-- ============================================================
-- 0023 — A DEVELOPMENT'S FOLDER, SCANNED NIGHTLY (overhaul 7b-1, Matt 11-03)
--
--   dev_projects.scan   what the helper's nightly scan found in the development's Drive folder:
--                       its top folders (Branding, Floorplans, Renders, Brochure ...) with each
--                       one's Drive link, file count, newest date and newest five files. Names
--                       and dates only; paperwork is never listed (drive-rules.js). The job page's
--                       Marketing materials card reads it, so it shows without Drive on the computer.
--
-- Written by the helper only (it runs with the service key), read like the rest of the row.
-- Safe to run more than once.
-- ============================================================

alter table public.dev_projects add column if not exists scan jsonb;
comment on column public.dev_projects.scan is
  'The nightly folder scan (0023): top folders with links, counts, newest files. Written by the helper only.';
