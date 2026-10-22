/* ============================================================
   PIECE FOLDER — where a job's showsheet goes (spec S17).

     showsheetDir(jobAbs) → { dir, made }

   A folder named Showsheet, Showsheets or Show Sheet (any case) inside the
   job's Marketing\ first, then at the job folder's top. None → the helper
   makes Marketing\Showsheet\ (made: true). Nothing is renamed or moved.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

const SHOWSHEET = /^(showsheets?|show sheets?)$/i;

function childDir(parent, rx) {
  let list;
  try { list = fs.readdirSync(parent, { withFileTypes: true }); } catch (e) { return null; }
  const hit = list.filter(d => d.isDirectory() && rx.test(d.name.trim())).map(d => d.name).sort()[0];
  return hit ? path.join(parent, hit) : null;
}

function showsheetDir(jobAbs) {
  const marketing = childDir(jobAbs, /^marketing$/i);
  const found = (marketing && childDir(marketing, SHOWSHEET)) || childDir(jobAbs, SHOWSHEET);
  if (found) return { dir: found, made: false };
  const dir = path.join(marketing || path.join(jobAbs, 'Marketing'), 'Showsheet');
  fs.mkdirSync(dir, { recursive: true });
  return { dir, made: true };
}

module.exports = { showsheetDir, SHOWSHEET };
