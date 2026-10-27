/* The job-folder maker. Checks a job folder against the folder standard (docs/folder-standard.md,
   assets/js/drive-rules.js) and, with --apply, creates the folders it lacks.

     node scripts/job-folders.js <resale|rental|sfh|newdev> "<job folder>" [--apply]

   It only ever creates folders. It never moves, renames or deletes anything: an old name such as
   "Floorplans" is reported, and left for a person to rename. Without --apply it just prints. */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('../assets/js/drive-rules.js');

function existing(root) {
  const out = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      out.push(r);
      if (rel.split('/').length < 2) walk(path.join(dir, e.name), r);   // the standard goes two deep
    }
  })(root, '');
  return out;
}

function run(type, root, apply) {
  if (!R.TYPES.includes(type)) throw new Error('Type must be one of ' + R.TYPES.join(', ') + '.');
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error('No such folder: ' + root);
  const gap = R.missingFolders(type, existing(root));
  const made = [];
  for (const p of gap.missing) {
    const full = path.join(root, ...p.split('/'));
    // a top folder that exists under an older name is renamed by a person, not duplicated here
    if (gap.renames.some(r => r.to === p.split('/')[0] && fs.existsSync(path.join(root, r.from)))) continue;
    made.push(p);
    if (apply) fs.mkdirSync(full, { recursive: true });
  }
  return { made, renames: gap.renames };
}

module.exports = { run };

if (require.main === module) {
  const [type, root, flag] = process.argv.slice(2);
  if (!type || !root) { console.error('Usage: node scripts/job-folders.js <resale|rental|sfh|newdev> "<job folder>" [--apply]'); process.exit(2); }
  try {
    const r = run(type, root, flag === '--apply');
    r.renames.forEach(x => console.log('RENAME by hand: "' + x.from + '" should be "' + x.to + '"'));
    r.made.forEach(p => console.log((flag === '--apply' ? 'made    ' : 'missing ') + p));
    if (!r.made.length && !r.renames.length) console.log('Nothing to do: the folder already follows the ' + type + ' standard.');
    if (flag !== '--apply' && r.made.length) console.log('\nRun again with --apply to create the missing folders.');
  } catch (e) { console.error(e.message); process.exit(1); }
}
