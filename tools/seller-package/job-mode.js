/* ============================================================
   SELLER PITCH JOB MODE (workspace v2, Slice 5, spec S7 to S14): the deck
   opened from a job, /tools/seller-package/?listing=<slug> or
   ?pitch=<slug>. Loaded by piece-loader.js only then; GVC_PIECEMODE runs
   the bar, the facts, Drive and saving.

   From the job: the subject (address, town / state / zip, beds, baths, sq
   ft, type, year built, taxes, common charges, description, features), the
   comps and the price band (the job's pitch facts: typed here, they save to
   the job), two agents, the market's wording (Florida takes New Jersey's,
   whose legal text is Florida's too). Photos: a listing's hero and picks; a
   pitch's Photos folder. The map: the job's map file (Map Studio's "Save map
   to the job"), else one dropped here by hand for this build. The deck's
   own: client, date, which pages show, videos, reviews, photo roles, crops.
   ============================================================ */
(function () {
  'use strict';
  var B = window.__piece, J = window.GVC_PIECEJOB, PM = window.GVC_PIECEMODE;
  var q = new URLSearchParams(location.search), kind = q.has('pitch') ? 'pitch' : 'listing', slug = q.get(kind) || '';
  var OWN = ['client', 'date', 'showProperty', 'pos', 'videos', 'reviews'];
  var saved = { photos: [] }, pathOf = {}, mapRead = null;
  var css = document.createElement('style');
  css.textContent = 'body.piece-mode #dropPhotos{display:none!important}';
  document.head.appendChild(css);

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function byPath(list, p) { return (list || []).filter(function (x) { return x && x.path === p; })[0] || null; }
  /* the job's agents, shown and not changed here; the picker repaints on every draw */
  function lock() {
    var pick = document.getElementById('rosterPick');
    if (pick) {
      var names = (B.state.agents || []).map(function (id) {
        var a = (window.GVC_ROSTER || []).filter(function (x) { return x.id === id; })[0];
        return '<li>' + PM._.esc(a ? a.name : id) + '</li>';
      }).join('');
      pick.innerHTML = '<ol style="margin:0 0 6px;padding-left:18px">' + names + '</ol><p class="note">These are the ' + kind + '\'s agents. Change them on the ' + kind + ' page.</p>';
    }
    Array.prototype.forEach.call(document.querySelectorAll('#marketPick button'), function (b) { b.disabled = true; });
    var drop = document.getElementById('dropMap');
    if (drop && !document.getElementById('makeMap')) {
      var a = document.createElement('a');
      a.id = 'makeMap'; a.className = 'btn sm'; a.style.marginTop = '14px'; a.style.display = 'inline-block';
      a.href = '../map-studio/?' + kind + '=' + encodeURIComponent(slug);
      a.textContent = 'Make the map';
      drop.parentNode.insertBefore(a, drop);
      var p = document.createElement('p');
      p.className = 'note'; p.id = 'makeMapNote';
      p.textContent = 'Map Studio opens with this ' + kind + '\'s address and comps. Save the map to the ' + kind + ' there; this deck picks it up when you reload. Or drop a map here for this build only.';
      drop.parentNode.insertBefore(p, drop);
    }
  }
  function mapFrom() {
    var m = B.state.map;
    if (!m) return null;
    return mapRead && m.url === mapRead.src ? { path: mapRead.path, modified: mapRead.modified || null } : { dropped: true };
  }

  PM.start({
    tool: 'seller', label: 'Seller pitch', prefix: 'Seller Pitch', owners: ['listing', 'pitch'], panel: '#editor', kitKey: 'pitch', map: true,
    ready: function () { return B.ready(); },
    note: function (row) {
      return row.market === 'FL' ? 'Florida has no seller deck of its own yet: the New Jersey wording prints (its legal text is the same as Florida\'s).' : '';
    },
    lay: function (doc, row, prev) {
      var base = B.sanitize({});
      if (doc) OWN.forEach(function (k) { if (k in doc) base[k] = clone(doc[k]); });
      saved.photos = doc && Array.isArray(doc.photos) ? doc.photos.filter(function (p) { return p && p.path; }) : [];
      var f = J.fill('seller', base, row, { previous: prev });
      f.state.photos = []; f.state.map = null;
      B.set(f.state);
      return { redone: f.redone };
    },
    afterLay: lock,
    wants: function (d) {
      var photos = kind === 'pitch' ? (d.pitchPhotos || []) : (J.photosFor('seller', d.row, d.editedPaths) || []);
      return { photos: photos, map: d.map };
    },
    apply: function (read) {
      if (Object.keys(pathOf).length) saved.photos = this.storable().photos;   // a second read keeps unsaved roles
      var s = clone(B.state), used = {}, reserved = {};
      saved.photos.forEach(function (x) { if (Number.isFinite(+x.id)) reserved[+x.id] = true; });
      pathOf = {};
      var idFor = function (prev) {
        var id = prev && Number.isFinite(+prev.id) && !used[+prev.id] ? +prev.id : null;
        while (id === null || used[id] || (reserved[id] && !(prev && +prev.id === id))) id = B.nextId();
        used[id] = true;
        return id;
      };
      s.photos = read.photos.map(function (p) {
        var prev = byPath(saved.photos, p.path), id = idFor(prev);
        pathOf[id] = { path: p.path, modified: p.modified || null };
        return { id: id, name: p.name, url: p.src, role: prev && prev.role ? prev.role : 'auto' };
      });
      mapRead = read.map || null;
      if (mapRead) s.map = { name: mapRead.path.split('/').pop(), url: mapRead.src };
      B.set(s);
      lock();
    },
    state: function () { return B.state; },
    storable: function () {
      var s = B.state, d = {};
      OWN.forEach(function (k) { d[k] = clone(s[k]); });
      d.photos = s.photos.map(function (p) { var x = pathOf[p.id] || {}; return { id: p.id, path: x.path || null, name: p.name, role: p.role }; })
        .filter(function (p) { return p.path; });
      saved.photos.forEach(function (p) { if (!byPath(d.photos, p.path)) d.photos.push(clone(p)); });
      d.mapFrom = mapFrom();
      return d;
    },
    printable: function () { return clone(B.state); },
    builtCtx: function () {
      return {
        photos: B.state.photos.filter(function (p) { return p.role !== 'exclude' && pathOf[p.id]; }).map(function (p) { return { path: pathOf[p.id].path, modified: pathOf[p.id].modified }; }),
        map: mapFrom()
      };
    },
    paper: function () { return 'letter'; }
  });
})();
