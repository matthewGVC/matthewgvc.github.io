/* ============================================================
   Tests for the job page's showsheet judgement (assets/js/job-page/kit.js
   GVC_JP.kit.judge): the page must hand GVC_STALE the clock its Drive read
   is on. 225 E79 PHA (11-03): a sheet built from G: dates, the page read
   through Google, and the page said "front photo, back photo" changed when
   nothing had: a second function named clockOf (a time formatter) replaced
   the clock check, so the page passed '' and dates from two clocks were
   compared. Made-up rows only.

     node scripts/test-kit-judge.js
   ============================================================ */
'use strict';

const S = require('../assets/js/sheet-job.js');
global.window = global;
global.GVC_SHEETJOB = S;
global.GVC_PIECEJOB = require('../assets/js/piece-job.js');
global.GVC_STALE = require('../assets/js/piece-stale.js');
global.GVC_DRIVE_RULES = require('../assets/js/drive-rules.js');
global.GVC_KIT = require('../assets/js/kit-track.js');
global.GVC_JP = { drive: { day: () => '', msgs: {} } };
require('../assets/js/job-page/kit.js');
const K = global.GVC_JP.kit;

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const core = { address: '100 Example St', unit: 'PH', propertyType: 'Condo', agentIds: ['a', 'b'], price: 2250000,
  facts: { price: { value: 2250000, source: 'DE', bySource: { DE: 2250000 } } } };
const row = { id: 'p1', slug: '100-example-st-ph', kind: 'sale', market: 'NYC', core, de: { listingUrl: 'https://www.elliman.com/x/1' },
  photo_hero: 'Photos/Edited/01.jpg', photo_order: ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg'] };
// built by the helper from G:: the photos' own saved dates (2 Dec)
const doc = { tool: 'showsheet', built_from: S.builtFrom({ ownership: 'condo', agentIds: ['a', 'b'], paper: 'a5', bleed: false }, row, {
  photos: { front: { path: 'Photos/Edited/01.jpg', modified: '2026-12-02T10:00:00Z' }, back: { path: 'Photos/Edited/02.jpg', modified: '2026-12-02T10:00:00Z' } },
  via: 'helper' }), output: { name: 'Showsheet - 100 Example St PH - 2026-11-03.pdf' } };
// the same two photos read through Google: Google's modifiedTime (4 Dec), clock 'google'
const google = ['01', '02'].map(n => ({ path: 'Photos/Edited/' + n + '.jpg', name: n + '.jpg', modified: '2026-12-04T10:00:00Z', clock: 'google' }));
const ctx = { kind: 'listing', row, doc };

check('G: build, page reads Drive through Google: not out of date', (K.judge(ctx, { photos: google }, true) || {}).state, 'fresh');
const disk = google.map(f => ({ path: f.path, name: f.name, modified: f.modified }));
check('G: build, page reads G: with a newer date: out of date', ((K.judge(ctx, { photos: disk }, true) || {}).changes || []).map(c => c.field), ['photos.front', 'photos.back']);
check('the brochure row gets the clock too', (K.judgeAll(Object.assign({}, ctx, { docs: [{ tool: 'brochure', built_from: global.GVC_PIECEJOB.builtFrom('brochure', {}, row,
  { via: 'helper', photos: ['01', '02'].map(n => ({ path: 'Photos/Edited/' + n + '.jpg', modified: '2026-12-02T10:00:00Z' })) }) }] }), { photos: google }, true)
  .filter(x => x.tool === 'brochure')[0] || { s: {} }).s.state, 'fresh');

console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
if (failures.length) {
  console.log('\n  ' + failures.join('\n\n  ') + '\n');
  process.exit(1);
}
console.log();
