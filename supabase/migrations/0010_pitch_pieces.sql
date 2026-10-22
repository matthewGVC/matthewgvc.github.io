-- ============================================================
-- 0010 — PITCH PIECES (workspace v2, Slice 5: Brochure, Postcard, Seller pitch from the job)
--
--   documents.pitch_id     a piece may belong to a pitch instead of a listing (the seller pitch
--                          and its map, D97). Exactly one of property_id / pitch_id is set.
--   documents keys         the primary key (property_id, tool) becomes two unique keys:
--                          (property_id, tool), which the old tools' upsert still targets, and
--                          (pitch_id, tool). Empty owners never clash.
--   save_piece_of(...)     save_piece for either owner ('properties' or 'pitches'): a draft
--                          (state only) or a build (state, built_from and output together), with
--                          the version check, owner only (D87), and one change-log row per build
--                          on the right owner ("Brochure made", "Seller pitch made"…).
--   save_piece(...)        unchanged for the Showsheet: now a call to save_piece_of('properties', …).
--   save_job(...)          unchanged, except the "Typo, no rebuild" rule now also reaches a
--                          pitch's pieces.
--
-- Needs 0004 to 0009. Safe to run more than once; nothing is dropped except the old primary
-- key, which the two unique keys replace. Before running it on the real project: back up
-- (helper/backup.js).
-- ============================================================

alter table public.documents
  add column if not exists pitch_id uuid references public.pitches(id) on delete cascade;
create index if not exists documents_pitch_idx on public.documents (pitch_id);

alter table public.documents drop constraint if exists documents_pkey;
alter table public.documents alter column property_id drop not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_property_tool_key') then
    alter table public.documents add constraint documents_property_tool_key unique (property_id, tool);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_pitch_tool_key') then
    alter table public.documents add constraint documents_pitch_tool_key unique (pitch_id, tool);
  end if;
end $$;
alter table public.documents drop constraint if exists documents_one_owner;
alter table public.documents add constraint documents_one_owner check ((property_id is null) <> (pitch_id is null));
comment on column public.documents.pitch_id is 'The pitch that owns this piece (a seller pitch, its map), when it is not a listing''s.';

-- a piece's name in the change log
create or replace function public.piece_label(p_tool text) returns text language sql immutable as $$
  select case p_tool
    when 'showsheet' then 'Showsheet'
    when 'brochure' then 'Brochure'
    when 'seller' then 'Seller pitch'
    when 'pitch-map' then 'Map'
    when 'postcard-listed' then 'Just Listed postcard'
    when 'postcard-sold' then 'Just Sold postcard'
    else initcap(replace(p_tool, '-', ' ')) end
$$;

create or replace function public.save_piece_of(p_table text, p_id uuid, p_tool text, p_version integer,
                                                p_state jsonb, p_built_from jsonb, p_output jsonb,
                                                p_archived jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_role  text;
  v_col   text;
  v_row   jsonb;
  v_build boolean := p_built_from is not null and p_output is not null;
  v_outs  jsonb;
  v_n     integer;
begin
  if p_table = 'properties' then v_col := 'property_id';
  elsif p_table = 'pitches' then v_col := 'pitch_id';
  else raise exception 'bad table';
  end if;
  select role into v_role from public.members where user_id = auth.uid() and active;
  if v_role is distinct from 'owner' then raise exception 'not allowed'; end if;
  if (p_built_from is null) <> (p_output is null) then raise exception 'bad build'; end if;

  if p_version is null then
    begin
      execute format('insert into public.documents (%I, tool, state, version, saved_at) values ($1, $2, $3, 1, now())', v_col)
        using p_id, p_tool, coalesce(p_state, '{}'::jsonb);
    exception when unique_violation then
      raise exception 'conflict' using errcode = 'P0001';   -- someone saved this piece first
    end;
  else
    execute format('update public.documents set state = $3, version = version + 1, saved_at = now()
                     where %I = $1 and tool = $2 and version = $4', v_col)
      using p_id, p_tool, coalesce(p_state, '{}'::jsonb), p_version;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'conflict' using errcode = 'P0001'; end if;
  end if;

  if v_build then
    execute format('select outputs from public.documents where %I = $1 and tool = $2', v_col) into v_outs using p_id, p_tool;
    v_outs := coalesce(v_outs, '[]'::jsonb);
    -- the move of the older file is kept on that file's entry
    if p_archived is not null and jsonb_array_length(v_outs) > 0 then
      v_outs := jsonb_set(v_outs, '{0}', (v_outs -> 0) || jsonb_build_object('archived', p_archived));
    end if;
    execute format('update public.documents
                       set built_from = $3, output = $4, built_at = now(), built_by = auth.uid(),
                           outputs = jsonb_build_array($4) || $5
                     where %I = $1 and tool = $2', v_col)
      using p_id, p_tool, p_built_from, p_output, v_outs;
    execute format('insert into public.changes (%I, field, new_value, note, source) values ($1, $2, $3, $4, ''Matt'')', v_col)
      using p_id, 'piece:' || p_tool, to_jsonb(coalesce(p_output ->> 'name', '')), public.piece_label(p_tool) || ' made';
  end if;

  execute format('select to_jsonb(d) from public.documents d where %I = $1 and tool = $2', v_col) into v_row using p_id, p_tool;
  return v_row;
end $$;

revoke execute on function public.save_piece_of(text, uuid, text, integer, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.save_piece_of(text, uuid, text, integer, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- the Showsheet's call (Slice 4) keeps its name and arguments
create or replace function public.save_piece(p_property_id uuid, p_tool text, p_version integer,
                                             p_state jsonb, p_built_from jsonb, p_output jsonb,
                                             p_archived jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  return public.save_piece_of('properties', p_property_id, p_tool, p_version, p_state, p_built_from, p_output, p_archived);
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
