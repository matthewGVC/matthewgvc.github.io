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
        lowercase-hyphenated and matching the filename.

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
    {id:'john-gasdaska',     name:'John Gasdaska',     title:'Licensed Associate Real Estate Broker', phone:'646.345.7350', mobile:'',    email:'john.gasdaska@elliman.com', instagram:''},
    {id:'tj-verdiglione',    name:'TJ Verdiglione',    title:'Licensed Real Estate Salesperson',      phone:'732.425.7477', mobile:'',    email:'thomas.verdiglione@elliman.com', instagram:''},
    {id:'jonathan-conlon',   name:'Jonathan Conlon',   title:'Licensed Associate Real Estate Broker', phone:'347.564.2440', mobile:'',    email:'jonathan.conlon@elliman.com', instagram:''},

    /* New York */
    {id:'katie-cook',        name:'Katie Cook',        title:'Licensed Real Estate Salesperson',      phone:'516.319.9732', mobile:'',    email:'katie.cook@elliman.com', instagram:''},
    {id:'nicole-sobol',      name:'Nicole Sobol',      title:'Licensed Real Estate Salesperson',      phone:'201.240.7544', mobile:'',    email:'nicole.sobol@elliman.com', instagram:''},
    {id:'gary-kasparov',     name:'Gary Kasparov',     title:'Licensed Real Estate Salesperson',      phone:'718.980.8777', mobile:'',    email:'gary.kasparov@elliman.com', instagram:''},
    {id:'ayuen-gai',         name:'Ayuen Gai',         title:'Licensed Real Estate Salesperson',      phone:'315.679.0088', mobile:'',    email:'ayuen.gai@elliman.com', instagram:''},

    /* New Jersey */
    {id:'marli-silver',      name:'Marli Silver',      title:'Licensed Real Estate Salesperson',      phone:'732.387.3807', mobile:'732.403.1174', email:'marli.silver@elliman.com', instagram:'@marlisilverrealestate'},
    {id:'george-putykewycz', name:'George Putykewycz', title:'Licensed Real Estate Salesperson',      phone:'732.546.7375', mobile:'',    email:'george.putykewycz@elliman.com', instagram:''},
    {id:'james-huber',       name:'James Huber',       title:'Licensed Real Estate Salesperson',      phone:'732.962.0683', mobile:'',    email:'james.huber@elliman.com', instagram:''},

    /* Florida */
    {id:'nicole-melveney',   name:'Nicole Melveney',   title:'Licensed Real Estate Sales Associate',  phone:'732.567.5375', mobile:'',    email:'nicole.melveney@elliman.com', instagram:''},
    {id:'karl-brisard',      name:'Karl Brisard',      title:'Licensed Real Estate Sales Associate',  phone:'561.291.8861', mobile:'',    email:'karl.brisard@elliman.com', instagram:''}
  ];

  /* Resolve headshots against this file's own location rather than the
     page's, so tools at any folder depth get a working path without
     each one hard-coding its own pile of ../../ */
  var dir = document.currentScript && document.currentScript.src;
  var base = dir ? new URL('../agents/', dir).href : '/assets/agents/';

  PEOPLE.forEach(function (a) { a.photo = base + a.id + '.png'; });

  global.GVC_ROSTER = PEOPLE;
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
