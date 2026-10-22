/* ============================================================
   Dry run of every Supabase migration in a local Postgres (PGlite, Postgres
   compiled to run inside Node), so a migration is proven before it ever
   touches the real project.

     cd scripts && npm install        (once — playwright, pglite)
     node scripts/test-migrations.js

   It stubs the parts of Supabase that plain Postgres lacks (the auth and
   storage schemas, auth.uid(), the anon/authenticated roles and Supabase's
   default grants), applies 0001–0003, adds rows shaped like today's library,
   then applies 0004 onward TWICE (they must be safe to re-run) and checks the
   rules as Matt, the helper, the shared team account, a stranger and an
   anonymous visitor.

   MIGRATIONS_UPTO=0003 runs only the old files (the new checks then fail).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const UPTO = process.env.MIGRATIONS_UPTO || '9999';

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const STUBS = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit integer);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant select on auth.users to authenticated;
  grant all on storage.objects to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const USERS = {
  matt: 'matthew@gvcrealestateteam.com', helper: 'helper@gvcrealestateteam.com',
  team: 'team@gvcrealestateteam.com', stranger: 'someone@example.com'
};

(async () => {
  const db = new PGlite();
  await db.exec(STUBS);
  const id = {};
  for (const k of Object.keys(USERS)) {
    id[k] = (await db.query('insert into auth.users (email) values ($1) returning id', [USERS[k]])).rows[0].id;
  }

  const files = fs.readdirSync(DIR).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
  const old = files.filter(f => f.slice(0, 4) <= '0003');
  const fresh = files.filter(f => f.slice(0, 4) > '0003' && f.slice(0, 4) <= UPTO);
  for (const f of old) await db.exec(fs.readFileSync(path.join(DIR, f), 'utf8'));

  // rows shaped like today's library
  const prop = (await db.query(`insert into public.properties (slug, label, core) values
    ('100-example-st-4a', '100 Example St, 4A', '{"address":"100 Example St","agentIds":["elyse-gutman"]}') returning id`)).rows[0].id;
  await db.query(`insert into public.documents (property_id, tool, state) values ($1, 'showsheet', '{"x":1}')`, [prop]);
  await db.query(`insert into public.todos (body) values ('Florida office signage')`);
  await db.query(`insert into public.developments (slug, label, data) values ('example-dev', 'Example Developer', '{}')`);
  // a rule someone once added by hand in the dashboard: it must not survive
  await db.exec(`create policy "anyone reads properties" on public.properties for select to authenticated using (true)`);

  const early = fresh.filter(f => f.slice(0, 4) <= '0005'), late = fresh.filter(f => f.slice(0, 4) > '0005');
  async function applyAll(list, round) {
    for (const f of list) {
      try { await db.exec(fs.readFileSync(path.join(DIR, f), 'utf8')); }
      catch (e) { failures.push('apply ' + f + ' (round ' + round + '): ' + e.message); }
    }
  }
  await applyAll(early, 1);
  // v1.1 data that 0006 must carry over: an old stage, a current stage, a development with old milestone keys
  const fpId = (await db.query(`insert into public.properties (slug, label, core, stage) values ('200-example-st', '200 Example St', '{}', 'Floorplan') returning id`)).rows[0].id;
  const liveId = (await db.query(`insert into public.properties (slug, label, core, stage) values ('300-example-st', '300 Example St', '{}', 'Live') returning id`)).rows[0].id;
  await db.query(`insert into public.dev_projects (slug, label, milestones) values ('example-tower', 'Example Tower',
    '{"Renders":{"done":true,"on":"2026-05-21"},"Launch event":{"done":false},"Contracts & sales":{"done":true},"Agreement":{"done":true}}')`);
  await applyAll(late, 1);
  await applyAll(fresh, 2);

  async function as(who, sql, params) {
    await db.exec('reset role');
    if (who === 'anon') await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false);");
    else await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id[who]]).then(() => db.exec('set role authenticated'));
    try { return await db.query(sql, params); }
    finally { await db.exec('reset role'); }
  }
  async function fails(who, sql, params) {
    try { await as(who, sql, params); return false; } catch (e) { return true; }
  }

  /* ---------- structure ---------- */
  const tables = (await db.query(`select table_name from information_schema.tables where table_schema = 'public' order by 1`)).rows.map(r => r.table_name);
  check('tables', tables, ['asana_people', 'asana_tasks', 'changes', 'de_listings', 'dev_projects', 'developments', 'documents', 'floorplans', 'members', 'photos', 'pitches', 'properties', 'sync_runs', 'todos']);
  const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'properties' order by 1`)).rows.map(r => r.column_name);
  check('properties columns', ['kind', 'market', 'stage', 'stage_source', 'units', 'extras', 'de_listing_id', 'de_status', 'de', 'mls_id',
    'drive_folder', 'folder_state', 'scan', 'photo_hero', 'photo_order', 'version', 'updated_by', 'from_pitch_id',
    'asana_gid', 'asana', 'milestones', 'match', 'dev_project_id', 'de_stage'].filter(c => cols.indexOf(c) === -1), []);
  const members = (await db.query('select role from public.members order by role')).rows.map(r => r.role);
  check('members from existing accounts only', members, ['helper', 'owner', 'shared']);

  /* ---------- existing data survives ---------- */
  const p = (await db.query('select core, kind, folder_state, version, status from public.properties where id = $1', [prop])).rows[0] || {};
  check('old property kept', [p.core && p.core.address, p.kind, p.folder_state, p.status], ['100 Example St', 'sale', 'unlinked', 'active']);
  check('old document kept', (await db.query('select count(*)::int n from public.documents')).rows[0].n, 1);

  /* ---------- rules ---------- */
  check('matt reads', (await as('matt', 'select count(*)::int n from public.properties')).rows[0].n, 3);
  check('helper reads', (await as('helper', 'select count(*)::int n from public.properties')).rows[0].n, 3);
  // before 0008 the shared team account reads the to-dos; from 0008 they are Matt's own
  check('shared account and to-dos', (await as('team', 'select count(*)::int n from public.todos')).rows[0].n, UPTO >= '0008' ? 0 : 1);
  check('shared account still reads properties', (await as('team', 'select count(*)::int n from public.properties')).rows[0].n, 3);
  check('stranger reads nothing', (await as('stranger', 'select count(*)::int n from public.properties')).rows[0].n, 0);
  check('stranger reads no todos', (await as('stranger', 'select count(*)::int n from public.todos')).rows[0].n, 0);
  check('anon reads nothing', (await as('anon', 'select count(*)::int n from public.properties')).rows[0].n, 0);
  check('stranger cannot add a pitch', await fails('stranger', `insert into public.pitches (slug, label) values ('x', 'x')`), true);
  check('stranger cannot read members', (await as('stranger', 'select count(*)::int n from public.members')).rows[0].n, 0);

  /* ---------- stamping and versions ---------- */
  await as('matt', `update public.properties set stage = 'Live' where id = $1`, [prop]);
  const s = (await db.query('select stage, version, updated_by from public.properties where id = $1', [prop])).rows[0];
  check('stamped by matt, version 2', [s.stage, s.version, s.updated_by], ['Live', 2, id.matt]);
  const stale = await as('helper', `update public.properties set stage = 'Sold' where id = $1 and version = 1`, [prop]);
  check('stale version changes nothing', stale.affectedRows, 0);
  await as('helper', `update public.documents set state = '{"x":2}' where property_id = $1`, [prop]);
  // saving a piece touches the property's date but isn't a change to it: no false version conflicts
  check('saving a piece keeps the version', (await db.query('select version from public.properties where id = $1', [prop])).rows[0].version, 2);
  const pit = (await as('matt', `insert into public.pitches (slug, label, pitched_on) values ('250-w94-11b-2026-08-04', '250 W94 11B', '2026-08-04') returning version, updated_by, outcome`)).rows[0];
  check('new pitch stamped', [pit.version, pit.updated_by, pit.outcome], [1, id.matt, 'open']);

  /* ---------- checks ---------- */
  check('bad stage refused', await fails('matt', `update public.properties set stage = 'Pending' where id = $1`, [prop]), true);
  check('bad market refused', await fails('matt', `update public.properties set market = 'CT' where id = $1`, [prop]), true);
  check('bad outcome refused', await fails('matt', `update public.pitches set outcome = 'lost'`), true);
  const pitchId = (await db.query('select id from public.pitches limit 1')).rows[0].id;
  check('change with two owners refused', await fails('matt',
    `insert into public.changes (property_id, pitch_id, source) values ($1, $2, 'Matt')`, [prop, pitchId]), true);
  const ch = (await as('matt', `insert into public.changes (property_id, field, new_value, source) values ($1, 'stage', '"Live"', 'Matt') returning user_id`, [prop])).rows[0];
  check('change stamped with its author', ch.user_id, id.matt);
  const edit = await as('matt', `update public.changes set note = 'edited' where property_id = $1`, [prop]);
  check('change log cannot be edited', edit.affectedRows, 0);
  const del = await as('matt', `delete from public.changes where property_id = $1`, [prop]);
  check('change log cannot be deleted', del.affectedRows, 0);
  const run = (await as('helper', `insert into public.sync_runs (kind, ok, rows_read) values ('de', true, '{"featured-sale":32}') returning kind`)).rows[0];
  check('helper logs a run', run.kind, 'de');
  check('bad run kind refused', await fails('helper', `insert into public.sync_runs (kind) values ('social')`), true);

  /* ---------- the change log survives, and is honest ---------- */
  check('a job with history can\'t be deleted', await fails('matt', 'delete from public.properties where id = $1', [prop]), true);
  check('its change log is still there', (await db.query('select count(*)::int n from public.changes where property_id = $1', [prop])).rows[0].n, 1);
  check('no change written in someone else\'s name', await fails('matt',
    `insert into public.changes (property_id, source, user_id) values ($1, 'Matt', $2)`, [prop, id.helper]), true);

  /* an account that wrote things can still be removed later */
  const tmp = (await db.query(`insert into auth.users (email) values ('temp@example.com') returning id`)).rows[0].id;
  await db.query(`insert into public.members (user_id, name, initials) values ($1, 'Temp', 'T')`, [tmp]);
  id.temp = tmp;
  await as('temp', `insert into public.pitches (slug, label) values ('temp-pitch', 'Temp pitch')`);
  await db.query("select set_config('request.jwt.claim.sub', '', false)");   // as the dashboard does it: nobody signed in
  check('removing an account that wrote works', await db.query('delete from auth.users where id = $1', [tmp]).then(() => true, () => false), true);
  check('its rows stay, unstamped', (await db.query(`select updated_by from public.pitches where slug = 'temp-pitch'`)).rows[0].updated_by, null);

  /* ---------- 0006: Asana columns, cache, people, new stage list ---------- */
  if (UPTO >= '0006') {
    const st = async x => (await db.query('select stage from public.properties where id = $1', [x])).rows[0].stage;
    check('old stage moved to Prep', await st(fpId), 'Prep');
    check('current stage kept', await st(liveId), 'Live');
    const mv = (await db.query(`select source, field, old_value, new_value, note from public.changes where property_id = $1`, [fpId])).rows;
    check('one change row for the move, even after two runs', mv, [{ source: 'seed', field: 'stage', old_value: 'Floorplan', new_value: 'Prep', note: 'stage list v1.2' }]);
    check('no change row for a stage that stayed', (await db.query(`select count(*)::int n from public.changes where property_id = $1`, [liveId])).rows[0].n, 0);
    check('old stage name refused now', await fails('matt', `update public.properties set stage = 'Won' where id = $1`, [liveId]), true);
    for (const ok of ['Accepted offer', 'Off market', 'Prep']) {
      check('new stage ' + ok + ' accepted', await fails('matt', `update public.properties set stage = '${ok}' where id = $1`, [liveId]), false);
    }
    await db.query(`update public.properties set stage = 'Live' where id = $1`, [liveId]);
    check('stage source Asana accepted', await fails('matt', `update public.properties set stage_source = 'Asana' where id = $1`, [liveId]), false);
    await db.query(`update public.properties set asana_gid = '1200000000000001' where id = $1`, [fpId]);
    check('one Asana task, one job', await fails('matt', `update public.properties set asana_gid = '1200000000000001' where id = $1`, [liveId]), true);
    await db.query(`insert into public.pitches (slug, label, asana_gid) values ('p-a', 'A', 'g9')`);
    check('pitch asana_gid is unique', await fails('matt', `insert into public.pitches (slug, label, asana_gid) values ('p-b', 'B', 'g9')`), true);
    for (const src of ['Asana', 'match', 'legacy'])
      check('change source ' + src, await fails('matt', `insert into public.changes (property_id, source) values ($1, '${src}')`, [liveId]), false);
    check('bad change source still refused', await fails('matt', `insert into public.changes (property_id, source) values ($1, 'email')`, [liveId]), true);
    for (const k of ['asana', 'people'])
      check('run kind ' + k, await fails('helper', `insert into public.sync_runs (kind) values ('${k}')`), false);
    const dp = (await db.query(`select milestones from public.dev_projects where slug = 'example-tower'`)).rows[0].milestones;
    check('milestone keys renamed', Object.keys(dp).sort(), ['agreement', 'contractsSales', 'launchEvent', 'renders']);
    check('milestone values kept', [dp.renders.done, dp.renders.on], [true, '2026-05-21']);
    await db.query(`insert into public.asana_tasks (gid, project_gid, kind, name) values ('t1', 'pr1', 'listing', 'Task')`);
    await db.query(`insert into public.asana_people (gid, name) values ('u1', 'Someone')`);
    for (const t of ['asana_tasks', 'asana_people']) {
      check(t + ': anon sees nothing', (await as('anon', 'select count(*)::int n from public.' + t)).rows[0].n, 0);
      check(t + ': stranger sees nothing', (await as('stranger', 'select count(*)::int n from public.' + t)).rows[0].n, 0);
      check(t + ': member sees all', (await as('matt', 'select count(*)::int n from public.' + t)).rows[0].n, 1);
    }
    check('helper can write the cache', await fails('helper', `update public.asana_tasks set name = 'Task 2' where gid = 't1'`), false);
    check('bad task kind refused', await fails('helper', `insert into public.asana_tasks (gid, project_gid, kind) values ('t2', 'pr1', 'odd')`), true);
  }

  /* ---------- 0008: to-dos are Matt's own (the helper may read them for the backup) ---------- */
  if (UPTO >= '0008') {
    const tr8 = (await db.query(`insert into auth.users (email) values ('todoteam@gvcrealestateteam.com') returning id`)).rows[0].id;
    await db.query(`insert into public.members (user_id, name, initials, role) values ($1, 'Todo Team', 'TT', 'team')`, [tr8]);
    id.todoteam = tr8;
    const n = async who => (await as(who, 'select count(*)::int n from public.todos')).rows[0].n;
    const tries = async (who, sql) => { try { const r = await as(who, sql); return r.affectedRows || 0; } catch (e) { return 'refused'; } };
    check('0008: Matt reads his to-dos', await n('matt'), 1);
    check('0008: Matt adds and ticks a to-do', [await tries('matt', `insert into public.todos (body) values ('Matt adds')`), await tries('matt', `update public.todos set done = true where body = 'Matt adds'`)], [1, 1]);
    check('0008: the helper reads them (nightly backup)', await n('helper'), 2);
    check('0008: the helper can\'t change them', [await tries('helper', `insert into public.todos (body) values ('helper adds')`), await tries('helper', `update public.todos set done = true`), await tries('helper', `delete from public.todos`)],
      ['refused', 0, 0]);
    check('0008: the shared team account sees and changes none', [await n('team'), await tries('team', `insert into public.todos (body) values ('team adds')`), await tries('team', `delete from public.todos`)], [0, 'refused', 0]);
    check('0008: a plain team member sees and changes none', [await n('todoteam'), await tries('todoteam', `update public.todos set done = true`)], [0, 0]);
    check('0008: strangers and anon see none', [await n('stranger'), await n('anon')], [0, 0]);
    check('0008: an inactive owner sees none', await (async () => { await db.query(`update public.members set active = false where role = 'owner'`); const x = await n('matt'); await db.query(`update public.members set active = true where role = 'owner'`); return x; })(), 0);
    await db.query(`delete from public.todos where body = 'Matt adds'`);
  }

  /* ---------- 0007: details_doc, no_rebuild, save_job ---------- */
  if (UPTO >= '0007') {
    const sj = (who, table, rid, ver, set, chg) => as(who, 'select public.save_job($1, $2, $3, $4::jsonb, $5::jsonb) r',
      [table, rid, ver, JSON.stringify(set), JSON.stringify(chg)]);
    const sjErr = async (who, ...a) => { try { await sj(who, ...a); return null; } catch (e) { return e.message; } };
    const count = async (where, ...params) => (await db.query('select count(*)::int n from public.changes where ' + where, params)).rows[0].n;
    const ver = async (t, x) => (await db.query('select version from public.' + t + ' where id = $1', [x])).rows[0].version;

    check('details_doc column', (await db.query(`select data_type from information_schema.columns where table_name = 'properties' and column_name = 'details_doc'`)).rows[0].data_type, 'jsonb');
    check('no_rebuild defaults false', (await db.query(`insert into public.changes (property_id, source) values ($1, 'Matt') returning no_rebuild`, [liveId])).rows[0].no_rebuild, false);
    check('anon cannot run save_job', await fails('anon', `select public.save_job('properties', $1, 1, '{}', '[]')`, [liveId]), true);

    // a member whose role is plain 'team' (the test accounts hold owner, helper and shared)
    const tr = (await db.query(`insert into auth.users (email) values ('teamrole@gvcrealestateteam.com') returning id`)).rows[0].id;
    await db.query(`insert into public.members (user_id, name, initials, role) values ($1, 'Team Member', 'TM', 'team')`, [tr]);
    id.teamrole = tr;

    const pid = (await db.query(`insert into public.properties (slug, label, core, asana) values ('400-example-st', '400 Example St', '{"price":1}',
      '{"stageFromStatus":"Live","stageFromSection":"Prep"}') returning id`)).rows[0].id;
    let v = await ver('properties', pid);
    const base = await count('property_id = $1', pid);

    const saved = (await sj('matt', 'properties', pid, v, { core: { price: 2 } }, [{ field: 'price', old_value: 1, new_value: 2, asked_by: 'Matt' }])).rows[0].r;
    check('save returns the new row', [saved.version, saved.core], [v + 1, { price: 2 }]);
    const row = (await db.query(`select source, property_id, field, old_value, new_value, asked_by, no_rebuild, user_id from public.changes where property_id = $1 and field = 'price'`, [pid])).rows;
    check('one change row, source Matt', row, [{ source: 'Matt', property_id: pid, field: 'price', old_value: 1, new_value: 2, asked_by: 'Matt', no_rebuild: false, user_id: id.matt }]);

    check('stale version raises conflict', await sjErr('matt', 'properties', pid, v, { core: { price: 3 } }, [{ field: 'price', new_value: 3 }]), 'conflict');
    check('conflict wrote no change row', await count('property_id = $1', pid), base + 1);
    check('conflict changed no data', (await db.query('select core from public.properties where id = $1', [pid])).rows[0].core, { price: 2 });
    let cfCode = '';
    try { await as('matt', `select public.save_job('properties', $1, 1, '{"core":{}}', '[]')`, [pid]); } catch (e) { cfCode = e.code || ''; }
    check('conflict errcode P0001', cfCode, 'P0001');
    v += 1;

    await sj('matt', 'properties', pid, v, { extras: { a: 1 } }, [{ field: 'x', source: 'DE', new_value: 1 }]);
    check('a sent source is ignored: source stays Matt', (await db.query(`select source from public.changes where property_id = $1 and field = 'x'`, [pid])).rows[0].source, 'Matt');
    v += 1;
    await sj('matt', 'properties', pid, v, { photo_hero: 'a.jpg', photo_order: ['a.jpg', 'b.jpg'] }, [{ field: 'typo', no_rebuild: true }]);
    v += 1;
    const ph = (await db.query('select photo_hero, photo_order from public.properties where id = $1', [pid])).rows[0];
    check('photo_hero and order saved', [ph.photo_hero, ph.photo_order], ['a.jpg', ['a.jpg', 'b.jpg']]);
    check('no_rebuild saved true', (await db.query(`select no_rebuild from public.changes where property_id = $1 and field = 'typo'`, [pid])).rows[0].no_rebuild, true);
    await sj('matt', 'properties', pid, v, { details_doc: { file: 'Details.docx', found: ['price'] } }, []);
    v += 1;
    check('details_doc saved', (await db.query('select details_doc from public.properties where id = $1', [pid])).rows[0].details_doc, { file: 'Details.docx', found: ['price'] });

    check('bad key slug', await sjErr('matt', 'properties', pid, v, { slug: 'x' }, []), 'bad key slug');
    check('bad key on a pitch', await sjErr('matt', 'pitches', pitchId, 1, { outcome: 'won' }, []), 'bad key outcome');
    check('bad table', await sjErr('matt', 'members', pid, v, { role: 'owner' }, []), 'bad table');
    check('bad key left the row alone', await ver('properties', pid), v);

    // stage: only Archived, and back to Asana's own stage
    check('Live from Prep refused', (await sjErr('matt', 'properties', pid, v, { stage: 'Live' }, [])) !== null, true);
    check('refused stage left the version', await ver('properties', pid), v);
    await sj('matt', 'properties', pid, v, { stage: 'Archived' }, [{ field: 'stage', old_value: 'Prep', new_value: 'Archived' }]);
    v += 1;
    let st = (await db.query('select stage, stage_source from public.properties where id = $1', [pid])).rows[0];
    check('archived by Matt', [st.stage, st.stage_source], ['Archived', 'Matt']);
    check('only the snapshot stage on the way back', (await sjErr('matt', 'properties', pid, v, { stage: 'Sold' }, [])) !== null, true);
    await sj('matt', 'properties', pid, v, { stage: 'Live' }, []);
    v += 1;
    st = (await db.query('select stage, stage_source from public.properties where id = $1', [pid])).rows[0];
    check('unarchived to the Asana stage', [st.stage, st.stage_source], ['Live', 'Asana']);
    // final review 6: a stale stage save is a conflict (the page reloads), not a bad stage
    check('stale stage save raises conflict', [await sjErr('matt', 'properties', pid, v - 1, { stage: 'Live' }, []), await sjErr('matt', 'properties', pid, v - 1, { stage: 'Sold' }, [])], ['conflict', 'conflict']);
    check('a current-version bad stage is still a bad stage', await sjErr('matt', 'properties', pid, v, { stage: 'Sold' }, []), 'bad stage Sold');
    const pid2 = (await db.query(`insert into public.properties (slug, label, core, stage) values ('500-example-st', '500 Example St', '{}', 'Archived') returning id`)).rows[0].id;
    check('no snapshot: back goes to Prep only', [(await sjErr('matt', 'properties', pid2, 1, { stage: 'Live' }, [])) !== null,
      (await sj('matt', 'properties', pid2, 1, { stage: 'Prep' }, [])).rows[0].r.stage], [true, 'Prep']);

    // pitches and development projects
    check('pitch core saved', (await sj('matt', 'pitches', pitchId, 1, { core: { agentIds: ['a'] } }, [{ field: 'agents' }])).rows[0].r.core, { agentIds: ['a'] });
    check('pitch change row has its owner', await count('pitch_id = $1 and field = $2', pitchId, 'agents'), 1);
    const devId = (await db.query(`select id from public.dev_projects where slug = 'example-tower'`)).rows[0].id;
    const dv = await ver('dev_projects', devId);
    check('dev milestones saved', (await sj('matt', 'dev_projects', devId, dv, { milestones: { renders: { done: true } } }, [{ field: 'renders', new_value: true }])).rows[0].r.milestones, { renders: { done: true } });
    check('dev change row has its owner', await count('dev_project_id = $1 and field = $2', devId, 'renders'), 1);

    // an empty set: only change rows, no version check, row returned as it is
    const e1 = (await sj('matt', 'properties', pid, 1, {}, [{ field: 'floorplan', new_value: 'v2' }, { note: 'called the agent' }])).rows[0].r;
    check('empty set ignores a stale version and changes nothing', [e1.version, await ver('properties', pid)], [v, v]);
    check('empty set still logs both rows', await count('property_id = $1 and (field = $2 or note = $3)', pid, 'floorplan', 'called the agent'), 2);

    // roles: team (role 'team' and the old 'shared' account) may only add notes
    for (const who of ['teamrole', 'team']) {
      const n0 = await count('property_id = $1', pid);
      check(who + ': fact change refused', await sjErr(who, 'properties', pid, v, { core: { price: 9 } }, [{ field: 'price', new_value: 9 }]), 'not allowed');
      check(who + ': stage refused', await sjErr(who, 'properties', pid, v, { stage: 'Archived' }, []), 'not allowed');
      check(who + ': empty set with a field refused', await sjErr(who, 'properties', pid, v, {}, [{ field: 'price' }]), 'not allowed');
      check(who + ': a field row hidden behind a note refused as a whole', await sjErr(who, 'properties', pid, v, {}, [{ note: 'x' }, { field: 'price' }]), 'not allowed');
      // final review 5: a teammate's row is a note and nothing else
      for (const [what, rows] of [['no note', [{ asked_by: 'x' }]], ['empty note', [{ note: '' }]], ['not an object', ['a note']], ['a number', [5]],
        ['a null field', [{ note: 'x', field: null }]], ['old_value', [{ note: 'x', old_value: 1 }]], ['new_value', [{ note: 'x', new_value: 2 }]],
        ['no_rebuild', [{ note: 'x', no_rebuild: true }]]])
        check(who + ': note rows only, refused: ' + what, await sjErr(who, 'properties', pid, v, {}, rows), 'not allowed');
      check(who + ': refusals wrote nothing', [await count('property_id = $1', pid), await ver('properties', pid)], [n0, v]);
      check(who + ': note with a stale version ok', await sjErr(who, 'properties', pid, 1, {}, [{ note: 'x' }]), null);
      check(who + ': note row written in their name', (await db.query(`select source, user_id from public.changes where property_id = $1 and note = 'x' and user_id = $2`, [pid, id[who]])).rows, [{ source: 'Matt', user_id: id[who] }]);
    }
    check('helper may not save facts', await sjErr('helper', 'properties', pid, v, { core: { price: 9 } }, []), 'not allowed');

    // strangers and anon get nothing
    const n1 = await count('property_id = $1', pid);
    check('stranger refused', await sjErr('stranger', 'properties', pid, v, {}, [{ note: 'x' }]), 'not allowed');
    check('stranger fact refused', await sjErr('stranger', 'properties', pid, v, { core: { price: 9 } }, []), 'not allowed');
    check('stranger changed nothing', [await count('property_id = $1', pid), await ver('properties', pid)], [n1, v]);
    check('anon changed nothing', [await fails('anon', `select public.save_job('properties', $1, $2, '{}', '[{"note":"x"}]')`, [pid, v]), await count('property_id = $1', pid)], [true, n1]);
    // a switched-off member is a stranger
    await db.query(`update public.members set active = false where role = 'team'`);
    check('inactive member refused', await sjErr('teamrole', 'properties', pid, v, {}, [{ note: 'y' }]), 'not allowed');
    await db.query(`update public.members set active = true where role = 'team'`);
  }

  /* ---------- 0009: documents record a build, save_piece, the typo rule ---------- */
  if (UPTO >= '0009') {
    const sp = (who, pid, tool, ver, st, bf, out, arch) => as(who, 'select public.save_piece($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb) r',
      [pid, tool, ver, JSON.stringify(st), bf == null ? null : JSON.stringify(bf), out == null ? null : JSON.stringify(out), arch == null ? null : JSON.stringify(arch)]);
    const spErr = async (...a) => { try { await sp(...a); return null; } catch (e) { return e.message; } };
    const doc = async (pid, tool) => (await db.query('select * from public.documents where property_id = $1 and tool = $2', [pid, tool || 'showsheet'])).rows[0];
    // jsonb keeps its own key order: compare objects with their keys sorted
    const canon = x => JSON.parse(JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((o, kk) => { o[kk] = v[kk]; return o; }, {}) : v));
    const pieceRows = async pid => (await db.query(`select field, new_value, note, source from public.changes where property_id = $1 and field like 'piece:%' order by at`, [pid])).rows;

    const dcols = (await db.query(`select column_name, data_type from information_schema.columns where table_name = 'documents' order by 1`)).rows;
    const has = n => (dcols.find(c => c.column_name === n) || {}).data_type || null;
    check('documents gain the record columns', ['built_from', 'output', 'outputs', 'built_at', 'built_by'].map(has),
      ['jsonb', 'jsonb', 'jsonb', 'timestamp with time zone', 'uuid']);
    check('anon cannot run save_piece', await fails('anon', `select public.save_piece($1, 'showsheet', null, '{}', null, null, null)`, [prop]), true);

    // the old library's showsheet row is there: inserting again is a conflict, saving over its version works
    const d0 = await doc(prop);
    check('old row has no outputs yet', [d0.outputs, d0.built_from], [[], null]);
    check('insert over an existing row is a conflict', await spErr('matt', prop, 'showsheet', null, { a: 1 }, null, null, null), 'conflict');
    check('stale version is a conflict', await spErr('matt', prop, 'showsheet', d0.version + 5, { a: 1 }, null, null, null), 'conflict');
    const draft = (await sp('matt', prop, 'showsheet', d0.version, { a: 1 }, null, null, null)).rows[0].r;
    check('draft save replaces state, bumps version', [draft.state, draft.version, draft.built_from, draft.outputs], [{ a: 1 }, d0.version + 1, null, []]);
    check('draft adds no change row', await pieceRows(prop), []);

    const BF = { v: 1, market: 'NYC', facts: { price: 2250000, beds: 3 }, agents: ['a'] };
    const OUT1 = { path: 'Marketing/Showsheet/Showsheet - 100 Example St 4A - 2026-10-22.pdf', name: 'Showsheet - 100 Example St 4A - 2026-10-22.pdf', size: 1000, via: 'helper' };
    check('built_from without output refused', await spErr('matt', prop, 'showsheet', draft.version, { a: 2 }, BF, null, null), 'bad build');
    check('output without built_from refused', await spErr('matt', prop, 'showsheet', draft.version, { a: 2 }, null, OUT1, null), 'bad build');
    const b1 = (await sp('matt', prop, 'showsheet', draft.version, { a: 2 }, BF, OUT1, null)).rows[0].r;
    check('build records built_from, output, who and when', canon([b1.built_from, b1.output, b1.built_by, !!b1.built_at, b1.outputs.length]), canon([BF, OUT1, id.matt, true, 1]));
    check('build adds one change row', await pieceRows(prop), [{ field: 'piece:showsheet', new_value: OUT1.name, note: 'Showsheet made', source: 'Matt' }]);
    const OUT2 = Object.assign({}, OUT1, { path: OUT1.path.replace('.pdf', ' (2).pdf'), name: OUT1.name.replace('.pdf', ' (2).pdf') });
    const b2 = (await sp('matt', prop, 'showsheet', b1.version, { a: 3 }, BF, OUT2, { from: OUT1.path, to: 'Marketing/Showsheet/Archive/' + OUT1.name })).rows[0].r;
    check('second build: newest first, the move kept on the older one', canon([b2.outputs.length, b2.outputs[0].name, b2.outputs[1].name, b2.outputs[1].archived, b2.outputs[0].archived]),
      canon([2, OUT2.name, OUT1.name, { from: OUT1.path, to: 'Marketing/Showsheet/Archive/' + OUT1.name }, null]));
    check('two builds, two change rows', (await pieceRows(prop)).length, 2);
    // an old tool's direct save of the same sheet now moves its version, so save_piece sees it
    const b2v = (await doc(prop)).version;
    await as('matt', `update public.documents set state = '{"from":"old tool"}' where property_id = $1 and tool = 'showsheet'`, [prop]);
    check("an old tool's save bumps the version", (await doc(prop)).version, b2v + 1);
    check('save_piece over it with the older version is a conflict', await spErr('matt', prop, 'showsheet', b2v, { a: 4 }, null, null, null), 'conflict');
    check("…and the old tool's save is kept", (await doc(prop)).state, { from: 'old tool' });
    await as('matt', `update public.documents set saved_at = now() where property_id = $1 and tool = 'showsheet'`, [prop]);
    check('a save that changes no state keeps the version', (await doc(prop)).version, b2v + 1);
    const vNow = (await doc(prop)).version;
    await sp('matt', prop, 'showsheet', vNow, { a: 5 }, BF, Object.assign({}, OUT2, { name: 'third.pdf' }), null);
    check('a build moves the version by exactly one', (await doc(prop)).version, vNow + 1);

    // a property with no showsheet yet: null version inserts
    const np = (await db.query(`insert into public.properties (slug, label, core) values ('900-example-st', '900 Example St', '{}') returning id`)).rows[0].id;
    const ins = (await sp('matt', np, 'showsheet', null, { b: 1 }, null, null, null)).rows[0].r;
    check('null version inserts', [ins.state, ins.version], [{ b: 1 }, 1]);
    check('a new piece name is allowed', (await sp('matt', np, 'postcard', null, {}, null, null, null)).rows[0].r.tool, 'postcard');
    check('junk piece names refused', await fails('matt', `insert into public.documents (property_id, tool) values ($1, 'Bad Tool!')`, [np]), true);
    check('one-letter piece name refused', await fails('matt', `insert into public.documents (property_id, tool) values ($1, 'x')`, [np]), true);

    // only the owner (D87)
    const before = await doc(np);
    for (const who of ['teamrole', 'team', 'helper', 'stranger']) {
      check(who + ': save_piece not allowed', await spErr(who, np, 'showsheet', before.version, { c: 1 }, null, null, null), 'not allowed');
    }
    check('refused saves changed nothing', (await doc(np)).state, { b: 1 });

    // the typo rule: save_job with no_rebuild writes the new value into built_from
    const sj = (who, rid, ver, set, chg) => as(who, 'select public.save_job($1, $2, $3, $4::jsonb, $5::jsonb) r',
      ['properties', rid, ver, JSON.stringify(set), JSON.stringify(chg)]);
    const pv = async x => (await db.query('select version from public.properties where id = $1', [x])).rows[0].version;
    await sj('matt', prop, await pv(prop), { core: { price: 2100000 } }, [{ field: 'price', old_value: 2250000, new_value: 2100000, no_rebuild: true }]);
    check('typo tick updates that fact in built_from only', canon((await doc(prop)).built_from.facts), canon({ price: 2100000, beds: 3 }));
    await sj('matt', prop, await pv(prop), { core: { beds: 4 } }, [{ field: 'beds', old_value: 3, new_value: 4 }]);
    check('a real change leaves built_from alone', (await doc(prop)).built_from.facts.beds, 3);
    await sj('matt', prop, await pv(prop), { core: { sqft: 900 } }, [{ field: 'sqft', new_value: 900, no_rebuild: true }]);
    check('a fact the sheet did not print adds nothing', Object.keys((await doc(prop)).built_from.facts).sort(), ['beds', 'price']);
    check('a draft with no built_from is untouched by the typo rule', (await doc(np)).built_from, null);
    const vTypo = (await doc(prop)).version;
    await sj('matt', prop, await pv(prop), { core: { price: 2000000 } }, [{ field: 'price', new_value: 2000000, no_rebuild: true }]);
    check("the typo rule does not move the sheet's version", (await doc(prop)).version, vTypo);
    await db.query(`update public.members set active = false where role = 'owner'`);
    check('an inactive owner may not save a piece', await spErr('matt', np, 'showsheet', (await doc(np)).version, { d: 1 }, null, null, null), 'not allowed');
    await db.query(`update public.members set active = true where role = 'owner'`);
  }

  /* ---------- the switch: the shared account stops ---------- */
  await db.query(`update public.members set active = false where role = 'shared'`);
  check('shared account switched off', (await as('team', 'select count(*)::int n from public.properties')).rows[0].n, 0);
  check('matt unaffected', (await as('matt', 'select count(*)::int n from public.properties')).rows[0].n, UPTO >= '0009' ? 6 : UPTO >= '0007' ? 5 : 3);

  /* ---------- run before the accounts exist: refuse rather than lock everyone out ---------- */
  if (fresh.length) {
    const db2 = new PGlite();
    await db2.exec(STUBS);
    for (const f of old) await db2.exec(fs.readFileSync(path.join(DIR, f), 'utf8'));
    let err = null;
    try { await db2.exec(fs.readFileSync(path.join(DIR, fresh[0]), 'utf8')); } catch (e) { err = e.message; }
    check('0004 refuses when no account is a member yet', /create the accounts first/i.test(err || ''), true);
    check('nothing changed: old rules still open to the team', (await db2.query(`select count(*)::int n from pg_policies where policyname = 'team reads properties'`)).rows[0].n, 1);
  }

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed (migrations ' + old.concat(fresh).map(f => f.slice(0, 4)).join(', ') + ')');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
