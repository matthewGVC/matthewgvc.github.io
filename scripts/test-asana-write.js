/* ============================================================
   The team's edits going to Asana (helper/asana-write.js, migration 0021,
   overhaul step 5).
     node scripts/test-asana-write.js
   ============================================================ */
const fs = require('fs'), path = require('path');
const AW = require('../helper/asana-write.js');
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('  FAIL ' + name + '\n      expected ' + JSON.stringify(want) + '\n      got      ' + JSON.stringify(got));
}
const err = f => { try { f(); return null; } catch (e) { return e.message; } };

/* values, by the Asana field's type */
const num = { gid: 'f1', name: '💵 Current Price', resource_subtype: 'number' };
check('a price goes as a number', [AW.valueFor(num, 2250000), AW.valueFor(num, '$2,250,000')], [2250000, 2250000]);
check('words in a number field are refused plainly', err(() => AW.valueFor(num, 'call us')), 'Asana\'s 💵 Current Price takes a number, not "call us".');
check('text goes as text; a list as lines', [AW.valueFor({ name: 'Listing Copy', resource_subtype: 'text' }, 'Bright'), AW.valueFor({ name: 'x', resource_subtype: 'text' }, ['a', 'b'])], ['Bright', 'a\nb']);
const en = { name: '📍 County', resource_subtype: 'enum', enum_options: [{ gid: 'o1', name: 'Monmouth', enabled: true }, { gid: 'o2', name: 'Ocean', enabled: false }] };
check('a choice goes as its option', AW.valueFor(en, ' monmouth '), 'o1');
check('a choice Asana lacks (or has switched off) is refused', [err(() => AW.valueFor(en, 'Bergen')), err(() => AW.valueFor(en, 'Ocean'))],
  ['Asana\'s 📍 County has no choice "Bergen".', 'Asana\'s 📍 County has no choice "Ocean".']);
check('no value: nothing to write', err(() => AW.valueFor(num, null)), 'There is no value to write.');

/* the run: take each waiting row, set the field, mark it */
function fakeDb(rows) {
  const log = [];
  return { log, rows,
    select: async (t, m) => rows.filter(r => r.status === m.status),
    update: async (t, m, patch) => {
      const hit = rows.filter(r => Object.keys(m).every(k => r[k] === m[k]));
      hit.forEach(r => Object.assign(r, patch)); log.push([m.id, patch.status]); return hit;
    } };
}
const TASK = { gid: 't1', custom_fields: [{ gid: 'cf1', name: '💵 Current Price', resource_subtype: 'number' }, { gid: 'cf2', name: 'Listing Copy', resource_subtype: 'text' }] };
(async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ method: init.method, url: url.replace('https://app.asana.com/api/1.0', ''), body: init.body ? JSON.parse(init.body) : null, auth: init.headers.authorization });
    if (/\/tasks\/gone/.test(url)) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => ({ data: init.method === 'GET' ? TASK : {} }) };
  };
  const db = fakeDb([
    { id: 'w1', status: 'waiting', task_gid: 't1', field: 'price', asana_field: '💵 Current Price', value: 2250000 },
    { id: 'w2', status: 'waiting', task_gid: 'gone', field: 'price', asana_field: '💵 Current Price', value: 1 },
    { id: 'w3', status: 'waiting', task_gid: 't1', field: 'zip', asana_field: '📍 Zip', value: '07730' },
    { id: 'w4', status: 'waiting', task_gid: 't1', field: 'stage', asana_field: 'Listing Status', value: 'Sold' },
    { id: 'w5', status: 'done', task_gid: 't1', field: 'price', asana_field: '💵 Current Price', value: 9 }]);
  const r = await AW.writeWaiting({ db, cfg: { asanaToken: 'tok' }, fetch });
  check('one written, three failed, the finished one left alone', [r, db.rows.map(x => x.status)], [{ done: 1, failed: 3 }, ['done', 'failed', 'failed', 'failed', 'done']]);
  check('the write: the field on the task, with the token', calls.filter(c => c.method === 'PUT'), [{ method: 'PUT', url: '/tasks/t1', body: { data: { custom_fields: { cf1: 2250000 } } }, auth: 'Bearer tok' }]);
  check('the reasons are plain', db.rows.slice(1, 4).map(x => x.error), ['The Asana task is gone', 'The Asana task has no 📍 Zip field.', 'The workspace doesn\'t write Asana\'s Listing Status.']);
  check('a field outside the list never reaches Asana', calls.some(c => /Listing Status/.test(JSON.stringify(c))), false);
  check('no token: nothing is asked', await AW.writeWaiting({ db: fakeDb([{ id: 'x', status: 'waiting' }]), cfg: {}, fetch: () => { throw new Error('asked'); } }), { done: 0, failed: 0 });

  /* the writer is the only helper file that changes Asana */
  const dir = path.join(__dirname, '..', 'helper');
  const writers = fs.readdirSync(dir).filter(f => f.endsWith('.js')).filter(f => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    return /app\.asana\.com/.test(src) && /\b(PUT|POST|PATCH|DELETE)\b/.test(src);
  });
  check('only asana-write.js writes to Asana', writers, ['asana-write.js']);
  check('the list matches 0021\'s', AW.FIELDS.every(f => fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0021_team_edits_asana.sql'), 'utf8').includes("'" + f + "'")), true);

  console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
  process.exit(fail ? 1 : 0);
})();
