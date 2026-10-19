/* ============================================================
   FOLDER SCAN — what each job folder shows, nightly (spec §2.5, C9).

     scanFolder(absPath, { since })  → { weeks, found, missing }
       weeks   files modified per week: { "<Monday YYYY-MM-DD>": count }
       found   first date a file appeared in each piece folder, old and new
               names alike: { floorplan, showsheet, photos (edited), brochure }
       missing the folder isn't there any more
     await scanAll({ client, driveRoot, now })
       scans every linked listing and pitch (never developments, D30),
       stores `scan`, marks a vanished folder 'broken', and moves an early
       stage forward from what the folder shows — never over DE or Matt.

   Reads names and dates only, never opens a file, and keeps no names:
   only weekly counts and dates. Paperwork folders and loose paperwork files
   are skipped entirely (assets/js/drive-rules.js). Nothing on Drive is
   ever changed (D7, D10).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const RULES = require('../assets/js/drive-rules.js');

const PIECES = [
  ['floorplan', /^floor ?plans?$/i],
  ['showsheet', /^show ?sheets?$/i],
  ['photos', /^(edited|edits|matt-edits)$/i],
  ['brochure', /^brochures?$/i]
];
const STAGE_OF = { floorplan: 'Floorplan', showsheet: 'Showsheet', photos: 'Photos', brochure: 'Brochure' };
const EARLY = ['Won', 'Floorplan', 'Showsheet', 'Photos', 'Brochure'];

function mondayOf(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

function scanFolder(abs, opts) {
  if (!fs.existsSync(abs)) return { weeks: {}, found: {}, missing: true };
  const since = opts && opts.since ? new Date(opts.since + 'T00:00:00Z') : null;
  const weeks = {}, first = {};
  (function walk(dir, trail) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || /^desktop\.ini$/i.test(e.name)) continue;
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
    }
  })(abs, []);
  const found = {};
  PIECES.forEach(([k]) => { if (first[k]) found[k] = first[k]; });
  const sorted = {};
  Object.keys(weeks).sort().forEach(k => { sorted[k] = weeks[k]; });
  return { weeks: sorted, found, missing: false };
}

/* the latest stage the folder shows: Floorplan < Showsheet < Photos < Brochure */
function folderStage(found) {
  let best = null;
  PIECES.forEach(([k]) => { if (found && found[k]) best = STAGE_OF[k]; });
  return best;
}

async function scanAll(o) {
  const { client } = o;
  const now = o.now || new Date();
  const since = new Date(now.getTime() - 400 * 864e5).toISOString().slice(0, 10);   // the overview shows six months
  const run = (await client.insert('sync_runs', { kind: 'scan', started_at: now.toISOString() }))[0];
  const out = { scanned: 0, broken: 0, moved: 0 };
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
        patch.scan = { weeks: s.weeks, found: s.found, scannedAt: now.toISOString() };
        if (r.folder_state === 'broken') { patch.folder_state = 'linked'; changes.push(log(owner, r.id, 'folder_state', 'broken', 'linked')); }
        const fs2 = folderStage(s.found);
        if (table === 'properties' && fs2 && r.stage_source !== 'Matt' && r.stage_source !== 'DE' &&
            (!r.stage || EARLY.indexOf(r.stage) !== -1) && EARLY.indexOf(fs2) > EARLY.indexOf(r.stage || '')) {
          patch.stage = fs2; patch.stage_source = 'folder';
          changes.push(log(owner, r.id, 'stage', r.stage || null, fs2)); out.moved++;
        }
      }
      try {
        await client.update(table, { id: r.id }, patch, { version: r.version });
        if (changes.length) await client.insert('changes', changes);
      } catch (e) { if (e.name !== 'ConflictError') throw e; }
    }
  }
  await client.update('sync_runs', { id: run.id }, { finished_at: new Date().toISOString(), ok: true, changes: out.broken + out.moved,
    rows_read: { jobs: out.scanned } });
  return out;
}

module.exports = { scanFolder, scanAll, mondayOf, folderStage };

if (require.main === module) {
  const { loadConfig } = require('./config.js');
  const cfg = loadConfig(), client = require('./supabase.js').createClient(cfg);
  if (!client.ready()) { console.log('No helper account yet.'); process.exit(1); }
  scanAll({ client, driveRoot: 'G:\\Shared drives' }).then(o => console.log('Scanned ' + o.scanned + ', ' + o.broken + ' broken, ' + o.moved + ' stages moved.'),
    e => { console.log('Scan failed: ' + e.message); process.exit(1); });
}
