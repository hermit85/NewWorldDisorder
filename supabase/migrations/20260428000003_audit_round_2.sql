-- ═══════════════════════════════════════════════════════════
-- Audit round 2 — independent cross-check by Codex on commit 50d5ce4
-- closed five gaps the round-1 audit missed:
--
--   1. fetch_scoped_leaderboard (today/weekend boards) wasn't pinned
--      to trails.current_version_id, so a baseline promote left the
--      board mixing v1 and v2 runs. all_time was already pinned via
--      leaderboard_entries; only the scoped variant was leaking.
--
--   2. promote_run_as_baseline could downgrade a live_confirmed
--      trail back to fresh_pending_second_run when the Pioneer
--      called the RPC directly with an old run id. The UI never
--      offers this path, but the RPC is callable. Now requires the
--      trail to be in calibration state, the run to be uncounted,
--      and the run to have failed *only* the consistency check.
--
--   3. submit_run set can_promote_baseline=true on every non-open
--      failure including weak GPS / corridor coverage / missing
--      checkpoints. UI then showed "use as new base" for runs that
--      had no business becoming baseline geometry. Tightened to
--      require server validation passed AND consistency check ran
--      AND failed.
--
--   4. submit_run trusted p_spot_id from the client. A buggy/
--      malicious client could pin a run for trail A under spot B,
--      desyncing venue activity. Now sourced from v_trail.spot_id.
--
--   5. Defensive backfill: ensure every active trail has a
--      current_version_id. mig 011 only backfilled trails with
--      geometry OR a pioneer; a draft flipped active without
--      finalize_seed_run would have hit the no_current_version
--      bail in submit_run. Live currently has zero orphans, but
--      this self-heals any future drift.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── 5. Defensive backfill (no-op on live as of 2026-04-25) ──

do $$
declare
  v_trail record;
  v_new_version_id uuid;
begin
  for v_trail in
    select id, geometry, pioneer_user_id, created_at
      from public.trails
     where current_version_id is null
       and is_active = true
  loop
    insert into public.trail_versions (
      trail_id, version_number, geometry, created_by, created_at, is_current
    ) values (
      v_trail.id,
      1,
      coalesce(v_trail.geometry, '{"points": []}'::jsonb),
      v_trail.pioneer_user_id,
      coalesce(v_trail.created_at, now()),
      true
    )
    returning id into v_new_version_id;

    update public.trails
       set current_version_id = v_new_version_id
     where id = v_trail.id;
  end loop;
end $$;

-- ─── 1. fetch_scoped_leaderboard: pin to current version ─────

create or replace function public.fetch_scoped_leaderboard(
  p_trail_id text,
  p_since timestamptz,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  trail_id text,
  best_duration_ms integer,
  rank_position integer,
  username text,
  display_name text,
  rank_id text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  with current_v as (
    -- One row, one column: the trail's live version. Used in the
    -- per-user-best CTE below as a CROSS JOIN — Postgres flattens
    -- this into a single bound parameter so the existing
    -- idx_runs_leaderboard composite index stays usable.
    select current_version_id
      from public.trails
     where id = p_trail_id
  ),
  per_user_best as (
    -- One row per user: their best counted time on this trail
    -- since cutoff, scoped to the live geometry version. After a
    -- baseline promote, prior-version runs are not comparable —
    -- they ran on different geometry — so we filter them out.
    select distinct on (r.user_id)
      r.user_id,
      r.trail_id,
      r.duration_ms
    from public.runs r
    cross join current_v
    where r.trail_id = p_trail_id
      and r.counted_in_leaderboard = true
      and r.started_at >= p_since
      and r.trail_version_id is not distinct from current_v.current_version_id
    order by r.user_id, r.duration_ms asc
  )
  select
    pu.user_id,
    pu.trail_id,
    pu.duration_ms::int                                              as best_duration_ms,
    (row_number() over (order by pu.duration_ms asc))::int           as rank_position,
    p.username,
    p.display_name,
    p.rank_id,
    p.avatar_url
  from per_user_best pu
  join public.profiles p on p.id = pu.user_id
  order by pu.duration_ms asc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

comment on function public.fetch_scoped_leaderboard(text, timestamptz, integer) is
  'Scoped leaderboard for a trail since cutoff, pinned to the trail''s current_version_id. Returns top p_limit unique riders by best counted duration_ms. Used by today/weekend boards.';

-- ─── 4. submit_run: ignore client spot_id, tighten promote gate ─

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
  v_can_promote        boolean := false;
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
    return jsonb_build_object('ok', false, 'code', 'no_current_version');
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

  -- AUDIT R2 #4: source spot_id from the trail row, not the client
  -- payload. p_spot_id is still accepted on the signature for
  -- backwards compatibility, but discarded here to prevent a
  -- run/spot mismatch leaking into venue activity feeds.
  insert into public.runs (
    user_id, spot_id, trail_id, trail_version_id, mode,
    started_at, finished_at, duration_ms,
    verification_status, verification_summary, gps_trace,
    is_pb, xp_awarded, counted_in_leaderboard
  ) values (
    v_user_id, v_trail.spot_id, p_trail_id, v_trail.current_version_id, p_mode,
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

  -- AUDIT R2 #3: a run can only become a baseline candidate when it
  -- passed every base validation gate AND only failed because of
  -- the consistency check. Weak-GPS / missing-checkpoint / coverage
  -- failures must not surface "use as new base" in the UI.
  v_can_promote := v_can_open
    and p_mode = 'ranked'
    and v_base_eligible
    and v_consistency_reason is not null
    and not v_trail_opened;

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
    'can_promote_baseline', v_can_promote,
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

-- ─── 2 + 3. promote_run_as_baseline: status + eligibility gates ─

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
  v_server_eligible boolean;
  v_consistency_ok  boolean;
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

  if v_run.trail_version_id is distinct from v_trail.current_version_id then
    return jsonb_build_object('ok', false, 'code', 'run_not_from_current_version');
  end if;

  -- AUDIT R2 #2 (primary gate): only a trail still pending its
  -- second consistent run is a re-baseline candidate. Without this
  -- a Pioneer could call the RPC directly on one of their old
  -- ranked runs and force a live_confirmed trail back to
  -- fresh_pending_second_run, nuking the live leaderboard.
  if v_trail.calibration_status not in ('fresh_pending_second_run', 'calibrating') then
    return jsonb_build_object('ok', false, 'code', 'trail_already_live');
  end if;

  -- AUDIT R2 #2 (belt-and-suspenders): a counted run is part of an
  -- active leaderboard scope. The status check above already covers
  -- this in practice (counted runs require live_* status), but we
  -- assert it explicitly to defend against future state machine
  -- drift.
  if v_run.counted_in_leaderboard then
    return jsonb_build_object('ok', false, 'code', 'run_counted_in_leaderboard');
  end if;

  -- AUDIT R2 #3: only runs that PASSED basic server validation
  -- (gate, corridor, GPS quality, checkpoints) can become the new
  -- baseline. A run that failed validation has bad geometry by
  -- definition and would poison the trail.
  v_server_eligible := coalesce(
    (v_run.verification_summary->'serverValidation'->>'eligible')::boolean,
    false
  );
  if not v_server_eligible then
    return jsonb_build_object('ok', false, 'code', 'run_not_eligible_baseline');
  end if;

  -- AUDIT R2 #3: the run must have failed *because* of consistency,
  -- not for some other reason. If consistency was OK (or never ran)
  -- there's nothing to re-baseline — promoting would be a side-step
  -- not a recovery.
  v_consistency_ok := coalesce(
    (v_run.verification_summary->'consistency'->>'ok')::boolean,
    true
  );
  if v_consistency_ok then
    return jsonb_build_object('ok', false, 'code', 'run_passed_consistency');
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
