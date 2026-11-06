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
const { makePlan, writePlanFiles, readPlanFile, matchTask } = require('../helper/asana/link.js');
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
const TABLES = ['properties', 'pitches', 'dev_projects', 'changes', 'sync_runs', 'asana_tasks', 'asana_people', 'de_listings', 'places', 'buildings'];
function fakeDb(seed) {
  const T = {};
  TABLES.forEach(t => { T[t] = []; });
  Object.keys(seed || {}).forEach(k => { T[k] = seed[k].map(r => Object.assign(k === 'asana_tasks' || k === 'asana_people' ? {} : { version: 1 }, r)); });
  let n = 0;
  // 'totals->>full' reads a JSON field, as PostgREST does
  const field = (row, k) => { const j = /^(\w+)->>(\w+)$/.exec(k); return j ? (row[j[1]] || {})[j[2]] : row[k]; };
  const matches = (row, m) => Object.keys(m || {}).every(k => String(field(row, k)) === String(m[k]));
  const copy = x => JSON.parse(JSON.stringify(x));
  const db = {
    T, conflictOn: null,
    ready: () => true,
    calls: [],
    select: async (t, m, cols, o) => {
      db.calls.push({ t, m, cols, o });
      let rows = T[t].filter(r => matches(r, m));
      if (o && o.order) {
        const [f, dir] = o.order.split('.');
        rows = rows.slice().sort((a, b) => (a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
      }
      if (o && o.limit) rows = rows.slice(0, o.limit);
      return rows.map(copy);
    },
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
const NYC = '1209188026968555', NJ = '1209188026968552', DEV = '1210736852899934';
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
  check('apply: Asana\'s State is the State fact at Asana\'s rank', [P('9000000000178').core.state, P('9000000000178').core.facts.state],
    ['NJ', { value: 'NJ', source: 'Asana', bySource: { Asana: 'NJ' } }]);
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

  /* the run after the plan brings in the off-market listings the plan left unticked by its old default (D88:
     off market within 120 days, set aside by the old rule, never listed); then the same run again changes nothing */
  await applyRun({ client: db, run: await read(world()), now: NOW });
  check('D88 after the plan: the recent off-market rows it left unticked by default become jobs at Off market',
    ['9000000000100', '9000000000110'].map(g => (P(g) || {}).stage), ['Off market', 'Off market']);
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
  // the lot's List Side Lead is a deal at Pitch, and its Active Buy Side our own purchase (a buy deal), on one place
  const lot = gid => db3.T.properties.find(p => p.asana_gid === gid) || {};
  check('30 Lot Rd: the List Side Lead is a Pitch deal, the Active Buy Side a buy deal, on one place',
    [lot('9000000000221').stage, lot('9000000000221').side, lot('9000000000211').stage, lot('9000000000211').side, lot('9000000000211').dev_project_id,
      !!lot('9000000000211').place_id && lot('9000000000211').place_id === lot('9000000000221').place_id, db3.T.places.filter(p => /30 Lot/.test(p.address)).length],
    ['Pitch', 'list', 'Live', 'buy', 'dev1', true, 1]);
  check('land row: the dev\'s next milestone stored', 'next_milestone' in db3.T.dev_projects[0], true);
  check('land row: the dev Match result stored', Array.isArray((db3.T.dev_projects[0].match || {}).list), true);

  /* ================= the development's schedule (D110) ================= */
  const wS = world();
  wS.tasks[DEV] = fx('tasks-' + DEV + '.json').data.map((t, i) => i === 0 ? Object.assign({}, t, { num_subtasks: 2, start_on: '2026-02-01', resource_subtype: 'milestone' }) : t);
  const parentGid = wS.tasks[DEV][0].gid;
  wS.subtasks[parentGid] = [
    { gid: 'w1', name: 'Excavation', completed: true, completed_at: '2026-05-08T12:00:00.000Z', start_on: '2026-05-04', due_on: '2026-05-08', parent: { gid: parentGid }, dependencies: [], assignee: { name: 'Agent A' }, notes: 'SECRET work note' },
    { gid: 'w2', name: 'Framing', completed: false, start_on: '2026-05-11', due_on: '2026-06-15', parent: { gid: parentGid }, dependencies: [{ gid: 'w1' }], num_subtasks: 1 }];
  wS.subtasks.w2 = [{ gid: 'w3', name: 'Framing inspection', completed: false, due_on: '2026-06-16', parent: { gid: 'w2' } }];
  const rS = await read(wS);
  const sched = rS.devs.find(d => d.project.gid === DEV).schedule;
  check('schedule: every task, its work items and theirs', [sched.length, sched.slice(-3).map(x => [x.gid, x.parentGid])], [17, [['w1', parentGid], ['w2', parentGid], ['w3', 'w2']]]);
  check('schedule: dates, milestone and links kept', [sched[0].startOn, sched[0].milestone, sched.find(x => x.gid === 'w2').deps], ['2026-02-01', true, ['w1']]);
  check('schedule: no notes or assignee', /SECRET|Agent A/.test(JSON.stringify(sched)), false);
  const dbS = fakeDb({ dev_projects: [Object.assign({}, DEVROW, { asana_project_gid: DEV, version: 1 })], asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }] });
  await applyRun({ client: dbS, run: rS, now: NOW });
  check('schedule: stored on the development', dbS.T.dev_projects[0].schedule.tasks.length, 17);
  const vS = dbS.T.dev_projects[0].version;
  await applyRun({ client: dbS, run: await read(wS), now: NOW });
  check('schedule: an unchanged one is not written again', dbS.T.dev_projects[0].version, vS);
  const rSF = await read(wS, { asana: asanaOf(wS, { failTask: { w2: 500 } }) });
  check('schedule: a work item that fails to read gives none, with a warning',
    [rSF.devs.find(d => d.project.gid === DEV).schedule, rSF.warnings.some(x => /w2/.test(x))], [null, true]);
  await applyRun({ client: dbS, run: rSF, now: NOW });
  check('schedule: the last one is kept', dbS.T.dev_projects[0].schedule.tasks.length, 17);
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
  // C1: the sync reads only the newest runs it needs, newest first, a small limit
  const runReads = db10.calls.filter(c => c.t === 'sync_runs');
  check('C1 sync_runs reads are newest first with a small limit', runReads.length > 0 && runReads.every(c => c.o && c.o.order === 'started_at.desc' && c.o.limit > 0 && c.o.limit <= 20), true);
  check('C1 sync_runs reads ask for good Asana runs only', runReads.every(c => c.m && c.m.kind === 'asana' && c.m.ok === true), true);

  // 1b. an existing job without a State gets Asana's "New Jersey" as NJ on the next sync (tune-up 4)
  {
    const ex = P('9000000000189');
    delete ex.core.state; if (ex.core.facts) delete ex.core.facts.state;
    const had = db.T.changes.length;
    const w4 = world();
    setField(find(w4, '9000000000189'), '📍 State', { enum_value: { name: 'New Jersey' }, display_value: 'New Jersey' });
    await applyRun({ client: db, run: await read(w4), now: NOW });
    const st = db.T.changes.slice(had).filter(c => c.property_id === ex.id && c.field === 'state');
    check('existing job: Asana\'s New Jersey becomes NJ, logged once', [P('9000000000189').core.state, P('9000000000189').core.facts.state.source, st.map(c => [c.old_value, c.new_value, c.source])],
      ['NJ', 'Asana', [[null, 'NJ', 'Asana']]]);
  }

  // 2. a task first seen as a Lead becomes a pitch once it has a pitch date
  w = world();
  const lead = find(w, '9000000000163');
  setField(lead, '🗓️ Pitch', { date_value: { date: '2026-10-15' } });
  lead.modified_at = LATER;
  await applyRun({ client: db, run: await read(w, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('a cached Lead later given a pitch date stays one deal at the Pitch stage',
    [db.T.properties.filter(p => p.asana_gid === '9000000000163').map(p => p.stage), db.T.pitches.some(p => p.asana_gid === '9000000000163')], [['Pitch'], false]);
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
  check('F6 the stored list names it, with its market (for the Match page\'s job picker)', (dF6.T.sync_runs.slice(-1)[0].totals.unlinked || []).find(u => u.gid === '9000000000905'), { gid: '9000000000905', name: 'Sample Penthouse', why: 'no street number', market: 'NYC' });

  // A1. Link by hand (tune-up A): a job Matt linked to the task on the Match page is found by its stored asana_gid,
  // even though the task's name has no address that matches; it is filled in and no longer listed as unlinked
  dF6.T.properties.push({ id: 'p-hand', slug: '52-e4-10fl', version: 1, kind: 'sale', market: 'NYC', stage: 'Live', stage_source: 'Matt', asana_gid: '9000000000905',
    core: { address: '52 E4', unit: '10FL' }, folder_state: 'unlinked' });
  dF6.T.asana_tasks.find(c => c.gid === '9000000000905').property_id = 'p-hand';
  const jobsA1 = dF6.T.properties.length;
  const oA1 = await applyRun({ client: dF6, run: await read(wF6, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  const pA1 = dF6.T.properties.find(p => p.id === 'p-hand');
  check('A1 hand link: the stored asana_gid is used first', [pA1.asana && pA1.asana.gid, pA1.asana && pA1.asana.name, dF6.T.properties.length], ['9000000000905', 'Sample Penthouse', jobsA1]);
  check('A1 hand link: no longer unlinked, the cache row stays on the job', [oA1.unlinked.some(u => u.gid === '9000000000905'),
    (dF6.T.sync_runs.slice(-1)[0].totals.unlinked || []).some(u => u.gid === '9000000000905'), dF6.T.asana_tasks.find(c => c.gid === '9000000000905').property_id], [false, false, 'p-hand']);
  // Ignore on the Match page: a task set aside stays set aside and off the list
  dF6.T.asana_tasks.find(c => c.gid === '9000000000906').ignored = true;
  await applyRun({ client: dF6, run: await read(wF6, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('A1 ignore: a task set aside stays ignored and is not listed', [dF6.T.asana_tasks.find(c => c.gid === '9000000000906').ignored,
    (dF6.T.sync_runs.slice(-1)[0].totals.unlinked || []).some(u => u.gid === '9000000000906')], [true, false]);

  // A3. a job (by asana_gid) and an open pitch both hold the task's gid, and the task is at Prep or later:
  // the pitch is won, pointing at that job (logged), instead of staying open
  const dA3 = await planned();
  const jA3 = PF(dA3, '9000000000023');
  dA3.T.pitches.push({ id: 'q-a3', slug: '23-pitch', version: 1, outcome: 'open', asana_gid: '9000000000023', market: 'NYC' });
  const wA3 = world();
  status(find(wA3, '9000000000023'), 'Active');
  await applyRun({ client: dA3, run: await read(wA3, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  const qA3 = dA3.T.pitches.find(p => p.id === 'q-a3');
  check('A3 job and open pitch on one gid: the pitch is won, pointing at the job', [qA3.outcome, qA3.won_property_id], ['won', jA3.id]);
  check('A3 the job is still updated from the task', PF(dA3, '9000000000023').stage, 'Live');
  check('A3 logged on the pitch, source Asana', dA3.T.changes.filter(c => c.pitch_id === 'q-a3' && c.field === 'outcome').map(c => [c.old_value, c.new_value, c.source]), [['open', 'won', 'Asana']]);
  await applyRun({ client: dA3, run: await read(wA3, { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('A3 the next run leaves the won pitch alone', dA3.T.changes.filter(c => c.pitch_id === 'q-a3' && c.field === 'outcome').length, 1);

  // D3 (deepen 3b). A List-Side task at Prep to In contract that no job links to is reported, even when an
  // incremental run doesn't read it again (404 Park S - 6A: linked by the plan to the sale row, unlinked by hand,
  // then never re-read, so nothing said it had no job)
  const dD3 = await planned();
  const jD3 = PF(dD3, '9000000000054');
  jD3.asana_gid = null;
  dD3.T.asana_tasks.find(c => c.gid === '9000000000054').property_id = null;
  const oD3 = await applyRun({ client: dD3, run: await read(world(), { full: false, since: '2026-10-20T12:30:00.000Z' }), now: NOW });
  check('D3 an unchanged cached task with no job is listed, with why and market', (dD3.T.sync_runs.slice(-1)[0].totals.unlinked || []).filter(u => u.gid === '9000000000054'),
    [{ gid: '9000000000054', name: (dD3.T.asana_tasks.find(c => c.gid === '9000000000054') || {}).name, why: 'no job yet', market: 'NYC' }]);
  check('D3 it is reported, not linked or made (the linking rules are unchanged)', [oD3.created, dD3.T.properties.filter(p => p.asana_gid === '9000000000054').length], [0, 0]);
  check('D3 a job linked to its task, an ignored task, a Sold task: never listed', (dD3.T.sync_runs.slice(-1)[0].totals.unlinked || [])
    .filter(u => ['9000000000041', '9000000000079', '9000000000152'].indexOf(u.gid) !== -1).length, 0);
  check('D3 the Match pass reads de_listings once for M19', dD3.calls.filter(c => c.t === 'de_listings').length >= 1, true);

  // B8. a run that isn't good (partial read) never stores totals.unlinked
  const dB8 = await planned();
  await applyRun({ client: dB8, run: await read(world(), { asana: asanaOf(world(), { fail: { [NJ]: 500 } }) }), now: NOW });
  const srB8 = dB8.T.sync_runs.slice(-1)[0];
  check('B8 a failed run stores no unlinked list', [srB8.ok, 'unlinked' in (srB8.totals || {})], [false, false]);

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
  const recFile = path.join(recF12, 'asana-2026-10-20', 'loose-' + looseIdx + '.json');
  check('F12 dry run ok', dryF12.ok, true);
  check('F12 recorded loose tasks: only those naming a linked development', fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')).map(t => t.gid) : 'no file', ['9000000000960']);
  const dryF12b = await dryRun({ cfg, fetch: replayFetch(FIX, wF12), record: true, recordDir: recF12, client: fakeDb(), outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-dry-')), date: '2026-10-21' });
  const recFileB = path.join(recF12, 'asana-2026-10-21', 'loose-' + looseIdx + '.json');
  check('F12 no linked development known: no loose task recorded', [dryF12b.ok, fs.existsSync(recFileB) ? JSON.parse(fs.readFileSync(recFileB, 'utf8')).length : 0], [true, 0]);

  // K1. sale vs rental (plan §5): a For Rent task never links to a sale job at the same unit
  const kProps = [{ id: 'p-sale', kind: 'sale', stage: 'Live', core: { address: '404 Park Ave S', unit: '6A', city: 'New York' } }];
  const kTask = (sr, extra) => ({ gid: 'g-k1', name: '404 Park Ave S - 6A', fields: Object.assign({ 'Sale/Rent': sr }, extra || {}) });
  const kMatch = sr => matchTask(kTask(sr), { properties: kProps, pitches: [] }, 'listing');
  check('K1 For Rent task: no match to the sale job (a new listing)', kMatch('For Rent'), {});
  check('K1 For Sale task: matches the sale job', kMatch('For Sale'), { propertyId: 'p-sale' });
  check('K1 For Sale or Rent: matches either', kMatch('For Sale or Rent'), { propertyId: 'p-sale' });
  check('K1 blank Sale/Rent: matches either', kMatch(null), { propertyId: 'p-sale' });
  check('K1 For Rent matches a rental job', matchTask(kTask('For Rent'), { properties: [Object.assign({}, kProps[0], { kind: 'rental' })], pitches: [] }, 'listing'), { propertyId: 'p-sale' });
  check('K1 Drive Link match also respects the kind', matchTask(kTask('For Rent', { '🛜 Google Drive Link': 'https://drive/x' }),
    { properties: [Object.assign({}, kProps[0], { core: Object.assign({ driveLink: 'https://drive/x' }, kProps[0].core) })], pitches: [] }, 'listing'), {});
  check('K1 a linked sale job does not make a rental task "taken"', matchTask(kTask('For Rent'), { properties: [Object.assign({ asana_gid: 'other' }, kProps[0])], pitches: [] }, 'listing'), {});
  const kRun = { listings: [
    { gid: 'g-ks', name: '404 Park Ave S - 6A', fields: { 'Deal Side': 'List Side', 'Listing Status': 'Active', 'Sale/Rent': 'For Sale' } },
    { gid: 'g-kr', name: '404 Park Ave S - 6A', fields: { 'Deal Side': 'List Side', 'Listing Status': 'Active', 'Sale/Rent': 'For Rent' } }] };
  const kPlan = makePlan(kRun, { properties: kProps, pitches: [], devs: [] }).rows;
  check('K1 plan: the sale links to the sale job, the rental is a new listing, both ticked',
    kPlan.map(r => [r.gid, r.tick, r.match && r.match.propertyId || null]), [['g-ks', true, 'p-sale'], ['g-kr', true, null]]);

  /* ---------- OM. Recently off-market listings become jobs (Matt, 2026-10-22: "off market listings should be on
     there, that's when a lot of the prep occurs"). A List-Side task that went off market from Prep or later within
     the last 120 days becomes a job at 'Off market'; older ones, lost Leads and Buy-Side rows stay out; a task the
     sync set aside under the old rule is looked at again, one Matt set aside stays aside. ---------- */
  const OM_NOW = new Date('2026-10-22T16:00:00Z');
  const omH = (...m) => m.map(x => ({ type: 'status', at: x[0], from: x[1], to: x[2] }));
  const omTask = (gid, name, status, history, extra) => Object.assign({ gid, name, projectGid: NJ, market: 'NJ', section: status, permalink: 'https://app.asana.com/0/' + NJ + '/' + gid,
    assignee: null, completed: false, modifiedAt: history.length ? history[history.length - 1].at : '2026-10-01T15:00:00.000Z',
    fields: Object.assign({ 'Deal Side': 'List Side', 'Listing Status': status, 'Sale/Rent': 'For Sale', '🧑‍💼 Point Person': 'AB', '💵 Current Price': 1250000 }, (extra || {}).fields || {}),
    history }, (({ fields, ...rest }) => rest)(extra || {}));
  const omRun = listings => ({ ok: true, full: true, kind: 'asana', listings, devs: [], loose: [], readProjects: [NJ, NYC] });
  const OM_FIRST = { id: 'run-first', kind: 'asana', started_at: '2026-10-21T14:49:00.000Z', ok: true, totals: { unlinked: [{ gid: 'g-om-listed', name: '7 Listed Ln', why: 'no job yet', market: 'NJ' }] } };
  const omDb = cacheRows => fakeDb({ sync_runs: [OM_FIRST], asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }].concat(cacheRows || []) });
  const omApply = (db, listings) => applyRun({ client: db, run: omRun(listings), now: OM_NOW, roster: [], initials: { AB: 'agent-b' } });
  const omJob = (db, gid) => db.T.properties.find(p => p.asana_gid === gid);
  const omCache = (db, gid) => db.T.asana_tasks.find(c => c.gid === gid) || {};

  // OM1. first met off market 10 days ago, from Live: a job at Off market, made like any other candidate
  const dOM1 = omDb();
  const oOM1 = await omApply(dOM1, [omTask('g-om1', '619 Sample Ave, Brielle - 1st', 'Graveyard',
    omH(['2026-06-04T15:00:00.000Z', 'TJ New Dev', 'Active'], ['2026-10-12T15:00:00.000Z', 'Active', 'TOTM'], ['2026-10-12T15:00:02.000Z', 'TOTM', 'Graveyard']))]);
  const jOM1 = omJob(dOM1, 'g-om1');
  check('OM1 a recent off-market listing becomes a job at Off market', [!!jOM1, jOM1 && jOM1.stage, jOM1 && jOM1.stage_source, oOM1.created], [true, 'Off market', 'Asana', 1]);
  check('OM1 made like other candidates: facts, suggested agents, milestones, snapshot, folder unlinked',
    jOM1 && [jOM1.core.price, jOM1.core.facts.price.source, jOM1.core.suggestedAgentIds, jOM1.milestones.offMarketOn, jOM1.milestones.listedOn.on, jOM1.asana.status, jOM1.folder_state, jOM1.market],
    [1250000, 'Asana', ['agent-b'], { on: '2026-10-12', planned: false }, '2026-06-04', 'Graveyard', 'unlinked', 'NJ']);
  check('OM1 logged as found in Asana, stage Off market', dOM1.T.changes.filter(c => jOM1 && c.property_id === jOM1.id && (c.field === 'stage' || !c.field)).map(c => [c.field, c.new_value, c.note]),
    [[null, null, 'Found in Asana'], ['stage', 'Off market', null]]);
  check('OM1 the cache row is the job\'s, not ignored', [omCache(dOM1, 'g-om1').ignored, omCache(dOM1, 'g-om1').property_id === (jOM1 && jOM1.id)], [false, true]);

  // OM2. older than 120 days, a lost Lead, a Buy-Side row: no job, and never listed on the Match page
  const dOM2 = omDb();
  const oOM2 = await omApply(dOM2, [
    omTask('g-om-old', '116 Sample Dr, Howell', 'Graveyard', omH(['2025-09-01T15:00:00.000Z', null, 'Active'], ['2026-05-25T15:00:00.000Z', 'Active', 'Graveyard'])),
    omTask('g-om-lead', '431 Sample St, Beach Haven', 'Graveyard', omH(['2026-01-07T15:00:00.000Z', null, 'Lead'], ['2026-08-10T15:00:00.000Z', 'Lead', 'Graveyard'])),
    omTask('g-om-buy', '12 Buyer Rd, Rumson', 'TOTM', omH(['2026-09-01T15:00:00.000Z', null, 'Active'], ['2026-10-01T15:00:00.000Z', 'Active', 'TOTM']), { fields: { 'Deal Side': 'Buy Side' } })]);
  check('OM2 older than 120 days, a lost Lead, Buy-Side: no job', ['g-om-old', 'g-om-lead', 'g-om-buy'].map(g => !!omJob(dOM2, g)), [false, false, false]);
  check('OM2 none of them is listed as not linked', oOM2.unlinked.filter(u => /^g-om/.test(u.gid)).length, 0);
  check('OM2 an old off-market task is not set aside for good (a later move off market can still bring it in)', omCache(dOM2, 'g-om-old').ignored, false);
  check('OM2 Sold first met is still set aside for good', (await (async () => {
    const d = omDb(); await omApply(d, [omTask('g-om-sold', '9 Sold Ct, Fair Haven', 'Complete', omH(['2026-09-01T15:00:00.000Z', 'Active', 'Complete']))]);
    return [omCache(d, 'g-om-sold').ignored, !!omJob(d, 'g-om-sold')]; })()), [true, false]);
  // the 120 days, both sides of the line
  const dOM2b = omDb();
  await omApply(dOM2b, [omTask('g-om-120', '120 Edge Rd, Rumson', 'TOTM', omH(['2026-01-01T15:00:00.000Z', null, 'Active'], ['2026-06-24T15:00:00.000Z', 'Active', 'TOTM'])),
    omTask('g-om-121', '121 Edge Rd, Rumson', 'TOTM', omH(['2026-01-01T15:00:00.000Z', null, 'Active'], ['2026-06-23T15:00:00.000Z', 'Active', 'TOTM']))]);
  check('OM2 120 days ago still counts; 121 does not', [!!omJob(dOM2b, 'g-om-120'), !!omJob(dOM2b, 'g-om-121')], [true, false]);
  // no history: Asana's modified date stands in
  const dOM2c = omDb();
  await omApply(dOM2c, [omTask('g-om-nh', '5 Quiet Ln, Rumson', 'TOTM', [], { modifiedAt: '2026-09-30T15:00:00.000Z' }),
    omTask('g-om-nh-old', '6 Quiet Ln, Rumson', 'TOTM', [], { modifiedAt: '2026-03-30T15:00:00.000Z' })]);
  check('OM2 no history: modified in the last 120 days counts, older does not', [!!omJob(dOM2c, 'g-om-nh'), !!omJob(dOM2c, 'g-om-nh-old')], [true, false]);
  // no street number: listed for Matt, as other candidates are
  const dOM2d = omDb();
  const oOM2d = await omApply(dOM2d, [omTask('g-om-nonum', 'Sample Farm, Colts Neck', 'TOTM', omH(['2026-09-01T15:00:00.000Z', null, 'Active'], ['2026-10-01T15:00:00.000Z', 'Active', 'TOTM']))]);
  check('OM2 no street number: no job, listed with why', [!!omJob(dOM2d, 'g-om-nonum'), (oOM2d.unlinked.find(u => u.gid === 'g-om-nonum') || {}).why], [false, 'no street number']);

  // an old off-market task at the address of a job linked to another task is not a "same address" line (never a job)
  const dOM2e = omDb();
  dOM2e.T.properties.push({ id: 'p-om2e', slug: '116-sample-dr', version: 1, kind: 'sale', market: 'NJ', stage: 'Live', asana_gid: 'g-other', core: { address: '116 Sample Dr', city: 'Howell' } });
  const oOM2e = await omApply(dOM2e, [omTask('g-om-old2', '116 Sample Dr, Howell', 'Graveyard', omH(['2025-09-01T15:00:00.000Z', null, 'Active'], ['2026-05-25T15:00:00.000Z', 'Active', 'Graveyard']))]);
  check('OM2 an old off-market task at the address of a linked job is not listed', oOM2e.unlinked.some(u => u.gid === 'g-om-old2'), false);

  // OM3. cached as ignored by the old automatic rule (off market before the workspace's first Asana run, never listed
  // on the Match page): brought in now. Matt's own Ignore (the task was listed) stays. A task left out on the plan
  // while it was still on the market, which went off market later, stays out.
  const recentH = omH(['2026-07-15T15:00:00.000Z', null, 'Active'], ['2026-09-22T15:00:00.000Z', 'Active', 'Graveyard']);
  const dOM3 = omDb([
    { gid: 'g-om-auto', project_gid: NJ, kind: 'listing', name: '3 Sample Ln, Port Monmouth', ignored: true, history: recentH },
    { gid: 'g-om-listed', project_gid: NJ, kind: 'listing', name: '7 Listed Ln', ignored: true, history: recentH },
    { gid: 'g-om-plan', project_gid: NJ, kind: 'listing', name: '8 Plan Ln, Rumson', ignored: true }]);
  const laterOff = omH(['2026-07-15T15:00:00.000Z', null, 'Active'], ['2026-10-21T20:00:00.000Z', 'Active', 'TOTM']);
  await omApply(dOM3, [omTask('g-om-auto', '3 Sample Ln, Port Monmouth', 'Graveyard', recentH), omTask('g-om-listed', '7 Listed Ln, Rumson', 'Graveyard', recentH),
    omTask('g-om-plan', '8 Plan Ln, Rumson', 'TOTM', laterOff)]);
  check('OM3 set aside by the old rule: brought in now, no longer ignored', [omJob(dOM3, 'g-om-auto') && omJob(dOM3, 'g-om-auto').stage, omCache(dOM3, 'g-om-auto').ignored], ['Off market', false]);
  check('OM3 set aside on the Match page (it was listed there): stays ignored, no job', [!!omJob(dOM3, 'g-om-listed'), omCache(dOM3, 'g-om-listed').ignored], [false, true]);
  check('OM3 left out on the plan while still on the market: stays ignored, no job', [!!omJob(dOM3, 'g-om-plan'), omCache(dOM3, 'g-om-plan').ignored], [false, true]);
  const omRuns = dOM3.calls.filter(c => c.t === 'sync_runs');
  check('OM3 the earlier runs are read once, only what the rule needs', [omRuns.length, omRuns[0] && omRuns[0].cols], [1, 'started_at,totals']);
  // a run with no ignored off-market task never reads the earlier runs
  check('OM3 no ignored candidate: earlier runs not read', dOM1.calls.filter(c => c.t === 'sync_runs').length, 0);
  // the next run leaves the made job alone (no second job, no new "Found in Asana")
  await omApply(dOM3, [omTask('g-om-auto', '3 Sample Ln, Port Monmouth', 'Graveyard', recentH)]);
  check('OM3 the next run: still one job, found once', [dOM3.T.properties.filter(p => p.asana_gid === 'g-om-auto').length,
    dOM3.T.changes.filter(c => c.note === 'Found in Asana' && c.property_id === (omJob(dOM3, 'g-om-auto') || {}).id).length], [1, 1]);

  // OM4. a job already linked that goes off market keeps its stage moves as before (Off market, logged)
  const dOM4 = omDb();
  await omApply(dOM4, [omTask('g-om4', '44 Moving Rd, Rumson', 'Active', omH(['2026-09-01T15:00:00.000Z', null, 'Active']))]);
  await omApply(dOM4, [omTask('g-om4', '44 Moving Rd, Rumson', 'TOTM', omH(['2026-09-01T15:00:00.000Z', null, 'Active'], ['2026-10-20T15:00:00.000Z', 'Active', 'TOTM']))]);
  check('OM4 a linked job that goes off market moves to Off market', [omJob(dOM4, 'g-om4').stage, dOM4.T.properties.length], ['Off market', 1]);

  /* ---------- PD. Places and deals (stage 1): the sync fills places, every Lead appears at Pitch, and repeat
     listings, a sale beside a rental and our own purchases sit on one place ---------- */
  const { keyOfCore } = require('../helper/place-store.js');
  const pdDb = seed => fakeDb(Object.assign({}, seed || {}, { asana_tasks: [MARK].concat((seed && seed.asana_tasks) || []) }));
  const pdTask = (gid, name, status, extra) => omTask(gid, name, status, [], extra);
  const pdApply = (db, listings, extra) => applyRun({ client: db, run: Object.assign(omRun(listings), extra || {}), now: OM_NOW, roster: [], initials: { AB: 'agent-b' } });
  const pdJob = (d, gid) => omJob(d, gid) || { core: {} };
  const NYCX = { projectGid: NYC, market: 'NYC' };
  const BUY = { fields: { 'Deal Side': 'Buy Side' } };
  const RENT = { fields: { 'Sale/Rent': 'For Rent', '💵 Current Price': 9500 } };
  const placeRow = (id, core, market, extra) => Object.assign({ id, slug: id, key: keyOfCore(core, market), address: core.address, town: core.city || null,
    label: core.address, market, building_id: null, dev_project_id: null }, extra);
  const deal = (id, gid, core, extra) => Object.assign({ id, slug: id, kind: 'sale', market: 'NJ', stage: 'Live', stage_source: 'Asana', asana_gid: gid,
    side: 'list', core, folder_state: 'unlinked' }, extra);
  const asanaNotes = (d, id) => d.T.changes.filter(c => c.property_id === id && c.source === 'Asana');

  let dPD = pdDb();
  await pdApply(dPD, [pdTask('g-pd1', '12 Elm St, Brielle', 'Active')]);
  check('PD a new listing gets a place', [dPD.T.places.length, pdJob(dPD, 'g-pd1').place_id === (dPD.T.places[0] || {}).id, pdJob(dPD, 'g-pd1').side,
    (dPD.T.places[0] || {}).address, (dPD.T.places[0] || {}).town], [1, true, 'list', '12 Elm St', 'Brielle']);

  dPD = pdDb();
  await pdApply(dPD, [pdTask('g-pd2a', '401 E89 - 2A', 'Active', NYCX)]);
  await pdApply(dPD, [pdTask('g-pd2b', '401 E89 - 3B', 'Active', NYCX)]);
  check('PD a second unit in a known building shares it', [dPD.T.places.length, dPD.T.buildings.length,
    dPD.T.places.every(p => !!p.building_id && p.building_id === (dPD.T.buildings[0] || {}).id)], [2, 1, true]);

  dPD = pdDb();
  await pdApply(dPD, [pdTask('g-pd3', '331 Florence Rd, Rumson', 'Lead')]);
  check('PD a Lead with no Pitch date appears at the Pitch stage', [dPD.T.properties.map(p => [p.asana_gid, p.stage, p.stage_source, p.side]), dPD.T.pitches.length],
    [[['g-pd3', 'Pitch', 'Asana', 'list']], 0]);

  dPD = pdDb();
  const oPD4 = await pdApply(dPD, [pdTask('g-pd4', 'Spring St, Red Bank', 'Lead')]);
  const oPD4b = await pdApply(dPD, [], { full: false });
  check('PD a Lead with no street number is listed, never made, on the first run and on a later run that did not read it',
    [dPD.T.properties.length, oPD4.unlinked.filter(u => u.gid === 'g-pd4').map(u => u.why), oPD4b.unlinked.filter(u => u.gid === 'g-pd4').map(u => u.why),
      (dPD.T.sync_runs.slice(-1)[0].totals.unlinked || []).filter(u => u.gid === 'g-pd4').map(u => [u.why, u.market])],
    [0, ['no street number'], ['no street number'], [['no street number', 'NJ']]]);

  dPD = pdDb({ asana_tasks: [{ gid: 'g-pd6', project_gid: NJ, kind: 'listing', name: '6 Oak Ln, Rumson', ignored: true }] });
  await pdApply(dPD, [pdTask('g-pd6', '6 Oak Ln, Rumson', 'Lead')]);
  check('PD a Lead Matt ignored stays ignored', [dPD.T.properties.length, omCache(dPD, 'g-pd6').ignored], [0, true]);

  dPD = pdDb();
  await pdApply(dPD, [pdTask('g-pd7', '7 Oak Ln, Rumson', 'Lead')]);
  const idPD7 = pdJob(dPD, 'g-pd7').id;
  await pdApply(dPD, [pdTask('g-pd7', '7 Oak Ln, Rumson', 'In Prep to List')]);
  check('PD Lead to Prep moves the stage', [dPD.T.properties.length, pdJob(dPD, 'g-pd7').id === idPD7, pdJob(dPD, 'g-pd7').stage], [1, true, 'Prep']);

  dPD = pdDb();
  await pdApply(dPD, [pdTask('g-pd8', "19 Colt's Gait Lane, Holmdel", 'Lead')]);
  const idPD8 = pdJob(dPD, 'g-pd8').id;
  await pdApply(dPD, [pdTask('g-pd8', "19 Colt's Gait Lane, Holmdel", 'Graveyard')]);
  check('PD Lead to Graveyard archives: Pitch lost, never Off market', [pdJob(dPD, 'g-pd8').stage, pdJob(dPD, 'g-pd8').stage_source,
    asanaNotes(dPD, idPD8).filter(c => c.field === 'stage').map(c => [c.old_value, c.new_value, c.note])],
    ['Archived', 'Asana', [[null, 'Pitch', null], ['Pitch', 'Archived', 'Pitch lost']]]);
  await pdApply(dPD, [pdTask('g-pd8', "19 Colt's Gait Lane, Holmdel", 'Graveyard')]);
  check('PD a lost pitch stays archived while Asana keeps it in the Graveyard', pdJob(dPD, 'g-pd8').stage, 'Archived');
  await pdApply(dPD, [pdTask('g-pd8', "19 Colt's Gait Lane, Holmdel", 'In Prep to List')]);
  check('PD a lost pitch that Asana moves to Prep comes back at Prep', [dPD.T.properties.length, pdJob(dPD, 'g-pd8').id === idPD8, pdJob(dPD, 'g-pd8').stage,
    pdJob(dPD, 'g-pd8').stage_source, asanaNotes(dPD, idPD8).filter(c => c.field === 'stage').slice(-1).map(c => [c.old_value, c.new_value, c.note])],
    [1, true, 'Prep', 'Asana', [['Archived', 'Prep', 'Pitch back in Asana']]]);
  dPD = pdDb({ properties: [deal('p-pd9', 'g-pd9', { address: '9 Oak Ln', city: 'Rumson' }, { stage: 'Archived', stage_source: 'Matt' })] });
  await pdApply(dPD, [pdTask('g-pd9', '9 Oak Ln, Rumson', 'In Prep to List')]);
  check('PD a deal Matt archived stays archived at Prep in Asana', [pdJob(dPD, 'g-pd9').stage, pdJob(dPD, 'g-pd9').stage_source], ['Archived', 'Matt']);

  dPD = pdDb({ pitches: [{ id: 'q-pd10', slug: 'q-pd10', label: '10 Bay Rd', market: 'NJ', outcome: 'won', asana_gid: 'g-pd10', won_property_id: 'p-pd10' }],
    properties: [deal('p-pd10', 'g-pd10', { address: '10 Bay Rd', city: 'Rumson' }, { stage: 'Pitch', from_pitch_id: 'q-pd10' })] });
  await pdApply(dPD, [pdTask('g-pd10', '10 Bay Rd, Rumson', 'Lead', { fields: { '🗓️ Pitch': '2026-10-01' } })]);
  check('PD a won pitch row and its deal are one job', [dPD.T.properties.length, dPD.T.pitches.length, dPD.T.pitches[0].outcome, pdJob(dPD, 'g-pd10').id,
    (pdJob(dPD, 'g-pd10').asana || {}).gid, !!pdJob(dPD, 'g-pd10').place_id], [1, 1, 'won', 'p-pd10', 'g-pd10', true]);

  const PAS = 'GVC - New York/Building Information/404 PAS/6A';
  dPD = pdDb({ properties: [deal('p-pd11', 'g-pd11s', { address: '404 Park Ave S', unit: '6A', beds: 2 }, { market: 'NYC', drive_folder: PAS, folder_state: 'linked' })] });
  await pdApply(dPD, [pdTask('g-pd11s', '404 Park S - 6A', 'Active', NYCX), pdTask('g-pd11r', '404 Park S - 6A', 'Active', Object.assign({}, NYCX, RENT))]);
  const sale11 = pdJob(dPD, 'g-pd11s'), rent11 = pdJob(dPD, 'g-pd11r') || {};
  check('PD sale and rental share a place, and the rental has the sale\'s folder', [dPD.T.properties.length, dPD.T.places.length, !!sale11.place_id && sale11.place_id === rent11.place_id,
    rent11.kind, rent11.drive_folder, rent11.folder_state, (rent11.core || {}).beds], [2, 1, true, 'rental', PAS, 'linked', 2]);
  check('PD an existing row with no place gets one', [sale11.id, sale11.place_id === (dPD.T.places[0] || {}).id, asanaNotes(dPD, 'p-pd11').filter(c => c.field === 'place_id').length], ['p-pd11', true, 1]);

  const ELM = { address: '12 Elm St', city: 'Brielle' };
  const oldFacts = { beds: { value: 4, source: 'DE', bySource: { DE: 4 } }, sqft: { value: 2600, source: 'DE', bySource: { DE: 2600 } } };
  const oldElm = extra => deal('p-pd13', 'g-pd13old', Object.assign({ beds: 4, sqft: 2600, price: 1100000, facts: oldFacts }, ELM),
    Object.assign({ stage: 'Sold', place_id: 'pl-13', drive_folder: 'GVC - New Jersey/Resale/Brielle/12 Elm St', folder_state: 'linked' }, extra));
  dPD = pdDb({ places: [placeRow('pl-13', ELM, 'NJ')], properties: [oldElm()] });
  const oPD13 = await pdApply(dPD, [pdTask('g-pd13', '12 Elm St, Brielle', 'Active')]);
  const new13 = pdJob(dPD, 'g-pd13');
  check('PD a repeat listing after a sale is a second deal on the place', [dPD.T.properties.length, dPD.T.places.length, new13.place_id, oPD13.unlinked.length], [2, 1, 'pl-13', 0]);
  check('PD the repeat listing takes the folder and the blank place facts, with their records', [new13.drive_folder, new13.folder_state, new13.core.beds, new13.core.sqft,
    (new13.core.facts || {}).beds, new13.core.price, ((new13.core.facts || {}).price || {}).source], ['GVC - New Jersey/Resale/Brielle/12 Elm St', 'linked', 4, 2600, oldFacts.beds, 1250000, 'Asana']);
  check('PD the old deal is left as it was', [pdJob(dPD, 'g-pd13old').stage, pdJob(dPD, 'g-pd13old').core.price, asanaNotes(dPD, 'p-pd13').length], ['Sold', 1100000, 0]);

  dPD = pdDb({ places: [placeRow('pl-13', ELM, 'NJ')], properties: [oldElm(), deal('p-pd14', 'g-pd14old', Object.assign({}, ELM), { stage: 'Off market', place_id: 'pl-13' })] });
  await pdApply(dPD, [pdTask('g-pd14', '12 Elm St, Brielle', 'In Prep to List')]);
  check('PD a third listing after two old deals is a new deal', [dPD.T.properties.length, (pdJob(dPD, 'g-pd14') || {}).place_id, (pdJob(dPD, 'g-pd14') || {}).stage], [3, 'pl-13', 'Prep']);

  dPD = pdDb({ properties: [deal('p-pd15', 'g-pd15a', { address: '15 Elm St', city: 'Brielle' })] });
  const oPD15 = await pdApply(dPD, [pdTask('g-pd15b', '15 Elm St, Brielle', 'Active')]);
  check('PD two live tasks of one kind stay refused', [dPD.T.properties.length, oPD15.unlinked.filter(u => u.gid === 'g-pd15b').map(u => [u.why, u.propertyId])],
    [1, [['same address', 'p-pd15']]]);

  const BROWN = { address: '401 Brown St', city: 'Brielle' };
  const brownDev = extra => Object.assign({ id: 'dev-brown', slug: '401-brown-st', label: '401 Brown St', market: 'NJ', milestones: {} }, extra);
  // the house's own List-Side task sits in the TJ New Dev section, as 401 Brown St's does: that is how the purchase beside it is ours
  dPD = pdDb({ dev_projects: [brownDev({ house_listing_id: 'p-pd16' })], places: [placeRow('pl-16', BROWN, 'NJ', { dev_project_id: 'dev-brown' })],
    properties: [deal('p-pd16', 'g-pd16l', Object.assign({ beds: 5 }, BROWN), { stage: 'Prep', place_id: 'pl-16', dev_project_id: 'dev-brown', drive_folder: 'GVC - New Jersey/New Development/401 Brown St', folder_state: 'linked' })],
    asana_tasks: [{ gid: 'g-pd16l', project_gid: NJ, kind: 'listing', name: '401 Brown St, Brielle', section: 'TJ New Dev', fields: { 'Deal Side': 'List Side' }, property_id: 'p-pd16' }] });
  const oPD16 = await pdApply(dPD, [pdTask('g-pd16b', '401 Brown st, Brielle', 'Active', BUY)], { full: false });
  const buy16 = pdJob(dPD, 'g-pd16b') || { core: {} };
  check('PD our own purchase is a buy deal on the place', [dPD.T.properties.length, buy16.side, buy16.stage, buy16.place_id, buy16.dev_project_id, oPD16.unlinked.length],
    [2, 'buy', 'Live', 'pl-16', 'dev-brown', 0]);
  check('PD a purchase inherits nothing', [buy16.drive_folder || null, buy16.folder_state, buy16.core.beds === undefined], [null, 'unlinked', true]);
  check('PD the list-side deal is untouched, and stays the development\'s house', [asanaNotes(dPD, 'p-pd16').length, pdJob(dPD, 'g-pd16l').stage, dPD.T.dev_projects[0].house_listing_id],
    [0, 'Prep', 'p-pd16']);

  dPD = pdDb({ dev_projects: [brownDev()] });
  const oPD17 = await pdApply(dPD, [pdTask('g-pd17b', '401 Brown st, Brielle', 'Active', BUY), pdTask('g-pd17l', '401 Brown St, Brielle', 'TJ New Dev')]);
  const buy17 = pdJob(dPD, 'g-pd17b') || {}, list17 = pdJob(dPD, 'g-pd17l') || {};
  check('PD a listing arriving after the purchase is created, not refused, and becomes the development\'s house',
    [buy17.side, list17.side, list17.stage, !!buy17.place_id && buy17.place_id === list17.place_id, dPD.T.dev_projects[0].house_listing_id === list17.id, oPD17.unlinked.length],
    ['buy', 'list', 'Prep', true, true, 0]);

  dPD = pdDb({ dev_projects: [brownDev()], places: [placeRow('pl-18', BROWN, 'NJ', { dev_project_id: 'dev-brown' })] });
  await pdApply(dPD, [pdTask('g-pd18', '401 Brown St, Brielle', 'Accepted Offer', BUY)]);
  check('PD a purchase never becomes the development\'s house', [(pdJob(dPD, 'g-pd18') || {}).side, (pdJob(dPD, 'g-pd18') || {}).dev_project_id, dPD.T.dev_projects[0].house_listing_id || null],
    ['buy', 'dev-brown', null]);
  check('PD a purchase at a development\'s street is logged as ours, not as joining it', asanaNotes(dPD, pdJob(dPD, 'g-pd18').id).filter(c => c.field === 'dev_project_id').map(c => c.note),
    ['Our own purchase for the development 401 Brown St']);

  dPD = pdDb({ dev_projects: [brownDev()], places: [placeRow('pl-19', BROWN, 'NJ', { dev_project_id: 'dev-brown' })] });
  const oPD19 = await pdApply(dPD, [pdTask('g-pd19', '401 Brown St, Brielle', 'Complete', BUY)]);
  check('PD a closed Buy Side task stays out', [dPD.T.properties.length, oPD19.unlinked.length], [0, 0]);

  dPD = pdDb();
  const oPD20 = await pdApply(dPD, [pdTask('g-pd20', '77 Client Rd, Rumson', 'Active', BUY)]);
  check('PD a client\'s buy side stays out', [dPD.T.properties.length, oPD20.unlinked.length], [0, 0]);

  // a client's buy side at one of our developments stays out too (decision 5): a Le Reve unit, and a buyer of our listed house
  dPD = pdDb({ places: [placeRow('pl-26', { address: '200 E Boca Raton Rd', unit: 'D', city: 'Boca Raton' }, 'FL', { dev_project_id: 'dev-lr' })] });
  const oPD26 = await pdApply(dPD, [pdTask('g-pd26', '200 E Boca Raton Rd - D', 'In Contract', BUY)]);
  check('PD a client\'s buy side of a Le Reve unit stays out', [dPD.T.properties.length, oPD26.unlinked.length], [0, 0]);
  dPD = pdDb({ dev_projects: [brownDev({ house_listing_id: 'p-pd27' })], places: [placeRow('pl-27', BROWN, 'NJ', { dev_project_id: 'dev-brown' })],
    properties: [deal('p-pd27', 'g-pd27l', Object.assign({}, BROWN), { stage: 'Live', place_id: 'pl-27', dev_project_id: 'dev-brown' })] });
  const oPD27 = await pdApply(dPD, [pdTask('g-pd27b', '401 Brown St, Brielle', 'In Contract', BUY)]);
  check('PD a buyer of our listed house stays out', [dPD.T.properties.length, oPD27.unlinked.length], [1, 0]);

  // a Lead refused as "same address" stays listed on a later run that did not read it again
  dPD = pdDb({ properties: [deal('p-pd28', 'g-pd28a', { address: '28 Elm St', city: 'Brielle' })] });
  const oPD28 = await pdApply(dPD, [pdTask('g-pd28b', '28 Elm St, Brielle', 'Lead')]);
  const oPD28b = await pdApply(dPD, [], { full: false });
  const why28 = o => o.unlinked.filter(u => u.gid === 'g-pd28b').map(u => [u.why, u.propertyId]);
  check('PD a Lead refused as same address is listed on the next run that did not read it', [dPD.T.properties.length, why28(oPD28), why28(oPD28b)],
    [1, [['same address', 'p-pd28']], [['same address', 'p-pd28']]]);
  dPD.T.asana_tasks.find(r => r.gid === 'g-pd28b').ignored = true;
  check('PD ... unless Matt ignored it', why28(await pdApply(dPD, [], { full: false })), []);

  // a repeat listing takes its folder from the newest earlier deal that has one (a later lost pitch had none), its facts from the newest
  dPD = pdDb({ places: [placeRow('pl-13', ELM, 'NJ')], properties: [oldElm({ created_at: '2020-01-01T00:00:00Z' }),
    deal('p-pd29', 'g-pd29lost', Object.assign({ beds: 5 }, ELM), { stage: 'Archived', place_id: 'pl-13', created_at: '2025-06-01T00:00:00Z', milestones: { pitchedOn: { on: '2025-05-01' } } })] });
  await pdApply(dPD, [pdTask('g-pd29', '12 Elm St, Brielle', 'Active')]);
  const new29 = pdJob(dPD, 'g-pd29');
  check('PD a repeat listing takes the folder of the newest deal that has one, the facts of the newest', [new29.drive_folder, new29.folder_state, new29.core.beds,
    asanaNotes(dPD, new29.id).filter(c => c.field === 'drive_folder').map(c => c.new_value)],
    ['GVC - New Jersey/Resale/Brielle/12 Elm St', 'linked', 5, ['GVC - New Jersey/Resale/Brielle/12 Elm St']]);

  // M29 skips a job on the house's place: a repeat listing at a single-house development is no "listed twice"
  const OAK = { address: '25 Oak Ln', city: 'Rumson' };
  dPD = pdDb({ dev_projects: [{ id: 'dev-oak', slug: '25-oak-ln', label: '25 Oak Ln', market: 'NJ', milestones: {}, house_listing_id: 'p-pd25' }],
    places: [placeRow('pl-25', OAK, 'NJ', { dev_project_id: 'dev-oak' })],
    properties: [deal('p-pd25', 'g-pd25old', Object.assign({}, OAK), { stage: 'Sold', place_id: 'pl-25', dev_project_id: 'dev-oak' })] });
  await pdApply(dPD, [pdTask('g-pd25', '25 Oak Ln, Rumson', 'Active')]);
  const new25 = pdJob(dPD, 'g-pd25') || {};
  check('PD a repeat listing at a single-house development has no Listed twice line', [new25.place_id, new25.dev_project_id, Array.isArray((new25.match || {}).list),
    ((new25.match || {}).list || []).some(m => m.code === 'M29')], ['pl-25', 'dev-oak', true, false]);

  // run twice, nothing new; two new tasks at one new address share a place in one run
  dPD = pdDb({ dev_projects: [brownDev()] });
  const twice = [pdTask('g-pd22s', '88 New Rd - 1A', 'Active', NYCX), pdTask('g-pd22r', '88 New Rd - 1A', 'Active', Object.assign({}, NYCX, RENT)),
    pdTask('g-pd22p', '90 New Rd, Rumson', 'Lead'), pdTask('g-pd22b', '401 Brown st, Brielle', 'Active', BUY), pdTask('g-pd22l', '401 Brown St, Brielle', 'TJ New Dev')];
  await pdApply(dPD, twice);
  check('PD two new tasks at one new address share a place in one run', [dPD.T.properties.length, dPD.T.places.length,
    pdJob(dPD, 'g-pd22s').place_id === pdJob(dPD, 'g-pd22r').place_id, dPD.T.buildings.length], [5, 3, true, 1]);
  const counts = d => [d.T.places.length, d.T.buildings.length, d.T.properties.length, d.T.changes.length];
  const firstPD = counts(dPD);
  await pdApply(dPD, twice);
  check('PD run twice, nothing new', counts(dPD), firstPD);

  // the job page's Units card: a purchase is never one of the development's houses
  require('../assets/js/job-page/units.js');
  check('PD units.houses leaves a purchase out', globalThis.GVC_JP.units.houses([{ slug: 'h', stage: 'Prep', core: BROWN }, { slug: 'b', stage: 'Live', side: 'buy', core: BROWN }])
    .map(u => u.jobUrl), ['../job/?listing=h']);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
