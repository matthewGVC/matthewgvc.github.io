/* ============================================================
   NAMING — the one way a listing is named (decision 12).

   Asana's task name is the listing's name, and it is written one way:

     NYC   200 E57 - 17A   1050 Fifth - 10C   404 PAS - 6A (Rental)   347 West Broadway - 6
     NJ    401 Brown St   315 Foreman Ave (House 1)   86 Montrose Ave (Abbey Farms)
     FL    200 E Boca Raton Rd - B

   The street (short type, NYC numbered streets and avenues in the team's
   own shorthand), a unit after " - ", "(House N)", a development's name for
   its houses, and " (Rental)" last when the deal is a rental. The town or
   hood lives in the task's City/Hood field, never in the name.

     GVC_NAME.baseName(name)                → the name as the workspace shows it: spaces tidied, "(Rental)" off
     GVC_NAME.isRental(name)                → the name ends "(Rental)"
     GVC_NAME.ruleName(name, ctx)           → { name, base, town, sure, why }
                                              ctx = { market, cityHood, rental, devHouse }
     GVC_NAME.nameOf({ street, unit, house }, market, { rental })  → the rule name from parts
     GVC_NAME.folderNameOf(name)            → baseName with each "/" a space ("401 E89 - 18 19E")
     GVC_NAME.TYPE_SHORT                    → street types and their short forms

   ruleName is careful: when it isn't sure (a note in brackets, a price, a zip,
   no street type, a town that disagrees with City/Hood, a unit written inside the
   street) it says so in plain words and returns the name unchanged, so a task
   is never renamed by a guess. A sure answer is always the same address and the
   same place as the name it came from (decision 18): the guard is here, in the code.

   Loads in the browser (window.GVC_NAME) and in Node (require). Uses GVC_ADDR
   (address-aliases.js) and GVC_PLACES (places.js), read when a function needs them.
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory(global);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_NAME = api;
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  var inNode = typeof module === 'object' && module.exports && typeof require === 'function';
  function addr() { return inNode ? require('./address-aliases.js') : global.GVC_ADDR; }
  function places() { return inNode ? require('./places.js') : global.GVC_PLACES; }

  var TYPE_SHORT = {
    street: 'St', avenue: 'Ave', road: 'Rd', lane: 'Ln', drive: 'Dr', place: 'Pl', court: 'Ct', boulevard: 'Blvd',
    terrace: 'Ter', parkway: 'Pkwy', square: 'Sq', circle: 'Cir', trail: 'Trl', highway: 'Hwy'
  };

  /* ---------------- the name as written ---------------- */

  function tidy(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function baseName(name) { return tidy(tidy(name).replace(/\s*\(\s*rental\s*\)\s*$/i, '')); }

  function isRental(name) { return /\(\s*rental\s*\)\s*$/i.test(tidy(name)); }

  function folderNameOf(name) { return baseName(name).replace(/\//g, ' '); }

  /* ---------------- words ---------------- */

  var DIRS = { n: 'N', north: 'N', s: 'S', south: 'S', e: 'E', east: 'E', w: 'W', west: 'W' };

  /* a street type word → its short form (Way and Plaza stay as written), or '' */
  function typeOf(word) {
    var w = String(word).toLowerCase().replace(/\.$/, '');
    if (TYPE_SHORT[w]) return TYPE_SHORT[w];
    if (w === 'av') return 'Ave';
    for (var k in TYPE_SHORT) if (TYPE_SHORT[k].toLowerCase() === w) return TYPE_SHORT[k];
    if (w === 'way' || w === 'plaza') return String(word).replace(/\.$/, '');
    return '';
  }

  var AVENUE_NAMES = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh'];
  var AVENUE_WORDS = { lexington: 'Lex', lex: 'Lex', park: 'Park', madison: 'Madison', columbus: 'Columbus', amsterdam: 'Amsterdam', york: 'York' };
  AVENUE_NAMES.forEach(function (n) { AVENUE_WORDS[n.toLowerCase()] = n; });

  /* whole streets the team writes in shorthand, or leaves alone */
  var NYC_STREETS = {
    'pas': 'PAS', 'park avenue south': 'PAS', 'park ave south': 'PAS', 'park avenue s': 'PAS', 'park ave s': 'PAS', 'park s': 'PAS',
    'wea': 'WEA', 'west end avenue': 'WEA', 'west end ave': 'WEA',
    'eea': 'EEA', 'east end avenue': 'EEA', 'east end ave': 'EEA',
    'rsd': 'RSD', 'riverside drive': 'RSD', 'riverside dr': 'RSD',
    'cpw': 'CPW', 'central park west': 'CPW',
    'cps': 'CPS', 'central park south': 'CPS',
    'sps': 'SPS', 'sutton place south': 'SPS'
  };
  var NYC_AS_WRITTEN = { 'broadway': 1, 'west broadway': 1, 'bowery': 1 };

  /* a unit is: a digit with no space, one capital letter, PH.., TH, Garden (as in address-aliases.js) */
  function unitLike(t) {
    return /\d/.test(t) || /^[A-Z]$/.test(t) || /^(PH\d{0,2}[A-Z]?|PENTHOUSE|TH|GARDEN)$/i.test(t);
  }

  function townKey(t) {
    return String(t || '').toUpperCase().replace(/[.,]/g, ' ').replace(/\b(NJ|NY|FL)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---------------- the street ---------------- */

  /* words after the number → { text } or { why } */
  function genericStreet(words) {
    var w = words.slice(), dir = '';
    if (w.length >= 3 && DIRS[w[w.length - 1].toLowerCase().replace(/\.$/, '')] && typeOf(w[w.length - 2])) {
      dir = DIRS[w.pop().toLowerCase().replace(/\.$/, '')];
    }
    var last = w[w.length - 1], t = typeOf(last);
    if (!t) return { why: 'the street has no street type at the end' };
    if (w.length > 1) w[w.length - 1] = t;   // a lone type word ("205 Parkway") is the street's name: keep it
    return { text: w.join(' ') + (dir ? ' ' + dir : '') };
  }

  function nycStreet(words) {
    var low = words.map(function (x) { return x.toLowerCase().replace(/\.$/, ''); }), key = low.join(' '), m, d;
    var lastType = words.length > 1 ? typeOf(words[words.length - 1]) : '';
    var plainStreet = !lastType || lastType === 'St';
    // a numbered street: direction + number, glued
    if ((m = /^([nsew])(\d+)(?:st|nd|rd|th)?$/.exec(low[0])) && words.length <= 2 && plainStreet) return { text: m[1].toUpperCase() + m[2] };
    if (DIRS[low[0]] && (m = /^(\d+)(?:st|nd|rd|th)?$/.exec(low[1] || '')) && words.length <= 3 && (words.length < 3 || lastType === 'St')) {
      return { text: DIRS[low[0]] + m[1] };
    }
    if (NYC_STREETS[key]) return { text: NYC_STREETS[key] };
    if (NYC_AS_WRITTEN[key]) return { text: words.join(' ') };
    // a Manhattan avenue: its word, no suffix
    var name = low[0];
    if ((d = /^(\d+)(?:st|nd|rd|th)$/.exec(name)) && +d[1] >= 1 && +d[1] <= 11) name = AVENUE_NAMES[+d[1] - 1].toLowerCase();
    if (AVENUE_WORDS[name] && (words.length === 1 || (words.length === 2 && lastType === 'Ave'))) return { text: AVENUE_WORDS[name] };
    return genericStreet(words);
  }

  /* ---------------- the rule ---------------- */

  function ruleName(name, ctx) {
    ctx = ctx || {};
    var base = baseName(name), market = ctx.market;
    function no(why) { return { name: base, base: base, town: '', sure: false, why: why }; }

    if (isRental(name) && !ctx.rental) return no('it says Rental but the deal is a sale');

    // brackets: (House N) and a development's name go last; any other note is Matt's to read
    var shape = /^([^()]*?)\s*((?:\([^()]*\)\s*)*)$/.exec(base);
    if (!shape) return no('it has a note in brackets');
    var rest = shape[1], house = '', dev = '', g, re = /\(([^()]*)\)/g;
    while ((g = re.exec(shape[2]))) {
      var h = /^house\s*([A-Z0-9]+)$/i.exec(g[1].trim());
      if (h && !house) house = h[1].toUpperCase();
      else if (!h && ctx.devHouse && !dev) dev = g[1].trim();
      else return no('it has a note in brackets');
    }

    if (!/^\d[\d-]*[A-Z]?\s/i.test(rest)) return no('it does not start with a street number');
    if (/\$/.test(rest)) return no('it has a price in it');
    var afterNumber = rest.replace(/^\S+\s+/, '');
    if (/\b\d{5}\b/.test(afterNumber)) return no('it has a zip code in it');
    if (/\b(NJ|NY|FL)\b/i.test(afterNumber)) return no('it has a state in it');

    // split: the street, then a unit and a town in any order a person might write them
    var segs = rest.split(/\s*,\s*/), dash = segs.shift().split(/\s+-\s+/), streetText = dash.shift().trim();
    var parts = dash.slice();
    segs.forEach(function (seg) { seg.split(/\s+-\s+/).forEach(function (p) { parts.push(p.trim()); }); });
    if (/(^|\s)(unit|apt\.?|apartment|suite|ste\.?|floor|fl)(\s|$)|#/i.test(streetText)) return no('the unit is written inside the street');

    var unit = '', town = '', u;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) return no('it has an empty part');
      if ((u = /^(?:APT|APARTMENT|UNIT|SUITE|#)\.?\s*(.+)$/i.exec(part))) {
        if (unit) return no('it names two units');
        unit = u[1].trim();
      } else if (!/\s/.test(part) && unitLike(part)) {
        if (unit) return no('it names two units');
        if (town) return no('it has a unit after the town');
        unit = part;
      } else {
        if (town) return no('it names two towns');
        town = part;
      }
    }

    var words = streetText.split(/\s+/), number = words.shift();
    if (!words.length) return no('the street has no name');
    var st = market === 'NYC' ? nycStreet(words) : genericStreet(words);
    if (st.why) return no(st.why);
    var street = number + ' ' + st.text;

    // the town or hood must agree with City/Hood
    var hood = tidy(ctx.cityHood);
    if (town) {
      if (market === 'NYC' && (!hood || townKey(town) !== townKey(hood))) return no('the name says ' + town + ' after the street, which is not the City/Hood');
      if (hood && townKey(town) !== townKey(hood)) return no('the name says ' + town + ', City/Hood says ' + hood);
    }

    var out = street + (unit ? ' - ' + unit : '') + (house ? ' (House ' + house + ')' : '') + (dev ? ' (' + dev + ')' : '');
    var full = out + (ctx.rental ? ' (Rental)' : '');

    // decision 18: never change the address or the place
    var A = addr(), P = places();
    function placeOf(n) {
      var s = A.splitName(n);
      return P.placeKey({ address: s.street, unit: s.unit || (s.house ? 'House ' + s.house : '') }, market);
    }
    if (!A.same(base, out) || placeOf(base) !== placeOf(out)) return no('the rule would change the address');

    return { name: full, base: out, town: town, sure: true, why: null };
  }

  /* the rule name from parts, for an Elliman-only unit (decision 72) */
  function nameOf(parts, market, opts) {
    parts = parts || {};
    var rental = !!(opts && opts.rental);
    var raw = tidy(parts.street) + (tidy(parts.unit) ? ' - ' + tidy(parts.unit) : '') + (tidy(parts.house) ? ' (House ' + tidy(parts.house) + ')' : '');
    var r = ruleName(raw, { market: market, cityHood: null, rental: rental });
    return r.sure ? r.name : raw + (rental ? ' (Rental)' : '');
  }

  return { baseName: baseName, isRental: isRental, ruleName: ruleName, nameOf: nameOf, folderNameOf: folderNameOf, TYPE_SHORT: TYPE_SHORT };
});
