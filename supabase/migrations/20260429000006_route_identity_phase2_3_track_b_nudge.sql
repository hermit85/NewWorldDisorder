-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 2.3 — Track B: stale-trail admin nudge
--
-- Long-tail trails with low traffic never reach Track A's
-- 3-confirmer threshold and would die in `provisional` forever.
-- Track B sweeps trails older than 30 days that have at least one
-- non-pioneer confirmation and zero open conflict reviews into the
-- route_review_queue with reason='low_confidence_cluster'. A
-- curator can then 1-click verify (Phase 4 admin UI).
--
--   nudge_stale_provisional_trails(min_age_days, min_confirmers)
--     SECURITY DEFINER, curator-only via internal role check.
--     Returns one row per newly-queued trail.
--
-- Designed to be called from a daily pg_cron job AND on-demand via
-- the curator UI; pg_cron scheduling lands when the cron extension
-- gets enabled (separate ops decision — this phase ships the RPC,
-- the cron line is left for ops to wire up).
--
-- Applied to prod 2026-04-26 via Supabase MCP.
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.nudge_stale_provisional_trails(
  p_min_age_days integer default 30,
  p_min_confirmers integer default 1
)
returns table(
  trail_id text,
  official_name text,
  age_days integer,
  unique_confirming_riders_count integer,
  queue_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if coalesce(v_caller_role, 'rider') not in ('curator', 'moderator') then
    raise exception 'forbidden: curator role required';
  end if;

  return query
    with eligible as (
      select
        t.id as trail_id,
        t.official_name,
        extract(day from (now() - t.pioneered_at))::integer as age_days,
        t.unique_confirming_riders_count
      from public.trails t
      where t.trust_tier = 'provisional'::public.trust_tier
        and t.pioneered_at is not null
        and t.pioneered_at < now() - (p_min_age_days || ' days')::interval
        and coalesce(t.unique_confirming_riders_count, 0) >= p_min_confirmers
        and not exists (
          select 1 from public.route_review_queue rrq
           where rrq.trail_id = t.id
             and rrq.status = 'pending'
             and rrq.reason in ('overlap_conflict', 'rider_dispute', 'shortcut_detected')
        )
        and not exists (
          select 1 from public.route_review_queue rrq
           where rrq.trail_id = t.id
             and rrq.reason = 'low_confidence_cluster'
             and rrq.status = 'pending'
        )
    ),
    queued as (
      insert into public.route_review_queue (
        trail_id, candidate_geometry_version_id,
        reason, severity, details, status
      )
      select
        e.trail_id,
        t.current_version_id,
        'low_confidence_cluster',
        'normal',
        jsonb_build_object(
          'age_days', e.age_days,
          'confirmers', e.unique_confirming_riders_count,
          'nudge_threshold_days', p_min_age_days,
          'nudge_min_confirmers', p_min_confirmers
        ),
        'pending'
      from eligible e
      join public.trails t on t.id = e.trail_id
      returning id, trail_id
    )
    select
      e.trail_id,
      e.official_name,
      e.age_days,
      e.unique_confirming_riders_count,
      q.id
    from eligible e
    join queued q on q.trail_id = e.trail_id;
end;
$$;

revoke all on function public.nudge_stale_provisional_trails(integer, integer)
  from public;
grant execute on function public.nudge_stale_provisional_trails(integer, integer)
  to authenticated;

commit;
