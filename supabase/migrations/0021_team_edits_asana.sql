-- ============================================================
-- 0021 — THE TEAM EDITS, AND AN EDIT GOES TO ASANA TOO (overhaul step 5, D77 lifted 11-03)
--
--   save_job          0018's, except: admin, marketing, ops and team (each signed in as
--                     themselves, 0020) may change a listing's or a pitch's facts (core).
--                     The stage, photos, details doc and a development's milestones stay
--                     the owner's; the shared sign-in still adds notes only. A change row
--                     names who made it (asked_by, user_id) when the page didn't.
--   asana_writes      what the helper is to write to Asana: one row per fact changed in the
--                     workspace (a changes row with source 'Matt') on a listing linked to an
--                     Asana task, for the facts Asana has a field for (asana_field_of). The
--                     helper (helper/asana-write.js) writes it and marks it done or failed.
--                     A change the helper itself read from Asana (source 'Asana') is never
--                     queued, so nothing goes round in a loop.
--
-- Matt, 11-03: "Yes. Remove rule D77". Needs 0020. Safe to run more than once.
-- Back up first (helper/backup.js).
-- ============================================================

create or replace function public.save_job(p_table text, p_id uuid, p_version integer,
                                           p_set jsonb, p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_role    text;
  v_name    text;
  v_allowed text[];
  v_owner   text;
  v_key     text;
  v_val     jsonb;
  v_chg     jsonb;
  v_sets    text[] := '{}';
  v_cur     public.properties%rowtype;
  v_snap    jsonb;
  v_to      text;
  v_row     jsonb;
  v_set     jsonb := coalesce(p_set, '{}'::jsonb);
  v_changes jsonb := coalesce(p_changes, '[]'::jsonb);
begin
  if p_table = 'properties' then
    v_allowed := array['core', 'extras', 'details_doc', 'photo_hero', 'photo_order', 'stage'];
    v_owner := 'property_id';
  elsif p_table = 'pitches' then
    v_allowed := array['core'];
    v_owner := 'pitch_id';
  elsif p_table = 'dev_projects' then
    v_allowed := array['milestones', 'archived'];
    v_owner := 'dev_project_id';
  else
    raise exception 'bad table';
  end if;

  select role, name into v_role, v_name from public.members where user_id = auth.uid() and active;
  if v_role is null then raise exception 'not allowed'; end if;

  if v_role in ('admin', 'marketing', 'ops', 'team') then
    -- the team, each signed in as themselves (0020): a listing's or a pitch's facts (core) and notes;
    -- the stage, photos, the details doc and a development's milestones stay the owner's
    if p_table = 'dev_projects' and v_set <> '{}'::jsonb then raise exception 'not allowed'; end if;
    for v_key in select jsonb_object_keys(v_set) loop
      if v_key <> 'core' then raise exception 'not allowed'; end if;
    end loop;
  elsif v_role <> 'owner' then
    -- anyone else (the shared sign-in): a note only (no fact, no field, no values)
    if v_set <> '{}'::jsonb then raise exception 'not allowed'; end if;
    for v_chg in select * from jsonb_array_elements(v_changes) loop
      if jsonb_typeof(v_chg) <> 'object'
         or coalesce(btrim(v_chg ->> 'note'), '') = ''
         or v_chg ?| array['field', 'old_value', 'new_value', 'no_rebuild'] then
        raise exception 'not allowed';
      end if;
    end loop;
  end if;

  for v_key in select jsonb_object_keys(v_set) loop
    if not (v_key = any (v_allowed)) then raise exception 'bad key %', v_key; end if;
  end loop;

  if v_set <> '{}'::jsonb then
    -- the row as the page loaded it, before any other rule: a stale save is a conflict
    execute format('select to_jsonb(t) from public.%I t where id = $1 and version = $2', p_table)
      into v_row using p_id, p_version;
    if v_row is null then
      raise exception 'conflict' using errcode = 'P0001';
    end if;

    for v_key, v_val in select * from jsonb_each(v_set) loop
      if p_table = 'properties' and v_key = 'stage' then
        select * into v_cur from public.properties where id = p_id;
        v_to := v_val #>> '{}';
        v_snap := coalesce(v_cur.asana, '{}'::jsonb);
        if v_to = 'Archived' then
          v_sets := v_sets || format('stage = %L, stage_source = %L', 'Archived', 'Matt');
        elsif v_cur.stage = 'Archived'
              and v_to = coalesce(nullif(v_snap ->> 'stageFromStatus', ''), nullif(v_snap ->> 'stageFromSection', ''), 'Prep') then
          v_sets := v_sets || format('stage = %L, stage_source = %L', v_to, 'Asana');
        else
          raise exception 'bad stage %', v_to;
        end if;
      elsif p_table = 'dev_projects' and v_key = 'archived' then
        -- 0018: true archives the development (now), false brings it back
        if jsonb_typeof(v_val) <> 'boolean' then raise exception 'bad archived'; end if;
        v_sets := v_sets || case when (v_val #>> '{}')::boolean then 'archived_at = now()' else 'archived_at = null' end;
      else
        v_sets := v_sets || format('%I = (jsonb_populate_record(null::public.%I, jsonb_build_object(%L, %L::jsonb))).%I',
                                   v_key, p_table, v_key, v_val::text, v_key);
      end if;
    end loop;

    execute format('update public.%I t set %s where id = $1 and version = $2 returning to_jsonb(t)',
                   p_table, array_to_string(v_sets, ', '))
      into v_row using p_id, p_version;
    if v_row is null then
      raise exception 'conflict' using errcode = 'P0001';
    end if;
  else
    execute format('select to_jsonb(t) from public.%I t where id = $1', p_table) into v_row using p_id;
    if v_row is null then raise exception 'conflict' using errcode = 'P0001'; end if;
  end if;

  for v_chg in select * from jsonb_array_elements(v_changes) loop
    -- who: the page's name for them, else the signed-in member's (0021)
    execute format('insert into public.changes (%I, field, old_value, new_value, note, asked_by, no_rebuild, source, user_id)
                    values ($1, $2, $3, $4, $5, $6, $7, ''Matt'', $8)', v_owner)
      using p_id, v_chg ->> 'field', v_chg -> 'old_value', v_chg -> 'new_value', v_chg ->> 'note',
            coalesce(v_chg ->> 'asked_by', v_name), coalesce((v_chg ->> 'no_rebuild')::boolean, false), auth.uid();
    -- "Typo, no rebuild" (0009, S16; 0010 for a pitch's pieces too): the printed pieces take the
    -- new value, so none goes stale
    if p_table in ('properties', 'pitches') and coalesce((v_chg ->> 'no_rebuild')::boolean, false)
       and coalesce(v_chg ->> 'field', '') <> '' then
      execute format('update public.documents
                         set built_from = jsonb_set(built_from, array[''facts'', $2], coalesce($3, ''null''::jsonb))
                       where %I = $1 and built_from -> ''facts'' ? $2', v_owner)
        using p_id, v_chg ->> 'field', v_chg -> 'new_value';
    end if;
  end loop;

  return v_row;
end $$;

revoke execute on function public.save_job(text, uuid, integer, jsonb, jsonb) from public, anon;
grant  execute on function public.save_job(text, uuid, integer, jsonb, jsonb) to authenticated;

-- ---------- what goes to Asana ----------
-- the workspace's fact → the Asana field it writes (asana-map.js reads the same fields)
create or replace function public.asana_field_of(p_field text) returns text
language sql immutable as $$
  select case p_field
    when 'price'         then '💵 Current Price'
    when 'originalPrice' then '💵 Original Price'
    when 'sqft'          then 'ℹ️ INT SF'
    when 'lotSize'       then 'ℹ️ Acreage'
    when 'zip'           then '📍 Zip'
    when 'county'        then '📍 County'
    when 'description'   then 'Listing Copy'
    when 'mapsUrl'       then 'Google Maps Link'
    when 'listingUrl'    then '🛜 Elliman Link'
  end
$$;

create table if not exists public.asana_writes (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  change_id   uuid references public.changes(id) on delete set null,
  task_gid    text not null,
  field       text not null,
  asana_field text not null,
  value       jsonb,
  asked_by    text,
  status      text not null default 'waiting' check (status in ('waiting', 'working', 'done', 'failed')),
  error       text,
  asked_at    timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists asana_writes_waiting on public.asana_writes (asked_at) where status = 'waiting';
comment on table public.asana_writes is
  'Facts changed in the workspace, waiting for the helper to write them to Asana (0021, overhaul step 5).';

alter table public.asana_writes enable row level security;
drop policy if exists "members read asana writes" on public.asana_writes;
drop policy if exists "helper works asana writes" on public.asana_writes;
create policy "members read asana writes" on public.asana_writes for select to authenticated using (public.is_member());
create policy "helper works asana writes" on public.asana_writes for update to authenticated
  using (public.member_role() = 'helper') with check (public.member_role() = 'helper');
-- rows are only ever added by the trigger below (security definer), never by a page

create or replace function public.queue_asana_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_gid text; v_af text;
begin
  if new.source <> 'Matt' or new.property_id is null or new.field is null then return new; end if;
  -- a cleared value leaves Asana's as it is
  if new.new_value is null or new.new_value = 'null'::jsonb then return new; end if;
  v_af := public.asana_field_of(new.field);
  if v_af is null then return new; end if;
  select asana_gid into v_gid from public.properties where id = new.property_id;
  if v_gid is null or v_gid = '' then return new; end if;
  -- a newer edit of the same field replaces one still waiting
  delete from public.asana_writes where property_id = new.property_id and field = new.field and status = 'waiting';
  insert into public.asana_writes (property_id, change_id, task_gid, field, asana_field, value, asked_by)
    values (new.property_id, new.id, v_gid, new.field, v_af, new.new_value, new.asked_by);
  return new;
end $$;
revoke execute on function public.queue_asana_write() from public, anon, authenticated;
drop trigger if exists queue_asana_write on public.changes;
create trigger queue_asana_write after insert on public.changes for each row execute function public.queue_asana_write();
