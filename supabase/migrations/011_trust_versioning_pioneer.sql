-- ═══════════════════════════════════════════════════════════
-- Sprint 4 — Truth protection + history preservation
-- ADR-012 Final (post-GPT-review cuts)
--
-- Two orthogonal axes:
--   seed_source  — immutable origin: curator | rider
--   trust_tier   — mutable state:    provisional | verified | disputed
--
-- trail_versions captures immutable history. leaderboard_entries
-- and runs reference a specific trail_version_id so a recalibration
-- doesn't silently overwrite context for existing times.
--
-- Pioneer stays at trail-level (pioneer_user_id) and is IMMUTABLE
-- after first assignment (enforced by trigger). Exception:
-- admin_resolve_pioneer() in migration 012 can bypass via session
-- setting for merge/split/dupe resolution.
-- ═══════════════════════════════════════════════════════════

begin;

-- ── Clean two-axis schema ──────────────────────────────────
create type seed_source as enum ('curator', 'rider');
create type trust_tier  as enum ('provisional', 'verified', 'disputed');

alter table public.trails
  add column seed_source        seed_source,
  add column trust_tier         trust_tier,
  add column current_version_id uuid;

-- ── Trail versions (immutable history) ─────────────────────
create table public.trail_versions (
  id                        uuid primary key default gen_random_uuid(),
  trail_id                  text not null references public.trails(id) on delete cascade,
  version_number            integer not null,
  geometry                  jsonb not null,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  superseded_at             timestamptz,
  superseded_by_version_id  uuid references public.trail_versions(id),
  is_current                boolean not null default false,
  unique (trail_id, version_number)
);

-- At most one current version per trail.
create unique index idx_trail_versions_one_current
  on public.trail_versions (trail_id)
  where is_current = true;

create index idx_trail_versions_trail on public.trail_versions(trail_id);

-- ── Reference version from leaderboard + runs (history) ────
alter table public.leaderboard_entries
  add column trail_version_id uuid references public.trail_versions(id);

alter table public.runs
  add column trail_version_id uuid references public.trail_versions(id);

-- ── Pioneer counters on profile (GPT anti-spam split) ──────
-- total = raw seeds; verified = post-community-confirmation (Sprint 5+).
alter table public.profiles
  add column pioneered_total_count    integer not null default 0,
  add column pioneered_verified_count integer not null default 0;

-- ═══════════════════════════════════════════════════════════
-- Pioneer immutability (GPT Rule 1)
-- pioneer_user_id never changes after first assignment, unless
-- `app.pioneer_admin_override` session setting is 'true' (used by
-- admin_resolve_pioneer in mig 012 for exceptional cases).
-- ═══════════════════════════════════════════════════════════

create or replace function public.enforce_pioneer_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.pioneer_user_id is not null
     and new.pioneer_user_id is distinct from old.pioneer_user_id
     and current_setting('app.pioneer_admin_override', true) is distinct from 'true'
  then
    raise exception 'Pioneer is immutable. Use admin_resolve_pioneer() for merge/split cases.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_pioneer_immutability
before update of pioneer_user_id on public.trails
for each row
execute function public.enforce_pioneer_immutability();

-- ═══════════════════════════════════════════════════════════
-- Pioneer total-count increment on first assignment
-- Verified count gets its own trigger in Sprint 5+ (trust_tier → verified).
-- ═══════════════════════════════════════════════════════════

create or replace function public.increment_pioneer_total()
returns trigger
language plpgsql
as $$
begin
  if new.pioneer_user_id is not null
     and (tg_op = 'INSERT' or old.pioneer_user_id is null)
  then
    update public.profiles
       set pioneered_total_count = pioneered_total_count + 1
     where id = new.pioneer_user_id;
  end if;
  return new;
end;
$$;

create trigger trg_pioneer_total_increment
after insert or update of pioneer_user_id on public.trails
for each row
execute function public.increment_pioneer_total();

-- ═══════════════════════════════════════════════════════════
-- Backfill existing data
-- ═══════════════════════════════════════════════════════════

-- Every trail with geometry OR a pioneer → version 1 (is_current=true).
insert into public.trail_versions (
  trail_id, version_number, geometry, created_by, created_at, is_current
)
select
  id,
  1,
  coalesce(geometry, '{"points": []}'::jsonb),
  pioneer_user_id,
  coalesce(pioneered_at, created_at),
  true
from public.trails
where geometry is not null or pioneer_user_id is not null;

-- Point trails.current_version_id at the fresh version-1 rows.
update public.trails t
   set current_version_id = tv.id
  from public.trail_versions tv
 where tv.trail_id = t.id
   and tv.version_number = 1;

-- Back-attach existing leaderboard rows to their trail's version 1.
update public.leaderboard_entries le
   set trail_version_id = t.current_version_id
  from public.trails t
 where le.trail_id = t.id
   and t.current_version_id is not null;

-- Back-attach existing runs.
update public.runs r
   set trail_version_id = t.current_version_id
  from public.trails t
 where r.trail_id = t.id
   and t.current_version_id is not null;

-- Seed source + trust tier from the existing creator role.
-- Only stamps trails that already have a pioneer (i.e. calibrating /
-- verified). Draft trails stay NULL on both axes until someone finalizes.
update public.trails t
   set seed_source = case
         when p.role in ('curator', 'moderator') then 'curator'::seed_source
         else 'rider'::seed_source
       end,
       trust_tier = 'provisional'::trust_tier
  from public.profiles p
 where t.pioneer_user_id = p.id
   and t.calibration_status in ('calibrating', 'verified');

-- Backfill pioneered_total_count from existing trail assignments.
-- The trigger will increment from now forward; this catches the pre-trigger rows.
update public.profiles p
   set pioneered_total_count = sub.cnt
  from (
    select pioneer_user_id, count(*) as cnt
      from public.trails
     where pioneer_user_id is not null
  group by pioneer_user_id
  ) sub
 where p.id = sub.pioneer_user_id;

commit;
