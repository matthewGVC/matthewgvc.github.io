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

  for (let round = 0; round < 2; round++) {
    for (const f of fresh) {
      try { await db.exec(fs.readFileSync(path.join(DIR, f), 'utf8')); }
      catch (e) { failures.push('apply ' + f + ' (round ' + (round + 1) + '): ' + e.message); }
    }
  }

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
  check('tables', tables, ['changes', 'de_listings', 'dev_projects', 'developments', 'documents', 'floorplans', 'members', 'photos', 'pitches', 'properties', 'sync_runs', 'todos']);
  const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'properties' order by 1`)).rows.map(r => r.column_name);
  check('properties columns', ['kind', 'market', 'stage', 'stage_source', 'units', 'extras', 'de_listing_id', 'de_status', 'de', 'mls_id',
    'drive_folder', 'folder_state', 'scan', 'photo_hero', 'photo_order', 'version', 'updated_by', 'from_pitch_id'].filter(c => cols.indexOf(c) === -1), []);
  const members = (await db.query('select role from public.members order by role')).rows.map(r => r.role);
  check('members from existing accounts only', members, ['helper', 'owner', 'shared']);

  /* ---------- existing data survives ---------- */
  const p = (await db.query('select core, kind, folder_state, version, status from public.properties where id = $1', [prop])).rows[0] || {};
  check('old property kept', [p.core && p.core.address, p.kind, p.folder_state, p.status], ['100 Example St', 'sale', 'unlinked', 'active']);
  check('old document kept', (await db.query('select count(*)::int n from public.documents')).rows[0].n, 1);

  /* ---------- rules ---------- */
  check('matt reads', (await as('matt', 'select count(*)::int n from public.properties')).rows[0].n, 1);
  check('helper reads', (await as('helper', 'select count(*)::int n from public.properties')).rows[0].n, 1);
  check('shared account still works', (await as('team', 'select count(*)::int n from public.todos')).rows[0].n, 1);
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
  check('saving a piece bumps the property', (await db.query('select version from public.properties where id = $1', [prop])).rows[0].version, 3);
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

  /* ---------- the switch: the shared account stops ---------- */
  await db.query(`update public.members set active = false where role = 'shared'`);
  check('shared account switched off', (await as('team', 'select count(*)::int n from public.properties')).rows[0].n, 0);
  check('matt unaffected', (await as('matt', 'select count(*)::int n from public.properties')).rows[0].n, 1);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed (migrations ' + old.concat(fresh).map(f => f.slice(0, 4)).join(', ') + ')');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
