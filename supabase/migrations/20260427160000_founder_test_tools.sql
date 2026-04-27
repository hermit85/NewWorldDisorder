-- ═══════════════════════════════════════════════════════════
-- Founder test-data tools.
--
-- TestFlight reality: SPOTY redesign removed the old client-side
-- "delete trail / delete spot" affordances, and the dev DebugDrawer
-- is __DEV__-gated so production testers can't reach it. Two
-- founder/test accounts now need a safe, server-enforced way to
-- wipe their own test runs/PBs/achievements without nuking other
-- riders' data.
--
-- This migration:
--   1. Widens profiles.role to allow 'founder'.
--   2. Adds is_founder_user() — single source of truth for the
--      "should this caller see Founder Tools?" gate.
--   3. Adds preview_test_data_reset() — returns counts so the UI
--      can show what will be wiped before confirmation.
--   4. Adds reset_my_test_data() — deletes runs, leaderboard
--      entries, challenge progress, achievements OWNED BY THE
--      CALLER. Profile, auth.users, global seed config and other
--      riders' rows stay intact.
--   5. Adds delete_test_spot(p_spot_id) — only when the caller
--      owns the spot (or is curator+) AND no other rider has
--      runs there. Falls back to a soft archive otherwise.
--
-- Trail self-delete is already covered by delete_trail_cascade
-- (20260424120000) — the founder role naturally inherits the
-- curator path there because that RPC already accepts curator/
-- moderator. This migration extends that allowlist to founder.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── 1. Widen role enum ────────────────────────────────────
-- The original CHECK constraint (006_curator_and_spot_submission)
-- locks roles to rider/curator/moderator. Drop and recreate to
-- include 'founder'. Existing rows keep their role; new founder
-- accounts get UPDATE'd manually after migration.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('rider', 'curator', 'moderator', 'founder'));

-- ─── 2. is_founder_user() ──────────────────────────────────
-- Pure read; safe to call from RLS-checked client without harm.
create or replace function public.is_founder_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = 'founder'
  );
$$;

revoke all    on function public.is_founder_user() from public;
grant execute on function public.is_founder_user() to authenticated;

-- ─── 3. preview_test_data_reset() ──────────────────────────
-- Returns the counts the founder is about to wipe, so the UI
-- can render "5 runs · 3 PBs · 2 trails" before the rider types
-- RESET. No side effects.
create or replace function public.preview_test_data_reset()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id   uuid := auth.uid();
  v_runs      bigint;
  v_lb        bigint;
  v_chal      bigint;
  v_ach       bigint;
  v_pioneer   bigint;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;
  if not public.is_founder_user() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select count(*) into v_runs
    from public.runs where user_id = v_user_id;
  select count(*) into v_lb
    from public.leaderboard_entries where user_id = v_user_id;
  select count(*) into v_chal
    from public.challenge_progress where user_id = v_user_id;
  select count(*) into v_ach
    from public.user_achievements where user_id = v_user_id;
  select count(*) into v_pioneer
    from public.trails where pioneer_user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'runs', v_runs,
    'leaderboard_entries', v_lb,
    'challenge_progress', v_chal,
    'achievements', v_ach,
    'pioneer_trails', v_pioneer
  );
end;
$$;

revoke all    on function public.preview_test_data_reset() from public;
grant execute on function public.preview_test_data_reset() to authenticated;

-- ─── 4. reset_my_test_data() ───────────────────────────────
-- Wipes the caller's runs and derived rows. Does NOT touch:
--   - auth.users
--   - profiles (the account stays — only its activity vanishes)
--   - spots / trails owned by other riders
--   - global seed config (challenges, achievements catalogue)
--
-- Trails seeded by this user as pioneer are NOT auto-deleted:
--   the founder explicitly calls delete_test_spot / the existing
--   delete_trail_cascade for those, after reviewing dependencies.
create or replace function public.reset_my_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_runs      bigint := 0;
  v_lb        bigint := 0;
  v_chal      bigint := 0;
  v_ach       bigint := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;
  if not public.is_founder_user() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  -- Order matches delete-account edge function (FK-safe):
  --   leaderboard_entries (run_id FK) → challenge_progress →
  --   user_achievements → runs → run_points (cascades).
  with d as (
    delete from public.leaderboard_entries
     where user_id = v_user_id
    returning 1
  )
  select count(*) into v_lb from d;

  with d as (
    delete from public.challenge_progress
     where user_id = v_user_id
    returning 1
  )
  select count(*) into v_chal from d;

  with d as (
    delete from public.user_achievements
     where user_id = v_user_id
    returning 1
  )
  select count(*) into v_ach from d;

  with d as (
    delete from public.runs
     where user_id = v_user_id
    returning 1
  )
  select count(*) into v_runs from d;

  -- Reset the cached scalars on profiles so JA/Home stop showing
  -- ghost counts before the next aggregate refresh job.
  update public.profiles
     set total_runs = 0,
         total_pbs = 0,
         pioneered_verified_count = 0,
         xp = 0
   where id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'runs', v_runs,
      'leaderboard_entries', v_lb,
      'challenge_progress', v_chal,
      'achievements', v_ach
    )
  );
end;
$$;

revoke all    on function public.reset_my_test_data() from public;
grant execute on function public.reset_my_test_data() to authenticated;

-- ─── 5. delete_test_spot(spot_id) ──────────────────────────
-- Founder/curator-only, with a strict "no foreign data" guard:
-- if any rider OTHER than the caller has a run on a trail of
-- this spot, refuse the hard delete and suggest soft archive.
-- Soft archive is performed in the same call when p_archive_if_blocked
-- is true so the founder can resolve the conflict in one round-trip.
create or replace function public.delete_test_spot(
  p_spot_id text,
  p_archive_if_blocked boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid := auth.uid();
  v_role           text;
  v_is_privileged  boolean;
  v_foreign_runs   bigint;
  v_trail_count    bigint;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  v_is_privileged := coalesce(v_role, 'rider') in ('founder', 'curator', 'moderator');
  if not v_is_privileged then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  -- Guard: any run on this spot's trails by a non-caller rider
  -- means the spot has community history. Block the hard delete.
  select count(*) into v_foreign_runs
    from public.runs r
    join public.trails t on t.id = r.trail_id
   where t.spot_id = p_spot_id
     and r.user_id <> v_user_id;

  if v_foreign_runs > 0 then
    if p_archive_if_blocked then
      update public.spots
         set status = 'rejected'
       where id = p_spot_id;
      return jsonb_build_object(
        'ok', true,
        'mode', 'archived',
        'foreign_runs', v_foreign_runs
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'code', 'has_foreign_runs',
      'foreign_runs', v_foreign_runs,
      'hint', 'Ten bike park ma dane innych riderów. Użyj archive zamiast delete.'
    );
  end if;

  -- Safe to hard-delete: cascade through trails, then the spot.
  select count(*) into v_trail_count
    from public.trails where spot_id = p_spot_id;

  delete from public.leaderboard_entries
   where trail_id in (select id from public.trails where spot_id = p_spot_id);
  delete from public.runs
   where trail_id in (select id from public.trails where spot_id = p_spot_id);
  delete from public.trails where spot_id = p_spot_id;
  delete from public.spots  where id      = p_spot_id;

  return jsonb_build_object(
    'ok', true,
    'mode', 'deleted',
    'spot_id', p_spot_id,
    'trails_deleted', v_trail_count
  );
end;
$$;

revoke all    on function public.delete_test_spot(text, boolean) from public;
grant execute on function public.delete_test_spot(text, boolean) to authenticated;

-- ─── 6. Widen delete_trail_cascade for founder ─────────────
-- The existing delete_trail_cascade gates on (curator, moderator).
-- Founder belongs to the same privileged tier for testing — re-
-- creating the function with the wider allowlist keeps the rest
-- of the body unchanged.
create or replace function public.delete_trail_cascade(p_trail_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id         uuid := auth.uid();
  v_role            text;
  v_is_curator      boolean;
  v_trail           public.trails%rowtype;
  v_is_pioneer_self boolean;
  v_in_flight       boolean;
  v_only_self_runs  boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  v_is_curator := coalesce(v_role, 'rider') in ('curator', 'moderator', 'founder');

  select * into v_trail from public.trails where id = p_trail_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  if not v_is_curator then
    v_is_pioneer_self := v_trail.pioneer_user_id = v_user_id;
    v_in_flight := v_trail.calibration_status in ('draft', 'calibrating');
    v_only_self_runs := coalesce(v_trail.runs_contributed, 0) <= 1;
    if not (v_is_pioneer_self and v_in_flight and v_only_self_runs) then
      return jsonb_build_object('ok', false, 'code', 'unauthorized');
    end if;
  end if;

  delete from public.leaderboard_entries where trail_id = p_trail_id;
  delete from public.runs               where trail_id = p_trail_id;
  delete from public.trails             where id       = p_trail_id;

  return jsonb_build_object('ok', true, 'trail_id', p_trail_id);
end;
$$;

revoke all    on function public.delete_trail_cascade(text) from public;
grant execute on function public.delete_trail_cascade(text) to authenticated;

commit;

-- ═══════════════════════════════════════════════════════════
-- Post-migration manual step (founder enrolment):
--
--   update public.profiles
--      set role = 'founder'
--    where id in (
--      '<founder-uuid-1>',  -- darek's primary account
--      '<founder-uuid-2>'   -- darek's secondary test account
--    );
--
-- Run this once in Supabase Studio after the migration applies.
-- Without this UPDATE the JA → MENU → Founder tools entry stays
-- hidden (is_founder_user() returns false for non-founder roles).
-- ═══════════════════════════════════════════════════════════
