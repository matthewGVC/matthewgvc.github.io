/* ============================================================
   Tests for the DE sync's writer (helper/de/apply.js): what one DE run
   changes in the database, against an in-memory fake (never the real one).

   Plain Node:  node scripts/test-de-apply.js
   ============================================================ */
'use strict';

// never this computer's own helper settings (they may be in starter mode)
process.env.GVC_HELPER_HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gvc-apply-'));
const { applyRun, canMove } = require('../helper/de/apply.js');
const { ConflictError } = require('../helper/supabase.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* ---------- an in-memory database with the helper client's shape ---------- */
function fakeDb(seed) {
  const T = { properties: [], changes: [], sync_runs: [], de_listings: [] };
  Object.keys(seed || {}).forEach(k => { T[k] = seed[k].map(r => Object.assign({ version: 1 }, r)); });
  let n = 0;
  const matches = (row, m) => Object.keys(m || {}).every(k => String(row[k]) === String(m[k]));
  const db = {
    T, conflictOn: null,
    ready: () => true,
    select: async (t, m) => T[t].filter(r => matches(r, m)).map(r => JSON.parse(JSON.stringify(r))),
    insert: async (t, rows) => [].concat(rows).map(r => { const x = Object.assign({ id: t + '-' + (++n), version: 1 }, r); T[t].push(x); return x; }),
    upsert: async (t, rows, key) => [].concat(rows).map(r => {
      const hit = T[t].find(x => x[key] === r[key]);
      if (hit) return Object.assign(hit, r);
      const x = Object.assign({}, r); T[t].push(x); return x;
    }),
    update: async (t, m, patch, o) => {
      if (db.conflictOn && m.id === db.conflictOn) throw new ConflictError(t);
      const hits = T[t].filter(r => matches(r, m) && (!o || o.version === undefined || r.version === o.version));
      if (o && o.version !== undefined && !hits.length) throw new ConflictError(t);
      hits.forEach(r => { Object.assign(r, patch); if (r.version !== undefined) r.version++; });
      return hits;
    }
  };
  return db;
}

function row(id, extra) {
  return Object.assign({ id, feed: 'featured', kind: 'sale', status: 'Active', stage: 'Live', street: '100 EXAMPLE ST', unit: '4A',
    city: 'New York', state: 'NY', zip: '10001', neighborhood: 'Testville', price: 1000000, closePrice: null, beds: 2, baths: 2,
    halfBaths: 0, sqft: 1200, priceChangePercent: 0, openHouses: [], listingUrl: 'https://example.com/l/' + id, cover: null }, extra);
}
function report(live, extra) { return Object.assign({ ok: true, totals: { 'featured-sale': live.length }, rowsRead: { 'featured-sale': live.length }, live }, extra); }
const NOW = new Date('2026-10-20T07:00:00Z');
const gvc = async () => ({ gvcListed: true, line: 'Douglas Elliman: Test Agent' });
const notGvc = async () => ({ gvcListed: false, line: 'Listing Courtesy of EXAMPLE REALTY' });

(async () => {
  /* ---------- stage rules ---------- */
  check('forward', canMove('Live', 'In contract'), true);
  check('contract fell through', canMove('In contract', 'Live'), true);
  check('never back from sold', canMove('Sold', 'Live'), false);
  check('archived stays', canMove('Archived', 'Live'), false);
  check('pre-live to live', canMove('Photos', 'Live'), true);
  check('no stage yet', canMove(null, 'Live'), true);
  check('same stage', canMove('Live', 'Live'), false);

  /* ---------- an aborted run writes only its log line ---------- */
  let db = fakeDb({ properties: [{ id: 'p1', slug: 's', core: { price: 1 }, stage: 'Live', de_listing_id: '900001' }] });
  let out = await applyRun({ client: db, report: { ok: false, aborted: 'DE sent a listing twice' }, rows: [], now: NOW, courtesy: gvc });
  check('aborted: one run row', [db.T.sync_runs.length, db.T.sync_runs[0].ok, db.T.sync_runs[0].errors[0].detail], [1, false, 'DE sent a listing twice']);
  check('aborted: nothing else', [db.T.changes.length, db.T.properties[0].version], [0, 1]);

  /* ---------- a linked listing: DE wins, every change logged ---------- */
  db = fakeDb({ properties: [{ id: 'p1', slug: '100-example-st-residence-4a', stage: 'Live', de_listing_id: '900001', kind: 'sale',
    core: { address: '100 Example St', unit: '4A', price: 1100000, beds: 2, baths: 2, agentIds: ['x'] } }] });
  out = await applyRun({ client: db, report: report([{ id: '900001', folder: null }]), now: NOW, courtesy: gvc,
    rows: [row('900001', { status: 'ActiveUnderContract', stage: 'In contract', price: 1000000, priceChangePercent: -9.1 })] });
  const p1 = db.T.properties[0];
  check('price from DE', p1.core.price, 1000000);
  check('agents untouched', p1.core.agentIds, ['x']);
  check('stage moved', [p1.stage, p1.stage_source], ['In contract', 'DE']);
  check('de snapshot', [p1.de.status, p1.de_status, p1.de.listingUrl], ['ActiveUnderContract', 'ActiveUnderContract', 'https://example.com/l/900001']);
  const fields = db.T.changes.map(c => c.field).sort();
  check('changes logged', fields, ['price', 'sqft', 'stage']);
  const pc = db.T.changes.find(c => c.field === 'price');
  check('price change row', [pc.old_value, pc.new_value, pc.source, pc.run_id, pc.property_id, /9\.1%/.test(pc.note)], [1100000, 1000000, 'DE', db.T.sync_runs[0].id, 'p1', true]);
  check('run logged ok', [db.T.sync_runs[0].ok, db.T.sync_runs[0].changes], [true, 3]);
  check('de_listings cached', db.T.de_listings.map(d => [d.de_listing_id, d.property_id]), [['900001', 'p1']]);

  /* the same run again changes nothing */
  const before = db.T.changes.length;
  await applyRun({ client: db, report: report([{ id: '900001', folder: null }]), now: NOW, courtesy: gvc,
    rows: [row('900001', { status: 'ActiveUnderContract', stage: 'In contract', price: 1000000, priceChangePercent: -9.1 })] });
  check('second run: no new changes', db.T.changes.length, before);

  /* ---------- starter mode (addNew: false): known jobs update, nothing new arrives ---------- */
  db = fakeDb({ properties: [{ id: 'lib1', slug: 'lib', stage: null, de_listing_id: '900001', kind: 'sale', core: { address: '100 Example St', unit: '4A', price: 1100000 } }] });
  await applyRun({ client: db, report: report([{ id: '900001', folder: null }]), now: NOW, addNew: false, courtesy: gvc, rows: [row('900001')] });
  check('starter mode: a library row keeps off the overview (no stage)', [db.T.properties[0].stage, db.T.changes.some(c => c.field === 'stage')], [null, false]);

  db = fakeDb();
  let askedStarter = 0;
  out = await applyRun({ client: db, report: report([{ id: '900002', folder: null }]), now: NOW, addNew: false,
    courtesy: async () => { askedStarter++; return { gvcListed: true }; }, rows: [row('900002')] });
  check('starter mode: no new job, no DE page read', [db.T.properties.length, out.created, askedStarter], [0, 0, 0]);

  /* ---------- a new GVC listing on DE becomes a job ---------- */
  db = fakeDb();
  out = await applyRun({ client: db, report: report([{ id: '900002', folder: 'GVC - New York/Building Information/100 Example St/4A', via: 'lnk' }]),
    now: NOW, courtesy: gvc, rows: [row('900002')] });
  const np = db.T.properties[0] || {};
  check('created', [db.T.properties.length, np.market, np.kind, np.stage, np.stage_source, np.de_listing_id], [1, 'NYC', 'sale', 'Live', 'DE', '900002']);
  check('created with its folder', [np.drive_folder, np.folder_state], ['GVC - New York/Building Information/100 Example St/4A', 'linked']);
  check('created core', [np.core.address, np.core.unit, np.core.price, np.slug], ['100 EXAMPLE ST', '4A', 1000000, '100-example-st-residence-4a']);
  check('creation logged', db.T.changes.map(c => c.note || c.field), ['Found on DE']);
  check('courtesy cached', [db.T.de_listings[0].gvc_listed, db.T.de_listings[0].courtesy], [true, 'Douglas Elliman: Test Agent']);

  /* a new listing that isn't GVC's is remembered, not created */
  db = fakeDb();
  await applyRun({ client: db, report: report([{ id: '900003', folder: null }]), now: NOW, courtesy: notGvc, rows: [row('900003')] });
  check('not GVC: no job', db.T.properties.length, 0);
  check('not GVC: remembered', db.T.de_listings[0].gvc_listed, false);
  let asked = 0;
  await applyRun({ client: db, report: report([{ id: '900003', folder: null }]), now: NOW, courtesy: async () => { asked++; return { gvcListed: true }; }, rows: [row('900003')] });
  check('not GVC: never asked again', [asked, db.T.properties.length], [0, 0]);

  /* ---------- sold: only by the listing's own DE id ---------- */
  db = fakeDb({ properties: [{ id: 'p1', slug: 's', stage: 'In contract', de_listing_id: '900001', kind: 'sale', core: { address: '100 Example St', unit: '4A', price: 1000000 } }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, rows: [
    row('900001', { feed: 'transactions', status: 'Sold', stage: 'Sold', closePrice: 950000 }),
    row('777777', { feed: 'transactions', status: 'Sold', stage: 'Sold', closePrice: 500000 })   // an old sale of the same unit
  ] });
  check('sold', [db.T.properties[0].stage, db.T.properties[0].core.closePrice], ['Sold', 950000]);
  check('old sale of the same unit ignored', db.T.properties.length, 1);
  check('transactions never create jobs (D31)', db.T.de_listings.find(d => d.de_listing_id === '777777').property_id || null, null);

  /* ---------- a conflict is logged and skipped, the rest goes on ---------- */
  db = fakeDb({ properties: [
    { id: 'p1', slug: 'a', stage: 'Live', de_listing_id: '900001', kind: 'sale', core: { price: 1 } },
    { id: 'p2', slug: 'b', stage: 'Live', de_listing_id: '900002', kind: 'sale', core: { price: 1 } }] });
  db.conflictOn = 'p1';
  out = await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, rows: [row('900001'), row('900002')] });
  check('conflict skipped', [db.T.properties[0].core.price, db.T.properties[1].core.price], [1, 1000000]);
  check('conflict logged', [out.errors.length, /changed this/.test(out.errors[0].detail)], [1, true]);
  check('run marked with errors', db.T.sync_runs[0].ok, true);

  /* ---------- review fixes ---------- */
  /* one row failing doesn't stop the run or leave it unfinished */
  db = fakeDb({ properties: [
    { id: 'p1', slug: 'a', stage: 'Live', de_listing_id: '900001', kind: 'sale', core: { price: 1 } },
    { id: 'p2', slug: 'b', stage: 'Live', de_listing_id: '900002', kind: 'sale', core: { price: 1 } }] });
  const realInsert = db.insert;
  db.insert = async (t, rows) => { if (t === 'changes' && [].concat(rows)[0].property_id === 'p1') throw new Error('network dropped'); return realInsert(t, rows); };
  out = await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, rows: [row('900001'), row('900002')] });
  check('row error: run still finished', [!!db.T.sync_runs[0].finished_at, out.errors.some(e => /network dropped/.test(e.detail))], [true, true]);
  check('row error: the next row still synced', db.T.properties[1].core.price, 1000000);

  /* the DE cache keeps what it knows when rows in one batch carry different fields */
  db = fakeDb({ de_listings: [{ de_listing_id: '900001', gvc_listed: true, courtesy: 'Douglas Elliman: Test Agent', feed: 'featured', kind: 'sale' }],
    properties: [{ id: 'p1', slug: 'a', stage: 'Live', de_listing_id: '900001', kind: 'sale', core: {} }] });
  db.upsert = async (t, rows, key) => {   // like PostgREST: one column list for the whole batch, missing keys become null
    const keys = [...new Set([].concat(rows).flatMap(r => Object.keys(r)))];
    return [].concat(rows).map(r => { const full = {}; keys.forEach(k => { full[k] = r[k] === undefined ? null : r[k]; });
      const hit = db.T[t].find(x => x[key] === full[key]); return hit ? Object.assign(hit, full) : (db.T[t].push(full), full); });
  };
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: notGvc, rows: [row('900001'), row('900009', { street: '9 OTHER ST' })] });
  check('cache keeps its GVC check', db.T.de_listings.find(d => d.de_listing_id === '900001').gvc_listed, true);

  /* a new DE listing never attaches to an old sold job at the same unit */
  db = fakeDb({ properties: [{ id: 'old', slug: 'old', stage: 'Sold', de_listing_id: null, kind: 'sale', core: { address: '100 Example St', unit: '4A' } }] });
  await applyRun({ client: db, report: report([{ id: '900010', folder: null }]), now: NOW, courtesy: gvc, rows: [row('900010')] });
  check('old sold job left alone', [db.T.properties.length, db.T.properties[0].stage, db.T.properties[0].de_listing_id], [2, 'Sold', null]);

  /* ---------- the whole sync on the made-up fixtures ---------- */
  const os = require('os'), fs = require('fs'), path = require('path');
  const { syncNow } = require('../helper/de-sync.js');
  db = fakeDb();
  out = await syncNow({ cfg: {}, client: db, courtesy: gvc, fixturesDir: path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic'),
    outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-sync-')), drive: false, lnks: [] });
  const starterDb = fakeDb();
  const starter = await syncNow({ cfg: { deAddsNew: false }, client: starterDb, courtesy: gvc, fixturesDir: path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic'),
    outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-sync-')), drive: false, lnks: [] });
  check('sync in starter mode adds no jobs', [starter.created, starterDb.T.properties.length], [0, 0]);
  check('sync: every live GVC listing a job', [out.created, db.T.properties.map(p => p.stage).sort()], [5, ['In contract', 'In contract', 'Live', 'Live', 'Live']]);
  check('sync: transactions remembered only', db.T.de_listings.length, 7);
  check('sync: run logged', [db.T.sync_runs.length, db.T.sync_runs[0].ok], [1, true]);
  db = fakeDb();
  let refused = null;
  try { await syncNow({ client: { ready: () => false }, fixturesDir: 'x' }); } catch (e) { refused = e.message; }
  check('sync: no account, nothing runs', /helper account/.test(refused || ''), true);
  refused = null;
  try { await syncNow({ fixturesDir: 'x', cfg: { helperEmail: 'h', helperPassword: 'p', supabaseUrl: 'https://x', publishableKey: 'k' } }); } catch (e) { refused = e.message; }
  check('sync: made-up listings never reach the real database', /made-up/.test(refused || ''), true);
  db = fakeDb();
  const SYN = path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic');
  const both = await Promise.all([1, 2].map(() => syncNow({ client: db, courtesy: gvc, fixturesDir: SYN, outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-sync-')), drive: false, lnks: [] })));
  check('sync: two at once run once', [db.T.sync_runs.length, both[0] === both[1]], [1, true]);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
