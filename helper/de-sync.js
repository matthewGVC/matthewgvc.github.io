/* ============================================================
   DE SYNC — reads Douglas Elliman's team listings and reports what the
   workspace would do with them. Slice 0 is a DRY RUN: it writes a report
   and nothing else (no Supabase, no Drive).

     node helper/de-sync.js --dry-run [--record] [--fixtures <dir>]
     node helper/de-sync.js --write         read DE and write the changes (needs the helper account)
     node helper/de-sync.js --courtesy <deId,deId>

   --record   also saves DE's raw pages to helper/fixtures/recorded/<date>/
   --fixtures replays a recording (or the made-up fixtures) instead of DE
   Report: exports/de-dry-run-<date>.json and .md (fixture runs:
   exports/fixture-runs/). Exit 1 when the run aborted.

   A run aborts, changing nothing, when a feed's total ≠ rows read, DE uses an
   unknown status, or live listings fell by more than a quarter since the last
   good report (plan §8).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { captureFeeds, fromFixtures, FEEDS } = require('./de/capture.js');
const { normalize } = require('./de/normalize.js');
const { mapStage } = require('./de/status.js');
const { checkTotals, checkDrop, diffRuns } = require('./de/checks.js');
const { resolveLnks } = require('./folders/lnk.js');
const A = require('../assets/js/address-aliases.js');

const REPO = path.join(__dirname, '..');
const DRIVE = 'G:\\Shared drives';

function today() { return new Date().toISOString().slice(0, 10); }
function relDrive(abs) {
  if (!abs) return null;
  const p = abs.replace(/\//g, '\\');
  const i = p.toLowerCase().indexOf(DRIVE.toLowerCase() + '\\');
  return (i === 0 ? p.slice(DRIVE.length + 1) : p).split('\\').join('/');
}
function dirs(abs) {
  try { return fs.readdirSync(abs, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
  catch (e) { return []; }
}

/* ---------- folder matching (directory NAMES only; nothing is opened) ---------- */

/* A shortcut points at …/Building Information/<building>/<unit>[/<sale subfolder>…]. */
function lnkMatches(lnk, row) {
  if (!lnk.target || !row.unit) return false;
  const parts = relDrive(lnk.target).split('/');
  const i = parts.indexOf('Building Information');
  if (i === -1 || parts.length < i + 3) return false;
  return A.same(parts[i + 1], row.street) && A.unitKey(parts[i + 2]) === A.unitKey(row.unit);
}

/* NJ / FL folders are named by address ("8 Woolley St", "14 Ridge Rd, Rumson NJ",
   "1006 Pheasant Ln #204"). Exact address only (no prefixes: "12 Oak St" is not
   "12 Oak Hill Rd"); a unit in the folder name must be this listing's unit. */
function addressFolderMatch(street, unit, names) {
  for (const n of names) {
    const base = n.split(',')[0].trim();
    if (A.same(base, street)) return n;
    if (!unit && A.startsWithAddress(base, street)) return n;
    const m = unit && /^(.*?)[\s,]*(?:#|unit\b|apt\.?|no\.)?\s*([A-Za-z0-9-]+)$/i.exec(base);
    if (m && A.same(m[1], street) && A.unitKey(m[2]) === A.unitKey(unit)) return n;
  }
  return null;
}

function makeDriveFinder(driveRoot) {
  const DRIVE = driveRoot;
  const cache = {};
  const list = abs => (cache[abs] = cache[abs] || dirs(abs));
  return row => {
    if (row.state === 'NY') {
      const bi = path.join(DRIVE, 'GVC - New York', 'Building Information');
      for (const b of list(bi).filter(n => A.same(n, row.street))) {
        const units = list(path.join(bi, b)).map(n => ({ name: n, path: 'GVC - New York/Building Information/' + b + '/' + n }));
        const hit = row.unit ? A.matchFolder(row.street, row.unit, units) : null;
        if (hit) return hit.path;
      }
      return null;
    }
    const roots = row.state === 'NJ'
      ? list(path.join(DRIVE, 'GVC - New Jersey', '1. Residential Sales', '1. Resale'))
          .map(t => 'GVC - New Jersey/1. Residential Sales/1. Resale/' + t)
          .concat(['GVC - New Jersey/Rentals'])
      : row.state === 'FL' ? ['GVC - Florida/Resale'] : [];
    for (const r of roots) {
      const hit = addressFolderMatch(row.street, row.unit, list(path.join(DRIVE, ...r.split('/'))));
      if (hit) return r + '/' + hit;
    }
    return null;
  };
}

/* ---------- the run ---------- */

/* The newest earlier report of a real DE run that went through. Fixture runs
   never count: they would make a real run compare against made-up listings. */
function lastGoodReport(outDir, date) {
  if (!fs.existsSync(outDir)) return null;
  const files = fs.readdirSync(outDir).filter(f => /^de-dry-run-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .filter(f => f.slice(11, 21) < date).sort().reverse();
  for (const f of files) {
    const r = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'));
    if (r.ok && r.source === 'DE') return r;
  }
  return null;
}

async function dryRun(opts) {
  opts = opts || {};
  const date = opts.date || today();
  // fixture runs report into their own folder, so they never replace a real report
  const outDir = opts.outDir || path.join(REPO, 'exports', opts.fixturesDir ? 'fixture-runs' : '');
  const driveRoot = opts.driveRoot || DRIVE;
  const report = { ok: false, date, source: opts.asSource || (opts.fixturesDir ? 'fixtures' : 'DE') };
  try {
    if (opts.drive !== false && !fs.existsSync(path.join(driveRoot, 'GVC - New York', 'ACTIVE LISTINGS & DEALS'))) {
      throw new Error('Drive isn\'t mounted on this PC (no ' + driveRoot + '), so folders can\'t be matched. Nothing was changed.');
    }
    const feeds = opts.fixturesDir ? fromFixtures(opts.fixturesDir)
      : await captureFeeds({ teamUrl: opts.teamUrl || require('./config.js').loadConfig().teamUrl,
        record: opts.record ? path.join(REPO, 'helper', 'fixtures', 'recorded', date) : null });

    report.totals = {}; report.rowsRead = {};
    const rows = [];
    Object.keys(FEEDS).forEach(name => {
      const f = feeds[name];
      report.totals[name] = f.total; report.rowsRead[name] = f.rows.length;
      checkTotals(name, f.total, f.rows.length);
      // a page served twice would still add up to the total
      const ids = new Set(f.rows.map(raw => String(raw.coreListingId)));
      if (ids.size !== f.rows.length) {
        throw new Error(name + ': DE sent ' + (f.rows.length - ids.size) + ' listing(s) twice, so the pages can\'t be trusted. Nothing was changed.');
      }
      f.rows.forEach(raw => rows.push(normalize(raw, name)));
    });
    rows.forEach(r => { r.stage = mapStage(r); });
    // every row, for syncNow(); not written into the report file
    Object.defineProperty(report, 'rows', { value: rows, enumerable: false });
    report.statusesSeen = Array.from(new Set(rows.map(r => r.status))).sort();

    const live = rows.filter(r => r.feed === 'featured');
    const prev = lastGoodReport(outDir, date);
    checkDrop(live.length, prev ? prev.live.length : null);

    const lnks = opts.lnks || (opts.drive === false ? [] : resolveLnks(path.join(driveRoot, 'GVC - New York', 'ACTIVE LISTINGS & DEALS')));
    const findOnDrive = opts.drive === false ? () => null : makeDriveFinder(driveRoot);
    report.live = live.map(r => {
      const lnk = lnks.find(l => lnkMatches(l, r));
      const folder = lnk ? relDrive(lnk.target) : findOnDrive(r);
      return { id: r.id, kind: r.kind, street: r.street, unit: r.unit, state: r.state, status: r.status,
        stage: r.stage, price: r.price, priceChangePercent: r.priceChangePercent, listingUrl: r.listingUrl,
        folder, via: lnk ? 'lnk' : folder ? 'alias' : null };
    });
    report.lnk = lnks.map(l => {
      const hit = rows.find(r => lnkMatches(l, r));
      return { name: l.name, target: relDrive(l.target), onDE: !!hit, deStage: hit ? hit.stage : undefined };
    });
    const d = diffRuns(prev ? prev.live : null, report.live);
    // a listing that left the live feed because it sold or rented is a move, not missing
    const closed = new Map(rows.filter(r => r.feed === 'transactions').map(r => [r.id, r.stage]));
    const prevStage = new Map((prev ? prev.live : []).map(x => [x.id, x.stage || mapStage(x)]));
    d.missing.filter(id => closed.has(id)).forEach(id => d.stageMoves.push({ id, from: prevStage.get(id), to: closed.get(id) }));
    report.stageMoves = d.stageMoves; report.missing = d.missing.filter(id => !closed.has(id)); report.priceReduced = d.priceReduced;
    report.ok = true;
  } catch (e) {
    report.aborted = e.message;
  }
  report.reportFile = path.relative(REPO, path.join(outDir, 'de-dry-run-' + date + '.md'));
  writeReport(outDir, report);
  return report;
}

/* ---------- report ---------- */

function money(n) { return n == null ? '' : '$' + Number(n).toLocaleString('en-US'); }

function writeReport(outDir, r) {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, 'de-dry-run-' + r.date);
  fs.writeFileSync(base + '.json', JSON.stringify(r, null, 2));
  const L = ['# DE dry run, ' + r.date, '', 'Source: ' + r.source + '. Nothing was written to Supabase or Drive.', ''];
  if (!r.ok) L.push('**ABORTED:** ' + r.aborted, '');
  if (r.totals) {
    L.push('## Totals', '', '| Feed | DE total | Rows read |', '|---|---|---|');
    Object.keys(r.totals).forEach(k => L.push('| ' + k + ' | ' + r.totals[k] + ' | ' + r.rowsRead[k] + ' |'));
    L.push('');
  }
  if (r.statusesSeen) L.push('Statuses seen: ' + r.statusesSeen.join(', '), '');
  if (r.live) {
    const matched = r.live.filter(x => x.folder).length;
    L.push('## Live and in contract (' + r.live.length + ', ' + matched + ' matched to a folder)', '',
      '| Listing | Kind | DE status | Stage | Price | Folder | Found by |', '|---|---|---|---|---|---|---|');
    r.live.forEach(x => L.push('| ' + x.street + (x.unit ? ' ' + x.unit : '') + ', ' + x.state + ' | ' + x.kind + ' | ' + x.status + ' | ' + x.stage +
      ' | ' + money(x.price) + (x.priceChangePercent < 0 ? ' (' + x.priceChangePercent.toFixed(1) + '%)' : '') + ' | ' + (x.folder || '**no folder found**') + ' | ' + (x.via || '') + ' |'));
    L.push('');
  }
  if (r.lnk && r.lnk.length) {
    L.push('## Shortcuts in ACTIVE LISTINGS & DEALS (' + r.lnk.length + ')', '', '| Shortcut | Points to | On DE |', '|---|---|---|');
    r.lnk.forEach(x => L.push('| ' + x.name + ' | ' + (x.target || '**target missing**') + ' | ' + (x.onDE ? x.deStage : 'no') + ' |'));
    L.push('');
  }
  if (r.stageMoves && r.stageMoves.length) { L.push('## Stage moves since the last report', ''); r.stageMoves.forEach(m => L.push('- ' + m.id + ': ' + m.from + ' → ' + m.to)); L.push(''); }
  if (r.missing && r.missing.length) L.push('Missing since the last report (stage kept): ' + r.missing.join(', '), '');
  if (r.courtesy) {
    L.push('## Listing Courtesy check', '', '| DE id | GVC-listed | Line |', '|---|---|---|');
    r.courtesy.forEach(c => L.push('| ' + c.id + ' | ' + (c.gvcListed ? 'yes (' + c.agent + ')' : 'no') + ' | ' + (c.line || 'not found') + ' |'));
    L.push('');
  }
  fs.writeFileSync(base + '.md', L.join('\n'));
}

/* ---------- courtesy for a few ids (B5) ---------- */

async function courtesyFor(ids, opts) {
  const { chromium } = require('playwright');
  const { checkCourtesy } = require('./de/courtesy.js');
  const { rosterNames } = require('./roster.js');
  const cfg = require('./config.js').loadConfig();
  const feeds = opts && opts.fixturesDir ? fromFixtures(opts.fixturesDir) : null;
  const rows = [];
  if (feeds) Object.keys(FEEDS).forEach(n => feeds[n].rows.forEach(raw => rows.push(normalize(raw, n))));
  const cacheFile = path.join(cfg.home, 'courtesy.json');
  const cache = new Map(fs.existsSync(cacheFile) ? Object.entries(JSON.parse(fs.readFileSync(cacheFile, 'utf8'))) : []);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = [];
  try {
    for (const id of ids) {
      const row = rows.find(r => r.id === id);
      if (!row) { out.push({ id, gvcListed: false, line: 'not in the recording' }); continue; }
      out.push(Object.assign({ id }, await checkCourtesy(page, row, cache, rosterNames())));
      await new Promise(r => setTimeout(r, 3000));
    }
  } finally { await browser.close(); }
  fs.writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(cache), null, 2));
  return out;
}

/* ---------- the real sync (Slice 1): read, check, then write ---------- */

/* Same reading and checks as the dry run, then helper/de/apply.js writes the
   result. A run the checks abort writes only its sync_runs row. The GVC-listed
   check opens a listing page only for a DE listing it has never seen. */
/* One sync at a time: "Sync now" during the 7:00 run joins the run in progress. */
let running = null;
function syncNow(opts) {
  if (!running) running = syncOnce(opts).finally(() => { running = null; });
  return running;
}

async function syncOnce(opts) {
  opts = opts || {};
  const cfg = opts.cfg || require('./config.js').loadConfig();
  if (opts.fixturesDir && !opts.client) throw new Error('Refusing to write made-up listings (fixtures) into the real database.');
  const client = opts.client || require('./supabase.js').createClient(cfg);
  if (!client.ready()) throw new Error('No helper account yet: add helperEmail and helperPassword to the helper\'s config.');
  const report = await dryRun(opts);
  let browser = null, page = null;
  const names = opts.courtesy ? null : require('./roster.js').rosterNames();
  const courtesy = opts.courtesy || (async row => {
    if (!page) {
      const { chromium } = require('playwright');
      browser = await chromium.launch(); page = await browser.newPage();
    }
    const r = await require('./de/courtesy.js').checkCourtesy(page, row, new Map(), names);
    await new Promise(res => setTimeout(res, 3000));
    return r;
  });
  try {
    return Object.assign(await require('./de/apply.js').applyRun({ client, report, rows: report.rows || [], courtesy,
      helperVersion: require('./package.json').version }), { report });
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { dryRun, syncNow, courtesyFor, writeReport, addressFolderMatch };

if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i === -1 ? null : a[i + 1]; };
  const fixturesDir = arg('--fixtures');
  if (a.includes('--courtesy')) {
    courtesyFor(arg('--courtesy').split(','), { fixturesDir }).then(r => { console.log(JSON.stringify(r, null, 2)); });
  } else if (a.includes('--write')) {
    syncNow({ fixturesDir }).then(r => {
      console.log(r.report.ok ? 'Sync done: ' + r.changes + ' change(s), ' + r.created + ' new job(s), ' + r.errors.length + ' skipped.'
        : 'Sync ABORTED (nothing changed): ' + r.report.aborted);
      process.exit(r.report.ok ? 0 : 1);
    }, e => { console.log('Sync failed: ' + e.message); process.exit(1); });
  } else if (a.includes('--dry-run')) {
    dryRun({ fixturesDir, record: a.includes('--record') }).then(r => {
      console.log(r.ok ? 'Dry run OK: ' + r.live.length + ' live, ' + r.live.filter(x => x.folder).length + ' matched to a folder. Report: ' + r.reportFile
        : 'Dry run ABORTED: ' + r.aborted);
      process.exit(r.ok ? 0 : 1);
    });
  } else {
    console.log('Usage: node helper/de-sync.js --dry-run [--record] [--fixtures <dir>]  |  --courtesy <id,id> --fixtures <dir>');
  }
}
