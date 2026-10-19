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

  const cfg = Object.assign(loadConfig(), { port: 47611 });
  check('config created', fs.existsSync(path.join(process.env.GVC_HELPER_HOME, 'config.json')), true);
  check('pair code is 6 digits', /^\d{6}$/.test(cfg.pairCode), true);
  check('default site', cfg.siteBase, 'https://matthewgvc.github.io');
  check('config is stable', loadConfig().pairCode, cfg.pairCode);

  route('POST', '/echo', body => Promise.resolve({ ok: true, body }));
  const server = await startServer(cfg);

  let r = await req('GET', '/health', { origin: 'https://matthewgvc.github.io' });
  check('health ok', [r.status, r.json && r.json.ok], [200, true]);
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

  check('bound to loopback', server.address().address, '127.0.0.1');
  server.close();

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
