/* ============================================================
   SHOWSHEET JOB MODE (workspace v2, Slice 4, spec §2): the sheet opened
   from a job, /tools/showsheet/?listing=<slug>.

   Loaded only with ?listing= (index.html adds it after the sheet's own
   script), so the standalone tool never runs a line of this. Order:
   blank sheet → the sheet's saved wording, crops and settings
   (documents.state) → the job laid over it (GVC_SHEETJOB.fill) → photos and
   the floorplan read from Drive on this desktop → drawn.

   The property bar is replaced by a job bar (the job, its market, made /
   stale) and "Listing files" by a facts block (each printed fact with its
   badge, other sources and the warning sign). A fact typed on the sheet
   saves to the job as Matt's (S4); the sheet's own wording stays with the
   sheet (S5). Address, unit, ownership, market and agents belong to the job
   and are changed on the job page. Only the owner saves (D87).

     GVC_SHEETMODE.ready       true once the job, the record and Drive are in
     GVC_SHEETMODE.saveSheet() Save sheet (S22)
     GVC_SHEETMODE.savePdf()   Save PDF to Drive (S17–S19)

   window.__sheetTimeoutMs shortens the 20 s Drive wait in tests.
   ============================================================ */
(function () {
  'use strict';
  var SH = window.__sheet, P = window.GVC_PROPS, SJ = window.GVC_SHEETJOB, ST = window.GVC_STALE, F = window.GVC_FACTS;
  var R = window.GVC_DRIVE_RULES;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var q = new URLSearchParams(location.search), slug = q.get('listing') || '', rebuild = q.get('rebuild') === '1';
  var IMG = /\.(jpe?g|png|webp)$/i;
  var CONFLICT = 'This job changed a moment ago. Reloaded; try again.';
  var MONEY = ['price', 'rent', 'maintenance', 'commonCharges', 'taxesMonthly'];
  var MARKET = { NYC: 'New York', NJ: 'New Jersey', FL: 'Florida' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var M = window.GVC_SHEETMODE = {
    ready: false, row: null, doc: null, me: null, canEdit: false,
    drive: null,          // 'connected' | 'needs-click' | … once asked
    files: null,          // { path: { modified } } of the photos and plans Drive listed
    editedPaths: null,    // the edited photos by path, when Drive was read
    fileFound: false,     // a showsheet file sits in the folder
    floorplan: null,      // the plan the job gives { version, render, path, modified }
    fpSrc: null,          // that plan as drawn, to tell it from one dropped by hand
    reading: 0, failed: [], noRebuild: {}, redone: [], busy: false
  };
  var ms = function () { return window.__sheetTimeoutMs || 20000; };
  function timed(p) {
    return Promise.race([p, new Promise(function (_, no) {
      setTimeout(function () { var e = new Error('timeout'); e.timeout = true; no(e); }, ms());
    })]);
  }
  function rest(path) { return P.call('/rest/v1' + path); }
  function rpc(name, body) {
    return P.call('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return Array.isArray(r) ? r[0] : r; });
  }
  function day(v) { var d = new Date(v); return isNaN(d) ? '' : d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function shownValue(name, v) {
    if (v === null || v === undefined || v === '') return 'none';
    if (Array.isArray(v)) return v.join(', ');
    if (MONEY.indexOf(name) !== -1 && typeof v === 'number') return money(v);
    return String(v);
  }

  /* ---------- the panel's own pieces ---------- */
  var css = document.createElement('style');
  css.textContent =
    'body.job-mode #docxDrop,body.job-mode #docxStatus,body.job-mode #phDrop,body.job-mode #fp2Drop{display:none!important}' +
    'body.job-mode:not(.job-plan-drop) #fpDrop{display:none!important}' +
    '#jobBar{padding:14px 20px;border-bottom:1px solid var(--ui-rule);font-size:13.5px;line-height:1.45;color:var(--navy)}' +
    '#jobBar .jb-t{font-weight:700}#jobBar a{color:inherit}#jobBar .jb-s{color:var(--ui-ink-soft);margin-top:2px}' +
    '#jobBar .linkbtn{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}' +
    '#jobBar .jb-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#jobBar .jb-n{margin-top:8px;color:var(--ui-ink-soft)}' +
    '#jobBanner{margin-top:10px;padding:8px 10px;border:1px solid var(--ui-rule);background:#fff}#jobBanner ul{margin:4px 0 0;padding-left:18px}' +
    '#jobMsg{margin:8px 0 0;min-height:1.2em}' +
    '#jobFacts{padding:12px 20px;border-bottom:1px solid var(--ui-rule);font-size:13px}' +
    '#jobFacts h3{margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ui-ink-soft)}' +
    '#jobFacts .jf{padding:5px 0;border-top:1px solid var(--ui-rule)}#jobFacts .jf:first-of-type{border-top:0}' +
    '#jobFacts .jl{display:inline-block;min-width:118px;color:var(--ui-ink-soft)}#jobFacts .jv{font-weight:600;color:var(--navy)}' +
    '#jobFacts .chip{display:inline-block;margin-left:6px;padding:0 6px;border:1px solid var(--ui-rule);border-radius:9px;font-size:11px}' +
    '#jobFacts .jfo,#jobFacts .jfe{color:var(--ui-ink-soft);font-size:12px;margin-top:2px}#jobFacts .jfw{font-size:12px;margin-top:2px;font-weight:600}' +
    '#jobFacts .jfw::before{content:"\\26A0  "}#jobFacts .jfe label{margin-left:8px}' +
    '#jobPhotoMsg,#jobPlanMsg{margin:8px 0 0;font-size:12.5px}';
  document.head.appendChild(css);
  document.body.classList.add('job-mode');
  var quick = $('#quickBar');
  if (quick) {
    quick.open = true;
    var sum = quick.querySelector('summary');
    if (sum) sum.textContent = 'Photos and floorplan';
  }

  function say(t) { var m = $('#jobMsg'); if (m) m.textContent = t || ''; }
  function photoMsg(html) { var m = $('#jobPhotoMsg'); if (m) m.innerHTML = html || ''; }
  function planMsg(t) { var m = $('#jobPlanMsg'); if (m) m.textContent = t || ''; }

  /* ---------- what the job owns can't be changed on the sheet ---------- */
  window.__afterHydrate = function () {
    if (!M.row) return;
    ['address', 'unit'].forEach(function (f) { var el = $('[data-field="' + f + '"]'); if (el) el.readOnly = true; });
    $$('#ownSeg button, #marketSeg button').forEach(function (b) { b.disabled = true; });
    var pick = $('#agentPick');
    if (pick) {
      var names = (SH.state.agentIds || []).map(function (id) {
        var a = (window.GVC_ROSTER || []).filter(function (x) { return x.id === id; })[0];
        return '<li>' + esc(a ? a.name : id) + '</li>';
      }).join('');
      pick.innerHTML = '<ol style="margin:0 0 6px;padding-left:18px">' + names + '</ol><p class="note">These are the job\'s agents. Change agents on the job page.</p>';
    }
    if (!M.canEdit) {
      $$('#editor [data-field]').forEach(function (el) { if (el.tagName === 'SELECT') el.disabled = true; else el.readOnly = true; });
      $$('#editor .seg button').forEach(function (b) { b.disabled = true; });
    }
  };

  /* ---------- the bar ---------- */
  function staleNow() {
    var opts = { fileFound: M.fileFound || !!(((M.row.scan || {}).pieces || {}).showsheet || []).length };
    if (M.files) { opts.files = M.files; opts.editedPaths = M.editedPaths; opts.floorplan = M.floorplan; }
    return ST.stale(M.doc, M.row, opts);
  }
  /* Open · Copy Drive link, for a file the helper wrote (a Drive link only: never a local path) */
  function fileLinks() {
    var out = M.doc && M.doc.output;
    if (!out || out.via !== 'helper' || !/^https:\/\/drive\.google\.com\//.test(String(out.url || ''))) return '';
    return ' · <a data-open href="' + esc(out.url) + '" target="_blank" rel="noopener">Open</a>' +
      ' · <button type="button" class="linkbtn" data-copy>Copy Drive link</button>';
  }
  function stateWords(s) {
    var out = M.doc && M.doc.output;
    if (s.state === 'none') return 'Not made yet';
    if (s.state === 'untracked') return 'Made before the workspace kept track';
    var when = (out && out.madeAt) || M.doc.built_at;
    var made = (new Date(when).toDateString() === new Date().toDateString() ? 'Made today' : 'Made ' + day(when)) + (out && out.paper ? ' · ' + String(out.paper).toUpperCase() : '') +
      (out && out.via === 'print' ? ' · printed by hand, file not tracked' : '');
    return s.state === 'stale' ? 'Stale: ' + ST.words(s.changes) + ' · ' + made : made;
  }
  function section(which) {
    if (which === 'residence') return 'The Residence';
    return SH.state.ownership === 'house' ? 'The Property' : 'The Building';
  }
  function banner(s) {
    if (!rebuild || s.state !== 'stale') return '';
    var lines = s.changes.filter(function (c) { return c.field !== 'interiorFeatures' && c.field !== 'buildingFeatures'; }).map(function (c) {
      return esc(c.label) + ' ' + esc(shownValue(c.field, c.was)) + ' → ' + esc(shownValue(c.field, c.now));
    });
    M.redone.forEach(function (w) {
      lines.push((w === 'building' ? 'Building features' : 'Interior features') + ' changed on the job; ' + section(w) + ' was redone from it');
    });
    return '<div id="jobBanner"><b>Rebuild: what changed since the last sheet</b><ul>' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') +
      '</ul>Check the sheet, then press Save PDF to Drive.</div>';
  }
  function drawBar() {
    var bar = $('#jobBar'), r = M.row, c = r.core || {};
    var s = staleNow(), ag = SJ.agentsOf(r);
    var back = '../../workspace/job/?listing=' + encodeURIComponent(slug);
    var html = '<div class="jb-t">Showsheet for ' + esc(c.address || r.label || slug) + (c.unit ? ' · ' + esc(c.unit) : '') +
      ' · <a data-back href="' + esc(back) + '">← Job page</a></div>' +
      '<div class="jb-s">' + esc(MARKET[r.market] || 'New York') + ' · <span id="jobState">' + esc(stateWords(s)) + '</span>' + fileLinks() + '</div>';
    if (!ag.confirmed) html += '<div class="jb-n">Agents not confirmed on the job: Asana\'s suggestion prints for now. <a href="' + esc(back) + '">Confirm them on the job page</a>.</div>';
    if (M.canEdit) html += '<div class="jb-b"><button type="button" class="btn sm" id="btnSaveSheet">Save sheet</button>' +
      '<button type="button" class="btn sm" id="btnSavePdf">Save PDF to Drive</button></div>';
    else html += '<div class="jb-n">Read only: only the owner account saves this sheet. Print still works.</div>';
    html += banner(s) + '<p id="jobMsg" role="status"></p>';
    var keep = $('#jobMsg') ? $('#jobMsg').textContent : '';
    bar.innerHTML = html;
    bar.hidden = false;
    say(keep);
    var b1 = $('#btnSaveSheet'), b2 = $('#btnSavePdf');
    if (b1) b1.onclick = function () { M.saveSheet(); };
    if (b2) b2.onclick = function () { if (M.savePdf) M.savePdf(); };
    var cp = $('#jobBar [data-copy]');
    if (cp) cp.onclick = function () {
      var url = M.doc && M.doc.output && M.doc.output.url;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard'))).then(function () { say('Drive link copied.'); }, function () { say(url); });
    };
    busy(M.busy);
  }
  function busy(on) {
    M.busy = !!on;
    $$('#btnSaveSheet, #btnSavePdf').forEach(function (b) { b.disabled = M.busy; });
  }

  /* ---------- the facts block ---------- */
  function labelOf(name) {
    var f = F.fieldsFor(M.row).filter(function (x) { return x.name === name; })[0] || F.FIELDS.filter(function (x) { return x.name === name; })[0];
    return name === 'rent' ? 'Rent per month' : name === 'headline' ? 'Lede (headline)' : name === 'city' ? 'Town' : (f ? f.label : name);
  }
  function drawFacts() {
    var host = $('#jobFacts'), r = M.row, core = r.core || {};
    var shown = {};
    F.shown(core, r).forEach(function (x) { shown[x.name] = x; });
    var edits = {};
    SJ.factEdits(SH.state, r).edits.forEach(function (e) { edits[e.field === 'halfBaths' ? 'baths' : e.field] = true; });
    var list = SJ.FIELDS(r, SH.state.ownership).filter(function (n) { return ['halfBaths', 'interiorFeatures', 'buildingFeatures'].indexOf(n) === -1; });
    var rows = list.map(function (n) {
      var x = shown[n] || { value: SJ.valueOf(r, n), badge: SJ.valueOf(r, n) !== null ? 'earlier tool' : null, others: [] };
      var v = n === 'baths' && SJ.valueOf(r, 'halfBaths') > 0 ? String(x.value) + '.5' : shownValue(n, x.value);
      var out = '<div class="jf" data-jf="' + esc(n) + '"><span class="jl">' + esc(labelOf(n)) + '</span><span class="jv">' + esc(x.value === null || x.value === undefined ? 'Not set' : v) + '</span>' +
        (x.badge ? '<span class="chip">' + esc(x.badge) + '</span>' : '');
      if (x.warn) out += '<div class="jfw">' + esc((x.warn.source || 'DE') + ' says ' + shownValue(n, x.warn.value)) + '</div>';
      (x.others || []).forEach(function (o) {
        if (x.warn && o.source === x.warn.source) return;   // already said by the warning
        out += '<div class="jfo">' + esc(o.badge + ' says ' + shownValue(n, o.value)) + '</div>';
      });
      if (edits[n] && M.canEdit) {
        out += '<div class="jfe">Changed on the sheet: yours, saves to the job' +
          '<label><input type="checkbox" data-typo="' + esc(n) + '"' + (M.noRebuild[n] ? ' checked' : '') + '> Typo, no rebuild</label></div>';
      }
      return out + '</div>';
    }).join('');
    var lists = ['interiorFeatures', 'buildingFeatures'].map(function (n) {
      var v = SJ.valueOf(r, n);
      return Array.isArray(v) && v.length ? '<div class="jf" data-jf="' + n + '"><span class="jl">' + esc(labelOf(n)) + '</span><span class="jv">' + v.length + ' on the job</span></div>' : '';
    }).join('');
    host.innerHTML = '<h3>Facts from the job</h3>' + rows + lists +
      '<p class="note">Change a fact in the sections below and it saves to the job when you save. Lists come from the job page.</p>' +
      '<h3 style="margin-top:12px">Photos and floorplan</h3><p class="note">From the job\'s Drive folder. <a href="../../workspace/job/?listing=' +
      encodeURIComponent(slug) + '">Change picks on the job page</a>.</p><div id="jobPhotoMsg" role="status"></div><div id="jobPlanMsg" role="status"></div>';
    host.hidden = false;
    $$('#jobFacts [data-typo]').forEach(function (b) {
      b.addEventListener('change', function () { M.noRebuild[b.dataset.typo] = b.checked; });
    });
    photoNote();
  }
  var lastPhotoHtml = '', lastPlan = '';
  function photoNote() { photoMsg(lastPhotoHtml); planMsg(lastPlan); wireReconnect(); }
  function setPhotoHtml(h) { lastPhotoHtml = h; photoNote(); }
  function setPlan(t) { lastPlan = t; planMsg(t); }

  var redrawTimer = null;
  document.addEventListener('input', function (e) {
    if (!M.row || (e.target.closest && e.target.closest('#jobFacts'))) return;
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(function () { drawFacts(); }, 150);
  });

  function drawAll() { if (!M.row) return; drawBar(); drawFacts(); }

  /* ---------- loading ---------- */
  function lay() {
    SH.LIBRARY.blank();
    var saved = M.doc && M.doc.state && typeof M.doc.state === 'object' ? JSON.parse(JSON.stringify(M.doc.state)) : null;
    var lists = saved && saved.listsFrom && typeof saved.listsFrom === 'object' ? saved.listsFrom : null;
    if (saved) delete saved.listsFrom;
    M.crops = {};
    if (saved) {
      (Array.isArray(saved.photos) ? saved.photos : []).forEach(function (p) { if (p && p.path) M.crops[p.path] = { fx: p.fx, fy: p.fy }; });
      ['photos', 'heroIndex', 'secondaryIndex', 'secondaryPhoto', 'floorplan', 'floorplan2', 'floorplanFrom'].forEach(function (k) { delete saved[k]; });
    }
    SH.LIBRARY.setDoc(saved);
    M.laidVersion = M.row.version;   // the job as the sheet was filled; only the sheet's own saves move it
    M.laidLists = { buildingFeatures: SJ.valueOf(M.row, 'buildingFeatures'), interiorFeatures: SJ.valueOf(M.row, 'interiorFeatures') };
    var f = SJ.fill(SH.state, M.row, { previous: lists ? { facts: lists } : M.doc && M.doc.built_from });
    M.redone = f.redone;
    f.state.photos = []; f.state.heroIndex = 0; f.state.secondaryIndex = null;
    f.state.floorplan = null; f.state.floorplan2 = null;
    f.state.disclaimer = window.GVC_LEGAL.listing(f.state.market);
    SH.state = f.state;
  }

  function load() {
    return rest('/properties?slug=eq.' + encodeURIComponent(slug) + '&select=*').then(function (rows) {
      var row = rows && rows[0];
      if (!row) {
        var bar = $('#jobBar');
        bar.innerHTML = '<div class="jb-t">No job called "' + esc(slug) + '"</div><div class="jb-s">It may have been renamed or never existed. <a href="../../workspace/">Back to the overview</a></div>';
        bar.hidden = false;
        return null;
      }
      return Promise.all([
        rest('/documents?property_id=eq.' + encodeURIComponent(row.id) + '&tool=eq.showsheet&select=*'),
        P.whoAmI().then(null, function () { return { role: null }; })
      ]).then(function (r) {
        M.row = row; M.doc = (r[0] || [])[0] || null; M.me = r[1] || {};
        M.canEdit = M.me.role === 'owner';
        lay();
        drawAll();
        return readDrive();
      });
    });
  }
  function reloadRow() {
    return rest('/properties?id=eq.' + encodeURIComponent(M.row.id) + '&select=*').then(function (rows) {
      if (rows && rows[0]) M.row = rows[0];
      drawAll();
    });
  }
  function reloadDoc() {
    return rest('/documents?property_id=eq.' + encodeURIComponent(M.row.id) + '&tool=eq.showsheet&select=*').then(function (rows) {
      M.doc = (rows || [])[0] || null;
      drawBar();
    });
  }

  /* ---------- Drive: photos and the floorplan (S7, S8) ---------- */
  function wireReconnect() {
    var b = $('#jobReconnect');
    if (b) b.onclick = function () {
      window.GVC_DRIVE.reconnect().then(function () { return readDrive(); }).then(drawAll, function (e) { setPhotoHtml(esc(e.message)); });
    };
  }
  /* M.loading covers the whole read (folder and files); M.driveFailed when it didn't finish */
  function readDrive() {
    M.loading = true; M.driveFailed = false;
    var done = function () { M.loading = false; };
    return readDriveNow().then(done, function (e) { done(); throw e; });
  }
  function readDriveNow() {
    var D = window.GVC_DRIVE, row = M.row;
    if (!row.drive_folder) { setPhotoHtml('This job has no Drive folder linked yet. Link it on the job page to bring in photos and the floorplan.'); return Promise.resolve(); }
    return D.state().then(function (st) {
      M.drive = st;
      if (st === 'unsupported') { setPhotoHtml('This browser can\'t read Drive. Photos and the floorplan come in on the desktop in Chrome.'); return; }
      if (st !== 'connected') {
        setPhotoHtml('Connect Drive on this desktop to bring in photos and the floorplan. <button type="button" class="btn sm ghost" id="jobReconnect">Reconnect</button>');
        return;
      }
      setPhotoHtml('Reading the folder…');
      return timed(D.tree(row.drive_folder, { timeoutMs: ms() })).then(function (tree) {
        var root = String(row.drive_folder).split('/')[0];
        var h = window.GVC_HEALTH.health(tree, { market: row.market, driveRoot: root, isNew: false });
        var ok = function (f) { return !f.archived && R.allowedInJob(f.path) && !R.isJunk(f.name); };
        var photos = (h.pieces.photos || []).filter(ok).filter(function (f) { return IMG.test(f.name); });
        var plans = (h.pieces.floorplan || []).filter(ok);
        M.fileFound = (h.pieces.showsheet || []).length > 0;
        M.files = {};
        photos.concat(plans).forEach(function (f) { M.files[f.path] = { modified: f.modified }; });
        M.editedPaths = photos.map(function (f) { return f.path; });
        M.floorplan = SJ.pickFloorplan(plans);
        planNote(plans);
        return readFiles(SJ.photosOf(row, M.editedPaths) || { front: null, back: null, tray: [] });
      }, function (e) {
        M.driveFailed = true;
        setPhotoHtml(esc(e.timeout ? 'Drive didn\'t answer in time. Reload to try again.' : e.message));
      });
    }).catch(function (e) {
      M.driveFailed = true;
      // the job and sheet are loaded: a Drive problem is said on the panel, the bar stays
      setPhotoHtml(esc((e && e.message) || 'Drive could not be read.'));
    });
  }
  function planNote(plans) {
    document.body.classList.remove('job-plan-drop');
    if (M.floorplan) { setPlan(''); return; }
    if (!plans.length) { setPlan('No floorplan in the job\'s folder yet. Drop one here for this sheet, or leave it blank.'); document.body.classList.add('job-plan-drop'); return; }
    var newest = plans.slice().sort(function (a, b) { return Date.parse(b.modified || 0) - Date.parse(a.modified || 0); })[0];
    var dir = newest.path.split('/').slice(0, -1).join('\\') + '\\';
    var kind = plans.some(function (f) { return /\.pdf$/i.test(f.name); }) ? 'PDF' : plans.some(function (f) { return /\.ai$/i.test(f.name); }) ? 'Illustrator' : 'files that aren\'t images';
    setPlan('No floorplan image in ' + dir + ' (only ' + kind + '). Export a JPG there, or drop one here for this sheet.');
    document.body.classList.add('job-plan-drop');
  }
  function readFile(path) {
    return timed(window.GVC_DRIVE.readJobFile(M.row.drive_folder, path, { timeoutMs: ms() }));
  }
  /* four at a time; each file on its own, so one slow photo never holds the rest */
  function pool(tasks, n) {
    var out = new Array(tasks.length), next = 0;
    function worker() {
      if (next >= tasks.length) return Promise.resolve();
      var i = next++;
      return tasks[i]().then(function (v) { out[i] = { ok: true, v: v }; }, function (e) { out[i] = { ok: false, e: e }; }).then(worker);
    }
    var ws = [];
    for (var k = 0; k < Math.min(n, tasks.length); k++) ws.push(worker());
    return Promise.all(ws).then(function () { return out; });
  }
  function readFiles(ph) {
    var paths = ph.tray.slice(0, 12), plan = M.floorplan;
    var tasks = paths.map(function (p) {
      return function () { return readFile(p).then(SH.fileToImage).then(function (img) { return SH.reencode(img, 2000, 0.87); }); };
    });
    if (plan) tasks.push(function () {
      return readFile(plan.path).then(SH.fileToImage).then(function (img) {
        var y = SH.floorplanHeaderY(img);
        return SH.reencode(img, 2400, 0.9, SH.trimRect(img, y));
      });
    });
    M.reading = tasks.length;
    return pool(tasks, 4).then(function (res) {
      M.reading = 0;
      var s = SH.state, failed = [];
      s.photos = [];
      paths.forEach(function (p, i) {
        if (!res[i].ok) { failed.push(p); return; }
        var crop = M.crops[p] || {};
        s.photos.push({ src: res[i].v, fx: Number.isFinite(+crop.fx) ? +crop.fx : 50, fy: Number.isFinite(+crop.fy) ? +crop.fy : 50,
          name: p.split('/').pop(), path: p, modified: (M.files[p] || {}).modified || null });
      });
      var idx = function (p) { for (var i = 0; i < s.photos.length; i++) if (s.photos[i].path === p) return i; return null; };
      s.heroIndex = idx(ph.front);
      s.secondaryIndex = ph.back ? idx(ph.back) : null;
      if (plan) {
        var pr = res[paths.length];
        if (pr.ok) { s.floorplan = pr.v; M.fpSrc = pr.v; } else failed.push(plan.path);
      }
      M.failed = failed;
      SH.renderTray(); SH.syncDropZones(); SH.render();
      setPhotoHtml(failed.length ? esc('Drive hasn\'t downloaded this yet: ' + failed.map(function (f) { return f.split('/').pop(); }).join(', ') +
        '. Open the folder in File Explorer to download it, then reload.') : '');
    });
  }
  /* where the plan on the sheet came from: the job's, one dropped by hand, or none */
  function planFrom() {
    var s = SH.state;
    if (!s.floorplan) return null;
    return s.floorplan === M.fpSrc && M.floorplan ? M.floorplan : { dropped: true };
  }
  function photoFrom(i) {
    var p = i == null ? null : SH.state.photos[i];
    return p && p.path ? { path: p.path, modified: p.modified || null } : null;
  }

  /* ---------- saving ---------- */
  function storable() {
    var d = SH.LIBRARY.getDoc();
    // photos by path only; a crop saved earlier for a photo Drive didn't bring in this time is kept
    var all = SH.state.photos || [], keep = [], at = {};
    all.forEach(function (p, i) { if (p && p.path) { at[i] = keep.length; keep.push({ path: p.path, fx: p.fx, fy: p.fy, name: p.name }); } });
    var have = {};
    keep.forEach(function (p) { have[p.path] = true; });
    Object.keys(M.crops || {}).forEach(function (path) {
      if (!have[path]) keep.push({ path: path, fx: M.crops[path].fx, fy: M.crops[path].fy, name: path.split('/').pop() });
    });
    d.photos = keep;
    var ix = function (i) { return i == null || at[i] == null ? null : at[i]; };
    d.heroIndex = ix(SH.state.heroIndex);
    d.secondaryIndex = ix(SH.state.secondaryIndex);
    delete d.secondaryPhoto;
    d.floorplan = null; d.floorplan2 = null;
    d.floorplanFrom = planFrom();
    // the job's lists the sheet's Building and Residence wording came from: a draft reopened
    // keeps its own wording until those lists change on the job
    d.listsFrom = M.laidLists;
    return d;
  }
  function saveFacts() {
    var fe = SJ.factEdits(SH.state, M.row);
    if (fe.errors.length) return Promise.reject(new Error(fe.errors[0].error));
    if (!fe.edits.length) return Promise.resolve(M.row);
    var nr = Object.assign({}, M.noRebuild);
    if (nr.baths) nr.halfBaths = true;
    var ap = SJ.applyEdits(M.row, fe.edits, { noRebuild: nr });
    var from = M.row.version;
    return rpc('save_job', { p_table: 'properties', p_id: M.row.id, p_version: M.row.version, p_set: ap.set, p_changes: ap.changes }).then(function (row) {
      if (row && row.id) {
        if (from === M.laidVersion) M.laidVersion = row.version;
        M.row = row;
      }
      M.noRebuild = {};
      return M.row;
    }, function (e) {
      var msg = String((e && e.message) || '');
      if (/conflict/.test(msg)) return reloadRow().then(function () { throw new Error(CONFLICT); }, function () { throw new Error(CONFLICT); });
      if (/not allowed/.test(msg)) throw new Error('Only the owner account can change this job.');
      throw e;
    });
  }
  function savePiece(builtFrom, output, archived) {
    return rpc('save_piece', {
      p_property_id: M.row.id, p_tool: 'showsheet', p_version: M.doc ? M.doc.version : null,
      p_state: storable(), p_built_from: builtFrom || null, p_output: output || null, p_archived: archived || null
    }).then(function (doc) { if (doc) M.doc = doc; return M.doc; }, function (e) {
      if (/conflict/.test(String((e && e.message) || ''))) {
        return reloadDoc().then(function () { throw new Error('This sheet was saved somewhere else a moment ago. Its record is reloaded; press save again.'); });
      }
      throw e;
    });
  }
  M.saveSheet = function () {
    if (!M.canEdit || M.busy) return Promise.resolve(false);
    busy(true); say('Saving…');
    return saveFacts().then(function () { return savePiece(null, null, null); }).then(function () {
      drawAll(); say('Saved. The facts are on the job; the sheet\'s wording and crops are kept with it.'); return true;
    }, function (e) { drawAll(); say(e.message); return false; }).then(function (ok) { busy(false); return ok; });
  };
  /* used by Save PDF to Drive (below the fold of this file's job: Task 8) */
  M._ = { saveFacts: saveFacts, savePiece: savePiece, storable: storable, planFrom: planFrom, photoFrom: photoFrom, drawAll: drawAll, say: say, busy: busy, reloadRow: reloadRow, esc: esc };

  /* ---------- Save PDF to Drive (spec §2.3; the order matters) ---------- */
  var NOT_RECORDED = 'Saved to Drive, but the job didn\'t record it. Press Save PDF to Drive again or reload.';
  function retryMs() { return window.__sheetRetryMs || 1000; }
  function pause(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* what the sheet prints must all be here: a photo or plan Drive hasn't brought in refuses the save */
  function notReady() {
    var s = SH.state, r = M.row;
    if (r.drive_folder && M.drive === 'unsupported') return 'This browser can\'t read Drive. Save the PDF from Chrome on the desktop.';
    if (r.drive_folder && M.drive !== 'connected') return 'Connect Drive on this desktop first, so the sheet has its photos and floorplan.';
    if (r.drive_folder && M.loading) return 'Drive is still reading the job\'s folder; wait a moment.';
    if (r.drive_folder && M.driveFailed) return 'Drive didn\'t finish reading the job\'s folder. Reload to try again.';
    if (M.reading) return 'Drive hasn\'t downloaded the photos yet; wait or reload.';
    var printed = [s.heroIndex, s.secondaryIndex].map(function (i) { return i == null ? null : s.photos[i]; }).filter(Boolean)
      .map(function (p) { return p.path; });
    var ph = SJ.photosOf(r, M.editedPaths) || {};
    [ph.front, ph.back].forEach(function (want) { if (want && printed.indexOf(want) === -1) printed.push(want); });
    if (M.floorplan && (!s.floorplan || s.floorplan === M.fpSrc)) printed.push(M.floorplan.path);
    var miss = (M.failed || []).filter(function (f) { return printed.indexOf(f) !== -1; })[0] ||
      (ph.front && !s.photos.some(function (p) { return p.path === ph.front; }) ? ph.front : null);
    return miss ? 'Drive hasn\'t downloaded ' + miss.split('/').pop() + ' yet; wait or reload.' : null;
  }
  /* the sheet as it prints: the two photos and the plans inline, nothing else in the tray */
  function printable() {
    var s = JSON.parse(JSON.stringify(SH.state)), list = [];
    var slot = function (i) {
      var p = i == null ? null : s.photos[i];
      if (!p || !p.src) return null;
      list.push({ src: p.src, fx: p.fx, fy: p.fy, name: p.name });
      return list.length - 1;
    };
    var hero = slot(s.heroIndex), back = slot(s.secondaryIndex);
    s.photos = list;
    s.heroIndex = hero;
    s.secondaryIndex = back;
    return s;
  }
  function record(bf, output, archived, failMsg) {
    var tries = 0;
    function attempt() {
      tries++;
      return savePiece(bf, output, archived).catch(function () {
        // the save may have landed with its reply lost: read the record before trying again
        var landed = function () {
          var o = M.doc && M.doc.output;
          return !!o && o.name === output.name && o.madeAt === output.madeAt;
        };
        var next = function () {
          if (landed()) return M.doc;
          if (tries >= 3) throw new Error(failMsg || NOT_RECORDED);
          return pause(retryMs()).then(attempt);
        };
        return reloadDoc().then(next, next);
      });
    }
    return attempt();
  }
  function byHand(bf) {
    var c = M.row.core || {}, s = SH.state;
    var name = 'Showsheet - ' + [c.address, c.unit].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g, '-') + ' - ' + today();
    var title = document.title;
    document.title = name;
    try { window.print(); } finally { document.title = title; }
    bf.via = 'print';
    return record(bf, { name: name + '.pdf', paper: s.paper || 'a5', madeAt: new Date().toISOString(), via: 'print' }, null,
      'Printed, but the job didn\'t record it. Press Save PDF to Drive again or reload.').then(function () {
      return 'Printed by hand, file not tracked. Save it into the job\'s showsheet folder yourself.';
    });
  }
  M.savePdf = function () {
    if (!M.canEdit || M.busy) return Promise.resolve(false);
    var why = notReady();
    if (why) { say(why); return Promise.resolve(false); }
    busy(true); say('Saving the facts…');
    return saveFacts().then(function () {
      return reloadRow().then(function () {
        // anything else that moved the job (agents, link, lists, facts) isn't in this sheet: the
        // record must match what prints, so stop rather than print one thing and record another
        if (M.row.version !== M.laidVersion) {
          throw new Error('This job changed somewhere else since the sheet opened. Reload the page to bring the change in, then save.');
        }
      });
    }).then(function () {
      var s = SH.state;
      var bf = SJ.builtFrom(s, M.row, { photos: { front: photoFrom(s.heroIndex), back: photoFrom(s.secondaryIndex) }, floorplan: planFrom(), via: 'helper' });
      say('Making the PDF…');
      var shell = window.GVC_SHELL;
      var ask = shell && shell.helper ? shell.helper('POST', '/piece', { propertyId: M.row.id, tool: 'showsheet', state: printable(), paper: s.paper || 'a5' })
        : Promise.reject(new Error('no helper'));
      return ask.then(function (reply) {
        if (!reply || !reply.ok) throw Object.assign(new Error((reply && reply.error) || 'The helper couldn\'t make the PDF.'), { refused: true });
        var output = { path: reply.path, name: reply.name, size: reply.size, modified: reply.modified, url: reply.url || null,
          paper: s.paper || 'a5', madeAt: new Date().toISOString(), via: 'helper' };
        return record(bf, output, reply.archived || null).then(function () {
          var a = reply.archived;
          return 'Saved to Drive: ' + reply.name + '.' + (a && a.to ? ' The older one is in Archive.' : a && a.why ? ' The ' + a.why + '.' : '');
        });
      }, function (e) {
        if (e && e.refused) throw e;
        return byHand(bf);   // the helper isn't here (S19)
      });
    }).then(function (msg) { drawAll(); say(msg); return true; }, function (e) { drawAll(); say(e.message); return false; })
      .then(function (ok) { busy(false); return ok; });
  };

  /* ---------- start ---------- */
  (P.signedIn() ? Promise.resolve(true) : P.askSignIn('Sign in to open this job\'s showsheet.')).then(function (ok) {
    if (!ok) {
      var bar = $('#jobBar');
      bar.innerHTML = '<div class="jb-t">Sign in to open this job\'s showsheet.</div><div class="jb-s"><a href="">Reload</a> to try again.</div>';
      bar.hidden = false;
      return null;
    }
    return load();
  }).then(function () { if (M.row) drawAll(); }, function (e) {
    var bar = $('#jobBar');
    bar.innerHTML = '<div class="jb-t">The job couldn\'t load</div><div class="jb-s">' + esc(e.message) + '</div>';
    bar.hidden = false;
  }).then(function () { M.ready = true; });
})();
