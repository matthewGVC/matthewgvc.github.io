/* ============================================================
   Tests for assets/js/kit-track.js — the marketing-step track: the file
   found on Drive against Asana's tick, per kit piece (spec S12).

   Plain Node:  node scripts/test-kit-track.js
   ============================================================ */
'use strict';

const K = require('../assets/js/kit-track.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const file = (name, modified, archived) => ({ path: 'Marketing/' + name, name, modified, archived: !!archived });
const step = (name, done, doneOn, who) => ({ name, done, doneOn: doneOn || null, who: who || null });
const row = (res, key) => res.rows.filter((r) => r.key === key)[0];

/* a showsheet loose at the top (another job's copy) never beats the one in its own folder, even when newer */
const top1 = K.track({ kind: 'sale', market: 'NYC', checklist: [], pieces: { showsheet: [
  { path: 'Showsheet 69 W9 - 12E.docx', name: 'Showsheet 69 W9 - 12E.docx', modified: '2026-08-10T00:00:00Z' },
  { path: '2026 - Sale/Showsheet/404 PAS - SHOWSHEET.pdf', name: '404 PAS - SHOWSHEET.pdf', modified: '2026-06-12T00:00:00Z' }] } });
check('loose top showsheet ranks after the one in its folder', row(top1, 'showsheet').file.name, '404 PAS - SHOWSHEET.pdf');
const top2 = K.track({ kind: 'sale', market: 'NYC', checklist: [], pieces: { showsheet: [{ name: 'Showsheet old.docx', modified: '2026-08-10T00:00:00Z', top: true }, { name: 'S.pdf', modified: '2026-06-12T00:00:00Z' }] } });
check('the scan top flag does the same', row(top2, 'showsheet').file.name, 'S.pdf');

const ORDER = ['floorplan', 'photos', 'showsheet', 'brochure', 'postcard', 'signage', 'video'];

/* NYC sale: Global order, signage not used */
let res = K.track({ kind: 'sale', market: 'NYC', pieces: {}, checklist: [], match: null });
check('order', res.rows.map((r) => r.key), ORDER);
check('labels', res.rows.map((r) => r.label), ['Floorplan', 'Photos', 'Showsheet', 'Brochure', 'Postcard', 'Signage', 'Video']);
check('NYC signage notUsed', row(res, 'signage').state, 'notUsed');
check('video tracked', row(res, 'video').state, 'tracked');
check('nothing yet', res.rows.filter((r) => ['notUsed', 'tracked'].indexOf(r.state) === -1).map((r) => r.state), ['notStarted', 'notStarted', 'notStarted', 'notStarted', 'notStarted']);
check('no checklist only', res.checklistOnly, []);

/* NJ signage is a normal row */
check('NJ signage not notUsed', row(K.track({ kind: 'sale', market: 'NJ', pieces: {}, checklist: [] }), 'signage').state, 'notStarted');

/* rental: all rows present */
check('rental rows', K.track({ kind: 'rental', market: 'NYC', pieces: {}, checklist: [] }).rows.map((r) => r.key), ORDER);

/* showsheet ticked + file → done; step carried */
const list = [{ block: 'Marketing', steps: [
  step('Create Show Sheet', true, '2026-09-10', 'MB'),
  step('Brand Floorplan', false),
  step('Pics/Video/FP', true, '2026-09-05', 'TJ'),
  step('Just Listed Postcard', false),
  step('Send Just Listed Email', true, '2026-09-12'),
  step('Advertising Spots', false)
] }];
const pieces = {
  showsheet: [file('old.pdf', '2026-09-02T10:00:00Z'), file('new.pdf', '2026-09-09T10:00:00Z'), file('older.pdf', '2026-08-01T10:00:00Z', true)],
  floorplan: [file('fp.pdf', '2026-09-03T10:00:00Z')],
  postcard: []
};
res = K.track({ kind: 'sale', market: 'NYC', pieces, checklist: list, match: null });
let s = row(res, 'showsheet');
check('showsheet done', s.state, 'done');
check('newest file', s.file, { name: 'new.pdf', modified: '2026-09-09T10:00:00Z' });
check('older count', s.older, 2);
check('step carried', s.step, { name: 'Create Show Sheet', done: true, doneOn: '2026-09-10', who: 'MB' });
/* file + open step */
check('floorplan fileOpen', row(res, 'floorplan').state, 'fileOpen');
/* tick, no file */
check('photos tickedNoFile', row(res, 'photos').state, 'tickedNoFile');
check('photos file null', row(res, 'photos').file, null);
/* postcard: open step, no file */
check('postcard notStarted', row(res, 'postcard').state, 'notStarted');
check('postcard step shown', row(res, 'postcard').step.name, 'Just Listed Postcard');
/* video: tracked, shares the Pics/Video/FP step */
check('video tracked with step', [row(res, 'video').state, row(res, 'video').step && row(res, 'video').step.done], ['tracked', true]);
/* piece with no Asana step but a file */
res = K.track({ kind: 'sale', market: 'NJ', pieces: { brochure: [file('b.pdf', '2026-09-01T00:00:00Z')] }, checklist: [] });
check('brochure file, no step → done', [row(res, 'brochure').state, row(res, 'brochure').step], ['done', null]);
/* only archived files: no current file */
res = K.track({ kind: 'sale', market: 'NJ', pieces: { brochure: [file('b.pdf', '2026-09-01T00:00:00Z', true)] }, checklist: [] });
check('archived only', [row(res, 'brochure').state, row(res, 'brochure').file, row(res, 'brochure').older], ['notStarted', null, 1]);

/* Just Listed Email: checklist only, NYC only; never a piece step */
res = K.track({ kind: 'sale', market: 'NYC', pieces: {}, checklist: list });
check('NYC checklist only', res.checklistOnly, [{ name: 'Send Just Listed Email', done: true, doneOn: '2026-09-12' }, { name: 'Advertising Spots', done: false, doneOn: null }]);
res = K.track({ kind: 'sale', market: 'NJ', pieces: {}, checklist: list });
check('NJ: email not listed', res.checklistOnly.map((x) => x.name), ['Advertising Spots']);
check('email never marks a piece', res.rows.some((r) => r.step && /email/i.test(r.step.name)), false);

/* NJ Just Listed Postcard maps to postcard, ticked */
res = K.track({ kind: 'sale', market: 'NJ', pieces: { postcard: [file('pc.pdf', '2026-09-01T00:00:00Z')] }, checklist: [{ block: 'x', steps: [step('Just Listed Postcard', true, '2026-09-02')] }] });
check('NJ postcard done', row(res, 'postcard').state, 'done');

/* M8 from the match list attaches to its row; others do not */
res = K.track({ kind: 'sale', market: 'NYC', pieces: {}, checklist: list,
  match: { list: [{ code: 'M8', key: 'M8:photos', text: 'Pics is ticked in Asana; no edited photos in the folder.' }, { code: 'M5', key: 'M5:closedOn', text: 'x' }], dismissed: {} } });
check('M8 on photos', row(res, 'photos').mismatch, { code: 'M8', text: 'Pics is ticked in Asana; no edited photos in the folder.' });
check('other rows no mismatch', res.rows.filter((r) => r.key !== 'photos').every((r) => r.mismatch === null), true);

/* url passes through */
res = K.track({ kind: 'sale', market: 'NJ', pieces: { showsheet: [{ path: 'a', name: 'a.pdf', modified: '2026-09-01T00:00:00Z', archived: false, url: 'https://drive.google.com/file/d/x/view' }] }, checklist: [] });
check('url kept', row(res, 'showsheet').file.url, 'https://drive.google.com/file/d/x/view');

/* a sidecar or system file is never the piece's newest file (slice3 tune-up 3) */
res = K.track({ kind: 'sale', market: 'NJ', pieces: { video: [file('GVC Video Clips.m4v.xmpses.xmp', '2026-10-14T00:00:00Z'), file('GVC Video Clips.m4v', '2026-10-05T00:00:00Z'),
  file('desktop.ini', '2026-10-15T00:00:00Z')], floorplan: [file('Thumbs.db', '2026-10-15T00:00:00Z')] }, checklist: [] });
check('sidecar never the newest file, nor counted as older', [row(res, 'video').file.name, row(res, 'video').older], ['GVC Video Clips.m4v', 0]);
check('only junk is no file', [row(res, 'floorplan').file, row(res, 'floorplan').state], [null, 'notStarted']);
res = K.track({ kind: 'sale', market: 'NJ', pieces: { floorplan: [{ path: 'Floorplans/Design/plans.pdf', name: 'plans.pdf', modified: '2026-10-01T00:00:00Z' }] }, checklist: [] });
check('a reference in Floorplan/Design/ is not a floorplan', [row(res, 'floorplan').file, row(res, 'floorplan').state], [null, 'notStarted']);
res = K.track({ kind: 'sale', market: 'NJ', pieces: { floorplan: [{ path: 'Floorplans/Design/plans.pdf', name: 'plans.pdf', modified: '2026-10-01T00:00:00Z' }, { path: 'Floorplans/Unbranded/x v1.svg', name: 'x v1.svg', modified: '2026-10-02T00:00:00Z' }] }, checklist: [] });
check('the Unbranded plan is the floorplan', [row(res, 'floorplan').file.name, row(res, 'floorplan').state], ['x v1.svg', 'done']);

/* STEPS match match-check's patterns */
check('STEPS pieces', K.STEPS.pieces.map((p) => p[0]), ['showsheet', 'floorplan', 'photos', 'postcard']);
check('never-file pattern', K.STEPS.neverFile.test('send just listed email'), true);

/* output has no dashes of the em/en kind */
check('no long dashes', /[–—]/.test(JSON.stringify(res)), false);

console.log((failures.length ? failures.join('\n') + '\n' : '') + pass + ' passed, ' + failures.length + ' failed');
process.exit(failures.length ? 1 : 0);
