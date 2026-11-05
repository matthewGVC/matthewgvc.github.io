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

// cleanStreet takes off the same comma unit the library's splitUnit does
['1050 Fifth Avenue, Apt. 2E', '12 Oak St, Residence 12E', '9 Pine Rd, Unit 4', '3 Bay Ave, Brielle'].forEach(a =>
  check('agrees with splitUnit: ' + a, P.cleanStreet(a), L.splitUnit(a).address));

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
