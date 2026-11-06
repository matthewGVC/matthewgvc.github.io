-- ============================================================
-- 0026 — THE ONE-MINUTE SYNC (stage 2, Matt 11-06)
--
--   Each minute the helper asks Asana what changed in the listing projects (Asana's events
--   feed, helper/asana-events.js) and reads just those tasks again.
--
--   sync_runs.kind   gains 'events': a run that re-read only the tasks the feed named. It is never
--                    the plain read's starting point (that stays the last good 'asana' run) and
--                    never carries the Errors page's list of tasks not linked.
--   sync_state       one row per kind of check, upserted on every check: when it last ran
--                    (checked_at), whether it worked (ok) and a plain line (detail: '3 tasks
--                    changed', 'caught up from the last full read', or the error). The header
--                    reads the 'asana-events' row.
--
-- Only the helper writes sync_state (insert, update, delete for the owner and the helper);
-- every member reads it. No page writes it, so the shared login never can.
-- Needs 0004 (is_member), 0008 (member_role), 0005 (sync_runs). Safe to run more than once;
-- nothing is dropped except the sync_runs kind check, which is replaced.
-- ============================================================

do $$ declare c record; begin
  for c in select conname from pg_constraint
            where conrelid = 'public.sync_runs'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%kind%' loop
    execute format('alter table public.sync_runs drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.sync_runs add constraint sync_runs_kind_check
  check (kind in ('de', 'asana', 'people', 'budget', 'scan', 'backup', 'pdf', 'seed', 'events'));

create table if not exists public.sync_state (
  kind        text primary key,
  checked_at  timestamptz not null,
  ok          boolean not null,
  detail      text
);
comment on table public.sync_state is 'The helper''s last check of each kind (0026): when, whether it worked, and a plain line. Written only by the helper.';

-- ---------- row security ----------
alter table public.sync_state enable row level security;

drop policy if exists "members read sync state" on public.sync_state;
create policy "members read sync state" on public.sync_state for select to authenticated using (public.is_member());
drop policy if exists "helper adds sync state" on public.sync_state;
create policy "helper adds sync state" on public.sync_state for insert to authenticated
  with check (public.member_role() in ('owner', 'helper'));
drop policy if exists "helper changes sync state" on public.sync_state;
create policy "helper changes sync state" on public.sync_state for update to authenticated
  using (public.member_role() in ('owner', 'helper')) with check (public.member_role() in ('owner', 'helper'));
drop policy if exists "helper removes sync state" on public.sync_state;
create policy "helper removes sync state" on public.sync_state for delete to authenticated
  using (public.member_role() in ('owner', 'helper'));
