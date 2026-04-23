-- ═══════════════════════════════════════════════════════════
-- Pioneer self-active flow — the submitter unblocks their own park
--
-- Problem (field test B19): a rider submits a bike park and gets
-- stuck behind `create_trail`'s `spot.status <> 'active'` gate
-- (migration 008 §84). They can't test their own pioneer loop
-- without first opening curator queue on another device and
-- approving their own submission — an absurd dependency loop.
--
-- Decision (Opcja B'): the *submitter* treats their own pending
-- park as if it were active. Other riders still only see active
-- spots. The park flips to `status='active'` publicly the moment
-- the submitter finalises their pioneer run — real geometry is
-- the proof, not a curator rubber stamp. Curator review becomes
-- post-hoc (can flag / hide a problem park, but isn't a gate).
--
-- Changes:
--   1. create_trail: relax the `status='active'` gate — allow the
--      submitter to author trails on their own pending park.
--   2. finalize_pioneer_run: atomically flip spot → active when a
--      pioneer run succeeds on a pending park and the caller was
--      the submitter.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── 1. create_trail — relax gate for submitter ──────────────

create or replace function public.create_trail(
  p_spot_id text,
  p_name text,
  p_difficulty text,
  p_trail_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_name        text;
  v_trail_type  text;
  v_spot_status text;
  v_submitter   uuid;
  v_id          text;
  v_attempt     integer := 0;
  v_sort_order  integer;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  -- Spot existence + status + submitter
  select status, submitted_by
    into v_spot_status, v_submitter
    from public.spots
   where id = p_spot_id;
  if v_spot_status is null then
    return jsonb_build_object('ok', false, 'code', 'spot_not_found');
  end if;

  -- Gate: active park is open to anyone, pending park is open to
  -- its own submitter only. Rejected parks stay closed for everyone.
  if v_spot_status = 'active' then
    -- ok, proceed
    null;
  elsif v_spot_status = 'pending' and v_submitter = v_user then
    -- ok, submitter may pioneer their own pending park
    null;
  else
    return jsonb_build_object('ok', false, 'code', 'spot_not_active');
  end if;

  -- Name length
  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 3 then
    return jsonb_build_object('ok', false, 'code', 'name_too_short');
  end if;
  if char_length(v_name) > 60 then
    return jsonb_build_object('ok', false, 'code', 'name_too_long');
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard', 'expert') then
    return jsonb_build_object('ok', false, 'code', 'invalid_difficulty');
  end if;

  v_trail_type := coalesce(nullif(btrim(p_trail_type), ''), 'flow');
  if v_trail_type not in ('downhill', 'flow', 'tech', 'jump') then
    return jsonb_build_object('ok', false, 'code', 'invalid_trail_type');
  end if;

  if exists (
    select 1 from public.trails
     where spot_id = p_spot_id
       and lower(official_name) = lower(v_name)
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_name_in_spot');
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort_order
    from public.trails
   where spot_id = p_spot_id;

  loop
    v_attempt := v_attempt + 1;
    v_id := 'pioneer-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    exit when not exists (select 1 from public.trails where id = v_id);
    if v_attempt >= 5 then
      raise exception 'trail_id collision after 5 attempts';
    end if;
  end loop;

  insert into public.trails (
    id, spot_id, official_name, short_name, game_label,
    difficulty, trail_type, distance_m, avg_grade_pct,
    elevation_drop_m, description, game_flavor,
    is_race_trail, is_active, sort_order,
    calibration_status, pioneer_user_id, geometry,
    runs_contributed
  ) values (
    v_id, p_spot_id, v_name, v_name, '',
    p_difficulty, v_trail_type, 0, 0,
    0, '', '',
    true, false, v_sort_order,
    'draft', null, null,
    0
  );

  return jsonb_build_object('ok', true, 'trail_id', v_id);
end;
$$;

revoke all on function public.create_trail(text, text, text, text) from public;
grant execute on function public.create_trail(text, text, text, text) to authenticated;

-- ─── 2. finalize_pioneer_run — atomic spot auto-activate ─────
--
-- On a successful pioneer run the parent park flips to active
-- *if* (a) it was pending and (b) the rider was the submitter.
-- Other states (already active, rejected, submitted by someone
-- else) are left alone — the trail still activates, but the
-- park's status is not the pioneer's to change.
--
-- This is atomic with the existing trail flip (step 9 below) so
-- a successful pioneer run lands the park + trail in `active` +
-- `calibrating` simultaneously or neither.

create or replace function public.finalize_pioneer_run(
  p_trail_id text,
  p_run_payload jsonb,
  p_geometry jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user          uuid := auth.uid();
  v_trail         record;
  v_points        jsonb;
  v_point         jsonb;
  v_i             integer;
  v_prev_t        numeric := -1;
  v_t             numeric;
  v_lat           numeric;
  v_lng           numeric;
  v_median_acc    numeric;
  v_verif_status  text;
  v_run_id        uuid;
  v_spot_id       text;
  v_started_at    timestamptz;
  v_finished_at   timestamptz;
  v_duration_ms   integer;
  v_mode          text;
  v_spot_status   text;
  v_submitter     uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  -- Lock trail row for concurrent-pioneer tie-break
  select id, spot_id, calibration_status, pioneer_user_id
    into v_trail
    from public.trails
   where id = p_trail_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;
  if v_trail.calibration_status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'trail_not_draft');
  end if;
  if v_trail.pioneer_user_id is not null then
    return jsonb_build_object('ok', false, 'code', 'already_pioneered');
  end if;

  -- Geometry shape check
  v_points := p_geometry->'points';
  if v_points is null or jsonb_typeof(v_points) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;
  if jsonb_array_length(v_points) < 30 then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;

  -- Monotonic timestamps + valid lat/lng
  for v_i in 0 .. jsonb_array_length(v_points) - 1 loop
    v_point := v_points->v_i;
    v_t := (v_point->>'t')::numeric;
    v_lat := (v_point->>'lat')::numeric;
    v_lng := (v_point->>'lng')::numeric;
    if v_t is null or v_lat is null or v_lng is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
    end if;
    if v_t <= v_prev_t then
      return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
    end if;
    if v_lat < -90 or v_lat > 90 or v_lng < -180 or v_lng > 180 then
      return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
    end if;
    v_prev_t := v_t;
  end loop;

  -- GPS accuracy gate
  v_median_acc := (p_run_payload->'verification_summary'->>'medianAccuracyM')::numeric;
  v_verif_status := p_run_payload->>'verification_status';
  if v_median_acc is not null and v_median_acc > 20
     or v_verif_status = 'weak_signal' then
    return jsonb_build_object('ok', false, 'code', 'weak_signal_pioneer');
  end if;

  -- Extract run payload fields
  v_spot_id     := p_run_payload->>'spot_id';
  v_started_at  := (p_run_payload->>'started_at')::timestamptz;
  v_finished_at := (p_run_payload->>'finished_at')::timestamptz;
  v_duration_ms := (p_run_payload->>'duration_ms')::integer;
  v_mode        := coalesce(p_run_payload->>'mode', 'ranked');
  if v_spot_id is null or v_started_at is null or v_finished_at is null
     or v_duration_ms is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;

  -- Insert run row
  insert into public.runs (
    user_id, spot_id, trail_id, mode,
    started_at, finished_at, duration_ms,
    verification_status, verification_summary, gps_trace,
    is_pb, xp_awarded, counted_in_leaderboard
  ) values (
    v_user, v_spot_id, p_trail_id, v_mode,
    v_started_at, v_finished_at, v_duration_ms,
    coalesce(v_verif_status, 'verified'),
    coalesce(p_run_payload->'verification_summary', 'null'::jsonb),
    coalesce(p_run_payload->'gps_trace', 'null'::jsonb),
    true, 0, true
  )
  returning id into v_run_id;

  -- Flip trail: pioneer claimed, geometry pinned, activated
  update public.trails
     set pioneer_user_id    = v_user,
         pioneered_at       = now(),
         geometry           = p_geometry,
         calibration_status = 'calibrating',
         is_active          = true,
         runs_contributed   = 1
   where id = p_trail_id;

  -- Flip spot if pending + submitter == pioneer (Opcja B').
  -- Self-approval: the rider's successful GPS-verified run is
  -- the proof of a real park. `approved_by` is the pioneer, not
  -- null, so the audit trail records who unlocked it.
  select status, submitted_by
    into v_spot_status, v_submitter
    from public.spots
   where id = v_spot_id;
  if v_spot_status = 'pending' and v_submitter = v_user then
    update public.spots
       set status      = 'active',
           is_active   = true,
           approved_by = v_user,
           approved_at = now()
     where id = v_spot_id
       and status = 'pending';  -- idempotent guard
  end if;

  -- First leaderboard_entry (position 1, all_time)
  insert into public.leaderboard_entries (
    user_id, trail_id, period_type, best_duration_ms,
    rank_position, previous_position, run_id
  ) values (
    v_user, p_trail_id, 'all_time', v_duration_ms,
    1, null, v_run_id
  );

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'is_pioneer', true,
    'trail_status', 'calibrating',
    'leaderboard_position', 1
  );
end;
$$;

revoke all on function public.finalize_pioneer_run(text, jsonb, jsonb) from public;
grant execute on function public.finalize_pioneer_run(text, jsonb, jsonb) to authenticated;

-- ─── 3. RLS: trails INSERT — allow submitter on own pending ──
--
-- Mirror the RPC relaxation at the RLS layer. The RPC is
-- security-definer and bypasses RLS, but keeping the two layers
-- consistent means a future direct-table mutation won't suddenly
-- be stricter than the RPC path. Still blocks insertions under
-- rejected parks and under parks submitted by someone else.

drop policy if exists "Trails only on active spots" on public.trails;

create policy "Trails on active or own pending spots"
  on public.trails for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from public.spots s
      where s.id = trails.spot_id
        and (
          s.status = 'active'
          or (s.status = 'pending' and s.submitted_by = auth.uid())
        )
    )
  );

commit;
