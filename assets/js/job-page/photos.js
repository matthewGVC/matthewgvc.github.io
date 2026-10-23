/* ============================================================
   JOB PAGE: the Photos card (spec §2.4, S17, D46).

     GVC_JP.photos.html(ctx) / wire(host, ctx)

   Sets from what Photos\ holds, with counts: Edited (default; old names
   edits / matt-edits too), Staged, Print, Web, and Raws (a count only, never
   opened). Thumbnails only from JPG / PNG / WebP, read four at a time as
   they scroll into view, shrunk to 400 px and kept for this page visit. A
   file Drive won't serve within the time limit says "Drive hasn't
   downloaded this yet." on its own tile.

   Picks: a hero (star) plus an ordered list (Pick, then ↑ ↓ ×), stored as
   paths inside the job folder ("Photos/Edited/03.jpg") in photo_hero and
   photo_order; Save picks writes both and one change-log line (owner
   only). Nothing picked = every edited photo in name order. A pick whose
   file is gone shows "Missing on Drive" and stays until removed. Without
   Drive here the picks show as names.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var IMG = /\.(jpe?g|png|webp)$/i;
  var SETS = [['edited', 'Edited', /^(edited|edits|matt[- ]edits)$/i], ['staged', 'Staged', /^staged$/i], ['print', 'Print', /^print$/i],
    ['web', 'Web', /^web$/i], ['raw', 'Raws', /^raws?$/i]];
  var LIMIT = 4, WIDTH = 400;

  var draft = null;      // { hero, order, msg } unsaved picks, kept across a redraw
  var setKey = 'edited';
  var thumbs = {};       // path → { url } | { fail }
  var queue = [], queued = {}, inflight = 0;
  var lists = {};        // folder/dir → Promise<entries>
  var missing = {};      // path → true once its folder was read without it
  var ctxNow = null;

  function base(p) { return String(p || '').split('/').pop(); }
  function picks(row) {
    if (draft) return draft;
    return { hero: row.photo_hero || null, order: (row.photo_order || []).slice(), msg: '' };
  }
  function changed(row) {
    if (!draft) return false;
    return (draft.hero || null) !== (row.photo_hero || null) || JSON.stringify(draft.order) !== JSON.stringify(row.photo_order || []);
  }

  /* ---------- Drive reads ---------- */
  function listing(ctx, dir) {
    var key = ctx.row.drive_folder + '|' + dir;
    if (!lists[key]) {
      lists[key] = JP.drive.timed(global.GVC_DRIVE.listJob(ctx.row.drive_folder, dir, { timeoutMs: JP.drive.ms() })).then(function (xs) {
        return (xs || []).filter(function (e) { return global.GVC_DRIVE_RULES.allowedInJob(dir + '/' + e.name) && !(e.kind !== 'directory' && global.GVC_DRIVE_RULES.isJunk(e.name)); });
      });
      lists[key].catch(function () {});
    }
    return lists[key];
  }

  function shrink(file) {
    return global.createImageBitmap(file).then(function (bmp) {
      var w = Math.min(WIDTH, bmp.width), h = Math.max(1, Math.round(bmp.height * w / bmp.width));
      var c = global.document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      return new Promise(function (res) { c.toBlob(function (b) { res(global.URL.createObjectURL(b || file)); }, 'image/jpeg', 0.82); });
    });
  }
  function paintTile(path) {
    var t = thumbs[path];
    global.document.querySelectorAll('[data-ph]').forEach(function (el) {
      if (el.dataset.ph !== path || !t) return;
      var box = el.querySelector('.pi');
      if (t.url) {
        if (!box.querySelector('img')) { var im = global.document.createElement('img'); im.alt = base(path); im.src = t.url; box.textContent = ''; box.appendChild(im); }
      } else { box.textContent = t.fail; box.classList.add('pfail'); }
    });
  }
  function pump() {
    while (inflight < LIMIT && queue.length) {
      (function (path) {
        inflight++;
        JP.drive.timed(global.GVC_DRIVE.readJobFile(ctxNow.row.drive_folder, path, { timeoutMs: JP.drive.ms() }).then(shrink)).then(function (url) {
          thumbs[path] = { url: url };
        }, function (e) {
          thumbs[path] = { fail: e && e.timeout ? JP.drive.FAIL : 'Can\'t show this photo.' };
        }).then(function () { inflight--; paintTile(path); pump(); });
      })(queue.shift());
    }
  }
  function want(path) {
    if (thumbs[path] || queued[path]) return;
    queued[path] = true; queue.push(path); pump();
  }

  /* ---------- the card ---------- */
  function setsOf(tree) {
    var ph = (tree.children || []).filter(function (c) { return c.kind === 'directory' && !c.skipped && /^photos$/i.test(c.name); })[0];
    if (!ph) return null;
    var out = [];
    SETS.forEach(function (s) {
      var d = (ph.children || []).filter(function (c) { return c.kind === 'directory' && s[2].test(c.name); })[0];
      if (!d) return;
      var files = (d.children || []).filter(function (c) { return c.kind === 'file'; });
      out.push({ key: s[0], label: s[1], path: ph.name + '/' + d.name, count: s[0] === 'raw' ? files.length : files.filter(function (f) { return IMG.test(f.name); }).length });
    });
    return out;
  }

  function tile(path, ctx, p) {
    var esc = ctx.esc, name = base(path), hero = p.hero === path, picked = p.order.indexOf(path) !== -1, t = thumbs[path];
    var inner = t && t.url ? '<img alt="' + esc(name) + '" src="' + esc(t.url) + '">' : t ? esc(t.fail) : '';
    var btns = ctx.canEdit ? '<span class="pb"><button class="b sm' + (hero ? ' primary' : '') + '" type="button" data-hero="' + esc(path) + '" aria-pressed="' + hero + '" aria-label="Make ' + esc(name) + ' the hero">★</button>' +
      '<button class="b sm" type="button" data-pick="' + esc(path) + '" aria-pressed="' + picked + '">' + (picked ? 'Picked' : 'Pick') + '</button></span>' : '';
    return '<div class="pt' + (hero ? ' hero' : '') + '" data-ph="' + esc(path) + '"><div class="pi' + (t && t.fail ? ' pfail' : '') + '">' + inner + '</div><span class="pn">' + esc(name) + '</span>' + btns + '</div>';
  }

  function picksHtml(ctx) {
    var esc = ctx.esc, r = ctx.row, p = picks(r), out = '';
    var miss = function (path) { return missing[path] ? ' <span class="chip stale">Missing on Drive</span>' : ''; };
    out += '<p class="phh">' + (p.hero ? 'Hero: ' + esc(base(p.hero)) + miss(p.hero) : 'No hero picked.') + '</p>';
    if (!p.order.length) out += '<p class="soft" style="font-size:13px">Nothing picked: every piece uses every edited photo in name order.</p>';
    else out += '<ol class="picks">' + p.order.map(function (path, i) {
      return '<li data-pk="' + esc(path) + '"><span class="pn">' + esc(base(path)) + '</span>' + (p.hero === path ? ' <span class="chip made">Hero</span>' : '') + miss(path) +
        (ctx.canEdit ? '<span class="pa"><button class="b sm" type="button" data-up="' + i + '" aria-label="Move ' + esc(base(path)) + ' up"' + (i ? '' : ' disabled') + '>↑</button>' +
          '<button class="b sm" type="button" data-down="' + i + '" aria-label="Move ' + esc(base(path)) + ' down"' + (i < p.order.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button class="b sm" type="button" data-star="' + i + '" aria-label="Make ' + esc(base(path)) + ' the hero">★</button>' +
          '<button class="b sm" type="button" data-drop="' + i + '" aria-label="Remove ' + esc(base(path)) + '">×</button></span>' : '') + '</li>';
    }).join('') + '</ol>';
    if (ctx.canEdit && (changed(r) || (draft && draft.msg))) out += '<div class="fbtn"><button class="b primary sm" type="button" id="phSave"' + (changed(r) ? '' : ' disabled') + '>Save picks</button>' +
      '<button class="b sm" type="button" id="phUndo">Undo</button></div>';
    out += '<p class="fmsg" id="phMsg" role="alert">' + esc((draft && draft.msg) || '') + '</p>';
    return out;
  }

  function html(ctx) {
    var m = JP.drive.mode(ctx), body;
    if (m === 'live' || m === 'checking') body = '<p class="soft" data-reading>' + (m === 'checking' ? 'Checking Drive…' : 'Reading the folder…') + '</p>';
    else if (m === 'scan') {
      var c = ((((ctx.row.scan || {}).health || {}).counts || {}).photos) || {};
      body = JP.drive.scanLine(ctx.row, ctx.esc) + (ctx.row.scan && ctx.row.scan.scannedAt ? '<p class="soft" style="font-size:13px">' + (+c.edited || 0) + ' edited photos in the folder.</p>' : '');
    } else body = '<p class="soft">Link the job\'s Drive folder to see its photos.</p>';
    return '<div class="card" id="photosCard"><div class="card-h"><div><h2>Photos</h2></div></div>' +
      '<div id="phBody">' + body + '</div><div id="phPicks">' + picksHtml(ctx) + '</div></div>';
  }

  function checkMissing(ctx, host) {
    var p = picks(ctx.row), paths = (p.hero ? [p.hero] : []).concat(p.order);
    var dirs = {};
    paths.forEach(function (path) {
      var d = String(path).split('/').slice(0, -1).join('/');
      if (d && global.GVC_DRIVE_RULES.allowedInJob(path)) (dirs[d] = dirs[d] || []).push(path);
    });
    Object.keys(dirs).forEach(function (d) {
      listing(ctx, d).then(function (xs) {
        var names = xs.map(function (x) { return x.name; });
        dirs[d].forEach(function (path) { if (names.indexOf(base(path)) === -1) missing[path] = true; });
      }, function (e) {
        if (e && !e.timeout && /NotFound/.test(e.name || '')) dirs[d].forEach(function (path) { missing[path] = true; });
      }).then(function () { wirePicks(host, ctx); });
    });
  }

  function wirePicks(host, ctx) {
    var box = host.querySelector('#phPicks');
    if (!box) return;
    box.innerHTML = picksHtml(ctx);
    var r = ctx.row;
    var edit = function (fn) {
      var p = picks(r);
      draft = { hero: p.hero, order: p.order.slice(), msg: '' };
      fn(draft);
      wirePicks(host, ctx); markTiles(host, ctx);
    };
    box.querySelectorAll('[data-up]').forEach(function (b) { b.addEventListener('click', function () { edit(function (d) { var i = +b.dataset.up; d.order.splice(i - 1, 0, d.order.splice(i, 1)[0]); }); }); });
    box.querySelectorAll('[data-down]').forEach(function (b) { b.addEventListener('click', function () { edit(function (d) { var i = +b.dataset.down; d.order.splice(i + 1, 0, d.order.splice(i, 1)[0]); }); }); });
    box.querySelectorAll('[data-star]').forEach(function (b) { b.addEventListener('click', function () { edit(function (d) { d.hero = d.order[+b.dataset.star]; }); }); });
    box.querySelectorAll('[data-drop]').forEach(function (b) {
      b.addEventListener('click', function () { edit(function (d) { var gone = d.order.splice(+b.dataset.drop, 1)[0]; if (d.hero === gone) d.hero = null; }); });
    });
    var undo = box.querySelector('#phUndo');
    if (undo) undo.addEventListener('click', function () { draft = null; wirePicks(host, ctx); markTiles(host, ctx); });
    var save = box.querySelector('#phSave');
    if (save) save.addEventListener('click', function () {
      var d = draft, before = { hero: r.photo_hero || null, order: r.photo_order || [] }, after = { hero: d.hero || null, order: d.order.slice() };
      box.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
      box.querySelector('#phMsg').textContent = 'Saving…';
      JP.save('properties', r, { photo_hero: after.hero, photo_order: after.order }, [{ field: 'photo_order', old_value: before, new_value: after }]).then(function () {
        draft = null; return JP.reload();
      }, function (e) {
        if (draft) draft.msg = e.message;
        var m = global.document.getElementById('phMsg');
        if (m) m.textContent = e.message;
        if (!e.conflict) global.document.querySelectorAll('#phPicks button').forEach(function (x) { x.disabled = false; });
      });
    });
  }

  /* the tiles' star and Pick buttons follow the picks */
  function markTiles(host, ctx) {
    var p = picks(ctx.row);
    host.querySelectorAll('[data-ph]').forEach(function (el) {
      var path = el.dataset.ph, hero = p.hero === path, picked = p.order.indexOf(path) !== -1;
      el.classList.toggle('hero', hero);
      var h = el.querySelector('[data-hero]'), k = el.querySelector('[data-pick]');
      if (h) { h.setAttribute('aria-pressed', String(hero)); h.classList.toggle('primary', hero); }
      if (k) { k.setAttribute('aria-pressed', String(picked)); k.textContent = picked ? 'Picked' : 'Pick'; }
    });
  }

  function grid(host, ctx, sets) {
    var body = host.querySelector('#phBody'), esc = ctx.esc;
    if (!sets) { body.innerHTML = '<p class="soft">No Photos folder found.</p>'; return; }
    if (!sets.length) { body.innerHTML = '<p class="soft">The Photos folder has no Edited, Staged, Print or Web folder yet.</p>'; return; }
    if (!sets.some(function (s) { return s.key === setKey; })) setKey = sets.filter(function (s) { return s.key !== 'raw'; }).concat(sets)[0].key;
    var seg = '<div class="phs seg" role="group" aria-label="Photo set">' + sets.map(function (s) {
      return s.key === 'raw' ? '<span class="phraw">Raws<span class="n">' + s.count + '</span></span>'
        : '<button type="button" data-set="' + s.key + '" aria-pressed="' + (s.key === setKey) + '">' + esc(s.label) + '<span class="n">' + s.count + '</span></button>';
    }).join('') + '</div>';
    var cur = sets.filter(function (s) { return s.key === setKey; })[0];
    if (cur.key === 'raw') { body.innerHTML = seg + '<p class="soft">Raws are counted, never opened.</p>'; return; }
    body.innerHTML = seg + '<div class="phg" id="phGrid"><p class="soft" data-reading>Reading the photos…</p></div>';
    body.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', function () { setKey = b.dataset.set; grid(host, ctx, sets); });
    });
    var edited = sets.filter(function (s) { return s.key === 'edited'; })[0];
    Promise.all([listing(ctx, cur.path), cur.key === 'staged' && edited ? listing(ctx, edited.path).catch(function () { return []; }) : Promise.resolve([])]).then(function (xs) {
      var g = host.querySelector('#phGrid');
      if (!g) return;
      var p = picks(ctx.row);
      var files = xs[0].filter(function (e) { return e.kind === 'file' && IMG.test(e.name); });
      if (!files.length) { g.innerHTML = '<p class="soft">No JPG, PNG or WebP photos in this folder.</p>'; return; }
      var originals = {};
      xs[1].forEach(function (e) { if (e.kind === 'file' && IMG.test(e.name)) originals[e.name.replace(/\.[^.]+$/, '').toLowerCase()] = edited.path + '/' + e.name; });
      g.innerHTML = files.map(function (f) {
        var path = cur.path + '/' + f.name, orig = originals[f.name.replace(/\.[^.]+$/, '').toLowerCase()];
        return orig ? '<div class="pair">' + tile(path, ctx, p) + tile(orig, ctx, p) + '</div>' : tile(path, ctx, p);
      }).join('');
      g.querySelectorAll('[data-hero]').forEach(function (b) {
        b.addEventListener('click', function () {
          var q = picks(ctx.row); draft = { hero: q.hero === b.dataset.hero ? null : b.dataset.hero, order: q.order.slice(), msg: '' };
          wirePicks(host, ctx); markTiles(host, ctx);
        });
      });
      g.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () {
          var q = picks(ctx.row), order = q.order.slice(), i = order.indexOf(b.dataset.pick);
          if (i === -1) order.push(b.dataset.pick); else order.splice(i, 1);
          draft = { hero: q.hero, order: order, msg: '' };
          wirePicks(host, ctx); markTiles(host, ctx);
        });
      });
      var tiles = g.querySelectorAll('[data-ph]');
      if (typeof global.IntersectionObserver !== 'function') { tiles.forEach(function (t) { want(t.dataset.ph); }); return; }
      var io = new global.IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); want(e.target.dataset.ph); } });
      }, { rootMargin: '200px' });
      tiles.forEach(function (t) { if (thumbs[t.dataset.ph]) paintTile(t.dataset.ph); else io.observe(t); });
    }, function (e) {
      var g = host.querySelector('#phGrid');
      if (g) g.innerHTML = '<p class="fmsg" role="alert">' + esc(e.timeout ? JP.drive.FAIL : e.message) + '</p>';
    });
  }

  function wire(host, ctx) {
    ctxNow = ctx;
    wirePicks(host, ctx);
    if (JP.drive.mode(ctx) !== 'live') return;
    JP.drive.folder(ctx).then(function (x) {
      grid(host, ctx, setsOf(x.tree));
      checkMissing(ctx, host);
    }, function (e) {
      var b = host.querySelector('#phBody');
      if (b) b.innerHTML = '<p class="fmsg" role="alert">' + ctx.esc(e.timeout ? JP.drive.FAIL : e.message) + '</p>';
    });
  }

  JP.photos = { html: html, wire: wire };
})(window);
