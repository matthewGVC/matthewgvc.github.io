/* ============================================================
   Tests for assets/js/match-check.js — the Match check, M1 to M17
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
check('M2: gone', m2.map(m => [m.text, m.fixAt, m.since]), [['Asana task gone', 'Asana', '2026-10-19']]);
m2 = has(M.check(job({ de_listing_id: null, de: null, de_stage: null, asana: { statusSince: '2026-09-01' } }), ctx()), 'M2');
check('M2: Live in Asana for weeks, not on DE', m2.map(m => m.text), ['Asana says Live since 1 Sep; the listing isn\'t on DE.']);
check('M2: Live a week, not on DE yet → grace', has(M.check(job({ de_listing_id: null, de: null, de_stage: null, asana: { statusSince: '2026-10-13' } }), ctx()), 'M2').length, 0);
check('M2: DE-only listing', M.checkDeListing({ de_listing_id: '900009', gvc_listed: true, courtesy: 'Douglas Elliman: Test Agent', raw: { listingUrl: 'https://x/9' } }).text,
  'On DE, not in Asana.');
check('M2: DE listing not GVC → nothing', M.checkDeListing({ de_listing_id: '900010', gvc_listed: false }), null);

/* ---------- M3: price ---------- */
let m3 = has(M.check(job({ asana: { fields: Object.assign({}, job().asana.fields, { '💵 Current Price': 2100000 }) } }), ctx()), 'M3');
check('M3: Asana price ≠ DE price', m3.map(m => [m.text, m.values, m.fixAt]), [['Asana says $2.1M; DE says $2.25M.', { asana: 2100000, de: 2250000 }, 'Asana']]);
check('M3: same price → nothing', has(M.check(job(), ctx()), 'M3').length, 0);

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

/* ---------- M9: exclusive expired while Live ---------- */
check('M9: expired', has(M.check(job({ milestones: { listedOn: { on: '2026-09-01', planned: false }, exclusiveExpiresOn: { on: '2026-10-01', planned: false } } }), ctx()), 'M9')
  .map(m => m.text), ['Asana says the exclusive expired on 1 Oct; the job is still Live.']);
check('M9: not yet expired', has(M.check(job({ milestones: { exclusiveExpiresOn: { on: '2026-12-01', planned: true } } }), ctx()), 'M9').length, 0);

/* ---------- M10: no status / address / Listing Date once Live ---------- */
const bare = Object.assign({}, job().asana.fields, { 'Listing Status': null, '🗓️ Listing Date': null });
check('M10: no status and no Listing Date', has(M.check(job({ asana: { status: null, stageFromStatus: null, fields: bare } }), ctx()), 'M10').map(m => [m.text, m.values]),
  [['Asana task has no Listing Status and no Listing Date.', { missing: ['Listing Status', 'Listing Date'] }]]);
check('M10: no street number', has(M.check(job({ asana: { name: 'Millerton House' } }), ctx()), 'M10').map(m => m.text), ['Asana task has no address.']);

/* ---------- M11: Point Person vs confirmed agents ---------- */
check('M11: differs', has(M.check(job({ core: { agentIds: ['agent-two'] } }), ctx()), 'M11').map(m => [m.text, m.fixAt]),
  [['Asana\'s Point Person is AE (Ann Example); the confirmed agents are Ben Sample.', 'Matt']]);
check('M11: no confirmed agents yet → nothing', has(M.check(job({ core: { agentIds: null } }), ctx()), 'M11').length, 0);
check('M11: ambiguous initials → nothing', has(M.check(job({ asana: { pointPerson: 'QQ' } }), ctx()), 'M11').length, 0);

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

/* ---------- text: plain sentences, no em dashes ---------- */
const all = [].concat(M.check(job({ de_stage: 'In contract', asana: { gone: NOW, pointPerson: 'PX', status: 'TOTM', section: '🪦 Graveyard' } }), ctx()));
check('no em dashes in any text', all.filter(m => /—/.test(m.text)).length, 0);

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
