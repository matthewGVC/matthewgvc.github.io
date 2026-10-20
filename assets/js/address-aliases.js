/* ============================================================
   ADDRESS ALIASES — one street address, however it's spelled.

   Douglas Elliman writes "347 W BROADWAY" and "404 PARK AVE S"; the team's
   Drive folders say "347 West Broadway" and "404 PAS". This file turns both
   into one canonical form so the workspace and the desktop helper can tell
   they're the same place.

     GVC_ADDR.normalize('347 W BROADWAY')        → '347 west broadway'
     GVC_ADDR.same('176 E 71ST ST', '176 E71')   → true
     GVC_ADDR.matchFolder(street, unit, folders) → the folder for that unit, or null

   The canonical form drops "street" (NYC folders leave it off: "176 E71")
   and writes ordinals as digits ("Fifth", "5TH" → "5").

   Loads in the browser (window.GVC_ADDR) and in Node (require).
   A new spelling is one row in WORDS or SHORT, plus a line in
   scripts/test-address-aliases.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_ADDR = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* whole-street shorthands the team uses in folder names */
  var SHORT = {
    PAS: 'PARK AVENUE SOUTH',
    WEA: 'WEST END AVENUE',
    EEA: 'EAST END AVENUE',
    RSD: 'RIVERSIDE DRIVE',
    CPW: 'CENTRAL PARK WEST',
    CPS: 'CENTRAL PARK SOUTH'
  };

  /* single-word abbreviations */
  var WORDS = {
    N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST',
    AVE: 'AVENUE', AV: 'AVENUE', BLVD: 'BOULEVARD', DR: 'DRIVE', LN: 'LANE',
    RD: 'ROAD', PL: 'PLACE', CT: 'COURT', TER: 'TERRACE', PKWY: 'PARKWAY',
    FIRST: '1', SECOND: '2', THIRD: '3', FOURTH: '4', FIFTH: '5',
    SIXTH: '6', SEVENTH: '7', EIGHTH: '8', NINTH: '9', TENTH: '10'
  };

  /* street types: a trailing one may be missing on one side ("176 E71",
     "1050 Park"), but two different types never match (St ≠ Ave) */
  var TYPES = { STREET: 1, AVENUE: 1, BOULEVARD: 1, DRIVE: 1, LANE: 1, ROAD: 1, PLACE: 1, COURT: 1, TERRACE: 1, PARKWAY: 1 };

  function tokens(s) {
    var out = [];
    String(s || '').toUpperCase().replace(/[.,#']/g, ' ').split(/\s+/).forEach(function (t) {
      if (!t) return;
      // glued direction + number: "E71", "W59", "E71ST"
      var g = /^([NSEW])(\d+)(ST|ND|RD|TH)?$/.exec(t);
      if (g) { out.push(g[1], g[2]); return; }
      out.push(t);
    });
    return out;
  }

  /* → { core: ['176', 'EAST', '71'], type: 'STREET' | null } */
  function parts(street) {
    var out = [];
    tokens(street).forEach(function (t) {
      var ord = /^(\d+)(ST|ND|RD|TH)$/.exec(t);
      if (ord) { out.push(ord[1]); return; }
      if (t === 'ST') { out.push('STREET'); return; }   // never Saint in these addresses
      if (SHORT[t]) { out.push.apply(out, SHORT[t].split(' ')); return; }
      out.push(WORDS[t] || t);
    });
    var type = out.length > 1 && TYPES[out[out.length - 1]] ? out.pop() : null;
    return { core: out, type: type };
  }

  /* canonical form; "street" is left off (NYC folders never write it) */
  function normalize(street) {
    var p = parts(street);
    return p.core.concat(p.type && p.type !== 'STREET' ? [p.type] : []).join(' ').toLowerCase();
  }

  /* every word, street type included: '84 east diane drive' */
  function full(street) {
    var p = parts(street);
    return p.core.concat(p.type ? [p.type] : []).join(' ').toLowerCase();
  }

  /* "84 Diane Dr. Tinton Falls" starts with "84 Diane Dr": the address must be
     complete, type and all, before the extra words ("12 Oak" never starts
     "12 Oak Hill Rd") */
  function startsWithAddress(name, street) {
    var p = parts(street);
    if (!p.type) return false;
    var want = full(street), have = full(name);
    return have.indexOf(want + ' ') === 0;
  }

  function same(a, b) {
    var x = parts(a), y = parts(b);
    if (!x.core.length || x.core.join(' ') !== y.core.join(' ')) return false;
    return !x.type || !y.type || x.type === y.type;
  }

  /* "11B Rental" → "11B", "Apt 4A - Lawson" → "4A", "18 19E" → "1819E",
     "6 Floor" / "6FL" → "6" */
  function unitKey(s) {
    var t = String(s || '').toUpperCase()
      .replace(/\b(APT|APARTMENT|RESIDENCE|UNIT|NO)\b\.?/g, ' ')
      .replace(/#/g, ' ')
      .split(/\s+-\s+|\s+(?=RENTAL\b)/)[0];
    var floor = /\b(FLOOR|FL)\b|^\d+FL$/.test(t.trim());
    t = t.replace(/\bRENTAL\b/g, '').replace(/\s*\b(FLOOR|FL)\b/g, '').replace(/^(\d+)FL$/, '$1');
    if (floor) t = t.trim().replace(/^(\d+)(ST|ND|RD|TH)$/, '$1');   // "6th Floor" is floor 6
    return t.replace(/[^A-Z0-9]/g, '');
  }

  /* candidates: the unit folders inside a building folder (or, for a house
     with no unit, the address folders of a town or market) */
  function matchFolder(street, unit, candidates) {
    var list = candidates || [];
    var want = unitKey(unit);
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (want) { if (unitKey(c.unit || c.name) === want) return c; }
      else if (same(c.name, street)) return c;
    }
    return null;
  }

  return { normalize: normalize, same: same, full: full, startsWithAddress: startsWithAddress, unitKey: unitKey, matchFolder: matchFolder };
});
