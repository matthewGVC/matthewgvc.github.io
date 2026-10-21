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
check('rel', R.rel('\\Photos\\Edited\\'), 'Photos/Edited');
check('rel dotdot', R.rel('Photos/../Docs'), null);

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
