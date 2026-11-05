/* ============================================================
   tools/brochure/fit.js: redraw, the overflow warnings, fitting the
   blurb's type size, and panning a zoomed floor plan. Fourth of the seven
   scripts (see state.js).
   ============================================================ */
'use strict';

function redraw() {
  if (!builder) return;
  assign = computeAssignment();
  syncGallery();
  /* The tray is often drawn before this runs — every caller pairs the two,
     and several draw the list first — so its badges would otherwise show a
     placement from before the photos were assigned, which read as a tray
     full of "Unused" beside pages that plainly had photos on them. The
     badges are re-read here instead, once the placement is settled. */
  refreshPlacementBadges();
  const n = pagePlan().length;
  if (builder.state.pages !== n) builder.setPages(n);
  else builder.rebuild();
  // setTimeout, not requestAnimationFrame: rAF is suspended while the tab
  // isn't rendering, which would leave stale warnings on a background tab.
  setTimeout(checkOverflow, 0);
}

/* ---------------- overflow warnings ---------------- */
/* selector | the flag printed over it on the page | its own warning box, which
   sits under the field that causes it. Both targets have one, so there is no
   catch-all panel; a new target without a box of its own needs somewhere to
   put its message. */
const OVER_TARGETS = [
  ['.info-blurb',  'Blurb clipped',    '#warnBlurb'],
  ['.info-feats',  'Features clipped', '#warnFeats']
];

function flag(el, label) {
  el.classList.add('is-over');
  const page = el.closest('.page');
  if (!page) return;
  const pr = page.getBoundingClientRect(), r = el.getBoundingClientRect();
  const tag = document.createElement('div');
  tag.className = 'over-flag';
  tag.textContent = label;
  tag.style.left = Math.max(0, r.left - pr.left) + 'px';
  tag.style.top = Math.max(0, r.bottom - pr.top - 18) + 'px';
  page.appendChild(tag);
}

/* The Overview is the one field with no natural length limit, and its column is
   a fixed box — so rather than guillotine the sentence, step the type down until
   it fits. 10.5pt is the design size, and the size it keeps whenever the blurb
   is short enough to hold it. 8pt is the floor: below that the page stops being
   worth reading, so the "Blurb clipped" warning takes over instead. Line height
   rides the size as a ratio, so the column stays evenly set at every step. */
const BLURB_MAX = 10.5, BLURB_MIN = 8, BLURB_LH = 16 / 10.5;

function fitBlurb() {
  document.querySelectorAll('.info-blurb').forEach(el => {
    el.style.lineHeight = BLURB_LH;
    let pt = BLURB_MAX;
    el.style.fontSize = pt + 'pt';
    while (pt > BLURB_MIN && el.scrollHeight > el.clientHeight + 1) {
      pt = Math.round((pt - 0.25) * 100) / 100;
      el.style.fontSize = pt + 'pt';
    }
  });
}

function checkOverflow() {
  // shrink to fit first, so the blurb is only ever flagged when even 8pt spills
  fitBlurb();
  document.querySelectorAll('.over-flag').forEach(n => n.remove());
  document.querySelectorAll('.is-over').forEach(n => n.classList.remove('is-over'));

  // multi-column and grid regions overflow sideways, so both axes matter
  const over = el => !!el && (el.scrollHeight > el.clientHeight + 1 ||
                              el.scrollWidth > el.clientWidth + 1);
  const hit = {};
  OVER_TARGETS.forEach(t => {
    let any = false;
    document.querySelectorAll(t[0]).forEach(el => { if (over(el)) { flag(el, t[1]); any = true; } });
    hit[t[2]] = any;
  });

  // page 1: has the address grown up out of the bottom scrim?
  let addrOver = false;
  const head = document.querySelector('.cv-head');
  if (head) {
    const page = head.closest('.page'), pr = page.getBoundingClientRect();
    const bot = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mask-bot'));
    const scrimTop = pr.top + pr.height * (1 - bot / 100);
    addrOver = head.getBoundingClientRect().top < scrimTop;
    if (addrOver) flag(head, 'Above the scrim');
  }

  $('#warnBlurb').hidden = !hit['#warnBlurb'];
  $('#warnFeats').hidden = !hit['#warnFeats'];
  $('#warnAddr').hidden = !addrOver;
}

const DRAG_THRESHOLD = 4;

/* ---------------- drag: pan a zoomed floor plan ----------------
   The plan is transformed, not object-positioned, so the pan is measured
   against the image's own untransformed layout box (offsetWidth/Height)
   and clamped so an edge can never be dragged inside the frame. */
function fpClamp(fp, box) {
  const img = box.querySelector('img');
  if (!img || !img.offsetWidth) return;
  const maxX = Math.max(0, (img.offsetWidth * fp.zoom - box.clientWidth) / 2 / img.offsetWidth * 100);
  const maxY = Math.max(0, (img.offsetHeight * fp.zoom - box.clientHeight) / 2 / img.offsetHeight * 100);
  fp.tx = Math.max(-maxX, Math.min(maxX, fp.tx || 0));
  fp.ty = Math.max(-maxY, Math.min(maxY, fp.ty || 0));
}

function beginFpDrag(e, box, fp) {
  const img = box.querySelector('img');
  if (!img || !img.offsetWidth || (fp.zoom || 1) <= 1.001) return;
  e.preventDefault();
  const page = box.closest('.page');
  const scale = page ? page.getBoundingClientRect().width / (8.5 * 96) : 1;
  const start = { x: e.clientX, y: e.clientY, tx: fp.tx || 0, ty: fp.ty || 0 };
  box.classList.add('is-moving');
  try { box.setPointerCapture(e.pointerId); } catch (_) {}

  const move = ev => {
    edited();
    fp.tx = start.tx + ((ev.clientX - start.x) / scale) / (img.offsetWidth * fp.zoom) * 100 * fp.zoom;
    fp.ty = start.ty + ((ev.clientY - start.y) / scale) / (img.offsetHeight * fp.zoom) * 100 * fp.zoom;
    fpClamp(fp, box);
    img.style.transform = 'translate(' + fp.tx + '%,' + fp.ty + '%) scale(' + fp.zoom + ')';
  };
  const done = ev => {
    box.removeEventListener('pointermove', move);
    box.removeEventListener('pointerup', done);
    box.removeEventListener('pointercancel', done);
    try { box.releasePointerCapture(ev.pointerId); } catch (_) {}
    box.classList.remove('is-moving');
  };
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', done);
  box.addEventListener('pointercancel', done);
}

/* Re-clamp every plan's pan against its frame — called after a zoom
   change, so zooming back out pulls the plan back inside the frame
   instead of leaving a white wedge along one edge. */
function clampAllFp() {
  document.querySelectorAll('.fp-frame.has-img').forEach(box => {
    const fp = state.floorplans[parseInt(box.dataset.fp, 10)];
    if (!fp) return;
    fpClamp(fp, box);
    const img = box.querySelector('img');
    if (img) img.style.transform = 'translate(' + fp.tx + '%,' + fp.ty + '%) scale(' + fp.zoom + ')';
  });
}

/* ---------------- editor UI ---------------- */
/* ---------------- gallery editor panel ----------------
   Everything here is chrome for the page preview: the page tabs, the preset
   shortcuts and an inspector for whichever cell is selected. The layout
   itself is edited on the page, by dragging. */
