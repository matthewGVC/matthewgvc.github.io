/* ============================================================
   Tests for helper/dev-units.js: Elliman's units inside a development (Le Reve,
   Casa Avenida) made and moved as deals of that development (decision 72), and
   what the Overview and Errors page do with them. Against an in-memory fake,
   never the real database.

   Plain Node:  node scripts/test-dev-units.js
   ============================================================ */
'use strict';

process.env.GVC_HELPER_HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gvc-units-'));
const fs = require('fs'), os = require('os'), path = require('path');
const { syncDevUnits } = require('../helper/dev-units.js');
const { matchTask } = require('../helper/asana/link.js');
const W = require('../assets/js/workspace-data.js');
const M = require('../assets/js/match-check.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* ---------- an in-memory database with the helper client's shape ---------- */
function fakeDb(seed) {
  const T = { properties: [], changes: [], sync_runs: [], de_listings: [], dev_projects: [], places: [], buildings: [] };
  Object.keys(seed || {}).forEach(k => { T[k] = seed[k].map(r => Object.assign({ version: 1 }, r)); });
  let n = 0;
  const matches = (row, m) => Object.keys(m || {}).every(k => String(row[k]) === String(m[k]));
  return {
    T,
    ready: () => true,
    select: async (t, m) => T[t].filter(r => matches(r, m)).map(r => JSON.parse(JSON.stringify(r))),
    insert: async (t, rows) => [].concat(rows).map(r => { const x = Object.assign({ id: t + '-' + (++n), version: 1 }, r); T[t].push(x); return JSON.parse(JSON.stringify(x)); }),
    upsert: async (t, rows, key) => [].concat(rows).map(r => {
      const hit = T[t].find(x => x[key] === r[key]);
      if (hit) return Object.assign(hit, r);
      const x = Object.assign({}, r); T[t].push(x); return x;
    }),
    update: async (t, m, patch, o) => {
      const hits = T[t].filter(r => matches(r, m) && (!o || o.version === undefined || r.version === o.version));
      if (o && o.version !== undefined && !hits.length) { const e = new Error('conflict'); e.name = 'ConflictError'; throw e; }
      hits.forEach(r => { Object.assign(r, patch); if (r.version !== undefined) r.version++; });
      return hits;
    }
  };
}

const NOW = new Date('2026-11-05T07:00:00Z');
const LE_REVE = { id: 'd-lr', slug: 'le-reve', label: 'Le Reve', market: 'FL', archived_at: null };
const CASA = { id: 'd-ca', slug: 'casa-avenida', label: 'Casa Avenida', market: 'FL', archived_at: null };
// a de_listings row as the Elliman read keeps it (street as Elliman writes it)
function unit(id, u, status, extra) {
  return Object.assign({ de_listing_id: id, feed: 'featured', kind: 'sale', gvc_listed: true, ignored: false, property_id: null,
    raw: { street: '200 E BOCA RATON RD', unit: u, status, city: 'Boca Raton', state: 'FL' } }, extra);
}
function run(db) { const logged = []; return syncDevUnits(db, { now: NOW, log: m => logged.push(m) }).then(out => Object.assign(out, { logged })); }

(async () => {
  /* ---------- a unit on Elliman becomes a deal in its development ---------- */
  let db = fakeDb({ dev_projects: [LE_REVE, CASA], de_listings: [unit('7001', 'B', 'Active')] });
  let out = await run(db);
  const b = db.T.properties[0];
  check('Le Reve\'s Elliman unit is created', [out.created, out.moved, db.T.properties.length], [1, 0, 1]);
  check('Le Reve\'s Elliman unit: one deal in that development', [b.dev_project_id, b.asana_gid, b.stage, b.stage_source, b.de_listing_id, b.kind, b.market,
    b.folder_state, !!b.place_id, b.core],
    ['d-lr', null, 'Live', 'DE', '7001', 'sale', 'FL', 'unlinked', true, { address: '200 E Boca Raton Rd', unit: 'B', city: 'Boca Raton', state: 'FL' }]);
  check('Le Reve\'s Elliman unit: the Elliman row points at it', db.T.de_listings[0].property_id, b.id);
  check('Le Reve\'s Elliman unit: its place is in the development', db.T.places.map(p => [p.id === b.place_id, p.dev_project_id]), [[true, 'd-lr']]);
  check('Le Reve\'s Elliman unit: logged as found on Elliman, source DE', db.T.changes.map(c => [c.field, c.new_value, c.source]),
    [[null, null, 'DE'], ['stage', 'Live', 'DE'], ['kind', 'sale', 'DE']]);
  check('Le Reve\'s Elliman unit: nothing logged as a problem', out.logged, []);

  /* ---------- unit E: the E in "200 E Boca Raton Rd" is not the unit ---------- */
  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Active'), unit('7003', 'E', 'Active'),
    unit('7004', 'C', 'Active', { property_id: 'p-old' })],
  properties: [{ id: 'p-old', slug: 'old-slug', label: 'Old label', stage: 'Live', stage_source: 'DE', dev_project_id: 'd-lr', asana_gid: null, de_listing_id: '7004',
    kind: 'sale', core: { address: '200 E Boca Raton Rd', unit: 'C' } }] });
  await run(db);
  const byDe = id => db.T.properties.find(p => p.de_listing_id === id);
  check('unit E keeps its unit', [byDe('7003').slug, byDe('7003').label],
    ['200-e-boca-raton-rd-residence-e', '200 E Boca Raton Rd - E']);
  check('unit E keeps its unit: unit B differs', [byDe('7001').slug, byDe('7001').label],
    ['200-e-boca-raton-rd-residence-b', '200 E Boca Raton Rd - B']);
  check('an Elliman unit is named by the rule', byDe('7001').label, '200 E Boca Raton Rd - B');
  check('unit E keeps its unit: a place each', db.T.places.length, 2);
  check('an older unit is renamed on the next run', [byDe('7004').slug, byDe('7004').label,
    db.T.changes.filter(c => c.property_id === 'p-old').map(c => [c.field, c.old_value, c.new_value, c.note, c.source])],
    ['old-slug', '200 E Boca Raton Rd - C', [['label', 'Old label', '200 E Boca Raton Rd - C', 'Named by the naming rule', 'DE']]]);

  /* a slug someone already has gets the Elliman id on the end */
  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7123456', 'B', 'Active')],
    properties: [{ id: 'p-x', slug: '200-e-boca-raton-rd-residence-b', stage: 'Archived', kind: 'sale', core: { address: '200 E Boca Raton Rd', unit: 'B' } }] });
  await run(db);
  check('a slug clash gets a suffix', byDe('7123456').slug, '200-e-boca-raton-rd-residence-b-123456');

  /* Casa Avenida lists its units at 102 SE 5th Ave */
  db = fakeDb({ dev_projects: [LE_REVE, CASA], de_listings: [unit('7201', '2', 'Active', { raw: { street: '102 SE 5TH AVE', unit: '2', status: 'Active', city: 'Delray Beach', state: 'FL' } })] });
  await run(db);
  check('Casa Avenida\'s unit 2 joins Casa Avenida', [db.T.properties.length, db.T.properties[0].dev_project_id, db.T.properties[0].slug], [1, 'd-ca', '102-se-5th-ave-residence-2']);

  /* ---------- stage ---------- */
  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Pending'), unit('7002', 'C', 'ActiveUnderContract')] });
  await run(db);
  check('Pending and ActiveUnderContract read In contract', [byDe('7001').stage, byDe('7002').stage], ['In contract', 'In contract']);

  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Withdrawn'), unit('7002', 'C', 'Active'), unit('7003', 'E', 'Withdrawn', { property_id: 'p-e' })],
    properties: [{ id: 'p-e', slug: 'e', stage: 'Live', stage_source: 'DE', dev_project_id: 'd-lr', asana_gid: null, de_listing_id: '7003', kind: 'sale', core: {} }] });
  out = await run(db);
  check('an unknown status moves nothing and the rest still run', [out.created, out.moved, db.T.properties.length, byDe('7002').stage, byDe('7003').stage,
    db.T.de_listings.find(d => d.de_listing_id === '7001').property_id], [1, 0, 2, 'Live', 'Live', null]);
  check('an unknown status is logged, once a row', [out.logged.length, out.logged.every(l => /^dev units: .*Withdrawn/.test(l))], [2, true]);

  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Sold', { property_id: 'p-b' }), unit('7002', 'C', 'Rented', { kind: 'rental', property_id: 'p-c' })],
    properties: [{ id: 'p-b', slug: 'b', stage: 'Live', stage_source: 'DE', dev_project_id: 'd-lr', asana_gid: null, de_listing_id: '7001', kind: 'sale', label: '200 E Boca Raton Rd - B', core: { address: '200 E Boca Raton Rd', unit: 'B' } },
      { id: 'p-c', slug: 'c', stage: 'Live', stage_source: 'DE', dev_project_id: 'd-lr', asana_gid: null, de_listing_id: '7002', kind: 'rental', label: '200 E Boca Raton Rd - C', core: { address: '200 E Boca Raton Rd', unit: 'C' } }] });
  out = await run(db);
  check('Sold and Rented on Elliman archive', [out.moved, byDe('7001').stage, byDe('7002').stage, byDe('7001').stage_source], [2, 'Archived', 'Archived', 'DE']);
  check('Sold and Rented on Elliman archive: one changes row each', db.T.changes.map(c => [c.property_id, c.field, c.old_value, c.new_value, c.source]),
    [['p-b', 'stage', 'Live', 'Archived', 'DE'], ['p-c', 'stage', 'Live', 'Archived', 'DE']]);

  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'ActiveUnderContract', { property_id: 'p-b' }), unit('7002', 'C', 'ActiveUnderContract', { kind: 'rental', property_id: 'p-c' })],
    properties: [{ id: 'p-b', slug: 'b', stage: 'Live', stage_source: 'DE', dev_project_id: 'd-lr', asana_gid: null, de_listing_id: '7001', kind: 'sale', label: '200 E Boca Raton Rd - B', core: { address: '200 E Boca Raton Rd', unit: 'B' } },
      { id: 'p-c', slug: 'c', stage: 'Live', stage_source: 'DE', dev_project_id: 'd-lr', asana_gid: null, de_listing_id: '7002', kind: 'rental', label: '200 E Boca Raton Rd - C', core: { address: '200 E Boca Raton Rd', unit: 'C' } }] });
  await run(db);
  check('a move is logged in the stage\'s own words, never Elliman\'s code', db.T.changes.map(c => c.note), ['Elliman shows it In contract', 'Elliman shows it Lease signed']);

  /* ---------- left alone ---------- */
  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7301', '1', 'Active', { raw: { street: '12 OTHER ST', unit: '1', status: 'Active', city: 'Boca Raton', state: 'FL' } })] });
  out = await run(db);
  check('a street that\'s no development\'s is left alone', [out.created, db.T.properties.length, db.T.places.length], [0, 0, 0]);

  db = fakeDb({ dev_projects: [Object.assign({}, LE_REVE, { archived_at: '2026-10-01T00:00:00Z' })], de_listings: [unit('7001', 'B', 'Active')] });
  out = await run(db);
  check('an archived development makes nothing', [out.created, db.T.properties.length], [0, 0]);

  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Active', { gvc_listed: false }), unit('7002', 'C', 'Active', { ignored: true })] });
  out = await run(db);
  check('not ours, or set aside: nothing made', [out.created, db.T.properties.length], [0, 0]);

  /* ---------- run twice, nothing new ---------- */
  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Active'), unit('7002', 'C', 'Sold')] });
  await run(db);
  const counts = () => [db.T.properties.length, db.T.places.length, db.T.changes.length, db.T.properties.map(p => p.version)];
  const first = counts();
  out = await run(db);
  check('run twice, nothing new', [out.created, out.moved, counts()], [0, 0, first]);

  /* ---------- a later Asana task takes it over ---------- */
  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Active')] });
  await run(db);
  const made = db.T.properties[0];
  check('a later Asana task takes it over: matchTask finds the unit', matchTask({ gid: 'g-b', name: '200 E Boca Raton Rd - B', fields: {} },
    { properties: db.T.properties, pitches: [] }, 'listing'), { propertyId: made.id });
  made.asana_gid = 'g-b'; made.stage_source = 'Asana';
  db.T.de_listings[0].raw.status = 'Sold';
  out = await run(db);
  check('a later Asana task takes it over: Elliman no longer moves its stage', [out.moved, made.stage], [0, 'Live']);

  /* ---------- the Overview and the Errors page ---------- */
  const deal = { id: 'p-u', slug: '200-e-boca-raton-rd-residence-b', label: '200 E Boca Raton Rd, Residence B', kind: 'sale', market: 'FL', stage: 'Live',
    stage_source: 'DE', dev_project_id: 'd-lr', asana_gid: null, de_listing_id: '7001', folder_state: 'unlinked', core: { address: '200 E Boca Raton Rd', unit: 'B' } };
  const flagsOf = p => (W.buildJobs({ properties: [p], pitches: [], devProjects: [], changes: [] }, '2026-11-05')[0] || {}).flags;
  check('no Link folder flag', [flagsOf(deal), flagsOf(Object.assign({}, deal, { asana_gid: 'g-1' })).map(f => f.k)], [[], ['link']]);
  check('no Errors lines', [M.check(deal, { now: NOW }), M.check(Object.assign({}, deal, { asana_gid: 'g-1', asana: { gone: NOW } }), { now: NOW }).length > 0], [[], true]);

  /* ---------- Sync now makes the units too (helper/de-sync.js) ---------- */
  const { syncNow } = require('../helper/de-sync.js');
  const SYN = path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic');
  const gvc = async () => ({ gvcListed: true, line: 'Douglas Elliman: Test Agent' });
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-units-sync-'));
  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Active')] });
  out = await syncNow({ cfg: {}, client: db, courtesy: gvc, fixturesDir: SYN, outDir: tmp(), drive: false, lnks: [] });
  check('Sync now makes the units too', [out.report.ok, db.T.properties.filter(p => p.dev_project_id === 'd-lr').length, typeof out.changes], [true, 1, 'number']);
  const bad = tmp();
  fs.readdirSync(SYN).filter(f => f.endsWith('.json')).forEach(f => fs.copyFileSync(path.join(SYN, f), path.join(bad, f)));
  const p1 = path.join(bad, 'featured-sale-p1.json'), j = JSON.parse(fs.readFileSync(p1, 'utf8'));
  j.totalCount = (j.totalCount || 0) + 5;
  fs.writeFileSync(p1, JSON.stringify(j));
  db = fakeDb({ dev_projects: [LE_REVE], de_listings: [unit('7001', 'B', 'Active')] });
  out = await syncNow({ cfg: {}, client: db, courtesy: gvc, fixturesDir: bad, outDir: tmp(), drive: false, lnks: [] });
  check('Sync now makes the units too: an aborted read makes none', [out.report.ok, db.T.properties.length, db.T.de_listings[0].property_id], [false, 0, null]);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
