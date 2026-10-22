-- ============================================================
-- 0008 — TO-DOS ARE MATT'S OWN (workspace v2, asked by Matt 2026-10-21)
--
-- The to-do list holds Matt's personal tasks. Until now any active member
-- (the team's shared sign-in included) could read and change it; the pages
-- already hide it from everyone but Matt, and this makes the database agree.
--
--   owner (Matt)   reads and writes
--   helper         reads only: the nightly backup (helper/backup.js) copies it
--   everyone else  nothing
--
-- scripts/sync_todo.py runs in the SQL Editor as the database owner, so it is
-- unaffected. Safe to run more than once.
-- ============================================================

create or replace function public.member_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid() and active
$$;
revoke execute on function public.member_role() from public, anon;
grant  execute on function public.member_role() to authenticated;

drop policy if exists "members read todos"  on public.todos;
drop policy if exists "members write todos" on public.todos;
drop policy if exists "owner reads todos"   on public.todos;
drop policy if exists "owner writes todos"  on public.todos;
drop policy if exists "helper reads todos"  on public.todos;

create policy "owner reads todos"  on public.todos for select to authenticated
  using (public.member_role() in ('owner', 'helper'));
create policy "owner writes todos" on public.todos for all to authenticated
  using (public.member_role() = 'owner') with check (public.member_role() = 'owner');
