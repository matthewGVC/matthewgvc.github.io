/* ============================================================
   Tests for the Asana sync's reader, link plan and writer
   (helper/asana/read.js, link.js, apply.js, helper/asana-sync.js), on the
   made-up Asana in helper/fixtures/synthetic/asana/ and an in-memory
   database (never the real Asana or the real Supabase).

   Plain Node:  node scripts/test-asana-sync.js
   ============================================================ */
'use strict';

// never this computer's own helper settings
process.env.GVC_HELPER_HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gvc-asana-sync-'));
const fs = require('fs'), path = require('path'), os = require('os');
const { createAsana } = require('../helper/asana/client.js');
const { readRun } = require('../helper/asana/read.js');
const { makePlan, writePlanFiles, readPlanFile } = require('../helper/asana/link.js');
const { applyRun } = require('../helper/asana/apply.js');
const { replayFetch } = require('../helper/asana/replay.js');
const { syncNow, dryRun } = require('../helper/asana-sync.js');
const { ConflictError } = require('../helper/supabase.js');
const MAP = require('../assets/js/asana-map.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* ---------- an in-memory database with the helper client's shape ---------- */
const TABLES = ['properties', 'pitches', 'dev_projects', 'changes', 'sync_runs', 'asana_tasks', 'asana_people', 'de_listings'];
function fakeDb(seed) {
  const T = {};
  TABLES.forEach(t => { T[t] = []; });
  Object.keys(seed || {}).forEach(k => { T[k] = seed[k].map(r => Object.assign(k === 'asana_tasks' || k === 'asana_people' ? {} : { version: 1 }, r)); });
  let n = 0;
  const matches = (row, m) => Object.keys(m || {}).every(k => String(row[k]) === String(m[k]));
  const copy = x => JSON.parse(JSON.stringify(x));
  const db = {
    T, conflictOn: null,
    ready: () => true,
    select: async (t, m) => T[t].filter(r => matches(r, m)).map(copy),
    insert: async (t, rows) => [].concat(rows).map(r => {
      const x = Object.assign({ id: t + '-' + (++n) }, TABLES.indexOf(t) < 3 ? { version: 1 } : {}, copy(r)); T[t].push(x); return copy(x);
    }),
    upsert: async (t, rows, key) => {
      // like PostgREST: one batch may not name the same row twice
      const keys = [].concat(rows).map(r => r[key]);
      if (new Set(keys).size !== keys.length) throw new Error('ON CONFLICT DO UPDATE command cannot affect row a second time');
      return db.upsertOne(t, rows, key);
    },
    upsertOne: async (t, rows, key) => [].concat(rows).map(r => {
      const hit = T[t].find(x => x[key] === r[key]);
      if (hit) return copy(Object.assign(hit, copy(r)));
      const x = copy(r); T[t].push(x); return copy(x);
    }),
    update: async (t, m, patch, o) => {
      if (db.conflictOn && m.id === db.conflictOn) throw new ConflictError(t);
      const hits = T[t].filter(r => matches(r, m) && (!o || o.version === undefined || r.version === o.version));
      if (o && o.version !== undefined && !hits.length) throw new ConflictError(t);
      hits.forEach(r => { Object.assign(r, copy(patch)); if (r.version !== undefined) r.version++; });
      return hits.map(copy);
    }
  };
  return db;
}

/* ---------- the made-up Asana, cloned per test so each can change it ---------- */
const FIX = path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic', 'asana');
const NYC = '1209188026968555', NJ = '1209188026968552', DEV = '1210736852899934', PEOPLE = '1209434796793215';
const fx = f => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));
const cfg = { asanaToken: 'tok-test-secret', asana: require('../helper/config.js').DEFAULTS.asana };
const NOW = new Date('2026-10-20T12:00:00Z');
const LATER = '2026-10-20T13:00:00.000Z';

function setField(raw, name, v) {
  let cf = raw.custom_fields.find(c => c.name === name);
  if (!cf) { cf = { gid: 'f-' + name, name, display_value: null, number_value: null, date_value: null, enum_value: null, multi_enum_values: null }; raw.custom_fields.push(cf); }
  Object.assign(cf, { display_value: null, number_value: null, date_value: null, enum_value: null, multi_enum_values: null }, v);
}
const status = (raw, s, section) => {
  setField(raw, 'Listing Status', { enum_value: { name: s }, display_value: s });
  raw.memberships[0].section.name = section || s;
  raw.modified_at = LATER;
};
function clone(raw, gid, name, extra) {
  const x = JSON.parse(JSON.stringify(raw));
  x.gid = gid; x.name = name;
  return Object.assign(x, extra || {});
}

function world() {
  const tasks = { [NYC]: fx('tasks-' + NYC + '.json').data, [NJ]: fx('tasks-' + NJ + '.json').data };
  const nj = tasks[NJ], ny = tasks[NYC];
  // a pitch: a List-Side Lead with a 🗓️ Pitch date in 2026
  const pitch = clone(nj[0], '9000000000901', '40 Pitch Rd, Exampleton');
  setField(pitch, '🗓️ Pitch', { date_value: { date: '2026-09-10' } });
  nj.push(pitch);
  // a Tenant deal, never a job
  const tenant = clone(ny.find(t => t.gid === '9000000000041'), '9000000000902', '50 Tenant Ave - 1A');
  setField(tenant, 'Deal Side', { enum_value: { name: 'Tenant' }, display_value: 'Tenant' });
  ny.push(tenant);
  // section and status disagree on one task (M14 needs both)
  ny.find(t => t.gid === '9000000000023').memberships[0].section.name = 'Active';
  // the land row has a Closing date (D65)
  setField(nj.find(t => t.gid === '9000000000211'), '🗓️ Closing Date', { date_value: { date: '2026-06-30' } });
  return {
    tasks,
    projects: { [DEV]: { gid: DEV, name: '🚧 30 Lot Rd' } },
    subtasks: { '9000000000041': [
      { gid: 's1', name: 'Create Show Sheet', completed: true, completed_at: '2026-09-20T15:00:00.000Z', due_on: null, assignee: { name: 'Agent B' }, parent: { gid: '9000000000041' }, notes: 'SECRET subtask notes' },
      { gid: 's2', name: 'Order Photos', completed: false, completed_at: null, due_on: '2026-10-30', assignee: null, parent: { gid: '9000000000041' } }] },
    stories: { '9000000000041': fx('stories-sample.json').data }
  };
}
const find = (w, gid) => [].concat(...Object.values(w.tasks)).find(t => t.gid === gid);
const asanaOf = (w, extra) => createAsana(cfg, { fetch: replayFetch(FIX, Object.assign({}, w, extra || {})) });
const read = (w, opts) => readRun(Object.assign({ asana: asanaOf(w), cfg, full: true, since: null }, opts || {}));
async function existingOf(db) {
  return { properties: await db.select('properties'), pitches: await db.select('pitches'), devs: await db.select('dev_projects') };
}
const forbidden = ['SECRET', 'Pat Madeup', 'Past client', '41250', '2175000', 'Contract Price', 'GCI', 'Client said', 'Source of Business',
  '555-01', 'a@example.com', '1990-01-02', '1988-05-06', 'buyer wire', 'tok-test-secret'];
const STARTER = { id: 'starter1', slug: '3-sample-ave-4c', label: '3 Sample Ave 4C', stage: 'Live', kind: 'sale', core: { address: '3 Sample Ave', unit: '4C' } };
const DEVROW = { id: 'dev1', slug: '30-lot-rd', label: '30 Lot Rd', market: 'NJ', milestones: {} };

(async () => {
  /* ================= the first link plan (S5, D54) ================= */
  let db = fakeDb({ properties: [STARTER], dev_projects: [DEVROW] });
  let w = world();
  const run1 = await read(w);
  check('read ok', [run1.ok, run1.full], [true, true]);
  check('read: listing tasks of every listing project', run1.listings.length, 22);
  check('read: each listing knows its market', [run1.listings.find(t => t.gid === '9000000000041').market, run1.listings.find(t => t.gid === '9000000000178').market], ['NYC', 'NJ']);
  check('read: subtasks and history for changed tasks', [run1.listings.find(t => t.gid === '9000000000041').subtasks.length,
    run1.listings.find(t => t.gid === '9000000000041').history.map(h => h.type)], [2, ['section', 'status', 'due', 'complete']]);
  const devRead = run1.devs.find(d => d.project.gid === DEV) || { project: {}, tasks: [] };
  check('read: every configured development project, with its tasks', [run1.devs.length, devRead.project.name, devRead.tasks.length], [4, '🚧 30 Lot Rd', 14]);
  check('read: no linked development, no loose tasks kept', run1.loose, []);
  check('read: no missing kept fields on a clean full read', Array.isArray(run1.missing), true);

  const plan = makePlan(run1, await existingOf(db));
  const row = gid => plan.rows.find(r => r.gid === gid);
  const ticked = gid => (row(gid) || {}).tick;
  check('plan: Prep, Live, Accepted offer, In contract are ticked',
    ['9000000000023', '9000000000041', '9000000000054', '9000000000068', '9000000000178', '9000000000189', '9000000000121', '9000000000142'].map(ticked),
    [true, true, true, true, true, true, true, true]);
  check('plan: Sold and Off market come unticked', ['9000000000079', '9000000000090', '9000000000200', '9000000000100', '9000000000110'].map(ticked), [false, false, false, false, false]);
  check('plan: Buy-Side, Tenant, Leads without a pitch date and the 2025 Graveyard import are absent',
    ['9000000000131', '9000000000902', '9000000000010', '9000000000163', '9000000000221', '9000000000211', '9000000000231', '9000000000152'].map(g => !!row(g)),
    [false, false, false, false, false, false, false, false]);
  check('plan: a 2026 pitch is ticked as a pitch', [row('9000000000901') && row('9000000000901').kind, ticked('9000000000901'), row('9000000000901') && row('9000000000901').stage], ['pitch', true, 'Pitch']);
  check('plan: the starter job at the same address is matched', row('9000000000041').match, { propertyId: 'starter1' });
  check('plan: a row says why', typeof row('9000000000023').why, 'string');
  check('plan: the 🚧 project is matched to its development by name', [row(DEV) && row(DEV).kind, row(DEV) && row(DEV).match, ticked(DEV)], ['dev', { devId: 'dev1' }, true]);

  /* the plan as files: Matt unticks a line in the .md and that wins */
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-plan-'));
  const files = writePlanFiles(plan, outDir, '2026-10-20');
  check('plan files written', [path.basename(files.md), path.basename(files.json)], ['asana-link-plan-2026-10-20.md', 'asana-link-plan-2026-10-20.json']);
  let md = fs.readFileSync(files.md, 'utf8');
  check('plan md has a tick box per row', (md.match(/^- \[[ x]\] /gm) || []).length, plan.rows.length);
  check('plan md holds no secrets', forbidden.some(s => md.includes(s)), false);
  fs.writeFileSync(files.md, md.replace(/^- \[x\] (.*`9000000000121`)/m, '- [ ] $1'));
  const reread = readPlanFile(files.md);
  check('plan read back: the unticked line is unticked, the rest kept', [reread.rows.find(r => r.gid === '9000000000121').tick, reread.rows.find(r => r.gid === '9000000000041').tick, reread.rows.length],
    [false, true, plan.rows.length]);

  /* ================= applying the plan ================= */
  let out = await applyRun({ client: db, run: run1, now: NOW, plan });
  const P = gid => db.T.properties.find(p => p.asana_gid === gid);
  check('apply: run logged ok, kind asana', [db.T.sync_runs.length, db.T.sync_runs[0].kind, db.T.sync_runs[0].ok], [1, 'asana', true]);
  check('apply: ticked listings become jobs (starter linked, not duplicated)', [db.T.properties.length, out.created], [8, 8]);
  check('apply: a linked job saved without a market gets the Asana market', P('9000000000041').market, 'NYC');
  check('apply: the starter job gained its Asana link', [P('9000000000041') && P('9000000000041').id, P('9000000000041').stage, P('9000000000041').stage_source], ['starter1', 'Live', 'Asana']);
  const ao = P('9000000000054') || { core: {} };
  check('apply: a new job from Asana', [ao.stage, ao.stage_source, ao.kind, ao.market, ao.core.address, ao.core.unit], ['Accepted offer', 'Asana', 'sale', 'NYC', '4 Sample Ave', '5D']);
  check('apply: facts at Asana\'s rank', [ao.core.price, ao.core.facts && ao.core.facts.price], [880000, { value: 880000, source: 'Asana', bySource: { Asana: 880000 } }]);
  const facts54 = Object.keys(MAP.factsOf(require('../helper/asana/allow.js').keepTask(find(w, '9000000000054'), NYC))).sort();
  const rows54 = db.T.changes.filter(c => c.property_id === ao.id && c.field && facts54.indexOf(c.field) !== -1);
  check('apply: one changes row per fact value, source Asana', [rows54.map(c => c.field).sort(), rows54.every(c => c.source === 'Asana' && c.run_id === db.T.sync_runs[0].id)], [facts54, true]);
  check('apply: deal dates as milestones (planned flagged)', P('9000000000068').milestones.closedOn, { on: '2026-11-30', planned: true });
  check('apply: a rental is a rental', P('9000000000121').kind, 'rental');
  check('apply: an NJ town lands in the city', [P('9000000000178').core.address, P('9000000000178').core.city], ['21 Test Ln', 'Exampleton']);
  const snap = P('9000000000023').asana || {};
  check('apply: the snapshot keeps both the status and the section stage (M14)', [P('9000000000023').stage, snap.status, snap.section, snap.stageFromStatus, snap.stageFromSection], ['Prep', 'In Prep to List', 'Active', 'Prep', 'Live']);
  check('apply: the checklist is in the snapshot, names and ticks only', P('9000000000041').asana.checklist,
    [{ block: 'prep', steps: [{ name: 'Create Show Sheet', done: true, doneOn: '2026-09-20', who: 'Agent B' }, { name: 'Order Photos', done: false, doneOn: null, who: null }] }]);
  check('apply: the pitch is a pitches row', [db.T.pitches.length, db.T.pitches[0] && db.T.pitches[0].asana_gid, db.T.pitches[0] && db.T.pitches[0].outcome, db.T.pitches[0] && db.T.pitches[0].pitched_on, db.T.pitches[0] && db.T.pitches[0].market],
    [1, '9000000000901', 'open', '2026-09-10', 'NJ']);
  const cache = gid => db.T.asana_tasks.find(t => t.gid === gid) || {};
  check('apply: every listing task cached, unticked ones ignored', [cache('9000000000079').ignored, cache('9000000000131').ignored, cache('9000000000041').property_id, cache('9000000000901').pitch_id],
    [true, false, 'starter1', db.T.pitches[0].id]);
  check('apply: the cache keeps the kept history only', cache('9000000000041').history.map(h => h.type), ['section', 'status', 'due', 'complete']);
  check('apply: the dev project linked once', db.T.dev_projects[0].asana_project_gid, DEV);
  check('apply: dev tasks cached with their batch day', [db.T.asana_tasks.filter(t => t.kind === 'dev').length, cache('9000000000240').batch_day, cache('9000000000357').batch_day], [14, true, false]);

  /* ---------- duplicate address: never two jobs, the other one listed ---------- */
  check('duplicate address: one job for 12 Dup Street', db.T.properties.filter(p => /^12 Dup/.test(p.core.address)).length, 1);
  check('duplicate address: the long-name task is unlinked, same address', out.unlinked.filter(u => u.gid === '9000000000152').map(u => u.why), ['same address']);

  /* the same run again changes nothing */
  let before = db.T.changes.length;
  await applyRun({ client: db, run: await read(world()), now: NOW });
  check('a second identical full run writes no changes', db.T.changes.length, before);

  /* ================= incremental run ================= */
  w = world();
  status(find(w, '9000000000041'), 'Accepted Offer/Attorney Review');
  const versions = db.T.properties.map(p => [p.id, p.version]);
  const run2 = await read(w, { full: false, since: '2026-10-20T12:30:00.000Z' });
  check('incremental: only the changed task is read', run2.listings.map(t => t.gid), ['9000000000041']);
  before = db.T.changes.length;
  out = await applyRun({ client: db, run: run2, now: NOW });
  const newRows = db.T.changes.slice(before);
  check('incremental: the stage moved', [P('9000000000041').stage, P('9000000000041').asana.status], ['Accepted offer', 'Accepted Offer/Attorney Review']);
  check('incremental: only that job changed', [newRows.length > 0, newRows.every(c => c.property_id === 'starter1'),
    db.T.properties.filter(p => p.id !== 'starter1').every(p => versions.find(v => v[0] === p.id)[1] === p.version)], [true, true, true]);
  const stageRow = newRows.find(c => c.field === 'stage');
  check('incremental: the stage change logged', [stageRow && stageRow.old_value, stageRow && stageRow.new_value, stageRow && stageRow.source], ['Live', 'Accepted offer', 'Asana']);

  /* an unknown Listing Status stops that task only */
  w = world();
  status(find(w, '9000000000054'), 'Something New', 'Accepted Offer/Attorney Review');
  status(find(w, '9000000000068'), 'Pending', 'Fully Executed/Board Package');
  out = await applyRun({ client: db, run: await read(w, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('unknown status: listed, stage kept', [out.errors.some(e => e.what === 'unknown status' && /Something New/.test(e.detail)), P('9000000000054').stage], [true, 'Accepted offer']);
  check('unknown status: the rest of the run goes on', P('9000000000068').stage, 'In contract');

  /* a conflict is logged and skipped, never overwritten */
  w = world();
  status(find(w, '9000000000023'), 'Active');
  db.conflictOn = P('9000000000023').id;
  out = await applyRun({ client: db, run: await read(w, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  db.conflictOn = null;
  check('conflict: skipped and logged', [P('9000000000023').stage, out.errors.some(e => e.what === 'conflict')], ['Prep', true]);

  /* ================= pitches follow Asana (D55) ================= */
  w = world();
  status(find(w, '9000000000901'), 'In Prep to List');
  out = await applyRun({ client: db, run: await read(w, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  const pitch = db.T.pitches[0], won = P('9000000000901') || {};
  check('pitch won: outcome won, listing made and linked', [pitch.outcome, pitch.won_property_id, won.from_pitch_id, won.stage, won.stage_source], ['won', won.id, pitch.id, 'Prep', 'Asana']);
  check('pitch won: logged on the pitch', db.T.changes.some(c => c.pitch_id === pitch.id && c.field === 'outcome' && c.new_value === 'won' && c.source === 'Asana'), true);

  let db2 = fakeDb({ dev_projects: [DEVROW] });
  const w2 = world();
  await applyRun({ client: db2, run: await read(w2), now: NOW, plan: makePlan(await read(w2), await existingOf(db2)) });
  status(find(w2, '9000000000901'), 'Graveyard');
  await applyRun({ client: db2, run: await read(w2, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('pitch not won: Graveyard while a pitch', [db2.T.pitches[0].outcome, db2.T.properties.some(p => p.asana_gid === '9000000000901')], ['not won', false]);

  /* the plan was made, then the task moved: its stage now decides pitch or listing */
  const db8 = fakeDb(), w8 = world();
  const plan8 = makePlan(await read(w8), await existingOf(db8));
  status(find(w8, '9000000000901'), 'In Prep to List');   // the ticked pitch is now in prep
  status(find(w8, '9000000000023'), 'Lead', 'Leads');     // a ticked listing went back to a lead
  await applyRun({ client: db8, run: await read(w8), now: NOW, plan: plan8 });
  check('plan made before a move: the pitch became a listing, the lead nothing',
    [db8.T.properties.some(p => p.asana_gid === '9000000000901'), db8.T.pitches.length, db8.T.properties.some(p => p.asana_gid === '9000000000023')], [true, 0, false]);

  /* ================= new tasks after the plan ================= */
  w = world();
  const ny = w.tasks[NYC], base = ny.find(t => t.gid === '9000000000023');
  const fresh = clone(base, '9000000000903', '60 New Pl - 1B', { modified_at: LATER });
  const closed = clone(base, '9000000000904', '61 Done Pl - 2C', { modified_at: LATER });
  status(closed, 'Complete');
  ny.push(fresh, closed);
  out = await applyRun({ client: db, run: await read(w, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('new task after plan: In Prep to List becomes a job', [!!P('9000000000903'), P('9000000000903') && P('9000000000903').stage], [true, 'Prep']);
  check('new task after plan: one first seen Complete never does', [!!P('9000000000904'), cache('9000000000904').gid], [false, '9000000000904']);

  /* ================= absence is not deletion ================= */
  w = world();
  w.tasks[NYC] = w.tasks[NYC].filter(t => t.gid !== '9000000000068');
  const goneId = P('9000000000068').id;
  out = await applyRun({ client: db, run: await read(w), now: NOW });
  const gone = db.T.properties.find(p => p.id === goneId);
  check('absence: the job is kept, stage and all', [!!gone, gone.stage], [true, 'In contract']);
  check('absence: Match says the task is gone', ((gone.match || {}).list || []).filter(m => m.code === 'M2').map(m => m.text), ['Asana task gone.']);
  check('match: found is logged (S14)', db.T.changes.filter(c => c.property_id === goneId && c.source === 'match').map(c => c.note).filter(n => /gone/.test(n)), ['Mismatch found: Asana task gone.']);
  check('match: every staged job has a stored result', db.T.properties.filter(p => p.stage).every(p => p.match && Array.isArray(p.match.list) && typeof p.match.dismissed === 'object'), true);
  check('match: the snapshot keeps the status date for M1', 'statusSince' in gone.asana, true);
  gone.match.dismissed = { M3: { values: { asana: 1, de: 2 }, reason: 'test', at: '2026-10-20' } };
  /* and it comes back */
  out = await applyRun({ client: db, run: await read(world()), now: NOW });
  const back = db.T.properties.find(p => p.id === goneId);
  check('absence: back again, the mismatch clears', ((back.match || {}).list || []).filter(m => m.code === 'M2').length, 0);
  check('match: cleared is logged', db.T.changes.filter(c => c.property_id === goneId && c.source === 'match').map(c => c.note).filter(n => /gone/.test(n)).pop(), 'Mismatch cleared: Asana task gone.');
  check('match: dismissals are kept by the writer', back.match.dismissed.M3 && back.match.dismissed.M3.reason, 'test');
  const nChanges = db.T.changes.length;
  await applyRun({ client: db, run: await read(world()), now: NOW });
  check('match: an unchanged run logs nothing', db.T.changes.length, nChanges);

  /* ================= development hints from the land row (D65) ================= */
  let db3 = fakeDb({ dev_projects: [Object.assign({}, DEVROW, { asana_project_gid: DEV })], asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }] });
  await applyRun({ client: db3, run: await read(world()), now: NOW });
  const hints = db3.T.dev_projects[0].milestone_hints || [];
  check('land row: Land closed suggested with its Closing date', hints.filter(h => h.key === 'landClosed').map(h => [h.date, h.rule, h.asanaGid]), [['2026-06-30', 'land', '9000000000211']]);
  check('land row: never a job', db3.T.properties.some(p => /30 Lot/.test(p.core.address)), false);
  check('land row: the dev\'s next milestone stored', 'next_milestone' in db3.T.dev_projects[0], true);
  check('land row: the dev Match result stored', Array.isArray((db3.T.dev_projects[0].match || {}).list), true);
  check('land row: the hint is logged on the development', db3.T.changes.some(c => c.dev_project_id === 'dev1' && c.source === 'Asana'), true);
  // a hint Matt turned down on the job page (asana_map.dismissed) stays down
  let db3b = fakeDb({ dev_projects: [Object.assign({}, DEVROW, { asana_project_gid: DEV, asana_map: { dismissed: { landClosed: ['9000000000211'] } } })], asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }] });
  await applyRun({ client: db3b, run: await read(world()), now: NOW });
  check('land row: a dismissed hint is not suggested again', (db3b.T.dev_projects[0].milestone_hints || []).some(h => h.key === 'landClosed'), false);

  /* loose tasks: only those naming a linked development are kept (D65) */
  const wl = world();
  wl.tasks['1211384244337827'] = [clone(fx('tasks-1211384244337827.json').data[0], '9000000000950', 'New Renderings for 30 Lot Rd'),
    clone(fx('tasks-1211384244337827.json').data[0], '9000000000951', 'Unrelated social post')];
  const rl = await read(wl, { looseNames: ['30 lot rd'] });
  check('loose: only the matching task is kept', rl.loose.map(l => l.gid), ['9000000000950']);
  check('loose: kept fields only', Object.keys(rl.loose[0]).sort(), ['assignee', 'completedAt', 'dueOn', 'gid', 'name', 'projectGid']);

  /* ================= stops (plan §8a) ================= */
  let db4 = fakeDb({ properties: [STARTER] });
  out = await syncNow({ cfg, client: db4, fetch: replayFetch(FIX, Object.assign(world(), { status: 401 })), now: NOW });
  check('token refused: only the run row, with the reason', [db4.T.sync_runs.length, db4.T.sync_runs[0].ok, db4.T.sync_runs[0].errors[0].detail], [1, false, 'Asana refused the token']);
  check('token refused: nothing else written', [db4.T.changes.length, db4.T.asana_tasks.length, db4.T.properties[0].version, db4.T.properties[0].stage], [0, 0, 1, 'Live']);

  let db5 = fakeDb({ sync_runs: [{ id: 'r0', kind: 'asana', ok: true, started_at: '2026-10-19T03:00:00.000Z', finished_at: '2026-10-19T03:01:00.000Z', totals: { full: true, open: { NYC: 40, NJ: 8, FL: 0 } } }],
    asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }] });
  out = await syncNow({ cfg, client: db5, fetch: replayFetch(FIX, world()), full: true, now: NOW });
  const r5 = db5.T.sync_runs[1] || {};
  check('abort on drop: aborted', [r5.ok, /fewer than half/.test(JSON.stringify(r5.errors))], [false, true]);
  check('abort on drop: nothing written', [db5.T.properties.length, db5.T.asana_tasks.length, db5.T.changes.length], [0, 1, 0]);

  let db6 = fakeDb();
  out = await syncNow({ cfg, client: db6, fetch: replayFetch(FIX, world()), now: NOW });
  check('no plan yet: the run stops and says how to start', [db6.T.sync_runs[0].ok, /link plan/.test(JSON.stringify(db6.T.sync_runs[0].errors)), db6.T.properties.length], [false, true, 0]);

  let refused = null;
  try { await syncNow({ cfg, fixturesDir: FIX }); } catch (e) { refused = e.message; }
  check('made-up Asana never reaches the real database', /made-up/.test(refused || ''), true);
  refused = null;
  try { await syncNow({ cfg: { asana: cfg.asana }, client: fakeDb(), fetch: replayFetch(FIX, world()) }); } catch (e) { refused = e.message; }
  check('no token, nothing runs', /No Asana token/.test(refused || ''), true);

  /* syncNow on the made-up files: the first run reads everything, the next only what changed */
  const db7 = fakeDb({ asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }] });
  const seen = [];
  const logFetch = f => async (url, init) => { seen.push(String(url)); return f(url, init); };
  await syncNow({ cfg, client: db7, fetch: logFetch(replayFetch(FIX, world())), now: NOW });
  seen.length = 0;
  await syncNow({ cfg, client: db7, fetch: logFetch(replayFetch(FIX, world())), now: new Date('2026-10-20T12:30:00Z') });
  check('syncNow: the next run asks only for changes since the last good run', seen.filter(u => /\/1\.0\/tasks\?/.test(u)).every(u => /modified_since=2026-10-20T12%3A00/.test(u)), true);
  check('syncNow: two runs logged ok', db7.T.sync_runs.map(r => r.ok), [true, true]);
  const both = await Promise.all([1, 2].map(() => syncNow({ cfg, client: db7, fetch: replayFetch(FIX, world()), now: NOW })));
  check('syncNow: two at once run once', both[0] === both[1], true);

  /* ================= People (D71) ================= */
  out = await syncNow({ cfg, client: db, fetch: replayFetch(FIX, world()), kind: 'people', now: NOW });
  check('people: every person kept, fresh', [db.T.asana_people.length, db.T.asana_people.every(p => p.seen_at === NOW.toISOString())], [5, true]);
  check('people: the past member flagged', db.T.asana_people.filter(p => p.past).length, 1);
  check('people: kept keys only', Object.keys(db.T.asana_people[0]).sort(), ['de_bio_url', 'de_profile_url', 'gid', 'name', 'past', 'section', 'seen_at', 'state', 'team', 'title']);
  check('people: run logged as people', db.T.sync_runs[db.T.sync_runs.length - 1].kind, 'people');

  /* ================= nothing outside the allowlist reaches the database ================= */
  const dump = JSON.stringify(db.T) + JSON.stringify(db2.T) + JSON.stringify(db3.T);
  forbidden.forEach(s => check('allowlist: the database never holds ' + s, dump.includes(s), false));

  /* ================= review fixes (round 1) ================= */
  // 1. Asana unreachable: every listing project failing aborts; one failing is not a good run
  let db9 = fakeDb({ asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }] });
  await syncNow({ cfg, client: db9, fetch: replayFetch(FIX, world()), now: NOW });
  const goodStart = db9.T.sync_runs[0].started_at;
  await syncNow({ cfg, client: db9, fetch: async () => { throw new Error('fetch failed'); }, now: new Date('2026-10-20T12:30:00Z') });
  const unreachable = db9.T.sync_runs[1];
  check('unreachable: aborted with a plain reason', [unreachable.ok, /Asana couldn't be reached/.test(JSON.stringify(unreachable.errors))], [false, true]);
  await syncNow({ cfg, client: db9, fetch: replayFetch(FIX, Object.assign(world(), { fail: { [NJ]: 500 } })), full: true, now: new Date('2026-10-20T13:00:00Z') });
  const partial = db9.T.sync_runs[2];
  check('one project failing: the run is not good, the reason is stored', [partial.ok, /NJ listings could not be read/.test(JSON.stringify(partial.errors))], [false, true]);
  const seen9 = [];
  await syncNow({ cfg, client: db9, fetch: async (u, i) => { seen9.push(String(u)); return replayFetch(FIX, world())(u, i); }, now: new Date('2026-10-20T13:30:00Z') });
  check('after a bad run, since stays at the last good run', seen9.filter(u => /\/1\.0\/tasks\?/.test(u)).every(u => u.includes('modified_since=' + encodeURIComponent(goodStart))), true);
  const db10 = fakeDb({ asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }], sync_runs: [
    { id: 'r1', kind: 'asana', ok: true, started_at: '2026-10-18T03:00:00.000Z', finished_at: 'x', totals: { full: true, open: { NYC: 40, NJ: 8 } } },
    { id: 'r2', kind: 'asana', ok: true, started_at: '2026-10-19T03:00:00.000Z', finished_at: 'x', totals: { full: true, open: { NJ: 8 } } }] });
  await syncNow({ cfg, client: db10, fetch: replayFetch(FIX, world()), full: true, now: NOW });
  check('a market missing from the last full run keeps its earlier open count', /fewer than half the open NYC/.test(JSON.stringify(db10.T.sync_runs[2].errors)), true);

  // 2. a task first seen as a Lead becomes a pitch once it has a pitch date
  w = world();
  const lead = find(w, '9000000000163');
  setField(lead, '🗓️ Pitch', { date_value: { date: '2026-10-15' } });
  lead.modified_at = LATER;
  await applyRun({ client: db, run: await read(w, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('a cached Lead later given a pitch date becomes a pitch', db.T.pitches.some(p => p.asana_gid === '9000000000163'), true);
  check('a task first seen closed is remembered as decided', cache('9000000000904').ignored, true);

  // 3. an edit made in a tool (core changed, the facts record not) is Matt's and Asana leaves it
  const tooled = P('9000000000054');
  tooled.core.price = 875000;          // a showsheet save
  await applyRun({ client: db, run: await read(world()), now: NOW });
  check('a tool edit holds over Asana\'s unchanged value', [P('9000000000054').core.price, P('9000000000054').core.facts.price.source, P('9000000000054').core.facts.price.bySource.Asana],
    [875000, 'Matt', 880000]);

  // 4. a won pitch links the free job already at its address instead of making a second one
  const db11 = fakeDb({ dev_projects: [DEVROW] });
  const w11 = world();
  await applyRun({ client: db11, run: await read(w11), now: NOW, plan: makePlan(await read(w11), await existingOf(db11)) });
  db11.T.properties.push({ id: 'free40', slug: '40-pitch-rd', version: 1, stage: null, kind: 'sale', core: { address: '40 Pitch Rd', city: 'Exampleton' } });
  status(find(w11, '9000000000901'), 'In Prep to List');
  await applyRun({ client: db11, run: await read(w11, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  const free40 = db11.T.properties.find(p => p.id === 'free40');
  check('won pitch: links the job at its address', [free40.asana_gid, free40.from_pitch_id, free40.stage, db11.T.properties.filter(p => /^40 Pitch/.test(p.core.address)).length, db11.T.pitches[0].won_property_id],
    ['9000000000901', db11.T.pitches[0].id, 'Prep', 1, 'free40']);

  // 5. one task in two projects: one cache row, one upsert batch without repeats
  const w12 = world();
  w12.tasks[NJ].push(JSON.parse(JSON.stringify(find(w12, '9000000000041'))));
  const r12 = await read(w12);
  check('a task in two projects is read once', r12.listings.filter(t => t.gid === '9000000000041').length, 1);
  const db12 = fakeDb({ asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }] });
  let threw = null;
  try { await applyRun({ client: db12, run: Object.assign({}, r12, { devs: [{ project: { gid: DEV, name: '🚧 x' }, tasks: [r12.listings.find(t => t.gid === '9000000000041')] }] }), now: NOW }); }
  catch (e) { threw = e.message; }
  check('cache rows are unique per batch, the listing row wins', [threw, db12.T.asana_tasks.filter(t => t.gid === '9000000000041').map(t => t.kind)], [null, ['listing']]);

  // 7. a 403 only stops the run on a listing project (or whoami); elsewhere it is a warning
  const r13 = await read(world(), { asana: asanaOf(world(), { fail: { [DEV]: 403 } }) });
  check('403 on a development project: a warning', [r13.ok, r13.warnings.some(x => /development project/.test(x))], [true, true]);
  const r14 = await read(world(), { asana: asanaOf(world(), { fail: { [NYC]: 403 } }) });
  check('403 on a listing project: refused', [r14.ok, r14.aborted], [false, 'Asana refused the token']);

  // 8. a task with no memberships still knows the project it was read from
  const w15 = world();
  delete find(w15, '9000000000023').memberships;
  check('no memberships: project gid from the read', (await read(w15)).listings.find(t => t.gid === '9000000000023').projectGid, NYC);

  /* ================= carried fixes from Task 1 ================= */
  // (a) a listing project that fails to read gives no "missing kept fields" verdict
  const half = await read(world(), { asana: asanaOf(world(), { fail: { [NJ]: 500 } }) });
  check('a project error: no missing-field verdict', [half.missing, half.warnings.some(x => /could not be read/.test(x))], [null, true]);
  const dry = await dryRun({ cfg, fetch: replayFetch(FIX, Object.assign(world(), { fail: { [NJ]: 500 } })), outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-dry-')), date: '2026-10-20' });
  check('dry run: a project error gives no verdict', [dry.missing, /no verdict/.test(fs.readFileSync(dry.reportFile, 'utf8'))], [null, true]);
  // (b) a partial asana object in the user's config keeps the default gids
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-cfg-'));
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ pairCode: '123456', asana: { loose: [], listings: { NYC: '42' } } }));
  process.env.GVC_HELPER_HOME = home;
  const merged = require('../helper/config.js').loadConfig();
  check('config: asana merges one level deep, listings too', [merged.asana.loose, merged.asana.listings.NYC, merged.asana.listings.NJ, merged.asana.people],
    [[], '42', '1209188026968552', '1209434796793215']);

  /* ================= final review fixes ================= */
  const MARK = { gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true };
  const planned = async () => {
    const d = fakeDb({ dev_projects: [DEVROW] }), w0 = world();
    await applyRun({ client: d, run: await read(w0), now: NOW, plan: makePlan(await read(w0), await existingOf(d)) });
    return d;
  };
  const PF = (d, gid) => d.T.properties.find(p => p.asana_gid === gid) || {};

  // F1. the nightly full read refreshes every checklist: a subtask tick doesn't move the parent's modified_at
  const dF1 = await planned();
  const wF1 = world();
  wF1.subtasks['9000000000041'][1] = Object.assign({}, wF1.subtasks['9000000000041'][1], { completed: true, completed_at: '2026-10-20T11:00:00.000Z' });
  const rF1 = await read(wF1, { full: true, since: '2026-10-20T12:30:00.000Z' });
  check('F1 full read: an unmodified task still gets its subtasks', (rF1.listings.find(t => t.gid === '9000000000041').subtasks || []).length, 2);
  await applyRun({ client: dF1, run: rF1, now: NOW });
  check('F1 full read: the ticked subtask reaches the checklist', PF(dF1, '9000000000041').asana.checklist[0].steps.map(x => x.done), [true, true]);
  const dF1b = fakeDb({ asana_tasks: [MARK], sync_runs: [{ id: 'r1', kind: 'asana', ok: true, started_at: '2026-10-20T12:30:00.000Z', finished_at: 'x', totals: { full: true, open: {} } }] });
  const seenF1 = [];
  await syncNow({ cfg, client: dF1b, fetch: async (u, i) => { seenF1.push(String(u)); return replayFetch(FIX, world())(u, i); }, full: true, now: NOW });
  check('F1 syncNow --full after a good run: every task detailed, no modified_since',
    [seenF1.some(u => /\/tasks\/9000000000041\/subtasks/.test(u)), seenF1.some(u => /modified_since/.test(u))], [true, false]);

  // F2. a renamed / removed Listing Status never moves a stage by the section alone
  const dF2 = await planned();
  let wF2 = world();
  const t54 = find(wF2, '9000000000054');
  t54.custom_fields = t54.custom_fields.filter(c => c.name !== 'Listing Status');
  t54.memberships[0].section.name = 'Active';
  t54.modified_at = LATER;
  const oF2 = await applyRun({ client: dF2, run: await read(wF2, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('F2 no Listing Status field on the task: stage kept, noted', [PF(dF2, '9000000000054').stage, oF2.errors.some(e => e.what === 'no status field')], ['Accepted offer', true]);
  wF2 = world();
  setField(find(wF2, '9000000000023'), 'Listing Status', {});      // present but empty: the section decides (D69)
  find(wF2, '9000000000023').memberships[0].section.name = 'Active';
  find(wF2, '9000000000023').modified_at = LATER;
  await applyRun({ client: dF2, run: await read(wF2, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('F2 Listing Status present but empty: the section still moves the stage', PF(dF2, '9000000000023').stage, 'Live');
  wF2 = world();
  status(find(wF2, '9000000000041'), 'In Contract', 'Fully Executed/Board Package');
  const rF2 = await read(wF2);
  rF2.missing = ['Listing Status'];
  await applyRun({ client: dF2, run: rF2, now: NOW });
  check('F2 a run that found Listing Status missing writes no stage', PF(dF2, '9000000000041').stage, 'Live');
  wF2 = world();
  Object.values(wF2.tasks).forEach(list => list.forEach(t => { t.custom_fields = t.custom_fields.filter(c => c.name !== 'Listing Status'); }));
  find(wF2, '9000000000068').memberships[0].section.name = 'Complete';
  const rF2b = await read(wF2);
  await applyRun({ client: dF2, run: rF2b, now: NOW });
  check('F2 the field gone from every task: missing reported, stage kept', [(rF2b.missing || []).indexOf('Listing Status') !== -1, PF(dF2, '9000000000068').stage], [true, 'In contract']);

  // F3. the stored "not linked" list names each task and leaves ignored tasks out
  check('F3 stored unlinked: the ignored Graveyard duplicate is left out', (db.T.sync_runs[0].totals.unlinked || []).some(u => u.gid === '9000000000152'), false);
  check('F3 stored unlinked: always a list on a run that read listings', Array.isArray(db.T.sync_runs[0].totals.unlinked), true);

  // F4. one task's subtasks / history failing is a warning; the run goes on and keeps what it had
  const dF4 = await planned();
  let rF4 = null, threwF4 = null;
  try { rF4 = await read(world(), { asana: asanaOf(world(), { failTask: { '9000000000041': 500 } }) }); } catch (e) { threwF4 = e.message; }
  check('F4 a 5xx on one task: no crash, a warning, the task read without detail',
    [threwF4, rF4 && rF4.ok, rF4 && rF4.warnings.some(x => /9000000000041/.test(x)), rF4 && 'subtasks' in rF4.listings.find(t => t.gid === '9000000000041'), rF4 && rF4.listings.length], [null, true, true, false, 22]);
  if (rF4) {
    await applyRun({ client: dF4, run: rF4, now: NOW });
    check('F4 the checklist known before is kept', PF(dF4, '9000000000041').asana.checklist[0].steps.length, 2);
    check('F4 the run is stored with the warning', dF4.T.sync_runs.slice(-1)[0].errors.some(e => e.what === 'warning' && /9000000000041/.test(e.detail)), true);
  }
  let rF4b = null;
  try { rF4b = await read(world(), { asana: asanaOf(world(), { failTask: { '9000000000041': 404 } }) }); } catch (e) { rF4b = { threw: e.message }; }
  check('F4 a 404 on one task: a warning too', [rF4b.ok, rF4b.threw || null], [true, null]);
  const rF4c = await read(world(), { asana: asanaOf(world(), { failTask: { '9000000000041': 401 } }) });
  check('F4 a 401 on one task still stops the run', [rF4c.ok, rF4c.aborted], [false, 'Asana refused the token']);

  // F6. after the plan, a task with no street number never becomes a job or a pitch by itself
  const dF6 = await planned();
  const wF6 = world(), nyF6 = wF6.tasks[NYC], baseF6 = nyF6.find(t => t.gid === '9000000000023');
  nyF6.push(clone(baseF6, '9000000000905', 'Sample Penthouse', { modified_at: LATER }));
  wF6.tasks[NJ].push(clone(find(wF6, '9000000000901'), '9000000000906', 'Pitch Road Lead', { modified_at: LATER }));
  const oF6 = await applyRun({ client: dF6, run: await read(wF6, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('F6 no street number: no job, no pitch', [dF6.T.properties.some(p => p.asana_gid === '9000000000905'), dF6.T.pitches.some(p => p.asana_gid === '9000000000906')], [false, false]);
  check('F6 no street number: listed as unlinked, with why', oF6.unlinked.filter(u => /^900000000090[56]$/.test(u.gid)).map(u => u.why), ['no street number', 'no street number']);
  check('F6 the stored list names it', (dF6.T.sync_runs.slice(-1)[0].totals.unlinked || []).find(u => u.gid === '9000000000905'), { gid: '9000000000905', name: 'Sample Penthouse', why: 'no street number' });

  // F10. applyRun says what sync_runs.ok says
  check('F10 ok on a good run', oF6.ok, true);
  check('F10 not ok before a plan', (await applyRun({ client: fakeDb(), run: await read(world()), now: NOW })).ok, false);
  check('F10 not ok on a partial read', (await applyRun({ client: await planned(), run: await read(world(), { asana: asanaOf(world(), { fail: { [NJ]: 500 } }) }), now: NOW })).ok, false);

  // F12. --dry-run --record keeps only loose tasks that name a linked development (D65)
  const wF12 = world();
  wF12.tasks['1211384244337827'] = [clone(fx('tasks-1211384244337827.json').data[0], '9000000000960', 'New Renderings for 30 Lot Rd'),
    clone(fx('tasks-1211384244337827.json').data[0], '9000000000961', 'Unrelated social post')];
  const recF12 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-rec-'));
  const dryF12 = await dryRun({ cfg, fetch: replayFetch(FIX, wF12), record: true, recordDir: recF12, looseNames: ['30 lot rd'], outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-dry-')), date: '2026-10-20' });
  const looseIdx = cfg.asana.loose.indexOf('1211384244337827') + 1;
  const recFile = path.join(recF12, '2026-10-20', 'asana-loose-' + looseIdx + '.json');
  check('F12 dry run ok', dryF12.ok, true);
  check('F12 recorded loose tasks: only those naming a linked development', fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')).map(t => t.gid) : 'no file', ['9000000000960']);
  const dryF12b = await dryRun({ cfg, fetch: replayFetch(FIX, wF12), record: true, recordDir: recF12, client: fakeDb(), outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-dry-')), date: '2026-10-21' });
  const recFileB = path.join(recF12, '2026-10-21', 'asana-loose-' + looseIdx + '.json');
  check('F12 no linked development known: no loose task recorded', [dryF12b.ok, fs.existsSync(recFileB) ? JSON.parse(fs.readFileSync(recFileB, 'utf8')).length : 0], [true, 0]);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
