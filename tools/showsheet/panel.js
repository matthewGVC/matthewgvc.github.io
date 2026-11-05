/* ============================================================
   tools/showsheet/panel.js: the Text & floorplan size panel, the agents
   picker and reading a dropped Word document. Sixth of the eight scripts
   (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   TEXT SIZE PANEL — one row per TEXT_SECTIONS entry
   ============================================================ */
let tsLit = null;   // the section whose row is hovered or focused
function buildTextPanel(){
  const host = $('#tsRows');
  let side = null, html = '';
  SIZE_ROWS.forEach(s => {
    if(s.side !== side){ side = s.side; html += `<div class="ts-group">${side}</div>`; }
    html += `<div class="ts-row" data-ts="${s.key}">
      <label for="ts-${s.key}">${s.label}</label>
      <div class="ts-ctl">
        <button type="button" class="ts-step" data-step="-1" aria-label="${s.label}: smaller">&minus;</button>
        <input type="range" id="ts-${s.key}" min="${s.min || TS_MIN}" max="${s.max || TS_MAX}" step="${TS_STEP}" value="100">
        <button type="button" class="ts-step" data-step="1" aria-label="${s.label}: larger">+</button>
        <output class="ts-val" for="ts-${s.key}"></output>
      </div>
      <div class="ts-note" aria-live="polite"></div>
    </div>`;
  });
  host.innerHTML = html;

  host.addEventListener('input', e => {
    const row = e.target.closest('.ts-row');
    if(!row || e.target.type !== 'range') return;
    const v = clampN(Math.round(Number(e.target.value) / TS_STEP) * TS_STEP, Number(e.target.min), Number(e.target.max));
    setSizePct(row.dataset.ts, v);
    syncTextPanel(); render();
  });
  // the steppers move the slider and let its input event do the rest, so
  // the unsaved-work guard sees them exactly as it sees a drag of the slider
  host.addEventListener('click', e => {
    const b = e.target.closest('.ts-step'); if(!b) return;
    const range = b.closest('.ts-row').querySelector('input[type=range]');
    range.value = Number(range.value) + Number(b.dataset.step) * TS_STEP;
    range.dispatchEvent(new Event('input', {bubbles:true}));
  });
  const lightFrom = e => { const row = e.target.closest && e.target.closest('.ts-row'); lightSection(row ? row.dataset.ts : null); };
  host.addEventListener('pointerover', lightFrom);
  host.addEventListener('focusin', lightFrom);
  host.addEventListener('pointerleave', () => lightSection(null));
  host.addEventListener('focusout', e => { if(!host.contains(e.relatedTarget)) lightSection(null); });

  $('#tsReset').addEventListener('click', () => {
    if(!Object.keys(state.textScale).length && fpSizePct() === 100) return;
    state.textScale = {};
    state.floorplanSize = 100;
    syncTextPanel(); render(); edited();
  });
}
/* outline a section on the sheet while its row is in use (screen only) */
function lightSection(key){
  tsLit = key;
  $$('#sheets .ts-hl').forEach(el => el.classList.remove('ts-hl'));
  const s = SIZE_ROWS.find(x => x.key === key);
  if(s) $$(s.sel.split(',').map(x => '#sheets ' + x.trim()).join(',')).forEach(el => el.classList.add('ts-hl'));
}
/* the controls, from state — after a load, a reset, or a change */
function syncTextPanel(){
  SIZE_ROWS.forEach(s => {
    const row = document.querySelector(`.ts-row[data-ts="${s.key}"]`); if(!row) return;
    const pct = sizePct(s.key);
    row.querySelector('input[type=range]').value = pct;
    const val = row.querySelector('.ts-val');
    val.textContent = pct === 100 ? 'Auto' : pct + '%';
    val.classList.toggle('set', pct !== 100);
    const [down, up] = row.querySelectorAll('.ts-step');
    down.disabled = pct <= (s.min || TS_MIN); up.disabled = pct >= (s.max || TS_MAX);
  });
}
/* after each render: what each section actually managed */
function paintTextPanel(){
  SIZE_ROWS.forEach(s => {
    const row = document.querySelector(`.ts-row[data-ts="${s.key}"]`); if(!row) return;
    const f = textFit[s.key], want = sizePct(s.key);
    const note = row.querySelector('.ts-note');
    row.classList.toggle('absent', !f);
    const got = f ? Math.round(f.got * 100) : 100;
    const capped = !!f && got < want - 1;
    const why = !capped || !f.why ? ''
      : f.why === 'height' ? ' — the agent photos are as small as they go'
      : ' — The Numbers need the rest of the width';
    // with The Numbers above, the two plans already take the whole width
    const top = !!f && f.why === 'top' && want !== 100;
    note.textContent = !f ? (s === FP_SIZE ? 'No floorplan on this sheet' : 'Not on this sheet')
      : top ? 'The plans fill the page while The Numbers sit above them'
      : capped ? `Largest that fits here: ${got}%${why}` : '';
    note.classList.toggle('warn', capped || top);
    row.querySelector('.ts-val').title = f && f.pt ? `Prints at ${f.pt.toFixed(1)}pt` : '';
  });
  if(tsLit) lightSection(tsLit);   // the sheet was rebuilt under the outline
}
/* A saved sheet is data from a network: keep only the shapes this build
   understands, so a stray value can neither break the layout nor come back
   out on the next save. */
function normalizeLayout(){
  const ts = state.textScale && typeof state.textScale === 'object' && !Array.isArray(state.textScale) ? state.textScale : {};
  const clean = {};
  TEXT_SECTIONS.forEach(s => {
    const v = Math.round(Number(ts[s.key]));
    if(Number.isFinite(v) && v && v !== 100) clean[s.key] = clampN(Math.round(v / TS_STEP) * TS_STEP, TS_MIN, TS_MAX);
  });
  state.textScale = clean;
  state.floorplanView = normFpView(state.floorplanView);
  if(typeof state.floorplan2 !== 'string' || !state.floorplan2) state.floorplan2 = null;
  if(state.floorplan2 && !state.floorplan){   // a lone second plan is the plan
    state.floorplan = state.floorplan2; state.floorplanView = normFpView(state.floorplan2View); state.floorplan2 = null;
  }
  state.floorplan2View = normFpView(state.floorplan2View);
  if(state.fpLayout !== 'above') state.fpLayout = 'beside';
  const fs = Math.round(Number(state.floorplanSize));
  state.floorplanSize = Number.isFinite(fs) && fs ? clampN(Math.round(fs / TS_STEP) * TS_STEP, FP_SIZE.min, FP_SIZE.max) : 100;
}
/* ============================================================
   AGENTS PICKER
   ============================================================ */
/* The chips themselves are the shared picker from roster.js. Unlike the
   other builders, a full sheet here refuses the extra agent and says so
   rather than silently dropping the first one — four is a layout limit,
   not a preference.

   The state goes in as a getter rather than as `state` itself: this tool
   replaces its whole state object when it loads a saved sheet or resets
   the form, so the picker has to look the selection up fresh each time
   rather than hold a reference to whichever object existed at startup. */
const renderAgentPicker = GVC_PICKER($('#agentPick'), () => state, {
  key: 'agentIds',
  max: 4,
  onChange: render,
  onFull: () => {
    toast('Up to four agents fit on the sheet — remove one first.', true);
    return false;
  }
});

/* ============================================================
   DOCX IMPORT
   ============================================================ */
async function importDocx(file){
  if(typeof mammoth === 'undefined'){ toast('The .docx library failed to load (offline?). Fill the form manually.', true); return; }
  $('#docxStatus').textContent = 'Reading ' + file.name + '…';
  try{
    const buf = await file.arrayBuffer();
    const {value:html} = await mammoth.convertToHtml({arrayBuffer:buf});
    const found = applyParsedDocx(GVC_LISTING.blocksFromHtml(html));
    state.docxName = file.name;
    hydrateForm(); render();
    $('#docxStatus').textContent = '';
    toast(found.length ? `Prefilled: ${found.join(', ')}. Review & edit below.` : 'Document read, but no recognizable fields found.');
  }catch(err){
    console.error(err);
    $('#docxStatus').textContent = '';
    toast('Could not parse that document — fields left as-is.', true);
  }
}
/* What the document says, laid over the sheet (listing.js does the reading).

   A different address OR a different unit is a different listing: start
   clean so nothing from the previous one leaks onto printed collateral.
   Comparing the address alone treated 4B and 3A in the same building as the
   same listing, and the second import inherited the first one's assessment,
   financing limit and photo. Only a unit the document actually names is
   compared: a document with no parseable unit must not read as "unit
   cleared" and wipe a sheet mid-edit. */
function applyParsedDocx(blocks){
  const title = GVC_LISTING.titleOf(blocks);
  const norm = s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const moved = (title.address && state.address && norm(title.address)!==norm(state.address)) ||
                (title.unit    && state.unit    && norm(title.unit)   !==norm(state.unit));
  if(moved) state = freshListing();
  const { building, residence, found, ...facts } = GVC_LISTING.read(blocks, state.ownership);
  Object.assign(state, facts);
  Object.assign(state.building, building);
  Object.assign(state.residence, residence);
  return moved ? ['(new unit — form reset)', ...found] : found;
}
wireDrop($('#docxDrop'), $('#docxFile'), importDocx, false);

/* Every field in the panel is a plain <label> sitting beside its control:
   correct on screen, and silent to a screen reader, because not one of the
   29 carried a `for`. Tying them together from the markup already here beats
   hand-writing 29 id/for pairs that the next field added would forget. */
function linkFieldLabels(){
  $$('.field').forEach(f => {
    const label = f.querySelector(':scope > label');
    if(!label || label.htmlFor) return;
    const controls = f.querySelectorAll('input, select, textarea');
    if(controls.length === 1){
      const c = controls[0];
      if(!c.id) c.id = 'fld-' + String(c.dataset.field || c.name || '').replace(/[^\w]+/g, '-');
      label.htmlFor = c.id;
      return;
    }
    /* Ownership is a row of buttons rather than one control, so its label
       names the group instead of pointing at whichever button came first. */
    const seg = f.querySelector('.seg');
    if(seg && !seg.getAttribute('aria-label')){
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', label.textContent.trim());
    }
  });
}
linkFieldLabels();
