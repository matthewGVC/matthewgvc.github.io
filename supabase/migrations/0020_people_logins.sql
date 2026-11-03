-- ============================================================
-- 0020 — EVERYONE SIGNS IN AS THEMSELVES (overhaul step 4b, docs/overhaul-plan.md)
--
--   invites           the people who may sign in: their GVC email (from the roster,
--                     assets/js/roster.js), name, role and market. Matt changes it by SQL.
--   claim_member()    called by the site after a Google sign-in: a Google account on
--                     gvcrealestateteam.com whose email is in invites becomes a member
--                     with that role and market. Anything else gets nothing (the page
--                     says "not on the team list").
--   members.market    NYC, NJ or FL; empty for someone who works every market.
--   members.role      gains 'ops' (an ops manager: Ayuen, James, Karl).
--   may_edit_facts()  adds ops and team: everyone edits the facts (Matt, 11-02: "the team
--                     needs to be able to edit throughout"), as the shared sign-in did.
--   may_read_budgets() adds ops (a development's budget, as the shared sign-in read it);
--                     agents (team) don't see budget figures.
--
-- Only a Google sign-in can claim (auth.identities provider 'google'): a password
-- account made with someone's email can't. The shared team password keeps working
-- until everyone is in; switching it off is a separate step.
--
-- Needs 0019. Safe to run more than once. Back up first (helper/backup.js).
-- ============================================================

alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('owner', 'admin', 'marketing', 'ops', 'team', 'helper', 'shared'));
alter table public.members add column if not exists market text check (market in ('NYC', 'NJ', 'FL'));
alter table public.members add column if not exists email text;

create table if not exists public.invites (
  email      text primary key check (email = lower(email) and email like '%@gvcrealestateteam.com'),
  name       text not null,
  initials   text not null,
  role       text not null check (role in ('admin', 'marketing', 'ops', 'team')),
  market     text check (market in ('NYC', 'NJ', 'FL')),
  roster_id  text,
  created_at timestamptz not null default now()
);
comment on table public.invites is
  'Who may sign in with Google (overhaul 4b). From the roster; Matt changes it by SQL. claim_member() turns one into a member.';
alter table public.invites enable row level security;
drop policy if exists "owner reads invites" on public.invites;
create policy "owner reads invites" on public.invites for select to authenticated using (public.member_role() = 'owner');

create or replace function public.claim_member() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   public.invites%rowtype;
begin
  if v_uid is null then return null; end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    return (select jsonb_build_object('role', role) from public.members where user_id = v_uid);
  end if;
  -- the email Google vouched for, never one typed into a password sign-up
  select lower(i.email) into v_email from auth.identities i
    where i.user_id = v_uid and i.provider = 'google' and i.email is not null limit 1;
  if v_email is null then return null; end if;
  select * into v_inv from public.invites where email = v_email;
  if not found then return null; end if;
  insert into public.members (user_id, name, initials, role, market, email)
    values (v_uid, v_inv.name, v_inv.initials, v_inv.role, v_inv.market, v_inv.email)
    on conflict (user_id) do nothing;
  return jsonb_build_object('role', v_inv.role);
end $$;
revoke execute on function public.claim_member() from public, anon;
grant  execute on function public.claim_member() to authenticated;

create or replace function public.may_edit_facts() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or exists (select 1 from public.members where user_id = auth.uid() and active
                   and role in ('owner', 'admin', 'marketing', 'ops', 'team', 'helper', 'shared'))
$$;
create or replace function public.may_read_budgets() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or exists (select 1 from public.members where user_id = auth.uid() and active and role in ('owner', 'admin', 'ops', 'helper', 'shared'))
$$;

-- The roster's people with a GVC email (11-03). Bosses who see the money are admin;
-- John (NYC, not new development or money) is team. Gary Kasparov, Elyse Gutman and
-- Marli Silver have no GVC email yet, so they can't sign in until one is added here.
insert into public.invites (email, name, initials, role, market, roster_id) values
  ('jonathan@gvcrealestateteam.com',     'Jonathan Conlon',  'JC', 'admin', null,  'jonathan-conlon'),
  ('tj@gvcrealestateteam.com',           'TJ Verdiglione',   'TV', 'admin', null,  'tj-verdiglione'),
  ('john@gvcrealestateteam.com',         'John Gasdaska',    'JG', 'team',  'NYC', 'john-gasdaska'),
  ('ayuen@gvcrealestateteam.com',        'Ayuen Gai',        'AG', 'ops',   'NYC', 'ayuen-gai'),
  ('james@gvcrealestateteam.com',        'James Huber',      'JH', 'ops',   'NJ',  'james-huber'),
  ('karl@gvcrealestateteam.com',         'Karl Brisard',     'KB', 'ops',   'FL',  'karl-brisard'),
  ('katie@gvcrealestateteam.com',        'Katie Cook',       'KC', 'team',  'NYC', 'katie-cook'),
  ('nicole.sobol@gvcrealestateteam.com', 'Nicole Sobol',     'NS', 'team',  'NYC', 'nicole-sobol'),
  ('george@gvcrealestateteam.com',       'George Putykewycz','GP', 'team',  'NJ',  'george-putykewycz'),
  ('nicole@gvcrealestateteam.com',       'Nicole Melveney',  'NM', 'team',  'FL',  'nicole-melveney'),
  ('karen@gvcrealestateteam.com',        'Karen Conlon',     'KC', 'team',  null,  'karen-conlon')
on conflict (email) do update set name = excluded.name, initials = excluded.initials, role = excluded.role,
  market = excluded.market, roster_id = excluded.roster_id;
