/* ============================================================
   ASANA WRITE — the one place the helper changes Asana (overhaul step 5;
   D77 lifted by Matt, 11-03: "Yes. Remove rule D77").

   A fact changed in the workspace (a job page's Facts card, anyone on the
   team) is queued in asana_writes by the database (migration 0021). Every
   minute the helper takes the waiting rows, oldest first, and sets that
   field on the listing's Asana task, then marks each done or failed with a
   plain sentence. It writes only the fields in FIELDS (0021's
   asana_field_of); the reading client (helper/asana/) stays GET-only.

     await writeWaiting({ db, cfg, fetch }) → { done, failed }
     valueFor(field, value)  → what Asana takes for that field, or throws (tested)

   The token is the helper's asanaToken; it goes in one header, never in a
   log or an error.
   ============================================================ */
'use strict';

const BASE = 'https://app.asana.com/api/1.0';
// the Asana fields the workspace may write: the same list as 0021's asana_field_of
const FIELDS = ['💵 Current Price', '💵 Original Price', 'ℹ️ INT SF', 'ℹ️ Acreage', '📍 Zip', '📍 County',
  'Listing Copy', 'Google Maps Link', '🛜 Elliman Link'];
const BATCH = 20;

/* the value as Asana takes it, by the field's type */
function valueFor(field, value) {
  const t = field.resource_subtype || field.type;
  if (value === null || value === undefined || value === '') throw new Error('There is no value to write.');
  if (t === 'number') {
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(n)) throw new Error('Asana\'s ' + field.name + ' takes a number, not "' + value + '".');
    return n;
  }
  if (t === 'text') return Array.isArray(value) ? value.join('\n') : String(value);
  if (t === 'enum') {
    const want = String(value).trim().toLowerCase();
    const o = (field.enum_options || []).find(x => x.enabled !== false && String(x.name).trim().toLowerCase() === want);
    if (!o) throw new Error('Asana\'s ' + field.name + ' has no choice "' + value + '".');
    return o.gid;
  }
  if (t === 'date') return { date: String(value).slice(0, 10) };
  throw new Error('The workspace can\'t write Asana\'s ' + field.name + ' (a ' + t + ' field).');
}

async function writeWaiting(o) {
  const db = o.db, doFetch = o.fetch || globalThis.fetch, token = o.cfg && o.cfg.asanaToken;
  if (!token) return { done: 0, failed: 0 };
  const now = () => new Date().toISOString();
  const call = async (method, path, body) => {
    let r;
    try {
      r = await doFetch(BASE + path, { method, headers: { authorization: 'Bearer ' + token, accept: 'application/json', 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    } catch (e) { throw new Error('Asana couldn\'t be reached'); }
    if (r.status === 401 || r.status === 403) throw new Error('Asana refused the helper\'s token for this task');
    if (r.status === 404) throw new Error('The Asana task is gone');
    if (!r.ok) throw new Error('Asana answered ' + r.status);
    return (await r.json()).data;
  };
  const rows = await db.select('asana_writes', { status: 'waiting' }, '*', { order: 'asked_at.asc', limit: BATCH });
  let done = 0, failed = 0;
  for (const w of rows) {
    // take it: a second helper (or a second tick) finds it no longer waiting
    const took = await db.update('asana_writes', { id: w.id, status: 'waiting' }, { status: 'working' });
    if (!took || !took.length) continue;
    try {
      if (FIELDS.indexOf(w.asana_field) === -1) throw new Error('The workspace doesn\'t write Asana\'s ' + w.asana_field + '.');
      const task = await call('GET', '/tasks/' + encodeURIComponent(w.task_gid) + '?opt_fields=custom_fields.name,custom_fields.type,custom_fields.resource_subtype,custom_fields.enum_options.name,custom_fields.enum_options.enabled');
      const field = (task.custom_fields || []).find(f => f.name === w.asana_field);
      if (!field) throw new Error('The Asana task has no ' + w.asana_field + ' field.');
      await call('PUT', '/tasks/' + encodeURIComponent(w.task_gid), { data: { custom_fields: { [field.gid]: valueFor(field, w.value) } } });
      await db.update('asana_writes', { id: w.id }, { status: 'done', done_at: now(), error: null });
      done++;
    } catch (e) {
      await db.update('asana_writes', { id: w.id }, { status: 'failed', done_at: now(), error: String(e.message).slice(0, 300) }).catch(() => {});
      failed++;
    }
  }
  return { done, failed };
}

module.exports = { writeWaiting, valueFor, FIELDS };
