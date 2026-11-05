/* ============================================================
   tools/brochure/photos.js: dragging photos between the tray and the
   pages, the photo and floor-plan lists in the panel, and taking in
   dropped files. Fifth of the seven scripts (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   PHOTO DRAG & DROP

   The whole photo system is one gesture: pick a photo up and drop it where
   it should go. The tray on the left is a source, every photo slot on every
   page is a target, and the tray is itself a target so dragging a photo off
   a page takes it out of the brochure.

   Slots are marked with data-drop as the pages render, so this code does not
   need to know anything about page layout:

     hero          the cover photo
     info-top      page 3, top banner
     cell          one gallery frame  (data-id = the photo in it)
     gal-add       a gallery page's spare space (data-gi = which page)
   ============================================================ */
/* The brochure's design canvas is 8.5in wide and its pages are .page — the
   two decks use .pg/.cv and the Showsheet is 11in, so the shared reframe
   has to be told. */
const REFRAME = { page: '.page', canvasIn: 8.5 };

const DROP_LABEL = {
  'hero': 'Cover photo', 'info-top': 'Top banner',
  'cell': 'Swap in', 'gal-add': 'Add to this page'
};

/* Put a photo in a named single slot, freeing whoever was pinned there. */
/* The single slot a photo is sitting in right now, or '' if it is in the
   gallery, the tray, or nowhere. */
function slotOf(img) {
  if (assign.hero === img) return 'hero';
  if (assign.infoTop === img) return 'info-top';
  return '';
}

function placeInSlot(id, slot) {
  id = Number(id);
  const role = slot === 'hero' ? 'hero' : slot;
  const img = state.images.filter(im => im.id === id)[0];
  if (!img) return;
  const sitting = state.images.filter(im => im !== img &&
    (slot === 'hero' ? assign.hero === im : assign.infoTop === im))[0];
  /* Dropping a gallery photo into a slot swaps the two: whoever was in the
     slot takes the gallery cell that just came free, rather than being
     turned loose to be re-placed wherever the strategy next puts it. */
  const cell = findCell(id);
  state.images.forEach(im => { if (im.role === role && im.id !== id) im.role = 'auto'; });
  if (cell && sitting) {
    cell.cell.id = sitting.id;
    cell.cell.fx = 50; cell.cell.fy = 50; cell.cell.z = 1;
    sitting.role = 'gallery';
  } else {
    removeCell(id);                // it cannot be in the gallery and here at once
  }
  img.role = role;
  redraw(); renderImgList(); renderGalleryPanel();
}

/* Drop onto an existing gallery frame. If the incoming photo is already in
   the gallery the two trade places, which is what the gesture looks like it
   should do; otherwise it takes the frame and the photo it displaces drops
   back to the tray as unused, where it is visible and one click from coming
   back. */
function dropOnCell(id, targetPhotoId) {
  id = Number(id); targetPhotoId = Number(targetPhotoId);
  if (id === targetPhotoId) return;
  const img = state.images.filter(im => im.id === id)[0];
  if (!img) return;
  if (findCell(id)) { swapCells(id, targetPhotoId); return; }
  const hit = findCell(targetPhotoId);
  if (!hit) return;
  const displaced = state.images.filter(im => im.id === targetPhotoId)[0];
  /* Where the dragged photo is coming from decides what happens to the one
     it lands on. Off the cover or page 3's banner it is a straight swap —
     the displaced photo takes the slot just vacated. Off the tray there is
     no slot to give back, so the displaced photo goes to the tray instead. */
  const vacated = slotOf(img);
  hit.cell.id = id;
  hit.cell.fx = 50; hit.cell.fy = 50; hit.cell.z = 1;
  img.role = 'gallery';
  if (displaced) displaced.role = vacated || 'exclude';
  redraw(); renderImgList(); renderGalleryPanel();
}

/* Drop onto a gallery page's spare space: append a frame on that page. */
function dropOnGalleryPage(id, gi) {
  id = Number(id);
  const img = state.images.filter(im => im.id === id)[0];
  if (!img) return;
  removeCell(id);
  img.role = 'gallery';
  state.galPage = gi;
  const pages = galPages();
  const host = pages[gi] || pages[pages.length - 1];
  const row = host.rows[host.rows.length - 1];
  if (row && row.cells.length < 4) row.cells.push(newCell(id));
  else host.rows.push({ h: 1, cells: [newCell(id)] });
  state.galSel = id;
  redraw(); renderImgList(); renderGalleryPanel();
}

/* Take a photo out of the brochure's pages without deleting the file. */
function unusePhoto(id) {
  id = Number(id);
  const img = state.images.filter(im => im.id === id)[0];
  if (!img) return;
  edited();
  removeCell(id);
  img.role = 'exclude';
  if (state.galSel === id) state.galSel = null;
  redraw(); renderImgList(); renderGalleryPanel();
}

/* Start dragging a photo. `from` is 'tray' or 'page' — a page drag that ends
   on the tray means "take this out", which a tray drag cannot mean.

   The gesture itself — the ghost, the live target, the auto-scroll — is in
   assets/js/photo-dnd.js and shared with the other three builders. All this
   adds is what the brochure's own data-drop values mean. */
function beginPhotoDnD(e, id, from) {
  id = Number(id);
  const img = state.images.filter(im => im.id === id)[0];
  if (!img) return;
  PD.drag(e, {
    url: img.url,
    from: from,
    scroller: document.getElementById('stage'),
    tray: document.getElementById('imgList'),
    labels: DROP_LABEL,
    onOut: () => unusePhoto(id),
    onDrop: (kind, zone) => {
      if (kind === 'cell')         dropOnCell(id, zone.dataset.id);
      else if (kind === 'gal-add') dropOnGalleryPage(id, parseInt(zone.dataset.gi, 10) || 0);
      else                         placeInSlot(id, kind);
    }
  });
}

/* Every photo in the deck carries a move grip and a ✕ — on a gallery frame,
   on the cover and on page 3's banner — so it can be moved or taken out from
   wherever it is sitting rather than only from the gallery. */
function addSlotGrip(box, img, title) {
  if (!box || !img) return;
  PD.grip(box, {
    moveTitle: title,
    onMove: ev => beginPhotoDnD(ev, img.id, 'page'),
    onOff: () => unusePhoto(img.id),
    offTitle: 'Take this photo off the page'
  });
}
/* ---------------- the photo tray ---------------- */
/* Re-read every tray badge from the current placement, leaving the rest of
   the row alone. Called at the end of every redraw. */
function refreshPlacementBadges() {
  document.querySelectorAll('#imgList .img-row').forEach(row => {
    const img = state.images.filter(im => im.id === +row.dataset.id)[0];
    const badge = row.querySelector('.img-badge');
    if (!img || !badge) return;
    const place = placementOf(img);
    badge.className = 'img-badge ' + place.cls;
    badge.textContent = place.text;
  });
}

/* Where a photo currently sits, as the badge shows it. */
function placementOf(img) {
  if (img.role === 'exclude') return { text: 'Unused', cls: '' };
  if (assign.hero === img) return { text: 'Cover', cls: img.role === 'hero' ? 'pinned' : 'used' };
  if (assign.infoTop === img) return { text: 'Top banner', cls: img.role === 'info-top' ? 'pinned' : 'used' };
  const hit = findCell(img.id);
  if (hit) return { text: 'Gallery ' + (hit.pi + 1), cls: img.role === 'gallery' ? 'pinned' : 'used' };
  if (assign.gallery.indexOf(img) > -1) return { text: 'Gallery', cls: 'used' };
  return { text: 'Unused', cls: '' };
}



/* The badge opens the same choices the old dropdown had. Dragging covers the
   common cases; this is the keyboard path and the way to say "auto", which is
   not a place and so cannot be dragged to. */
function openImgMenu(img, anchor) {
  PD.menu(anchor, ROLES, value => {
    if (value === 'gallery' || value === 'auto' || value === 'exclude') {
      if (value !== 'gallery') removeCell(img.id);
      img.role = value;
      redraw(); renderImgList(); renderGalleryPanel();
    } else {
      placeInSlot(img.id, value);
    }
  }, img.role || 'auto');
}

function renderImgList() {
  PD.tray($('#imgList'), state.images, {
    idOf: img => img.id,
    onGrab: (e, img) => beginPhotoDnD(e, img.id, 'tray'),
    badgeOf: img => {
      const place = placementOf(img);
      return {
        text: place.text, cls: place.cls,
        title: (img.role && img.role !== 'auto')
          ? 'Placed by hand — click to change'
          : 'Placed automatically — click to pin it somewhere'
      };
    },
    onBadge: (img, badge) => openImgMenu(img, badge),
    onRemove: img => {
      edited();
      removeCell(img.id);
      state.images = state.images.filter(x => x.id !== img.id);
      redraw(); renderImgList(); renderGalleryPanel();
    },
    removeTitle: 'Remove this photo from the brochure',
    note: $('#imgNote'),
    hint: 'Drag a thumbnail onto any slot in the preview to place it. ' +
          'Drag a photo off a page and onto this list to take it out.'
  });
}

/* The .ag-chip picker shared with the Showsheet and the packages — the
   implementation lives in roster.js, the styles in builder.css. */
let renderRoster = () => {};

function renderFpList() {
  const host = $('#fpList');
  host.innerHTML = '';
  state.floorplans.forEach((fp, i) => {
    const row = document.createElement('div');
    row.className = 'img-row fp-row';

    const top = document.createElement('div');
    top.className = 'fp-top';
    const thumb = document.createElement('img');
    thumb.className = 'img-thumb'; thumb.src = fp.url; thumb.alt = '';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'fp-label'; inp.value = fp.label || '';
    inp.placeholder = 'Level ' + (i + 1);
    inp.addEventListener('input', () => { fp.label = inp.value; redraw(); });
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'img-x'; del.innerHTML = '&#10005;'; del.title = 'Remove';
    del.addEventListener('click', () => {
      edited();
      state.floorplans = state.floorplans.filter(x => x.id !== fp.id);
      renderFpList(); redraw();
    });
    top.append(thumb, inp, del);

    // crop row: zoom in on the plan, then drag it around on the page
    const crop = document.createElement('div');
    crop.className = 'fp-crop';
    const lab = document.createElement('span');
    lab.className = 'fp-crop-l'; lab.textContent = 'Crop';
    const rng = document.createElement('input');
    rng.type = 'range'; rng.min = '100'; rng.max = '300'; rng.step = '1';
    rng.value = String(Math.round((fp.zoom || 1) * 100));
    rng.title = 'Scale the plan inside its frame, then drag it on the page to crop';
    const val = document.createElement('span');
    val.className = 'fp-crop-v'; val.textContent = rng.value + '%';
    rng.addEventListener('input', () => {
      fp.zoom = parseInt(rng.value, 10) / 100;
      val.textContent = rng.value + '%';
      clampAllFp();
    });
    const rst = document.createElement('button');
    rst.type = 'button'; rst.className = 'shot-btn'; rst.textContent = 'Reset';
    rst.addEventListener('click', () => {
      edited();
      fp.zoom = 1; fp.tx = 0; fp.ty = 0;
      rng.value = '100'; val.textContent = '100%';
      redraw();
    });
    crop.append(lab, rng, val, rst);

    row.append(top, crop);
    host.appendChild(row);
  });
}

/* ---------------- file intake ---------------- */
function addFiles(files) {
  [...files].filter(f => f.type.startsWith('image/')).forEach(f => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = { id: ++uid, name: f.name, url: e.target.result, ar: 1.5, role: 'auto' };
      state.images.push(img);
      // aspect ratio drives the "by shape" strategy
      const probe = new Image();
      probe.onload = () => {
        img.ar = probe.naturalWidth / probe.naturalHeight;
        if (state.strategy === 'aspect') { redraw(); renderImgList(); }
      };
      probe.src = img.url;
      redraw(); renderImgList(); updateBentoNote();
      edited();
    };
    reader.readAsDataURL(f);
  });
}

/* reading a dropped plan is shared with the Showsheet — assets/js/images.js */
const { fileToImage, reencode, floorplanHeaderY, trimRect } = window.GVC_IMAGES;

async function addFloorplans(files) {
  for (const f of [...files].filter(f => f.type.startsWith('image/'))) {
    try {
      const img = await fileToImage(f);
      const rect = trimRect(img, floorplanHeaderY(img));
      const url = reencode(img, 2400, .9, rect);
      state.floorplans.push({ id: ++uid, name: f.name, url, label: '', zoom: 1, tx: 0, ty: 0 });
      edited();
      renderFpList(); redraw();
    } catch (e) { /* unreadable file — skip it */ }
  }
}

function wireDrop(dropSel, inputSel, handler) {
  const drop = $(dropSel), input = $(inputSel);
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => { handler(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => handler(e.dataTransfer.files));
}
