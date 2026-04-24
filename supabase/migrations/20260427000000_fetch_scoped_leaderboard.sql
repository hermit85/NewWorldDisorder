-- ═══════════════════════════════════════════════════════════
-- fetch_scoped_leaderboard RPC (Codex FAZA2-R2 P1)
--
-- The client previously pulled up to 500 raw `runs` rows ordered
-- by duration_ms, then ran a Map dedup in JS to keep one entry
-- per user. Correctness relied on the hope that the raw window
-- contained at least one row for every top-50 unique rider.
--
-- Failure mode on a viral trail: if 3-4 heavy attempters each
-- rack up >100 counted runs on a hot weekend, their repeats fill
-- the 500-row window before slower-but-still-top-50 riders ever
-- appear. Those riders vanish from "today" / "weekend" boards
-- even though they earned a spot.
--
-- This RPC does the dedup where it belongs — in the database —
-- via `distinct on (user_id) order by user_id, duration_ms asc`
-- inside a CTE, then ranks the per-user bests with row_number()
-- and returns the top p_limit entries. The client just consumes
-- the result list.
--
-- Why SECURITY DEFINER:
--   runs / profiles have RLS that permits SELECT for everyone,
--   so we technically don't *need* definer rights. But keeping
--   the search_path locked and running as the function owner
--   matches every other RPC in this codebase and guards against
--   future RLS tightening on `runs` breaking the board silently.
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.fetch_scoped_leaderboard(
  p_trail_id text,
  p_since timestamptz,
  p_limit integer default 50
)
returns table (
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
  with per_user_best as (
    -- One row per user: their best counted time on this trail since cutoff.
    -- distinct on + order by (user_id, duration_ms asc) is the standard
    -- "best row per group" pattern and is index-friendly given
    -- idx_runs_leaderboard (trail_id, counted_in_leaderboard, duration_ms).
    select distinct on (r.user_id)
      r.user_id,
      r.trail_id,
      r.duration_ms
    from public.runs r
    where r.trail_id = p_trail_id
      and r.counted_in_leaderboard = true
      and r.started_at >= p_since
    order by r.user_id, r.duration_ms asc
  )
  select
    pu.user_id,
    pu.trail_id,
    pu.duration_ms::int                                              as best_duration_ms,
    (row_number() over (order by pu.duration_ms asc))::int           as rank_position,
    p.username,
    p.display_name,
    p.rank_id,
    p.avatar_url
  from per_user_best pu
  join public.profiles p on p.id = pu.user_id
  order by pu.duration_ms asc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

comment on function public.fetch_scoped_leaderboard(text, timestamptz, integer) is
  'Scoped leaderboard for a trail since cutoff. Returns the top `p_limit` unique riders by best counted duration_ms. Used by today/weekend boards.';

-- Execute permissions: both authenticated riders and anon (guest)
-- clients should be able to read public leaderboards. Matches the
-- existing "Anyone can read leaderboard" policy on leaderboard_entries.
grant execute on function public.fetch_scoped_leaderboard(text, timestamptz, integer) to authenticated;
grant execute on function public.fetch_scoped_leaderboard(text, timestamptz, integer) to anon;

commit;
