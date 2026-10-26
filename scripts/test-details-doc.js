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

/* addressCheck: a doc never renames a listing (225 E79 PHA read a doc headed
   "340 East 23rd St 5M"). The listing's own address is its best non-doc value,
   an earlier tool's value included, else its label. */
const own = (address, unit, src) => ({ facts: {
  address: { value: address, source: src || 'legacy', bySource: { [src || 'legacy']: address } },
  unit: { value: unit, source: src || 'legacy', bySource: { [src || 'legacy']: unit } } } });
const wrong = { address: '340 East 23rd St', unit: '5M', price: 2195000 };
check('check: another street is caught', D.addressCheck(wrong, own('225 E79', 'PHA'), '225 E79, PHA'),
  { doc: '340 East 23rd St 5M', job: '225 E79 PHA' });
check('check: the same street spelled out is fine',
  D.addressCheck({ address: '225 East 79th Street', unit: 'PHA' }, own('225 E79', 'PHA')), null);
check('check: same street, another unit is caught',
  D.addressCheck({ address: '225 E 79th St', unit: '5M' }, own('225 E79', 'PHA')), { doc: '225 E 79th St 5M', job: '225 E79 PHA' });
check('check: "Residence PHA" is unit PHA', D.addressCheck({ address: '225 E79', unit: 'Residence PHA' }, own('225 E79', 'PHA')), null);
check('check: a unit on one side only is fine', D.addressCheck({ address: '225 E79' }, own('225 E79', 'PHA')), null);
check('check: the doc\'s own earlier value is not the listing\'s',
  D.addressCheck(wrong, { facts: { address: { value: '340 East 23rd St', source: 'doc', bySource: { doc: '340 East 23rd St', legacy: '225 E79' } },
    unit: { value: '5M', source: 'doc', bySource: { doc: '5M', legacy: 'PHA' } } } }), { doc: '340 East 23rd St 5M', job: '225 E79 PHA' });
check('check: Asana outranks an earlier tool',
  D.addressCheck({ address: '12 Oak St' }, { facts: { address: { value: '9 Elm St', source: 'Asana', bySource: { Asana: '9 Elm St', legacy: '12 Oak St' } } } }),
  { doc: '12 Oak St', job: '9 Elm St' });
check('check: an address in core with no record counts', D.addressCheck(wrong, { address: '225 E79', unit: 'PHA' }), { doc: '340 East 23rd St 5M', job: '225 E79 PHA' });
check('check: no address on file, the label decides', D.addressCheck(wrong, {}, '225 E79 - PHA'), { doc: '340 East 23rd St 5M', job: '225 E79 - PHA' });
check('check: no address on file, a matching label is fine', D.addressCheck({ address: '225 East 79th St' }, {}, '225 E79 - PHA'), null);
check('check: nothing to compare with fills the gap', D.addressCheck(wrong, {}, 'Untitled property'), null);
check('check: a doc with no address is fine', D.addressCheck({ price: 1 }, own('225 E79', 'PHA')), null);

console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
if (failures.length) {
  console.log('\n  ' + failures.join('\n\n  ') + '\n');
  process.exit(1);
}
console.log();
