-- Founder god-mode archive/delete tools.
--
-- Build 50 field-test fix: founder cleanup must be able to either
-- archive bad content without deleting rider history, or hard-delete it
-- intentionally even when other riders already have runs there.

begin;

alter table public.trails
  drop constraint if exists trails_calibration_status_check;

alter table public.trails
  add constraint trails_calibration_status_check
  check (
    calibration_status in (
      'draft',
      'fresh_pending_second_run',
      'live_fresh',
      'live_confirmed',
      'stable',
      'calibrating',
      'verified',
      'locked',
      'archived'
    )
  );

create or replace function public.founder_manage_spot(
  p_spot_id text,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_action text := lower(coalesce(p_action, ''));
  v_spot public.spots%rowtype;
  v_trail_count bigint := 0;
  v_run_count bigint := 0;
  v_lb_count bigint := 0;
  v_foreign_runs bigint := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if coalesce(v_role, 'rider') <> 'founder' then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if v_action not in ('archive', 'delete') then
    return jsonb_build_object('ok', false, 'code', 'invalid_action');
  end if;

  select * into v_spot
    from public.spots
   where id = p_spot_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'spot_not_found');
  end if;

  select count(*) into v_foreign_runs
    from public.runs r
    join public.trails t on t.id = r.trail_id
   where t.spot_id = p_spot_id
     and r.user_id <> v_user_id;

  if v_action = 'archive' then
    update public.spots
       set status = 'rejected',
           is_active = false,
           rejection_reason = coalesce(p_reason, 'founder_archive')
     where id = p_spot_id;

    update public.trails
       set is_active = false,
           calibration_status = 'archived',
           archived_at = coalesce(archived_at, now()),
           archive_reason = coalesce(p_reason, 'founder_archive_spot')
     where spot_id = p_spot_id;
    get diagnostics v_trail_count = row_count;

    return jsonb_build_object(
      'ok', true,
      'mode', 'archived',
      'spot_id', p_spot_id,
      'trails_archived', v_trail_count,
      'foreign_runs', v_foreign_runs
    );
  end if;

  select count(*) into v_trail_count
    from public.trails
   where spot_id = p_spot_id;

  select count(*) into v_run_count
    from public.runs r
    join public.trails t on t.id = r.trail_id
   where t.spot_id = p_spot_id;

  with d as (
    delete from public.leaderboard_entries
     where trail_id in (select id from public.trails where spot_id = p_spot_id)
    returning 1
  )
  select count(*) into v_lb_count from d;

  delete from public.runs
   where trail_id in (select id from public.trails where spot_id = p_spot_id);

  delete from public.trails
   where spot_id = p_spot_id;

  delete from public.spots
   where id = p_spot_id;

  return jsonb_build_object(
    'ok', true,
    'mode', 'deleted',
    'spot_id', p_spot_id,
    'trails_deleted', v_trail_count,
    'runs_deleted', v_run_count,
    'leaderboard_entries_deleted', v_lb_count,
    'foreign_runs', v_foreign_runs
  );
end;
$$;

revoke all on function public.founder_manage_spot(text, text, text) from public;
grant execute on function public.founder_manage_spot(text, text, text) to authenticated;

create or replace function public.founder_manage_trail(
  p_trail_id text,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_action text := lower(coalesce(p_action, ''));
  v_trail public.trails%rowtype;
  v_run_count bigint := 0;
  v_lb_count bigint := 0;
  v_foreign_runs bigint := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if coalesce(v_role, 'rider') <> 'founder' then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if v_action not in ('archive', 'delete') then
    return jsonb_build_object('ok', false, 'code', 'invalid_action');
  end if;

  select * into v_trail
    from public.trails
   where id = p_trail_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  select count(*) into v_foreign_runs
    from public.runs
   where trail_id = p_trail_id
     and user_id <> v_user_id;

  if v_action = 'archive' then
    update public.trails
       set is_active = false,
           calibration_status = 'archived',
           archived_at = coalesce(archived_at, now()),
           archive_reason = coalesce(p_reason, 'founder_archive_trail')
     where id = p_trail_id;

    return jsonb_build_object(
      'ok', true,
      'mode', 'archived',
      'trail_id', p_trail_id,
      'foreign_runs', v_foreign_runs
    );
  end if;

  select count(*) into v_run_count
    from public.runs
   where trail_id = p_trail_id;

  with d as (
    delete from public.leaderboard_entries
     where trail_id = p_trail_id
    returning 1
  )
  select count(*) into v_lb_count from d;

  delete from public.runs
   where trail_id = p_trail_id;

  delete from public.trails
   where id = p_trail_id;

  return jsonb_build_object(
    'ok', true,
    'mode', 'deleted',
    'trail_id', p_trail_id,
    'runs_deleted', v_run_count,
    'leaderboard_entries_deleted', v_lb_count,
    'foreign_runs', v_foreign_runs
  );
end;
$$;

revoke all on function public.founder_manage_trail(text, text, text) from public;
grant execute on function public.founder_manage_trail(text, text, text) to authenticated;

commit;
