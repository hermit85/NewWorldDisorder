-- ═══════════════════════════════════════════════════════════
-- Two-run blocker fixes
--
-- Fixes:
--   1. Consistent count only includes the seed run + counted runs.
--      Failed consistency Pioneer runs no longer open the trail.
--   2. delete_run can downgrade a trail back to pending-second-run.
--   3. Opening the leaderboard grants +300 XP server-side.
--   4. Pioneer can promote their own run as a new baseline version.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── Confidence recompute: no failed-run backdoor ──────────

create or replace function public.recompute_trail_confidence(
  p_trail_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trail public.trails%rowtype;
  v_consistent integer;
  v_unique integer;
  v_status text;
  v_label text;
begin
  select * into v_trail
    from public.trails
   where id = p_trail_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  select
    count(*) filter (
      where r.mode = 'ranked'
        and (
          coalesce((r.verification_summary->>'seed_run')::boolean, false) = true
          or (
            r.verification_status = 'verified'
            and r.counted_in_leaderboard = true
          )
        )
    ),
    count(distinct r.user_id) filter (where r.counted_in_leaderboard = true)
    into v_consistent, v_unique
    from public.runs r
   where r.trail_id = p_trail_id
     and r.trail_version_id is not distinct from v_trail.current_version_id;

  if v_trail.calibration_status = 'draft' then
    v_status := 'draft';
    v_label := null;
  elsif coalesce(v_consistent, 0) < 2 then
    v_status := 'fresh_pending_second_run';
    v_label := 'fresh';
  elsif coalesce(v_consistent, 0) >= 10 then
    v_status := 'stable';
    v_label := 'stable';
  elsif coalesce(v_consistent, 0) >= 5 then
    v_status := 'live_confirmed';
    v_label := 'confirmed';
  elsif coalesce(v_unique, 0) >= 3 then
    v_status := 'live_confirmed';
    v_label := 'community_checked';
  else
    v_status := 'live_fresh';
    v_label := 'fresh';
  end if;

  update public.trails
     set calibration_status = v_status,
         confidence_label = v_label,
         consistent_pioneer_runs_count = coalesce(v_consistent, 0),
         unique_confirming_riders_count = coalesce(v_unique, 0)
   where id = p_trail_id;

  return jsonb_build_object(
    'ok', true,
    'calibration_status', v_status,
    'confidence_label', v_label,
    'consistent_runs', coalesce(v_consistent, 0),
    'unique_riders', coalesce(v_unique, 0)
  );
end;
$$;

-- Re-evaluate rows affected by the previous backdoor logic.
do $$
declare
  v_trail_id text;
begin
  for v_trail_id in
    select id
      from public.trails
     where calibration_status <> 'draft'
  loop
    perform public.recompute_trail_confidence(v_trail_id);
  end loop;
end;
$$;

-- ─── submit_run: open bonus + better failed-open payload ───

create or replace function public.submit_run(
  p_spot_id text,
  p_trail_id text,
  p_mode text,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_duration_ms integer,
  p_verification_status text,
  p_verification_summary jsonb,
  p_gps_trace jsonb,
  p_xp_awarded integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id            uuid := auth.uid();
  v_elapsed_ms         integer;
  v_invalidation       text[] := array[]::text[];
  v_client_eligible    boolean;
  v_coverage           numeric;
  v_accuracy           numeric;
  v_cp_passed          integer;
  v_cp_total           integer;
  v_accepted_via       text;
  v_base_eligible      boolean := false;
  v_eligible           boolean := false;
  v_previous_best_ms   integer;
  v_is_pb              boolean := false;
  v_run_row            public.runs%rowtype;
  v_lb                 jsonb;
  v_summary_out        jsonb;
  v_trail              public.trails%rowtype;
  v_consistency        jsonb;
  v_confidence         jsonb;
  v_can_rank           boolean := false;
  v_can_open           boolean := false;
  v_trail_opened       boolean := false;
  v_consistency_reason text;
  v_open_bonus_xp      integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  if p_mode not in ('ranked', 'practice') then
    return jsonb_build_object('ok', false, 'code', 'invalid_mode');
  end if;

  select * into v_trail
    from public.trails
   where id = p_trail_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  if v_trail.current_version_id is null then
    v_invalidation := v_invalidation || 'no_current_version';
  end if;

  v_can_rank := v_trail.calibration_status in (
    'live_fresh', 'live_confirmed', 'stable', 'verified', 'locked'
  );
  v_can_open := v_trail.calibration_status in (
    'fresh_pending_second_run', 'calibrating'
  ) and v_trail.pioneer_user_id = v_user_id;

  if p_duration_ms is null or p_duration_ms < 5000 then
    v_invalidation := v_invalidation || 'duration_too_short';
  end if;
  if p_duration_ms > 14400000 then
    v_invalidation := v_invalidation || 'duration_too_long';
  end if;

  v_elapsed_ms := (extract(epoch from (p_finished_at - p_started_at)) * 1000)::integer;
  if abs(coalesce(v_elapsed_ms, -1) - coalesce(p_duration_ms, -1)) > 2000 then
    v_invalidation := v_invalidation || 'timestamp_mismatch';
  end if;

  if p_mode = 'ranked' and array_length(v_invalidation, 1) is null then
    v_client_eligible := coalesce(
      (p_verification_summary->>'isLeaderboardEligible')::boolean, false);
    v_coverage := coalesce(
      (p_verification_summary->'corridor'->>'coveragePercent')::numeric, 0);
    v_accuracy := coalesce(
      (p_verification_summary->>'avgAccuracyM')::numeric, 999);
    v_cp_passed := coalesce(
      (p_verification_summary->>'checkpointsPassed')::integer, 0);
    v_cp_total := coalesce(
      (p_verification_summary->>'checkpointsTotal')::integer, -1);
    v_accepted_via := coalesce(p_verification_summary->>'acceptedVia', '');

    if p_verification_status <> 'verified' then
      v_invalidation := v_invalidation || 'status_not_verified';
    end if;
    if not v_client_eligible then
      v_invalidation := v_invalidation || 'client_not_eligible';
    end if;
    if v_coverage < 70 then
      v_invalidation := v_invalidation || 'corridor_coverage_low';
    end if;
    if v_accuracy > 20 then
      v_invalidation := v_invalidation || 'gps_accuracy_weak';
    end if;
    if v_cp_total <= 0 or v_cp_passed < v_cp_total then
      v_invalidation := v_invalidation || 'checkpoints_incomplete';
    end if;
    if v_accepted_via not in ('gate_cross', 'corridor_rescue') then
      v_invalidation := v_invalidation || 'accepted_via_invalid';
    end if;
    if not (v_can_rank or v_can_open) then
      v_invalidation := v_invalidation || 'trail_pending_second_run';
    end if;

    v_base_eligible := array_length(v_invalidation, 1) is null;
  end if;

  if v_base_eligible then
    select best_duration_ms
      into v_previous_best_ms
      from public.leaderboard_entries
     where user_id = v_user_id
       and trail_id = p_trail_id
       and trail_version_id is not distinct from v_trail.current_version_id
       and period_type = 'all_time';
    v_is_pb := v_previous_best_ms is null or p_duration_ms < v_previous_best_ms;
  end if;

  v_summary_out := coalesce(p_verification_summary, '{}'::jsonb)
    || jsonb_build_object(
      'serverValidation', jsonb_build_object(
        'eligible', v_base_eligible,
        'reasons', to_jsonb(v_invalidation),
        'validatedAt', now()
      )
    );

  insert into public.runs (
    user_id, spot_id, trail_id, trail_version_id, mode,
    started_at, finished_at, duration_ms,
    verification_status, verification_summary, gps_trace,
    is_pb, xp_awarded, counted_in_leaderboard
  ) values (
    v_user_id, p_spot_id, p_trail_id, v_trail.current_version_id, p_mode,
    p_started_at, p_finished_at, p_duration_ms,
    p_verification_status, v_summary_out, p_gps_trace,
    false, coalesce(p_xp_awarded, 0), false
  )
  returning * into v_run_row;

  if v_base_eligible then
    v_consistency := public.check_run_consistency(v_run_row.id, p_trail_id);
    if coalesce((v_consistency->>'ok')::boolean, false) then
      v_eligible := true;
      update public.runs
         set counted_in_leaderboard = true,
             is_pb = v_is_pb
       where id = v_run_row.id
       returning * into v_run_row;

      update public.trails
         set runs_contributed = coalesce(runs_contributed, 0) + 1
       where id = p_trail_id;

      v_lb := public.upsert_leaderboard_entry(
        v_user_id,
        p_trail_id,
        v_trail.current_version_id,
        'all_time',
        p_duration_ms,
        v_run_row.id
      );

      v_confidence := public.recompute_trail_confidence(p_trail_id);
      v_trail_opened := v_can_open
        and coalesce(v_confidence->>'calibration_status', '') in ('live_fresh', 'live_confirmed', 'stable');

      if v_trail_opened then
        v_open_bonus_xp := 300;
        update public.runs
           set xp_awarded = coalesce(xp_awarded, 0) + v_open_bonus_xp
         where id = v_run_row.id
         returning * into v_run_row;

        update public.profiles
           set xp = xp + v_open_bonus_xp,
               updated_at = now()
         where id = v_user_id;
      end if;
    else
      v_consistency_reason := coalesce(v_consistency->>'reason', 'consistency_failed');
      v_summary_out := v_summary_out || jsonb_build_object(
        'consistency', v_consistency
      );
      update public.runs
         set verification_summary = v_summary_out
       where id = v_run_row.id
       returning * into v_run_row;
      v_invalidation := v_invalidation || v_consistency_reason;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'run', row_to_json(v_run_row),
    'eligible', v_eligible,
    'invalidation_reasons', to_jsonb(v_invalidation),
    'leaderboard', v_lb,
    'is_pb', v_is_pb and v_eligible,
    'previous_best_ms', v_previous_best_ms,
    'trail_opened', v_trail_opened,
    'trail_open_failed', v_can_open and p_mode = 'ranked' and not v_trail_opened,
    'can_promote_baseline', v_can_open and p_mode = 'ranked' and not v_trail_opened,
    'consistency_reason', v_consistency_reason,
    'open_bonus_xp', v_open_bonus_xp,
    'trail_status', coalesce(v_confidence->>'calibration_status', v_trail.calibration_status),
    'confidence_label', v_confidence->>'confidence_label'
  );
end;
$$;

revoke all on function public.submit_run(
  text, text, text, timestamptz, timestamptz, integer, text, jsonb, jsonb, integer
) from public;
grant execute on function public.submit_run(
  text, text, text, timestamptz, timestamptz, integer, text, jsonb, jsonb, integer
) to authenticated;

-- ─── promote_run_as_baseline ───────────────────────────────

create or replace function public.promote_run_as_baseline(
  p_run_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.runs%rowtype;
  v_trail public.trails%rowtype;
  v_current_version public.trail_versions%rowtype;
  v_new_version_id uuid;
  v_new_version_number integer;
  v_points jsonb;
  v_geometry_points jsonb;
  v_point_count integer;
  v_total_distance_m double precision := 0;
  v_prev jsonb;
  v_curr jsonb;
  i integer;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select * into v_run
    from public.runs
   where id = p_run_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'run_not_found');
  end if;

  select * into v_trail
    from public.trails
   where id = v_run.trail_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  if v_trail.pioneer_user_id is distinct from v_user_id
     or v_run.user_id is distinct from v_user_id then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;

  if v_trail.current_version_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_current_version');
  end if;

  v_points := coalesce(v_run.gps_trace->'sampledPoints', '[]'::jsonb);
  v_point_count := jsonb_array_length(v_points);

  if v_point_count < 10 then
    return jsonb_build_object('ok', false, 'code', 'too_few_points');
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'lat', (p.value->>'lat')::double precision,
      'lng', (p.value->>'lng')::double precision,
      'alt', null,
      't', coalesce((p.value->>'t')::double precision, 0)
    )
    order by p.ordinality
  )
    into v_geometry_points
    from jsonb_array_elements(v_points) with ordinality as p(value, ordinality)
   where p.value ? 'lat'
     and p.value ? 'lng'
     and (p.value->>'lat') is not null
     and (p.value->>'lng') is not null;

  if jsonb_array_length(coalesce(v_geometry_points, '[]'::jsonb)) < 10 then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;

  for i in 1..(jsonb_array_length(v_geometry_points) - 1) loop
    v_prev := v_geometry_points->(i - 1);
    v_curr := v_geometry_points->i;
    v_total_distance_m := v_total_distance_m + public.gps_distance_m(
      (v_prev->>'lat')::double precision,
      (v_prev->>'lng')::double precision,
      (v_curr->>'lat')::double precision,
      (v_curr->>'lng')::double precision
    );
  end loop;

  select * into v_current_version
    from public.trail_versions
   where id = v_trail.current_version_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_current_version');
  end if;

  v_new_version_number := v_current_version.version_number + 1;

  update public.trail_versions
     set is_current = false,
         superseded_at = now()
   where id = v_current_version.id;

  insert into public.trail_versions (
    trail_id, version_number, geometry, created_by, is_current
  ) values (
    v_trail.id,
    v_new_version_number,
    jsonb_build_object(
      'version', 1,
      'points', v_geometry_points,
      'meta', jsonb_build_object(
        'totalDistanceM', v_total_distance_m,
        'totalDescentM', 0,
        'durationS', greatest(coalesce(v_run.duration_ms, 0), 0) / 1000.0,
        'medianAccuracyM', coalesce((v_run.verification_summary->>'avgAccuracyM')::numeric, 0),
        'pioneerRunId', v_run.id::text,
        'promotedFromRunId', v_run.id::text
      )
    ),
    v_user_id,
    true
  )
  returning id into v_new_version_id;

  update public.trail_versions
     set superseded_by_version_id = v_new_version_id
   where id = v_current_version.id;

  delete from public.leaderboard_entries
   where run_id = v_run.id;

  update public.runs
     set trail_version_id = v_new_version_id,
         counted_in_leaderboard = false,
         is_pb = false,
         verification_summary = coalesce(verification_summary, '{}'::jsonb)
           || jsonb_build_object(
             'seed_run', true,
             'promoted_baseline', true
           )
   where id = v_run.id;

  update public.trails
     set current_version_id = v_new_version_id,
         geometry = (
           select geometry
             from public.trail_versions
            where id = v_new_version_id
         ),
         calibration_status = 'fresh_pending_second_run',
         confidence_label = 'fresh',
         consistent_pioneer_runs_count = 1,
         unique_confirming_riders_count = 0,
         runs_contributed = 1,
         trust_tier = 'provisional'
   where id = v_trail.id;

  return jsonb_build_object(
    'ok', true,
    'trail_id', v_trail.id,
    'run_id', v_run.id,
    'new_version_id', v_new_version_id,
    'new_version_number', v_new_version_number,
    'trail_status', 'fresh_pending_second_run'
  );
end;
$$;

revoke all on function public.promote_run_as_baseline(uuid) from public;
grant execute on function public.promote_run_as_baseline(uuid) to authenticated;

commit;
