-- ============================================================
-- 0019 — MAKING PIECES IS MARKETING'S (overhaul step 4, docs/overhaul-plan.md)
--
--   may_ask_piece()   owner, admin and marketing may ask the helper to make or rebuild a
--                     piece. The team's shared account no longer may (0017 let it): the
--                     agents use the showsheets, floorplans and the rest, marketing makes
--                     them (Matt, 11-02). The job page and the pieces hide Make / Rebuild
--                     for everyone else (ASKERS in workspace/job/index.html, piece-mode.js).
--
-- Needs 0017. Safe to run more than once. Back up first (helper/backup.js).
-- ============================================================

create or replace function public.may_ask_piece() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and active
                   and role in ('owner', 'admin', 'marketing'))
$$;
revoke execute on function public.may_ask_piece() from public, anon;
grant  execute on function public.may_ask_piece() to authenticated;
