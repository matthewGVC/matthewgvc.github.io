-- ============================================================
-- 0006 — ASANA, THE NEW STAGE LIST (workspace v2, Slice 2)
--
--   properties    gains the Asana link and snapshot, the checklist (milestones), the
--                 Match result, the development link and DE's own stage. The stage
--                 list becomes: Prep, Live, Accepted offer, In contract, Sold, Rented,
--                 Off market, Archived. Jobs still on an old stage (Won, Floorplan,
--                 Showsheet, Photos, Brochure) move to Prep FIRST, each with one row
--                 in the change log (source 'seed', note 'stage list v1.2').
--   pitches       gains the Asana link.
--   dev_projects  gains the Asana project link, hints, field map, next milestone and
--                 Match result; milestone keys are renamed to the new short keys
--                 (Renders -> renders, "Contracts & sales" -> contractsSales, …).
--   asana_tasks   the helper's read-only cache of Asana tasks (allowlisted fields).
--   asana_people  the roster the helper reads from Asana.
--   changes.source gains Asana, match, legacy; sync_runs.kind gains asana, people;
--   properties.stage_source gains Asana.
--
-- Needs 0004 and 0005. Safe to run more than once: only rows still on an old stage
-- are moved, so a second run writes no second change row.
-- Before running it on the real project: back up (helper/backup.js).
-- ============================================================

-- ---------- properties ----------
alter table public.properties
  add column if not exists asana_gid      text,
  add column if not exists asana          jsonb,
  add column if not exists milestones     jsonb not null default '{}'::jsonb,
  add column if not exists match          jsonb,
  add column if not exists dev_project_id uuid references public.dev_projects(id) on delete set null,
  add column if not exists de_stage       text;

do $$ begin
  alter table public.properties add constraint properties_asana_gid_key unique (asana_gid);
exception when duplicate_object or duplicate_table then null; end $$;

comment on column public.properties.asana_gid is 'The Asana task for this job. One task, one job.';
comment on column public.properties.asana is 'Last Asana snapshot of the allowlisted fields (read-only; nothing is ever written back to Asana).';
comment on column public.properties.milestones is 'The job''s checklist: {"<key>": {"done": true, "on": "2026-05-21"}, …}.';
comment on column public.properties.match is 'Result of the Match check: the differences between Asana, DE, the folder scan and Matt''s own values.';
comment on column public.properties.de_stage is 'The stage DE alone implies, kept beside the shown stage so the two can be compared.';

-- ---------- stage list: lift the old check, move the old values, add the new check ----------
alter table public.properties drop constraint if exists properties_stage_check;

with old_ones as (
  select id, stage from public.properties
   where stage in ('Won', 'Floorplan', 'Showsheet', 'Photos', 'Brochure')
), logged as (
  insert into public.changes (property_id, field, old_value, new_value, note, source)
  select id, 'stage', to_jsonb(stage), to_jsonb('Prep'::text), 'stage list v1.2', 'seed' from old_ones
  returning property_id
)
update public.properties p set stage = 'Prep'
  from old_ones o where p.id = o.id;

alter table public.properties add constraint properties_stage_check check (stage in
  ('Prep', 'Live', 'Accepted offer', 'In contract', 'Sold', 'Rented', 'Off market', 'Archived'));

alter table public.properties drop constraint if exists properties_stage_source_check;
alter table public.properties add constraint properties_stage_source_check
  check (stage_source in ('DE', 'Matt', 'Asana', 'folder', 'seed'));

-- ---------- pitches ----------
alter table public.pitches add column if not exists asana_gid text;
do $$ begin
  alter table public.pitches add constraint pitches_asana_gid_key unique (asana_gid);
exception when duplicate_object or duplicate_table then null; end $$;

-- ---------- dev_projects ----------
alter table public.dev_projects
  add column if not exists asana_project_gid text,
  add column if not exists milestone_hints   jsonb not null default '[]'::jsonb,
  add column if not exists asana_map         jsonb not null default '{}'::jsonb,
  add column if not exists next_milestone    jsonb,
  add column if not exists match             jsonb;

-- milestone keys: old display names -> short keys (a key already short is left alone)
update public.dev_projects d set milestones = (
  select coalesce(jsonb_object_agg(
    case e.key
      when 'Agreement'         then 'agreement'
      when 'Architecturals'    then 'architecturals'
      when 'Renders'           then 'renders'
      when 'Finishes'          then 'finishes'
      when 'Floorplans'        then 'floorplans'
      when 'Branding'          then 'branding'
      when 'Launch event'      then 'launchEvent'
      when 'Showing assets'    then 'showingAssets'
      when 'Construction'      then 'construction'
      when 'Contracts & sales' then 'contractsSales'
      else e.key end, e.value), '{}'::jsonb)
  from jsonb_each(d.milestones) e)
where exists (
  select 1 from jsonb_object_keys(d.milestones) k
   where k in ('Agreement', 'Architecturals', 'Renders', 'Finishes', 'Floorplans', 'Branding',
               'Launch event', 'Showing assets', 'Construction', 'Contracts & sales'));

comment on column public.dev_projects.milestones is '{"renders": {"done": true, "on": "2026-05-21"}, …} — short keys (plan D66); ticked by Matt or read from Asana.';

-- ---------- changes.source and sync_runs.kind: widen the checks ----------
-- Both were written inline in 0005, so Postgres named them itself; find them by what they test.
do $$ declare c record; begin
  for c in select conname from pg_constraint
            where conrelid = 'public.changes'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%source%' loop
    execute format('alter table public.changes drop constraint %I', c.conname);
  end loop;
  for c in select conname from pg_constraint
            where conrelid = 'public.sync_runs'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%kind%' loop
    execute format('alter table public.sync_runs drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.changes add constraint changes_source_check
  check (source in ('DE', 'Matt', 'Asana', 'form', 'doc', 'folder', 'seed', 'match', 'legacy'));
alter table public.sync_runs add constraint sync_runs_kind_check
  check (kind in ('de', 'asana', 'people', 'scan', 'backup', 'pdf', 'seed'));

-- ---------- asana_tasks ----------
create table if not exists public.asana_tasks (
  gid            text primary key,
  project_gid    text not null,
  kind           text not null check (kind in ('listing', 'subtask', 'dev', 'loose')),
  section        text,
  name           text,
  fields         jsonb not null default '{}'::jsonb,
  history        jsonb not null default '[]'::jsonb,
  due_on         date,
  completed_at   timestamptz,
  batch_day      boolean not null default false,
  modified_at    timestamptz,
  last_seen      timestamptz not null default now(),
  property_id    uuid references public.properties(id) on delete set null,
  pitch_id       uuid references public.pitches(id) on delete set null,
  dev_project_id uuid references public.dev_projects(id) on delete set null,
  ignored        boolean not null default false
);
comment on table public.asana_tasks is 'Read-only cache of Asana tasks: allowlisted custom fields and kept history only, never notes or attachments.';
create index if not exists asana_tasks_project_idx  on public.asana_tasks (project_gid);
create index if not exists asana_tasks_property_idx on public.asana_tasks (property_id) where property_id is not null;
create index if not exists asana_tasks_pitch_idx    on public.asana_tasks (pitch_id) where pitch_id is not null;
create index if not exists asana_tasks_dev_idx      on public.asana_tasks (dev_project_id) where dev_project_id is not null;

-- ---------- asana_people ----------
create table if not exists public.asana_people (
  gid             text primary key,
  name            text not null,
  section         text,
  title           text,
  state           text,
  team            text[],
  de_bio_url      text,
  de_profile_url  text,
  past            boolean not null default false,
  seen_at         timestamptz not null default now()
);

-- ---------- rules: active members only ----------
alter table public.asana_tasks  enable row level security;
alter table public.asana_people enable row level security;

drop policy if exists "members read asana tasks"  on public.asana_tasks;
drop policy if exists "members write asana tasks" on public.asana_tasks;
create policy "members read asana tasks"  on public.asana_tasks for select to authenticated using (public.is_member());
create policy "members write asana tasks" on public.asana_tasks for all    to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members read asana people"  on public.asana_people;
drop policy if exists "members write asana people" on public.asana_people;
create policy "members read asana people"  on public.asana_people for select to authenticated using (public.is_member());
create policy "members write asana people" on public.asana_people for all    to authenticated using (public.is_member()) with check (public.is_member());
