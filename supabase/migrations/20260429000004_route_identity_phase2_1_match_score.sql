-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 2.1 — match_score on every run
--
-- After run_points are populated by trg_runs_persist_raw_points
-- (Phase 1.5), this trigger computes a 0–1 geometric match score
-- against the run's matched geometry version: % of GPS fixes that
-- land within 15 m of the canonical line. The score becomes the
-- input for Phase 2.2 (unique-rider verification counter) and for
-- the eventual route_match_status column.
--
-- Pioneer runs (finalize_seed_run set match_score in Phase 1.3)
-- skip the trigger via the early NULL-guard. Runs without a
-- matched version (legacy or orphan) also skip — match_score
-- stays NULL and the row is excluded from later verification
-- math, which is correct.
--
-- Trigger ordering: this fires AFTER trg_runs_persist_raw_points
-- because PG fires same-kind triggers in name-alphabetical order
-- and 'persist_raw_points' < 'zzz_compute_match_score'.
--
-- Applied to prod 2026-04-26 via Supabase MCP. Backfill on the 8
-- non-orphan historical runs produced match_score=1.000 for all
-- (same trail, same line, GPS clean).
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.tg_runs_compute_match_score()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_canonical_geom jsonb;
  v_canonical_line extensions.geometry;
  v_match_score    numeric(4,3);
  v_pts_total      integer;
  v_pts_matched    integer;
  v_version_id     uuid;
begin
  if new.match_score is not null then
    return new;
  end if;

  v_version_id := new.trail_version_id;
  if v_version_id is null then
    return new;
  end if;

  select geometry
    into v_canonical_geom
    from public.trail_versions
   where id = v_version_id
     and status in ('canonical', 'candidate');

  if v_canonical_geom is null then
    return new;
  end if;

  v_canonical_line := public.fn_jsonb_geometry_to_linestring(v_canonical_geom);
  if v_canonical_line is null then
    return new;
  end if;

  select
    count(*),
    count(*) filter (
      where extensions.ST_DWithin(
        extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography,
        v_canonical_line::extensions.geography,
        15.0
      )
    )
    into v_pts_total, v_pts_matched
    from public.run_points
   where run_id = new.id;

  if v_pts_total = 0 then
    return new;
  end if;

  v_match_score := round(v_pts_matched::numeric / v_pts_total::numeric, 3);

  update public.runs
     set match_score = v_match_score,
         matched_geometry_version_id = coalesce(matched_geometry_version_id, v_version_id)
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_runs_zzz_compute_match_score on public.runs;
create trigger trg_runs_zzz_compute_match_score
  after insert on public.runs
  for each row
  execute function public.tg_runs_compute_match_score();

-- ── Backfill ──────────────────────────────────────────────────

with computed as (
  select
    r.id as run_id,
    r.trail_version_id,
    case
      when count(p.*) = 0 then null::numeric(4,3)
      else round(
        (count(p.*) filter (
          where extensions.ST_DWithin(
            extensions.ST_SetSRID(extensions.ST_MakePoint(p.lng, p.lat), 4326)::extensions.geography,
            public.fn_jsonb_geometry_to_linestring(tv.geometry)::extensions.geography,
            15.0
          )
        ))::numeric / count(p.*)::numeric,
        3
      )
    end as match_score
  from public.runs r
  join public.trail_versions tv on tv.id = r.trail_version_id
  left join public.run_points p on p.run_id = r.id
  where r.match_score is null
    and tv.status in ('canonical', 'candidate')
    and tv.geometry is not null
  group by r.id, r.trail_version_id, tv.geometry
)
update public.runs r
   set match_score = c.match_score,
       matched_geometry_version_id = coalesce(r.matched_geometry_version_id, c.trail_version_id)
  from computed c
 where r.id = c.run_id
   and c.match_score is not null;

commit;
