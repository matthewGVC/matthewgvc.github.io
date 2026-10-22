/* ============================================================
   SHEET JOB — a job laid onto the Showsheet, and the sheet's edits laid
   back onto the job (workspace v2, Slice 4, spec §2 and §4).

     GVC_SHEETJOB.fill(state, row, { previous })  → { state, redone }
       A new sheet state with the job's facts, agents, listing link and
       market on it. The building and residence sections are redone from
       the job's feature lists through the Showsheet's own reader rules
       (listing.js) when nothing was built yet or the list changed since
       `previous` (the last build's built_from); otherwise the sheet's own
       wording stays. redone names the sections redone.
     GVC_SHEETJOB.factEdits(state, row) → { edits: [{ field, from, to }], errors: [{ field, error }] }
       What the sheet now says differently from the job, in job values
       (money as numbers, baths whole + halfBaths). Address and unit never.
     GVC_SHEETJOB.applyEdits(row, edits, { noRebuild }) → { set: { core }, changes }
       The save_job arguments for those edits (Matt's values, logged
       "on the Showsheet", ticked "Typo, no rebuild" where asked).
     GVC_SHEETJOB.builtFrom(state, row, { photos, floorplan, via }) → snapshot
       What a build printed from the job (plan §10): every printed fact as
       the job held it, agents, listing link, market, photos and floorplan.
     GVC_SHEETJOB.FIELDS(row, ownership?) → the job facts the sheet prints.
     Also: marketKey, ownershipOf, valueOf, listingUrlOf, agentsOf,
     photosOf(row, editedPaths), pickFloorplan(files).

   Pure: no DOM, no network. Loads in the browser (window.GVC_SHEETJOB,
   after job-facts.js and listing.js) and in Node (require).
   Tested by scripts/test-sheet-job.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./job-facts.js'), require('../../tools/showsheet/listing.js'));
  } else global.GVC_SHEETJOB = factory(global.GVC_FACTS, global.GVC_LISTING);
})(typeof window !== 'undefined' ? window : globalThis, function (F, L) {
  'use strict';

  var HOUSES = ['Townhouse', 'Single family', 'Other'];
  var IMG = /\.(jpe?g|png|webp)$/i;

  function empty(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function same(a, b) {
    if (JSON.stringify(a) === JSON.stringify(b)) return true;
    var x = numOf(a), y = numOf(b);
    return x !== null && y !== null && x === y;
  }
  function numOf(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    var s = v.replace(/[\s,$%]/g, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  function marketKey(m) { return ({ NYC: 'nyc', NJ: 'nj', FL: 'fl' })[m] || 'nyc'; }
  function typeOf(row) {
    var t = row && row.core && row.core.propertyType;
    if (Array.isArray(t)) t = t[0];
    return typeof t === 'string' && t ? t : null;
  }
  function ownershipOf(row) {
    var t = typeOf(row);
    if (t === 'Co-op') return 'co-op';
    if (t === 'Condo' || t === 'Condop') return 'condo';
    if (t && HOUSES.indexOf(t) !== -1) return 'house';
    return row && (row.market === 'NJ' || row.market === 'FL') ? 'house' : null;
  }

  /* the shown value of a job fact (DE > Matt > Asana > …), else what core holds */
  function valueOf(row, name) {
    var core = (row && row.core) || {};
    var hit = F.shown(core, Object.assign({}, row, { core: core })).filter(function (x) { return x.name === name; })[0];
    var v = hit ? hit.value : core[name];
    return empty(v) ? null : v;
  }
  function listingUrlOf(row) {
    var u = ((row && row.core) || {}).listingUrl || ((row && row.de) || {}).listingUrl || null;
    return typeof u === 'string' && /^https:\/\//.test(u) ? u : null;
  }
  function agentsOf(row) {
    var core = (row && row.core) || {};
    if (core.agentIds && core.agentIds.length) return { ids: core.agentIds.slice(), confirmed: true };
    return { ids: (core.suggestedAgentIds || []).slice(), confirmed: false };
  }
  /* the place on the chip: the neighbourhood, else (NJ / FL) the town */
  function placeField(row) {
    if (valueOf(row, 'neighborhood') !== null) return 'neighborhood';
    return row && (row.market === 'NJ' || row.market === 'FL') ? 'city' : 'neighborhood';
  }

  /* the job facts this sheet prints (S15: only these can make it stale) */
  function FIELDS(row, ownership) {
    var own = ownership || ownershipOf(row) || 'co-op', nyc = !row || row.market !== 'NJ' && row.market !== 'FL';
    var rental = !!(row && row.kind === 'rental');
    var out = [rental ? 'rent' : 'price', 'beds', 'baths', 'halfBaths', placeField(row), 'yearBuilt', 'headline', 'interiorFeatures', 'buildingFeatures'];
    if (!rental) {
      out.push('assessments');
      if (nyc && own === 'co-op') out.push('maintenance', 'maxFinancing', 'flipTax');
      else out.push('commonCharges', 'taxesMonthly');
    }
    if (!nyc) out.push('sqft', 'lotSize', 'parking');
    return out;
  }

  /* ---------- job → sheet ---------- */

  var MONEY = ['maintenance', 'commonCharges', 'taxesMonthly'];
  function text(v) { return v === null || v === undefined ? '' : String(v); }

  function fill(state, row, ctx) {
    var s = clone(state) || {}, core = (row && row.core) || {}, prev = (ctx && ctx.previous) || null, redone = [];
    var v = function (n) { return valueOf(row, n); };
    s.market = marketKey(row.market);
    s.kind = row.kind === 'rental' ? 'rental' : 'sale';
    var own = ownershipOf(row);
    if (own) s.ownership = own;
    s.propertyType = typeOf(row) || '';
    s.address = text(core.address);
    s.unit = text(core.unit);
    s.neighborhood = text(v('neighborhood') || v('city') || '');
    var price = v(s.kind === 'rental' ? 'rent' : 'price');
    s.price = price === null ? '' : (numOf(price) !== null ? money(numOf(price)) : String(price));
    s.beds = text(v('beds'));
    var baths = v('baths'), half = v('halfBaths');
    s.baths = baths === null ? '' : String(baths) + (numOf(half) > 0 ? '.5' : '');
    MONEY.forEach(function (n) { var x = v(n); s[n] = x === null ? '' : (numOf(x) !== null ? money(numOf(x)) : String(x)); });
    if (s.kind === 'rental') MONEY.forEach(function (n) { s[n] = ''; });
    if (s.ownership === 'co-op' && s.market === 'nyc') { s.commonCharges = ''; s.taxesMonthly = ''; }
    else s.maintenance = '';
    var mf = v('maxFinancing');
    s.maxFinancing = mf === null ? '' : (numOf(mf) !== null ? numOf(mf) + '%' : String(mf));
    s.flipTax = text(v('flipTax'));
    s.assessments = text(v('assessments'));
    s.sqft = text(v('sqft'));
    s.lotSize = text(v('lotSize'));
    s.parking = text(v('parking'));
    s.building = Object.assign({}, s.building || {});
    s.residence = Object.assign({}, s.residence || {});
    if (v('yearBuilt') !== null) s.building.builtYear = String(v('yearBuilt'));
    if (v('headline') !== null) s.positioning = String(v('headline'));
    var url = listingUrlOf(row);
    if (url) s.listingUrl = url;
    var ag = agentsOf(row);
    if (ag.ids.length) s.agentIds = ag.ids;

    // lists: through the reader rules, when new or changed since the last build
    var pf = (prev && prev.facts) || null;
    var bl = v('buildingFeatures'), il = v('interiorFeatures');
    if (Array.isArray(bl) && bl.length && (!pf || JSON.stringify(pf.buildingFeatures || null) !== JSON.stringify(bl))) {
      var b = L.buildingFrom(bl).building;
      ['builtYear', 'stories', 'residences', 'service', 'policy'].forEach(function (k) { if (k !== 'builtYear' || v('yearBuilt') === null) s.building[k] = b[k] || (k === 'builtYear' ? s.building[k] || '' : ''); });
      s.building.amenities = b.amenities || [];
      redone.push('building');
    }
    if (Array.isArray(il) && il.length && (!pf || JSON.stringify(pf.interiorFeatures || null) !== JSON.stringify(il))) {
      var r = L.residenceFrom(il).residence;
      ['exposures', 'outdoor', 'ceiling', 'climate'].forEach(function (k) { s.residence[k] = r[k] || ''; });
      s.residence.features = r.features || [];
      redone.push('residence');
    }
    return { state: s, redone: redone };
  }

  /* ---------- sheet → job ---------- */

  /* sheet key, job field, parse kind; 'soft' = sheet wording when it doesn't parse (no edit, no error) */
  function EDITABLE(row) {
    var rental = row && row.kind === 'rental';
    return [
      ['price', rental ? 'rent' : 'price', 'money'], ['beds', 'beds', 'number'], ['baths', 'baths', 'baths'],
      ['maintenance', 'maintenance', 'money'], ['commonCharges', 'commonCharges', 'money'], ['taxesMonthly', 'taxesMonthly', 'money'],
      ['assessments', 'assessments', 'text'], ['maxFinancing', 'maxFinancing', 'number'], ['flipTax', 'flipTax', 'text'],
      ['sqft', 'sqft', 'number'], ['lotSize', 'lotSize', 'text'], ['parking', 'parking', 'text'],
      ['building.builtYear', 'yearBuilt', 'soft'], ['neighborhood', null, 'text'], ['positioning', 'headline', 'text']
    ];
  }
  function setAt(o, path, v) {
    var ks = path.split('.'), last = ks.pop(), t = ks.reduce(function (x, k) { return x[k] = x[k] || {}; }, o);
    t[last] = v;
  }
  function at(o, path) { return path.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function parse(kind, t) {
    if (kind === 'money') return F.parseValue('money', t.replace(/\s*(\/\s*(mo|month)\.?|per\s+month|monthly|a\s+month)\s*$/i, ''));
    if (kind === 'number') return F.parseValue('number', t.replace(/%\s*$/, ''));
    if (kind === 'soft') { var y = F.parseValue('number', t); return y.ok ? y : { ok: false, soft: true }; }
    return F.parseValue(kind, t);
  }

  function factEdits(state, row) {
    // what the job alone would put in each field: the editable fields cleared, then the job laid on
    var base = clone(state);
    EDITABLE(row).forEach(function (e) { setAt(base, e[0], ''); });
    var shown = fill(base, row, { previous: { facts: { buildingFeatures: null, interiorFeatures: null } } }).state;
    var printed = FIELDS(row, state.ownership), edits = [], errors = [];
    EDITABLE(row).forEach(function (e) {
      var key = e[0], field = e[1] || placeField(row), kind = e[2];
      if (printed.indexOf(field) === -1 && field !== 'neighborhood' && field !== 'city') return;
      var now = text(at(state, key)).trim(), was = text(at(shown, key)).trim();
      if (!now || now === was) return;
      var p = parse(kind, now);
      if (!p.ok) { if (!p.soft) errors.push({ field: field, error: p.error }); return; }
      var cur = valueOf(row, field);
      if (field === 'baths') {
        if (!same(cur, p.value)) edits.push({ field: 'baths', from: cur, to: p.value });
        var h = valueOf(row, 'halfBaths'), hn = p.halfBaths || null;
        if (!same(h, hn) && !(h === null && hn === null) && !(numOf(h) === 0 && hn === null)) edits.push({ field: 'halfBaths', from: h, to: hn });
        return;
      }
      if (same(cur, p.value)) return;
      edits.push({ field: field, from: cur, to: p.value });
    });
    return { edits: edits, errors: errors };
  }

  function applyEdits(row, edits, opts) {
    var core = clone((row && row.core) || {}), noRebuild = (opts && opts.noRebuild) || {}, changes = [];
    var facts = core.facts || {};
    (edits || []).forEach(function (e) {
      facts = F.adoptEdit(facts, e.field, e.to);
      core[e.field] = e.to;
      changes.push({ field: e.field, old_value: e.from, new_value: e.to, note: 'on the Showsheet', no_rebuild: !!noRebuild[e.field] });
    });
    core.facts = facts;
    return { set: { core: core }, changes: changes };
  }

  /* ---------- what a build printed ---------- */

  function builtFrom(state, row, ctx) {
    ctx = ctx || {};
    var facts = {};
    FIELDS(row, state.ownership).forEach(function (n) { facts[n] = valueOf(row, n); });
    var ag = agentsOf(row);
    return {
      v: 1, market: row.market || 'NYC', kind: row.kind === 'rental' ? 'rental' : 'sale', ownership: state.ownership || null,
      facts: facts, agents: (state.agentIds || ag.ids).slice(), agentsConfirmed: ag.confirmed, listingUrl: listingUrlOf(row),
      photos: ctx.photos || { front: null, back: null }, floorplan: ctx.floorplan || null,
      print: { paper: state.paper || 'a5', bleed: !!state.bleed }, via: ctx.via || 'helper'
    };
  }

  /* ---------- photos and floorplan (S7) ---------- */

  function byName(a, b) { a = a.split('/').pop().toLowerCase(); b = b.split('/').pop().toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
  function photosOf(row, editedPaths) {
    var hero = (row && row.photo_hero) || null, order = ((row && row.photo_order) || []).slice();
    var tray = order.length ? order : (editedPaths ? editedPaths.slice().sort(byName).slice(0, 12) : null);
    if (!tray) { if (!hero) return null; tray = []; }
    if (hero && tray.indexOf(hero) === -1) tray.unshift(hero);
    var front = hero || tray[0] || null;
    var back = tray.filter(function (p) { return p !== front; })[0] || null;
    return { front: front, back: back, tray: tray };
  }

  function versionOf(f) {
    var segs = String(f.path || f.name).split('/');
    for (var i = segs.length - 2; i >= 0; i--) { var m = /^v(\d+)$/i.exec(segs[i]); if (m) return +m[1]; }
    var n = /\bv(\d+)\b/i.exec(f.name || '');
    return n ? +n[1] : 0;
  }
  function renderOf(name) {
    if (/unbranded|\bmls\b/i.test(name)) return 'unbranded';
    if (/blank/i.test(name)) return 'blank';
    return 'branded';
  }
  var RENDER_RANK = { branded: 0, unbranded: 1, blank: 2 };
  function ms(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }
  function pickFloorplan(files) {
    var best = null;
    (files || []).forEach(function (f) {
      var name = f.name || String(f.path || '').split('/').pop();
      if (!IMG.test(name) || /(^|\/)source\//i.test(f.path || '') || /\b(alt|alternate|option)\b/i.test(name)) return;
      var x = { version: versionOf(f), render: renderOf(name), path: f.path, modified: f.modified || null };
      if (!best || x.version > best.version ||
          (x.version === best.version && (RENDER_RANK[x.render] < RENDER_RANK[best.render] ||
            (x.render === best.render && ms(x.modified) > ms(best.modified))))) best = x;
    });
    return best;
  }

  return { marketKey: marketKey, ownershipOf: ownershipOf, valueOf: valueOf, listingUrlOf: listingUrlOf, agentsOf: agentsOf,
           FIELDS: FIELDS, fill: fill, factEdits: factEdits, applyEdits: applyEdits, builtFrom: builtFrom,
           photosOf: photosOf, pickFloorplan: pickFloorplan, same: same };
});
