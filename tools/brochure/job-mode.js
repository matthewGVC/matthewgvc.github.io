/* ============================================================
   BROCHURE JOB MODE (workspace v2, Slice 5, spec S4): the brochure opened
   from a job, /tools/brochure/?listing=<slug>. Loaded by piece-loader.js
   only then; GVC_PIECEMODE runs the bar, the facts, Drive and saving.

   From the job: address, town / state / zip, price (or rent), beds, baths,
   sq ft, parking, the description, the feature bullets, the listing link,
   two agents; photos (hero first, then the picks in order) and every image
   of the newest floorplan version. The brochure's own: gallery layout and
   captions, photo roles and crops, floorplan labels, zoom and note, paper.
   Photos and plans are kept by their path in the job folder; a saved
   brochure's photo ids are reused for the same path, so its gallery cells
   still find their photos.
   ============================================================ */
(function () {
  'use strict';
  var B = window.__piece, J = window.GVC_PIECEJOB;
  var DOC_KEYS = ['images', 'gallery', 'galCaptions', 'galPage', 'strategy', 'floorplans', 'fpNote', 'coverPos', 'infoTopPos', 'paper'];
  var saved = { images: [], floorplans: [], gallery: [] };
  var pathOf = {};    // brochure image or plan id → { path, modified, version, render }
  var css = document.createElement('style');
  css.textContent = 'body.piece-mode #imgDrop,body.piece-mode #fpDrop{display:none!important}';
  document.head.appendChild(css);

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function byPath(list, p) { return (list || []).filter(function (x) { return x && x.path === p; })[0] || null; }

  /* the job's agents, shown and not changeable here (picked on the job page); the picker
     repaints on every draw, so this runs after each one */
  function lockAgents() {
    var pick = document.getElementById('rosterPick');
    if (!pick) return;
    var names = (B.state.agents || []).map(function (id) {
      var a = (window.GVC_ROSTER || []).filter(function (x) { return x.id === id; })[0];
      return '<li>' + window.GVC_PIECEMODE._.esc(a ? a.name : id) + '</li>';
    }).join('');
    pick.innerHTML = '<ol style="margin:0 0 6px;padding-left:18px">' + names + '</ol><p class="note">These are the job\'s agents. Change agents on the job page.</p>';
  }

  window.GVC_PIECEMODE.start({
    tool: 'brochure', label: 'Brochure', prefix: 'Brochure', owners: ['listing'], panel: '#editor', kitKey: 'brochure', plans: true,
    ready: function () { return B.ready(); },
    lay: function (doc, row, prev) {
      var base = B.blank();
      if (doc) DOC_KEYS.forEach(function (k) { if (k in doc) base[k] = clone(doc[k]); });
      saved.images = Array.isArray(base.images) ? base.images.filter(function (x) { return x && x.path; }) : [];
      saved.floorplans = Array.isArray(base.floorplans) ? base.floorplans.filter(function (x) { return x && x.path; }) : [];
      saved.gallery = Array.isArray(base.gallery) ? base.gallery : [];
      var f = J.fill('brochure', base, row, { previous: prev });
      f.state.images = []; f.state.floorplans = [];
      B.set(f.state);
      return { redone: f.redone };
    },
    afterLay: function () { lockAgents(); },
    wants: function (d) { return { photos: J.photosFor('brochure', d.row, d.editedPaths) || [], plans: d.plans || [] }; },
    apply: function (read) {
      var s = clone(B.state), used = {};
      pathOf = {};
      var idFor = function (prev) {
        var id = prev && Number.isFinite(+prev.id) && !used[prev.id] ? +prev.id : B.nextId();
        used[id] = true;
        return id;
      };
      s.images = read.photos.map(function (p) {
        var prev = byPath(saved.images, p.path), id = idFor(prev);
        pathOf[id] = { path: p.path, modified: p.modified || null };
        return { id: id, name: p.name, url: p.src, ar: p.h ? p.w / p.h : 1.5, role: prev && prev.role ? prev.role : 'auto' };
      });
      s.floorplans = read.plans.map(function (p, i) {
        var prev = byPath(saved.floorplans, p.path), id = idFor(prev);
        pathOf[id] = { path: p.path, modified: p.modified || null, version: p.version, render: p.render };
        return { id: id, name: p.path.split('/').pop(), url: p.src, label: prev && prev.label ? prev.label : 'Level ' + (i + 1),
          zoom: prev ? prev.zoom : 1, tx: prev ? prev.tx : 0, ty: prev ? prev.ty : 0 };
      });
      s.gallery = saved.gallery;
      B.set(s);
      lockAgents();
    },
    state: function () { return B.state; },
    storable: function () {
      var s = B.state, d = {};
      DOC_KEYS.forEach(function (k) { d[k] = clone(s[k]); });
      d.images = s.images.map(function (im) { var p = pathOf[im.id] || {}; return { id: im.id, path: p.path || null, name: im.name, role: im.role, ar: im.ar }; })
        .filter(function (im) { return im.path; });
      // a saved photo Drive didn't bring in this time keeps its place and role
      saved.images.forEach(function (im) { if (!byPath(d.images, im.path)) d.images.push(clone(im)); });
      d.floorplans = s.floorplans.map(function (f) { var p = pathOf[f.id] || {}; return { id: f.id, path: p.path || null, name: f.name, label: f.label, zoom: f.zoom, tx: f.tx, ty: f.ty }; })
        .filter(function (f) { return f.path; });
      return d;
    },
    printable: function () {
      var s = clone(B.state);
      s.images = s.images.filter(function (im) { return im.role !== 'exclude'; });
      return s;
    },
    builtCtx: function () {
      var s = B.state;
      return {
        photos: s.images.filter(function (im) { return im.role !== 'exclude' && pathOf[im.id]; }).map(function (im) { return { path: pathOf[im.id].path, modified: pathOf[im.id].modified }; }),
        plans: s.floorplans.filter(function (f) { return pathOf[f.id]; }).map(function (f) { var p = pathOf[f.id]; return { path: p.path, modified: p.modified, version: p.version, render: p.render }; })
      };
    },
    paper: function () { return B.state.paper || 'letter'; }
  });
})();
