-- ============================================================
-- 0011 — MATCH CLAIMS (workspace v2 tune-ups 2: who deals with an error)
--
--   members.role           gains 'admin' and 'marketing'. Matt gives these to people as
--                          they get their own sign-in (Supabase dashboard or SQL only).
--   match_claims           one row per error on a job: who claimed it ("I'm on it") and
--                          who marked it fixed, with the values it had when it was fixed.
--                          The Errors page reads it; a fixed error that a later sync still
--                          finds comes back as "still wrong after it was marked fixed".
--   can_fix_errors()       true for an active owner, admin or marketing member: only they
--                          claim, fix or undo (Matt, 10-23). Everyone on the team reads.
--
-- Needs 0004 to 0010. Safe to run more than once; nothing is dropped except the old
-- members.role check, which is replaced. Back up first (helper/backup.js).
-- ============================================================

alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('owner', 'admin', 'marketing', 'team', 'helper', 'shared'));

create or replace function public.can_fix_errors() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and active and role in ('owner', 'admin', 'marketing'))
$$;
revoke execute on function public.can_fix_errors() from public, anon;
grant  execute on function public.can_fix_errors() to authenticated;

create table if not exists public.match_claims (
  id           uuid primary key default gen_random_uuid(),
  owner_table  text not null check (owner_table in ('properties', 'dev_projects')),
  owner_id     uuid not null,
  key          text not null check (length(key) between 1 and 80),
  claimed_by   uuid references auth.users(id) on delete set null,
  claimed_name text,
  claimed_at   timestamptz,
  fixed_by     uuid references auth.users(id) on delete set null,
  fixed_name   text,
  fixed_at     timestamptz,
  fixed_values jsonb,
  updated_at   timestamptz not null default now(),
  unique (owner_table, owner_id, key)
);
comment on table public.match_claims is
  'Who claimed an error on a job and who marked it fixed (Errors page). Owner, admin and marketing members write; the team reads.';

-- the names and times are the signed-in member's own, whatever the page sends
create or replace function public.match_claims_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.members where user_id = auth.uid() and active;
  if tg_op = 'INSERT' or new.claimed_at is distinct from old.claimed_at then
    if new.claimed_at is not null then new.claimed_by := auth.uid(); new.claimed_name := v_name; new.claimed_at := now();
    else new.claimed_by := null; new.claimed_name := null; end if;
  end if;
  if tg_op = 'INSERT' or new.fixed_at is distinct from old.fixed_at then
    if new.fixed_at is not null then new.fixed_by := auth.uid(); new.fixed_name := v_name; new.fixed_at := now();
    else new.fixed_by := null; new.fixed_name := null; new.fixed_values := null; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists match_claims_stamp on public.match_claims;
create trigger match_claims_stamp before insert or update on public.match_claims
  for each row execute function public.match_claims_stamp();

alter table public.match_claims enable row level security;
drop policy if exists "members read match claims" on public.match_claims;
drop policy if exists "fixers write match claims" on public.match_claims;
create policy "members read match claims" on public.match_claims
  for select to authenticated using (public.is_member());
create policy "fixers write match claims" on public.match_claims
  for all to authenticated using (public.can_fix_errors()) with check (public.can_fix_errors());
grant select, insert, update, delete on public.match_claims to authenticated;
