-- Curator-privilege: relaxed Pioneer thresholds for curator/moderator roles.
--
-- Walk-test unlock: hermit_nwd (and any future curator) needs to be able
-- to seed a trail without riding 150 m / 30 s / <20 m GPS accuracy. ADR-002
-- already grants curators full control over spot state transitions — this
-- extends the same trust to Pioneer seeding. Regular riders keep the strict
-- thresholds so rider-seeded trails retain their quality bar.
--
-- Two things change:
--   1. finalize_seed_run — role-gated threshold constants.
--      Curator/moderator: 5 s / 20 m / 5 pts / 50 m accuracy.
--      Rider (and NULL role fallback): 30 s / 150 m / 15 pts / 20 m.
--      Rest of the function body is mig 012 + mig 013 verbatim.
--   2. profiles.role — revoke UPDATE from authenticated users so a
--      rider cannot self-escalate to curator and bypass the strict
--      bar. Role changes must go through a SECURITY DEFINER path
--      (migrations today; a moderator-only RPC later).
--
-- Rollback: re-run supabase/migrations/013_lower_pioneer_threshold.sql
-- to restore the strict function body (CREATE OR REPLACE is idempotent).
-- If the column-level revokes need to be lifted:
--   GRANT UPDATE (role) ON public.profiles TO authenticated, anon;
--   GRANT INSERT (role) ON public.profiles TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.finalize_seed_run(
  p_trail_id            text,
  p_geometry            jsonb,
  p_duration_ms         integer,
  p_gps_trace           jsonb,
  p_median_accuracy_m   real,
  p_quality_tier        text,
  p_verification_status text,
  p_started_at          timestamp with time zone,
  p_finished_at         timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id         uuid;
  v_user_role       text;
  v_is_curator      boolean;
  v_seed_source     seed_source;
  v_trail_row       public.trails%rowtype;
  v_version_id      uuid;
  v_run_id          uuid;
  v_point_count     integer;
  v_distance_m      real;
  v_min_duration_ms integer;
  v_min_distance_m  real;
  v_min_points      integer;
  v_max_accuracy_m  real;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_user_role from public.profiles where id = v_user_id;

  -- COALESCE guards a NULL-role row (possible when the profile was
  -- not yet created — e.g., auth flow race). NULL falls through to
  -- the strict rider bar, which is the safe default.
  v_is_curator := coalesce(v_user_role, 'rider') in ('curator', 'moderator');

  -- Role-based thresholds. Curators seed with relaxed bar (they are
  -- trusted to recalibrate and take responsibility for trail quality);
  -- riders seed with strict bar (original mig 012 values).
  if v_is_curator then
    v_min_duration_ms := 5000;   -- 5 s (vs 30 s for riders)
    v_min_distance_m  := 20;     -- 20 m (vs 150 m)
    v_min_points      := 5;      -- 5 pts (vs 15)
    v_max_accuracy_m  := 50;     -- 50 m (vs 20 m) — urban-canyon walk-test ceiling
  else
    v_min_duration_ms := 30000;
    v_min_distance_m  := 150;
    v_min_points      := 15;
    v_max_accuracy_m  := 20;
  end if;

  select * into v_trail_row from public.trails where id = p_trail_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'trail_not_found');
  end if;

  if v_trail_row.pioneer_user_id is not null then
    return jsonb_build_object('ok', false, 'code', 'already_pioneered');
  end if;

  if v_trail_row.calibration_status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state');
  end if;

  if p_duration_ms < v_min_duration_ms then
    return jsonb_build_object(
      'ok', false,
      'code', 'too_short_duration',
      'observed', p_duration_ms,
      'required', v_min_duration_ms
    );
  end if;

  v_distance_m := coalesce((p_geometry->'meta'->>'totalDistanceM')::real, 0);
  if v_distance_m < v_min_distance_m then
    return jsonb_build_object(
      'ok', false,
      'code', 'too_short_distance',
      'observed', v_distance_m,
      'required', v_min_distance_m
    );
  end if;

  v_point_count := jsonb_array_length(p_geometry->'points');
  if v_point_count < v_min_points then
    return jsonb_build_object(
      'ok', false,
      'code', 'too_few_points',
      'observed', v_point_count,
      'required', v_min_points
    );
  end if;

  if coalesce(p_median_accuracy_m, 999) > v_max_accuracy_m then
    return jsonb_build_object(
      'ok', false,
      'code', 'accuracy_too_poor_avg',
      'observed', p_median_accuracy_m,
      'required', v_max_accuracy_m
    );
  end if;

  v_seed_source := case
    when v_is_curator then 'curator'::seed_source
    else 'rider'::seed_source
  end;

  insert into public.trail_versions (
    trail_id, version_number, geometry, created_by, is_current
  ) values (p_trail_id, 1, p_geometry, v_user_id, true)
  returning id into v_version_id;

  update public.trails set
    pioneer_user_id    = v_user_id,
    pioneered_at       = now(),
    geometry           = p_geometry,
    calibration_status = 'calibrating',
    seed_source        = v_seed_source,
    trust_tier         = 'provisional',
    current_version_id = v_version_id,
    is_active          = true,
    runs_contributed   = 1
  where id = p_trail_id;

  insert into public.runs (
    user_id, trail_id, spot_id, trail_version_id,
    duration_ms, gps_trace, verification_status,
    verification_summary,
    counted_in_leaderboard, is_pb,
    started_at, finished_at, mode
  ) values (
    v_user_id, p_trail_id, v_trail_row.spot_id, v_version_id,
    p_duration_ms, p_gps_trace, p_verification_status,
    jsonb_build_object(
      'quality_tier',      p_quality_tier,
      'median_accuracy_m', p_median_accuracy_m
    ),
    true, true,
    p_started_at, p_finished_at, 'ranked'
  )
  returning id into v_run_id;

  insert into public.leaderboard_entries (
    trail_id, user_id, trail_version_id,
    period_type, rank_position, best_duration_ms, run_id
  ) values (
    p_trail_id, v_user_id, v_version_id,
    'all_time', 1, p_duration_ms, v_run_id
  );

  return jsonb_build_object(
    'ok',                   true,
    'run_id',               v_run_id,
    'seed_source',          v_seed_source::text,
    'trust_tier',           'provisional',
    'version_id',           v_version_id,
    'is_pioneer',           true,
    'leaderboard_position', 1
  );
end;
$function$;

-- ─── profiles.role hardening ────────────────────────────────────────
-- Before this migration, RLS "Users can update own profile" allowed a
-- rider to PATCH /profiles?id=eq.<self> with {"role":"curator"} via
-- PostgREST. With relaxed Pioneer thresholds for curator, that path
-- becomes a self-serve quality-bypass. Revoke the column-level UPDATE
-- privilege so role stays append-only from the client's perspective
-- and can only be mutated via SECURITY DEFINER paths (migrations and
-- future moderator-only RPCs).

REVOKE UPDATE (role) ON public.profiles FROM authenticated;
REVOKE UPDATE (role) ON public.profiles FROM anon;

-- Close the symmetric INSERT hole. Without this, a fresh user could
-- POST /profiles with `{id:self, role:'curator'}` on first-time profile
-- creation (the RLS INSERT policy auth.uid() = id does not filter
-- columns). `profiles.role` has DEFAULT 'rider' (mig 006), so
-- `createProfile` in src/hooks/useAuth.ts which does not send the
-- column keeps working — it just can't be overridden from the client.
REVOKE INSERT (role) ON public.profiles FROM authenticated;
REVOKE INSERT (role) ON public.profiles FROM anon;
