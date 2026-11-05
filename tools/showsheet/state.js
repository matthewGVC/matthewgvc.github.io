/* ============================================================
   tools/showsheet/state.js: the sheet's state (blankUnit), the roster,
   the logo art, fixed wording and small utilities.

   The Showsheet's script is eight classic scripts sharing one global
   scope, loaded in this order by index.html after listing.js: state.js,
   sheet.js, fit.js, form.js, photos.js, panel.js, print.js, piece.js.
   Code that runs while a file loads may only use what an earlier file
   defines; functions called later may use any.
   ============================================================ */
'use strict';

/* ============================================================
   ROSTER — shared with every other tool; edit assets/js/roster.js
   ============================================================ */
const ROSTER = window.GVC_ROSTER;

/* Brand artwork for the sheet lives in assets/logos/sheet/ — the exact paths
   this file used to carry inline (41 KB of it, half never used), with the crop
   fitLogos() used to measure on every render now baked into each viewBox.

   The files are read once at startup and placed inline, as they always were:
   an SVG drawn through <img> goes down a different rendering path and shifted
   every logo by a fraction of a pixel on the printed page, and inline artwork
   can never be caught half-loaded by the print dialog. Until they arrive (or
   if they cannot be read) the slots are simply empty. */
const ART_DIR = '../../assets/logos/sheet/';
const ART_FILES = { lockup: 'lockup-navy.svg', monoWhite: 'monogram-white.svg', monoNavy: 'monogram-navy.svg',
                    badgeDe: 'badge-de.svg', badgeGvc: 'badge-gvc.svg', de: 'douglas-elliman.svg' };
const art = Object.fromEntries(Object.keys(ART_FILES).map(k => [k, '']));
function loadArt(){
  return Promise.all(Object.entries(ART_FILES).map(([k, file]) =>
    fetch(ART_DIR + file).then(r => r.ok ? r.text() : '').catch(() => '')
      // only an SVG is ever put into the page
      .then(t => { art[k] = /^\s*<svg[\s>]/.test(t) ? t.trim() : ''; })));
}
const BADGE_EHO = `<svg viewBox="8.5 8 23.5 22" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#00273A" stroke-width="1.6"><path d="M20 9.5 10 17h2.3v11.5h15.4V17H30L20 9.5z" stroke-linejoin="round"/><path d="M16 20h8M16 23.6h8" stroke-linecap="round"/></svg>`;
/* hairline icon set — stroke inherits currentColor */
const ICONS = {
  bed:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-8m0 5h18v3m0-3v-4a2 2 0 0 0-2-2h-8v6"/><circle cx="6.8" cy="11.8" r="1.6"/></svg>`,
  bath: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h16v1.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 14.5V13zm2 0V6.5A2.5 2.5 0 0 1 8.5 4c1.2 0 2.2.8 2.5 2"/><path d="M6.5 19l-.8 1.8M17.5 19l.8 1.8"/></svg>`,
  ledger:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.2v9.6m2.5-7.4c-.5-.8-1.4-1.3-2.5-1.3-1.4 0-2.6.8-2.6 2 0 2.7 5.2 1.4 5.2 4.1 0 1.2-1.2 2-2.6 2-1.2 0-2.1-.6-2.6-1.4"/></svg>`,
  bldg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18"/><path d="M9 7h2m4 0h-2M9 11h2m4 0h-2M9 15h2m4 0h-2M11 21v-3h2v3"/></svg>`,
  key:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8.5" r="4.2"/><path d="M11 11.5 20 20.5m-3.5-1.5 1.8-1.8m-4.3-.7 1.8-1.8"/></svg>`,
  plan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16"/><path d="M12 4v6.5m0 0H20m-8 0H9.5m0 0V20"/></svg>`,
};
const EHO_SVG = `<svg class="eho" viewBox="0 0 26 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 0 0 9.8h3.1V24h19.8V9.8H26L13 0Zm7.5 21.6H5.5V8.9L13 3.2l7.5 5.7v12.7Z"/><rect x="8.2" y="11" width="9.6" height="2.1"/><rect x="8.2" y="15.4" width="9.6" height="2.1"/></svg>`;

/* the same words the other three builders print — assets/js/legal.js */
const DEFAULT_DISCLAIMER = window.GVC_LEGAL.DISCLAIMER;
const FRONT_DISCLAIMER = "All information is from sources deemed reliable but is not guaranteed; complete terms and disclosures appear on the reverse. Equal Housing Opportunity.";
const OFFICE_LINE = "575 Madison Avenue, 5th Floor · (347) 564-2440 · gvcrealestateteam.com";

function blankUnit(){
  return {
    ownership:'co-op', paper:'a5', bleed:false, neighborhood:'', borough:'Manhattan', address:'', unit:'', positioning:'',
    /* market picks the money block, the logo and the legal text: 'nyc', 'nj' or 'fl'
       (assets/js/legal.js spelling). kind 'rental' prints Monthly Rent. propertyType,
       sqft, lotSize and parking only print on New Jersey and Florida sheets. */
    market:'nyc', kind:'sale', propertyType:'', sqft:'', lotSize:'', parking:'',
    listingUrl:'', docxName:'',
    /* photos is the tray; heroIndex and secondaryIndex say which of them sit
       in the sheet's two slots, or null for a slot left empty. Older saved
       sheets carried the back photo as its own secondaryPhoto object — setDoc
       folds those into the tray. */
    photos:[], heroIndex:0, secondaryIndex:null,
    floorplan:null,
    /* the floorplan's crop inside its frame: zoom 1 shows the whole plan; once
       zoomed in, x/y (0–100) say where the view sits, like object-position */
    floorplanView:{zoom:1, x:50, y:50},
    /* an optional second plan (another level, a second unit) that shares the
       floorplan's space; it only exists beside a first one */
    floorplan2:null, floorplan2View:{zoom:1, x:50, y:50},
    /* with two plans, The Numbers sit 'beside' them (the usual column) or
       'above' them as one row, so the plans get the full width */
    fpLayout:'beside',
    /* how wide the floorplan's column is, in percent of the usual 3/4 of the
       back page; the ledger beside it gives up the width. 100 is the default */
    floorplanSize:100,
    /* manual text size per section, in percent of the autofit (see TEXT_SECTIONS);
       a section left out is at 100 — auto */
    textScale:{},
    price:'', beds:'', baths:'',
    maintenance:'', commonCharges:'', taxesMonthly:'', taxDeductible:'',
    maxFinancing:'', assessments:'', capitalContributions:'', flipTax:'',
    building:{builtYear:'', architect:'', stories:'', residences:'', service:'', policy:'', amenities:[]},
    residence:{exposures:'', outdoor:'', ceiling:'', climate:'', features:[]},
    agentIds:['john-gasdaska','tj-verdiglione'],
    disclaimer: DEFAULT_DISCLAIMER
  };
}
let state = blankUnit();
/* Paper size, bleed and the agents belong to the person printing and to the
   team, not to the listing, so they carry from one listing to the next. This
   is the one way a new listing starts: dropping a different Word document,
   clearing the form, and loading another property from the library all used
   to build it separately, and each kept a slightly different list. */
const CARRY_OVER = ['paper', 'bleed', 'agentIds'];
function freshListing(){
  const next = blankUnit();
  CARRY_OVER.forEach(k => { next[k] = structuredClone(state[k]); });
  return next;
}

/* ============================================================
   UTILITIES
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(msg, err){
  const t = document.createElement('div');
  t.className = 'toast'+(err?' err':''); t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>{t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(()=>t.remove(),420);}, 3400);
}
function getPath(obj, path){ return path.split('.').reduce((o,k)=>o==null?o:o[k], obj); }
function setPath(obj, path, val){
  const ks = path.split('.'); const last = ks.pop();
  const tgt = ks.reduce((o,k)=>o[k], obj); tgt[last] = val;
}
/* reading money and Word documents lives in listing.js, where Node can test it */
const { blankish, fmtMoney, displayPrice, moneyText } = window.GVC_LISTING;

/* ============================================================
   QR — shared with the other three builders, assets/js/qr.js
   ============================================================ */
const qrSvg = window.GVC_QR;
