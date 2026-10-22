/* ============================================================
   Tests for assets/js/asana-map.js — turning an Asana task (as
   helper/asana/allow.js keeps it) into the workspace's words: stage,
   facts, deal dates, agents, checklist blocks and development hints.
   Made-up data only (helper/fixtures/synthetic/asana/ plus tasks built here).

   Plain Node:  node scripts/test-asana-map.js
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const M = require('../assets/js/asana-map.js');
const allow = require('../helper/asana/allow.js');
const { roster, rosterInitials } = require('../helper/roster.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const FIX = path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic', 'asana');
const fx = f => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));

/* a kept task with just what a test needs */
let gidSeq = 7000;
function task(o) {
  return Object.assign({ gid: String(++gidSeq), name: 'T', completed: false, completedAt: null, dueOn: null,
    assignee: null, section: null, projectGid: 'p1', parentGid: null, fields: {} }, o);
}
const st = (status, section, extra) => task({ section: section || null, fields: Object.assign({ 'Listing Status': status }, extra || {}) });

/* ---------- stageOf: every row of plan §6.1 ---------- */
const ROWS = [
  ['Lead', 'Pitch'], ['Leads', 'Pitch'], ['Pitches', 'Pitch'],
  ['In Prep to List', 'Prep'], ['🌴🌳 Coming Soon', 'Prep'], ['TJ New Dev', 'Prep'],
  ['Active', 'Live'],
  ['Accepted Offer/Attorney Review', 'Accepted offer'], ['Accepted Offer', 'Accepted offer'],
  ['Fully Executed/Board Package', 'In contract'], ['In Contract', 'In contract'], ['Financing & Package', 'In contract'],
  ['Pending', 'In contract'], ['🗽 Board Interview', 'In contract'], ['🗽 Board Approved', 'In contract'],
  ['Waiting to Close/Board Approved', 'In contract'],
  ['Post-Closing', 'Sold'], ['Complete', 'Sold'], ['N/A - Sold', 'Sold'],
  ['Listing Removed', 'Off market'], ['TOTM', 'Off market'], ['Graveyard', 'Off market']
];
ROWS.forEach(r => check('stage ' + r[0], M.stageOf(st(r[0])), { stage: r[1] }));
check('rental Complete → Rented', M.stageOf(st('Complete', null, { 'Sale/Rent': 'For Rent' })), { stage: 'Rented' });
check('rental Post-Closing → Rented (fixture spelling)', M.stageOf(st('Post-Closing', null, { 'Sale/Rent': 'Rent' })), { stage: 'Rented' });
check('For Sale or Rent Complete → Sold', M.stageOf(st('Complete', null, { 'Sale/Rent': 'For Sale or Rent' })), { stage: 'Sold' });
check('unknown status', M.stageOf(st('Foo')), { unknown: 'Foo' });
check('D69: TOTM in 🪦 Graveyard', M.stageOf(st('TOTM', '🪦 Graveyard')), { stage: 'Off market' });
check('D69: status wins over section', M.stageOf(st('Active', 'Leads')), { stage: 'Live' });
check('no status, section Active', M.stageOf(st(null, 'Active')), { stage: 'Live' });
check('no status, section In Contract', M.stageOf(st(null, 'In Contract')), { stage: 'In contract' });
check('no status field at all, section 🪦 Graveyard', M.stageOf(task({ section: '🪦 Graveyard' })), { stage: 'Off market' });
check('no status, unknown section', M.stageOf(st(null, 'Odd Section')), { unknown: 'Odd Section' });

/* the NYC fixture: every task maps to a known stage */
const nyc = fx('tasks-1209188026968555.json').data.map(r => allow.keepTask(r, '1209188026968555'));
check('fixture: no unknown stages', nyc.filter(t => M.stageOf(t).unknown).map(t => t.name), []);

/* ---------- isGvcListing (D51) ---------- */
['List Side', 'List (Direct)', 'Direct', 'Landlord'].forEach(v =>
  check('gvc ' + v, M.isGvcListing(task({ fields: { 'Deal Side': v } })), true));
['Buy Side', 'Buy (Direct)', 'Tenant', '', null].forEach(v =>
  check('not gvc ' + v, M.isGvcListing(task({ fields: { 'Deal Side': v } })), false));
check('not gvc: no field', M.isGvcListing(task({})), false);

/* ---------- factsOf ---------- */
const stats = M.factsOf(task({ fields: { 'ℹ️ Property Stats': ['🛏️ 3 Bedrooms', '🚿 2 Full Baths', '🧼 1 Half Bath'] } }));
check('stats beds', stats.beds, 3);
check('stats baths', stats.baths, 2);
check('stats halfBaths', stats.halfBaths, 1);
check('Studio → beds 0', M.factsOf(task({ fields: { 'ℹ️ Property Stats': ['Studio'] } })).beds, 0);
check('rooms and levels', (f => [f.rooms, f.levels])(M.factsOf(task({ fields: { 'ℹ️ Property Stats': ['6 Rooms', '↕️ 2 Levels'] } }))), [6, 2]);
check('stats as one string', (f => [f.beds, f.baths])(M.factsOf(task({ fields: { 'ℹ️ Property Stats': '🛏️ 4 Bedrooms, 🚿 3 Full Baths' } }))), [4, 3]);
check('City/Hood Upper East Side → neighborhood',
  M.factsOf(task({ fields: { '📍 City/Hood': 'Upper East Side' } })), { neighborhood: 'Upper East Side' });
check('City/Hood Lincoln Square → neighborhood',
  M.factsOf(task({ fields: { '📍 City/Hood': 'Lincoln Square' } })).neighborhood, 'Lincoln Square');
check('City/Hood Wall → city', M.factsOf(task({ fields: { '📍 City/Hood': 'Wall' } })), { city: 'Wall' });
/* 📍 State → the two-letter State fact (slice3 tune-up 4: 315 Foreman showed State Not set) */
check('State: names become the two-letter code', ['New Jersey', 'New York', 'Florida', 'new jersey ', 'NJ', 'ny', 'Fl'].map(v => M.factsOf(task({ fields: { '📍 State': v } })).state),
  ['NJ', 'NY', 'FL', 'NJ', 'NJ', 'NY', 'FL']);
check('State: an unknown name is left out, not guessed', [M.factsOf(task({ fields: { '📍 State': 'Narnia' } })).state, M.factsOf(task({ fields: { '📍 State': '' } })).state], [undefined, undefined]);
check('City/Hood with a caller list', M.factsOf(task({ fields: { '📍 City/Hood': 'Testville' } }), { areas: ['Testville'] }), { neighborhood: 'Testville' });
const full = M.factsOf(nyc.find(t => t.gid === '9000000000041'));
check('full facts (absent keys omitted)', full, {
  price: 2250000, originalPrice: 2300000, kind: 'sale', beds: 2, baths: 2, sqft: 1200, propertyType: 'Condo', state: 'NY',
  listingUrl: 'https://example.com/l/3-sample'
});
check('price falls back to Original', M.factsOf(task({ fields: { '💵 Original Price': 900000, '💵 Current Price': null } })), { price: 900000, originalPrice: 900000 });
check('0 sq ft, price and lot size count as not filled in (150 E61, 200 E57)',
  M.factsOf(task({ fields: { 'ℹ️ INT SF': 0, '💵 Current Price': 0, '💵 Original Price': 0, 'ℹ️ Acreage': 0 } })), {});
check('0 Current Price falls back to Original', M.factsOf(task({ fields: { '💵 Current Price': 0, '💵 Original Price': 750000 } })), { price: 750000, originalPrice: 750000 });
check('Studio (beds 0) stays', M.factsOf(task({ fields: { 'ℹ️ Property Stats': ['Studio', '1 Bath'] } })).beds, 0);
check('kind rental', M.factsOf(task({ fields: { 'Sale/Rent': 'For Rent' } })).kind, 'rental');
check('kind For Sale or Rent → sale', M.factsOf(task({ fields: { 'Sale/Rent': 'For Sale or Rent' } })).kind, 'sale');
check('NJ facts', M.factsOf(task({ fields: { '📍 County': 'Monmouth', '📍 Zip': '07700', '📍 MLS': 'MoreMLS', 'ℹ️ Acreage': 0.5,
  'Listing Copy': 'Light and bright.', 'Google Maps Link': 'https://maps.example/1', '🛜 Google Drive Link': 'https://drive.example/f/1' } })),
  { lotSize: 0.5, zip: '07700', county: 'Monmouth', mlsBoard: 'MoreMLS', description: 'Light and bright.',
    mapsUrl: 'https://maps.example/1', driveLink: 'https://drive.example/f/1' });

/* ---------- datesOf ---------- */
const TODAY = '2026-10-20';
check('planned Listing Date', M.datesOf(task({ fields: { '🗓️ Listing Date': '2027-01-15' } }), [], TODAY).listedOn, { on: '2027-01-15', planned: true });
check('past Listing Date', M.datesOf(task({ fields: { '🗓️ Listing Date': '2026-09-01T00:00:00.000Z' } }), [], TODAY).listedOn, { on: '2026-09-01', planned: false });
const tjHist = [{ type: 'status', at: '2026-06-04T15:00:00.000Z', from: 'TJ New Dev', to: 'Active' },
  { type: 'status', at: '2026-10-12T15:00:00.000Z', from: 'Active', to: 'TOTM' }];
const tjDates = M.datesOf(task({ fields: { '🗓️ Listing Date': null } }), tjHist, TODAY);
check('listedOn from history', tjDates.listedOn.on, '2026-06-04');
check('offMarketOn from history', tjDates.offMarketOn, { on: '2026-10-12', planned: false });
check('history local day (late UTC evening is still the NY day)',
  M.datesOf(task({}), [{ type: 'status', at: '2026-06-05T02:30:00.000Z', from: 'TJ New Dev', to: 'Active' }], TODAY).listedOn.on, '2026-06-04');
check('every date key', Object.keys(M.datesOf(nyc.find(t => t.gid === '9000000000068'), [], TODAY)),
  ['acceptedOfferOn', 'contractOn', 'boardPackageOn', 'closedOn']);
check('all keys map', Object.keys(M.datesOf(task({ fields: {
  '🗓️ Pitch': '2026-01-01', '🗓️ Exclusive Date': '2026-01-02', '🗓️ Est. Listing Date': '2026-01-03', '🗓️ Listing Date': '2026-01-04',
  '🗓️ AO Date': '2026-01-05', '🗓️ CS Date': '2026-01-06', '🗓️ BPS Date': '2026-01-07', '🗓️ BI Date': '2026-01-08',
  '🗓️ BA Date': '2026-01-09', '🗓️ CC Date': '2026-01-10', '🗓️ Closing Date': '2026-01-11', '🗓️ Exclusive Expires': '2027-01-12' } }), [], TODAY)),
  ['pitchedOn', 'exclusiveOn', 'estListingOn', 'listedOn', 'acceptedOfferOn', 'contractOn', 'boardPackageOn',
    'boardInterviewOn', 'boardApprovedOn', 'ccOn', 'closedOn', 'exclusiveExpiresOn']);

/* ---------- agentsOf (D53, D71) ---------- */
const INIT = rosterInitials(), ROSTER = roster();
check('initials table loads', INIT.KC, 'katie-cook');
check('JG/KC', M.agentsOf(task({ fields: { '🧑‍💼 Point Person': 'JG/KC' } }), INIT, ROSTER), { ids: ['john-gasdaska', 'katie-cook'], ask: [], others: [] });
check('CB asks', M.agentsOf(task({ fields: { '🧑‍💼 Point Person': 'CB' } }), INIT, ROSTER), { ids: [], ask: ['CB'], others: [] });
check('KC/JG, comma and space', M.agentsOf(task({ fields: { '🧑‍💼 Point Person': 'KC, JG' } }), INIT, ROSTER).ids, ['katie-cook', 'john-gasdaska']);
check('unknown initials ask', M.agentsOf(task({ fields: { '🧑‍💼 Point Person': 'LP' } }), INIT, ROSTER).ask, ['LP']);
check('past member', M.agentsOf(task({ fields: { '🧑‍💼 Point Person': 'JW' } }), INIT, ROSTER).others, [{ initials: 'JW', name: 'Jessica Wolf', past: true }]);
check('assignee when no Point Person', M.agentsOf(task({ assignee: 'James Huber', fields: {} }), INIT, ROSTER).ids, ['james-huber']);
check('assignee not on roster → nothing', M.agentsOf(task({ assignee: 'GVC', fields: {} }), INIT, ROSTER), { ids: [], ask: [], others: [] });
check('duplicates dropped', M.agentsOf(task({ fields: { '🧑‍💼 Point Person': 'TJ/TV' } }), INIT, ROSTER).ids, ['tj-verdiglione']);

/* ---------- checklistOf ---------- */
const sub = (name, done, extra) => Object.assign({ gid: String(++gidSeq), name, completed: !!done,
  completedAt: done ? done : null, assignee: 'Agent A' }, extra || {});
const blocks = M.checklistOf([
  sub('Create New Folder in Teams Files', '2026-05-01T14:00:00.000Z'),
  sub('Fully Execute & Circulate Listing Agreement'),
  sub('Activate Listing'),
  sub('Add to Results'),
  sub('Send Price Change Email'), sub('Change in Results'),
  sub('Create Deal Sheet'), sub('Update ReSource & SE'), sub('Board Package Submission'),
  sub('Update ReSource & SE'), sub('Send clients Closing Gift/Cutting Board')
]);
check('checklist blocks', blocks.map(b => b.block + ':' + b.steps.length), ['prep:4', 'price change:2', 'contract:3', 'post-closing:2']);
check('checklist step shape', blocks[0].steps[0], { name: 'Create New Folder in Teams Files', done: true, doneOn: '2026-05-01', who: 'Agent A' });
check('ambiguous step joins the block before it', blocks[2].steps[1].name, 'Update ReSource & SE');
check('a shared step seen again starts the next block', blocks[3].steps[0].name, 'Update ReSource & SE');
check('empty checklist', M.checklistOf([]), []);

/* ---------- devHints (D64, D66, D67) on the synthetic 🚧 project ---------- */
const DEV = '1210736852899934';
const devTasks = fx('tasks-' + DEV + '.json').data.map(r => allow.keepTask(r, DEV));
const BATCH = '2026-05-27T17:00:00.000Z';   // the fixture's batch day (12 ticks + 1 early)
const dt = (name, section, dueOn, completedAt, extra) => task(Object.assign({ name, section, dueOn, projectGid: DEV,
  completed: !!completedAt, completedAt: completedAt || null }, extra || {}));
const agreement = dt('Receive Completed Advisory Agreement (M)', '1 Advisory', '2026-03-13', BATCH);
const ground = dt('Groundbreaking (Construction Phase Begins)', '3 Construction', '2026-06-14', BATCH);
const brand = dt('Branding Guidelines Approved', '2 Asset Gen', '2026-08-01', '2026-08-11T18:00:00.000Z');
const renders = dt('Receive Final Renderings', '2 Asset Gen', '2026-06-01', '2026-08-06T16:00:00.000Z');
const tco = dt('TCO/Substantial Completion', '3 Construction', '2027-05-01', null, { history: [
  { type: 'due', at: '2026-05-27T17:00:00.000Z', from: null, to: '2026-12-25' },
  { type: 'due', at: '2026-07-01T17:00:00.000Z', from: '2026-12-25', to: '2027-01-31' },
  { type: 'due', at: '2026-08-01T17:00:00.000Z', from: '2027-01-31', to: '2027-03-15' },
  { type: 'due', at: '2026-09-01T17:00:00.000Z', from: '2027-03-15', to: '2027-05-01' }
] });
const build = [
  dt('Excavation Complete', '3. Construction', '2026-06-20', '2026-06-25T15:00:00.000Z'),
  dt('Foundation Poured', '3. Construction', '2026-07-10', '2026-07-12T15:00:00.000Z'),
  dt('Interior Framing Complete', '3. Construction', '2026-08-01', '2026-08-03T15:00:00.000Z'),
  dt('Rough-In Complete', '3. Construction', '2026-09-01', '2026-09-20T15:00:00.000Z'),
  dt('Fence Installed', '3. Construction', '2026-03-13', BATCH),          // batch tick: counts in total, not done
  dt('Foundation Complete', '3. Construction', '2026-11-04', null),
  dt('Drywall Complete', '3. Construction', '2026-12-01', null),
  dt('Flooring Complete', '3. Construction', '2027-01-15', null),
  dt('Final Paint Complete', '3. Construction', '2027-02-20', null),
  dt('Framing Video (if applicable)', '3. Construction', '2026-08-01', null)   // video twin: not a build step
];
const project = { gid: DEV, name: '🚧 Example Tower' };
const all = devTasks.concat([agreement, ground, brand, renders, tco]).concat(build);
const H = M.devHints(project, all, { tz: 'America/New_York' }, TODAY);
const hint = key => H.hints.filter(h => h.key === key);
check('batch days found', M.batchDays(all, 'America/New_York'), ['2026-05-27']);
check('family FL', H.family, 'FL');
check('batch tick after due → due date', hint('agreement'), [{ key: 'agreement', date: '2026-03-13', approx: false, rule: 'batch',
  source: 'Asana: 🚧 Example Tower, Receive Completed Advisory Agreement (M)', asanaGid: agreement.gid }]);
check('batch tick before due → no hint', hint('groundbreaking'), []);
check('batch tick before due → flagged early', H.early.map(e => e.gid).sort(), [ground.gid, '9000000000348'].sort());
check('early flag shape', H.early.find(e => e.gid === ground.gid), { gid: ground.gid, key: 'groundbreaking', name: ground.name, dueOn: '2026-06-14', tickedOn: '2026-05-27' });
check('live tick 10 days late → tick date', hint('branding').map(h => [h.date, h.approx, h.rule]), [['2026-08-11', false, 'tick']]);
check('live tick 66 days late → due date, approx', hint('renders').map(h => [h.date, h.approx, h.rule]), [['2026-06-01', true, 'late']]);
check('slips', H.slips[tco.gid], { count: 3, days: 127 });
check('no slips for unmoved tasks', H.slips[brand.gid], undefined);
check('construction progress', H.construction, { done: 4, total: 9 });
check('next: a task ticked ahead of its date is still open (D64)', H.next, { key: 'groundbreaking', name: ground.name, dueOn: '2026-06-14' });
check('next without the early tick', M.devHints(project, all.filter(t => t !== ground), { tz: 'America/New_York' }, TODAY).next, { key: 'construction', name: 'Foundation Complete', dueOn: '2026-11-04' });
check('hints in MILESTONES order', H.hints.map(h => h.key), ['agreement', 'renders', 'branding']);
check('MILESTONES', M.MILESTONES, ['agreement', 'landClosed', 'architecturals', 'permits', 'renders', 'finishes', 'floorplans',
  'branding', 'listingAgreement', 'websiteLive', 'groundbreaking', 'launchEvent', 'showingAssets', 'listedUnits',
  'construction', 'tco', 'contractsSales', 'closedOut']);
check('milestone names: launch event, not its planning task',
  [M.milestoneOf('Demo/Launch Event', 'FL'), M.milestoneOf('Plan Demo Launch Event', 'FL'), M.milestoneOf('Demo/Launch Video', 'FL')],
  ['launchEvent', null, null]);
check('milestone names: success event, not its planning task',
  [M.milestoneOf('Host Success Event', 'FL'), M.milestoneOf('Plan Success Event', 'FL')], ['closedOut', null]);

/* NJ build: the house row, the land row and loose tasks (D65) */
const nj = [
  dt('Conclude Attorney Review', '1 Acquisition', '2025-11-04', '2026-05-27T15:00:00.000Z'),
  dt('Close on Property', '1 Acquisition', '2025-12-16', null),
  dt('Construction Permit Received', '2 Planning', '2026-03-30', '2026-04-02T15:00:00.000Z'),
  dt('Certificate of Occupancy', '3 Construction', '2027-01-11', null)
];
const house = task({ name: '30 Lot Rd, Exampleton', fields: { 'Listing Status': 'Active', '🗓️ Exclusive Date': '2026-06-01', '🗓️ CS Date': '2027-01-01' },
  history: [{ type: 'status', at: '2026-06-04T15:00:00.000Z', from: 'TJ New Dev', to: 'Active' }] });
const land = task({ name: '30 Lot Rd, Exampleton', fields: { 'Deal Side': 'Buy Side', '🗓️ CS Date': '2025-11-01', '🗓️ Closing Date': '2025-12-16' } });
const loose = [{ gid: '6001', name: 'New Renderings for 30 Lot Rd', projectGid: 'L1', dueOn: '2026-02-18', completedAt: '2026-03-19T18:00:00.000Z', assignee: 'Agent B' },
  { gid: '6002', name: 'Redo Floorplan 30 Lot Rd', projectGid: 'L1', dueOn: '2026-06-10', completedAt: null, assignee: 'Agent B' }];
const HN = M.devHints({ gid: 'p2', name: '🚧 30 Lot Rd' }, nj, { houses: [house], lands: [land], loose, tz: 'America/New_York' }, TODAY);
check('family NJ', HN.family, 'NJ');
check('NJ hints', HN.hints.map(h => [h.key, h.date, h.rule]), [
  ['landClosed', '2025-12-16', 'land'],
  ['permits', '2026-04-02', 'tick'],
  ['renders', '2026-03-19', 'loose'],
  ['listingAgreement', '2026-06-01', 'house'],
  ['listedUnits', '2026-06-04', 'house']
]);
check('planned house CS date is no hint', HN.hints.some(h => h.key === 'contractsSales'), false);
check('NJ: not a batch day (one tick)', M.batchDays(nj, 'America/New_York'), []);
check('NJ next', HN.next, { key: 'landClosed', name: 'Close on Property', dueOn: '2025-12-16' });

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
