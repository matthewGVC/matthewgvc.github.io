/* ============================================================
   ASANA CLIENT — the helper's read-only door into Asana.

   It can only ask (GET). Nothing in this folder sends, changes or deletes
   anything in Asana (D77), and scripts/test-asana-allow.js fails if a
   write verb ever appears here. The token (asanaToken in the helper's
   config) goes in one header and is never logged or put in an error.

     const asana = createAsana(cfg, { fetch })    // cfg from loadConfig()
     asana.ready()                       → true once a token is configured
     await asana.get('/projects/1/tasks', { opt_fields: '...' })
                                         → every row, all pages, 100 at a time
     await asana.whoami()                → { name }

   Errors carry .status and a plain .message. A page sequence that repeats a
   row throws "Asana sent a task twice". A 429 waits the time Asana asks for
   and tries again (up to three times).
   ============================================================ */
'use strict';

const BASE = 'https://app.asana.com/api/1.0';
const NO_TOKEN = 'No Asana token yet: add asanaToken to the helper\'s config.';

function createAsana(cfg, opts) {
  const doFetch = (opts && opts.fetch) || globalThis.fetch;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function ready() { return !!(cfg && cfg.asanaToken); }

  async function page(url) {
    for (let tries = 0; ; tries++) {
      const r = await doFetch(url, {
        headers: { authorization: 'Bearer ' + cfg.asanaToken, accept: 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
      if (r.status === 429 && tries < 3) {
        const wait = Number(r.headers && r.headers.get && r.headers.get('retry-after'));
        await sleep(Math.min(Number.isFinite(wait) ? wait : 5, 60) * 1000);
        continue;
      }
      if (r.ok) return r.json();
      const e = new Error(r.status === 401 || r.status === 403 ? 'Asana refused the token'
        : r.status === 429 ? 'Asana is busy; try again in a few minutes'
        : 'Asana answered ' + r.status + ' for ' + url.slice(BASE.length).split('?')[0]);
      e.status = r.status;
      throw e;
    }
  }

  async function get(path, query) {
    if (!ready()) throw new Error(NO_TOKEN);
    const q = new URLSearchParams();
    const all = Object.assign({ limit: '100' }, query || {});
    Object.keys(all).forEach(k => { if (all[k] !== null && all[k] !== undefined) q.set(k, all[k]); });
    const rows = [], gids = new Map();
    for (;;) {
      const j = await page(BASE + path + '?' + q.toString());
      const data = Array.isArray(j.data) ? j.data : (j.data ? [j.data] : []);
      for (const row of data) {
        if (row && row.gid !== undefined) {
          if (gids.has(row.gid)) throw new Error('Asana sent a task twice');
          gids.set(row.gid, true);
        }
        rows.push(row);
      }
      if (!j.next_page || !j.next_page.offset) return rows;
      q.set('offset', j.next_page.offset);
    }
  }

  async function whoami() {
    const me = await get('/users/me', { opt_fields: 'name', limit: null });
    return { name: me[0] && me[0].name };
  }

  return { ready, get, whoami };
}

module.exports = { createAsana, NO_TOKEN, BASE };
