-- ============================================================
-- 0005 — THE V2 JOB TABLES (workspace v2, Slice 1)
--
--   pitches       seller pitches, won or not (plan §5; D32: outcome is a side feature)
--   dev_projects  developments on the overview (spec C1: separate from `developments`,
--                 which is the New Development tool's document and stays as it is)
--   changes       the change log: one row per change, exactly one owner
--   floorplans    versions × layouts per listing (used from Slice 2)
--   sync_runs     every run of the desktop helper (DE sync, scan, backup, seed)
--   de_listings   what the DE sync knows about each DE listing, incl. the
--                 GVC-listed check (D8/D35) and "not ours, don't ask again"
--
-- Needs 0004 (is_member, stamp_row). Safe to run more than once.
-- ============================================================

-- ---------- pitches ----------
create table if not exists public.pitches (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  label           text not null,
  market          text check (market in ('NYC', 'NJ', 'FL')),
  pitched_on      date,
  core            jsonb not null default '{}'::jsonb,
  drive_folder    text,
  folder_state    text not null default 'unlinked' check (folder_state in ('linked', 'unlinked', 'broken')),
  outcome         text not null default 'open' check (outcome in ('open', 'won', 'not won')),
  won_property_id uuid references public.properties(id) on delete set null,
  scan            jsonb,
  version         integer not null default 1,
  updated_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on column public.pitches.slug is 'Address + unit + pitch date: an address can be pitched more than once.';
comment on column public.pitches.core is 'address, unit, agentIds, comps, priceLow/Mid/High, recBand, map — the Seller Package''s pitch facts.';

alter table public.properties
  add column if not exists from_pitch_id uuid references public.pitches(id) on delete set null;

-- ---------- dev_projects ----------
create table if not exists public.dev_projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  label         text not null,
  market        text check (market in ('NYC', 'NJ', 'FL')),
  size_band     text check (size_band in ('boutique', 'medium', 'large')),
  unit_count    integer,
  milestones    jsonb not null default '{}'::jsonb,
  drive_folder  text,
  folder_state  text not null default 'unlinked' check (folder_state in ('linked', 'unlinked', 'broken')),
  pipeline_slug text,
  version       integer not null default 1,
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.dev_projects.milestones is '{"Renders": {"done": true, "on": "2026-05-21"}, …} — ticked by Matt (plan §6).';

-- ---------- sync_runs ----------
create table if not exists public.sync_runs (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('de', 'scan', 'backup', 'pdf', 'seed')),
  dry_run        boolean not null default false,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  ok             boolean,
  rows_read      jsonb,
  totals         jsonb,
  changes        integer not null default 0,
  errors         jsonb,
  helper_version text
);
create index if not exists sync_runs_kind_idx on public.sync_runs (kind, started_at desc);

-- ---------- changes ----------
create table if not exists public.changes (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid references public.properties(id) on delete restrict,
  pitch_id       uuid references public.pitches(id) on delete restrict,
  dev_project_id uuid references public.dev_projects(id) on delete restrict,
  at             timestamptz not null default now(),
  field          text,
  old_value      jsonb,
  new_value      jsonb,
  note           text,
  asked_by       text,
  source         text not null check (source in ('DE', 'Matt', 'form', 'doc', 'folder', 'seed')),
  run_id         uuid references public.sync_runs(id) on delete set null,
  user_id        uuid references auth.users(id) on delete set null default auth.uid(),
  check (num_nonnulls(property_id, pitch_id, dev_project_id) = 1)
);
comment on column public.changes.asked_by is 'Who asked for it: an agent''s name or "Matt". Never a client''s name (D2).';
create index if not exists changes_property_idx on public.changes (property_id, at desc) where property_id is not null;
create index if not exists changes_pitch_idx    on public.changes (pitch_id, at desc)    where pitch_id is not null;
create index if not exists changes_dev_idx      on public.changes (dev_project_id, at desc) where dev_project_id is not null;
create index if not exists changes_at_idx       on public.changes (at desc);

-- ---------- floorplans ----------
create table if not exists public.floorplans (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  version       integer not null,
  layout        text not null default 'current',
  layout_label  text,
  geometry_path text,
  note          text,
  asked_by      text,
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (property_id, version, layout)
);

-- ---------- de_listings ----------
create table if not exists public.de_listings (
  de_listing_id text primary key,
  feed          text not null check (feed in ('featured', 'transactions')),
  kind          text not null check (kind in ('sale', 'rental')),
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  raw           jsonb not null,
  gvc_listed    boolean,
  courtesy      text,
  checked_at    timestamptz,
  property_id   uuid references public.properties(id) on delete set null,
  ignored       boolean not null default false
);
comment on column public.de_listings.courtesy is 'The GVC-listed evidence: "Douglas Elliman: <agents>" or another brokerage''s "Listing Courtesy of …" line (D35).';

-- ---------- triggers ----------
drop trigger if exists pitches_stamp on public.pitches;
create trigger pitches_stamp before insert or update on public.pitches
  for each row execute function public.stamp_row();
drop trigger if exists dev_projects_stamp on public.dev_projects;
create trigger dev_projects_stamp before insert or update on public.dev_projects
  for each row execute function public.stamp_row();

-- ---------- rules: active members only ----------
alter table public.pitches      enable row level security;
alter table public.dev_projects enable row level security;
alter table public.sync_runs    enable row level security;
alter table public.changes      enable row level security;
alter table public.floorplans   enable row level security;
alter table public.de_listings  enable row level security;

drop policy if exists "members read pitches"  on public.pitches;
drop policy if exists "members write pitches" on public.pitches;
create policy "members read pitches"  on public.pitches for select to authenticated using (public.is_member());
create policy "members write pitches" on public.pitches for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members read dev projects"  on public.dev_projects;
drop policy if exists "members write dev projects" on public.dev_projects;
create policy "members read dev projects"  on public.dev_projects for select to authenticated using (public.is_member());
create policy "members write dev projects" on public.dev_projects for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members read sync runs"  on public.sync_runs;
drop policy if exists "members write sync runs" on public.sync_runs;
create policy "members read sync runs"  on public.sync_runs for select to authenticated using (public.is_member());
create policy "members write sync runs" on public.sync_runs for all    to authenticated using (public.is_member()) with check (public.is_member());

-- the change log is append-only from the site: read and add, never edit or delete
drop policy if exists "members read changes" on public.changes;
drop policy if exists "members add changes"  on public.changes;
create policy "members read changes" on public.changes for select to authenticated using (public.is_member());
create policy "members add changes"  on public.changes for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());   -- only in your own name

drop policy if exists "members read floorplans"  on public.floorplans;
drop policy if exists "members write floorplans" on public.floorplans;
create policy "members read floorplans"  on public.floorplans for select to authenticated using (public.is_member());
create policy "members write floorplans" on public.floorplans for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members read de listings"  on public.de_listings;
drop policy if exists "members write de listings" on public.de_listings;
create policy "members read de listings"  on public.de_listings for select to authenticated using (public.is_member());
create policy "members write de listings" on public.de_listings for all    to authenticated using (public.is_member()) with check (public.is_member());
