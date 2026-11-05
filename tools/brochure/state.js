/* ============================================================
   tools/brochure/state.js: the brochure's state, the agent roster, the
   gallery layout model (pages of rows of cells), photo roles and the
   shared page footer.

   The Brochure's script is seven classic scripts sharing one global
   scope, loaded in this order by index.html: state.js, gallery.js,
   pages.js, fit.js, photos.js, panel.js, piece.js. Code that runs while a
   file loads may only use what an earlier file defines; functions called
   later may use any.
   ============================================================ */
'use strict';

const $ = s => document.querySelector(s);
const P = window.Pitch, esc = P.esc;
const PD = window.GVC_PHOTODND;
const MONO = '../../assets/logos/monogram-white.svg';
const MONO_NAVY = '../../assets/logos/monogram.svg';

/* The website printed in every footer. Not editable — the footer, the
   social handles and the links are all fixed team boilerplate in all three
   builders, so none of them can print a wrong one. */
const SITE = 'gvcrealestateteam.com';

/* ============================================================
   ROSTER — The Gasdaska Verdiglione Conlon Team
   Selecting an agent fills the page 1 footer and the agent page,
   so contact details are never retyped.
   ============================================================ */
const ROSTER = window.GVC_ROSTER;
// Headshots come from the roster as transparent PNGs, so they sit on the
// closing page's card without a white box behind them. The roster is the
// only source: a per-listing override would drift from the two packages,
// which have never had one.
const headshotFor = a => a.photo;
const MAX_AGENTS = 2;

/* ============================================================
   GALLERY LAYOUT MODEL

   A gallery page is a list of rows; a row is a list of cells. Rows carry a
   height and cells a width, both in proportional fr units, so the page is
   always exactly filled whatever the numbers are. That is the whole trick
   behind free resizing: there is no grid to tile and therefore no way to
   leave a hole or overflow the paper.

     pages: [ { rows: [ { h, cells: [ {id, w, fx, fy, z, label} ] } ] } ]

   A cell's fx/fy are the crop's focal point in per-cent and z its zoom;
   label is the caption printed on the photo.

   PRESETS are written as row shapes — [rowHeight, [cellWidths]] — and are
   only ever starting points: everything is draggable afterwards.
   ============================================================ */
const PRESETS = [
  { n: 1, name: 'Full page',    rows: [[1, [1]]] },
  { n: 2, name: 'Side by side', rows: [[1, [1, 1]]] },
  { n: 2, name: 'Stacked',      rows: [[1, [1]], [1, [1]]] },
  { n: 2, name: 'Wide + strip', rows: [[2, [1]], [1, [1]]] },
  { n: 3, name: 'Hero + pair',  rows: [[2, [1]], [1, [1, 1]]] },
  { n: 3, name: 'Three up',     rows: [[1, [1, 1, 1]]] },
  { n: 3, name: 'Tall + two',   rows: [[1, [1.6, 1]], [1, [1]]] },
  { n: 4, name: 'Quad',         rows: [[1, [1, 1]], [1, [1, 1]]] },
  { n: 4, name: 'Hero + three', rows: [[2, [1]], [1, [1, 1, 1]]] },
  { n: 4, name: 'Big + strip',  rows: [[2, [1.7, 1]], [1, [1, 1]]] },
  { n: 5, name: 'Hero + four',  rows: [[2, [1]], [1, [1, 1, 1, 1]]] },
  { n: 5, name: 'Two + three',  rows: [[1.3, [1, 1]], [1, [1, 1, 1]]] },
  { n: 6, name: 'Six up',       rows: [[1, [1, 1, 1]], [1, [1, 1, 1]]] },
  { n: 6, name: 'Hero + five',  rows: [[1.8, [1.6, 1]], [1, [1, 1, 1, 1]]] }
];

const CELL_MIN = 0.28;     // smallest a cell may be dragged, in fr
const GAL_MAX_PAGES = 6;

function newCell(id) { return { id: id, w: 1, fx: 50, fy: 50, z: 1, label: '' }; }

/* Lay `ids` out using the best-fitting preset — the one whose cell count
   matches, else the largest that does not exceed it, with any remainder
   spilling into a final row. */
function layoutFor(ids, presetName) {
  const pool = ids.slice();
  const opts = PRESETS.filter(p => p.n === pool.length);
  const chosen = (presetName && PRESETS.filter(p => p.name === presetName)[0])
              || opts[0]
              || PRESETS.filter(p => p.n <= pool.length).pop()
              || PRESETS[0];
  const rows = [];
  chosen.rows.forEach(([h, ws]) => {
    const cells = [];
    ws.forEach(w => { if (pool.length) { const c = newCell(pool.shift()); c.w = w; cells.push(c); } });
    if (cells.length) rows.push({ h: h, cells: cells });
  });
  while (pool.length) {                     // leftovers get their own row
    const take = pool.splice(0, Math.min(3, pool.length)).map(newCell);
    rows.push({ h: 1, cells: take });
  }
  return { rows: rows };
}

/* Every cell on a page, flattened, with its row for context. */
function cellsOf(pg) {
  const out = [];
  (pg.rows || []).forEach((row, ri) => (row.cells || []).forEach((c, ci) =>
    out.push({ cell: c, row: row, ri: ri, ci: ci })));
  return out;
}

function galPages() {
  if (!Array.isArray(state.gallery)) state.gallery = [];
  return state.gallery;
}

/* Photo ids are numbers, but every id read back out of the DOM (a cell's
   data-id, a tray row's) arrives as a string, and `===` says 8 is not '8'.
   Every lookup here coerces, so a drop that came from the DOM finds its
   photo instead of silently doing nothing — which is what used to happen
   to every photo-onto-photo swap. */
function findCell(id) {
  id = Number(id);
  const pages = galPages();
  for (let pi = 0; pi < pages.length; pi++) {
    const hit = cellsOf(pages[pi]).filter(x => x.cell.id === id)[0];
    if (hit) return Object.assign({ pi: pi, page: pages[pi] }, hit);
  }
  return null;
}

/* Drop a cell, and tidy up after it: an empty row goes, and an empty page
   goes too unless it is the only one. */
function removeCell(id) {
  const hit = findCell(id);
  if (!hit) return;
  hit.row.cells.splice(hit.ci, 1);
  if (!hit.row.cells.length) hit.page.rows.splice(hit.ri, 1);
  if (!hit.page.rows.length && galPages().length > 1) galPages().splice(hit.pi, 1);
}

/* ============================================================
   PHOTO PLACEMENT
   Every photo has a role. 'auto' lets the chosen strategy decide;
   anything else is an explicit override the strategy won't touch.
   ============================================================ */
const ROLES = [
  ['auto',        'Auto'],
  ['hero',        'Cover'],
  ['gallery',     'Gallery'],
  ['info-top',    'Info · top banner'],
  ['exclude',     'Unused']
];
// aspect ratio each single slot wants, used by the "by shape" strategy
const SLOT_AR = { hero: 0.77, infoTop: 1.70 };

const state = {
  images: [],            // {id,name,url,ar,role}
  strategy: 'sequence',
  /* one entry per gallery page — see the GALLERY LAYOUT MODEL block */
  gallery: [],
  galCaptions: true,
  galPage: 0,            // which gallery page the editor is working on
  galSel: null,          // id of the selected cell, if any
  // page 1
  address: '', city: '', state: '', zip: '',
  // agents
  agents: [],

  // page 3
  price: '', blurb: '', features: '', listingUrl: '',
  beds: '', baths: '', parking: '', sqft: '',
  coverPos: { x: 50, y: 50 }, infoTopPos: { x: 50, y: 50 },
  // floor plans
  floorplans: [],        // {id,name,url,label}
  fpNote: window.GVC_LEGAL.FLOORPLAN,
  // output paper — 'letter' (8.5 x 11) or 'half' (5.5 x 8.5). See the
  // PAPER SIZE block in the head styles.
  paper: 'letter',
};

/* What a brochure looks like before any property is loaded. The reset a
   property switch performs is derived from this rather than hand-listed, so a
   field added above is covered the day it is added — a hand-list is how the
   previous listing's marketing strategy and floor-plan note came to survive
   onto the next one. */
const BLANK = structuredClone(state);

let uid = 0, builder = null;
let assign = { hero: null, infoTop: null, gallery: [] };

/* ---------------- helpers ---------------- */
/* Escaping is Pitch's (esc, above) — the same one both decks use.
   featureLines is deliberately not Pitch.lines: that escapes a textarea into
   one <br>-joined run of HTML, this splits it into the separate strings
   page 2 bullets and the saved core facts each need. */
/* A drag, a button or a dropped file fires no input event, so the unsaved-work
   prompt (assets/js/unsaved.js) never heard about it. Every gesture that changes
   the deck calls this. */
const edited = () => GVC_UNSAVED.touch();
const featureLines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
/* QR as vector SVG so it stays crisp at any print size — one shared
   implementation for all four builders, in assets/js/qr.js. */
const qrSvg = window.GVC_QR;
const cityLine = () => {
  const cs = [state.city, state.state].filter(Boolean).join(', ');
  return [cs, state.zip].filter(Boolean).join(' ');
};
const agentObjs = () => state.agents.map(id => ROSTER.find(a => a.id === id)).filter(Boolean);

/* Shared running footer — site, monogram, page N/of M — identical to the
   Seller Package and Buyer Package's pg-foot. `dark` picks the white
   monogram and light-on-dark text for a navy page; light pages get the
   navy monogram instead. */
function pageFoot(n, of, dark) {
  return '<div class="pg-foot' + (dark ? ' rev' : '') + '">' +
    '<span class="site">' + esc(SITE) + '</span>' +
    '<img class="pg-mono" src="' + (dark ? MONO : MONO_NAVY) + '" alt="">' +
    '<span class="pg-n">' + n + ' / ' + of + '</span>' +
  '</div>';
}
