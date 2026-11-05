-- ============================================================
-- 0025 — PLACES AND DEALS (Matt 11-05)
--
--   A deal is a row in `properties` (a sale, a rental, a pitch); a place is the apartment or
--   house itself, so a sale and a rental on one unit, or a re-listing years later, are several
--   deals on one place.
--
--   places       one row per apartment or house. `key` finds candidates (GVC_PLACES.placeKey) and
--                `address` holds the clean street (cleanStreet) that samePlace compares against.
--                Its development, when it is a unit in one.
--   buildings    NYC only: the facts every unit in a building shares. Keyed by buildingKey.
--   properties.place_id   the place a deal is on (indexed).
--   properties.side       'list' (we list it) or 'buy' (a Buy Side task).
--   properties_stage_check   also allows 'Pitch': a lead is now a deal with that stage.
--
-- Only the helper writes places and buildings (insert, update, delete for the owner and the
-- helper); every member reads them. No page writes them, so the shared login never can, and they
-- carry no version column or stamp_row trigger.
-- Needs 0004 (is_member), 0008 (member_role), 0005 (dev_projects). Safe to run more than once.
-- ============================================================

create table if not exists public.buildings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text,
  market      text check (market in ('NYC', 'NJ', 'FL')),
  facts       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.buildings is 'NYC buildings (0025): the facts every unit in one shares. Written only by the helper.';

create table if not exists public.places (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  key            text not null,
  address        text not null,
  town           text,
  label          text,
  market         text check (market in ('NYC', 'NJ', 'FL')),
  building_id    uuid references public.buildings(id) on delete set null,
  dev_project_id uuid references public.dev_projects(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.places is 'An apartment or house (0025); its deals are the properties rows with place_id. Written only by the helper.';
comment on column public.places.address is 'cleanStreet(address): the spelling GVC_PLACES.samePlace compares against.';
create index if not exists places_key_idx on public.places (key);

alter table public.properties add column if not exists place_id uuid
  references public.places(id) on delete set null;
create index if not exists properties_place_idx on public.properties (place_id) where place_id is not null;

alter table public.properties add column if not exists side text not null default 'list';
alter table public.properties drop constraint if exists properties_side_check;
alter table public.properties add constraint properties_side_check check (side in ('list', 'buy'));

alter table public.properties drop constraint if exists properties_stage_check;
alter table public.properties add constraint properties_stage_check check (stage in
  ('Pitch', 'Prep', 'Live', 'Accepted offer', 'In contract', 'Sold', 'Rented', 'Off market', 'Archived'));

-- ---------- row security ----------
alter table public.buildings enable row level security;
alter table public.places    enable row level security;

drop policy if exists "members read buildings" on public.buildings;
create policy "members read buildings" on public.buildings for select to authenticated using (public.is_member());
drop policy if exists "helper adds buildings" on public.buildings;
create policy "helper adds buildings" on public.buildings for insert to authenticated
  with check (public.member_role() in ('owner', 'helper'));
drop policy if exists "helper changes buildings" on public.buildings;
create policy "helper changes buildings" on public.buildings for update to authenticated
  using (public.member_role() in ('owner', 'helper')) with check (public.member_role() in ('owner', 'helper'));
drop policy if exists "helper removes buildings" on public.buildings;
create policy "helper removes buildings" on public.buildings for delete to authenticated
  using (public.member_role() in ('owner', 'helper'));

drop policy if exists "members read places" on public.places;
create policy "members read places" on public.places for select to authenticated using (public.is_member());
drop policy if exists "helper adds places" on public.places;
create policy "helper adds places" on public.places for insert to authenticated
  with check (public.member_role() in ('owner', 'helper'));
drop policy if exists "helper changes places" on public.places;
create policy "helper changes places" on public.places for update to authenticated
  using (public.member_role() in ('owner', 'helper')) with check (public.member_role() in ('owner', 'helper'));
drop policy if exists "helper removes places" on public.places;
create policy "helper removes places" on public.places for delete to authenticated
  using (public.member_role() in ('owner', 'helper'));
