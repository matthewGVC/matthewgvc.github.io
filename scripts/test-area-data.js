/* ============================================================
   Ranking claims in the area datasets, checked against their own figures.

   Plain Node, no browser, no install:  node scripts/test-area-data.js

   The tearsheets do not only print numbers, they make claims about them —
   "the fastest homes in the city", "the slowest market on this list". Those
   claims are prose, so nothing was checking them, and four had drifted out of
   agreement with the figures printed beside them: Brooklyn called itself the
   fastest in the city while Staten Island sold six days quicker, and the
   Financial District and Washington Heights both claimed to be the slowest.

   A test cannot read prose. What it can do is pin down who the extremes
   actually are, so that editing a figure fails here and sends whoever changed
   it back to the sentence that quotes it.
   ============================================================ */
'use strict';

global.window = global.window || {};
require('../assets/js/nyc-areas.js');
require('../assets/js/nj-towns.js');

const NYC = global.window.GVC_NYC_AREAS;
const NJ = global.window.GVC_NJ_TOWNS;

let pass = 0;
const failures = [];

function check(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  failures.push(name + '\n      expected ' + JSON.stringify(want) +
                       '\n      got      ' + JSON.stringify(got));
}

const days  = a => parseInt(a.days, 10);
const rate  = t => parseFloat(t.rate);
const money = s => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return /M/i.test(s) ? n * 1e6 : /K/i.test(s) ? n * 1e3 : n;
};
const least = (rows, f) => [...rows].sort((a, b) => f(a) - f(b))[0].name;
const most  = (rows, f) => [...rows].sort((a, b) => f(b) - f(a))[0].name;

/* ------------------------------------------------------------
   New York — days to contract. Every sentence naming a fastest or a
   slowest is anchored to one of these.
   ------------------------------------------------------------ */
const areas = NYC.list;
const manhattan = areas.filter(a => a.county === 'Manhattan');

check('fastest area in the city',        least(areas, days),     'Staten Island');
check('slowest area in the city',        most(areas, days),      'Washington Heights');
check('fastest Manhattan submarket',     least(manhattan, days), 'East Village');
check('slowest Manhattan submarket',     most(manhattan, days),  'Washington Heights');

/* Brooklyn's line says "only Staten Island moves quicker", which is a claim
   about second place and would survive the check above unnoticed. */
const bySpeed = [...areas].sort((a, b) => days(a) - days(b)).map(a => a.name);
check('second-fastest in the city', bySpeed[1], 'Brooklyn');

/* The Financial District's line names the two areas that sit longer than it,
   so those two have to stay the only ones. */
const slowerThanFiDi = areas
  .filter(a => days(a) > days(areas.find(x => x.name === 'Financial District')))
  .map(a => a.name).sort();
check('areas slower than the Financial District',
      slowerThanFiDi, ['Central Harlem', 'Washington Heights']);

/* Two areas both claiming to be the slowest is the contradiction that started
   this file, and no ranking assertion catches it if the prose is edited and
   the figures are not. Matching prose is fragile, so the rule is deliberately
   narrow: a city-wide speed claim is a sentence that quotes a day count, uses
   the superlative, and scopes itself to the city. "Second-fastest" is a claim
   about second place, and the Lower East Side's "slowest downtown commute" is
   about minutes, not days — neither is competing for this title. */
function citywideSpeedClaims(word) {
  const scope = /\b(on this (list|page)|in the city|anywhere in the city)\b/i;
  return areas.filter(a => [a.tag, ...(a.notes || [])].some(s =>
    new RegExp('\\b' + word, 'i').test(s) &&
    /\bdays\b/i.test(s) &&
    scope.test(s) &&
    !/\bsecond[- ]/i.test(s)));
}
check('one area claims the city-wide fastest',
      citywideSpeedClaims('fastest').map(a => a.name), ['Staten Island']);
check('one area claims the city-wide slowest',
      citywideSpeedClaims('slowest').map(a => a.name), ['Washington Heights']);

/* ------------------------------------------------------------
   New Jersey — the towns make claims about rates, prices and tax bills.
   ------------------------------------------------------------ */
const towns = NJ.list;
const byRate = [...towns].sort((a, b) => rate(a) - rate(b)).map(t => t.name);

check('highest effective tax rate', most(towns, rate),  'Matawan');
check('lowest effective tax rate',  least(towns, rate), 'Beach Haven');
check('second-lowest tax rate',     byRate[1],          'Sea Bright');   // Sea Bright's own line
check('lowest median price',        least(towns, t => money(t.price)), 'Whiting');
check('smallest tax bill',          least(towns, t => money(t.tax)),   'Whiting');
check('biggest tax bill',           most(towns,  t => money(t.tax)),   'Rumson');

/* Tinton Falls claims the lowest price "outside Whiting and Freehold". */
const byPrice = [...towns].sort((a, b) => money(a.price) - money(b.price)).map(t => t.name);
check('cheapest three towns, in order', byPrice.slice(0, 3),
      ['Whiting', 'Freehold', 'Tinton Falls']);

/* ------------------------------------------------------------
   Both datasets stamp when they were last checked. An empty one would let a
   page print figures with no date against them.
   ------------------------------------------------------------ */
check('New York names its sources and date', !!(NYC.AS_OF || '').trim(), true);
check('New Jersey names its sources and date', !!(NJ.AS_OF || '').trim(), true);

/* ------------------------------------------------------------ */
if (failures.length) {
  console.error('\n  ' + failures.length + ' failed, ' + pass + ' passed\n');
  failures.forEach(f => console.error('  ✗ ' + f + '\n'));
  console.error('  A figure moved. Re-read the sentence that quotes it before' +
                ' changing this test.\n');
  process.exit(1);
}
console.log('\n  ' + pass + ' passed\n');
