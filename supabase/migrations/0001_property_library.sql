-- ============================================================
-- PROPERTY LIBRARY — the shared store behind the three listing builders.
--
-- A property is three things: the core facts every builder wants, one saved
-- document per builder, and the photos of the place. Whichever tool an agent
-- opens first creates the property; the others find it already filled in.
--
-- Everything is gated behind the team's single signed-in account: nothing is
-- readable by an anonymous visitor, which matters because the site itself is
-- public.
-- ============================================================

-- ---------- properties ----------
-- One row per address. A unit number is part of the address line, so
-- "45 Crosby Street, Penthouse" and "45 Crosby Street, 3B" are two properties
-- and the same address is never two.
create table if not exists public.properties (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  label          text not null,
  status         text not null default 'active'
                 check (status in ('active', 'coming-soon', 'sold', 'archived')),
  core           jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.properties is
  'One listing. core holds the facts every builder shares; each builder''s own work lives in documents.';
comment on column public.properties.slug is
  'Normalised address, unit included — the identity of the property.';
comment on column public.properties.core is
  'address, city/state/zip, price, beds, baths, sqft, parking, description, features, agentIds, comps.';

-- ---------- documents ----------
-- One saved document per tool per property, and a property may have none.
-- state is stored verbatim and handed back untouched: the library never
-- interprets a brochure's gallery layout.
create table if not exists public.documents (
  property_id    uuid not null references public.properties(id) on delete cascade,
  tool           text not null check (tool in ('showsheet', 'brochure', 'seller', 'buyer')),
  state          jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  saved_at       timestamptz not null default now(),
  primary key (property_id, tool)
);

comment on table public.documents is
  'A tool''s saved work for one property. Written only by that tool.';

-- ---------- photos ----------
-- The shelf. Files live in the private property-photos bucket; this table is
-- the index. Photos are downscaled to 2000px on the way in and deduped by
-- content hash, so the same shot dropped into three tools is one file.
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  hash        text not null,
  name        text not null default '',
  path        text not null,
  width       integer,
  height      integer,
  bytes       integer,
  created_at  timestamptz not null default now(),
  unique (property_id, hash)
);

comment on column public.photos.path is
  'Key inside the property-photos storage bucket. The bucket is private — pages render signed URLs.';

create index if not exists documents_property_idx on public.documents (property_id);
create index if not exists photos_property_idx    on public.photos (property_id);
create index if not exists properties_sort_idx    on public.properties (status, updated_at desc);

-- ---------- housekeeping triggers ----------
-- updated_at should mean "when this property last changed", including when a
-- document or a photo changed, so the dropdown can sort by real activity
-- rather than by when the address was last edited.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists properties_touch on public.properties;
create trigger properties_touch
  before update on public.properties
  for each row execute function public.touch_updated_at();

create or replace function public.touch_property()
returns trigger language plpgsql as $$
begin
  update public.properties
     set updated_at = now()
   where id = coalesce(new.property_id, old.property_id);
  return null;
end;
$$;

drop trigger if exists documents_touch_property on public.documents;
create trigger documents_touch_property
  after insert or update or delete on public.documents
  for each row execute function public.touch_property();

drop trigger if exists photos_touch_property on public.photos;
create trigger photos_touch_property
  after insert or delete on public.photos
  for each row execute function public.touch_property();

-- ---------- row level security ----------
-- The site is public; the library is not. Only a signed-in session — the
-- team account — can see or change anything here.
alter table public.properties enable row level security;
alter table public.documents  enable row level security;
alter table public.photos     enable row level security;

drop policy if exists "team reads properties"  on public.properties;
drop policy if exists "team writes properties" on public.properties;
create policy "team reads properties"  on public.properties
  for select to authenticated using (true);
create policy "team writes properties" on public.properties
  for all to authenticated using (true) with check (true);

drop policy if exists "team reads documents"  on public.documents;
drop policy if exists "team writes documents" on public.documents;
create policy "team reads documents"  on public.documents
  for select to authenticated using (true);
create policy "team writes documents" on public.documents
  for all to authenticated using (true) with check (true);

drop policy if exists "team reads photos"  on public.photos;
drop policy if exists "team writes photos" on public.photos;
create policy "team reads photos"  on public.photos
  for select to authenticated using (true);
create policy "team writes photos" on public.photos
  for all to authenticated using (true) with check (true);

-- ---------- photo storage ----------
-- Private bucket: a listing's photos are marketing material, but the folder
-- structure would otherwise be guessable and public. Pages render them
-- through short-lived signed URLs instead.
insert into storage.buckets (id, name, public, file_size_limit)
values ('property-photos', 'property-photos', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "team reads photo files"  on storage.objects;
drop policy if exists "team writes photo files" on storage.objects;
create policy "team reads photo files" on storage.objects
  for select to authenticated using (bucket_id = 'property-photos');
create policy "team writes photo files" on storage.objects
  for all to authenticated
  using (bucket_id = 'property-photos')
  with check (bucket_id = 'property-photos');
