-- ADR-012 Phase 3 follow-up: bump default gate radius 15 → 25 m.
--
-- Phase 3 backfill showed only 1 of 8 historical runs got both
-- crossings populated; the other 7 ended within 16–22 m of the
-- canonical finish point but outside the 15 m radius. 25 m is
-- the industry default for finish-gate detection (Strava uses
-- ~30 m on segments) and absorbs both rider line-of-sight drift
-- and consumer GPS noise without making the gate so loose that
-- a passing rider on a different trail accidentally triggers it.
--
-- route_corridor_radius_m stays at 15 m — gate radius and
-- corridor radius are intentionally different responsibilities
-- (point detection vs. linear match).

begin;

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

-- Repopulate gates with the new default radius. Existing
-- canonical/candidate versions get fresh start_gate/finish_gate
-- jsonb with radius_m=25.
update public.trail_versions
   set start_gate  = public.fn_derive_start_gate(geometry),
       finish_gate = public.fn_derive_finish_gate(geometry)
 where geometry is not null;

-- Re-run crossing backfill against the wider radius. ON the
-- previously-empty rows only — already-populated rows from the
-- earlier 15 m attempt stay valid (their crossing was inside
-- 15 m, which is also inside 25 m, so no recompute needed).
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

commit;
