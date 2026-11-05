/* ============================================================
   Tests for a development's Finishes card (assets/js/job-page/finishes.js,
   plan D142) and its Drive rule (GVC_DRIVE_RULES.finishFile): only PDFs that
   say "finish" in their name or folder, never paperwork; no finish sheet →
   "No finish sheet yet", never a made-up one; known gaps → "To be confirmed";
   no file's own name on the page. Made-up rows only.

     node scripts/test-finishes.js
   ============================================================ */
'use strict';

global.window = global;
const R = require('../assets/js/drive-rules.js');
global.GVC_DRIVE_RULES = R;
require('../assets/js/job-page/finishes.js');
const F = global.GVC_JP.finishes;

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ctx = (slug, drive) => ({ row: { slug, drive_folder: 'GVC - Florida/New Development/X' }, drive: drive || 'connected', esc, I: () => '' });

// the rule
check('PDF in a Finishes folder', R.finishFile('0 - Approved Assets/Finishes/Le Reve Finish Schedule.pdf'), true);
check('PDF named for finishes, loose', R.finishFile('0 - Approved Asset Collection/CASA AVENIDA_Finishes Schedule 6.17.26.pdf'), true);
check('PDF that says nothing of finishes', R.finishFile('0 - Approved Asset Collection/Links.pdf'), false);
check('a working spreadsheet (prices) is never shown', R.finishFile('Finish Schedule/BRADLEY WITH LINKS.xlsx'), false);
check('paperwork word', R.finishFile('Finishes/Signed contract.pdf'), false);
check('paperwork folder', R.finishFile('Finishes/Docs/a finish.pdf'), false);
check('up a folder', R.finishFile('../Finishes/a.pdf'), false);
check('junk', R.finishFile('Finishes/._a.pdf'), false);

// where to look
check('standard place', F.placesOf('366-north-3rd-street'), [{ path: 'Finishes' }]);
check('Le Reve place', F.placesOf('le-reve')[0].path, '0 - Approved Assets/Finishes');
check('two houses', F.placesOf('405-old-bridge-rd').map(p => p.label), ['House 1', 'House 2']);

// the card
const none = F.body(ctx('opus'), [{ place: { path: 'Finishes' }, files: [] }]);
check('no sheet says so', /No finish sheet yet/.test(none), true);
check('no sheet embeds nothing', /iframe/.test(none), false);
const url = 'https://drive.google.com/file/d/abcDEF123_-x/view';
const one = F.body(ctx('le-reve'), [{ place: F.placesOf('le-reve')[0], files: [{ name: 'Le Reve Finish Schedule.pdf', modified: '2026-11-04T13:05:00Z', url }] }]);
check('sheet embedded in Drive viewer', /src="https:\/\/drive\.google\.com\/file\/d\/abcDEF123_-x\/preview"/.test(one), true);
check('no file name shown', /Le Reve Finish Schedule/.test(one), false);
check('Open on Drive', one.indexOf('href="' + url + '"') !== -1, true);
const bad = F.body(ctx('le-reve'), [{ place: { path: 'Finishes' }, files: [{ name: 'x.pdf', url: 'javascript:alert(1)' }] }]);
check('a link that isn\'t a Drive file is dropped', /javascript/.test(bad), false);
const newest = F.body(ctx('405-old-bridge-rd'), [
  { place: { path: 'House 1/Finishes', label: 'House 1' }, files: [{ modified: '2026-10-01T00:00:00Z', url: 'https://drive.google.com/file/d/old1/view' }] },
  { place: { path: 'House 2/Finishes', label: 'House 2' }, files: [{ modified: '2026-11-01T00:00:00Z', url: 'https://drive.google.com/file/d/new2/view' }] }]);
check('newest one embedded', /file\/d\/new2\/preview/.test(newest), true);
check('house labels shown', /House 1 · Finish sheet/.test(newest) && /House 2 · Finish sheet/.test(newest), true);

// known gaps, and Drive not connected
const le = F.html(ctx('le-reve'));
check('Le Reve colours to be confirmed', /To be confirmed/.test(le) && /colours differ in every residence/.test(le), true);
check('no gaps listed when none known', /To be confirmed/.test(F.html(ctx('366-north-3rd-street'))), false);
check('Casa Avenida: one finish, no Brisa / Noir line', [/To be confirmed/.test(F.html(ctx('casa-avenida'))), F.placesOf('casa-avenida')[0].path], [false, '0 - Approved Asset Collection/7 - Tear Sheets']);
check('Casa Avenida: the tear sheet beside it is not a finish sheet', R.finishFile('0 - Approved Asset Collection/7 - Tear Sheets/Tear Sheet.pdf'), false);
check('Opus: not a new development, no Finishes card', F.html(ctx('opus')), '');
check('not connected asks for Google', /Sign in with Google/.test(F.html(ctx('610-agnes', 'not-connected'))), true);

if (failures.length) {
  console.log('FAIL ' + failures.length + ' of ' + (pass + failures.length) + '\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log('test-finishes: all ' + pass + ' pass');
