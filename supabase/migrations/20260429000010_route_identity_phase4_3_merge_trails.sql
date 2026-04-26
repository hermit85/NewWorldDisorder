-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 4.3 — merge_trails (curator-only)
--
-- Reconciles a duplicate trail with the canonical one. Used when:
--   - geo-overlap put a candidate in route_review_queue at 60–85%
--     and curator decides "yep, same trail";
--   - a rider pioneered before geo-overlap auto-merge existed and
--     the duplicate slipped through;
--   - two trails turn out to share a physical line after riders
--     supply enough geometry to triangulate.
--
-- Atomic effects:
--   1. All runs on the source trail get reassigned to the target.
--      matched_geometry_version_id is set to the target's
--      current canonical so leaderboards flow through cleanly;
--      match_score / computed_time_ms are nulled to force the
--      Phase 2/3 triggers to recompute on UPDATE.
--   2. Source's official_name and any existing aliases land in
--      trail_name_aliases as alias rows pointing at target so
--      search keeps working.
--   3. Source is marked archived; merged_into_trail_id is set so
--      deeplinks can redirect.
--   4. Pending review_queue entries for source resolve as
--      'merged' with audit trail.
--   5. Target's verification counters refresh (fn_maybe_verify_trail
--      runs once with the new run population).
--
-- Applied to prod 2026-04-26 via Supabase MCP.
-- ═══════════════════════════════════════════════════════════

begin;

alter table public.trails
  add column if not exists merged_into_trail_id text
    references public.trails(id) on delete set null;
alter table public.trails
  add column if not exists archived_at timestamptz;
alter table public.trails
  add column if not exists archive_reason text;

create or replace function public.merge_trails(
  p_source_trail_id text,
  p_target_trail_id text,
  p_reason          text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_user_role   text;
  v_source      public.trails%rowtype;
  v_target      public.trails%rowtype;
  v_target_ver  uuid;
  v_runs_moved  integer;
  v_aliases_added integer;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_user_role from public.profiles where id = v_user;
  if coalesce(v_user_role, 'rider') not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if p_source_trail_id = p_target_trail_id then
    return jsonb_build_object('ok', false, 'code', 'self_merge_forbidden');
  end if;

  select * into v_source from public.trails where id = p_source_trail_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'source_not_found');
  end if;
  if v_source.merged_into_trail_id is not null then
    return jsonb_build_object('ok', false, 'code', 'source_already_merged');
  end if;

  select * into v_target from public.trails where id = p_target_trail_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'target_not_found');
  end if;
  if v_target.spot_id <> v_source.spot_id then
    return jsonb_build_object('ok', false, 'code', 'cross_spot_merge_forbidden');
  end if;

  v_target_ver := v_target.current_version_id;

  update public.runs
     set trail_id = p_target_trail_id,
         trail_version_id = v_target_ver,
         matched_geometry_version_id = v_target_ver,
         match_score = null,
         computed_time_ms = null,
         start_crossed_at = null,
         finish_crossed_at = null
   where trail_id = p_source_trail_id;
  get diagnostics v_runs_moved = row_count;

  insert into public.trail_name_aliases (trail_id, alias, source, created_by)
  select p_target_trail_id, v_source.official_name, 'merge', v_user
   where v_source.official_name is not null
  on conflict (trail_id, alias) do nothing;

  insert into public.trail_name_aliases (trail_id, alias, source, created_by)
  select p_target_trail_id, ana.alias, 'merge', v_user
    from public.trail_name_aliases ana
   where ana.trail_id = p_source_trail_id
  on conflict (trail_id, alias) do nothing;

  get diagnostics v_aliases_added = row_count;

  delete from public.trail_name_aliases where trail_id = p_source_trail_id;

  update public.trails
     set merged_into_trail_id = p_target_trail_id,
         archived_at          = now(),
         archive_reason       = coalesce(p_reason, 'merged_into_target'),
         is_active            = false,
         calibration_status   = 'archived'
   where id = p_source_trail_id;

  update public.route_review_queue
     set status          = 'merged',
         resolved_at     = now(),
         resolved_by     = v_user,
         resolution_notes = format(
           'Source trail %s merged into %s. %s',
           p_source_trail_id,
           p_target_trail_id,
           coalesce(p_reason, '')
         )
   where trail_id = p_source_trail_id
     and status = 'pending';

  perform public.fn_maybe_verify_trail(p_target_trail_id);

  return jsonb_build_object(
    'ok',                true,
    'source_trail_id',   p_source_trail_id,
    'target_trail_id',   p_target_trail_id,
    'runs_moved',        v_runs_moved,
    'aliases_added',     v_aliases_added,
    'merged_at',         now()
  );
end;
$$;

revoke all on function public.merge_trails(text, text, text) from public;
grant execute on function public.merge_trails(text, text, text)
  to authenticated;

commit;
