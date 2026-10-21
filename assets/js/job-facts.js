/* ============================================================
   JOB FACTS — which source's value a job's fact shows.

   A job's facts (price, beds, sq ft, city…) can arrive from six places.
   Each fact keeps every source's own value, and shows the best-ranked one:

     DE > Matt > Asana > form > doc > legacy          (D43, D52, D79)

   "legacy" is a value typed into the tools before v2: it only fills gaps.

   The shape (one entry per fact name):

     facts.price = {
       value:    2250000,          what the job shows
       source:   'Matt',           whose value that is
       bySource: { DE: 2400000, Matt: 2250000, Asana: 2300000 }
     }                             every source's latest value, kept so a later
                                   run can tell whether a source's OWN value moved

     GVC_FACTS.applyFact(facts, field, source, value)
       → { facts, changed, warn? }
         facts    a new object (the input is never changed)
         changed  true when the shown value or its source changed
         warn     { source, value } while the shown value is Matt's and DE's
                  (else Asana's) current value differs from it (D78, M17)

     GVC_FACTS.adoptEdit(facts, field, shown, noRecordSource?)
       → facts (a new object; the same object when nothing changes)
         For a value changed outside the helper (a builder saving core):
         shown differs from the record → it becomes Matt's (a signed-in edit
         is Matt's, D78); no record yet → noRecordSource (default 'legacy',
         D79). Callers run it before applyFact so a source repeating its old
         value never overwrites the edit. A number and the same number
         written as text are the same value (the builders save numbers as
         strings, e.g. "2250000"), so a save that only re-types DE's figure
         is not an edit.

   The rules:
     - An empty value (null, undefined, '') is ignored: a source going quiet
       never clears a fact.
     - A source replaces the shown value when it ranks the same as or higher
       than the source shown now; a lower one is only remembered in bySource.
     - Matt's typed value always takes the fact, even over DE (D78), and then
       holds until DE's OWN value changes: DE sending the same value it had
       when Matt typed (compared against bySource.DE) leaves Matt's in place,
       with a warning. A DE value that differs from DE's previous one (or DE's
       first value ever) replaces Matt's, and the change is logged by the caller.

   Loads in the browser (window.GVC_FACTS) and in Node (require).
   Tested by scripts/test-job-facts.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_FACTS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var RANK = ['DE', 'Matt', 'Asana', 'form', 'doc', 'legacy'];

  function rankOf(source) { return RANK.indexOf(source); }
  function empty(v) { return v === null || v === undefined || v === ''; }
  function eq(a, b) { return a === b || JSON.stringify(a) === JSON.stringify(b); }
  /* a number and the same number as text ("2250000", " 2,250,000 ") are one value */
  function numOf(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    var s = v.replace(/[\s,$]/g, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  function sameValue(a, b) {
    if (eq(a, b)) return true;
    if (typeof a !== 'number' && typeof b !== 'number') return false;
    var x = numOf(a), y = numOf(b);
    return x !== null && y !== null && x === y;
  }

  /* the warning a shown fact carries, or undefined */
  function warnOf(fact) {
    if (!fact || fact.source !== 'Matt') return undefined;
    var by = fact.bySource || {};
    if (!empty(by.DE) && !eq(by.DE, fact.value)) return { source: 'DE', value: by.DE };
    if (!empty(by.Asana) && !eq(by.Asana, fact.value)) return { source: 'Asana', value: by.Asana };
    return undefined;
  }

  function applyFact(facts, field, source, value) {
    if (rankOf(source) === -1) throw new Error('Unknown fact source: ' + source);
    var out = Object.assign({}, facts || {});
    var cur = out[field];
    if (empty(value)) {
      var r0 = { facts: out, changed: false };
      var w0 = warnOf(cur);
      if (w0) r0.warn = w0;
      return r0;
    }
    var by = Object.assign({}, (cur && cur.bySource) || {});
    var before = by[source];
    by[source] = value;

    var take;
    if (!cur) take = true;
    else if (source === 'Matt') take = true;
    else if (cur.source === 'Matt' && source === 'DE') take = empty(before) || !eq(before, value);
    else take = rankOf(source) <= rankOf(cur.source);

    var next = take ? { value: value, source: source, bySource: by }
                    : { value: cur.value, source: cur.source, bySource: by };
    out[field] = next;
    var res = { facts: out, changed: !cur || !eq(cur.value, next.value) || cur.source !== next.source };
    var w = warnOf(next);
    if (w) res.warn = w;
    return res;
  }

  function adoptEdit(facts, field, shown, noRecordSource) {
    if (empty(shown)) return facts;
    var cur = facts && facts[field];
    if (cur && sameValue(cur.value, shown)) return facts;
    var out = Object.assign({}, facts || {});
    if (!cur) {
      var src = noRecordSource || 'legacy', by = {};
      by[src] = shown;
      out[field] = { value: shown, source: src, bySource: by };
    } else {
      out[field] = { value: shown, source: 'Matt', bySource: Object.assign({}, cur.bySource || {}, { Matt: shown }) };
    }
    return out;
  }

  return { RANK: RANK, rankOf: rankOf, applyFact: applyFact, warnOf: warnOf, adoptEdit: adoptEdit };
});
