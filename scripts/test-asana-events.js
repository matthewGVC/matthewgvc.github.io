/* ============================================================
   Tests for the one-minute sync (helper/asana-events.js, Asana's Events API):
   the client's events() call, readRun's single-task read (gids), applyRun's
   'events' runs, and the in-flight rule, on a made-up Asana (a fake fetch)
   and an in-memory database (never the real Asana or the real Supabase).

   Plain Node:  node scripts/test-asana-events.js
   ============================================================ */
'use strict';

// never this computer's own helper settings
process.env.GVC_HELPER_HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gvc-asana-events-'));
const fs = require('fs'), path = require('path');
const { createAsana } = require('../helper/asana/client.js');
const { readRun } = require('../helper/asana/read.js');
const { applyRun } = require('../helper/asana/apply.js');
const { replayFetch } = require('../helper/asana/replay.js');
const { checkEvents } = require('../helper/asana-events.js');
const { syncNow } = require('../helper/asana-sync.js');
const { runAsana } = require('../helper/inflight.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* ---------- an in-memory database with the helper client's shape (as scripts/test-asana-sync.js) ---------- */
const TABLES = ['properties', 'pitches', 'dev_projects', 'changes', 'sync_runs', 'asana_tasks', 'asana_people', 'de_listings', 'places', 'buildings', 'sync_state'];
function fakeDb(seed) {
  const T = {};
  TABLES.forEach(t => { T[t] = []; });
  Object.keys(seed || {}).forEach(k => { T[k] = seed[k].map(r => Object.assign(k === 'asana_tasks' || k === 'sync_runs' || k === 'sync_state' ? {} : { version: 1 }, r)); });
  let n = 0;
  const field = (row, k) => { const j = /^(\w+)->>(\w+)$/.exec(k); return j ? (row[j[1]] || {})[j[2]] : row[k]; };
  const matches = (row, m) => Object.keys(m || {}).every(k => String(field(row, k)) === String(m[k]));
  const copy = x => JSON.parse(JSON.stringify(x));
  const db = {
    T, calls: [],
    ready: () => true,
    select: async (t, m, cols, o) => {
      db.calls.push({ t, m, cols, o });
      let rows = T[t].filter(r => matches(r, m));
      if (o && o.order) {
        const [f, dir] = o.order.split('.');
        rows = rows.slice().sort((a, b) => (a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
      }
      if (o && o.limit) rows = rows.slice(0, o.limit);
      return rows.map(copy);
    },
    insert: async (t, rows) => [].concat(rows).map(r => {
      const x = Object.assign({ id: t + '-' + (++n) }, TABLES.indexOf(t) < 3 ? { version: 1 } : {}, copy(r)); T[t].push(x); return copy(x);
    }),
    upsert: async (t, rows, key) => {
      const keys = [].concat(rows).map(r => r[key]);
      if (new Set(keys).size !== keys.length) throw new Error('ON CONFLICT DO UPDATE command cannot affect row a second time');
      return [].concat(rows).map(r => {
        const hit = T[t].find(x => x[key] === r[key]);
        if (hit) return copy(Object.assign(hit, copy(r)));
        const x = copy(r); T[t].push(x); return copy(x);
      });
    },
    update: async (t, m, patch, o) => {
      const hits = T[t].filter(r => matches(r, m) && (!o || o.version === undefined || r.version === o.version));
      hits.forEach(r => { Object.assign(r, copy(patch)); if (r.version !== undefined) r.version++; });
      return hits.map(copy);
    }
  };
  return db;
}

/* ---------- a made-up Asana: /events per project (a queue of answers), /tasks/<gid>, the rest replayed ---------- */
const FIX = path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic', 'asana');
const NYC = '1209188026968555', NJ = '1209188026968552', DEV = '1210736852899934';
const res = (body, status) => ({ ok: !status || status < 400, status: status || 200, headers: { get: () => null }, json: async () => body });
function fakeFetch(o) {
  const calls = [];
  const replay = replayFetch(FIX, o.replay || {});
  const f = async url => {
    const u = new URL(url), p = u.pathname.replace(/^\/api\/1\.0/, '');
    calls.push(p + u.search);
    if (p === '/events') {
      const project = u.searchParams.get('resource'), token = u.searchParams.get('sync');
      if (!token) return res({ errors: [{ message: 'Sync token invalid or too old' }], sync: 'new-' + project }, 412);
      const q = (o.events || {})[project] || [];
      const a = q.length ? q.shift() : { data: [], sync: token, has_more: false };
      if (a.expired) return res({ errors: [{ message: 'Sync token invalid or too old' }], sync: a.sync }, 412);
      return res({ data: a.data || [], sync: a.sync, has_more: !!a.has_more });
    }
    let m;
    if ((m = p.match(/^\/tasks\/([\w-]+)$/))) {
      if (o.taskStatus && o.taskStatus[m[1]]) return res({ errors: [{ message: 'no' }] }, o.taskStatus[m[1]]);
      const t = (o.tasks || {})[m[1]];
      return t ? res({ data: t }) : res({ errors: [{ message: 'Not found' }] }, 404);
    }
    return replay(url);
  };
  f.calls = calls;
  return f;
}
const ev = (gid, type, parent) => ({ action: 'changed', resource: { gid, resource_type: type || 'task' }, parent: parent ? { gid: parent, resource_type: 'task' } : null });
const cfg = { asanaToken: 'tok-test-secret', asana: { listings: { NYC, NJ } } };
const NOW = new Date('2026-11-06T15:00:00Z');

let dir = fs.mkdtempSync(path.join(process.env.GVC_HELPER_HOME, 'state-'));
let k = 0;
const stateAt = tokens => { const f = path.join(dir, 'asana-events-' + (++k) + '.json'); if (tokens) fs.writeFileSync(f, JSON.stringify(tokens)); return f; };
const tokensIn = f => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const LINKED = [{ gid: 'g1', project_gid: NYC, kind: 'listing', property_id: 'p1' }, { gid: 'g2', project_gid: NJ, kind: 'listing', property_id: 'p2' },
  { gid: 'g7', project_gid: NJ, kind: 'listing', pitch_id: 'pi7' }, { gid: 'g8', project_gid: NYC, kind: 'listing', ignored: true },
  { gid: 'g9', project_gid: NYC, kind: 'listing', property_id: null, pitch_id: null }];
const fakeSync = (answer) => {
  const calls = [];
  const s = async o => { calls.push(JSON.parse(JSON.stringify(o))); return typeof answer === 'function' ? answer(o) : (answer || { ok: true, report: { ok: true } }); };
  s.calls = calls;
  return s;
};
async function check1(o) {
  const db = o.db || fakeDb({ asana_tasks: LINKED });
  const fetch = fakeFetch(o);
  const sync = o.sync || fakeSync();
  const stateFile = o.stateFile || stateAt(o.tokens === undefined ? { [NYC]: 'tN', [NJ]: 'tJ' } : o.tokens);
  const r = await checkEvents({ cfg, client: db, asana: createAsana(cfg, { fetch, sleep: async () => {} }), sync, stateFile, now: NOW });
  return { r, db, fetch, sync, stateFile, state: db.T.sync_state.find(s => s.kind === 'asana-events') || null };
}

(async () => {
  /* ================= the client's events() ================= */
  {
    const fetch = fakeFetch({ events: { [NYC]: [{ data: [ev('g1')], sync: 's2', has_more: true }] } });
    const asana = createAsana(cfg, { fetch });
    const a = await asana.events(NYC, 's1');
    check('events: one page, the next token and more', [a.events.length, a.sync, a.more, a.expired], [1, 's2', true, false]);
    check('events: a GET on /events with the resource and the token', fetch.calls[0], '/events?resource=' + NYC + '&sync=s1');
    const b = await asana.events(NJ, null);
    check('events: no token is a 412 that hands a new one', [b.expired, b.sync, b.events], [true, 'new-' + NJ, []]);
    check('events: no token, no sync parameter', fetch.calls[1], '/events?resource=' + NJ);
    let err = null;
    try { await createAsana(cfg, { fetch: async () => res({ errors: [] }, 401) }).events(NYC, 's1'); } catch (e) { err = e.message; }
    check('events: a refused token still throws', err, 'Asana refused the token');
    err = null;
    try { await createAsana(cfg, { fetch: async () => res({ errors: [] }, 500) }).events(NYC, 's1'); } catch (e) { err = e.message; }
    check('events: a server error throws', err, 'Asana answered 500 for /events');
    let tries = 0;
    const busy = createAsana(cfg, { sleep: async () => {}, fetch: async () => (++tries < 2 ? res({}, 429) : res({ data: [], sync: 'ok', has_more: false })) });
    check('events: a 429 waits and tries again', [(await busy.events(NYC, 's1')).sync, tries], ['ok', 2]);
  }

  /* ================= checkEvents ================= */
  let t = await check1({ tokens: null });
  check('no token yet: saves the new one and reads since the last good run', [t.r.gap, t.sync.calls.map(c => c.kind), tokensIn(t.stateFile)],
    [true, ['plain'], { [NYC]: 'new-' + NYC, [NJ]: 'new-' + NJ }]);
  check('no token yet: the check is ok, caught up', [t.state.ok, t.state.detail, t.state.checked_at], [true, 'caught up from the last full read', NOW.toISOString()]);

  t = await check1({ events: { [NYC]: [{ data: [ev('g1')], sync: 'tN2' }] } });
  check('a changed task is read alone', [t.r.gap, t.sync.calls], [false, [{ kind: 'events', gids: { g1: 'NYC' } }]]);
  check('a changed task: tokens saved, 1 task changed', [tokensIn(t.stateFile), t.state.ok, t.state.detail], [{ [NYC]: 'tN2', [NJ]: 'tJ' }, true, '1 task changed']);

  t = await check1({ events: { [NYC]: [{ data: [ev('g9')], sync: 'tN2' }] }, tasks: { g9: { gid: 'g9', parent: null } } });
  check('a task with no deal goes to the plain read', [t.r.gap, t.sync.calls.map(c => c.kind)], [true, ['plain']]);

  t = await check1({ events: { [NJ]: [{ data: [ev('st1', 'story', 'g2')], sync: 'tJ2' }] } });
  check('a comment counts for its task', t.sync.calls, [{ kind: 'events', gids: { g2: 'NJ' } }]);

  t = await check1({ events: { [NYC]: [{ data: [ev('g1')], sync: 'tN2', has_more: true }, { data: [ev('g1', 'story', 'g1')], sync: 'tN3' }] } });
  check('two pages of events: both read, the last token saved', [t.fetch.calls.filter(c => c.indexOf('/events?resource=' + NYC) === 0),
    tokensIn(t.stateFile)[NYC], t.sync.calls], [['/events?resource=' + NYC + '&sync=tN', '/events?resource=' + NYC + '&sync=tN2'], 'tN3', [{ kind: 'events', gids: { g1: 'NYC' } }]]);

  t = await check1({ events: { [NJ]: [{ expired: true, sync: 'tJnew' }] } });
  check('an expired token is a gap, the new token saved', [t.r.gap, t.sync.calls.map(c => c.kind), tokensIn(t.stateFile)], [true, ['plain'], { [NYC]: 'tN', [NJ]: 'tJnew' }]);

  {
    let mid = null;
    const sf = stateAt({ [NYC]: 'tN', [NJ]: 'tJ' });
    const sync = fakeSync(o => { if (o.kind === 'plain') mid = tokensIn(sf); return { ok: true, report: { ok: true } }; });
    t = await check1({ stateFile: sf, sync, events: { [NYC]: [{ data: [ev('g9'), ev('s1')], sync: 'tN2' }] },
      tasks: { g9: { gid: 'g9', parent: null }, s1: { gid: 's1', parent: { gid: 'g1' } } } });
    check('a gap still re-reads a ticked subtask\'s listing', t.sync.calls, [{ kind: 'plain' }, { kind: 'events', gids: { g1: 'NYC' } }]);
    check('a gap: tokens saved after both, not between', [mid, tokensIn(sf)], [{ [NYC]: 'tN', [NJ]: 'tJ' }, { [NYC]: 'tN2', [NJ]: 'tJ' }]);
  }

  t = await check1({ sync: fakeSync(() => { throw new Error('Asana couldn\'t be reached'); }), events: { [NYC]: [{ data: [ev('g1')], sync: 'tN2' }] } });
  check('a failed run keeps the old token', [t.r.ok, tokensIn(t.stateFile)], [false, { [NYC]: 'tN', [NJ]: 'tJ' }]);
  check('a failed run: sync_state not ok, with the reason', [t.state.ok, t.state.detail], [false, 'Asana couldn\'t be reached']);

  t = await check1({ sync: fakeSync({ ok: false, report: { ok: false, aborted: 'Asana refused the token' } }), events: { [NYC]: [{ data: [ev('g1')], sync: 'tN2' }] } });
  check('a stopped read is a failed run', [t.r.ok, tokensIn(t.stateFile), t.state.ok, t.state.detail], [false, { [NYC]: 'tN', [NJ]: 'tJ' }, false, 'Asana refused the token']);

  t = await check1({ sync: fakeSync({ ok: false, report: { ok: true, warnings: ['NJ listings could not be read: Asana answered 500'] } }), events: { [NYC]: [{ data: [ev('g1')], sync: 'tN2' }] } });
  check('a partial read is a failed run too', [t.r.ok, tokensIn(t.stateFile)[NYC], t.state.ok, t.state.detail], [false, 'tN', false, 'NJ listings could not be read: Asana answered 500']);

  t = await check1({ events: { [NYC]: [{ data: [ev('s9')], sync: 'tN2' }] } });
  check('a deleted subtask doesn\'t stop the feed', [t.r.ok, t.r.gap, t.sync.calls, t.state.ok, tokensIn(t.stateFile)[NYC]], [true, false, [], true, 'tN2']);

  /* fix round 1 */
  t = await check1({ events: { [NYC]: [{ data: [ev('s5'), ev('g1')], sync: 'tN2' }] }, taskStatus: { s5: 403 } });
  check('a task that answers 403 on its parent lookup is a gap, not a failure', [t.r.ok, t.r.gap, t.sync.calls, tokensIn(t.stateFile)[NYC], t.state.ok],
    [true, true, [{ kind: 'plain' }, { kind: 'events', gids: { g1: 'NYC' } }], 'tN2', true]);
  t = await check1({ events: { [NYC]: [{ data: [ev('s5')], sync: 'tN2' }] }, taskStatus: { s5: 401 } });
  check('a refused token on the parent lookup still fails the check', [t.r.ok, t.state.ok, t.state.detail, tokensIn(t.stateFile)[NYC]], [false, false, 'Asana refused the token', 'tN']);
  t = await check1({ events: { [NJ]: [{ data: [ev('g7')], sync: 'tJ2' }] }, tasks: { g7: { gid: 'g7', parent: null } } });
  check('a task linked only by a pitch goes to the plain read', [t.r.gap, t.sync.calls.map(c => c.kind)], [true, ['plain']]);
  t = await check1({ events: { [NYC]: [{ data: [ev('g8'), ev('st8', 'story', 'g8')], sync: 'tN2' }] } });
  check('an ignored task\'s edit runs no read', [t.r.ok, t.r.gap, t.sync.calls, t.fetch.calls.some(c => /^\/tasks\//.test(c)), tokensIn(t.stateFile)[NYC]], [true, false, [], false, 'tN2']);
  {
    const P1 = { id: 'p1', slug: '3-sample-ave-4c', label: '3 Sample Ave - 4C', kind: 'sale', market: 'NYC', stage: 'Live', stage_source: 'Asana', asana_gid: 'g1',
      core: { address: '3 Sample Ave', unit: '4C' }, place_id: 'pl1' };
    const db = fakeDb({ properties: [P1], places: [{ id: 'pl1', slug: 'pl1', key: 'k', address: '3 Sample Ave', label: '3 Sample Ave - 4C', market: 'NYC' }],
      asana_tasks: [{ gid: 'g1', project_gid: NYC, kind: 'listing', property_id: 'p1' }] });
    const g1 = { gid: 'g1', name: '3 Sample Ave - 4C', completed: false, modified_at: '2026-11-06T14:00:00.000Z', parent: null,
      memberships: [{ project: { gid: NYC }, section: { name: 'Accepted Offer/Attorney Review' } }],
      custom_fields: [{ name: 'Listing Status', enum_value: { name: 'Accepted Offer/Attorney Review' }, display_value: 'Accepted Offer/Attorney Review' }] };
    const fetch = fakeFetch({ tasks: { g1 }, taskStatus: { g6: 500 } });
    const r = await syncNow({ cfg, client: db, fetch, kind: 'events', gids: { g6: 'NYC', g1: 'NYC' }, now: NOW });
    check('a task that answers 500 in the events read is skipped with a warning; the others still apply',
      [r.ok, r.report.ok, r.report.listings, r.report.warnings.some(w => /g6/.test(w)), db.T.properties[0].stage, db.T.sync_runs.map(x => [x.kind, x.ok])],
      [true, true, 1, true, 'Accepted offer', [['events', true]]]);
    const db2 = fakeDb({ asana_tasks: [{ gid: 'g1', project_gid: NYC, kind: 'listing', property_id: 'p1' }] });
    const r2 = await syncNow({ cfg, client: db2, fetch: async () => res({}, 401), kind: 'events', gids: { g1: 'NYC' }, now: NOW });
    check('an aborted events read writes no sync_runs row', [r2.ok, r2.report.ok, r2.report.aborted, db2.T.sync_runs.length], [false, false, 'Asana refused the token', 0]);
  }

  t = await check1({});
  check('nothing changed: no sync, but checked_at moves', [t.sync.calls, t.state.ok, t.state.checked_at, t.r.gap], [[], true, NOW.toISOString(), false]);

  t = await check1({ events: { [NYC]: [{ data: [ev('s1')], sync: 'tN2' }] }, tasks: { s1: { gid: 's1', parent: { gid: 'g1' } } } });
  check('a subtask of a linked listing counts as that listing', [t.r.gap, t.sync.calls], [false, [{ kind: 'events', gids: { g1: 'NYC' } }]]);
  t = await check1({ events: { [NYC]: [{ data: [ev('s3')], sync: 'tN2' }] }, tasks: { s3: { gid: 's3', parent: { gid: 's2' } }, s2: { gid: 's2', parent: { gid: 'g1' } } } });
  check('a sub-subtask counts as its listing too', t.sync.calls, [{ kind: 'events', gids: { g1: 'NYC' } }]);
  t = await check1({ events: { [NYC]: [{ data: [{ action: 'changed', resource: { gid: 'sec1', resource_type: 'section' }, parent: null }], sync: 'tN2' }] } });
  check('a section event is no task', [t.sync.calls, t.r.gap], [[], false]);

  {
    const db = fakeDb({ asana_tasks: LINKED });
    t = await check1({ db, events: { [NYC]: [{ data: [ev('g1')], sync: 'tN2' }] } });
    check('the links are read once per check', db.calls.filter(c => c.t === 'asana_tasks').length, 1);
  }

  /* a new house still joins its development, through that plain read (the real sync) */
  {
    const nj = JSON.parse(fs.readFileSync(path.join(FIX, 'tasks-' + NJ + '.json'), 'utf8')).data;
    const house = Object.assign(JSON.parse(JSON.stringify(nj.find(x => x.gid === '9000000000178'))),
      { gid: '9000000000999', name: '30 Lot Rd, Exampleton (House 3)', modified_at: '2026-11-06T14:00:00.000Z' });
    const db = fakeDb({
      dev_projects: [{ id: 'dev1', slug: '30-lot-rd', label: '30 Lot Rd', market: 'NJ', milestones: {}, asana_project_gid: DEV }],
      asana_tasks: [{ gid: 'marker', project_gid: NJ, kind: 'listing', ignored: true }],
      sync_runs: [{ id: 'r0', kind: 'asana', ok: true, started_at: '2026-11-06T12:00:00.000Z', finished_at: '2026-11-06T12:01:00.000Z', totals: { full: false } }]
    });
    const fullCfg = { asanaToken: 'tok-test-secret', asana: Object.assign({}, require('../helper/config.js').DEFAULTS.asana, { posts: null }) };
    const fetch = fakeFetch({ events: { [NJ]: [{ data: [ev('9000000000999')], sync: 'tJ2' }] }, tasks: { '9000000000999': { gid: '9000000000999', parent: null } },
      // a development of several houses has a 🚧 project per house, named for it (L.devAddresses, A.sameStreet keeps houses apart)
      replay: { tasks: { [NJ]: nj.concat([house]) }, projects: { [DEV]: { gid: DEV, name: '🚧 30 Lot Rd (House 3)' } } } });
    const sync = o => syncNow(Object.assign({ cfg: fullCfg, client: db, fetch, now: NOW }, o));
    const r = await checkEvents({ cfg: fullCfg, client: db, asana: createAsana(fullCfg, { fetch }), sync, stateFile: stateAt({ [NYC]: 'tN', [NJ]: 'tJ', '1209188026968549': 'tF' }), now: NOW });
    const job = db.T.properties.find(p => p.asana_gid === '9000000000999') || {};
    const place = db.T.places.find(p => p.id === job.place_id) || {};
    check('a new house still joins its development', [r.ok, r.gap, job.dev_project_id, place.dev_project_id], [true, true, 'dev1', 'dev1']);
    check('a new house: made by a plain read', db.T.sync_runs.slice(1).map(x => x.kind), ['asana']);
  }

  /* ================= readRun with gids ================= */
  const raw = (gid, name, project, extra) => Object.assign({ gid, name, completed: false, modified_at: '2026-11-06T14:00:00.000Z', parent: null,
    memberships: [{ project: { gid: project }, section: { name: 'Active' } }], custom_fields: [{ name: 'Listing Status', enum_value: { name: 'Active' }, display_value: 'Active' }] }, extra || {});
  {
    const fetch = fakeFetch({ tasks: { g1: raw('g1', '3 Sample Ave - 4C', NYC), s1: raw('s1', 'Order Photos', NYC, { parent: { gid: 'g1' }, memberships: [] }) },
      replay: { subtasks: { g1: [{ gid: 's1', name: 'Order Photos', completed: true, completed_at: '2026-11-06T14:00:00.000Z', parent: { gid: 'g1' } }] } } });
    const run = await readRun({ asana: createAsana(cfg, { fetch }), cfg, gids: { s1: 'NYC' } });
    check('a subtask event re-reads its parent', [run.ok, run.kind, run.full, run.listings.map(x => [x.gid, x.market, (x.subtasks || []).map(s => s.completed)])],
      [true, 'events', false, [['g1', 'NYC', [true]]]]);
    check('events run shape', [run.devs, run.loose, run.people, run.readProjects, run.totals, run.rowsRead], [[], [], null, [], { events: true }, { events: 1 }]);
    check('a task is read with limit off and the task fields', fetch.calls.filter(c => /^\/tasks\/s1\?/.test(c)).map(c => /limit=/.test(c)), [false]);
  }
  {
    const fetch = fakeFetch({ tasks: { g1: raw('g1', '3 Sample Ave - 4C', NYC) } });
    const run = await readRun({ asana: createAsana(cfg, { fetch }), cfg, gids: { g3: 'NYC', g1: 'NYC' } });
    check('a deleted task is skipped', [run.ok, run.listings.map(x => x.gid)], [true, ['g1']]);
    const gone = await readRun({ asana: createAsana(cfg, { fetch }), cfg, gids: { g3: 'NYC' } });
    check('a deleted task alone: listings empty, the run ok', [gone.ok, gone.listings], [true, []]);
  }
  {
    const fetch = fakeFetch({ tasks: { g1: raw('g1', '3 Sample Ave - 4C', '999') } });
    const run = await readRun({ asana: createAsana(cfg, { fetch }), cfg, gids: { g1: 'NYC' } });
    check('a task moved out of the listings is skipped', [run.ok, run.listings], [true, []]);
  }
  {
    const run = await readRun({ asana: createAsana(cfg, { fetch: async () => res({}, 401) }), cfg, gids: { g1: 'NYC' } });
    check('a refused token stops an events read', [run.ok, run.aborted], [false, 'Asana refused the token']);
  }

  /* ================= applyRun with an events run ================= */
  {
    const OLD = { id: 'r0', kind: 'asana', ok: true, started_at: '2026-11-06T12:00:00.000Z', finished_at: '2026-11-06T12:01:00.000Z', totals: { full: false, unlinked: [] } };
    const db = fakeDb({ sync_runs: [OLD], asana_tasks: [{ gid: 'marker', project_gid: NYC, kind: 'listing', ignored: true }] });
    const fetch = fakeFetch({ tasks: { g5: raw('g5', '5 Nowhere St - 1A', NYC) } });
    const run = await readRun({ asana: createAsana(cfg, { fetch }), cfg, gids: { g5: 'NYC' } });
    const out = await applyRun({ client: db, run, now: NOW, roster: [], initials: {} });
    const row = db.T.sync_runs.find(r => r.id === out.runId) || {};
    check('an events run is a sync_runs row of kind events', [row.kind, row.ok], ['events', true]);
    const good = db.T.sync_runs.filter(r => r.kind === 'asana' && r.ok).sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
    check('an events run leaves the plain read\'s starting point alone', good.id, 'r0');
    check('an events run doesn\'t touch the Errors page\'s list', 'unlinked' in (row.totals || {}), false);
  }

  /* ================= one Asana run at a time ================= */
  {
    const order = []; let rel;
    const gate = new Promise(r => { rel = r; });
    const plain = runAsana('plain', async () => { order.push('plain start'); await gate; order.push('plain end'); return 'p'; });
    const events = runAsana('events', async () => { order.push('events'); return 'e'; });
    await new Promise(r => setImmediate(r));
    check('a plain read doesn\'t swallow an events run: it waits', order, ['plain start']);
    rel();
    check('then runs its own', [await plain, await events, order], ['p', 'e', ['plain start', 'plain end', 'events']]);
    let rel2;
    const gate2 = new Promise(r => { rel2 = r; });
    const ev1 = runAsana('events', async () => { await gate2; return 'e1'; });
    const pl = runAsana('plain', async () => 'p2');
    const ev2 = runAsana('events', async () => 'e2');
    rel2();
    check('an events run doesn\'t swallow a plain read; a second events check shares the first', [await ev1, await pl, await ev2], ['e1', 'p2', 'e1']);
  }

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
