/* ============================================================
   ARCHIVE MOVE — the only move the workspace ever makes (spec S18).

     archivePrevious({ jobAbs, dir, prev, outputs, words?, ext? })
       → null                 nothing to move (no earlier file, or it was printed by hand)
       | { from, to }         moved into <dir>\Archive\ (paths relative to the job folder, '/')
       | { left, why }        left where it is, and why

   Moves the previous output only when the helper made it, it still sits in
   this piece's folder, it is listed in the piece's outputs, and its size
   and date are still what the workspace recorded. A name already in
   Archive\ gets ' (2)'. Nothing is overwritten or deleted.
   Slice 5: the sentences name the piece (words, default 'showsheet'); ext is
   the file type it moves ('pdf', or 'png' for the map).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { insideJobPiece } = require('./guard.js');

function sentences(words) {
  const w = 'older ' + (words || 'showsheet') + ' left in place: ';
  return { CHANGED: w + 'it changed after the workspace made it', GONE: w + 'it isn\'t where the workspace left it',
    UNKNOWN: w + 'the workspace has no record of making it', LINKED: w + 'its Archive folder points outside the job folder' };
}
const { CHANGED, GONE, UNKNOWN, LINKED } = sentences('showsheet');

function relOf(jobAbs, abs) { return path.relative(jobAbs, abs).split(path.sep).join('/'); }
function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase(); }
function ms(v) { return typeof v === 'number' ? v : Date.parse(v); }

function freeName(folder, name) {
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : stem + ' (' + n + ')' + ext;
    if (!fs.existsSync(path.join(folder, candidate))) return candidate;
  }
}

function archivePrevious(o) {
  const prev = o.prev;
  if (!prev || prev.via !== 'helper' || !prev.path) return null;
  const said = sentences(o.words);
  const ext = o.ext === 'png' ? /\.png$/i : /\.pdf$/i;
  const segs = String(prev.path).split(/[\\/]+/).filter(Boolean);
  if (!segs.length || segs.some(s => /^[.\s]+$/.test(s) || /[:"<>|*?\x00-\x1f]/.test(s)) || !ext.test(segs[segs.length - 1])) {
    return { left: prev.path, why: said.GONE };
  }
  const abs = path.resolve(o.jobAbs, ...segs);
  if (!insideJobPiece(abs, o.jobAbs, o.dir) || !same(path.dirname(abs), o.dir)) return { left: prev.path, why: said.GONE };
  if (!(o.outputs || []).some(x => x && same(String(x.path || '').split(/[\\/]+/).join('/'), segs.join('/')))) return { left: prev.path, why: said.UNKNOWN };
  let st;
  try { st = fs.statSync(abs); } catch (e) { return { left: prev.path, why: said.GONE }; }
  if (!st.isFile()) return { left: prev.path, why: said.GONE };
  if (st.size !== prev.size || !(Math.abs(st.mtimeMs - ms(prev.modified)) <= 2000)) return { left: prev.path, why: said.CHANGED };
  const archive = path.join(o.dir, 'Archive');
  // an Archive junction or link must not carry the move outside the piece's folder
  const linked = () => fs.realpathSync(archive).toLowerCase().indexOf(fs.realpathSync(o.dir).toLowerCase() + path.sep) !== 0;
  if (fs.existsSync(archive) && linked()) return { left: prev.path, why: said.LINKED };
  fs.mkdirSync(archive, { recursive: true });
  if (linked()) return { left: prev.path, why: said.LINKED };
  const target = path.join(archive, freeName(archive, path.basename(abs)));
  if (!insideJobPiece(target, o.jobAbs, o.dir)) return { left: prev.path, why: said.GONE };
  fs.renameSync(abs, target);
  return { from: relOf(o.jobAbs, abs), to: relOf(o.jobAbs, target) };
}

module.exports = { archivePrevious, sentences, CHANGED, GONE, UNKNOWN, LINKED };
