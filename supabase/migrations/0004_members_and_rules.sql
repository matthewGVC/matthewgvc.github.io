-- ============================================================
-- 0004 — PEOPLE, STAMPING, VERSIONS, MEMBER-ONLY RULES (workspace v2, Slice 1)
--
-- Per-person sign-in (plan D3): each person has their own Supabase account,
-- public sign-up is off, and only accounts listed in `members` (and active)
-- can read or write anything. The team's shared account is a member too
-- (role 'shared') until Matt switches it off, so today's tools keep working.
--
-- Every row of the job tables now records who last changed it (updated_by)
-- and a version number that goes up on every change, so two people (or the
-- desktop helper and a person) can't silently overwrite each other: a write
-- sent with `version=eq.<n>` changes nothing if someone got there first.
--
-- Nothing is dropped or renamed: every existing column and row stays.
-- Safe to run more than once. Before running it: back up (helper/backup.js)
-- and create Matt's and the helper's accounts, so the members insert finds them.
-- ============================================================

-- ---------- members ----------
create table if not exists public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  initials   text not null,
  role       text not null default 'team' check (role in ('owner', 'team', 'helper', 'shared')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.members is
  'Who may use the workspace. Changed in the Supabase dashboard or by SQL only, never from the site.';

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and active)
$$;

-- By email, so this file holds no ids. A person whose account doesn't exist
-- yet is simply skipped; run the file again after creating it.
insert into public.members (user_id, name, initials, role)
select id, 'Matt Bloomfield', 'MB', 'owner' from auth.users where lower(email) = 'matthew@gvcrealestateteam.com'
on conflict (user_id) do nothing;
insert into public.members (user_id, name, initials, role)
select id, 'Desktop helper', 'H', 'helper' from auth.users where lower(email) = 'helper@gvcrealestateteam.com'
on conflict (user_id) do nothing;
insert into public.members (user_id, name, initials, role)
select id, 'Team (shared)', 'GVC', 'shared' from auth.users where lower(email) = 'team@gvcrealestateteam.com'
on conflict (user_id) do nothing;

-- Stop here, before any rule changes, if nobody would be let in: running this
-- before the accounts exist would otherwise lock the whole team out.
do $$ begin
  if not exists (select 1 from public.members where active and role in ('owner', 'shared')) then
    raise exception 'No account is a member yet: create the accounts first (Matt''s and the helper''s), then run this again.';
  end if;
end $$;

alter table public.members enable row level security;
drop policy if exists "members read members" on public.members;
create policy "members read members" on public.members
  for select to authenticated using (public.is_member());

-- ---------- stamping + versions ----------
-- A "touch" (only updated_at moves: 0001's touch_property after a piece is
-- saved) isn't a change to the row, so it keeps its version and author; any
-- other change bumps the version and records who made it.
create or replace function public.stamp_row() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at' - 'version')
                        = (to_jsonb(old) - 'updated_at' - 'version') then
    new.version := old.version;
    new.updated_by := old.updated_by;
    return new;
  end if;
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
  return new;
end;
$$;

-- ---------- properties: the v2 columns (plan §5) ----------
-- core keeps every fact today's tools use; agents stay in core.agentIds (spec C2).
alter table public.properties
  add column if not exists kind          text not null default 'sale',
  add column if not exists market        text,
  add column if not exists stage         text,
  add column if not exists stage_source  text,
  add column if not exists units         text[] not null default '{}',
  add column if not exists extras        jsonb not null default '{}'::jsonb,
  add column if not exists de_listing_id text,
  add column if not exists de_status     text,
  add column if not exists de            jsonb,
  add column if not exists mls_id        text,
  add column if not exists drive_folder  text,
  add column if not exists folder_state  text not null default 'unlinked',
  add column if not exists scan          jsonb,
  add column if not exists photo_hero    text,
  add column if not exists photo_order   text[],
  add column if not exists version       integer not null default 1,
  add column if not exists updated_by    uuid references auth.users(id) on delete set null;

do $$ begin
  alter table public.properties add constraint properties_kind_check check (kind in ('sale', 'rental'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties add constraint properties_market_check check (market in ('NYC', 'NJ', 'FL'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties add constraint properties_stage_check check (stage in
    ('Won', 'Floorplan', 'Showsheet', 'Photos', 'Brochure', 'Live', 'In contract', 'Sold', 'Rented', 'Archived'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties add constraint properties_stage_source_check check (stage_source in ('DE', 'Matt', 'folder', 'seed'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties add constraint properties_folder_state_check check (folder_state in ('linked', 'unlinked', 'broken'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties add constraint properties_de_listing_id_key unique (de_listing_id);
exception when duplicate_object or duplicate_table then null; end $$;

comment on column public.properties.drive_folder is 'Relative to G:\Shared drives\. Linked where it is, never moved (D10).';
comment on column public.properties.de is 'Last DE snapshot: price, beds, baths, listingUrl, cover, openHouses…';
comment on column public.properties.scan is 'From the helper''s nightly folder scan: {weeks: {"<monday>": count}, found: {piece: date}, scannedAt}. Counts only, no file names.';
comment on column public.properties.status is 'Old library status, still read by the property bar. The workspace reads stage.';

alter table public.developments
  add column if not exists version    integer not null default 1,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.documents
  add column if not exists version    integer not null default 1;

-- stamp_row replaces the old touch triggers on properties and developments.
-- documents and photos keep touch_property(), which bumps the property's
-- updated_at (and now its version): a property whose saved piece changed is newer.
drop trigger if exists properties_touch on public.properties;
drop trigger if exists properties_stamp on public.properties;
create trigger properties_stamp before insert or update on public.properties
  for each row execute function public.stamp_row();
drop trigger if exists developments_touch on public.developments;
drop trigger if exists developments_stamp on public.developments;
create trigger developments_stamp before insert or update on public.developments
  for each row execute function public.stamp_row();

-- ---------- rules: active members only ----------
-- Every existing rule on these tables goes first, whatever its name (one
-- added by hand in the dashboard would otherwise still let others in), then
-- the member-only rules are created. Storage keeps other buckets' rules.
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('properties', 'documents', 'photos', 'developments', 'todos')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
drop policy if exists "team reads properties"    on public.properties;
drop policy if exists "team writes properties"   on public.properties;
drop policy if exists "members read properties"  on public.properties;
drop policy if exists "members write properties" on public.properties;
create policy "members read properties"  on public.properties for select to authenticated using (public.is_member());
create policy "members write properties" on public.properties for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "team reads documents"    on public.documents;
drop policy if exists "team writes documents"   on public.documents;
drop policy if exists "members read documents"  on public.documents;
drop policy if exists "members write documents" on public.documents;
create policy "members read documents"  on public.documents for select to authenticated using (public.is_member());
create policy "members write documents" on public.documents for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "team reads photos"    on public.photos;
drop policy if exists "team writes photos"   on public.photos;
drop policy if exists "members read photos"  on public.photos;
drop policy if exists "members write photos" on public.photos;
create policy "members read photos"  on public.photos for select to authenticated using (public.is_member());
create policy "members write photos" on public.photos for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "team reads developments"    on public.developments;
drop policy if exists "team writes developments"   on public.developments;
drop policy if exists "members read developments"  on public.developments;
drop policy if exists "members write developments" on public.developments;
create policy "members read developments"  on public.developments for select to authenticated using (public.is_member());
create policy "members write developments" on public.developments for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "team reads todos"    on public.todos;
drop policy if exists "team writes todos"   on public.todos;
drop policy if exists "members read todos"  on public.todos;
drop policy if exists "members write todos" on public.todos;
create policy "members read todos"  on public.todos for select to authenticated using (public.is_member());
create policy "members write todos" on public.todos for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "team reads photo files"    on storage.objects;
drop policy if exists "team writes photo files"   on storage.objects;
drop policy if exists "members read photo files"  on storage.objects;
drop policy if exists "members write photo files" on storage.objects;
create policy "members read photo files" on storage.objects
  for select to authenticated using (bucket_id = 'property-photos' and public.is_member());
create policy "members write photo files" on storage.objects
  for all to authenticated
  using (bucket_id = 'property-photos' and public.is_member())
  with check (bucket_id = 'property-photos' and public.is_member());
