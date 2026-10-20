/* ============================================================
   Tests for the seed planner (helper/seed.js): which jobs the overview
   starts with (spec §2.6, D31 "only what's active now"), on made-up DE rows
   and made-up Drive folder names.

   Plain Node:  node scripts/test-seed.js
   ============================================================ */
'use strict';

const { buildPlan, parsePitch, applyPlan } = require('../helper/seed.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* ---------- pitch folder names ---------- */
check('dash unit', parsePitch('2026-06-08 1050 Park Ave - 13C'), { date: '2026-06-08', street: '1050 Park Ave', unit: '13C' });
check('comma apt', parsePitch('2025-7-1 370 Riverside Dr, Apt. 12C'), { date: '2025-07-01', street: '370 Riverside Dr', unit: '12C' });
check('hash unit', parsePitch('2025-3-31 105 Norfolk #15'), { date: '2025-03-31', street: '105 Norfolk', unit: '15' });
check('unit after street type', parsePitch('2026-02-9 60 East 9th St 428'), { date: '2026-02-09', street: '60 East 9th St', unit: '428' });
check('no unit', parsePitch('2026-05-27 450 East 83 St'), { date: '2026-05-27', street: '450 East 83 St', unit: '' });
check('no unit, no type', parsePitch('2026-1-13 1050 5th Ave'), { date: '2026-01-13', street: '1050 5th Ave', unit: '' });
check('not an address', parsePitch('2025-8-29 Adam Buchman'), null);
check('template', parsePitch('NYC Pitch Template'), null);

/* ---------- the plan ---------- */
const NOW = '2026-10-20';
const live = (id, street, unit, stage, folder, extra) => Object.assign({ id, feed: 'featured', kind: 'sale', status: 'Active', stage, street, unit, state: 'NY',
  price: 1000000, beds: 2, baths: 2, listingUrl: 'u' }, extra || {}, { _folder: folder });
const rows = [
  live('9001', '100 EXAMPLE ST', '4A', 'Live', 'GVC - New York/Building Information/100 Example St/4A'),
  live('9002', '20 SAMPLE AVE', '7B', 'In contract', null),
  live('9003', '12 Sample Lane', '', 'In contract', null, { state: 'NJ' }),
  Object.assign(live('9004', '30 TEST PL', 'PH1', 'Sold', null), { feed: 'transactions', status: 'Sold' })
];
const report = {
  ok: true,
  live: rows.filter(r => r.feed === 'featured').map(r => ({ id: r.id, folder: r._folder, via: r._folder ? 'lnk' : null })),
  lnk: [
    { name: '100 Example - 4A.lnk', target: 'GVC - New York/Building Information/100 Example St/4A', onDE: true, deStage: 'Live' },
    { name: '30 Test - PH1.lnk', target: 'GVC - New York/Building Information/30 Test Pl/PH1', onDE: true, deStage: 'Sold' },
    { name: '40 Demo - 2C.lnk', target: 'GVC - New York/Building Information/40 Demo St/2C', onDE: false },
    { name: '50 Mock - Building.lnk', target: 'GVC - New York/Building Information/50 Mock St/50 Mock - Building Sale', onDE: false },
    { name: '60 Gone - 1A.lnk', target: null, onDE: false }
  ]
};
const drive = {
  units: [
    { building: '100 Example St', name: '4A', created: '2026-09-01' },
    { building: '70 Fresh St', name: '6G', created: '2026-09-25' },
    { building: '80 Old St', name: '2B', created: '2025-01-01' },
    { building: '70 Fresh St', name: 'Due Diligence', created: '2026-09-25' }
  ],
  pitches: ['2026-06-08 100 Example St - 4A', '2026-08-04 90 Pitch St - 11B', '2025-9-5 20 Sample Ave 7B', '2025-8-29 Jane Client', '2024-05-02 91 Old Pitch St, 3A'],
  devs: { NJ: ['00 SFH TEMPLATE', '619 Example Ave', 'Master Template List'], FL: ['0 - TEMPLATED NEW DEV FOLDER', '1 - Casa Example', 'Archive', 'New Dev - Market Reports'] },
  devFolders: { NJ: 'GVC - New Jersey/New Development', FL: 'GVC - Florida/New Development' }
};
const existing = [{ id: 'old-1', slug: '20-sample-ave-residence-7b', label: '20 Sample Ave, 7B', core: { address: '20 Sample Avenue', unit: '7B' } },
  { id: 'old-2', slug: '123-street', label: '123 Street', core: { address: '123 Street' } }];

const plan = buildPlan({ report, rows, drive, existing, today: NOW });
const L = plan.listings, by = s => L.find(x => x.street === s) || {};
check('DE live listings in, ticked', ['100 EXAMPLE ST', '20 SAMPLE AVE', '12 Sample Lane'].map(s => by(s).include), [true, true, true]);
check('stage and DE id kept', [by('100 EXAMPLE ST').stage, by('100 EXAMPLE ST').deId, by('100 EXAMPLE ST').folder],
  ['Live', '9001', 'GVC - New York/Building Information/100 Example St/4A']);
check('existing row merged, not duplicated', [by('20 SAMPLE AVE').existingId, L.filter(x => x.street === '20 SAMPLE AVE').length], ['old-1', 1]);
check('market from state', by('12 Sample Lane').market, 'NJ');
check('sold on DE: left out (D31)', L.some(x => /30 Test/i.test(x.street)), false);
const lnkOnly = L.find(x => x.source === 'lnk') || {};
check('shortcut not on DE: listed, unticked, Won', [lnkOnly.folder, lnkOnly.include, lnkOnly.stage], ['GVC - New York/Building Information/40 Demo St/2C', false, 'Won']);
check('building shortcut: review only', plan.review.some(r => /50 Mock - Building/.test(r.name) && /building/i.test(r.why)), true);
check('broken shortcut: review only', plan.review.some(r => /60 Gone/.test(r.name)), true);
const recent = L.filter(x => x.source === 'recent folder');
check('recent unit folders: listed unticked, old and paperwork folders left out', recent.map(x => [x.folder, x.include]),
  [['GVC - New York/Building Information/70 Fresh St/6G', false]]);
check('opened date from the folder', recent[0].opened, '2026-09-25');

const P_ = plan.pitches;
check('2026 pitch not won: in, open', P_.filter(p => p.outcome === 'open').map(p => [p.date, p.street, p.unit]), [['2026-08-04', '90 Pitch St', '11B']]);
check('pitch of a seeded listing: won, linked', P_.filter(p => p.outcome === 'won').map(p => [p.date, p.wonStreet]).sort(),
  [['2025-09-05', '20 SAMPLE AVE'], ['2026-06-08', '100 EXAMPLE ST']]);
check('old unwon pitch left out', P_.some(p => /91 Old/.test(p.street)), false);
check('person-named folder: never stored, listed for Matt', [P_.some(p => /Jane/.test(JSON.stringify(p))), plan.review.some(r => /Jane Client/.test(r.name))], [false, true]);
check('developments: listed unticked, templates and admin left out', plan.devs.map(d => [d.label, d.market, d.include]),
  [['619 Example Ave', 'NJ', false], ['Casa Example', 'FL', false]]);
check('existing rows not seeded stay untouched', plan.untouched.map(x => x.id), ['old-2']);

/* library rows that keep the unit inside the address line still merge */
const plan2 = buildPlan({ report: { ok: true, live: [], lnk: [] }, drive: { units: [], pitches: [], devs: { NJ: [], FL: [] } }, today: NOW,
  rows: [live('8001', '347 W BROADWAY', '6', 'Live', null), live('8002', '1006 Pheasant Ln', '204', 'In contract', null, { state: 'NJ' }),
    live('8003', '52 E 4TH ST', '10', 'Live', null)],
  existing: [{ id: 'e1', label: 'x', core: { address: '347 West Broadway, 6th Floor', unit: null } },
    { id: 'e2', label: 'y', core: { address: '1006 Pheasant Lane #204', unit: null } },
    { id: 'e3', label: 'z', core: { address: '52 East 4th Street, 10th Floor', unit: '' } }] });
check('unit inside the address line merges', plan2.listings.map(l => l.existingId), ['e1', 'e2', 'e3']);

/* a library row merges once: the sale, not also the rental of the same unit */
const plan3 = buildPlan({ report: { ok: true, live: [], lnk: [] }, drive: { units: [], pitches: [], devs: { NJ: [], FL: [] } }, today: NOW,
  rows: [live('7001', '404 PARK AVE S', '6A', 'Live', null, { kind: 'rental' }), live('7002', '404 PARK AVE S', '6A', 'Live', null)],
  existing: [{ id: 'e9', label: 'p', core: { address: '404 Park Ave South, Residence 6A', unit: null } }] });
check('one merge per library row, sale first', plan3.listings.map(l => [l.kind, l.existingId]), [['rental', null], ['sale', 'e9']]);

/* a recent building folder whose subfolders aren't units is one job */
const plan4 = buildPlan({ report: { ok: true, live: [], lnk: [] }, rows: [], existing: [], today: NOW, drive: { pitches: [], devs: { NJ: [], FL: [] },
  units: [{ building: '8 Woolley NJ', name: 'Raw', created: '2026-09-07' }, { building: '8 Woolley NJ', name: 'Virtually Staged', created: '2026-09-07' },
    { building: '194 RSD', name: 'Floorplan', created: '2026-10-08' }, { building: '11 Bray', name: 'Photos', created: '2026-10-01' },
    { building: '11 Bray', name: 'edits', created: '2026-10-01' },{ building: '70 Fresh St', name: '6G', created: '2026-09-25' },
    { building: '70 Fresh St', name: '11B Rental', created: '2026-09-25' }] } });
check('content subfolders: the building is the job', plan4.listings.map(l => [l.folder, l.kind]), [
  ['GVC - New York/Building Information/8 Woolley NJ', 'sale'], ['GVC - New York/Building Information/194 RSD', 'sale'],
  ['GVC - New York/Building Information/11 Bray', 'sale'],
  ['GVC - New York/Building Information/70 Fresh St/6G', 'sale'], ['GVC - New York/Building Information/70 Fresh St/11B Rental', 'rental']]);

/* ---------- apply ---------- */
(async () => {
  const T = { properties: [{ id: 'old-1', slug: '20-sample-ave-residence-7b', version: 1, core: { address: '20 Sample Avenue', unit: '7B', agentIds: ['x'] } }],
    pitches: [], dev_projects: [], changes: [], sync_runs: [] };
  let n = 0;
  const db = {
    ready: () => true,
    insert: async (t, rows2) => [].concat(rows2).map(r => { const x = Object.assign({ id: t + (++n), version: 1 }, r); T[t].push(x); return x; }),
    update: async (t, m, patch) => { const r = T[t].find(x => x.id === m.id); Object.assign(r, patch); r.version++; return [r]; },
    select: async (t, m) => T[t].filter(r => Object.keys(m || {}).every(k => String(r[k]) === String(m[k])))
  };
  const ticked = JSON.parse(JSON.stringify(plan));
  ticked.devs[1].include = true;                                         // Matt ticks Casa Example
  ticked.listings.find(x => x.source === 'recent folder').include = true; // and the recent folder
  const out = await applyPlan({ client: db, plan: ticked, now: new Date('2026-10-20T12:00:00Z') });
  check('applied counts', [out.listings, out.pitches, out.devs], [4, 3, 1]);
  const merged = T.properties.find(p => p.id === 'old-1');
  check('existing row updated in place, tools data kept', [merged.stage, merged.de_listing_id, merged.core.agentIds], ['In contract', '9002', ['x']]);
  const fresh = T.properties.find(p => p.de_listing_id === '9001');
  check('new listing', [fresh.stage, fresh.stage_source, fresh.folder_state, fresh.market], ['Live', 'seed', 'linked', 'NYC']);
  const won = T.pitches.find(p => p.pitched_on === '2026-06-08');
  check('won pitch linked both ways', [won.outcome, won.won_property_id === fresh.id, fresh.from_pitch_id === won.id], ['won', true, true]);
  check('history back-dated from the folder', T.changes.some(c => c.source === 'seed' && c.field === 'stage' && c.new_value === 'Won' && /^2026-09-25/.test(c.at)), true);
  check('pitch date in the history', T.changes.some(c => c.pitch_id === won.id && /^2026-06-08/.test(c.at)), true);
  check('seed run logged', [T.sync_runs[0].kind, T.sync_runs[0].ok], ['seed', true]);
  // a second run (Matt ticks more later) adds only what isn't there yet
  const sizes = () => [T.properties.length, T.pitches.length, T.dev_projects.length, T.changes.length];
  const before = sizes();
  const again = await applyPlan({ client: db, plan: ticked, now: new Date('2026-10-21T12:00:00Z') });
  check('seeding twice adds nothing twice', [[again.listings, again.pitches, again.devs], sizes()], [[0, 0, 0], before]);
  const more = JSON.parse(JSON.stringify(ticked)); more.devs[0].include = true;
  const added = await applyPlan({ client: db, plan: more, now: new Date('2026-10-22T12:00:00Z') });
  check('a newly ticked job arrives on a later run', [added.listings, added.pitches, added.devs, T.dev_projects.length], [0, 0, 1, before[2] + 1]);

  /* a 2026 pitch "won" by a listing Matt didn't tick stays, as an open pitch */
  const T2 = { properties: [], pitches: [], dev_projects: [], changes: [], sync_runs: [] };
  const db2 = Object.assign({}, db, {
    insert: async (t, rows2) => [].concat(rows2).map(r => { const x = Object.assign({ id: t + (++n), version: 1 }, r); T2[t].push(x); return x; }),
    update: async (t, m, patch) => { const r = T2[t].find(x => x.id === m.id); Object.assign(r, patch); return [r]; },
    select: async (t, m) => T2[t].filter(r => Object.keys(m || {}).every(k => String(r[k]) === String(m[k]))) });
  await applyPlan({ client: db2, now: new Date('2026-10-20T12:00:00Z'), plan: { listings: [{ include: false, street: '9 A St', unit: '1', stage: 'Won' }],
    pitches: [{ include: true, date: '2026-08-04', street: '9 A St', unit: '1', outcome: 'won', wonStreet: '9 A St', wonUnit: '1', market: 'NYC', folder: 'f' },
      { include: true, date: '2025-08-04', street: '8 B St', unit: '2', outcome: 'won', wonStreet: '8 B St', wonUnit: '2', market: 'NYC', folder: 'g' }], devs: [] } });
  check('unticked listing: 2026 pitch kept as open, older one dropped', T2.pitches.map(p => [p.pitched_on, p.outcome]), [['2026-08-04', 'open']]);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
