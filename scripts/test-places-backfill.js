/* ============================================================
   Tests for the places backfill (helper/places-backfill.js) and the shared place
   store (helper/place-store.js): what the one-time plan says, and what applying it
   changes, against an in-memory fake of the helper's database client (never the
   real one). Made-up rows only.

   Plain Node:  node scripts/test-places-backfill.js
   ============================================================ */
'use strict';

const { planBackfill, applyPlan, reportOf } = require('../helper/places-backfill.js');
const { keyOfCore, findOrMakePlace } = require('../helper/place-store.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* ---------- an in-memory database with the helper client's shape ---------- */
function fakeDb(seed) {
  const T = { places: [], buildings: [], properties: [], pitches: [], dev_projects: [], changes: [] };
  Object.keys(seed || {}).forEach(k => { T[k] = seed[k].map(r => Object.assign({ version: 1 }, r)); });
  let n = 0;
  const matches = (row, m) => Object.keys(m || {}).every(k => String(row[k]) === String(m[k]));
  return {
    T,
    select: async (t, m) => T[t].filter(r => matches(r, m)).map(r => JSON.parse(JSON.stringify(r))),
    insert: async (t, rows) => [].concat(rows).map(r => { const x = Object.assign({ id: t + '-' + (++n), version: 1 }, r); T[t].push(x); return JSON.parse(JSON.stringify(x)); }),
    update: async (t, m, patch) => {
      const hits = T[t].filter(r => matches(r, m));
      hits.forEach(r => { Object.assign(r, patch); r.version++; });
      return hits;
    }
  };
}

/* ---------- the plan ---------- */
const plan = planBackfill({
  properties: [
    { id: 'a', kind: 'sale', market: 'NYC', stage: 'Live', asana_gid: 'g1', label: '404 PAS 6A', core: { address: '404 Park Ave S', unit: '6A' } },
    { id: 'b', kind: 'rental', market: 'NYC', stage: 'Live', asana_gid: 'g2', label: '404 PAS 6A rental', core: { address: '404 PAS', unit: '6A' } },
    { id: 'c', kind: 'sale', market: 'NJ', stage: 'Live', asana_gid: 'g3', label: '12 Elm', core: { address: '12 Elm St', city: 'Brielle' } },
    { id: 'd', kind: 'sale', market: 'NJ', stage: 'Live', asana_gid: 'g4', label: '12 Elm', core: { address: '12 Elm St', city: 'Manasquan' } },
    { id: 'e', kind: 'sale', market: 'NJ', stage: 'Prep', asana_gid: 't1', label: '401 Brown St', drive_folder: 'x', folder_state: 'linked', core: { address: '401 Brown St', city: 'Brielle' } },
    { id: 'f', kind: 'sale', market: 'NYC', stage: 'Archived', label: 'merged copy', core: { address: '404 Park Ave South, Residence 6A' } },
    { id: 'g', kind: 'sale', market: null, stage: null, label: 'old save', core: { address: 'BUCHMAN ESTATE' } },
    { id: 'h', kind: 'sale', market: 'NYC', stage: 'Live', asana_gid: 'g5', label: '1 Inside', core: { address: '1 Inside St, Residence 2B' } }
  ],
  pitches: [{ id: 'q', slug: '331-florence-rd', outcome: 'open', market: 'NJ', asana_gid: 't2', label: '331 Florence Rd', pitched_on: '2026-07-28', core: { address: '331 Florence Rd' } }],
  devs: [],
  tasks: [{ gid: 't1', section: '🏗️TJ New Dev' }]
});
check('sale and rental share a place', plan.links.find(l => l.propertyId === 'a').placeKey, plan.links.find(l => l.propertyId === 'b').placeKey);
check('two towns, two places', plan.places.filter(p => /12 elm/.test(p.key)).length, 2);
check('a link says which town', plan.links.find(l => l.propertyId === 'd').town, 'Manasquan');
check('a second unit in a known building shares it', planBackfill({ properties: [
  { id: 'x', kind: 'sale', market: 'NYC', stage: 'Live', asana_gid: 'g8', core: { address: '1050 Fifth Avenue', unit: '10C' } },
  { id: 'y', kind: 'sale', market: 'NYC', stage: 'Live', asana_gid: 'g9', core: { address: '1050 Fifth', unit: '2E' } }], pitches: [], devs: [], tasks: [] }).buildings.length, 1);
check('a place keeps its clean address', plan.places.find(p => p.key === 'NYC|1 inside|2B').address, '1 Inside St');
check('NYC buildings', plan.buildings.length, 2);
check('a unit inside the address is read', plan.links.find(l => l.propertyId === 'h').placeKey, 'NYC|1 inside|2B');
check('a merged archived copy gets no place, so no false past deal', plan.links.some(l => l.propertyId === 'f'), false);
check('it is listed as skipped', plan.skipped.map(s => s.id).sort(), ['f', 'g']);
check('a TJ build with no development gets one', plan.newDevs.map(d => [d.label, d.market, d.house_listing_id, d.drive_folder]), [['401 Brown St', 'NJ', 'e', 'x']]);
check('the open pitch becomes a deal', plan.pitchesToDeals.map(p => p.id), ['q']);
const twice = planBackfill({ properties: [{ place_id: 'z', id: 'a', kind: 'sale', market: 'NYC', stage: 'Live', asana_gid: 'g1', core: { address: '404 PAS', unit: '6A' } }], pitches: [], devs: [], tasks: [] });
check('already linked is left alone', twice.links.length, 0);

const odd = planBackfill({ properties: [
  { id: 'n', kind: 'sale', market: 'NYC', stage: 'Live', asana_gid: 'g6', label: 'no street', core: { address: '' } },
  { id: 'm', kind: 'sale', market: null, stage: 'Live', asana_gid: 'g7', label: 'no market', core: { address: '5 Oak St' } },
  { id: 'k', kind: 'sale', market: 'NJ', stage: 'Live', asana_gid: 'g10', label: '9 Pine Rd', dev_project_id: 'dev-9', core: { address: '9 Pine Rd', city: 'Brielle' } }],
  pitches: [{ id: 'r', slug: 'r', outcome: 'open', market: 'NJ', core: {} }, { id: 's', slug: 's', outcome: 'won', market: 'NJ', core: { address: '7 Won St' } }],
  devs: [], tasks: [] });
check('no street or no market: a question, never a guess', odd.questions.map(q => q.id).sort(), ['m', 'n', 'r']);
check('they are not linked', odd.links.map(l => l.propertyId), ['k']);
check("a development's house carries its development to the place", odd.links[0].devId, 'dev-9');
check('only an open pitch becomes a deal', odd.pitchesToDeals.length, 0);
const known = planBackfill({ properties: [{ id: 'e', kind: 'sale', market: 'NJ', stage: 'Prep', asana_gid: 't1', label: '401 Brown St', core: { address: '401 Brown St' } }],
  pitches: [], devs: [{ id: 'dev-1', house_listing_id: 'e' }], tasks: [{ gid: 't1', section: '🏗️TJ New Dev' }] });
check('a house that already has its development makes no second one', [known.newDevs.length, known.links[0].devId], [0, 'dev-1']);

check('keyOfCore reads a unit left in the address', keyOfCore({ address: '1 Inside St, Residence 2B' }, 'NYC'), 'NYC|1 inside|2B');

(async () => {
  /* ---------- the place store ---------- */
  const db = fakeDb(), cache = { places: [], buildings: [] };
  const p1 = await findOrMakePlace(db, cache, { core: { address: '1050 Fifth Avenue', unit: '10C' }, market: 'NYC' });
  const p2 = await findOrMakePlace(db, cache, { core: { address: '1050 Fifth', unit: '2E' }, market: 'NYC' });
  const p3 = await findOrMakePlace(db, cache, { core: { address: '1050 Fifth Ave', unit: '10C' }, market: 'NYC' });
  check('a second call finds the first place', p3.id, p1.id);
  check('two units, two places, one building', [db.T.places.length, db.T.buildings.length, p1.building_id === p2.building_id && !!p1.building_id], [2, 1, true]);
  check('a place is stored with its clean address, key and slug', [p1.address, p1.key, p1.slug, p2.slug], ['1050 Fifth Avenue', 'NYC|1050 5|10C', '1050-fifth-avenue-residence-10c', '1050-fifth-residence-2e']);
  const e1 = await findOrMakePlace(db, cache, { core: { address: '12 Elm St', city: 'Brielle' }, market: 'NJ' });
  const e2 = await findOrMakePlace(db, cache, { core: { address: '12 Elm St', city: 'Manasquan' }, market: 'NJ' });
  check('one address in two towns is two places, slugs kept apart', [e1.id === e2.id, e1.slug, e2.slug, e1.building_id], [false, '12-elm-st', '12-elm-st-2', null]);
  const withDev = await findOrMakePlace(db, cache, { core: { address: '12 Elm St', city: 'Brielle' }, market: 'NJ', devId: 'dev-1' });
  check('a found place without a development takes the one given', [withDev.id, db.T.places.find(p => p.id === e1.id).dev_project_id], [e1.id, 'dev-1']);

  const none = await findOrMakePlace(db, cache, { core: { address: '', city: 'Brielle' }, market: 'NJ' });
  check('a core with no street makes no place', [none, db.T.places.length], [null, 4]);
  const townless = await findOrMakePlace(db, cache, { core: { address: '9 Pine Rd' }, market: 'NJ' });
  const townGiven = await findOrMakePlace(db, cache, { core: { address: '9 Pine Rd', city: 'Brielle' }, market: 'NJ' });
  check("a found place with no town takes the core's", [townGiven.id === townless.id, db.T.places.find(p => p.id === townless.id).town], [true, 'Brielle']);

  /* ---------- applying the plan ---------- */
  const live = fakeDb({
    properties: [
      { id: 'a', slug: '404-pas-6a', kind: 'sale', market: 'NYC', stage: 'Live', asana_gid: 'g1', label: '404 PAS 6A', core: { address: '404 Park Ave S', unit: '6A' } },
      { id: 'b', slug: '404-pas-6a-r', kind: 'rental', market: 'NYC', stage: 'Live', asana_gid: 'g2', label: '404 PAS 6A rental', core: { address: '404 PAS', unit: '6A' } },
      { id: 'e', slug: '401-brown-st', kind: 'sale', market: 'NJ', stage: 'Prep', asana_gid: 't1', label: '401 Brown St', drive_folder: 'x', folder_state: 'linked', core: { address: '401 Brown St', city: 'Brielle' } }
    ],
    pitches: [{ id: 'q', slug: '331-florence-rd', outcome: 'open', market: 'NJ', asana_gid: 't2', label: '331 Florence Rd', pitched_on: '2026-07-28', drive_folder: 'pf', folder_state: 'linked', core: { address: '331 Florence Rd' } }]
  });
  const input = () => ({ properties: live.T.properties, pitches: live.T.pitches, devs: live.T.dev_projects, tasks: [{ gid: 't1', section: '🏗️TJ New Dev' }] });
  const fromDb = planBackfill(input());
  const done = await applyPlan({ client: live, plan: fromDb });
  const prop = id => live.T.properties.find(p => p.id === id);
  check('a sale and a rental end on one place', [!!prop('a').place_id, prop('a').place_id === prop('b').place_id], [true, true]);
  check('the places and the one NYC building were made', [live.T.places.length, live.T.buildings.length], [3, 1]);
  const dev = live.T.dev_projects[0];
  check('the development is the house', [dev.label, dev.slug, dev.market, dev.house_listing_id, dev.drive_folder, dev.folder_state], ['401 Brown St', '401-brown-st', 'NJ', 'e', 'x', 'linked']);
  check('the house and its place carry the development', [prop('e').dev_project_id, live.T.places.find(p => p.id === prop('e').place_id).dev_project_id], [dev.id, dev.id]);
  const pitchDeal = live.T.properties.find(p => p.from_pitch_id === 'q');
  check('the open pitch is a deal', [pitchDeal.stage, pitchDeal.stage_source, pitchDeal.kind, pitchDeal.asana_gid, pitchDeal.milestones, pitchDeal.drive_folder, !!pitchDeal.place_id],
    ['Pitch', 'Asana', 'sale', 't2', { pitchedOn: { on: '2026-07-28' } }, 'pf', true]);
  check('the pitch is marked won, pointing at it', [live.T.pitches[0].outcome, live.T.pitches[0].won_property_id], ['won', pitchDeal.id]);
  check('every change says who and why', live.T.changes.length > 0 && live.T.changes.every(c => c.source === 'Helper' && c.note === 'Places backfill (11-05)'), true);
  check('each change has exactly one owner', live.T.changes.every(c => [c.property_id, c.pitch_id, c.dev_project_id].filter(Boolean).length === 1), true);
  check('the summary counts', [done.linked, done.devs, done.pitches], [3, 1, 1]);

  const counts = () => JSON.stringify(Object.keys(live.T).map(k => live.T[k].length));
  const before = counts();
  const again = await applyPlan({ client: live, plan: fromDb });
  check('applying the same plan twice changes nothing', [counts(), again.linked, again.devs, again.pitches], [before, 0, 0, 0]);
  const fresh = planBackfill(input());
  check('and a new plan from the new state has nothing left to link', [fresh.links.length, fresh.newDevs.length, fresh.pitchesToDeals.length], [0, 0, 0]);

  // a job whose street was lost since the plan was made is a question, not a junk place
  const lost = fakeDb({ properties: [{ id: 'z', slug: 'z', kind: 'sale', market: 'NJ', stage: 'Live', core: { address: '' } }] });
  const lostRun = await applyPlan({ client: lost, plan: { newDevs: [], links: [{ propertyId: 'z' }], pitchesToDeals: [] } });
  check('apply skips a job with no street and lists it', [lost.T.places.length, lost.T.properties[0].place_id || null, lostRun.questions.map(q => q.id)], [0, null, ['z']]);
  const rp = reportOf(plan, '2026-11-05');
  check('the report names each place and its jobs', [/places \(some may already exist\)/i.test(rp), /404 Park Ave S/.test(rp) && /`a`/.test(rp) && /`b`/.test(rp), /12 Elm St · Manasquan/.test(rp)], [true, true, true]);
  check('the report lists skipped rows and questions', [/Skipped/.test(reportOf(plan, '2026-11-05')), /Questions/.test(reportOf(odd, '2026-11-05'))], [true, true]);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
