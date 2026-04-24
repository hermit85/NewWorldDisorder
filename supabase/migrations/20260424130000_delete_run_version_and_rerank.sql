-- ═══════════════════════════════════════════════════════════
-- delete_run hardening (F0#2 — audit follow-up)
--
-- Two gaps in the 20260424120000 delete_run RPC:
--
--   1. Promotion next-best select was scoped by (trail_id, user_id)
--      only. When a rider has runs on multiple trail_versions,
--      promotion could pick a run from a different version than
--      the deleted one, splicing a stale-geometry time into the
--      current leaderboard.
--
--   2. Global rerank after promotion was explicitly deferred to
--      "next incremental job" — but no cron/edge function owns
--      that job on prod. Other riders' rank_position stays stale
--      until organic PBs rewrite them.
--
-- Fix:
--   - Filter next-best select by trail_version_id.
--   - After insert/delete, recompute rank_position for the whole
--     (trail_id, period_type='all_time') slice using row_number()
--     over best_duration_ms ASC. One UPDATE touches every entry.
-- ═══════════════════════════════════════════════════════════

begin;

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

  -- Promote rider's next-best counted run on the SAME trail_version.
  -- Mixing versions in promotion splices a run made against older
  -- geometry into the current leaderboard — corridor/gate assumptions
  -- differ, so the time is not comparable.
  if v_had_entry then
    select *
      into v_next_run
      from public.runs
     where trail_id = v_run.trail_id
       and user_id = v_run.user_id
       and (trail_version_id is not distinct from v_run.trail_version_id)
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

  -- Global rerank for the affected trail's all_time board.
  -- Without this, every rider who was ranked below the deleted/
  -- promoted entry keeps a stale rank_position until their own PB
  -- rewrites it organically. Single UPDATE with row_number() is
  -- cheap at the scale we care about (a trail board rarely exceeds
  -- a few hundred rows).
  if v_had_entry then
    with ranked as (
      select
        id,
        row_number() over (
          order by best_duration_ms asc, updated_at asc
        ) as new_rank
      from public.leaderboard_entries
      where trail_id = v_run.trail_id
        and period_type = 'all_time'
    )
    update public.leaderboard_entries le
       set previous_position = le.rank_position,
           rank_position     = r.new_rank,
           updated_at        = now()
      from ranked r
     where le.id = r.id
       and le.rank_position is distinct from r.new_rank;
  end if;

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
