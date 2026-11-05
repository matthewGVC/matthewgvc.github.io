/* ============================================================
   tools/showsheet/piece.js: saving to the property library (the property
   bar), window.__sheet for job mode (job-mode.js), window.__render, which
   the helper prints a job's sheet through (helper/pdf/render.js), and the
   test hooks (window.__test). Last of the eight scripts (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   THE PROPERTY LIBRARY

   Which of this sheet's fields are shared facts, and how to put the sheet
   itself back. Everything about saving, loading, photos and the team
   password lives in the shared module.

   Two spellings need care here. A unit is part of the address in the
   library — one address is one property — but the sheet keeps it in its
   own field, so it is joined on the way out and split on the way back.
   And the sheet thinks in borough plus neighborhood where the other tools
   think in city, state, zip: core carries both and neither is invented
   from the other.
   ============================================================ */
const CORE_ONLY = ['address','unit','borough','neighborhood','price','beds','baths',
                   'listingUrl','positioning','maintenance','commonCharges','taxesMonthly',
                   'ownership','agentIds'];

/* What a sheet looks like before any property is loaded. Every reset is built
   from blankUnit() rather than hand-listed, so a field added there is covered
   the day it is added — a hand-list is exactly how the Web ID, assessments,
   maxFinancing and the flip tax came to survive a property switch and print on
   the next listing's sheet. */
const BLANK_DOC = blankUnit();

/* what property-bar calls before a property's facts go on */
function resetDocFields(){ state = freshListing(); coreMarket = null; }
/* the market the loaded property's address says, which a saved sheet's own pick never overrides */
let coreMarket = null;

/* Nothing is kept in this browser any more, so the tab has to ask before it
   closes on unsaved work — the same warning the other three builders give.
   property-bar clears the marker after a save and after a load. */
GVC_UNSAVED.watch();

/* named, so the test hooks can run a save and a load without a network */
const LIBRARY = {
  blank: resetDocFields,

  toCore: () => ({
    address: String(state.address || '').trim(),
    unit: String(state.unit || '').trim(),
    borough: state.borough, neighborhood: state.neighborhood,
    price: state.price, beds: state.beds, baths: state.baths,
    ownership: state.ownership, listingUrl: state.listingUrl,
    description: state.positioning,
    maintenance: state.maintenance, commonCharges: state.commonCharges,
    taxesMonthly: state.taxesMonthly,
    yearBuilt: state.building && state.building.builtYear,
    features: (state.residence && state.residence.features) || [],
    agentIds: (state.agentIds || []).slice()
  }),

  fromCore: core => {
    /* One place decides what a record means — an older one still carries its
       unit inside the address line, a newer one keeps it in its own key. */
    const split = GVC_PROPS.unitOf(core);
    state.address = split.address;
    state.unit = split.unit;
    state.borough = core.borough || core.city || '';
    state.neighborhood = core.neighborhood || '';
    /* assigned, not merged: a field this property does not carry has to go
       blank, or the last listing's maintenance and taxes quietly print on
       the next one's sheet */
    ['price','beds','baths','ownership','listingUrl','maintenance','commonCharges','taxesMonthly']
      .forEach(k => { state[k] = core[k] || ''; });
    state.positioning = core.description || '';
    state.building.builtYear = core.yearBuilt || '';
    // the other builders read the shared feature list; a showsheet started on
    // a property made elsewhere should too (a saved sheet's own list still wins)
    if (Array.isArray(core.features) && core.features.length) state.residence.features = core.features.slice();
    // the roster is team-level and carries between listings on purpose; a
    // property with no agents falls back to the default pair, not the last one's
    // a property that knows its state or zip is in that market; else New York, as before
    coreMarket = (core.state || core.zip) ? GVC_LEGAL.marketOf(core) : null;
    if (coreMarket) state.market = coreMarket;
    state.agentIds = (core.agentIds && core.agentIds.length)
      ? core.agentIds.slice() : BLANK_DOC.agentIds.slice();
    hydrateForm(); render();
  },

  /* everything that is not a shared fact: the sheet's own copy, its photos
     and its floor plan */
  getDoc: () => {
    const doc = JSON.parse(JSON.stringify(state));
    CORE_ONLY.forEach(k => delete doc[k]);
    delete doc.disclaimer;                 // code-controlled, never stored
    return doc;
  },

  /* blank() has already started a fresh listing, so this only lays a saved
     sheet on top of it. A property with no showsheet yet
     needs nothing further — it already has the blank. */
  setDoc: doc => {
    if (doc) {
      /* fromCore has just filled these from the shared facts. They live inside
         building and residence, which the saved sheet carries whole, so laying
         the sheet down would put back whatever year was typed when it was last
         saved — a Year Built corrected in another tool reverted every time this
         sheet was opened. The property's value wins; an older property that
         never had one keeps the sheet's. */
      const built = state.building.builtYear;
      const coreFeats = state.residence.features;
      // only fields this build knows (plus the old back-photo shape migratePhotos folds in);
      // anything else an older sheet carried would ride along into every later save
      Object.keys(doc).forEach(k => {
        if (CORE_ONLY.indexOf(k) === -1 && (k in BLANK_DOC || k === 'secondaryPhoto')) state[k] = doc[k];
      });
      // merged over the blank so a sheet saved before a key existed still has it
      state.building = Object.assign(structuredClone(BLANK_DOC.building), state.building);
      state.residence = Object.assign(structuredClone(BLANK_DOC.residence), state.residence);
      if (built) state.building.builtYear = built;
      if (!(state.residence.features || []).some(f => String(f).trim()) && coreFeats.length) {
        state.residence.features = coreFeats.slice();
      }
      migratePhotos();
    }
    if (coreMarket) state.market = coreMarket;
    settleMarket();
    hydrateForm(); render();
  }
};
/* Opened from a job (?listing=<slug>, Slice 4): job-mode.js runs the sheet from the job instead
   of the property bar. Without it the tool is exactly as it always was. */
const JOB_MODE = new URLSearchParams(location.search).has('listing');
if (!JOB_MODE) GVC_PROPBAR.mount(Object.assign({ host: $('#propBar'), tool: 'showsheet' }, LIBRARY));

/* what job-mode.js works through: the sheet's own state, drawing and image intake */
window.__sheet = {
  get state(){ return state; },
  set state(s){ state = s; hydrateForm(); render(); },
  blankUnit, hydrateForm, render, LIBRARY, renderTray, syncDropZones, normFpView, toast, edited,
  fileToImage, reencode, floorplanHeaderY, trimRect, setFloorplanFile, printSheet, ESSENTIALS: () => ESSENTIALS
};

/* ============================================================
   __render(state): draw a given sheet with no network beyond the page's own
   files, then say so (window.__rendered). The helper prints a job's sheet this
   way (helper/pdf/render.js): the state carries its photos and plans inline.
   ============================================================ */
window.__render = async function(s){
  window.__rendered = false; window.__renderError = null;
  try { return await drawGiven(s); }
  catch(e){ window.__renderError = String(e && e.message || e); throw e; }
};
async function drawGiven(s){
  const base = blankUnit(), given = JSON.parse(JSON.stringify(s && typeof s === 'object' ? s : {}));
  // only keys the sheet knows, each in the shape it expects (a null list or a string building can't break it)
  Object.keys(given).forEach(k => {
    if(!Object.prototype.hasOwnProperty.call(base, k) || given[k] == null) return;
    if(Array.isArray(base[k]) !== Array.isArray(given[k])) return;
    if(base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && (typeof given[k] !== 'object' || Array.isArray(given[k]))) return;
    base[k] = given[k];
  });
  state = base;
  state.building = Object.assign(blankUnit().building, state.building);
  state.residence = Object.assign(blankUnit().residence, state.residence);
  // pictures come inline only: an address elsewhere (another host, a file) is dropped, never fetched
  // a whole base64 data URL: nothing after the prefix may close the attribute it is drawn into
  const inline = v => typeof v === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(v);
  state.photos = state.photos.filter(p => p && inline(p.src));
  if(!inline(state.floorplan)) state.floorplan = null;
  if(!inline(state.floorplan2)) state.floorplan2 = null;
  state.floorplanView = normFpView(state.floorplanView);
  state.floorplan2View = normFpView(state.floorplan2View);
  settleMarket();
  hydrateForm();
  // every wait is capped: a font or an image that never settles must not hang the helper
  const capped = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  await capped(artReady, 10000);
  if(document.fonts && document.fonts.ready) await capped(document.fonts.ready, 10000);
  const frame = () => new Promise(r => document.hidden ? setTimeout(r, 0) : requestAnimationFrame(() => r()));
  render(); await frame(); await frame();
  await capped(Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))), 20000);
  render(); await frame(); await frame();
  window.__rendered = true;
  return true;
}

/* test hooks (harmless in production) */
window.__test = {
  get state(){ return state; },
  set state(s){ state = s; hydrateForm(); render(); },
  render, hydrateForm,
  /* what property-bar calls before a property's facts are applied — exposed so
     a test can prove a switch leaves nothing of the last listing behind */
  resetDocFields, BLANK_DOC, CORE_ONLY, LIBRARY,
  /* takes parsed blocks rather than a .docx, so the reset rule can be tested
     without building a Word file */
  applyParsedDocx,
  async addPhotoDataUrl(dataUrl){
    state.photos = [{src:dataUrl, fx:50, fy:50, name:'Photo'}];
    state.heroIndex = 0; state.secondaryIndex = null;
    renderTray(); syncDropZones(); render();
  },
  placePhoto, unusePhoto, renderTray, migratePhotos,
  setFloorplanDataUrl(dataUrl, slot){
    if(slot === 1){ state.floorplan2 = dataUrl; state.floorplan2View = normFpView(null); }
    else state.floorplan = dataUrl;
    syncDropZones(); render();
  },
  /* the real upload path — header crop and margin trim included */
  setFloorplanFile, textFit: () => textFit, TEXT_SECTIONS,
  async importDocxBuffer(buf){
    const {value:html} = await mammoth.convertToHtml({arrayBuffer:buf});
    const found = applyParsedDocx(GVC_LISTING.blocksFromHtml(html));
    hydrateForm(); render();
    return found;
  }
};
