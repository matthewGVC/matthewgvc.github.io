/* ============================================================
   WORKSPACE JOB LISTS: the Resell tab (listings, rentals, pitches) and the
   New Dev tab (developments). <body data-nav="resell"> or "newdev".
   Needs: property-library.js, roster.js, workspace-data.js, workspace-shell.js.
   ============================================================ */
(function () {
  'use strict';
  var P = window.GVC_PROPS, W = window.GVC_WS, I = window.GVC_ICON, esc = window.GVC_ESC, $ = function (id) { return document.getElementById(id); };
  // one page script, two tabs: Resell (listings, rentals, pitches) and New Dev (developments)
  var DEV = document.body.dataset.nav === 'newdev';
  var mine = function (j) { return DEV ? j.type === 'development' : j.type !== 'development'; };
  var f = { market: '', type: '', q: '' }, data = null, agentsOf = {}, postsBy = {};
  /* column sorting: no column chosen = last activity, newest first */
  var sort = { key: null, dir: 1 };
  var COLS = [['name', 'Job', ''], ['type', 'Type', ''], ['market', 'Market', ''], ['stage', 'Stage', ''], ['price', 'Price', 'r'], ['agents', 'Agents', ''], ['de', 'DE status', 'r']];
  // each listing's or development's social posts from Asana's Social Media project (posted, and how many are coming)
  COLS.splice(6, 0, ['posts', 'Posts', 'r']);
  var TYPE_WORD = { listing: 'Sale', rental: 'Rental', pitch: 'Pitch', development: 'Development' };
  var num = function (s) { var n = Number(String(s || '').replace(/[^0-9.]/g, '')); return s && !isNaN(n) ? n : null; };
  var SORT_BY = {
    name: function (j) { return String(j.name || '').toLowerCase(); },
    type: function (j) { return TYPE_WORD[j.type] || ''; },
    market: function (j) { return j.market || ''; },
    stage: function (j) { var i = (W.STAGES || []).indexOf(j.stage); return i === -1 ? 999 : i; },
    price: function (j) { return num(j.price); },
    agents: function (j) { return (agentsOf[j.id] || []).join(', ').toLowerCase(); },
    de: function (j) { return W.deLabel(j.deStatus) || ''; },
    posts: function (j) { var p = postsBy[j.id]; return p ? p.posted.length : null; }
  };
  function heads() {
    $('heads').innerHTML = COLS.map(function (c) {
      var on = sort.key === c[0], arrow = on ? (sort.dir === 1 ? ' ↑' : ' ↓') : ' ↕';
      return '<th' + (c[2] ? ' class="' + c[2] + '"' : '') + (on ? ' aria-sort="' + (sort.dir === 1 ? 'ascending' : 'descending') + '"' : '') + '>' +
        '<button type="button" class="sortb" data-sort="' + c[0] + '">' + c[1] + '<span class="arr" aria-hidden="true">' + arrow + '</span></button></th>';
    }).join('');
    $('sortedBy').textContent = sort.key ? 'Sorted by ' + COLS.filter(function (c) { return c[0] === sort.key; })[0][1].toLowerCase() : 'Sorted by last activity';
  }
  heads();
  $('heads').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sort]'); if (!b) return;
    var k = b.dataset.sort;
    // a first click sorts A to Z (prices and stages high/late first reads better for money: price starts high to low)
    if (sort.key === k) sort.dir = -sort.dir; else { sort.key = k; sort.dir = k === 'price' ? -1 : 1; }
    heads(); if (data) render();
    var again = $('heads').querySelector('button[data-sort="' + k + '"]'); if (again) again.focus();
  });
  var today = W.today();
  var TYPES = DEV ? [] : [['', 'All'], ['listing', 'Listings'], ['pitch', 'Pitches']];
  $('si').innerHTML = I('search');
  var shell = GVC_SHELL.mount({});

  function rest(path) { return P.call('/rest/v1' + path); }
  function gate(title, text, button) {
    $('board').hidden = true; $('gate').hidden = false;
    $('gate').innerHTML = '<div class="card empty"><b>' + esc(title) + '</b>' + esc(text) + (button ? '<div style="margin-top:14px"><button class="b primary" type="button" id="gateBtn">' + esc(button) + '</button></div>' : '') + '</div>';
  }
  function load() {
    return Promise.all([
      rest('/properties?select=id,slug,label,core,kind,market,stage,stage_source,de,de_status,de_listing_id,drive_folder,folder_state,scan,version&stage=not.is.null'),
      rest('/pitches?select=*'), rest('/dev_projects?select=*'),
      rest('/changes?select=id,property_id,pitch_id,dev_project_id,at,field,old_value,new_value,note,source&order=at.desc&limit=2000'),
      // unreadable (0012 not run yet) means no counts, never a broken list
      rest('/asana_tasks?kind=eq.post&' + (DEV ? 'dev_project_id' : 'property_id') + '=not.is.null&select=property_id,dev_project_id,completed_at,due_on,fields').catch(function () { return []; })
    ]).then(function (r) {
      data = { properties: r[0] || [], pitches: r[1] || [], devProjects: r[2] || [], changes: r[3] || [] };
      var byJob = {};
      (r[4] || []).forEach(function (x) { var id = DEV ? x.dev_project_id : x.property_id; if (id) (byJob[id] = byJob[id] || []).push(x); });
      postsBy = {};
      Object.keys(byJob).forEach(function (id) { postsBy[id] = W.postsOf(byJob[id]); });
      (data.properties).forEach(function (p) {
        agentsOf[p.id] = ((p.core || {}).agentIds || []).map(function (id) { var a = window.GVC_AGENT && GVC_AGENT(id); return a ? a.name : null; }).filter(Boolean);
      });
      $('gate').hidden = true; $('board').hidden = false; render();
    }, function (e) {
      if (e.status === 404 || e.status === 400 || /does not exist|schema cache/i.test(e.message)) gate('The workspace tables aren\'t set up yet', 'Migrations 0004 and 0005 haven\'t been applied to the database yet.');
      else gate('The jobs couldn\'t load', e.message);
    });
  }
  function postsCell(p) {
    if (!p || (!p.posted.length && !p.coming.length)) return '<span class="soft">0</span>';
    return esc(p.posted.length) + (p.coming.length ? '<small>' + esc(p.coming.length) + ' coming</small>' : '');
  }
  function pass(j) {
    var hay = (j.name + ' ' + (j.place || '') + ' ' + (agentsOf[j.id] || []).join(' ')).toLowerCase();
    return (!f.market || j.market === f.market) && (!f.type || j.type === f.type || (f.type === 'listing' && j.type === 'rental')) && (!f.q || hay.indexOf(f.q) !== -1);
  }
  function render() {
    var all = W.buildJobs(data, today).filter(mine);
    // built once, then updated in place so a keyboard user keeps focus on the button they pressed
    if (TYPES.length && !$('typ').children.length) $('typ').innerHTML = TYPES.map(function (t) { return '<button type="button" data-v="' + t[0] + '">' + t[1] + '<span class="n"></span></button>'; }).join('');
    TYPES.forEach(function (t, i) {
      var b = $('typ').children[i];
      b.setAttribute('aria-pressed', f.type === t[0]);
      b.querySelector('.n').textContent = all.filter(function (j) { return !t[0] || j.type === t[0] || (t[0] === 'listing' && j.type === 'rental'); }).length;
    });
    var byLast = function (a, b) { return (b.last || '') > (a.last || '') ? 1 : (b.last || '') < (a.last || '') ? -1 : 0; };
    var js = all.filter(pass).sort(function (a, b) {
      if (!sort.key) return byLast(a, b);
      var x = SORT_BY[sort.key](a), y = SORT_BY[sort.key](b);
      if (x === y || (x == null && y == null)) return byLast(a, b);
      if (x == null || x === '') return 1;   // blanks always last, whichever way
      if (y == null || y === '') return -1;
      return (typeof x === 'string' ? x.localeCompare(y) : (x > y ? 1 : -1)) * sort.dir;
    });
    $('rows').innerHTML = js.length ? js.map(function (j) {
      var pctv = j.steps.length ? Math.max(0, (j.stageIdx + 1) / j.steps.length * 100) : 0;
      var ag = agentsOf[j.id] || [];
      return '<tr><td class="nm"><a href="../' + esc(j.href) + '">' + esc(j.name) + '</a><small>' + esc(j.place || (j.folder ? j.folder.split('/').slice(-2).join(' / ') : 'no folder linked')) + '</small><div class="pj-sync">' + window.GVC_SYNCB(j.sync) + '</div></td>' +
        '<td>' + esc({ listing: 'Sale', rental: 'Rental', pitch: 'Pitch', development: 'Development' }[j.type]) + '</td><td>' + esc(j.market) + '</td>' +
        '<td class="stg"><span class="chip ' + j.chip + '">' + esc(j.stage) + '</span><div class="track"><i class="' + (j.chip === 'contract' ? 'c' : '') + '" style="width:' + pctv + '%"></i></div></td>' +
        '<td class="r price">' + (j.price ? esc(j.price) : '<span class="soft">Not set</span>') + '</td><td>' + ((j.agentIds || []).length ? window.GVC_FACES(j.agentIds) : ag.length ? '<span class="soft">' + esc(ag.join(', ')) + ' (from Asana)</span>' : '<span class="soft">Not set</span>') + '</td>' +
        '<td class="r posts">' + (j.type === 'pitch' ? '' : postsCell(postsBy[j.id])) + '</td>' +
        '<td class="r">' + (W.deLabel(j.deStatus) || (j.type !== 'pitch' && j.type !== 'development') ? '<span class="chip">' + esc(W.deLabel(j.deStatus) || 'not on DE') + '</span>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="' + COLS.length + '" class="empty">' + (all.length ? 'Nothing matches these filters.' : (DEV ? 'No developments yet.' : 'No jobs yet.')) + '</td></tr>';
    $('count').textContent = js.length + ' of ' + all.length + ' jobs';
    var tl = W.taskFlags(all).filter(function (t) { return t.kind !== 'archive'; });
    $('n2').innerHTML = tl.length ? tl.map(function (t) { return '<li><a href="../' + esc(t.href) + '">' + esc(t.job) + '</a><span>' + esc(t.text) + '</span></li>'; }).join('') : '<li class="soft">Everything is linked.</li>';
    var ps = all.filter(function (j) { return j.type === 'pitch'; });
    if ($('n3')) $('n3').innerHTML = ps.length ? ps.map(function (j) { return '<li><a href="../' + esc(j.href) + '">' + esc(j.name) + '</a><span>' + esc(j.pitchedOn ? W.fmtDay(j.pitchedOn) : '') + '</span></li>'; }).join('') : '<li class="soft">No open pitches.</li>';
  }
  if ($('typ')) $('typ').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; f.type = b.dataset.v; render(); });
  $('mkt').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    f.market = b.dataset.v; if (data) render();
  });
  $('wsSearch').addEventListener('input', function () { f.q = this.value.trim().toLowerCase(); if (data) render(); });

  if (P.signedIn()) load();
  else {
    gate('Sign in', 'For the GVC team.', 'Sign in');
    $('gateBtn').addEventListener('click', function () { P.askSignIn('Sign in to open the workspace.').then(function (ok) { if (ok) { shell.paintMe(); load(); } }); });
  }
})();
