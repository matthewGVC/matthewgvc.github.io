/* ============================================================
   PHOTO DRAG & DROP — one gesture, four builders.

   The whole photo system is one idea: pick a photo up and drop it where it
   should go. The tray is a source, every photo slot on every page is a
   target, and the tray is itself a target — so dragging a photo off a page
   and onto the tray takes it out of the document.

   Slots mark themselves with data-drop as the pages render, so nothing here
   needs to know anything about any tool's page layout. Each builder says
   what its own data-drop values mean:

     GVC_PHOTODND.drag(e, {
       url:      thumbnail for the ghost that follows the pointer
       from:     'tray' or 'page' — only a page drag can end on the tray
       scroller: the element that scrolls the preview
       tray:     the tray element (a target when from === 'page')
       labels:   { 'hero': 'Cover photo', … } shown on each live target
       onDrop:   function (kind, zone) — landed on a [data-drop]
       onOut:    function ()           — landed on the tray
     });

   Paired with assets/css/photo-dnd.css. Written against the tokens.css
   variable names, because the Showsheet loads neither builder.css nor
   pitch.css and this has to look the same in all four.
   ============================================================ */
(function (global) {
  'use strict';

  /* Below this, a pointerdown is a click and not a drag. Small, because the
     grab handles are small. */
  var THRESHOLD = 4;
  /* How close to the edge of the preview the pointer has to get before the
     deck starts scrolling, and how fast it can go. */
  var EDGE = 80, MAX_SPEED = 26;

  var active = null;      // the drag in flight, or null

  /* ---------------- the popup menu ---------------- */

  function closeMenus() {
    var list = document.querySelectorAll('.img-menu');
    for (var i = 0; i < list.length; i++) list[i].remove();
  }

  /* The click path. Dragging covers the common cases; this is how a photo is
     placed with the keyboard, and the only way to say "auto" — which is not a
     place, so it cannot be dragged to. */
  function menu(anchor, options, onPick, current) {
    closeMenus();
    var box = anchor.getBoundingClientRect();
    var m = document.createElement('div');
    m.className = 'img-menu';
    options.forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = opt[1];
      if (current != null && opt[0] === current) b.className = 'on';
      b.addEventListener('click', function () { closeMenus(); onPick(opt[0]); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    m.style.left = Math.min(box.left, global.innerWidth - m.offsetWidth - 10) + 'px';
    m.style.top = Math.min(box.bottom + 5, global.innerHeight - m.offsetHeight - 10) + 'px';
    setTimeout(function () {
      document.addEventListener('pointerdown', function once(ev) {
        if (!m.contains(ev.target)) { closeMenus(); document.removeEventListener('pointerdown', once); }
      });
    }, 0);
    return m;
  }

  /* ---------------- placing a photo ---------------- */

  function drag(e, opts) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    var scroller = opts.scroller || null;
    var tray = opts.tray || null;
    var labels = opts.labels || {};
    var last = { x: e.clientX, y: e.clientY };
    var raf = 0;

    active = { from: opts.from, x: e.clientX, y: e.clientY, on: false, ghost: null, over: null };

    /* What is under the pointer right now, highlighted as the live target. A
       drop can only land on something actually under the pointer, which is
       why this and the auto-scroll below have to agree. */
    function aim() {
      var el = document.elementFromPoint(last.x, last.y);
      var zone = el && el.closest ? el.closest('[data-drop]') : null;
      if (!zone && tray && active.from === 'page' && el && el.closest && el.closest('#' + tray.id)) {
        zone = tray;
      }
      if (zone !== active.over) {
        var lit = document.querySelectorAll('.drop-on');
        for (var i = 0; i < lit.length; i++) lit[i].classList.remove('drop-on');
        if (zone) zone.classList.add('drop-on');
        active.over = zone;
      }
    }

    /* Speed for one axis: nothing until the pointer is inside the edge band,
       then proportional to how far into it it has gone. */
    function speed(pos, lo, hi) {
      if (pos < lo + EDGE) return -MAX_SPEED * Math.min(1, (lo + EDGE - pos) / EDGE);
      if (pos > hi - EDGE) return MAX_SPEED * Math.min(1, (pos - (hi - EDGE)) / EDGE);
      return 0;
    }

    /* The deck is taller than the preview, so the page a photo is headed for
       is usually off-screen when the drag starts. Holding the photo near an
       edge scrolls the preview, the way dragging to the edge of any list
       does — which is what makes moving a photo between pages possible. */
    function scrollTick() {
      if (!active || !active.on || !scroller) { raf = 0; return; }
      var r = scroller.getBoundingClientRect();
      // both axes: the deck is taller than the preview, and at some zooms wider
      var vy = speed(last.y, r.top, r.bottom), vx = speed(last.x, r.left, r.right);
      if (vy || vx) {
        var wasY = scroller.scrollTop, wasX = scroller.scrollLeft;
        scroller.scrollTop += vy; scroller.scrollLeft += vx;
        if (scroller.scrollTop !== wasY || scroller.scrollLeft !== wasX) aim();   // the target moved
      }
      raf = requestAnimationFrame(scrollTick);
    }

    function arm() {
      document.body.classList.add('is-dragging-photo');
      if (!raf && scroller) raf = requestAnimationFrame(scrollTick);
      var g = document.createElement('div');
      g.className = 'drag-ghost';
      var im = document.createElement('img');
      im.src = opts.url; im.alt = '';
      g.appendChild(im);
      document.body.appendChild(g);
      active.ghost = g;
      // label every live target, so the drop is self-explanatory
      var zones = document.querySelectorAll('[data-drop]');
      for (var i = 0; i < zones.length; i++) {
        if (zones[i].querySelector(':scope > .drop-label')) continue;
        var l = document.createElement('div');
        l.className = 'drop-label';
        l.textContent = labels[zones[i].dataset.drop] || 'Drop here';
        zones[i].appendChild(l);
      }
    }

    function clear() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      document.body.classList.remove('is-dragging-photo');
      if (active && active.ghost) active.ghost.remove();
      ['.drop-label', '.drop-on', '.img-row.is-source'].forEach(function (sel) {
        var els = document.querySelectorAll(sel);
        for (var i = 0; i < els.length; i++) {
          if (sel === '.drop-label') els[i].remove();
          else els[i].classList.remove(sel === '.drop-on' ? 'drop-on' : 'is-source');
        }
      });
    }

    function move(ev) {
      if (!active) return;
      if (!active.on) {
        if (Math.hypot(ev.clientX - active.x, ev.clientY - active.y) < THRESHOLD) return;
        active.on = true;
        arm();
      }
      active.ghost.style.left = ev.clientX + 'px';
      active.ghost.style.top = ev.clientY + 'px';
      last = { x: ev.clientX, y: ev.clientY };
      aim();
    }

    function finish() {
      global.removeEventListener('pointermove', move);
      global.removeEventListener('pointerup', finish);
      global.removeEventListener('pointercancel', finish);
      var d = active;
      var zone = d && d.on ? d.over : null;
      clear();
      active = null;
      if (!zone) return;
      if (global.GVC_UNSAVED) GVC_UNSAVED.touch();
      if (tray && zone === tray) { if (opts.onOut) opts.onOut(); return; }
      if (opts.onDrop) opts.onDrop(zone.dataset.drop, zone);
    }

    global.addEventListener('pointermove', move);
    global.addEventListener('pointerup', finish);
    global.addEventListener('pointercancel', finish);
  }

  /* ---------------- reframing a photo inside its crop ----------------

     object-position p% puts the image's overflow at -(overflow * p/100), so
     moving it by d px means changing p by -d/overflow*100. Pointer deltas are
     in screen px, so they are divided by the preview's scale first — and the
     scale needs the design canvas's real width, which is 8.5in for the three
     portrait decks and 11in for the Showsheet. */
  function reframe(e, box, pos, opts) {
    opts = opts || {};
    var img = box.querySelector('img');
    if (!img || !img.naturalWidth) return;
    e.preventDefault();
    var page = box.closest(opts.page || '.pg, .cv, .page, .trim');
    var canvas = (opts.canvasIn || 8.5) * 96;
    var scale = page ? page.getBoundingClientRect().width / canvas : 1;
    var bw = box.clientWidth, bh = box.clientHeight;
    var cover = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
    var overX = img.naturalWidth * cover - bw, overY = img.naturalHeight * cover - bh;
    var start = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    box.classList.add('is-moving');
    try { box.setPointerCapture(e.pointerId); } catch (_) {}

    function move(ev) {
      var dx = (ev.clientX - start.x) / scale, dy = (ev.clientY - start.y) / scale;
      if (overX > 0.5) pos.x = Math.max(0, Math.min(100, start.px - (dx / overX) * 100));
      if (overY > 0.5) pos.y = Math.max(0, Math.min(100, start.py - (dy / overY) * 100));
      if (global.GVC_UNSAVED) GVC_UNSAVED.touch();
      img.style.objectPosition = pos.x + '% ' + pos.y + '%';
      if (opts.onMove) opts.onMove(pos);
    }
    function done(ev) {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', done);
      box.removeEventListener('pointercancel', done);
      try { box.releasePointerCapture(ev.pointerId); } catch (_) {}
      box.classList.remove('is-moving');
      if (opts.onEnd) opts.onEnd(pos);
    }
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', done);
    box.addEventListener('pointercancel', done);
  }

  /* Call once per redraw, on the container holding the freshly-rendered
     pages. Anything carrying data-pos="<key>" gets drag-to-reframe wired
     against posStore[key], created on first touch if missing. */
  function wireReframe(root, posStore, opts) {
    root.querySelectorAll('[data-pos]').forEach(function (box) {
      var key = box.dataset.pos;
      if (!posStore[key]) posStore[key] = { x: 50, y: 50 };
      box.addEventListener('pointerdown', function (e) { reframe(e, box, posStore[key], opts); });
    });
  }

  /* ---------------- the tray ----------------

     One row per photo: a grab handle to drag it out of, its name, a badge
     saying where it currently sits (itself a button, for the click path) and
     a ✕ that deletes the photo outright. */
  function tray(host, items, opts) {
    host.innerHTML = '';
    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'img-row';
      // so a tool can find one row again and refresh its badge in place,
      // rather than rebuilding the whole tray after every redraw
      if (opts.idOf) row.dataset.id = opts.idOf(item);

      var grab = document.createElement('div');
      grab.className = 'img-grab';
      grab.title = opts.grabTitle || 'Drag onto any photo slot in the preview';
      var thumb = document.createElement('img');
      thumb.src = opts.urlOf ? opts.urlOf(item) : item.url;
      thumb.alt = '';
      grab.appendChild(thumb);
      grab.addEventListener('pointerdown', function (e) {
        row.classList.add('is-source');
        opts.onGrab(e, item);
      });

      var mid = document.createElement('div');
      mid.className = 'img-mid';
      var name = document.createElement('div');
      name.className = 'img-name';
      name.textContent = (opts.nameOf ? opts.nameOf(item) : item.name) || 'Photo';
      mid.appendChild(name);

      row.appendChild(grab);
      row.appendChild(mid);

      if (opts.badgeOf) {
        var place = opts.badgeOf(item);
        var badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'img-badge ' + (place.cls || '');
        badge.textContent = place.text;
        badge.title = place.title || 'Click to place this photo';
        badge.addEventListener('click', function () { opts.onBadge(item, badge); });
        row.appendChild(badge);
      }

      if (opts.onRemove) {
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'img-x';
        del.innerHTML = '&#10005;';
        del.title = opts.removeTitle || 'Remove this photo';
        del.addEventListener('click', function () { if (global.GVC_UNSAVED) GVC_UNSAVED.touch(); opts.onRemove(item); });
        row.appendChild(del);
      }

      host.appendChild(row);
    });

    if (opts.note) {
      opts.note.textContent = '';
      if (items.length) {
        opts.note.append(items.length + (items.length === 1 ? ' photo' : ' photos'));
        if (opts.hint) {
          var h = document.createElement('div');
          h.className = 'img-hint';
          h.textContent = opts.hint;
          opts.note.appendChild(h);
        }
      }
    }
  }

  /* Give a placed photo its two controls: a grip to drag it somewhere else,
     and a ✕ to take it off the page. Marking the box .ph-slot is what makes
     them appear on hover — see photo-dnd.css. Used for every slot in every
     tool, so a photo can be moved or removed from wherever it is sitting. */
  function grip(box, opts) {
    if (!box) return;
    box.classList.add('ph-slot');
    var g = document.createElement('div');
    g.className = 'ph-grip';
    g.textContent = '✥';
    g.title = opts.moveTitle || 'Drag to move this photo somewhere else';
    g.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      opts.onMove(ev);
    });
    box.appendChild(g);
    if (opts.onOff) box.appendChild(offPageBtn(opts.onOff, opts.offTitle));
    return g;
  }

  /* The ✕ that takes a photo off the page — the same button on every slot in
     every tool, all doing the one thing: hand the photo back to the tray. */
  function offPageBtn(onOff, title) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ph-kill';
    b.innerHTML = '&#10005;';
    b.title = title || 'Take this photo off the page';
    // the pages are covered in drag handlers, so this must not reach them
    b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    b.addEventListener('click', function (ev) { ev.stopPropagation(); onOff(); });
    return b;
  }

  global.GVC_PHOTODND = {
    THRESHOLD: THRESHOLD,
    drag: drag, reframe: reframe, wireReframe: wireReframe,
    tray: tray, menu: menu, closeMenus: closeMenus,
    grip: grip, offPageBtn: offPageBtn
  };
})(window);
