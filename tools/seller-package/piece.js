/* ============================================================
   tools/seller-package/piece.js: the deck opened from a job. window.__piece
   (state, sanitize, set) for job-mode.js, and window.__render, which the
   helper prints a job's deck through (helper/pdf/render.js). Last of the
   five scripts (see content.js).
   ============================================================ */
'use strict';

/* Opened from a job (?listing=<slug> or ?pitch=<slug>, Slice 5): job-mode.js runs the deck from
   the job instead of the property bar; ?draw=1 is the helper drawing a job's deck. Without any
   of them the tool is exactly as it always was. */
const JOB_MODE = (q => q.has('listing') || q.has('pitch') || q.has('draw'))(new URLSearchParams(location.search));

/* A deck from outside (a job, or the helper's drawing), cut to what the deck knows: each key in
   its own shape, numbers as numbers, words as words, pictures inline only (a whole base64 data
   URL, nothing that could close an attribute). */
const INLINE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
function sanitize(s) {
  const base = structuredClone(BLANK), given = JSON.parse(JSON.stringify(s && typeof s === 'object' ? s : {}));
  Object.keys(given).forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(base, k) || given[k] == null || k === 'map' || k === 'videos' || k === 'reviews') return;
    if (Array.isArray(base[k]) !== Array.isArray(given[k]) || typeof base[k] !== typeof given[k]) return;
    base[k] = given[k];
  });
  const num = (v, d) => Number.isFinite(+v) && v !== '' && v !== null ? +v : d;
  const str = v => (v == null ? '' : String(v));
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  const ROLE_OK = ROLES.map(r => r[0]);
  base.photos = base.photos.filter(p => obj(p) && typeof p.url === 'string' && INLINE.test(p.url) && Number.isFinite(+p.id))
    .map(p => ({ id: +p.id, name: str(p.name), url: p.url, role: ROLE_OK.indexOf(p.role) !== -1 ? p.role : 'auto' }));
  base.map = obj(given.map) && typeof given.map.url === 'string' && INLINE.test(given.map.url) ? { name: str(given.map.name || 'map'), url: given.map.url } : null;
  ['videos', 'reviews'].forEach(k => { base[k] = Array.isArray(given[k]) ? given[k].filter(x => typeof x === 'string') : null; });
  base.agents = base.agents.filter(a => typeof a === 'string').slice(0, 2);
  // comp rows keep their keys, every value as words (the deck escapes and reads them itself)
  base.comps = base.comps.filter(obj).map(c => {
    const o = {};
    Object.keys(c).forEach(k => { if (typeof c[k] === 'string' || typeof c[k] === 'number') o[k] = String(c[k]); });
    return o;
  });
  const pos = {};
  if (obj(base.pos)) Object.keys(base.pos).forEach(k => { const p = base.pos[k]; if (obj(p)) pos[k] = { x: num(p.x, 50), y: num(p.y, 50) }; });
  base.pos = pos;
  ['address', 'city', 'state', 'zip', 'beds', 'baths', 'sqft', 'ptype', 'year', 'taxes', 'cc', 'blurb', 'features', 'client', 'date',
    'priceLow', 'priceMid', 'priceHigh'].forEach(k => { base[k] = str(base[k]); });
  if (['low', 'mid', 'high'].indexOf(base.recBand) === -1) base.recBand = 'mid';
  base.showProperty = base.showProperty !== false;
  base.version = P.versionId(base.version);  /* old 'marli'/'james' saves map to roster ids */
  if (base.market !== 'nj') base.market = 'nyc';
  return base;
}

/* what a job mode works through: the deck's own state, drawing and picture intake */
window.__piece = {
  get state() { return state; },
  blank: () => structuredClone(BLANK), JOB_MODE, INLINE, sanitize,
  nextId: () => ++uid,
  ready: () => !!builder,
  /* replace the whole deck (sanitized), then draw */
  set(s) {
    if (!builder) throw new Error('The Seller Package page has not finished loading.');
    const base = sanitize(s);
    Object.keys(state).forEach(k => { delete state[k]; });
    Object.assign(state, base);
    uid = Math.max(uid, ...state.photos.map(p => p.id), 0);
    document.querySelectorAll('[data-f]').forEach(el => { el.value = state[el.dataset.f] || ''; });
    paintPhotos(); paintMap(); renderComps(); paintRoster(); paintProp(); paintVersion();
    paintMarket(); paintVideoPick(); wireReviewPick(); paintPickModes(); redraw();
  },
  redraw, paintPhotos, paintMap, renderComps, checkAll,
  fileToImage: f => window.GVC_IMAGES.fileToImage(f), reencode: (img, edge, q) => window.GVC_IMAGES.reencode(img, edge, q)
};

/* ============================================================
   __render(state): draw a given deck with no network beyond the page's own
   files, then say so (window.__rendered). The helper prints a job's seller
   pitch this way (helper/pdf/render.js): its photos and map come inline.
   ============================================================ */
window.__render = async function (s) {
  window.__rendered = false; window.__renderError = null;
  try { return await drawGiven(s); }
  catch (e) { window.__renderError = String(e && e.message || e); throw e; }
};
async function drawGiven(s) {
  const capped = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  const frame = () => new Promise(r => document.hidden ? setTimeout(r, 0) : requestAnimationFrame(() => r()));
  for (let i = 0; i < 100 && !builder; i++) await new Promise(r => setTimeout(r, 50));
  window.__piece.set(s);
  if (document.fonts && document.fonts.ready) await capped(document.fonts.ready, 10000);
  await frame(); await frame();
  await capped(Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))), 20000);
  redraw(); await frame(); await frame();
  checkAll();
  window.__rendered = true;
  return true;
}
