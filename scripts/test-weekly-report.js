/* ============================================================
   The Sunday email's builder (helper/weekly-report.js, overhaul step 3).
     node scripts/test-weekly-report.js
   ============================================================ */
const R = require('../helper/weekly-report.js');
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('  FAIL ' + name + '\n      expected ' + JSON.stringify(want) + '\n      got      ' + JSON.stringify(got));
}
const prop = (o) => Object.assign({ id: 'p1', slug: '1-test-st', label: '1 Test St', kind: 'sale', market: 'NJ', stage: 'In contract', core: { address: '1 Test St' },
  milestones: { contractOn: { on: '2026-10-01' }, closedOn: { on: '2026-11-04' } }, match: { list: [] }, version: 1 }, o);
const empty = R.build({}, { today: '2026-11-08' });
check('empty: a subject and zero counts', [empty.subject, empty.counts], ['GVC week to 8 Nov', { live: 0, contract: 0, closed: 0, upcoming: 0, agenda: 0, errors: 0 }]);
const one = R.build({ properties: [prop()] }, { today: '2026-11-02' });
check('a closing this week is on the agenda and in Closing soon', [one.counts.contract, one.counts.upcoming, /This week.*1 Test St.*closing 4 Nov/.test(one.html)], [1, 1, true]);
check('another market\'s edition leaves it out', R.build({ properties: [prop()] }, { today: '2026-11-02', market: 'NYC' }).counts.contract, 0);
check('no banned words', /\bDE\b|helper/.test(R.build({ properties: [prop({ match: { list: [{ code: 'M3', key: 'M3', text: 'Asana says $1; DE says $2.' }] } })] }, { today: '2026-11-02' }).html), false);
const n = R.build({ properties: [prop()], changes: [{ property_id: 'p1', at: '2026-11-01T10:00:00Z', field: null, note: 'Buyer\'s lender asked for the appraisal' },
  { property_id: 'p1', at: '2026-11-01T11:00:00Z', field: 'piece:showsheet', new_value: 'x.pdf', note: 'Showsheet made' }] }, { today: '2026-11-02' });
check('notes under What changed; pieces made under Marketing', [/What changed this week[\s\S]*appraisal/.test(n.html), /Made this week[\s\S]*1 Test St/.test(n.html), /x\.pdf/.test(n.html)], [true, true, false]);
console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
