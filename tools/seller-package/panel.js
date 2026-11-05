/* ============================================================
   tools/seller-package/panel.js: drawing the deck (redraw, the overflow
   checks) and the side panel: fields, comps, pickers, photos, map, and the
   property bar. Fourth of the five scripts (see content.js).
   ============================================================ */
'use strict';

/* ============================================================
   WIRING
   ============================================================ */
let builder = null;

function redraw() {
  if (!builder) return;
  P.runHead = 'The GVC Team / Listing Presentation';
  reassign();
  /* the property page is optional, so dropping it has to renumber every
     page after it and the running footers along with them */
  PAGES = pageList(); OF = PAGES.length;
  if (builder.state.pages !== PAGES.length) builder.setPages(PAGES.length);
  else builder.rebuild();
  paintPhotos();
  PD.wireReframe(document.getElementById('pages'), state.pos, REFRAME);
  paintSlotGrips();
  // setTimeout, not rAF: rAF is suspended while the tab is not rendering,
  // which silently skips the overflow check.
  setTimeout(checkAll, 0);
}

const RULES = [
  { key:'comps',    box:'warnComps',   msg:'Comparable sales run past the page — remove one, or shorten the longest address.' },
  { key:'property', box:'warnProperty',msg:'The property page is over-full — shorten the description or cut a feature.' },
  { key:'strategy', box:'warnStrategy',msg:'The strategy page is over-full — a price is running onto a second line.' },
  { key:'videos',   box:'warnVideos',  msg:'Video cards run past the page — untick one.' },
  { key:'reviews',  box:'warnReviews', msg:'Testimonials run past the page — untick one, or pick shorter quotes.' }
];
/* Runs after the pages are in the DOM and again once the webfonts have
   landed. Both matter to the cover — see Pitch.fitCover() for why. */
function checkAll() {
  P.fitCover();
  P.checkOverflow(document.getElementById('pages'), RULES, 'warnGeneral');
}

/* Set by the property library's mount, below — the State field has to be
   able to move the market toggle, and bindFields runs before that exists. */
let syncMarketToState = () => {};

function bindFields() {
  document.querySelectorAll('[data-f]').forEach(el => {
    const k = el.dataset.f;
    el.value = state[k] || '';
    el.addEventListener('input', () => {
      state[k] = el.value;
      /* Typing NJ in the State field lands the toggle on New Jersey without
         it having to be found. Only the State field does this, and only
         while it reads as one of the two — clearing it leaves the toggle
         where it was rather than snapping back. */
      if (k === 'state') syncMarketToState();
      redraw();
    });
  });
}

/* comps are a repeating row, so they get their own tiny list editor */
function renderComps() {
  // the editor itself is shared with the other package — pitch.js
  P.compsEditor(document.getElementById('compList'), state.comps, redraw);
}

function renderThumbs(hostId, arr, onRemove) {
  const host = document.getElementById(hostId);
  host.innerHTML = '';
  arr.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    const img = document.createElement('img'); img.src = p.url; img.alt = '';
    const b = document.createElement('button'); b.type = 'button'; b.textContent = '×';
    b.addEventListener('click', () => { onRemove(i); });
    d.appendChild(img); d.appendChild(b); host.appendChild(d);
  });
}

/* The two segmented picks in the panel — which of the three ranges carries
   the star, and whether the property page prints at all. Both are the
   shared P.segPick(), which hands back a repaint function so the buttons
   can be re-synced with state after a property is loaded rather than being
   left showing the last document's answer. */
let paintRoster = () => {}, paintProp = () => {}, paintVersion = () => {};
/* The market seg, and the two grouped tick lists. The tick lists are rebuilt
   rather than merely repainted when their groups change — the testimonial
   groups follow whichever agents are picked, so the subheads themselves move. */
let paintMarket = () => {}, paintVideoPick = () => {}, wireReviewPick = () => {};

document.addEventListener('DOMContentLoaded', () => {
  GVC_LOOK.wire(document.getElementById('lookPick'), () => redraw());
  bindFields();
  renderComps();

  P.wireDrop(document.getElementById('dropPhotos'), document.getElementById('filePhotos'), files => {
    files.forEach(f => state.photos.push({ id: ++uid, name: f.name, url: f.url, role: 'auto' }));
    redraw(); GVC_UNSAVED.touch();
  });
  P.wireDrop(document.getElementById('dropMap'), document.getElementById('fileMap'), files => {
    state.map = files[0];
    paintMap(); redraw(); GVC_UNSAVED.touch();
  });

  /* A following testimonial selection is derived from the agents, so the
     roster has to rebuild the picker rather than just redraw the page. A
     manual selection is left alone, which is the whole point of the mode. */
  paintRoster = P.wireRoster(document.getElementById('rosterPick'), state, 2,
    () => {
      /* hand-picking agents leaves the version's own choice behind */
      const v = P.versionId(state.version);
      if (v && (state.agents.length !== 1 || state.agents[0] !== v)) { state.version = ''; paintVersion(); }
      wireReviewPick(); paintPickModes(); redraw();
    });
  /* The Version pick: any roster agent. That agent alone goes on the deck (one
     agent, inside the Agents section's limit of two: cover + closing), and the
     deck moves to their market when it is one this deck prints (NJ or NYC). */
  paintVersion = P.versionPick(document.getElementById('versionPick'),
    () => P.versionId(state.version),
    v => {
      state.version = v = P.versionId(v);
      if (v) {
        state.agents = [v];
        const m = (GVC_AGENT(v).market || '').toLowerCase();
        if (m === 'nj' || m === 'nyc') state.market = m;
      }
      paintRoster(); paintMarket(); paintVideoPick(); wireReviewPick(); paintPickModes(); redraw(); GVC_UNSAVED.touch();
    });

  document.getElementById('addComp').addEventListener('click', () => {
    state.comps.push(P.blankComp());
    renderComps(); redraw();
  });
  paintProp = P.segPick(document.getElementById('propPick'), 'on',
    () => (state.showProperty ? '1' : '0'),
    v => { state.showProperty = v === '1'; redraw(); });

  /* ---------- the market toggle ----------
     Changing it repaints the video ticks, because the films on offer are
     that market's three whenever the selection is still following. A manual
     selection is left exactly as it is. */
  paintMarket = P.segPick(document.getElementById('marketPick'), 'market',
    () => state.market,
    v => { state.market = v; paintVideoPick(); paintPickModes(); redraw(); });

  /* ---------- which films print ----------
     One tick list per market, so the panel reads the way the library does.
     Ticking anything at all takes the selection off the market toggle: the
     ticks become the answer, and "Reset to market" hands it back. */
  const wireVideoGroup = (hostId, market) => P.tickList(document.getElementById(hostId),
    VIDEOS.filter(v => v.market === market).map(v => [v.id, v.title]),
    id => videoIds().indexOf(id) > -1,
    (id, on) => {
      const now = videoIds();
      state.videos = VIDEOS
        .filter(v => (v.id === id ? on : now.indexOf(v.id) > -1))
        .map(v => v.id);
      paintVideoPick(); paintPickModes(); redraw();
    });
  const paintNyc = wireVideoGroup('vidPickNyc', 'nyc');
  const paintNj  = wireVideoGroup('vidPickNj', 'nj');
  paintVideoPick = () => { paintNyc(); paintNj(); };

  const setVideos = ids => { state.videos = ids; paintVideoPick(); paintPickModes(); redraw(); };
  document.getElementById('vidAllNyc').addEventListener('click',
    () => setVideos(VIDEOS.filter(v => v.market === 'nyc').map(v => v.id)));
  document.getElementById('vidAllNj').addEventListener('click',
    () => setVideos(VIDEOS.filter(v => v.market === 'nj').map(v => v.id)));
  document.getElementById('vidFollow').addEventListener('click', () => setVideos(null));

  /* ---------- which testimonials print ----------
     Grouped by agent, an agent per subhead, with the reviews that name
     nobody under Team. Only the picked agents get a group: the whole roster
     would be twelve subheads, most of them empty. Rebuilt rather than
     repainted whenever the agents change, since the subheads move with them. */
  wireReviewPick = () => {
    const host = document.getElementById('revPick');
    host.replaceChildren();
    const mine = agents()
      .map(a => [a.name, REVIEWS.filter(r => r.agents.indexOf(a.id) > -1)]);
    /* a generic review lent to a picked agent shows under that agent only */
    const lent = mine.reduce((all, g) => all.concat(g[1]), []);
    const groups = mine
      .concat([['Team', REVIEWS.filter(r => teamReview(r) && lent.indexOf(r) < 0)]])
      .filter(g => g[1].length);
    /* Whatever a picked agent has no group for still has to be reachable,
       or a following selection could show ticks the panel cannot untick. */
    const shown = groups.reduce((all, g) => all.concat(g[1]), []);
    const rest = REVIEWS.filter(r => shown.indexOf(r) < 0);
    if (rest.length) groups.push(['Other reviews', rest]);
    groups.forEach(([name, rs]) => {
      const field = document.createElement('div'); field.className = 'field';
      const lab = document.createElement('label'); lab.textContent = name;
      const box = document.createElement('div');
      field.append(lab, box); host.appendChild(field);
      P.tickList(box, rs.map(r => [r.id, r.who, r.quote.slice(0, 72) + '…']),
        id => reviewIds().indexOf(id) > -1,
        (id, on) => {
          const now = reviewIds();
          state.reviews = REVIEWS
            .filter(r => (r.id === id ? on : now.indexOf(r.id) > -1))
            .map(r => r.id);
          wireReviewPick(); paintPickModes(); redraw();
        });
    });
  };
  wireReviewPick();
  document.getElementById('revFollow').addEventListener('click', () => {
    state.reviews = null; wireReviewPick(); paintPickModes(); redraw();
  });
  paintPickModes();

  builder = Builder.init({
    pages: PAGES.length,
    label: 'Page',
    printName: () => {
      const addr = String(state.address || '').trim();
      return addr ? 'Seller Package - ' + addr : 'Seller Package';
    },
    render: (page, i) => {
      page.innerHTML = RENDER[PAGES[i].key](i + 1, PAGES[i]);
      // tag the rendered page so the overflow check can name it
      const pg = page.querySelector('.pg');
      if (pg) { pg.dataset.key = PAGES[i].key; pg.dataset.n = String(i + 1); pg.dataset.market = state.market; }
    }
  });
  document.fonts && document.fonts.ready.then(() => setTimeout(checkAll, 0));
  setTimeout(checkAll, 0);
  /* the browser asks before a reload throws unsaved work away */
  GVC_UNSAVED.watch();

  /* ============================================================
     THE PROPERTY LIBRARY

     The price band is deliberately not a shared fact: a CMA is what you
     bring to a seller who has not set a price yet, so low/mid/high stays
     in this document and never becomes the property's asking price.
     ============================================================ */
  /* market is the arguable one: a listing's market looks like a fact about
     the house. It stays document-only deliberately, because what it selects
     is verbiage for one presentation, and the property record already
     carries the real fact in its state field — which is what the toggle
     derives its default from. */
  const DOC_ONLY = ['client','date','photos','map','priceLow','priceMid','priceHigh',
                    'recBand','showProperty','pos','agents','market','videos','reviews','version'];

  /* Called before a property's facts are applied — see property-bar's open().
     Every document field goes back to blank; fromCore then re-establishes the
     roster from the property, falling back to this deck's own default rather
     than to whoever was on the last one. Cloned, or photos and comps would be
     shared with the blank and edited through it. */
  const resetDocFields = () => {
    DOC_ONLY.forEach(k => { state[k] = structuredClone(BLANK[k]); });
    // a shared fact the next property may not carry at all: comps for the
    // wrong listing is the worst thing this deck can print
    state.comps = [];
  };

  /* NY gives New York, NJ gives New Jersey, anything else leaves the toggle
     where it is. A deck with no property yet starts on New York: the firm is
     New York-headquartered and the plan page already reads that way. */
  const marketFromState = () => {
    const st = String(state.state || '').trim().toUpperCase();
    return st === 'NJ' ? 'nj' : st === 'NY' ? 'nyc' : null;
  };
  syncMarketToState = () => {
    const m = marketFromState();
    if (!m || m === state.market) return;
    state.market = m;
    paintMarket(); paintVideoPick(); paintPickModes();
  };

  /* the features box is one per line; P.lines() renders them, it does not
     split them */
  const splitLines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);

  const LIBRARY = {
    blank: resetDocFields,

    /* This deck has one address box and no unit box, so the unit travels
       inside the line the agent typed. Splitting it out here keeps the stored
       record in the same shape the Showsheet writes — one property, address
       and unit in their own keys — without changing anything on the cover.
       The Unit field itself is queued in the address/unit spec. */
    toCore: () => {
      const u = GVC_PROPS.splitUnit(state.address);
      return {
        address: u.address, unit: u.unit,
        city: state.city, state: state.state, zip: state.zip,
        beds: state.beds, baths: state.baths, sqft: state.sqft,
        propertyType: state.ptype, yearBuilt: state.year,
        taxesMonthly: state.taxes, commonCharges: state.cc,
        description: state.blurb, features: splitLines(state.features),
        agentIds: state.agents.slice(), comps: state.comps
      };
    },

    fromCore: core => {
      // the unit goes back into the address line this deck prints from
      const u = GVC_PROPS.unitOf(core);
      Object.assign(state, {
        address: GVC_PROPS.joinUnit(u.address, u.unit),
        city: core.city || '', state: core.state || '',
        zip: core.zip || '', beds: core.beds || '', baths: core.baths || '',
        sqft: core.sqft || '', ptype: core.propertyType || '', year: core.yearBuilt || '',
        taxes: core.taxesMonthly || '', cc: core.commonCharges || '',
        blurb: core.description || ''
      });
      state.features = (core.features || []).join(String.fromCharCode(10));
      /* assigned, not merged: a property with no comps has to show none. The
         guard that used to be here left the last listing's comparable sales
         standing under the new seller's name. */
      state.comps = (core.comps && core.comps.length) ? core.comps : [];
      state.agents = (core.agentIds && core.agentIds.length)
        ? core.agentIds.slice(0, 2) : BLANK.agents.slice();
      /* The market is not set here: setDoc runs immediately after this and
         owns it, so that a deck saved with a deliberate market keeps it
         rather than being snapped back to whatever the State field says. */
      document.querySelectorAll('[data-f]').forEach(el => { el.value = state[el.dataset.f] || ''; });
      renderComps(); paintRoster(); paintMarket(); paintVideoPick();
      wireReviewPick(); paintPickModes(); redraw();
    },

    getDoc: () => DOC_ONLY.reduce((doc, k) => { doc[k] = state[k]; return doc; }, {}),

    setDoc: doc => {
      /* blank() has already put every document field back, so this only lays a
         saved deck on top. The market is the one field that cannot come from
         the blank: it is derived from the property's State, which fromCore has
         just filled in. A deck saved before these four existed has no answer
         for them either, so they are set here and then overridden by the
         document if it carries one. */
      state.showProperty = true;
      state.market = marketFromState() || 'nyc';
      state.videos = null;
      state.reviews = null;
      if (doc) DOC_ONLY.forEach(k => { if (k in doc) state[k] = doc[k]; });
      uid = Math.max(uid, ...state.photos.map(p => p.id || 0), 0);
      document.querySelectorAll('[data-f]').forEach(el => { el.value = state[el.dataset.f] || ''; });
      paintPhotos(); paintMap(); renderComps(); paintRoster(); paintProp(); paintVersion();
      paintMarket(); paintVideoPick(); wireReviewPick(); paintPickModes(); redraw();
    }
  };
  window.__piece.LIBRARY = LIBRARY;
  if (!JOB_MODE) GVC_PROPBAR.mount(Object.assign({ host: document.getElementById('propBar'), tool: 'seller' }, LIBRARY));
});

/* The two pickers say which mode they are in, because "3 of 3" alone does
   not tell you whether the answer will move when you change market or
   agents. Both hints count what will actually print, so a selection with a
   stale id in it reads honestly. */
function paintPickModes() {
  const nV = chosenVideos().length, nR = chosenReviews().length;
  document.getElementById('vidHint').textContent = nV + ' of ' + VIDEO_SLOTS;
  document.getElementById('revHint').textContent = nR + ' of ' + REVIEW_SLOTS;
  const market = (MARKETS.filter(m => m[0] === state.market)[0] || MARKETS[0])[1];
  document.getElementById('vidMode').textContent = state.videos === null
    ? 'Following the market — showing the ' + market + ' films.'
    : 'Manual. Reset to market hands the choice back to the ' + market + ' films.';
  document.getElementById('revMode').textContent = state.reviews === null
    ? (agents().length
        ? 'Following your agents — changing them refills these.'
        : 'Following your agents — pick some, or these fill from the team reviews.')
    : 'Manual. Changing your agents no longer moves these.';
}

function paintPhotos() {
  PD.tray(document.getElementById('imgList'), state.photos, {
    idOf: img => img.id,
    onGrab: (e, img) => beginPhotoDnD(e, img, 'tray'),
    badgeOf: img => {
      const place = P.placementOf(img, assign, ROLES);
      return {
        text: place.text, cls: place.cls,
        title: (img.role && img.role !== 'auto')
          ? 'Placed by hand — click to change'
          : 'Placed automatically — click to pin it somewhere'
      };
    },
    onBadge: (img, badge) => PD.menu(badge, ROLES, value => {
      if (value === 'auto' || value === 'exclude') { img.role = value; redraw(); }
      else placeInRole(img, value);
    }, img.role || 'auto'),
    onRemove: img => { state.photos = state.photos.filter(x => x.id !== img.id); redraw(); },
    removeTitle: 'Remove this photo from the deck',
    note: document.getElementById('imgNote'),
    hint: 'Drag a thumbnail onto any photo slot in the preview. ' +
          'Drag a photo off a page and onto this list to take it out.'
  });
}
function paintMap() {
  renderThumbs('thumbsMap', state.map ? [state.map] : [], () => {
    state.map = null; paintMap(); redraw();
  });
}
