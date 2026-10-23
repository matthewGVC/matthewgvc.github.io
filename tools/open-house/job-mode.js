/* ============================================================
   OPEN HOUSE FLYER JOB MODE (workspace v2, Slice 6, spec T2, T3): the flyer
   opened from a job, /tools/open-house/?listing=<slug>. Loaded by
   piece-loader.js only then; GVC_PIECEMODE runs the bar, the facts, Drive
   and saving.

   From the job: address, unit, the town, the price (or rent), beds, baths,
   sq ft, the short description (else the description), two agents, the DE
   listing link for the QR, the market's legal text, DE's upcoming open
   houses, and three photos (the hero, then the picks). The flyer's own: the
   dates once typed (until DE's change), the description's wording, crops.
   This browser's own saved flyer (standalone use) is never read or written.
   ============================================================ */
(function () {
  'use strict';
  var B = window.__piece, J = window.GVC_PIECEJOB, PM = window.GVC_PIECEMODE;
  var OWN = ['dates', 'blurb'];
  var crops = {}, fileOf = {};   // a picture as drawn → its file in the job folder
  var css = document.createElement('style');
  css.textContent = 'body.piece-mode #photoDrop{display:none!important}';
  document.head.appendChild(css);

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function keyOf(name, url) { return String(name) + '|' + String(url); }
  /* the job's agents, address and market are the job's: shown, not changed here */
  function lock() {
    var pick = document.getElementById('rosterPick');
    if (pick) {
      var names = (B.state.agents || []).map(function (id) {
        var a = (window.GVC_ROSTER || []).filter(function (x) { return x.id === id; })[0];
        return '<li>' + PM._.esc(a ? a.name : id) + '</li>';
      }).join('');
      pick.innerHTML = '<ol style="margin:0 0 6px;padding-left:18px">' + names + '</ol><p class="note">These are the job\'s agents. Change agents on the job page.</p>';
    }
    Array.prototype.forEach.call(document.querySelectorAll('#marketPick button'), function (b) { b.disabled = true; });
    ['#fAddress', '#fUnit', '#fLink'].forEach(function (sel) { var el = document.querySelector(sel); if (el) el.readOnly = true; });
  }

  PM.start({
    tool: 'open-house', label: 'Open house flyer', prefix: 'Open House Flyer', owners: ['listing'], panel: '#editor', kitKey: 'openHouse',
    ready: function () { return B.ready(); },
    note: function (row) {
      return J.value('open-house', row, 'openHouses') ? '' : 'DE shows no upcoming open house for this job: the flyer prints "By appointment" unless you type the dates.';
    },
    lay: function (doc, row, prev) {
      var base = B.sanitize({});
      crops = {};
      if (doc) {
        OWN.forEach(function (k) { if (k in doc) base[k] = clone(doc[k]); });
        (Array.isArray(doc.photos) ? doc.photos : []).forEach(function (p) { if (p && p.path) crops[p.path] = { x: p.x, y: p.y }; });
      }
      var f = J.fill('open-house', base, row, { previous: prev });
      f.state.photos = [];
      B.set(f.state);
      return { redone: f.redone };
    },
    afterLay: lock,
    wants: function (d) { return { photos: J.photosFor('open-house', d.row, d.editedPaths) || [] }; },
    apply: function (read) {
      var s = clone(B.state);
      fileOf = {};
      read.photos.forEach(function (p) { fileOf[keyOf(p.name, p.src)] = { path: p.path, modified: p.modified || null }; });
      s.photos = read.photos.map(function (p) {
        var c = crops[p.path] || {};
        return { url: p.src, name: p.name, x: Number.isFinite(+c.x) ? +c.x : 50, y: Number.isFinite(+c.y) ? +c.y : 50, w: p.w || 0 };
      });
      B.set(s);
      lock();
    },
    state: function () { return B.state; },
    storable: function () {
      var s = B.state, d = {};
      OWN.forEach(function (k) { d[k] = clone(s[k]); });
      d.photos = s.photos.map(function (p) { var f = fileOf[keyOf(p.name, p.url)]; return f ? { path: f.path, name: p.name, x: p.x, y: p.y } : null; }).filter(Boolean);
      Object.keys(crops).forEach(function (p) {
        if (!d.photos.some(function (x) { return x.path === p; })) d.photos.push({ path: p, name: p.split('/').pop(), x: crops[p].x, y: crops[p].y });
      });
      return d;
    },
    printable: function () { return clone(B.state); },
    builtCtx: function () { return { photos: B.state.photos.map(function (p) { return fileOf[keyOf(p.name, p.url)] || { path: null, dropped: true }; }) }; },
    paper: function () { return 'letter'; }
  });
})();
