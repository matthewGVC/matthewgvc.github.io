-- ============================================================
-- 0022 — DRIVE COMES WITH THE GOOGLE SIGN-IN (overhaul 9b, Matt 11-03: "Fold the drive
-- permission into sign in")
--
--   google_tokens    each person's long-lasting Google permission (read-only Drive), kept
--                    when they sign in with Google. No page can read it: row security is on
--                    with no rule for anyone, so only the drive-token server function (it runs
--                    with the service key) reads and writes it, and hands the page a fresh
--                    one-hour Drive pass. Nobody clicks again each hour.
--
-- A person can withdraw it in their Google account (Security → Third-party access); the next
-- pass then fails and the row is dropped. Safe to run more than once.
-- ============================================================

create table if not exists public.google_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at    timestamptz not null default now()
);
comment on table public.google_tokens is
  'Long-lasting Google Drive permission per person (0022). Read only by the drive-token function; no page can read it.';
alter table public.google_tokens enable row level security;
revoke all on public.google_tokens from anon, authenticated;
