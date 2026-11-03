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
check('a closing this week is under Deal dates, once, not on the agenda', [one.counts.contract, one.counts.upcoming, /Deal dates[\s\S]*4 Nov[\s\S]*1 Test St[\s\S]*Closing/.test(one.html), one.html.split('>1 Test St<').length - 1], [1, 1, true, 1]);
const errs = R.build({ properties: [prop({ match: { list: [{ code: 'M3', key: 'M3', text: 'x', since: '2026-10-01' }, { code: 'M4', key: 'M4', text: 'y' }] } })] }, { today: '2026-11-02' });
check('one error count: the head figure and the agenda line agree', [errs.counts.errors, /1 of the 2 on the Errors page/.test(errs.html)], [2, true]);
check('another market\'s edition leaves it out', R.build({ properties: [prop()] }, { today: '2026-11-02', market: 'NYC' }).counts.contract, 0);
check('no banned words', /\bDE\b|helper/.test(R.build({ properties: [prop({ match: { list: [{ code: 'M3', key: 'M3', text: 'Asana says $1; DE says $2.' }] } })] }, { today: '2026-11-02' }).html), false);
const n = R.build({ properties: [prop()], changes: [{ property_id: 'p1', at: '2026-11-01T10:00:00Z', field: null, note: 'Buyer\'s lender asked for the appraisal' },
  { property_id: 'p1', at: '2026-11-01T11:00:00Z', field: 'piece:showsheet', new_value: 'x.pdf', note: 'Showsheet made' }] }, { today: '2026-11-02' });
check('notes under What changed; pieces made under Marketing', [/What changed this week[\s\S]*appraisal/.test(n.html), /Made this week[\s\S]*1 Test St/.test(n.html), /x\.pdf/.test(n.html)], [true, true, false]);

/* sending: the raw message, the Sunday slot, and one send to Matt */
const G = require('../helper/mail/gmail.js');
const raw = G.mime({ to: ['matthew@gvcrealestateteam.com'], subject: 'GVC week to 8 Nov · New Jersey', html: '<p>Hi</p>' });
check('the message: from GVC Workspace at Matt address, replies to Matt, the subject encoded', [/^From: GVC Workspace <matthew@gvcrealestateteam.com>/.test(raw), /Reply-To: matthew@gvcrealestateteam.com/.test(raw),
  /Subject: =\?UTF-8\?B\?/.test(raw), Buffer.from(raw.split('\r\n\r\n')[1], 'base64').toString()], [true, true, true, '<p>Hi</p>']);
const { due } = require('../helper/schedule.js');
const at = s => new Date(s), ran = { de: at('2026-11-08T07:00:00'), scan: at('2026-11-08T02:00:00'), backup: at('2026-11-08T02:30:00') };
check('Sunday 18:00: the email is due once, and not before, nor on Monday', [
  due(at('2026-11-08T17:59:00'), ran, { weekly: true }), due(at('2026-11-08T18:01:00'), ran, { weekly: true }),
  due(at('2026-11-08T18:30:00'), Object.assign({ weekly: at('2026-11-08T18:01:00') }, ran), { weekly: true }),
  due(at('2026-11-09T19:00:00'), Object.assign({}, ran, { de: at('2026-11-09T07:00:00'), scan: at('2026-11-09T02:00:00'), backup: at('2026-11-09T02:30:00') }), { weekly: true }),
  due(at('2026-11-08T18:01:00'), ran, {})], [[], ['weekly'], [], [], []]);
(async () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-')), sent = [];
  const db = { select: async t => t === 'properties' ? [prop()] : [] };
  const r = await R.sendWeekly({ cfg: { home }, client: db, mail: { send: async m => { sent.push(m); return 'id1'; } }, today: '2026-11-02' });
  check('sendWeekly: one email, to Matt alone, and the time kept', [sent.length, sent[0].to, /1 Test St/.test(sent[0].html), r.id, !!R.lastSent({ home })], [1, ['matthew@gvcrealestateteam.com'], true, 'id1', true]);
  await R.sendWeekly({ cfg: { home, weeklyTo: ['a@x.com', 'b@x.com'] }, client: db, mail: { send: async m => { sent.push(m); return 'id2'; } }, today: '2026-11-02' });
  check('weeklyTo in the config adds people', sent[1].to, ['a@x.com', 'b@x.com']);
  console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
  process.exit(fail ? 1 : 0);
})();
