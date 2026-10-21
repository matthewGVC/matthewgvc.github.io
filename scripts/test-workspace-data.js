/* ============================================================
   Tests for assets/js/workspace-data.js: database rows → the jobs, numbers,
   tasks and sync status the /workspace/ pages draw. Made-up rows only.

   Plain Node:  node scripts/test-workspace-data.js
   ============================================================ */
'use strict';

process.env.TZ = 'America/New_York';   // dates are shown in the office's local time, not UTC
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
    de: { status: 'ActiveUnderContract', price: 4500000, beds: 4, baths: 4 },
    de_listing_id: '9001', drive_folder: 'GVC - New York/Building Information/100 Example St/4A', folder_state: 'linked',
    scan: { weeks: { '2026-09-07': 58, '2026-09-14': 9 }, found: { floorplan: '2026-09-15', showsheet: '2026-09-14' } },
    asana_gid: '1201', asana: { gid: '1201', permalink: 'https://app.asana.com/0/1/1201', checklist: [] },
    milestones: { closedOn: { on: '2026-12-15', planned: true }, listedOn: { on: '2026-09-17', planned: false }, contractOn: { on: '2026-10-12', planned: false } },
    match: { list: [
      { code: 'M3', key: 'M3', text: 'Asana says $4,750,000; DE says $4,500,000.', values: { asana: 4750000, de: 4500000 }, fixAt: 'Asana', who: ['Elyse Gutman'], since: '2026-10-13' },
      { code: 'M7', key: 'M7:drive', text: 'Asana\'s Drive Link is empty; paste https://drive.google.com/x', values: { field: 'Drive Link', paste: 'https://drive.google.com/x' }, fixAt: 'Asana', who: [], since: '2026-10-14' },
      { code: 'M17', key: 'M17:price', text: 'You typed $4,400,000 for the price; DE says $4,500,000.', values: { matt: 4400000, de: 4500000 }, fixAt: 'Matt', who: ['Elyse Gutman'], since: '2026-10-15' },
      { code: 'M5', key: 'M5:closedOn', text: 'Closing dates differ.', values: { asana: '2026-12-15', de: '2026-12-01' }, fixAt: 'DE', who: ['Elyse Gutman'], since: '2026-10-16' }],
      dismissed: { 'M17:price': { values: { matt: 4400000, de: 4500000 }, reason: 'Agent texted the new price', by: 'MB', at: '2026-10-16' },
        'M5:closedOn': { values: { asana: '2026-12-10', de: '2026-12-01' }, reason: 'old', by: 'MB', at: '2026-10-01' } } },
    core: { address: '100 EXAMPLE ST', unit: '4A', neighborhood: 'Carnegie Hill', price: 4500000, beds: 4, baths: 4, agentIds: ['elyse-gutman'] } },
  { id: 'p2', slug: '20-sample-ave-7b', label: '20 Sample Ave, 7B', kind: 'rental', market: 'NYC', stage: 'Live', stage_source: 'DE',
    core: { address: '20 Sample Ave', unit: '7B', price: 5000, suggestedAgentIds: ['sam-agent'] }, de_listing_id: '9002', drive_folder: null, folder_state: 'unlinked',
    asana_gid: '1202', asana: { gid: '1202', projectGid: '55', permalink: 'javascript:alert(1)' } },
  { id: 'p3', slug: '12-sample-lane', label: '12 Sample Lane', kind: 'sale', market: 'NJ', stage: 'Live', stage_source: 'seed',
    core: { address: '12 Sample Lane' }, de_listing_id: null, drive_folder: 'GVC - New Jersey/x', folder_state: 'broken' },
  { id: 'p4', slug: 'old', label: 'Old', kind: 'sale', market: 'NYC', stage: 'Sold', stage_source: 'DE', core: { address: '1 Old St' }, de_listing_id: '9004', folder_state: 'linked', drive_folder: 'x' },
  { id: 'p7', slug: 'asana-sold', label: 'Asana Sold', kind: 'sale', market: 'NJ', stage: 'Sold', stage_source: 'Asana', core: { address: '3 Asana Rd' }, de_listing_id: '9007', folder_state: 'linked', drive_folder: 'x7' },
  { id: 'p5', slug: 'gone', label: 'Gone', kind: 'sale', market: 'NYC', stage: 'Archived', core: { address: '2 Gone St' }, folder_state: 'linked', drive_folder: 'y' },
  { id: 'p6', slug: 'library-only', label: '123 Street', kind: 'sale', stage: null, core: { address: '123 Street' }, folder_state: 'unlinked' }
];
const pitches = [{ id: 'q1', slug: '90-pitch-st-11b-2026-08-04', label: '90 Pitch St 11B', market: 'NYC', pitched_on: '2026-08-04', outcome: 'open', folder_state: 'linked', drive_folder: 'z' },
  { id: 'q2', slug: 'won-pitch', label: '100 Example St 4A', market: 'NYC', pitched_on: '2026-06-08', outcome: 'won', won_property_id: 'p1', folder_state: 'linked', drive_folder: 'w' }];
const devs = [{ id: 'd1', slug: '619-example-ave', label: '619 Example Ave', market: 'NJ', milestones: { renders: { done: true, on: '2026-05-21' }, architecturals: { done: true } }, folder_state: 'linked', drive_folder: 'v',
  next_milestone: { key: 'finishes', name: 'Finishes selected', dueOn: '2026-11-02', family: 'NJ', slips: { g1: { count: 2, days: 10 }, g2: { count: 1, days: 4 } }, construction: { done: 3, total: 12 }, early: [] },
  milestone_hints: [{ key: 'floorplans', date: '2026-09-01', approx: false, rule: 'tick', source: 'Asana: Floorplans done', asanaGid: 'g9' }],
  match: { list: [{ code: 'M12', key: 'M12:g7', text: 'Permits is 20 days past due in Asana.', values: { due: '2026-09-30' }, fixAt: 'Asana', who: ['Pat Builder'], since: '2026-10-14' }], dismissed: {} } },
  { id: 'd2', slug: 'west-example', label: 'West Example', market: 'FL', milestones: { agreement: { done: true, on: '2026-01-10' }, groundbreaking: { on: '2026-12-01', planned: true } }, folder_state: 'linked', drive_folder: 'u' }];
const changes = [
  { id: 'c1', property_id: 'p1', at: '2026-06-08T12:00:00Z', field: 'stage', new_value: 'Prep', source: 'seed' },
  { id: 'c2', property_id: 'p1', at: '2026-09-17T12:00:00Z', field: 'stage', old_value: 'Prep', new_value: 'Live', source: 'DE' },
  { id: 'c3', property_id: 'p1', at: '2026-10-12T07:00:00Z', field: 'stage', old_value: 'Live', new_value: 'In contract', source: 'DE' },
  { id: 'c4', property_id: 'p1', at: '2026-10-13T07:00:00Z', field: 'price', old_value: 4750000, new_value: 4500000, note: 'Price reduced 5.3% on DE', source: 'DE' },
  { id: 'c5', pitch_id: 'q1', at: '2026-08-04T12:00:00Z', note: 'Pitched', source: 'seed' }
];

const NAMES = { 'elyse-gutman': 'Elyse Gutman', 'sam-agent': 'Sam Agent' };
const jobs = W.buildJobs({ properties: props, pitches, devProjects: devs, changes }, TODAY, { agentName: id => NAMES[id] || null });
const J = id => jobs.find(j => j.id === id) || {};

/* ---------- which jobs ---------- */
check('library rows without a stage stay off', jobs.some(j => j.id === 'p6'), false);
check('archived hidden by default', jobs.some(j => j.id === 'p5'), false);
check('archived on request', W.buildJobs({ properties: props, pitches, devProjects: devs, changes }, TODAY, { archived: true }).some(j => j.id === 'p5'), true);
check('won pitch folds into its listing', jobs.some(j => j.id === 'q2'), false);
check('types', ['p1', 'p2', 'q1', 'd1'].map(id => J(id).type), ['listing', 'rental', 'pitch', 'development']);

/* ---------- the stage list (S6) ---------- */
check('listing stages are the new list', W.STAGES, ['Prep', 'Live', 'Accepted offer', 'In contract', 'Sold', 'Rented', 'Off market', 'Archived']);
check('old stage names are gone', ['Won', 'Floorplan', 'Showsheet', 'Photos', 'Brochure'].filter(s => W.STAGES.indexOf(s) !== -1 || J('p1').steps.indexOf(s) !== -1), []);
check('a listing\'s steps start at the pitch', J('p1').steps, ['Pitch', 'Prep', 'Live', 'Accepted offer', 'In contract', 'Sold']);
check('a rental ends at Rented', J('p2').steps[J('p2').steps.length - 1], 'Rented');
check('development milestones are D66\'s 18, in order', W.DEV_KEYS, require('../assets/js/asana-map.js').MILESTONES);
check('accepted offer chip', W.buildJobs({ properties: [{ id: 'x', slug: 'x', label: 'x', stage: 'Accepted offer', core: {} }] }, TODAY)[0].chip, 'contract');

/* ---------- deal dates (S7) ---------- */
check('deal dates in date order, with labels', J('p1').dates, [
  { key: 'listedOn', label: 'Listed', on: '2026-09-17', planned: false },
  { key: 'contractOn', label: 'Contract signed', on: '2026-10-12', planned: false },
  { key: 'closedOn', label: 'Closing', on: '2026-12-15', planned: true }]);
check('a date after today is planned, whatever was stored', W.buildJobs({ properties: [{ id: 'x', slug: 'x', label: 'x', stage: 'Live', core: {},
  milestones: { listedOn: { on: '2026-10-30', planned: false }, exclusiveOn: { on: '2026-10-01', planned: true } } }] }, TODAY)[0].dates.map(d => [d.key, d.planned]),
  [['exclusiveOn', false], ['listedOn', true]]);
check('no milestones, no dates', J('p3').dates, []);

/* ---------- Asana link, agents, mismatches ---------- */
check('Asana link: the permalink', J('p1').asanaUrl, 'https://app.asana.com/0/1/1201');
check('Asana link: built from the gid when the permalink isn\'t a web link', J('p2').asanaUrl, 'https://app.asana.com/0/55/1202');
check('Asana link: none when not linked', J('p3').asanaUrl, null);
check('agents: confirmed, else suggested from Asana', [J('p1').agents, J('p2').agents, J('p3').agents], [['Elyse Gutman'], ['Sam Agent'], []]);
check('mismatches: dismissed at the same values left out', [J('p1').mismatches, J('p1').match.map(m => m.key)], [3, ['M3', 'M7:drive', 'M5:closedOn']]);
check('mismatches: none stored, none counted', [J('p3').mismatches, J('p3').match], [0, []]);
check('mismatch total', W.overviewStats(jobs).mismatches, 4);

/* ---------- developments (D66, D67) ---------- */
check('development: next milestone from Asana', J('d1').next, { key: 'finishes', label: 'Finishes', on: '2026-11-02', overdue: false });
check('development: slips counted', J('d1').slips, 3);
check('development: confirmed milestones as progress', J('d1').progress, { done: 2, total: 18 });
check('development: construction bar', J('d1').construction, { done: 3, total: 12 });
check('development: hints waiting for Matt', J('d1').hints, 1);
check('development: next from its own planned milestones without Asana', [J('d2').next, J('d2').slips, J('d2').construction], [{ key: 'groundbreaking', label: 'Groundbreaking', on: '2026-12-01', overdue: false }, 0, null]);
check('development: its mismatches count', J('d1').mismatches, 1);

/* ---------- what a row shows ---------- */
check('name: DE capitals made readable', J('p1').name, '100 Example St 4A');
check('href per job', [J('p1').href, J('q1').href, J('d1').href], ['job/?listing=100-example-st-residence-4a', 'job/?pitch=90-pitch-st-11b-2026-08-04', 'job/?dev=619-example-ave']);
check('price and rooms from DE', [J('p1').price, J('p1').rooms], ['$4,500,000', '4 bd · 4 ba']);
check('rental price per month', J('p2').price, '$5,000/mo');
check('chip', [J('p1').chip, J('p2').chip, J('p4').chip, J('q1').chip], ['contract', 'live', 'sold', 'pre']);
check('stage dates from the change log', J('p1').done, { Prep: '2026-06-08', Live: '2026-09-17', 'In contract': '2026-10-12' });
check('pitch dates fold in', J('p1').done.Pitch, undefined);
check('pitched date shown on the listing', J('p1').pitchedOn, '2026-06-08');
check('step index', [J('p1').stageIdx, J('q1').stageIdx], [4, 0]);
check('development milestones', [J('d1').steps.length, J('d1').stageIdx, J('d1').stage], [18, 4, 'Renders']);
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
  '1 Old St: Sold on DE. Archive the job?',
  '3 Asana Rd: Sold in Asana. Archive the job?'
]);
check('no won-or-lost task for pitches (D32)', tasks.some(t => /won or lost/i.test(t.text)), false);

/* ---------- numbers and recent changes ---------- */
check('stats', W.overviewStats(jobs), { live: 2, contract: 1, toLink: 2, total: 8, mismatches: 4 });
check('recent', W.recentChanges(changes, jobs, 2).map(r => [r.job, r.title, r.when]), [
  ['100 Example St 4A', 'Price $4,750,000 → $4,500,000', '2026-10-13'], ['100 Example St 4A', 'Stage moved to In contract', '2026-10-12']]);

/* ---------- DE sync status (spec §2.9) ---------- */
const now = new Date('2026-10-20T10:00:00Z');
check('never synced', W.syncHealth(null, now).state, 'never');
check('fresh', W.syncHealth({ started_at: '2026-10-20T07:00:00Z', ok: true }, now).state, 'ok');
check('over 36 h', W.syncHealth({ started_at: '2026-10-18T21:00:00Z', ok: true }, now).state, 'amber');
const red = W.syncHealth({ started_at: '2026-10-20T07:00:00Z', ok: false, errors: [{ what: 'aborted', detail: 'DE used a status the workspace doesn\'t know: "Withdrawn".' }] }, now);
check('failed run in plain words', [red.state, /Withdrawn/.test(red.why)], ['red', true]);

/* ---------- local dates ---------- */
check('a 9:30 pm change stays on its own day', W.day('2026-10-13T01:30:00Z'), '2026-10-12');
check('a plain date is left alone', W.day('2026-10-13'), '2026-10-13');
check('no date, no NaN', W.fmtDay(null), '');
check('today is the local date', W.today(new Date('2026-10-21T02:00:00Z')), '2026-10-20');
check('Monday of a week', W.mondayOf('2026-10-21'), '2026-10-19');
check('31 Aug minus six months is 28 Feb', W.today(W.addMonths(new Date(2026, 7, 31), -6)), '2026-02-28');

/* ---------- odd rows ---------- */
const odd = W.buildJobs({ properties: [
  { id: 'q1', slug: 'x', label: 'Hudson Yards Penthouse', stage: 'Live', core: {}, market: 'NYC' },
  { id: 'q2', slug: 'y', label: 'Library row', stage: null, core: { address: '9 Elm St' }, market: 'NJ' }
], pitches: [{ id: 'w1', slug: 'w', label: '9 Elm St', market: 'NJ', outcome: 'won', won_property_id: 'q2', pitched_on: '2026-05-01' }],
  devProjects: [], changes: [] }, TODAY);
check('no address: named by its label', odd.find(j => j.id === 'q1').name, 'Hudson Yards Penthouse');
check('won pitch whose listing has no stage still shows', odd.some(j => j.id === 'w1'), true);

/* ---------- empty database ---------- */
const none = W.buildJobs({ properties: [], pitches: [], devProjects: [], changes: [] }, TODAY);
check('empty: no jobs, sane numbers', [none.length, W.overviewStats(none)], [0, { live: 0, contract: 0, toLink: 0, total: 0, mismatches: 0 }]);
check('empty: no status rows, no match groups', [W.statusRows(none), W.matchGroups(none, [])], [[], []]);

/* ---------- the team Status page (S9) ---------- */
const st = W.statusRows(jobs);
check('status: grouped by market', st.map(g => g.market), ['NYC', 'NJ']);
check('status: by stage order inside a market', st[0].rows.map(r => r.stage + ' ' + r.name), ['Pitch 90 Pitch St 11B', 'Live 20 Sample Ave 7B', 'In contract 100 Example St 4A', 'Sold 1 Old St']);
check('status: developments are not on it', st.some(g => g.rows.some(r => /Example Ave|West Example/.test(r.name))), false);
check('status: a row', st[0].rows[2], { name: '100 Example St 4A', href: 'job/?listing=100-example-st-residence-4a', stage: 'In contract', chip: 'contract',
  lastMilestone: { label: 'Contract signed', on: '2026-10-12' }, nextDate: { label: 'Closing', on: '2026-12-15' }, agents: ['Elyse Gutman'], mismatches: 3 });
check('status: no dates, no milestone', st[0].rows[1].lastMilestone, null);
check('status: a pitch\'s milestone is its pitch day', st[0].rows[0].lastMilestone, { label: 'Pitched', on: '2026-08-04' });

/* ---------- the Match page (S10) ---------- */
const mg = W.matchGroups(jobs, [{ name: 'Alexandra Lynch', text: 'Alexandra Lynch is in Asana People but not on the roster.' }]);
check('match: grouped by where to fix it, roster drift last', mg.map(g => g.fixAt), ['Asana', 'DE', 'Roster']);
check('match: then by person, no one named last', mg[0].people.map(p => p.who), ['Elyse Gutman', 'Pat Builder', '']);
check('match: a line', mg[0].people[0].items[0], { job: '100 Example St 4A', href: 'job/?listing=100-example-st-residence-4a', id: 'p1', table: 'properties',
  code: 'M3', key: 'M3', text: 'Asana says $4,750,000; DE says $4,500,000.', since: '2026-10-13', asanaUrl: 'https://app.asana.com/0/1/1201', paste: null });
check('match: M7 carries the link to paste', mg[0].people[2].items[0].paste, 'https://drive.google.com/x');
check('match: development lines point at dev_projects', mg[0].people[1].items[0].table, 'dev_projects');
check('match: roster drift', mg[2].people[0].items.map(i => i.text), ['Alexandra Lynch is in Asana People but not on the roster.']);

/* ---------- Asana sync status (6 h) ---------- */
check('asana: never', W.asanaHealth(null, now).text, 'Asana hasn\'t synced yet');
check('asana: fresh', W.asanaHealth({ started_at: '2026-10-20T06:00:00Z', ok: true }, now).state, 'ok');
check('asana: 6 h 1 min is late', W.asanaHealth({ started_at: '2026-10-20T03:59:00Z', ok: true }, now).state, 'amber');
check('asana: says when', /^Asana last synced/.test(W.asanaHealth({ started_at: '2026-10-20T06:00:00Z', ok: true }, now).text), true);
check('asana: refused token in plain words', W.asanaHealth({ started_at: '2026-10-20T06:00:00Z', ok: false, errors: [{ what: 'token', detail: 'Asana refused the token' }] }, now).why, 'Asana refused the token');

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
