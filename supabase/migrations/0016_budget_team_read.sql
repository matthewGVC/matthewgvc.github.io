-- ============================================================
-- 0016 — THE TEAM'S SHARED SIGN-IN READS A DEVELOPMENT'S BUDGET (Matt, 10-29; changes D113)
--
--   The shared GVC account (role 'shared') now reads dev_budgets, so a development's
--   page shows its total, spent, remaining and final cost outlook to anyone signed in on
--   the team account. Only owner, admin and the helper still write it (link or change
--   the sheet, store a read): "budget writers" keeps may_see_budgets().
--
-- Needs 0015. Safe to run more than once.
-- ============================================================

create or replace function public.may_read_budgets() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or exists (select 1 from public.members where user_id = auth.uid() and active and role in ('owner', 'admin', 'helper', 'shared'))
$$;
revoke execute on function public.may_read_budgets() from public, anon;
grant  execute on function public.may_read_budgets() to authenticated;

drop policy if exists "budget readers" on public.dev_budgets;
create policy "budget readers" on public.dev_budgets for select to authenticated using (public.may_read_budgets());
