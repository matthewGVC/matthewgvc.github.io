/* ============================================================
   Tests for assets/js/job-facts.js — which source's value a job's fact
   shows: DE > Matt > Asana > form > doc > legacy (D52, D79), with Matt's
   typed value holding, under a warning, until DE's own value changes (D78).

   Plain Node:  node scripts/test-job-facts.js
   ============================================================ */
'use strict';

const F = require('../assets/js/job-facts.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

check('RANK', F.RANK, ['DE', 'Matt', 'Asana', 'form', 'doc', 'legacy']);

/* first value lands */
let r = F.applyFact({}, 'price', 'Asana', 2300000);
check('first value', r.facts.price, { value: 2300000, source: 'Asana', bySource: { Asana: 2300000 } });
check('first value changed', r.changed, true);
check('input not mutated', JSON.stringify(F.applyFact({}, 'price', 'Asana', 1).facts) !== '{}', true);

/* Matt's price over Asana's holds */
r = F.applyFact(r.facts, 'price', 'Matt', 2250000);
check('Matt over Asana', [r.facts.price.value, r.facts.price.source, r.changed], [2250000, 'Matt', true]);
check('Matt differs from Asana → warn', r.warn, { source: 'Asana', value: 2300000 });
r = F.applyFact(r.facts, 'price', 'Asana', 2300000);
check('Asana again: Matt holds', [r.facts.price.value, r.facts.price.source, r.changed], [2250000, 'Matt', false]);
check('Asana again: still warns', r.warn, { source: 'Asana', value: 2300000 });
r = F.applyFact(r.facts, 'price', 'Asana', 2250000);
check('Asana agrees with Matt: no warn', [r.facts.price.value, r.warn], [2250000, undefined]);

/* DE: Matt typed while DE said 2.4M; DE still says 2.4M → Matt holds with a warning */
let f = F.applyFact({}, 'price', 'DE', 2400000).facts;
f = F.applyFact(f, 'price', 'Matt', 2250000).facts;
check('Matt over DE when he types', [f.price.value, f.price.source], [2250000, 'Matt']);
r = F.applyFact(f, 'price', 'DE', 2400000);
check('DE unchanged since Matt typed → Matt holds', [r.facts.price.value, r.facts.price.source, r.changed], [2250000, 'Matt', false]);
check('DE unchanged → warn DE', r.warn, { source: 'DE', value: 2400000 });
/* DE's own value then changes → DE wins */
r = F.applyFact(r.facts, 'price', 'DE', 2200000);
check('DE changes → DE wins', [r.facts.price.value, r.facts.price.source, r.changed, r.warn], [2200000, 'DE', true, undefined]);
check('bySource keeps every source', r.facts.price.bySource, { DE: 2200000, Matt: 2250000 });

/* DE's first value ever (Matt typed before the listing reached DE) is a change → DE wins */
f = F.applyFact({}, 'price', 'Matt', 2250000).facts;
r = F.applyFact(f, 'price', 'DE', 2300000);
check('DE first value replaces Matt', [r.facts.price.value, r.facts.price.source], [2300000, 'DE']);

/* ranks below */
f = F.applyFact({}, 'beds', 'doc', 3).facts;
r = F.applyFact(f, 'beds', 'legacy', 4);
check('legacy never replaces doc', [r.facts.beds.value, r.facts.beds.source, r.changed], [3, 'doc', false]);
check('legacy is remembered', r.facts.beds.bySource.legacy, 4);
r = F.applyFact(r.facts, 'beds', 'form', 2);
check('form replaces doc', [r.facts.beds.value, r.facts.beds.source], [2, 'form']);
r = F.applyFact(r.facts, 'beds', 'Asana', 2);
check('same value from a higher source takes the source', [r.facts.beds.value, r.facts.beds.source], [2, 'Asana']);
r = F.applyFact(r.facts, 'beds', 'Asana', 5);
check('same source updates its value', [r.facts.beds.value, r.changed], [5, true]);
f = F.applyFact({}, 'sqft', 'legacy', 900).facts;
check('legacy fills a gap', f.sqft.value, 900);

/* empty values never clear a fact */
f = F.applyFact({}, 'zip', 'Asana', '10019').facts;
r = F.applyFact(f, 'zip', 'Asana', null);
check('empty value ignored', [r.facts.zip.value, r.changed], ['10019', false]);
check('unknown source throws', (() => { try { F.applyFact({}, 'zip', 'Zillow', '1'); return 'no'; } catch (e) { return 'threw'; } })(), 'threw');
check('arrays compare by value', F.applyFact(F.applyFact({}, 'propertyType', 'Asana', ['Condo']).facts, 'propertyType', 'Asana', ['Condo']).changed, false);

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
