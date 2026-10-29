/* ============================================================
   Tests for assets/js/dev-build.js: a development's work items, totals and
   Needs attention (D114). Made-up figures only.

     node scripts/test-dev-build.js
   ============================================================ */
'use strict';

const B = require('../assets/js/dev-build.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const TODAY = '2026-10-29';
const schedule = { tasks: [
  { gid: 'p1', name: 'Groundbreaking', section: 'Construction', milestone: true, dueOn: '2026-05-04', completed: true },
  { gid: 'p2', name: 'Site Work', section: 'Construction', dueOn: '2026-06-01', completed: false },
  { gid: 'w1', name: 'Excavation', parentGid: 'p2', startOn: '2026-05-04', dueOn: '2026-05-08', completed: true },
  { gid: 'w2', name: 'Roofing', parentGid: 'p2', startOn: '2026-09-01', dueOn: '2026-10-14', completed: false },
  { gid: 'w3', name: 'Stairs', parentGid: 'p2', dueOn: '2026-11-05', completed: false },
  { gid: 'w4', name: 'Paint', parentGid: 'w3', dueOn: '2026-12-20', completed: false },
  { gid: 'p3', name: 'Cleanup', section: 'Closeout', completed: false }
] };
const budget = {
  lines: [
    { name: 'Architect', estimate: 10000, actual: 6000, upgrade: false },
    { name: 'Lumber', estimate: 40000, actual: 52500, upgrade: false },
    { name: 'Mason', estimate: 14500, actual: 18000, upgrade: false },
    { name: 'Inspections', estimate: null, actual: 300, upgrade: false },
    { name: 'Landscaping', estimate: null, actual: null, upgrade: false },
    { name: 'Pool', estimate: 30000, actual: null, upgrade: true }
  ],
  sheetTotal: { estimate: 64500, actual: 70000, remaining: null },
  payments: [{ amount: 6000, receipt: true }, { amount: 52500, receipt: false }]
};

const items = B.workItems(schedule);
check('work items are the leaves', items.map(t => t.gid), ['p1', 'w1', 'w2', 'w4', 'p3']);
check('a work item takes its top task\'s section and its parent\'s name', [items[3].section, items[3].parentName, items[0].parentName], ['Construction', 'Stairs', null]);
check('no schedule, no items', B.workItems(null), []);
check('status', items.map(t => B.statusOf(t, TODAY)), ['done', 'done', 'late', 'open', 'undated']);
check('due within 14 days is soon', B.statusOf({ dueOn: '2026-11-12' }, TODAY), 'soon');

const base = B.totals(budget, false), all = B.totals(budget, true);
check('base totals leave the upgrades out', [base.lines.length, base.estimate, base.actual, base.remaining], [5, 64500, 76800, -12300]);
check('with upgrades', [all.lines.length, all.estimate, all.remaining], [6, 94500, 17700]);
check('payments and missing receipts', [base.payments, base.missingReceipts], [2, 1]);

const a = B.attention(schedule, budget, TODAY);
check('over estimate, largest first', a.over.map(o => [o.name, o.by, o.pct]), [['Lumber', 12500, 31.3], ['Mason', 3500, 24.1]]);
check('spending with no estimate', a.noEstimate, [{ name: 'Inspections', actual: 300 }]);
check('open lines with no estimate', a.unestimated, ['Landscaping']);
check('past target, not done', a.late.map(t => t.name), ['Roofing']);
check('nothing due in the next 14 days', a.soon, []);
check('the sheet\'s TOTAL row is off from its lines', a.sheetDiff, { field: 'actual', sheet: 70000, sum: 76800 });
check('a TOTAL row within a dollar is fine', B.attention(null, Object.assign({}, budget, { sheetTotal: { estimate: 64500.4, actual: 76800 } }), TODAY).sheetDiff, null);
check('nothing at all', B.attention(null, null, TODAY), { over: [], noEstimate: [], unestimated: [], late: [], soon: [], sheetDiff: null, missingReceipts: 0 });

check('csv quotes what needs it', B.csv([{ name: 'Roofing, siding "and" gutters', section: 'Construction', startOn: null, dueOn: '2026-10-14', completed: false, milestone: false }]),
  'Work item,Section,Start,Target,Done,Milestone\r\n"Roofing, siding ""and"" gutters",Construction,,2026-10-14,no,no\r\n');

check('current phase: the first open construction task, milestones skipped', B.currentPhase(schedule), { name: 'Site Work', section: 'Construction' });
check('current phase: every phase done', B.currentPhase({ tasks: [{ gid: 'a', name: 'Framing', section: '3. Construction', completed: true }] }), null);
check('current phase: no construction section falls back to the whole schedule',
  B.currentPhase({ tasks: [{ gid: 'a', name: 'Design ', section: 'Planning', completed: false }] }), { name: 'Design', section: 'Planning' });
check('section label drops the number', [B.sectionLabel('3. Construction'), B.sectionLabel('Closeout'), B.sectionLabel(null)], ['Construction', 'Closeout', '']);

check('planned: what the lines under their estimate have left, overruns at $0', [B.totals(budget, false).planned, B.totals(budget, true).planned], [4000, 34000]);

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
