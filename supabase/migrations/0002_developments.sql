-- ============================================================
-- DEVELOPMENTS — the store behind tools/new-development/.
--
-- One row per developer pipeline (e.g. South Street Development Group). The
-- whole printable document — header copy, every home, the image references —
-- is one jsonb blob that the tool reads and writes verbatim, the same way
-- documents.state works for the listing builders.
--
-- Team only, like the property library: nothing here is readable by an
-- anonymous visitor. Renderings uploaded from the tool go into the existing
-- private property-photos bucket under developments/<slug>/, which the
-- 0001 policies already open to the signed-in team and nobody else.
-- ============================================================

create table if not exists public.developments (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  label          text not null,
  data           jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.developments is
  'A developer''s pipeline for the New Development tool. data is the whole document, stored verbatim.';
comment on column public.developments.data is
  'kicker, title, lede, developer, marketing, notes, disclaimer and homes[] — see assets/js/development.js.';

drop trigger if exists developments_touch on public.developments;
create trigger developments_touch
  before update on public.developments
  for each row execute function public.touch_updated_at();

alter table public.developments enable row level security;

drop policy if exists "team reads developments"  on public.developments;
drop policy if exists "team writes developments" on public.developments;
create policy "team reads developments"  on public.developments
  for select to authenticated using (true);
create policy "team writes developments" on public.developments
  for all to authenticated using (true) with check (true);
