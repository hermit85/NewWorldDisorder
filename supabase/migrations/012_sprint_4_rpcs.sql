-- ═══════════════════════════════════════════════════════════
-- Sprint 4 RPCs — finalize_seed_run, recalibrate_trail,
--                 admin_resolve_pioneer
--
-- finalize_seed_run supersedes finalize_pioneer_run's semantics:
-- auto-stamps seed_source from creator role, creates trail_versions
-- row, attaches run + leaderboard_entries to trail_version_id,
-- sets trust_tier='provisional'. Pioneer assignment + count flow
-- through migration-011 triggers (immutability + increment).
--
-- recalibrate_trail: curator-only, creates new version, supersedes
-- old, resets trust_tier to provisional. Pioneer identity survives
-- (immutability trigger enforces).
--
-- admin_resolve_pioneer: moderator-only escape hatch for
-- merge/split/dupe resolution. Bypasses immutability via session
-- setting, rebalances counters.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── finalize_seed_run ─────────────────────────────────────

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

  if coalesce(p_median_accuracy_m, 999) > 20 then
    return jsonb_build_object('ok', false, 'code', 'weak_signal_pioneer');
  end if;

  if jsonb_array_length(p_geometry->'points') < 30 then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
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

  -- Leaderboard entries (all_time is the only canonical period for now;
  -- 'season' isn't in the period_type CHECK constraint, skip it).
  insert into public.leaderboard_entries (
    trail_id, user_id, trail_version_id,
    period_type, rank_position, best_duration_ms, run_id
  ) values (
    p_trail_id, v_user_id, v_version_id,
    'all_time', 1, p_duration_ms, v_run_id
  );

  return jsonb_build_object(
    'ok',           true,
    'run_id',       v_run_id,
    'seed_source',  v_seed_source::text,
    'trust_tier',   'provisional',
    'version_id',   v_version_id,
    'is_pioneer',   true,
    'leaderboard_position', 1
  );
end;
$$;

revoke all    on function public.finalize_seed_run(text, jsonb, integer, jsonb, real, text, text, timestamptz, timestamptz) from public;
grant execute on function public.finalize_seed_run(text, jsonb, integer, jsonb, real, text, text, timestamptz, timestamptz) to authenticated;

-- ─── recalibrate_trail ─────────────────────────────────────

create or replace function public.recalibrate_trail(
  p_trail_id     text,
  p_new_geometry jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id             uuid;
  v_user_role           text;
  v_current_version     public.trail_versions%rowtype;
  v_new_version_id      uuid;
  v_new_version_number  integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_user_role from public.profiles where id = v_user_id;
  if v_user_role not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;

  select * into v_current_version
    from public.trail_versions
   where trail_id = p_trail_id and is_current = true
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_current_version');
  end if;

  v_new_version_number := v_current_version.version_number + 1;

  -- Flip old version off FIRST (the partial unique index on is_current
  -- requires exactly one TRUE row per trail_id at a time).
  update public.trail_versions
     set is_current    = false,
         superseded_at = now()
   where id = v_current_version.id;

  insert into public.trail_versions (
    trail_id, version_number, geometry, created_by, is_current
  ) values (
    p_trail_id, v_new_version_number, p_new_geometry, v_user_id, true
  ) returning id into v_new_version_id;

  -- Link the supersession pointer.
  update public.trail_versions
     set superseded_by_version_id = v_new_version_id
   where id = v_current_version.id;

  -- Repoint the trail at the new version; drop tier back to provisional
  -- so the community re-confirms. pioneer_user_id stays (immutability).
  update public.trails set
    current_version_id = v_new_version_id,
    geometry           = p_new_geometry,
    trust_tier         = 'provisional'
  where id = p_trail_id;

  return jsonb_build_object(
    'ok',                 true,
    'new_version_id',     v_new_version_id,
    'new_version_number', v_new_version_number
  );
end;
$$;

revoke all    on function public.recalibrate_trail(text, jsonb) from public;
grant execute on function public.recalibrate_trail(text, jsonb) to authenticated;

-- ─── admin_resolve_pioneer (GPT exception to immutability) ─

create or replace function public.admin_resolve_pioneer(
  p_trail_id             text,
  p_new_pioneer_user_id  uuid,
  p_reason               text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_role   text;
  v_old_pioneer uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_user_role from public.profiles where id = auth.uid();
  if v_user_role <> 'moderator' then
    return jsonb_build_object('ok', false, 'code', 'not_authorized');
  end if;

  -- Flip the session setting so the immutability trigger allows the swap.
  -- `true` as third arg = local-only (cleared at txn end).
  perform set_config('app.pioneer_admin_override', 'true', true);

  select pioneer_user_id into v_old_pioneer
    from public.trails where id = p_trail_id;

  if v_old_pioneer is not null then
    update public.profiles
       set pioneered_total_count = greatest(0, pioneered_total_count - 1)
     where id = v_old_pioneer;
  end if;

  update public.trails set
    pioneer_user_id = p_new_pioneer_user_id,
    pioneered_at    = now()
  where id = p_trail_id;

  -- The increment trigger fires on the UPDATE — new pioneer counter bumps
  -- automatically (the trigger's "first assignment" guard sees OLD not-null
  -- but that doesn't apply here; we treat override as a re-assignment, so
  -- we must not double-count. The trigger's guard is
  --   (TG_OP='INSERT' OR OLD.pioneer_user_id IS NULL)
  -- which means OLD-not-null → no auto-increment. Manual bump below.
  if p_new_pioneer_user_id is not null then
    update public.profiles
       set pioneered_total_count = pioneered_total_count + 1
     where id = p_new_pioneer_user_id;
  end if;

  -- Audit breadcrumb (audit_log table lands in Sprint 5+).
  raise notice 'Pioneer resolved: trail=% old=% new=% reason=%',
    p_trail_id, v_old_pioneer, p_new_pioneer_user_id, p_reason;

  perform set_config('app.pioneer_admin_override', 'false', true);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all    on function public.admin_resolve_pioneer(text, uuid, text) from public;
grant execute on function public.admin_resolve_pioneer(text, uuid, text) to authenticated;

commit;
