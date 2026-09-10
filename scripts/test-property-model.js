/* ============================================================
   Regression tests for the shared property model.

   Plain Node, no browser, no install:  node scripts/test-property-model.js

   These cover the behaviours that quietly corrupt a listing rather than
   throwing — a unit that vanishes on reload, a field that will not clear, a
   fact carried from the previous property. None of them raise an error at
   runtime, which is why they survived so long and why they are pinned here.
   ============================================================ */
'use strict';

const P = require('../assets/js/property-library.js');

let pass = 0;
const failures = [];

function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

function ok(name, cond) { check(name, !!cond, true); }

/* ------------------------------------------------------------
   1 + 2. A unit survives a round trip, and splitUnit can read what
   unitDisplay writes. These are the same property stated two ways, and the
   pair was broken for every bare unit — "4B", "PHC", "3A" — which is the
   spelling an agent actually types.
   ------------------------------------------------------------ */
const ADDR = '555 W 59th St';
const UNITS = ['4B', '3A', 'PHC', 'PH-2', '12', 'Apt 4B', 'Unit 12', '#7', 'Penthouse C'];

UNITS.forEach(u => {
  const stored = P.joinUnit(ADDR, u);
  const back = P.splitUnit(stored);
  check('round trip: ' + u, back, { address: ADDR, unit: u });
});

/* The join has to survive being read back a second time, or a record
   rewrites itself a little more wrongly on every save. */
UNITS.forEach(u => {
  const once = P.splitUnit(P.joinUnit(ADDR, u));
  const twice = P.splitUnit(P.joinUnit(once.address, once.unit));
  check('stable on re-save: ' + u, twice, once);
});

/* "Residence" is unitDisplay's own word and must not accumulate. */
check('no doubled prefix', P.joinUnit(ADDR, '4B'), '555 W 59th St, Residence 4B');
check('prefix stripped once', P.splitUnit('555 W 59th St, Residence 4B').unit, '4B');
check('typed spelling untouched', P.joinUnit(ADDR, 'Apt 4B'), '555 W 59th St, Apt 4B');

/* ------------------------------------------------------------
   3. A town is not a unit. The regex is a guess about human text, so the
   ways it could guess wrong are pinned individually.
   ------------------------------------------------------------ */
check('town tail is not a unit',
  P.splitUnit('12 Ocean Ave, Sea Bright, NJ'),
  { address: '12 Ocean Ave, Sea Bright, NJ', unit: '' });

check('city tail is not a unit',
  P.splitUnit('45 Crosby Street, New York'),
  { address: '45 Crosby Street, New York', unit: '' });

check('no comma, no unit',
  P.splitUnit('45 Crosby Street'),
  { address: '45 Crosby Street', unit: '' });

check('empty is empty', P.splitUnit(''), { address: '', unit: '' });

/* A unit on an address that already carries a town keeps the whole town. */
check('town plus unit',
  P.splitUnit(P.joinUnit('12 Ocean Ave, Sea Bright, NJ', '4B')),
  { address: '12 Ocean Ave, Sea Bright, NJ', unit: '4B' });

/* ------------------------------------------------------------
   4. Two apartments in one building are two properties. This is the
   constraint the whole identity design bends around: get it wrong and the
   second save overwrites the first listing.
   ------------------------------------------------------------ */
const slugA = P.slugOfCore({ address: '45 Crosby Street', unit: 'PH C' });
const slugB = P.slugOfCore({ address: '45 Crosby Street', unit: '3B' });
ok('two units, two slugs', slugA !== slugB);
check('same unit, same slug', P.slugOfCore({ address: '45 Crosby Street', unit: '3B' }), slugB);

/* An older record whose unit is still inside the address line must land on
   the same identity as the split form, or loading and re-saving it would
   fork the property in two. */
check('joined and split agree',
  P.slugOfCore({ address: '45 Crosby Street, Residence 3B' }),
  P.slugOfCore({ address: '45 Crosby Street', unit: '3B' }));

/* ------------------------------------------------------------
   5. unitOf decides what a record means, in one place.
   ------------------------------------------------------------ */
check('trusts an explicit unit',
  P.unitOf({ address: '45 Crosby Street', unit: '3B' }),
  { address: '45 Crosby Street', unit: '3B' });

check('falls back to the joined line',
  P.unitOf({ address: '45 Crosby Street, Residence 3B' }),
  { address: '45 Crosby Street', unit: '3B' });

check('legacy Penthouse line', // the old splitUnit could not read this either
  P.unitOf({ address: '45 Crosby Street, Penthouse C' }),
  { address: '45 Crosby Street', unit: 'Penthouse C' });

check('no unit anywhere',
  P.unitOf({ address: '45 Crosby Street' }),
  { address: '45 Crosby Street', unit: '' });

/* ------------------------------------------------------------
   6. Saving replaces the keys a tool owns, and only those. Clearing a price
   used to be impossible: the empty value was skipped and the old figure
   stood.
   ------------------------------------------------------------ */
const stored = { address: '45 Crosby St', price: '$1,200,000', sqft: '1,100', beds: '2' };

check('a cleared field clears',
  P.mergeCore(stored, { address: '45 Crosby St', price: '', beds: '2' }).price,
  '');

check('a key the tool does not send is left alone',
  P.mergeCore(stored, { address: '45 Crosby St', price: '', beds: '2' }).sqft,
  '1,100');

check('a new value wins',
  P.mergeCore(stored, { price: '$1,150,000' }).price,
  '$1,150,000');

check('an empty list clears',
  P.mergeCore({ features: ['River views'] }, { features: [] }).features,
  []);

/* ------------------------------------------------------------
   7. The agent is asked before any of that happens. A clear is a change and
   has to appear in the dialog — it was the one change the dialog skipped.
   ------------------------------------------------------------ */
check('clearing is reported',
  P.changesAgainst({ price: '$1,200,000' }, { price: '' }),
  [{ field: 'price', was: '$1,200,000', now: '' }]);

check('filling a gap is not a change',
  P.changesAgainst({ price: '' }, { price: '$1,200,000' }),
  []);

check('an unchanged value is not a change',
  P.changesAgainst({ price: '$1,200,000' }, { price: '$1,200,000' }),
  []);

check('a real edit is reported',
  P.changesAgainst({ price: '$1,200,000' }, { price: '$1,150,000' }),
  [{ field: 'price', was: '$1,200,000', now: '$1,150,000' }]);

/* Key order out of Postgres is not the order that went in — a comps array
   that made the round trip must not read as an edit. */
check('key order is not a change',
  P.changesAgainst({ comps: [{ a: 1, b: 2 }] }, { comps: [{ b: 2, a: 1 }] }),
  []);

/* ------------------------------------------------------------ */
if (failures.length) {
  console.error('\n  ' + failures.length + ' failed, ' + pass + ' passed\n');
  failures.forEach(f => console.error('  ✗ ' + f + '\n'));
  process.exit(1);
}
console.log('\n  ' + pass + ' passed\n');
