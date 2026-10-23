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

function outputName(piece, label, date, existing, ext) {
  const base = clean(piece) + ' - ' + clean(label) + ' - ' + date;
  const taken = new Set((existing || []).map(n => n.toLowerCase()));
  const dot = '.' + (ext === 'png' ? 'png' : 'pdf');
  for (let n = 1; ; n++) {
    const name = base + (n === 1 ? '' : ' (' + n + ')') + dot;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

async function savePdf(buf, dir, piece, label, date, ext) {
  fs.mkdirSync(dir, { recursive: true });
  for (let tries = 0; tries < 50; tries++) {
    const name = outputName(piece, label, date, fs.readdirSync(dir), ext);
    const file = path.join(dir, name);
    let fd;
    try { fd = fs.openSync(file, 'wx'); } catch (e) {
      if (e.code === 'EEXIST') continue;
      throw e;
    }
    try {
      fs.writeFileSync(fd, buf);
      fs.closeSync(fd);
      return file;
    } catch (e) {
      // a half-written file this call created must not sit in the folder looking like the real one
      try { fs.closeSync(fd); } catch (ignore) { /* already closed */ }
      try { fs.unlinkSync(file); } catch (ignore) { /* gone already */ }
      throw e;
    }
  }
  throw new Error('Couldn\'t find a free file name in ' + dir + '.');
}

module.exports = { outputName, savePdf, clean };
