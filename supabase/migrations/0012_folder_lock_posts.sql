-- ============================================================
-- 0012 — DRIVE FOLDER LOCK + SOCIAL POSTS (workspace v2 follow-ups, 10-23)
--
--   may_link_folder()      true for an active owner, admin or helper member, or for SQL
--                          run with no signed-in user (the SQL Editor, migrations).
--   guard_drive_folder     (R25, Slice 4/5 reviews) a job's, pitch's or development's
--                          drive_folder is set or changed only by them: the helper writes
--                          Save PDF into whatever that column points at, so a teammate's
--                          sign-in must not be able to repoint it. Everything else on the
--                          row stays as 0004/0005 left it.
--   asana_tasks.kind       gains 'post': the 💬 Social Media project's tasks, read-only like
--                          the rest, linked to the job their 🏡2026 Properties tag names.
--
-- Needs 0004 to 0011. Safe to run more than once; nothing is dropped except the
-- asana_tasks kind check, which is replaced. Back up first (helper/backup.js).
-- ============================================================

create or replace function public.may_link_folder() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or exists (select 1 from public.members where user_id = auth.uid() and active and role in ('owner', 'admin', 'helper'))
$$;
revoke execute on function public.may_link_folder() from public, anon;
grant  execute on function public.may_link_folder() to authenticated;

create or replace function public.guard_drive_folder() returns trigger
language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.drive_folder is not null)
     or (tg_op = 'UPDATE' and new.drive_folder is distinct from old.drive_folder) then
    if not public.may_link_folder() then
      raise exception 'Only Matt can link a Drive folder.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists properties_drive_folder on public.properties;
create trigger properties_drive_folder before insert or update on public.properties
  for each row execute function public.guard_drive_folder();
drop trigger if exists pitches_drive_folder on public.pitches;
create trigger pitches_drive_folder before insert or update on public.pitches
  for each row execute function public.guard_drive_folder();
drop trigger if exists dev_projects_drive_folder on public.dev_projects;
create trigger dev_projects_drive_folder before insert or update on public.dev_projects
  for each row execute function public.guard_drive_folder();

-- ---------- asana_tasks: social posts ----------
alter table public.asana_tasks drop constraint if exists asana_tasks_kind_check;
alter table public.asana_tasks add constraint asana_tasks_kind_check
  check (kind in ('listing', 'subtask', 'dev', 'loose', 'post'));
