-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 1.5 — raw GPS trace persistence
--
-- Every insert into public.runs fires a trigger that fan-outs the
-- gps_trace jsonb into one row per fix in public.run_points. This
-- is the foundation for future geometry recompute (Phase 2 / 3) —
-- without per-fix rows we can't replay a run against an updated
-- canonical geometry version, so a corrected line would silently
-- lose all historical times.
--
-- gps_trace shape on prod (verified 2026-04-26):
--   { "sampledPoints": [{ "t": <epoch_ms>, "lat": ..., "lng": ... }, ...],
--     "mode": "...", "startedAt": ..., "finishedAt": ..., "pointCount": ... }
--
-- The trigger handles both the live shape (`sampledPoints` key) and
-- the legacy `points` / bare-array fallbacks for forward compat.
-- Optional accuracy / alt / speed fields populate when present.
--
-- Applied to prod 2026-04-26 via Supabase MCP as migration version
-- 20260426093800. Backfill on the 8 prod runs with non-null
-- gps_trace produced 284 run_points rows.
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.tg_runs_persist_raw_points()
returns trigger
language plpgsql
as $$
declare
  v_pts jsonb;
begin
  if new.gps_trace is null then
    return new;
  end if;

  -- Locate the points array regardless of wrapper shape.
  v_pts := case
    when jsonb_typeof(new.gps_trace) = 'array'   then new.gps_trace
    when new.gps_trace ? 'sampledPoints'         then new.gps_trace->'sampledPoints'
    when new.gps_trace ? 'points'                then new.gps_trace->'points'
    else null
  end;

  if v_pts is null or jsonb_typeof(v_pts) <> 'array' then
    return new;
  end if;

  insert into public.run_points (
    run_id, point_index, recorded_at,
    lat, lng, accuracy_m, altitude_m, speed_mps
  )
  select
    new.id,
    (ord - 1)::integer,
    case
      -- Explicit ISO timestamp on the point — trust it.
      when point ? 'recorded_at' then (point->>'recorded_at')::timestamptz
      -- t looks like epoch milliseconds (>= 2001-09-09); convert.
      when point ? 't' and (point->>'t')::numeric > 1000000000000
        then to_timestamp(((point->>'t')::numeric) / 1000.0)
      -- t looks like a relative seconds offset from started_at.
      when point ? 't' and new.started_at is not null
        then new.started_at + ((point->>'t')::numeric * interval '1 second')
      when new.started_at is not null then new.started_at
      else now()
    end,
    (point->>'lat')::double precision,
    (point->>'lng')::double precision,
    nullif((point->>'accuracy')::real, 0),
    (point->>'alt')::real,
    (point->>'speed')::real
  from jsonb_array_elements(v_pts) with ordinality as t(point, ord)
  where (point->>'lat') is not null
    and (point->>'lng') is not null
  on conflict (run_id, point_index) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_runs_persist_raw_points on public.runs;
create trigger trg_runs_persist_raw_points
  after insert on public.runs
  for each row
  execute function public.tg_runs_persist_raw_points();

-- ── Backfill: existing prod runs ──────────────────────────────
--
-- One-shot expansion of historical gps_traces into run_points.
-- ON CONFLICT clause makes this idempotent so reapplying the
-- migration on dev is safe.

with backfill_pts as (
  select
    r.id as run_id,
    (ord - 1)::integer as point_index,
    case
      when point ? 'recorded_at' then (point->>'recorded_at')::timestamptz
      when point ? 't' and (point->>'t')::numeric > 1000000000000
        then to_timestamp(((point->>'t')::numeric) / 1000.0)
      when point ? 't' and r.started_at is not null
        then r.started_at + ((point->>'t')::numeric * interval '1 second')
      when r.started_at is not null then r.started_at
      else now()
    end as recorded_at,
    (point->>'lat')::double precision as lat,
    (point->>'lng')::double precision as lng,
    nullif((point->>'accuracy')::real, 0) as accuracy_m,
    (point->>'alt')::real as altitude_m,
    (point->>'speed')::real as speed_mps
  from public.runs r,
    lateral jsonb_array_elements(
      case
        when jsonb_typeof(r.gps_trace) = 'array'   then r.gps_trace
        when r.gps_trace ? 'sampledPoints'         then r.gps_trace->'sampledPoints'
        when r.gps_trace ? 'points'                then r.gps_trace->'points'
        else '[]'::jsonb
      end
    ) with ordinality as t(point, ord)
  where r.gps_trace is not null
    and (point->>'lat') is not null
    and (point->>'lng') is not null
)
insert into public.run_points (
  run_id, point_index, recorded_at, lat, lng, accuracy_m, altitude_m, speed_mps
)
select run_id, point_index, recorded_at, lat, lng, accuracy_m, altitude_m, speed_mps
from backfill_pts
on conflict (run_id, point_index) do nothing;

commit;
