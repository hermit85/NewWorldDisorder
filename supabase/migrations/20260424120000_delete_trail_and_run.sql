-- ═══════════════════════════════════════════════════════════
-- Widen delete_trail_cascade to accept the pioneer on their own
-- draft/calibrating trail. Add delete_run RPC with leaderboard
-- recalc.
--
-- Scope (B22):
--   - Trail self-delete: the pioneer who seeded a trail can wipe
--     it only while it's still draft/calibrating AND no other
--     rider has contributed a run (runs_contributed <= 1 — their
--     own seeding run counts as the first). Once a second rider
--     lands a ranked attempt we treat the trail as "public
--     history" and only a curator can remove it.
--   - Run delete: the owner or a curator can delete a run. If
--     the deleted run was the user's leaderboard entry on that
--     trail, pick the next-best counted run for the same user
--     and (if found) take over the entry with its duration.
--     Otherwise the entry is removed entirely. Rank-position
--     reshuffling is intentionally left to the next incremental
--     recompute job — keeping this RPC a single transaction
--     without touching every other row on the board.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── Widen delete_trail_cascade ──────────────────────────────
--
-- Existing curator path is unchanged. The new branch allows the
-- pioneer to clean up their own in-flight trail when nobody else
-- has put time on it yet. FOR UPDATE locks the trail row so two
-- concurrent finalize_seed_run + delete calls can't race.

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
  v_is_curator := coalesce(v_role, 'rider') in ('curator', 'moderator');

  select * into v_trail from public.trails where id = p_trail_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  if not v_is_curator then
    -- Pioneer self-delete preconditions.
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

-- ─── delete_run ──────────────────────────────────────────────
--
-- Owner + curator can delete a run. Atomic:
--   1. Lock the run row.
--   2. Capture its user_id + trail_id.
--   3. Remove any leaderboard_entry pointing at it.
--   4. If that entry was current, promote the rider's next-best
--      counted run on the same trail into a fresh entry with
--      rank_position=1 (local to the rider — global position
--      reshuffling is out of scope here and will pick up on the
--      next incremental leaderboard job).
--   5. Delete the run row.

create or replace function public.delete_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid := auth.uid();
  v_role           text;
  v_is_curator     boolean;
  v_run            public.runs%rowtype;
  v_had_entry      boolean := false;
  v_next_run       public.runs%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  v_is_curator := coalesce(v_role, 'rider') in ('curator', 'moderator');

  select * into v_run from public.runs where id = p_run_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'run_not_found');
  end if;

  if not v_is_curator and v_run.user_id <> v_user_id then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  -- Drop the leaderboard entry keyed on this run id (if any).
  delete from public.leaderboard_entries
   where run_id = p_run_id
  returning true into v_had_entry;

  -- If the deleted run was the rider's leaderboard entry, promote
  -- their next-best counted run on the same trail into its slot.
  -- We restrict to period_type='all_time' since B21 only materialises
  -- that period; weekly/seasonal surfaces will need their own
  -- recompute jobs once they come back online.
  if v_had_entry then
    select *
      into v_next_run
      from public.runs
     where trail_id = v_run.trail_id
       and user_id = v_run.user_id
       and id <> p_run_id
       and counted_in_leaderboard = true
     order by duration_ms asc
     limit 1;

    if found then
      insert into public.leaderboard_entries (
        user_id, trail_id, trail_version_id,
        period_type, rank_position, best_duration_ms, run_id
      ) values (
        v_next_run.user_id, v_next_run.trail_id, v_next_run.trail_version_id,
        'all_time', 1, v_next_run.duration_ms, v_next_run.id
      );
      update public.runs set is_pb = true where id = v_next_run.id;
    end if;
  end if;

  delete from public.runs where id = p_run_id;

  return jsonb_build_object(
    'ok', true,
    'run_id', p_run_id,
    'had_leaderboard_entry', v_had_entry,
    'promoted_run_id', case when v_next_run.id is not null then v_next_run.id else null end
  );
end;
$$;

revoke all    on function public.delete_run(uuid) from public;
grant execute on function public.delete_run(uuid) to authenticated;

commit;
