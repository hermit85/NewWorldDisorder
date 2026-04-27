-- Founder god-mode: delete a user account.
--
-- For TestFlight cleanup of empty / spam profiles. Founder-only,
-- security definer, refuses self-delete (so the founder cannot
-- accidentally lock themselves out).
--
-- Strategy:
--   1. Explicit cleanup of all activity rows (leaderboard, runs,
--      challenge progress, achievements). Keeps the function
--      deterministic regardless of which FKs cascade vs SET NULL
--      vs RESTRICT in the various migrations.
--   2. Orphan spots/trails the user authored (submitted_by /
--      pioneer_user_id → null) so their history doesn't disappear
--      for other riders who already raced those tracks.
--   3. Drop public.profiles row; auth.users delete cascades to
--      anything we missed (feedback_reports, profile via FK).
--
-- The function returns the deletion summary so the UI can confirm
-- the operation actually fired.

create or replace function public.delete_user_cascade(
  p_user_id uuid,
  p_reason  text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller       uuid := auth.uid();
  v_username     text;
  v_run_count    bigint := 0;
  v_lb_count     bigint := 0;
  v_spot_orphan  bigint := 0;
  v_trail_orphan bigint := 0;
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;
  if not public.is_founder_user() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_user_id = v_caller then
    return jsonb_build_object('ok', false, 'code', 'cannot_delete_self');
  end if;

  select username into v_username from public.profiles where id = p_user_id;
  if v_username is null then
    return jsonb_build_object('ok', false, 'code', 'user_not_found');
  end if;

  -- 1. Activity rows (explicit; FK semantics vary across migrations)
  with d as (
    delete from public.leaderboard_entries where user_id = p_user_id returning 1
  ) select count(*) into v_lb_count from d;

  delete from public.challenge_progress where user_id = p_user_id;
  delete from public.user_achievements where user_id = p_user_id;

  with d as (
    delete from public.runs where user_id = p_user_id returning 1
  ) select count(*) into v_run_count from d;

  -- 2. Orphan authored content so the community history stays put
  with u as (
    update public.spots set submitted_by = null
     where submitted_by = p_user_id
     returning 1
  ) select count(*) into v_spot_orphan from u;

  with u as (
    update public.trails set pioneer_user_id = null
     where pioneer_user_id = p_user_id
     returning 1
  ) select count(*) into v_trail_orphan from u;

  -- 3. Profile row + auth.users (auth.users cascades feedback_reports etc.)
  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'deleted_user', v_username,
    'cascade', jsonb_build_object(
      'runs', v_run_count,
      'leaderboard_entries', v_lb_count,
      'spots_orphaned', v_spot_orphan,
      'trails_orphaned', v_trail_orphan
    )
  );
end;
$$;

revoke all    on function public.delete_user_cascade(uuid, text) from public;
grant execute on function public.delete_user_cascade(uuid, text) to authenticated;
