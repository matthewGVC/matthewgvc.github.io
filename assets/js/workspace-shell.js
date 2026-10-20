/* ============================================================
   WORKSPACE SHELL — the top bar, banner and footer of every /workspace/ page
   (from the locked mockup's shell.js, now wired to real state).

     <body data-nav="overview|jobs|job" data-root="./ or ../">
     const shell = GVC_SHELL.mount({ onSearch })   after the page's markup
     shell.setSync(health)      health from GVC_WS.syncHealth(); updates the
                                sync button's title and the footer
     shell.driveState()         → Promise<'connected'|'needs-click'|…> (GVC_DRIVE)
     GVC_SHELL.helper(method, path, body) → the desktop helper's JSON, or
                                throws "The helper isn't running on this PC."
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
      '<nav class="nav" aria-label="Main"><a href="' + root + '"' + cur('overview') + '>Overview</a><a href="' + root + 'jobs/"' + cur('jobs') + '>Jobs</a>' +
      '<a href="' + root + '../#tools">Team</a><a href="' + root + '../listing-rules/">Reference</a><a href="' + root + '#tasks">Tasks</a></nav>' +
      '<div class="top-r"><button class="pill-ok off" type="button" id="wsDrive">Drive…</button>' +
      '<button class="ibtn" type="button" id="wsSync" title="Sync now from DE">' + icon('sync') + '<span class="sr">Sync now from DE</span></button>' +
      '<button class="ibtn" type="button" id="wsSearchBtn" title="Search jobs">' + icon('search') + '<span class="sr">Search jobs</span></button>' +
      '<button class="avatar" type="button" id="wsMe" title="Signed in" aria-haspopup="true">·</button></div>';
    body.insertBefore(top, body.firstChild);

    var banner = doc.createElement('div');
    banner.className = 'banner'; banner.hidden = true; banner.setAttribute('role', 'status');
    top.after(banner);

    var foot = doc.createElement('footer');
    foot.className = 'foot';
    foot.innerHTML = '<span class="ok" id="wsFootSync">DE sync status loading</span><span id="wsFootDrive"></span><span>The GVC Team · Douglas Elliman</span>';
    body.appendChild(foot);

    var shell = { readOnly: true };

    /* ---------- Drive ---------- */
    var pill = doc.getElementById('wsDrive');
    function paintDrive(s) {
      var l = DRIVE_LABEL[s] || DRIVE_LABEL.error;
      pill.textContent = l[0]; pill.className = 'pill-ok' + (l[1] ? ' ' + l[1] : '');
      shell.readOnly = s !== 'connected';
      doc.getElementById('wsFootDrive').textContent = s === 'connected' ? 'Drive G:\\Shared drives' : 'Read-only: no Drive here';
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
      syncBtn.disabled = true;
      syncBtn.title = 'Syncing from DE…';
      helper('POST', '/de/sync').then(function (r) {
        syncBtn.title = r.ok ? 'Synced: ' + r.changes + ' change(s), ' + r.created + ' new job(s).' : (r.aborted || r.error || 'Sync failed.');
        if (opts.onSynced) opts.onSynced(r);
      }, function (e) { syncBtn.title = e.message; }).then(function () { syncBtn.disabled = false; });
    });
    shell.setSync = function (h) {
      syncText = h.text;
      if (!syncBtn.disabled) syncBtn.title = 'Sync now from DE · ' + h.text;
      var f = doc.getElementById('wsFootSync');
      f.textContent = h.text;
      f.className = h.state === 'ok' ? 'ok' : '';
    };

    /* ---------- search ---------- */
    doc.getElementById('wsSearchBtn').addEventListener('click', function () {
      var box = doc.getElementById('wsSearch');
      if (box) { box.focus(); return; }
      if (opts.onSearchOpen) opts.onSearchOpen();
    });

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
    } else shell.setSync({ state: 'never', text: 'Sign in to see the DE sync' });
    return shell;
  }

  global.GVC_SHELL = { mount: mount, helper: helper };
  global.GVC_ICON = icon;
  global.GVC_ESC = esc;
})(window);
