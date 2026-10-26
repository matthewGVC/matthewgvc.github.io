-- ============================================================
-- 0014 — LISTING FACTS LOCK (R25 follow-up, Matt, 10-26)
--
--   may_edit_facts()       true for an active owner, admin, marketing, helper or shared
--                          member, or for SQL run with no signed-in user (the SQL Editor,
--                          migrations). 'shared' stays in while the team's shared sign-in
--                          is on: the standalone tools save their facts through it
--                          (property-library.js). Switch the shared sign-in off and only
--                          the named roles remain.
--   guard_facts            a plain 'team' sign-in can no longer make a job or pitch, nor
--                          change its facts (core, label, slug, extras, details doc, stage,
--                          DE / Asana link) by writing the table directly. save_job already
--                          kept them to notes; this closes the direct-write door 0004/0005
--                          left open. Everything else on the row (folder_state, match…)
--                          stays as before; drive_folder keeps its own lock (0012/0013).
--
-- Needs 0013. Safe to run more than once; only functions and triggers are replaced.
-- ============================================================

create or replace function public.may_edit_facts() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or exists (select 1 from public.members where user_id = auth.uid() and active
                   and role in ('owner', 'admin', 'marketing', 'helper', 'shared'))
$$;
revoke execute on function public.may_edit_facts() from public, anon;
grant  execute on function public.may_edit_facts() to authenticated;

create or replace function public.guard_property_facts() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.may_edit_facts() then return new; end if;
  if tg_op = 'INSERT'
     or new.core is distinct from old.core or new.label is distinct from old.label
     or new.slug is distinct from old.slug or new.extras is distinct from old.extras
     or new.details_doc is distinct from old.details_doc or new.stage is distinct from old.stage
     or new.de_listing_id is distinct from old.de_listing_id or new.asana_gid is distinct from old.asana_gid then
    raise exception 'Only Marketing can change a listing''s details.' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.guard_pitch_facts() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.may_edit_facts() then return new; end if;
  if tg_op = 'INSERT'
     or new.core is distinct from old.core or new.label is distinct from old.label
     or new.slug is distinct from old.slug then
    raise exception 'Only Marketing can change a listing''s details.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists properties_facts on public.properties;
create trigger properties_facts before insert or update on public.properties
  for each row execute function public.guard_property_facts();
drop trigger if exists pitches_facts on public.pitches;
create trigger pitches_facts before insert or update on public.pitches
  for each row execute function public.guard_pitch_facts();
