-- ═══════════════════════════════════════════════════════════
-- Two-run Pioneer unlock + current-version leaderboards
--
-- Product rule:
--   1. First Pioneer run creates v1 geometry but does not open the
--      public leaderboard.
--   2. A second consistent Pioneer run opens the leaderboard.
--   3. Later counted runs raise trail confidence.
--   4. Every leaderboard row is scoped to a concrete trail_version_id.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── Trail lifecycle columns ───────────────────────────────

alter table public.trails
  drop constraint if exists trails_calibration_status_check;

alter table public.trails
  add constraint trails_calibration_status_check
  check (
    calibration_status in (
      'draft',
      'fresh_pending_second_run',
      'live_fresh',
      'live_confirmed',
      'stable',
      -- Legacy statuses kept readable during rollout/backfill.
      'calibrating',
      'verified',
      'locked'
    )
  );

alter table public.trails
  add column if not exists confidence_label text,
  add column if not exists consistent_pioneer_runs_count integer not null default 0,
  add column if not exists unique_confirming_riders_count integer not null default 0;

alter table public.trails
  drop constraint if exists trails_confidence_label_check;

alter table public.trails
  add constraint trails_confidence_label_check
  check (
    confidence_label is null
    or confidence_label in ('fresh', 'confirmed', 'community_checked', 'stable')
  );

-- Existing data: keep user-visible shock low. If an old calibrating trail
-- already has at least two counted ranked runs, treat it as freshly live.
with current_counts as (
  select
    t.id,
    count(r.id) filter (
      where r.trail_version_id is not distinct from t.current_version_id
        and r.mode = 'ranked'
        and r.verification_status = 'verified'
        and r.counted_in_leaderboard = true
    ) as counted_runs,
    count(distinct r.user_id) filter (
      where r.trail_version_id is not distinct from t.current_version_id
        and r.counted_in_leaderboard = true
    ) as unique_riders
  from public.trails t
  left join public.runs r on r.trail_id = t.id
  group by t.id
)
update public.trails t
   set calibration_status = case
         when t.calibration_status = 'calibrating' and coalesce(c.counted_runs, 0) >= 2
           then 'live_fresh'
         when t.calibration_status = 'calibrating'
           then 'fresh_pending_second_run'
         when t.calibration_status = 'verified'
           then 'live_confirmed'
         when t.calibration_status = 'locked'
           then 'stable'
         else t.calibration_status
       end,
       consistent_pioneer_runs_count = greatest(coalesce(t.consistent_pioneer_runs_count, 0), coalesce(c.counted_runs, 0)),
       unique_confirming_riders_count = greatest(coalesce(t.unique_confirming_riders_count, 0), coalesce(c.unique_riders, 0)),
       confidence_label = case
         when t.calibration_status = 'locked' or coalesce(c.counted_runs, 0) >= 10 then 'stable'
         when t.calibration_status = 'verified' or coalesce(c.counted_runs, 0) >= 5 then 'confirmed'
         when coalesce(c.unique_riders, 0) >= 3 then 'community_checked'
         when t.calibration_status <> 'draft' then 'fresh'
         else null
       end
  from current_counts c
 where c.id = t.id;

-- ─── Version-scoped leaderboard foundation ─────────────────

-- Backfill any rows that missed mig 011 attachment.
update public.runs r
   set trail_version_id = t.current_version_id
  from public.trails t
 where r.trail_id = t.id
   and r.trail_version_id is null
   and t.current_version_id is not null;

update public.leaderboard_entries le
   set trail_version_id = coalesce(
     (select r.trail_version_id from public.runs r where r.id = le.run_id),
     t.current_version_id
   )
  from public.trails t
 where le.trail_id = t.id
   and le.trail_version_id is null
   and coalesce(
     (select r.trail_version_id from public.runs r where r.id = le.run_id),
     t.current_version_id
   ) is not null;

alter table public.leaderboard_entries
  drop constraint if exists leaderboard_entries_user_id_trail_id_period_type_key;

alter table public.leaderboard_entries
  drop constraint if exists leaderboard_entries_user_trail_version_period_key;

alter table public.leaderboard_entries
  add constraint leaderboard_entries_user_trail_version_period_key
  unique (user_id, trail_id, trail_version_id, period_type);

create index if not exists idx_leaderboard_trail_version_period
  on public.leaderboard_entries(trail_id, trail_version_id, period_type, rank_position);

create index if not exists idx_runs_leaderboard_version
  on public.runs(trail_id, trail_version_id, counted_in_leaderboard, duration_ms);

-- Leaderboard writes now belong exclusively to SECURITY DEFINER RPCs.
drop policy if exists "Users can upsert own leaderboard entries" on public.leaderboard_entries;
drop policy if exists "Users can update own leaderboard entries" on public.leaderboard_entries;

-- ─── Small geo helper for server trace sanity ───────────────

create or replace function public.gps_distance_m(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
) returns double precision
language sql
immutable
as $$
  select 6371000.0 * 2.0 * asin(
    least(1.0, sqrt(
      power(sin(radians(($3 - $1) / 2.0)), 2)
      + cos(radians($1)) * cos(radians($3))
        * power(sin(radians(($4 - $2) / 2.0)), 2)
    ))
  );
$$;

create or replace function public.check_run_consistency(
  p_run_id uuid,
  p_trail_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.runs%rowtype;
  v_points jsonb;
  v_count integer;
  v_prev jsonb;
  v_curr jsonb;
  v_dt_s double precision;
  v_dist_m double precision;
  v_speed_kmh double precision;
  i integer;
begin
  select * into v_run
    from public.runs
   where id = p_run_id
     and trail_id = p_trail_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'run_not_found');
  end if;

  if v_run.mode <> 'ranked' or v_run.verification_status <> 'verified' then
    return jsonb_build_object('ok', false, 'reason', 'not_verified_ranked');
  end if;

  if coalesce((v_run.verification_summary->'serverValidation'->>'eligible')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'reason', 'server_validation_failed');
  end if;

  v_points := coalesce(v_run.gps_trace->'sampledPoints', '[]'::jsonb);
  v_count := jsonb_array_length(v_points);

  if v_count < 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_few_sampled_points');
  end if;

  for i in 1..(v_count - 1) loop
    v_prev := v_points->(i - 1);
    v_curr := v_points->i;
    v_dt_s := ((v_curr->>'t')::double precision - (v_prev->>'t')::double precision) / 1000.0;

    if v_dt_s < -1.0 then
      return jsonb_build_object('ok', false, 'reason', 'time_reversal');
    end if;

    if v_dt_s > 20.0 then
      return jsonb_build_object('ok', false, 'reason', 'gps_gap');
    end if;

    if v_dt_s > 0.5 then
      v_dist_m := public.gps_distance_m(
        (v_prev->>'lat')::double precision,
        (v_prev->>'lng')::double precision,
        (v_curr->>'lat')::double precision,
        (v_curr->>'lng')::double precision
      );
      v_speed_kmh := (v_dist_m / v_dt_s) * 3.6;

      if v_dist_m > 300.0 or v_speed_kmh > 120.0 then
        return jsonb_build_object(
          'ok', false,
          'reason', 'impossible_speed',
          'distance_m', v_dist_m,
          'speed_kmh', v_speed_kmh
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

-- Recompute confidence from current-version runs. This intentionally
-- keeps trust_tier separate; flags/disputes are a different axis.
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
        and r.verification_status = 'verified'
        and (
          r.counted_in_leaderboard = true
          or r.user_id = v_trail.pioneer_user_id
        )
    ),
    count(distinct r.user_id) filter (where r.counted_in_leaderboard = true)
    into v_consistent, v_unique
    from public.runs r
   where r.trail_id = p_trail_id
     and r.trail_version_id is not distinct from v_trail.current_version_id;

  v_status := v_trail.calibration_status;

  if v_status in ('draft') then
    v_label := null;
  elsif v_status in ('fresh_pending_second_run', 'calibrating') and v_consistent >= 2 then
    v_status := 'live_fresh';
    v_label := 'fresh';
  elsif v_consistent >= 10 then
    v_status := 'stable';
    v_label := 'stable';
  elsif v_consistent >= 5 then
    v_status := 'live_confirmed';
    v_label := 'confirmed';
  elsif v_unique >= 3 then
    v_status := 'live_confirmed';
    v_label := 'community_checked';
  elsif v_status in ('verified', 'locked') then
    v_status := case when v_status = 'locked' then 'stable' else 'live_confirmed' end;
    v_label := case when v_status = 'stable' then 'stable' else 'confirmed' end;
  else
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

-- ─── Versioned all-time leaderboard upsert ─────────────────

create or replace function public.upsert_leaderboard_entry(
  p_user_id uuid,
  p_trail_id text,
  p_trail_version_id uuid,
  p_period_type text,
  p_duration_ms integer,
  p_run_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_ms integer;
  v_new_position integer;
  v_old_position integer;
begin
  select best_duration_ms, rank_position
    into v_existing_ms, v_old_position
    from public.leaderboard_entries
   where user_id = p_user_id
     and trail_id = p_trail_id
     and trail_version_id is not distinct from p_trail_version_id
     and period_type = p_period_type;

  if v_existing_ms is null or p_duration_ms < v_existing_ms then
    insert into public.leaderboard_entries (
      user_id, trail_id, trail_version_id,
      period_type, best_duration_ms, run_id, previous_position, updated_at
    ) values (
      p_user_id, p_trail_id, p_trail_version_id,
      p_period_type, p_duration_ms, p_run_id, v_old_position, now()
    )
    on conflict (user_id, trail_id, trail_version_id, period_type) do update set
      best_duration_ms = excluded.best_duration_ms,
      run_id = excluded.run_id,
      previous_position = leaderboard_entries.rank_position,
      updated_at = now();
  end if;

  with ranked as (
    select id, row_number() over (order by best_duration_ms asc, updated_at asc) as new_rank
      from public.leaderboard_entries
     where trail_id = p_trail_id
       and trail_version_id is not distinct from p_trail_version_id
       and period_type = p_period_type
  )
  update public.leaderboard_entries le
     set rank_position = ranked.new_rank
    from ranked
   where le.id = ranked.id;

  select rank_position
    into v_new_position
    from public.leaderboard_entries
   where user_id = p_user_id
     and trail_id = p_trail_id
     and trail_version_id is not distinct from p_trail_version_id
     and period_type = p_period_type;

  return jsonb_build_object(
    'position', v_new_position,
    'previous_position', v_old_position,
    'delta', coalesce(v_old_position, v_new_position + 1) - v_new_position,
    'is_new_best', v_existing_ms is null or p_duration_ms < v_existing_ms
  );
end;
$$;

-- Back-compat wrapper for any stale server-side callers. New code should
-- pass the version explicitly.
create or replace function public.upsert_leaderboard_entry(
  p_user_id uuid,
  p_trail_id text,
  p_period_type text,
  p_duration_ms integer,
  p_run_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version_id uuid;
begin
  select current_version_id into v_version_id
    from public.trails
   where id = p_trail_id;

  return public.upsert_leaderboard_entry(
    p_user_id,
    p_trail_id,
    v_version_id,
    p_period_type,
    p_duration_ms,
    p_run_id
  );
end;
$$;

-- ─── submit_run: validate, pin to current version, maybe unlock ───

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
    else
      v_summary_out := v_summary_out || jsonb_build_object(
        'consistency', v_consistency
      );
      update public.runs
         set verification_summary = v_summary_out
       where id = v_run_row.id
       returning * into v_run_row;
      v_invalidation := v_invalidation || coalesce(v_consistency->>'reason', 'consistency_failed');
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
    'trail_opened', v_can_open and v_eligible,
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

-- ─── finalize_seed_run: first run seeds, does not open board ─────

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
set search_path = public
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

  v_seed_source := case
    when v_is_curator then 'curator'::seed_source
    else 'rider'::seed_source
  end;

  insert into public.trail_versions (
    trail_id, version_number, geometry, created_by, is_current
  ) values (p_trail_id, 1, p_geometry, v_user_id, true)
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
    started_at, finished_at, mode
  ) values (
    v_user_id, p_trail_id, v_trail_row.spot_id, v_version_id,
    p_duration_ms, p_gps_trace, p_verification_status,
    jsonb_build_object(
      'quality_tier',      p_quality_tier,
      'median_accuracy_m', p_median_accuracy_m,
      'seed_run',          true
    ),
    false, false, 100,
    p_started_at, p_finished_at, 'ranked'
  )
  returning id into v_run_id;

  update public.profiles
     set xp = xp + 100,
         updated_at = now()
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

-- ─── delete_run: keep rerank scoped to the deleted version ───────

create or replace function public.delete_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid := auth.uid();
  v_role           text;
  v_is_curator     boolean;
  v_run            public.runs%rowtype;
  v_had_entry      boolean := false;
  v_next_run       public.runs%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  v_is_curator := coalesce(v_role, 'rider') in ('curator', 'moderator');

  select * into v_run from public.runs where id = p_run_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'run_not_found');
  end if;

  if not v_is_curator and v_run.user_id <> v_user_id then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  delete from public.leaderboard_entries
   where run_id = p_run_id
  returning true into v_had_entry;

  if v_had_entry then
    select *
      into v_next_run
      from public.runs
     where trail_id = v_run.trail_id
       and user_id = v_run.user_id
       and trail_version_id is not distinct from v_run.trail_version_id
       and id <> p_run_id
       and counted_in_leaderboard = true
     order by duration_ms asc
     limit 1;

    if found then
      insert into public.leaderboard_entries (
        user_id, trail_id, trail_version_id,
        period_type, rank_position, best_duration_ms, run_id
      ) values (
        v_next_run.user_id, v_next_run.trail_id, v_next_run.trail_version_id,
        'all_time', 1, v_next_run.duration_ms, v_next_run.id
      );
      update public.runs set is_pb = true where id = v_next_run.id;
    end if;
  end if;

  delete from public.runs where id = p_run_id;

  if v_had_entry then
    with ranked as (
      select
        id,
        row_number() over (
          order by best_duration_ms asc, updated_at asc
        ) as new_rank
      from public.leaderboard_entries
      where trail_id = v_run.trail_id
        and trail_version_id is not distinct from v_run.trail_version_id
        and period_type = 'all_time'
    )
    update public.leaderboard_entries le
       set previous_position = le.rank_position,
           rank_position     = r.new_rank,
           updated_at        = now()
      from ranked r
     where le.id = r.id
       and le.rank_position is distinct from r.new_rank;

    perform public.recompute_trail_confidence(v_run.trail_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'run_id', p_run_id,
    'had_leaderboard_entry', v_had_entry,
    'promoted_run_id', case when v_next_run.id is not null then v_next_run.id else null end
  );
end;
$$;

grant execute on function public.delete_run(uuid) to authenticated;

-- Current-version scoped day/weekend boards.
create or replace function public.fetch_scoped_leaderboard(
  p_trail_id text,
  p_since timestamptz,
  p_limit integer default 50
) returns table (
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
  with current_trail as (
    select current_version_id
      from public.trails
     where id = p_trail_id
  ),
  per_user_best as (
    select distinct on (r.user_id)
      r.user_id,
      r.trail_id,
      r.duration_ms
    from public.runs r
    cross join current_trail ct
    where r.trail_id = p_trail_id
      and r.trail_version_id is not distinct from ct.current_version_id
      and r.counted_in_leaderboard = true
      and r.started_at >= p_since
    order by r.user_id, r.duration_ms asc
  )
  select
    pu.user_id,
    pu.trail_id,
    pu.duration_ms::int as best_duration_ms,
    (row_number() over (order by pu.duration_ms asc))::int as rank_position,
    p.username,
    p.display_name,
    p.rank_id,
    p.avatar_url
  from per_user_best pu
  join public.profiles p on p.id = pu.user_id
  order by pu.duration_ms asc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

grant execute on function public.fetch_scoped_leaderboard(text, timestamptz, integer) to authenticated;
grant execute on function public.fetch_scoped_leaderboard(text, timestamptz, integer) to anon;

commit;
