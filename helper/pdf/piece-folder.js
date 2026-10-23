/* ============================================================
   PIECE FOLDER — where a job's showsheet goes (spec S17).

     showsheetDir(jobAbs) → { dir, made }
     pieceDir(jobAbs, spec) → { dir, made }     (Slice 5, any piece in pieces.js)

   A folder named Showsheet, Showsheets or Show Sheet (any case) inside the
   job's Marketing\ first, then at the job folder's top. None → the helper
   makes Marketing\Showsheet\ (made: true). Nothing is renamed or moved.
   Other pieces the same way with their own folder names; a pitch's folder
   is treated like a job's (its seller pitch and map go in Marketing\Pitch\).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

const SHOWSHEET = /^(showsheets?|show sheets?)$/i;

function childDir(parent, rx) {
  let list;
  try { list = fs.readdirSync(parent, { withFileTypes: true }); } catch (e) { return null; }
  // a junction or link counts too, so the caller's real-path check sees it rather than mkdir going through it
  const isDir = d => d.isDirectory() || (d.isSymbolicLink() && (() => { try { return fs.statSync(path.join(parent, d.name)).isDirectory(); } catch (e) { return false; } })());
  const hit = list.filter(d => isDir(d) && rx.test(d.name.trim())).map(d => d.name).sort()[0];
  return hit ? path.join(parent, hit) : null;
}

function pieceDir(jobAbs, spec) {
  const marketing = childDir(jobAbs, /^marketing$/i);
  // a Marketing junction or link must not carry a new folder outside the job
  const real = p => fs.realpathSync(p).toLowerCase();
  if (marketing && real(marketing).indexOf(real(jobAbs) + path.sep) !== 0) {
    throw Object.assign(new Error('The job\'s ' + spec.words + ' folder points outside the job folder.'), { status: 403 });
  }
  const found = (marketing && childDir(marketing, spec.folder)) || childDir(jobAbs, spec.folder);
  if (found) return { dir: found, made: false };
  const dir = path.join(marketing || path.join(jobAbs, 'Marketing'), spec.make);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, made: true };
}

function showsheetDir(jobAbs) { return pieceDir(jobAbs, { words: 'showsheet', folder: SHOWSHEET, make: 'Showsheet' }); }

module.exports = { showsheetDir, pieceDir, SHOWSHEET };
