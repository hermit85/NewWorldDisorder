-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 1.2 — RPCs for anti-duplicate + Smart Suggest
--
--   1. fn_jsonb_geometry_to_linestring — helper, jsonb {points: [...]}
--      → PostGIS LINESTRING (SRID 4326). NULL on <2 points.
--
--   2. check_trail_overlap(p_spot_id, p_geometry) — for each
--      canonical-status trail_version in the spot, % of candidate
--      points within 15 m of the canonical line. Returns rows
--      with overlap_pct + decision_band ('auto_merge' >=0.85,
--      'review' 0.60–0.85, 'distinct' <0.60). Used by Phase 1.3
--      (geo-overlap matrix in finalize_pioneer_run) and by clients
--      that want a pre-flight read.
--
--   3. list_spot_trails(p_spot_id) — Step 0 UI in trail/new.
--      All trails in the spot with name keys, status, pioneer
--      username, aliases. Bypasses RLS via SECURITY DEFINER so
--      anon riders see the canonical list while still being
--      blocked from writing.
--
--   4. create_trail — updated:
--        - HARD reject on normalized_name collision per spot
--          (replaces the old lower(official_name) match).
--        - SOFT reject with code='name_suggests_existing' and
--          suggestions[] when duplicate_base_key matches one or
--          more existing trails AND p_force_create is false.
--          UI shows "wygląda jak Kometa", rider re-submits with
--          p_force_create=true if they really mean a new trail.
--
-- Applied to prod 2026-04-26 via Supabase MCP as migration
-- version 20260426085530; this file mirrors that schema.
-- ═══════════════════════════════════════════════════════════

begin;

-- ── 1. jsonb geometry helper ──────────────────────────────────

create or replace function public.fn_jsonb_geometry_to_linestring(p_geometry jsonb)
returns extensions.geometry
language plpgsql
immutable
parallel safe
as $$
declare
  v_pts extensions.geometry[];
begin
  if p_geometry is null
     or p_geometry->'points' is null
     or jsonb_typeof(p_geometry->'points') <> 'array'
     or jsonb_array_length(p_geometry->'points') < 2
  then
    return null;
  end if;

  select array_agg(
    extensions.ST_SetSRID(
      extensions.ST_MakePoint(
        (point->>'lng')::double precision,
        (point->>'lat')::double precision
      ),
      4326
    )
    order by ord
  )
  into v_pts
  from jsonb_array_elements(p_geometry->'points') with ordinality as t(point, ord);

  return extensions.ST_MakeLine(v_pts);
end;
$$;

grant execute on function public.fn_jsonb_geometry_to_linestring(jsonb)
  to authenticated, anon;

-- ── 2. check_trail_overlap ────────────────────────────────────

create or replace function public.check_trail_overlap(
  p_spot_id text,
  p_geometry jsonb
)
returns table(
  trail_id text,
  official_name text,
  geometry_version_id uuid,
  overlap_pct numeric,
  decision_band text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with candidate_pts as (
    select
      ord,
      (point->>'lng')::double precision as lng,
      (point->>'lat')::double precision as lat
    from jsonb_array_elements(p_geometry->'points')
      with ordinality as t(point, ord)
  ),
  candidate_total as (
    select count(*)::numeric as n from candidate_pts
  ),
  matches as (
    select
      t.id as trail_id,
      t.official_name,
      tv.id as geometry_version_id,
      public.fn_jsonb_geometry_to_linestring(tv.geometry) as canonical_line
    from public.trails t
    join public.trail_versions tv
      on tv.trail_id = t.id and tv.status = 'canonical'
    where t.spot_id = p_spot_id
      and tv.geometry is not null
  ),
  scored as (
    select
      m.trail_id,
      m.official_name,
      m.geometry_version_id,
      case
        when (select n from candidate_total) = 0 then 0::numeric
        when m.canonical_line is null then 0::numeric
        else (
          select count(*)::numeric
            from candidate_pts cp
           where extensions.ST_DWithin(
                   extensions.ST_SetSRID(extensions.ST_MakePoint(cp.lng, cp.lat), 4326)::extensions.geography,
                   m.canonical_line::extensions.geography,
                   15.0
                 )
        ) / (select n from candidate_total)
      end as overlap_pct
    from matches m
  )
  select
    trail_id,
    official_name,
    geometry_version_id,
    round(overlap_pct, 4) as overlap_pct,
    case
      when overlap_pct >= 0.85 then 'auto_merge'
      when overlap_pct >= 0.60 then 'review'
      else 'distinct'
    end as decision_band
  from scored
  where overlap_pct > 0
  order by overlap_pct desc;
$$;

revoke all on function public.check_trail_overlap(text, jsonb) from public;
grant execute on function public.check_trail_overlap(text, jsonb)
  to authenticated;

-- ── 3. list_spot_trails ───────────────────────────────────────

create or replace function public.list_spot_trails(p_spot_id text)
returns table(
  trail_id text,
  official_name text,
  normalized_name text,
  duplicate_base_key text,
  difficulty text,
  trail_type text,
  calibration_status text,
  trust_tier public.trust_tier,
  is_active boolean,
  distance_m integer,
  runs_contributed integer,
  unique_confirming_riders_count integer,
  current_version_id uuid,
  pioneer_user_id uuid,
  pioneer_username text,
  aliases text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.official_name,
    t.normalized_name,
    t.duplicate_base_key,
    t.difficulty,
    t.trail_type,
    t.calibration_status,
    t.trust_tier,
    t.is_active,
    t.distance_m,
    t.runs_contributed,
    t.unique_confirming_riders_count,
    t.current_version_id,
    t.pioneer_user_id,
    p.username,
    coalesce(
      (
        select array_agg(a.alias order by a.alias)
        from public.trail_name_aliases a
        where a.trail_id = t.id
      ),
      array[]::text[]
    ) as aliases
  from public.trails t
  left join public.profiles p on p.id = t.pioneer_user_id
  where t.spot_id = p_spot_id
  order by coalesce(t.sort_order, 999), t.official_name;
$$;

revoke all on function public.list_spot_trails(text) from public;
grant execute on function public.list_spot_trails(text)
  to authenticated, anon;

-- ── 4. create_trail with two-tier check ──────────────────────

drop function if exists public.create_trail(text, text, text, text);

create or replace function public.create_trail(
  p_spot_id text,
  p_name text,
  p_difficulty text,
  p_trail_type text,
  p_force_create boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_name        text;
  v_trail_type  text;
  v_spot_status text;
  v_submitter   uuid;
  v_id          text;
  v_attempt     integer := 0;
  v_sort_order  integer;
  v_normalized  text;
  v_dup_base    text;
  v_suggestions jsonb;
  v_existing    jsonb;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  -- Spot gate (unchanged from 20260423180000_pioneer_self_active_flow)
  select status, submitted_by
    into v_spot_status, v_submitter
    from public.spots
   where id = p_spot_id;
  if v_spot_status is null then
    return jsonb_build_object('ok', false, 'code', 'spot_not_found');
  end if;

  if v_spot_status = 'active' then
    null;
  elsif v_spot_status = 'pending' and v_submitter = v_user then
    null;
  else
    return jsonb_build_object('ok', false, 'code', 'spot_not_active');
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

  v_trail_type := coalesce(nullif(btrim(p_trail_type), ''), 'flow');
  if v_trail_type not in ('downhill', 'flow', 'tech', 'jump') then
    return jsonb_build_object('ok', false, 'code', 'invalid_trail_type');
  end if;

  -- ── ADR-012 anti-duplicate ────────────────────────────────

  v_normalized := public.fn_normalize_trail_name(v_name);
  v_dup_base   := public.fn_duplicate_base_key(v_name);

  -- HARD: normalized_name unique per spot. Catches Kometa /
  -- Kómeta / KOMETA!!! / "Kometa  " (whitespace).
  select jsonb_build_object(
    'trail_id', t.id,
    'official_name', t.official_name,
    'difficulty', t.difficulty,
    'trail_type', t.trail_type
  )
  into v_existing
  from public.trails t
  where t.spot_id = p_spot_id
    and t.normalized_name = v_normalized
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'duplicate_name_in_spot',
      'existing', v_existing
    );
  end if;

  -- SOFT: duplicate_base_key match. Strips garbage suffixes
  -- (digits, V\d+, Bis, Copy, year). Returns suggestions; rider
  -- bypasses by re-submitting with p_force_create=true.
  if not p_force_create then
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'trail_id', t.id,
        'official_name', t.official_name,
        'difficulty', t.difficulty,
        'trail_type', t.trail_type,
        'calibration_status', t.calibration_status
      ) order by t.official_name),
      '[]'::jsonb
    )
    into v_suggestions
    from public.trails t
    where t.spot_id = p_spot_id
      and t.duplicate_base_key = v_dup_base;

    if jsonb_array_length(v_suggestions) > 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'name_suggests_existing',
        'suggestions', v_suggestions
      );
    end if;
  end if;

  -- ── Insert (unchanged from prior version) ────────────────
  select coalesce(max(sort_order), 0) + 1 into v_sort_order
    from public.trails
   where spot_id = p_spot_id;

  loop
    v_attempt := v_attempt + 1;
    v_id := 'pioneer-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    exit when not exists (select 1 from public.trails where id = v_id);
    if v_attempt >= 5 then
      raise exception 'trail_id collision after 5 attempts';
    end if;
  end loop;

  insert into public.trails (
    id, spot_id, official_name, short_name, game_label,
    difficulty, trail_type, distance_m, avg_grade_pct,
    elevation_drop_m, description, game_flavor,
    is_race_trail, is_active, sort_order,
    calibration_status, pioneer_user_id, geometry,
    runs_contributed
  ) values (
    v_id, p_spot_id, v_name, v_name, '',
    p_difficulty, v_trail_type, 0, 0,
    0, '', '',
    true, false, v_sort_order,
    'draft', null, null,
    0
  );

  return jsonb_build_object('ok', true, 'trail_id', v_id);
end;
$$;

revoke all on function public.create_trail(text, text, text, text, boolean)
  from public;
grant execute on function public.create_trail(text, text, text, text, boolean)
  to authenticated;

commit;
