-- ============================================================
-- TODOS — Matt's to-do list behind tools/todo/ (mirrors docs/todo.md).
--
-- One row per item. Sections are free text so new headings need no
-- migration. Team only, like the property library: nothing here is
-- readable by an anonymous visitor.
-- ============================================================

create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  section     text not null default 'Up next',
  body        text not null,
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists todos_touch on public.todos;
create trigger todos_touch
  before update on public.todos
  for each row execute function public.touch_updated_at();

alter table public.todos enable row level security;

drop policy if exists "team reads todos"  on public.todos;
drop policy if exists "team writes todos" on public.todos;
create policy "team reads todos"  on public.todos
  for select to authenticated using (true);
create policy "team writes todos" on public.todos
  for all to authenticated using (true) with check (true);
