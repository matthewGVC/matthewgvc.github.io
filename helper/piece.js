/* ============================================================
   POST /piece — "Save PDF to Drive" on a job's Showsheet (spec §2.3, §5).

     pieceRoute({ db, render, driveRoot, driveLink, today, sleep })
       → async (body, cfg) → { ok, path, name, size, modified, url, pages, archived, folderMade }

   body: { propertyId, tool: 'showsheet', state, paper }. The helper reads the
   job row itself (drive_folder, label, market, core) and the piece's record
   (output, outputs): nothing path-like from the browser is trusted. Refused
   before anything is drawn: no folder linked, folder gone, or a paperwork
   word or folder anywhere in the path. Then: draw the given state, write the
   PDF into the showsheet folder (never overwriting), move the helper's own
   older PDF into Archive\ (archive.js). path is relative to the job folder.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { isPaperworkFolder, hasPaperworkWord } = require('../assets/js/drive-rules.js');
const { showsheetDir } = require('./pdf/piece-folder.js');
const { archivePrevious } = require('./pdf/archive.js');
const { insideJobPiece } = require('./pdf/guard.js');
const { savePdf } = require('./pdf/name.js');

const PIECE = { showsheet: 'Showsheet' };
const RENDER_MS = 3 * 60 * 1000;

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

function pieceRoute(o) {
  const root = path.resolve(o.driveRoot);
  const today = o.today || (() => localDay(new Date()));
  const sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const renderMs = o.renderMs || RENDER_MS;
  const db = typeof o.db === 'function' ? o.db : () => o.db;

  return async (body, cfg) => {
    body = body || {};
    if (!PIECE[body.tool]) throw fail(400, 'The helper can\'t make a ' + String(body.tool || 'piece') + ' yet.');
    if (!body.propertyId || typeof body.propertyId !== 'string') throw fail(400, 'The request didn\'t say which job.');
    if (!body.state || typeof body.state !== 'object') throw fail(400, 'The request had no sheet to print.');
    const client = db(cfg);
    if (client.ready && !client.ready()) throw fail(503, 'The helper has no account yet, so it can\'t read the job.');

    const row = (await client.select('properties', { id: body.propertyId }, 'id,drive_folder,label,market,core'))[0];
    if (!row) throw fail(404, 'No job with that id.');
    if (!row.drive_folder) throw fail(409, 'This job has no Drive folder linked.');
    const segs = String(row.drive_folder).split(/[\\/]+/).filter(Boolean);
    if (segs.length < 2 || segs.some(s => /^[.\s]+$/.test(s) || /[:"<>|*?]/.test(s))) throw fail(400, 'The job\'s Drive folder isn\'t a path the helper writes to.');
    if (segs.some(s => isPaperworkFolder(s) || hasPaperworkWord(s))) throw fail(403, 'The workspace doesn\'t write into that folder.');
    const jobAbs = path.resolve(root, ...segs);
    if (jobAbs.indexOf(root + path.sep) !== 0) throw fail(400, 'The job\'s Drive folder isn\'t a path the helper writes to.');
    if (!fs.existsSync(jobAbs) || !fs.statSync(jobAbs).isDirectory()) throw fail(404, 'The job\'s Drive folder isn\'t on this computer.');

    const doc = (await client.select('documents', { property_id: row.id, tool: body.tool }, 'output,outputs'))[0] || {};
    const paper = body.paper === 'letter' ? 'letter' : 'a5';
    const r = await capped(o.render({ tool: body.tool, state: body.state, paper, siteBase: cfg.siteBase }), renderMs,
      'The sheet took too long to draw. Nothing was saved; try again.');

    const { dir, made } = showsheetDir(jobAbs);
    // a junction or link inside the job folder must not carry the write somewhere else
    if (fs.realpathSync(dir).toLowerCase().indexOf(fs.realpathSync(jobAbs).toLowerCase() + path.sep) !== 0) {
      throw fail(403, 'The job\'s showsheet folder points outside the job folder.');
    }
    const rel = abs => path.relative(jobAbs, abs).split(path.sep).join('/');
    if (rel(dir).split('/').some(s => isPaperworkFolder(s) || hasPaperworkWord(s))) throw fail(403, 'The workspace doesn\'t write into that folder.');
    const core = row.core || {};
    const label = safeLabel([core.address, core.unit].filter(Boolean).join(' ')) || safeLabel(row.label) || safeLabel(r.label) || 'Job';
    if (hasPaperworkWord(label)) throw fail(403, 'The workspace doesn\'t write a file with that name.');
    const file = await savePdf(r.pdf, dir, PIECE[body.tool], label, today());
    if (!insideJobPiece(file, jobAbs, dir)) throw fail(500, 'The helper wrote somewhere it shouldn\'t have: ' + file);

    // the PDF is on Drive now: nothing after this may turn the answer into an error
    let archived;
    try { archived = archivePrevious({ jobAbs, dir, prev: doc.output, outputs: doc.outputs }); }
    catch (e) { archived = { left: doc.output && doc.output.path, why: 'older showsheet left in place: it couldn\'t be moved (' + (e.code || e.message) + ')' }; }
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

module.exports = { pieceRoute, safeLabel };
