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

   DE sends 0 for a square footage or a bath count it doesn't know (most
   co-ops): deBlank(field, value) says so, and that DE value is never shown,
   never warns and is never stored by the DE sync (Match's M4 uses the same
   rule). DE's 0 beds is a studio and counts. forget(facts, field, source)
   drops one source's value and shows the best one left.

   For the job page (Slice 3), further down: FIELDS and fieldsFor(row) (what a job
   shows by market, type and sale or rental), shown(core, row) (value, badge, other
   sources, warning), clear(facts, field) (drop Matt's value) and parseValue(kind, text)
   (a typed value, or a plain sentence saying what is wrong).

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

  /* DE's 0 sq ft / 0 baths means "not known" (co-ops); 0 beds is a studio (M4) */
  var DE_ZERO_BLANK = ['sqft', 'baths'];
  function deBlank(field, value) {
    return DE_ZERO_BLANK.indexOf(field) !== -1 && !empty(value) && Number(value) === 0;
  }

  /* the warning a shown fact carries, or undefined (field: so DE's blank 0 never warns) */
  function warnOf(fact, field) {
    if (!fact || fact.source !== 'Matt') return undefined;
    var by = fact.bySource || {};
    if (!empty(by.DE) && !deBlank(field, by.DE) && !eq(by.DE, fact.value)) return { source: 'DE', value: by.DE };
    if (!empty(by.Asana) && !eq(by.Asana, fact.value)) return { source: 'Asana', value: by.Asana };
    return undefined;
  }

  function applyFact(facts, field, source, value) {
    if (rankOf(source) === -1) throw new Error('Unknown fact source: ' + source);
    var out = Object.assign({}, facts || {});
    var cur = out[field];
    if (empty(value)) {
      var r0 = { facts: out, changed: false };
      var w0 = warnOf(cur, field);
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
    var w = warnOf(next, field);
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

  /* ---------- the fields the job page shows (facts dictionary §1-§5) ---------- */

  var BADGE = { DE: 'DE', Matt: 'Matt', Asana: 'Asana', form: 'form', doc: 'doc', legacy: 'earlier tool' };

  var TYPES = ['Co-op', 'Condo', 'Condop', 'Townhouse', 'Single family', 'Other'];
  var HOUSES = ['Townhouse', 'Single family', 'Other'];

  /* markets / types: only for those (no list = all). rental: true = rentals only,
     false = sales only, missing = both. */
  var FIELDS = [
    { name: 'address', label: 'Address', kind: 'text', tier: 'core' },
    { name: 'unit', label: 'Unit', kind: 'text', tier: 'core' },
    { name: 'city', label: 'City', kind: 'text', tier: 'core' },
    { name: 'state', label: 'State', kind: 'text', tier: 'core' },
    { name: 'zip', label: 'Zip', kind: 'text', tier: 'core' },
    { name: 'neighborhood', label: 'Neighborhood', kind: 'pick', tier: 'core' },
    { name: 'propertyType', label: 'Property type', kind: 'pick', tier: 'core', options: TYPES },
    { name: 'price', label: 'Price', kind: 'money', tier: 'core', rental: false },
    { name: 'rent', label: 'Rent per month', kind: 'money', tier: 'core', rental: true },
    { name: 'originalPrice', label: 'Original price', kind: 'money', tier: 'core', rental: false },
    { name: 'maintenance', label: 'Maintenance', kind: 'money', tier: 'core', types: ['Co-op', 'Condop'] },
    { name: 'commonCharges', label: 'Common charges', kind: 'money', tier: 'core', types: ['Condo'].concat(HOUSES) },
    { name: 'taxesMonthly', label: 'Taxes per month', kind: 'money', tier: 'core' },
    { name: 'maxFinancing', label: 'Max financing (%)', kind: 'number', tier: 'core', markets: ['NYC'], types: ['Co-op', 'Condop'], rental: false },
    { name: 'flipTax', label: 'Flip tax', kind: 'text', tier: 'core', markets: ['NYC'], types: ['Co-op', 'Condop'], rental: false },
    { name: 'assessments', label: 'Assessments', kind: 'text', tier: 'core' },
    { name: 'lotSize', label: 'Lot size', kind: 'text', tier: 'core', markets: ['NJ', 'FL'], types: HOUSES },
    { name: 'beds', label: 'Beds', kind: 'number', tier: 'core' },
    { name: 'baths', label: 'Baths', kind: 'baths', tier: 'core' },
    { name: 'halfBaths', label: 'Half baths', kind: 'number', tier: 'core' },
    { name: 'sqft', label: 'Sq ft', kind: 'number', tier: 'core' },
    { name: 'interiorFeatures', label: 'Interior features', kind: 'list', tier: 'core' },
    { name: 'buildingFeatures', label: 'Building features', kind: 'list', tier: 'core' },
    { name: 'description', label: 'Description', kind: 'long', tier: 'core' },
    { name: 'shortDescription', label: 'Short description', kind: 'long', tier: 'core' },
    { name: 'openHouses', label: 'Open houses', kind: 'list', tier: 'core' },
    { name: 'mlsBoard', label: 'MLS board', kind: 'text', tier: 'core' },
    /* extras */
    { name: 'borough', label: 'Borough', kind: 'text', tier: 'extra', markets: ['NYC'] },
    { name: 'rooms', label: 'Rooms', kind: 'number', tier: 'extra' },
    { name: 'layoutType', label: 'Layout', kind: 'pick', tier: 'extra' },
    { name: 'floor', label: 'Floor', kind: 'number', tier: 'extra' },
    { name: 'exposures', label: 'Exposures', kind: 'list', tier: 'extra' },
    { name: 'views', label: 'Views', kind: 'list', tier: 'extra' },
    { name: 'ceilingHeight', label: 'Ceiling height', kind: 'text', tier: 'extra' },
    { name: 'outdoorSpace', label: 'Outdoor space', kind: 'text', tier: 'extra' },
    { name: 'yearBuilt', label: 'Year built', kind: 'number', tier: 'extra' },
    { name: 'stories', label: 'Stories', kind: 'number', tier: 'extra' },
    { name: 'parking', label: 'Parking', kind: 'text', tier: 'extra' },
    { name: 'headline', label: 'Headline', kind: 'text', tier: 'extra' }
  ];

  function typeOf(row) {
    var t = row && row.core && row.core.propertyType;
    if (Array.isArray(t)) t = t[0];
    return typeof t === 'string' && t ? t : null;
  }

  /* "Maintenance" for co-ops, "Common charges" for condos, "HOA" for NJ/FL houses */
  function labelFor(field, row) {
    if (field.name === 'commonCharges') {
      var t = typeOf(row), m = row && row.market;
      if (t && HOUSES.indexOf(t) !== -1 && (m === 'NJ' || m === 'FL')) return 'HOA';
    }
    return field.label;
  }

  /* the fields that apply to this job: by market, property type and sale or rental.
     A job with no property type yet shows every type-specific field of its market. */
  function fieldsFor(row) {
    var market = row && row.market, rental = !!(row && row.kind === 'rental'), type = typeOf(row);
    return FIELDS.filter(function (f) {
      if (f.markets && market && f.markets.indexOf(market) === -1) return false;
      if (f.types && type && f.types.indexOf(type) === -1) return false;
      if (f.rental === true && !rental) return false;
      if (f.rental === false && rental) return false;
      return true;
    }).map(function (f) {
      return Object.assign({}, f, { label: labelFor(f, row) });
    });
  }

  /* each field with what it shows: [{ name, label, kind, tier, value, source, badge, others, warn }].
     A value in core with no record is from before v2: source 'legacy', badge 'earlier tool'.
     others = the other sources' different values, best-ranked first. */
  function shown(core, row) {
    core = core || {};
    var facts = core.facts || {};
    return fieldsFor(Object.assign({}, row, { core: core })).map(function (f) {
      var rec = facts[f.name], legacyOk = true;
      if (rec && rec.bySource && deBlank(f.name, rec.bySource.DE)) {   // an older DE run stored its 0: never shown
        rec = forgetIn(rec, 'DE');
        legacyOk = false;                                              // core still holds that 0
      }
      var out = { name: f.name, label: f.label, kind: f.kind, tier: f.tier, others: [] };
      if (rec && !empty(rec.value)) {
        out.value = rec.value; out.source = rec.source; out.badge = BADGE[rec.source] || rec.source;
        var by = rec.bySource || {};
        RANK.forEach(function (src) {
          if (src !== rec.source && !empty(by[src]) && !eq(by[src], rec.value)) {
            out.others.push({ source: src, badge: BADGE[src], value: by[src] });
          }
        });
        var w = warnOf(rec, f.name);
        if (w) out.warn = w;
      } else if (legacyOk && !empty(core[f.name])) {
        out.value = core[f.name]; out.source = 'legacy'; out.badge = BADGE.legacy;
      } else {
        out.value = null; out.source = null; out.badge = null;
      }
      return out;
    });
  }

  /* one fact record without a source's value: the best remaining source shows, or null */
  function forgetIn(rec, source) {
    var by = Object.assign({}, rec.bySource || {});
    delete by[source];
    var best = RANK.filter(function (s) { return !empty(by[s]); })[0];
    return best ? { value: by[best], source: best, bySource: by } : null;
  }

  /* drop one source's value; the best remaining source shows, or the fact goes.
     A fact without that source is returned as it is. */
  function forget(facts, field, source) {
    var cur = facts && facts[field];
    if (!cur || !cur.bySource || !(source in cur.bySource)) return facts;
    var out = Object.assign({}, facts), next = forgetIn(cur, source);
    if (!next) delete out[field]; else out[field] = next;
    return out;
  }

  /* Clear: drop Matt's value, show the best remaining source, or remove the fact.
     A fact Matt never typed is returned as it is. */
  function clear(facts, field) { return forget(facts, field, 'Matt'); }

  /* what a typed value means: { ok, value } or { ok: false, error } (never NaN).
     Empty text is { ok: true, value: null }, which the page treats as Clear. */
  function parseValue(kind, text) {
    var t = text === null || text === undefined ? '' : String(text);
    if (!t.trim()) return { ok: true, value: null };
    var s;
    if (kind === 'money') {
      s = t.replace(/[\s,$]/g, '');
      var m = /^(\d+(?:\.\d+)?)([kKmM])?$/.exec(s);
      if (!m) return { ok: false, error: 'Type a number, like 2250000 or $2.25M.' };
      var mult = m[2] ? (m[2].toLowerCase() === 'm' ? 1000000 : 1000) : 1;
      return { ok: true, value: Math.round(Number(m[1]) * mult) };
    }
    if (kind === 'number') {
      s = t.replace(/[\s,]/g, '');
      if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: 'Type a number, like 2 or 1200.' };
      return { ok: true, value: Number(s) };
    }
    if (kind === 'baths') {
      s = t.replace(/[\s,]/g, '');
      var b = /^(\d+)(?:\.(\d+))?$/.exec(s);
      if (!b || (b[2] !== undefined && !/^0*5?0*$/.test(b[2]))) {
        return { ok: false, error: 'Type whole baths, or end in .5 for a half bath, like 3 or 3.5.' };
      }
      var half = b[2] !== undefined && /5/.test(b[2]);
      return half ? { ok: true, value: Number(b[1]), halfBaths: 1 } : { ok: true, value: Number(b[1]) };
    }
    if (kind === 'list') {
      var items = t.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      return { ok: true, value: items.length ? items : null };
    }
    return { ok: true, value: t.trim() };
  }

  return { RANK: RANK, rankOf: rankOf, applyFact: applyFact, warnOf: warnOf, adoptEdit: adoptEdit, deBlank: deBlank,
           BADGE: BADGE, FIELDS: FIELDS, fieldsFor: fieldsFor, shown: shown, clear: clear, forget: forget, parseValue: parseValue };
});
