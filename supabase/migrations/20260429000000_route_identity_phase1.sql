-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 1 — Route Identity, Geometry, Raw Trace
--
-- Foundations for "one public name, versioned geometry, geo as
-- final arbiter". This migration adds the schema; RPCs and the
-- decision matrix in finalize_pioneer_run land in subsequent
-- migrations (Phase 1.2 / 1.3).
--
-- Schema additions:
--   1. unaccent + postgis extensions (overlap queries + name normalize)
--   2. trails.normalized_name (hard unique per spot, generated col)
--      trails.duplicate_base_key (soft warn, generated col)
--   3. trail_name_aliases (discoverability for variants)
--   4. trail_versions enrichment: status enum + source/confidence/
--      gate fields + direction_type
--   5. run_points (raw GPS trace, one row per fix — required for
--      future recompute against canonical geometry corrections)
--   6. runs columns: matched_geometry_version_id, match_score,
--      recording_mode, quality status, computed timing
--   7. route_review_queue (admin queue for overlap conflicts /
--      shortcut detection / rider disputes)
--
-- Applied to prod 2026-04-26 via Supabase MCP as migration
-- version 20260426082236; this file mirrors that schema for
-- `supabase db reset` reproducibility.
-- ═══════════════════════════════════════════════════════════

begin;

-- ── 1. Extensions ─────────────────────────────────────────────

create extension if not exists unaccent;
create extension if not exists postgis with schema extensions;

-- ── 2. Name normalization helpers ─────────────────────────────
--
-- unaccent() is marked STABLE in the standard PG distribution because
-- text-search dictionaries can in theory be reloaded. For our use
-- case the dictionary is fixed, so we wrap it in an IMMUTABLE SQL
-- function — required for STORED generated columns. Standard pattern.

create or replace function public.immutable_unaccent(p_in text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select unaccent('public.unaccent'::regdictionary, p_in);
$$;

-- normalized_name: hard uniqueness key per spot.
-- Drops diacritics, lowercases, removes punctuation, collapses
-- whitespace. "KÓMĘTA!!!" → "kometa".
create or replace function public.fn_normalize_trail_name(p_name text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_name is null then null
    else trim(both ' ' from
      regexp_replace(
        regexp_replace(
          lower(public.immutable_unaccent(p_name)),
          '[^a-z0-9 ]+', ' ', 'g'
        ),
        '\s+', ' ', 'g'
      )
    )
  end;
$$;

-- duplicate_base_key: soft-warn key. Strips garbage suffixes that
-- riders tack on to indicate "version 2" / "fixed" / "year". Does
-- NOT strip semantic suffixes (elite, pro, black, beginner, blue,
-- red, flow, dh, jump) — those may be real variants and geometry
-- decides. Run twice to catch chained suffixes ("Kometa V2 2025").
create or replace function public.fn_duplicate_base_key(p_name text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(both ' ' from
    regexp_replace(
      regexp_replace(
        public.fn_normalize_trail_name(p_name),
        '\s+(v\d+|bis|copy|new|poprawna|prawdziwa|\d{4}|\d+)$', '', 'gi'
      ),
      '\s+(v\d+|bis|copy|new|poprawna|prawdziwa|\d{4}|\d+)$', '', 'gi'
    )
  );
$$;

-- ── 3. trails — generated keys + uniqueness ───────────────────

alter table public.trails
  add column if not exists normalized_name text
    generated always as (public.fn_normalize_trail_name(official_name)) stored,
  add column if not exists duplicate_base_key text
    generated always as (public.fn_duplicate_base_key(official_name)) stored;

-- Hard uniqueness per spot (replaces the ad-hoc lower(official_name)
-- check inside create_trail RPC; that check stays for now and gets
-- replaced in Phase 1.2 with normalized_name lookup).
create unique index if not exists idx_trails_spot_normalized_name
  on public.trails(spot_id, normalized_name);

-- Soft suggest lookup index.
create index if not exists idx_trails_spot_duplicate_base_key
  on public.trails(spot_id, duplicate_base_key);

-- ── 4. trail_name_aliases — discoverability ───────────────────

create table if not exists public.trail_name_aliases (
  id uuid primary key default gen_random_uuid(),
  trail_id text not null references public.trails(id) on delete cascade,
  alias text not null,
  normalized_alias text generated always as (public.fn_normalize_trail_name(alias)) stored,
  source text not null default 'rider'
    check (source in ('rider', 'curator', 'auto', 'merge')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trail_id, alias)
);

create index if not exists idx_trail_name_aliases_trail
  on public.trail_name_aliases(trail_id);
create index if not exists idx_trail_name_aliases_normalized
  on public.trail_name_aliases(normalized_alias);

-- ── 5. trail_versions enrichment ──────────────────────────────
--
-- Existing table from Sprint 4 / migration 011 has: id, trail_id,
-- version_number, geometry (jsonb), created_by, created_at,
-- superseded_at, superseded_by_version_id, is_current.
-- Extend with ADR-012 fields.

do $$ begin
  create type public.trail_geometry_version_status
    as enum ('candidate', 'canonical', 'superseded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.trail_direction_type
    as enum ('descending', 'ascending', 'loop_cw', 'loop_ccw', 'bidirectional');
exception when duplicate_object then null; end $$;

alter table public.trail_versions
  add column if not exists status public.trail_geometry_version_status
    not null default 'canonical',
  add column if not exists source_run_id uuid
    references public.runs(id) on delete set null,
  add column if not exists source_user_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists source_type text
    check (source_type in ('pioneer', 'correction', 'curator', 'passive', 'merge')),
  add column if not exists confidence_score numeric(4,3) default 0.350,
  add column if not exists supporters_count integer not null default 0,
  add column if not exists start_gate jsonb,
  add column if not exists finish_gate jsonb,
  add column if not exists route_corridor_radius_m integer default 15,
  add column if not exists direction_type public.trail_direction_type
    not null default 'descending',
  add column if not exists distance_m integer,
  add column if not exists elevation_drop_m integer,
  add column if not exists archived_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists became_canonical_at timestamptz;

-- Backfill: existing trail_versions rows are pioneer-sourced.
-- Pre-ADR-012 model treated them as canonical from inception.
update public.trail_versions
   set status = 'canonical',
       source_type = coalesce(source_type, 'pioneer'),
       became_canonical_at = coalesce(became_canonical_at, created_at)
 where is_current = true and became_canonical_at is null;

update public.trail_versions
   set status = 'superseded'
 where is_current = false and superseded_at is not null;

-- ── 6. run_points — raw GPS trace ─────────────────────────────
--
-- One row per GPS fix. Without this, the geometry-correction flow
-- (Phase 2) cannot recompute historical runs against an updated
-- canonical line. ADR-012 makes raw trace mandatory.

create table if not exists public.run_points (
  run_id uuid not null references public.runs(id) on delete cascade,
  point_index integer not null,
  recorded_at timestamptz not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real,
  altitude_m real,
  speed_mps real,
  primary key (run_id, point_index)
);

create index if not exists idx_run_points_run on public.run_points(run_id);

-- ── 7. runs — matching, mode, computed timing ─────────────────

do $$ begin
  create type public.recording_mode
    as enum ('normal', 'pioneer', 'correction');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.run_quality_status
    as enum ('valid', 'invalid_gps', 'invalid_route', 'partial');
exception when duplicate_object then null; end $$;

alter table public.runs
  add column if not exists matched_geometry_version_id uuid
    references public.trail_versions(id) on delete set null,
  add column if not exists match_score numeric(4,3),
  add column if not exists recording_mode public.recording_mode
    not null default 'normal',
  add column if not exists run_quality_status public.run_quality_status,
  add column if not exists timing_confidence numeric(4,3),
  add column if not exists computed_time_ms integer,
  add column if not exists start_crossed_at timestamptz,
  add column if not exists finish_crossed_at timestamptz,
  add column if not exists rejection_reason text;

-- Leaderboard query path: trail + matched version + counted flag.
create index if not exists idx_runs_matched_version
  on public.runs(matched_geometry_version_id);
create index if not exists idx_runs_trail_match_counted
  on public.runs(trail_id, matched_geometry_version_id)
  where counted_in_leaderboard = true;

-- ── 8. route_review_queue — admin queue ───────────────────────

create table if not exists public.route_review_queue (
  id uuid primary key default gen_random_uuid(),
  trail_id text not null references public.trails(id) on delete cascade,
  candidate_geometry_version_id uuid
    references public.trail_versions(id) on delete cascade,
  reason text not null
    check (reason in (
      'overlap_conflict', 'shortcut_detected', 'low_confidence_cluster',
      'rider_dispute', 'name_collision', 'merge_proposal'
    )),
  severity text not null default 'normal'
    check (severity in ('low', 'normal', 'high')),
  details jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'merged')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_notes text
);

create index if not exists idx_route_review_queue_pending
  on public.route_review_queue(status, created_at)
  where status = 'pending';
create index if not exists idx_route_review_queue_trail
  on public.route_review_queue(trail_id);

-- ── 9. RLS policies ───────────────────────────────────────────

alter table public.run_points enable row level security;
alter table public.trail_name_aliases enable row level security;
alter table public.route_review_queue enable row level security;

-- run_points: rider reads own, curator reads all, rider inserts own
drop policy if exists run_points_owner_read on public.run_points;
create policy run_points_owner_read on public.run_points
  for select
  using (
    exists (
      select 1 from public.runs r
       where r.id = run_id and r.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'curator'
    )
  );

drop policy if exists run_points_owner_insert on public.run_points;
create policy run_points_owner_insert on public.run_points
  for insert
  with check (
    exists (
      select 1 from public.runs r
       where r.id = run_id and r.user_id = auth.uid()
    )
  );

-- trail_name_aliases: any authenticated rider can read (discoverability),
-- only curator writes (riders cannot pollute alias table directly —
-- aliases come from auto-merge on geo-overlap or explicit curator action)
drop policy if exists trail_name_aliases_read on public.trail_name_aliases;
create policy trail_name_aliases_read on public.trail_name_aliases
  for select
  using (auth.role() = 'authenticated');

drop policy if exists trail_name_aliases_curator_write on public.trail_name_aliases;
create policy trail_name_aliases_curator_write on public.trail_name_aliases
  for all
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'curator'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'curator'
    )
  );

-- route_review_queue: curator-only
drop policy if exists route_review_queue_curator_all on public.route_review_queue;
create policy route_review_queue_curator_all on public.route_review_queue
  for all
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'curator'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'curator'
    )
  );

-- ── 10. Function privileges ───────────────────────────────────

grant execute on function public.fn_normalize_trail_name(text) to authenticated, anon;
grant execute on function public.fn_duplicate_base_key(text) to authenticated, anon;
grant execute on function public.immutable_unaccent(text) to authenticated, anon;

commit;
