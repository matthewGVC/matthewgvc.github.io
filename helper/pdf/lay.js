/* ============================================================
   LAY A PIECE FROM A JOB — the helper's hidden browser opens the piece's own
   page as if Matt had opened it from the job page, and asks it what it would
   print (0017; docs/piece-helper-design.md).

     const r = await layPiece({ tool, kind: 'listing' | 'pitch', row, docs, tree, jobAbs, siteBase })
       → { why }                                    the page says it can't be made, in a sentence
       | { state, storable, builtFrom, paper }      what prints, what is kept, what it was built from

   The page runs its ordinary job mode (assets/js/piece-mode.js) with
   window.__helperBuild in place of the sign-in and the browser's Drive: the
   job's row and records come from the helper's own read, the folder's tree
   from scan.js, and each photo or plan from readJobFile below, which only
   ever opens an image under the job's Floorplan\, Photos\ or Marketing\
   (drive-rules.js), never paperwork, never outside the job folder. The page
   may reach nothing else beyond its own site (render.js guardRequests).
   ============================================================ */
'use strict';

require('../config.js');   // points Playwright at the helper's own browser

const fs = require('fs'), path = require('path');
const RULES = require('../../assets/js/drive-rules.js');
const { PIECES } = require('../pieces.js');
const { guardRequests } = require('./render.js');

const LAY_MS = 90 * 1000;
const MAX_FILE = 60 * 1024 * 1024;
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
const FILE_PATH = '/__gvc_helper_file';

function fail(status, msg) { return Object.assign(new Error(msg), { status }); }

/* one picture inside the job folder, by its path relative to it ('Photos/Edited/01.jpg'):
   → { buf, type, name, modified }, or throws a plain sentence */
function readJobFile(jobAbs, rel) {
  const inside = String(rel || '').split(/[\\/]+/).filter(Boolean);
  const name = inside[inside.length - 1] || '';
  const ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1];
  if (!inside.length || inside.some(s => /^[.\s]+$/.test(s) || /[:"<>|*?\x00-\x1f]/.test(s))) throw fail(400, 'That isn\'t a path the helper reads.');
  // only a piece's pictures: Floorplan, Photos or Marketing (after an optional "2026 - Sales" wrapper)
  const top = (inside.length > 1 && /^(19|20)\d{2}\s*[-–]\s*sales?$/i.test(inside[0]) ? inside[1] : inside[0]) || '';
  const pictureFolder = /^(floorplans?|photos|marketing)$/i.test(top);
  if (!pictureFolder || !RULES.allowedInJob(inside.join('/')) || inside.some(s => RULES.isPaperwork(s)) || RULES.isJunk(name)) throw fail(403, 'The workspace doesn\'t read that file.');
  if (!ext || !TYPES[ext.toLowerCase()]) throw fail(403, 'The helper only reads pictures for a piece.');
  const abs = path.resolve(jobAbs, ...inside);
  if (abs.indexOf(jobAbs + path.sep) !== 0) throw fail(400, 'That isn\'t a path the helper reads.');
  let st;
  try { st = fs.statSync(abs); } catch (e) { throw fail(404, 'Drive hasn\'t got ' + name + ' on this computer.'); }
  if (!st.isFile()) throw fail(404, 'Drive hasn\'t got ' + name + ' on this computer.');
  if (fs.realpathSync(abs).toLowerCase().indexOf(fs.realpathSync(jobAbs).toLowerCase() + path.sep) !== 0) throw fail(403, 'That file points outside the job folder.');
  if (st.size > MAX_FILE) throw fail(413, name + ' is too large to use.');
  return { buf: fs.readFileSync(abs), type: TYPES[ext.toLowerCase()], name, modified: st.mtime.toISOString() };
}

function pageUrl(tool, kind, slug, siteBase) {
  const spec = PIECES[tool];
  const q = [(kind === 'pitch' ? 'pitch' : 'listing') + '=' + encodeURIComponent(slug), 'build=1'];
  if (spec.card) q.push(spec.card);
  return siteBase.replace(/\/$/, '') + spec.page + '?' + q.join('&');
}

async function layPiece(o) {
  const spec = Object.prototype.hasOwnProperty.call(PIECES, o.tool) ? PIECES[o.tool] : null;
  if (!spec || !spec.page) throw fail(400, 'The helper can\'t make a ' + o.tool + ' from a job.');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await guardRequests(page, o.siteBase);
    const origin = new URL(o.siteBase).origin;
    // registered after the guard, so it answers first: the job's pictures, read here
    await page.route(origin + FILE_PATH + '*', route => {
      let rel = '';
      try { rel = new URL(route.request().url()).searchParams.get('p') || ''; } catch (e) { /* none */ }
      try {
        const f = readJobFile(o.jobAbs, rel);
        return route.fulfill({ status: 200, contentType: f.type, body: f.buf });
      } catch (e) {
        return route.fulfill({ status: e.status || 500, contentType: 'text/plain', body: e.message });
      }
    });
    await page.addInitScript(hb => { window.__helperBuild = hb; window.__pieceTimeoutMs = 60000; },
      { row: o.row, docs: o.docs || [], tree: o.tree, filePath: FILE_PATH });
    await page.goto(pageUrl(o.tool, o.kind, o.row.slug, o.siteBase), { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction(() => window.GVC_PIECEMODE && window.GVC_PIECEMODE.ready, null, { timeout: o.layMs || LAY_MS })
      .catch(() => { throw fail(504, 'The ' + spec.words + ' took too long to lay out. Nothing was saved; ask again.'); });
    const out = await page.evaluate(() => window.GVC_PIECEMODE.buildPayload());
    if (errors.length && !(out && out.why)) throw new Error('The ' + spec.words + ' page reported an error: ' + errors[0]);
    return out;
  } finally {
    await browser.close();
  }
}

module.exports = { layPiece, readJobFile, pageUrl, FILE_PATH };
