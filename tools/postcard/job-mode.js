/* ============================================================
   POSTCARD JOB MODE (workspace v2, Slice 5, spec S5, S6): the card opened
   from a job, /tools/postcard/?listing=<slug>&card=listed|sold. Loaded by
   piece-loader.js only then; GVC_PIECEMODE runs the bar, the facts, Drive and
   saving. Just Listed and Just Sold are two pieces, each with its own record.

   From the job: address, unit, the town (neighbourhood, else city), the price
   (Just Sold: DE's closing price, else the last price), two agents, and two
   photos (the hero, then the next pick). The card's own: headline, message,
   sign-off, back headline, call to action, layout, bleed, the photos' crops.
   This browser's own saved card (standalone use) is never read or written.
   ============================================================ */
(function () {
  'use strict';
  var B = window.__piece, J = window.GVC_PIECEJOB, PM = window.GVC_PIECEMODE;
  var sold = new URLSearchParams(location.search).get('card') === 'sold';
  var TOOL = sold ? 'postcard-sold' : 'postcard-listed';
  var OWN = ['headline', 'message', 'sign', 'backHead', 'cta', 'layout', 'bleed', 'priceLabel'];
  var crops = {}, paths = [];
  var css = document.createElement('style');
  css.textContent = 'body.piece-mode #photoDrop{display:none!important}';
  document.head.appendChild(css);

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  /* the job's agents and the kind of card are the job's: shown, not changed here */
  function lock() {
    var pick = document.getElementById('rosterPick');
    if (pick) {
      var names = (B.state.agents || []).map(function (id) {
        var a = (window.GVC_ROSTER || []).filter(function (x) { return x.id === id; })[0];
        return '<li>' + PM._.esc(a ? a.name : id) + '</li>';
      }).join('');
      pick.innerHTML = '<ol style="margin:0 0 6px;padding-left:18px">' + names + '</ol><p class="note">These are the job\'s agents. Change agents on the job page.</p>';
    }
    Array.prototype.forEach.call(document.querySelectorAll('#kindPick button'), function (b) { b.disabled = true; });
    ['#fAddress', '#fUnit'].forEach(function (sel) { var el = document.querySelector(sel); if (el) el.readOnly = true; });
  }

  PM.start({
    tool: TOOL, label: sold ? 'Just Sold postcard' : 'Just Listed postcard', prefix: sold ? 'Just Sold Postcard' : 'Just Listed Postcard',
    owners: ['listing'], panel: '#editor', kitKey: 'postcard',
    ready: function () { return B.ready(); },
    note: function (row) {
      if (row.kind === 'rental') return 'The kit has no postcard for a rental; this prints, but nothing expects it.';
      if (sold && J.FIELDS('postcard-sold', row)[0] !== 'closePrice') return 'DE has no closing price for this job yet, so the card prints the last asking price.';
      return '';
    },
    lay: function (doc, row, prev) {
      var base = B.sanitize({});
      crops = {};
      if (doc) {
        OWN.forEach(function (k) { if (k in doc) base[k] = doc[k]; });
        (Array.isArray(doc.photos) ? doc.photos : []).forEach(function (p) { if (p && p.path) crops[p.path] = { x: p.x, y: p.y }; });
      }
      var f = J.fill(TOOL, base, row, { previous: prev });
      f.state.photos = [];
      B.set(f.state);
      return { redone: f.redone };
    },
    afterLay: lock,
    wants: function (d) { return { photos: J.photosFor(TOOL, d.row, d.editedPaths) || [] }; },
    apply: function (read) {
      var s = clone(B.state);
      paths = read.photos.map(function (p) { return { path: p.path, modified: p.modified || null }; });
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
      OWN.forEach(function (k) { d[k] = s[k]; });
      d.photos = s.photos.map(function (p, i) { return paths[i] ? { path: paths[i].path, name: p.name, x: p.x, y: p.y } : null; }).filter(Boolean);
      // a crop saved for a photo Drive didn't bring in this time is kept
      Object.keys(crops).forEach(function (p) {
        if (!d.photos.some(function (x) { return x.path === p; })) d.photos.push({ path: p, name: p.split('/').pop(), x: crops[p].x, y: crops[p].y });
      });
      return d;
    },
    printable: function () { return clone(B.state); },
    builtCtx: function () { return { photos: paths.slice(0, B.state.photos.length) }; },
    paper: function () { return B.state.bleed === 'trim' ? 'trim' : 'bleed'; }
  });
})();
