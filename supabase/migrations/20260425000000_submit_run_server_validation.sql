-- ═══════════════════════════════════════════════════════════
-- submit_run RPC — server-side eligibility validation (F1#9)
--
-- Before this migration the client wrote `counted_in_leaderboard`
-- directly on insert. A tampered client could set the flag + a
-- duration_ms of 1 and land at #1 on any board. The whole trust
-- model depended on the JS layer being honest.
--
-- This migration:
--   1. Adds SECURITY DEFINER function `public.submit_run` that
--      re-validates the verification summary against the same
--      thresholds the client uses (corridor coverage, GPS
--      accuracy, checkpoint completion, acceptedVia), checks
--      duration sanity + timestamp consistency, and decides
--      counted_in_leaderboard itself. Rider-provided values for
--      that flag are ignored.
--   2. Stores the server's validation verdict on the run row
--      (verification_summary.serverValidation) so we can audit
--      later why a run was or wasn't counted.
--   3. Hardens the existing "Users can insert own runs" RLS
--      policy: direct INSERTs must set counted_in_leaderboard =
--      false. The only way to land on the leaderboard is through
--      this RPC.
--
-- Thresholds mirror the client (src/systems/realVerification.ts):
--   CORRIDOR_COVERAGE_MIN = 70  — same 0.70
--   GPS_QUALITY_THRESHOLD_M = 20
--   checkpoints: all required checkpoints passed
--   acceptedVia: 'gate_cross' or 'corridor_rescue' (F0 audit types)
--   duration: [5s, 4h], and matches finished_at - started_at ±2s
-- ═══════════════════════════════════════════════════════════

begin;

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
)
returns jsonb
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
  v_eligible           boolean := false;
  v_previous_best_ms   integer;
  v_is_pb              boolean := false;
  v_run_row            public.runs%rowtype;
  v_lb                 jsonb;
  v_summary_out        jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  if p_mode not in ('ranked', 'practice') then
    return jsonb_build_object('ok', false, 'code', 'invalid_mode');
  end if;

  -- ── Duration sanity ──
  if p_duration_ms is null or p_duration_ms < 5000 then
    v_invalidation := v_invalidation || 'duration_too_short';
  end if;
  if p_duration_ms > 14400000 then  -- 4h
    v_invalidation := v_invalidation || 'duration_too_long';
  end if;

  -- Timer and wall-clock must agree. A 2s tolerance covers UI lag
  -- between countdown finish and the timer starting; anything more
  -- means the client fabricated one of the values.
  v_elapsed_ms := (extract(epoch from (p_finished_at - p_started_at)) * 1000)::integer;
  if abs(coalesce(v_elapsed_ms, -1) - coalesce(p_duration_ms, -1)) > 2000 then
    v_invalidation := v_invalidation || 'timestamp_mismatch';
  end if;

  -- ── Eligibility re-validation (only for ranked mode) ──
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

    v_eligible := array_length(v_invalidation, 1) is null;
  end if;

  -- ── PB determination ──
  -- Server reads the rider's current best from leaderboard_entries
  -- instead of trusting a client-provided previousBestMs.
  if v_eligible then
    select best_duration_ms
      into v_previous_best_ms
      from public.leaderboard_entries
     where user_id = v_user_id
       and trail_id = p_trail_id
       and period_type = 'all_time';
    v_is_pb := v_previous_best_ms is null or p_duration_ms < v_previous_best_ms;
  end if;

  -- Annotate the verification summary with the server's audit trail
  -- so we can diff client vs server decisions after the fact.
  v_summary_out := coalesce(p_verification_summary, '{}'::jsonb)
    || jsonb_build_object(
      'serverValidation', jsonb_build_object(
        'eligible', v_eligible,
        'reasons', to_jsonb(v_invalidation),
        'validatedAt', now()
      )
    );

  -- ── Insert the run ──
  insert into public.runs (
    user_id, spot_id, trail_id, mode,
    started_at, finished_at, duration_ms,
    verification_status, verification_summary, gps_trace,
    is_pb, xp_awarded, counted_in_leaderboard
  ) values (
    v_user_id, p_spot_id, p_trail_id, p_mode,
    p_started_at, p_finished_at, p_duration_ms,
    p_verification_status, v_summary_out, p_gps_trace,
    v_is_pb and v_eligible, coalesce(p_xp_awarded, 0), v_eligible
  )
  returning * into v_run_row;

  -- ── Leaderboard upsert ──
  if v_eligible then
    v_lb := public.upsert_leaderboard_entry(
      v_user_id, p_trail_id, 'all_time', p_duration_ms, v_run_row.id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'run', row_to_json(v_run_row),
    'eligible', v_eligible,
    'invalidation_reasons', to_jsonb(v_invalidation),
    'leaderboard', v_lb,
    'is_pb', v_is_pb,
    'previous_best_ms', v_previous_best_ms
  );
end;
$$;

revoke all    on function public.submit_run(
  text, text, text, timestamptz, timestamptz, integer, text, jsonb, jsonb, integer
) from public;
grant execute on function public.submit_run(
  text, text, text, timestamptz, timestamptz, integer, text, jsonb, jsonb, integer
) to authenticated;

-- ── Harden RLS: direct inserts may no longer claim leaderboard counting ──
-- Practice runs (and any unverified history rows) can still be written
-- directly; only the server-validated ranked path can set the flag.
drop policy if exists "Users can insert own runs" on public.runs;
create policy "Users can insert own runs"
  on public.runs for insert
  with check (
    auth.uid() = user_id
    and counted_in_leaderboard = false
  );

commit;
