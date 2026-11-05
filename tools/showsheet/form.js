/* ============================================================
   tools/showsheet/form.js: the preview's scale and the panel's fields and
   switches (market, ownership, paper, bleed). Fourth of the eight
   scripts (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   PREVIEW SCALING
   ============================================================ */
let zoom100 = false;
function layoutPreview(){
  const stage = $('#stage');
  /* Floored, because a stage that has not been laid out yet — or one squeezed
     to nothing on a narrow screen — made these negative, and a negative scale
     turns the sheet inside out and prints "-19% · fit width" in the corner. */
  const avail = Math.max(160, stage.clientWidth - 72);
  const availH = Math.max(200, stage.clientHeight - 84); // page tag + margins (control bar docks below the stage)
  const w = $('.sheet').offsetWidth, h = $('.sheet').offsetHeight;
  // the preview fills whatever space the window gives it: side by side only when
  // that still yields big pages; stacked pages grow past 100% to fill the stage
  const dbl = (avail - 26) / 2 / w;
  const sideBySide = !zoom100 && dbl >= .62;
  let scale;
  if(zoom100) scale = 1;
  else if(sideBySide) scale = Math.min(dbl, Math.max(.62, availH / h));
  else scale = Math.min(avail / w, Math.max(1, availH / h));
  $$('.sheet-wrap').forEach(wrap=>{
    wrap.querySelector('.sheet').style.transform = `scale(${scale})`;
    wrap.style.width = (w*scale)+'px';
    wrap.style.height = (h*scale)+'px';
    wrap.style.margin = '0 0 24px';
  });
  $('#zoomInfo').textContent = zoom100 ? '100%' : Math.round(scale*100)+'% · '+(sideBySide ? 'side by side' : 'fit width');
}
window.addEventListener('resize', layoutPreview);

/* ============================================================
   FORM BINDING
   ============================================================ */
/* The Web ID is the final group of digits in the listing URL. It is worked
   out wherever it is printed rather than stored: kept as its own field, it was
   only updated while typing in the URL box, so a property loaded from the
   library printed no Web ID at all, or an old one beside a newer link. */
function webIdOf(url){
  const m = String(url || '').replace(/[?#].*$/,'').match(/(\d+)\/?\s*$/);
  return m ? m[1] : '';
}
function hydrateForm(){
  normalizeLayout();
  $$('[data-field]').forEach(el=>{
    const v = getPath(state, el.dataset.field);
    if(el.tagName==='TEXTAREA' && Array.isArray(v)) el.value = v.join('\n');
    else el.value = v==null ? '' : v;
  });
  syncMarket();
  syncOwnership();
  syncPaper();
  syncBleed();
  renderAgentPicker();
  renderTray();
  syncDropZones();
  syncTextPanel();
  if(window.__afterHydrate) window.__afterHydrate();   // job mode locks what belongs to the job
}
function syncDropZones(){
  $('#docxDrop').classList.toggle('loaded', !!state.docxName);
  $('#docxName').textContent = state.docxName || '';
  $('#phDrop').classList.toggle('loaded', state.photos.length > 0);
  const n = state.photos.length;
  if($('#phCount')) $('#phCount').textContent = n === 1 ? '1 photo' : n + ' photos';
  $('#fpDrop').classList.toggle('loaded', !!state.floorplan);
  // the second plan's zone appears once there is a first
  $('#fp2Drop').hidden = !state.floorplan;
  $('#fp2Drop').classList.toggle('loaded', !!state.floorplan2);
  // where The Numbers sit only matters once there are two plans
  $('#fpLayoutField').style.display = state.floorplan2 ? '' : 'none';
  $$('#fpLayoutSeg button').forEach(b=>b.classList.toggle('on', b.dataset.v === (state.fpLayout === 'above' ? 'above' : 'beside')));
}
$('#fpLayoutSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  state.fpLayout = b.dataset.v;
  syncDropZones(); render(); edited();
});
document.addEventListener('click', e=>{
  const x = e.target.closest('.d-x'); if(!x) return;
  e.preventDefault(); e.stopPropagation();
  const what = x.dataset.clear;
  if(what==='photo'){ state.photos=[]; state.heroIndex=0; state.secondaryIndex=null; renderTray(); }
  if(what==='floorplan'){
    // the second plan, if there is one, moves up to take the first's place
    state.floorplan = state.floorplan2 || null;
    state.floorplanView = normFpView(state.floorplan2 ? state.floorplan2View : null);
    state.floorplan2 = null; state.floorplan2View = normFpView(null);
    edited();
  }
  if(what==='floorplan2'){ state.floorplan2=null; state.floorplan2View = normFpView(null); edited(); }
  if(what==='docx'){
    // dropping the doc means starting the next listing — clear everything unit-specific
    state = freshListing();
    hydrateForm();
    toast('Form cleared — drop the next listing.');
  }
  syncDropZones(); render();
}, true);
// the paper size only changes the print output (page size + scale); the design
// canvas and on-screen preview are identical for A5 and Letter.
function syncPaper(){
  const letter = state.paper === 'letter';
  document.body.classList.toggle('paper-letter', letter);
  $$('#paperSeg button').forEach(b=>b.classList.toggle('on', b.dataset.v===state.paper));
  // printed bleed = the .125in design bleed times the paper's print scale (A5 prints at .75161, Letter 1:1)
  const bleedIn = state.bleed ? 0.125 * (letter ? 1 : 0.75161) : 0;
  const ps = $('#pagesize');
  if(ps){
    if(letter){ const w = (11 + 2*bleedIn).toFixed(3), h = (8.5 + 2*bleedIn).toFixed(3);
      ps.textContent = `@page{size:${w}in ${h}in;margin:0;}`; }
    else { const w = (210 + 2*bleedIn*25.4).toFixed(2), h = (148 + 2*bleedIn*25.4).toFixed(2);
      ps.textContent = `@page{size:${w}mm ${h}mm;margin:0;}`; }
  }
  const lbl = letter ? 'Letter landscape' : 'A5 landscape';
  $$('.pg-tag').forEach((t,i)=>{ t.textContent = (i===0?'Front · ':'Back · ') + lbl + (state.bleed ? ' · bleed' : ''); });
  const pn = $('#btnPrint');
  if(pn){
    if(state.bleed){
      // Bleed prints an OVERSIZED page (the artwork runs past the trim) that you cut down
      // afterward. Forcing the dialog's paper to A5/Letter shrinks that oversized page back
      // onto a standard sheet and kills the bleed — so the user must leave paper at default
      // and let 'Save as PDF' honor the oversized @page size we set.
      const dim = letter ? '11.25 × 8.75 in' : '~215 × 153 mm';
      const trim = letter ? 'Letter' : 'A5';
      pn.title = `Bleed is on, so the page is intentionally oversized (${dim}) to be trimmed down to ${trim} after printing. In the print dialog: Destination 'Save as PDF' · leave Paper size at its default — do NOT pick ${trim}, that scales the page down and cuts off the bleed${letter ? " · Layout 'Landscape'" : ''} · Margins 'None' · enable 'Background graphics'.`;
    } else {
      pn.title = letter
        ? "In the print dialog: Destination 'Save as PDF' · Paper 'Letter' · Layout 'Landscape' · Margins 'None' · enable 'Background graphics'. Prints as two Letter landscape pages."
        : "In the print dialog: Destination 'Save as PDF' · Paper 'A5' · Margins 'None' · enable 'Background graphics'. Prints as two A5 landscape pages.";
    }
  }
}
function syncBleed(){
  document.body.classList.toggle('bleed', !!state.bleed);
  $$('#bleedSeg button').forEach(b=>b.classList.toggle('on', (b.dataset.v==='on')===!!state.bleed));
  syncPaper();   // the print page size grows with the bleed
}
/* the market: New York keeps today's panel exactly; NJ and FL add their fields */
function syncMarket(){
  const nyc = nycSheet();
  $$('#marketSeg button').forEach(b=>b.classList.toggle('on', b.dataset.v===(state.market||'nyc')));
  $$('.njfl-only').forEach(e=>e.style.display = nyc ? 'none' : '');
  $$('.nyc-only').forEach(e=>e.style.display = nyc ? '' : 'none');
  $('#ccLabel').textContent = !nyc && state.ownership === 'house' ? 'HOA (monthly)' : 'Common Charges (monthly)';
  $('#taxLabel').textContent = nyc ? 'Real Estate Taxes (monthly)' : 'Property Taxes (monthly; prints yearly)';
}
$('#marketSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b || b.disabled) return;
  state.market = b.dataset.v;
  // the legal text is the market's (D28), never typed; a co-op or a house follows the market
  settleMarket();
  syncMarket(); syncOwnership(); render(); edited();
});
function syncOwnership(){
  $$('#ownSeg button').forEach(b=>b.classList.toggle('on', b.dataset.v===state.ownership));
  $$('.coop-only').forEach(e=>e.style.display = state.ownership==='co-op'?'':'none');
  $$('.condo-only').forEach(e=>e.style.display = state.ownership==='co-op'?'none':'');
  $$('.house-only').forEach(e=>{ if(state.ownership !== 'house') e.style.display = 'none'; else if(!nycSheet()) e.style.display = ''; });
  if($('#ccLabel')) $('#ccLabel').textContent = !nycSheet() && state.ownership === 'house' ? 'HOA (monthly)' : 'Common Charges (monthly)';
}
document.addEventListener('input', e=>{
  const f = e.target.dataset && e.target.dataset.field;
  if(!f) return;
  let v = e.target.value;
  if(e.target.tagName==='TEXTAREA' && (f==='building.amenities' || f==='residence.features')) v = v.split('\n');
  setPath(state, f, v);
  render();
});
$('#ownSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  state.ownership = b.dataset.v;
  syncOwnership(); render();
});
$('#paperSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  state.paper = b.dataset.v;
  syncPaper(); render();   // canvas height changes with paper — re-run the autofit
});
$('#bleedSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  state.bleed = b.dataset.v === 'on';
  syncBleed(); render();   // bleed reshapes the page — re-run the autofit
});
