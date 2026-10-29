/* ============================================================
   HELPER ↔ SUPABASE — the desktop helper's own connection to the database.

   The helper signs in as its own account (spec C5), so the database rules
   apply to it like anyone else and every change it makes is stamped
   "Desktop helper". Its email and password live in the helper's config
   (%USERPROFILE%\.gvc-helper\config.json: helperEmail, helperPassword),
   never in the repo. Without them, ready() is false and nothing runs.

     const db = createClient(cfg)            // cfg from loadConfig()
     await db.select('properties', { stage: 'Live' })
     await db.select('sync_runs', { kind: 'de' }, 'kind,started_at', { order: 'started_at.desc', limit: 1 })
         → just the newest rows, one request (order alone still reads every page);
           a match key like 'totals->>full' filters on a JSON field
     await db.insert('changes', [{ … }])
     await db.update('properties', { id }, { stage: 'Sold' }, { version: 4 })
         → throws ConflictError when someone else changed the row first
     await db.upsert('de_listings', rows, 'de_listing_id')
     await db.count('properties')
     await db.listBucket('property-photos')  → every file path, folders walked
     await db.download('property-photos', path) → Buffer

   Errors carry .status (404 = the table doesn't exist yet).
   ============================================================ */
'use strict';

class ConflictError extends Error {
  constructor(table) {
    super('Someone else changed this ' + table + ' row first, so it wasn\'t overwritten.');
    this.name = 'ConflictError';
  }
}

function createClient(cfg, opts) {
  const doFetch = (opts && opts.fetch) || globalThis.fetch;
  const base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  let session = null;

  function ready() { return !!(cfg.helperEmail && cfg.helperPassword && base && cfg.publishableKey); }

  async function token() {
    if (session && Date.now() < session.expires) return session.access;
    if (!ready()) throw new Error('No helper account yet: add helperEmail and helperPassword to the helper\'s config.');
    const body = session ? { refresh_token: session.refresh } : { email: cfg.helperEmail, password: cfg.helperPassword };
    const r = await doFetch(base + '/auth/v1/token?grant_type=' + (session ? 'refresh_token' : 'password'), {
      method: 'POST', headers: { apikey: cfg.publishableKey, 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok || !j.access_token) {
      if (session) { session = null; return token(); }
      throw new Error('The helper account couldn\'t sign in (' + (j.error_description || j.msg || r.status) + ').');
    }
    session = { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + Math.max(0, (j.expires_in || 3600) - 60) * 1000 };
    return session.access;
  }

  async function request(method, path, body, headers) {
    const t = await token();
    const r = await doFetch(base + path, {
      method,
      headers: Object.assign({ apikey: cfg.publishableKey, authorization: 'Bearer ' + t, 'content-type': 'application/json' }, headers || {}),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!r.ok) {
      let detail = ''; try { detail = (await r.json()).message || ''; } catch (e) { /* no body */ }
      const e = new Error(method + ' ' + path.split('?')[0] + ' failed (' + r.status + ')' + (detail ? ': ' + detail : ''));
      e.status = r.status;
      throw e;
    }
    return r;
  }

  function query(match, extra) {
    const q = Object.keys(match || {}).map(k => encodeURIComponent(k) + '=eq.' + encodeURIComponent(match[k]));
    return q.concat(extra || []).join('&');
  }

  /* pages are read in key order: without an order, Postgres may hand rows back
     in a different order per page and a long read could skip or repeat rows */
  const KEY = { members: 'user_id', de_listings: 'de_listing_id', documents: 'property_id,pitch_id,tool', asana_tasks: 'gid', asana_people: 'gid',
    dev_budgets: 'dev_project_id' };
  async function select(table, match, cols, opts) {
    try { return await selectBy(table, match, cols, opts); }
    catch (e) {
      // before migration 0010 documents has no pitch_id: read in the Slice 4 order and keep to it
      if (table !== 'documents' || e.status !== 400 || !/pitch_id/.test(e.message) || KEY.documents === 'property_id,tool') throw e;
      KEY.documents = 'property_id,tool';
      return selectBy(table, match, cols, opts);
    }
  }
  async function selectBy(table, match, cols, opts) {
    const o = opts || {}, key = KEY[table] || 'id';
    const order = 'order=' + (o.order ? o.order + ',' + key : key);
    if (o.limit) {
      const r = await request('GET', '/rest/v1/' + table + '?' + query(match, ['select=' + (cols || '*'), order, 'limit=' + o.limit]));
      return r.json();
    }
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const r = await request('GET', '/rest/v1/' + table + '?' + query(match, ['select=' + (cols || '*'), order,
        'limit=1000', 'offset=' + offset]));
      const page = await r.json();
      rows.push.apply(rows, page);
      if (page.length < 1000) return rows;
    }
  }

  async function insert(table, rows) {
    const r = await request('POST', '/rest/v1/' + table, [].concat(rows), { prefer: 'return=representation' });
    return r.json();
  }

  async function upsert(table, rows, onConflict) {
    const r = await request('POST', '/rest/v1/' + table + '?on_conflict=' + encodeURIComponent(onConflict), [].concat(rows),
      { prefer: 'resolution=merge-duplicates,return=representation' });
    return r.json();
  }

  async function update(table, match, patch, o) {
    const m = Object.assign({}, match);
    if (o && o.version !== undefined) m.version = o.version;
    const r = await request('PATCH', '/rest/v1/' + table + '?' + query(m), patch, { prefer: 'return=representation' });
    const rows = await r.json();
    if (o && o.version !== undefined && !rows.length) throw new ConflictError(table);
    return rows;
  }

  async function count(table) {
    const r = await request('HEAD', '/rest/v1/' + table + '?select=*', undefined, { prefer: 'count=exact' });
    const range = r.headers.get('content-range') || '';
    return Number(range.split('/')[1]);
  }

  async function listBucket(bucket, prefix) {
    const out = [];
    for (let offset = 0; ; offset += 1000) {
      const r = await request('POST', '/storage/v1/object/list/' + bucket, { prefix: prefix || '', limit: 1000, offset });
      const items = await r.json();
      for (const it of items) {
        const p = (prefix ? prefix + '/' : '') + it.name;
        if (it.id) out.push(p); else out.push.apply(out, await listBucket(bucket, p));
      }
      if (items.length < 1000) return out;
    }
  }

  async function download(bucket, path) {
    const r = await request('GET', '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'));
    return Buffer.from(await r.arrayBuffer());
  }

  return { ready, select, insert, upsert, update, count, listBucket, download };
}

module.exports = { createClient, ConflictError };
