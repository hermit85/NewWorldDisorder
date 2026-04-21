-- ═══════════════════════════════════════════════════════════
-- Sprint 4.5 / Chunk 6 — lower Pioneer threshold + specific
-- error codes.
--
-- Context: walk-test v1 surfaced that 30-point Pioneer minimum
-- was tuned for Słotwiny-length trails (~2 min at 1 Hz) but
-- blocks legitimate short-track DH (Tajemna Hardline 187m ≈ 30s).
-- Lowering to 15 points matches the 30s duration floor (1 Hz
-- post 2m dedup) and mirrors client-side PIONEER_VALIDATORS in
-- src/features/recording/validators.ts.
--
-- Also replaces two generic error codes (invalid_geometry,
-- weak_signal_pioneer) with four specific codes the client UI
-- can render with observed/required numbers. Legacy codes are
-- no longer emitted but the client SEED_RUN_ERRORS map keeps
-- them as aliases so stale app builds still render copy.
--
-- RPC cannot validate start/end per-sample accuracy — geometry
-- builder strips per-point accuracy before serialisation (only
-- the median reaches the server). Those two checks live in the
-- client validator (Pioneer flow review screen).
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.finalize_seed_run(
  p_trail_id             text,
  p_geometry             jsonb,
  p_duration_ms          integer,
  p_gps_trace            jsonb,
  p_median_accuracy_m    real,
  p_quality_tier         text,
  p_verification_status  text,
  p_started_at           timestamptz,
  p_finished_at          timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_user_role    text;
  v_seed_source  seed_source;
  v_trail_row    public.trails%rowtype;
  v_version_id   uuid;
  v_run_id       uuid;
  v_point_count  integer;
  v_distance_m   real;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_user_role from public.profiles where id = v_user_id;

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

  -- ── NEW: duration gate ──
  -- 30s matches UCI short-track DH lower bound; below this the
  -- geometry is unreliable even with clean GPS (insufficient
  -- sampling window).
  if p_duration_ms < 30000 then
    return jsonb_build_object(
      'ok', false,
      'code', 'too_short_duration',
      'observed', p_duration_ms,
      'required', 30000
    );
  end if;

  -- ── NEW: distance gate (reads from geometry meta) ──
  -- totalDistanceM is authored by the client geometryBuilder;
  -- keeps pump tracks (< 150m) out of the seed pipeline while
  -- admitting Tajemna Hardline (187m) and similar short tracks.
  v_distance_m := coalesce((p_geometry->'meta'->>'totalDistanceM')::real, 0);
  if v_distance_m < 150 then
    return jsonb_build_object(
      'ok', false,
      'code', 'too_short_distance',
      'observed', v_distance_m,
      'required', 150
    );
  end if;

  -- ── CHANGED: lowered 30 → 15 + specific code ──
  -- 15 samples ≈ 30s post 2m dedup at 1 Hz.
  v_point_count := jsonb_array_length(p_geometry->'points');
  if v_point_count < 15 then
    return jsonb_build_object(
      'ok', false,
      'code', 'too_few_points',
      'observed', v_point_count,
      'required', 15
    );
  end if;

  -- ── CHANGED: weak_signal_pioneer → accuracy_too_poor_avg + payload ──
  if coalesce(p_median_accuracy_m, 999) > 20 then
    return jsonb_build_object(
      'ok', false,
      'code', 'accuracy_too_poor_avg',
      'observed', p_median_accuracy_m,
      'required', 20
    );
  end if;

  v_seed_source := case
    when v_user_role in ('curator', 'moderator') then 'curator'::seed_source
    else 'rider'::seed_source
  end;

  -- Create version 1
  insert into public.trail_versions (
    trail_id, version_number, geometry, created_by, is_current
  ) values (p_trail_id, 1, p_geometry, v_user_id, true)
  returning id into v_version_id;

  -- Claim trail + stamp axes (triggers handle immutability + count)
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

  -- Run row references the version
  insert into public.runs (
    user_id, trail_id, spot_id, trail_version_id,
    duration_ms, gps_trace, verification_status,
    verification_summary,
    counted_in_leaderboard, is_pb,
    started_at, finished_at, mode
  ) values (
    v_user_id, p_trail_id, v_trail_row.spot_id, v_version_id,
    p_duration_ms, p_gps_trace, p_verification_status,
    jsonb_build_object(
      'quality_tier',     p_quality_tier,
      'median_accuracy_m', p_median_accuracy_m
    ),
    true, true,
    p_started_at, p_finished_at, 'ranked'
  )
  returning id into v_run_id;

  -- Leaderboard entry (all_time only — 'season' is not in the
  -- period_type CHECK constraint).
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
    'leaderboard_position', 1
  );
end;
$$;

-- Re-apply the grant surface from migration 012. CREATE OR REPLACE
-- preserves existing grants in Postgres so this is belt-and-braces,
-- but keeps the migration self-documenting about the intended ACL.
revoke all    on function public.finalize_seed_run(text, jsonb, integer, jsonb, real, text, text, timestamptz, timestamptz) from public;
grant execute on function public.finalize_seed_run(text, jsonb, integer, jsonb, real, text, text, timestamptz, timestamptz) to authenticated;

commit;
