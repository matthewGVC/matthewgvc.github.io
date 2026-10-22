/* ============================================================
   Tests for assets/js/match-check.js — the Match check, M1 to M27
   (spec §5, plan §8b), the dismiss rule and roster drift (D71).
   Made-up jobs only.

   Plain Node:  node scripts/test-match-check.js
   ============================================================ */
'use strict';

const M = require('../assets/js/match-check.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const ROSTER = [
  { id: 'agent-one', name: 'Ann Example' },
  { id: 'agent-two', name: 'Ben Sample' },
  { id: 'agent-three', name: 'Cal Testing' }
];
const INITIALS = { AE: 'agent-one', BS: 'agent-two', CT: 'agent-three', PX: 'past:Pat Former', OX: 'other:Olive Other', QQ: null };
const NOW = '2026-10-20T16:00:00Z';

/* a clean job: Asana and DE agree on everything */
function job(o) {
  const base = {
    id: 'p1', stage: 'Live', de_stage: 'Live', de_listing_id: '900001',
    drive_folder: 'GVC - New York/Building Information/100 Example St/4A', folder_state: 'linked',
    core: { address: '100 Example St', unit: '4A', price: 2250000, agentIds: ['agent-one'] },
    asana: {
      gid: '9000000000001', name: '100 Example St - 4A', section: 'Active', status: 'Active',
      stageFromStatus: 'Live', stageFromSection: 'Live', statusSince: '2026-09-01',
      pointPerson: 'AE', assignee: 'Ops Person', completed: false,
      fields: {
        'Listing Status': 'Active', '💵 Current Price': 2250000, 'ℹ️ Property Stats': ['🛏️ 2 Bedrooms', '🚿 2 Full Baths'],
        'ℹ️ INT SF': 1200, '🗓️ Listing Date': '2026-09-01', '🛜 Elliman Link': 'https://www.elliman.com/listing/x/900001',
        '🛜 Google Drive Link': 'https://drive.google.com/drive/folders/abc123', '🧑‍💼 Point Person': 'AE'
      },
      checklist: [{ block: 'prep', steps: [
        { name: 'Revise/Brand Floorplan', done: true, doneOn: '2026-08-20', who: null },
        { name: 'Create Show Sheet', done: true, doneOn: '2026-08-25', who: null },
        { name: 'Send Just Listed Email', done: true, doneOn: '2026-09-02', who: null }
      ] }]
    },
    milestones: { listedOn: { on: '2026-09-01', planned: false } },
    de: { status: 'Active', price: 2250000, beds: 2, baths: 2, halfBaths: 0, sqft: 1200, listingUrl: 'https://www.elliman.com/listing/x/900001' },
    scan: { found: { floorplan: '2026-08-19', showsheet: '2026-08-24' }, scannedAt: '2026-10-20T06:00:00Z' },
    match: null
  };
  const out = JSON.parse(JSON.stringify(base));
  Object.keys(o || {}).forEach(k => {
    if ((k === 'asana' || k === 'core' || k === 'de') && o[k]) out[k] = Object.assign(out[k] || {}, o[k]);
    else out[k] = o[k];
  });
  return out;
}
const ctx = o => Object.assign({ roster: ROSTER, initials: INITIALS, people: [], now: NOW }, o || {});
const codes = list => list.map(m => m.code);
const has = (list, code) => list.filter(m => m.code === code);

/* ---------- a clean job has nothing ---------- */
check('clean job: no mismatches', codes(M.check(job(), ctx())), []);
check('every item has the shape', Object.keys(M.check(job({ de_stage: 'In contract' }), ctx())[0]).sort(),
  ['code', 'fixAt', 'key', 'since', 'text', 'values', 'who']);

/* ---------- M1: Asana ahead of DE, 14 days grace from the history date ---------- */
const ao = { stage: 'Accepted offer', asana: { status: 'Accepted Offer/Attorney Review', section: 'Accepted Offer/Attorney Review',
  stageFromStatus: 'Accepted offer', stageFromSection: 'Accepted offer', statusSince: '2026-10-03' } };
check('M1: Accepted offer 14 days, DE Active → not yet', has(M.check(job(ao), ctx({ now: '2026-10-17T16:00:00Z' })), 'M1').length, 0);
let m1 = has(M.check(job(ao), ctx({ now: '2026-10-18T16:00:00Z' })), 'M1');
check('M1: day 15 → fires', m1.length, 1);
check('M1: text', m1[0] && m1[0].text, 'Asana says Accepted offer since 3 Oct; DE still says Live.');
check('M1: values, fix at DE, since', m1[0] && [m1[0].values, m1[0].fixAt, m1[0].since], [{ asana: 'Accepted offer', de: 'Live' }, 'DE', '2026-10-03']);
check('M1: who is the Point Person', m1[0] && m1[0].who, ['Ann Example']);
m1 = has(M.check(job({ de_stage: 'In contract' }), ctx()), 'M1');
check('M1: DE ahead of Asana fires at once, fix in Asana', m1[0] && [m1[0].text, m1[0].fixAt], ['DE says In contract; Asana still says Live.', 'Asana']);
check('M1: no DE stage → no M1', has(M.check(job({ de_stage: null, de_listing_id: null, de: null, stage: 'Prep',
  asana: { status: 'In Prep to List', section: 'In Prep to List', stageFromStatus: 'Prep', stageFromSection: 'Prep' } }), ctx()), 'M1').length, 0);
check('M1: Sold and Rented on DE agree with Sold in Asana', has(M.check(job({ stage: 'Sold', de_stage: 'Sold',
  asana: { status: 'Complete', section: 'Complete', stageFromStatus: 'Sold', stageFromSection: 'Sold' } }), ctx()), 'M1').length, 0);
check('M1: statusSince from history', M.statusSince([
  { type: 'status', at: '2026-09-01T15:00:00Z', from: 'In Prep to List', to: 'Active' },
  { type: 'status', at: '2026-10-03T15:00:00Z', from: 'Active', to: 'Accepted Offer/Attorney Review' }], 'Accepted offer'), '2026-10-03');
check('M1: statusSince none', M.statusSince([], 'Live'), null);

/* ---------- M2: Asana task gone / Live in Asana, not on DE ---------- */
let m2 = has(M.check(job({ asana: { gone: '2026-10-19T07:00:00Z' } }), ctx()), 'M2');
check('M2: gone', m2.map(m => [m.text, m.fixAt, m.since]), [['Asana task gone.', 'Asana', '2026-10-19']]);
m2 = has(M.check(job({ de_listing_id: null, de: null, de_stage: null, asana: { statusSince: '2026-09-01' } }), ctx()), 'M2');
check('M2: Live in Asana for weeks, not on DE (Asana ahead: fix on DE, as M1)', m2.map(m => [m.text, m.fixAt]), [['Asana says Live since 1 Sep; the listing isn\'t on DE.', 'DE']]);
check('M2: Live a week, not on DE yet → grace', has(M.check(job({ de_listing_id: null, de: null, de_stage: null, asana: { statusSince: '2026-10-13' } }), ctx()), 'M2').length, 0);
check('M2: DE-only listing', M.checkDeListing({ de_listing_id: '900009', gvc_listed: true, courtesy: 'Douglas Elliman: Test Agent', raw: { listingUrl: 'https://x/9' } }).text,
  'On DE, not in Asana.');
check('M2: DE listing not GVC → nothing', M.checkDeListing({ de_listing_id: '900010', gvc_listed: false }), null);

/* ---------- M3: price ---------- */
let m3 = has(M.check(job({ asana: { fields: Object.assign({}, job().asana.fields, { '💵 Current Price': 2100000 }) } }), ctx()), 'M3');
check('M3: Asana price ≠ DE price', m3.map(m => [m.text, m.values, m.fixAt]), [['Asana says $2.1M; DE says $2.25M.', { asana: 2100000, de: 2250000 }, 'Asana']]);
check('M3: same price → nothing', has(M.check(job(), ctx()), 'M3').length, 0);
const m3f = o => Object.assign({}, job().asana.fields, o);
check('M3: Current Price blank, Original differs → nothing (435 E57)',
  has(M.check(job({ asana: { fields: m3f({ '💵 Current Price': null, '💵 Original Price': 2650000 }) } }), ctx()), 'M3').length, 0);
check('M3: Current Price 0 → nothing', has(M.check(job({ asana: { fields: m3f({ '💵 Current Price': 0, '💵 Original Price': 2650000 }) } }), ctx()), 'M3').length, 0);
check('M3: For Rent in Asana on a sale job → nothing (a linking problem, 404 Park)',
  has(M.check(job({ kind: 'sale', asana: { fields: m3f({ 'Sale/Rent': 'For Rent', '💵 Current Price': 12200 }) } }), ctx()), 'M3').length, 0);
check('M3: rental job, For Rent, prices differ → fires (84 Diane)',
  has(M.check(job({ kind: 'rental', de: { price: 2400 }, asana: { fields: m3f({ 'Sale/Rent': 'For Rent', '💵 Current Price': 2600 }) } }), ctx()), 'M3').map(m => m.text),
  ['Asana says $2,600; DE says $2,400.']);
check('M3: For Sale or Rent on a rental job still compares',
  has(M.check(job({ kind: 'rental', de: { price: 17000 }, asana: { fields: m3f({ 'Sale/Rent': 'For Sale or Rent', '💵 Current Price': 16000 }) } }), ctx()), 'M3').length, 1);

/* ---------- M4: beds / baths / sq ft ---------- */
const m4 = has(M.check(job({ de: { beds: 3, sqft: 1250 } }), ctx()), 'M4');
check('M4: beds and sq ft differ', m4.map(m => [m.text, m.values]),
  [['Asana says 2 beds, 1,200 sq ft; DE says 3 beds, 1,250 sq ft.', { beds: { asana: 2, de: 3 }, sqft: { asana: 1200, de: 1250 } }]]);
check('M4: missing on one side → nothing', has(M.check(job({ de: { beds: null, sqft: null } }), ctx()), 'M4').length, 0);

/* ---------- M5: listed / closing dates, > 3 days, planned skipped ---------- */
const sold = (asanaOn, planned, deOn) => job({ stage: 'Sold', de_stage: 'Sold',
  asana: { status: 'Complete', section: 'Complete', stageFromStatus: 'Sold', stageFromSection: 'Sold' },
  milestones: { listedOn: { on: '2026-09-01', planned: false }, closedOn: { on: asanaOn, planned } }, core: { closeDate: deOn } });
check('M5: closing 3 days apart → nothing', has(M.check(sold('2026-10-10', false, '2026-10-13'), ctx()), 'M5').length, 0);
let m5 = has(M.check(sold('2026-10-10', false, '2026-10-14'), ctx()), 'M5');
check('M5: closing 4 days apart → fires', m5.map(m => [m.key, m.text, m.values]),
  [['M5:closedOn', 'Asana says closing on 10 Oct; DE says 14 Oct.', { date: 'closedOn', asana: '2026-10-10', de: '2026-10-14' }]]);
check('M5: a planned date is skipped', has(M.check(sold('2026-11-30', true, '2026-10-14'), ctx()), 'M5').length, 0);

/* ---------- M6: no folder while Prep or later / Drive Link elsewhere ---------- */
check('M6: no folder linked while Live', has(M.check(job({ drive_folder: null, folder_state: 'unlinked' }), ctx()), 'M6').map(m => [m.text, m.fixAt]),
  [['No Drive folder is linked, and the job is Live.', 'Drive']]);
check('M6: Off market without a folder → nothing', has(M.check(job({ stage: 'Off market', drive_folder: null, folder_state: 'unlinked', de_stage: null, de_listing_id: null, de: null,
  asana: { status: 'Listing Removed', section: 'Listing Removed', stageFromStatus: 'Off market', stageFromSection: 'Off market' } }), ctx()), 'M6').length, 0);
check('M6: Asana Drive Link points to another folder', has(M.check(job(), ctx({ drive: { folderId: 'zzz999' } })), 'M6').map(m => [m.text, m.fixAt]),
  [['Asana\'s Drive Link points to a different folder than the one linked here.', 'Asana']]);
check('M6: same folder → nothing', has(M.check(job(), ctx({ drive: { folderId: 'abc123' } })), 'M6').length, 0);

/* ---------- M7: links empty in Asana while the workspace knows them ---------- */
const noLinks = Object.assign({}, job().asana.fields, { '🛜 Elliman Link': null });
delete noLinks['🛜 Google Drive Link'];
const m7 = has(M.check(job({ asana: { fields: noLinks } }), ctx({ drive: { folderId: 'abc123', folderUrl: 'https://drive.google.com/drive/folders/abc123' } })), 'M7');
check('M7: both links to paste', m7.map(m => [m.key, m.values.paste]),
  [['M7:drive', 'https://drive.google.com/drive/folders/abc123'], ['M7:elliman', 'https://www.elliman.com/listing/x/900001']]);
check('M7: text', m7[1] && m7[1].text, 'Asana\'s Elliman Link is empty; paste https://www.elliman.com/listing/x/900001');
check('M7: nothing known → nothing', has(M.check(job({ asana: { fields: noLinks }, de: { listingUrl: null } }), ctx()), 'M7').length, 0);

/* ---------- M8: marketing steps vs the folder scan ---------- */
let m8 = has(M.check(job({ scan: { found: { floorplan: '2026-08-19' } } }), ctx()), 'M8');
check('M8: Show Sheet ticked, no showsheet in the folder', m8.map(m => [m.key, m.text, m.fixAt]),
  [['M8:showsheet', 'Create Show Sheet is ticked in Asana; no showsheet in the folder.', 'Drive']]);
check('M8: never the Just Listed email', M.check(job({ scan: { found: { floorplan: '2026-08-19', showsheet: '2026-08-24' } } }), ctx())
  .filter(m => /email/i.test(m.text)).length, 0);
const openSheet = JSON.parse(JSON.stringify(job().asana.checklist));
openSheet[0].steps[1].done = false; openSheet[0].steps[1].doneOn = null;
m8 = has(M.check(job({ asana: { checklist: openSheet }, scan: { found: { floorplan: '2026-08-19', showsheet: '2026-10-12' } } }), ctx()), 'M8');
check('M8: showsheet in the folder 8 days, step open', m8.map(m => m.text), ['Showsheet in the folder since 12 Oct; Create Show Sheet is still open in Asana.']);
check('M8: 7 days → grace', has(M.check(job({ asana: { checklist: openSheet }, scan: { found: { floorplan: '2026-08-19', showsheet: '2026-10-13' } } }), ctx()), 'M8').length, 0);
check('M8: no scan → nothing', has(M.check(job({ scan: null }), ctx()), 'M8').length, 0);
const KIT = require('../assets/js/kit-track.js');
check('M8: step patterns come from GVC_KIT.STEPS', KIT.STEPS.pieces.map(p => p[0]), ['showsheet', 'floorplan', 'photos', 'postcard']);
const withPostcard = { block: 'prep', steps: [{ name: 'Just Listed Postcard', done: true, doneOn: '2026-09-03', who: null }] };
const baseSteps = job().asana.checklist;
const nightly = pieces => job({ asana: { checklist: baseSteps.concat([withPostcard]) }, scan: { found: { floorplan: '2026-08-19', showsheet: '2026-08-24' }, pieces } });
check('M8: postcard ticked, nightly scan has no postcard file → fires',
  has(M.check(nightly({ floorplan: [{ name: 'fp.pdf', modified: '2026-08-19', archived: false }], showsheet: [{ name: 'ss.pdf', modified: '2026-08-24', archived: false }] }), ctx()), 'M8').map(m => [m.key, m.fixAt]),
  [['M8:postcard', 'Drive']]);
check('M8: postcard ticked and a postcard file → nothing',
  has(M.check(nightly({ postcard: [{ name: 'pc.pdf', modified: '2026-09-03', archived: false }] }), ctx()), 'M8').length, 0);
check('M8: postcard file 8 days old, step open, nightly scan → fires',
  has(M.check(job({ asana: { checklist: [{ block: 'prep', steps: [{ name: 'Just Listed Postcard', done: false }] }] },
    scan: { found: {}, pieces: { postcard: [{ name: 'pc.pdf', modified: '2026-10-12', archived: false }] } } }), ctx()), 'M8').map(m => [m.key, m.fixAt]),
  [['M8:postcard', 'Asana']]);
check('M8: old scan (list of pieces) never checks the postcard', has(M.check(job({ asana: { checklist: baseSteps.concat([withPostcard]) }, scan: { found: { floorplan: '2026-08-19', showsheet: '2026-08-24' }, pieces: ['floorplan', 'showsheet'] } }), ctx()), 'M8').length, 0);

/* ---------- M9: exclusive expired while Live ---------- */
check('M9: expired', has(M.check(job({ milestones: { listedOn: { on: '2026-09-01', planned: false }, exclusiveExpiresOn: { on: '2026-10-01', planned: false } } }), ctx()), 'M9')
  .map(m => m.text), ['Asana\'s exclusive expired on 1 Oct while the listing is Live. Extend it in Asana or confirm it ended.']);
check('M9: not yet expired', has(M.check(job({ milestones: { exclusiveExpiresOn: { on: '2026-12-01', planned: true } } }), ctx()), 'M9').length, 0);

/* ---------- M10: no status / address / Listing Date once Live ---------- */
const bare = Object.assign({}, job().asana.fields, { 'Listing Status': null, '🗓️ Listing Date': null });
check('M10: no status and no Listing Date', has(M.check(job({ asana: { status: null, stageFromStatus: null, fields: bare } }), ctx()), 'M10').map(m => [m.text, m.values]),
  [['Asana task has no Listing Status and no Listing Date.', { missing: ['Listing Status', 'Listing Date'] }]]);
check('M10: no street number', has(M.check(job({ asana: { name: 'Millerton House' } }), ctx()), 'M10').map(m => m.text), ['Asana task has no address.']);

/* ---------- M11: Point Person vs confirmed agents ---------- */
check('M11: differs', has(M.check(job({ core: { agentIds: ['agent-two'] } }), ctx()), 'M11').map(m => [m.text, m.fixAt]),
  [['Asana\'s Point Person is AE (Ann Example); the confirmed agents are Ben Sample.', 'Matt']]);
check('M11: Point Person a subset of the confirmed agents → nothing (69 W9)',
  has(M.check(job({ core: { agentIds: ['agent-one', 'agent-two'] } }), ctx()), 'M11').length, 0);
check('M11: Point Person names one confirmed and one other → fires',
  has(M.check(job({ core: { agentIds: ['agent-one'] }, asana: { pointPerson: 'AE/BS', fields: Object.assign({}, job().asana.fields, { '🧑‍💼 Point Person': 'AE/BS' }) } }), ctx()), 'M11').length, 1);
check('M11: no confirmed agents yet → nothing', has(M.check(job({ core: { agentIds: null } }), ctx()), 'M11').length, 0);
check('M11: ambiguous initials → nothing', has(M.check(job({ asana: { pointPerson: 'QQ' } }), ctx()), 'M11').length, 0);
const conf1 = from => ({ agentsConfirmed: { from, on: '2026-10-01', by: 'matt' } });
check('M11: confirmed from the current suggestion, other agents confirmed → nothing',
  has(M.check(job({ core: Object.assign({ agentIds: ['agent-two'] }, conf1(['agent-one'])) }), ctx()), 'M11').length, 0);
const m11c = has(M.check(job({ core: Object.assign({ agentIds: ['agent-two'] }, conf1(['agent-two'])) }), ctx()), 'M11');
check('M11: the suggestion changed since the confirmation → fires at Asana', m11c.map(m => [m.fixAt, m.values.asana, m.values.confirmedFrom]), [['Asana', ['agent-one'], ['agent-two']]]);
check('M11: text names Point Person and confirmed agents', m11c[0] && m11c[0].text,
  "Asana's Point Person is now AE (Ann Example); the confirmed agents are Ben Sample. Check the listing's agents.");
check('M11: confirmed, same set in another order → nothing',
  has(M.check(job({ asana: { pointPerson: 'AE/BS', fields: Object.assign({}, job().asana.fields, { '🧑‍💼 Point Person': 'AE/BS' }) }, core: Object.assign({ agentIds: ['agent-one'] }, conf1(['agent-two', 'agent-one'])) }), ctx()), 'M11').length, 0);

/* ---------- M12: development milestone open > 14 days past due ---------- */
const dev = { id: 'dev1', label: 'Example Dev', asana_project_gid: '1210000000000001', next_milestone: { early: [] } };
const devTask = due => ({ gid: 't1', name: 'Foundation Complete', completed: false, dueOn: due, assignee: 'Ben Sample' });
check('M12: 14 days overdue → not yet', has(M.check(dev, ctx({ asana: { tasks: [devTask('2026-10-06')] } })), 'M12').length, 0);
const m12 = has(M.check(dev, ctx({ asana: { tasks: [devTask('2026-10-05')] } })), 'M12');
check('M12: 15 days overdue → fires', m12.map(m => [m.key, m.text, m.fixAt, m.who]),
  [['M12:t1', 'Foundation Complete is open in Asana and was due on 5 Oct.', 'Asana', ['Ben Sample']]]);

/* ---------- M13: premature ticks ---------- */
const m13 = has(M.check(dev, ctx({ asana: { tasks: [
  { gid: 't2', name: 'Construction Permit Received', completed: true, completedAt: '2026-09-01T15:00:00Z', dueOn: '2026-09-01' },
  { gid: 't3', name: 'Submit permit forms', completed: false, parentGid: 't2', dueOn: '2026-08-20' }] } })), 'M13');
check('M13: parent done with an open subtask', m13.map(m => [m.key, m.text]),
  [['M13:t2', 'Construction Permit Received is ticked in Asana while 1 of its subtasks is open.']]);
check('M13: all subtasks done → nothing', has(M.check(dev, ctx({ asana: { tasks: [
  { gid: 't2', name: 'Construction Permit Received', completed: true, dueOn: '2026-09-01' },
  { gid: 't3', name: 'Submit permit forms', completed: true, parentGid: 't2' }] } })), 'M13').length, 0);
check('M13: ticked ahead of its date on a batch day', has(M.check(Object.assign({}, dev, { next_milestone: { early: [
  { gid: 't4', key: 'groundbreaking', name: 'Groundbreaking', dueOn: '2026-11-01', tickedOn: '2026-03-25' }] } }), ctx({ asana: { tasks: [] } })), 'M13').map(m => m.text),
  ['Groundbreaking was ticked in Asana on 25 Mar, ahead of its due date of 1 Nov.']);

/* ---------- M14: section vs Listing Status ---------- */
const totm = { stage: 'Off market', de_stage: null, de_listing_id: null, de: null,
  asana: { status: 'TOTM', section: '🪦 Graveyard', stageFromStatus: 'Off market', stageFromSection: 'Off market' } };
check('M14: Graveyard section, TOTM status', has(M.check(job(totm), ctx()), 'M14').map(m => [m.text, m.values]),
  [['Asana\'s section is 🪦 Graveyard but its Listing Status is TOTM.', { section: '🪦 Graveyard', status: 'TOTM' }]]);
check('M14: In Contract section, Fully Executed status → agree', has(M.check(job({ stage: 'In contract', de_stage: 'In contract',
  asana: { status: 'Fully Executed/Board Package', section: 'In Contract', stageFromStatus: 'In contract', stageFromSection: 'In contract' } }), ctx()), 'M14').length, 0);
check('M14: Leads section, Lead status → agree', M.sectionDisagrees('Lead', 'Leads', 'Pitch', 'Pitch'), false);

/* ---------- M15: Est. Listing Date passed, still Prep ---------- */
const prep = est => job({ stage: 'Prep', de_stage: null, de_listing_id: null, de: null,
  asana: { status: 'In Prep to List', section: 'In Prep to List', stageFromStatus: 'Prep', stageFromSection: 'Prep' },
  milestones: { estListingOn: { on: est, planned: est > '2026-10-20' } } });
check('M15: passed', has(M.check(prep('2026-10-15'), ctx()), 'M15').map(m => m.text), ['Asana\'s Est. Listing Date was 15 Oct; the job is still in Prep.']);
check('M15: not yet', has(M.check(prep('2026-10-25'), ctx()), 'M15').length, 0);

/* ---------- M16: Point Person is a past member ---------- */
check('M16: past initials', has(M.check(job({ asana: { pointPerson: 'AE/PX' } }), ctx()), 'M16').map(m => [m.text, m.values]),
  [['Asana\'s Point Person PX is Pat Former, who has left the team.', { initials: 'PX', name: 'Pat Former' }]]);
check('M16: a roster agent People marks as past', has(M.check(job(), ctx({ people: [{ name: 'Ann Example', past: true }] })), 'M16').length, 1);
check('M16: current member → nothing', has(M.check(job(), ctx({ people: [{ name: 'Ann Example', past: false }] })), 'M16').length, 0);

/* ---------- M17: Matt's value vs DE / Asana (GVC_FACTS.warnOf) ---------- */
const m17 = has(M.check(job({ core: { price: 2100000, facts: { price: { value: 2100000, source: 'Matt', bySource: { Matt: 2100000, DE: 2250000 } } } } }), ctx()), 'M17');
check('M17: Matt price ≠ DE price', m17.map(m => [m.key, m.text, m.values, m.fixAt]),
  [['M17:price', 'You typed $2.1M for the price; DE says $2.25M.', { field: 'price', matt: 2100000, source: 'DE', value: 2250000 }, 'Matt']]);
check('M17: Matt agrees with DE → nothing', has(M.check(job({ core: { facts: { price: { value: 2250000, source: 'Matt', bySource: { Matt: 2250000, DE: 2250000 } } } } }), ctx()), 'M17').length, 0);

/* ---------- dismiss ---------- */
const m3job = p => job({ asana: { fields: Object.assign({}, job().asana.fields, { '💵 Current Price': p }) } });
const list1 = M.check(m3job(2100000), ctx());
const dismissed = { M3: { values: { asana: 2100000, de: 2250000 }, reason: 'Agent confirmed', at: '2026-10-20' } };
check('dismiss: M3 at the same values is hidden', codes(M.applyDismissed(list1, dismissed)), []);
check('dismiss: values change → shown again', codes(M.applyDismissed(M.check(m3job(2000000), ctx()), dismissed)), ['M3']);
check('dismiss: nothing dismissed', codes(M.applyDismissed(list1, null)), ['M3']);

/* ---------- merge: since carried, found / cleared ---------- */
let mg = M.merge(null, list1, NOW);
check('merge: first found today', [mg.match.list[0].since, mg.found, mg.cleared], ['2026-10-20', ['M3'], []]);
mg = M.merge({ list: [Object.assign({}, list1[0], { since: '2026-10-01' })], dismissed }, list1, '2026-10-21T12:00:00Z');
check('merge: since kept, dismissed kept, nothing new', [mg.match.list[0].since, mg.match.dismissed.M3.reason, mg.found, mg.cleared, mg.changed],
  ['2026-10-01', 'Agent confirmed', [], [], false]);
mg = M.merge(mg.match, [], NOW);
check('merge: cleared', [mg.match.list.length, mg.cleared, mg.changed], [0, ['M3'], true]);

/* ---------- roster drift ---------- */
const people = [
  { name: 'Ann Example', section: 'Sales Agents', past: false, deProfileUrl: 'https://de/ann' },
  { name: 'Ben B. Sample', section: 'Leadership', title: 'Co-Founder', past: false, de_bio_url: 'https://de/ben' },
  { name: 'Cal Testing', section: 'Operations', past: false, deBioUrl: 'https://de/cal' },
  { name: 'Staff Designer', section: 'Marketing', title: 'Graphic Designer', past: false }
];
check('drift: all in step', M.rosterDrift(ROSTER, people), []);
const drift = M.rosterDrift(ROSTER.concat([{ id: 'agent-four', name: 'Dee Missing' }]), people.concat([{ name: 'Eve Newcomer', section: 'Partners', title: 'Licensed Salesperson', past: false }]));
check('drift: one line each way', drift, [
  { name: 'Eve Newcomer', text: 'Eve Newcomer is in Asana\'s People but not on the roster.' },
  { name: 'Dee Missing', text: 'Dee Missing is on the roster but not in Asana\'s People.' }]);
check('drift: People missing a roster agent → one line', M.rosterDrift(ROSTER, people.slice(0, 2)).map(d => d.text), ['Cal Testing is on the roster but not in Asana\'s People.']);
check('drift: past member still on the roster; no DE link', M.rosterDrift(ROSTER, [people[0], { name: 'Ben Sample', past: true, section: 'Past Team Members' },
  { name: 'Cal Testing', section: 'Operations', past: false }]).map(d => d.text),
['Ben Sample has left the team but is still on the roster.', 'Cal Testing has no DE profile link in Asana\'s People.']);
check('drift: People never read → nothing', M.rosterDrift(ROSTER, []), []);

/* ---------- tune-up B1: no status date → grace from the day it was first found ---------- */
const aoBare = { stage: 'Accepted offer', milestones: {}, asana: { status: 'Accepted Offer/Attorney Review', section: 'Accepted Offer/Attorney Review',
  stageFromStatus: 'Accepted offer', stageFromSection: 'Accepted offer', statusSince: null,
  fields: Object.assign({}, job().asana.fields, { '🗓️ AO Date': '2026-10-01' }) } };   // its AO Date is there (M23 is not under test here)
let b1 = M.check(job(aoBare), ctx());
check('B1 M1: no status date, first seen → not yet', has(b1, 'M1').length, 0);
let b1m = M.merge(null, b1, NOW);
check('B1 M1: the first-found day is stored as waiting', [b1m.match.waiting, b1m.changed], [{ M1: '2026-10-20' }, true]);
check('B1 M1: stored again a day later → kept, nothing changed', (() => { const j = job(Object.assign({}, aoBare, { match: b1m.match }));
  const r = M.merge(j.match, M.check(j, ctx({ now: '2026-10-21T16:00:00Z' })), '2026-10-21T16:00:00Z'); return [r.match.waiting, r.changed, r.found]; })(), [{ M1: '2026-10-20' }, false, []]);
check('B1 M1: 14 days after first found → still waiting', has(M.check(job(Object.assign({}, aoBare, { match: { list: [], waiting: { M1: '2026-10-06' } } })), ctx()), 'M1').length, 0);
b1 = has(M.check(job(Object.assign({}, aoBare, { match: { list: [], waiting: { M1: '2026-10-05' } } })), ctx()), 'M1');
check('B1 M1: 15 days after first found → fires, since that day', b1.map(m => [m.text, m.since, m.fixAt]), [['Asana says Accepted offer; DE still says Live.', '2026-10-05', 'DE']]);
b1m = M.merge({ list: [], waiting: { M1: '2026-10-05' } }, M.check(job(Object.assign({}, aoBare, { match: { list: [], waiting: { M1: '2026-10-05' } } })), ctx()), NOW);
check('B1 M1: once it fires it leaves waiting and keeps its since', [b1m.match.waiting || {}, b1m.match.list.map(m => m.since), b1m.found], [{}, ['2026-10-05'], ['M1']]);
b1m = M.merge({ list: [], waiting: { M1: '2026-10-05' } }, M.check(job({ match: { list: [], waiting: { M1: '2026-10-05' } } }), ctx()), NOW);
check('B1 M1: stages agree again → waiting cleared', [b1m.match.waiting || {}, b1m.changed], [{}, true]);
const liveBare = { de_listing_id: null, de: null, de_stage: null, milestones: {}, asana: { statusSince: null } };
check('B1 M2: Live, no date, first seen → not yet', has(M.check(job(liveBare), ctx()), 'M2').length, 0);
check('B1 M2: waiting stored under M2:live', M.merge(null, M.check(job(liveBare), ctx()), NOW).match.waiting, { 'M2:live': '2026-10-20' });
b1 = has(M.check(job(Object.assign({}, liveBare, { match: { list: [], waiting: { 'M2:live': '2026-10-01' } } })), ctx()), 'M2');
check('B1 M2: 19 days after first found → fires', b1.map(m => [m.key, m.text, m.since]), [['M2:live', 'Asana says Live; the listing isn\'t on DE.', '2026-10-01']]);
check('B1: a job with a status date stores no waiting', M.merge(null, M.check(job(), ctx()), NOW).match.waiting || {}, {});

/* ---------- tune-up B2: DE publishes no listing date: closing dates only ---------- */
check('B2 M5: listed dates are never compared', has(M.check(job({ de: { listedOn: '2026-09-20', listDate: '2026-09-20' } }), ctx()), 'M5').length, 0);
const soldDe = (asanaOn, deOn) => job({ stage: 'Sold', de_stage: 'Sold', asana: { status: 'Complete', section: 'Complete', stageFromStatus: 'Sold', stageFromSection: 'Sold' },
  milestones: { closedOn: { on: asanaOn, planned: false } }, de: { closeDate: deOn } });
check('B2 M5: Asana Closing vs DE closeDate in the DE snapshot', has(M.check(soldDe('2026-10-10', '2026-10-15'), ctx()), 'M5').map(m => [m.key, m.text]),
  [['M5:closedOn', 'Asana says closing on 10 Oct; DE says 15 Oct.']]);
check('B2 M5: 3 days apart → nothing', has(M.check(soldDe('2026-10-10', '2026-10-13'), ctx()), 'M5').length, 0);

/* ---------- tune-up B3: M12 for a task ticked ahead of its date ---------- */
const earlyDev = Object.assign({}, dev, { next_milestone: { early: [{ gid: 't5', key: 'permits', name: 'Permits Filed', dueOn: '2026-10-01', tickedOn: '2026-09-02' }] } });
const b3 = has(M.check(earlyDev, ctx({ asana: { tasks: [{ gid: 't5', name: 'Permits Filed', completed: true, dueOn: '2026-10-01', assignee: 'Ben Sample' }] } })), 'M12');
check('B3 M12: ticked before its date says so', b3.map(m => m.text), ['Asana shows Permits Filed ticked before its date (1 Oct); check it really happened.']);
check('B3 M12: an open task keeps its wording', has(M.check(dev, ctx({ asana: { tasks: [devTask('2026-10-05')] } })), 'M12').map(m => m.text), ['Foundation Complete is open in Asana and was due on 5 Oct.']);

/* ---------- tune-up B4: M16's key uses upper-cased initials ---------- */
check('B4 M16: initials typed lower-case → key upper-cased', has(M.check(job({ asana: { pointPerson: 'ae' } }), ctx({ people: [{ name: 'Ann Example', past: true }] })), 'M16').map(m => m.key), ['M16:AE']);

/* ---------- deepen (2026-10-21): M4's DE zero ---------- */
check('M4: DE 0 sq ft counts as blank (co-ops), never a value', has(M.check(job({ de: { sqft: 0 } }), ctx()), 'M4').length, 0);
check('M4: DE 0 baths counts as blank', has(M.check(job({ de: { baths: 0 } }), ctx()), 'M4').length, 0);
check('M4: DE 0 beds is a studio and is still compared', has(M.check(job({ de: { beds: 0 } }), ctx()), 'M4').map(m => m.values), [{ beds: { asana: 2, de: 0 } }]);

/* ---------- M18: a folder for the job is on Drive, not linked ---------- */
const CAND = 'GVC - New York/Building Information/100 Example St/4A';
const noFolder = { drive_folder: null, folder_state: 'unlinked' };
let m18 = M.check(job(Object.assign({}, noFolder, { scan: { candidate: CAND, candidateAt: '2026-10-20T06:00:00Z' } })), ctx());
check('M18: a folder found by the scan replaces M6, fix in the workspace', [has(m18, 'M6').length, has(m18, 'M18').map(m => [m.key, m.text, m.fixAt, m.values])],
  [0, [['M18', 'A folder for this job is on Drive at ' + CAND + '; link it.', 'Matt', { candidate: CAND, stage: 'Live' }]]]);
check('M18: no candidate keeps M6', [has(M.check(job(noFolder), ctx()), 'M6').length, has(M.check(job(noFolder), ctx()), 'M18').length], [1, 0]);
check('M18: a linked folder: nothing', has(M.check(job({ scan: { candidate: CAND } }), ctx()), 'M18').length, 0);
check('M18: Off market: nothing', has(M.check(job(Object.assign({}, noFolder, { stage: 'Off market', de_stage: null, de_listing_id: null, de: null, scan: { candidate: CAND },
  asana: { status: 'Listing Removed', section: 'Listing Removed', stageFromStatus: 'Off market', stageFromSection: 'Off market' } })), ctx()), 'M18').length, 0);

/* ---------- M19: probably the same listing (a GVC DE row at the building, no job) ---------- */
const deRow = o => Object.assign({ de_listing_id: '900050', feed: 'featured', kind: 'sale', gvc_listed: true, property_id: null, ignored: false,
  courtesy: 'Douglas Elliman: Ann Example', raw: { street: '100 EXAMPLE ST', unit: '3A', status: 'Active', listingUrl: 'https://www.elliman.com/listing/x/900050' } }, o || {});
const offDe = { de_listing_id: null, de: null, de_stage: null, kind: 'sale' };
let m19 = M.check(job(offDe), ctx({ deListings: [deRow()] }));
check('M19: same building, other unit, the job not on DE: one line naming both', has(m19, 'M19').map(m => [m.key, m.text, m.fixAt, m.values]),
  [['M19:900050', 'DE has 100 Example St 3A (sale, Active) with no job; this job is 4A. Probably the same listing: check the unit in Asana, or link the DE listing to this job.', 'Matt',
    { deListingId: '900050', deUnit: '3A', deKind: 'sale', unit: '4A', kind: 'sale' }]]);
check('M19: it takes the place of the job\'s M2 "isn\'t on DE" half', has(m19, 'M2').length, 0);
m19 = has(M.check(job(Object.assign({}, offDe, { core: { address: '52 E4', unit: '10FL' } })), ctx({ deListings: [deRow({ kind: 'rental', raw: { street: '52 E 4TH ST', unit: '10', status: 'ActiveUnderContract' } })] })), 'M19');
check('M19: same unit as a rental while the job is a sale', m19.map(m => m.text),
  ['DE has 52 E 4th St 10 (rental, Contract signed) with no job; this job is 10FL, a sale. Probably the same listing: check the unit in Asana, or link the DE listing to this job.']);
check('M19: a job on DE and another GVC unit in the building: nothing (two real listings)', has(M.check(job({ kind: 'sale' }), ctx({ deListings: [deRow()] })), 'M19').length, 0);
check('M19: a job on DE and the same unit on DE as the other kind: the line', has(M.check(job({ kind: 'sale' }), ctx({ deListings: [deRow({ kind: 'rental', raw: { street: '100 EXAMPLE ST', unit: '4A', status: 'Active' } })] })), 'M19').map(m => m.key), ['M19:900050']);
check('M19: another street: nothing', has(M.check(job(offDe), ctx({ deListings: [deRow({ raw: { street: '102 EXAMPLE ST', unit: '3A', status: 'Active' } })] })), 'M19').length, 0);
check('M19: a DE row already linked, set aside, or sold: nothing', [{ property_id: 'p9' }, { ignored: true }, { feed: 'transactions' }]
  .map(o => has(M.check(job(offDe), ctx({ deListings: [deRow(o)] })), 'M19').length), [0, 0, 0]);
check('M19: a row DE\'s page check did not call GVC: nothing for a job with a unit', has(M.check(job(offDe), ctx({ deListings: [deRow({ gvc_listed: false })] })), 'M19').length, 0);
const house = Object.assign({}, offDe, { core: { address: '1 Carriage Ln', unit: '' } });
check('M19: a job with no unit takes the DE row at its address even when the page check missed it', has(M.check(job(house),
  ctx({ deListings: [deRow({ gvc_listed: false, courtesy: null, raw: { street: '1 CARRIAGE LN', unit: '1118', status: 'Active' } })] })), 'M19').map(m => m.text),
  ['DE has 1 Carriage Ln 1118 (sale, Active) with no job; this job has no unit. Probably the same listing: check the unit in Asana, or link the DE listing to this job.']);
check('M19: DE\'s stray comma after the street is left out', has(M.check(job(house), ctx({ deListings: [deRow({ raw: { street: '1 CARRIAGE LN,', unit: '1118', status: 'Active' } })] })), 'M19')
  .map(m => m.text.slice(0, 26)), ['DE has 1 Carriage Ln 1118 ']);
check('M19: a Sold job: nothing', has(M.check(job(Object.assign({}, offDe, { stage: 'Sold', asana: { status: 'Complete', section: 'Complete', stageFromStatus: 'Sold', stageFromSection: 'Sold' } })),
  ctx({ deListings: [deRow()] })), 'M19').length, 0);
check('M19: no DE rows given (the page): nothing', has(M.check(job(offDe), ctx()), 'M19').length, 0);
const m19vals = has(M.check(job(offDe), ctx({ deListings: [deRow()] })), 'M19').concat([{}])[0].values;
const m19gone = M.check(job(Object.assign({}, offDe, { match: { list: [], dismissed: { 'M19:900050': { values: m19vals, reason: 'Two units' } } } })), ctx({ deListings: [deRow()] }));
check('M19 dismissed ("not the same"): the M2 half comes back', has(m19gone, 'M2').map(m => m.key), ['M2:live']);

/* ---------- M20: a workspace row with no stage at a job's address ---------- */
const lib = o => Object.assign({ id: 'lib1', slug: '100-example-st-4a-old', label: '100 Example St, Residence 4A', stage: null, core: { address: '100 Example St, Residence 4A' } }, o || {});
check('M20: same address and unit, no stage', has(M.check(job(), ctx({ library: [lib()] })), 'M20').map(m => [m.key, m.text, m.fixAt, m.values]),
  [['M20:lib1', 'Another workspace row, 100 Example St, Residence 4A, is at this address with no stage and no Asana link. Archive it if it is the same home.', 'Matt',
    { other: 'lib1', label: '100 Example St, Residence 4A' }]]);
check('M20: "6th Floor" and "Residence 6" are one unit', has(M.check(job({ core: { address: '347 West Broadway', unit: 'Residence 6' } }),
  ctx({ library: [lib({ label: '347 West Broadway, 6th Floor', core: { address: '347 West Broadway', unit: '6th Floor' } })] })), 'M20').length, 1);
check('M20: a job with no unit and a row with one (one house)', has(M.check(job({ core: { address: '1006 Pheasant Ln, Wall', unit: '' } }),
  ctx({ library: [lib({ label: '1006 Pheasant Lane #204', core: { address: '1006 Pheasant Lane', unit: '204' } })] })), 'M20').length, 1);
check('M20: a unit written into the address with # ("1006 Pheasant Lane #204")', has(M.check(job({ core: { address: '1006 Pheasant Ln, Wall', unit: '' } }),
  ctx({ library: [lib({ label: '1006 Pheasant Lane #204', core: { address: '1006 Pheasant Lane #204' } })] })), 'M20').length, 1);
check('M20: another unit: nothing', has(M.check(job(), ctx({ library: [lib({ core: { address: '100 Example St', unit: '5B' } })] })), 'M20').length, 0);
check('M20: a row with a stage, an Asana link, or the job itself: nothing', [lib({ stage: 'Live' }), lib({ asana_gid: '123' }), lib({ id: 'p1' })]
  .map(r => has(M.check(job(), ctx({ library: [r] })), 'M20').length), [0, 0, 0]);

/* ---------- M21: deal stuck in contract / at accepted offer ---------- */
const ic = o => job(Object.assign({ stage: 'In contract', de_stage: 'In contract', asana: { status: 'In Contract', section: 'In Contract', stageFromStatus: 'In contract',
  stageFromSection: 'In contract', statusSince: '2026-05-01', fields: Object.assign({}, job().asana.fields, { '🗓️ CS Date': '2026-05-01' }) } }, o || {}));
const icMs = closed => ({ listedOn: { on: '2026-03-01', planned: false }, contractOn: { on: '2026-05-01', planned: false }, closedOn: closed });
check('M21: closing date passed 8 days ago, still in contract', has(M.check(ic({ milestones: icMs({ on: '2026-10-12', planned: false }) }), ctx()), 'M21').map(m => [m.key, m.text, m.fixAt, m.values]),
  [['M21', 'Asana\'s closing date was 12 Oct and the deal is still in contract. Check it closed, or update the date in Asana.', 'Asana', { stage: 'In contract', closedOn: '2026-10-12', since: null }]]);
check('M21: closing 7 days ago: grace', has(M.check(ic({ milestones: icMs({ on: '2026-10-13', planned: false }) }), ctx()), 'M21').length, 0);
check('M21: closing ahead: nothing', has(M.check(ic({ milestones: icMs({ on: '2026-11-20', planned: true }) }), ctx()), 'M21').length, 0);
check('M21: in contract 172 days, no closing date', has(M.check(ic({ milestones: icMs(undefined) }), ctx()), 'M21').map(m => [m.text, m.values]),
  [['In contract since 1 May with no closing date in Asana, more than 120 days. Check where the deal stands.', { stage: 'In contract', closedOn: null, since: '2026-05-01' }]]);
check('M21: in contract 111 days, no closing date: nothing', has(M.check(ic({ milestones: { contractOn: { on: '2026-07-01', planned: false } } }), ctx()), 'M21').length, 0);
const aoLong = since => job({ stage: 'Accepted offer', de_stage: 'In contract', milestones: { acceptedOfferOn: { on: since, planned: false } },
  asana: { status: 'Accepted Offer/Attorney Review', section: 'Accepted Offer/Attorney Review', stageFromStatus: 'Accepted offer', stageFromSection: 'Accepted offer', statusSince: since,
    fields: Object.assign({}, job().asana.fields, { '🗓️ AO Date': since }) } });
check('M21: at accepted offer 80 days, no closing date', has(M.check(aoLong('2026-08-01'), ctx()), 'M21').map(m => m.text),
  ['At Accepted offer since 1 Aug with no closing date in Asana, more than 60 days. Check where the deal stands.']);
check('M21: at accepted offer 50 days: nothing', has(M.check(aoLong('2026-08-31'), ctx()), 'M21').length, 0);

/* ---------- M22: original price vs DE ---------- */
const priced = (a, d) => job({ asana: { fields: Object.assign({}, job().asana.fields, a) }, de: d });
check('M22: Current Price blank: Asana\'s Original vs DE\'s price', has(M.check(priced({ '💵 Current Price': null, '💵 Original Price': 2650000 }, { price: 2695000, priceChangePercent: null }), ctx()), 'M22')
  .map(m => [m.key, m.text, m.fixAt, m.values]), [['M22', 'Asana\'s Current Price is blank and its Original Price is $2.65M; DE says $2.695M.', 'Asana', { asana: 2650000, de: 2695000 }]]);
check('M22: DE\'s price history implies another original', has(M.check(priced({ '💵 Current Price': 3995000, '💵 Original Price': 4295000 }, { price: 3995000, priceChangePercent: 0 }), ctx()), 'M22')
  .map(m => [m.text, m.values]), [['Asana\'s Original Price is $4.295M; DE\'s price history starts at $3.995M.', { asana: 4295000, de: 3995000 }]]);
check('M22: DE\'s implied original matches (within 1%): nothing', has(M.check(priced({ '💵 Current Price': 900000, '💵 Original Price': 1000000 }, { price: 900000, priceChangePercent: -10 }), ctx()), 'M22').length, 0);
check('M22: 0.5% apart: nothing', has(M.check(priced({ '💵 Current Price': 1000000, '💵 Original Price': 1005000 }, { price: 1000000, priceChangePercent: 0 }), ctx()), 'M22').length, 0);
check('M22: no change percent on DE and a Current Price (NJ): nothing', has(M.check(priced({ '💵 Original Price': 1300000 }, { price: 2250000, priceChangePercent: null }), ctx()), 'M22').length, 0);
check('M22: a rental: nothing', has(M.check(Object.assign(priced({ '💵 Current Price': null, '💵 Original Price': 12000 }, { price: 12500, priceChangePercent: null }), { kind: 'rental' }), ctx()), 'M22').length, 0);
check('M22: no Original Price: nothing (M3 covers the current one)', has(M.check(priced({}, { price: 2250000, priceChangePercent: -5 }), ctx()), 'M22').length, 0);

/* ---------- M23: no date for the current stage ---------- */
const aoNoDate = since => job({ stage: 'Accepted offer', de_stage: 'In contract', asana: { status: 'Accepted Offer/Attorney Review', section: 'Accepted Offer/Attorney Review',
  stageFromStatus: 'Accepted offer', stageFromSection: 'Accepted offer', statusSince: since } });
check('M23: Accepted offer 19 days, no AO Date', has(M.check(aoNoDate('2026-10-01'), ctx()), 'M23').map(m => [m.key, m.text, m.fixAt, m.values, m.since]),
  [['M23', 'Asana says Accepted offer but has no AO Date.', 'Asana', { stage: 'Accepted offer', missing: 'AO Date' }, '2026-10-01']]);
check('M23: 5 days: grace', has(M.check(aoNoDate('2026-10-15'), ctx()), 'M23').length, 0);
check('M23: no status date: waits from the day first found', [has(M.check(aoNoDate(null), ctx()), 'M23').length, M.check(aoNoDate(null), ctx()).waiting.M23], [0, '2026-10-20']);
const icNoCs = job({ stage: 'In contract', de_stage: 'In contract', asana: { status: 'In Contract', section: 'In Contract', stageFromStatus: 'In contract', stageFromSection: 'In contract', statusSince: '2026-09-01' } });
check('M23: In contract with no CS Date', has(M.check(icNoCs, ctx()), 'M23').map(m => m.text), ['Asana says In contract but has no CS Date.']);
check('M23: In contract with its CS Date: nothing', has(M.check(ic(), ctx()), 'M23').length, 0);

/* ---------- M24: AO / CS date left behind after the deal fell back to Live ---------- */
const fellBack = (f, since) => job({ asana: { statusSince: since || '2026-09-16', fields: Object.assign({}, job().asana.fields, f) } });
check('M24: AO Date kept after going back to Live', has(M.check(fellBack({ '🗓️ AO Date': '2026-08-19' }), ctx()), 'M24').map(m => [m.key, m.text, m.fixAt, m.values]),
  [['M24', 'Asana still has an AO Date of 19 Aug, but the listing went back to Live on 16 Sep. Clear it if the deal fell through.', 'Asana',
    { aoDate: '2026-08-19', csDate: null, liveSince: '2026-09-16' }]]);
check('M24: both dates kept', has(M.check(fellBack({ '🗓️ AO Date': '2026-08-19', '🗓️ CS Date': '2026-09-01' }), ctx()), 'M24').map(m => m.text),
  ['Asana still has an AO Date of 19 Aug and a CS Date of 1 Sep, but the listing went back to Live on 16 Sep. Clear them if the deal fell through.']);
check('M24: back to Live 5 days ago: grace', has(M.check(fellBack({ '🗓️ AO Date': '2026-08-19' }, '2026-10-15'), ctx()), 'M24').length, 0);
check('M24: an AO Date after the move to Live: not this check', has(M.check(fellBack({ '🗓️ AO Date': '2026-10-01' }), ctx()), 'M24').length, 0);
check('M24: no status date: nothing', has(M.check(job({ asana: { statusSince: null, fields: Object.assign({}, job().asana.fields, { '🗓️ AO Date': '2026-08-19' }) } }), ctx()), 'M24').length, 0);

/* ---------- M25: at accepted offer or in contract in Asana, never on DE ---------- */
const dealOff = since => job(Object.assign({}, offDe, { stage: 'In contract', asana: { status: 'In Contract', section: 'In Contract', stageFromStatus: 'In contract', stageFromSection: 'In contract',
  statusSince: since, fields: Object.assign({}, job().asana.fields, { '🗓️ CS Date': '2026-09-01' }) } }));
check('M25: in contract 49 days, not on DE', has(M.check(dealOff('2026-09-01'), ctx()), 'M25').map(m => [m.key, m.text, m.fixAt, m.since]),
  [['M25', 'Asana says In contract since 1 Sep; the listing isn\'t on DE.', 'DE', '2026-09-01']]);
check('M25: 10 days: grace', has(M.check(dealOff('2026-10-10'), ctx()), 'M25').length, 0);
check('M25: no status date: waits from the day first found', [has(M.check(dealOff(null), ctx()), 'M25').length, M.check(dealOff(null), ctx()).waiting.M25], [0, '2026-10-20']);
check('M25: on DE: nothing', has(M.check(ic(), ctx()), 'M25').length, 0);
check('M25: claimed by a M19 line: nothing', has(M.check(dealOff('2026-09-01'), ctx({ deListings: [deRow()] })), 'M25').length, 0);

/* ---------- M26: zip vs DE ---------- */
const zipped = (z, d) => job({ asana: { fields: Object.assign({}, job().asana.fields, { '📍 Zip': z }) }, de: d });
check('M26: Asana\'s zip vs DE\'s', has(M.check(zipped('10011', { zip: '10021' }), ctx()), 'M26').map(m => [m.key, m.text, m.fixAt, m.values]),
  [['M26', 'Asana\'s Zip is 10011; DE says 10021.', 'Asana', { asana: '10011', de: '10021' }]]);
check('M26: DE\'s zip from its listing link when the snapshot has none', has(M.check(zipped('10011', { zip: null, listingUrl: 'https://www.elliman.com/listing/241-e-76th-st-10bcd-new-york-ny-10021/900001' }), ctx()), 'M26')
  .map(m => m.values), [{ asana: '10011', de: '10021' }]);
check('M26: same zip (a number in Asana, 07701): nothing', has(M.check(zipped(7701, { zip: '07701' }), ctx()), 'M26').length, 0);
check('M26: blank in Asana: nothing', has(M.check(zipped(null, { zip: '10021' }), ctx()), 'M26').length, 0);

/* ---------- M27: the exclusive ends within 14 days while Live ---------- */
const excl = on => job({ milestones: { listedOn: { on: '2026-09-01', planned: false }, exclusiveExpiresOn: { on: on, planned: on > '2026-10-20' } } });
check('M27: ends in 14 days', has(M.check(excl('2026-11-03'), ctx()), 'M27').map(m => [m.key, m.text, m.fixAt, m.values]),
  [['M27', 'Asana\'s exclusive ends on 3 Nov while the listing is Live. Extend it in Asana if the listing carries on.', 'Asana', { exclusiveExpiresOn: '2026-11-03' }]]);
check('M27: ends today: still a heads-up, not M9', [has(M.check(excl('2026-10-20'), ctx()), 'M27').length, has(M.check(excl('2026-10-20'), ctx()), 'M9').length], [1, 0]);
check('M27: 15 days away: nothing', has(M.check(excl('2026-11-04'), ctx()), 'M27').length, 0);
check('M27: already passed: M9, not M27', [has(M.check(excl('2026-10-19'), ctx()), 'M27').length, has(M.check(excl('2026-10-19'), ctx()), 'M9').length], [0, 1]);
check('M27: not Live: nothing', has(M.check(Object.assign(excl('2026-11-03'), { stage: 'Prep', de_stage: null }), ctx()), 'M27').length, 0);

/* ---------- text: plain sentences, no em dashes ---------- */
const all = [].concat(M.check(job({ de_stage: 'In contract', asana: { gone: NOW, pointPerson: 'PX', status: 'TOTM', section: '🪦 Graveyard' } }), ctx()));
check('no em dashes in any text', all.filter(m => /—/.test(m.text)).length, 0);

/* ---------- the key the Match page shows ---------- */
const keyCodes = Object.keys(M.KEY || {});
const want = []; for (let n = 1; n <= 27; n++) want.push('M' + n);
check('key: one plain line for every code M1 to M27', [want.every(c => typeof (M.KEY || {})[c] === 'string' && M.KEY[c].length > 10), keyCodes.length], [true, 27]);
check('key: plain sentences, no em or en dashes', keyCodes.some(c => /[–—]/.test(M.KEY[c])), false);

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
