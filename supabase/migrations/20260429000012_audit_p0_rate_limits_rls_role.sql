-- ═══════════════════════════════════════════════════════════
-- AUDIT P0 — security & stability hardening
--
-- Bundles four findings from the ADR-012 follow-up audit:
--   1. submit_spot rate limit (1 spot per submitter per 24 h)
--   2. submit_run rate limit (1 ranked run per user per trail per
--      5 minutes) — practice runs unaffected
--   3. trail_versions RLS — provisional candidates were SELECTable
--      by every authenticated rider; tighten so non-canonical rows
--      are visible only to creator + curator/moderator
--   4. profiles.role NOT NULL DEFAULT 'rider' — null roles bypassed
--      curator checks via NULL-coercion gotchas; harden the column
--      and default value
--
-- Applied to prod 2026-04-26 via Supabase MCP.
-- ═══════════════════════════════════════════════════════════

begin;

-- ── 1. submit_spot rate limit ────────────────────────────────

create or replace function public.tg_spots_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
  v_user_role    text;
begin
  if new.submitted_by is null then
    return new;
  end if;

  select role into v_user_role from public.profiles where id = new.submitted_by;
  if coalesce(v_user_role, 'rider') in ('curator', 'moderator') then
    return new;
  end if;

  select count(*)
    into v_recent_count
    from public.spots
   where submitted_by = new.submitted_by
     and created_at > now() - interval '24 hours';

  if v_recent_count >= 1 then
    raise exception 'spot_rate_limited'
      using detail = format(
        'Rider %s already submitted a spot within the last 24 hours.',
        new.submitted_by
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_spots_submission_rate_limit on public.spots;
create trigger trg_spots_submission_rate_limit
  before insert on public.spots
  for each row
  execute function public.tg_spots_submission_rate_limit();

-- ── 2. submit_run rate limit ─────────────────────────────────

create or replace function public.tg_runs_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
  v_user_role    text;
begin
  if new.user_id is null or new.mode is null then
    return new;
  end if;

  if new.mode <> 'ranked' then
    return new;
  end if;

  select role into v_user_role from public.profiles where id = new.user_id;
  if coalesce(v_user_role, 'rider') in ('curator', 'moderator') then
    return new;
  end if;

  select count(*)
    into v_recent_count
    from public.runs
   where user_id = new.user_id
     and trail_id = new.trail_id
     and mode = 'ranked'
     and created_at > now() - interval '5 minutes';

  if v_recent_count >= 1 then
    raise exception 'run_rate_limited'
      using detail = format(
        'Rider %s already submitted a ranked run for trail %s within the last 5 minutes.',
        new.user_id, new.trail_id
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_runs_submission_rate_limit on public.runs;
create trigger trg_runs_submission_rate_limit
  before insert on public.runs
  for each row
  execute function public.tg_runs_submission_rate_limit();

-- ── 3. trail_versions RLS ────────────────────────────────────
--
-- Pre-audit state: trail_versions had no RLS policies, so every
-- authenticated rider could SELECT every row including private
-- candidates from other riders' correction proposals (their GPS
-- coordinates leak).

alter table public.trail_versions enable row level security;

drop policy if exists trail_versions_select on public.trail_versions;
create policy trail_versions_select on public.trail_versions
  for select
  using (
    status = 'canonical'
    or source_user_id = auth.uid()
    or created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and coalesce(p.role, 'rider') in ('curator', 'moderator')
    )
  );

drop policy if exists trail_versions_insert on public.trail_versions;
create policy trail_versions_insert on public.trail_versions
  for insert
  with check (auth.uid() is not null);

drop policy if exists trail_versions_curator_write on public.trail_versions;
create policy trail_versions_curator_write on public.trail_versions
  for update
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and coalesce(p.role, 'rider') in ('curator', 'moderator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and coalesce(p.role, 'rider') in ('curator', 'moderator')
    )
  );

drop policy if exists trail_versions_curator_delete on public.trail_versions;
create policy trail_versions_curator_delete on public.trail_versions
  for delete
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and coalesce(p.role, 'rider') in ('curator', 'moderator')
    )
  );

-- ── 4. profiles.role NOT NULL DEFAULT 'rider' ────────────────

update public.profiles set role = 'rider' where role is null;

alter table public.profiles
  alter column role set default 'rider';
alter table public.profiles
  alter column role set not null;

commit;
