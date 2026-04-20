-- ═══════════════════════════════════════════════════════════
-- 009: Curator cleanup flows — delete_spot_cascade + delete_trail_cascade
-- ═══════════════════════════════════════════════════════════
-- Scoped to curators/moderators (gated via profiles.role). Used during
-- test/dev cycles to remove user-submitted spots and draft trails
-- without hand-writing SQL. Child rows are deleted first so FKs (even
-- ON DELETE RESTRICT) do not block.
--
-- Intentionally omitted:
--   - Un-pioneer of an already-pioneered trail. That would invalidate
--     XP, leaderboard history, and the pioneer-badge for the holder.
--     Ships separately in Sprint 4+ with proper audit trail.
--   - User-initiated spot deletion. Curators only.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── delete_spot_cascade ─────────────────────────────────────

create or replace function public.delete_spot_cascade(p_spot_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role    text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  -- Cascade cleanup child → parent
  delete from public.leaderboard_entries
   where trail_id in (select id from public.trails where spot_id = p_spot_id);

  delete from public.runs
   where trail_id in (select id from public.trails where spot_id = p_spot_id);

  delete from public.challenge_progress
   where challenge_id in (select id from public.challenges where spot_id = p_spot_id);

  delete from public.challenges where spot_id = p_spot_id;
  delete from public.trails     where spot_id = p_spot_id;
  delete from public.spots      where id      = p_spot_id;

  return jsonb_build_object('ok', true, 'spot_id', p_spot_id);
end;
$$;

revoke all    on function public.delete_spot_cascade(text) from public;
grant execute on function public.delete_spot_cascade(text) to authenticated;

-- ─── delete_trail_cascade ────────────────────────────────────

create or replace function public.delete_trail_cascade(p_trail_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role    text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
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
