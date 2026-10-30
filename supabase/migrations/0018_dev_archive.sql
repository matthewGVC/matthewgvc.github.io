-- ============================================================
-- 0018 — archiving a development (Matt, 2026-10-30)
--
-- A listing is archived by its stage ('Archived', save_job since 0007). A
-- development has no stage, so it gets archived_at: set, it leaves the
-- overview, the lists, the Match page and the search's results unless
-- "Show archived" is ticked (workspace-data.js buildJobs); cleared, it is back.
-- Nothing else about the development changes, and nothing on Drive or in
-- Asana moves.
--
-- save_job (0010's, unchanged otherwise) takes { archived: true | false } for
-- dev_projects, owner only like every other set, and logs it as a change row
-- like any field.
-- ============================================================

alter table public.dev_projects add column if not exists archived_at timestamptz;

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
    v_allowed := array['milestones', 'archived'];
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
