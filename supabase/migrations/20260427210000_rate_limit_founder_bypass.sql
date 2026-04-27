-- Rate-limit fix for founder testing.
--
-- 20260429000012 added a 5-min ranked-run rate limit per (user,
-- trail) pair to stop spam. Curator + moderator roles bypass it.
-- Founder was missed — and founder is the role that grinds the
-- same trail back-to-back during TestFlight QA. Result: every
-- second attempt fails with `run_rate_limited`, surfaced in the
-- Result screen as "Serwer: rpc_transport — run_rate_limited".
--
-- Add 'founder' to the bypass list. No other behavior change.

create or replace function public.tg_runs_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
  v_user_role    text;
begin
  if new.user_id is null or new.mode is null then
    return new;
  end if;

  if new.mode <> 'ranked' then
    return new;
  end if;

  select role into v_user_role from public.profiles where id = new.user_id;
  -- Founder added to the bypass list so QA on the same trail in
  -- rapid succession isn't blocked. Curator + moderator stay
  -- exempt; regular riders still hit the 5-min limit.
  if coalesce(v_user_role, 'rider') in ('curator', 'moderator', 'founder') then
    return new;
  end if;

  select count(*)
    into v_recent_count
    from public.runs
   where user_id = new.user_id
     and trail_id = new.trail_id
     and mode = 'ranked'
     and created_at > now() - interval '5 minutes';

  if v_recent_count >= 1 then
    raise exception 'run_rate_limited'
      using detail = format(
        'Rider %s already submitted a ranked run for trail %s within the last 5 minutes.',
        new.user_id, new.trail_id
      );
  end if;

  return new;
end;
$$;
