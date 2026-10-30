/* ============================================================
   FOLDER SCAN — what each job folder shows, nightly (spec §2.5, C9).

     scanFolder(absPath, { since })  → { weeks, found, missing }
       weeks   files modified per week: { "<Monday YYYY-MM-DD>": count }
       found   first date a file appeared in each piece folder, old and new
               names alike: { floorplan, showsheet, photos (edited), brochure }
       missing the folder isn't there any more
     await scanAll({ client, driveRoot, now })
       scans every linked listing and pitch (never developments, D30),
       stores `scan` and marks a vanished folder 'broken'. It never moves the
       stage: that is Asana's (D50, S8); the pieces found feed Match's M8.

   Sidecar and system files (.xmp, .xmpses, desktop.ini, Thumbs.db, ~$ and
   ._ files: drive-rules.js isJunk) are skipped everywhere, never counted.
   Reads names and dates only, never opens a file. It keeps weekly counts and
   dates, plus (S15) the folder's Drive link, the newest 5 finished files of
   each kit piece with their links, and the folder-health notes. Never a name
   from paperwork or Docs.

   A job at Prep or later with no linked folder: the scan looks for its
   folder with the Link folder suggestions' own matching (folder-link.js
   suggest, folder names only) and keeps the likely one as scan.candidate
   (with candidateAt), the evidence for Match's M18. An NYC job with a unit
   needs its unit folder; a building folder alone is not a candidate. It is a
   suggestion only: nothing is linked here, and nothing on Drive is written. Paperwork folders and loose paperwork files
   are skipped entirely (assets/js/drive-rules.js). Nothing on Drive is
   ever changed (D7, D10).

   The AI pass (D123, folder-ai.js), only when scanAll is given `ask` (the
   config holds anthropicKey): a staged job (not Archived) still with no
   folder and no candidate after the address matching gets one question to
   Claude Haiku over the folder NAMES of its market and New Development. A
   pick is kept as scan.candidate with candidateBy 'ai' and candidateWhy (the
   model's one-line reason); every ask stamps candidateAiAt, and a job is
   asked again only after AI_RETRY_DAYS. The guess stands until the address
   matching finds a folder or the job is linked; it is never linked by
   itself. Each ask logs the job and the path chosen, never the folder list.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const RULES = require('../assets/js/drive-rules.js');
const LINK = require('../assets/js/folder-link.js');
const ADDR = require('../assets/js/address-aliases.js');
const HEALTH = require('../assets/js/folder-health.js');
const { driveLink } = require('./drive-link.js');
const PREP_ON = ['Prep', 'Live', 'Accepted offer', 'In contract', 'Sold', 'Rented', 'Off market'];   // match-check.js's, M18 (D88)
const NYC_ROOT = 'GVC - New York/Building Information';
const AI = require('./folder-ai.js');
const AI_RETRY_DAYS = 7;
const CAND_KEYS = ['candidate', 'candidateAt', 'candidateBy', 'candidateWhy', 'candidateAiAt'];

/* folder names under the Drive root, as GVC_DRIVE.list gives them; read once per run */
function driveLister(root) {
  const memo = new Map();
  return { list(p) {
    if (!memo.has(p)) {
      let v = null;
      try {
        v = fs.readdirSync(path.join(root, ...p.split('/')), { withFileTypes: true })
          .filter(e => !e.name.startsWith('.')).map(e => ({ kind: e.isDirectory() ? 'directory' : 'file', name: e.name }));
      } catch (e) { v = null; }
      memo.set(p, v);
    }
    const v = memo.get(p);
    return v ? Promise.resolve(v) : Promise.reject(new Error('Not on Drive: ' + p));
  } };
}

/* the likely folder of a job with none linked, or null */
async function candidateFor(D, row) {
  const paths = await LINK.suggest(D, ADDR, 'properties', row);
  const unit = String((row.core || {}).unit || '').trim();
  const nycUnit = row.market === 'NYC' && unit;
  const hit = paths.find(p => !nycUnit || p.split('/').length === NYC_ROOT.split('/').length + 2);
  return hit || null;
}

const PIECES = [
  ['floorplan', /^floor ?plans?$/i],
  ['showsheet', /^show ?sheets?$/i],
  ['photos', /^(edited|edits|edited photos|matt[- ]edits|finals?|final photos|selects)$/i],
  ['brochure', /^brochures?$/i]
];

function mondayOf(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

function scanFolder(abs, opts) {
  if (!fs.existsSync(abs)) return { weeks: {}, found: {}, missing: true };
  const since = opts && opts.since ? new Date(opts.since + 'T00:00:00Z') : null;
  const weeks = {}, first = {};
  let loosePhoto = null;   // finished photos loose in Photos\ (no Edited / Finals folder): Matt, 10-30
  (function walk(dir, trail) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (!e.isDirectory() && RULES.isJunk(e.name)) continue;   // sidecars, Thumbs.db, ~$ temp files (drive-rules.js)
      if (e.name.startsWith('.')) continue;
      if (RULES.isPaperworkFolder(e.name)) continue;          // folders and loose files alike
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p, trail.concat(e.name)); continue; }
      let t;
      try { t = fs.statSync(p).mtime; } catch (x) { continue; }
      if (since && t < since) continue;
      const wk = mondayOf(t);
      weeks[wk] = (weeks[wk] || 0) + 1;
      const day = t.toISOString().slice(0, 10);
      PIECES.forEach(([k, re]) => {
        if (trail.some(seg => re.test(seg)) && (!first[k] || day < first[k])) first[k] = day;
      });
      if (trail.length === 1 && /^(photos?|pictures)$/i.test(trail[0]) && /\.(jpe?g|png|tiff?|heic|webp)$/i.test(e.name) && (!loosePhoto || day < loosePhoto)) loosePhoto = day;
    }
  })(abs, []);
  if (!first.photos && loosePhoto) first.photos = loosePhoto;
  const found = {};
  PIECES.forEach(([k]) => { if (first[k]) found[k] = first[k]; });
  const sorted = {};
  Object.keys(weeks).sort().forEach(k => { sorted[k] = weeks[k]; });
  return { weeks: sorted, found, missing: false };
}

/* The job folder as GVC_HEALTH's tree, like assets/js/drive.js treeOf (depth 4): every name passes
   drive-rules BEFORE it is statted or opened. Paperwork folders come out as one skipped line, paperwork
   and other loose top files are only counted, and a loose top file named like a piece (a showsheet at the
   top) is passed by name so the health check can flag it. A paperwork folder deeper down ("Marketing/Docs")
   is dropped before it is read. Stats only; no file is ever opened. */
const NO_STAT = ['raw', 'raws', 'staged', 'print', 'web'];   // photo sets: counted by name
function treeOf(abs, depth) {
  const top = { name: path.basename(abs), kind: 'directory', children: [], looseCount: 0, otherCount: 0 };
  const read = dir => { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return []; } };
  const skip = (n, e) => n.startsWith('.') || (!e.isDirectory() && RULES.isJunk(n));   // sidecars and system files (drive-rules.js)
  function fileNode(p, name, segs) {
    const f = { name, kind: 'file' };
    if (segs.some(g => NO_STAT.indexOf(g.toLowerCase()) !== -1)) return f;
    try { const st = fs.statSync(p); f.size = st.size; f.modified = st.mtime.toISOString(); } catch (e) { /* no date */ }
    return f;
  }
  function walk(dir, segs, left, node) {
    read(dir).forEach(e => {
      if (skip(e.name, e) || !(e.isDirectory() || e.isFile())) return;
      const p = path.join(dir, e.name), at = segs.concat(e.name);
      if (!segs.length) {
        const paper = RULES.isPaperworkFolder(e.name) || RULES.hasPaperworkWord(e.name);
        if (e.isDirectory()) {
          if (paper) { node.children.push({ name: e.name, kind: 'directory', skipped: true }); return; }
          if (!RULES.allowedInJob(e.name)) { top.otherCount++; return; }
        } else {
          if (paper) { top.looseCount++; return; }
          if (!RULES.allowedInJob(e.name)) {
            if (HEALTH.topPieceKey(e.name)) node.children.push(fileNode(p, e.name, segs)); else top.looseCount++;
            return;
          }
        }
      } else if (!RULES.allowedInJob(at.join('/'))) return;
      if (!e.isDirectory()) { node.children.push(fileNode(p, e.name, segs)); return; }
      if (RULES.isPaperwork(e.name)) return;                     // "Marketing/Docs": never listed, never opened
      const d = { name: e.name, kind: 'directory', children: [] };
      node.children.push(d);
      if (left <= 1) d.more = true; else walk(p, at, left - 1, d);
    });
    node.children.sort((a, b) => a.name.localeCompare(b.name));
  }
  walk(abs, [], depth || 4, top);
  return RULES.jobTree(top);
}

/* what the job page and the phone show without Drive: the folder's link, the newest 5 files of each kit
   piece with their links, the health notes and counts, the details doc. Names of allowed files only. */
function richScan(abs, tree, r) {
  const h = HEALTH.health(tree, { market: r.market, driveRoot: String(r.drive_folder || '').split('/')[0], isNew: false });
  const pieces = {};
  HEALTH.KEYS.forEach(k => {
    const loose = f => f.path.indexOf('/') === -1 ? 1 : 0;   // a file loose at the top ranks after one in the piece's own folder
    const list = (h.pieces[k] || []).slice().sort((a, b) => (loose(a) - loose(b)) || (Date.parse(b.modified) || 0) - (Date.parse(a.modified) || 0)).slice(0, 5);
    if (list.length) pieces[k] = list.map(f => Object.assign({ name: f.name, modified: f.modified, archived: !!f.archived,
      url: driveLink(path.join(abs, ...f.path.split('/')), false) }, f.path.indexOf('/') === -1 ? { top: true } : {}));
  });
  return { folderUrl: driveLink(abs, true), pieces, health: { notes: h.notes, counts: h.counts }, detailsDoc: h.detailsDoc };
}

async function scanAll(o) {
  const { client } = o;
  const now = o.now || new Date();
  const since = new Date(now.getTime() - 400 * 864e5).toISOString().slice(0, 10);   // the overview shows six months
  const run = (await client.insert('sync_runs', { kind: 'scan', started_at: now.toISOString() }))[0];
  const out = { scanned: 0, broken: 0, candidates: 0, aiAsked: 0, aiGuesses: 0 };
  const say = o.log || (m => console.log(m));
  // G: not mounted (Drive for Desktop not running): every folder would look gone
  if (!fs.existsSync(o.driveRoot)) {
    out.aborted = 'Google Drive isn\'t mounted (no ' + o.driveRoot + '), so nothing was scanned or marked.';
    await client.update('sync_runs', { id: run.id }, { finished_at: new Date().toISOString(), ok: false, errors: [{ what: 'aborted', detail: out.aborted }] });
    return out;
  }
  const log = (owner, id, field, oldV, newV) => Object.assign({ [owner]: id, at: now.toISOString(), field,
    old_value: oldV, new_value: newV, source: 'folder', run_id: run.id });

  for (const [table, owner] of [['properties', 'property_id'], ['pitches', 'pitch_id']]) {
    let rows = [];
    try { rows = await client.select(table); } catch (e) { if (e.status !== 404) throw e; }
    for (const r of rows.filter(x => x.drive_folder && x.folder_state !== 'unlinked')) {
      const s = scanFolder(path.join(o.driveRoot, ...r.drive_folder.split('/')), { since });
      out.scanned++;
      const patch = {}, changes = [];
      if (s.missing) {
        if (r.folder_state !== 'broken') { patch.folder_state = 'broken'; changes.push(log(owner, r.id, 'folder_state', r.folder_state, 'broken')); out.broken++; }
      } else {
        const abs = path.join(o.driveRoot, ...r.drive_folder.split('/'));
        const keep = {};
        CAND_KEYS.forEach(k => { if (r.scan && r.scan[k] !== undefined) keep[k] = r.scan[k]; });
        patch.scan = Object.assign({ weeks: s.weeks, found: s.found, scannedAt: now.toISOString() }, richScan(abs, treeOf(abs, 4), r), keep);
        if (r.folder_state === 'broken') { patch.folder_state = 'linked'; changes.push(log(owner, r.id, 'folder_state', 'broken', 'linked')); }
      }
      try {
        await client.update(table, { id: r.id }, patch, { version: r.version });
        if (changes.length) await client.insert('changes', changes);
      } catch (e) { if (e.name !== 'ConflictError') throw e; }
    }
    if (table !== 'properties') continue;
    // M18: a job with no folder linked, and the folder its address points to
    const D = driveLister(o.driveRoot);
    for (const r of rows.filter(x => PREP_ON.indexOf(x.stage) !== -1 && (!x.drive_folder || x.folder_state === 'unlinked'))) {
      let cand = null;
      try { cand = await candidateFor(D, r); } catch (e) { cand = null; }
      if (cand) out.candidates++;
      const prev = r.scan || {};
      if (!cand && prev.candidateBy === 'ai') continue;   // the AI's guess stands until the matching finds one
      if ((prev.candidate || null) === cand && prev.candidateBy !== 'ai') continue;
      const next = Object.assign({}, prev, { candidate: cand, candidateAt: now.toISOString() });
      delete next.candidateBy; delete next.candidateWhy;
      try {
        await client.update(table, { id: r.id }, { scan: next }, { version: r.version });
      } catch (e) { if (e.name !== 'ConflictError') throw e; }
    }
    if (!o.ask) continue;
    // the AI pass: staged jobs the matching couldn't place (D123); read again, the loop above moved versions
    const fresh = await client.select(table);
    const taken = fresh.filter(x => x.drive_folder && x.folder_state !== 'unlinked').map(x => x.drive_folder);
    const unplaced = fresh.filter(x => x.stage && x.stage !== 'Archived' && (!x.drive_folder || x.folder_state === 'unlinked') &&
      !(x.scan && x.scan.candidate) && !(x.scan && Date.parse(x.scan.candidateAiAt) > now.getTime() - AI_RETRY_DAYS * 864e5));
    for (const r of unplaced) {
      const core = r.core || {};
      const name = [core.address || r.label || r.id, core.unit].filter(Boolean).join(' ');
      let g;
      try {
        g = await AI.guess({ ask: o.ask, row: r, paths: await AI.folderNames(D, r, { taken }) });
      } catch (e) { say('AI folder guess: ' + name + ': failed (' + e.message + '); asked again next night.'); continue; }
      out.aiAsked++;
      if (g) out.aiGuesses++;
      say('AI folder guess: ' + name + ' -> ' + (g ? g.path : 'none'));
      const extra = g ? { candidate: g.path, candidateAt: now.toISOString(), candidateBy: 'ai', candidateWhy: g.why } : {};
      try {
        await client.update(table, { id: r.id }, { scan: Object.assign({}, r.scan || {}, extra, { candidateAiAt: now.toISOString() }) }, { version: r.version });
      } catch (e) { if (e.name !== 'ConflictError') throw e; }
    }
  }
  await client.update('sync_runs', { id: run.id }, { finished_at: new Date().toISOString(), ok: true, changes: out.broken,
    rows_read: { jobs: out.scanned } });
  return out;
}

module.exports = { scanFolder, treeOf, scanAll, mondayOf, candidateFor, driveLister };

if (require.main === module) {
  const { loadConfig } = require('./config.js');
  const cfg = loadConfig(), client = require('./supabase.js').createClient(cfg);
  if (!client.ready()) { console.log('No helper account yet.'); process.exit(1); }
  scanAll({ client, driveRoot: 'G:\\Shared drives', ask: AI.makeAsk(cfg) }).then(o => console.log('Scanned ' + o.scanned + ', ' + o.broken + ' broken.'),
    e => { console.log('Scan failed: ' + e.message); process.exit(1); });
}
