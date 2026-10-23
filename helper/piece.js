/* ============================================================
   POST /piece — "Save PDF to Drive" on a job's piece (Slice 4 spec §2.3, §5;
   Slice 5: every piece in pieces.js, owned by a listing or a pitch).

     pieceRoute({ db, render, driveRoot, driveLink, today, sleep })
       → async (body, cfg) → { ok, path, name, size, modified, url, pages, archived, folderMade }

   body: { propertyId | pitchId, tool, state | image, paper }. The helper reads
   the owner row itself (drive_folder, label, market, core) and the piece's
   record (output, outputs): nothing path-like from the browser is trusted.
   Refused before anything is drawn: no folder linked, folder gone, or a
   paperwork word or folder anywhere in the path. Then: draw the given state
   (or, for the map, take the PNG as sent), write it into the piece's folder
   (never overwriting), move the helper's own older file into Archive\
   (archive.js). path is relative to the job folder.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { isPaperworkFolder, hasPaperworkWord } = require('../assets/js/drive-rules.js');
const { PIECES } = require('./pieces.js');
const { pieceDir } = require('./pdf/piece-folder.js');
const { archivePrevious } = require('./pdf/archive.js');
const { insideJobPiece } = require('./pdf/guard.js');
const { savePdf } = require('./pdf/name.js');

const RENDER_MS = 3 * 60 * 1000;
const MAX_PNG = 20 * 1024 * 1024;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PAPERS = ['a5', 'letter', 'half'];

/* the address part of the file name: the job's own, no control characters, no paperwork
   words (a file the workspace makes must never look like deal paperwork), at most 80 characters */
function safeLabel(s) {
  // cut first, then strip: a cut can't turn "Offering" into "Offer" after the check
  return String(s || '').replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    .replace(/\b(offers?|contracts?|exclusives?|commissions?|closings?|deals?|leases?|agreements?|signed)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}
function capped(p, ms, msg) {
  let t;
  return Promise.race([p, new Promise((res, rej) => { t = setTimeout(() => rej(fail(504, msg)), ms); })]).finally(() => clearTimeout(t));
}

function fail(status, msg) { return Object.assign(new Error(msg), { status }); }
function localDay(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/* a ready-made map: a PNG data URL, checked by its first bytes */
function pngOf(image) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(typeof image === 'string' ? image : '');
  if (!m) throw fail(400, 'The map has to come as a PNG picture.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_PNG) throw fail(413, 'That map is too large.');
  if (buf.length < 9 || !buf.subarray(0, 8).equals(PNG_SIG)) throw fail(400, 'The map has to come as a PNG picture.');
  return buf;
}

function pieceRoute(o) {
  const root = path.resolve(o.driveRoot);
  const today = o.today || (() => localDay(new Date()));
  const sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const renderMs = o.renderMs || RENDER_MS;
  const db = typeof o.db === 'function' ? o.db : () => o.db;

  return async (body, cfg) => {
    body = body || {};
    const spec = typeof body.tool === 'string' && Object.prototype.hasOwnProperty.call(PIECES, body.tool) ? PIECES[body.tool] : null;
    if (!spec) throw fail(400, 'The helper can\'t make a ' + String(body.tool || 'piece') + ' yet.');
    const hasP = typeof body.propertyId === 'string' && body.propertyId, hasQ = typeof body.pitchId === 'string' && body.pitchId;
    if (!hasP === !hasQ) throw fail(400, 'The request didn\'t say which job.');
    const table = hasQ ? 'pitches' : 'properties';
    if (spec.owners.indexOf(table) === -1) throw fail(400, 'A pitch doesn\'t have a ' + spec.words + '.');
    const ready = spec.ext === 'png' ? pngOf(body.image) : null;
    if (!ready && (!body.state || typeof body.state !== 'object' || Array.isArray(body.state))) throw fail(400, 'The request had no ' + spec.words + ' to print.');
    const client = db(cfg);
    if (client.ready && !client.ready()) throw fail(503, 'The helper has no account yet, so it can\'t read the job.');

    const row = (await client.select(table, { id: hasQ ? body.pitchId : body.propertyId }, 'id,drive_folder,label,market,core'))[0];
    const noun = table === 'pitches' ? 'pitch' : 'job';
    if (!row) throw fail(404, 'No ' + noun + ' with that id.');
    if (!row.drive_folder) throw fail(409, 'This ' + noun + ' has no Drive folder linked.');
    const segs = String(row.drive_folder).split(/[\\/]+/).filter(Boolean);
    if (segs.length < 2 || segs.some(s => /^[.\s]+$/.test(s) || /[:"<>|*?]/.test(s))) throw fail(400, 'The ' + noun + '\'s Drive folder isn\'t a path the helper writes to.');
    if (segs.some(s => isPaperworkFolder(s) || hasPaperworkWord(s))) throw fail(403, 'The workspace doesn\'t write into that folder.');
    const jobAbs = path.resolve(root, ...segs);
    if (jobAbs.indexOf(root + path.sep) !== 0) throw fail(400, 'The ' + noun + '\'s Drive folder isn\'t a path the helper writes to.');
    if (!fs.existsSync(jobAbs) || !fs.statSync(jobAbs).isDirectory()) throw fail(404, 'The ' + noun + '\'s Drive folder isn\'t on this computer.');
    // the folder itself (or a folder on its way) may be a junction: it must still land under the Drive root
    if (fs.realpathSync(jobAbs).toLowerCase().indexOf(fs.realpathSync(root).toLowerCase() + path.sep) !== 0) {
      throw fail(403, 'The ' + noun + '\'s Drive folder points outside the shared drives.');
    }

    const owner = table === 'pitches' ? { pitch_id: row.id, tool: body.tool } : { property_id: row.id, tool: body.tool };
    const doc = (await client.select('documents', owner, 'output,outputs'))[0] || {};
    const paper = PAPERS.indexOf(body.paper) !== -1 ? body.paper : (body.tool === 'showsheet' ? 'a5' : null);
    let r;
    if (ready) r = { pdf: ready, pages: 1 };
    else {
      r = await capped(o.render({ tool: body.tool, state: body.state, paper, siteBase: cfg.siteBase }), renderMs,
        'The ' + spec.words + ' took too long to draw. Nothing was saved; try again.');
    }

    const { dir, made } = pieceDir(jobAbs, spec);
    // a junction or link inside the job folder must not carry the write somewhere else
    const realDir = fs.realpathSync(dir).toLowerCase(), realJob = fs.realpathSync(jobAbs).toLowerCase();
    if (realDir.indexOf(realJob + path.sep) !== 0) {
      throw fail(403, 'The job\'s ' + spec.words + ' folder points outside the job folder.');
    }
    const rel = abs => path.relative(jobAbs, abs).split(path.sep).join('/');
    if (rel(dir).split('/').some(s => isPaperworkFolder(s) || hasPaperworkWord(s))) throw fail(403, 'The workspace doesn\'t write into that folder.');
    const core = row.core || {};
    const label = safeLabel([core.address, core.unit].filter(Boolean).join(' ')) || safeLabel(row.label) || safeLabel(r.label) || 'Job';
    if (hasPaperworkWord(label)) throw fail(403, 'The workspace doesn\'t write a file with that name.');
    const file = await savePdf(r.pdf, dir, spec.prefix, label, today(), spec.ext);
    if (!insideJobPiece(file, jobAbs, dir)) throw fail(500, 'The helper wrote somewhere it shouldn\'t have: ' + file);

    // the file is on Drive now: nothing after this may turn the answer into an error
    let archived;
    try { archived = archivePrevious({ jobAbs, dir, prev: doc.output, outputs: doc.outputs, words: spec.words, ext: spec.ext }); }
    catch (e) { archived = { left: doc.output && doc.output.path, why: 'older ' + spec.words + ' left in place: it couldn\'t be moved (' + (e.code || e.message) + ')' }; }
    const st = fs.statSync(file);
    let url = null;
    for (let i = 0; i < 10 && !url; i++) {
      try { url = o.driveLink(file, false); } catch (e) { url = null; }
      if (!url && i < 9) await sleep(1000);
    }
    return { ok: true, path: rel(file), name: path.basename(file), size: st.size, modified: st.mtime.toISOString(),
      url, pages: r.pages, archived, folderMade: made };
  };
}

module.exports = { pieceRoute, safeLabel, pngOf };
