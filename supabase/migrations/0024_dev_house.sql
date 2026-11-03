-- ============================================================
-- 0024 — A DEVELOPMENT THAT IS ONE HOUSE (Matt 11-03, D141)
--
--   dev_projects.house_listing_id   the development's own house listing, when the development
--                       is that one house (366 North 3rd Street is its 366 N 3rd St listing).
--                       The listing stays: it is the Asana task's row and holds the price, the
--                       agents and the floorplans. With this set it shows only as the
--                       development: not in search, the Overview or the Errors page by itself,
--                       and the Errors check "Listed twice" (M29) leaves the pair alone.
--
-- Set by Matt's say-so only (through the Supabase MCP, logged as a `changes` row).
-- Safe to run more than once.
-- ============================================================

alter table public.dev_projects add column if not exists house_listing_id uuid
  references public.properties(id) on delete set null;
comment on column public.dev_projects.house_listing_id is
  'The development is this one house listing (0024, D141): the listing shows only as the development.';
