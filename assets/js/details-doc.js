/* ============================================================
   DETAILS DOC — the job's details .docx, as the job's facts.

   The Showsheet's reader (tools/showsheet/listing.js) already turns the Word
   document into the sheet's own field names. This file renames those to the
   job's fact names (docs/workspace-v2-facts.md) and picks which file in a job
   folder is the details doc:

     GVC_DOC.toFacts(readResult)  → { <fact name>: value }
       Only stored fields. Maintenance and common charges stay separate; money
       is the reader's own monthly figure; an empty or unreadable value is
       dropped. ownership → propertyType ('Co-op', 'Condo'), residence.features
       → interiorFeatures, building.amenities → buildingFeatures,
       building.builtYear → yearBuilt.
     GVC_DOC.pick(files)          → the newest top-level .docx with "details"
                                    in its name, or null. Files are
                                    { name, size, modified }.
     GVC_DOC.changed(prev, file)  → true when name, size or modified differ
                                    from the details_doc record (null = new).
     GVC_DOC.addressCheck(found, core, label)
                                  → null, or { doc, job } when the doc's
                                    address is another place than the job's.
                                    A doc never renames a job: a copied doc
                                    still headed with the last listing's
                                    address would. The job's own address is
                                    its best non-doc value (an earlier tool's
                                    included), else its label. Same street by
                                    GVC_ADDR.sameStreet; units only differ
                                    when both sides name one.

   Loads in the browser (window.GVC_DOC, after listing.js) and in Node.
   Tested by scripts/test-details-doc.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  var listing = typeof module === 'object' && module.exports
    ? require('../../tools/showsheet/listing.js') : global.GVC_LISTING;
  var rules = typeof module === 'object' && module.exports ? require('./drive-rules.js') : global.GVC_DRIVE_RULES;
  var addr = typeof module === 'object' && module.exports ? require('./address-aliases.js') : global.GVC_ADDR;
  var api = factory(listing, rules, addr);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_DOC = api;
})(typeof window !== 'undefined' ? window : globalThis, function (L, rules, A) {
  'use strict';

  var TYPES = { 'co-op': 'Co-op', condo: 'Condo' };

  function text(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }
  function num(v) {
    var m = /\d[\d,]*(?:\.\d+)?/.exec(String(v == null ? '' : v));
    return m ? Number(m[0].replace(/,/g, '')) : null;
  }
  /* a price that is a figure; "Call for price" is not one */
  function price(v) {
    var t = text(v);
    return t && /^[\s$\d,.]+$/.test(t) ? L.moneyNum(t) : null;
  }
  function monthly(v) {
    var n = L.monthlyAmount(v);
    return n === null ? null : Math.round(n * 100) / 100;
  }
  function list(v) {
    var items = (Array.isArray(v) ? v : v ? [v] : []).map(text).filter(Boolean);
    return items.length ? items : null;
  }

  function toFacts(r) {
    r = r || {};
    var b = r.building || {}, res = r.residence || {};
    var baths = text(r.baths) ? Number(r.baths) : null;
    var out = {
      address: text(r.address),
      unit: text(r.unit),
      propertyType: TYPES[r.ownership] || null,
      price: price(r.price),
      maintenance: monthly(r.maintenance),
      commonCharges: monthly(r.commonCharges),
      taxesMonthly: monthly(r.taxesMonthly),
      maxFinancing: num(r.maxFinancing),
      flipTax: text(r.flipTax),
      assessments: text(r.assessments),
      beds: text(r.beds) ? Number(r.beds) : null,
      baths: baths === null ? null : Math.floor(baths),
      halfBaths: baths !== null && baths % 1 !== 0 ? 1 : null,
      yearBuilt: num(b.builtYear),
      stories: num(b.stories),
      interiorFeatures: list(res.features),
      buildingFeatures: list(b.amenities),
      exposures: list(res.exposures),
      outdoorSpace: text(res.outdoor),
      ceilingHeight: text(res.ceiling)
    };
    var facts = {};
    Object.keys(out).forEach(function (k) {
      var v = out[k];
      if (v !== null && v !== undefined && !(typeof v === 'number' && !isFinite(v))) facts[k] = v;
    });
    return facts;
  }

  function pick(files) {
    var best = null;
    (files || []).forEach(function (f) {
      if (!f || typeof f.name !== 'string') return;
      if (!/\.docx$/i.test(f.name) || !/details/i.test(f.name) || /^~\$/.test(f.name)) return;
      if (rules && rules.hasPaperworkWord(f.name)) return;
      if (!best || new Date(f.modified) > new Date(best.modified)) best = f;
    });
    return best;
  }

  function changed(prev, file) {
    if (!file) return false;
    if (!prev) return true;
    return prev.name !== file.name || prev.size !== file.size ||
      new Date(prev.modified).getTime() !== new Date(file.modified).getTime();
  }

  /* the job's own value for a fact: the best-ranked source other than the doc */
  var OWN = ['DE', 'Matt', 'Asana', 'form', 'legacy'];
  function ownValue(core, name) {
    var rec = (core.facts || {})[name];
    if (!rec) return text(core[name]);
    var by = rec.bySource || {};
    for (var i = 0; i < OWN.length; i++) if (text(by[OWN[i]])) return text(by[OWN[i]]);
    return null;
  }
  function both(a, u) { return [a, u].filter(Boolean).join(' '); }

  function addressCheck(found, core, label) {
    var a = text((found || {}).address);
    if (!a) return null;
    core = core || {};
    var u = text(found.unit), doc = both(a, u);
    var own = ownValue(core, 'address'), ownUnit = ownValue(core, 'unit');
    if (own) {
      if (!A.sameStreet(a, own)) return { doc: doc, job: both(own, ownUnit) };
      if (u && ownUnit && A.unitKey(u) !== A.unitKey(ownUnit)) return { doc: doc, job: both(own, ownUnit) };
      return null;
    }
    var l = text(label);
    if (!l || !/^\d/.test(l)) return null;     // "Untitled property": nothing to compare with
    return A.sameStreet(a, l) ? null : { doc: doc, job: l };
  }

  return { toFacts: toFacts, pick: pick, changed: changed, addressCheck: addressCheck };
});
