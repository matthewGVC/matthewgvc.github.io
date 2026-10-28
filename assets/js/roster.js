/* ============================================================
   GVC TEAM ROSTER — the single source of truth for agent profiles.

   Every tool on the site (showsheet, brochure, seller and buyer
   packages, and whatever comes next) reads its agent list from here.
   Add a teammate once, in this file, and they turn up everywhere.

   TO ADD SOMEONE
     1. Drop a square headshot at  assets/agents/<id>.png
        1100x1100, transparent background — a cut-out of the person,
        not a photo with a white box behind them. The tools draw it on
        white paper and on navy panels, so any background will show.
        Frame it like the others: face about 0.30 of the width, centred,
        eyes a third of the way down, torso running off the bottom edge.
     2. Add a row to the right market below. Keep `id`
        lowercase-hyphenated and matching the filename. `market` is
        NYC, NJ or FL ('' for the founders, who work every market).

   Bios, a short intro and the "at a glance" facts are NOT written here:
   they are in assets/js/bios.js, one block per person, and merged in below.

   `phone`, `mobile` and `instagram` may be left empty — the tools skip blank fields
   rather than leaving a gap in the layout. That makes Instagram opt-in: a
   handle is printed only for the agents who have one filled in here, so
   nobody's account goes on a client-facing page by default.

   This file also owns the agent PICKER the builder tools share, so the
   chips look and behave the same everywhere. See GVC_PICKER at the
   bottom.
   ============================================================ */
(function (global) {
  /* Founders first, then each market, which is the order the pickers
     show and roughly the order sheets get built in. */
  var PEOPLE = [
    /* Founders */
    {market:'', id:'john-gasdaska',     name:'John Gasdaska',     title:'Licensed Associate Real Estate Broker', phone:'646.345.7350', mobile:'',    email:'john.gasdaska@elliman.com', instagram:''},
    {market:'', id:'tj-verdiglione',    name:'TJ Verdiglione',    title:'Licensed Real Estate Salesperson',      phone:'732.425.7477', mobile:'',    email:'thomas.verdiglione@elliman.com', instagram:''},
    {market:'', id:'jonathan-conlon',   name:'Jonathan Conlon',   title:'Licensed Associate Real Estate Broker', phone:'347.564.2440', mobile:'',    email:'jonathan.conlon@elliman.com', instagram:''},

    /* New York */
    {market:'NYC', id:'katie-cook',        name:'Katie Cook',        title:'Licensed Real Estate Salesperson',      phone:'516.319.9732', mobile:'',    email:'katie.cook@elliman.com', instagram:''},
    {market:'NYC', id:'nicole-sobol',      name:'Nicole Sobol',      title:'Licensed Real Estate Salesperson',      phone:'201.240.7544', mobile:'',    email:'nicole.sobol@elliman.com', instagram:''},
    {market:'NYC', id:'gary-kasparov',     name:'Gary Kasparov',     title:'Licensed Real Estate Salesperson',      phone:'718.980.8777', mobile:'',    email:'gary.kasparov@elliman.com', instagram:''},
    /* Elyse's number is from the team's 2024 pitch template. */
    {market:'NYC', id:'elyse-gutman',      name:'Elyse Gutman',      title:'Licensed Associate Real Estate Broker', phone:'917.796.3144', mobile:'',    email:'elyse.gutman@elliman.com', instagram:''},
    {market:'NYC', id:'ayuen-gai',         name:'Ayuen Gai',         title:'Licensed Real Estate Salesperson',      phone:'315.679.0088', mobile:'',    email:'ayuen.gai@elliman.com', instagram:''},

    /* New Jersey */
    {market:'NJ', id:'marli-silver',      name:'Marli Silver',      title:'Licensed Real Estate Salesperson',      phone:'732.387.3807', mobile:'732.403.1174', email:'marli.silver@elliman.com', instagram:'@marlisilverrealestate'},
    {market:'NJ', id:'george-putykewycz', name:'George Putykewycz', title:'Licensed Real Estate Salesperson',      phone:'732.546.7535', mobile:'',    email:'george.putykewycz@elliman.com', instagram:''},
    {market:'NJ', id:'james-huber',       name:'James Huber',       title:'Licensed Real Estate Salesperson',      phone:'732.962.0683', mobile:'',    email:'james.huber@elliman.com', instagram:''},

    /* Florida */
    {market:'FL', id:'nicole-melveney',   name:'Nicole Melveney',   title:'Licensed Real Estate Sales Associate',  phone:'732.567.5375', mobile:'',    email:'nicole.melveney@elliman.com', instagram:''},
    {market:'FL', id:'karl-brisard',      name:'Karl Brisard',      title:'Licensed Real Estate Sales Associate',  phone:'561.291.8861', mobile:'',    email:'karl.brisard@elliman.com', instagram:''}
  ];

  /* Resolve headshots against this file's own location rather than the
     page's, so tools at any folder depth get a working path without
     each one hard-coding its own pile of ../../ */
  var dir = document.currentScript && document.currentScript.src;
  var base = dir ? new URL('../agents/', dir).href : '/assets/agents/';

  /* Bios live in assets/js/bios.js (loaded first, optional). Each person
     gets role / blurb / bio / facts from there, or empty ones, so a tool can
     read them without checking they exist. */
  var BIOS = global.GVC_BIOS || {};
  PEOPLE.forEach(function (a) {
    var b = BIOS[a.id] || {};
    a.photo = base + a.id + '.png';
    a.role = b.role || '';
    a.blurb = b.blurb || '';
    a.bio = b.bio || [];
    a.facts = b.facts || [];
  });

  /* NAME CASING — one rule for every generator that prints a person's name
     (agents here, and any name typed into a panel: tools call
     GVC_NAMECASE on it before printing). Each word gets a capital first
     letter, including after a hyphen or apostrophe and after Mc/Mac-style
     prefixes already typed that way; letters the person typed in capitals
     are kept ("TJ", "McKenzie"), so it only ever adds capitals. */
  /* Beyond that: particles inside a name stay lower case ("Juan de la Cruz",
     "Ludwig van der Rohe") unless the name starts with one; generational
     suffixes read II / III / IV and Jr / Sr; a typed "mc" prefix gets its
     second capital ("McDonald"); and a letter after a full stop is an
     initial, so "j.r." reads "J.R.". */
  var PARTICLES = { de: 1, del: 1, della: 1, der: 1, di: 1, da: 1, du: 1, la: 1, le: 1, van: 1, von: 1, den: 1, dos: 1, das: 1 };
  var ROMAN = { ii: 'II', iii: 'III', iv: 'IV', vi: 'VI', vii: 'VII' };
  var SUFFIX = { jr: 'Jr', sr: 'Sr' };
  function nameCase(s) {
    var first = true;
    return String(s == null ? '' : s).replace(/[^\s]+/g, function (word) {
      var bare = word.replace(/[.,]+$/, ''), tail = word.slice(bare.length), low = bare.toLowerCase();
      var wasFirst = first; first = false;
      if (!wasFirst && bare === low && PARTICLES[low]) return word;
      if (!wasFirst && ROMAN[low] && (bare === low || bare === ROMAN[low])) return ROMAN[low] + tail;
      if (!wasFirst && SUFFIX[low] && bare === low) return SUFFIX[low] + tail;
      word = word.replace(/(^|[\-'’(&.])([a-zà-þ])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); });
      return word.replace(/^(\(?)Mc([a-zà-þ])/, function (m, pre, ch) { return pre + 'Mc' + ch.toUpperCase(); });
    });
  }
  global.GVC_NAMECASE = nameCase;
  PEOPLE.forEach(function (a) { a.name = nameCase(a.name); });

  global.GVC_ROSTER = PEOPLE;

  /* INITIALS — Asana's "🧑‍💼 Point Person" field holds initials ("JG/KC"),
     and the workspace suggests agents from them (D53). Written out by hand
     (D71), never computed, because initials clash. Each value is one of:
       'katie-cook'           the roster id
       null                   ambiguous: always ask Matt (CB = Colton Bryan
                              or Catherine Ballard)
       'past:Jessica Wolf'    a past team member, not on the roster
       'other:Alexandra Lynch' on the team in Asana's People, not on the roster
     KC is Katie Cook on listings (Karen Conlon isn't an agent). Initials not
     listed here are asked about too. Sources: the Asana rest crawl §4 and the
     listings survey (VB was seen on old listings). */
  global.GVC_ROSTER_INITIALS = {
    JG: 'john-gasdaska',
    TJ: 'tj-verdiglione', TV: 'tj-verdiglione',
    JC: 'jonathan-conlon',
    KC: 'katie-cook',
    NS: 'nicole-sobol',
    GK: 'gary-kasparov',
    EG: 'elyse-gutman',
    AG: 'ayuen-gai',
    MS: 'marli-silver',
    GP: 'george-putykewycz',
    JH: 'james-huber',
    NM: 'nicole-melveney',
    KB: 'karl-brisard',
    AL: 'other:Alexandra Lynch',
    CB: null,
    KG: 'past:Kathy Grabowy',
    JW: 'past:Jessica Wolf',
    CR: 'past:CJ Reid',
    AR: 'past:Anthony Romano',
    SB: 'past:Sharon Baum',
    MSA: 'past:Mariana Santelli',   /* typed "MSa" in Asana; lookups also try upper case */
    VB: 'past:Victor Barbenes'
  };

  var BY_ID = {};
  PEOPLE.forEach(function (a) { BY_ID[a.id] = a; });
  global.GVC_AGENT = function (id) { return BY_ID[id] || null; };

  /* ============================================================
     THE SHARED AGENT PICKER

     The grid of headshot chips in every builder's Agents panel. Click
     to add, click again to remove; a selected chip carries a badge with
     its position, because on the printed sheet the order is the order.

     Kept here rather than in each tool because there is one right way
     for it to behave and four tools that need it. Styles are the
     .ag-chip rules in assets/css/builder.css (the Showsheet keeps its
     own copy, being deliberately self-contained).

       host    element to fill
       state   object holding the selection array — or, for a tool that
               REPLACES its state object rather than mutating it (loading
               a saved sheet, resetting the form), a function returning
               the current one. Passing the object itself there would
               leave the picker editing a discarded copy.
       opts    {key, max, onChange, onFull}
                 key      state property holding the ids (default 'agents')
                 max      how many fit on the page (default 2)
                 onChange called after every change
                 onFull   called with the roster entry when the pick
                          would exceed `max`. Return false to reject it;
                          anything else drops the oldest and accepts.

     Returns its own repaint function, for callers that reset state
     from elsewhere (loading a sample, clearing the form).
     ============================================================ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* The chips are narrow, so titles ride in abbreviated. */
  function shortTitle(t) {
    return String(t || '').replace('Licensed', 'Lic.').replace('Real Estate', 'R.E.');
  }

  global.GVC_PICKER = function (host, state, opts) {
    opts = opts || {};
    var key = opts.key || 'agents';
    var max = opts.max || 2;

    /* Resolved on every read, never cached, so a tool that swaps its whole
       state object out from under us still gets the live selection. */
    function picked() {
      var s = typeof state === 'function' ? state() : state;
      if (!Array.isArray(s[key])) s[key] = [];
      return s[key];
    }

    function paint() {
      var sel = picked();
      host.innerHTML = '';
      PEOPLE.forEach(function (a) {
        var ord = sel.indexOf(a.id);
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ag-chip' + (ord > -1 ? ' sel' : '');
        chip.setAttribute('aria-pressed', ord > -1 ? 'true' : 'false');
        chip.innerHTML =
          '<img src="' + a.photo + '" alt="">' +
          '<div><div class="nm">' + esc(a.name) + '</div>' +
          '<div class="tt">' + esc(shortTitle(a.title)) + '</div></div>' +
          (ord > -1 ? '<span class="ord">' + (ord + 1) + '</span>' : '');
        chip.addEventListener('click', function () {
          var list = picked(), i = list.indexOf(a.id);
          if (i > -1) list.splice(i, 1);
          else {
            if (list.length >= max && opts.onFull && opts.onFull(a, max) === false) return;
            list.push(a.id);
            while (list.length > max) list.shift();
          }
          paint();
          if (opts.onChange) opts.onChange();
        });
        host.appendChild(chip);
      });
    }

    paint();
    return paint;
  };
})(window);
