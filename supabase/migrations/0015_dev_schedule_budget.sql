-- ============================================================
-- 0015 — A DEVELOPMENT'S SCHEDULE AND BUDGET (D109–D114, Matt, 10-29)
--
--   dev_projects.schedule  the 🚧 Asana project's tasks and work items with their dates,
--                          milestone flag and dependencies (D110), written by the helper's
--                          Asana sync. Read like the rest of the row: any active member.
--   dev_budgets            one row per development: the pro-forma sheet Matt linked
--                          (sheet_id) and what the helper keeps of it (budget, D112), with
--                          the last good read (synced_at) and the last failure (error).
--                          Owner, admin and the helper only (D113): a teammate's sign-in
--                          never sees a developer's spending.
--   sync_runs.kind         gains 'budget'.
--
-- Needs 0004 to 0014. Safe to run more than once; nothing is dropped except the
-- sync_runs kind check, which is replaced.
-- ============================================================

alter table public.dev_projects add column if not exists schedule jsonb;
comment on column public.dev_projects.schedule is '{"tasks": [{"gid", "name", "section", "parentGid", "startOn", "dueOn", "completed", "completedAt", "milestone", "deps", "link"}]} — from the 🚧 Asana project (D110).';

create or replace function public.may_see_budgets() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or exists (select 1 from public.members where user_id = auth.uid() and active and role in ('owner', 'admin', 'helper'))
$$;
revoke execute on function public.may_see_budgets() from public, anon;
grant  execute on function public.may_see_budgets() to authenticated;

create table if not exists public.dev_budgets (
  dev_project_id uuid primary key references public.dev_projects(id) on delete cascade,
  sheet_id       text not null check (sheet_id ~ '^[A-Za-z0-9_-]{20,}$'),
  budget         jsonb,
  synced_at      timestamptz,
  error          text,
  version        integer not null default 1,
  updated_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column public.dev_budgets.budget is '{"title", "lines": [{"name", "estimate", "actual", "upgrade"}], "sheetTotal": {"estimate", "actual", "remaining"}, "payments": [{"date", "category", "vendor", "description", "amount", "status", "receipt"}]} — kept by helper/budget/allow.js (D112).';

drop trigger if exists dev_budgets_stamp on public.dev_budgets;
create trigger dev_budgets_stamp before insert or update on public.dev_budgets
  for each row execute function public.stamp_row();

alter table public.dev_budgets enable row level security;
drop policy if exists "budget readers"  on public.dev_budgets;
drop policy if exists "budget writers" on public.dev_budgets;
create policy "budget readers" on public.dev_budgets for select to authenticated using (public.may_see_budgets());
create policy "budget writers" on public.dev_budgets for all    to authenticated using (public.may_see_budgets()) with check (public.may_see_budgets());

do $$ declare c record; begin
  for c in select conname from pg_constraint
            where conrelid = 'public.sync_runs'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%kind%' loop
    execute format('alter table public.sync_runs drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.sync_runs add constraint sync_runs_kind_check
  check (kind in ('de', 'asana', 'people', 'budget', 'scan', 'backup', 'pdf', 'seed'));
