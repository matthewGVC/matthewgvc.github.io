/* the folder standard (flat and numbered, decisions 19-23, 26, 75) and the job-folder maker */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const R = require('../assets/js/drive-rules.js');
const J = require('./job-folders.js');
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : (fail++, console.log('FAIL ' + name + '\n  expected ' + JSON.stringify(want) + '\n  got      ' + JSON.stringify(got)));
}
const names = t => R.layout(t).map(x => x.name);
const LISTING = ['Photos', 'Floorplan', 'Video', 'Showsheet', 'Brochure', 'Open House', 'Postcard', 'Signage', 'Pitch', 'Docs'];
check('types', R.TYPES, ['resale', 'rental', 'sfh', 'newdev']);
check('rental is resale', names('rental'), names('resale'));
check('the flat listing layout', names('resale'), LISTING);
check('Photos holds the numbered sets, Print and Web', R.layout('resale')[0].children, ['1 Raw', '2 Edits', '3 PS', '4 Virtual Staged', '5 Finals', '6 Selects', 'Print', 'Web']);
check('Floorplan holds its three', R.layout('resale')[1].children, ['Design', 'Unbranded', 'Branded']);
check('sfh adds the build folders', names('sfh').slice(LISTING.length), ['Architecturals & Site Plan', 'Finishes', 'Final Renders', '3D File Assets and Archive - For Matt and Ilin']);
check('newdev is the FL template', names('newdev'), ['0 - Approved Assets', '1 - Branding', '2 - Marketing - Working Files', '3 - Assets from Developer',
  '4 - MLS & Listing Info', '5 - Reporting, Pricing & Comps', '6 - Documents', '7 - Construction Schedule']);
check('unknown type', R.layout('condo'), null);
check('every standard top folder the workspace reads is readable', LISTING.filter(n => n !== 'Docs').every(n => R.allowedInJob(n)), true);
check('Docs is never read', R.allowedInJob('Docs'), false);
check('old name is reported as a rename', R.missingFolders('resale', ['Floorplans', 'Floorplans/Design']).renames, [{ from: 'Floorplans', to: 'Floorplan' }]);
check('never flag a missing empty folder (23)', R.missingFolders('resale', []), { missing: [], renames: [] });
check('missingFolders renames both old names', R.missingFolders('resale', ['Photos/Edited', 'Floorplans']).renames,
  [{ from: 'Photos/Edited', to: 'Photos/2 Edits' }, { from: 'Floorplans', to: 'Floorplan' }]);
check('missingFolders: unknown type', R.missingFolders('condo', []), null);

/* every row of the old -> new table, as written and in capitals */
const TABLE = [
  ['floorplans', 'Floorplan'], ['floor plan', 'Floorplan'], ['floor plans', 'Floorplan'],
  ['photo', 'Photos'], ['pictures', 'Photos'],
  ['showsheets', 'Showsheet'], ['show sheet', 'Showsheet'], ['show sheets', 'Showsheet'],
  ['brochures', 'Brochure'], ['postcards', 'Postcard'], ['signs', 'Signage'],
  ['film', 'Video'], ['videos', 'Video'], ['open houses', 'Open House'], ['pitches', 'Pitch'],
  ['Photos/raw', 'Photos/1 Raw'], ['Photos/raws', 'Photos/1 Raw'],
  ['Photos/edited', 'Photos/2 Edits'], ['Photos/edits', 'Photos/2 Edits'], ['Photos/edited photos', 'Photos/2 Edits'],
  ['Photos/matt edits', 'Photos/2 Edits'], ['Photos/matt-edits', 'Photos/2 Edits'],
  ['Photos/ps', 'Photos/3 PS'],
  ['Photos/staged', 'Photos/4 Virtual Staged'], ['Photos/virtual staged', 'Photos/4 Virtual Staged'], ['Photos/virtually staged', 'Photos/4 Virtual Staged'],
  ['Photos/final', 'Photos/5 Finals'], ['Photos/finals', 'Photos/5 Finals'], ['Photos/final photos', 'Photos/5 Finals'],
  ['Photos/selects', 'Photos/6 Selects'],
  ['Floorplan/design', 'Floorplan/Design'], ['Floorplan/unbranded', 'Floorplan/Unbranded'], ['Floorplan/branded', 'Floorplan/Branded'],
  ['Marketing/show sheets', 'Showsheet'], ['Marketing/pictures', 'Photos'], ['Marketing/video', 'Video']
];
TABLE.forEach(([from, to]) => {
  check('table: ' + from, R.standardName(from), to);
  const caps = from.split('/').map((s, i, a) => i === a.length - 1 ? s.toUpperCase() : s).join('/');
  check('table: ' + caps, R.standardName(caps), to);
});
check('every parent standardised too', [R.standardName('Floorplans/Unbranded'), R.standardName('Pictures/Edited'), R.standardName('Photos/Edited')],
  ['Floorplan/Unbranded', 'Photos/2 Edits', 'Photos/2 Edits']);
check('a deeper folder follows its parents', R.standardName('Pictures/Edited/Kitchen'), 'Photos/2 Edits/Kitchen');
check('Marketing moves up', [R.standardName('Marketing/Show Sheets'), R.standardName('Marketing/Showsheet'), R.standardName('Marketing/Floorplans/Design')],
  ['Showsheet', 'Showsheet', 'Floorplan/Design']);
check('not in the table, or paperwork: stays', ['Marketing/Docs', 'Marketing/Social', 'Marketing', 'Docs', 'Offers 2024', 'Marketing/Offers'].map(R.standardName), [null, null, null, null, null, null]);
check('a standard name is null', ['Photos', 'Floorplan', 'Showsheet', 'Pitch', 'Photos/2 Edits', 'Photos/1 Raw', 'Photos/Print', 'Floorplan/Unbranded', 'Video', 'Open House'].map(R.standardName),
  Array(10).fill(null));
check('other photo folders keep their names', ['Photos/HiRes', 'Photos/ALL PHOTOS', 'Photos/Exteriors-LowRes', 'HiRes', 'ALL PHOTOS', 'Exteriors-LowRes'].map(R.standardName), Array(6).fill(null));
check('a deal folder is skipped', [R.standardName('2026 Sale/Photos/Edited'), R.standardName('2026 Sale'), R.standardName('2025 - Rental/Floorplans')],
  ['2026 Sale/Photos/2 Edits', null, '2025 - Rental/Floorplan']);
check('backslashes', R.standardName('Pictures\\Edited'), 'Photos/2 Edits');
check('nothing given', [R.standardName(''), R.standardName(null), R.standardName('Photos/../Docs')], [null, null, null]);

check('ownChange: own segment changes', ['Floorplans', 'Photos/Edited', 'Marketing/Showsheet', 'Marketing/Show Sheets'].map(R.ownChange), [true, true, true, true]);
check('ownChange: only a parent changes, or nothing', ['Floorplans/Design', 'Pictures/Kitchen', 'Marketing/Showsheet/Archive', 'Photos', 'Marketing/Docs', '2026 Sale'].map(R.ownChange),
  [false, false, false, false, false, false]);

const PS = [['Raw', 'raw'], ['raws', 'raw'], ['1 Raw', 'raw'], ['Edited', 'edits'], ['Edits', 'edits'], ['Edited Photos', 'edits'], ['Matt Edits', 'edits'], ['Matt-Edits', 'edits'], ['2 Edits', 'edits'],
  ['PS', 'ps'], ['3 PS', 'ps'], ['Staged', 'staged'], ['Virtual Staged', 'staged'], ['Virtually Staged', 'staged'], ['4 Virtual Staged', 'staged'],
  ['Final', 'finals'], ['Finals', 'finals'], ['Final Photos', 'finals'], ['5 Finals', 'finals'], ['Selects', 'selects'], ['6 Selects', 'selects'],
  ['Print', 'print'], ['Web', 'web'], [' edited ', 'edits'], ['HiRes', null], ['ALL PHOTOS', null], ['', null]];
check('photoSet', PS.map(x => R.photoSet(x[0])), PS.map(x => x[1]));
check('usablePhotos: finals over edits, empty selects left out', R.usablePhotos({ finals: 3, edits: 9, selects: 0 }), { list: ['finals'], first: 'finals' });
check('usablePhotos: selects first, edits when no finals', R.usablePhotos({ finals: 0, edits: 9, selects: 4 }), { list: ['selects', 'edits'], first: 'selects' });
check('usablePhotos: nothing', R.usablePhotos({}), { list: [], first: null });
check('usablePhotos: raw never counts', R.usablePhotos({ raw: 40, ps: 2, staged: 3 }), { list: [], first: null });
check('STARTER', R.STARTER, ['Photos', 'Photos/1 Raw', 'Floorplan']);
check('DEAL_FOLDER', ['2026 Sale', '2016 Purchase', '2026 - Sale', '2025 - Rental', '2024 – Sales', '2026 Plans', 'Sale', '2026'].map(n => R.DEAL_FOLDER.test(n)),
  [true, true, true, true, true, false, false, false]);

const tree = d => fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory())
  .flatMap(e => [e.name].concat(tree(path.join(d, e.name)).map(c => e.name + '\\' + c)));
const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfolders-'));
J.run('resale', fresh, true);
check('apply on an empty folder makes only the starter', tree(fresh).sort(), ['Floorplan', 'Photos', 'Photos\\1 Raw']);
fs.rmSync(fresh, { recursive: true, force: true });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfolders-'));
fs.mkdirSync(path.join(tmp, 'Floorplans', 'Design'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'Floorplans', 'Design', 'ref.pdf'), 'x');
fs.mkdirSync(path.join(tmp, 'Finishes'));
const dry = J.run('sfh', tmp, false);
check('dry run creates nothing', fs.existsSync(path.join(tmp, 'Photos')), false);
check('old Floorplans is not duplicated as Floorplan', dry.made.some(p => p.startsWith('Floorplan')), false);
check('dry run reports the rename', dry.renames, [{ from: 'Floorplans', to: 'Floorplan' }]);
J.run('sfh', tmp, true);
check('apply makes Photos/1 Raw and nothing else new', tree(tmp).sort(), ['Finishes', 'Floorplans', 'Floorplans\\Design', 'Photos', 'Photos\\1 Raw']);
check('apply leaves the existing file', fs.readFileSync(path.join(tmp, 'Floorplans', 'Design', 'ref.pdf'), 'utf8'), 'x');
check('second run makes nothing', J.run('sfh', tmp, true).made, []);
fs.rmSync(tmp, { recursive: true, force: true });

const old = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfolders-'));
fs.mkdirSync(path.join(old, 'Pictures', 'Raw'), { recursive: true });
check('Photos and its Raw under old names: only Floorplan made', J.run('resale', old, true).made, ['Floorplan']);
fs.rmSync(path.join(old, 'Pictures', 'Raw'), { recursive: true });
check('Photos under an old name: 1 Raw goes inside it', [J.run('resale', old, true).made, fs.existsSync(path.join(old, 'Pictures', '1 Raw')), fs.existsSync(path.join(old, 'Photos'))],
  [['Pictures/1 Raw'], true, false]);
fs.rmSync(old, { recursive: true, force: true });
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
