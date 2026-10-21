/* ============================================================
   Tests for the helper's Supabase client (helper/supabase.js) and the
   backup (helper/backup.js), against a fake Supabase held in memory —
   the real project is never touched.

   Plain Node:  node scripts/test-helper-db.js
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path');
process.env.GVC_HELPER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-db-'));
const { createClient, ConflictError } = require('../helper/supabase.js');
const { backup, TABLES } = require('../helper/backup.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}
async function throwsName(fn) { try { await fn(); return null; } catch (e) { return e.name; } }

/* ---------- a fake Supabase: tables in memory, PostgREST-ish filters ---------- */
function fakeSupabase(tables, files) {
  const log = [];
  let tokens = 0;
  const res = (status, body, headers) => Promise.resolve({
    ok: status < 400, status, headers: { get: k => (headers || {})[k.toLowerCase()] || null },
    json: () => Promise.resolve(body), text: () => Promise.resolve(body == null ? '' : JSON.stringify(body)),
    arrayBuffer: () => Promise.resolve(Buffer.from(String(body)))
  });
  const fetch = (url, opts) => {
    opts = opts || {};
    const u = new URL(url), method = opts.method || 'GET', h = opts.headers || {};
    log.push(method + ' ' + u.pathname + u.search);
    if (u.pathname === '/auth/v1/token') {
      const b = JSON.parse(opts.body);
      if (b.password !== 'helper-pw' && !b.refresh_token) return res(400, { error_description: 'Invalid login credentials' });
      tokens++; return res(200, { access_token: 'tok' + tokens, refresh_token: 'r', expires_in: 3600 });
    }
    if (!/^Bearer tok/.test(h.authorization || '')) return res(401, { message: 'no session' });
    const m = /^\/rest\/v1\/(\w+)$/.exec(u.pathname);
    if (m) {
      const t = tables[m[1]];
      if (!t) return res(404, { message: 'relation "public.' + m[1] + '" does not exist' });
      const filters = [...u.searchParams].filter(([k]) => !['select', 'on_conflict', 'order', 'limit', 'offset'].includes(k));
      const match = row => filters.every(([k, v]) => String(row[k]) === v.replace(/^eq\./, ''));
      if (method === 'HEAD') return res(200, null, { 'content-range': '0-' + (t.length - 1) + '/' + t.length });
      if (method === 'GET') {
        const off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || 1000);
        return res(200, t.filter(match).slice(off, off + lim));
      }
      if (method === 'POST') { const rows = [].concat(JSON.parse(opts.body)); rows.forEach(r => t.push(Object.assign({ version: 1 }, r))); return res(201, rows); }
      if (method === 'PATCH') {
        const patch = JSON.parse(opts.body), hit = t.filter(match);
        hit.forEach(r => { Object.assign(r, patch); r.version = (r.version || 1) + 1; });
        return res(200, hit);
      }
    }
    const list = /^\/storage\/v1\/object\/list\/([\w-]+)$/.exec(u.pathname);
    if (list) {
      const prefix = JSON.parse(opts.body).prefix || '';
      const names = Object.keys(files).filter(f => f.startsWith(prefix ? prefix + '/' : ''));
      const level = new Map();
      names.forEach(f => { const rest = f.slice(prefix ? prefix.length + 1 : 0); const first = rest.split('/')[0]; level.set(first, rest.includes('/') ? null : { id: first }); });
      return res(200, [...level].map(([name, meta]) => ({ name, id: meta ? meta.id : null })));
    }
    const dl = /^\/storage\/v1\/object\/([\w-]+)\/(.+)$/.exec(u.pathname);
    if (dl && method === 'GET') return res(200, files[decodeURIComponent(dl[2])]);
    return res(404, {});
  };
  return { fetch, log };
}

const CFG = { supabaseUrl: 'https://example.supabase.co', publishableKey: 'pk', helperEmail: 'helper@example.com', helperPassword: 'helper-pw' };

(async () => {
  /* ---------- config: project address from the site's own file ---------- */
  const lc = require('../helper/config.js').loadConfig();
  check('project from supabase-config.js', [lc.supabaseUrl, /^sb_publishable_/.test(lc.publishableKey || '')], ['https://hoszxrrlfhzbbrzenqvp.supabase.co', true]);
  check('no account by default', [lc.helperEmail || null, lc.helperPassword || null], [null, null]);

  /* ---------- client ---------- */
  const T = { properties: [{ id: 'p1', slug: 'a', version: 1 }, { id: 'p2', slug: 'b', version: 3 }], todos: [{ id: 't1' }] };
  const F = { 'p1/one.jpg': 'JPEG-1', 'p1/two.jpg': 'JPEG-2', 'developments/x/r.png': 'PNG' };
  let fake = fakeSupabase(T, F);
  let c = createClient(CFG, { fetch: fake.fetch });
  check('ready with an account', c.ready(), true);
  check('not ready without one', createClient({ supabaseUrl: 'x', publishableKey: 'k' }, { fetch: fake.fetch }).ready(), false);
  check('select', (await c.select('properties')).map(r => r.slug), ['a', 'b']);
  check('signs in once', fake.log.filter(l => /token/.test(l)).length, 1);
  check('paged reads are ordered (no skipped rows)', fake.log.filter(l => /^GET \/rest\/v1\/properties/.test(l)).every(l => /[?&]order=/.test(l)), true);
  T.asana_tasks = [{ gid: 'g1' }]; T.asana_people = [{ gid: 'u1' }];
  await c.select('asana_tasks'); await c.select('asana_people');
  check('Asana tables are read in gid order (they have no id)', fake.log.filter(l => /^GET \/rest\/v1\/asana_/.test(l)).every(l => /[?&]order=gid/.test(l)), true);
  check('filtered select',(await c.select('properties', { slug: 'b' })).map(r => r.id), ['p2']);
  /* C1: order and limit read just the newest rows, in one request */
  T.sync_runs = [1, 2, 3].map(i => ({ id: 'r' + i, kind: 'de', started_at: '2026-10-1' + i, totals: { full: i === 2 } }));
  fake.log.length = 0;
  const newest = await c.select('sync_runs', { kind: 'de' }, 'kind,started_at', { order: 'started_at.desc', limit: 2 }).catch(e => e.message);
  const runGets = fake.log.filter(l => /^GET \/rest\/v1\/sync_runs/.test(l)).map(decodeURIComponent);
  check('order and limit: one request, at most the limit back', [runGets.length, Array.isArray(newest) && newest.length], [1, 2]);
  check('order and limit: asks newest first (key as tie-break), limit 2, no paging', runGets.map(l => [/[?&]order=started_at\.desc,id(&|$)/.test(l), /[?&]limit=2(&|$)/.test(l), /offset=/.test(l)]), [[true, true, false]]);
  check('order and limit: only the columns asked for', runGets.map(l => /[?&]select=kind,started_at(&|$)/.test(l)), [true]);
  fake.log.length = 0;
  await c.select('sync_runs', { kind: 'asana', 'totals->>full': 'true' }, 'kind,started_at', { order: 'started_at.desc', limit: 1 });
  check('a JSON field filter goes through as PostgREST\'s ->> (eq)', fake.log.map(decodeURIComponent).some(l => /[?&]totals->>full=eq\.true(&|$)/.test(l)), true);
  fake.log.length = 0;
  await c.select('properties', {}, 'id', { order: 'slug.desc' });
  check('order without a limit still pages, key as tie-break', fake.log.filter(l => /^GET /.test(l)).map(decodeURIComponent).every(l => /order=slug\.desc,id&/.test(l) && /limit=1000/.test(l) && /offset=0/.test(l)), true);
  check('count', await c.count('properties'), 2);
  await c.insert('todos', { id: 't2', body: 'x' });
  check('insert', T.todos.length, 2);
  const up = await c.update('properties', { id: 'p2' }, { stage: 'Live' }, { version: 3 });
  check('update with the right version', [up.length, T.properties[1].stage, T.properties[1].version], [1, 'Live', 4]);
  check('stale version is a conflict', await throwsName(() => c.update('properties', { id: 'p2' }, { stage: 'Sold' }, { version: 3 })), 'ConflictError');
  check('conflict leaves the row alone', T.properties[1].stage, 'Live');
  check('missing table is null, not an error', await c.select('pitches').catch(e => e.status), 404);
  const bad = createClient(Object.assign({}, CFG, { helperPassword: 'nope' }), { fetch: fakeSupabase(T, F).fetch });
  let msg = null; try { await bad.select('properties'); } catch (e) { msg = e.message; }
  check('wrong password explained', /helper account/.test(msg || ''), true);

  /* ---------- backup ---------- */
  check('backup covers every workspace table, the Asana cache and People too', ['properties', 'pitches', 'dev_projects', 'changes', 'sync_runs', 'de_listings', 'asana_tasks', 'asana_people'].every(t => TABLES.indexOf(t) !== -1), true);
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-bk-')), 'supabase-backup-2026-10-19');
  fake = fakeSupabase(T, F);
  c = createClient(CFG, { fetch: fake.fetch });
  const man = await backup({ client: c, outDir: out, tables: ['properties', 'todos', 'pitches'], bucket: 'property-photos' });
  check('manifest tables', man.tables, { properties: 2, todos: 2, pitches: 'not created yet' });
  check('manifest files', man.bucket, { name: 'property-photos', files: 3 });
  check('table file', JSON.parse(fs.readFileSync(path.join(out, 'properties.json'), 'utf8')).length, 2);
  check('bucket file', fs.readFileSync(path.join(out, 'files', 'p1', 'two.jpg'), 'utf8'), 'JPEG-2');
  check('nested bucket file', fs.existsSync(path.join(out, 'files', 'developments', 'x', 'r.png')), true);
  check('restore notes', fs.existsSync(path.join(out, 'README.txt')), true);
  check('never overwrites a backup', await throwsName(() => backup({ client: c, outDir: out, tables: ['todos'] })), 'Error');

  /* a bucket file whose name climbs out of the folder is skipped and listed, never written */
  const evilOut = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-bk-')), 'b');
  const evil = fakeSupabase({ todos: [] }, { 'ok/a.jpg': 'A', '../../escape.txt': 'X', 'x/../../y.txt': 'Y', 'c:/z.txt': 'Z' });
  const m2 = await backup({ client: createClient(CFG, { fetch: evil.fetch }), outDir: evilOut, tables: ['todos'], bucket: 'property-photos' });
  check('unsafe names skipped', [m2.bucket.files, m2.bucket.skipped.length], [1, 3]);
  check('nothing written outside', fs.existsSync(path.join(path.dirname(evilOut), 'escape.txt')) || fs.existsSync(path.join(evilOut, 'y.txt')), false);

  /* a count that disagrees with the rows read fails loudly */
  const wrong = fakeSupabase({ todos: [{ id: 1 }] }, {});
  const orig = wrong.fetch;
  const lying = (url, opts) => (opts && opts.method === 'HEAD')
    ? Promise.resolve({ ok: true, status: 200, headers: { get: () => '0-4/5' }, text: () => Promise.resolve('') }) : orig(url, opts);
  const c2 = createClient(CFG, { fetch: lying });
  check('count mismatch fails', await throwsName(() => backup({ client: c2, outDir: out + '-2', tables: ['todos'] })), 'Error');

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
