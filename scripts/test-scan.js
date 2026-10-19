/* ============================================================
   Tests for the nightly folder scan (helper/scan.js) and the helper's
   schedule (helper/schedule.js). The scan runs on a made-up folder tree in
   a temp folder, never on Drive.

   Plain Node:  node scripts/test-scan.js
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path');
const { scanFolder, mondayOf, folderStage, scanAll } = require('../helper/scan.js');
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

  check('monday of', mondayOf(new Date('2026-09-10T12:00:00Z')), '2026-09-07');
  const s = scanFolder(job, { since: '2026-08-01' });
  check('weekly counts', s.weeks, { '2026-09-07': 4, '2026-09-14': 3 });
  check('pieces found', s.found, { floorplan: '2026-09-15', showsheet: '2026-09-14', photos: '2026-09-12' });
  check('not missing', s.missing, false);
  check('no file names kept', JSON.stringify(s).includes('.jpg') || JSON.stringify(s).includes('offer'), false);
  check('missing folder', scanFolder(path.join(job, 'nope'), {}).missing, true);

  check('folder stage: latest piece', folderStage({ floorplan: '2026-09-15', showsheet: '2026-09-14' }), 'Showsheet');
  check('folder stage: brochure', folderStage({ brochure: '2026-01-01', photos: '2026-01-01' }), 'Brochure');
  check('folder stage: nothing', folderStage({}), null);

  /* ---------- scanAll writes the scan, breaks missing links, moves early stages ---------- */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-drive-'));
  fs.mkdirSync(path.join(root, 'NY', 'A'), { recursive: true });
  file(root, 'NY/A/Floorplan/v1.pdf', '2026-10-01');
  file(root, 'NY/B/ShowSheet/s.pdf', '2026-10-02');
  const T = {
    properties: [
      { id: 'a', slug: 'a', version: 1, stage: 'Won', stage_source: 'seed', drive_folder: 'NY/A', folder_state: 'linked' },
      { id: 'b', slug: 'b', version: 1, stage: 'Live', stage_source: 'DE', drive_folder: 'NY/B', folder_state: 'linked' },
      { id: 'c', slug: 'c', version: 1, stage: 'Won', stage_source: 'Matt', drive_folder: 'NY/GONE', folder_state: 'linked' },
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
  check('early stage moved by the folder', [T.properties[0].stage, T.properties[0].stage_source], ['Floorplan', 'folder']);
  check('DE stage untouched', T.properties[1].stage, 'Live');
  check('gone folder marked broken', T.properties[2].folder_state, 'broken');
  check('broken link logged', T.changes.some(c => c.property_id === 'c' && c.field === 'folder_state' && c.source === 'folder'), true);
  check('stage move logged', T.changes.some(c => c.property_id === 'a' && c.field === 'stage' && c.new_value === 'Floorplan'), true);
  check('run logged', [T.sync_runs[0].kind, T.sync_runs[0].ok], ['scan', true]);

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

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
