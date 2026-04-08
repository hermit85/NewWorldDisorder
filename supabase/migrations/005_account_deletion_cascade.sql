-- ═══════════════════════════════════════════════════════════
-- 005: Account deletion cascade
--
-- App Store Guideline 5.1.1(v) requires that the in-app
-- "Delete Account" flow actually deletes the user.
--
-- The original schema (001) only cascaded `profiles` from
-- `auth.users`. Every dependent table — runs, leaderboard
-- entries, challenge_progress, user_achievements — references
-- `profiles(id)` WITHOUT `on delete cascade`. Without this
-- migration, the delete-account Edge Function would either
-- fail with a FK violation or leave orphaned rows.
--
-- This migration:
--   1. Drops the existing FKs on dependent tables
--   2. Re-adds them with `on delete cascade`
-- so that wiping `auth.users` (or `public.profiles`) cleanly
-- removes everything the user produced.
-- ═══════════════════════════════════════════════════════════

-- ── runs ──
alter table public.runs
  drop constraint if exists runs_user_id_fkey;
alter table public.runs
  add constraint runs_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- ── leaderboard_entries ──
alter table public.leaderboard_entries
  drop constraint if exists leaderboard_entries_user_id_fkey;
alter table public.leaderboard_entries
  add constraint leaderboard_entries_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- leaderboard_entries also references runs(id) — cascade so a
-- deleted run takes its leaderboard pointer with it.
alter table public.leaderboard_entries
  drop constraint if exists leaderboard_entries_run_id_fkey;
alter table public.leaderboard_entries
  add constraint leaderboard_entries_run_id_fkey
  foreign key (run_id) references public.runs(id) on delete cascade;

-- ── challenge_progress ──
alter table public.challenge_progress
  drop constraint if exists challenge_progress_user_id_fkey;
alter table public.challenge_progress
  add constraint challenge_progress_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- ── user_achievements ──
alter table public.user_achievements
  drop constraint if exists user_achievements_user_id_fkey;
alter table public.user_achievements
  add constraint user_achievements_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
