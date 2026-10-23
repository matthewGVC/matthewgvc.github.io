/* ============================================================
   PIECE JOB — a job laid onto the Brochure, the Postcards and the Seller
   pitch, and their edits laid back onto the job (workspace v2, Slice 5,
   spec §3). The Showsheet's own rules stay in sheet-job.js; this file reuses
   its helpers.

     GVC_PIECEJOB.TOOLS                       ['brochure', 'postcard-listed', 'postcard-sold', 'seller', 'pitch-map']
     GVC_PIECEJOB.FIELDS(tool, row)           the job facts the piece prints (only these can make it stale)
     GVC_PIECEJOB.value(tool, row, name)      a fact as the piece reads it (pitch-map: mapAddresses)
     GVC_PIECEJOB.fill(tool, state, row, ctx) → { state, redone }
       A new tool state with the job laid on. The feature bullets are redone
       from the job's lists when nothing was built yet or the lists changed
       since ctx.previous (the last build's built_from, or the lists a draft
       was laid from); otherwise the piece's own wording stays.
     GVC_PIECEJOB.factEdits(tool, state, row) → { edits: [{ field, from, to }], errors }
     GVC_PIECEJOB.applyEdits(tool, row, edits, { noRebuild }) → { set: { core }, changes }
     GVC_PIECEJOB.builtFrom(tool, state, row, ctx) → the v2 snapshot (plan §10)
     GVC_PIECEJOB.photosFor(tool, row, editedPaths) → [paths] | null (unknown)
     GVC_PIECEJOB.pickFloorplans(files)  every image of the newest version, one per level
     GVC_PIECEJOB.pitchPhotos(files)     a pitch folder's photos (its Photos/ folder), maps left out
     GVC_PIECEJOB.mapAddresses(row)      the subject, then each comp's address
     GVC_PIECEJOB.label(tool), note(tool), maxAgents(tool), joinUnit(a, u)

   A row is a listing (properties) or a pitch (pitches: plain core values,
   no core.facts record, until Matt types one). Pure: no DOM, no network.
   Loads in the browser (window.GVC_PIECEJOB, after job-facts.js and
   sheet-job.js) and in Node. Tested by scripts/test-piece-job.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./job-facts.js'), require('./sheet-job.js'));
  else global.GVC_PIECEJOB = factory(global.GVC_FACTS, global.GVC_SHEETJOB);
})(typeof window !== 'undefined' ? window : globalThis, function (F, S) {
  'use strict';

  var TOOLS = ['brochure', 'postcard-listed', 'postcard-sold', 'seller', 'pitch-map', 'open-house', 'signage'];
  var LABEL = { brochure: 'Brochure', 'postcard-listed': 'Just Listed postcard', 'postcard-sold': 'Just Sold postcard', seller: 'Seller pitch', 'pitch-map': 'Map',
    'open-house': 'Open house flyer', signage: 'Signage' };
  var NOTE = { brochure: 'on the Brochure', 'postcard-listed': 'on the Postcard', 'postcard-sold': 'on the Postcard', seller: 'on the Seller pitch', 'pitch-map': 'on the Map',
    'open-house': 'on the Open House flyer', signage: 'on the Sign' };
  var MAX_AGENTS = { brochure: 2, 'postcard-listed': 2, 'postcard-sold': 2, seller: 2, 'pitch-map': 0, 'open-house': 2, signage: 2 };
  var LINKED = ['brochure', 'open-house', 'signage'];   // pieces that print the listing link (a QR)
  var PITCH_FACTS = ['comps', 'priceLow', 'priceMid', 'priceHigh', 'recBand'];
  var IMG = /\.(jpe?g|png|webp)$/i;

  function empty(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function text(v) { return v === null || v === undefined ? '' : String(v); }
  function numOf(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    var s = v.replace(/[\s,$%]/g, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  function figure(v) { return v === null ? '' : (numOf(v) !== null ? String(numOf(v)) : String(v)); }

  /* the same line GVC_PROPS.joinUnit prints (property-library.js) */
  function unitDisplay(u) { u = String(u || '').trim(); return !u ? '' : /^[\w-]{1,7}$/.test(u) ? 'Residence ' + u : u; }
  function joinUnit(a, u) { return [String(a || '').trim(), unitDisplay(u)].filter(Boolean).join(', '); }

  function core(row) { return (row && row.core) || {}; }
  /* the listing link a piece prints as a QR: the job's DE listing on elliman.com only. Any other
     address (typed into the job by anyone) prints the team's site instead, so a printed sign or
     flyer can never send buyers somewhere else. */
  var DE_HOST = /^https:\/\/([a-z0-9-]+\.)*elliman\.com(:443)?([\/?#]|$)/i;
  function linkOf(row) {
    var u = S.listingUrlOf(row);
    if (u && DE_HOST.test(u)) return u;
    var d = row && row.de && row.de.listingUrl;
    return typeof d === 'string' && DE_HOST.test(d) ? d : null;
  }
  function rental(row) { return !!(row && row.kind === 'rental'); }
  function v(row, name) { return S.valueOf(row, name); }
  function place(row) { return v(row, 'neighborhood') === null && v(row, 'city') !== null ? 'city' : 'neighborhood'; }
  /* the job's feature lists, interior first; an older record's single list when it has neither */
  function listFields(row) {
    var i = v(row, 'interiorFeatures'), b = v(row, 'buildingFeatures');
    return (Array.isArray(i) && i.length) || (Array.isArray(b) && b.length) ? ['interiorFeatures', 'buildingFeatures'] : ['features'];
  }
  function featureList(row, which) {
    var out = [];
    (which || listFields(row)).forEach(function (n) { var x = v(row, n); if (Array.isArray(x)) out = out.concat(x); });
    return out.map(function (s) { return String(s).trim(); }).filter(Boolean);
  }
  function soldPrice(row) { return v(row, 'closePrice') !== null ? 'closePrice' : 'price'; }

  function mapAddresses(row) {
    var c = core(row), out = [];
    var subject = joinUnit(c.address, c.unit);
    if (subject) out.push(subject);
    (Array.isArray(c.comps) ? c.comps : []).forEach(function (x) {
      var a = x && String(x.address || '').trim();
      if (a) out.push(a);
    });
    return out;
  }

  /* Slice 6: DE's open houses still to come, oldest first: [{ type, start, end }] (DE's local times) */
  /* DE's open house times are New York wall-clock times with no zone ("2026-10-25T15:00:00"):
     they are compared as text with "now" written the same way in New York, so a computer in
     another zone never moves them. A date alone ("2026-10-25") runs to the end of that day. */
  var WALL = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
  function wall(s, endOfDay) {
    if (typeof s !== 'string' || !WALL.test(s)) return null;
    if (s.length === 10) return s + (endOfDay ? 'T23:59:59' : 'T00:00:00');
    return s.length === 16 ? s + ':00' : s;
  }
  function nyNow(t) {
    var parts = {};
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t)).forEach(function (p) { parts[p.type] = p.value; });
      return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second;
    } catch (e) { return new Date(t).toISOString().slice(0, 19); }
  }
  function upcomingOpenHouses(row, now) {
    var list = core(row).openHouses;
    if (!Array.isArray(list) || !list.length) list = (row && row.de && row.de.openHouses) || [];
    var at = nyNow(typeof now === 'number' ? now : Date.now());
    return (Array.isArray(list) ? list : []).filter(function (o) { return o && typeof o === 'object' && wall(o.startTime); })
      .filter(function (o) { return (wall(o.endTime, true) || wall(o.startTime, true)) >= at; })
      .map(function (o) { return { type: o.type === 'Broker' ? 'Broker' : 'Public', start: o.startTime, end: wall(o.endTime) ? o.endTime : null }; })
      .sort(function (a, b) { return wall(a.start) < wall(b.start) ? -1 : wall(a.start) > wall(b.start) ? 1 : 0; });
  }

  function FIELDS(tool, row) {
    if (tool === 'brochure') {
      return [rental(row) ? 'rent' : 'price', 'beds', 'baths', 'halfBaths', 'sqft', 'parking', 'city', 'state', 'zip', 'description'].concat(listFields(row));
    }
    if (tool === 'postcard-listed') return ['price', place(row)];
    if (tool === 'postcard-sold') return [soldPrice(row), place(row)];
    if (tool === 'seller') {
      var l = listFields(row).indexOf('features') !== -1 ? ['features'] : ['interiorFeatures'];
      return ['beds', 'baths', 'halfBaths', 'sqft', 'propertyType', 'yearBuilt', 'taxesMonthly', 'commonCharges', 'description']
        .concat(l, ['city', 'state', 'zip'], PITCH_FACTS);
    }
    if (tool === 'pitch-map') return ['mapAddresses'];
    // the blurb is the short description, else the description: whichever prints is the one tracked
    if (tool === 'open-house') return [rental(row) ? 'rent' : 'price', 'beds', 'baths', 'halfBaths', 'sqft', place(row), 'openHouses',
      v(row, 'shortDescription') !== null || v(row, 'description') === null ? 'shortDescription' : 'description'];
    return [];
  }
  function value(tool, row, name) {
    if (name === 'mapAddresses') return mapAddresses(row);
    // the three the flyer prints (a fourth one changing changes nothing printed)
    if (name === 'openHouses') { var oh = upcomingOpenHouses(row).slice(0, 3); return oh.length ? oh : null; }
    if (PITCH_FACTS.indexOf(name) !== -1) { var x = core(row)[name]; return empty(x) ? null : x; }
    return v(row, name);
  }
  function agents(tool, row) {
    var a = S.agentsOf(row);
    return { ids: a.ids.slice(0, MAX_AGENTS[tool] || 0), confirmed: a.confirmed };
  }
  function bathsText(row) {
    var b = v(row, 'baths'), h = v(row, 'halfBaths');
    return b === null ? '' : String(b) + (numOf(h) > 0 && Number.isInteger(numOf(b)) ? '.5' : '');
  }

  /* ---------- job → piece ---------- */

  function listsChanged(row, ctx, which) {
    var pf = ctx && ctx.previous && ctx.previous.facts;
    if (!pf) return true;
    return which.some(function (n) { return JSON.stringify(pf[n] === undefined ? null : pf[n]) !== JSON.stringify(v(row, n)); });
  }

  function fill(tool, state, row, ctx) {
    row = row || {};
    var s = clone(state) || {}, c = core(row), redone = [];
    var lists = listFields(row);
    var a = agents(tool, row);
    if (tool === 'brochure') {
      s.address = joinUnit(c.address, c.unit);
      s.city = text(v(row, 'city')); s.state = text(v(row, 'state')); s.zip = text(v(row, 'zip'));
      s.price = figure(v(row, rental(row) ? 'rent' : 'price'));
      s.beds = text(v(row, 'beds')); s.baths = bathsText(row);
      s.sqft = text(v(row, 'sqft')); s.parking = text(v(row, 'parking'));
      if (v(row, 'description') !== null) s.blurb = String(v(row, 'description'));
      s.listingUrl = linkOf(row) || '';   // the job's DE listing, else none (never an old outside link)
      if (a.ids.length) s.agents = a.ids;
      if (featureList(row, lists).length && listsChanged(row, ctx, lists)) { s.features = featureList(row, lists).join('\n'); redone.push('features'); }
    } else if (tool === 'postcard-listed' || tool === 'postcard-sold') {
      s.kind = tool === 'postcard-sold' ? 'sold' : 'sale';
      s.address = text(c.address); s.unit = text(c.unit);
      s.town = text(v(row, 'neighborhood') || v(row, 'city') || '');
      s.price = figure(v(row, tool === 'postcard-sold' ? soldPrice(row) : 'price'));
      if (a.ids.length) s.agents = a.ids;
    } else if (tool === 'seller') {
      s.address = joinUnit(c.address, c.unit);
      s.city = text(v(row, 'city')); s.state = text(v(row, 'state')); s.zip = text(v(row, 'zip'));
      s.beds = text(v(row, 'beds')); s.baths = bathsText(row); s.sqft = text(v(row, 'sqft'));
      s.ptype = text(v(row, 'propertyType')); s.year = text(v(row, 'yearBuilt'));
      s.taxes = figure(v(row, 'taxesMonthly')); s.cc = figure(v(row, 'commonCharges'));
      if (v(row, 'description') !== null) s.blurb = String(v(row, 'description'));
      var fl = lists.indexOf('features') !== -1 ? ['features'] : ['interiorFeatures'];
      if (featureList(row, fl).length && listsChanged(row, ctx, fl)) { s.features = featureList(row, fl).join('\n'); redone.push('features'); }
      s.comps = Array.isArray(c.comps) ? clone(c.comps) : [];
      ['priceLow', 'priceMid', 'priceHigh'].forEach(function (k) { s[k] = text(c[k]); });
      s.recBand = c.recBand ? String(c.recBand) : (s.recBand || 'mid');
      // the deck speaks New York or New Jersey; Florida takes New Jersey's wording (D100)
      s.market = row.market === 'NYC' ? 'nyc' : row.market === 'NJ' || row.market === 'FL' ? 'nj' : (s.market || 'nyc');
      if (a.ids.length) s.agents = a.ids;
    } else if (tool === 'open-house') {
      s.address = text(c.address); s.unit = text(c.unit);
      s.town = text(v(row, 'neighborhood') || v(row, 'city') || '');
      s.price = figure(v(row, rental(row) ? 'rent' : 'price'));
      s.priceLabel = rental(row) ? 'Monthly Rent' : 'List Price';
      s.beds = text(v(row, 'beds')); s.baths = bathsText(row); s.sqft = text(v(row, 'sqft'));
      var short = v(row, 'shortDescription') || v(row, 'description');
      if (short !== null) s.blurb = String(short);
      s.market = S.marketKey(row.market);
      s.listingUrl = linkOf(row) || '';
      if (a.ids.length) s.agents = a.ids;
      // the dates: DE's upcoming open houses, redone when they changed since the last build
      var oh = value(tool, row, 'openHouses') || [];
      var pf = ctx && ctx.previous && ctx.previous.facts;
      // (a first build with no open houses on DE keeps the dates typed on the flyer)
      if ((pf || oh.length) && JSON.stringify((pf && pf.openHouses) || null) !== JSON.stringify(oh.length ? oh : null)) {
        s.dates = oh.slice(0, 3).map(function (o) { return { start: o.start, end: o.end, broker: o.type === 'Broker' }; });
        redone.push('dates');
      }
    } else if (tool === 'signage') {
      s.kind = 'for-sale';
      // the job's DE listing, else blank (the sign prints the team's site): never an old link
      s.qrUrl = linkOf(row) || '';
      s.market = S.marketKey(row.market);
      if (a.ids.length) s.agents = a.ids;
    }
    return { state: s, redone: redone };
  }

  /* ---------- piece → job ---------- */

  /* piece key, job field, parse kind ('soft' = wording when it doesn't parse: no edit, no error) */
  function EDITABLE(tool, row) {
    var r = rental(row);
    if (tool === 'brochure') {
      return [['price', r ? 'rent' : 'price', 'money'], ['beds', 'beds', 'number'], ['baths', 'baths', 'baths'],
        ['sqft', 'sqft', 'number'], ['parking', 'parking', 'text'], ['city', 'city', 'text'], ['state', 'state', 'text'],
        ['zip', 'zip', 'text'], ['blurb', 'description', 'text']];
    }
    if (tool === 'postcard-listed') return [['price', 'price', 'money']];
    if (tool === 'open-house') return [['price', r ? 'rent' : 'price', 'money']];
    if (tool === 'seller') {
      return [['beds', 'beds', 'number'], ['baths', 'baths', 'baths'], ['sqft', 'sqft', 'number'], ['ptype', 'propertyType', 'text'],
        ['year', 'yearBuilt', 'soft'], ['taxes', 'taxesMonthly', 'money'], ['cc', 'commonCharges', 'money'], ['blurb', 'description', 'text'],
        ['city', 'city', 'text'], ['state', 'state', 'text'], ['zip', 'zip', 'text'],
        ['priceLow', 'priceLow', 'pitch'], ['priceMid', 'priceMid', 'pitch'], ['priceHigh', 'priceHigh', 'pitch'],
        ['recBand', 'recBand', 'pitch'], ['comps', 'comps', 'pitch']];
    }
    return [];
  }
  function parse(kind, t) {
    if (kind === 'money') return F.parseValue('money', t.replace(/\s*(\/\s*(mo|month)\.?|per\s+month|monthly|a\s+month)\s*$/i, ''));
    if (kind === 'soft') { var y = F.parseValue('number', t); return y.ok ? y : { ok: false, soft: true }; }
    return F.parseValue(kind, t);
  }
  function cleanComps(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object'; })
      .map(function (x) { var o = {}; ['address', 'price', 'sqft', 'bb', 'date'].forEach(function (k) { o[k] = text(x[k]).trim(); }); return o; })
      .filter(function (x) { return x.address || x.price || x.sqft || x.bb || x.date; });
  }

  /* the deck's comp rows as saved: blank rows dropped, every other key kept */
  function keepComps(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object' && cleanComps([x]).length; })
      .map(function (x) { return clone(x); });
  }

  function factEdits(tool, state, row) {
    state = state || {}; row = row || {};
    var base = clone(state);
    EDITABLE(tool, row).forEach(function (e) { base[e[0]] = e[2] === 'pitch' && e[0] === 'comps' ? [] : ''; });
    var shown = fill(tool, base, row, { previous: { facts: {} } }).state;
    var edits = [], errors = [];
    EDITABLE(tool, row).forEach(function (e) {
      var key = e[0], field = e[1], kind = e[2];
      if (kind === 'pitch') {
        var from = core(row)[key] === undefined ? null : core(row)[key];
        if (key === 'comps') {
          // compared on what the deck prints; saved as the rows the deck holds (other keys kept)
          if (JSON.stringify(cleanComps(state.comps)) === JSON.stringify(cleanComps(core(row).comps))) return;
          edits.push({ field: field, from: from, to: keepComps(state.comps) });
          return;
        }
        if (key === 'recBand') {
          // 'mid' is the deck's own default: no band on the job and 'mid' on the deck is no change
          var nb = text(state.recBand).trim() || 'mid', ob = text(from).trim() || 'mid';
          if (nb !== ob) edits.push({ field: field, from: from, to: nb });
          return;
        }
        var nowT = text(state[key]).trim(), wasT = text(from).trim();
        if (nowT === wasT || (numOf(nowT) !== null && numOf(nowT) === numOf(wasT))) return;
        if (nowT && numOf(nowT) === null) { errors.push({ field: field, error: 'The price band needs figures, like 2,100,000.' }); return; }
        edits.push({ field: field, from: from, to: nowT === '' ? null : numOf(nowT) });
        return;
      }
      var t = text(state[key]).trim(), w = text(shown[key]).trim();
      if (!t || t === w) return;
      var p = parse(kind, t);
      if (!p.ok) { if (!p.soft) errors.push({ field: field, error: p.error }); return; }
      var cur = v(row, field);
      if (field === 'baths') {
        if (!S.same(cur, p.value)) edits.push({ field: 'baths', from: cur, to: p.value });
        var h = v(row, 'halfBaths'), hn = p.halfBaths || null;
        if (!S.same(h, hn) && !(h === null && hn === null) && !(numOf(h) === 0 && hn === null)) edits.push({ field: 'halfBaths', from: h, to: hn });
        return;
      }
      if (S.same(cur, p.value)) return;
      edits.push({ field: field, from: cur, to: p.value });
    });
    return { edits: edits, errors: errors };
  }

  function applyEdits(tool, row, edits, opts) {
    var c = clone(core(row)), noRebuild = (opts && opts.noRebuild) || {}, changes = [];
    var facts = c.facts || {}, used = false;
    (edits || []).forEach(function (e) {
      if (PITCH_FACTS.indexOf(e.field) !== -1) {
        // the pitch's own work: Matt is its only source, no record of sources
        if (e.to === null) delete c[e.field]; else c[e.field] = e.to;
      } else {
        used = true;
        facts = e.to === null ? F.clear(facts, e.field) : F.adoptEdit(facts, e.field, e.to);
        c[e.field] = e.to === null && facts[e.field] ? facts[e.field].value : e.to;
      }
      changes.push({ field: e.field, old_value: e.from, new_value: e.to, note: NOTE[tool] || 'on the piece', no_rebuild: !!noRebuild[e.field] });
    });
    if (used || c.facts) c.facts = facts;
    return { set: { core: c }, changes: changes };
  }

  /* ---------- what a build printed ---------- */

  function builtFrom(tool, state, row, ctx) {
    ctx = ctx || {}; state = state || {}; row = row || {};
    var facts = {};
    FIELDS(tool, row).forEach(function (n) { facts[n] = value(tool, row, n); });
    var a = agents(tool, row);
    return {
      v: 2, tool: tool, market: row.market || 'NYC', kind: rental(row) ? 'rental' : 'sale',
      facts: facts, agents: a.ids, agentsConfirmed: a.confirmed, listingUrl: LINKED.indexOf(tool) !== -1 ? linkOf(row) : null,
      photos: ctx.photos || [], plans: ctx.plans || [], map: ctx.map || null,
      print: { paper: state.paper || null, bleed: state.bleed || null }, via: ctx.via || 'helper'
    };
  }

  /* ---------- files ---------- */

  function byName(a, b) { a = a.split('/').pop().toLowerCase(); b = b.split('/').pop().toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
  /* the photos a piece prints, in order; null when not known (no picks, Drive not read) */
  function photosFor(tool, row, editedPaths) {
    var ph = S.photosOf(row, editedPaths);
    if (!ph) return null;
    var list = ph.tray.slice();
    if (ph.front && list.indexOf(ph.front) !== 0) { list = list.filter(function (p) { return p !== ph.front; }); list.unshift(ph.front); }
    if (tool === 'postcard-listed' || tool === 'postcard-sold') return list.slice(0, 2);
    if (tool === 'brochure') return list.slice(0, 24);
    if (tool === 'seller') return list.slice(0, 12);
    if (tool === 'open-house') return list.slice(0, 3);
    return [];
  }

  function versionOf(f) {
    var segs = String(f.path || f.name).split('/');
    for (var i = segs.length - 2; i >= 0; i--) { var m = /^v(\d+)$/i.exec(segs[i]); if (m) return +m[1]; }
    var n = /\bv(\d+)\b/i.exec(f.name || '');
    return n ? +n[1] : 0;
  }
  function renderOf(name) { return /unbranded|\bmls\b/i.test(name) ? 'unbranded' : /blank/i.test(name) ? 'blank' : 'branded'; }
  var RANK = { branded: 0, unbranded: 1, blank: 2 };
  /* a level's name: the file name without the render, version and extension words */
  function levelOf(name) {
    return name.replace(/\.[a-z0-9]+$/i, '').replace(/\b(unbranded|branded|mls|blank|v\d+)\b/gi, ' ').replace(/[\s_-]+/g, ' ').trim().toLowerCase();
  }
  function ms(x) { var t = Date.parse(x); return isNaN(t) ? 0 : t; }
  function pickFloorplans(files) {
    var ok = (files || []).map(function (f) {
      var name = f.name || String(f.path || '').split('/').pop();
      if (!IMG.test(name) || /(^|\/)source\//i.test(f.path || '') || /\b(alt|alternate|option)\b/i.test(name)) return null;
      return { version: versionOf(f), render: renderOf(name), path: f.path, modified: f.modified || null, level: levelOf(name) };
    }).filter(Boolean);
    if (!ok.length) return [];
    var top = Math.max.apply(null, ok.map(function (x) { return x.version; }));
    var best = {};
    ok.filter(function (x) { return x.version === top; }).forEach(function (x) {
      var b = best[x.level];
      if (!b || RANK[x.render] < RANK[b.render] || (x.render === b.render && ms(x.modified) > ms(b.modified))) best[x.level] = x;
    });
    return Object.keys(best).sort().map(function (k) { var x = best[k]; return { version: x.version, render: x.render, path: x.path, modified: x.modified }; }).slice(0, 4);
  }

  var MAP_FILE = /^(map\s+-\s+|gvc-3d-property-map)/i;
  function pitchPhotos(files) {
    return (files || []).filter(function (f) {
      var p = String(f.path || ''), segs = p.split('/'), name = segs[segs.length - 1];
      if (!IMG.test(name) || MAP_FILE.test(name)) return false;
      return segs.length === 2 && /^photos$/i.test(segs[0]);
    }).map(function (f) { return f.path; }).sort(byName).slice(0, 12);
  }

  return {
    TOOLS: TOOLS, FIELDS: FIELDS, value: value, fill: fill, factEdits: factEdits, applyEdits: applyEdits, builtFrom: builtFrom,
    photosFor: photosFor, pickFloorplans: pickFloorplans, pitchPhotos: pitchPhotos, mapAddresses: mapAddresses,
    label: function (t) { return LABEL[t] || t; }, note: function (t) { return NOTE[t]; }, maxAgents: function (t) { return MAX_AGENTS[t] || 0; },
    agents: agents, joinUnit: joinUnit, PITCH_FACTS: PITCH_FACTS, upcomingOpenHouses: upcomingOpenHouses, LINKED: LINKED, linkOf: linkOf
  };
});
