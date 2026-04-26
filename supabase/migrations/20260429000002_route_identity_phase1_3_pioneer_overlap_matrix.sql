-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 1.3 — geo-overlap decision matrix in pioneer flow
--
-- Modifies finalize_seed_run (the live pioneer-finalize RPC; the
-- legacy finalize_pioneer_run from migration 008/20260423180000
-- stays untouched, no longer called from the client). After all
-- existing validation gates pass, the candidate geometry is
-- compared against canonical-status trail_versions in the same
-- spot via check_trail_overlap (Phase 1.2). The top match's
-- decision_band selects one of three branches:
--
--   auto_merge (>=85%):
--     The candidate line is essentially the existing trail. Insert
--     the run into the existing trail's leaderboard with
--     matched_geometry_version_id = canonical version, recording
--     mode 'normal' (rider isn't pioneer of a new trail), small XP.
--     Drop the orphan draft trail row that create_trail produced.
--
--   review (60–85%):
--     Looks like the existing trail but not enough to merge. Park
--     the candidate as a non-canonical trail_version (status
--     'candidate'), log run as not-counted with rejection_reason
--     'overlap_review_pending', insert into route_review_queue.
--     Trail stays in draft so a curator can decide.
--
--   distinct (<60%, or no overlap):
--     Existing pioneer flow — insert canonical trail_version, flip
--     trail to fresh_pending_second_run, count run as pioneer.
--
-- All pre-Phase-1.3 callers see the same successful payload shape
-- on the distinct path. Auto-merge and review paths add new
-- response keys (auto_merged / similar_trail_id / overlap_pct).
--
-- Applied to prod 2026-04-26 via Supabase MCP as migration version
-- 20260426091400; this file mirrors that schema.
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.finalize_seed_run(
  p_trail_id            text,
  p_geometry            jsonb,
  p_duration_ms         integer,
  p_gps_trace           jsonb,
  p_median_accuracy_m   real,
  p_quality_tier        text,
  p_verification_status text,
  p_started_at          timestamp with time zone,
  p_finished_at         timestamp with time zone
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
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

    -- Drop the orphan draft trail. create_trail already inserted
    -- the row before pioneer rode; auto-merge means we never
    -- claim it as a separate trail.
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
  if v_overlap.decision_band = 'review' then
    insert into public.trail_versions (
      trail_id, version_number, geometry, created_by, is_current,
      status, source_type, source_user_id,
      confidence_score, direction_type
    ) values (
      p_trail_id, 1, p_geometry, v_user_id, false,
      'candidate', 'pioneer', v_user_id,
      0.350, 'descending'
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

  -- ── Branch 3: distinct (or no overlap) — existing flow ──────

  v_seed_source := case
    when v_is_curator then 'curator'::seed_source
    else 'rider'::seed_source
  end;

  insert into public.trail_versions (
    trail_id, version_number, geometry, created_by, is_current,
    status, source_type, source_user_id,
    confidence_score, direction_type, became_canonical_at
  ) values (
    p_trail_id, 1, p_geometry, v_user_id, true,
    'canonical', 'pioneer', v_user_id,
    0.350, 'descending', now()
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
$$;

revoke all on function public.finalize_seed_run(
  text, jsonb, integer, jsonb, real, text, text, timestamptz, timestamptz
) from public;
grant execute on function public.finalize_seed_run(
  text, jsonb, integer, jsonb, real, text, text, timestamptz, timestamptz
) to authenticated;

commit;
