/* ============================================================
   Tests for the DE sync's rules (helper/de/*, helper/de-sync.js):
   the status map, the safety checks that stop a bad run from writing
   anything, and the dry-run report.

   Runs on the made-up fixtures in helper/fixtures/synthetic/, and also
   on a real recording when one is present on this PC
   (helper/fixtures/recorded/<date>/, gitignored).

   Plain Node:  node scripts/test-de-sync.js
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path');
const { mapStage } = require('../helper/de/status.js');
const { checkTotals, checkDrop, diffRuns } = require('../helper/de/checks.js');
const { parseCourtesy } = require('../helper/de/courtesy.js');
const { rosterNames } = require('../helper/roster.js');
const { dryRun } = require('../helper/de-sync.js');

const SYN = path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}
function throwsName(fn) { try { fn(); return null; } catch (e) { return e.name; } }
function row(id, status, feed, extra) {
  return Object.assign({ id, status, feed: feed || 'featured', kind: 'sale', street: '1 Test St', unit: '1A', priceChangePercent: 0 }, extra);
}
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-de-')); }
/* a copy of the synthetic fixtures with one page edited */
function copyWith(file, edit) {
  const dir = tmp();
  fs.readdirSync(SYN).filter(f => f.endsWith('.json')).forEach(f => fs.copyFileSync(path.join(SYN, f), path.join(dir, f)));
  const p = path.join(dir, file), json = JSON.parse(fs.readFileSync(p, 'utf8'));
  edit(json);
  fs.writeFileSync(p, JSON.stringify(json));
  return dir;
}

(async () => {
  /* ---------- status map ---------- */
  check('Active', mapStage(row('a', 'Active')), 'Live');
  check('Under contract', mapStage(row('a', 'ActiveUnderContract')), 'In contract');
  check('Pending', mapStage(row('a', 'Pending')), 'In contract');
  check('sold', mapStage(row('a', 'Sold', 'transactions')), 'Sold');
  check('rented', mapStage(row('a', 'Rented', 'transactions', { kind: 'rental' })), 'Rented');
  check('rental live', mapStage(row('a', 'Active', 'featured', { kind: 'rental' })), 'Live');
  check('unknown', throwsName(() => mapStage(row('a', 'Withdrawn'))), 'UnknownStatusError');

  /* ---------- safety checks ---------- */
  check('totals ok', throwsName(() => checkTotals('featured-sale', 3, 3)), null);
  check('totals short', throwsName(() => checkTotals('featured-sale', 51, 50)), 'Error');
  check('drop 30%', throwsName(() => checkDrop(7, 10)), 'Error');
  check('drop 20%', throwsName(() => checkDrop(8, 10)), null);
  check('first run', throwsName(() => checkDrop(3, null)), null);

  let d = diffRuns([row('A', 'Active'), row('B', 'Active')], [row('A', 'ActiveUnderContract')]);
  check('stage move', d.stageMoves, [{ id: 'A', from: 'Live', to: 'In contract' }]);
  check('missing kept', d.missing, ['B']);
  check('price reduced', diffRuns(null, [row('C', 'Active', 'featured', { priceChangePercent: -5 })]).priceReduced, [{ id: 'C', percent: -5 }]);

  /* ---------- dry run on made-up fixtures ---------- */
  let out = tmp();
  let r = await dryRun({ fixturesDir: SYN, outDir: out, lnks: [], drive: false });
  check('report ok', r.ok, true);
  check('report totals', r.totals, { 'featured-sale': 4, 'featured-rental': 1, 'transactions-sale': 1, 'transactions-rental': 1 });
  check('report statuses', r.statusesSeen, ['Active', 'ActiveUnderContract', 'Pending', 'Rented', 'Sold']);
  check('report live count', r.live.length, 5);
  check('no-unit row', (r.live.find(x => x.unit === '') || {}).street, '12 Sample Lane');
  check('report files', fs.readdirSync(out).filter(f => /^de-dry-run-/.test(f)).map(f => path.extname(f)).sort(), ['.json', '.md']);

  r = await dryRun({ fixturesDir: copyWith('featured-sale-p2.json', j => { j.data.pop(); }), outDir: tmp(), lnks: [], drive: false });
  check('page missing aborts', [r.ok, /featured-sale/.test(r.aborted || '')], [false, true]);

  r = await dryRun({ fixturesDir: copyWith('featured-sale-p1.json', j => { j.data[0].listingStatus = 'Withdrawn'; }), outDir: tmp(), lnks: [], drive: false });
  check('unknown aborts', [r.ok, /Withdrawn/.test(r.aborted || '')], [false, true]);

  r = await dryRun({ fixturesDir: SYN, outDir: tmp(), drive: false, lnks: [{ name: '100 Example - 4A.lnk', target: null }] });
  check('broken lnk listed', [r.ok, r.lnk.length, r.lnk[0].target], [true, 1, null]);

  r = await dryRun({ fixturesDir: SYN, outDir: tmp(), drive: false,
    lnks: [{ name: '100 Example - 4A.lnk', target: 'G:\\Shared drives\\GVC - New York\\Building Information\\100 Example St\\4A' }] });
  check('lnk matches live row', [r.live.find(x => x.unit === '4A').folder, r.live.find(x => x.unit === '4A').via],
    ['GVC - New York/Building Information/100 Example St/4A', 'lnk']);
  check('lnk on DE', [r.lnk[0].onDE, r.lnk[0].deStage], [true, 'Live']);

  /* a shortcut into a per-sale subfolder ("7B\2026 - Sale") still matches its unit; the job folder is the subfolder */
  r = await dryRun({ fixturesDir: SYN, outDir: tmp(), drive: false,
    lnks: [{ name: '20 Sample - 7B.lnk', target: 'G:\\Shared drives\\GVC - New York\\Building Information\\20 Sample Ave\\7B\\2026 - Sale' }] });
  check('deep lnk', r.live.find(x => x.unit === '7B').folder, 'GVC - New York/Building Information/20 Sample Ave/7B/2026 - Sale');

  /* the live count dropping by more than a quarter against the last report aborts */
  out = tmp();
  await dryRun({ fixturesDir: SYN, outDir: out, lnks: [], drive: false, asSource: 'DE' });
  const fewer = copyWith('featured-sale-p2.json', j => { j.data = []; });
  fs.writeFileSync(path.join(fewer, 'featured-sale-p1.json'), JSON.stringify({ data: [], totalCount: 0 }));
  fs.unlinkSync(path.join(fewer, 'featured-sale-p2.json'));
  r = await dryRun({ fixturesDir: fewer, outDir: out, lnks: [], drive: false, date: '2099-01-01', asSource: 'DE' });
  check('drop aborts', [r.ok, /live/i.test(r.aborted || '')], [false, true]);

  /* ---------- review fixes (2026-10-19) ---------- */
  const { addressFolderMatch } = require('../helper/de-sync.js');
  check('house folder exact', addressFolderMatch('12 OAK ST', '', ['12 Oak Hill Rd', '12 Oak St, Rumson NJ']), '12 Oak St, Rumson NJ');
  check('town after the full street', addressFolderMatch('84 Diane Dr', '', ['84 Diane Dr. Tinton Falls']), '84 Diane Dr. Tinton Falls');
  check('town needs the street type', addressFolderMatch('12 OAK', '', ['12 Oak Hill Rd']), null);
  check('no prefix match',addressFolderMatch('12 OAK ST', '', ['12 Oak Hill Rd']), null);
  check('no type swap', addressFolderMatch('1 MAIN ST', '', ['1 Main Avenue']), null);
  check('unit in folder name', addressFolderMatch('1006 Pheasant Ln', '204', ['1006 Pheasant Ln #204']), '1006 Pheasant Ln #204');
  check('other unit refused', addressFolderMatch('100 MAIN ST', '2B', ['100 Main St #3C']), null);
  check('other unit after " - " refused', addressFolderMatch('100 MAIN ST', '2B', ['100 Main St - 3C']), null);
  check('building folder for a unit', addressFolderMatch('1006 Pheasant Ln', '204', ['1006 Pheasant Ln']), '1006 Pheasant Ln');

  r = await dryRun({ fixturesDir: copyWith('featured-sale-p2.json', j => {
    j.data = JSON.parse(fs.readFileSync(path.join(SYN, 'featured-sale-p1.json'), 'utf8')).data; }), outDir: tmp(), lnks: [], drive: false });
  check('duplicate page aborts', [r.ok, /twice|duplicate/i.test(r.aborted || '')], [false, true]);

  r = await dryRun({ fixturesDir: SYN, outDir: tmp(), driveRoot: path.join(tmp(), 'no-such-drive') });
  check('unmounted Drive aborts', [r.ok, /Drive/.test(r.aborted || '')], [false, true]);

  out = tmp();
  fs.writeFileSync(path.join(out, 'de-dry-run-2026-01-01.json'), JSON.stringify({ ok: true, source: 'DE', date: '2026-01-01',
    live: [{ id: '900006', status: 'Active', stage: 'Live', priceChangePercent: 0 }] }));
  r = await dryRun({ fixturesDir: SYN, outDir: out, lnks: [], drive: false, date: '2026-01-02', asSource: 'DE' });
  check('live then sold is a move', r.stageMoves, [{ id: '900006', from: 'Live', to: 'Sold' }]);
  check('sold is not missing', r.missing, []);

  const realReports = path.join(__dirname, '..', 'exports');
  const before = fs.existsSync(realReports) ? fs.readdirSync(realReports).filter(f => /^de-dry-run-/.test(f)).length : 0;
  r = await dryRun({ fixturesDir: SYN, lnks: [], drive: false });
  const after = fs.existsSync(realReports) ? fs.readdirSync(realReports).filter(f => /^de-dry-run-/.test(f)).length : 0;
  check('fixture runs stay out of exports/', [r.ok, after - before], [true, 0]);
  out = tmp();
  fs.writeFileSync(path.join(out, 'de-dry-run-2026-01-01.json'), JSON.stringify({ ok: true, source: 'fixtures', date: '2026-01-01',
    live: Array.from({ length: 40 }, (_, i) => ({ id: 'x' + i, status: 'Active', stage: 'Live' })) }));
  r = await dryRun({ fixturesDir: SYN, outDir: out, lnks: [], drive: false, date: '2026-01-02', asSource: 'DE' });
  check('fixture report never the baseline', r.ok, true);

  /* ---------- courtesy line ---------- */
  const NAMES = rosterNames();
  check('roster loads', NAMES.includes('Elyse Gutman'), true);
  /* Page text shapes seen 2026-10-19: DE's own listing has an agent block
     ("GET IN TOUCH WITH OUR AGENTS … CONNECT"); another brokerage's listing
     has "Listing Courtesy of <brokerage>" instead. Lines after "CONNECT NOW" /
     "SIMILAR LISTINGS" belong to other listings and are ignored. */
  /* made-up text in the shape of the real pages (no real listing, broker or number) */
  const OWN = 'SOLD GET IN TOUCH WITH OUR AGENTS John Gasdaska 555-0100 Licensed Associate Real Estate Broker LIC: 1 CONNECT ' +
    'Elyse Gutman 555-0101 Licensed Associate Real Estate Broker LIC: 2 CONNECT DETAILS Co-Op MLS/Listing ID 99990001 Sample House ' +
    'CONNECT NOW SIMILAR LISTINGS $1,000,000 Listing Courtesy of EXAMPLE REALTY GROUP., PAT SAMPLE - 555-0102';
  check('DE own listing, GVC agents', parseCourtesy(OWN, NAMES),
    { gvcListed: true, line: 'Douglas Elliman: John Gasdaska, Elyse Gutman', agent: 'John Gasdaska', mlsId: '99990001' });
  const OTHER = 'SOLD 12 Sample Lane MLS/Listing ID 99990002 Listing Courtesy of EXAMPLE HOMES REALTY., ALEX TEST - 555-0103 CONNECT NOW';
  check('other brokerage', parseCourtesy(OTHER, NAMES),
    { gvcListed: false, line: 'Listing Courtesy of EXAMPLE HOMES REALTY., ALEX TEST', agent: null, mlsId: '99990002' });
  check('DE listing, not a GVC agent', parseCourtesy('GET IN TOUCH WITH OUR AGENTS Someone Else 212 Licensed Salesperson CONNECT CONNECT NOW', NAMES).gvcListed, false);
  check('similar listing ignored', parseCourtesy('Nothing about the agents here CONNECT NOW Listing Courtesy of DOUGLAS ELLIMAN., Elyse Gutman', NAMES).gvcListed, false);
  check('no markers', parseCourtesy('nothing here', NAMES), { gvcListed: false, line: null, agent: null, mlsId: null });

  /* ---------- the real recording, when this PC has one ---------- */
  const recRoot = path.join(__dirname, '..', 'helper', 'fixtures', 'recorded');
  const recs = fs.existsSync(recRoot) ? fs.readdirSync(recRoot).sort() : [];
  if (recs.length) {
    r = await dryRun({ fixturesDir: path.join(recRoot, recs[recs.length - 1]), outDir: tmp(), lnks: [], drive: false });
    check('recording replays (' + recs[recs.length - 1] + ')', [r.ok, r.aborted || null], [true, null]);
  }

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed' + (recs.length ? ' (incl. real recording)' : ' (no real recording on this PC)'));
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
