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

/* adoptEdit: a value changed outside the helper (a tool save) becomes Matt's (D78, D79) */
f = F.applyFact({}, 'price', 'Asana', 880000).facts;
r = F.adoptEdit(f, 'price', 875000);
check('edit over a record is Matt\'s', [r.price.value, r.price.source, r.price.bySource], [875000, 'Matt', { Asana: 880000, Matt: 875000 }]);
check('then Asana\'s unchanged value does not take it', F.applyFact(r, 'price', 'Asana', 880000).facts.price.value, 875000);
check('no record: legacy by default', F.adoptEdit({}, 'sqft', 900).sqft, { value: 900, source: 'legacy', bySource: { legacy: 900 } });
check('no record: the given source', F.adoptEdit({}, 'sqft', 900, 'DE').sqft.source, 'DE');
check('same value: unchanged', F.adoptEdit(f, 'price', 880000), f);
check('empty value: unchanged', F.adoptEdit(f, 'price', null), f);
/* builders save numbers as text: the same figure typed as a string is no edit */
const fde = F.applyFact({}, 'price', 'DE', 2250000).facts;
check('numeric string equal to the number: unchanged', F.adoptEdit(fde, 'price', '2250000'), fde);
check('numeric string with commas: unchanged', F.adoptEdit(fde, 'price', '2,250,000'), fde);
check('a different figure as text is still an edit', F.adoptEdit(fde, 'price', '2200000').price.source, 'Matt');
check('text that is not a number still compares as text', F.adoptEdit(F.applyFact({}, 'zip', 'Asana', '07030').facts, 'zip', '7030').zip.source, 'Matt');

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

/* ---------- the page's field list, display, clear and value checks (Slice 3) ---------- */
const names = row => F.fieldsFor(row).map(x => x.name);
const coop = { market: 'NYC', kind: 'sale', core: { propertyType: 'Co-op' } };
check('NYC co-op: max financing and flip tax', ['maxFinancing', 'flipTax', 'maintenance', 'price'].every(n => names(coop).includes(n)), true);
check('NYC co-op: no common charges, no lot size', ['commonCharges', 'lotSize'].some(n => names(coop).includes(n)), false);
const njHouse = { market: 'NJ', kind: 'sale', core: { propertyType: 'Single family' } };
check('NJ house: no max financing or flip tax', ['maxFinancing', 'flipTax'].some(n => names(njHouse).includes(n)), false);
check('NJ house: lot size', names(njHouse).includes('lotSize'), true);
check('NJ house: common charges labelled HOA', F.fieldsFor(njHouse).find(x => x.name === 'commonCharges').label, 'HOA');
check('NYC condo: common charges label', F.fieldsFor({ market: 'NYC', kind: 'sale', core: { propertyType: 'Condo' } }).find(x => x.name === 'commonCharges').label, 'Common charges');
check('co-op: maintenance label', F.fieldsFor(coop).find(x => x.name === 'maintenance').label, 'Maintenance');
const rental = { market: 'NYC', kind: 'rental', core: { propertyType: 'Condo' } };
check('rental shows rent, not price', [names(rental).includes('rent'), names(rental).includes('price'), names(rental).includes('originalPrice')], [true, false, false]);
check('sale shows price, not rent', [names(coop).includes('price'), names(coop).includes('rent')], [true, false]);
check('core list has original price and MLS board', ['originalPrice', 'mlsBoard'].every(n => F.FIELDS.find(x => x.name === n && x.tier === 'core')), true);
check('extras are tiered', F.FIELDS.filter(x => x.tier === 'extra').map(x => x.name).includes('ceilingHeight'), true);
check('baths is its own kind', F.FIELDS.find(x => x.name === 'baths').kind, 'baths');
check('BADGE', F.BADGE, { DE: 'DE', Matt: 'Matt', Asana: 'Asana', form: 'form', doc: 'doc', legacy: 'earlier tool' });
check('no dashes in labels', F.FIELDS.some(x => /[–—]/.test(x.label)), false);

/* shown */
const get = (list, n) => list.find(x => x.name === n);
let sh = F.shown({ price: 2250000, beds: 2 }, njHouse);
check('legacy value: earlier tool badge', [get(sh, 'price').value, get(sh, 'price').source, get(sh, 'price').badge], [2250000, 'legacy', 'earlier tool']);
check('empty field: no badge', [get(sh, 'zip').value, get(sh, 'zip').badge], [null, null]);
let fx = F.applyFact({}, 'price', 'Asana', 2300000).facts;
fx = F.applyFact(fx, 'price', 'Matt', 2250000).facts;
sh = F.shown({ price: 2250000, facts: fx }, njHouse);
check('shown: Matt badge', [get(sh, 'price').source, get(sh, 'price').badge], ['Matt', 'Matt']);
check('shown: others lists Asana', get(sh, 'price').others, [{ source: 'Asana', badge: 'Asana', value: 2300000 }]);
check('shown: warn from warnOf', get(sh, 'price').warn, { source: 'Asana', value: 2300000 });
fx = F.applyFact(F.applyFact({}, 'price', 'DE', 2400000).facts, 'price', 'Matt', 2250000).facts;
check('shown: warn names DE', get(F.shown({ price: 2250000, facts: fx }, njHouse), 'price').warn, { source: 'DE', value: 2400000 });
fx = F.applyFact(F.applyFact({}, 'beds', 'DE', 2).facts, 'beds', 'Asana', 2).facts;
check('shown: agreeing source is not listed', get(F.shown({ beds: 2, facts: fx }, njHouse), 'beds').others, []);

/* clear */
fx = F.applyFact(F.applyFact({}, 'price', 'Asana', 2300000).facts, 'price', 'Matt', 2250000).facts;
check('clear: Asana shows again', F.clear(fx, 'price').price, { value: 2300000, source: 'Asana', bySource: { Asana: 2300000 } });
fx = F.applyFact({}, 'price', 'Matt', 2250000).facts;
check('clear: only Matt removes the fact', F.clear(fx, 'price'), {});
fx = F.applyFact(F.applyFact({}, 'price', 'DE', 2400000).facts, 'price', 'Matt', 2250000).facts;
check('clear: DE comes back over Matt', [F.clear(fx, 'price').price.value, F.clear(fx, 'price').price.source], [2400000, 'DE']);
check('clear: input untouched', fx.price.source, 'Matt');
fx = F.applyFact({}, 'price', 'DE', 2400000).facts;
check('clear: nothing of Matt\'s leaves it alone', F.clear(fx, 'price'), fx);

/* parse values */
const pv = (k, t) => F.parseValue(k, t);
check('parse $2.1M', pv('money', '$2.1M'), { ok: true, value: 2100000 });
check('parse 2,250,000', pv('money', '2,250,000'), { ok: true, value: 2250000 });
check('parse 850k', pv('money', '850k'), { ok: true, value: 850000 });
check('parse money empty', pv('money', ''), { ok: true, value: null });
check('parse money blank spaces', pv('money', '   '), { ok: true, value: null });
check('parse money abc', pv('money', 'abc'), { ok: false, error: 'Type a number, like 2250000 or $2.25M.' });
check('parse money never NaN', ['-5', '1e9', '$', '1.2.3'].map(t => pv('money', t).ok), [false, false, false, false]);
check('parse baths 3.5', pv('baths', '3.5'), { ok: true, value: 3, halfBaths: 1 });
check('parse baths 2', pv('baths', '2'), { ok: true, value: 2 });
check('parse baths 2.75 refused', pv('baths', '2.75').ok, false);
check('parse baths abc refused', pv('baths', 'abc').ok, false);
check('parse baths empty', pv('baths', ''), { ok: true, value: null });
check('parse number', pv('number', '1,200'), { ok: true, value: 1200 });
check('parse number abc', pv('number', 'abc').ok, false);
check('parse list', pv('list', 'Doorman\n  Gym \n\n'), { ok: true, value: ['Doorman', 'Gym'] });
check('parse list empty', pv('list', ' \n '), { ok: true, value: null });
check('parse text trims', pv('text', '  12L '), { ok: true, value: '12L' });
check('parse long keeps lines', pv('long', 'One.\nTwo.'), { ok: true, value: 'One.\nTwo.' });
check('parse error copy has no dashes', /[–—]/.test(pv('baths', 'x').error + pv('number', 'x').error), false);


if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
