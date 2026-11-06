/* ============================================================
   PLACES — which deals are one place, and what belongs to the place.

   A deal is a row in `properties` (a sale, a rental, a pitch). A place is the
   apartment or house itself, so a sale and a rental on the same unit, or a
   re-listing years later, are several deals on one place.

     GVC_PLACES.placeKey({ address, unit }, 'NYC')  → 'NYC|401 east 89|1819E'
     GVC_PLACES.buildingKey({ address }, 'NYC')     → 'NYC|401 east 89' (NYC only)
     GVC_PLACES.samePlace(a, b)                     → confirms a key match
     GVC_PLACES.inherit(prevCore, newCore)          → a new deal's core, place facts filled in
     GVC_PLACES.group(jobs, allRows)                → one row per place for the Overview and Resell
     GVC_PLACES.shown(all, passing, allRows)        → the rows to draw: each place a passing deal is on, with all its deals
     GVC_PLACES.dealWord(job)                       → a row's chip for another deal on it: 'Rental · Live'
     GVC_PLACES.errors(row)                         → the row's errors: its live deals' and its lead's

   The key finds candidates and samePlace confirms ("12 Elm St" and "12 Elm
   Ave" share a key, but are two places). The address and unit are passed
   already split (GVC_PROPS.unitOf); placeKey also lifts a trailing unit or
   floor out of the address ("Apt. 2E", "#204", "10th Floor") so a unit left
   in the address still lands on the right place.

   Uses GVC_ADDR (address-aliases.js) and, for placeFacts, GVC_FACTS
   (job-facts.js). Both are read only when a function needs them, so pages can
   load this file without them and still use group, shown, lead and LIVE.

   Loads in the browser (window.GVC_PLACES) and in Node (require).
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory(global);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_PLACES = api;
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  var inNode = typeof module === 'object' && module.exports && typeof require === 'function';
  function addr() { return inNode ? require('./address-aliases.js') : global.GVC_ADDR; }
  function facts() { return inNode ? require('./job-facts.js') : global.GVC_FACTS; }

  /* a street type left off one side must not make two places ("929 Park") */
  var TYPE_WORDS = /\s(?:avenue|ave|road|rd|lane|ln|place|pl|drive|dr|court|ct|boulevard|blvd|way|terrace|ter|circle|cir|parkway|pkwy|square|sq|plaza|highway|hwy)$/;

  /* the unit words property-library.js's splitUnit takes as the start of a unit */
  var UNIT_WORD = '(?:residence|apartment|apt\\.?|unit|suite|ste\\.?|penthouse|ph)';
  var WORD_TAIL = new RegExp(',\\s*' + UNIT_WORD + '\\s*([\\w-]+)\\s*$', 'i');
  var BARE_TAIL = /,\s*([0-9]+[A-Za-z]?)\s*$/;
  var HASH_TAIL = /\s*#\s*([\w-]+)\s*$/;
  var FLOOR_TAIL = /[\s,]+(\d+)(?:st|nd|rd|th)\s+floor\s*$/i;

  /* '1050 Fifth Avenue, Apt. 2E' → { street: '1050 Fifth Avenue', unit: '2E' };
     '52 East 4th Street 10th Floor' → unit '10FL'; no unit → unit '' */
  function splitTrailing(address) {
    var s = String(address || '').trim(), m;
    if ((m = FLOOR_TAIL.exec(s))) return { street: s.slice(0, m.index).trim(), unit: m[1] + 'FL' };
    if ((m = HASH_TAIL.exec(s))) return { street: s.slice(0, m.index).trim(), unit: m[1] };
    if ((m = WORD_TAIL.exec(s)) || (m = BARE_TAIL.exec(s))) return { street: s.slice(0, m.index).trim(), unit: m[1] };
    return { street: s, unit: '' };
  }

  function cleanStreet(address) { return splitTrailing(address).street; }

  function streetKey(address) {
    var k = addr().normalize(cleanStreet(address));
    var bare = k.replace(TYPE_WORDS, '');
    return /\s/.test(bare) ? bare : k;   // "205 Parkway" keeps its type: only the number would be left
  }

  function placeKey(core, market) {
    core = core || {};
    var street = streetKey(core.address);
    if (!street) return '';
    var unit = String(core.unit || '').trim() ? core.unit : splitTrailing(core.address).unit;
    return market + '|' + street + '|' + addr().unitKey(unit);
  }

  /* a town may be missing on one side: false only when both name one and differ */
  function sameTown(a, b) {
    function key(t) { return String(t || '').toUpperCase().replace(/[.,]/g, ' ').replace(/\b(NJ|NY|FL)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
    var x = key(a), y = key(b);
    return !x || !y || x === y;
  }

  function samePlace(a, b) {
    return addr().sameStreet(cleanStreet(a.address), cleanStreet(b.address)) && sameTown(a.town, b.town);
  }

  /* NYC buildings hold facts for every unit; NJ and FL keep them on the place */
  function buildingKey(core, market) {
    var street = market === 'NYC' ? streetKey((core || {}).address) : '';
    return street ? market + '|' + street : '';
  }

  /* ---------------- which facts belong to the place ---------------- */

  var PLACE_FACTS = ['beds', 'baths', 'halfBaths', 'sqft', 'exteriorSqft', 'propertyType', 'rooms', 'layoutType', 'floor',
    'exposures', 'views', 'ceilingHeight', 'outdoorSpace', 'yearBuilt', 'stories', 'parking'];

  /* the board rules and the building's facts too; price, copy, milestones and pieces stay on the deal */
  function placeFacts() {
    var out = PLACE_FACTS.slice();
    facts().FIELDS.forEach(function (f) {
      if ((f.group === 'rules' || f.group === 'building') && out.indexOf(f.name) === -1) out.push(f.name);
    });
    return out;
  }

  function blank(v) {
    return v == null || v === '' || (Array.isArray(v) && !v.length);
  }

  /* a new deal takes the place's facts from its newest earlier deal where it has none of its own,
     with each fact's record so it doesn't read as "earlier tool"; the earlier deal is left alone */
  function inherit(prevCore, newCore) {
    var out = {}, k;
    for (k in newCore) out[k] = newCore[k];
    prevCore = prevCore || {};
    placeFacts().forEach(function (name) {
      if (!blank(out[name]) || blank(prevCore[name])) return;
      out[name] = prevCore[name];
      var rec = prevCore.facts && prevCore.facts[name];
      if (!rec) return;
      var copy = {};
      for (k in out.facts) copy[k] = out.facts[k];
      copy[name] = rec;
      out.facts = copy;
    });
    return out;
  }

  /* ---------------- one row per place ---------------- */

  var LIVE = ['Pitch', 'Prep', 'Live', 'Accepted offer', 'In contract'];

  function isLive(stage) { return LIVE.indexOf(stage) !== -1; }

  /* the deal a row opens: a live one, a sale before a rental, then the newest; with
     nothing live, the newest whatever its kind (Review Focus 5) */
  function lead(deals) {
    function rank(d) { return !isLive(d.stage) ? 4 : d.kind === 'sale' ? 0 : d.kind === 'rental' ? 1 : 2; }
    function made(d) { return String(d.createdAt || ''); }
    return deals.slice().sort(function (a, b) {
      return rank(a) - rank(b) || (made(a) < made(b) ? 1 : made(a) > made(b) ? -1 : 0);
    })[0];
  }

  /* jobs are Job objects (placeId); allRows are the database's rows (place_id), so a
     filter on the jobs can't turn a live sale into a "past deal" */
  function group(jobs, allRows) {
    var order = [], byPlace = {};
    jobs.forEach(function (j) {
      if (!j.placeId) { order.push([j]); return; }
      if (!byPlace[j.placeId]) { byPlace[j.placeId] = []; order.push(byPlace[j.placeId]); }
      byPlace[j.placeId].push(j);
    });
    return order.map(function (deals) {
      var head = lead(deals), placeId = head.placeId || null;
      return {
        placeId: placeId,
        lead: head,
        live: deals.filter(function (d) { return isLive(d.stage); }),
        history: !placeId ? 0 : (allRows || []).filter(function (r) {
          return r.place_id === placeId && !isLive(r.stage) && r.side !== 'buy' && r.id !== head.id;
        }).length
      };
    });
  }

  /* a place shows when any of its deals passes the page's filters, and its row has all its
     deals (all: the page's deals before the filters), so an agent on the rental still sees the place */
  function shown(all, passing, allRows) {
    var on = {};
    passing.forEach(function (j) { on[j.placeId || j.id] = true; });
    return group(all.filter(function (j) { return on[j.placeId || j.id]; }), allRows);
  }

  var DEAL_WORD = { listing: 'Sale', rental: 'Rental' };
  function dealWord(d) { return DEAL_WORD[d.type] ? DEAL_WORD[d.type] + ' · ' + (d.phase || d.stage) : d.phase || d.stage; }

  function errors(row) {
    var deals = row.live.indexOf(row.lead) === -1 ? [row.lead].concat(row.live) : row.live;
    return deals.reduce(function (n, d) { return n + (d.mismatches || 0); }, 0);
  }

  return { splitTrailing: splitTrailing, cleanStreet: cleanStreet, streetKey: streetKey, placeKey: placeKey, samePlace: samePlace,
    buildingKey: buildingKey, sameTown: sameTown, placeFacts: placeFacts, inherit: inherit, LIVE: LIVE, lead: lead, group: group,
    shown: shown, dealWord: dealWord, errors: errors };
});
