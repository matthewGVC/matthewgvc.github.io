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

  /* the real Google Drive link of a job folder or file: refused outside the Drive root and for paperwork */
  const { driveLinkRoute } = require('../helper/routes.js');
  const dl = driveLinkRoute({ driveRoot: fakeRoot });
  const jobDir = path.join(fakeRoot, 'GVC - New York', 'A');
  fs.mkdirSync(path.join(jobDir, 'Floorplan'), { recursive: true });
  fs.mkdirSync(path.join(jobDir, 'Docs'), { recursive: true });
  fs.writeFileSync(path.join(jobDir, 'Floorplan', 'plan.pdf'), 'x');
  fs.writeFileSync(path.join(jobDir, 'Docs', 'x.pdf'), 'x');
  fs.writeFileSync(path.join(jobDir, 'Exclusive - Jane Client.pdf'), 'x');
  const dlErr = b => dl(b).then(() => null, e => [e.status, e.message]);
  check('drive-link: outside Shared drives is 400', await dlErr({ folder: 'GVC - New York/../..' }), [400, "That isn't a path the helper reads."]);
  check('drive-link: a drive letter is refused', (await dlErr({ folder: 'C:/Windows' }))[0], 400);
  check('drive-link: Docs file is 403', await dlErr({ folder: 'GVC - New York/A', file: 'Docs/x.pdf' }), [403, "The workspace doesn't link that file."]);
  check('drive-link: loose paperwork file is 403', (await dlErr({ folder: 'GVC - New York/A', file: 'Exclusive - Jane Client.pdf' }))[0], 403);
  check('drive-link: a stream name on a file is 403', (await dlErr({ folder: 'GVC - New York/A', file: 'Floorplan/plan.pdf:user.drive.id' }))[0], 403);
  check('drive-link: file climbing out of the folder is refused', (await dlErr({ folder: 'GVC - New York/A', file: 'Floorplan/../../B/x.pdf' }))[0], 403);
  /* final review 4: a paperwork folder, or a whole shared drive, is never linked */
  fs.mkdirSync(path.join(jobDir, 'Marketing', 'Offer Docs'), { recursive: true });
  for (const p of [jobDir, path.join(jobDir, 'Docs'), path.join(jobDir, 'Marketing', 'Offer Docs'), path.join(fakeRoot, 'GVC - New York')])
    try { fs.writeFileSync(p + ':user.drive.id', 'SOMEID1234567'); } catch (e) { /* no streams off Windows: the 403 comes first anyway */ }
  check('drive-link: a Docs folder is 403', await dlErr({ folder: 'GVC - New York/A/Docs' }), [403, "The workspace doesn't link that folder."]);
  check('drive-link: a paperwork folder deeper down is 403', (await dlErr({ folder: 'GVC - New York\\A\\Marketing\\Offer Docs' }))[0], 403);
  check('drive-link: a paperwork folder with a file is 403', (await dlErr({ folder: 'GVC - New York/A/Docs', file: 'Floorplan/plan.pdf' }))[0], 403);
  check('drive-link: a whole shared drive is 403', (await dlErr({ folder: 'GVC - New York' }))[0], 403);
  fs.unlinkSync(jobDir + ':user.drive.id');
  check('drive-link: no Drive id is 404', await dlErr({ folder: 'GVC - New York/A' }), [404, 'No Drive id beside this item']);
  check('drive-link: a file with no id is 404', await dlErr({ folder: 'GVC - New York/A', file: 'Floorplan/plan.pdf' }), [404, 'No Drive id beside this item']);
  if (process.platform === 'win32') {
    fs.writeFileSync(jobDir + ':user.drive.id', 'FOLDERID1234567');
    fs.writeFileSync(path.join(jobDir, 'Floorplan', 'plan.pdf') + ':user.drive.id', 'FILEID1234567\n');
    check('drive-link: the folder link', await dl({ folder: 'GVC - New York/A' }), { url: 'https://drive.google.com/drive/folders/FOLDERID1234567' });
    check('drive-link: the file link', await dl({ folder: 'GVC - New York\\A', file: 'Floorplan\\plan.pdf' }), { url: 'https://drive.google.com/file/d/FILEID1234567/view' });
  }
  check('the real drive-link route points at the Drive root', /driveLinkRoute\(\{ driveRoot: 'G:\\\\Shared drives'/.test(fs.readFileSync(path.join(__dirname, '..', 'helper', 'routes.js'), 'utf8')), true);

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

  /* ---------- Slice 4: POST /piece writes the showsheet into the job folder ---------- */
  const { pieceRoute } = require('../helper/piece.js');
  const { insideJobPiece } = require('../helper/pdf/guard.js');
  const { archivePrevious } = require('../helper/pdf/archive.js');
  const pRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-piece-'));
  const job = n => path.join(pRoot, 'GVC - Test', n);
  ['1 Example St', '2 Example St', '3 Example St', '5 Example St', '1 Example St/Contracts'].forEach(n => fs.mkdirSync(job(n), { recursive: true }));
  fs.mkdirSync(path.join(job('2 Example St'), 'Show Sheet'));
  fs.mkdirSync(path.join(job('3 Example St'), 'Show Sheet'));
  fs.mkdirSync(path.join(job('3 Example St'), 'marketing', 'SHOWSHEETS'), { recursive: true });
  fs.writeFileSync(path.join(job('1 Example St'), 'Exclusive - Jane Client.pdf'), 'paper');
  const ROWS = {
    p1: { id: 'p1', drive_folder: 'GVC - Test/1 Example St', label: '1 Example St 4A', market: 'NYC', core: { address: '1 Example St', unit: '4A' } },
    p2: { id: 'p2', drive_folder: 'GVC - Test/2 Example St', label: '2 Example St', market: 'NJ', core: { address: '2 Example St' } },
    p3: { id: 'p3', drive_folder: 'GVC - Test/3 Example St', label: '3 Example St', market: 'NJ', core: { address: '3 Example St' } },
    p5: { id: 'p5', drive_folder: 'GVC - Test/5 Example St', label: '5 Example St', market: 'FL', core: { address: '5 Example St' } },
    none: { id: 'none', drive_folder: null, label: 'x', core: {} },
    gone: { id: 'gone', drive_folder: 'GVC - Test/Missing St', label: 'x', core: {} },
    paper: { id: 'paper', drive_folder: 'GVC - Test/1 Example St/Contracts', label: 'x', core: {} },
    climb: { id: 'climb', drive_folder: 'GVC - Test/../../x', label: 'x', core: {} }
  };
  const DOCS = {};
  let renders = 0, linkTries = 0;
  const pdb = { select: async (t, m) => t === 'properties' ? (ROWS[m.id] ? [ROWS[m.id]] : []) : (DOCS[m.property_id] ? [DOCS[m.property_id]] : []) };
  const piece = pieceRoute({ db: pdb, driveRoot: pRoot, today: () => '2026-10-22', sleep: async () => {},
    render: async o => { renders++; return { pdf: Buffer.alloc(1024, 'x'), label: o.state.address + (o.state.unit ? ' ' + o.state.unit : ''), pages: 2 }; },
    driveLink: () => (++linkTries >= 3 ? 'https://drive.google.com/file/d/FILEID1234567/view' : null) });
  const cfgP = { siteBase: 'http://localhost:8080' };
  const S = (address, unit) => ({ address, unit: unit || '' });
  const pErr = b => piece(b, cfgP).then(() => null, e => [e.status, e.message]);
  const countFiles = d => { let n = 0; (function walk(x) { fs.readdirSync(x, { withFileTypes: true }).forEach(e => { if (e.isDirectory()) walk(path.join(x, e.name)); else n++; }); })(d); return n; };

  check('piece: another tool is 400', (await pErr({ propertyId: 'p1', tool: 'postcard', state: {} }))[0], 400);
  check('piece: no job named is 400', (await pErr({ tool: 'showsheet', state: {} }))[0], 400);
  check('piece: unknown job is 404', (await pErr({ propertyId: 'zz', tool: 'showsheet', state: {} }))[0], 404);
  check('piece: no folder', await pErr({ propertyId: 'none', tool: 'showsheet', state: {} }), [409, 'This job has no Drive folder linked.']);
  check('piece: gone folder', await pErr({ propertyId: 'gone', tool: 'showsheet', state: {} }), [404, 'The job\'s Drive folder isn\'t on this computer.']);
  check('piece: paperwork path', (await pErr({ propertyId: 'paper', tool: 'showsheet', state: {} }))[0], 403);
  check('piece: a climbing folder is refused', (await pErr({ propertyId: 'climb', tool: 'showsheet', state: {} }))[0], 400);
  check('piece: refused before drawing, nothing written', [renders, countFiles(job('1 Example St'))], [0, 1]);

  let out = await piece({ propertyId: 'p2', tool: 'showsheet', state: S('2 Example St'), paper: 'a5' }, cfgP);
  check('piece: an existing Show Sheet at the top is used', [out.path, out.folderMade, out.pages, out.size], ['Show Sheet/Showsheet - 2 Example St - 2026-10-22.pdf', false, 2, 1024]);
  check('piece: Drive link retried until it appears', [out.url, linkTries], ['https://drive.google.com/file/d/FILEID1234567/view', 3]);
  out = await piece({ propertyId: 'p3', tool: 'showsheet', state: S('3 Example St') }, cfgP);
  check('piece: Marketing first, any case', out.path, 'marketing/SHOWSHEETS/Showsheet - 3 Example St - 2026-10-22.pdf');
  out = await piece({ propertyId: 'p5', tool: 'showsheet', state: S('5 Example St') }, cfgP);
  check('piece: none → Marketing\Showsheet made', [out.path, out.folderMade, out.archived], ['Marketing/Showsheet/Showsheet - 5 Example St - 2026-10-22.pdf', true, null]);

  const first = await piece({ propertyId: 'p1', tool: 'showsheet', state: S('1 Example St', '4A') }, cfgP);
  check('piece: first build', [first.path, first.archived], ['Marketing/Showsheet/Showsheet - 1 Example St 4A - 2026-10-22.pdf', null]);
  const rec = x => ({ path: x.path, name: x.name, size: x.size, modified: x.modified, via: 'helper' });
  DOCS.p1 = { output: rec(first), outputs: [rec(first)] };
  let before = countFiles(job('1 Example St'));
  const second = await piece({ propertyId: 'p1', tool: 'showsheet', state: S('1 Example St', '4A') }, cfgP);
  check('piece: second build same day gets (2)', second.name, 'Showsheet - 1 Example St 4A - 2026-10-22 (2).pdf');
  check('archive moved', second.archived, { from: first.path, to: 'Marketing/Showsheet/Archive/Showsheet - 1 Example St 4A - 2026-10-22.pdf' });
  check('archive: the old file is in Archive, nothing deleted', [fs.existsSync(path.join(job('1 Example St'), ...second.archived.to.split('/'))), countFiles(job('1 Example St'))], [true, before + 1]);

  DOCS.p1 = { output: rec(second), outputs: [rec(second), rec(first)] };
  fs.appendFileSync(path.join(job('1 Example St'), ...second.path.split('/')), 'edited by hand');
  before = countFiles(job('1 Example St'));
  const third = await piece({ propertyId: 'p1', tool: 'showsheet', state: S('1 Example St', '4A') }, cfgP);
  check('archive left when size moved', third.archived, { left: second.path, why: 'older showsheet left in place: it changed after the workspace made it' });
  check('archive left: the new PDF is still written', [fs.existsSync(path.join(job('1 Example St'), ...third.path.split('/'))), countFiles(job('1 Example St'))], [true, before + 1]);

  DOCS.p1 = { output: Object.assign(rec(third), { path: 'Marketing/Showsheet/Gone.pdf' }), outputs: [Object.assign(rec(third), { path: 'Marketing/Showsheet/Gone.pdf' })] };
  check('archive left when gone', (await piece({ propertyId: 'p1', tool: 'showsheet', state: S('1 Example St', '4A') }, cfgP)).archived,
    { left: 'Marketing/Showsheet/Gone.pdf', why: 'older showsheet left in place: it isn\'t where the workspace left it' });
  DOCS.p1 = { output: rec(third), outputs: [] };
  check('archive: a file not in outputs is left', (await piece({ propertyId: 'p1', tool: 'showsheet', state: S('1 Example St', '4A') }, cfgP)).archived.why,
    'older showsheet left in place: the workspace has no record of making it');
  DOCS.p1 = { output: Object.assign(rec(third), { via: 'print' }), outputs: [rec(third)] };
  check('archive: a printed sheet is never moved', (await piece({ propertyId: 'p1', tool: 'showsheet', state: S('1 Example St', '4A') }, cfgP)).archived, null);
  DOCS.p1 = { output: Object.assign(rec(third), { path: '../../Exclusive - Jane Client.pdf' }), outputs: [Object.assign(rec(third), { path: '../../Exclusive - Jane Client.pdf' })] };
  check('archive: a recorded path outside the folder is left', !!(await piece({ propertyId: 'p1', tool: 'showsheet', state: S('1 Example St', '4A') }, cfgP)).archived.left, true);
  check('archive: paperwork untouched', fs.existsSync(path.join(job('1 Example St'), 'Exclusive - Jane Client.pdf')), true);

  /* Archive clash → (2), never overwritten */
  const sheetDir = path.join(job('1 Example St'), 'Marketing', 'Showsheet');
  fs.writeFileSync(path.join(sheetDir, 'Old.pdf'), 'old one');
  const oldSt = fs.statSync(path.join(sheetDir, 'Old.pdf'));
  const oldRec = { path: 'Marketing/Showsheet/Old.pdf', size: oldSt.size, modified: oldSt.mtime.toISOString(), via: 'helper' };
  fs.writeFileSync(path.join(sheetDir, 'Archive', 'Old.pdf'), 'already archived');
  check('archive clash gets (2)', archivePrevious({ jobAbs: job('1 Example St'), dir: sheetDir, prev: oldRec, outputs: [oldRec] }),
    { from: 'Marketing/Showsheet/Old.pdf', to: 'Marketing/Showsheet/Archive/Old (2).pdf' });
  check('archive clash: the first one is untouched', fs.readFileSync(path.join(sheetDir, 'Archive', 'Old.pdf'), 'utf8'), 'already archived');

  /* the write guard */
  const jA = job('1 Example St');
  check('guard: in the showsheet folder', insideJobPiece(path.join(sheetDir, 'a.pdf'), jA, sheetDir), true);
  check('guard: in its Archive', insideJobPiece(path.join(sheetDir, 'Archive', 'a.pdf'), jA, sheetDir), true);
  check('guard: case does not matter', insideJobPiece(path.join(sheetDir.toUpperCase(), 'a.pdf'), jA, sheetDir), true);
  check('guard: ..\\..\\x.pdf refused', insideJobPiece(path.join(sheetDir, '..', '..', 'x.pdf'), jA, sheetDir), false);
  check('guard: look-alike Showsheet2 refused', insideJobPiece(path.join(jA, 'Marketing', 'Showsheet2', 'a.pdf'), jA, sheetDir), false);
  check('guard: deeper than Archive refused', insideJobPiece(path.join(sheetDir, 'Archive', 'x', 'a.pdf'), jA, sheetDir), false);
  check('guard: a folder outside the job refused', insideJobPiece(path.join(pRoot, 'a.pdf'), jA, pRoot), false);
  check('guard: relative paths refused', insideJobPiece('a.pdf', jA, sheetDir), false);

  /* review fixes: the name is the job's, a stuck draw is capped, nothing after the write is an error */
  const { safeLabel } = require('../helper/piece.js');
  check('label: paperwork words and control characters out', safeLabel('12 Contract Ave\u0007 Signed'), '12 Ave');
  check('label: at most 80 characters', safeLabel('x'.repeat(200)).length, 80);
  ROWS.p6 = { id: 'p6', drive_folder: 'GVC - Test/6 Example St', label: '6 Example St', market: 'NJ', core: { address: '6 Example St', unit: '2' } };
  fs.mkdirSync(job('6 Example St'));
  out = await piece({ propertyId: 'p6', tool: 'showsheet', state: S('../../Exclusive - Jane Client') }, cfgP);
  check('label: from the job row, never the posted state', out.name, 'Showsheet - 6 Example St 2 - 2026-10-22.pdf');
  const stuck = pieceRoute({ db: pdb, driveRoot: pRoot, today: () => '2026-10-22', sleep: async () => {}, renderMs: 50,
    render: () => new Promise(() => {}), driveLink: () => null });
  before = countFiles(job('6 Example St'));
  check('a draw that never ends is refused', await stuck({ propertyId: 'p6', tool: 'showsheet', state: S('6 Example St') }, cfgP).then(() => null, e => e.status), 504);
  check('a stuck draw writes nothing', countFiles(job('6 Example St')), before);
  const linkThrows = pieceRoute({ db: pdb, driveRoot: pRoot, today: () => '2026-10-22', sleep: async () => {},
    render: async () => ({ pdf: Buffer.alloc(10), pages: 2 }), driveLink: () => { throw new Error('stream busy'); } });
  out = await linkThrows({ propertyId: 'p6', tool: 'showsheet', state: S('6 Example St') }, cfgP);
  check('a Drive link error still answers ok', [out.ok, out.url], [true, null]);
  DOCS.p6 = { output: { path: 'Marketing/Showsheet/x.pdf:evil', size: 10, modified: 0, via: 'helper' }, outputs: [{ path: 'Marketing/Showsheet/x.pdf:evil' }] };
  check('archive: a stream name in the record is left', !!(await piece({ propertyId: 'p6', tool: 'showsheet', state: S('6 Example St') }, cfgP)).archived.left, true);
  DOCS.p6 = { output: { path: 'Marketing/Showsheet/notes.txt', size: 10, modified: 0, via: 'helper' }, outputs: [{ path: 'Marketing/Showsheet/notes.txt' }] };
  check('archive: only a PDF is ever moved', !!(await piece({ propertyId: 'p6', tool: 'showsheet', state: S('6 Example St') }, cfgP)).archived.left, true);

  /* ---------- Slice 5: one /piece for every piece, a listing or a pitch ---------- */
  {
    const r5 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-piece5-'));
    const j5 = n => path.join(r5, 'GVC - Test', n);
    ['10 Example St', '11 Example St', '2026-10-01 12 Sample Ln', '13 Example St/Contracts', '14 Example St'].forEach(n => fs.mkdirSync(j5(n), { recursive: true }));
    fs.mkdirSync(path.join(j5('11 Example St'), 'Marketing', 'Postcards'), { recursive: true });
    fs.writeFileSync(path.join(j5('2026-10-01 12 Sample Ln'), '12 Sample Ln.pdf'), 'their own pitch');
    const PROPS = {
      l10: { id: 'l10', drive_folder: 'GVC - Test/10 Example St', label: '10 Example St', market: 'NJ', core: { address: '10 Example St', unit: '' } },
      l11: { id: 'l11', drive_folder: 'GVC - Test/11 Example St', label: '11 Example St', market: 'NJ', core: { address: '11 Example St' } },
      l14: { id: 'l14', drive_folder: 'GVC - Test/14 Example St', label: '14 Example St', market: 'NYC', core: { address: '14 Example St' } }
    };
    const PITCHES = {
      q12: { id: 'q12', drive_folder: 'GVC - Test/2026-10-01 12 Sample Ln', label: '12 Sample Ln', market: 'NJ', core: { address: '12 Sample Ln' } },
      q13: { id: 'q13', drive_folder: 'GVC - Test/13 Example St/Contracts', label: '13 Example St', market: 'NJ', core: { address: '13 Example St' } },
      qnone: { id: 'qnone', drive_folder: null, label: 'x', core: {} }
    };
    const D5 = {};
    const asked = [];
    const db5 = { select: async (t, m) => {
      asked.push(t);
      if (t === 'properties') return PROPS[m.id] ? [PROPS[m.id]] : [];
      if (t === 'pitches') return PITCHES[m.id] ? [PITCHES[m.id]] : [];
      const k = (m.property_id || m.pitch_id) + '|' + m.tool;
      return D5[k] ? [D5[k]] : [];
    } };
    let drawn = [];
    const p5 = pieceRoute({ db: db5, driveRoot: r5, today: () => '2026-10-22', sleep: async () => {},
      render: async o => { drawn.push([o.tool, o.paper]); return { pdf: Buffer.alloc(2048, 'y'), pages: o.tool === 'brochure' ? 5 : 2 }; },
      driveLink: () => null });
    const e5 = b => p5(b, cfgP).then(() => null, e => [e.status, e.message]);
    const PNG = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]).toString('base64');

    let o5 = await p5({ propertyId: 'l10', tool: 'brochure', state: { paper: 'half' } }, cfgP);
    check('brochure: Marketing\\Brochure made', [o5.path, o5.folderMade, o5.pages], ['Marketing/Brochure/Brochure - 10 Example St - 2026-10-22.pdf', true, 5]);
    check('brochure: drawn with no paper forced', drawn[0], ['brochure', null]);
    o5 = await p5({ propertyId: 'l11', tool: 'postcard-listed', state: {} }, cfgP);
    check('postcard listed: an existing Postcards folder', o5.path, 'Marketing/Postcards/Just Listed Postcard - 11 Example St - 2026-10-22.pdf');
    o5 = await p5({ propertyId: 'l11', tool: 'postcard-sold', state: {} }, cfgP);
    check('postcard sold: beside it', o5.path, 'Marketing/Postcards/Just Sold Postcard - 11 Example St - 2026-10-22.pdf');
    o5 = await p5({ propertyId: 'l14', tool: 'seller', state: {} }, cfgP);
    check('seller on a listing: Marketing\\Pitch made', [o5.path, o5.folderMade], ['Marketing/Pitch/Seller Package - 14 Example St - 2026-10-22.pdf', true]);
    const s1 = await p5({ pitchId: 'q12', tool: 'seller', state: {} }, cfgP);
    check('seller on a pitch: Marketing/Pitch made in the pitch folder', [s1.path, s1.folderMade, asked.indexOf('pitches') !== -1], ['Marketing/Pitch/Seller Package - 12 Sample Ln - 2026-10-22.pdf', true, true]);
    D5['q12|seller'] = { output: { path: s1.path, size: s1.size, modified: s1.modified, via: 'helper' }, outputs: [{ path: s1.path }] };
    const s2 = await p5({ pitchId: 'q12', tool: 'seller', state: {} }, cfgP);
    check('seller on a pitch: the older one into Marketing/Pitch/Archive', [s2.name, s2.archived],
      ['Seller Package - 12 Sample Ln - 2026-10-22 (2).pdf', { from: s1.path, to: 'Marketing/Pitch/Archive/' + s1.name }]);
    check('the pitch\'s own files untouched', fs.readFileSync(path.join(j5('2026-10-01 12 Sample Ln'), '12 Sample Ln.pdf'), 'utf8'), 'their own pitch');

    const m1 = await p5({ pitchId: 'q12', tool: 'pitch-map', image: PNG }, cfgP);
    check('map: written as sent, a .png, nothing drawn', [m1.path, m1.size, drawn.filter(d => d[0] === 'pitch-map').length], ['Marketing/Pitch/Map - 12 Sample Ln - 2026-10-22.png', 48, 0]);
    D5['q12|pitch-map'] = { output: { path: m1.path, size: m1.size, modified: m1.modified, via: 'helper' }, outputs: [{ path: m1.path }] };
    const m2 = await p5({ pitchId: 'q12', tool: 'pitch-map', image: PNG }, cfgP);
    check('map: the older map archived', m2.archived, { from: m1.path, to: 'Marketing/Pitch/Archive/' + m1.name });
    D5['q12|pitch-map'] = { output: { path: m2.path, size: 1, modified: m2.modified, via: 'helper' }, outputs: [{ path: m2.path }] };
    check('map: a changed older map is left, named as a map', (await p5({ pitchId: 'q12', tool: 'pitch-map', image: PNG }, cfgP)).archived.why,
      'older map left in place: it changed after the workspace made it');
    o5 = await p5({ propertyId: 'l14', tool: 'pitch-map', image: PNG }, cfgP);
    check('map on a listing: beside its seller pitch', o5.path, 'Marketing/Pitch/Map - 14 Example St - 2026-10-22.png');

    check('map: not a PNG refused', await e5({ pitchId: 'q12', tool: 'pitch-map', image: 'data:image/png;base64,' + Buffer.from('<svg onload=x>').toString('base64') }), [400, 'The map has to come as a PNG picture.']);
    check('map: a JPEG data URL refused', (await e5({ pitchId: 'q12', tool: 'pitch-map', image: 'data:image/jpeg;base64,AAAA' }))[0], 400);
    check('map: no image refused', (await e5({ pitchId: 'q12', tool: 'pitch-map', state: {} }))[0], 400);
    check('a postcard on a pitch refused', (await e5({ pitchId: 'q12', tool: 'postcard-listed', state: {} }))[0], 400);
    check('both owners named refused', await e5({ propertyId: 'l10', pitchId: 'q12', tool: 'seller', state: {} }), [400, 'The request didn\'t say which job.']);
    check('no owner named refused', (await e5({ tool: 'seller', state: {} }))[0], 400);
    check('a pitch with no folder', await e5({ pitchId: 'qnone', tool: 'seller', state: {} }), [409, 'This pitch has no Drive folder linked.']);
    check('an unknown pitch', (await e5({ pitchId: 'zz', tool: 'seller', state: {} }))[0], 404);
    check('a pitch folder that is paperwork', (await e5({ pitchId: 'q13', tool: 'seller', state: {} }))[0], 403);
    check('an inherited name is not a piece', (await e5({ propertyId: 'l10', tool: 'constructor', state: {} }))[0], 400);
    check('a brochure with no state refused', (await e5({ propertyId: 'l10', tool: 'brochure' }))[0], 400);
    check('a tool given as a list is refused', (await e5({ propertyId: 'l10', tool: ['brochure'], state: {} }))[0], 400);
    check('a state given as a list is refused', (await e5({ propertyId: 'l10', tool: 'brochure', state: [] }))[0], 400);
    // a job folder that is a junction pointing outside the Drive root is refused
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-outside-'));
    let linked = true;
    try { fs.symlinkSync(outside, j5('15 Linked St'), 'junction'); } catch (e) { linked = false; }
    if (linked) {
      PROPS.l15 = { id: 'l15', drive_folder: 'GVC - Test/15 Linked St', label: '15 Linked St', market: 'NJ', core: { address: '15 Linked St' } };
      check('a job folder linked outside the Drive root is refused', (await e5({ propertyId: 'l15', tool: 'brochure', state: {} }))[0], 403);
      check('…and nothing was written there', fs.readdirSync(outside).length, 0);
      fs.rmdirSync(j5('15 Linked St'));   // removes the link only
    }
    /* Slice 6: the For Sale sign; the Open House flyer is gone */
    o5 = await p5({ propertyId: 'l11', tool: 'signage', state: {} }, cfgP);
    check('signage: Marketing\\Signage made', [o5.path, o5.folderMade], ['Marketing/Signage/For Sale Sign - 11 Example St - 2026-10-22.pdf', true]);
    fs.mkdirSync(path.join(j5('14 Example St'), 'Signs'), { recursive: true });
    o5 = await p5({ propertyId: 'l14', tool: 'signage', state: {} }, cfgP);
    check('signage: an old Signs folder at the top is used', o5.path, 'Signs/For Sale Sign - 14 Example St - 2026-10-22.pdf');
    check('a sign for a pitch is refused', (await e5({ pitchId: 'q12', tool: 'signage', state: {} }))[0], 400);
    check('an open house flyer is refused (the tool is gone)', (await e5({ propertyId: 'l10', tool: 'open-house', state: {} }))[0], 400);
    check('archive sentences per piece', require('../helper/pdf/archive.js').sentences('brochure').GONE, 'older brochure left in place: it isn\'t where the workspace left it');
  }

  /* body sizes: /piece takes up to 40 MB, every other route 1 MB */
  const big = mb => ({ propertyId: 'nobody', tool: 'showsheet', state: { pad: 'x'.repeat(mb * 1024 * 1024) } });
  const pairH = { origin: 'http://localhost:8080', 'x-gvc-pair': cfg.pairCode };
  r = await req('POST', '/piece', { origin: 'http://localhost:8080' }, { propertyId: 'p1', tool: 'showsheet', state: {} });
  check('/piece unpaired is refused', r.status, 403);
  r = await req('POST', '/piece', pairH, big(2));
  check('/piece: a 2 MB body gets past the size check', [r.status !== 413, r.json && r.json.error !== 'That request is too large.'], [true, true]);
  r = await req('POST', '/drive-link', pairH, big(2));
  check('/drive-link: a 2 MB body is refused', [r.status, r.json && r.json.error], [413, 'That request is too large.']);
  r = await req('POST', '/piece', pairH, big(41));
  check('/piece: 41 MB is refused', [r.status, r.json && r.json.error], [413, 'That request is too large.']);
  check('the real /piece route points at the Drive root', /driveRoot: 'G:\\\\Shared drives',\r?\n  driveLink/.test(fs.readFileSync(path.join(__dirname, '..', 'helper', 'routes.js'), 'utf8')), true);

  /* Task 10 security fixes */
  const { hasPaperworkWord } = require('../assets/js/drive-rules.js');
  check('label: the cut never leaves a paperwork word behind', hasPaperworkWord(safeLabel('x'.repeat(74) + ' Offering')), false);
  // a junction inside the job folder must not carry a new folder or a move outside it
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-outside-'));
  ROWS.p7 = { id: 'p7', drive_folder: 'GVC - Test/7 Example St', label: '7 Example St', market: 'NJ', core: { address: '7 Example St' } };
  fs.mkdirSync(job('7 Example St'));
  fs.symlinkSync(outside, path.join(job('7 Example St'), 'Marketing'), 'junction');
  check('a Marketing junction is refused', await piece({ propertyId: 'p7', tool: 'showsheet', state: S('7 Example St') }, cfgP).then(() => null, e => e.status), 403);
  check('…and nothing is made outside the job', fs.readdirSync(outside), []);
  ROWS.p8 = { id: 'p8', drive_folder: 'GVC - Test/8 Example St', label: '8 Example St', market: 'NJ', core: { address: '8 Example St' } };
  const sh8 = path.join(job('8 Example St'), 'Marketing', 'Showsheet');
  fs.mkdirSync(sh8, { recursive: true });
  const old8 = path.join(sh8, 'Showsheet - 8 Example St - 2026-10-01.pdf');
  fs.writeFileSync(old8, 'x'.repeat(10));
  fs.symlinkSync(outside, path.join(sh8, 'Archive'), 'junction');
  const st8 = fs.statSync(old8);
  DOCS.p8 = { output: { path: 'Marketing/Showsheet/' + path.basename(old8), size: 10, modified: st8.mtime.toISOString(), via: 'helper' },
    outputs: [{ path: 'Marketing/Showsheet/' + path.basename(old8) }] };
  out = await piece({ propertyId: 'p8', tool: 'showsheet', state: S('8 Example St') }, cfgP);
  check('an Archive junction leaves the older file in place', [!!out.archived.left, fs.existsSync(old8), fs.readdirSync(outside)], [true, true, []]);
  // a body sent in pieces with no length, over the limit and never ending, is cut off
  const cut = await new Promise(resolve => {
    const q = http.request({ host: '127.0.0.1', port: server.address().port, method: 'POST', path: '/drive-link', headers: pairH });
    const t = setTimeout(() => { q.destroy(); resolve('still open'); }, 8000);
    q.on('response', rs => { rs.resume(); clearTimeout(t); resolve('answered ' + rs.statusCode); q.destroy(); });
    q.on('error', () => { clearTimeout(t); resolve('cut off'); });
    const chunk = Buffer.alloc(256 * 1024, 120);
    let n = 0;
    (function more() { if (q.destroyed || n++ > 400) return; q.write(chunk, () => setImmediate(more)); })();
  });
  check('an endless body over the limit is cut off', cut === 'still open' ? cut : 'ended', 'ended');

  check('bound to loopback', server.address().address, '127.0.0.1');
  server.close();

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
