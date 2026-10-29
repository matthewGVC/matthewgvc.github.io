/* ============================================================
   BACKUP — every workspace table, and the photo bucket, copied to a local
   folder (plan §11). Run before any migration, and nightly by the helper.

     node helper/backup.js                       → exports/supabase-backup-<date>/
     node helper/backup.js --no-files            tables only (the nightly run)
     node helper/backup.js --out <folder>

   Writes <table>.json for each table, files/<path> for each bucket file,
   manifest.json (row and file counts) and README.txt (how to restore).
   Never writes into a folder that already holds a backup. Fails loudly when
   the rows read don't match the database's own count. A table that doesn't
   exist yet (before a migration) is noted, not an error.
   Needs the helper's account (helper/supabase.js).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

const TABLES = ['properties', 'documents', 'photos', 'developments', 'todos', 'members', 'pitches',
  'dev_projects', 'dev_budgets', 'changes', 'floorplans', 'sync_runs', 'de_listings', 'asana_tasks', 'asana_people'];
const BUCKET = 'property-photos';

const README = [
  'GVC Workspace — Supabase backup',
  '',
  'One JSON file per table (an array of rows), files/ = the property-photos bucket,',
  'manifest.json = the counts when it was taken.',
  '',
  'To restore a table: POST its rows back through the REST API with',
  '  Prefer: resolution=merge-duplicates   (upsert by primary key; documents has none since',
  '  0010: send listing rows with ?on_conflict=property_id,tool and pitch rows with',
  '  ?on_conflict=pitch_id,tool)',
  'as a member account, or paste them in the Supabase SQL editor with',
  '  insert into public.<table> select * from json_populate_recordset(null::public.<table>, \'<json>\')',
  '  on conflict do nothing;',
  'Files: upload each one back to the bucket at the same path.',
  ''
].join('\n');

async function backup(o) {
  const out = o.outDir;
  if (fs.existsSync(path.join(out, 'manifest.json'))) throw new Error('A backup is already in ' + out + '. Pick another folder.');
  fs.mkdirSync(out, { recursive: true });
  const manifest = { takenAt: new Date().toISOString(), tables: {}, bucket: null };

  for (const t of o.tables || TABLES) {
    let rows;
    try { rows = await o.client.select(t); }
    catch (e) { if (e.status === 404) { manifest.tables[t] = 'not created yet'; continue; } throw e; }
    const n = await o.client.count(t);
    if (n !== rows.length) throw new Error(t + ': the database counts ' + n + ' rows but ' + rows.length + ' were read. The backup is incomplete.');
    fs.writeFileSync(path.join(out, t + '.json'), JSON.stringify(rows, null, 2));
    manifest.tables[t] = rows.length;
  }

  if (o.bucket) {
    const files = await o.client.listBucket(o.bucket);
    const root = path.resolve(out, 'files'), skipped = [];
    let written = 0;
    for (const f of files) {
      // a stored name must stay inside files/: no "..", ".", empty parts, drive letters or backslashes
      const segs = f.split('/');
      const dest = path.resolve(root, ...segs);
      if (segs.some(s => s === '' || /^[.\s]+$/.test(s) || /[\\:]/.test(s)) || dest.indexOf(root + path.sep) !== 0) {
        skipped.push(f);
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, await o.client.download(o.bucket, f));
      written++;
    }
    manifest.bucket = { name: o.bucket, files: written };
    if (skipped.length) manifest.bucket.skipped = skipped;
  }

  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(out, 'README.txt'), README);
  return manifest;
}

module.exports = { backup, TABLES, BUCKET };

if (require.main === module) {
  const { loadConfig } = require('./config.js');
  const { createClient } = require('./supabase.js');
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i === -1 ? null : a[i + 1]; };
  const cfg = loadConfig(), client = createClient(cfg);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = arg('--out') || path.join(__dirname, '..', 'exports', 'supabase-backup-' + date);
  if (!client.ready()) { console.log('No helper account yet: add helperEmail and helperPassword to ' + path.join(cfg.home, 'config.json') + '.'); process.exit(1); }
  backup({ client, outDir, bucket: a.includes('--no-files') ? null : BUCKET }).then(m => {
    console.log('Backup written to ' + outDir);
    Object.keys(m.tables).forEach(t => console.log('  ' + t + ': ' + m.tables[t]));
    if (m.bucket) console.log('  ' + m.bucket.name + ': ' + m.bucket.files + ' files');
  }, e => { console.log('BACKUP FAILED: ' + e.message); process.exit(1); });
}
