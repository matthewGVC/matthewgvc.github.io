/* ============================================================
   tools/brochure/piece.js: saving to the property library (the property
   bar), the brochure opened from a job (window.__piece for job-mode.js),
   and window.__render, which the helper prints a job's brochure through
   (helper/pdf/render.js). Last of the seven scripts (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   THE PROPERTY LIBRARY

   Two small maps and nothing else: which of this deck's fields are shared
   facts, and how to put its own work back. Everything about saving,
   loading, photos and the team password lives in the shared module.
   ============================================================ */

/* the deck's own work — everything that is not a shared fact */
const DOC_KEYS = ['images', 'gallery', 'galCaptions', 'galPage', 'strategy',
                  'floorplans', 'fpNote', 'coverPos', 'infoTopPos', 'paper'];

/* Paper size belongs to the person printing, not to the listing, so it is
   saved with the brochure but not wiped when the property changes. */
const KEEP_ON_SWITCH = ['paper'];

/* Called before a property's facts are applied — see property-bar's open().
   Cloned, or images and gallery pages would be shared with the blank. */
const syncStrategy = () => { $('#strategy').value = state.strategy; };
const resetDocFields = () => {
  DOC_KEYS.forEach(k => {
    if (KEEP_ON_SWITCH.includes(k)) return;
    state[k] = structuredClone(BLANK[k]);
  });
  state.galSel = null;
  syncStrategy();
};

/* Opened from a job (?listing=<slug>, Slice 5): job-mode.js runs the brochure from the job
   instead of the property bar. Without it the tool is exactly as it always was. */
const JOB_MODE = (q => q.has('listing') || q.has('pitch') || q.has('draw'))(new URLSearchParams(location.search));

const LIBRARY = {
  blank: resetDocFields,

  /* One address box and no unit box, so the unit travels inside the line the
     agent typed. Splitting it out here keeps the stored record in the shape
     the Showsheet writes without changing anything on the cover; the Unit
     field itself is queued in the address/unit spec. */
  toCore: () => {
    const u = GVC_PROPS.splitUnit(state.address);
    return {
      address: u.address, unit: u.unit,
      city: state.city, state: state.state, zip: state.zip,
      price: state.price, beds: state.beds, baths: state.baths,
      sqft: state.sqft, parking: state.parking,
      listingUrl: state.listingUrl, description: state.blurb,
      features: featureLines(state.features), agentIds: state.agents.slice()
    };
  },

  fromCore: core => {
    // the unit goes back into the address line this cover prints from
    const u = GVC_PROPS.unitOf(core);
    Object.assign(state, {
      address: GVC_PROPS.joinUnit(u.address, u.unit),
      city: core.city || '', state: core.state || '',
      zip: core.zip || '', price: core.price || '', beds: core.beds || '',
      baths: core.baths || '', sqft: core.sqft || '', parking: core.parking || '',
      listingUrl: core.listingUrl || '', blurb: core.description || '',
      features: (core.features || []).join('\n')
    });
    // assigned, not merged: a property with no agents falls back to this
    // builder's own default, never to whoever was on the last listing
    state.agents = (core.agentIds && core.agentIds.length)
      ? core.agentIds.slice(0, MAX_AGENTS) : BLANK.agents.slice();
    document.querySelectorAll('[data-field]').forEach(el => {
      const k = el.dataset.field;
      if (k in state) el.value = state[k];
    });
    renderRoster(); redraw();
  },

  getDoc: () => DOC_KEYS.reduce((doc, k) => { doc[k] = state[k]; return doc; }, {}),

  /* blank() has already emptied the deck, so this only lays a saved brochure
     on top. null means the property has no brochure yet, which is normal: the
     facts fromCore just filled in stay, and the deck stays empty. */
  setDoc: doc => {
    DOC_KEYS.forEach(k => { if (doc && k in doc) state[k] = doc[k]; });
    state.galSel = null;
    /* placeInSlot keeps each single slot to one photo, but a deck saved before
       that could carry two tagged Cover (or Top banner); the later one would
       otherwise end up wherever the strategy dropped it. Free it to auto. */
    ['hero', 'info-top'].forEach(role => state.images.filter(im => im.role === role)
      .slice(1).forEach(im => { im.role = 'auto'; }));
    uid = Math.max(uid, ...state.images.map(i => i.id || 0), ...state.floorplans.map(f => f.id || 0), 0);
    document.querySelectorAll('[data-field]').forEach(el => {
      const k = el.dataset.field;
      if (k in state) el.value = state[k];
    });
    syncPaper(); syncStrategy();
    renderImgList(); renderFpList(); renderGalleryPanel(); redraw(); updateBentoNote();
  }
};
if (!JOB_MODE) GVC_PROPBAR.mount(Object.assign({ host: $('#propBar'), tool: 'brochure' }, LIBRARY));
// webfont metrics change block heights, so re-measure once they land
if (document.fonts && document.fonts.ready) document.fonts.ready.then(checkOverflow);

/* what a job mode works through (Slice 5): the brochure's own state, drawing and image intake */
const fillFields = () => document.querySelectorAll('[data-field]').forEach(el => {
  const k = el.dataset.field;
  if (k in state) el.value = state[k];
});
/* A state from outside (a job, or the helper's drawing), cut to what the brochure knows: each
   key in its own shape, numbers as numbers, words as words, pictures inline only (a whole
   base64 data URL, nothing that could close an attribute). */
const INLINE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
function sanitize(s) {
  const base = structuredClone(BLANK), given = JSON.parse(JSON.stringify(s && typeof s === 'object' ? s : {}));
  Object.keys(given).forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(base, k) || given[k] == null) return;
    if (Array.isArray(base[k]) !== Array.isArray(given[k]) || typeof base[k] !== typeof given[k]) return;
    base[k] = given[k];
  });
  const num = (v, d) => Number.isFinite(+v) && v !== '' && v !== null ? +v : d;
  const str = v => (v == null ? '' : String(v));
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  const ROLE_OK = ROLES.map(r => r[0]);
  base.images = base.images.filter(im => obj(im) && typeof im.url === 'string' && INLINE.test(im.url) && Number.isFinite(+im.id))
    .map(im => ({ id: +im.id, name: str(im.name), url: im.url, ar: num(im.ar, 1.5), role: ROLE_OK.indexOf(im.role) !== -1 ? im.role : 'auto' }));
  base.floorplans = base.floorplans.filter(f => obj(f) && typeof f.url === 'string' && INLINE.test(f.url) && Number.isFinite(+f.id))
    .map(f => ({ id: +f.id, name: str(f.name), url: f.url, label: str(f.label), zoom: num(f.zoom, 1), tx: num(f.tx, 0), ty: num(f.ty, 0) }));
  const cell = c => {
    const o = { id: +c.id };
    ['w', 'fx', 'fy', 'z'].forEach(k => { if (k in c && Number.isFinite(+c[k])) o[k] = +c[k]; });
    if ('label' in c) o.label = str(c.label);
    return o;
  };
  base.gallery = base.gallery.filter(obj).map(pg => ({ rows: (Array.isArray(pg.rows) ? pg.rows : []).filter(obj).map(r => {
    const row = { cells: (Array.isArray(r.cells) ? r.cells : []).filter(c => obj(c) && Number.isFinite(+c.id)).map(cell) };
    if ('h' in r && Number.isFinite(+r.h)) row.h = +r.h;
    return row;
  }) }));
  ['coverPos', 'infoTopPos'].forEach(k => { const p = obj(base[k]) ? base[k] : {}; base[k] = { x: num(p.x, 50), y: num(p.y, 50) }; });
  ['address', 'city', 'state', 'zip', 'price', 'blurb', 'features', 'listingUrl', 'beds', 'baths', 'parking', 'sqft', 'fpNote', 'strategy']
    .forEach(k => { base[k] = str(base[k]); });
  base.agents = base.agents.filter(a => typeof a === 'string').slice(0, MAX_AGENTS);
  base.galCaptions = !!base.galCaptions;
  base.galPage = Math.max(0, Math.floor(num(base.galPage, 0)));
  if (base.paper !== 'half') base.paper = 'letter';
  // one Cover and one Top banner at most, as setDoc keeps it
  ['hero', 'info-top'].forEach(role => base.images.filter(im => im.role === role).slice(1).forEach(im => { im.role = 'auto'; }));
  return base;
}
window.__piece = {
  get state() { return state; },
  blank: () => structuredClone(BLANK), LIBRARY, JOB_MODE, INLINE, sanitize,
  nextId: () => ++uid,
  ready: () => !!builder,
  /* replace the whole state (sanitized), then draw */
  set(s) {
    const base = sanitize(s);
    Object.keys(state).forEach(k => { delete state[k]; });
    Object.assign(state, base);
    state.galSel = null;
    uid = Math.max(uid, ...state.images.map(i => i.id), ...state.floorplans.map(f => f.id), 0);
    fillFields(); syncPaper(); syncStrategy(); renderRoster();
    renderImgList(); renderFpList(); renderGalleryPanel(); redraw(); updateBentoNote();
  },
  redraw, renderImgList, renderFpList, renderGalleryPanel, fillFields, checkOverflow,
  fileToImage, reencode, floorplanHeaderY, trimRect
};

/* ============================================================
   __render(state): draw a given brochure with no network beyond the page's
   own files, then say so (window.__rendered). The helper prints a job's
   brochure this way (helper/pdf/render.js): photos and plans come inline.
   ============================================================ */
window.__render = async function (s) {
  window.__rendered = false; window.__renderError = null;
  try { return await drawGiven(s); }
  catch (e) { window.__renderError = String(e && e.message || e); throw e; }
};
async function drawGiven(s) {
  if (!builder) throw new Error('The brochure page did not finish loading.');
  window.__piece.set(s);
  // every wait is capped: a font or an image that never settles must not hang the helper
  const capped = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  if (document.fonts && document.fonts.ready) await capped(document.fonts.ready, 10000);
  const frame = () => new Promise(r => document.hidden ? setTimeout(r, 0) : requestAnimationFrame(() => r()));
  await frame(); await frame();
  await capped(Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))), 20000);
  redraw(); await frame(); await frame();
  checkOverflow();
  window.__rendered = true;
  return true;
}
