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

function fail(status, msg) { return Object.assign(new Error(msg), { status }); }
function localDay(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function pieceRoute(o) {
  const root = path.resolve(o.driveRoot);
  const today = o.today || (() => localDay(new Date()));
  const sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms)));
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
    const r = await o.render({ tool: body.tool, state: body.state, paper, siteBase: cfg.siteBase });

    const { dir, made } = showsheetDir(jobAbs);
    const rel = abs => path.relative(jobAbs, abs).split(path.sep).join('/');
    if (rel(dir).split('/').some(s => isPaperworkFolder(s) || hasPaperworkWord(s))) throw fail(403, 'The workspace doesn\'t write into that folder.');
    const core = row.core || {};
    const label = r.label || [core.address, core.unit].filter(Boolean).join(' ') || row.label;
    const file = await savePdf(r.pdf, dir, PIECE[body.tool], label, today());
    if (!insideJobPiece(file, jobAbs, dir)) throw fail(500, 'The helper wrote somewhere it shouldn\'t have: ' + file);

    const archived = archivePrevious({ jobAbs, dir, prev: doc.output, outputs: doc.outputs });
    const st = fs.statSync(file);
    let url = null;
    for (let i = 0; i < 10 && !url; i++) {
      url = o.driveLink(file, false);
      if (!url && i < 9) await sleep(1000);
    }
    return { ok: true, path: rel(file), name: path.basename(file), size: st.size, modified: st.mtime.toISOString(),
      url, pages: r.pages, archived, folderMade: made };
  };
}

module.exports = { pieceRoute };
