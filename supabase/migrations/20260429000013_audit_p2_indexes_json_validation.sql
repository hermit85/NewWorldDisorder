-- ═══════════════════════════════════════════════════════════
-- AUDIT P2 — DB hardening
--
--   1. Indexes for common query paths missed in earlier migrations
--      - runs(trail_id, run_quality_status) for leaderboard filters
--      - run_points(run_id, recorded_at) for time-range scans
--        during recompute against future canonical geometry
--      - trail_versions(trail_id, status) for canonical-only queries
--      - route_review_queue(reason, created_at) for admin sweeps
--
--   2. JSON shape validation — gps_trace / geometry / details are
--      jsonb but accept anything. Trigger checks they are objects
--      (not arrays / strings / nulls of the wrong type) before
--      INSERT lands. Defends against malformed RPC payloads from
--      buggy clients.
--
--   3. finalize_pioneer_run RPC is dead since Sprint 4 (mig 012);
--      finalize_seed_run is the live path. Annotate with COMMENT
--      so future readers don't waste time tracing it.
--
-- Applied to prod 2026-04-26 via Supabase MCP.
-- ═══════════════════════════════════════════════════════════

begin;

-- ── 1. Missing indexes ────────────────────────────────────────

create index if not exists idx_runs_trail_quality
  on public.runs(trail_id, run_quality_status)
  where counted_in_leaderboard = true;

create index if not exists idx_run_points_run_time
  on public.run_points(run_id, recorded_at);

create index if not exists idx_trail_versions_trail_status
  on public.trail_versions(trail_id, status);

create index if not exists idx_route_review_queue_reason_age
  on public.route_review_queue(reason, created_at desc)
  where status = 'pending';

-- ── 2. JSON shape validation ──────────────────────────────────

create or replace function public.tg_runs_validate_gps_trace_shape()
returns trigger
language plpgsql
as $$
declare
  v_type text;
begin
  if new.gps_trace is null then
    return new;
  end if;
  v_type := jsonb_typeof(new.gps_trace);
  if v_type not in ('object', 'array') then
    raise exception 'gps_trace_invalid_shape'
      using detail = format(
        'gps_trace must be a jsonb object or array, got %s.', v_type
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_runs_validate_gps_trace_shape on public.runs;
create trigger trg_runs_validate_gps_trace_shape
  before insert or update on public.runs
  for each row
  execute function public.tg_runs_validate_gps_trace_shape();

create or replace function public.tg_trail_versions_validate_geometry_shape()
returns trigger
language plpgsql
as $$
begin
  if new.geometry is null then
    raise exception 'geometry_required'
      using detail = 'trail_versions.geometry cannot be null.';
  end if;
  if jsonb_typeof(new.geometry) <> 'object' then
    raise exception 'geometry_invalid_shape'
      using detail = format(
        'geometry must be a jsonb object, got %s.',
        jsonb_typeof(new.geometry)
      );
  end if;
  if not (new.geometry ? 'points') then
    raise exception 'geometry_missing_points'
      using detail = 'geometry must have a "points" key.';
  end if;
  if jsonb_typeof(new.geometry->'points') <> 'array' then
    raise exception 'geometry_points_not_array'
      using detail = format(
        'geometry.points must be an array, got %s.',
        jsonb_typeof(new.geometry->'points')
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trail_versions_validate_geometry_shape on public.trail_versions;
create trigger trg_trail_versions_validate_geometry_shape
  before insert or update on public.trail_versions
  for each row
  execute function public.tg_trail_versions_validate_geometry_shape();

create or replace function public.tg_route_review_queue_validate_details_shape()
returns trigger
language plpgsql
as $$
begin
  if new.details is null then
    return new;
  end if;
  if jsonb_typeof(new.details) <> 'object' then
    raise exception 'details_invalid_shape'
      using detail = format(
        'route_review_queue.details must be a jsonb object, got %s.',
        jsonb_typeof(new.details)
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_route_review_queue_validate_details_shape on public.route_review_queue;
create trigger trg_route_review_queue_validate_details_shape
  before insert or update on public.route_review_queue
  for each row
  execute function public.tg_route_review_queue_validate_details_shape();

-- ── 3. Deprecate legacy finalize_pioneer_run ──────────────────

comment on function public.finalize_pioneer_run(text, jsonb, jsonb) is
  'DEPRECATED: legacy Pioneer-finalize RPC from migration 008 / '
  '20260423180000. Superseded by finalize_seed_run (live path '
  'since Sprint 4 / migration 012). Kept in DB for historical '
  'audit / read-only diagnostic — DO NOT call from new client '
  'code. Will be dropped in a future cleanup migration once we '
  'are certain no installed-app build still references it.';

commit;
