/* ============================================================
   PDF NAMES — how a finished piece is named in its folder (plan §9).

     outputName('Showsheet', '1050 Park Ave 13C', '2026-10-19', existingNames)
       → 'Showsheet - 1050 Park Ave 13C - 2026-10-19.pdf', then ' (2)', ' (3)'…
     await savePdf(buffer, dir, piece, label, date) → full path written

   Nothing is ever overwritten: the file is created with the "fail if it
   exists" flag, and a clash (two saves in the same second) moves on to the
   next number.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

function clean(s) {
  return String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').replace(/-+$/, '').trim();
}

function outputName(piece, label, date, existing) {
  const base = clean(piece) + ' - ' + clean(label) + ' - ' + date;
  const taken = new Set((existing || []).map(n => n.toLowerCase()));
  for (let n = 1; ; n++) {
    const name = base + (n === 1 ? '' : ' (' + n + ')') + '.pdf';
    if (!taken.has(name.toLowerCase())) return name;
  }
}

async function savePdf(buf, dir, piece, label, date) {
  fs.mkdirSync(dir, { recursive: true });
  for (let tries = 0; tries < 50; tries++) {
    const name = outputName(piece, label, date, fs.readdirSync(dir));
    const file = path.join(dir, name);
    try {
      fs.writeFileSync(file, buf, { flag: 'wx' });
      return file;
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      // a half-written file must not sit in the folder looking like the real one
      try { fs.unlinkSync(file); } catch (ignore) { /* never created */ }
      throw e;
    }
  }
  throw new Error('Couldn\'t find a free file name in ' + dir + '.');
}

module.exports = { outputName, savePdf, clean };
