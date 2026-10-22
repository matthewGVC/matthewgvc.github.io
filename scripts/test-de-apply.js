/* ============================================================
   Tests for the DE sync's writer (helper/de/apply.js): what one DE run
   changes in the database, against an in-memory fake (never the real one).

   Plain Node:  node scripts/test-de-apply.js
   ============================================================ */
'use strict';

// never this computer's own helper settings (they may be in starter mode)
process.env.GVC_HELPER_HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gvc-apply-'));
const deApply = require('../helper/de/apply.js');
const { applyRun } = deApply;
const F = require('../assets/js/job-facts.js');
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
  /* ---------- DE no longer moves the stage (D50, S8): no stage rules left ---------- */
  check('no stage rules exported', typeof deApply.canMove, 'undefined');

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
  check('stage left alone, DE stage recorded', [p1.stage, p1.stage_source, p1.de_stage], ['Live', undefined, 'In contract']);
  check('de snapshot', [p1.de.status, p1.de_status, p1.de.listingUrl], ['ActiveUnderContract', 'ActiveUnderContract', 'https://example.com/l/900001']);
  const fields = db.T.changes.filter(c => c.source !== 'match').map(c => c.field).sort();
  check('changes logged', fields, ['de_stage', 'price', 'sqft']);
  const pc = db.T.changes.find(c => c.field === 'price');
  check('price change row', [pc.old_value, pc.new_value, pc.source, pc.run_id, pc.property_id, /9\.1%/.test(pc.note)], [1100000, 1000000, 'DE', db.T.sync_runs[0].id, 'p1', true]);
  check('run logged ok', [db.T.sync_runs[0].ok, db.T.sync_runs[0].changes], [true, 3]);
  check('de_listings cached', db.T.de_listings.map(d => [d.de_listing_id, d.property_id]), [['900001', 'p1']]);

  /* the same run again changes nothing */
  const before = db.T.changes.length;
  await applyRun({ client: db, report: report([{ id: '900001', folder: null }]), now: NOW, courtesy: gvc,
    rows: [row('900001', { status: 'ActiveUnderContract', stage: 'In contract', price: 1000000, priceChangePercent: -9.1 })] });
  check('second run: no new changes', db.T.changes.length, before);

  /* ---------- a library row (no stage): DE's facts and DE's stage, never a stage ---------- */
  db = fakeDb({ properties: [{ id: 'lib1', slug: 'lib', stage: null, de_listing_id: '900001', kind: 'sale', core: { address: '100 Example St', unit: '4A', price: 1100000 } }] });
  await applyRun({ client: db, report: report([{ id: '900001', folder: null }]), now: NOW, courtesy: gvc, rows: [row('900001')] });
  check('library row keeps off the overview (no stage)', [db.T.properties[0].stage, db.T.changes.some(c => c.field === 'stage')], [null, false]);
  check('library row gets DE\'s stage and price', [db.T.properties[0].de_stage, db.T.properties[0].core.price], ['Live', 1000000]);

  /* ---------- a new GVC listing on DE is remembered, never a job (D54: jobs come from Asana) ---------- */
  db = fakeDb();
  out = await applyRun({ client: db, report: report([{ id: '900002', folder: 'GVC - New York/Building Information/100 Example St/4A', via: 'lnk' }]),
    now: NOW, courtesy: gvc, rows: [row('900002')] });
  check('DE never creates a job', [out.created, db.T.properties.length, db.T.changes.length], [0, 0, 0]);
  check('the GVC listing is kept in de_listings', [db.T.de_listings.length, db.T.de_listings[0].de_listing_id, db.T.de_listings[0].property_id || null], [1, '900002', null]);
  check('courtesy cached (the M2 evidence)', [db.T.de_listings[0].gvc_listed, db.T.de_listings[0].courtesy], [true, 'Douglas Elliman: Test Agent']);
  /* an old starter-mode setting changes nothing */
  db = fakeDb();
  out = await applyRun({ client: db, report: report([{ id: '900002', folder: null }]), now: NOW, addNew: true, courtesy: gvc, rows: [row('900002')] });
  check('addNew is ignored', [out.created, db.T.properties.length], [0, 0]);

  /* ---------- deepen: DE's zip, neighbourhood and property label are kept (M26) ---------- */
  const { normalize } = require('../helper/de/normalize.js');
  const nz = normalize({ coreListingId: 7, propertyLabel: 'Co-op', address: { postalCode: null, neighborhood: 'Lenox Hill', unitNumber: '2B',
    samlsFullAddress: '1 EXAMPLE ST 2B, New York, NY 10021', samlsPartialAddress: '1 EXAMPLE ST 2B' } }, 'featured-sale');
  check('deepen normalize: zip, neighbourhood and property label', [nz.zip, nz.neighborhood, nz.propertyLabel], ['10021', 'Lenox Hill', 'Co-op']);
  db = fakeDb({ properties: [{ id: 'pz', slug: 'z', stage: 'Live', de_listing_id: '900001', kind: 'sale', core: { address: '100 Example St', unit: '4A' } }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, roster: [], initials: {}, rows: [row('900001', { propertyLabel: 'Condo' })] });
  check('deepen snapshot: the job\'s DE snapshot keeps zip, neighbourhood and property label', [db.T.properties[0].de.zip, db.T.properties[0].de.neighborhood, db.T.properties[0].de.propertyLabel], ['10001', 'Testville', 'Condo']);
  check('deepen snapshot: so does de_listings.raw', [db.T.de_listings[0].raw.zip, db.T.de_listings[0].raw.neighborhood, db.T.de_listings[0].raw.propertyLabel], ['10001', 'Testville', 'Condo']);

  /* ---------- deepen: the Match pass sees this run's DE listings with no job (M19) and the stageless rows (M20) ---------- */
  db = fakeDb({ properties: [
    { id: 'pj', slug: 'j', stage: 'Live', kind: 'sale', core: { address: '100 Example St', unit: '5B' }, folder_state: 'linked', drive_folder: 'x',
      asana: { gid: '1', name: '100 Example St - 5B', status: 'Active', section: 'Active', stageFromStatus: 'Live', stageFromSection: 'Live', statusSince: '2026-09-01', fields: {} } },
    { id: 'old', slug: 'old', label: '100 Example St, Residence 5B', stage: null, core: { address: '100 Example St', unit: '5B' } }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, roster: [], initials: {}, rows: [row('900077', { unit: '4A' })] });
  const mj = ((db.T.properties[0].match || {}).list || []).map(m => m.key);
  check('deepen: M19 from this run\'s DE listing, M20 from the stageless row, no M2 half', [mj.indexOf('M19:900077') !== -1, mj.indexOf('M20:old') !== -1, mj.indexOf('M2:live') !== -1], [true, true, false]);

  /* ---------- an open Asana-made job at the same unit gets DE's id ---------- */
  db = fakeDb({ properties: [{ id: 'a1', slug: 'a1', stage: 'Live', stage_source: 'Asana', asana_gid: '9000000000041', kind: 'sale', core: { address: '100 Example St', unit: '4A', price: 990000 } }] });
  await applyRun({ client: db, report: report([{ id: '900002', folder: null }]), now: NOW, courtesy: gvc, rows: [row('900002')] });
  check('matched by address: DE id, DE stage, Asana stage kept', [db.T.properties[0].de_listing_id, db.T.properties[0].de_stage, db.T.properties[0].stage, db.T.properties[0].stage_source],
    ['900002', 'Live', 'Live', 'Asana']);

  /* ---------- D78: Matt's typed price holds while DE's own price hasn't moved ---------- */
  const mattFacts = { price: { value: 2250000, source: 'Matt', bySource: { DE: 2400000, Matt: 2250000 } } };
  db = fakeDb({ properties: [{ id: 'm1', slug: 'm1', stage: 'Live', de_listing_id: '900001', kind: 'sale', core: { address: '100 Example St', unit: '4A', price: 2250000, facts: mattFacts } }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, rows: [row('900001', { price: 2400000 })] });
  check('Matt kept while DE unchanged', [db.T.properties[0].core.price, db.T.properties[0].core.facts.price.source, db.T.changes.some(c => c.field === 'price')], [2250000, 'Matt', false]);
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, rows: [row('900001', { price: 2300000 })] });
  const tookOver = db.T.changes.find(c => c.field === 'price');
  check('DE\'s own change takes over, logged', [db.T.properties[0].core.price, db.T.properties[0].core.facts.price.source, tookOver && tookOver.old_value, tookOver && tookOver.new_value],
    [2300000, 'DE', 2250000, 2300000]);
  check('DE facts keep their sources', db.T.properties[0].core.facts.beds, { value: 2, source: 'DE', bySource: { DE: 2 } });
  /* a builder's save changes core.price, not the facts record: it is Matt's, and DE's unchanged price leaves it */
  db.T.properties[0].core.price = 2275000;
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, rows: [row('900001', { price: 2300000 })] });
  check('a tool edit holds over DE\'s unchanged value', [db.T.properties[0].core.price, db.T.properties[0].core.facts.price.source], [2275000, 'Matt']);

  /* a new listing that isn't GVC's is remembered, not created */
  db = fakeDb();
  await applyRun({ client: db, report: report([{ id: '900003', folder: null }]), now: NOW, courtesy: notGvc, rows: [row('900003')] });
  check('not GVC: no job', db.T.properties.length, 0);
  check('not GVC: remembered', db.T.de_listings[0].gvc_listed, false);
  let asked = 0;
  await applyRun({ client: db, report: report([{ id: '900003', folder: null }]), now: NOW, courtesy: async () => { asked++; return { gvcListed: true }; }, rows: [row('900003')] });
  check('not GVC: never asked again', [asked, db.T.properties.length], [0, 0]);

  /* ---------- Match is stored after a DE run (spec §5) ---------- */
  db = fakeDb({ properties: [{ id: 'mm1', slug: 'mm1', stage: 'Live', stage_source: 'Asana', de_listing_id: '900001', kind: 'sale',
    drive_folder: 'GVC - New York/Building Information/100 Example St/4A', folder_state: 'linked',
    asana: { gid: '1', name: '100 Example St - 4A', status: 'Active', section: 'Active', stageFromStatus: 'Live', stageFromSection: 'Live',
      fields: { 'Listing Status': 'Active', '🗓️ Listing Date': '2026-09-01', '🛜 Elliman Link': 'x', '🛜 Google Drive Link': 'y' } },
    core: { address: '100 Example St', unit: '4A' } }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, roster: [], initials: {},
    rows: [row('900001', { status: 'ActiveUnderContract', stage: 'In contract' })] });
  const mm = db.T.properties[0].match;
  check('match after DE: DE ahead of Asana is M1', ((mm || {}).list || []).map(m => [m.code, m.text, m.fixAt]), [['M1', 'DE says In contract; Asana still says Live.', 'Asana']]);
  check('match after DE: found logged as match', db.T.changes.filter(c => c.source === 'match').map(c => c.new_value), ['M1']);
  const before2 = db.T.changes.length;
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, roster: [], initials: {},
    rows: [row('900001', { status: 'ActiveUnderContract', stage: 'In contract' })] });
  check('match after DE: the same run again stores nothing new', db.T.changes.length, before2);

  /* ---------- sold: only by the listing's own DE id ---------- */
  db = fakeDb({ properties: [{ id: 'p1', slug: 's', stage: 'In contract', de_listing_id: '900001', kind: 'sale', core: { address: '100 Example St', unit: '4A', price: 1000000 } }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, rows: [
    row('900001', { feed: 'transactions', status: 'Sold', stage: 'Sold', closePrice: 950000, closeDate: '2026-10-01' }),
    row('777777', { feed: 'transactions', status: 'Sold', stage: 'Sold', closePrice: 500000 })   // an old sale of the same unit
  ] });
  check('sold: DE stage and close recorded, stage left to Asana', [db.T.properties[0].stage, db.T.properties[0].de_stage, db.T.properties[0].core.closePrice, db.T.properties[0].core.closeDate],
    ['In contract', 'Sold', 950000, '2026-10-01']);
  check('old sale of the same unit ignored', db.T.properties.length, 1);
  check('transactions never create jobs (D31)', db.T.de_listings.find(d => d.de_listing_id === '777777').property_id || null, null);

  /* ---------- tune-up B2: DE's closeDate is kept in the job's DE snapshot (M5 compares closing dates) ---------- */
  check('B2: the sold row puts DE\'s closeDate in the job\'s DE snapshot', db.T.properties[0].de.closeDate, '2026-10-01');
  db = fakeDb({ properties: [{ id: 'p1', slug: 's', stage: 'Live', de_listing_id: '900001', kind: 'sale', core: { price: 1000000 } }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, rows: [row('900001')] });
  check('B2: a row with no closeDate adds no closeDate key', 'closeDate' in db.T.properties[0].de, false);
  db = fakeDb({ properties: [{ id: 'p1', slug: 's', stage: 'Sold', de_listing_id: '900001', kind: 'sale', core: { price: 950000 },
    milestones: { closedOn: { on: '2026-09-20', planned: false } },
    asana: { gid: '1', name: '100 Example St - 4A', status: 'Complete', section: 'Complete', stageFromStatus: 'Sold', stageFromSection: 'Sold', fields: {} } }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, roster: [], initials: {},
    rows: [row('900001', { feed: 'transactions', status: 'Sold', stage: 'Sold', closePrice: 950000, closeDate: '2026-10-01' })] });
  check('B2: after a DE run M5 compares Asana Closing with DE closeDate', ((db.T.properties[0].match || {}).list || []).filter(m => m.code === 'M5').map(m => m.text),
    ['Asana says closing on 20 Sep; DE says 1 Oct.']);

  /* ---------- tune-up B1: the stored match is read back, and its waiting day kept ---------- */
  const b1Job = extra => Object.assign({ id: 'w1', slug: 'w1', stage: 'In contract', stage_source: 'Asana', de_listing_id: '900001', kind: 'sale', de_stage: 'Live',
    milestones: {}, core: { address: '100 Example St', unit: '4A' },
    asana: { gid: '1', name: '100 Example St - 4A', status: 'In Contract', section: 'In Contract', stageFromStatus: 'In contract', stageFromSection: 'In contract', statusSince: null, fields: { '🗓️ CS Date': '2026-09-01' } } }, extra);   // its CS Date is there (M23 is not under test)
  db = fakeDb({ properties: [b1Job()] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, roster: [], initials: {}, rows: [row('900001')] });
  const w1 = db.T.properties[0];
  check('B1: Asana ahead with no status date waits, and the day is stored', [((w1.match || {}).list || []).filter(m => m.code === 'M1').length, (w1.match || {}).waiting], [0, { M1: '2026-10-20' }]);
  db = fakeDb({ properties: [b1Job({ match: { list: [], dismissed: {}, waiting: { M1: '2026-10-01' } } })] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, roster: [], initials: {}, rows: [row('900001')] });
  const w2 = db.T.properties[0];
  check('B1: a stored waiting day past the grace fires M1 from that day', [((w2.match || {}).list || []).filter(m => m.code === 'M1').map(m => m.since), (w2.match || {}).waiting || {}],
    [['2026-10-01'], {}]);
  db = fakeDb({ properties: [b1Job({ match: { list: [], dismissed: {}, waiting: { M1: '2026-10-10' } } })] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc, roster: [], initials: {}, rows: [row('900001')] });
  check('B1: a stored waiting day inside the grace is kept as it was', (db.T.properties[0].match || {}).waiting, { M1: '2026-10-10' });

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
  check('old sold job left alone', [db.T.properties.length, db.T.properties[0].stage, db.T.properties[0].de_listing_id], [1, 'Sold', null]);

  /* ---------- the whole sync on the made-up fixtures ---------- */
  const os = require('os'), fs = require('fs'), path = require('path');
  const { syncNow } = require('../helper/de-sync.js');
  db = fakeDb();
  out = await syncNow({ cfg: {}, client: db, courtesy: gvc, fixturesDir: path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic'),
    outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-sync-')), drive: false, lnks: [] });
  const starterDb = fakeDb();
  const starter = await syncNow({ cfg: { deAddsNew: false }, client: starterDb, courtesy: gvc, fixturesDir: path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic'),
    outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-sync-')), drive: false, lnks: [] });
  check('sync: the retired deAddsNew setting changes nothing', [starter.created, starterDb.T.properties.length, starterDb.T.de_listings.length], [0, 0, 7]);
  check('sync: DE adds no jobs', [out.created, db.T.properties.length], [0, 0]);
  check('sync: every DE listing remembered', [db.T.de_listings.length, db.T.de_listings.filter(d => d.gvc_listed).length], [7, 5]);
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

  /* ---------- Link by hand (tune-up A) ---------- */
  // a GVC listing with no job keeps its address on the cache row, so the Match page can find the job it belongs to
  db = fakeDb();
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc,
    rows: [row('930001', { street: '1006 PHEASANT LN', unit: '204', city: 'Wall', state: 'NJ' })] });
  const cachedA = db.T.de_listings.find(d => d.de_listing_id === '930001');
  check('hand link: the cache row keeps the street, unit, city and state', [cachedA.raw.street, cachedA.raw.unit, cachedA.raw.city, cachedA.raw.state], ['1006 PHEASANT LN', '204', 'Wall', 'NJ']);
  // a job Matt linked by hand (its address doesn't match DE's) is found by its stored DE id; a listing set aside stays set aside
  db = fakeDb({
    properties: [{ id: 'pw', slug: '1006-pheasant-ln-wall', stage: 'Live', kind: 'sale', de_listing_id: '930001', core: { address: '1006 Pheasant Ln, Wall', price: 900000 } }],
    de_listings: [{ de_listing_id: '930001', feed: 'featured', kind: 'sale', gvc_listed: true, property_id: 'pw', raw: {} },
      { de_listing_id: '930002', feed: 'featured', kind: 'sale', gvc_listed: true, property_id: null, ignored: true, raw: {} }] });
  await applyRun({ client: db, report: report([]), now: NOW, courtesy: gvc,
    rows: [row('930001', { street: '1006 PHEASANT LN', unit: '204', city: 'Wall', state: 'NJ', price: 950000 }), row('930002', { street: '9 OTHER RD', unit: '' })] });
  const pw = db.T.properties.find(p => p.id === 'pw');
  check('hand link: the stored DE id is used, and the job filled in', [pw.core.price, pw.de.price, pw.de_listing_id], [950000, 950000, '930001']);
  check('hand link: the job snapshot carries no address', 'street' in pw.de, false);
  check('hand link: the cache row stays on the job', db.T.de_listings.find(d => d.de_listing_id === '930001').property_id, 'pw');
  check('not ours: a listing set aside stays set aside after a run', db.T.de_listings.find(d => d.de_listing_id === '930002').ignored, true);

  /* ---------- DE page facts (D47, S20) ---------- */
  {
    const PF = require('../helper/de/page-facts.js'), fsx = require('fs'), pathx = require('path');
    const fx = n => fsx.readFileSync(pathx.join(__dirname, '..', 'helper', 'fixtures', 'synthetic', n), 'utf8');
    check('page facts: condo page, co-op type', PF.parsePageFacts(fx('de-page-condo.txt'), 'Co-op'),
      { taxesMonthly: 1234, maintenance: 2345, yearBuilt: 1987, mlsId: '12345678' });
    check('page facts: condo type reads common charges; text after SIMILAR LISTINGS ignored', PF.parsePageFacts(fx('de-page-condo.txt'), 'Condo'),
      { taxesMonthly: 1234, commonCharges: 2345, yearBuilt: 1987, mlsId: '12345678' });
    check('page facts: house page has a lot size in DE\'s words', PF.parsePageFacts(fx('de-page-house.txt'), ['Single family']),
      { taxesMonthly: 1234, commonCharges: 150, lotSize: '0.35 Acres', yearBuilt: 1962, mlsId: 'R7770001' });
    check('page facts: labels in any case', PF.parsePageFacts('$99 monthly tax LOT SIZE 2 acres', 'Condo'), { taxesMonthly: 99, lotSize: '2 acres' });
    /* final review 2: money is read value-then-label only; a label followed by the next value is not its value */
    check('page facts: label-first money is never read', 'commonCharges' in PF.parsePageFacts('Monthly Maintenance/CC $1,234 Monthly Tax', 'Condo'), false);
    /* final review 10: no property type, no maintenance or common charges */
    check('page facts: unknown property type keeps maintenance and common charges out', [null, undefined, '', []].map(t => {
      const o = PF.parsePageFacts(fx('de-page-condo.txt'), t); return ['maintenance' in o, 'commonCharges' in o, o.taxesMonthly];
    }), [[false, false, 1234], [false, false, 1234], [false, false, 1234], [false, false, 1234]]);
    /* final review 9: only DE's own https pages are opened */
    {
      const went = [], fakePage = { goto: async u => { went.push(u); }, evaluate: async () => 'DETAILS $5 Monthly Tax' };
      const tries = ['http://www.elliman.com/x', 'https://elliman.com.evil.example/x', 'https://evil.example/elliman.com', 'javascript:alert(1)', 'https://www.elliman.com/new-york-city/1-x'];
      const res = [];
      for (const u of tries) res.push(await PF.readPageFacts(fakePage, { listingUrl: u }, 'Condo').then(x => x.taxesMonthly, e => /https page on elliman\.com/.test(e.message) ? 'refused' : e.message));
      check('page facts: only https elliman.com pages opened', [res, went], [['refused', 'refused', 'refused', 'refused', 5], ['https://www.elliman.com/new-york-city/1-x']]);
    }
    check('page facts: no lot on the page, home Sq Ft never a lot, alphanumeric id', PF.parsePageFacts(fx('de-page-nolot.txt'), 'Single family'), { commonCharges: 700, yearBuilt: 2025, mlsId: 'R1115' });
    check('page facts: Sq Ft lot', PF.parsePageFacts('DETAILS 2,000 Sq Ft Single Family 7,500 Sq Ft Lot Built in 2001', 'Single family'), { lotSize: '7,500 Sq Ft', yearBuilt: 2001 });
    check('page facts: label-first lot size still read', PF.parsePageFacts('Lot Size: 0.5 acres.', 'Condo'), { lotSize: '0.5 acres' });
    check('page facts: nothing to read', PF.parsePageFacts('hello', 'Condo'), {});
    const T0 = new Date('2026-10-20T07:00:00Z'), job = (de) => ({ de });
    check('needsPage: never read', PF.needsPage(job({}), { price: 5 }, T0), true);
    check('needsPage: read today at the same price', PF.needsPage(job({ pageFactsAt: '2026-10-19T07:00:00Z', pageFactsPrice: 5 }), { price: 5 }, T0), false);
    check('needsPage: price changed since', PF.needsPage(job({ pageFactsAt: '2026-10-19T07:00:00Z', pageFactsPrice: 5 }), { price: 4 }, T0), true);
    check('needsPage: a week old', PF.needsPage(job({ pageFactsAt: '2026-10-13T07:00:00Z', pageFactsPrice: 5 }), { price: 5 }, T0), true);
    check('needsPage: six days old', PF.needsPage(job({ pageFactsAt: '2026-10-14T07:00:00Z', pageFactsPrice: 5 }), { price: 5 }, T0), false);

    const mk = (core, de) => fakeDb({ properties: [{ id: 'pf', slug: 'pf', stage: 'Live', kind: 'sale', de_listing_id: '900001', de: de || null,
      core: Object.assign({ address: '100 Example St', unit: '4A', propertyType: 'Co-op', price: 1000000, beds: 2, baths: 2, sqft: 1200, halfBaths: 0 }, core) }] });
    let asked = 0;
    const page = async (r, type) => { asked++; return PF.parsePageFacts(fx('de-page-condo.txt'), type); };
    const run = (d, pf, when) => applyRun({ client: d, report: report([{ id: '900001' }]), now: when || NOW, courtesy: gvc, rows: [row('900001')], pageFacts: pf });

    // DE's page value replaces the doc's, at DE's rank; each change logged
    let d = mk({ maintenance: 1800, facts: { maintenance: { value: 1800, source: 'doc', bySource: { doc: 1800 } } } });
    await run(d, page);
    let c = d.T.properties[0].core;
    check('apply: DE page replaces the doc value', [c.maintenance, c.facts.maintenance.source, c.taxesMonthly, c.yearBuilt, c.mlsId, c.commonCharges], [2345, 'DE', 1234, 1987, '12345678', undefined]);
    check('apply: each page change logged as DE', d.T.changes.filter(x => x.source === 'DE' && ['maintenance', 'taxesMonthly', 'yearBuilt', 'mlsId'].includes(x.field)).length, 4);
    check('apply: stamp kept in the snapshot', [d.T.properties[0].de.pageFactsAt, d.T.properties[0].de.pageFactsPrice], [NOW.toISOString(), 1000000]);

    // the next day: not asked again, stamp survives the snapshot rewrite
    asked = 0;
    await run(d, page, new Date('2026-10-21T07:00:00Z'));
    check('apply: not asked again within a week at the same price', [asked, d.T.properties[0].de.pageFactsAt], [0, NOW.toISOString()]);
    await run(d, page, new Date('2026-10-28T07:00:00Z'));
    check('apply: asked again after a week', asked, 1);

    // Matt's typed value holds while DE repeats, and warns (D78)
    d = mk({ maintenance: 2000, facts: { maintenance: { value: 2000, source: 'Matt', bySource: { Matt: 2000, DE: 2345 } } } });
    await run(d, page);
    c = d.T.properties[0].core;
    check('apply: Matt\'s value holds while DE repeats', [c.maintenance, c.facts.maintenance.source, F.warnOf(c.facts.maintenance)], [2000, 'Matt', { source: 'DE', value: 2345 }]);
    check('apply: no maintenance change logged', d.T.changes.some(x => x.field === 'maintenance'), false);
    // DE's page value changes: DE takes over, with the note
    d = mk({ maintenance: 2000, facts: { maintenance: { value: 2000, source: 'Matt', bySource: { Matt: 2000, DE: 2100 } } } });
    await run(d, page);
    check('apply: DE\'s new page value replaces Matt\'s with a note', [d.T.properties[0].core.maintenance, d.T.changes.find(x => x.field === 'maintenance').note], [2345, 'DE\'s own value changed, so it replaces the one Matt typed']);
    // a value already in core with no record is an earlier tool's, which DE outranks
    d = mk({ taxesMonthly: 999 });
    await run(d, page);
    check('apply: an earlier-tool value in core is replaced by DE page', [d.T.properties[0].core.taxesMonthly, d.T.properties[0].core.facts.taxesMonthly.source, d.T.properties[0].core.facts.taxesMonthly.bySource.legacy], [1234, 'DE', 999]);

    // a page that fails to load is logged and skipped, never fatal; the other facts still sync and it is retried next run
    d = mk({ price: 900000 });
    out = await run(d, async () => { throw new Error('timeout'); });
    check('apply: a failed page is logged, the run goes on', [out.errors.map(e => e.what), d.T.properties[0].core.price, d.T.sync_runs[0].ok, d.T.properties[0].de.pageFactsAt], [['page'], 1000000, true, undefined]);
    // no pageFacts function: nothing asked
    d = mk({});
    await run(d, undefined);
    check('apply: without a page reader nothing changes', [d.T.properties[0].core.taxesMonthly, d.T.properties[0].de.pageFactsAt], [undefined, undefined]);
    // sold feed rows never ask
    asked = 0; d = mk({});
    await applyRun({ client: d, report: report([]), now: NOW, courtesy: gvc, rows: [row('900001', { feed: 'transactions', status: 'Sold', stage: 'Sold', closePrice: 1 })], pageFacts: page });
    check('apply: sold rows never open a page', asked, 0);
  }

  /* ---------- DE's 0 sq ft and 0 baths mean "not known" (M4's rule, slice3 tune-up 2) ---------- */
  {
    // a new link: DE's 0 sq ft is never stored as a fact; Asana's figure stays shown
    let d = fakeDb({ properties: [{ id: 'z1', slug: 'z1', stage: 'Live', de_listing_id: '900001', kind: 'sale',
      core: { address: '100 Example St', unit: '4A', sqft: 1200, facts: { sqft: { value: 1200, source: 'Asana', bySource: { Asana: 1200 } } } } }] });
    await applyRun({ client: d, report: report([{ id: '900001', folder: null }]), now: NOW, courtesy: gvc, rows: [row('900001', { sqft: 0, baths: 0, beds: 0 })] });
    const z = d.T.properties[0];
    check('DE 0 sq ft: Asana\'s figure stays, DE\'s 0 is not kept', [z.core.sqft, z.core.facts.sqft.source, 'DE' in z.core.facts.sqft.bySource], [1200, 'Asana', false]);
    check('DE 0 baths: no fact stored, no change logged', [z.core.baths, z.core.facts.baths, d.T.changes.some(c => c.field === 'baths' || c.field === 'sqft')], [undefined, undefined, false]);
    check('DE 0 beds: a studio, kept', [z.core.beds, z.core.facts.beds.source], [0, 'DE']);
    // an older run stored DE's 0 as the fact: the next run drops it and logs it once
    d = fakeDb({ properties: [{ id: 'z2', slug: 'z2', stage: 'Live', de_listing_id: '900001', kind: 'sale',
      core: { address: '100 Example St', unit: '4A', price: 1000000, beds: 2, baths: 2, halfBaths: 0, sqft: 0,
        facts: { sqft: { value: 0, source: 'DE', bySource: { DE: 0, Asana: 950 } } } } }] });
    await applyRun({ client: d, report: report([{ id: '900001', folder: null }]), now: NOW, courtesy: gvc, rows: [row('900001', { sqft: 0 })] });
    const z2 = d.T.properties[0], zc = d.T.changes.filter(c => c.field === 'sqft');
    check('stored DE 0 sq ft is dropped, Asana shows', [z2.core.sqft, z2.core.facts.sqft], [950, { value: 950, source: 'Asana', bySource: { Asana: 950 } }]);
    check('the drop is logged once', [zc.length, zc[0] && zc[0].old_value, zc[0] && zc[0].new_value, zc[0] && zc[0].source], [1, 0, 950, 'DE']);
    const n = d.T.changes.filter(c => c.source !== 'match').length;
    await applyRun({ client: d, report: report([{ id: '900001', folder: null }]), now: NOW, courtesy: gvc, rows: [row('900001', { sqft: 0 })] });
    check('next run: nothing more to drop', d.T.changes.filter(c => c.source !== 'match').length, n);
    // stored DE 0 with nothing else: the fact and core value go
    d = fakeDb({ properties: [{ id: 'z3', slug: 'z3', stage: 'Live', de_listing_id: '900001', kind: 'sale',
      core: { address: '100 Example St', unit: '4A', sqft: 0, facts: { sqft: { value: 0, source: 'DE', bySource: { DE: 0 } } } } }] });
    await applyRun({ client: d, report: report([{ id: '900001', folder: null }]), now: NOW, courtesy: gvc, rows: [row('900001', { sqft: 0 })] });
    check('stored DE 0 sq ft alone: fact and value removed', ['sqft' in d.T.properties[0].core, 'sqft' in d.T.properties[0].core.facts], [false, false]);
  }

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
