/* ============================================================
   tools/seller-package/photos.js: which photo fills which slot (cover,
   property, strategy, films), and dragging photos between the tray and
   the pages. Second of the five scripts (see content.js).
   ============================================================ */
'use strict';

/* Photo roles — 'auto' fills the slots below in order; a pinned photo is
   left where the agent put it. Mirrors the brochure's behaviour. */
const ROLES = [
  ['auto',    'Auto'],
  ['cover',   'Cover'],
  ['hero',    'Property hero'],
  ['strategy','Strategy page'],
  ['video1',  'Video 1 still'],
  ['video2',  'Video 2 still'],
  ['video3',  'Video 3 still'],
  ['exclude', 'Unused']
];
const SLOTS = ['cover','hero','strategy','video1','video2','video3'];
let assign = {}, uid = 0;
/* The property page owns the 'hero' slot, so with that page switched off
   the slot is not offered a photo — otherwise the auto pass would quietly
   swallow one into a page that is not being printed. The role stays in the
   menu either way: a photo pinned to it simply waits for the page.
   The same goes for a video card: one whose film carries its own still, or
   one that is not printed at all (fewer films picked), is not offered an
   auto photo, so the tray never calls a photo a "Video still" that does not
   print. A photo pinned there by hand still wins, as before. */
function liveSlots() {
  const vids = chosenVideos();
  return SLOTS.filter(s => {
    if (s === 'hero') return state.showProperty;
    const m = /^video(\d)$/.exec(s);
    if (m) { const v = vids[m[1] - 1]; return !!v && !v.photo; }
    return true;
  });
}
function reassign() { assign = P.assignRoles(state.photos, liveSlots()); }
function slot(name) { return assign[name] ? assign[name].url : null; }

/* ============================================================
   PHOTOS — drag one onto the slot you want it in.

   The gesture is shared with the other three builders and lives in
   assets/js/photo-dnd.js. This deck has six slots, which is where a
   dropdown per photo hurt most and where dragging helps most.

   A photo's role IS its placement, so a drop is just setting that role —
   the same field the old dropdown wrote, which is why no saved deck needed
   migrating.
   ============================================================ */
const REFRAME = { page: '.pg, .fcv', canvasIn: 8.5 };
const DROP_LABEL = {
  'cover': 'Cover photo', 'hero': 'Property hero', 'strategy': 'Strategy page',
  'video1': 'Video 1 still', 'video2': 'Video 2 still', 'video3': 'Video 3 still'
};

/* Pin a photo to a slot, turning whoever was pinned there loose. The
   displaced photo goes back to 'auto' rather than out of the deck, so it can
   still be picked up by the auto pass for a slot that is empty. */
function placeInRole(img, role) {
  state.photos.forEach(p => { if (p !== img && p.role === role) p.role = 'auto'; });
  img.role = role;
  redraw();
}

/* Off the pages but not out of the tray — it shows as Unused and can be
   dropped back anywhere. */
function unusePhoto(img) { img.role = 'exclude'; redraw(); }

function beginPhotoDnD(e, img, from) {
  PD.drag(e, {
    url: img.url,
    from: from,
    scroller: document.getElementById('stage'),
    tray: document.getElementById('imgList'),
    labels: DROP_LABEL,
    onOut: () => unusePhoto(img),
    onDrop: kind => placeInRole(img, kind)
  });
}

/* Every placed photo gets the move grip and the ✕, so it can be moved or
   taken off the page from where it is sitting. Called after each redraw,
   because the pages are rebuilt from scratch.

   A video still is only shown when that video has no frame of its own, so a
   slot can be a live drop target with nothing of ours in it — hence the
   check that the box actually holds the photo assign gave it. */
function paintSlotGrips() {
  SLOTS.forEach(name => {
    const img = assign[name];
    const box = document.querySelector('[data-drop="' + name + '"]');
    const shown = box && box.querySelector('img');
    if (!img || !shown || shown.getAttribute('src') !== img.url) return;
    PD.grip(box, {
      onMove: ev => beginPhotoDnD(ev, img, 'page'),
      onOff: () => unusePhoto(img)
    });
  });
}
