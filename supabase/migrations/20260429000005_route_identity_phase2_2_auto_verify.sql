-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 2.2 — Track A: crowd auto-verify
--
-- After every run insert / match_score update, count unique riders
-- (excluding pioneer themselves) whose run on the trail's current
-- canonical version landed match_score >= 0.80. If >= 3, flip
-- trail.trust_tier provisional → verified atomically.
--
-- Track B (time-based admin nudge) and Track C (curator GPX) live
-- in later phases; this phase only ships Track A.
--
-- Applied to prod 2026-04-26 via Supabase MCP. Backfill: Prezydencka
-- (8 confirming runs but only 1 distinct non-pioneer user) stays
-- provisional, unique_confirming_riders_count updated to 1.
-- ═══════════════════════════════════════════════════════════

begin;

alter table public.trails
  add column if not exists verified_at timestamptz;

create or replace function public.fn_maybe_verify_trail(p_trail_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trust_tier        public.trust_tier;
  v_current_version   uuid;
  v_pioneer_user_id   uuid;
  v_unique_confirmers integer;
begin
  select trust_tier, current_version_id, pioneer_user_id
    into v_trust_tier, v_current_version, v_pioneer_user_id
    from public.trails
   where id = p_trail_id;

  if v_current_version is null then
    return;
  end if;

  select count(distinct r.user_id)
    into v_unique_confirmers
    from public.runs r
   where r.trail_id = p_trail_id
     and r.matched_geometry_version_id = v_current_version
     and r.match_score >= 0.80
     and r.counted_in_leaderboard = true
     and (v_pioneer_user_id is null or r.user_id <> v_pioneer_user_id);

  update public.trails
     set unique_confirming_riders_count = coalesce(v_unique_confirmers, 0)
   where id = p_trail_id;

  if v_trust_tier = 'provisional'::public.trust_tier
     and coalesce(v_unique_confirmers, 0) >= 3 then
    update public.trails
       set trust_tier = 'verified'::public.trust_tier,
           verified_at = now()
     where id = p_trail_id
       and trust_tier = 'provisional'::public.trust_tier;
  end if;
end;
$$;

create or replace function public.tg_runs_after_match_score_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trail_id is not null and new.match_score is not null then
    perform public.fn_maybe_verify_trail(new.trail_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_runs_zzzz_maybe_verify_insert on public.runs;
create trigger trg_runs_zzzz_maybe_verify_insert
  after insert on public.runs
  for each row
  when (new.match_score is not null)
  execute function public.tg_runs_after_match_score_set();

drop trigger if exists trg_runs_zzzz_maybe_verify_update on public.runs;
create trigger trg_runs_zzzz_maybe_verify_update
  after update of match_score on public.runs
  for each row
  when (new.match_score is not null
        and (old.match_score is null or old.match_score is distinct from new.match_score))
  execute function public.tg_runs_after_match_score_set();

-- Backfill: recount confirmers + flip any trail that already
-- crossed the 3-confirmer threshold from historical data.
select public.fn_maybe_verify_trail(t.id)
  from public.trails t;

commit;
