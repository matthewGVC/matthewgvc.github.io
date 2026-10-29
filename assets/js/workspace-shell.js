/* ============================================================
   WORKSPACE SHELL — the top bar, banner and footer of every /workspace/ page
   (from the locked mockup's shell.js, now wired to real state).
   Main nav: Overview · Resell · New Dev · Errors · Tools (Status is Resell's Table view). The footer
   keeps Listing rules and Tasks.

     <body data-nav="overview|resell|newdev|job|match|tools" data-root="./ or ../">
     const shell = GVC_SHELL.mount({ onSynced, onDrive, noDrive })   after the page's markup
                                noDrive: the page never needs Drive (Match, Status):
                                no Drive pill, no read-only banner
     shell.setSync(health)      health from GVC_WS.syncHealth(); updates the
                                sync button's title and the DE pill (its hover
                                says when it last synced)
     shell.setAsana(health)     the same for GVC_WS.asanaHealth() (Asana pill)
     GVC_SHELL.syncWords(r)     POST /sync's { ok, asana, de } in one plain line,
                                each part read on its own (ok is false whenever
                                Asana has no token, even when DE synced)
     shell.driveState()         → Promise<'connected'|'needs-click'|…> (GVC_DRIVE)
     GVC_SHELL.helper(method, path, body) → the desktop helper's JSON, or
                                throws "The helper isn't running on this PC."
     GVC_SHELL.onTeam()         → Promise<true|false|null>: false when the
                                signed-in account has no role on the team list
                                (whoAmI().role empty), so a page says so
                                instead of an empty "all clear" (tune-up B5);
                                null when the team list couldn't be read
                                (whoAmI().checkFailed); true when it has a role,
                                or when whoAmI itself fails (the page's own
                                read then says what went wrong)
     GVC_SHELL.NOT_ON_TEAM      what those pages say when it's false
     GVC_SHELL.CANT_CHECK       what they say when it's null
     GVC_ICON(name)             the mockup's line icons
     GVC_ESC(text)              HTML-escapes anything from the database

   Read-only mode (spec §2.9): whenever Drive isn't connected here (phone,
   Safari, another PC, or Chrome before Reconnect) a banner says so; things
   that need Drive check shell.readOnly before acting.
   Needs: property-library.js, drive-rules.js, drive.js.
   ============================================================ */
(function (global) {
  'use strict';

  var ICONS = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 8"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    alert: '<path d="M12 8v5"/><path d="M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 5.5"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
  };
  function icon(n) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }
  /* a job's Asana / Drive / DE badges (GVC_WS.syncOf): a tick, a cross or a dash */
  function syncBadges(list) {
    return '<span class="syncb">' + (list || []).map(function (b) {
      var c = b.ok === true ? 'ok' : b.ok === false ? 'no' : 'na';
      return '<span class="sb ' + c + '" title="' + esc(b.src + ': ' + b.why) + '"><i aria-hidden="true">' + (c === 'ok' ? '✓' : c === 'no' ? '✗' : '○') + '</i>' + esc(b.src) +
        '<span class="sr">: ' + esc(b.why) + '</span></span>';
    }).join('') + '</span>';
  }
  /* confirmed agents as headshots (Sydney's note), the name on hover and for screen readers;
     anyone the roster doesn't know prints as a name */
  function faces(ids) {
    var A = global.GVC_AGENT;
    return '<span class="faces">' + (ids || []).map(function (id) {
      var a = A && A(id);
      if (!a) return '<span class="face-n">' + esc(id) + '</span>';
      return '<span class="face" title="' + esc(a.name) + '"><img src="' + esc(a.photo) + '" alt="' + esc(a.name) + '" loading="lazy"></span>';
    }).join('') + '</span>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var HELPER = 'http://localhost:47610', PAIR_KEY = 'gvc.helper.pair';
  function pairCode() { try { return global.localStorage.getItem(PAIR_KEY) || ''; } catch (e) { return ''; } }
  function helper(method, path, body) {
    return fetch(HELPER + path, {
      method: method, headers: { 'content-type': 'application/json', 'x-gvc-pair': pairCode() },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json(); }, function () {
      throw new Error('The helper isn\'t running on this PC.');
    });
  }

  var DRIVE_LABEL = {
    connected: ['Drive connected', ''], 'needs-click': ['Reconnect Drive', 'warn'], 'not-connected': ['Connect Drive', 'warn'],
    unsupported: ['Read-only here', 'off'], error: ['Drive unavailable', 'warn']
  };

  function mount(opts) {
    opts = opts || {};
    var doc = global.document, body = doc.body, root = body.dataset.root || './', nav = body.dataset.nav || '';
    var P = global.GVC_PROPS, D = global.GVC_DRIVE;
    var cur = function (k) { return k === nav ? ' aria-current="page"' : ''; };

    var top = doc.createElement('header');
    top.className = 'top';
    top.innerHTML = '<a class="brand" href="' + root + '"><img src="' + root + '../assets/logos/monogram.svg" alt="">GVC Workspace</a>' +
      '<nav class="nav" aria-label="Main"><a href="' + root + '"' + cur('overview') + '>Overview</a><a href="' + root + 'jobs/"' + cur('resell') + '>Resell</a>' +
      '<a href="' + root + 'new-dev/"' + cur('newdev') + '>New Dev</a><a href="' + root + 'match/"' + cur('match') + '>Errors</a>' +
      '<a href="' + root + 'tools/"' + cur('tools') + '>Tools</a></nav>' +
      // the DE and Asana sync pills sit beside the Drive pill, the same bubble, the last sync on hover (Matt, 10-23);
      // ids kept from the footer days
      '<div class="top-r"><span class="top-sync"><span class="pill-ok off" id="wsFootSync" title="DE sync status loading">DE…</span><span class="pill-ok off" id="wsFootAsana" title="Asana sync status loading">Asana…</span></span>' +
      '<button class="pill-ok off" type="button" id="wsDrive">Drive…</button>' +
      '<button class="ibtn" type="button" id="wsSync" title="Sync now: Asana, then DE">' + icon('sync') + '<span class="sr">Sync now: Asana, then DE</span></button>' +
      '<button class="ibtn" type="button" id="wsSearchBtn" title="Search jobs">' + icon('search') + '<span class="sr">Search jobs</span></button>' +
      '<button class="avatar" type="button" id="wsMe" title="Signed in" aria-haspopup="true">·</button></div>';
    body.insertBefore(top, body.firstChild);

    var banner = doc.createElement('div');
    banner.className = 'banner'; banner.hidden = true; banner.setAttribute('role', 'status');
    top.after(banner);

    var foot = doc.createElement('footer');
    foot.className = 'foot';
    foot.innerHTML = '<nav class="foot-links" aria-label="More"><a href="' + root + '../listing-rules/">Listing rules</a><a href="' + root + '#tasks">Tasks</a></nav>' +
      '<span>The GVC Team · Douglas Elliman</span>';
    body.appendChild(foot);

    var shell = { readOnly: true };

    /* ---------- Drive ---------- */
    var pill = doc.getElementById('wsDrive');
    function paintDrive(s) {
      if (opts.noDrive) { shell.readOnly = s !== 'connected'; if (opts.onDrive) opts.onDrive(s); return; }
      var l = DRIVE_LABEL[s] || DRIVE_LABEL.error;
      pill.textContent = l[0]; pill.className = 'pill-ok' + (l[1] ? ' ' + l[1] : '');
      shell.readOnly = s !== 'connected';
      banner.hidden = !shell.readOnly;
      banner.innerHTML = '';
      if (shell.readOnly) {
        var t = doc.createElement('span');
        t.textContent = s === 'unsupported' ? 'Read-only here: this browser can\'t open Drive folders. Facts and the change log still show.'
          : 'Read-only here: Drive isn\'t connected on this device.';
        banner.appendChild(t);
        if (s === 'needs-click' || s === 'not-connected') {
          var b = doc.createElement('button'); b.type = 'button'; b.className = 'b sm';
          b.textContent = s === 'needs-click' ? 'Reconnect Drive' : 'Connect Drive';
          b.addEventListener('click', driveClick); banner.appendChild(b);
        }
      }
      if (opts.onDrive) opts.onDrive(s);
    }
    function refreshDrive() { return (D ? D.state() : Promise.resolve('unsupported')).then(function (s) { paintDrive(s); return s; }); }
    function driveClick() {
      if (!D) return;
      D.state().then(function (s) {
        if (s === 'needs-click') return D.reconnect();
        if (s === 'not-connected' || s === 'error') return D.connect();
      }).catch(function () { /* picker closed */ }).then(refreshDrive);
    }
    pill.addEventListener('click', driveClick);
    // pages that never need Drive (Match, Status): no pill, no read-only banner
    if (opts.noDrive) { pill.style.display = 'none'; banner.style.display = 'none'; }
    shell.driveState = refreshDrive;
    refreshDrive();

    /* ---------- sync now ---------- */
    var syncBtn = doc.getElementById('wsSync'), syncText = 'DE sync status loading';
    // no helper can run where Drive can't (phones, Safari): don't even ask
    (D && D.supported() ? helper('GET', '/health') : Promise.reject(new Error('no helper here'))).then(function (h) {
      syncBtn.disabled = false;
      if (!h.paired) syncBtn.title = 'Pair this browser with the helper first (Slice 0 lab page).';
    }, function () {
      syncBtn.disabled = true;
      syncBtn.title = 'The helper isn\'t running on this PC. ' + syncText + '.';
    });
    syncBtn.addEventListener('click', function () {
      if (!global.confirm('This takes approx. 5 minutes, are you sure?')) return;
      syncBtn.disabled = true;
      syncBtn.title = 'Syncing Asana, then DE…';
      helper('POST', '/sync').then(function (r) {
        syncBtn.title = shell.lastSync = syncWords(r);
        if (opts.onSynced) opts.onSynced(r);
      }, function (e) { syncBtn.title = e.message; }).then(function () { syncBtn.disabled = false; });
    });
    shell.setSync = function (h) {
      syncText = h.text;
      if (!syncBtn.disabled && !shell.lastSync) syncBtn.title = 'Sync now: Asana, then DE. ' + h.text;   // a sync's result stays readable
      paintSync(doc.getElementById('wsFootSync'), 'DE', h);
    };
    shell.setAsana = function (h) { paintSync(doc.getElementById('wsFootAsana'), 'Asana', h); };
    /* a short label in the pill, the whole line (when it last ran, or why not) on hover */
    var SYNC_LABEL = { ok: [' synced', ''], amber: [' sync late', 'warn'], red: [' sync failed', 'warn'], never: [' not synced', 'off'] };
    function paintSync(el, src, h) {
      el.hidden = !h.text;
      var l = SYNC_LABEL[h.state] || SYNC_LABEL.never;
      el.textContent = src + l[0];
      el.className = 'pill-ok' + (l[1] ? ' ' + l[1] : '');
      el.title = h.text + (h.why ? '. ' + h.why : '');
    }

    /* ---------- search: its own dropdown on every page (Matt, 10-28) ---------- */
    var searchRows = null;
    function loadSearchRows() {
      if (searchRows) return searchRows;
      if (!P || !P.signedIn()) return Promise.resolve([]);
      var ask = function (path) { return P.call('/rest/v1' + path).then(function (r) { return r || []; }, function () { return []; }); };
      searchRows = Promise.all([
        ask('/properties?select=slug,label,kind,market,stage,core&stage=not.is.null'),
        ask('/pitches?select=slug,label,market,outcome'),
        ask('/dev_projects?select=slug,label,market')
      ]).then(function (r) {
        var out = [];
        r[0].forEach(function (x) { var c = x.core || {}; out.push({ name: x.label || c.address || 'Untitled listing', meta: [x.market, x.kind === 'rental' ? 'Rental' : '', x.stage], href: 'job/?listing=' + encodeURIComponent(x.slug), hay: [x.label, c.address, c.unit, c.city, c.town, x.market, x.stage].join(' ') }); });
        r[1].forEach(function (x) { out.push({ name: x.label || 'Pitch', meta: [x.market, 'Pitch'], href: 'job/?pitch=' + encodeURIComponent(x.slug), hay: [x.label, x.market, 'pitch'].join(' ') }); });
        r[2].forEach(function (x) { out.push({ name: x.label || 'Development', meta: [x.market, 'Development'], href: 'job/?dev=' + encodeURIComponent(x.slug), hay: [x.label, x.market, 'development'].join(' ') }); });
        out.forEach(function (o) { o.hay = o.hay.toLowerCase(); });
        return out;
      });
      return searchRows;
    }
    function closeSearch(refocus) {
      var old = doc.getElementById('wsSearchPop'); if (!old) return;
      old.remove(); doc.removeEventListener('click', onSearchOutside, true); doc.removeEventListener('keydown', onSearchKey);
      if (refocus) doc.getElementById('wsSearchBtn').focus();
    }
    function onSearchOutside(e) { var m = doc.getElementById('wsSearchPop'); if (m && !m.contains(e.target) && !doc.getElementById('wsSearchBtn').contains(e.target)) closeSearch(false); }
    function onSearchKey(e) { if (e.key === 'Escape') closeSearch(true); }
    doc.getElementById('wsSearchBtn').addEventListener('click', function () {
      if (doc.getElementById('wsSearchPop')) { closeSearch(false); return; }
      closeMenu(false);
      var pop = doc.createElement('div'); pop.className = 'sbox'; pop.id = 'wsSearchPop';
      pop.innerHTML = '<input type="search" id="wsSearchGlobal" placeholder="Search any job: address, unit, town" autocomplete="off" aria-label="Search any job"><div class="sres" id="wsSearchRes" role="listbox"></div>';
      top.appendChild(pop);
      var input = doc.getElementById('wsSearchGlobal'), res = doc.getElementById('wsSearchRes'), shown = [], active = 0;
      function paint() {
        res.innerHTML = shown.length ? shown.map(function (o, i) {
          return '<a role="option" href="' + esc(root + o.href) + '"' + (i === active ? ' aria-selected="true"' : '') + '><b>' + esc(o.name) + '</b><small>' + esc(o.meta.filter(Boolean).join(' · ')) + '</small></a>';
        }).join('') : '<p>' + (input.value.trim() ? 'No job matches that.' : 'Type an address, unit or town.') + '</p>';
      }
      function run() {
        var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) { shown = []; active = 0; paint(); return; }
        loadSearchRows().then(function (rows) {
          shown = rows.filter(function (o) { return words.every(function (w) { return o.hay.indexOf(w) !== -1; }); }).slice(0, 8);
          active = 0; paint();
        });
      }
      input.addEventListener('input', run);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (shown.length) { active = (active + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length; paint(); }
        } else if (e.key === 'Enter' && shown[active]) { global.location.href = root + shown[active].href; }
      });
      paint(); input.focus(); loadSearchRows();
      doc.addEventListener('keydown', onSearchKey); doc.addEventListener('click', onSearchOutside, true);
    });

    /* coming back to a page (Back button, a restored tab): the browser may hand over the old, frozen copy, so
       re-read it. Only when it really was restored from history, never on a normal load. */
    global.addEventListener('pageshow', function (e) { if (e.persisted) global.location.reload(); });

    /* ---------- who is signed in ---------- */
    var me = doc.getElementById('wsMe');
    function paintMe() {
      if (!P || !P.signedIn()) { me.textContent = '·'; me.title = 'Not signed in'; return; }
      P.whoAmI().then(function (w) { me.textContent = w.initials; me.title = 'Signed in as ' + w.name; shell.me = w; }, function () { me.textContent = '?'; });
    }
    me.setAttribute('aria-haspopup', 'true'); me.setAttribute('aria-expanded', 'false');
    function closeMenu(refocus) {
      var old = doc.getElementById('wsMenu'); if (!old) return;
      old.remove(); me.setAttribute('aria-expanded', 'false');
      doc.removeEventListener('keydown', onKey); doc.removeEventListener('click', onOutside, true);
      if (refocus) me.focus();
    }
    function onKey(e) { if (e.key === 'Escape') closeMenu(true); }
    function onOutside(e) { var m = doc.getElementById('wsMenu'); if (m && !m.contains(e.target) && e.target !== me) closeMenu(false); }
    me.addEventListener('click', function () {
      if (doc.getElementById('wsMenu')) { closeMenu(false); return; }
      var m = doc.createElement('div'); m.className = 'menu'; m.id = 'wsMenu';
      var p = doc.createElement('p'); p.textContent = shell.me ? 'Signed in as ' + shell.me.name : 'Not signed in';
      var b = doc.createElement('button'); b.type = 'button'; b.textContent = P && P.signedIn() ? 'Sign out' : 'Sign in';
      b.addEventListener('click', function () {
        if (P.signedIn()) { P.signOut(); global.location.reload(); }
        else P.askSignIn('Sign in to open the workspace.').then(function (ok) { if (ok) global.location.reload(); });
      });
      m.appendChild(p); m.appendChild(b); top.appendChild(m);
      me.setAttribute('aria-expanded', 'true');
      doc.addEventListener('keydown', onKey); doc.addEventListener('click', onOutside, true);
    });
    shell.paintMe = paintMe;
    paintMe();

    /* the DE sync status for the footer, on every page */
    if (P && P.signedIn() && global.GVC_WS) {
      P.call('/rest/v1/sync_runs?select=kind,started_at,ok,errors&kind=eq.de&order=started_at.desc&limit=1')
        .then(function (rows) { shell.setSync(global.GVC_WS.syncHealth((rows || [])[0] || null, new Date())); },
          function () { shell.setSync({ state: 'never', text: 'DE sync status unknown' }); });
      P.call('/rest/v1/sync_runs?select=kind,started_at,ok,errors&kind=eq.asana&order=started_at.desc&limit=1')
        .then(function (rows) { shell.setAsana(global.GVC_WS.asanaHealth((rows || [])[0] || null, new Date())); },
          function () { shell.setAsana({ state: 'never', text: 'Asana sync status unknown' }); });
    } else { shell.setSync({ state: 'never', text: 'Sign in to see the DE sync' }); shell.setAsana({ state: 'never', text: '' }); }
    return shell;
  }

  /* POST /sync → one plain line; each part is read on its own */
  function part(name, x) {
    if (!x) return name + ' didn\'t answer.';
    if (!x.ok) return name + ' didn\'t sync: ' + String(x.aborted || x.error || 'no reason given').replace(/\.$/, '') + '.';
    var n = +x.changes || 0, made = name === 'Asana' && +x.created ? ', ' + x.created + ' new job' + (+x.created === 1 ? '' : 's') : '';
    return name + ': ' + n + ' change' + (n === 1 ? '' : 's') + made + '.';
  }
  function syncWords(r) {
    r = r || {};
    if (!r.asana && !r.de) return r.error || 'Sync failed.';
    return part('Asana', r.asana) + ' ' + part('DE', r.de);
  }

  /* a signed-in account with no role on the team list reads nothing (row security): say so (tune-up B5) */
  var NOT_ON_TEAM = 'Your account isn\'t on the GVC team list yet. Ask Matt to add you.';
  var CANT_CHECK = 'Couldn\'t check your account just now. Reload the page to try again.';
  function onTeam() {
    return global.GVC_PROPS.whoAmI().then(function (w) {
      if (w && w.checkFailed) return null;
      return !!(w && w.role);
    }, function () { return true; });
  }

  global.GVC_SHELL = { mount: mount, helper: helper, syncWords: syncWords, onTeam: onTeam, NOT_ON_TEAM: NOT_ON_TEAM, CANT_CHECK: CANT_CHECK };
  global.GVC_ICON = icon;
  global.GVC_ESC = esc;
  global.GVC_SYNCB = syncBadges;
  global.GVC_FACES = faces;
})(window);
