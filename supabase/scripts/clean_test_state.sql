-- ═══════════════════════════════════════════════════════════
-- Clean test state — wipe ALL rider activity + spots/trails.
--
-- One-shot script meant to be pasted into the Supabase Studio
-- SQL Editor (or run via `psql` against the project URL) when
-- you want to start TestFlight from a fresh DB.
--
-- Wipes:
--   - runs, run_points, gate_crossings (cascades)
--   - leaderboard_entries
--   - challenge_progress, user_achievements
--   - trails, trail_versions, trail_name_aliases, route_review_queue
--   - spots
--   - resets profile counters (xp, total_runs, total_pbs,
--     pioneered_verified_count, best_position, favorite_trail_id)
--
-- Preserves:
--   - auth.users          (your two test accounts stay)
--   - public.profiles     (account rows kept; counters zeroed)
--   - public.challenges   (global daily-quest catalog)
--   - public.achievements (global pasy catalog)
--   - storage buckets     (avatars stay; clean separately if needed)
--
-- The whole thing runs inside a transaction. If anything explodes,
-- the script rolls back and the DB stays untouched.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── Before snapshot ────────────────────────────────────────
-- Print current row counts so you can see what's about to go.
do $$
declare
  v_runs   bigint := (select count(*) from public.runs);
  v_spots  bigint := (select count(*) from public.spots);
  v_trails bigint := (select count(*) from public.trails);
  v_lb     bigint := (select count(*) from public.leaderboard_entries);
  v_chal   bigint := (select count(*) from public.challenge_progress);
  v_ach    bigint := (select count(*) from public.user_achievements);
begin
  raise notice 'BEFORE | runs=% spots=% trails=% leaderboard=% challenge_progress=% achievements=%',
    v_runs, v_spots, v_trails, v_lb, v_chal, v_ach;
end$$;

-- ─── Cascade-aware deletes ──────────────────────────────────
-- Order matters because of FK constraints. We work from the
-- leaf tables upward so each delete sees an empty dependency.
--
-- run_points / route_review_queue use ON DELETE CASCADE on
-- trails+runs (per migration 20260429000000), so deleting the
-- parent table removes them. We still issue explicit deletes
-- here for transparency in the row-count log.

delete from public.leaderboard_entries;
delete from public.challenge_progress;
delete from public.user_achievements;
delete from public.run_points;
delete from public.route_review_queue;
delete from public.runs;
delete from public.trail_name_aliases;
delete from public.trail_versions;
delete from public.trails;
delete from public.spots;

-- ─── Reset profile counters ─────────────────────────────────
-- Accounts stay; the cached scalars used by Home/Spoty/Tablica/JA
-- get zeroed so the four screens flip to fresh-rider state on
-- next open without waiting for an aggregate refresh job.
update public.profiles
   set xp = 0,
       total_runs = 0,
       total_pbs = 0,
       pioneered_verified_count = 0,
       best_position = null,
       favorite_trail_id = null,
       rank_id = 'rookie';

-- ─── After snapshot ─────────────────────────────────────────
do $$
declare
  v_runs   bigint := (select count(*) from public.runs);
  v_spots  bigint := (select count(*) from public.spots);
  v_trails bigint := (select count(*) from public.trails);
  v_lb     bigint := (select count(*) from public.leaderboard_entries);
  v_chal   bigint := (select count(*) from public.challenge_progress);
  v_ach    bigint := (select count(*) from public.user_achievements);
  v_profs  bigint := (select count(*) from public.profiles);
begin
  raise notice 'AFTER  | runs=% spots=% trails=% leaderboard=% challenge_progress=% achievements=%',
    v_runs, v_spots, v_trails, v_lb, v_chal, v_ach;
  raise notice 'KEPT   | profiles=% (counters zeroed, accounts intact)', v_profs;
end$$;

commit;

-- ═══════════════════════════════════════════════════════════
-- Done. Open the app on either test device:
--   - Home (START)  → "GDZIE DZIŚ JEŹDZISZ?" (NO_SPOT mission)
--   - Spoty         → "BRAK BIKE PARKÓW · Dodaj pierwszy."
--   - Tablica       → empty / "Wybierz pierwszy bike park"
--   - JA            → DOROBEK 0/0/0/0 · PASY 0/N · Rekordy: empty
--
-- If you want avatars wiped too:
--   delete from storage.objects where bucket_id = 'avatars';
-- ═══════════════════════════════════════════════════════════
