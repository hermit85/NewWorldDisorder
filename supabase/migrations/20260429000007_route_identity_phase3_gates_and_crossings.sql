-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 3 — Gates as bramki + crossing-based timing
--
-- The pre-Phase-3 model used the geometry's first/last GPS point as
-- the start/finish marker, which broke the moment a rider's GPS
-- drifted 5–10 m on the line. Phase 3 makes start/finish into
-- proper bramki — center + radius + bearing — and times the run by
-- when the rider's trace actually crosses each gate.
--
-- 3.1 — Gate derivation (radius default = 25 m)
--   fn_bearing_deg(lat1,lng1,lat2,lng2) — compass bearing helper.
--   fn_derive_start_gate / fn_derive_finish_gate — take geometry,
--     return jsonb {lat, lng, radius_m, direction_deg}. Center is
--     first/last point; bearing is computed against the 5th point
--     in / from the start. Radius defaults to 25 m (Strava-segment
--     standard) so consumer-grade GPS noise + line-of-sight drift
--     don't strand legitimate finishers outside the gate.
--   Backfill: every canonical/candidate trail_version with
--     geometry but missing gates gets gates derived in place.
--
-- 3.2 — Crossing detection
--   fn_first_gate_cross(run_id, gate) — earliest run_point inside
--     the gate radius (geography ST_DWithin).
--   fn_last_gate_cross(run_id, gate) — latest run_point inside.
--   tg_runs_compute_crossings — AFTER INSERT / AFTER UPDATE OF
--     match_score, populate runs.start_crossed_at /
--     finish_crossed_at / computed_time_ms / timing_confidence.
--   Backfill: 8 historical runs got crossings populated (after
--     the 15 → 25 m radius bump; first attempt only caught 1).
--   Avg(client_ms − computed_ms) = -5.6s consistently negative —
--     riders tap START before the start gate and STOP after the
--     finish, exactly the slack ADR-012 §timing wants the system
--     to absorb.
--
-- 3.3 — Recompute RPC
--   recompute_run_against_geometry(run_id, version_id) — curator-
--   only, re-derives match + crossings against a different
--   canonical version. Used by Phase 4 curator GPX import or
--   geometry-correction merge.
--
-- Applied to prod 2026-04-26 via Supabase MCP.
-- ═══════════════════════════════════════════════════════════

begin;

-- ── 3.1 — Gate derivation ─────────────────────────────────────

create or replace function public.fn_bearing_deg(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
) returns numeric
language sql
immutable
parallel safe
as $$
  select round(
    (degrees(atan2(
      sin(radians(p_lng2 - p_lng1)) * cos(radians(p_lat2)),
      cos(radians(p_lat1)) * sin(radians(p_lat2))
        - sin(radians(p_lat1)) * cos(radians(p_lat2)) * cos(radians(p_lng2 - p_lng1))
    ))::numeric + 360) % 360,
    2
  );
$$;

create or replace function public.fn_derive_start_gate(
  p_geometry jsonb,
  p_radius_m integer default 25
) returns jsonb
language plpgsql
immutable
parallel safe
as $$
declare
  v_pts jsonb;
  v_count integer;
  v_first jsonb;
  v_after jsonb;
  v_idx integer;
begin
  v_pts := p_geometry->'points';
  if v_pts is null or jsonb_typeof(v_pts) <> 'array' then
    return null;
  end if;
  v_count := jsonb_array_length(v_pts);
  if v_count < 2 then
    return null;
  end if;
  v_first := v_pts->0;
  v_idx := least(5, v_count - 1);
  v_after := v_pts->v_idx;
  return jsonb_build_object(
    'lat', (v_first->>'lat')::double precision,
    'lng', (v_first->>'lng')::double precision,
    'radius_m', p_radius_m,
    'direction_deg', public.fn_bearing_deg(
      (v_first->>'lat')::double precision,
      (v_first->>'lng')::double precision,
      (v_after->>'lat')::double precision,
      (v_after->>'lng')::double precision
    )
  );
end;
$$;

create or replace function public.fn_derive_finish_gate(
  p_geometry jsonb,
  p_radius_m integer default 25
) returns jsonb
language plpgsql
immutable
parallel safe
as $$
declare
  v_pts jsonb;
  v_count integer;
  v_last jsonb;
  v_before jsonb;
  v_idx integer;
begin
  v_pts := p_geometry->'points';
  if v_pts is null or jsonb_typeof(v_pts) <> 'array' then
    return null;
  end if;
  v_count := jsonb_array_length(v_pts);
  if v_count < 2 then
    return null;
  end if;
  v_last := v_pts->(v_count - 1);
  v_idx := greatest(0, v_count - 6);
  v_before := v_pts->v_idx;
  return jsonb_build_object(
    'lat', (v_last->>'lat')::double precision,
    'lng', (v_last->>'lng')::double precision,
    'radius_m', p_radius_m,
    'direction_deg', public.fn_bearing_deg(
      (v_before->>'lat')::double precision,
      (v_before->>'lng')::double precision,
      (v_last->>'lat')::double precision,
      (v_last->>'lng')::double precision
    )
  );
end;
$$;

-- Backfill: any canonical/candidate trail_version with geometry
-- but missing gates gets gates derived from the geometry.
update public.trail_versions
   set start_gate  = public.fn_derive_start_gate(geometry),
       finish_gate = public.fn_derive_finish_gate(geometry)
 where geometry is not null
   and (start_gate is null or finish_gate is null);

-- ── 3.2 — Crossing detection ──────────────────────────────────

create or replace function public.fn_first_gate_cross(
  p_run_id uuid,
  p_gate jsonb
) returns timestamptz
language sql
stable
parallel safe
set search_path = public, extensions
as $$
  select recorded_at
    from public.run_points p
   where p.run_id = p_run_id
     and extensions.ST_DWithin(
       extensions.ST_SetSRID(extensions.ST_MakePoint(p.lng, p.lat), 4326)::extensions.geography,
       extensions.ST_SetSRID(
         extensions.ST_MakePoint(
           (p_gate->>'lng')::double precision,
           (p_gate->>'lat')::double precision
         ), 4326
       )::extensions.geography,
       coalesce((p_gate->>'radius_m')::double precision, 25.0)
     )
   order by p.recorded_at asc
   limit 1;
$$;

create or replace function public.fn_last_gate_cross(
  p_run_id uuid,
  p_gate jsonb
) returns timestamptz
language sql
stable
parallel safe
set search_path = public, extensions
as $$
  select recorded_at
    from public.run_points p
   where p.run_id = p_run_id
     and extensions.ST_DWithin(
       extensions.ST_SetSRID(extensions.ST_MakePoint(p.lng, p.lat), 4326)::extensions.geography,
       extensions.ST_SetSRID(
         extensions.ST_MakePoint(
           (p_gate->>'lng')::double precision,
           (p_gate->>'lat')::double precision
         ), 4326
       )::extensions.geography,
       coalesce((p_gate->>'radius_m')::double precision, 25.0)
     )
   order by p.recorded_at desc
   limit 1;
$$;

create or replace function public.tg_runs_compute_crossings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version       record;
  v_start_at      timestamptz;
  v_finish_at     timestamptz;
  v_computed_ms   integer;
  v_confidence    numeric(4,3);
begin
  if new.matched_geometry_version_id is null then
    return new;
  end if;
  if new.computed_time_ms is not null and new.start_crossed_at is not null then
    return new;
  end if;

  select start_gate, finish_gate, route_corridor_radius_m
    into v_version
    from public.trail_versions
   where id = new.matched_geometry_version_id;

  if v_version.start_gate is null or v_version.finish_gate is null then
    return new;
  end if;

  v_start_at  := public.fn_first_gate_cross(new.id, v_version.start_gate);
  v_finish_at := public.fn_last_gate_cross(new.id, v_version.finish_gate);

  if v_start_at is null or v_finish_at is null or v_finish_at <= v_start_at then
    return new;
  end if;

  v_computed_ms := (extract(epoch from (v_finish_at - v_start_at)) * 1000)::integer;

  v_confidence := least(
    1.0,
    coalesce(new.match_score, 0.5)
      * case
          when new.duration_ms is null then 0.8
          when new.duration_ms = 0 then 0.5
          when abs(v_computed_ms - new.duration_ms)::numeric / new.duration_ms <= 0.10 then 1.0
          when abs(v_computed_ms - new.duration_ms)::numeric / new.duration_ms <= 0.25 then 0.85
          else 0.65
        end
  );
  v_confidence := greatest(v_confidence, 0.10);

  update public.runs
     set start_crossed_at  = v_start_at,
         finish_crossed_at = v_finish_at,
         computed_time_ms  = v_computed_ms,
         timing_confidence = round(v_confidence, 3)
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_runs_zzzzz_compute_crossings_insert on public.runs;
create trigger trg_runs_zzzzz_compute_crossings_insert
  after insert on public.runs
  for each row
  when (new.match_score is not null)
  execute function public.tg_runs_compute_crossings();

drop trigger if exists trg_runs_zzzzz_compute_crossings_update on public.runs;
create trigger trg_runs_zzzzz_compute_crossings_update
  after update of match_score on public.runs
  for each row
  when (new.match_score is not null
        and (old.match_score is null or old.match_score is distinct from new.match_score))
  execute function public.tg_runs_compute_crossings();

-- Backfill historical runs.
with computed as (
  select
    r.id as run_id,
    public.fn_first_gate_cross(r.id, tv.start_gate)  as start_crossed_at,
    public.fn_last_gate_cross(r.id, tv.finish_gate)  as finish_crossed_at,
    r.duration_ms,
    r.match_score
  from public.runs r
  join public.trail_versions tv on tv.id = r.matched_geometry_version_id
  where r.match_score is not null
    and r.computed_time_ms is null
    and tv.start_gate is not null
    and tv.finish_gate is not null
)
update public.runs r
   set start_crossed_at  = c.start_crossed_at,
       finish_crossed_at = c.finish_crossed_at,
       computed_time_ms  = (extract(epoch from (c.finish_crossed_at - c.start_crossed_at)) * 1000)::integer,
       timing_confidence = round(
         least(
           1.0,
           coalesce(c.match_score, 0.5)
             * case
                 when c.duration_ms is null or c.duration_ms = 0 then 0.6
                 when abs(
                   (extract(epoch from (c.finish_crossed_at - c.start_crossed_at)) * 1000)::integer
                     - c.duration_ms
                 )::numeric / c.duration_ms <= 0.10 then 1.0
                 else 0.85
               end
         ),
         3
       )
  from computed c
 where r.id = c.run_id
   and c.start_crossed_at is not null
   and c.finish_crossed_at is not null
   and c.finish_crossed_at > c.start_crossed_at;

-- ── 3.3 — Recompute RPC (curator-only) ────────────────────────

create or replace function public.recompute_run_against_geometry(
  p_run_id uuid,
  p_geometry_version_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_role text;
  v_run         public.runs%rowtype;
  v_version     record;
  v_canonical_line extensions.geometry;
  v_pts_total   integer;
  v_pts_matched integer;
  v_match_score numeric(4,3);
  v_start_at    timestamptz;
  v_finish_at   timestamptz;
  v_computed_ms integer;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if coalesce(v_caller_role, 'rider') not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select * into v_run from public.runs where id = p_run_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'run_not_found');
  end if;

  select id, geometry, start_gate, finish_gate, status
    into v_version
    from public.trail_versions
   where id = p_geometry_version_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'version_not_found');
  end if;

  v_canonical_line := public.fn_jsonb_geometry_to_linestring(v_version.geometry);
  if v_canonical_line is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;

  select
    count(*),
    count(*) filter (
      where extensions.ST_DWithin(
        extensions.ST_SetSRID(extensions.ST_MakePoint(p.lng, p.lat), 4326)::extensions.geography,
        v_canonical_line::extensions.geography,
        15.0
      )
    )
    into v_pts_total, v_pts_matched
    from public.run_points p
   where p.run_id = p_run_id;

  if v_pts_total = 0 then
    return jsonb_build_object('ok', false, 'code', 'no_run_points');
  end if;

  v_match_score := round(v_pts_matched::numeric / v_pts_total::numeric, 3);
  v_start_at    := public.fn_first_gate_cross(p_run_id, v_version.start_gate);
  v_finish_at   := public.fn_last_gate_cross(p_run_id, v_version.finish_gate);

  if v_start_at is not null and v_finish_at is not null and v_finish_at > v_start_at then
    v_computed_ms := (extract(epoch from (v_finish_at - v_start_at)) * 1000)::integer;
  else
    v_computed_ms := null;
  end if;

  update public.runs
     set matched_geometry_version_id = p_geometry_version_id,
         match_score                 = v_match_score,
         start_crossed_at            = v_start_at,
         finish_crossed_at           = v_finish_at,
         computed_time_ms            = v_computed_ms
   where id = p_run_id;

  return jsonb_build_object(
    'ok',                true,
    'run_id',            p_run_id,
    'match_score',       v_match_score,
    'computed_time_ms',  v_computed_ms,
    'start_crossed_at',  v_start_at,
    'finish_crossed_at', v_finish_at
  );
end;
$$;

revoke all on function public.recompute_run_against_geometry(uuid, uuid)
  from public;
grant execute on function public.recompute_run_against_geometry(uuid, uuid)
  to authenticated;

commit;
