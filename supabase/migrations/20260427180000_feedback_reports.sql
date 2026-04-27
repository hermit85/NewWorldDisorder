-- ═══════════════════════════════════════════════════════════
-- feedback_reports — TestFlight field-feedback inbox.
--
-- Lightweight bug/idea/praise sink for testers. NOT a public
-- comment system. RLS:
--   - any authenticated rider can INSERT a row keyed to their
--     own auth.uid().
--   - only founder / curator / moderator can SELECT (so test
--     reports stay private; we read them in Studio).
--
-- The body is intentionally generous (`text` not enum types
-- for `type` so we can add categories without a migration). The
-- debug_payload jsonb captures whatever the client thinks is
-- relevant: trail id, run id, save status, GPS counts, etc.
-- ═══════════════════════════════════════════════════════════

begin;

create table if not exists public.feedback_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  screen        text,
  trail_id      text,
  run_id        uuid,
  type          text not null check (type in ('bug', 'unclear', 'idea', 'praise')),
  message       text not null check (length(message) between 1 and 4000),
  app_version   text,
  device_info   jsonb,
  debug_payload jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists feedback_reports_user_created_idx
  on public.feedback_reports (user_id, created_at desc);
create index if not exists feedback_reports_type_created_idx
  on public.feedback_reports (type, created_at desc);

alter table public.feedback_reports enable row level security;

-- Rider can write their own report (and only their own).
drop policy if exists feedback_reports_insert_own
  on public.feedback_reports;
create policy feedback_reports_insert_own
  on public.feedback_reports
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Privileged readers — founder + curator + moderator.
drop policy if exists feedback_reports_read_privileged
  on public.feedback_reports;
create policy feedback_reports_read_privileged
  on public.feedback_reports
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.role in ('founder', 'curator', 'moderator')
    )
  );

-- (No update / delete policies → RLS-default deny. Reports are
-- append-only from the client; a Studio user can mutate via the
-- service role if needed.)

commit;
