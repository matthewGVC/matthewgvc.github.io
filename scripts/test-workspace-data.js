/* ============================================================
   Tests for assets/js/workspace-data.js: database rows → the jobs, numbers,
   tasks and sync status the /workspace/ pages draw. Made-up rows only.

   Plain Node:  node scripts/test-workspace-data.js
   ============================================================ */
'use strict';

const W = require('../assets/js/workspace-data.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const TODAY = '2026-10-20';
const props = [
  { id: 'p1', slug: '100-example-st-residence-4a', label: '100 EXAMPLE ST, Residence 4A', kind: 'sale', market: 'NYC', stage: 'In contract', stage_source: 'DE',
    core: { address: '100 EXAMPLE ST', unit: '4A', neighborhood: 'Carnegie Hill', price: 4500000, beds: 4, baths: 4 }, de: { status: 'ActiveUnderContract', price: 4500000, beds: 4, baths: 4 },
    de_listing_id: '9001', drive_folder: 'GVC - New York/Building Information/100 Example St/4A', folder_state: 'linked',
    scan: { weeks: { '2026-09-07': 58, '2026-09-14': 9 }, found: { floorplan: '2026-09-15', showsheet: '2026-09-14' } } },
  { id: 'p2', slug: '20-sample-ave-7b', label: '20 Sample Ave, 7B', kind: 'rental', market: 'NYC', stage: 'Live', stage_source: 'DE',
    core: { address: '20 Sample Ave', unit: '7B', price: 5000 }, de_listing_id: '9002', drive_folder: null, folder_state: 'unlinked' },
  { id: 'p3', slug: '12-sample-lane', label: '12 Sample Lane', kind: 'sale', market: 'NJ', stage: 'Live', stage_source: 'seed',
    core: { address: '12 Sample Lane' }, de_listing_id: null, drive_folder: 'GVC - New Jersey/x', folder_state: 'broken' },
  { id: 'p4', slug: 'old', label: 'Old', kind: 'sale', market: 'NYC', stage: 'Sold', stage_source: 'DE', core: { address: '1 Old St' }, de_listing_id: '9004', folder_state: 'linked', drive_folder: 'x' },
  { id: 'p5', slug: 'gone', label: 'Gone', kind: 'sale', market: 'NYC', stage: 'Archived', core: { address: '2 Gone St' }, folder_state: 'linked', drive_folder: 'y' },
  { id: 'p6', slug: 'library-only', label: '123 Street', kind: 'sale', stage: null, core: { address: '123 Street' }, folder_state: 'unlinked' }
];
const pitches = [{ id: 'q1', slug: '90-pitch-st-11b-2026-08-04', label: '90 Pitch St 11B', market: 'NYC', pitched_on: '2026-08-04', outcome: 'open', folder_state: 'linked', drive_folder: 'z' },
  { id: 'q2', slug: 'won-pitch', label: '100 Example St 4A', market: 'NYC', pitched_on: '2026-06-08', outcome: 'won', won_property_id: 'p1', folder_state: 'linked', drive_folder: 'w' }];
const devs = [{ id: 'd1', slug: '619-example-ave', label: '619 Example Ave', market: 'NJ', milestones: { Renders: { done: true, on: '2026-05-21' }, Architecturals: { done: true } }, folder_state: 'linked', drive_folder: 'v' }];
const changes = [
  { id: 'c1', property_id: 'p1', at: '2026-06-08T12:00:00Z', field: 'stage', new_value: 'Won', source: 'seed' },
  { id: 'c2', property_id: 'p1', at: '2026-09-17T12:00:00Z', field: 'stage', old_value: 'Won', new_value: 'Live', source: 'DE' },
  { id: 'c3', property_id: 'p1', at: '2026-10-12T07:00:00Z', field: 'stage', old_value: 'Live', new_value: 'In contract', source: 'DE' },
  { id: 'c4', property_id: 'p1', at: '2026-10-13T07:00:00Z', field: 'price', old_value: 4750000, new_value: 4500000, note: 'Price reduced 5.3% on DE', source: 'DE' },
  { id: 'c5', pitch_id: 'q1', at: '2026-08-04T12:00:00Z', note: 'Pitched', source: 'seed' }
];

const jobs = W.buildJobs({ properties: props, pitches, devProjects: devs, changes }, TODAY);
const J = id => jobs.find(j => j.id === id) || {};

/* ---------- which jobs ---------- */
check('library rows without a stage stay off', jobs.some(j => j.id === 'p6'), false);
check('archived hidden by default', jobs.some(j => j.id === 'p5'), false);
check('archived on request', W.buildJobs({ properties: props, pitches, devProjects: devs, changes }, TODAY, { archived: true }).some(j => j.id === 'p5'), true);
check('won pitch folds into its listing', jobs.some(j => j.id === 'q2'), false);
check('types', ['p1', 'p2', 'q1', 'd1'].map(id => J(id).type), ['listing', 'rental', 'pitch', 'development']);

/* ---------- what a row shows ---------- */
check('name: DE capitals made readable', J('p1').name, '100 Example St 4A');
check('href per job', [J('p1').href, J('q1').href, J('d1').href], ['job/?listing=100-example-st-residence-4a', 'job/?pitch=90-pitch-st-11b-2026-08-04', 'job/?dev=619-example-ave']);
check('price and rooms from DE', [J('p1').price, J('p1').rooms], ['$4,500,000', '4 bd · 4 ba']);
check('rental price per month', J('p2').price, '$5,000/mo');
check('chip', [J('p1').chip, J('p2').chip, J('p4').chip, J('q1').chip], ['contract', 'live', 'sold', 'pre']);
check('stage dates from the change log', J('p1').done, { Won: '2026-06-08', Floorplan: '2026-09-15', Showsheet: '2026-09-14', Live: '2026-09-17', 'In contract': '2026-10-12' });
check('pitch dates fold in', J('p1').done.Pitch, undefined);
check('pitched date shown on the listing', J('p1').pitchedOn, '2026-06-08');
check('step index', [J('p1').stageIdx, J('q1').stageIdx], [7, 0]);
check('development milestones', [J('d1').steps.length, J('d1').stageIdx, J('d1').stage], [10, 2, 'Renders']);
check('last activity', J('p1').last, '2026-10-13');
check('activity from the scan', J('p1').activity, { '2026-09-07': 58, '2026-09-14': 9 });
check('status bars for the timeline', J('p1').bars.map(b => [b.s, b.from, b.to]),
  [['pitch', '2026-06-08', '2026-06-08'], ['won', '2026-06-08', '2026-09-17'], ['live', '2026-09-17', '2026-10-12'], ['contract', '2026-10-12', null]]);
check('ticks for pieces found', J('p1').ticks.map(t => t.label), ['Showsheet', 'Floorplan']);

check('DE status in DE words', [W.deLabel('Active'), W.deLabel('ActiveUnderContract'), W.deLabel('Pending'), W.deLabel(null)], ['Active', 'Contract signed', 'Pending', '']);
/* ---------- flags and tasks ---------- */
check('flags', [J('p1').flags, J('p2').flags.map(f => f.t), J('p3').flags.map(f => f.t)], [[], ['Link folder'], ['Relink folder', 'Match DE']]);
const tasks = W.taskFlags(jobs);
check('tasks', tasks.map(t => t.job + ': ' + t.text), [
  '20 Sample Ave 7B: Link the Drive folder',
  '12 Sample Lane: Relink the folder (moved or renamed)',
  '12 Sample Lane: Match to a DE listing',
  '1 Old St: Sold on DE. Archive the job?'
]);
check('no won-or-lost task for pitches (D32)', tasks.some(t => /won or lost/i.test(t.text)), false);

/* ---------- numbers and recent changes ---------- */
check('stats', W.overviewStats(jobs), { live: 2, contract: 1, toLink: 2, total: 6 });
check('recent', W.recentChanges(changes, jobs, 2).map(r => [r.job, r.title, r.when]), [
  ['100 Example St 4A', 'Price $4,750,000 → $4,500,000', '2026-10-13'], ['100 Example St 4A', 'Stage moved to In contract', '2026-10-12']]);

/* ---------- DE sync status (spec §2.9) ---------- */
const now = new Date('2026-10-20T10:00:00Z');
check('never synced', W.syncHealth(null, now).state, 'never');
check('fresh', W.syncHealth({ started_at: '2026-10-20T07:00:00Z', ok: true }, now).state, 'ok');
check('over 36 h', W.syncHealth({ started_at: '2026-10-18T21:00:00Z', ok: true }, now).state, 'amber');
const red = W.syncHealth({ started_at: '2026-10-20T07:00:00Z', ok: false, errors: [{ what: 'aborted', detail: 'DE used a status the workspace doesn\'t know: "Withdrawn".' }] }, now);
check('failed run in plain words', [red.state, /Withdrawn/.test(red.why)], ['red', true]);

/* ---------- empty database ---------- */
const none = W.buildJobs({ properties: [], pitches: [], devProjects: [], changes: [] }, TODAY);
check('empty: no jobs, sane numbers', [none.length, W.overviewStats(none)], [0, { live: 0, contract: 0, toLink: 0, total: 0 }]);

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
