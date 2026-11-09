/* ============================================================
   Tests for helper/name-flow.js: an Asana task's name becomes its deal's
   label, and a rename that moves the deal (a new unit, a new street) moves
   its address with it, while a respelling moves nothing (decisions 12, 13, 15).
   Made-up addresses, or the ones the plan names.

   Plain Node:  node scripts/test-name-flow.js
   ============================================================ */
'use strict';

const { nameFlow } = require('../helper/name-flow.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

let row = { label: '200 E 57, Residence 17A', core: { address: '200 E 57th', unit: '17A' } };
let r = nameFlow(row, '200 E57 - 17A');
check('a respelling changes the label only', [r.label, r.core, r.changes, r.moved], ['200 E57 - 17A', row.core, [], false]);
check('a respelling: the row itself is untouched', row.core, { address: '200 E 57th', unit: '17A' });

r = nameFlow({ core: { address: '435 East 57th Street', unit: '12B' } }, '435 E57 - 12B');
check('the long form stays for print', [r.core.address, r.moved], ['435 East 57th Street', false]);

r = nameFlow({ core: { address: '52 East 4th Street 10th Floor', unit: '10FL' } }, '52 E4 - 10FL');
check('a floor in the address is not a new street', [r.moved, r.changes, r.core.address], [false, [], '52 East 4th Street 10th Floor']);

r = nameFlow({ core: { address: '400 E59', unit: '4H' } }, '400 E59 - 3H');
check('a new unit follows Asana', [r.core.unit, r.core.facts && r.core.facts.unit.source, r.changes, r.moved],
  ['3H', 'Asana', [{ field: 'unit', old: '4H', new: '3H', note: 'Renamed in Asana' }], true]);

r = nameFlow({ core: { address: '225 East 79th Street', unit: 'Penthouse',
  facts: { unit: { value: 'Penthouse', source: 'Matt', bySource: { Matt: 'Penthouse', legacy: 'PHA' } } } } }, '225 E79 - PHA');
check('Asana\'s unit replaces the team\'s', [r.core.unit, r.core.facts.unit.source, 'Matt' in r.core.facts.unit.bySource, r.changes, r.moved],
  ['PHA', 'Asana', false, [{ field: 'unit', old: 'Penthouse', new: 'PHA', note: 'Renamed in Asana' }], true]);

r = nameFlow({ core: { address: '69 West 9th Street, Residence 12E', unit: null } }, '69 W10 - 12E');
check('a unit inside the address survives a new street', [r.core.unit, r.core.address, r.moved], ['12E', '69 W10', true]);
check('a unit inside the address survives a new street: one change, the address', r.changes,
  [{ field: 'address', old: '69 West 9th Street, Residence 12E', new: '69 W10', note: 'Renamed in Asana' }]);

r = nameFlow({ core: { address: '1006 Pheasant Ln', unit: '204' } }, '1006 Pheasant Ln, Wall');
check('no unit in the name clears nothing', [r.core.unit, r.moved, r.changes], ['204', false, []]);

row = { core: { address: '315 Foreman Ave', unit: 'House 1' } };
r = nameFlow(row, '315 Foreman Ave (House 1)');
check('a house keeps its house', [r.core, r.changes, r.moved, r.label], [row.core, [], false, '315 Foreman Ave (House 1)']);

r = nameFlow({ label: 'Kept', core: { address: '9 Elm St' } }, '');
check('an empty name keeps the label', [r.label, r.moved], ['Kept', false]);

r = nameFlow({ label: 'x', core: { address: '404 PAS', unit: '6A' } }, '404 PAS - 6A (Rental)');
check('a rental\'s label has no (Rental)', r.label, '404 PAS - 6A');

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
