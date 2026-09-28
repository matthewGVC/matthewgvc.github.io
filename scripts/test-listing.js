/* ============================================================
   Regression tests for tools/showsheet/listing.js — reading a listing's
   Word document, and the money on the back of the sheet.

   Plain Node, no browser, no install:  node scripts/test-listing.js

   Every case here is a way the printed sheet was, or could quietly be, wrong
   without anything throwing: a carrying cost missing its taxes, a feature
   line that vanished, "scoop" read as co-op.
   ============================================================ */
'use strict';

const L = require('../tools/showsheet/listing.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* ------------------------------------------------------------
   Money
   ------------------------------------------------------------ */
check('monthly: $ figure with a sentence', L.monthlyAmount('$220.35/mo through July 2027'), 220.35);
check('monthly: bare figure counts (the $6,128 vs $11,716 bug)', L.monthlyAmount('5,588/mo'), 5588);
check('monthly: bare number, no period', L.monthlyAmount('5588'), 5588);
check('monthly: yearly is a twelfth', L.monthlyAmount('$22,080/yr'), 1840);
check('monthly: "per year" too', L.monthlyAmount('$22,080 per year'), 1840);
check('monthly: one-time is not monthly', L.monthlyAmount('$12,000 one-time'), null);
check('monthly: a total is not monthly', L.monthlyAmount('$12,000 total, payable over 12 months'), null);
check('monthly: a year in a sentence is not money', L.monthlyAmount('Through July 2027'), null);
check('monthly: blank', L.monthlyAmount('—'), null);

check('moneyText: bare figure gets its $', L.moneyText('5,588/mo'), '$5,588/mo');
check('moneyText: already has one', L.moneyText('$5,588/mo'), '$5,588/mo');
check('moneyText: prose left alone', L.moneyText('Included in maintenance'), 'Included in maintenance');

check('price: figure formatted', L.displayPrice('2250000'), '$2,250,000');
check('price: prose as typed', L.displayPrice('Call for price'), 'Call for price');

check('carrying: condo, taxes without a $',
  L.carrying({ ownership: 'condo', commonCharges: '$6,128/mo', taxesMonthly: '5,588/mo' }),
  { total: 11716, what: 'Common charges & taxes' });
check('carrying: co-op with a monthly assessment',
  L.carrying({ ownership: 'co-op', maintenance: '$5,559', assessments: '$220/mo' }),
  { total: 5779, what: 'Maintenance & assessments' });
check('carrying: a co-op ignores condo fields',
  L.carrying({ ownership: 'co-op', maintenance: '$5,000', commonCharges: '$9,999', taxesMonthly: '$9,999' }),
  { total: 5000, what: 'Maintenance' });
check('carrying: nothing to add', L.carrying({ ownership: 'condo' }), null);

/* ------------------------------------------------------------
   The Word document. Blocks are what blocksFromHtml() hands over.
   ------------------------------------------------------------ */
const p = text => ({ kind: 'p', text });
const li = text => ({ kind: 'li', text });
const row = (...cells) => ({ kind: 'row', cells });

const doc = [
  p('555 West 59th Street - PHC'),
  row('Price', '$9,500,000'), row('Maintenance/CC', '$6,128/mo'), row('Taxes', '5,588/mo'),
  row('Max Financing', '90 &'), row('Assessments', 'N/A'), row('Flip Tax', '2.%'),
  p('Interior Features'),
  li('4BD / 4BA Condominium'),
  li('Floor-to-ceiling windows with north, east & south exposures'),
  li('Private wraparound terrace'),
  li('10\' ceilings throughout'),
  li('Central heat & air conditioning'),
  li('Chef\'s kitchen with double-wide island'),
  li('Chef\'s kitchen with a double-wide island'),
  p('Building Features'),
  li('Built 2007'), li('35 floors / 186 units'),
  li('Full-service luxury condominium'), li('Full-time doorman & concierge'),
  li('Pied-à-terre permitted'), li('Pets welcome'),
  li('Fitness center'), li('Children\'s playroom')
];
const f = L.read(doc, 'co-op');

check('title → address', f.address, '555 West 59th Street');
check('title → unit', f.unit, 'PHC');
check('price', f.price, '$9,500,000');
check('"90 &" is Word mangling 90%', f.maxFinancing, '90%');
check('"2.%" becomes 2%', f.flipTax, '2%');
check('a blankish value is not a fact', 'assessments' in f, false);
check('condo named in the features', f.ownership, 'condo');
check('the CC cell is common charges on a condo', f.commonCharges, '$6,128/mo');
check('…and not maintenance', 'maintenance' in f, false);
check('condo taxes read', f.taxesMonthly, '5,588/mo');
check('beds', f.beds, '4');
check('baths', f.baths, '4');
check('built', f.building.builtYear, '2007');
check('stories / residences', [f.building.stories, f.building.residences], ['35', '186']);
check('service lines, building word dropped', f.building.service, 'Full-service luxury · Full-time doorman & concierge');
check('policies', f.building.policy, 'Pied-à-terre permitted · Pets welcome');
check('amenities are what is left', f.building.amenities, ['Fitness center', 'Children\'s playroom']);
check('exposures', f.residence.exposures, 'Floor-to-ceiling windows with north, east & south exposures');
check('outdoor', f.residence.outdoor, 'Private wraparound terrace');
check('ceiling', f.residence.ceiling, '10\' ceilings throughout');
check('climate', f.residence.climate, 'Central heat & air conditioning');
check('a line that only restates beds/baths/ownership is not a bullet; near-duplicates collapse',
  f.residence.features, ['Chef\'s kitchen with double-wide island']);
check('found, in document order', f.found,
  ['address', 'unit', 'price', 'max financing', 'flip tax', 'ownership', 'common charges', 'taxes',
   'beds/baths', 'built', 'stories/residences', 'service', 'policies', 'amenities', 'features']);

/* A first line with real content used to be moved into residence.tag, which
   nothing printed — "Prewar classic 7" simply disappeared from the sheet. */
const prewar = L.read([p('10 Main St'), p('Interior Features'), li('Prewar classic 7 with river views'), li('Wood-burning fireplace')], 'co-op');
check('a descriptive first line stays a feature', prewar.residence.features, ['Prewar classic 7 with river views', 'Wood-burning fireplace']);
const ph = L.read([p('10 Main St'), p('Interior Features'), li('Penthouse duplex, 3BD / 2BA'), li('Roof deck access')], 'co-op');
check('beds/baths plus more is still a feature', ph.residence.features[0], 'Penthouse duplex, 3BD / 2BA');
check('…and its beds/baths are read', [ph.beds, ph.baths], ['3', '2']);

/* ownership and the single charges cell */
const scoop = L.read([p('1 A St'), row('CC', '$900'), p('Building Features'), li('Ice cream scoop shop downstairs')], 'co-op');
check('"scoop" is not co-op', 'ownership' in scoop, false);
check('no ownership named: the sheet\'s decides (co-op → maintenance)', scoop.maintenance, '$900');
const both = L.read([p('1 A St'), p('Building Features'), li('Condo-style co-op')], 'condo');
check('both named: ownership left alone', 'ownership' in both, false);
const coop = L.read([p('1 A St'), row('Taxes', '$1,000'), p('Building Features'), li('Prewar cooperative')], 'condo');
check('co-op named', coop.ownership, 'co-op');
check('a co-op\'s taxes are in its maintenance, not their own line', 'taxesMonthly' in coop, false);

/* titles */
check('no dash: the whole title is the address', L.titleOf([p('10 Main Street')]).address, '10 Main Street');
check('a dash inside the address survives', L.titleOf([p('10 - 12 Main Street - 4B')]).address, '10 - 12 Main Street');
check('empty document', L.read([], 'co-op').found, []);

console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
if (failures.length) {
  console.log('\n  ' + failures.join('\n\n  ') + '\n');
  process.exit(1);
}
console.log();
