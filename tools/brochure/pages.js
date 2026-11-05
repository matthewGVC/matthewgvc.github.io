/* ============================================================
   tools/brochure/pages.js: the page plan and one renderer per page
   (cover, gallery, info, floorplan, agent), with the gallery's own drags
   (resizing rows and cells, swapping, cropping). Third of the seven
   scripts (see state.js).
   ============================================================ */
'use strict';

function pagePlan() {
  const plan = [{ t: 'cover', title: 'Cover' }];
  const gp = galPages();
  gp.forEach((_, i) => plan.push({
    t: 'gallery', gi: i,
    title: 'The Property in Pictures' + (gp.length > 1 ? ' \u2014 ' + (i + 1) + ' of ' + gp.length : '')
  }));
  plan.push({ t: 'info', title: 'The Property' });
  /* No floor plans uploaded means no Floor Plans page, not an empty one. */
  const fpPages = Math.ceil(state.floorplans.length / 2);
  for (let i = 0; i < fpPages; i++) {
    plan.push({ t: 'floorplan', from: i * 2, page: i + 1, of: fpPages,
                title: 'Floor Plans' + (fpPages > 1 ? ' \u2014 ' + (i + 1) + ' of ' + fpPages : '') });
  }
  plan.push({ t: 'agent', title: 'Thank You' });
  return plan;
}

/* ---------------- renderers ---------------- */
/* Cover — a full-bleed photo with the type over it, this deck's own design
   now that the two packages front with the framed cover instead. One agent
   block per side; an absent agent still renders an empty flex:1 side so
   the centre monogram never drifts off centre. */
/* The cover names each number rather than printing it bare. A reader looking
   at a phone number on a front page has no other way to tell a desk line from
   a mobile, and unlike the closing card there is no second number beside it to
   imply which is which. Returns escaped, ready-to-join strings. */
function cbNums(a) {
  const o = a.phone && String(a.phone).trim();
  const m = a.mobile && String(a.mobile).trim();
  const out = [];
  if (o) out.push('o: ' + esc(o));
  if (m) out.push('m: ' + esc(m));
  return out;
}

function cbSide(a, side) {
  if (!a) return '<div class="cb-side ' + side + '"></div>';
  return '<div class="cb-side ' + side + '">' +
    '<div class="cb-nm">' + esc(a.name) + '</div>' +
    '<div class="cb-ct">' + cbNums(a).concat(a.email ? [esc(a.email)] : []).join(' &nbsp;·&nbsp; ') + '</div>' +
  '</div>';
}

/* With two agents each side of the bar carries one. With one, the right side
   would otherwise be an empty box facing a filled one, so it takes the agent's
   licence title over the brokerage instead — the bar stays balanced without
   repeating the contact details already sitting on the left. */
function cbBrokerage(a) {
  return '<div class="cb-side r brok">' +
    (a.title ? '<div class="cb-ct">' + esc(a.title) + '</div>' : '') +
    '<div class="cb-ct">Douglas Elliman Real Estate</div>' +
  '</div>';
}

function renderCover(page) {
  const hero = assign.hero, city = cityLine();
  const [a1, a2] = agentObjs();
  page.innerHTML =
    '<div class="cv" data-drop="hero">' +
      (hero ? '<img class="cv-img" src="' + hero.url + '" alt="" style="object-position:' +
                state.coverPos.x + '% ' + state.coverPos.y + '%">'
            : '<div class="empty-note">Drop a cover photo<br>in the Photos panel</div>') +
      '<div class="cv-mask"></div>' +
      '<div class="cv-kind">The GVC Team Presents</div>' +
      '<div class="cv-head">' +
        '<div class="cv-ttl">' + (esc(state.address) || '&nbsp;') + '</div>' +
        (city ? '<div class="cv-sub">' + esc(city) + '</div>' : '') +
        '<div class="cv-for">' + esc(SITE) + '</div>' +
      '</div>' +
      '<div class="cv-bar">' +
        cbSide(a1, 'l') +
        '<img class="cb-mono" src="' + MONO + '" alt="">' +
        (a1 && !a2 ? cbBrokerage(a1) : cbSide(a2, 'r')) +
      '</div>' +
    '</div>';
  const cv = page.querySelector('.cv');
  if (hero) {
    cv.classList.add('has-img');
    cv.addEventListener('pointerdown', e => PD.reframe(e, cv, state.coverPos, REFRAME));
  }
  addSlotGrip(cv, hero, 'Drag to move the cover photo');
}


/* A gallery page. Rows and cells are flexed by their fr values, so the
   printed page is filled exactly; the divider strips and the selection
   chrome are screen-only and drop out of the print stylesheet. */
function renderGallery(page, gi) {
  const pg = galPages()[gi || 0];
  const cells = pg ? cellsOf(pg) : [];
  if (!cells.length) {
    const empty = document.createElement('div');
    empty.className = 'gal-empty';
    empty.dataset.drop = 'gal-add';
    empty.dataset.gi = String(gi || 0);
    empty.innerHTML = '<div class="empty-note">Drag photos here from the Photos panel</div>';
    page.replaceChildren(empty);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'gal';
  wrap.dataset.drop = 'gal-add';
  wrap.dataset.gi = String(gi || 0);

  pg.rows.forEach((row, ri) => {
    const rEl = document.createElement('div');
    rEl.className = 'gal-row';
    rEl.style.flex = (row.h || 1) + ' 1 0';
    rEl.style.position = 'relative';

    row.cells.forEach((c, ci) => {
      const img = state.images.filter(im => im.id === c.id)[0];
      const cell = document.createElement('div');
      cell.className = 'gal-cell' + (c.label ? '' : ' no-cap') +
                       (state.galSel === c.id ? ' is-sel' : '');
      cell.style.flex = (c.w || 1) + ' 1 0';
      cell.dataset.id = c.id;
      cell.dataset.drop = 'cell';        // a photo dropped here swaps in

      if (img) {
        const el = document.createElement('img');
        el.src = img.url; el.alt = ''; el.draggable = false;
        el.style.objectPosition = (c.fx || 50) + '% ' + (c.fy || 50) + '%';
        el.style.setProperty('--z', c.z || 1);
        cell.appendChild(el);
      }

      const cap = document.createElement('div');
      cap.className = 'gal-cap';
      if (!state.galCaptions) cap.style.display = 'none';
      const capT = document.createElement('span');
      capT.className = 'gal-cap-t';
      capT.textContent = c.label || '';
      capT.contentEditable = 'true';
      capT.spellcheck = false;
      capT.addEventListener('pointerdown', ev => ev.stopPropagation());
      capT.addEventListener('input', () => { c.label = capT.textContent.trim(); });
      capT.addEventListener('blur', () => {
        c.label = capT.textContent.trim();
        cell.classList.toggle('no-cap', !c.label);
        renderGalleryPanel();
      });
      capT.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); capT.blur(); }
      });
      cap.appendChild(capT);
      cell.appendChild(cap);

      /* Dragging the photo pans its crop, which is the thing you do most, so
         moving it lives on its own grip rather than behind a held key. */
      PD.grip(cell, {
        onMove: ev => { state.galSel = c.id; beginPhotoDnD(ev, c.id, 'page'); },
        onOff: () => unusePhoto(c.id),
        offTitle: 'Take this photo off the page'
      });

      cell.addEventListener('pointerdown', ev => beginCellPointer(ev, cell, c, wrap));

      if (ci < row.cells.length - 1) {
        const d = document.createElement('div');
        d.className = 'gal-vdiv';
        d.style.right = '0';
        d.style.marginRight = 'calc(-7px - var(--bento-gap) / 2)';
        d.addEventListener('pointerdown', ev => beginFlexDrag(ev, 'x', row.cells, ci, rEl));
        cell.appendChild(d);
      }
      rEl.appendChild(cell);
    });

    if (ri < pg.rows.length - 1) {
      const d = document.createElement('div');
      d.className = 'gal-hdiv';
      d.style.bottom = '0';
      d.style.marginBottom = 'calc(-7px - var(--bento-gap) / 2)';
      d.addEventListener('pointerdown', ev => beginFlexDrag(ev, 'y', pg.rows, ri, wrap));
      rEl.appendChild(d);
    }
    wrap.appendChild(rEl);
  });

  page.replaceChildren(wrap);
}

/* Drag a divider: hand the delta to the pair either side of it, in fr. That
   pair's total is fixed, so the rest of the page holds still. */
function beginFlexDrag(e, axis, list, i, container) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  const key = axis === 'x' ? 'w' : 'h';
  const a = list[i], b = list[i + 1];
  if (!a || !b) return;
  const box = container.getBoundingClientRect();
  const span = axis === 'x' ? box.width : box.height;
  const start = axis === 'x' ? e.clientX : e.clientY;
  const a0 = a[key] || 1, b0 = b[key] || 1, total = a0 + b0;
  const shareTotal = list.reduce((sum, x) => sum + (x[key] || 1), 0);
  const px = (span * (total / shareTotal)) || 1;     // pixels the pair occupies
  const div = e.currentTarget;
  div.classList.add('gal-div-live');

  const move = ev => {
    const d = (((axis === 'x' ? ev.clientX : ev.clientY) - start) / px) * total;
    edited();
    let na = a0 + d, nb = b0 - d;
    if (na < CELL_MIN) { nb -= CELL_MIN - na; na = CELL_MIN; }
    if (nb < CELL_MIN) { na -= CELL_MIN - nb; nb = CELL_MIN; }
    a[key] = Math.round(na * 100) / 100;
    b[key] = Math.round(nb * 100) / 100;
    redraw();
  };
  const finish = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    document.querySelectorAll('.gal-div-live').forEach(x => x.classList.remove('gal-div-live'));
    renderGalleryPanel();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
}

/* Pointer on a cell: select it, then either pan its crop (plain drag, the
   common case) or throw its photo at another cell (Shift-drag). */
function beginCellPointer(e, cellEl, c, wrap) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  state.galSel = c.id;
  wrap.querySelectorAll('.gal-cell').forEach(x => x.classList.remove('is-sel'));
  cellEl.classList.add('is-sel');
  renderGalleryPanel();
  if (e.shiftKey) beginCellSwap(e, cellEl, c, wrap);
  else beginCrop(e, cellEl, c);
}

function beginCellSwap(e, cellEl, c, wrap) {
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY };
  let active = false, target = null;
  const move = ev => {
    if (!active && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
    active = true;
    cellEl.classList.add('is-dragging');
    wrap.querySelectorAll('.gal-cell').forEach(x => x.classList.remove('is-target'));
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const hit = el && el.closest ? el.closest('.gal-cell') : null;
    target = (hit && hit !== cellEl && wrap.contains(hit)) ? hit.dataset.id : null;
    if (target) hit.classList.add('is-target');
  };
  const finish = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    wrap.querySelectorAll('.gal-cell').forEach(x => x.classList.remove('is-dragging', 'is-target'));
    if (active && target) swapCells(c.id, target);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
}

/* Pan the photo inside its frame. object-position p% offsets the overflow by
   -(overflow * p/100); pointer deltas are screen px so they divide by the
   preview scale first. Zoom multiplies the overflow. */
function beginCrop(e, cellEl, c) {
  const img = cellEl.querySelector('img');
  if (!img || !img.naturalWidth) return;
  e.preventDefault();
  const pageEl = cellEl.closest('.page');
  const scale = pageEl ? pageEl.getBoundingClientRect().width / (8.5 * 96) : 1;
  const bw = cellEl.clientWidth, bh = cellEl.clientHeight;
  const cover = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * (c.z || 1);
  const overX = img.naturalWidth * cover - bw, overY = img.naturalHeight * cover - bh;
  const start = { x: e.clientX, y: e.clientY, fx: c.fx || 50, fy: c.fy || 50 };
  let active = false;
  const move = ev => {
    if (!active && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
    active = true;
    edited();
    cellEl.classList.add('is-moving');
    const dx = (ev.clientX - start.x) / scale, dy = (ev.clientY - start.y) / scale;
    if (overX > 1) c.fx = Math.max(0, Math.min(100, start.fx - (dx / overX) * 100));
    if (overY > 1) c.fy = Math.max(0, Math.min(100, start.fy - (dy / overY) * 100));
    img.style.objectPosition = c.fx + '% ' + c.fy + '%';
  };
  const finish = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    cellEl.classList.remove('is-moving');
    if (active) renderGalleryPanel();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
}

function renderInfo(page, n, of) {
  const topPhoto = assign.infoTop;
  const feats = featureLines(state.features);
  const stats = [['Bedrooms', state.beds, 'bed'], ['Bathrooms', state.baths, 'bath'],
                 ['Parking', state.parking, 'car'], ['Sq Ft', state.sqft, 'ruler']];
  /* A typed number is formatted the way every other builder formats one —
     4275000 prints as $4,275,000, not as 4275000. Anything without a digit
     in it ("Price upon request") is a label, and prints as tracked caps. */
  const price = state.price
    ? (/\d/.test(state.price) ? esc(P.money(state.price) || state.price)
       : '<span class="po">' + esc(state.price) + '</span>')
    : '';
  const np = price ? '' : ' no-price';
  /* the QR is drawn from whatever link is typed; a bare domain still has to
     scan as a link, so it gets an https:// in front of it. The printed line
     under the code keeps the address as it was typed. */
  const url = String(state.listingUrl || '').trim();
  const qr = url ? qrSvg(/^[a-z]+:\/\//i.test(url) ? url : 'https://' + url) : '';

  page.innerHTML =
    '<div class="info">' +
      '<div class="info-tr' + (topPhoto ? ' has-img' : '') + '" data-drop="info-top">' +
        (topPhoto ? '<img src="' + topPhoto.url + '" alt="" style="object-position:' +
                      state.infoTopPos.x + '% ' + state.infoTopPos.y + '%">'
                  : '<div class="empty-note">Top banner photo</div>') +
      '</div>' +
      (price ? '<div class="info-price">' + price + '</div>' : '') +
      '<div class="info-block' + np + '">' +
        '<div class="pg-h rev"><h2>The Property</h2></div>' +
        '<div class="info-mid">' +
          '<div class="info-col about"><div class="info-lbl">Overview</div>' +
            '<div class="info-blurb">' + esc(state.blurb) + '</div>' +
          '</div>' +
          '<div class="info-right">' +
          '<div class="info-col features"><div class="info-lbl">Features</div>' +
            '<ul class="info-feats">' + feats.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
          '</div>' +
          '<div class="info-col stats"><div class="info-lbl">The Details</div>' +
            '<div class="info-stats">' +
              stats.map(s => '<div class="stat">' + icon(s[2]) + '<div class="txt">' +
                '<div class="v">' + (esc(s[1]) || '&mdash;') + '</div>' +
                '<div class="k">' + s[0] + '</div></div></div>').join('') +
            '</div>' +
            (qr ? '<div class="info-qr"><div class="box">' + qr + '</div>' +
                    '<div class="cap"><b>Scan for<br>the full listing</b>' +
                      '<span class="url">' + esc(url) + '</span></div></div>'
                : '') +
          '</div>' +
          '</div>' +
        '</div>' +
        pageFoot(n, of, true) +
      '</div>' +
    '</div>';

  const tr = page.querySelector('.info-tr');
  if (topPhoto) tr.addEventListener('pointerdown', e => PD.reframe(e, tr, state.infoTopPos, REFRAME));
  addSlotGrip(tr, topPhoto, 'Drag to move this photo somewhere else');
}

/* The crop transform for one plan. At zoom 1 the plan is letterboxed whole
   inside its frame; above that it is enlarged about the frame centre and
   clipped, and tx/ty pan the enlarged plan — percentages of the plan's own
   un-transformed size, so they survive a re-render at any preview scale. */
function fpTransform(fp) {
  return 'transform:translate(' + (fp.tx || 0) + '%,' + (fp.ty || 0) + '%) scale(' + (fp.zoom || 1) + ')';
}

function renderFloorplan(page, spec, n, of) {
  const slice = state.floorplans.slice(spec.from, spec.from + 2);
  const items = slice.length ? slice : [null];
  page.innerHTML =
    '<div class="fp">' +
      '<div class="pg-h"><h2>Floor Plans</h2></div>' +
      '<div class="pg-body fp-body">' +
        items.map((fp, i) =>
          '<div class="fp-item">' +
            '<div class="fp-frame' + (fp ? ' has-img' : '') + '" data-fp="' + (spec.from + i) + '">' +
              (fp ? '<img src="' + fp.url + '" alt="" style="' + fpTransform(fp) + '">'
                  : '<div class="empty-note on-white">Drop a floor plan<br>in the Floor plans panel</div>') +
            '</div>' +
            (fp ? '<div class="fp-cap"><span>' + esc(fp.label || ('Level ' + (spec.from + i + 1))) +
                  '</span>' + (state.sqft ? '<span class="sub">' + esc(state.sqft.replace(/\s*(sq\.?\s*ft\.?|sf)\s*$/i, '')) + ' sq ft total</span>' : '') +
                  '</div>' : '') +
          '</div>').join('') +
        (state.fpNote ? '<div class="fp-note">' + esc(state.fpNote) + '</div>' : '') +
      '</div>' +
      pageFoot(n, of, false) +
    '</div>';

  // drag inside the frame to pan a zoomed plan
  page.querySelectorAll('.fp-frame.has-img').forEach(box => {
    const fp = state.floorplans[parseInt(box.dataset.fp, 10)];
    if (fp) box.addEventListener('pointerdown', e => beginFpDrag(e, box, fp));
  });
}

/* Where the closing page's QR sends a reader: the team's property page rather
   than the homepage, so a scan lands on the listings. Page 3's QR is separate
   and still points at whatever Listing URL was typed for this property. */
const TEAM_QR_URL = 'https://www.gvcrealestateteam.com/property';

/* The closing page. Every part of it — the lockup, the sign-off, the agent
   rows, the three footer columns and the states — is built by
   Pitch.closingPage() in assets/js/pitch.js, shared with the Buyer Package so
   the two closes are one design. Its styles are the copy of pitch.css's
   EDITORIAL CLOSING PAGE section in the stylesheet above; this deck cannot
   load pitch.css, so the two copies have to be changed together. */
function renderAgent(page, n, of) {
  page.innerHTML = P.closingPage({
    agents: agentObjs(), headshotFor,
    qr: qrSvg(TEAM_QR_URL), qrCap: 'Our properties',
    legal: GVC_LEGAL.block('listing', GVC_LEGAL.marketOf(state)),
    foot: pageFoot(n, of, true)
  });
}


function renderPage(page, i) {
  const plan = pagePlan();
  const spec = plan[i];
  if (!spec) return;
  const n = i + 1, of = plan.length;
  if (spec.t === 'cover')          renderCover(page);
  else if (spec.t === 'gallery')   renderGallery(page, spec.gi);
  else if (spec.t === 'info')      renderInfo(page, n, of);
  else if (spec.t === 'floorplan') renderFloorplan(page, spec, n, of);
  else if (spec.t === 'agent')     renderAgent(page, n, of);
}
