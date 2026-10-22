-- ============================================================
-- 0009 — PIECES (workspace v2, Slice 4: the Showsheet from the job)
--
--   documents.built_from   what the piece printed from the job when it was made (facts,
--                          agents, listing link, market, photos and floorplan with their
--                          file dates, paper). Null = made before Slice 4, or never made.
--   documents.output       the current file: {path, name, size, modified, url, paper,
--                          madeAt, via: 'helper'|'print'}.
--   documents.outputs      every file the workspace made for this piece, newest first. The
--                          helper moves an older file into Archive only when it is listed
--                          here (and unchanged since); the move is kept on its entry.
--   documents.built_at / built_by   when and by whom the current file was made.
--   documents.tool         any short lower-case piece name (was a fixed list of four).
--   save_piece(...)        the one way a piece is saved from a job: a draft (state only) or
--                          a build (state, built_from and output together), with the
--                          version check, owner only (D87), and one change-log row per build.
--   save_job(...)          unchanged, except "Typo, no rebuild": a change ticked so also
--                          writes its new value into each piece's built_from for that fact,
--                          in the same save, so nothing goes stale (S16).
--
-- Needs 0004 to 0008. Safe to run more than once; nothing is dropped or renamed except the
-- old tool check, which is replaced. Before running it on the real project: back up
-- (helper/backup.js).
-- ============================================================

alter table public.documents
  add column if not exists built_from jsonb,
  add column if not exists output     jsonb,
  add column if not exists outputs    jsonb not null default '[]'::jsonb,
  add column if not exists built_at   timestamptz,
  add column if not exists built_by   uuid references auth.users(id) on delete set null;
comment on column public.documents.built_from is 'What the piece printed from the job when it was made. Null = made before Slice 4, or not made.';
comment on column public.documents.outputs is 'Every file the workspace made for this piece, newest first; the helper archives only these.';

alter table public.documents drop constraint if exists documents_tool_check;
alter table public.documents add constraint documents_tool_check check (tool ~ '^[a-z][a-z0-9-]{1,30}$');

create or replace function public.save_piece(p_property_id uuid, p_tool text, p_version integer,
                                             p_state jsonb, p_built_from jsonb, p_output jsonb,
                                             p_archived jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_role  text;
  v_row   jsonb;
  v_build boolean := p_built_from is not null and p_output is not null;
  v_outs  jsonb;
  v_label text;
begin
  select role into v_role from public.members where user_id = auth.uid() and active;
  if v_role is distinct from 'owner' then raise exception 'not allowed'; end if;
  if (p_built_from is null) <> (p_output is null) then raise exception 'bad build'; end if;

  if p_version is null then
    if exists (select 1 from public.documents where property_id = p_property_id and tool = p_tool) then
      raise exception 'conflict' using errcode = 'P0001';
    end if;
    insert into public.documents (property_id, tool, state, version, saved_at)
    values (p_property_id, p_tool, coalesce(p_state, '{}'::jsonb), 1, now());
  else
    update public.documents set state = coalesce(p_state, '{}'::jsonb), version = version + 1, saved_at = now()
     where property_id = p_property_id and tool = p_tool and version = p_version;
    if not found then raise exception 'conflict' using errcode = 'P0001'; end if;
  end if;

  if v_build then
    select outputs into v_outs from public.documents where property_id = p_property_id and tool = p_tool;
    v_outs := coalesce(v_outs, '[]'::jsonb);
    -- the move of the older file is kept on that file's entry
    if p_archived is not null and jsonb_array_length(v_outs) > 0 then
      v_outs := jsonb_set(v_outs, '{0}', (v_outs -> 0) || jsonb_build_object('archived', p_archived));
    end if;
    update public.documents
       set built_from = p_built_from, output = p_output, built_at = now(), built_by = auth.uid(),
           outputs = jsonb_build_array(p_output) || v_outs
     where property_id = p_property_id and tool = p_tool;
    v_label := case when p_tool = 'showsheet' then 'Showsheet' else initcap(p_tool) end;
    insert into public.changes (property_id, field, new_value, note, source)
    values (p_property_id, 'piece:' || p_tool, to_jsonb(coalesce(p_output ->> 'name', '')), v_label || ' made', 'Matt');
  end if;

  select to_jsonb(d) into v_row from public.documents d where property_id = p_property_id and tool = p_tool;
  return v_row;
end $$;

revoke execute on function public.save_piece(uuid, text, integer, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.save_piece(uuid, text, integer, jsonb, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.save_job(p_table text, p_id uuid, p_version integer,
                                           p_set jsonb, p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_role    text;
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
    v_allowed := array['milestones'];
    v_owner := 'dev_project_id';
  else
    raise exception 'bad table';
  end if;

  select role into v_role from public.members where user_id = auth.uid() and active;
  if v_role is null then raise exception 'not allowed'; end if;

  if v_role <> 'owner' then
    -- anyone else: a note only (no fact, no field, no values)
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
    execute format('insert into public.changes (%I, field, old_value, new_value, note, asked_by, no_rebuild, source)
                    values ($1, $2, $3, $4, $5, $6, $7, ''Matt'')', v_owner)
      using p_id, v_chg ->> 'field', v_chg -> 'old_value', v_chg -> 'new_value', v_chg ->> 'note',
            v_chg ->> 'asked_by', coalesce((v_chg ->> 'no_rebuild')::boolean, false);
    -- "Typo, no rebuild" (0009, S16): the printed pieces take the new value too, so none goes stale
    if p_table = 'properties' and coalesce((v_chg ->> 'no_rebuild')::boolean, false)
       and coalesce(v_chg ->> 'field', '') <> '' then
      update public.documents
         set built_from = jsonb_set(built_from, array['facts', v_chg ->> 'field'], coalesce(v_chg -> 'new_value', 'null'::jsonb))
       where property_id = p_id and built_from -> 'facts' ? (v_chg ->> 'field');
    end if;
  end loop;

  return v_row;
end $$;

revoke execute on function public.save_job(text, uuid, integer, jsonb, jsonb) from public, anon;
grant  execute on function public.save_job(text, uuid, integer, jsonb, jsonb) to authenticated;
