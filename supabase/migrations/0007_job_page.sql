-- ============================================================
-- 0007 — THE JOB PAGE (workspace v2, Slice 3)
--
--   properties.details_doc  what the helper last read from the job's details document
--                           ({file, size, modified, readAt, found: [names]}).
--   changes.no_rebuild      "Typo, no rebuild": a change that needs no new version of the
--                           printed pieces (read by Slice 4). Defaults to false.
--   save_job(...)           the one way the job page saves: the row change and its
--                           change-log rows together, or nothing. It refuses when the row
--                           moved since the page loaded ('conflict'), when the caller is
--                           not the owner and is changing a fact ('not allowed'), and for
--                           any table or key it does not know ('bad table', 'bad key <k>').
--                           Any active member may add a note (an empty change set and rows
--                           with no field). Change rows are always source 'Matt'.
--
-- Needs 0004, 0005 and 0006. Safe to run more than once; nothing is dropped or renamed.
-- Before running it on the real project: back up (helper/backup.js).
-- ============================================================

alter table public.properties
  add column if not exists details_doc jsonb;
comment on column public.properties.details_doc is 'The details document last read: {file, size, modified, readAt, found: [names]}. Field names only, no values.';

alter table public.changes
  add column if not exists no_rebuild boolean not null default false;
comment on column public.changes.no_rebuild is 'True for a typo-level change that needs no rebuild of the printed pieces.';

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
    -- anyone else: a note only (no fact, no field)
    if v_set <> '{}'::jsonb then raise exception 'not allowed'; end if;
    for v_chg in select * from jsonb_array_elements(v_changes) loop
      if coalesce(v_chg ->> 'field', '') <> '' then raise exception 'not allowed'; end if;
    end loop;
  end if;

  for v_key in select jsonb_object_keys(v_set) loop
    if not (v_key = any (v_allowed)) then raise exception 'bad key %', v_key; end if;
  end loop;

  if v_set <> '{}'::jsonb then
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
  end loop;

  return v_row;
end $$;

revoke execute on function public.save_job(text, uuid, integer, jsonb, jsonb) from public, anon;
grant  execute on function public.save_job(text, uuid, integer, jsonb, jsonb) to authenticated;
