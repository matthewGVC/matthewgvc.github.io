-- ============================================================
-- 0017 — PIECE REQUESTS: the desktop helper makes and rebuilds a job's pieces itself
--         (overturns D89 and D91; docs/piece-helper-design.md)
--
--   piece_requests        one row per "make this piece" ask: Make / Rebuild on the job page,
--                         Rebuild n stale, or Make PDF on the piece's own page. The helper
--                         works through the waiting ones, oldest first, from any device's ask.
--                         status: waiting → working → done | failed (message says why).
--                         One open (waiting or working) ask per piece: asking again joins it.
--   may_ask_piece()       owner, admin, marketing and the team's shared account may ask
--                         (the people who may change facts, 0014); a plain 'team' member and
--                         the helper may not.
--   piece_requests_stamp  an ask is always made in the asker's own name, waiting, now; the
--                         asker can't set its outcome.
--   save_piece_build(...) the helper's one way to record what it made: the piece, owner and
--                         tool come from the request (never from the call), the record columns
--                         are written as save_piece_of writes them, the change log says
--                         "<piece> made" with source 'Helper' and who asked, and the request is
--                         marked done, all in one transaction.
--   documents_record_owner the record columns: the owner's, and the helper's only inside
--                         save_piece_build (a direct write by the helper is still refused).
--   changes.source        adds 'Helper' (0006's list otherwise).
--
-- Needs 0004 to 0016. Safe to run more than once. Before running it on the real project:
-- back up (helper/backup.js). Run it before the helper code that reads piece_requests is
-- started (the helper waits quietly while the table is missing).
-- ============================================================

create or replace function public.may_ask_piece() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and active
                   and role in ('owner', 'admin', 'marketing', 'shared'))
$$;
revoke execute on function public.may_ask_piece() from public, anon;
grant  execute on function public.may_ask_piece() to authenticated;

create table if not exists public.piece_requests (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  pitch_id    uuid references public.pitches(id) on delete cascade,
  tool        text not null check (tool in ('showsheet', 'brochure', 'postcard-listed', 'postcard-sold', 'seller', 'signage')),
  status      text not null default 'waiting' check (status in ('waiting', 'working', 'done', 'failed')),
  asked_by    uuid references auth.users(id) on delete set null default auth.uid(),
  asked_name  text,
  asked_at    timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz,
  message     text,
  result      jsonb,
  check ((property_id is null) <> (pitch_id is null))
);
comment on table public.piece_requests is 'Asks for the desktop helper to make a piece from a job (0017). The helper works through the waiting ones.';
comment on column public.piece_requests.result is 'The file the helper made: {path, name, url, paper, madeAt}.';
create unique index if not exists piece_requests_open_listing on public.piece_requests (property_id, tool)
  where status in ('waiting', 'working') and property_id is not null;
create unique index if not exists piece_requests_open_pitch on public.piece_requests (pitch_id, tool)
  where status in ('waiting', 'working') and pitch_id is not null;
create index if not exists piece_requests_waiting on public.piece_requests (asked_at) where status = 'waiting';
create index if not exists piece_requests_owner on public.piece_requests (property_id, pitch_id, asked_at desc);

-- an ask from the site is always the asker's own, waiting, now: its outcome is the helper's
create or replace function public.piece_requests_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- the SQL Editor, a restore
  new.asked_by := auth.uid();
  new.asked_name := (select name from public.members where user_id = auth.uid());
  new.asked_at := now();
  new.status := 'waiting';
  new.started_at := null; new.finished_at := null; new.message := null; new.result := null;
  return new;
end $$;
drop trigger if exists piece_requests_stamp on public.piece_requests;
create trigger piece_requests_stamp before insert on public.piece_requests
  for each row execute function public.piece_requests_stamp();

alter table public.piece_requests enable row level security;
drop policy if exists "members read piece requests" on public.piece_requests;
drop policy if exists "askers add piece requests"   on public.piece_requests;
drop policy if exists "helper works piece requests" on public.piece_requests;
drop policy if exists "helper clears piece requests" on public.piece_requests;
create policy "members read piece requests" on public.piece_requests for select to authenticated using (public.is_member());
create policy "askers add piece requests"   on public.piece_requests for insert to authenticated with check (public.may_ask_piece());
create policy "helper works piece requests" on public.piece_requests for update to authenticated
  using (public.member_role() = 'helper') with check (public.member_role() = 'helper');
-- old finished asks are cleared by the helper (and the owner); a waiting one is never deleted from the site
create policy "helper clears piece requests" on public.piece_requests for delete to authenticated
  using (public.member_role() in ('helper', 'owner') and status in ('done', 'failed'));

-- the change log names the helper as a source
alter table public.changes drop constraint if exists changes_source_check;
alter table public.changes add constraint changes_source_check
  check (source in ('DE', 'Matt', 'Asana', 'form', 'doc', 'folder', 'seed', 'match', 'legacy', 'Helper'));

-- the record columns: the owner's (D87), and the helper's while save_piece_build runs
create or replace function public.documents_record_owner() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (tg_op = 'INSERT' and (new.built_from is not null or new.output is not null
        or coalesce(new.outputs, '[]'::jsonb) <> '[]'::jsonb or new.built_at is not null or new.built_by is not null))
     or (tg_op = 'UPDATE' and (new.built_from is distinct from old.built_from or new.output is distinct from old.output
        or new.outputs is distinct from old.outputs or new.built_at is distinct from old.built_at
        or new.built_by is distinct from old.built_by)) then
    if not exists (select 1 from public.members where user_id = auth.uid() and active
                     and (role = 'owner' or (role = 'helper' and current_setting('gvc.piece_build', true) = 'on'))) then
      raise exception 'not allowed';
    end if;
  end if;
  return new;
end $$;

create or replace function public.save_piece_build(p_request uuid, p_version integer, p_state jsonb,
                                                   p_built_from jsonb, p_output jsonb, p_archived jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_req  public.piece_requests%rowtype;
  v_col  text;
  v_id   uuid;
  v_n    integer;
  v_outs jsonb;
  v_row  jsonb;
begin
  if public.member_role() is distinct from 'helper' then raise exception 'not allowed'; end if;
  if p_built_from is null or p_output is null then raise exception 'bad build'; end if;
  perform set_config('gvc.piece_build', 'on', true);   -- this transaction only (documents_record_owner)
  select * into v_req from public.piece_requests where id = p_request for update;
  if not found or v_req.status <> 'working' then raise exception 'no such request'; end if;
  if v_req.pitch_id is not null then v_col := 'pitch_id'; v_id := v_req.pitch_id;
  else v_col := 'property_id'; v_id := v_req.property_id; end if;

  if p_version is null then
    begin
      execute format('insert into public.documents (%I, tool, state, version, saved_at) values ($1, $2, $3, 1, now())', v_col)
        using v_id, v_req.tool, coalesce(p_state, '{}'::jsonb);
    exception when unique_violation then
      raise exception 'conflict' using errcode = 'P0001';
    end;
  else
    execute format('update public.documents set state = $3, version = version + 1, saved_at = now()
                     where %I = $1 and tool = $2 and version = $4', v_col)
      using v_id, v_req.tool, coalesce(p_state, '{}'::jsonb), p_version;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'conflict' using errcode = 'P0001'; end if;
  end if;

  execute format('select outputs from public.documents where %I = $1 and tool = $2', v_col) into v_outs using v_id, v_req.tool;
  v_outs := coalesce(v_outs, '[]'::jsonb);
  if p_archived is not null and jsonb_array_length(v_outs) > 0 then
    v_outs := jsonb_set(v_outs, '{0}', (v_outs -> 0) || jsonb_build_object('archived', p_archived));
  end if;
  execute format('update public.documents
                     set built_from = $3, output = $4, built_at = now(), built_by = auth.uid(),
                         outputs = jsonb_build_array($4) || $5
                   where %I = $1 and tool = $2', v_col)
    using v_id, v_req.tool, p_built_from, p_output, v_outs;
  execute format('insert into public.changes (%I, field, new_value, note, asked_by, source) values ($1, $2, $3, $4, $5, ''Helper'')', v_col)
    using v_id, 'piece:' || v_req.tool, to_jsonb(coalesce(p_output ->> 'name', '')), public.piece_label(v_req.tool) || ' made', v_req.asked_name;

  update public.piece_requests
     set status = 'done', finished_at = now(), message = null,
         result = jsonb_build_object('path', p_output -> 'path', 'name', p_output -> 'name', 'url', p_output -> 'url',
                                     'paper', p_output -> 'paper', 'madeAt', p_output -> 'madeAt')
   where id = p_request;
  perform set_config('gvc.piece_build', 'off', true);

  execute format('select to_jsonb(d) from public.documents d where %I = $1 and tool = $2', v_col) into v_row using v_id, v_req.tool;
  return v_row;
end $$;
revoke execute on function public.save_piece_build(uuid, integer, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.save_piece_build(uuid, integer, jsonb, jsonb, jsonb, jsonb) to authenticated;
