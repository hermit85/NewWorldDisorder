-- ═══════════════════════════════════════════════════════════
-- 003: Progression Hardening
-- - Atomic XP increment (prevents race conditions)
-- - Achievement XP reward on unlock
-- ═══════════════════════════════════════════════════════════

-- ── Atomic XP increment ──
-- Replaces non-atomic read-modify-write pattern.
-- Uses database-level increment to prevent lost updates.

create or replace function public.increment_profile_xp(
  p_user_id uuid,
  p_xp_to_add integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_new_xp integer;
  v_new_rank text;
begin
  -- Atomic increment using UPDATE ... RETURNING
  update public.profiles
  set
    xp = xp + p_xp_to_add,
    updated_at = now()
  where id = p_user_id
  returning xp into v_new_xp;

  if v_new_xp is null then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  -- Compute new rank from XP thresholds
  v_new_rank := case
    when v_new_xp >= 30000 then 'legend'
    when v_new_xp >= 12000 then 'apex'
    when v_new_xp >= 5000 then 'slayer'
    when v_new_xp >= 2000 then 'hunter'
    when v_new_xp >= 500 then 'rider'
    else 'rookie'
  end;

  -- Update rank if changed
  update public.profiles
  set rank_id = v_new_rank
  where id = p_user_id and rank_id != v_new_rank;

  return jsonb_build_object(
    'xp', v_new_xp,
    'rank_id', v_new_rank,
    'xp_added', p_xp_to_add
  );
end;
$$;

-- ── Achievement unlock with XP reward ──
-- Atomically unlocks achievement + grants XP reward.
-- Idempotent: re-unlock returns existing data without double-granting XP.

create or replace function public.unlock_achievement_with_xp(
  p_user_id uuid,
  p_achievement_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_xp_reward integer;
  v_already_unlocked boolean;
  v_new_xp integer;
begin
  -- Get XP reward for this achievement
  select xp_reward into v_xp_reward
  from public.achievements
  where id = p_achievement_id;

  if v_xp_reward is null then
    return jsonb_build_object('error', 'achievement_not_found');
  end if;

  -- Check if already unlocked (idempotent)
  select exists(
    select 1 from public.user_achievements
    where user_id = p_user_id and achievement_id = p_achievement_id
  ) into v_already_unlocked;

  if v_already_unlocked then
    return jsonb_build_object('status', 'already_unlocked', 'xp_awarded', 0);
  end if;

  -- Unlock achievement
  insert into public.user_achievements (user_id, achievement_id, unlocked_at)
  values (p_user_id, p_achievement_id, now())
  on conflict (user_id, achievement_id) do nothing;

  -- Grant XP reward atomically
  if v_xp_reward > 0 then
    update public.profiles
    set xp = xp + v_xp_reward, updated_at = now()
    where id = p_user_id
    returning xp into v_new_xp;

    -- Update rank
    update public.profiles
    set rank_id = case
      when v_new_xp >= 30000 then 'legend'
      when v_new_xp >= 12000 then 'apex'
      when v_new_xp >= 5000 then 'slayer'
      when v_new_xp >= 2000 then 'hunter'
      when v_new_xp >= 500 then 'rider'
      else 'rookie'
    end
    where id = p_user_id;
  end if;

  return jsonb_build_object(
    'status', 'unlocked',
    'achievement_id', p_achievement_id,
    'xp_awarded', coalesce(v_xp_reward, 0),
    'new_xp', v_new_xp
  );
end;
$$;
