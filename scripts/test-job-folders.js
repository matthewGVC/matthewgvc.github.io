/* the folder standard and the job-folder maker */
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
check('types', R.TYPES, ['resale', 'rental', 'sfh', 'newdev']);
check('rental is resale', names('rental'), names('resale'));
check('core', names('resale'), ['Floorplan', 'Photos', 'Marketing', 'Docs']);
check('sfh adds the build folders', names('sfh').slice(4), ['Architecturals & Site Plan', 'Finishes', 'Final Renders', '3D File Assets and Archive - For Matt and Ilin']);
check('newdev adds Branding last', names('newdev').slice(-1), ['Branding']);
check('unknown type', R.layout('condo'), null);
check('every standard top folder the workspace reads is readable', ['Floorplan', 'Photos', 'Marketing'].every(n => R.allowedInJob(n)), true);
check('Docs is never read', R.allowedInJob('Docs'), false);
check('old name is reported as a rename', R.missingFolders('resale', ['Floorplans', 'Floorplans/Design']).renames, [{ from: 'Floorplans', to: 'Floorplan' }]);
check('a complete resale folder has nothing missing', R.missingFolders('resale', R.layout('resale').flatMap(f => [f.name].concat(f.children.map(c => f.name + '/' + c)))).missing, []);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobfolders-'));
fs.mkdirSync(path.join(tmp, 'Floorplans', 'Design'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'Floorplans', 'Design', 'ref.pdf'), 'x');
fs.mkdirSync(path.join(tmp, 'Finishes'));
const dry = J.run('sfh', tmp, false);
check('dry run creates nothing', fs.existsSync(path.join(tmp, 'Photos')), false);
check('old Floorplans is not duplicated as Floorplan', dry.made.some(p => p.startsWith('Floorplan')), false);
J.run('sfh', tmp, true);
check('apply makes Photos/Edited', fs.existsSync(path.join(tmp, 'Photos', 'Edited')), true);
check('apply leaves the existing file', fs.readFileSync(path.join(tmp, 'Floorplans', 'Design', 'ref.pdf'), 'utf8'), 'x');
check('second run makes nothing', J.run('sfh', tmp, true).made, []);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
