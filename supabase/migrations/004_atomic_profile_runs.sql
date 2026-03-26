-- ═══════════════════════════════════════════════════════════
-- 004: Atomic profile run counter increment
-- Prevents race condition on concurrent run submissions.
-- ═══════════════════════════════════════════════════════════

create or replace function public.increment_profile_runs(
  p_user_id uuid,
  p_is_pb boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_new_runs integer;
  v_new_pbs integer;
begin
  update public.profiles
  set
    total_runs = total_runs + 1,
    total_pbs = case when p_is_pb then total_pbs + 1 else total_pbs end,
    updated_at = now()
  where id = p_user_id
  returning total_runs, total_pbs into v_new_runs, v_new_pbs;

  if v_new_runs is null then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  return jsonb_build_object(
    'total_runs', v_new_runs,
    'total_pbs', v_new_pbs
  );
end;
$$;
