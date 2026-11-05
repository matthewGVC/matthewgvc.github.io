/* ============================================================
   tools/showsheet/print.js: printing (with the missing-essentials
   warning), the zoom button, and the boot that draws the blank sheet.
   Seventh of the eight scripts (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   OUTPUT — print, bleed, download
   ============================================================ */
// the essentials every sheet needs — warn (but don't block) when any are missing
const ESSENTIALS = [
  ['Listing Word document', ()=>!!state.docxName],
  ['Photo', ()=>state.photos.length>0],
  ['Floorplan', ()=>!!state.floorplan],
  ['Listing URL', ()=>!!String(state.listingUrl||'').trim()],
];
// The browser's Print → "Save as PDF" dialog uses the page title as the default
// file name, so set it to the listing address (+ unit) just before printing and
// restore it afterward, leaving the normal app title in place the rest of the time.
const APP_TITLE = document.title;
function printSheet(){
  const addr = String(state.address||'').trim();
  const unit = String(state.unit||'').trim();
  const name = [addr, unit && unitDisplay(unit)].filter(Boolean).join(' - ').trim();
  if(name) document.title = name;
  const restore = ()=>{ document.title = APP_TITLE; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  window.print();
}
$('#btnPrint').onclick = ()=>{
  const missing = ESSENTIALS.filter(([,ok])=>!ok()).map(([name])=>name);
  if(!missing.length){ printSheet(); return; }
  $('#warnList').innerHTML = missing.map(m=>`<li>${m}</li>`).join('');
  $('#warnOverlay').hidden = false;
  $('#warnBack').focus();
};
/* a modal: focus goes in when it opens, back to Print when it closes, stays
   between its two buttons while open, and Escape is "Go back" */
function closeWarn(){ $('#warnOverlay').hidden = true; $('#btnPrint').focus(); }
$('#warnBack').onclick = closeWarn;
$('#warnPrint').onclick = ()=>{ closeWarn(); printSheet(); };
$('#warnOverlay').addEventListener('keydown', e=>{
  if(e.key === 'Escape'){ e.preventDefault(); closeWarn(); return; }
  if(e.key !== 'Tab') return;
  const first = $('#warnBack'), last = $('#warnPrint');
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});
$('#btnZoom').onclick = ()=>{
  zoom100 = !zoom100;
  $('#btnZoom').textContent = zoom100 ? 'Zoom: Fit' : 'Zoom 100%';
  layoutPreview();
};
/* ============================================================
   BOOT — the sheet always opens blank. Nothing is kept in this browser;
   the property library is the only way work comes back.
   ============================================================ */
let artReady = Promise.resolve();
(function boot(){
  buildTextPanel();
  hydrateForm();
  render();
  artReady = loadArt().then(render);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>render());
})();
