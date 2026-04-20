-- ═══════════════════════════════════════════════════════════
-- 008: Pioneer trail flow — create_trail + finalize_pioneer_run
--
-- Sprint 3 backbone: any rider on an active spot can create a draft
-- trail and, on their first clean GPS run, atomically claim the
-- pioneer slot, carve the canonical geometry, and open the
-- leaderboard.
--
-- Two RPCs, one CHECK constraint, one partial index. Matches the
-- contract in docs/SPRINT_3_SPEC.md §5 (resolved Q11, Q12, Q15).
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── 1. Difficulty CHECK constraint on trails ───────────────
-- trails.difficulty was unconstrained text; the app shipped with
-- fixed values but nothing enforced them server-side. Lock it now
-- that `draft` trails can be authored by any rider.
--
-- DB is empty of trails today (verified pre-Sprint-3), so a plain
-- VALIDATED constraint is safe. If this migration ever runs against
-- a populated DB with legacy values, switch to `NOT VALID` + a
-- separate VALIDATE once the data is cleaned.

alter table public.trails
  drop constraint if exists trails_difficulty_check;
alter table public.trails
  add constraint trails_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard', 'expert'));

-- ─── 2. Partial index on draft trails per spot ──────────────
-- Hot-path: `spot_detail` screen resolves the list of draft trails
-- waiting for a pioneer. Partial index keeps it small (only rows
-- actually in the draft state) and avoids polluting the regular
-- spot_id index with all-time historical data.

create index if not exists idx_trails_draft_by_spot
  on public.trails (spot_id)
  where calibration_status = 'draft';

-- ─── 3. create_trail RPC ────────────────────────────────────
-- Return shape (jsonb):
--   { ok: true,  trail_id: "pioneer-<10 hex>" }
--   { ok: false, code: "unauthenticated" | "spot_not_found" |
--       "spot_not_active" | "name_too_short" | "name_too_long" |
--       "invalid_difficulty" | "invalid_trail_type" |
--       "duplicate_name_in_spot" }
--
-- Behaviour: authed rider submits a new trail under an already-
-- approved spot. Trail starts in `draft` with is_active=false so
-- it doesn't pollute any listing until a pioneer finalises it.

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
  v_id          text;
  v_attempt     integer := 0;
  v_sort_order  integer;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  -- Spot existence + active status
  select status into v_spot_status
    from public.spots
   where id = p_spot_id;
  if v_spot_status is null then
    return jsonb_build_object('ok', false, 'code', 'spot_not_found');
  end if;
  if v_spot_status <> 'active' then
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

  -- Difficulty vocabulary (CHECK constraint would raise; we pre-
  -- check to return a typed error code the client can map to UI copy)
  if p_difficulty not in ('easy', 'medium', 'hard', 'expert') then
    return jsonb_build_object('ok', false, 'code', 'invalid_difficulty');
  end if;

  -- Trail type default + vocabulary
  v_trail_type := coalesce(nullif(btrim(p_trail_type), ''), 'flow');
  if v_trail_type not in ('downhill', 'flow', 'tech', 'jump') then
    return jsonb_build_object('ok', false, 'code', 'invalid_trail_type');
  end if;

  -- Case-insensitive name uniqueness per spot
  if exists (
    select 1 from public.trails
     where spot_id = p_spot_id
       and lower(official_name) = lower(v_name)
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_name_in_spot');
  end if;

  -- Next sort_order within the spot
  select coalesce(max(sort_order), 0) + 1 into v_sort_order
    from public.trails
   where spot_id = p_spot_id;

  -- Generate `pioneer-<10 hex>` id. 16^10 ≈ 1.1e12 space;
  -- collision odds are negligible at our scale but we retry
  -- defensively, mirroring migration 007's submit_spot pattern.
  loop
    v_attempt := v_attempt + 1;
    v_id := 'pioneer-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    exit when not exists (select 1 from public.trails where id = v_id);
    if v_attempt >= 5 then
      raise exception 'trail_id collision after 5 attempts';
    end if;
  end loop;

  -- Insert. Note:
  --   * is_active=false — draft trails are invisible in catalog
  --     queries (fetchTrails filters is_active=true). They become
  --     active when finalize_pioneer_run flips the flag.
  --   * official_name carries the user-provided name; short_name
  --     mirrors it until a curator decides otherwise.
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

-- ─── 4. finalize_pioneer_run RPC ────────────────────────────
-- Atomic: run insert + pioneer claim + trail activation +
-- leaderboard entry, all in one transaction under a FOR UPDATE
-- row lock on the trail.
--
-- Return shape (jsonb):
--   { ok: true,
--     run_id: uuid, is_pioneer: true,
--     trail_status: "calibrating", leaderboard_position: 1 }
--   { ok: false, code: "unauthenticated" | "trail_not_found" |
--       "trail_not_draft" | "already_pioneered" |
--       "invalid_geometry" | "weak_signal_pioneer" }
--
-- Why FOR UPDATE over advisory lock: row locks are localised and
-- already integrate with the concurrent pioneer-race tie-break.
-- Advisory locks would work but don't compose as cleanly with the
-- `already_pioneered` visibility check.
--
-- Why weak_signal_pioneer BLOCKS (not warns): the pioneer run's
-- geometry becomes the canonical corridor for every subsequent
-- rider's verification. Noisy GPS → poisoned corridor → everyone
-- downstream gates wrong. Cheaper to reject up front (Q12).
--
-- Why 30 points minimum: at 1 Hz post 2 m dedup, 30 samples ≈
-- 30 s of real descent. Below that it's either a joke run or an
-- aborted one — neither a credible canonical line (Q11).

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
begin
  -- 1. Auth
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  -- 2. Lock trail row + existence
  select id, calibration_status, pioneer_user_id, spot_id
    into v_trail
    from public.trails
   where id = p_trail_id
     for update;
  if v_trail.id is null then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  -- 3. Must be draft
  if v_trail.calibration_status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'trail_not_draft');
  end if;

  -- 4. Pioneer slot must be open (race-condition loser path)
  if v_trail.pioneer_user_id is not null then
    return jsonb_build_object('ok', false, 'code', 'already_pioneered');
  end if;

  -- 5. Geometry validation — version, length, per-point shape,
  --    strictly increasing timestamps, coordinate bounds.
  if coalesce((p_geometry->>'version')::integer, 0) <> 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;

  v_points := p_geometry->'points';
  if v_points is null or jsonb_typeof(v_points) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;
  if jsonb_array_length(v_points) < 30 then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;

  for v_i in 0..jsonb_array_length(v_points) - 1 loop
    v_point := v_points -> v_i;
    -- Required fields present
    if v_point is null
       or v_point->>'lat' is null
       or v_point->>'lng' is null
       or v_point->>'t'   is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
    end if;
    -- Cast and bound-check
    begin
      v_lat := (v_point->>'lat')::numeric;
      v_lng := (v_point->>'lng')::numeric;
      v_t   := (v_point->>'t')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
    end;
    if v_lat < -90 or v_lat > 90 or v_lng < -180 or v_lng > 180 then
      return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
    end if;
    -- Strictly increasing t (monotonic)
    if v_t <= v_prev_t then
      return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
    end if;
    v_prev_t := v_t;
  end loop;

  -- 6. Weak-signal gate — reject before writing anything
  v_median_acc := nullif(p_run_payload->>'median_accuracy_m', '')::numeric;
  v_verif_status := p_run_payload->>'verification_status';
  if (v_median_acc is not null and v_median_acc > 20)
     or v_verif_status = 'weak_signal' then
    return jsonb_build_object('ok', false, 'code', 'weak_signal_pioneer');
  end if;

  -- 7. Extract run payload fields (with sane fallbacks where safe)
  v_spot_id     := p_run_payload->>'spot_id';
  v_started_at  := (p_run_payload->>'started_at')::timestamptz;
  v_finished_at := (p_run_payload->>'finished_at')::timestamptz;
  v_duration_ms := (p_run_payload->>'duration_ms')::integer;
  v_mode        := coalesce(p_run_payload->>'mode', 'ranked');
  if v_spot_id is null or v_started_at is null or v_finished_at is null
     or v_duration_ms is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;

  -- 8. Insert run row (Q7: first run ever ⇒ is_pb=true)
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

  -- 9. Flip trail: pioneer claimed, geometry pinned, activated
  update public.trails
     set pioneer_user_id    = v_user,
         pioneered_at       = now(),
         geometry           = p_geometry,
         calibration_status = 'calibrating',
         is_active          = true,
         runs_contributed   = 1
   where id = p_trail_id;

  -- 10. First leaderboard_entry (position 1, all_time)
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

commit;
