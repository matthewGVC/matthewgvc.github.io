/* ============================================================
   ASANA CLIENT — the helper's read-only door into Asana.

   It can only ask (GET). Nothing in this folder sends, changes or deletes
   anything in Asana, and scripts/test-asana-allow.js fails if a write verb
   ever appears here. The one writer is helper/asana-write.js (the team's
   edits, D77 lifted 11-03, migration 0021). The token (asanaToken in the helper's
   config) goes in one header and is never logged or put in an error.

     const asana = createAsana(cfg, { fetch, sleep? })    // cfg from loadConfig()
     asana.ready()                       → true once a token is configured
     await asana.get('/projects/1/tasks', { opt_fields: '...' })
                                         → every row, all pages, 100 at a time
     await asana.whoami()                → { name }
     await asana.events(resource, sync)  → { sync, events, more, expired }
                                         one page of Asana's events feed for a project
                                         (GET /events, no paging: call again while more).
                                         A missing or too old token (412) is no error:
                                         { expired: true, sync: <a new token>, events: [] }.

   Errors carry .status (when Asana answered) and a plain .message. A page
   sequence that repeats a row throws "Asana sent a task twice". A 429 waits
   the time Asana asks for (5 s when it doesn't say) and tries again (up to
   three times). No answer in 30 s is "Asana didn't answer in time", no
   connection "Asana couldn't be reached", an answer that isn't JSON "Asana
   sent an answer the helper can't read".
   ============================================================ */
'use strict';

const BASE = 'https://app.asana.com/api/1.0';
const NO_TOKEN = 'No Asana token yet: add asanaToken to the helper\'s config.';

function createAsana(cfg, opts) {
  const doFetch = (opts && opts.fetch) || globalThis.fetch;
  const sleep = (opts && opts.sleep) || (ms => new Promise(r => setTimeout(r, ms)));
  const plain = (message, status) => { const e = new Error(message); if (status !== undefined) e.status = status; return e; };

  function ready() { return !!(cfg && cfg.asanaToken); }

  // 412 on the events feed: the token is missing or too old, and the answer carries a new one
  const EXPIRED = Symbol('expired');
  async function page(url, take412) {
    for (let tries = 0; ; tries++) {
      let r;
      try {
        r = await doFetch(url, {
          headers: { authorization: 'Bearer ' + cfg.asanaToken, accept: 'application/json' },
          signal: AbortSignal.timeout(30000)
        });
      } catch (err) {
        throw plain(err && (err.name === 'TimeoutError' || err.name === 'AbortError') ? 'Asana didn\'t answer in time' : 'Asana couldn\'t be reached');
      }
      if (r.status === 429 && tries < 3) {
        const said = String((r.headers && r.headers.get && r.headers.get('retry-after')) || '').trim();
        const wait = said === '' ? NaN : Number(said);
        await sleep(Math.min(Number.isFinite(wait) && wait >= 0 ? wait : 5, 60) * 1000);
        continue;
      }
      if (take412 && r.status === 412) {
        let body;
        try { body = await r.json(); }
        catch (err) { throw plain('Asana sent an answer the helper can\'t read', 412); }
        return { [EXPIRED]: body || {} };
      }
      if (r.ok) {
        try { return await r.json(); }
        catch (err) { throw plain(err && (err.name === 'TimeoutError' || err.name === 'AbortError') ? 'Asana didn\'t answer in time' : 'Asana sent an answer the helper can\'t read', r.status); }
      }
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

  async function events(resource, sync) {
    if (!ready()) throw new Error(NO_TOKEN);
    const q = new URLSearchParams({ resource: String(resource) });
    if (sync) q.set('sync', sync);
    const j = await page(BASE + '/events?' + q.toString(), true);
    if (j && j[EXPIRED]) {
      if (!j[EXPIRED].sync) throw plain('Asana sent no new events token', 412);
      return { sync: j[EXPIRED].sync, events: [], more: false, expired: true };
    }
    return { sync: (j && j.sync) || sync || null, events: Array.isArray(j && j.data) ? j.data : [], more: !!(j && j.has_more), expired: false };
  }

  return { ready, get, whoami, events };
}

module.exports = { createAsana, NO_TOKEN, BASE };
