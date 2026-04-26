-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 4.2 — curator GPX import (Track C)
--
-- A curator uploads a GPX (or any source they vouch for) and
-- import_curator_trail creates the trail + canonical geometry
-- version skipping the entire provisional → verified ladder.
-- The two-tier name check still fires for normalized_name
-- (genuine collisions stay errors), but duplicate_base_key soft
-- warns are bypassed because curator authority over-rides the
-- "rider might be confused about the name" heuristic.
--
--   import_curator_trail(spot_id, name, difficulty, trail_type,
--                        geometry, distance_m, elevation_drop_m)
--     curator/moderator-only.
--     Returns { ok, trail_id, version_id, distance_m, elevation_drop_m }.
--
-- Applied to prod 2026-04-26 via Supabase MCP.
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.import_curator_trail(
  p_spot_id          text,
  p_name             text,
  p_difficulty       text,
  p_trail_type       text,
  p_geometry         jsonb,
  p_distance_m       integer default null,
  p_elevation_drop_m integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_user_role   text;
  v_name        text;
  v_normalized  text;
  v_id          text;
  v_attempt     integer := 0;
  v_sort_order  integer;
  v_version_id  uuid;
  v_distance    integer;
  v_elevation   integer;
  v_spot_status text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_user_role from public.profiles where id = v_user;
  if coalesce(v_user_role, 'rider') not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select status
    into v_spot_status
    from public.spots
   where id = p_spot_id;
  if v_spot_status is null then
    return jsonb_build_object('ok', false, 'code', 'spot_not_found');
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 3 then
    return jsonb_build_object('ok', false, 'code', 'name_too_short');
  end if;
  if char_length(v_name) > 60 then
    return jsonb_build_object('ok', false, 'code', 'name_too_long');
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard', 'expert') then
    return jsonb_build_object('ok', false, 'code', 'invalid_difficulty');
  end if;
  if coalesce(p_trail_type, 'flow') not in ('downhill', 'flow', 'tech', 'jump') then
    return jsonb_build_object('ok', false, 'code', 'invalid_trail_type');
  end if;

  v_normalized := public.fn_normalize_trail_name(v_name);
  if exists (
    select 1 from public.trails
     where spot_id = p_spot_id
       and normalized_name = v_normalized
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_name_in_spot');
  end if;

  if public.fn_jsonb_geometry_to_linestring(p_geometry) is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_geometry');
  end if;

  v_distance := coalesce(
    p_distance_m,
    nullif((p_geometry->'meta'->>'totalDistanceM')::integer, 0),
    floor(public.fn_geometry_distance_m(p_geometry))::integer,
    0
  );
  v_elevation := coalesce(
    p_elevation_drop_m,
    nullif((p_geometry->'meta'->>'totalDescentM')::integer, 0),
    0
  );

  loop
    v_attempt := v_attempt + 1;
    v_id := 'curator-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    exit when not exists (select 1 from public.trails where id = v_id);
    if v_attempt >= 5 then
      raise exception 'trail_id collision after 5 attempts';
    end if;
  end loop;

  select coalesce(max(sort_order), 0) + 1 into v_sort_order
    from public.trails
   where spot_id = p_spot_id;

  insert into public.trails (
    id, spot_id, official_name, short_name, game_label,
    difficulty, trail_type, distance_m, avg_grade_pct,
    elevation_drop_m, description, game_flavor,
    is_race_trail, is_active, sort_order,
    calibration_status, pioneer_user_id, pioneered_at, geometry,
    runs_contributed, seed_source, trust_tier,
    confidence_label, consistent_pioneer_runs_count,
    unique_confirming_riders_count, verified_at
  ) values (
    v_id, p_spot_id, v_name, v_name, '',
    p_difficulty, p_trail_type, v_distance, 0,
    v_elevation, '', '',
    true, true, v_sort_order,
    'verified', null, null, p_geometry,
    0, 'curator'::seed_source, 'verified'::trust_tier,
    'curator', 0, 0, now()
  );

  insert into public.trail_versions (
    trail_id, version_number, geometry, created_by, is_current,
    status, source_type, source_user_id,
    confidence_score, direction_type, became_canonical_at,
    distance_m, elevation_drop_m
  ) values (
    v_id, 1, p_geometry, v_user, true,
    'canonical', 'curator', v_user,
    1.000, 'descending', now(),
    v_distance, v_elevation
  )
  returning id into v_version_id;

  update public.trail_versions
     set start_gate  = public.fn_derive_start_gate(p_geometry),
         finish_gate = public.fn_derive_finish_gate(p_geometry)
   where id = v_version_id;

  update public.trails
     set current_version_id = v_version_id
   where id = v_id;

  return jsonb_build_object(
    'ok', true,
    'trail_id', v_id,
    'version_id', v_version_id,
    'distance_m', v_distance,
    'elevation_drop_m', v_elevation
  );
end;
$$;

revoke all on function public.import_curator_trail(
  text, text, text, text, jsonb, integer, integer
) from public;
grant execute on function public.import_curator_trail(
  text, text, text, text, jsonb, integer, integer
) to authenticated;

commit;
