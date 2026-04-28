-- ═══════════════════════════════════════════════════════════════════
-- submit_run: allow ANY rider's first eligible ranked run to open a
-- fresh_pending_second_run trail (not just the pioneer)
--
-- Codex pass 5 found the loop-blocker that survived build 49's gate
-- canonicalisation: even after Phone B can arm UZBRÓJ correctly,
-- their ranked run is rejected with `trail_pending_second_run`
-- because submit_run gates v_can_open on
-- `pioneer_user_id = v_user_id`. The intended product semantics is
-- the opposite: the trail is in `fresh_pending_second_run` precisely
-- to wait for someone — pioneer or anyone else — to validate it
-- with a clean ranked descent. Keeping it pioneer-only effectively
-- means a non-pioneer rider has no path to a counted ranked run on
-- a freshly pioneered trail until the pioneer themselves does a
-- second ride.
--
-- Fix: drop the pioneer_user_id check from v_can_open. recompute_
-- trail_confidence already does the right counting (consistent
-- ranked runs + distinct counted users) and will advance the trail
-- to live_fresh once Phone B's run hits 2 consistent runs (pioneer
-- seed + Phone B's confirming).
--
-- Wrapped in BEGIN/COMMIT for atomicity. Function signature is
-- unchanged so client code keeps working.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_run(
  p_spot_id text,
  p_trail_id text,
  p_mode text,
  p_started_at timestamp with time zone,
  p_finished_at timestamp with time zone,
  p_duration_ms integer,
  p_verification_status text,
  p_verification_summary jsonb,
  p_gps_trace jsonb,
  p_xp_awarded integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  -- Build 49 P0: drop pioneer-only restriction. ANY rider's first
  -- clean ranked run on a fresh_pending_second_run trail counts as
  -- the confirming run that opens the trail. recompute_trail_
  -- confidence below takes over the counting / state advance.
  v_can_open := v_trail.calibration_status in (
    'fresh_pending_second_run', 'calibrating'
  );

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

  -- Insert the run row with xp_awarded = 0 unconditionally. The
  -- client-provided p_xp_awarded is only honoured below if the
  -- server confirms eligibility AND consistency.ok. Pre-build-49
  -- the row stored p_xp_awarded even on rejected runs, leaving
  -- the DB inconsistent with the (correctly-gated) client profile
  -- XP update — a Codex pass 6 silent-corruption finding.
  insert into public.runs (
    user_id, spot_id, trail_id, trail_version_id, mode,
    started_at, finished_at, duration_ms,
    verification_status, verification_summary, gps_trace,
    is_pb, xp_awarded, counted_in_leaderboard
  ) values (
    v_user_id, v_trail.spot_id, p_trail_id, v_trail.current_version_id, p_mode,
    p_started_at, p_finished_at, p_duration_ms,
    p_verification_status, v_summary_out, p_gps_trace,
    false, 0, false
  )
  returning * into v_run_row;

  if v_base_eligible then
    v_consistency := public.check_run_consistency(v_run_row.id, p_trail_id);
    if coalesce((v_consistency->>'ok')::boolean, false) then
      v_eligible := true;
      update public.runs
         set counted_in_leaderboard = true,
             is_pb = v_is_pb,
             xp_awarded = coalesce(p_xp_awarded, 0)
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
$function$;

COMMIT;
