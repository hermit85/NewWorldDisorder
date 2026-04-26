-- ═══════════════════════════════════════════════════════════
-- ADR-012 Phase 4.4 — review queue resolution RPC
--
-- One entry point for the admin UI to resolve a queue item:
--
--   resolve_review_queue_entry(p_queue_id, p_action, p_notes)
--     p_action ∈ {'approve', 'reject'}
--     'approve': for shortcut_detected / overlap_conflict, mark
--                queue 'approved' (no automatic geometry changes —
--                further state changes use merge_trails / direct
--                version status updates)
--     'reject':  mark queue 'rejected', archive the candidate
--                version (status='superseded', archived_at=now)
--                so it stops counting in consensus.
--
-- Merge action is its own RPC (merge_trails); this entrypoint
-- only handles the binary in-place resolutions.
--
-- Applied to prod 2026-04-26 via Supabase MCP.
-- ═══════════════════════════════════════════════════════════

begin;

create or replace function public.resolve_review_queue_entry(
  p_queue_id uuid,
  p_action   text,
  p_notes    text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_user_role   text;
  v_entry       public.route_review_queue%rowtype;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select role into v_user_role from public.profiles where id = v_user;
  if coalesce(v_user_role, 'rider') not in ('curator', 'moderator') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if p_action not in ('approve', 'reject') then
    return jsonb_build_object('ok', false, 'code', 'invalid_action');
  end if;

  select * into v_entry from public.route_review_queue where id = p_queue_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'queue_entry_not_found');
  end if;
  if v_entry.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'already_resolved');
  end if;

  if p_action = 'reject' and v_entry.candidate_geometry_version_id is not null then
    update public.trail_versions
       set status            = 'superseded',
           archived_at       = now(),
           rejection_reason  = coalesce(p_notes, 'rejected_via_review_queue')
     where id = v_entry.candidate_geometry_version_id;
  end if;

  update public.route_review_queue
     set status           = case when p_action = 'approve' then 'approved' else 'rejected' end,
         resolved_at      = now(),
         resolved_by      = v_user,
         resolution_notes = p_notes
   where id = p_queue_id;

  return jsonb_build_object(
    'ok', true,
    'queue_id', p_queue_id,
    'action',   p_action
  );
end;
$$;

revoke all on function public.resolve_review_queue_entry(uuid, text, text)
  from public;
grant execute on function public.resolve_review_queue_entry(uuid, text, text)
  to authenticated;

commit;
