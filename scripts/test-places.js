/* ============================================================
   Tests for assets/js/places.js: which deals are one place, which facts
   belong to the place, and how a list of deals folds into one row per place.
   Made-up addresses only.

   Plain Node:  node scripts/test-places.js
   ============================================================ */
'use strict';

const P = require('../assets/js/places.js');
const L = require('../assets/js/property-library.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

check('same unit, two spellings',
  P.placeKey({ address: '401 East 89th Street', unit: '18/19E' }, 'NYC'),
  P.placeKey({ address: '401 E89', unit: '18 19E' }, 'NYC'));
check('the key, spelled out', P.placeKey({ address: '401 E89', unit: '18/19E' }, 'NYC'), 'NYC|401 east 89|1819E');
check('404 PAS is 404 Park Ave South',
  P.placeKey({ address: '404 PAS', unit: '6A' }, 'NYC'), P.placeKey({ address: '404 Park Ave South', unit: '6A' }, 'NYC'));
check('houses differ',
  P.placeKey({ address: '315 Foreman Ave', unit: 'House 1' }, 'NJ') === P.placeKey({ address: '315 Foreman Ave', unit: 'House 2' }, 'NJ'), false);
check('no address', P.placeKey({ address: '' }, 'NYC'), '');
check('unit left in the address',
  P.placeKey({ address: '1050 Fifth Avenue, Apt. 2E', unit: '2E' }, 'NYC'), P.placeKey({ address: '1050 Fifth', unit: '2E' }, 'NYC'));
check('floor left in the address',
  P.placeKey({ address: '52 East 4th Street 10th Floor', unit: '10FL' }, 'NYC'), P.placeKey({ address: '52 E4', unit: '10FL' }, 'NYC'));
check('street type on one side only',
  P.placeKey({ address: '929 Park', unit: '4C' }, 'NYC'), P.placeKey({ address: '929 Park Ave', unit: '4C' }, 'NYC'));
check('one building for both spellings',
  P.buildingKey({ address: '1050 Fifth Avenue, Apt. 2E' }, 'NYC'), P.buildingKey({ address: '1050 Fifth Avenue' }, 'NYC'));
check('a unit after # keeps two apartments apart',
  P.placeKey({ address: '200 Main St #204' }, 'NJ') === P.placeKey({ address: '200 Main St #205' }, 'NJ'), false);
check('# and a unit field are one place',
  P.placeKey({ address: '200 Main St #204' }, 'NJ'), P.placeKey({ address: '200 Main St', unit: '204' }, 'NJ'));
check('two floors are two places',
  P.placeKey({ address: '52 E4 10th Floor' }, 'NYC') === P.placeKey({ address: '52 E4 9th Floor' }, 'NYC'), false);
check('a street that is only its type', P.placeKey({ address: '205 Parkway' }, 'NJ'), 'NJ|205 parkway|');
check('St and Ave share a key but are not one place', P.samePlace({ address: '12 Elm St' }, { address: '12 Elm Ave' }), false);
check('one place across spellings', P.samePlace({ address: '52 East 4th Street 10th Floor' }, { address: '52 E4' }), true);
check('two towns are two places', P.samePlace({ address: '12 Elm St', town: 'Brielle' }, { address: '12 Elm St', town: 'Manasquan' }), false);
check('a town and its township are one town', [P.sameTown('Wall', 'Wall Township'), P.sameTown('Wall Twp.', 'WALL, NJ'), P.sameTown('Rumson Borough', 'Rumson'),
  P.sameTown('Fair Haven Boro', 'Fair Haven'), P.sameTown('Ridgewood Village', 'ridgewood'), P.sameTown('Wall Township', 'Brielle'), P.sameTown('', 'Wall')],
  [true, true, true, true, true, false, true]);
check('one place across a township spelling', P.samePlace({ address: '12 Elm St', town: 'Wall' }, { address: '12 Elm St', town: 'Wall Township' }), true);
check('ellimanOnly: a development unit with no Asana task', [P.ellimanOnly({ dev_project_id: 'd', asana_gid: null }), P.ellimanOnly({ dev_project_id: 'd', asana_gid: 'g' }),
  P.ellimanOnly({ asana_gid: null }), P.ellimanOnly(null)], [true, false, false, false]);
check('NYC building ignores the unit',
  P.buildingKey({ address: '400 E59' }, 'NYC'), P.buildingKey({ address: '400 East 59th St' }, 'NYC'));
check('no NJ building', P.buildingKey({ address: '401 Brown St' }, 'NJ'), '');
check('price stays on the deal', P.placeFacts().indexOf('price'), -1);
check('board rules move with the place', P.placeFacts().indexOf('petPolicy') !== -1, true);
const rec = { value: 'Yes', source: 'Matt' };
check('inherit fills blanks and keeps the record',
  P.inherit({ beds: 2, petPolicy: 'Yes', price: 9, facts: { petPolicy: rec } }, { beds: 3 }),
  { beds: 3, petPolicy: 'Yes', facts: { petPolicy: rec } });
const s = { id: 's', placeId: 'x', kind: 'sale', stage: 'Live' }, r = { id: 'r', placeId: 'x', kind: 'rental', stage: 'Live' };
const g = P.group([r, s], [{ id: 's', place_id: 'x', stage: 'Live' }, { id: 'r', place_id: 'x', stage: 'Live' },
  { id: 'o', place_id: 'x', stage: 'Sold' }, { id: 'b', place_id: 'x', stage: 'In contract', side: 'buy' }]);
check('sale and rental: one row', g.length, 1);
check('the sale leads', g[0].lead.id, 's');
check('both are live', g[0].live.length, 2);
check('the old deal counts as history, a purchase does not', g[0].history, 1);
const mine = P.group([r], [{ id: 's', place_id: 'x', stage: 'Live' }, { id: 'r', place_id: 'x', stage: 'Live' }]);
check('a filtered-out live sale is not a past deal', mine[0].history, 0);
const again = P.group([{ id: 'n', placeId: 'w', stage: 'Live', kind: 'sale' }, { id: 'o', placeId: 'w', stage: 'Sold', kind: 'sale' }],
  [{ id: 'n', place_id: 'w', stage: 'Live' }, { id: 'o', place_id: 'w', stage: 'Sold' }]);
check('a repeat listing: one row, one past deal', [again.length, again[0].lead.id, again[0].live.length, again[0].history], [1, 'n', 1, 1]);
check('no place: own row', P.group([{ id: 'a' }, { id: 'b' }], []).length, 2);
const sold = P.group([{ id: 'o', placeId: 'y', stage: 'Sold' }], [{ id: 'o', place_id: 'y', stage: 'Sold' }]);
check('a sold-only place is a row led by that deal', [sold[0].lead.id, sold[0].live.length, sold[0].history], ['o', 0, 0]);
const arch = P.group([{ id: 'n', placeId: 'z', stage: 'Archived', createdAt: '2026' }, { id: 'm', placeId: 'z', stage: 'Archived', createdAt: '2024' }], []);
check('all archived opens on the newest', arch[0].lead.id, 'n');   // Review Focus 5
const past = P.group([{ id: 's19', placeId: 'v', kind: 'sale', stage: 'Archived', createdAt: '2019-05-01' },
  { id: 'r23', placeId: 'v', kind: 'rental', stage: 'Archived', createdAt: '2023-05-01' }], []);
check('nothing live: an archived 2023 rental beats an archived 2019 sale', past[0].lead.id, 'r23');
const lost = { id: 'l', place_id: 'u', stage: 'Archived', stage_source: 'Asana', milestones: { pitchedOn: { on: '2026-03-01' } } };
check('lostPitch: archived, pitched, never listed', [P.lostPitch(lost), P.lostPitch({ stage: 'Archived', stage_source: 'Asana', milestones: {} }),
  P.lostPitch({ stage: 'Archived', stage_source: 'Matt', milestones: { pitchedOn: '2025-01-01', listedOn: { on: '2025-02-01' } } }),
  P.lostPitch({ stage: 'Archived', stage_source: 'Matt', milestones: { listedOn: { on: '2027-01-01', planned: true } } }),
  P.lostPitch({ stage: 'Sold', milestones: { pitchedOn: '2026-01-01' } })], [true, false, false, false, false]);
const withLost = P.group([{ id: 'n', placeId: 'u', stage: 'Live', kind: 'sale' }], [{ id: 'n', place_id: 'u', stage: 'Live' }, lost, { id: 'o', place_id: 'u', stage: 'Sold' }]);
check('a lost pitch is no past deal: it was never listed', withLost[0].history, 1);
const lone = { id: 'n1', kind: 'sale', stage: 'Live' }, other = { id: 'z', placeId: 'q', kind: 'sale', stage: 'Live' };
check('shown: a place shows when any of its deals passes, with all its deals',
  P.shown([s, r, other, lone], [r, lone], []).map(x => [x.lead.id, x.live.length]), [['s', 2], ['n1', 1]]);
check('dealWord: the chip for a place\'s other deal', [P.dealWord({ type: 'rental', stage: 'Live' }), P.dealWord({ type: 'listing', stage: 'In contract' }),
  P.dealWord({ type: 'rental', stage: 'In contract', phase: 'Lease signed' }), P.dealWord({ type: 'pitch', stage: 'Pitch' })],
  ['Rental · Live', 'Sale · In contract', 'Rental · Lease signed', 'Pitch']);
const e1 = { id: 'e1', stage: 'Live', mismatches: 1 }, e2 = { id: 'e2', stage: 'Live', mismatches: 2 }, e3 = { id: 'e3', stage: 'Archived', mismatches: 4 };
check('errors: summed over the row\'s live deals, the lead included', [P.errors({ lead: e1, live: [e1, e2] }), P.errors({ lead: e3, live: [e2] }), P.errors({ lead: e3, live: [] })], [3, 6, 4]);

/* the Deals card's rows (assets/js/job-page/deals.js) */
const D = require('../assets/js/job-page/deals.js');
const deal = (o) => Object.assign({ id: 'x', slug: 'x', kind: 'sale', side: 'list', stage: 'Sold', core: {}, milestones: {}, created_at: '2020-01-01T00:00:00Z' }, o);
const sale = deal({ id: 's', slug: 'sale', stage: 'Live' }), rent = deal({ id: 'r', slug: 'rent', kind: 'rental', stage: 'Live' });
check('one deal, no card', D.html({ deals: [sale], row: sale, esc: String, I: () => '' }), '');
check('sale and rental: each links to the other', [D.rows([sale, rent], 's').live, D.rows([sale, rent], 'r').live],
  [[{ slug: 'sale', word: 'Sale · Live', kind: 'Sale', here: true }, { slug: 'rent', word: 'Rental · Live', kind: 'Rental', here: false }],
   [{ slug: 'sale', word: 'Sale · Live', kind: 'Sale', here: false }, { slug: 'rent', word: 'Rental · Live', kind: 'Rental', here: true }]]);
check('past deal\'s sold price comes from Elliman', D.rows([sale, deal({ id: 'a', core: { closePrice: 1200000, price: 1300000 } }), deal({ id: 'b', core: { price: 1300000 } })], 's').past.map(p => p.soldPrice),
  ['$1,200,000', '']);
check('past deals newest first', D.rows([sale, deal({ id: 'a', milestones: { closedOn: { on: '2019-06-01' } } }), deal({ id: 'b', slug: 'b', milestones: { listedOn: '2022-03-01' } }),
  deal({ id: 'c', slug: 'c', created_at: '2021-05-05T10:00:00Z' })], 's').past.map(p => [p.slug, p.year]), [['b', '2022'], ['c', '2021'], ['x', '2019']]);
check('a past deal carries its dates', D.rows([sale, deal({ id: 'a', milestones: { closedOn: { on: '2019-06-01' }, listedOn: { on: '2019-01-10' }, contractOn: '2019-04-02', pitchedOn: {} } })], 's').past[0].dates,
  [{ word: 'Listed', day: '2019-01-10' }, { word: 'Contract signed', day: '2019-04-02' }, { word: 'Closed', day: '2019-06-01' }]);
check('a planned-only milestone stays out of dates', D.rows([sale, deal({ id: 'a', milestones: { listedOn: { on: '2019-01-10' }, closedOn: { planned: '2019-06-01' } } })], 's').past[0].dates,
  [{ word: 'Listed', day: '2019-01-10' }]);
check('a pitch reads Pitch, like the Overview', D.rows([sale, deal({ id: 'a', slug: 'a', stage: 'Pitch' })], 's').live[1].word, 'Pitch');
check('a purchase reads Purchase', D.rows([sale, deal({ id: 'a', side: 'buy' }), deal({ id: 'b', side: 'buy', stage: 'Live', slug: 'b' })], 's').past.map(p => p.type).concat(D.rows([sale, deal({ id: 'b', side: 'buy', stage: 'Live', slug: 'b' })], 's').live[1].word),
  ['Purchase', 'Purchase · Live']);
check('dealWord: a purchase', P.dealWord({ type: 'purchase', stage: 'Live' }), 'Purchase · Live');
check('a lost pitch reads Pitch on the Deals card', D.rows([sale, deal({ id: 'l', stage: 'Archived', stage_source: 'Asana', milestones: { pitchedOn: { on: '2026-03-01' } } })], 's').past[0].type, 'Pitch');
check('a sold rental reads Rental, in lease words', D.rows([sale, deal({ id: 'a', kind: 'rental', stage: 'Rented' })], 's').past[0].type, 'Rental');

// cleanStreet takes off the same comma unit the library's splitUnit does
['1050 Fifth Avenue, Apt. 2E', '12 Oak St, Residence 12E', '9 Pine Rd, Unit 4', '3 Bay Ave, Brielle'].forEach(a =>
  check('agrees with splitUnit: ' + a, P.cleanStreet(a), L.splitUnit(a).address));

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
