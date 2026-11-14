/* The job-folder maker. Checks a job folder against the folder standard (assets/js/drive-rules.js: flat
   and numbered, each folder made only when first needed) and, with --apply, gives it the starter folders.

     node scripts/job-folders.js <resale|rental|sfh|newdev> "<job folder>" [--apply]

   It only ever creates folders, and only the starter (Photos, Photos\1 Raw, Floorplan): every other
   folder is made by whoever first needs it. A starter folder that already exists under an older name
   ("Floorplans", "Pictures\Raw") is not made again, and a new one goes inside its parent as it stands
   ("Pictures\1 Raw"). It never moves, renames or deletes anything: old names are reported, for the
   folder run or a person to rename. Without --apply it just prints. */
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
  const have = existing(root);
  const gap = R.missingFolders(type, have);
  // each folder there now, by its standard path (lower case) → its path as it stands
  const at = {};
  for (const p of have) {
    const k = (R.standardName(p) || p).toLowerCase();
    if (!(k in at)) at[k] = p;
  }
  const made = [];
  for (const p of R.STARTER) {
    if (p.toLowerCase() in at) continue;                      // there, under this name or an older one
    const segs = p.split('/'), parent = segs.slice(0, -1).join('/').toLowerCase();
    const real = parent && at[parent] ? at[parent] + '/' + segs[segs.length - 1] : p;
    made.push(real);
    at[p.toLowerCase()] = real;
    if (apply) fs.mkdirSync(path.join(root, ...real.split('/')), { recursive: true });
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
    if (flag !== '--apply' && r.made.length) console.log('\nRun again with --apply to create the starter folders.');
  } catch (e) { console.error(e.message); process.exit(1); }
}
