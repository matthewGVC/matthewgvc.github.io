/* ============================================================
   tools/showsheet/photos.js: taking in photos and floorplans, the photo
   tray and its two slots, and cropping the floorplan on the sheet. Fifth
   of the eight scripts (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   IMAGES — ingestion (canvas re-encode: CMYK→RGB, downscale)
   ============================================================ */
/* reading a dropped photo or plan is shared with the Brochure — assets/js/images.js */
const { fileToImage, reencode, floorplanHeaderY, trimRect } = window.GVC_IMAGES;

/* Every image dropped joins the tray. The first one to arrive takes the
   front of the sheet, because that is what an agent dropping one photo
   means; everything after that waits to be dragged somewhere. */
async function addPhotoFiles(files){
  const imgs = [...(files||[])].filter(x=>/^image\//.test(x.type));
  if(!imgs.length) return;
  let added = 0, failed = 0;
  const first = state.photos.length;
  for(const f of imgs){
    try{
      const img = await fileToImage(f);
      state.photos.push({src: reencode(img, 2000, .87), fx:50, fy:50, name: f.name || 'Photo'});
      added++;
    }catch(e){ failed++; }
  }
  // an empty front takes the first of the photos just dropped — not photo 0,
  // which may be the one already on the back
  if((state.heroIndex == null || !state.photos[state.heroIndex]) && state.photos[first]) state.heroIndex = first;
  renderTray(); syncDropZones(); render();
  if(added) toast(added === 1 ? 'Photo added.' : `${added} photos added.`);
  if(failed) toast(`Couldn't read ${failed} ${failed===1?'file':'files'}.`, true);
}
/* slot 0 is the floorplan, slot 1 the optional second plan beside it; a
   second plan with no first one becomes the first */
async function setFloorplanFile(f, slot = 0){
  try{
    const img = await fileToImage(f);
    const cropY = floorplanHeaderY(img);
    const rect = trimRect(img, cropY);
    const box = rect.w < img.naturalWidth || rect.h < img.naturalHeight - cropY;   // did the trim take anything
    const src = reencode(img, 2400, .9, rect);
    if(slot === 1 && !state.floorplan) slot = 0;
    // a new plan starts uncropped
    if(slot === 1){ state.floorplan2 = src; state.floorplan2View = normFpView(null); }
    else { state.floorplan = src; state.floorplanView = normFpView(null); }
    syncDropZones();
    render();
    edited();
    const did = [cropY && 'header strip cropped off', box && 'margins trimmed'].filter(Boolean).join(', ');
    const what = slot === 1 ? 'Second floorplan added — the two plans share the space' : 'Floorplan added';
    toast(did ? `${what} — ${did}. Hover it on the sheet to zoom and move it.`
              : `${what}. Hover it on the sheet to zoom and move it.`);
  }catch(e){ toast('Could not read the floorplan image.', true); }
}
/* the floorplan zone takes one plan, or two at once: the first and the second */
async function addFloorplanFiles(files){
  // a file with no type (HEIC, some Windows drags) still gets a try, as it always did
  const imgs = [...(files||[])].filter(x=>!x.type || /^image\//.test(x.type));
  if(!imgs.length){ if(files && files.length) toast('Could not read the floorplan image.', true); return; }
  await setFloorplanFile(imgs[0], 0);
  if(imgs[1]) await setFloorplanFile(imgs[1], 1);
  if(imgs.length > 2) toast('The sheet holds two floorplans — the first two were used.', true);
}
function wireDrop(zone, input, handler, multiple){
  zone.addEventListener('click', ()=>input.click());
  // the zones are buttons to a keyboard too; the ✕ inside one keeps its own keys
  zone.addEventListener('keydown', e=>{
    if(e.target !== zone || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); input.click();
  });
  input.addEventListener('change', ()=>{ handler(multiple ? [...input.files] : input.files[0]); input.value=''; });
  ;['dragover','dragenter'].forEach(ev=>zone.addEventListener(ev, e=>{e.preventDefault(); zone.classList.add('over');}));
  ;['dragleave','drop'].forEach(ev=>zone.addEventListener(ev, e=>{e.preventDefault(); zone.classList.remove('over');}));
  zone.addEventListener('drop', e=>{
    const fs = [...e.dataTransfer.files];
    if(fs.length) handler(multiple ? fs : fs[0]);
  });
}
wireDrop($('#phDrop'), $('#phFile'), addPhotoFiles, true);
wireDrop($('#fpDrop'), $('#fpFile'), addFloorplanFiles, true);
wireDrop($('#fp2Drop'), $('#fp2File'), f => setFloorplanFile(f, 1), false);


/* ============================================================
   PHOTOS — a tray, and two slots to drag onto.

   The sheet has two photo slots: the big one on the front (hero) and the
   smaller one under the residence (back). The tray holds every photo that
   has been dropped in; which one sits where is heroIndex and
   secondaryIndex, so a placement is just an index.

   The gesture is shared with the other three builders — see
   assets/js/photo-dnd.js. Reframing a photo inside its crop replaces what
   used to be a click on the tray thumbnail: the thumbnail is now the drag
   handle, and the crop is adjusted on the sheet itself, where the result is
   actually visible. It writes the same fx/fy the click used to.
   ============================================================ */
const PD = window.GVC_PHOTODND;
/* The Showsheet's design canvas is 11in wide and .trim is the element that is
   that wide — the three portrait decks are 8.5in, which is why the shared
   reframe takes both as options. */
const REFRAME = { page: '.trim', canvasIn: 11 };
const DROP_LABEL = { 'hero': 'Front photo', 'back': 'Back photo' };
const PLACE_ROLES = [['hero','Front'], ['back','Back'], ['none','Unused']];

/* Sheets saved before the tray existed held one photo in `photos` and the
   back one as its own `secondaryPhoto` object. Fold that into the tray and
   point secondaryIndex at it, so an old sheet opens with both photos in
   place and behaves like a new one.

   Detected by shape rather than by a version number, which is the more
   reliable test here: it is true of exactly the documents that need it, and
   stays correct for a sheet saved by any build in between.

   Not reversible, and does not need to be — saving writes the new shape and
   nothing reads secondaryPhoto any more. */
function migratePhotos(){
  if(!Array.isArray(state.photos)) state.photos = [];
  // photos saved before the tray had no name to show in it
  state.photos.forEach(p => { if(p && !p.name) p.name = 'Photo'; });
  const legacy = state.secondaryPhoto;
  if(legacy && legacy.src){
    state.photos.push({ src: legacy.src, fx: legacy.fx ?? 50, fy: legacy.fy ?? 50,
                        name: legacy.name || 'Back photo' });
    state.secondaryIndex = state.photos.length - 1;
  }
  delete state.secondaryPhoto;
  const valid = i => (i != null && state.photos[i]) ? i : null;
  state.secondaryIndex = valid(state.secondaryIndex);
  /* A null front is the agent's own choice ("Unused") and is kept — filling
     it with photo 0 here put the back photo in both slots whenever photo 0
     was the back one. A sheet saved before heroIndex existed never reaches
     this as null: blankUnit() gives it 0 first. */
  if(state.heroIndex != null && !state.photos[state.heroIndex]) state.heroIndex = firstFreePhoto();
  if(state.heroIndex != null && state.heroIndex === state.secondaryIndex) state.secondaryIndex = null;
}
/* the first photo not already holding the back slot */
function firstFreePhoto(){
  const i = state.photos.findIndex((p, j) => p && j !== state.secondaryIndex);
  return i === -1 ? null : i;
}

function frontPhoto(){ return state.photos[state.heroIndex] || null; }
function backPhoto(){
  return state.secondaryIndex == null ? null : (state.photos[state.secondaryIndex] || null);
}

/* Put a photo in a slot. A photo cannot hold both slots at once, so taking
   the one it is not already in hands the other back to the tray. */
function placePhoto(i, slot){
  i = Number(i);
  if(!state.photos[i]) return;
  if(slot === 'hero'){
    if(state.secondaryIndex === i) state.secondaryIndex = null;
    state.heroIndex = i;
  }else if(slot === 'back'){
    if(state.heroIndex === i) state.heroIndex = null;
    state.secondaryIndex = i;
  }
  renderTray(); syncDropZones(); render();
}

/* Off the sheet but still in the tray — it shows as Unused and can be
   dropped back on either slot. */
function unusePhoto(i){
  i = Number(i);
  if(state.heroIndex === i) state.heroIndex = null;
  if(state.secondaryIndex === i) state.secondaryIndex = null;
  renderTray(); syncDropZones(); render();
}

/* Delete the file itself. Every index above it shifts down by one, so the
   two placements have to move with it or they would point at a neighbour. */
function deletePhoto(i){
  i = Number(i);
  state.photos.splice(i, 1);
  const shift = idx => idx == null ? null : (idx === i ? null : (idx > i ? idx - 1 : idx));
  const wasFront = state.heroIndex === i;
  state.heroIndex = shift(state.heroIndex);
  state.secondaryIndex = shift(state.secondaryIndex);
  // deleting the front photo refills the front — from a photo that is not on
  // the back; a front the agent had emptied on purpose stays empty
  if(wasFront) state.heroIndex = firstFreePhoto();
  renderTray(); syncDropZones(); render();
}

function slotOf(i){
  if(state.heroIndex === i) return 'hero';
  if(state.secondaryIndex === i) return 'back';
  return 'none';
}

function beginPhotoDnD(e, i, from){
  const p = state.photos[i];
  if(!p) return;
  PD.drag(e, {
    url: p.src,
    from: from,
    scroller: document.getElementById('stage'),
    tray: document.getElementById('imgList'),
    labels: DROP_LABEL,
    onOut: () => unusePhoto(i),
    onDrop: kind => placePhoto(i, kind)
  });
}

function renderTray(){
  PD.tray($('#imgList'), state.photos, {
    idOf: (p) => state.photos.indexOf(p),
    urlOf: p => p.src,
    nameOf: p => p.name || 'Photo',
    onGrab: (e, p) => beginPhotoDnD(e, state.photos.indexOf(p), 'tray'),
    badgeOf: p => {
      const slot = slotOf(state.photos.indexOf(p));
      const row = PLACE_ROLES.filter(r => r[0] === slot)[0];
      return {
        text: row ? row[1] : 'Unused',
        cls: slot === 'none' ? '' : 'pinned',
        title: 'Click to place this photo'
      };
    },
    onBadge: (p, badge) => PD.menu(badge, PLACE_ROLES, value => {
      const i = state.photos.indexOf(p);
      if(value === 'none') unusePhoto(i); else placePhoto(i, value);
    }, slotOf(state.photos.indexOf(p))),
    onRemove: p => deletePhoto(state.photos.indexOf(p)),
    removeTitle: 'Delete this photo',
    note: $('#imgNote'),
    hint: 'Drag a thumbnail onto either photo slot on the sheet. ' +
          'Drag a photo off the sheet and onto this list to take it out. ' +
          'Drag the photo itself on the sheet to adjust its crop.'
  });
}

/* After every render: the slots are rebuilt from scratch, so reframing and
   the move grip have to be re-attached. The back slot only gets them when it
   actually holds a photo — when empty it is a drag-time overlay. */
function paintSlotTools(){
  [['hero', state.heroIndex], ['back', state.secondaryIndex]].forEach(([slot, idx]) => {
    if(idx == null) return;
    const p = state.photos[idx];
    const box = document.querySelector('#sheetFront [data-drop="' + slot + '"]');
    if(!p || !box || !box.querySelector('img')) return;
    box.addEventListener('pointerdown', ev => {
      if(ev.target.closest('.ph-grip, .ph-kill')) return;
      PD.reframe(ev, box, { x: p.fx ?? 50, y: p.fy ?? 50 }, Object.assign({}, REFRAME, {
        onMove: pos => { p.fx = Math.round(pos.x); p.fy = Math.round(pos.y); },
        onEnd: () => { edited(); }
      }));
    });
    PD.grip(box, {
      onMove: ev => beginPhotoDnD(ev, idx, 'page'),
      onOff: () => unusePhoto(idx),
      offTitle: 'Take this photo off the sheet'
    });
  });
}

/* A click or a drag fires no input event, so neither the unsaved-work guard
   nor the property bar's "Unsaved changes" mark hears about it. Tell both the
   way they already listen: an input event at the document, which the form
   binding ignores because the document carries no data-field. */
function edited(){ document.dispatchEvent(new Event('input')); }

/* ============================================================
   FLOORPLAN CROP — zoom into the plan and move it inside its frame.

   Saved with the sheet as floorplanView {zoom, x, y}. Everything is a CSS
   transform on the image (see .fp-wrap), so cropping never changes layout
   and needs no re-render: the drag and the buttons repaint the one image.
   ============================================================ */
const FP_MAX_ZOOM = 3, FP_STEP = 0.1;
const finiteOr = (v, d) => (v === null || v === '' || !Number.isFinite(+v)) ? d : +v;
function normFpView(v){
  v = v && typeof v === 'object' ? v : {};
  return { zoom: clampN(finiteOr(v.zoom, 1), 1, FP_MAX_ZOOM),
           x: clampN(finiteOr(v.x, 50), 0, 100), y: clampN(finiteOr(v.y, 50), 0, 100) };
}
function fpTransform(v){
  v = normFpView(v);
  return v.zoom > 1
    ? `transform:scale(${v.zoom.toFixed(3)});transform-origin:${v.x.toFixed(2)}% ${v.y.toFixed(2)}%`
    : '';
}
function paintFloorplanTools(){
  document.querySelectorAll('#sheetBack .fp-wrap').forEach(wrap =>
    paintFpCrop(wrap, wrap.dataset.fp === '1' ? state.floorplan2View : state.floorplanView));
}
function paintFpCrop(wrap, v){
  const img = wrap.querySelector('img');
  if(!img || !v) return;
  wrap.title = 'Zoom with + and − (or pinch / Ctrl + scroll), then drag to move the plan';
  const tools = document.createElement('div');
  tools.className = 'fp-tools';
  tools.innerHTML =
    '<button type="button" data-fz="-1" aria-label="Zoom out" title="Zoom out">&minus;</button>' +
    '<span class="fp-z" aria-live="polite"></span>' +
    '<button type="button" data-fz="1" aria-label="Zoom in" title="Zoom in">+</button>' +
    '<button type="button" class="fit" data-fz="0" title="Show the whole plan again">Fit</button>';
  wrap.appendChild(tools);

  const show = () => {
    img.style.cssText = fpTransform(v);
    wrap.classList.toggle('is-zoomed', v.zoom > 1);
    tools.querySelector('.fp-z').textContent = Math.round(v.zoom * 100) + '%';
    tools.querySelector('[data-fz="-1"]').disabled = v.zoom <= 1;
    tools.querySelector('[data-fz="0"]').disabled = v.zoom <= 1;
    tools.querySelector('[data-fz="1"]').disabled = v.zoom >= FP_MAX_ZOOM;
  };
  const zoomTo = z => {
    const was = v.zoom;
    v.zoom = clampN(Math.round(z * 100) / 100, 1, FP_MAX_ZOOM);
    if(v.zoom === 1){ v.x = 50; v.y = 50; }
    if(v.zoom !== was){ show(); edited(); }
  };
  const panBy = (dx, dy) => {
    if(v.zoom <= 1) return;
    v.x = clampN(v.x + dx, 0, 100); v.y = clampN(v.y + dy, 0, 100);
    show(); edited();
  };
  show();

  // the controls sit on the plan, so a press on them must not start a pan
  tools.addEventListener('pointerdown', e => e.stopPropagation());
  tools.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    const d = Number(b.dataset.fz);
    zoomTo(d === 0 ? 1 : v.zoom + d * FP_STEP);
  });
  // a pinch on a trackpad arrives as ctrl + wheel; a plain wheel still scrolls the preview
  wrap.addEventListener('wheel', e => {
    if(!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomTo(v.zoom * Math.exp(-e.deltaY * 0.0025));
  }, {passive:false});
  wrap.addEventListener('keydown', e => {
    const step = e.shiftKey ? 15 : 5;
    const k = e.key;
    if(k === '+' || k === '=') zoomTo(v.zoom + FP_STEP);
    else if(k === '-' || k === '_') zoomTo(v.zoom - FP_STEP);
    else if(k === '0') zoomTo(1);
    // arrows move the plan the way it moves under a drag
    else if(k === 'ArrowLeft')  panBy(step, 0);
    else if(k === 'ArrowRight') panBy(-step, 0);
    else if(k === 'ArrowUp')    panBy(0, step);
    else if(k === 'ArrowDown')  panBy(0, -step);
    else return;
    e.preventDefault();
  });

  /* transform-origin p% maps a point q to p + z(q - p), so moving the origin
     by Δ shifts the picture by Δ(1 - z) of the frame: to follow the pointer
     by d px, the origin moves by -d / ((z - 1) × width). Pointer deltas are
     screen px, divided by the preview's scale to get design px. */
  wrap.addEventListener('pointerdown', e => {
    if(v.zoom <= 1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const page = wrap.closest('.trim');
    const scale = page ? page.getBoundingClientRect().width / (11 * 96) : 1;
    const W = img.offsetWidth, H = img.offsetHeight;
    const start = { x: e.clientX, y: e.clientY, px: v.x, py: v.y };
    let moved = false;
    wrap.classList.add('is-panning');
    try { wrap.setPointerCapture(e.pointerId); } catch(_){}
    const move = ev => {
      const dx = (ev.clientX - start.x) / scale, dy = (ev.clientY - start.y) / scale;
      v.x = Math.round(clampN(start.px - dx / ((v.zoom - 1) * W) * 100, 0, 100) * 10) / 10;
      v.y = Math.round(clampN(start.py - dy / ((v.zoom - 1) * H) * 100, 0, 100) * 10) / 10;
      moved = true;
      img.style.transformOrigin = v.x.toFixed(2) + '% ' + v.y.toFixed(2) + '%';
    };
    const done = ev => {
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerup', done);
      wrap.removeEventListener('pointercancel', done);
      try { wrap.releasePointerCapture(ev.pointerId); } catch(_){}
      wrap.classList.remove('is-panning');
      if(moved) edited();
    };
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', done);
    wrap.addEventListener('pointercancel', done);
  });
}
