-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 4.1 — anti-gaming guards
--
-- Two guards on correction proposals (trail_versions inserts with
-- source_type='correction'):
--
--   1. Rate limit — 1 candidate per rider per trail per 24h.
--      Stops the "3 mates spam corrections in 5 minutes" attack
--      vector, where a coordinated cluster of identical proposals
--      could otherwise tip the consensus algorithm fast.
--
--   2. Shortcut detection — if a candidate's distance is shorter
--      than the current canonical by >5%, it never goes straight
--      to the consensus pool; it routes to route_review_queue
--      with severity='high', reason='shortcut_detected'. Always
--      requires a curator decision regardless of supporters_count.
--
-- Rate limit fires BEFORE INSERT so blocked rows never land in
-- trail_versions; shortcut detection fires AFTER INSERT and only
-- writes to route_review_queue (the candidate row stays so the
-- curator can read its geometry when deciding).
--
-- Applied to prod 2026-04-26 via Supabase MCP.
-- ═══════════════════════════════════════════════════════════

begin;

-- ── Rate limit ────────────────────────────────────────────────

create or replace function public.tg_trail_versions_correction_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
  v_user_role    text;
begin
  if new.source_type is distinct from 'correction' then
    return new;
  end if;
  if new.source_user_id is null then
    return new;
  end if;

  select role into v_user_role from public.profiles where id = new.source_user_id;
  if coalesce(v_user_role, 'rider') in ('curator', 'moderator') then
    return new;
  end if;

  select count(*)
    into v_recent_count
    from public.trail_versions
   where trail_id = new.trail_id
     and source_user_id = new.source_user_id
     and source_type = 'correction'
     and created_at > now() - interval '24 hours';

  if v_recent_count >= 1 then
    raise exception 'correction_rate_limited'
      using detail = format(
        'Rider %s already submitted a correction for trail %s within the last 24 hours.',
        new.source_user_id, new.trail_id
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tv_correction_rate_limit on public.trail_versions;
create trigger trg_tv_correction_rate_limit
  before insert on public.trail_versions
  for each row
  execute function public.tg_trail_versions_correction_rate_limit();

-- ── Shortcut detection ────────────────────────────────────────

create or replace function public.fn_geometry_distance_m(p_geometry jsonb)
returns numeric
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_meta_dist numeric;
  v_line      extensions.geometry;
begin
  v_meta_dist := nullif((p_geometry->'meta'->>'totalDistanceM')::numeric, 0);
  if v_meta_dist is not null then
    return v_meta_dist;
  end if;

  v_line := public.fn_jsonb_geometry_to_linestring(p_geometry);
  if v_line is null then
    return null;
  end if;
  return extensions.ST_Length(v_line::extensions.geography)::numeric;
end;
$$;

create or replace function public.tg_trail_versions_shortcut_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical_dist numeric;
  v_candidate_dist numeric;
  v_ratio          numeric;
begin
  if new.source_type is distinct from 'correction' then
    return new;
  end if;
  if new.status is distinct from 'candidate' then
    return new;
  end if;

  select public.fn_geometry_distance_m(geometry)
    into v_canonical_dist
    from public.trail_versions
   where trail_id = new.trail_id
     and status = 'canonical'
   limit 1;

  if v_canonical_dist is null or v_canonical_dist = 0 then
    return new;
  end if;

  v_candidate_dist := public.fn_geometry_distance_m(new.geometry);
  if v_candidate_dist is null then
    return new;
  end if;

  v_ratio := v_candidate_dist / v_canonical_dist;

  if v_ratio < 0.95 then
    insert into public.route_review_queue (
      trail_id, candidate_geometry_version_id,
      reason, severity, details, status
    ) values (
      new.trail_id, new.id,
      'shortcut_detected', 'high',
      jsonb_build_object(
        'candidate_distance_m', round(v_candidate_dist, 2),
        'canonical_distance_m', round(v_canonical_dist, 2),
        'ratio', round(v_ratio, 4),
        'threshold', 0.95,
        'source_user_id', new.source_user_id
      ),
      'pending'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tv_shortcut_check on public.trail_versions;
create trigger trg_tv_shortcut_check
  after insert on public.trail_versions
  for each row
  execute function public.tg_trail_versions_shortcut_check();

commit;
