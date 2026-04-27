-- Chunk 10.1 hotfix: Auto-approve spot submissions from curators/moderators
-- Rationale: curators have authority to moderate; their own submissions don't need
-- a second approval step. Regular users still go through 'pending' → curator approve.
-- Trigger fires AFTER INSERT, so submit_spot RPC logic (dedup check etc.) runs first.

CREATE OR REPLACE FUNCTION public.auto_approve_curator_spot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_role text;
begin
  -- Only auto-promote pending spots
  if NEW.status <> 'pending' then
    return NEW;
  end if;

  -- Fetch submitter's role
  select role into v_role
  from public.profiles
  where id = NEW.submitted_by;

  -- Auto-approve if curator or moderator
  if v_role in ('curator', 'moderator') then
    NEW.status := 'active';
    NEW.is_active := true;
    NEW.approved_by := NEW.submitted_by;  -- self-approval
    NEW.approved_at := now();
  end if;

  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_curator_spot ON public.spots;

CREATE TRIGGER trg_auto_approve_curator_spot
  BEFORE INSERT ON public.spots
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_curator_spot();

COMMENT ON FUNCTION public.auto_approve_curator_spot() IS
  'Chunk 10.1: Auto-approve spot submissions from curator/moderator roles. Regular users still go through pending state.';
