/* ============================================================
   Tests for the Asana name fix (helper/asana-name-fix.js, stage 2 Task 7):
   the plan (planFixes), the writer (fixNames, off unless the helper config
   says asanaNameFix: true), the dry run and the runner's wiring. A fake
   Asana and an in-memory database only: nothing here reaches the real
   Asana or the real Supabase. Made-up addresses, or past listings the plan names.

   Plain Node:  node scripts/test-asana-name-fix.js
   ============================================================ */
'use strict';

// never this computer's own helper settings
process.env.GVC_HELPER_HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gvc-name-fix-'));
const fs = require('fs'), path = require('path'), os = require('os');
// a real request from this file is a failure, never a call to Asana
globalThis.fetch = async () => { throw new Error('a real fetch was made'); };
const NF = require('../helper/asana-name-fix.js');
const { asanaJobs } = require('../helper/runner.js');
const { DEFAULTS } = require('../helper/config.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const HOOD = '📍 City/Hood';
let seq = 0;
/* a properties row as the sync leaves it */
function deal(name, o) {
  o = o || {};
  const gid = o.gid || 'g' + (++seq);
  return Object.assign({ id: 'p-' + gid, asana_gid: gid, dev_project_id: null, market: 'NYC', kind: 'sale', side: 'list', stage: 'Active',
    place_id: null, created_at: '2026-01-01T00:00:00Z', label: name.trim(), core: {},
    asana: { gid, name, fields: { [HOOD]: o.hood === undefined ? null : o.hood } } }, o.row || {});
}

/* the in-memory database (the fakeDb pattern of test-asana-sync.js) */
function fakeDb(seed) {
  const T = { properties: [], changes: [] };
  Object.keys(seed || {}).forEach(k => { T[k] = seed[k].map(r => JSON.parse(JSON.stringify(r))); });
  const copy = x => JSON.parse(JSON.stringify(x));
  const matches = (row, m) => Object.keys(m || {}).every(k => String(row[k]) === String(m[k]));
  const db = {
    T, writes: [],
    ready: () => true,
    select: async (t, m) => (T[t] || []).filter(r => matches(r, m)).map(copy),
    insert: async (t, rows) => { db.writes.push(['insert', t]); [].concat(rows).forEach(r => T[t].push(copy(r))); return [].concat(rows).map(copy); },
    update: async (t, m, patch) => { db.writes.push(['update', t]); const hit = (T[t] || []).filter(r => matches(r, m)); hit.forEach(r => Object.assign(r, copy(patch))); return hit.map(copy); },
    upsert: async (t) => { db.writes.push(['upsert', t]); return []; }
  };
  return db;
}

/* a fake Asana: tasks by gid, each call recorded; fail: gids that answer 500 */
function fakeAsana(tasks, fail) {
  const calls = [];
  const fetch = async (url, init) => {
    const p = String(url).replace('https://app.asana.com/api/1.0', '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, path: p, body, auth: init.headers.authorization });
    const gid = decodeURIComponent((/^\/tasks\/([^/?]+)/.exec(p) || [])[1] || '');
    if ((fail || []).indexOf(gid) !== -1) return { ok: false, status: 500 };
    const t = tasks[gid];
    if (!t) return { ok: false, status: 404 };
    const ok = data => ({ ok: true, status: 200, json: async () => ({ data }) });
    if (init.method === 'GET') return ok(JSON.parse(JSON.stringify(t)));
    if (init.method === 'PUT') {
      if (body.data.name) t.name = body.data.name;
      Object.keys(body.data.custom_fields || {}).forEach(g => { const f = t.custom_fields.find(x => x.gid === g); if (f) f.display_value = body.data.custom_fields[g]; });
      return ok({ gid });
    }
    if (init.method === 'POST') return ok({ gid: 's1' });
    return { ok: false, status: 400 };
  };
  return { fetch, calls };
}
const task = (name, hood) => ({ name, custom_fields: [{ gid: 'cfHood', name: HOOD, resource_subtype: 'text', display_value: hood || null },
  { gid: 'cfPrice', name: '💵 Current Price', resource_subtype: 'number', display_value: '1' }] });
const ON = { asanaToken: 'tok', asanaNameFix: true };
const NOW = new Date('2026-11-06T15:00:00Z');

(async () => {
  /* ---------- planFixes ---------- */
  let p = NF.planFixes([deal('200 E 57 - 17A', { gid: 'a1' })]);
  check('planFixes: a sure fix', p, { fixes: [{ gid: 'a1', propertyId: 'p-a1', from: '200 E 57 - 17A', to: '200 E57 - 17A', town: null, why: null }], left: [] });

  p = NF.planFixes([deal('512 Laurel Rd, Oakton', { gid: 'a2', row: { market: 'NJ' } })]);
  check('planFixes: an empty City/Hood is filled', p.fixes.map(f => [f.to, f.town]), [['512 Laurel Rd', 'Oakton']]);
  p = NF.planFixes([deal('512 Laurel Rd, Oakton', { gid: 'a2b', hood: 'Oakton', row: { market: 'NJ' } })]);
  check('planFixes: a City/Hood already holding the town is not filled', p.fixes.map(f => [f.to, f.town]), [['512 Laurel Rd', null]]);

  p = NF.planFixes([deal('200 E57 - 17A', { gid: 'a3' }), deal('401 Brown St', { gid: 'a3b', hood: 'Brielle', row: { market: 'NJ' } })]);
  check('planFixes: a rule name is left alone', p, { fixes: [], left: [] });
  check('planFixes: stray spaces alone are not a fix', NF.planFixes([deal('200 E57 - 17A ', { gid: 'a3c' })]), { fixes: [], left: [] });

  p = NF.planFixes([deal('444 Spruce - C609', { gid: 'a4' })]);
  check('planFixes: an unsure name is left for Matt', p, { fixes: [], left: [{ gid: 'a4', propertyId: 'p-a4', name: '444 Spruce - C609', why: 'the street has no street type at the end' }] });
  check('planFixes: a price is left for Matt', NF.planFixes([deal('182 Rumson rd, rumson $3.5', { gid: 'a4b', row: { market: 'NJ' } })]).left.map(l => l.why), ['it has a price in it']);

  p = NF.planFixes([deal('200 E 57 - 17A', { gid: 'a5' }), deal('444 Spruce - C609', { gid: 'a5b' }), deal('300 E 57 - 2A', { gid: 'a5c' })], { skip: ['a5', 'a5b'] });
  check('planFixes: Matt\'s no holds', [p.fixes.map(f => f.gid), p.left.map(l => l.gid)], [['a5c'], []]);

  p = NF.planFixes([deal('106 CPS - 8A', { gid: 'a6', row: { kind: 'rental' } })]);
  check('planFixes: a rental gets (Rental)', p.fixes.map(f => f.to), ['106 CPS - 8A (Rental)']);

  p = NF.planFixes([
    deal('401 Brown st, Brielle', { gid: 'b1', hood: 'Brielle', row: { market: 'NJ', side: 'buy', place_id: 'pl1', created_at: '2025-03-01T00:00:00Z' } }),
    deal('401 Brown St, Brielle', { gid: 'b2', hood: 'Brielle', row: { market: 'NJ', side: 'list', place_id: 'pl1', created_at: '2026-05-01T00:00:00Z' } })]);
  check('planFixes: the newest deal\'s name wins', p.fixes.map(f => [f.gid, f.to]), [['b1', '401 Brown St'], ['b2', '401 Brown St']]);
  p = NF.planFixes([
    deal('225 E 79 - pha', { gid: 'b3', row: { place_id: 'plP', created_at: '2024-03-01T00:00:00Z' } }),
    deal('225 E79 - PHA', { gid: 'b4', row: { place_id: 'plP', created_at: '2026-05-01T00:00:00Z' } }),
    deal('225 East 79th Street - PHA', { gid: 'b5', row: { side: 'buy', place_id: 'plP', created_at: '2026-09-01T00:00:00Z' } })]);
  check('planFixes: the newest list-side deal spelling wins over the deal own spelling', p.fixes.map(f => [f.gid, f.to]), [['b3', '225 E79 - PHA'], ['b5', '225 E79 - PHA']]);
  p = NF.planFixes([
    deal('106 Example Ave - 3', { gid: 'c1', row: { place_id: 'pl2', created_at: '2026-06-01T00:00:00Z' } }),
    deal('106 Example Avenue - 3', { gid: 'c2', row: { kind: 'rental', place_id: 'pl2', created_at: '2025-01-01T00:00:00Z' } })]);
  check('planFixes: a rental on the place takes the newest name plus (Rental)', p.fixes.map(f => [f.gid, f.to]), [['c2', '106 Example Ave - 3 (Rental)']]);
  p = NF.planFixes([
    deal('10 Elm St - 2', { gid: 'd1', row: { market: 'NJ', place_id: 'pl3', created_at: '2026-06-01T00:00:00Z' } }),
    deal('12 Elm Street - 4', { gid: 'd2', row: { market: 'NJ', place_id: 'pl3', created_at: '2025-01-01T00:00:00Z' } })]);
  check('planFixes: deals that parse as different places keep their own answers', p.fixes.map(f => [f.gid, f.to]), [['d2', '12 Elm St - 4']]);

  p = NF.planFixes([deal('200 E 57 - 17A', { gid: 'e1', row: { stage: 'Archived' } }), deal('300 E 57 - 2A', { gid: 'e2', row: { stage: null } })]);
  check('planFixes: an archived deal is renamed too', p.fixes.map(f => f.gid), ['e1']);
  check('planFixes: a row with no stage is not', p.fixes.concat(p.left).some(f => f.gid === 'e2'), false);
  check('planFixes: a row with no Asana task is not', NF.planFixes([deal('200 E 57 - 17A', { row: { asana_gid: null } })]), { fixes: [], left: [] });

  /* ---------- fixNames ---------- */
  {
    const fa = fakeAsana({ a1: task('200 E 57 - 17A') });
    const db = fakeDb({ properties: [deal('200 E 57 - 17A', { gid: 'a1' })] });
    const r1 = await NF.fixNames({ db, cfg: { asanaToken: 'tok' }, fetch: fa.fetch, now: NOW });
    const r2 = await NF.fixNames({ db, cfg: { asanaNameFix: true }, fetch: fa.fetch, now: NOW });
    check('fixNames: off by default (no fetch at all)', [r1, r2, fa.calls.length, db.writes.length], [{ done: 0, failed: 0, skipped: 0 }, { done: 0, failed: 0, skipped: 0 }, 0, 0]);
    check('the shipped config keeps it off', [DEFAULTS.asanaNameFix, DEFAULTS.nameFixSkip], [false, []]);
  }
  {
    const fa = fakeAsana({ f1: task('512 Laurel Rd, Oakton') });
    const db = fakeDb({ properties: [deal('512 Laurel Rd, Oakton', { gid: 'f1', row: { market: 'NJ' } })] });
    const r = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: renames, fills City/Hood, comments, logs (result)', r, { done: 1, failed: 0, skipped: 0 });
    check('fixNames: the calls, in order', fa.calls.map(c => [c.method, c.path.split('?')[0], c.body]), [
      ['GET', '/tasks/f1', null],
      ['PUT', '/tasks/f1', { data: { name: '512 Laurel Rd', custom_fields: { cfHood: 'Oakton' } } }],
      ['POST', '/tasks/f1/stories', { data: { text: 'Renamed to "512 Laurel Rd" to match the GVC naming rule; Oakton moved to City/Hood.' } }]]);
    check('fixNames: the GET asks for the name and the fields', decodeURIComponent(fa.calls[0].path.split('opt_fields=')[1]),
      'name,custom_fields.name,custom_fields.type,custom_fields.resource_subtype,custom_fields.enum_options.name,custom_fields.enum_options.enabled,custom_fields.display_value');
    check('fixNames: the token goes in the header', fa.calls.every(c => c.auth === 'Bearer tok'), true);
    const ch = db.T.changes.map(c => { const x = Object.assign({}, c); delete x.at; return x; });
    check('fixNames: one changes row, source Helper', ch, [{ property_id: 'p-f1', field: 'asana name', old_value: '512 Laurel Rd, Oakton', new_value: '512 Laurel Rd',
      note: 'Renamed in Asana by the helper (naming rule)', source: 'Helper' }]);
    check('fixNames: it writes no other table', db.writes, [['insert', 'changes']]);
  }
  {
    const fa = fakeAsana({ f2: task('512 Laurel Rd, Oakton', 'Oakton') });
    const db = fakeDb({ properties: [deal('512 Laurel Rd, Oakton', { gid: 'f2', row: { market: 'NJ' } })] });
    const r = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    const put = fa.calls.find(c => c.method === 'PUT');
    check('fixNames: a City/Hood already filled is not written', [r.done, put && put.body, fa.calls.find(c => c.method === 'POST').body.data.text],
      [1, { data: { name: '512 Laurel Rd' } }, 'Renamed to "512 Laurel Rd" to match the GVC naming rule.']);
  }
  {
    const fa = fakeAsana({ f2b: task('512 Laurel Rd, Oakton', 'Elmwood') });
    const db = fakeDb({ properties: [deal('512 Laurel Rd, Oakton', { gid: 'f2b', row: { market: 'NJ' } })] });
    const r = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: a City/Hood filled meanwhile with another town is skipped', [r, fa.calls.map(c => c.method)], [{ done: 0, failed: 0, skipped: 1 }, ['GET']]);
  }
  {
    const fa = fakeAsana({ f3: task('200 E 57 - 17B') });
    const db = fakeDb({ properties: [deal('200 E 57 - 17A', { gid: 'f3' })] });
    const r = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: a name changed meanwhile is skipped', [r, fa.calls.map(c => c.method), db.writes], [{ done: 0, failed: 0, skipped: 1 }, ['GET'], []]);
  }
  {
    const fa = fakeAsana({ f4: task('404 Park S - 6A '), f5: task('315 Foreman Ave, Point Pleasant Beach  (House 1)') });
    const db = fakeDb({ properties: [deal('404 Park S - 6A ', { gid: 'f4' }),
      deal('315 Foreman Ave, Point Pleasant Beach  (House 1)', { gid: 'f5', hood: 'Point Pleasant Beach', row: { market: 'NJ' } })] });
    const r = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: stray spaces aren\'t a change', [r, fa.calls.filter(c => c.method === 'PUT').map(c => c.body.data.name)],
      [{ done: 2, failed: 0, skipped: 0 }, ['404 PAS - 6A', '315 Foreman Ave (House 1)']]);
  }
  {
    const fa = fakeAsana({ f6: task('106 CPS - 8A (Rental)') });
    const db = fakeDb({ properties: [deal('106 CPS - 8A', { gid: 'f6', row: { kind: 'rental' } })] });
    const r = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: a fix already made isn\'t made twice', [r, fa.calls.map(c => c.method), db.writes], [{ done: 0, failed: 0, skipped: 1 }, ['GET'], []]);
  }
  {
    // a mix: every write is the name, City/Hood or one comment
    const tasks = { g1: task('200 E 57 - 17A'), g2: task('512 Laurel Rd, Oakton'), g3: task('106 CPS - 8A'), g4: task('10 Elm Street - 2, Oakton') };
    const fa = fakeAsana(tasks);
    const db = fakeDb({ properties: [deal('200 E 57 - 17A', { gid: 'g1' }), deal('512 Laurel Rd, Oakton', { gid: 'g2', row: { market: 'NJ' } }),
      deal('106 CPS - 8A', { gid: 'g3', row: { kind: 'rental' } }), deal('10 Elm Street - 2, Oakton', { gid: 'g4', row: { market: 'NJ' } })] });
    await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    const writes = fa.calls.filter(c => c.method !== 'GET');
    check('fixNames: only name, City/Hood and one comment are ever sent', [
      writes.every(c => (c.method === 'PUT' && /^\/tasks\/g\d$/.test(c.path)) || (c.method === 'POST' && /^\/tasks\/g\d\/stories$/.test(c.path))),
      writes.filter(c => c.method === 'PUT').every(c => Object.keys(c.body.data).every(k => k === 'name' || k === 'custom_fields')
        && Object.keys(c.body.data.custom_fields || {}).every(g => g === 'cfHood')),
      writes.filter(c => c.method === 'POST').every(c => Object.keys(c.body.data).join() === 'text'),
      ['g1', 'g2', 'g3', 'g4'].map(g => writes.filter(c => c.method === 'POST' && c.path.indexOf('/' + g + '/') !== -1).length)],
      [true, true, true, [1, 1, 1, 1]]);
    // the next tick, with the snapshot not yet re-read: nothing written again (loop safety)
    const before = fa.calls.length;
    const again = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: the next tick writes nothing more', [again.done, fa.calls.slice(before).filter(c => c.method !== 'GET').length], [0, 0]);
    // once the sync has read the new names, nothing is even planned
    db.T.properties.forEach(r => { r.asana.name = tasks[r.asana_gid].name; });
    const after = fa.calls.length;
    await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: once synced, nothing is even asked', fa.calls.length, after);
  }
  {
    const fa = fakeAsana({ h1: task('200 E 57 - 17A'), h2: task('300 E 57 - 2A') }, ['h1']);
    const db = fakeDb({ properties: [deal('200 E 57 - 17A', { gid: 'h1' }), deal('300 E 57 - 2A', { gid: 'h2' })] });
    const r = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    const failRow = db.T.changes.find(c => c.property_id === 'p-h1');
    check('fixNames: a failure is logged', [r, failRow && failRow.source, failRow && failRow.field, failRow && failRow.note],
      [{ done: 1, failed: 1, skipped: 0 }, 'Helper', 'asana name', 'Not renamed in Asana: Asana answered 500']);
    const n = fa.calls.length;
    const r2 = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: new Date('2026-11-06T20:00:00Z') });
    // h2 was renamed and the snapshot not yet re-read: skipped, never renamed twice
    check('fixNames: a failure is not retried the same day', [r2, fa.calls.slice(n).some(c => c.path.indexOf('/h1') !== -1)], [{ done: 0, failed: 0, skipped: 1 }, false]);
    const r3 = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: new Date('2026-11-08T15:00:00Z') });
    check('fixNames: tried again the next day', [r3.failed, fa.calls.slice(n).some(c => c.path.indexOf('/h1') !== -1)], [1, true]);
  }
  {
    const tasks = {}, rows = [];
    for (let i = 1; i <= 25; i++) { tasks['m' + i] = task(i + '00 E 57 - 1A'); rows.push(deal(i + '00 E 57 - 1A', { gid: 'm' + i })); }
    const fa = fakeAsana(tasks);
    const r = await NF.fixNames({ db: fakeDb({ properties: rows }), cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: at most 20 a run', [r.done, fa.calls.filter(c => c.method === 'PUT').length], [20, 20]);
  }
  {
    const fa = fakeAsana({ k1: task('1150 Fifth - Legato') });
    const db = fakeDb({ properties: [deal('1150 Fifth - Legato', { gid: 'k1' })] });
    const r = await NF.fixNames({ db, cfg: ON, fetch: fa.fetch, now: NOW });
    check('fixNames: a name it can\'t parse is never touched', [r, fa.calls.length, db.writes], [{ done: 0, failed: 0, skipped: 0 }, 0, []]);
  }

  /* ---------- the dry run ---------- */
  {
    const fa = fakeAsana({});
    const rows = [
      deal('200 E 57 - 17A', { gid: 'r1', row: { label: '200 E 57 - 17A', core: { address: '200 E 57th', unit: '17A' } } }),
      deal('512 Laurel Rd, Oakton', { gid: 'r2', row: { market: 'NJ', label: '512 Laurel Rd, Oakton', core: { address: '512 Laurel Road' } } }),
      deal('444 Spruce - C609', { gid: 'r3' }),
      deal('225 E79 - PHA', { gid: 'r4', row: { label: '225 E79 - Penthouse', core: { address: '225 East 79th Street', unit: 'Penthouse',
        facts: { unit: { value: 'Penthouse', source: 'Matt', bySource: { Matt: 'Penthouse' } } } } } })];
    const db = fakeDb({ properties: rows });
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-name-fix-dry-'));
    const r = await NF.dryRun({ db, cfg: { asanaToken: 'tok', nameFixSkip: [] }, fetch: fa.fetch, outDir: out, date: '2026-11-06' });
    check('the dry run writes no Asana call and no database row', [fa.calls.length, db.writes], [0, []]);
    check('the dry run report lands in the out folder', path.basename(r.reportFile), 'asana-name-fix-2026-11-06.md');
    const md = fs.readFileSync(r.reportFile, 'utf8');
    check('the report has the three sections', ['## Renames', '## Left for Matt', '## What the workspace will show after the merge'].map(s => md.includes(s)), [true, true, true]);
    check('the report lists the renames', [md.includes('200 E 57 - 17A → 200 E57 - 17A'), md.includes('512 Laurel Rd, Oakton → 512 Laurel Rd'), md.includes('City/Hood: Oakton')], [true, true, true]);
    check('the report lists what is left, with why', md.includes('444 Spruce - C609') && md.includes('the street has no street type at the end'), true);
    check('the report shows the label and a team value Asana replaces', [md.includes('200 E 57 - 17A → 200 E57 - 17A'), /unit: Penthouse → PHA.*team/.test(md)], [true, true]);
    check('the report never holds the token', md.includes('tok'), false);
  }

  /* ---------- the runner's wiring ---------- */
  {
    const db = fakeDb({ properties: [deal('200 E 57 - 17A', { gid: 'w1' })], asana_writes: [] });
    const fa = fakeAsana({ w1: task('200 E 57 - 17A') });
    const offJob = asanaJobs({ asanaToken: 'tok' }, db, null, { fetch: fa.fetch }).asanaWrite;
    const off = await offJob();
    check('runner: the name fix stays off without asanaNameFix', [off, fa.calls.length], [{ done: 0, failed: 0 }, 0]);
    const onJob = asanaJobs(ON, db, null, { fetch: fa.fetch }).asanaWrite;
    const on = await onJob();
    check('runner: asanaWrite also fixes names when it is on', [on.done, on.failed, on.names], [0, 0, { done: 1, failed: 0, skipped: 0 }]);
    check('runner: still the same job keys', Object.keys(asanaJobs(ON, db)).sort(), ['asana', 'asanaEvents', 'asanaFull', 'asanaWrite', 'people']);
    // a name fix that throws never hides the edits' result
    const broken = Object.assign({}, db, { select: async (t, m) => { if (t === 'properties') throw new Error('properties unreadable'); return db.select(t, m); } });
    const b = await asanaJobs(ON, broken, null, { fetch: fa.fetch }).asanaWrite();
    check('runner: a name fix failure never fails the edits', [b.done, b.failed, b.names], [0, 0, { error: 'properties unreadable' }]);
  }

  /* ---------- asanaCall, the one request both writers use ---------- */
  {
    const AW = require('../helper/asana-write.js');
    const seen = [];
    const call = AW.asanaCall({ token: 't0k', fetch: async (u, i) => { seen.push([u, i.method, i.headers.authorization]); return { ok: false, status: 404 }; } });
    let msg = '';
    try { await call('GET', '/tasks/1'); } catch (e) { msg = e.message; }
    check('asanaCall: the request and its plain errors', [seen, msg], [[['https://app.asana.com/api/1.0/tasks/1', 'GET', 'Bearer t0k']], 'The Asana task is gone']);
  }

  failures.forEach(f => console.log('FAIL ' + f));
  console.log(pass + ' passed, ' + failures.length + ' failed');
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.log('FAIL (threw) ' + (e && e.stack || e)); process.exit(1); });
