/* ============================================================
   MARKETS — what differs between New York, New Jersey and Florida (overhaul step 2).

   One pipeline for all three markets: the same stages, Errors checks, kit
   and folder standard. Only what is listed here differs, and code asks this
   file rather than testing 'NYC' / 'NJ' / 'FL' itself. A new difference
   goes here first.

     GVC_MARKETS.get('NJ')        → the market, or null
     GVC_MARKETS.byState('NY')    → the market for a two-letter state (DE rows)
     GVC_MARKETS.CODES            → ['NYC', 'NJ', 'FL']
     GVC_MARKETS.signage(code)    → does a sale use yard signs here
     GVC_MARKETS.houses(code)     → are listings houses (HOA, the house sheet)
     GVC_MARKETS.deck(code)       → the Seller Package wording: 'nyc' or 'nj'
   ============================================================ */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else global.GVC_MARKETS = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LIST = [
    { code: 'NYC', state: 'NY', name: 'New York', drive: 'GVC - New York',
      // listings are co-op and condo units; no yard signs
      signage: false, houses: false, deck: 'nyc',
      mls: ['REBNY RLS'] },
    { code: 'NJ', state: 'NJ', name: 'New Jersey', drive: 'GVC - New Jersey',
      signage: true, houses: true, deck: 'nj',
      mls: [] },   // which NJ boards, and what data they give: waiting on James (overhaul plan, Held)
    { code: 'FL', state: 'FL', name: 'Florida', drive: 'GVC - Florida',
      // Florida decks take New Jersey's wording (D100)
      signage: true, houses: true, deck: 'nj',
      mls: ['BeachesMLS', 'Miami MLS', 'Stellar MLS'] }
  ];
  var BY = {}, BY_STATE = {};
  LIST.forEach(function (m) { BY[m.code] = m; BY_STATE[m.state] = m; });

  function get(code) { return BY[code] || null; }
  function byState(st) { return BY_STATE[String(st || '').toUpperCase()] || null; }
  function flag(k) { return function (code) { var m = get(code); return !!(m && m[k]); }; }

  return {
    LIST: LIST, CODES: LIST.map(function (m) { return m.code; }),
    get: get, byState: byState,
    name: function (code) { var m = get(code); return m ? m.name : ''; },
    signage: flag('signage'), houses: flag('houses'),
    deck: function (code) { var m = get(code); return m ? m.deck : null; }
  };
});
