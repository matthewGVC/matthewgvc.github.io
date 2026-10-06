/* ============================================================
   Tests for tools/nj-footprint — the data contract and the totals.

   Plain Node, no browser, no install:  node scripts/test-nj-footprint.js

   The page prints whatever is in transactions.js, so the thing worth guarding is
   that file: when the real MLS list is pasted in, a misspelt county, a text price or an
   unknown agent should fail here, not print as a blank county or a short total.
   ============================================================ */
'use strict';

const path = require('path');
const dir = path.join(__dirname, '..', 'tools', 'nj-footprint');
global.window = global;
require(path.join(dir, 'nj-counties.js'));
require(path.join(dir, 'transactions.js'));
const F = require(path.join(dir, 'footprint.js'));

const errors = [];
const check = (ok, msg) => { if (!ok) errors.push(msg); };

const counties = window.NJ_COUNTIES.counties;
const names = new Set(counties.map(c => c.name));
const rows = window.NJ_TRANSACTIONS;

// map
check(counties.length === 21, 'NJ has 21 counties, found ' + counties.length);
F.CORE.forEach(c => check(names.has(c), 'core county missing from the map: ' + c));
counties.forEach(c => check(c.d && c.c.length === 2 && c.c.every(Number.isFinite), 'bad outline for ' + c.name));

// data contract
check(Array.isArray(rows) && rows.length > 0, 'no transactions');
check(typeof window.NJ_DRAFT_NOTE === 'string', "NJ_DRAFT_NOTE must be a string ('' for a finished sheet)");
check(typeof window.NJ_SOURCE === 'string' && window.NJ_SOURCE.length > 10, 'NJ_SOURCE must say where the figures come from');
rows.forEach((r, i) => {
  const at = 'row ' + (i + 1) + ' (' + r.town + '): ';
  check(/^\d{4}(-(0[1-9]|1[0-2])(-\d{2})?)?$/.test(r.date), at + 'date must be YYYY, YYYY-MM or YYYY-MM-DD (approximate dates are allowed)');
  check(r.town && typeof r.town === 'string', at + 'town missing');
  check(names.has(r.county), at + 'county "' + r.county + '" is not an NJ county name (use "Monmouth", not "Monmouth County")');
  check(Number.isFinite(r.price) && r.price > 0, at + 'price must be a positive number');
  check(F.AGENTS.indexOf(r.agent) !== -1, at + 'unknown agent "' + r.agent + '"');
});

// totals
const s = F.summarize(rows);
const sum = (o, k) => Object.values(o).reduce((a, v) => a + v[k], 0);
check(s.deals === rows.length, 'deal count off');
check(s.volume === rows.reduce((a, r) => a + r.price, 0), 'volume off');
['deals', 'volume'].forEach(k => {
  check(sum(s.byCounty, k) === s[k], 'county ' + k + ' do not add up to the total');
  check(sum(s.byAgent, k) === s[k], 'agent ' + k + ' do not add up to the total');
});
// A draft sheet may hold only some agents' sales; a finished one must hold all three.
F.AGENTS.forEach(a => {
  if (s.byAgent[a].deals > 0) return;
  if (window.NJ_DRAFT_NOTE) console.warn('note: ' + a + ' has no sales in the list yet (draft sheet)');
  else errors.push(a + ' has no deals — is their business in the list?');
});
F.CORE.forEach(c => check(s.byCounty[c] && s.byCounty[c].deals > 0, c + ' has no deals'));

// shading + short money
check(F.tone('Monmouth', s) === 'core' && F.tone('Ocean', s) === 'core', 'core counties must shade as core');
check(F.tone('Salem', { byCounty: {} }) === 'none', 'a county with no sales must shade as none');
check(F.tone('Hudson', { byCounty: { Hudson: { deals: 1 } } }) === 'active', 'other counties with sales must shade as active');
check(F.moneyShort(94175000) === '$94.2M', 'moneyShort 94175000 -> ' + F.moneyShort(94175000));
check(F.moneyShort(5250000) === '$5.25M', 'moneyShort 5250000 -> ' + F.moneyShort(5250000));
check(F.moneyShort(40000000) === '$40M', 'moneyShort 40000000 -> ' + F.moneyShort(40000000));
check(F.moneyShort(950000) === '$950K', 'moneyShort 950000 -> ' + F.moneyShort(950000));

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('nj-footprint: ' + rows.length + ' sales, ' + counties.length + ' counties — ok');
