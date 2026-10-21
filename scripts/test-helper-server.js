/* ============================================================
   Tests for the desktop helper's server (helper/server.js): it answers
   only the workspace's own address, only after pairing, and only on this PC.

   Plain Node 18+:  node scripts/test-helper-server.js
   Uses a throwaway config folder and port 47611, so a running helper is
   left alone.
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');

process.env.GVC_HELPER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-helper-test-'));
const { loadConfig } = require('../helper/config.js');
const { startServer, route } = require('../helper/server.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

function req(method, p, headers, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = http.request({ host: '127.0.0.1', port: 47611, method, path: p,
      headers: Object.assign(data ? { 'content-type': 'application/json' } : {}, headers) }, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => {
        let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  /* The default home sits outside AppData: Windows gives packaged apps (the
     Claude app) a private copy of AppData, so a pairing code written from
     there would never reach the real helper. */
  const saved = process.env.GVC_HELPER_HOME;
  delete process.env.GVC_HELPER_HOME;
  check('default home outside AppData', require('../helper/config.js').home(), path.join(os.homedir(), '.gvc-helper'));
  process.env.GVC_HELPER_HOME = saved;
  /* the helper's own browser for Playwright lives in its home too, for the same reason */
  check('browsers live in the helper home', process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(saved, 'browsers'));
  check('capture and render load the config first',
    ['de/capture.js', 'pdf/render.js'].every(f => /require\('\.\.\/config\.js'\)/.test(fs.readFileSync(path.join(__dirname, '..', 'helper', f), 'utf8'))), true);

  const cfg = Object.assign(loadConfig(), { port: 47611 });
  check('config created', fs.existsSync(path.join(process.env.GVC_HELPER_HOME, 'config.json')), true);
  check('pair code is 6 digits', /^\d{6}$/.test(cfg.pairCode), true);
  check('default site', cfg.siteBase, 'https://matthewgvc.github.io');
  check('config is stable', loadConfig().pairCode, cfg.pairCode);

  route('POST', '/echo', body => Promise.resolve({ ok: true, body }));
  const server = await startServer(cfg);

  let r = await req('GET', '/health', { origin: 'https://matthewgvc.github.io' });
  check('health ok', [r.status, r.json && r.json.ok], [200, true]);
  check('unpaired health: liveness only', [r.json && 'account' in r.json, r.json && 'lastRuns' in r.json], [false, false]);
  r = await req('GET', '/health', { origin: 'https://matthewgvc.github.io', 'x-gvc-pair': cfg.pairCode });
  check('paired health: account and last runs', [r.json && r.json.paired, r.json && r.json.account, r.json && r.json.lastRuns], [true, false, {}]);
  check('acao exact', r.headers['access-control-allow-origin'], 'https://matthewgvc.github.io');

  r = await req('OPTIONS', '/de/dry-run', { origin: 'https://matthewgvc.github.io',
    'access-control-request-private-network': 'true', 'access-control-request-method': 'POST' });
  check('pna preflight', [r.status, r.headers['access-control-allow-private-network']], [204, 'true']);
  check('preflight allows pair header', /x-gvc-pair/.test(r.headers['access-control-allow-headers'] || ''), true);

  r = await req('GET', '/health', { origin: 'https://example.com' });
  check('foreign origin', [r.status, r.headers['access-control-allow-origin']], [403, undefined]);

  r = await req('POST', '/echo', {}, {});
  check('no origin', r.status, 403);

  r = await req('POST', '/echo', { origin: 'http://localhost:8080' }, {});
  check('no pair', r.status, 403);
  r = await req('POST', '/echo', { origin: 'http://localhost:8080', 'x-gvc-pair': '000000' === cfg.pairCode ? '111111' : '000000' }, {});
  check('wrong pair', r.status, 403);
  r = await req('POST', '/echo', { origin: 'http://localhost:8080', 'x-gvc-pair': cfg.pairCode }, { a: 1 });
  check('paired', [r.status, r.json && r.json.ok, r.json && r.json.body], [200, true, { a: 1 }]);

  r = await req('POST', '/nothing-here', { origin: 'http://localhost:8080', 'x-gvc-pair': cfg.pairCode }, {});
  check('unknown route', [r.status, r.json && r.json.ok], [404, false]);

  /* open a job folder in File Explorer: only existing folders under the Drive root, never a shell */
  const { openFolderRoute } = require('../helper/routes.js');
  const opened = [];
  const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-root-'));
  fs.mkdirSync(path.join(fakeRoot, 'GVC - New York', 'A'), { recursive: true });
  const openFolder = openFolderRoute({ driveRoot: fakeRoot, launch: p => opened.push(p) });
  let o = await openFolder({ folder: 'GVC - New York/A' });
  check('opens a job folder', [o.ok, opened.length && opened[0] === path.join(fakeRoot, 'GVC - New York', 'A')], [true, true]);
  for (const bad of ['GVC - New York/../..', '..', 'C:/Windows', 'GVC - New York/missing', '', 'GVC - New York/A" & calc']) {
    o = await openFolder({ folder: bad }).catch(e => ({ ok: false, error: e.message }));
    check('refuses ' + JSON.stringify(bad), o.ok, false);
  }
  check('nothing else opened', opened.length, 1);
  o = await openFolder({ folder: 'GVC - New York\\A' });
  check('backslash paths too', [o.ok, opened[1] === path.join(fakeRoot, 'GVC - New York', 'A')], [true, true]);
  check('the real route points at the Drive root', /driveRoot: 'G:\\\\Shared drives'/.test(fs.readFileSync(path.join(__dirname, '..', 'helper', 'routes.js'), 'utf8')), true);

  /* ---------- Asana in the schedule, the runner, the routes and /health ---------- */
  const { due } = require('../helper/schedule.js');
  const { createRunner } = require('../helper/runner.js');
  const at = s => new Date(s);
  const quiet = { de: at('2026-10-20T07:00:05'), scan: at('2026-10-20T02:00:05'), backup: at('2026-10-20T02:30:05'),
    asanaFull: at('2026-10-20T03:00:05'), people: at('2026-10-20T03:15:05') };
  const dueA = (now, last) => due(at(now), last, { asana: true });
  check('asana: 29 minutes since the last read is not due', dueA('2026-10-20T10:29:00', Object.assign({ asana: at('2026-10-20T10:00:00') }, quiet)), []);
  check('asana: 30 minutes is due', dueA('2026-10-20T10:30:00', Object.assign({ asana: at('2026-10-20T10:00:00') }, quiet)), ['asana']);
  const off = dueA('2026-10-20T08:00:00', { de: at('2026-10-19T07:00:05'), scan: at('2026-10-20T02:00:05'), backup: at('2026-10-20T02:30:05'),
    asana: at('2026-10-20T07:50:00'), asanaFull: at('2026-10-19T03:00:05'), people: at('2026-10-19T03:15:05') }).sort();
  check('PC off overnight: full read and People catch up, plus DE', off, ['asanaFull', 'de', 'people']);
  check('3:00 not reached: last night counts', dueA('2026-10-20T02:59:00', Object.assign({}, quiet, { asana: at('2026-10-20T02:45:00'),
    asanaFull: at('2026-10-19T03:00:05'), people: at('2026-10-19T03:15:05'), de: at('2026-10-19T07:00:05'), scan: at('2026-10-19T02:00:05'),
    backup: at('2026-10-19T02:30:05') })).sort(), ['backup', 'scan']);
  check('without the asana option the Asana jobs are never due', due(at('2026-10-20T08:00:00'), {}).sort(), ['backup', 'de', 'scan']);

  const ranA = [];
  const mk = (jobs, last) => createRunner({ jobs, last });
  const run1 = mk({ asana: async () => { ranA.push('asana'); }, asanaFull: async () => { ranA.push('asanaFull'); }, people: async () => { ranA.push('people'); },
    de: async () => { ranA.push('de'); } },
  { de: at('2026-10-19T07:00:05'), scan: at('2026-10-20T02:00:05'), backup: at('2026-10-20T02:30:05'),
    asana: at('2026-10-20T07:00:00'), asanaFull: at('2026-10-19T03:00:05'), people: at('2026-10-19T03:15:05') });
  await run1.tick(at('2026-10-20T08:00:00'));
  check('start at 8:00: full read, People, DE once each; the plain read is folded into the full one', ranA.slice().sort(), ['asanaFull', 'de', 'people']);
  await run1.tick(at('2026-10-20T08:01:00'));
  check('nothing twice', ranA.length, 3);
  await run1.tick(at('2026-10-20T08:31:00'));
  check('30 minutes later the plain read runs', ranA[ranA.length - 1], 'asana');

  const ranB = [];
  const noTok = mk({ de: async () => { ranB.push('de'); } }, {});
  await noTok.tick(at('2026-10-20T08:00:00'));
  check('no token: the runner never calls an Asana job', ranB, ['de']);
  check('no token: nothing Asana in the last runs', Object.keys(noTok.lastRuns()).filter(k => /asana|people/.test(k)), []);

  /* /health */
  const { healthAsana } = require('../helper/server.js');
  check('health: no token', healthAsana({}, null), 'no token yet');
  check('health: token, nothing run yet', healthAsana({ asanaToken: 'x' }, { lastRuns: () => ({}) }), { at: null, ok: null });
  check('health: latest of the plain and full reads', healthAsana({ asanaToken: 'x' }, { lastRuns: () => ({
    asana: { at: '2026-10-20T10:00:00.000Z', ok: true }, asanaFull: { at: '2026-10-20T10:30:00.000Z', ok: false, error: 'Asana refused the token' } }) }),
  { at: '2026-10-20T10:30:00.000Z', ok: false, error: 'Asana refused the token' });

  /* routes */
  const { asanaSyncRoute, syncRoute } = require('../helper/routes.js');
  let calls = 0, release;
  const gate = new Promise(res => { release = res; });
  const slow = asanaSyncRoute(async () => { calls++; await gate; return { report: { ok: true, aborted: null }, changes: 3, created: 1, errors: [] }; });
  const p1 = slow(), p2 = slow();
  release();
  const [a1, a2] = await Promise.all([p1, p2]);
  check('two /asana/sync at once share one run', [calls, JSON.stringify(a1) === JSON.stringify(a2), a1.ok, a1.changes], [1, true, true, 3]);
  const partialRun = await asanaSyncRoute(async () => ({ ok: false, report: { ok: true, aborted: null, warnings: ['NJ listings could not be read: x'] }, changes: 1, created: 0, errors: [] }))();
  check('/asana/sync: a partial run is not OK, and says why', [partialRun.ok, partialRun.aborted], [false, 'NJ listings could not be read: x']);
  const noPlanRun = await asanaSyncRoute(async () => ({ ok: false, report: { ok: true, aborted: null, warnings: [] }, changes: 0, created: 0, errors: [{ what: 'no plan', detail: 'No link plan applied yet' }] }))();
  check('/asana/sync: no plan yet is not OK, and says why', [noPlanRun.ok, noPlanRun.aborted], [false, 'No link plan applied yet']);
  const both = await syncRoute({
    asana: async () => ({ ok: true, changes: 2, created: 0, skipped: 0, aborted: null }),
    de: async () => ({ ok: true, changes: 5, created: 1, skipped: 0, aborted: null }) })();
  check('/sync returns Asana and DE', [both.asana.changes, both.de.changes], [2, 5]);
  const half = await syncRoute({ asana: async () => { throw new Error('No Asana token yet'); }, de: async () => ({ ok: true, changes: 1 }) })();
  check('/sync: no Asana token still runs DE', [half.asana.ok, half.asana.error, half.de.ok], [false, 'No Asana token yet', true]);
  r = await req('POST', '/sync', { origin: 'http://localhost:8080' }, {});
  check('/sync from an unpaired origin is refused', r.status, 403);
  r = await req('POST', '/asana/sync', { origin: 'http://localhost:8080' }, {});
  check('/asana/sync from an unpaired origin is refused', r.status, 403);

  /* startRunner's pieces: token gate, last-run map, one shared Asana run */
  const { asanaJobs, lastFromRuns, readLastRuns } = require('../helper/runner.js');
  /* C1: startup reads only the newest run of each kind (and the newest full Asana read) */
  const runRows = [
    { kind: 'asana', started_at: '2026-10-18T03:00:00Z', totals: { full: true, unlinked: [] } },
    { kind: 'asana', started_at: '2026-10-19T03:00:00Z', totals: { full: true, unlinked: [] } },
    { kind: 'asana', started_at: '2026-10-20T10:00:00Z', totals: { full: false, unlinked: [] } },
    { kind: 'people', started_at: '2026-10-20T03:15:00Z', totals: null },
    { kind: 'de', started_at: '2026-10-19T07:00:00Z' }, { kind: 'de', started_at: '2026-10-20T07:00:00Z' },
    { kind: 'scan', started_at: '2026-10-20T06:00:00Z' }];
  const runCalls = [];
  const runClient = { select: async (t, m, cols, o) => {
    runCalls.push({ t, m, cols, o });
    const hit = runRows.filter(r => Object.keys(m || {}).every(k => {
      const j = /^(\w+)->>(\w+)$/.exec(k);
      return String(j ? (r[j[1]] || {})[j[2]] : r[k]) === String(m[k]);
    })).sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    return hit.slice(0, o && o.limit ? o.limit : hit.length).map(r => { const x = {}; String(cols || '*').split(',').forEach(c => { if (c === '*' || c in r) Object.assign(x, c === '*' ? r : { [c]: r[c] }); }); return x; });
  } };
  const lr = typeof readLastRuns === 'function' ? lastFromRuns(await readLastRuns(runClient)) : {};
  check('startup last map from small reads: plain, full, people, de, scan', ['asana', 'asanaFull', 'people', 'de', 'scan'].map(k => lr[k] ? lr[k].toISOString() : null),
    ['2026-10-20T10:00:00.000Z', '2026-10-19T03:00:00.000Z', '2026-10-20T03:15:00.000Z', '2026-10-20T07:00:00.000Z', '2026-10-20T06:00:00.000Z']);
  check('startup reads: every one newest first, limit 1, never the totals', runCalls.length > 0 && runCalls.every(c => c.t === 'sync_runs' && c.o && c.o.order === 'started_at.desc' && c.o.limit === 1 && !/totals/.test(c.cols || '*') && (c.cols || '*') !== '*'), true);
  check('no token: no Asana jobs', Object.keys(asanaJobs({}, {})), []);
  check('token: asana, asanaFull, people jobs', Object.keys(asanaJobs({ asanaToken: 'x' }, {})).sort(), ['asana', 'asanaFull', 'people']);
  const seen = [];
  const jobs = asanaJobs({ asanaToken: 'x' }, { c: 1 }, async o => { seen.push([!!o.full, o.kind || null, o.client.c]); return { report: { ok: true } }; });
  await jobs.asana(); await jobs.asanaFull(); await jobs.people();
  check('jobs pass full and people options', seen, [[false, null, 1], [true, null, 1], [false, 'people', 1]]);
  const lf = lastFromRuns([
    { kind: 'asana', started_at: '2026-10-19T03:00:00Z', totals: { full: true } },
    { kind: 'asana', started_at: '2026-10-20T09:30:00Z', totals: { full: false } },
    { kind: 'asana', started_at: '2026-10-20T10:00:00Z', totals: null },
    { kind: 'people', started_at: '2026-10-20T03:15:00Z', totals: null },
    { kind: 'de', started_at: '2026-10-20T07:00:00Z' }]);
  check('last map: plain, full, people, de', [lf.asana.toISOString(), lf.asanaFull.toISOString(), lf.people.toISOString(), lf.de.toISOString()],
    ['2026-10-20T10:00:00.000Z', '2026-10-19T03:00:00.000Z', '2026-10-20T03:15:00.000Z', '2026-10-20T07:00:00.000Z']);
  let n = 0, rel2;
  const g2 = new Promise(res => { rel2 = res; });
  const slowSync = async () => { n++; await g2; return { report: { ok: true }, changes: 1, created: 0, errors: [] }; };
  const sched = asanaJobs({ asanaToken: 'x' }, {}, slowSync).asanaFull();
  const click = asanaSyncRoute(slowSync)();
  rel2();
  await Promise.all([sched, click]);
  check('a scheduled run and a Sync now click share one run', n, 1);

  /* a different kind of run is never swallowed by the one in flight */
  const callsB = []; let relB;
  const gB = new Promise(res => { relB = res; });
  const syncB = async o => { callsB.push(o.full ? 'full' : o.kind === 'people' ? 'people' : 'plain'); if (callsB.length === 1) await gB; return { report: { ok: true }, changes: 0, created: 0, errors: [] }; };
  const jb = asanaJobs({ asanaToken: 'x' }, {}, syncB);
  const plainRun = jb.asana();
  const fullRun = jb.asanaFull();
  const peopleRun = jb.people();
  await new Promise(res => setImmediate(res));
  check('full and People wait while a plain run is in flight', callsB, ['plain']);
  relB();
  await Promise.all([plainRun, fullRun, peopleRun]);
  check('then each runs its own, one at a time', callsB, ['plain', 'full', 'people']);
  const callsC = []; let relC;
  const gC = new Promise(res => { relC = res; });
  const syncC = async o => { callsC.push(o.full ? 'full' : 'plain'); await gC; return { report: { ok: true }, changes: 0, created: 0, errors: [] }; };
  const fullC = asanaJobs({ asanaToken: 'x' }, {}, syncC).asanaFull();
  const clickC = asanaSyncRoute(syncC)();
  relC();
  await Promise.all([fullC, clickC]);
  check('a plain click during a full read shares it', callsC, ['full']);

  check('bound to loopback', server.address().address, '127.0.0.1');
  server.close();

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
