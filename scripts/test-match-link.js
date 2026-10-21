/* ============================================================
   Tests for "Link by hand" on the Match page (assets/js/match-link.js,
   tune-up A): which jobs the picker offers, what it refuses, and exactly
   what each save writes, against a fake REST call (never the real database).

   Plain Node:  node scripts/test-match-link.js
   ============================================================ */
'use strict';

const L = require('../assets/js/match-link.js');
const A = require('../assets/js/address-aliases.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* a fake of GVC_PROPS: call(path, opts) answers from `answers` (first match on method + path start), records every call */
function fakeApi(answers, signedIn) {
  const calls = [];
  return {
    calls,
    signedIn: () => signedIn !== false,
    call: (p, o) => {
      o = o || {};
      const method = o.method || 'GET';
      calls.push([method, p, o.body ? JSON.parse(o.body) : null, o.prefer || null]);
      const a = (answers || []).find(x => x[0] === method && p.indexOf(x[1]) === 0);
      if (!a) return Promise.resolve(null);
      const v = typeof a[2] === 'function' ? a[2]() : a[2];
      if (v instanceof Error) return Promise.reject(v);
      return Promise.resolve(v);
    }
  };
}
const httpError = (status, msg) => { const e = new Error(msg); e.status = status; return e; };

const ROWS = [
  { id: 'p1', kind: 'sale', market: 'NJ', stage: 'Live', version: 4, core: { address: '1006 Pheasant Ln, Wall' } },
  { id: 'p2', kind: 'sale', market: 'NJ', stage: 'Prep', version: 1, core: { address: '12 Sample Lane' } },
  { id: 'p3', kind: 'rental', market: 'NJ', stage: 'Live', version: 1, core: { address: '1006 Pheasant Lane', unit: '3' }, de_listing_id: '8001', asana_gid: '7001' },
  { id: 'p4', kind: 'sale', market: 'NYC', stage: 'Live', version: 1, core: { address: '52 E4', unit: '10FL' } },
  { id: 'p5', kind: 'sale', market: 'NJ', stage: 'Archived', version: 1, core: { address: '1006 Pheasant Ln' } },
  { id: 'p6', kind: null, market: 'NJ', stage: 'Live', version: 1, core: { address: '3 Kindless Ct' } }
];
const nameOf = r => r.core.address + (r.core.unit ? ' ' + r.core.unit : '');
const DE = { type: 'de', id: '9201', kind: 'sale', market: 'NJ', street: '1006 PHEASANT LN', unit: '204' };
const AS = { type: 'asana', gid: '1600', name: '52 E4 - 10', market: 'NYC' };

(async () => {
  /* ---------- the picker's list ---------- */
  let c = L.candidates(ROWS, DE, A, nameOf);
  check('picker: same market, same street first, then the rest, each by name; Archived left out', [c.same.map(r => r.id), c.rest.map(r => r.id)], [['p3', 'p1'], ['p2', 'p6']]);
  c = L.candidates(ROWS, AS, A, nameOf);
  check('picker: an Asana task matches on the street in its name', [c.same.map(r => r.id), c.rest.map(r => r.id)], [['p4'], []]);
  c = L.candidates(ROWS, { type: 'de', id: '9101', kind: null, market: null, street: null, unit: null }, A, nameOf);
  check('picker: no market or street known: every open job, by name', [c.same.map(r => r.id), c.rest.map(r => r.id)], [[], ['p3', 'p1', 'p2', 'p6', 'p4']]);
  check('picker: search narrows by name, ignoring case', L.filter(ROWS.slice(0, 4), 'pheasant', nameOf).map(r => r.id), ['p1', 'p3']);

  /* ---------- refusals, in plain words ---------- */
  check('refuse: the job already has a different DE listing', L.refusal(ROWS[2], Object.assign({}, DE, { kind: 'rental' })),
    'That job is already linked to DE listing 8001. A job has one DE listing.');
  check('refuse: a sale DE listing never links to a rental job', L.refusal(Object.assign({}, ROWS[2], { de_listing_id: null }), DE),
    'This DE listing is a sale and that job is a rental, so they can\'t be linked.');
  check('allow: a job with no kind takes either', L.refusal(ROWS[5], DE), null);
  check('allow: a DE listing whose kind is unknown', L.refusal(Object.assign({}, ROWS[2], { de_listing_id: null }), Object.assign({}, DE, { kind: null })), null);
  check('refuse: the job already has a different Asana task', L.refusal(ROWS[2], AS), 'That job is already linked to another Asana task. A job has one Asana task.');
  check('allow: Asana has no sale/rental rule', L.refusal(Object.assign({}, ROWS[2], { asana_gid: null }), AS), null);
  check('allow: the same link again', L.refusal(ROWS[2], { type: 'asana', gid: '7001' }), null);

  /* ---------- linking a DE listing ---------- */
  let api = fakeApi([['PATCH', '/rest/v1/properties', [{ id: 'p1', version: 5 }]], ['PATCH', '/rest/v1/de_listings', [{ de_listing_id: '9201' }]]]);
  await L.linkTo(api, ROWS[0], DE);
  check('link DE: three writes, in order', api.calls.map(x => x[0] + ' ' + x[1]), [
    'PATCH /rest/v1/properties?id=eq.p1&version=eq.4', 'PATCH /rest/v1/de_listings?de_listing_id=eq.9201', 'POST /rest/v1/changes']);
  check('link DE: the job gets the DE id (versioned, row returned)', [api.calls[0][2], api.calls[0][3]], [{ de_listing_id: '9201' }, 'return=representation']);
  check('link DE: the DE listing gets the job', api.calls[1][2], { property_id: 'p1' });
  check('link DE: one change row, source Matt', api.calls[2][2],
    { property_id: 'p1', field: 'de_listing_id', old_value: null, new_value: '9201', note: 'Linked to DE by hand', source: 'Matt' });

  api = fakeApi([['PATCH', '/rest/v1/properties', []]]);
  let err = null;
  try { await L.linkTo(api, ROWS[0], DE); } catch (e) { err = e; }
  check('link DE: version conflict, plain words, nothing else written', [err && err.message, err && !!err.conflict, api.calls.length],
    ['Someone changed this job meanwhile. Reload the page and link it again.', true, 1]);

  api = fakeApi([['PATCH', '/rest/v1/properties', httpError(409, 'A property already exists at that address.')]]);
  err = null;
  try { await L.linkTo(api, ROWS[0], DE); } catch (e) { err = e; }
  check('link DE: another job holds the DE id: said so, nothing else written', [err && err.message, api.calls.length],
    ['Another job is already linked to this DE listing. Reload the page to see it.', 1]);

  api = fakeApi([['PATCH', '/rest/v1/properties', [{ id: 'p1' }]], ['POST', '/rest/v1/changes', httpError(500, 'connection lost')]]);
  err = null;
  try { await L.linkTo(api, ROWS[0], DE); } catch (e) { err = e; }
  check('link DE: the log fails after the link saved: Linked, nothing to redo', [err && /^Linked, but/.test(err.message), err && /nothing to redo/.test(err.message), err && !!err.linked],
    [true, true, true]);

  api = fakeApi([], true);
  err = null;
  try { await L.linkTo(api, ROWS[2], Object.assign({}, DE, { kind: 'rental' })); } catch (e) { err = e; }
  check('link DE: a refused link writes nothing', [err && err.message, api.calls.length], ['That job is already linked to DE listing 8001. A job has one DE listing.', 0]);

  api = fakeApi([], false);
  err = null;
  try { await L.linkTo(api, ROWS[0], DE); } catch (e) { err = e; }
  check('link DE: signed out: nothing written', [err && err.message, api.calls.length], ['Sign in first.', 0]);

  /* ---------- linking an Asana task ---------- */
  api = fakeApi([['PATCH', '/rest/v1/properties', [{ id: 'p4' }]], ['PATCH', '/rest/v1/asana_tasks', [{ gid: '1600' }]]]);
  await L.linkTo(api, ROWS[3], AS);
  check('link Asana: three writes, in order', api.calls.map(x => x[0] + ' ' + x[1]), [
    'PATCH /rest/v1/properties?id=eq.p4&version=eq.1', 'PATCH /rest/v1/asana_tasks?gid=eq.1600', 'POST /rest/v1/changes']);
  check('link Asana: the job gets the gid, the task gets the job', [api.calls[0][2], api.calls[1][2]], [{ asana_gid: '1600' }, { property_id: 'p4' }]);
  check('link Asana: one change row', api.calls[2][2],
    { property_id: 'p4', field: 'asana_gid', old_value: null, new_value: '1600', note: 'Linked to Asana by hand', source: 'Matt' });
  api = fakeApi([['PATCH', '/rest/v1/properties', httpError(409, 'x')]]);
  err = null;
  try { await L.linkTo(api, ROWS[3], AS); } catch (e) { err = e; }
  check('link Asana: another job holds the gid', err && err.message, 'Another job is already linked to this Asana task. Reload the page to see it.');

  /* ---------- Not ours / Ignore ---------- */
  api = fakeApi([['PATCH', '/rest/v1/de_listings', [{ de_listing_id: '9201', property_id: null }]]]);
  await L.setAside(api, DE);
  check('not ours: ignored = true, no change row without an owner', api.calls.map(x => [x[0] + ' ' + x[1], x[2]]),
    [['PATCH /rest/v1/de_listings?de_listing_id=eq.9201', { ignored: true }]]);
  api = fakeApi([['PATCH', '/rest/v1/asana_tasks', [{ gid: '1600', property_id: null, pitch_id: null, dev_project_id: null }]]]);
  await L.setAside(api, AS);
  check('ignore: ignored = true, no change row without an owner', api.calls.map(x => [x[0] + ' ' + x[1], x[2]]),
    [['PATCH /rest/v1/asana_tasks?gid=eq.1600', { ignored: true }]]);
  api = fakeApi([['PATCH', '/rest/v1/asana_tasks', [{ gid: '1600', property_id: null, pitch_id: 'q1', dev_project_id: null }]]]);
  await L.setAside(api, AS);
  check('ignore: a change row when the task has an owner', api.calls[1] && [api.calls[1][0] + ' ' + api.calls[1][1], api.calls[1][2]],
    ['POST /rest/v1/changes', { pitch_id: 'q1', field: null, old_value: null, new_value: null, note: 'Asana task 52 E4 - 10 ignored on the Match page', source: 'Matt' }]);
  api = fakeApi([['PATCH', '/rest/v1/de_listings', [{ de_listing_id: '9201', property_id: 'p9' }]]]);
  await L.setAside(api, DE);
  check('not ours: a change row when the listing has an owner', api.calls[1] && api.calls[1][2],
    { property_id: 'p9', field: null, old_value: null, new_value: null, note: 'DE listing 9201 marked not ours on the Match page', source: 'Matt' });
  api = fakeApi([['PATCH', '/rest/v1/asana_tasks', []]]);
  err = null;
  try { await L.setAside(api, AS); } catch (e) { err = e; }
  check('ignore: a task the workspace has no copy of: said so', err && err.message, 'The workspace has no copy of this Asana task yet. Wait for the next Asana sync, then try again.');
  api = fakeApi([], false);
  err = null;
  try { await L.setAside(api, DE); } catch (e) { err = e; }
  check('not ours: signed out: nothing written', [err && err.message, api.calls.length], ['Sign in first.', 0]);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
