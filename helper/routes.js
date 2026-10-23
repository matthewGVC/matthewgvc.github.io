/* ============================================================
   HELPER ROUTES — what the workspace can ask the helper to do.

     POST /de/dry-run   {}                        → the dry-run report (writes nothing)
     POST /asana/sync   {}                        → one Asana read (joins one already running)
     POST /sync         {}                        → Asana, then DE: {asana:{...}, de:{...}}
     POST /pdf          {tool, inputs, paper, outDir}
                                                  → {ok, path, pages}
     POST /drive-link   {folder, file?}           → {url} (the real Google Drive link; paperwork refused)
     GET  /lab/samples                            → paths of the Showsheet sample files
     POST /piece        {propertyId, tool, state, paper}
                                                  → the showsheet PDF written into the job's
                                                    folder (helper/piece.js); body up to 40 MB

   /pdf in Slice 0 accepts only the repo's sample files as inputs, and
   writes only inside the configured output roots (helper/pdf/guard.js).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { route } = require('./server.js');
const { insideRoots } = require('./pdf/guard.js');
const { savePdf } = require('./pdf/name.js');

const SAMPLES = path.join(__dirname, '..', 'tools', 'showsheet', 'sample');
// the Slice 0 test route draws the Showsheet only; its file prefix comes from the one table
const PIECE = { showsheet: require('./pieces.js').PIECES.showsheet.prefix };

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

/* "Sync now" on the overview. Refused (with the reason) until the helper has its account. */
let syncing = null;
function deSync() {
  if (!syncing) {
    syncing = require('./de-sync.js').syncNow({})
      .then(r => ({ ok: !!r.report.ok, changes: r.changes, created: r.created, skipped: r.errors.length, aborted: r.report.aborted || null }))
      .finally(() => { syncing = null; });
  }
  return syncing;
}
route('POST', '/de/sync', deSync);

/* Asana: one sync at a time (a second call joins the one running). Refused with
   the reason until the token is in the config. ok is the stored run's ok
   (sync_runs.ok): a partial read or a run before the link plan is not OK, and
   aborted then says why. */
function shapeRun(r) {
  const ok = r.ok === undefined ? !!r.report.ok : !!r.ok;
  const errs = r.errors || [];
  const why = r.report.aborted || (ok ? null
    : ((errs.find(e => e.what === 'no plan') || errs.find(e => e.what === 'failed') || {}).detail || (r.report.warnings || [])[0] || 'the run was not complete'));
  return { ok, changes: r.changes, created: r.created, skipped: errs.length, aborted: why || null };
}
function asanaSyncRoute(syncNow) {
  // the same in-flight run the scheduled jobs use (inflight.js)
  return () => require('./inflight.js').runAsana('plain', syncNow).then(shapeRun);
}
/* Sync now: Asana first, then DE. A problem in one never stops the other. */
function syncRoute(o) {
  const soft = fn => Promise.resolve().then(fn).catch(e => ({ ok: false, error: e.message || String(e) }));
  return async () => {
    const asana = await soft(o.asana);
    const de = await soft(o.de);
    return { ok: !!(asana.ok && de.ok), asana, de };
  };
}
const asanaOne = asanaSyncRoute(() => require('./asana-sync.js').syncNow({}));
route('POST', '/asana/sync', asanaOne);
route('POST', '/sync', syncRoute({ asana: asanaOne, de: () => deSync() }));

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

/* "Open folder" on a job page: opens the job's folder in File Explorer.
   Only a folder that exists under G:\Shared drives; launched without a shell. */
function openFolderRoute(o) {
  const root = path.resolve(o.driveRoot);
  const launch = o.launch || (p => require('child_process').spawn('explorer.exe', [p], { detached: true, stdio: 'ignore' }).unref());
  return async body => {
    const rel = String(body.folder || '');
    const segs = rel.split(/[\\/]+/).filter(Boolean);
    if (!segs.length || segs.some(s => /^[.\s]+$/.test(s) || /[:"<>|*?]/.test(s))) throw fail(400, 'That isn\'t a folder path the helper opens.');
    const abs = path.resolve(root, ...segs);
    if (abs.indexOf(root + path.sep) !== 0) throw fail(403, 'Only folders in Shared drives can be opened.');
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw fail(404, 'That folder isn\'t on Drive any more.');
    launch(abs);
    return { ok: true };
  };
}
route('POST', '/open-folder', openFolderRoute({ driveRoot: 'G:\\Shared drives' }));

/* "Copy Drive link": the real drive.google.com link of a job folder, or of one file in it
   (relative to the folder). Reads the Drive id Google Drive for Desktop keeps beside the item;
   writes nothing. Paperwork files, a folder with paperwork in its path ("<job>/Docs") and a
   whole shared drive are refused before anything is touched. */
function driveLinkRoute(o) {
  const root = path.resolve(o.driveRoot);
  const { allowedInJob, isPaperworkFolder, hasPaperworkWord } = require('../assets/js/drive-rules.js');
  const { driveLink } = require('./drive-link.js');
  const under = rel => {
    const segs = String(rel || '').split(/[\\/]+/).filter(Boolean);
    if (!segs.length || segs.some(s => /^[.\s]+$/.test(s) || /[:"<>|*?]/.test(s))) throw fail(400, 'That isn\'t a path the helper reads.');
    const abs = path.resolve(root, ...segs);
    if (abs.indexOf(root + path.sep) !== 0) throw fail(400, 'Not under Shared drives');
    return { abs, segs };
  };
  return async body => {
    const f = under(body.folder);
    if (f.segs.length < 2 || f.segs.some(s => isPaperworkFolder(s) || hasPaperworkWord(s))) throw fail(403, 'The workspace doesn\'t link that folder.');
    if (!body.file) {
      const url = driveLink(f.abs, true);
      if (!url) throw fail(404, 'No Drive id beside this item');
      return { url };
    }
    const inside = String(body.file).split(/[\\/]+/).filter(Boolean).join('/');
    if (!allowedInJob(inside) || /[:"<>|*?]/.test(inside)) throw fail(403, 'The workspace doesn\'t link that file.');
    const abs = path.resolve(f.abs, ...inside.split('/'));
    if (abs.indexOf(f.abs + path.sep) !== 0) throw fail(400, 'That isn\'t a path the helper reads.');
    const url = driveLink(abs, false);
    if (!url) throw fail(404, 'No Drive id beside this item');
    return { url };
  };
}
route('POST', '/drive-link', driveLinkRoute({ driveRoot: 'G:\\Shared drives' }));

/* "Save PDF to Drive" on a job's piece (pieces.js). The helper's own account reads the job. */
let pieceDb = null;
route('POST', '/piece', require('./piece.js').pieceRoute({
  db: cfg => (pieceDb = pieceDb || require('./supabase.js').createClient(cfg)),
  render: o => require('./pdf/render.js').renderPiece(o),
  driveRoot: 'G:\\Shared drives',
  driveLink: (abs, isFolder) => require('./drive-link.js').driveLink(abs, isFolder)
}), { maxBody: 40 * 1024 * 1024 });

module.exports = { driveLinkRoute, openFolderRoute, asanaSyncRoute, syncRoute };
