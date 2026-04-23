-- ═══════════════════════════════════════════════════════════
-- Use ROW_COUNT to report spot_auto_activated truthfully
--
-- Codex round 2 P2 (`20260423190000_seed_run_self_active_flow`):
-- the returned `spot_auto_activated` flag was set to `true`
-- whenever the pre-read saw `status='pending'`, even if the
-- guarded `UPDATE ... WHERE status='pending'` affected zero rows
-- because another concurrent finalize_seed_run had already
-- flipped the spot. DB state stays correct in that race, but the
-- client receives a celebratory flag from the losing transaction
-- — analytics + any future "park dołączył do ligi" toast fire on
-- the wrong run.
--
-- Fix: set the flag from the UPDATE's ROW_COUNT. Only the
-- transaction that actually changed the row claims the publish.
-- Everything else returns v_spot_flipped=false, which is the
-- honest answer ("I rode, the park was already active").
--
-- Idempotent: CREATE OR REPLACE. The function body is identical
-- to 20260423190000 except for the flag-setting block at the end
-- of the spot-flip section.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.finalize_seed_run(
  p_trail_id            text,
  p_geometry            jsonb,
  p_duration_ms         integer,
  p_gps_trace           jsonb,
  p_median_accuracy_m   real,
  p_quality_tier        text,
  p_verification_status text,
  p_started_at          timestamp with time zone,
  p_finished_at         timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_spot_rows       integer;
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

  if p_duration_ms < v_min_duration_ms then
    return jsonb_build_object('ok', false, 'code', 'too_short_duration', 'observed', p_duration_ms, 'required', v_min_duration_ms);
  end if;

  v_distance_m := coalesce((p_geometry->'meta'->>'totalDistanceM')::real, 0);
  if v_distance_m < v_min_distance_m then
    return jsonb_build_object('ok', false, 'code', 'too_short_distance', 'observed', v_distance_m, 'required', v_min_distance_m);
  end if;

  v_point_count := jsonb_array_length(p_geometry->'points');
  if v_point_count < v_min_points then
    return jsonb_build_object('ok', false, 'code', 'too_few_points', 'observed', v_point_count, 'required', v_min_points);
  end if;

  if coalesce(p_median_accuracy_m, 999) > v_max_accuracy_m then
    return jsonb_build_object('ok', false, 'code', 'accuracy_too_poor_avg', 'observed', p_median_accuracy_m, 'required', v_max_accuracy_m);
  end if;

  v_seed_source := case when v_is_curator then 'curator'::seed_source else 'rider'::seed_source end;

  insert into public.trail_versions (trail_id, version_number, geometry, created_by, is_current)
  values (p_trail_id, 1, p_geometry, v_user_id, true)
  returning id into v_version_id;

  update public.trails set
    pioneer_user_id    = v_user_id,
    pioneered_at       = now(),
    geometry           = p_geometry,
    calibration_status = 'calibrating',
    seed_source        = v_seed_source,
    trust_tier         = 'provisional',
    current_version_id = v_version_id,
    is_active          = true,
    runs_contributed   = 1
  where id = p_trail_id;

  -- Submitter-self-active spot flip.
  --
  -- ROW_COUNT check means only the transaction that actually
  -- flipped the row claims `spot_auto_activated=true`. A concurrent
  -- pioneer run on a *different* trail under the same park would
  -- also see status='pending' in its own pre-read, but only one
  -- update fires the flip — the loser sees 0 rows affected and
  -- honestly returns false.
  select status, submitted_by
    into v_spot_status, v_spot_submitter
    from public.spots
   where id = v_trail_row.spot_id;
  if v_spot_status = 'pending' and v_spot_submitter = v_user_id then
    update public.spots
       set status      = 'active',
           is_active   = true,
           approved_by = v_user_id,
           approved_at = now()
     where id = v_trail_row.spot_id
       and status = 'pending';
    GET DIAGNOSTICS v_spot_rows = ROW_COUNT;
    v_spot_flipped := v_spot_rows > 0;
  end if;

  insert into public.runs (
    user_id, trail_id, spot_id, trail_version_id,
    duration_ms, gps_trace, verification_status,
    verification_summary,
    counted_in_leaderboard, is_pb,
    started_at, finished_at, mode
  ) values (
    v_user_id, p_trail_id, v_trail_row.spot_id, v_version_id,
    p_duration_ms, p_gps_trace, p_verification_status,
    jsonb_build_object('quality_tier', p_quality_tier, 'median_accuracy_m', p_median_accuracy_m),
    true, true,
    p_started_at, p_finished_at, 'ranked'
  )
  returning id into v_run_id;

  insert into public.leaderboard_entries (
    trail_id, user_id, trail_version_id,
    period_type, rank_position, best_duration_ms, run_id
  ) values (
    p_trail_id, v_user_id, v_version_id,
    'all_time', 1, p_duration_ms, v_run_id
  );

  return jsonb_build_object(
    'ok',                   true,
    'run_id',               v_run_id,
    'seed_source',          v_seed_source::text,
    'trust_tier',           'provisional',
    'version_id',           v_version_id,
    'is_pioneer',           true,
    'leaderboard_position', 1,
    'spot_auto_activated',  v_spot_flipped
  );
end;
$function$;
