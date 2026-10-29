/* ============================================================
   SHOWSHEET JOB MODE (workspace v2, Slice 4, spec §2): the sheet opened
   from a job, /tools/showsheet/?listing=<slug>.

   Loaded only with ?listing= (index.html adds it after the sheet's own
   script, with the shared piece files), so the standalone tool never runs a
   line of this. Since 0017 the sheet runs on the shared piece mode
   (assets/js/piece-mode.js) like every other piece: this file is only the
   sheet's adapter. The bar, the facts block, Drive, saving and Make PDF are
   piece-mode's; the sheet keeps its own rules (GVC_SHEETJOB), element ids
   (#jobBar, #btnSaveSheet…), image intake, crops and floorplan choice.

   Order: blank sheet → the sheet's saved wording, crops and settings
   (documents.state) → the job laid over it (GVC_SHEETJOB.fill) → photos and
   the floorplan read from Drive (or through the helper) → drawn. Address,
   unit, ownership, market and agents belong to the job and are changed on
   the job page.

     GVC_SHEETMODE             the shared GVC_PIECEMODE, plus .floorplan (the plan the job gives)
   ============================================================ */
(function () {
  'use strict';
  var SH = window.__sheet, SJ = window.GVC_SHEETJOB, PM = window.GVC_PIECEMODE;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var MONEY = ['price', 'rent', 'maintenance', 'commonCharges', 'taxesMonthly'];
  var crops = {}, savedPlanFrom = null, fpSrc = null, ph = { front: null, back: null, tray: [] }, lastPlan = '';
  window.GVC_SHEETMODE = PM;
  PM.floorplan = null;   // the plan the job gives { version, render, path, modified }

  var css = document.createElement('style');
  css.textContent =
    'body.piece-mode #docxDrop,body.piece-mode #docxStatus,body.piece-mode #phDrop,body.piece-mode #fp2Drop{display:none!important}' +
    'body.piece-mode:not(.job-plan-drop) #fpDrop{display:none!important}#jobPlanMsg{margin:8px 0 0;font-size:12.5px}';
  document.head.appendChild(css);
  var quick = $('#quickBar');
  if (quick) {
    quick.open = true;
    var sum = quick.querySelector('summary');
    if (sum) sum.textContent = 'Photos and floorplan';
  }

  function esc(s) { return PM._.esc(s); }
  function shownValue(name, v) {
    if (v === null || v === undefined || v === '') return 'none';
    if (Array.isArray(v)) return v.join(', ');
    if (MONEY.indexOf(name) !== -1 && typeof v === 'number') return '$' + Math.round(v).toLocaleString('en-US');
    return String(v);
  }
  function setPlan(t) { lastPlan = t || ''; var m = $('#jobPlanMsg'); if (m) m.textContent = lastPlan; }
  function section(which) {
    if (which === 'residence') return 'The Residence';
    return SH.state.ownership === 'house' ? 'The Property' : 'The Building';
  }

  /* ---------- what the job owns can't be changed on the sheet ---------- */
  window.__afterHydrate = function () {
    if (!PM.row) return;
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
    if (!PM.canEdit) {
      $$('#editor [data-field]').forEach(function (el) { if (el.tagName === 'SELECT') el.disabled = true; else el.readOnly = true; });
      $$('#editor .seg button').forEach(function (b) { b.disabled = true; });
    }
  };

  /* ---------- the floorplan the job gives (S8) ---------- */
  /* the saved crop belonged to the saved plan: when the job now gives another file (a new
     standard Unbranded/ plan, a new version), both plan views start again from the whole plan */
  function resetPlanCrop() {
    var was = savedPlanFrom, now = PM.floorplan;
    if (!was || !was.path || (now && now.path === was.path)) return;
    SH.state.floorplanView = { zoom: 1, x: 50, y: 50 };
    SH.state.floorplan2View = { zoom: 1, x: 50, y: 50 };
    savedPlanFrom = now;   // once: a later read of the same folder keeps the crop made since
  }
  function planNote(plans) {
    document.body.classList.remove('job-plan-drop');
    if (PM.floorplan) { setPlan(''); return; }
    if (!plans.length) { setPlan('No floorplan in the job\'s folder yet. Drop one here for this sheet, or leave it blank.'); document.body.classList.add('job-plan-drop'); return; }
    var newest = plans.slice().sort(function (a, b) { return Date.parse(b.modified || 0) - Date.parse(a.modified || 0); })[0];
    var dir = newest.path.split('/').slice(0, -1).join('\\') + '\\';
    var kind = plans.some(function (f) { return /\.pdf$/i.test(f.name); }) ? 'PDF' : plans.some(function (f) { return /\.ai$/i.test(f.name); }) ? 'Illustrator' : 'files that aren\'t images';
    setPlan('No floorplan image in ' + dir + ' (only ' + kind + '). Export a JPG there, or drop one here for this sheet.');
    document.body.classList.add('job-plan-drop');
  }
  /* where the plan on the sheet came from: the job's, one dropped by hand, or none */
  function planFrom() {
    var s = SH.state;
    if (!s.floorplan) return null;
    return s.floorplan === fpSrc && PM.floorplan ? PM.floorplan : { dropped: true };
  }
  function photoFrom(i) {
    var p = i == null ? null : SH.state.photos[i];
    return p && p.path ? { path: p.path, modified: p.modified || null } : null;
  }

  PM.start({
    tool: 'showsheet', label: 'Showsheet', prefix: 'Showsheet', owners: ['listing'], panel: '#editor', kitKey: 'showsheet', plans: true,
    ids: { bar: 'jobBar', facts: 'jobFacts', msg: 'jobMsg', photoMsg: 'jobPhotoMsg', save: 'btnSaveSheet', pdf: 'btnSavePdf',
      state: 'jobState', banner: 'jobBanner', reconnect: 'jobReconnect', pdfWhy: 'jobPdfWhy' },
    rules: {
      FIELDS: function (row, state) { return SJ.FIELDS(row, (state || SH.state || {}).ownership); },
      value: function (row, n) { return SJ.valueOf(row, n); },
      factEdits: function (state, row) { return SJ.factEdits(state, row); },
      applyEdits: function (row, edits, opts) { return SJ.applyEdits(row, edits, opts); },
      builtFrom: function (state, row, ctx) { return SJ.builtFrom(state, row, ctx); },
      maxAgents: 99   // the sheet prints every confirmed agent; only the "not confirmed" note applies
    },
    labels: { headline: 'Lede (headline)' },
    editedWords: 'Changed on the sheet: yours, saves to the job',
    photoWords: 'Photos and the floorplan',
    bannerNoun: 'sheet',
    factsExtra: '<div id="jobPlanMsg" role="status"></div>',
    afterFacts: function () { setPlan(lastPlan); },
    bannerLines: function (changes, redone) {
      var lines = changes.filter(function (c) { return c.field !== 'interiorFeatures' && c.field !== 'buildingFeatures'; }).map(function (c) {
        return esc(c.label) + ' ' + esc(shownValue(c.field, c.was)) + ' → ' + esc(shownValue(c.field, c.now));
      });
      (redone || []).forEach(function (w) {
        lines.push((w === 'building' ? 'Building features' : 'Interior features') + ' changed on the job; ' + esc(section(w)) + ' was redone from it');
      });
      return lines;
    },
    ready: function () { return !!SH; },
    lay: function (saved, row, prev) {
      SH.LIBRARY.blank();
      crops = {};
      savedPlanFrom = saved && saved.floorplanFrom && typeof saved.floorplanFrom === 'object' ? saved.floorplanFrom : null;
      if (saved) {
        (Array.isArray(saved.photos) ? saved.photos : []).forEach(function (p) { if (p && p.path) crops[p.path] = { fx: p.fx, fy: p.fy }; });
        ['photos', 'heroIndex', 'secondaryIndex', 'secondaryPhoto', 'floorplan', 'floorplan2', 'floorplanFrom'].forEach(function (k) { delete saved[k]; });
      }
      SH.LIBRARY.setDoc(saved);
      var f = SJ.fill(SH.state, row, { previous: prev });
      f.state.photos = []; f.state.heroIndex = 0; f.state.secondaryIndex = null;
      f.state.floorplan = null; f.state.floorplan2 = null;
      f.state.disclaimer = window.GVC_LEGAL.listing(f.state.market);
      SH.state = f.state;
      return { redone: f.redone };
    },
    afterLay: function () { if (window.__afterHydrate) window.__afterHydrate(); },
    // Floorplan/Design/ holds references and run notes, never a plan (not even for the note)
    afterTree: function (plans) {
      var usable = plans.filter(function (f) { return SJ.planPlace(f.path) !== 'design'; });
      PM.floorplan = SJ.pickFloorplan(usable);
      resetPlanCrop();
      planNote(usable);
    },
    staleOpts: function (o) {
      var x = { fileFound: o.fileFound };
      if (o.files) { x.files = o.files; x.editedPaths = o.editedPaths; x.floorplan = PM.floorplan; }
      return x;
    },
    wants: function (d) {
      ph = SJ.photosOf(d.row, d.editedPaths) || { front: null, back: null, tray: [] };
      return { photos: ph.tray.slice(0, 12), plans: PM.floorplan ? [PM.floorplan] : [] };
    },
    photoOf: function (file) { return SH.fileToImage(file).then(function (img) { return { src: SH.reencode(img, 2000, 0.87) }; }); },
    planOf: function (file, path) {
      return SH.fileToImage(file).then(function (img) {
        var y = SJ.planPlace(path) === 'unbranded' ? 0 : SH.floorplanHeaderY(img);   // the standard plan has no title band
        return { src: SH.reencode(img, 2400, 0.9, SH.trimRect(img, y)) };
      });
    },
    apply: function (read) {
      var s = SH.state;
      s.photos = read.photos.map(function (p) {
        var c = crops[p.path] || {};
        return { src: p.src, fx: Number.isFinite(+c.fx) ? +c.fx : 50, fy: Number.isFinite(+c.fy) ? +c.fy : 50, name: p.name, path: p.path, modified: p.modified || null };
      });
      var idx = function (p) { for (var i = 0; i < s.photos.length; i++) if (s.photos[i].path === p) return i; return null; };
      s.heroIndex = idx(ph.front);
      s.secondaryIndex = ph.back ? idx(ph.back) : null;
      var plan = read.plans[0];
      if (plan) { s.floorplan = plan.src; fpSrc = plan.src; }
      SH.renderTray(); SH.syncDropZones(); SH.render();
    },
    /* only what the sheet prints counts: the two photos and the job's plan */
    missing: function (failed) {
      var s = SH.state;
      var printed = [s.heroIndex, s.secondaryIndex].map(function (i) { return i == null ? null : s.photos[i]; }).filter(Boolean).map(function (p) { return p.path; });
      [ph.front, ph.back].forEach(function (want) { if (want && printed.indexOf(want) === -1) printed.push(want); });
      if (PM.floorplan && (!s.floorplan || s.floorplan === fpSrc)) printed.push(PM.floorplan.path);
      return failed.filter(function (f) { return printed.indexOf(f) !== -1; })[0] ||
        (ph.front && !s.photos.some(function (p) { return p.path === ph.front; }) ? ph.front : null);
    },
    state: function () { return SH.state; },
    storable: function () {
      var d = SH.LIBRARY.getDoc();
      // photos by path only; a crop saved earlier for a photo Drive didn't bring in this time is kept
      var all = SH.state.photos || [], keep = [], at = {};
      all.forEach(function (p, i) { if (p && p.path) { at[i] = keep.length; keep.push({ path: p.path, fx: p.fx, fy: p.fy, name: p.name }); } });
      var have = {};
      keep.forEach(function (p) { have[p.path] = true; });
      Object.keys(crops).forEach(function (path) {
        if (!have[path]) keep.push({ path: path, fx: crops[path].fx, fy: crops[path].fy, name: path.split('/').pop() });
      });
      d.photos = keep;
      var ix = function (i) { return i == null || at[i] == null ? null : at[i]; };
      d.heroIndex = ix(SH.state.heroIndex);
      d.secondaryIndex = ix(SH.state.secondaryIndex);
      delete d.secondaryPhoto;
      d.floorplan = null; d.floorplan2 = null;
      d.floorplanFrom = planFrom();
      return d;
    },
    /* the sheet as it prints: the two photos and the plans inline, nothing else in the tray */
    printable: function () {
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
    },
    builtCtx: function () {
      var s = SH.state;
      return { photos: { front: photoFrom(s.heroIndex), back: photoFrom(s.secondaryIndex) }, floorplan: planFrom() };
    },
    paper: function () { return SH.state.paper || 'a5'; }
  });
})();
