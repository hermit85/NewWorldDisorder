-- ═══════════════════════════════════════════════════════════
-- 007: Spot submission RPCs + submitter self-read policy
--
-- Wraps the three write operations from Sprint 2's submission
-- flow behind security-definer functions so the client never
-- generates primary keys, wall-clock timestamps, or approval
-- metadata itself. RLS on `spots` stays strict; the RPCs are
-- the privileged path.
--
-- Functions:
--   submit_spot(name, lat, lng)   — rider submits a pending spot
--   approve_spot(spot_id)         — curator flips pending→active
--   reject_spot(spot_id, reason)  — curator flips pending→rejected
--
-- Plus: one additional SELECT policy on spots so a rider can
-- read their own pending/rejected rows (migration 006 only let
-- them read `status='active'`).
-- ═══════════════════════════════════════════════════════════

begin;

-- ─── 1. Additive SELECT policy for submitters ───────────────
-- Postgres ORs SELECT policies, so this composes with the two
-- policies introduced in 006 ("Everyone reads active spots" and
-- "Curators read all spots"). Riders now see: active (anyone)
-- OR their own pending/rejected (authored).

create policy "Submitter reads own pending spots"
  on public.spots for select
  using (submitted_by = auth.uid());

-- ─── 2. submit_spot ─────────────────────────────────────────
-- Server is the only place that picks `id` and enforces the
-- 500 m dedup, which makes the check atomic (no client-side
-- TOCTOU race between two concurrent submitters).
--
-- Return shape (jsonb):
--   { ok: true,  spot_id: "submitted-xxxxxxxx" }
--   { ok: false, code: "unauthenticated" }
--   { ok: false, code: "name_too_short" }
--   { ok: false, code: "name_too_long" }
--   { ok: false, code: "duplicate_nearby",
--     near_spot_id, near_spot_name, distance_m }

create or replace function public.submit_spot(
  p_name text,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trimmed text;
  v_user    uuid := auth.uid();
  v_near    record;
  v_id      text;
  v_attempt integer := 0;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  v_trimmed := btrim(coalesce(p_name, ''));
  if char_length(v_trimmed) < 3 then
    return jsonb_build_object('ok', false, 'code', 'name_too_short');
  end if;
  if char_length(v_trimmed) > 80 then
    return jsonb_build_object('ok', false, 'code', 'name_too_long');
  end if;

  -- Nearest pending-or-active spot within 500 m (haversine on
  -- the earth's mean radius in metres). NULL coords are skipped
  -- — a legacy seeded row without lat/lng can never collide.
  select id, name,
         (6371000 * acos(least(1.0,
           cos(radians(p_lat)) * cos(radians(center_lat)) *
           cos(radians(center_lng) - radians(p_lng)) +
           sin(radians(p_lat)) * sin(radians(center_lat))
         )))::integer as distance_m
    into v_near
    from public.spots
   where status in ('active', 'pending')
     and center_lat is not null
     and center_lng is not null
     and (6371000 * acos(least(1.0,
           cos(radians(p_lat)) * cos(radians(center_lat)) *
           cos(radians(center_lng) - radians(p_lng)) +
           sin(radians(p_lat)) * sin(radians(center_lat))
         ))) <= 500
   order by 3 asc
   limit 1;

  if v_near.id is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'duplicate_nearby',
      'near_spot_id', v_near.id,
      'near_spot_name', v_near.name,
      'distance_m', v_near.distance_m
    );
  end if;

  -- Generate `submitted-<8 hex>` ID. Collision odds on 16^8 are
  -- ~1 in 4e9, but retry a few times defensively.
  loop
    v_attempt := v_attempt + 1;
    v_id := 'submitted-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    exit when not exists (select 1 from public.spots where id = v_id);
    if v_attempt >= 5 then
      raise exception 'spot_id collision after 5 attempts';
    end if;
  end loop;

  insert into public.spots (
    id, slug, name, status,
    submitted_by, center_lat, center_lng,
    is_active
  ) values (
    v_id,
    v_id,                -- slug = id for user submissions; curator can rename at approve time later
    v_trimmed,
    'pending',
    v_user,
    p_lat,
    p_lng,
    false                -- becomes true when approved
  );

  return jsonb_build_object('ok', true, 'spot_id', v_id);
end;
$$;

-- ─── 3. approve_spot ────────────────────────────────────────
-- Curator-only. Requires spot to be in 'pending' so approval
-- cannot accidentally resurrect a rejected spot or re-approve
-- an active one (both would be suspicious audit events).
--
-- Return shape (jsonb):
--   { ok: true }
--   { ok: false, code: "not_curator" | "not_found" | "not_pending" }

create or replace function public.approve_spot(
  p_spot_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_role   text;
  v_status text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'not_curator');
  end if;

  select role into v_role from public.profiles where id = v_user;
  if v_role is null or v_role not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'not_curator');
  end if;

  select status into v_status from public.spots where id = p_spot_id;
  if v_status is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'not_pending');
  end if;

  update public.spots
     set status = 'active',
         is_active = true,
         approved_by = v_user,
         approved_at = now(),
         rejection_reason = null
   where id = p_spot_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ─── 4. reject_spot ─────────────────────────────────────────
-- Same guardrails as approve_spot, plus a reason-length check.
-- We keep the rejection reason because rider-facing copy needs
-- it ("Odrzucony: <reason>") — see Sprint 2 spec §12.3.
--
-- Return shape (jsonb):
--   { ok: true }
--   { ok: false, code: "not_curator" | "not_found" | "not_pending" | "reason_too_short" }

create or replace function public.reject_spot(
  p_spot_id text,
  p_reason  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_role    text;
  v_status  text;
  v_reason  text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'not_curator');
  end if;

  select role into v_role from public.profiles where id = v_user;
  if v_role is null or v_role not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'not_curator');
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 then
    return jsonb_build_object('ok', false, 'code', 'reason_too_short');
  end if;

  select status into v_status from public.spots where id = p_spot_id;
  if v_status is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'not_pending');
  end if;

  update public.spots
     set status = 'rejected',
         is_active = false,
         approved_by = v_user,
         approved_at = now(),
         rejection_reason = v_reason
   where id = p_spot_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ─── 5. Grants ──────────────────────────────────────────────
-- Revoke the default PUBLIC execute so anonymous users can't
-- call the RPCs; grant only to `authenticated`.

revoke all on function public.submit_spot(text, double precision, double precision) from public;
revoke all on function public.approve_spot(text) from public;
revoke all on function public.reject_spot(text, text) from public;

grant execute on function public.submit_spot(text, double precision, double precision) to authenticated;
grant execute on function public.approve_spot(text) to authenticated;
grant execute on function public.reject_spot(text, text) to authenticated;

commit;
