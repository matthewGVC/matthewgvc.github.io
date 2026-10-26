/* ============================================================
   Tests for assets/js/drive-rules.js — the read allowlist (plan §9).
   Inside a job folder the workspace may read Floorplan\, Photos\,
   Marketing\ (and today's old names for the same things) and, at the top
   level, only a "details" .docx. Deal paperwork is never opened.

   Plain Node:  node scripts/test-drive-allow.js
   ============================================================ */
'use strict';

const R = require('../assets/js/drive-rules.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

check('floorplan', R.allowedInJob('Floorplan/v2/plan.svg'), true);
check('floor plan (singular)', [R.allowedInJob('Floor Plan/Unbranded/x v1.svg'), R.allowedInJob('Floor Plan')], [true, true]);
check('planPlace: / or \\', [R.planPlace('Floor Plan/Unbranded/x v1.svg'), R.planPlace('Floorplan\\Branded\\x v1.png'), R.planPlace('Floorplan/x v1.png')], ['unbranded', 'branded', null]);
check('photos', R.allowedInJob('Photos/Edited/edit 01.jpg'), true);
check('marketing', R.allowedInJob('Marketing/Showsheet/Showsheet - 1050 Park Ave 13C - 2026-10-19.pdf'), true);
check('old names', ['Floor Plans/a.png', 'ShowSheet/a.pdf', 'Showsheets/a.pdf', 'Brochure/a.pdf', 'Copy/Description.docx', 'Video/a.mp4'].every(R.allowedInJob), true);
check('details doc', R.allowedInJob('1050 Park 13C showsheet details.docx'), true);
check('Details caps', R.allowedInJob('DETAILS.docx'), true);
check('top-level pdf', R.allowedInJob('Exclusive signed.pdf'), false);
check('top-level docx not details', R.allowedInJob('Contract.docx'), false);
check('Docs', R.allowedInJob('Docs/details.docx'), false);
check('Offers', R.allowedInJob('Offers/offer 1.pdf'), false);
check('dotdot', R.allowedInJob('Photos/../Docs/x.pdf'), false);
check('backslashes', R.allowedInJob('Photos\\Edited\\a.jpg'), true);
check('offer named details', R.allowedInJob('Offer details.docx'), false);
check('exclusive named details', R.allowedInJob('Exclusive details.docx'), false);
check('contract named details', R.allowedInJob('Contract Details.docx'), false);
check('dot-space segment', R.allowedInJob('Photos/.. /Docs/x.pdf'), false);
check('three dots', R.allowedInJob('Photos/.../Docs/x.pdf'), false);
check('dots and spaces', R.allowedInJob('Photos/....  /Docs/x.pdf'), false);
check('rel dot-space', R.rel('Photos/.. /Docs'), null);
check('folder itself',R.allowedInJob('Photos'), true);
check('empty', R.allowedInJob(''), false);
check('paperwork names', ['Docs', 'Offers', 'Contracts', 'Contract', 'Deal Sheet', 'Deals', 'Commission', 'Exclusives', 'Closing'].every(R.isPaperworkFolder), true);
check('not paperwork', R.isPaperworkFolder('Photos'), false);
check('paper word: mid-name', ['Signed Contract Floorplan.pdf', 'Showsheet - Offer from Buyer.pdf', 'Lease agreement.pdf', 'exclusive.pdf', 'Deals.pdf'].every(R.hasPaperworkWord), true);
check('paper word: whole words only', ['Dealer.pdf', 'Floorplan v2.pdf', 'Listing details doc.docx', 'Offering plan.pdf', 'Photos'].some(R.hasPaperworkWord), false);
check('paper word: empty', [R.hasPaperworkWord(''), R.hasPaperworkWord(null)], [false, false]);
check('older top-level marketing folders readable', ['Show Sheet', 'Open House', 'Postcard', 'Postcards', 'Signage', 'Signs'].every(n => R.allowedInJob(n) && R.allowedInJob(n + '/a.pdf')), true);
/* R10: paperwork anywhere in a nested path is refused, not only in the first segment */
check('nested paperwork word refused', ['Marketing/Offer from Jane Client.pdf', 'Photos/Edited/Signed Contract.jpg', 'Marketing/Showsheet/Exclusive.pdf'].some(R.allowedInJob), false);
check('nested paperwork folder refused', ['Marketing/Offers/a.pdf', 'Photos/Docs/a.jpg', 'Floorplan/Contracts/v1.pdf', 'Marketing/Deal Sheet/a.pdf'].some(R.allowedInJob), false);
check('prefix rule only for folders: file names like Offering, Dock, Document are fine',
  ['Marketing/Offering plan.pdf', 'Photos/Edited/Dock view.jpg', 'Marketing/Brochure/Document.pdf', 'Marketing/Dealer.pdf'].map(R.allowedInJob), [true, true, true, true]);
check('paperwork folders and words still refused', ['Offers/x.pdf', 'Docs/x.pdf', 'Marketing/Offer from Buyer.pdf', 'Marketing/Documents/a.pdf'].map(R.allowedInJob), [false, false, false, false]);
check('R13: whole paperwork words hide a file even in Marketing', ['Marketing/Postcard/Exclusive Listing postcard.pdf', 'Photos/Edited/Closing time.jpg'].map(R.allowedInJob), [false, false]);
check('final review 1: folder prefix rule takes whole leading words, so Dock photos is a folder like any other',
  [R.isPaperworkFolder('Dock photos'), R.allowedInJob('Photos/Dock photos/a.jpg'), R.isPaperworkFolder('Documents'), R.isPaperworkFolder('Docs 2024'), R.isPaperworkFolder('Offers')],
  [false, true, true, true, true]);
check('nested marketing still fine', ['Marketing/Showsheet/Showsheet - 1 Example St - 2026-10-01.pdf', 'Floorplan/v2/Floorplan unbranded.pdf', 'Photos/Edited/01.jpg'].every(R.allowedInJob), true);

/* jobTree: what the page and the tree builder may show */
const f = (name, extra) => Object.assign({ name, kind: 'file' }, extra || {});
const d = (name, children) => ({ name, kind: 'directory', children: children || [] });
const raw = d('4A', [
  f('Exclusive - Jane Client.pdf'), f('Brochure draft.pdf'), f('100 Example St 4A details.docx', { size: 10, modified: '2026-10-10T10:00:00Z' }),
  d('Offers', [f('Offer from Jane Client.pdf')]), d('Docs', [f('x.pdf')]), d('Old stuff', [f('a.pdf')]), { name: 'Contract Jane Client', kind: 'directory', skipped: true },
  d('Marketing', [f('Offer from Jane Client.pdf'), d('Showsheet', [f('Showsheet - 1.pdf', { size: 5, modified: '2026-10-01T10:00:00Z' }), d('Archive', [f('Showsheet - 0.pdf')])])]),
  d('Photos', [d('Edited', [f('01.jpg'), f('Closing gift.jpg')])])
]);
raw.looseCount = 2;
const t = R.jobTree(raw);
const names = n => (n.children || []).map(c => c.name);
check('jobTree: top shows readable folders, the doc, non-paperwork loose files, paperwork as Docs/Paperwork',
  names(t), ['Brochure draft.pdf', '100 Example St 4A details.docx', 'Paperwork', 'Docs', 'Paperwork', 'Marketing', 'Photos']);
check('jobTree: paperwork folders skipped, never opened', t.children.filter(c => c.skipped).map(c => (c.children || []).length), [0, 0, 0]);
check('jobTree: loose paperwork counted on top of the count given', t.looseCount, 3);
check('jobTree: other folders counted', t.otherCount, 1);
check('jobTree: nested paperwork dropped', names(t.children.find(c => c.name === 'Marketing')), ['Showsheet']);
check('jobTree: nested files keep size and date', t.children.find(c => c.name === 'Marketing').children[0].children[0], { name: 'Showsheet - 1.pdf', kind: 'file', size: 5, modified: '2026-10-01T10:00:00Z' });
check('jobTree: photos with a paperwork word dropped', names(t.children.find(c => c.name === 'Photos').children[0]), ['01.jpg']);
check('jobTree: no paperwork name anywhere', /Jane Client|Offer|Contract|Exclusive|Old stuff/.test(JSON.stringify(t)), false);
check('jobTree: twice is the same', JSON.stringify(R.jobTree(t)), JSON.stringify(t));
check('jobTree: input untouched', raw.children.length, 9);
check('jobTree: a broken link passes through', R.jobTree({ name: 'x', kind: 'directory', broken: true }), { name: 'x', kind: 'directory', broken: true });

check('rel', R.rel('\\Photos\\Edited\\'), 'Photos/Edited');

/* sidecar and system files are never a piece, a photo or a count (slice3 tune-up 3) */
check('isJunk: sidecars and system files',
  ['GVC Video Clips.m4v.xmpses.xmp', 'a.xmp', 'IMG_1.CR3.xmp', 'clip.xmpses', 'desktop.ini', 'Desktop.ini', 'Thumbs.db', 'thumbs.db', '.DS_Store',
   '~$Details 2A.docx', '._01.jpg', '.hidden'].map(R.isJunk), Array(12).fill(true));
check('isJunk: real files are kept', ['GVC Video Clips.m4v', '01.jpg', 'Details 2A.docx', 'xmp notes.pdf', 'Floorplan v2.pdf', 'Thumbs up.jpg'].map(R.isJunk),
  [false, false, false, false, false, false]);
const junky = { name: '2A', kind: 'directory', children: [
  { name: 'desktop.ini', kind: 'file' }, { name: 'Details 2A.docx', kind: 'file' }, { name: '~$Details 2A.docx', kind: 'file' },
  { name: 'Video', kind: 'directory', children: [{ name: 'Clip.m4v', kind: 'file' }, { name: 'Clip.m4v.xmpses.xmp', kind: 'file' }, { name: 'Thumbs.db', kind: 'file' }] }] };
const jt = R.jobTree(junky);
check('jobTree: junk dropped at the top and below, never counted', [jt.children.map(c => c.name), jt.children[1].children.map(c => c.name), jt.looseCount], [['Details 2A.docx', 'Video'], ['Clip.m4v'], 0]);
check('rel dotdot', R.rel('Photos/../Docs'), null);

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
