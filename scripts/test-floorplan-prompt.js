/* Tests for assets/js/floorplan-prompt.js.  Plain Node:  node scripts/test-floorplan-prompt.js */
'use strict';
const { build } = require('../assets/js/floorplan-prompt.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}
const F = (path, modified) => ({ path, name: path.split('/').pop(), modified });
const row = { id: 'p1', label: '176 E71 4B', market: 'NYC', kind: 'sale', drive_folder: 'GVC - New York/Building Information/176 E71/PHD',
  core: { beds: 2, baths: 2, address: '176 East 71st Street', unit: '4B' } };
const day = (iso) => { const d = new Date(iso), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const m1 = '2026-10-20T15:00:00', m2 = '2026-10-22T15:00:00';

const files = [F('Floorplan/Design/cubicasa.png', m1), F('Floorplan/Design/architect.pdf', m2),
  F('Floorplan/Unbranded/176 v2.svg', m1), F('Floorplan/Design/plan.json', m1), F('Floorplan/Design/run-v2.md', m1)];
let r = build(row, files, [{ version: 3 }]);
check('version is 4 (files reach v2, recorded v3)', r.version, 4);
check('exact text', r.text, [
  'Make the floorplan for 176 E71 4B (NYC, sale, 2 bed / 2 bath).', '',
  'Address: 176 East 71st Street, 4B',
  'Facts: {"beds":2,"baths":2}',
  'Floorplan folder: G:\\Shared drives\\GVC - New York\\Building Information\\176 E71\\PHD\\Floorplan',
  'References in Design\\:',
  '- cubicasa.png (modified ' + day(m1) + ')', '- architect.pdf (modified ' + day(m2) + ')',
  'Save as version v4.', '', 'Use the making-gvc-floorplans skill.'].join('\n'));

r = build({ ...row, kind: 'rental', core: {} }, [F('Floors/x', m1), F('Floorplans/Design/a.jpg')], []);
check('rental, no beds/baths, no date, folder name kept', r.text.split('\n').filter((l, i) => i === 0 || i >= 2 && i <= 5),
  ['Make the floorplan for 176 E71 4B (NYC, rental).', 'Floorplan folder: G:\\Shared drives\\GVC - New York\\Building Information\\176 E71\\PHD\\Floorplans', 'References in Design\\:', '- a.jpg', 'Save as version v1.']);

/* the header's facts come straight from the job: half baths; the size only outside NYC (Matt's NYC sheets show none) */
r = build({ ...row, core: { ...row.core, halfBaths: 1, sqft: 3369 } }, files, []);
check('half baths in the title and the facts; no size for NYC', [r.text.split('\n')[0], r.text.split('\n')[3]], ['Make the floorplan for 176 E71 4B (NYC, sale, 2 bed / 2 bath, 1 half bath).', 'Facts: {"beds":2,"baths":2,"half":1}']);
r = build({ ...row, market: 'NJ', core: { beds: 4, baths: '3', sqft: '2,850' } }, files, []);
check('outside NYC the size goes in too; no address line when the job has none', [r.text.includes('Address:'), r.text.split('\n')[2]], [false, 'Facts: {"beds":4,"baths":3,"sqft":2850}']);
check('no drive folder', build({ ...row, drive_folder: null }, files, []), { ok: false, reason: 'This job has no Drive folder linked yet. Link it first.' });
check('no floorplan folder', build(row, [F('Photos/Edited/1.jpg')], []), { ok: false, reason: 'There is no Floorplan folder in the job\'s Drive folder yet. Make one with a Design folder inside and drop the reference there.' });
check('no files at all', build(row, [], []).ok, false);
check('nothing in Design', build(row, [F('Floorplan/Unbranded/x v1.png', m1)], []), { ok: false, reason: 'There is nothing in Floorplan\\Design yet. Drop the reference (Cubicasa file, screenshot, architect\'s PDF or DWG) there.' });
check('paperwork name left out', build(row, [F('Floorplan/Design/Signed Contract plan.pdf', m1), F('Floorplan/Design/cubicasa.png', m1)], []).text.includes('Contract'), false);
check('only paperwork -> nothing', build(row, [F('Floorplan/Design/Offer.pdf', m1)], []).ok, false);
check('archive left out', build(row, [F('Floorplan/Design/archive/old.png', m1)], []).ok, false);
check('backslash paths', build(row, [{ path: 'Floorplan\\Design\\a.png', name: 'a.png' }], []).ok, true);

if (failures.length) { console.log(failures.join('\n')); console.log(pass + ' passed, ' + failures.length + ' FAILED'); process.exit(1); }
console.log(pass + ' passed');
