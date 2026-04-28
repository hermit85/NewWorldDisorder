-- ═══════════════════════════════════════════════════════════════════
-- finalize_seed_run: persist canonical start_gate / finish_gate
--
-- Build 48 (TestFlight) shipped a feature gap discovered in field
-- testing on 2026-04-28 — when a second rider opens a freshly
-- pioneered trail on a different phone, ranked arming silently
-- rejects with "Jeszcze nie teraz" even when the rider is standing
-- at the start pin. Root cause: the per-trail gate (start line +
-- finish line) is derived client-side from the geometry, on every
-- device, every time, and the two devices disagree on where the
-- gate is.
--
-- The DB has had `fn_derive_start_gate(geometry, radius)` and the
-- finish counterpart since the route-identity phase, but
-- `finalize_seed_run` never wired them into the trail_versions
-- INSERTs. The columns existed (`start_gate`, `finish_gate`,
-- `route_corridor_radius_m`) but stayed NULL for every pioneer
-- finalisation.
--
-- This migration:
--   1. Replaces finalize_seed_run so both the `review` and `distinct`
--      branches populate start_gate + finish_gate from the geometry
--      via the existing helpers (radius 25 m, matches the helper
--      defaults). The `auto_merge` branch reuses an existing
--      trail_version so it already inherits gate data once that
--      version was finalised through this function.
--   2. Backfills any existing trail_versions row that has geometry
--      but missing gate data. WHERE clause guards both directions
--      (start NULL OR finish NULL) so a row with one side already
--      filled doesn't get clobbered. COALESCE preserves any value
--      that's already there.
--
-- Client read path is changed in the same build (api fetchTrailGeometry
-- returns server gates, resolveVenue prefers them) — without that
-- companion change this migration is observable but not yet
-- effective on the device.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.finalize_seed_run(
  p_trail_id text,
  p_geometry jsonb,
  p_duration_ms integer,
  p_gps_trace jsonb,
  p_median_accuracy_m real,
  p_quality_tier text,
  p_verification_status text,
  p_started_at timestamp with time zone,
  p_finished_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_user_id         uuid;
  v_user_role       text;
  v_is_curator      boolean;
  v_seed_source     seed_source;
  v_trail_row       public.trails%rowtype;
  v_version_id      uuid;
  v_run_id          uuid;
  v_point_count     integer;
  v_distance_m      real;
  v_min_duration_ms integer;
  v_min_distance_m  real;
  v_min_points      integer;
  v_max_accuracy_m  real;
  v_spot_status     text;
  v_spot_submitter  uuid;
  v_spot_flipped    boolean := false;
  v_overlap         record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_user_role from public.profiles where id = v_user_id;
  v_is_curator := coalesce(v_user_role, 'rider') in ('curator', 'moderator');

  if v_is_curator then
    v_min_duration_ms := 5000;
    v_min_distance_m  := 20;
    v_min_points      := 5;
    v_max_accuracy_m  := 50;
  else
    v_min_duration_ms := 30000;
    v_min_distance_m  := 150;
    v_min_points      := 15;
    v_max_accuracy_m  := 20;
  end if;

  select * into v_trail_row from public.trails where id = p_trail_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  if v_trail_row.pioneer_user_id is not null then
    return jsonb_build_object('ok', false, 'code', 'already_pioneered');
  end if;

  if v_trail_row.calibration_status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;

  select status, submitted_by
    into v_spot_status, v_spot_submitter
    from public.spots
   where id = v_trail_row.spot_id;

  if v_spot_status = 'pending'
     and not v_is_curator
     and v_spot_submitter is distinct from v_user_id then
    return jsonb_build_object('ok', false, 'code', 'pending_spot_forbidden');
  end if;

  if p_duration_ms < v_min_duration_ms then
    return jsonb_build_object('ok', false, 'code', 'too_short_duration',
      'observed', p_duration_ms, 'required', v_min_duration_ms);
  end if;

  v_distance_m := coalesce((p_geometry->'meta'->>'totalDistanceM')::real, 0);
  if v_distance_m < v_min_distance_m then
    return jsonb_build_object('ok', false, 'code', 'too_short_distance',
      'observed', v_distance_m, 'required', v_min_distance_m);
  end if;

  v_point_count := jsonb_array_length(p_geometry->'points');
  if v_point_count < v_min_points then
    return jsonb_build_object('ok', false, 'code', 'too_few_points',
      'observed', v_point_count, 'required', v_min_points);
  end if;

  if coalesce(p_median_accuracy_m, 999) > v_max_accuracy_m then
    return jsonb_build_object('ok', false, 'code', 'accuracy_too_poor_avg',
      'observed', p_median_accuracy_m, 'required', v_max_accuracy_m);
  end if;

  -- ── ADR-012 geo-overlap decision matrix ─────────────────────

  select trail_id, geometry_version_id, overlap_pct, decision_band
    into v_overlap
    from public.check_trail_overlap(v_trail_row.spot_id, p_geometry)
   order by overlap_pct desc
   limit 1;

  -- ── Branch 1: auto_merge ────────────────────────────────────
  -- Reuses an existing trail_version, which already has gate data
  -- (set when its source pioneer ran through this function). No
  -- change needed in this branch.
  if v_overlap.decision_band = 'auto_merge' then
    insert into public.runs (
      user_id, trail_id, spot_id, trail_version_id,
      duration_ms, gps_trace, verification_status,
      verification_summary,
      counted_in_leaderboard, is_pb, xp_awarded,
      started_at, finished_at, mode,
      matched_geometry_version_id, match_score, recording_mode
    ) values (
      v_user_id, v_overlap.trail_id, v_trail_row.spot_id, v_overlap.geometry_version_id,
      p_duration_ms, p_gps_trace, p_verification_status,
      jsonb_build_object(
        'quality_tier',           p_quality_tier,
        'median_accuracy_m',      p_median_accuracy_m,
        'auto_merged_from_draft', p_trail_id,
        'overlap_pct',            v_overlap.overlap_pct
      ),
      true, false, 25,
      p_started_at, p_finished_at, 'ranked',
      v_overlap.geometry_version_id, v_overlap.overlap_pct, 'normal'
    )
    returning id into v_run_id;

    update public.profiles
       set xp = xp + 25, updated_at = now()
     where id = v_user_id;

    delete from public.trails where id = p_trail_id;

    return jsonb_build_object(
      'ok',                      true,
      'auto_merged',             true,
      'into_trail_id',           v_overlap.trail_id,
      'overlap_pct',             v_overlap.overlap_pct,
      'run_id',                  v_run_id,
      'is_pioneer',              false,
      'archived_draft_trail_id', p_trail_id,
      'spot_auto_activated',     false
    );
  end if;

  -- ── Branch 2: review ────────────────────────────────────────
  -- Inserts a new trail_version (status=candidate). MUST populate
  -- gate data so that if a curator later promotes this candidate
  -- to canonical, the gate is already available.
  if v_overlap.decision_band = 'review' then
    insert into public.trail_versions (
      trail_id, version_number, geometry, created_by, is_current,
      status, source_type, source_user_id,
      confidence_score, direction_type,
      start_gate, finish_gate
    ) values (
      p_trail_id, 1, p_geometry, v_user_id, false,
      'candidate', 'pioneer', v_user_id,
      0.350, 'descending',
      public.fn_derive_start_gate(p_geometry, 25),
      public.fn_derive_finish_gate(p_geometry, 25)
    )
    returning id into v_version_id;

    insert into public.runs (
      user_id, trail_id, spot_id, trail_version_id,
      duration_ms, gps_trace, verification_status,
      verification_summary,
      counted_in_leaderboard, is_pb, xp_awarded,
      started_at, finished_at, mode,
      matched_geometry_version_id, match_score,
      recording_mode, rejection_reason
    ) values (
      v_user_id, p_trail_id, v_trail_row.spot_id, v_version_id,
      p_duration_ms, p_gps_trace, p_verification_status,
      jsonb_build_object(
        'quality_tier',      p_quality_tier,
        'median_accuracy_m', p_median_accuracy_m,
        'overlap_review',    true,
        'similar_trail_id',  v_overlap.trail_id,
        'overlap_pct',       v_overlap.overlap_pct
      ),
      false, false, 0,
      p_started_at, p_finished_at, 'ranked',
      v_version_id, v_overlap.overlap_pct,
      'pioneer', 'overlap_review_pending'
    )
    returning id into v_run_id;

    update public.trail_versions
       set source_run_id = v_run_id
     where id = v_version_id;

    insert into public.route_review_queue (
      trail_id, candidate_geometry_version_id, reason, severity, details
    ) values (
      p_trail_id, v_version_id, 'overlap_conflict', 'high',
      jsonb_build_object(
        'similar_trail_id', v_overlap.trail_id,
        'overlap_pct',      v_overlap.overlap_pct,
        'pioneer_user_id',  v_user_id,
        'pioneer_run_id',   v_run_id
      )
    );

    return jsonb_build_object(
      'ok',               false,
      'code',             'overlap_review_pending',
      'similar_trail_id', v_overlap.trail_id,
      'overlap_pct',      v_overlap.overlap_pct,
      'run_id',           v_run_id,
      'is_pioneer',       false
    );
  end if;

  -- ── Branch 3: distinct (or no overlap) — primary pioneer flow ──
  -- This is the path that hits when a fresh trail has no overlap
  -- with anything. The result is a canonical trail_version that
  -- every subsequent ranked attempt on this trail measures against.
  -- Gate data MUST be populated here — otherwise every other rider
  -- has to derive it client-side and they all disagree.
  v_seed_source := case
    when v_is_curator then 'curator'::seed_source
    else 'rider'::seed_source
  end;

  insert into public.trail_versions (
    trail_id, version_number, geometry, created_by, is_current,
    status, source_type, source_user_id,
    confidence_score, direction_type, became_canonical_at,
    start_gate, finish_gate
  ) values (
    p_trail_id, 1, p_geometry, v_user_id, true,
    'canonical', 'pioneer', v_user_id,
    0.350, 'descending', now(),
    public.fn_derive_start_gate(p_geometry, 25),
    public.fn_derive_finish_gate(p_geometry, 25)
  )
  returning id into v_version_id;

  update public.trails set
    pioneer_user_id                = v_user_id,
    pioneered_at                   = now(),
    geometry                       = p_geometry,
    calibration_status             = 'fresh_pending_second_run',
    confidence_label               = 'fresh',
    consistent_pioneer_runs_count  = 1,
    unique_confirming_riders_count = 0,
    seed_source                    = v_seed_source,
    trust_tier                     = 'provisional',
    current_version_id             = v_version_id,
    is_active                      = true,
    runs_contributed               = 1
  where id = p_trail_id;

  if v_spot_status = 'pending' and v_spot_submitter = v_user_id then
    update public.spots
       set status      = 'active',
           is_active   = true,
           approved_by = v_user_id,
           approved_at = now()
     where id = v_trail_row.spot_id
       and status = 'pending';
    v_spot_flipped := true;
  end if;

  insert into public.runs (
    user_id, trail_id, spot_id, trail_version_id,
    duration_ms, gps_trace, verification_status,
    verification_summary,
    counted_in_leaderboard, is_pb, xp_awarded,
    started_at, finished_at, mode,
    matched_geometry_version_id, match_score, recording_mode
  ) values (
    v_user_id, p_trail_id, v_trail_row.spot_id, v_version_id,
    p_duration_ms, p_gps_trace, p_verification_status,
    jsonb_build_object(
      'quality_tier',      p_quality_tier,
      'median_accuracy_m', p_median_accuracy_m,
      'seed_run',          true
    ),
    false, false, 100,
    p_started_at, p_finished_at, 'ranked',
    v_version_id, 1.000, 'pioneer'
  )
  returning id into v_run_id;

  update public.trail_versions
     set source_run_id = v_run_id
   where id = v_version_id;

  update public.profiles
     set xp = xp + 100, updated_at = now()
   where id = v_user_id;

  return jsonb_build_object(
    'ok',                   true,
    'run_id',               v_run_id,
    'seed_source',          v_seed_source::text,
    'trust_tier',           'provisional',
    'version_id',           v_version_id,
    'is_pioneer',           true,
    'trail_status',         'fresh_pending_second_run',
    'leaderboard_position', null,
    'spot_auto_activated',  v_spot_flipped
  );
end;
$function$;

-- ── Backfill existing rows ──────────────────────────────────────
-- Repairs trail_versions rows pioneered before this migration.
-- COALESCE preserves any pre-existing gate value (unlikely but
-- possible if hand-set), so a row with one side filled won't get
-- the other side clobbered. Helpers return NULL for malformed
-- geometry (jsonb_typeof <> 'array' or count < 2), so the UPDATE
-- self-no-ops on bad data.
UPDATE public.trail_versions
SET
  start_gate  = COALESCE(start_gate,  public.fn_derive_start_gate(geometry, 25)),
  finish_gate = COALESCE(finish_gate, public.fn_derive_finish_gate(geometry, 25))
WHERE geometry IS NOT NULL
  AND geometry ? 'points'
  AND (start_gate IS NULL OR finish_gate IS NULL);
