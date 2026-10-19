/* ============================================================
   HELPER ROUTES — what the workspace can ask the helper to do.

     POST /de/dry-run   {}                        → the dry-run report (writes nothing)
     POST /pdf          {tool, inputs, paper, outDir}
                                                  → {ok, path, pages}
     GET  /lab/samples                            → paths of the Showsheet sample files

   /pdf in Slice 0 accepts only the repo's sample files as inputs, and
   writes only inside the configured output roots (helper/pdf/guard.js).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { route } = require('./server.js');
const { insideRoots } = require('./pdf/guard.js');
const { savePdf } = require('./pdf/name.js');

const SAMPLES = path.join(__dirname, '..', 'tools', 'showsheet', 'sample');
const PIECE = { showsheet: 'Showsheet' };

function fail(status, msg) { return Object.assign(new Error(msg), { status }); }
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

route('GET', '/lab/samples', () => Promise.resolve({
  ok: true,
  inputs: { docx: path.join(SAMPLES, 'listing.docx'), photo: path.join(SAMPLES, 'hero.jpg'), floorplan: path.join(SAMPLES, 'floorplan.jpg') }
}));

route('POST', '/de/dry-run', () => require('./de-sync.js').dryRun({}));

route('POST', '/pdf', async (body, cfg) => {
  if (!PIECE[body.tool]) throw fail(400, 'The helper can\'t make a ' + body.tool + ' yet.');
  if (!insideRoots(body.outDir, cfg.outputRoots)) throw fail(403, 'That folder is outside the places the helper may write to.');
  const inputs = body.inputs || {};
  for (const k of Object.keys(inputs)) {
    const p = path.resolve(String(inputs[k]));
    if (path.dirname(p).toLowerCase() !== SAMPLES.toLowerCase() || !fs.existsSync(p)) {
      throw fail(403, 'In this test the helper only reads the Showsheet sample files.');
    }
  }
  const { renderPiece } = require('./pdf/render.js');
  const r = await renderPiece({ tool: body.tool, inputs, paper: body.paper || 'a5', siteBase: cfg.siteBase });
  const file = await savePdf(r.pdf, body.outDir, PIECE[body.tool], r.label, today());
  return { ok: true, path: file, pages: r.pages };
});
