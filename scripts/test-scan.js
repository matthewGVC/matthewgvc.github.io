/* ============================================================
   Tests for the nightly folder scan (helper/scan.js) and the helper's
   schedule (helper/schedule.js). The scan runs on a made-up folder tree in
   a temp folder, never on Drive.

   Plain Node:  node scripts/test-scan.js
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path');
const { scanFolder, mondayOf, scanAll, treeOf } = require('../helper/scan.js');
const { due } = require('../helper/schedule.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

function file(root, rel, date) {
  const p = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'x');
  const t = new Date(date + 'T12:00:00Z');
  fs.utimesSync(p, t, t);
}

(async () => {
  /* ---------- one job folder ---------- */
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-scan-'));
  file(job, 'Photos/raws/a.jpg', '2026-09-08');
  file(job, 'Photos/raws/b.jpg', '2026-09-09');
  file(job, 'Photos/edits/a.jpg', '2026-09-12');
  file(job, 'ShowSheet/Showsheet - x.pdf', '2026-09-14');
  file(job, 'Floorplan/v1.pdf', '2026-09-15');
  file(job, 'Floor Plans/old.png', '2026-09-16');
  file(job, 'Offers/offer 1.pdf', '2026-09-20');            // paperwork folder: never counted
  file(job, 'Exclusive signed.pdf', '2026-09-20');          // loose paperwork: never counted
  file(job, 'showsheet details.docx', '2026-09-07');
  file(job, 'Old asset.png', '2020-01-01');                 // before the job: ignored
  file(job, 'Photos/edits/a.jpg.xmp', '2026-09-12');        // sidecars and system files: never counted (tune-up 3)
  file(job, 'Photos/edits/Thumbs.db', '2026-09-12');
  file(job, 'ShowSheet/~$draft.docx', '2026-09-14');
  file(job, 'Photos/edits/._a.jpg', '2026-09-12');

  check('monday of', mondayOf(new Date('2026-09-10T12:00:00Z')), '2026-09-07');
  const s = scanFolder(job, { since: '2026-08-01' });
  check('weekly counts', s.weeks, { '2026-09-07': 4, '2026-09-14': 3 });
  check('pieces found', s.found, { floorplan: '2026-09-15', showsheet: '2026-09-14', photos: '2026-09-12' });
  check('not missing', s.missing, false);
  check('no file names kept', JSON.stringify(s).includes('.jpg') || JSON.stringify(s).includes('offer'), false);
  check('missing folder', scanFolder(path.join(job, 'nope'), {}).missing, true);


  /* ---------- scanAll writes the scan and breaks missing links; the stage is Asana's (D50, S8) ---------- */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-drive-'));
  fs.mkdirSync(path.join(root, 'NY', 'A'), { recursive: true });
  file(root, 'NY/A/Floorplan/v1.pdf', '2026-10-01');
  file(root, 'NY/B/ShowSheet/s.pdf', '2026-10-02');
  const T = {
    properties: [
      { id: 'a', slug: 'a', version: 1, stage: 'Prep', stage_source: 'Asana', drive_folder: 'NY/A', folder_state: 'linked' },
      { id: 'b', slug: 'b', version: 1, stage: 'Live', stage_source: 'DE', drive_folder: 'NY/B', folder_state: 'linked' },
      { id: 'c', slug: 'c', version: 1, stage: 'Prep', stage_source: 'Matt', drive_folder: 'NY/GONE', folder_state: 'linked' },
      { id: 'd', slug: 'd', version: 1, stage: null, drive_folder: null, folder_state: 'unlinked' }
    ],
    pitches: [], changes: [], sync_runs: []
  };
  const db = {
    ready: () => true,
    select: async t => JSON.parse(JSON.stringify(T[t])),
    insert: async (t, rows) => [].concat(rows).map((r, i) => { const x = Object.assign({ id: t + T[t].length + i }, r); T[t].push(x); return x; }),
    update: async (t, m, patch) => { const r = T[t].find(x => x.id === m.id); Object.assign(r, patch); return [r]; }
  };
  const out = await scanAll({ client: db, driveRoot: root, now: new Date('2026-10-20T02:00:00Z') });
  check('scanned the linked ones', out.scanned, 3);
  check('scan stored', Object.keys(T.properties[0].scan.weeks), ['2026-09-28']);
  check('the folder never moves the stage', [T.properties[0].stage, T.properties[0].stage_source, 'folderStage' in require('../helper/scan.js')], ['Prep', 'Asana', false]);
  check('pieces found are kept in the scan', T.properties[0].scan.found, { floorplan: '2026-10-01' });
  check('DE stage untouched', T.properties[1].stage, 'Live');
  check('gone folder marked broken', T.properties[2].folder_state, 'broken');
  check('broken link logged', T.changes.some(c => c.property_id === 'c' && c.field === 'folder_state' && c.source === 'folder'), true);
  check('no stage change logged', T.changes.some(c => c.field === 'stage'), false);
  check('run logged', [T.sync_runs[0].kind, T.sync_runs[0].ok], ['scan', true]);

  /* Drive not mounted at 2:00: nothing is marked broken, the run says why */
  T.properties.forEach(p => { if (p.folder_state === 'broken') p.folder_state = 'linked'; });
  const before = T.changes.length;
  const gone = await scanAll({ client: db, driveRoot: path.join(root, 'not-mounted'), now: new Date('2026-10-21T02:00:00Z') });
  check('unmounted Drive: nothing broken', [T.properties.filter(p => p.folder_state === 'broken').length, T.changes.length - before], [0, 0]);
  check('unmounted Drive: run fails with the reason', [gone.aborted ? true : false, T.sync_runs[T.sync_runs.length - 1].ok], [true, false]);

  /* ---------- deepen M18: a job with no linked folder gets the folder the Link suggestions would offer ---------- */
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-drive2-'));
  const NYB = 'GVC - New York/Building Information';
  file(root2, NYB + '/100 Example St/4A/Photos/a.jpg', '2026-10-01');
  fs.mkdirSync(path.join(root2, ...(NYB + '/100 Example St/5B').split('/')), { recursive: true });
  fs.mkdirSync(path.join(root2, ...'GVC - New Jersey/1. Residential Sales/1. Resale/Wall Township/40 Chapel Lane'.split('/')), { recursive: true });
  fs.mkdirSync(path.join(root2, ...'GVC - New Jersey/New Development/610 Agnes Ave'.split('/')), { recursive: true });
  const tree = dir => { const out = []; (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name);
    out.push(p + (e.isDirectory() ? '/' : ':' + fs.statSync(p).mtimeMs)); if (e.isDirectory()) walk(p); }); })(dir); return out.sort(); };
  const before2 = tree(root2);
  const T2 = {
    properties: [
      { id: 'n1', slug: 'n1', version: 1, stage: 'Live', market: 'NYC', core: { address: '100 Example St', unit: '4A' }, drive_folder: null, folder_state: 'unlinked' },
      { id: 'n2', slug: 'n2', version: 1, stage: 'Live', market: 'NYC', core: { address: '100 Example St', unit: '9Z' }, drive_folder: null, folder_state: 'unlinked' },
      { id: 'j1', slug: 'j1', version: 1, stage: 'In contract', market: 'NJ', core: { address: '40 Chapel Ln', city: 'Wall' }, drive_folder: null, folder_state: 'unlinked' },
      { id: 'd1', slug: 'd1', version: 1, stage: 'Prep', market: 'NJ', dev_project_id: 'dev1', core: { address: '610 Agnes Ave' }, drive_folder: null, folder_state: 'unlinked' },
      { id: 'x1', slug: 'x1', version: 1, stage: null, market: 'NYC', core: { address: '100 Example St', unit: '4A' }, drive_folder: null, folder_state: 'unlinked' },
      { id: 'o1', slug: 'o1', version: 1, stage: 'Off market', market: 'NYC', core: { address: '100 Example St', unit: '4A' }, drive_folder: null, folder_state: 'unlinked' }
    ],
    pitches: [], changes: [], sync_runs: []
  };
  let writes2 = 0;
  const db2 = {
    ready: () => true,
    select: async t => JSON.parse(JSON.stringify(T2[t])),
    insert: async (t, rows) => [].concat(rows).map((r, i) => { const x = Object.assign({ id: t + T2[t].length + i }, r); T2[t].push(x); return x; }),
    update: async (t, m, patch) => { if (t === 'properties') writes2++; const r = T2[t].find(x => x.id === m.id); Object.assign(r, patch); return [r]; }
  };
  const out2 = await scanAll({ client: db2, driveRoot: root2, now: new Date('2026-10-21T02:00:00Z') });
  const cand = id => ((T2.properties.find(p => p.id === id) || {}).scan || {}).candidate || null;
  check('M18 scan: the NYC unit folder', cand('n1'), NYB + '/100 Example St/4A');
  check('M18 scan: only the building folder (no unit folder): no candidate', cand('n2'), null);
  check('M18 scan: NJ resale by town', cand('j1'), 'GVC - New Jersey/1. Residential Sales/1. Resale/Wall Township/40 Chapel Lane');
  check('M18 scan: a development house in New Development', cand('d1'), 'GVC - New Jersey/New Development/610 Agnes Ave');
  check('M18 scan: never for a row with no stage', T2.properties.find(p => p.id === 'x1').scan, undefined);
  check('M18 scan: an Off market job is looked for too (D88: prep happens while off market)', cand('o1'), NYB + '/100 Example St/4A');
  check('M18 scan: nothing linked by itself', T2.properties.map(p => [p.drive_folder, p.folder_state]).filter(x => x[0] || x[1] !== 'unlinked'), []);
  check('M18 scan: counted, and Drive left exactly as it was', [out2.candidates, JSON.stringify(tree(root2)) === JSON.stringify(before2)], [4, true]);
  const w2 = writes2;
  await scanAll({ client: db2, driveRoot: root2, now: new Date('2026-10-22T02:00:00Z') });
  check('M18 scan: the same candidate again is not written again', writes2 - w2, 0);

  /* ---------- S15: the folder link, pieces with links, health notes; paperwork never kept ---------- */
  const root3 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-drive3-'));
  const JF = 'GVC - New York/Building Information/9 Sample Pl/2A';
  file(root3, JF + '/Floorplan/v1/plan.pdf', '2026-10-01');
  for (let i = 1; i <= 7; i++) file(root3, JF + '/Floorplan/v2/plan ' + i + '.pdf', '2026-10-0' + i);
  file(root3, JF + '/Floorplan/Archive/old plan.pdf', '2026-09-01');
  file(root3, JF + '/Photos/Edited/a.jpg', '2026-10-05');
  file(root3, JF + '/Photos/Raw/r1.cr2', '2026-10-05');
  file(root3, JF + '/Showsheet 2A.pdf', '2026-10-06');                // a piece loose at the top
  file(root3, JF + '/Details 2A.docx', '2026-10-02');
  file(root3, JF + '/Exclusive - Jane Client.pdf', '2026-10-03');     // loose paperwork
  file(root3, JF + '/Notes.txt', '2026-10-03');                       // loose, not a piece
  file(root3, JF + '/Docs/Offer from Jane Client.pdf', '2026-10-03');
  file(root3, JF + '/Marketing/Offer - Jane Client.pdf', '2026-10-03');
  file(root3, JF + '/Marketing/Brochure/Brochure.pdf', '2026-10-04');
  file(root3, JF + '/Video/GVC Video Clips.m4v', '2026-10-05');                 // a film and its sidecars (tune-up 3)
  file(root3, JF + '/Video/GVC Video Clips.m4v.xmpses.xmp', '2026-10-09');
  file(root3, JF + '/Photos/Edited/a.jpg.xmp', '2026-10-09');
  file(root3, JF + '/Photos/Edited/Thumbs.db', '2026-10-09');
  file(root3, JF + '/Thumbs.db', '2026-10-09');
  const tr = treeOf(path.join(root3, ...JF.split('/')), 4);
  check('tree: Docs is one skipped line, loose files counted', [tr.children.filter(c => c.skipped).map(c => c.name), tr.looseCount, tr.otherCount], [['Docs'], 2, 0]);
  check('tree: a piece loose at the top is named; paperwork and notes are not', tr.children.filter(c => c.kind === 'file').map(c => c.name).sort(), ['Details 2A.docx', 'Showsheet 2A.pdf']);
  check('tree: nothing from paperwork anywhere', JSON.stringify(tr).includes('Jane Client'), false);
  const raw = tr.children.find(c => c.name === 'Photos').children.find(c => c.name === 'Raw').children[0];
  check('tree: raw photos are counted by name, not statted', raw, { name: 'r1.cr2', kind: 'file' });
  /* final review 1: a paperwork folder below the top is never listed nor opened */
  file(root3, JF + '/Marketing/Docs/Seller ID.pdf', '2026-10-03');
  file(root3, JF + '/Photos/Dock photos/d1.jpg', '2026-10-03');
  const opened = [], realReaddir = fs.readdirSync;
  fs.readdirSync = function (p) { opened.push(String(p)); return realReaddir.apply(fs, arguments); };
  let tr2;
  try { tr2 = treeOf(path.join(root3, ...JF.split('/')), 4); } finally { fs.readdirSync = realReaddir; }
  const mk = tr2.children.find(c => c.name === 'Marketing');
  check('tree: Marketing/Docs is not listed', mk.children.map(c => c.name), ['Brochure']);
  check('tree: Marketing/Docs is never opened', opened.some(p => /[\\/]Docs$/.test(p)), false);
  check('tree: Seller ID never named', JSON.stringify(tr2).includes('Seller ID'), false);
  check('tree: Dock photos is a folder like any other', tr2.children.find(c => c.name === 'Photos').children.map(c => c.name), ['Dock photos', 'Edited', 'Raw']);
  const T3 = { properties: [
    { id: 'p', slug: 'p', version: 1, stage: 'Live', market: 'NYC', drive_folder: JF, folder_state: 'linked',
      scan: { candidate: 'GVC - New York/Somewhere', candidateAt: '2026-10-01T02:00:00Z', weeks: { old: 1 } } }
  ], pitches: [], changes: [], sync_runs: [] };
  const db3 = {
    ready: () => true,
    select: async t => JSON.parse(JSON.stringify(T3[t])),
    insert: async (t, rows) => [].concat(rows).map((r, i) => { const x = Object.assign({ id: t + T3[t].length + i }, r); T3[t].push(x); return x; }),
    update: async (t, m, patch) => { const r = T3[t].find(x => x.id === m.id); Object.assign(r, patch); return [r]; }
  };
  const before3 = tree(root3);
  await scanAll({ client: db3, driveRoot: root3, now: new Date('2026-10-20T02:00:00Z') });
  const sc = T3.properties[0].scan;
  check('scan: found has the same pieces and dates the old scan found', [sc.found.floorplan, sc.found.photos, sc.found.showsheet || null, sc.found.brochure || null], ['2026-09-01', '2026-10-05', null, '2026-10-04']);
  check('scan: candidate kept', [sc.candidate, sc.candidateAt], ['GVC - New York/Somewhere', '2026-10-01T02:00:00Z']);
  check('scan: weeks and scannedAt', [typeof sc.weeks, sc.scannedAt], ['object', '2026-10-20T02:00:00.000Z']);
  check('scan: no stream means no links, not an error', [sc.folderUrl, sc.pieces.floorplan.every(f => f.url === null)], [null, true]);
  check('scan: newest 5 per piece, newest first', [sc.pieces.floorplan.length, sc.pieces.floorplan[0].name], [5, 'plan 7.pdf']);
  check('scan: archived flag', sc.pieces.floorplan.filter(f => f.archived).length, 0);
  check('scan: the loose showsheet is a piece and the health says so', [sc.pieces.showsheet.map(f => f.name), sc.health.notes.some(n => n.code === 'pieceAtTop')], [['Showsheet 2A.pdf'], true]);
  check('scan: brochure under Marketing is found', (sc.pieces.brochure || []).map(f => f.name), ['Brochure.pdf']);
  check('scan: the video piece is the film, never its sidecar', (sc.pieces.video || []).map(f => f.name), ['GVC Video Clips.m4v']);
  check('scan: sidecars and system files never counted', [sc.health.counts.photos.edited, JSON.stringify(sc).includes('xmp') || JSON.stringify(sc).includes('Thumbs')], [1, false]);
  check('scan: details doc and counts', [sc.detailsDoc && sc.detailsDoc.name, sc.health.counts.looseTop, sc.health.counts.photos.raw], ['Details 2A.docx', 2, 1]);
  check('scan: no paperwork name anywhere in what is stored', JSON.stringify(T3.properties[0].scan).includes('Jane Client'), false);
  check('scan: Drive left exactly as it was', JSON.stringify(tree(root3)) === JSON.stringify(before3), true);
  if (process.platform === 'win32') {
    const ds = (p, id) => fs.writeFileSync(p + ':user.drive.id', id);
    const jabs = path.join(root3, ...JF.split('/'));
    ds(jabs, 'FOLDERID1234567');
    ds(path.join(jabs, 'Floorplan', 'v2', 'plan 7.pdf'), 'FILEID1234567');
    ds(path.join(jabs, 'Floorplan', 'v2', 'plan 6.pdf'), 'bad id');
    await scanAll({ client: db3, driveRoot: root3, now: new Date('2026-10-21T02:00:00Z') });
    const s2 = T3.properties[0].scan;
    check('scan: folder and file links from the Drive ids', [s2.folderUrl, (s2.pieces.floorplan.find(f => f.name === 'plan 7.pdf') || {}).url, (s2.pieces.floorplan.find(f => f.name === 'plan 6.pdf') || {}).url],
      ['https://drive.google.com/drive/folders/FOLDERID1234567', 'https://drive.google.com/file/d/FILEID1234567/view', null]);
  }

  /* ---------- the schedule ---------- */
  const at = s2 => new Date(s2);   // local time strings
  check('nothing ran yet: all due', due(at('2026-10-20T08:00:00'), {}).sort(), ['backup', 'de', 'scan']);
  check('after 7:00, DE ran at 7:00: none', due(at('2026-10-20T08:00:00'), {
    de: at('2026-10-20T07:00:05'), scan: at('2026-10-20T02:00:05'), backup: at('2026-10-20T02:30:05') }), []);
  check('PC was off at 7:00: DE catches up', due(at('2026-10-20T09:15:00'), {
    de: at('2026-10-19T07:00:05'), scan: at('2026-10-20T02:00:05'), backup: at('2026-10-20T02:30:05') }), ['de']);
  check('before 7:00, yesterday 7:00 counts', due(at('2026-10-20T06:00:00'), {
    de: at('2026-10-19T07:00:05'), scan: at('2026-10-20T02:00:05'), backup: at('2026-10-20T02:30:05') }), []);
  check('2:00 passed: scan due', due(at('2026-10-20T02:01:00'), {
    de: at('2026-10-19T07:00:05'), scan: at('2026-10-19T02:00:05'), backup: at('2026-10-19T02:30:05') }), ['scan']);

  /* ---------- the runner: due jobs run once, one at a time, and are remembered ---------- */
  const { createRunner } = require('../helper/runner.js');
  const ran = [];
  const runner = createRunner({
    jobs: { de: async () => { ran.push('de'); }, scan: async () => { ran.push('scan'); }, backup: async () => { throw new Error('disk full'); } },
    last: { de: at('2026-10-19T07:00:05'), scan: at('2026-10-20T02:00:05') }
  });
  await runner.tick(at('2026-10-20T08:00:00'));
  check('runner ran what was due', ran, ['de']);
  const lr = runner.lastRuns();
  check('runner remembers results', [lr.de.ok, lr.backup.ok, lr.backup.error], [true, false, 'disk full']);
  await runner.tick(at('2026-10-20T08:01:00'));
  check('nothing twice in one slot', ran, ['de']);
  const r2 = createRunner({ jobs: { de: async () => ({ report: { ok: false, aborted: 'DE used an unknown status' } }) }, last: {} });
  await r2.tick(at('2026-10-20T08:00:00'));
  check('an aborted sync shows as not ok', [r2.lastRuns().de.ok, r2.lastRuns().de.error], [false, 'DE used an unknown status']);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
