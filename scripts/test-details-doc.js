/* ============================================================
   Tests for assets/js/details-doc.js: the Showsheet reader's output as the
   job's fact names, and which file in a folder is the details doc.

   Plain Node:  node scripts/test-details-doc.js

   The .docx itself needs mammoth (browser only), so the blocks are built by
   hand, shaped like tools/showsheet/sample/listing.docx.
   ============================================================ */
'use strict';

const L = require('../tools/showsheet/listing.js');
const D = require('../assets/js/details-doc.js');
const { FIELDS } = require('../assets/js/job-facts.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const p = text => ({ kind: 'p', text });
const li = text => ({ kind: 'li', text });
const row = (...cells) => ({ kind: 'row', cells });

const blocks = [
  p('12 Example Street - 4B'),
  row('Price', '$2,250,000'), row('Maintenance/CC', '$1,280/mo'), row('Taxes', '$22,080/yr'),
  row('Max Financing', '90 &'), row('Assessments', 'N/A'), row('Flip Tax', '2.%'),
  p('Interior Features'),
  li('2BD / 2.5BA Condominium'),
  li('Open kitchen with stone counters'),
  li('Wide plank oak floors'),
  p('Building Features'),
  li('Built 1928'), li('12 floors / 80 units'),
  li('Full-time doorman'), li('Fitness center')
];
const read = L.read(blocks, 'co-op');
const facts = D.toFacts(read);
const names = FIELDS.map(f => f.name);

check('price with the reader\'s value', facts.price, 2250000);
check('beds', facts.beds, 2);
check('baths whole, half split out', [facts.baths, facts.halfBaths], [2, 1]);
check('interiorFeatures are the reader\'s list', facts.interiorFeatures, read.residence.features);
check('buildingFeatures are the reader\'s amenities', facts.buildingFeatures, read.building.amenities);
check('condo named: propertyType, common charges not maintenance',
  [facts.propertyType, facts.commonCharges, 'maintenance' in facts], ['Condo', 1280, false]);
check('taxes: a yearly figure becomes the monthly one', facts.taxesMonthly, 1840);
check('max financing is a number', facts.maxFinancing, 90);
check('flip tax as the reader gave it', facts.flipTax, read.flipTax);
check('N/A assessments are dropped', 'assessments' in facts, false);
check('address and unit', [facts.address, facts.unit], ['12 Example Street', '4B']);
check('year built and stories', [facts.yearBuilt, facts.stories], [1928, 12]);
check('every name is a stored job field', Object.keys(facts).filter(k => !names.includes(k)), []);
check('no empty values', Object.values(facts).filter(v => v === null || v === '' || (Array.isArray(v) && !v.length)), []);

/* a co-op keeps its charge as maintenance */
const coop = D.toFacts(L.read([
  p('9 Sample Avenue - 2A'), row('Maintenance/CC', '$5,559'), row('Price', 'Call for price'),
  p('Building Features'), li('Cooperative building'), li('Built 1962')
], 'condo'));
check('co-op: maintenance, not common charges, propertyType Co-op',
  [coop.maintenance, 'commonCharges' in coop, coop.propertyType, coop.yearBuilt], [5559, false, 'Co-op', 1962]);
check('a price that is words is dropped', 'price' in coop, false);

/* a made-up read result for the renames */
check('building.builtYear maps to yearBuilt', D.toFacts({ building: { builtYear: 'July 2007' } }), { yearBuilt: 2007 });
check('residence.features maps to interiorFeatures',
  D.toFacts({ residence: { features: ['A', ' ', 'B'] } }), { interiorFeatures: ['A', 'B'] });
check('empty read gives no facts', D.toFacts({ building: {}, residence: {}, found: [] }), {});
check('nothing at all gives no facts', D.toFacts(null), {});

/* picking the details doc */
const f = (name, modified, size) => ({ name, size: size || 100, modified });
const older = f('Showsheet details.docx', '2026-10-01T10:00:00Z');
const newer = f('Showsheet details v2.docx', '2026-10-10T10:00:00Z');
check('pick: newest of two details docs, paperwork and notes ignored',
  D.pick([older, f('notes.docx', '2026-10-20T10:00:00Z'), f('Exclusive details signed.pdf', '2026-10-21T10:00:00Z'), newer]), newer);
check('pick: order does not matter', D.pick([newer, older]), newer);
check('pick: a Word lock file is not a doc', D.pick([f('~$Showsheet details.docx', '2026-10-30T10:00:00Z')]), null);
check('pick: a paperwork word anywhere keeps a doc out', D.pick([f('Signed contract details.docx', '2026-10-30T10:00:00Z')]), null);
const dd = f('Listing details doc.docx', '2026-10-30T10:00:00Z');
check('pick: "doc" in a details name is fine', D.pick([dd]), dd);
check('pick: none', D.pick([f('notes.docx', '2026-10-20T10:00:00Z')]), null);
check('pick: empty', D.pick([]), null);

/* changed */
const rec = { name: older.name, size: older.size, modified: older.modified };
check('changed: same file', D.changed(rec, older), false);
check('changed: modified differs', D.changed(rec, f(older.name, '2026-10-02T10:00:00Z')), true);
check('changed: size differs', D.changed(rec, f(older.name, older.modified, 999)), true);
check('changed: name differs', D.changed(rec, newer), true);
check('changed: nothing recorded yet', D.changed(null, older), true);

console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
if (failures.length) {
  console.log('\n  ' + failures.join('\n\n  ') + '\n');
  process.exit(1);
}
console.log();
