-- ═══════════════════════════════════════════════════════════
-- 010: trails.runs_contributed auto-increment trigger
-- ═══════════════════════════════════════════════════════════
-- finalize_pioneer_run (migration 008) sets the counter to 1 for the
-- Pioneer run itself; subsequent counted runs need to bump it too.
-- A trigger keeps this truth next to the runs table so every insert
-- path (RPC, direct, backfill) stays consistent.
--
-- Counted runs only: counted_in_leaderboard=true. That filter excludes
-- practice/unverified/weak-signal runs so the number reflects runs that
-- actually contributed data to the trail's ranking.
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.increment_trail_runs_contributed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.counted_in_leaderboard = true then
    update public.trails
       set runs_contributed = coalesce(runs_contributed, 0) + 1
     where id = new.trail_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_runs_increment_contributed on public.runs;

create trigger trg_runs_increment_contributed
after insert on public.runs
for each row
execute function public.increment_trail_runs_contributed();

-- Backfill: recount existing counted runs per trail. Idempotent — safe
-- to re-run after a partial apply.
update public.trails t
   set runs_contributed = (
     select count(*)
       from public.runs r
      where r.trail_id = t.id
        and r.counted_in_leaderboard = true
   );

commit;
