-- ============================================================
-- 0013 — DRIVE FOLDER LOCK: MARKETING (Matt, 10-26)
--
--   guard_drive_folder     says "Only Marketing can link a Drive Folder." when it refuses.
--   may_link_folder()      gains 'marketing', so the words hold: owner, admin, marketing
--                          and the helper may set or change a Drive folder (and SQL run
--                          with no signed-in user).
--
-- Needs 0012. Safe to run more than once; only the two functions are replaced.
-- ============================================================

create or replace function public.may_link_folder() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or exists (select 1 from public.members where user_id = auth.uid() and active and role in ('owner', 'admin', 'marketing', 'helper'))
$$;
revoke execute on function public.may_link_folder() from public, anon;
grant  execute on function public.may_link_folder() to authenticated;

create or replace function public.guard_drive_folder() returns trigger
language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.drive_folder is not null)
     or (tg_op = 'UPDATE' and new.drive_folder is distinct from old.drive_folder) then
    if not public.may_link_folder() then
      raise exception 'Only Marketing can link a Drive Folder.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
