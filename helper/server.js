/* ============================================================
   GVC HELPER — the small program on Matt's PC that does what a browser
   can't (plan §4): read Douglas Elliman's team page, and save PDFs into
   Drive folders.

   Listens on http://127.0.0.1:47610 only (never the office network).
   Every request must come from the workspace's own address
   (https://matthewgvc.github.io, or http://localhost:8080 while testing),
   and every route except /health must carry the pairing code
   (header X-GVC-Pair) that `node helper/pair.js` prints. Chrome's
   "private network" preflight is answered so the https site may call it.

     node helper/server.js          start (Task Scheduler does this at log on)
     route('POST', '/pdf', fn)      routes: fn(body, cfg) → Promise<{ok, …}>

   Errors go back as {ok: false, error: '<plain sentence>'}.
   ============================================================ */
'use strict';

const http = require('http');
const { loadConfig } = require('./config.js');
const VERSION = require('./package.json').version || '0.1.0';

const ORIGINS = ['https://matthewgvc.github.io', 'http://localhost:8080'];
const MAX_BODY = 1024 * 1024;
const routes = {};
let runner = null;   // the daily jobs (runner.js), started only with the helper's account

/* the newest Asana run (plain or full) for /health; the token itself is never shown */
function healthAsana(cfg, r) {
  if (!cfg.asanaToken) return 'no token yet';
  const lr = r ? r.lastRuns() : {};
  const a = [lr.asana, lr.asanaFull].filter(Boolean).sort((x, y) => (x.at < y.at ? 1 : -1))[0];
  return a ? Object.assign({ at: a.at, ok: a.ok }, a.error ? { error: a.error } : {}) : { at: null, ok: null };
}

function route(method, path, handler) { routes[method + ' ' + path] = handler; }

function send(res, status, body, origin) {
  const h = { 'content-type': 'application/json', vary: 'Origin' };
  if (origin) h['access-control-allow-origin'] = origin;
  res.writeHead(status, h);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, text = '';
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('That request is too large.')); req.destroy(); return; }
      text += c;
    });
    req.on('end', () => {
      if (!text) return resolve({});
      try { resolve(JSON.parse(text)); } catch (e) { reject(new Error('That request wasn\'t valid JSON.')); }
    });
  });
}

function handle(cfg) {
  return (req, res) => {
    const origin = req.headers.origin;
    const allowed = ORIGINS.indexOf(origin) !== -1;
    const path = req.url.split('?')[0];

    if (!allowed) return send(res, 403, { ok: false, error: 'Not allowed from here.' });

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST',
        'access-control-allow-headers': 'content-type, x-gvc-pair',
        'access-control-allow-private-network': 'true',
        'access-control-max-age': '600',
        vary: 'Origin'
      });
      return res.end();
    }

    if (req.method === 'GET' && path === '/health') {
      // unpaired: liveness only; the account and run details only for a paired browser
      const paired = req.headers['x-gvc-pair'] === cfg.pairCode;
      const body = { ok: true, version: VERSION, paired };
      if (paired) { body.account = !!(cfg.helperEmail && cfg.helperPassword); body.lastRuns = runner ? runner.lastRuns() : {}; body.asana = healthAsana(cfg, runner); }
      return send(res, 200, body, origin);
    }

    if (req.headers['x-gvc-pair'] !== cfg.pairCode) {
      return send(res, 403, { ok: false, error: 'This browser isn\'t paired with the helper yet.' }, origin);
    }

    const fn = routes[req.method + ' ' + path];
    if (!fn) return send(res, 404, { ok: false, error: 'The helper has no ' + path + '.' }, origin);

    readBody(req)
      .then(body => fn(body, cfg))
      .then(out => send(res, out && out.status || 200, out, origin))
      .catch(e => send(res, e.status || 500, { ok: false, error: e.message || String(e) }, origin));
  };
}

function startServer(cfg) {
  cfg = cfg || loadConfig();
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle(cfg));
    server.on('error', reject);
    server.listen(cfg.port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { startServer, route, healthAsana, VERSION };

if (require.main === module) {
  require('./routes.js');
  const cfg = loadConfig();
  require('./runner.js').startRunner(cfg).then(r => {
    runner = r;
    console.log(r ? 'Daily jobs on: DE 7:00, scan 2:00, backup 2:30' + (cfg.asanaToken ? ', Asana every 30 minutes (full 3:00, People 3:15).' : '; Asana off until its token is in the config.') : 'No helper account yet: daily jobs off.');
  }, e => console.log('Daily jobs failed to start: ' + e.message));
  startServer(cfg).then(() => console.log('GVC helper listening on http://127.0.0.1:' + cfg.port));
}
