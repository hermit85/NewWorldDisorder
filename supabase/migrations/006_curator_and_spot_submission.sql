-- ═══════════════════════════════════════════════════════════
-- 006: Curator role + user-submitted spots + trail calibration
--
-- Model shift: instead of seeding spots/trails from code, the
-- catalog is now user-submitted and curator-approved.
--
-- Roles:
--   rider     — default; can submit new spots (pending)
--   curator   — can approve/reject spots, mark trails verified
--   moderator — reserved for later (UGC policing). Same write
--               permissions as curator for now.
--
-- Lifecycle:
--   A rider submits a spot → status 'pending'.
--   A curator flips it to 'active' (visible to everyone) or
--   'rejected' (with reason).
--   A trail can only be attached to an 'active' spot, and starts
--   in calibration_status 'draft'; a pioneer refines its
--   geometry (array of {lat,lng,altitude}) until a curator
--   locks it.
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── 1. profiles.role ───────────────────────────────────────
-- New column. Default 'rider' keeps every existing row valid.
-- CHECK constraint is the single source of truth for role
-- vocabulary — RLS policies reference these literals directly.

alter table public.profiles
  add column if not exists role text not null default 'rider'
    check (role in ('rider', 'curator', 'moderator'));

-- ─── 2. spots: submission + approval metadata ───────────────
-- `status` replaces the old `is_active` semantic for the
-- approval workflow. `is_active` stays as an on/off switch a
-- curator can flip on an already-approved spot (e.g. off-season).
--
-- center_lat/lng are denormalized from the canonical geometry
-- for fast radial queries ("spots near me") without opening
-- jsonb on every row.

alter table public.spots
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected')),
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_by  uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists center_lat double precision,
  add column if not exists center_lng double precision;

-- Fast lookup: "show me all active spots" is the hot read path.
create index if not exists idx_spots_status on public.spots(status);

-- ─── 3. trails: pioneer + calibration + geometry ────────────
-- geometry is stored as jsonb (array of {lat,lng,altitude})
-- for flexibility while the schema stabilizes. If / when we
-- need spatial queries, we'll move to PostGIS in a later mig.
--
-- runs_contributed is an atomic counter bumped by the app when
-- a ranked run finishes on this trail — used to decide when a
-- draft trail has enough signal to transition to 'verified'.

alter table public.trails
  add column if not exists pioneer_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists calibration_status text not null default 'draft'
    check (calibration_status in ('draft', 'calibrating', 'verified', 'locked')),
  add column if not exists geometry jsonb,
  add column if not exists pioneered_at timestamptz,
  add column if not exists runs_contributed integer not null default 0;

create index if not exists idx_trails_calibration on public.trails(calibration_status);

-- ─── 4. Wipe seed data from 002_seed_slotwiny.sql ───────────
-- Moving to user-submitted model. Slotwiny will be re-added by
-- Darek as first curator via the app's spot-submission flow.
--
-- Order matters: children first, parents last. runs.spot_id and
-- trails.spot_id do NOT have ON DELETE CASCADE (migration 005
-- only cascaded the user_id edges), so we must clear dependent
-- rows explicitly before dropping spots/trails.

-- Target set: every spot that came from the original seed plus
-- anything that looks like a Kasina placeholder. Kasina was
-- never seeded server-side, but we clean it defensively so a
-- stale row can't shadow a future submission.
--
-- Progress rows first — they reference challenges.
delete from public.challenge_progress
 where challenge_id in (
   select id from public.challenges
   where spot_id in (
     select id from public.spots
     where id = 'slotwiny-arena'
        or id like 'slotwiny-%'
        or id like 'kasina-%'
   )
 );

-- Challenges on those spots.
delete from public.challenges
 where spot_id in (
   select id from public.spots
   where id = 'slotwiny-arena'
      or id like 'slotwiny-%'
      or id like 'kasina-%'
 );

-- Leaderboard entries on trails that belong to those spots.
-- leaderboard_entries.run_id has ON DELETE CASCADE (mig 005),
-- so deleting entries here is the only cleanup needed before
-- the runs go.
delete from public.leaderboard_entries
 where trail_id in (
   select id from public.trails
   where spot_id in (
     select id from public.spots
     where id = 'slotwiny-arena'
        or id like 'slotwiny-%'
        or id like 'kasina-%'
   )
 );

-- Runs on those spots.
delete from public.runs
 where spot_id in (
   select id from public.spots
   where id = 'slotwiny-arena'
      or id like 'slotwiny-%'
      or id like 'kasina-%'
 );

-- Trails on those spots.
delete from public.trails
 where spot_id in (
   select id from public.spots
   where id = 'slotwiny-arena'
      or id like 'slotwiny-%'
      or id like 'kasina-%'
 );

-- Finally the spots themselves.
delete from public.spots
 where id = 'slotwiny-arena'
    or id like 'slotwiny-%'
    or id like 'kasina-%';

-- ─── 5. RLS: spots ──────────────────────────────────────────
-- Replace the blanket "anyone reads all spots" with a two-tier
-- read model: riders see 'active' only, curators/moderators see
-- everything (including 'pending' queue and rejected spots).

drop policy if exists "Anyone can read spots" on public.spots;

create policy "Everyone reads active spots"
  on public.spots for select
  using (status = 'active');

create policy "Curators read all spots"
  on public.spots for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('curator', 'moderator')
    )
  );

-- Any authenticated user can submit a spot, but only in the
-- 'pending' state and only authored by themselves. The CHECK
-- constraint on submitted_by = auth.uid() prevents spoofing.
create policy "Authenticated users can submit pending spots"
  on public.spots for insert
  with check (
    auth.uid() is not null
    and status = 'pending'
    and submitted_by = auth.uid()
  );

-- Only curators/moderators can change status / approval fields.
-- Anyone who can see a row already knows it exists; the USING
-- clause gates row visibility and the WITH CHECK gates what the
-- resulting row may look like.
create policy "Curators manage spot approval"
  on public.spots for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('curator', 'moderator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('curator', 'moderator')
    )
  );

-- ─── 6. RLS: trails ─────────────────────────────────────────
-- A trail may only be inserted under an already-approved spot.
-- This prevents pioneers from pre-populating trails on pending
-- submissions (which would bypass curator review).
create policy "Trails only on active spots"
  on public.trails for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from public.spots s
      where s.id = trails.spot_id
        and s.status = 'active'
    )
  );

-- Pioneer can update their own draft trail geometry.
-- Curators can update anything (calibration_status → 'locked',
-- etc.). `pioneer_user_id = auth.uid()` pins self-edits.
create policy "Pioneer updates own draft trail"
  on public.trails for update
  using (
    pioneer_user_id = auth.uid()
    and calibration_status in ('draft', 'calibrating')
  )
  with check (
    pioneer_user_id = auth.uid()
    and calibration_status in ('draft', 'calibrating')
  );

create policy "Curators update any trail"
  on public.trails for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('curator', 'moderator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('curator', 'moderator')
    )
  );

-- ─── 7. Bootstrap: hermit85 → curator ───────────────────────
-- First curator is seeded here so the submission flow has an
-- approver on day one. If the profile does not exist yet (fresh
-- DB), this update affects zero rows — the app layer should
-- re-run the promotion once hermit85 completes sign-up.
update public.profiles
   set role = 'curator'
 where username = 'hermit85';

-- If hermit85 hasn't signed up yet the UPDATE is a no-op and
-- silently affects zero rows. Surface that as a NOTICE so the
-- operator running `supabase db push` sees it and remembers to
-- promote manually from the dashboard after signup.
do $$
begin
  if not exists (
    select 1 from public.profiles
    where username = 'hermit85' and role = 'curator'
  ) then
    raise notice 'WARNING: hermit85 profile not promoted to curator. Run manual promotion after signup via Supabase Dashboard.';
  end if;
end $$;

commit;
