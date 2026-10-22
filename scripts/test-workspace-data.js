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

/* ---------- change-log words (Slice 3, S19) ---------- */
const nm = id => ({ 'katie-cook': 'Katie Cook', 'john-gasdaska': 'John Gasdaska' })[id] || null;
check('changeTitle: words for each kind of change', [
  W.changeTitle({ field: 'agentIds', old_value: [], new_value: ['john-gasdaska', 'katie-cook'] }, nm),
  W.changeTitle({ field: 'agentIds', new_value: ['gone-id'] }, nm),
  W.changeTitle({ field: 'agentIds', new_value: [] }, nm),
  W.changeTitle({ field: 'photo_hero', new_value: 'Photos/Edited/03.jpg' }),
  W.changeTitle({ field: 'beds', old_value: 3, new_value: 4 }),
  W.changeTitle({ field: 'taxesMonthly', old_value: null, new_value: 1250 }),
  W.changeTitle({ field: 'price', old_value: 2250000, new_value: null }),
  W.changeTitle({ field: 'interiorFeatures', new_value: ['Washer'] }),
  W.changeTitle({ field: 'milestones', note: 'Permits / zoning ticked by hand: 3 Oct.' }),
  W.changeTitle({ field: 'floorplan', new_value: { version: 3, note: 'bigger kitchen' } }),
  W.changeTitle({ field: null, note: 'Katie says the price drops Friday' }),
  W.changeTitle({ field: 'price', old_value: 4750000, new_value: 4500000 })
], ['Agents: John Gasdaska, Katie Cook', 'Agents: Unknown agent (gone-id)', 'Agents cleared', 'Photo picks saved', 'Beds 3 → 4',
  'Taxes per month set to $1,250', 'Price cleared', 'Interior features changed', 'Permits / zoning ticked by hand: 3 Oct.', 'Floorplan v3 recorded',
  'Katie says the price drops Friday', 'Price $4,750,000 → $4,500,000']);

/* ---------- change-log words: every field in plain words with its value (slice3 tune-up 1) ---------- */
check('changeTitle: sync fields in plain words', [
  W.changeTitle({ field: 'mlsId', old_value: null, new_value: '123456', source: 'DE' }),
  W.changeTitle({ field: 'de_stage', old_value: 'Live', new_value: 'In contract', source: 'DE' }),
  W.changeTitle({ field: 'exclusiveOn', old_value: null, new_value: '2026-05-27', source: 'Asana' }),
  W.changeTitle({ field: 'estListingOn', old_value: '2026-06-01', new_value: '2026-06-15', source: 'Asana' }),
  W.changeTitle({ field: 'acceptedOfferOn', old_value: null, new_value: '2026-09-03', source: 'Asana' }),
  W.changeTitle({ field: 'boardApprovedOn', old_value: '2026-10-01', new_value: null, source: 'Asana' }),
  W.changeTitle({ field: 'asana_gid', old_value: null, new_value: '1201', note: 'Linked to Asana', source: 'Asana' }),
  W.changeTitle({ field: 'kind', old_value: null, new_value: 'sale', source: 'Asana' }),
  W.changeTitle({ field: 'kind', old_value: 'sale', new_value: 'rental', source: 'Asana' }),
  W.changeTitle({ field: 'market', old_value: null, new_value: 'NJ', source: 'Asana' }),
  W.changeTitle({ field: 'county', old_value: null, new_value: 'Monmouth', source: 'Asana' }),
  W.changeTitle({ field: 'closeDate', old_value: null, new_value: '2026-10-02', source: 'DE' }),
  W.changeTitle({ field: 'pitched_on', old_value: null, new_value: '2026-09-10', source: 'Asana' }),
  W.changeTitle({ field: 'outcome', old_value: 'open', new_value: 'not won', source: 'Asana' }),
  W.changeTitle({ field: 'yearBuilt', old_value: null, new_value: 2007, source: 'DE' }),
  W.changeTitle({ field: 'state', old_value: null, new_value: 'NJ', source: 'Asana' })
], ['MLS number set to 123456', 'DE stage moved to In contract', 'Exclusive date set to 27 May', 'Est. listing date 1 Jun → 15 Jun',
  'Accepted offer date set to 3 Sep', 'Board approval date cleared', 'Linked to Asana', 'Sale or rental set to Sale', 'Sale or rental Sale → Rental',
  'Market set to NJ', 'County set to Monmouth', 'DE closing date set to 2 Oct', 'Pitch date set to 10 Sep', 'Outcome Open → Not won',
  'Year built set to 2007', 'State set to NJ']);
check('changeTitle: an unknown field is humanised, never raw', [
  W.changeTitle({ field: 'someNewField', old_value: null, new_value: 'x' }),
  W.changeTitle({ field: 'other_new_thing', old_value: 'a', new_value: 'b' }),
  W.changeTitle({ field: 'dev_project_id', old_value: null, new_value: 'd1' }),
  W.changeTitle({ field: 'from_pitch_id', old_value: null, new_value: 'p1' })
], ['Some new field set to x', 'Other new thing a → b', 'Joined a development', 'Made from a won pitch']);
check('changeTitle: no line ever shows a raw camelCase or snake_case name',
  ['mlsId', 'de_stage', 'exclusiveOn', 'estListingOn', 'acceptedOfferOn', 'boardApprovedOn', 'asana_gid', 'kind', 'asana_project_gid', 'suggestedAgentIds',
   'closePrice', 'listingUrl', 'mapsUrl', 'driveLink', 'levels', 'contractOn', 'exclusiveExpiresOn', 'offMarketOn', 'milestone_hints']
    .map(f => W.changeTitle({ field: f, old_value: null, new_value: f === 'suggestedAgentIds' ? [] : '2026-05-27', source: 'Asana' }))
    .filter(t => /[a-z][A-Z]|_/.test(t)), []);
check('W.fieldLabel: one label map', [W.fieldLabel('mlsId'), W.fieldLabel('sqft'), W.fieldLabel('exclusiveOn'), W.fieldLabel('fooBarBaz')],
  ['MLS number', 'Sq ft', 'Exclusive date', 'Foo bar baz']);

/* ---------- DE's 0 sq ft / 0 baths is blank, as Match's M4 says (slice3 tune-up 2) ---------- */
check('changeTitle: DE\'s 0 sq ft and 0 baths read as blank, 0 beds is a studio', [
  W.changeTitle({ field: 'sqft', old_value: null, new_value: 0, source: 'DE' }),
  W.changeTitle({ field: 'baths', old_value: null, new_value: 0, source: 'DE' }),
  W.changeTitle({ field: 'beds', old_value: null, new_value: 0, source: 'DE' }),
  W.changeTitle({ field: 'sqft', old_value: 0, new_value: 1200, source: 'DE' })
], ['Sq ft is blank on DE', 'Baths is blank on DE', 'Beds set to 0', 'Sq ft set to 1200']);

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

/* M6 "no Drive folder linked" collapses to one line per fix group (each job once) */
const m6job = (id, who, values) => ({ id, name: 'Job ' + id, href: 'job/?listing=' + id, type: 'listing', asanaUrl: null,
  match: [{ code: 'M6', key: 'M6', text: 'No Drive folder is linked, and the job is Live.', values, fixAt: 'Drive', who }] });
const mg6 = W.matchGroups([m6job('a', ['Ann'], { folder: null, stage: 'Live' }), m6job('b', ['Ann', 'Ben'], { folder: null, stage: 'Live' }),
  m6job('c', ['Ben'], { folder: 'x', broken: true })], []);
check('match M6: one bulk line, each job once', mg6.map(g => [g.fixAt, (g.bulk || []).map(b => [b.code, b.text, b.items.map(i => i.id)])]),
  [['Drive', [['M6', '2 jobs have no Drive folder linked yet.', ['a', 'b']]]]]);
check('match M6: a broken folder stays a normal line', mg6[0].people.map(p => [p.who, p.items.map(i => i.id)]), [['Ben', ['c']]]);
check('match M6: one job reads "1 job has"', W.matchGroups([m6job('a', [], { folder: null, stage: 'Prep' })], [])[0].bulk[0].text, '1 job has no Drive folder linked yet.');

/* ---------- Asana sync status (6 h) ---------- */
check('asana: never', W.asanaHealth(null, now).text, 'Asana hasn\'t synced yet');
check('asana: fresh', W.asanaHealth({ started_at: '2026-10-20T06:00:00Z', ok: true }, now).state, 'ok');
check('asana: 6 h 1 min is late', W.asanaHealth({ started_at: '2026-10-20T03:59:00Z', ok: true }, now).state, 'amber');
check('asana: says when', /^Asana last synced/.test(W.asanaHealth({ started_at: '2026-10-20T06:00:00Z', ok: true }, now).text), true);
/* construction counts stored as text are numbers before they're drawn */
const consJobs = W.buildJobs({ properties: [], pitches: [], devProjects: [{ id: 'dx', slug: 'x', label: 'X', market: 'NJ', milestones: {},
  next_milestone: { key: null, construction: { done: '3', total: '12' } } }], changes: [] }, TODAY, {});
check('development: construction counts coerced to numbers', consJobs[0].construction, { done: 3, total: 12 });

/* lines with no job: DE-only listings (M2) and Asana tasks the last sync couldn't link */
const MC = require('../assets/js/match-check.js');
const loose = W.looseMatch({
  deListings: [{ de_listing_id: '9101', gvc_listed: true, property_id: null, courtesy: 'Douglas Elliman: Test Agent', raw: { listingUrl: 'https://www.elliman.com/x/9101' }, checked_at: '2026-10-19T07:00:00Z' },
    { de_listing_id: '9102', gvc_listed: true, property_id: 'p1' }, { de_listing_id: '9103', gvc_listed: true, property_id: null, ignored: true }, { de_listing_id: '9104', gvc_listed: false }],
  asanaRun: { started_at: '2026-10-20T06:00:00Z', totals: { unlinked: [{ gid: '1500', name: '7 Lone Pl', why: 'same address' }, { gid: '1501', name: '8 Ignored Pl', why: 'same address' }] } },
  ignoredGids: ['1501'] }, MC);
check('loose: one DE-only line and one unlinked task', loose.map(l => [l.fixAt, l.item.code, l.item.job]), [['Asana', 'M2', 'DE listing 9101'], ['Asana', 'Link', '7 Lone Pl']]);
check('loose: plain words and links', [loose[0].item.text, loose[0].item.deUrl, loose[1].item.text, loose[1].item.asanaUrl],
  ['On DE, not in Asana. DE shows: Douglas Elliman: Test Agent.', 'https://www.elliman.com/x/9101', 'Asana task not linked: another task is linked to the job at this address.', 'https://app.asana.com/0/0/1500']);
const mgL = W.matchGroups([], [], loose);
check('loose: in the Asana group, no one named', [mgL.map(g => g.fixAt), mgL[0].people.map(p => p.who), mgL[0].people[0].items.length], [['Asana'], [''], 2]);
// Link by hand (tune-up A): each loose line says what it is, so the page can link it to a job or set it aside
check('loose: what a DE line links (no address kept yet: no street, no market)', loose[0].item.link, { type: 'de', id: '9101', kind: null, market: null, street: null, unit: null });
check('loose: what an Asana line links', loose[1].item.link, { type: 'asana', gid: '1500', name: '7 Lone Pl', market: null });
const looseA = W.looseMatch({
  deListings: [{ de_listing_id: '9201', kind: 'sale', gvc_listed: true, property_id: null, raw: { street: '1006 PHEASANT LN', unit: '204', state: 'NJ' } },
    { de_listing_id: '9202', kind: 'rental', gvc_listed: true, property_id: null, raw: { street: '52 E 4TH ST', unit: '10', state: 'NY' } }],
  asanaRun: { started_at: '2026-10-20T06:00:00Z', totals: { unlinked: [{ gid: '1600', name: '1006 Pheasant Ln, Wall', why: 'same address', market: 'NJ' }, { gid: '1601', name: '9 Linked Pl', why: 'same address', market: 'NJ' }] } },
  linkedGids: ['1601'] }, MC);
check('loose: a DE line with its address: street, market from the state, kind', looseA.slice(0, 2).map(l => l.item.link),
  [{ type: 'de', id: '9201', kind: 'sale', market: 'NJ', street: '1006 PHEASANT LN', unit: '204' }, { type: 'de', id: '9202', kind: 'rental', market: 'NYC', street: '52 E 4TH ST', unit: '10' }]);
check('loose: the DE address shows beside its id', looseA[0].item.job, '1006 Pheasant Ln 204 · DE listing 9201');
check('loose: an Asana line carries its market; a task linked by hand since the run is left out', looseA.slice(2).map(l => [(l.item.link || {}).gid, (l.item.link || {}).market]), [['1600', 'NJ']]);

// tune-up A1: a DE listing whose id a job already holds is left out (a hand link half saved: the job has it, the cache row doesn't)
const looseD = W.looseMatch({ deListings: [{ de_listing_id: '9301', kind: 'sale', gvc_listed: true, property_id: null }, { de_listing_id: '9302', kind: 'sale', gvc_listed: true, property_id: null }],
  linkedDeIds: ['9301'] }, MC);
check('loose: a DE listing a job already holds is left out', looseD.map(l => l.item.link.id), ['9302']);
// deepen M19: a DE line a job's "probably the same listing" line names says so (and keeps Link to a job / Not ours)
const looseM19 = W.looseMatch({ deListings: [{ de_listing_id: '9302', kind: 'rental', gvc_listed: true, property_id: null, raw: { street: '52 E 4TH ST', unit: '10', state: 'NY' } }],
  claims: { '9302': '52 E4, 10FL' } }, MC);
check('loose: a DE line claimed by a job\'s M19 names that job', [looseM19[0].item.text, !!looseM19[0].item.link],
  ['On DE, not in Asana. Probably the same listing as 52 E4, 10FL: see that job\'s line.', true]);
// deepen 3b: a cached task no job links to
const looseNoJob = W.looseMatch({ asanaRun: { started_at: '2026-10-21T06:00:00Z', totals: { unlinked: [{ gid: '1700', name: '404 Park S - 6A', why: 'no job yet', market: 'NYC' }] } } }, MC);
check('loose: a task with no job yet says so', looseNoJob[0].item.text, 'Asana task not linked: no job is linked to it yet, so check whether it should be one.');
// tune-up B6: the chip colour of a stage
check('chipOf: each stage\'s chip', ['Live', 'In contract', 'Accepted offer', 'Sold', 'Rented', 'Prep', 'Pitch', undefined].map(W.chipOf),
  ['live', 'contract', 'contract', 'sold', 'sold', 'pre', 'pre', 'pre']);

check('asana: refused token in plain words', W.asanaHealth({ started_at: '2026-10-20T06:00:00Z', ok: false, errors: [{ what: 'token', detail: 'Asana refused the token' }] }, now).why, 'Asana refused the token');

/* ---------- beds and baths: show what is known ---------- */
const roomsOf = core => (W.buildJobs({ properties: [{ id: 'r1', slug: 'r', stage: 'Live', market: 'NYC', core: Object.assign({ address: '1 Room St' }, core) }], pitches: [], devProjects: [], changes: [] }, TODAY)[0] || {}).rooms;
check('rooms: beds and baths', roomsOf({ beds: 2, baths: 1 }), '2 bd · 1 ba');
check('rooms: baths unknown still shows the beds', roomsOf({ beds: 1 }), '1 bd');
check('rooms: beds unknown still shows the baths', roomsOf({ baths: 2 }), '2 ba');
check('rooms: a studio is 0 bd', roomsOf({ beds: 0, baths: 1 }), '0 bd · 1 ba');
check('rooms: nothing known', roomsOf({}), '');

/* ---------- the place line (neighborhood, else city) is back on listings (lost on 2026-10-22, 7169fc1) ---------- */
check('place: a listing shows its neighborhood', J('p1').place, 'Carnegie Hill');
check('place: else its city', (W.buildJobs({ properties: [{ id: 'pl', slug: 'pl', stage: 'Prep', market: 'NJ', core: { address: '3 Crosby Ln', city: 'Port Monmouth' } }], pitches: [], devProjects: [], changes: [] }, TODAY)[0] || {}).place, 'Port Monmouth');

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
