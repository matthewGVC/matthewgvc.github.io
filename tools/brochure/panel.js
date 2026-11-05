/* ============================================================
   tools/brochure/panel.js: the gallery panel and inspector, the panel's
   wiring, the paper size and the printed file's name; starts the builder.
   Sixth of the seven scripts (see state.js).
   ============================================================ */
'use strict';

function renderGalleryPanel() {
  const pages = galPages();
  const note = $('#bentoNote');

  // page tabs
  const tabs = $('#galTabs');
  if (tabs) {
    tabs.innerHTML = '';
    pages.forEach((pg, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gal-tab' + (i === state.galPage ? ' on' : '');
      b.textContent = (i + 1) + ' · ' + cellsOf(pg).length;
      b.title = 'Gallery page ' + (i + 1);
      b.addEventListener('click', () => {
        state.galPage = i; state.galSel = null; redraw(); renderGalleryPanel();
      });
      tabs.appendChild(b);
    });
  }
  const delBtn = $('#btnGalDel'), addBtn = $('#btnGalAdd');
  if (delBtn) delBtn.disabled = pages.length <= 1;
  if (addBtn) addBtn.disabled = pages.length >= GAL_MAX_PAGES;

  // presets that fit the active page's photo count
  const pg = pages[state.galPage];
  const n = pg ? cellsOf(pg).length : 0;
  const host = $('#galPresets');
  if (host) {
    const opts = PRESETS.filter(pr => pr.n === n);
    host.innerHTML = '';
    if (!opts.length) {
      host.innerHTML = '<div class="gal-ins-none">' + (n
        ? n + ' photos on this page — no preset that size, so drag the dividers to shape it.'
        : 'No photos on this page yet.') + '</div>';
    }
    opts.forEach(pr => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gal-pre'; b.textContent = pr.name;
      b.addEventListener('click', () => applyPreset(pr.name));
      host.appendChild(b);
    });
  }

  const caps = $('#galCaps');
  if (caps) caps.checked = !!state.galCaptions;

  renderGalleryInspector();

  if (note) {
    const total = pages.reduce((t, x) => t + cellsOf(x).length, 0);
    note.textContent = total
      ? total + ' photo' + (total === 1 ? '' : 's') + ' across ' + pages.length +
        ' gallery page' + (pages.length === 1 ? '' : 's') + '.'
      : 'Tag photos as Gallery in the Photos panel.';
  }
}

/* The selected cell's own controls: caption, size, zoom, and the moves that
   dragging cannot express. */
function renderGalleryInspector() {
  const host = $('#galInspect');
  if (!host) return;
  host.innerHTML = '';
  const hit = state.galSel ? findCell(state.galSel) : null;
  if (!hit) {
    host.innerHTML = '<div class="gal-ins-none">Click a photo on the gallery page to size it, ' +
      'crop it or label it.</div>' +
      '<div class="gal-tip">Drag a photo to move the crop. Drag the lines between photos to ' +
      'resize them. Shift-drag one photo onto another to swap them. Click a label to type on it.</div>';
    return;
  }
  const c = hit.cell;
  const img = state.images.filter(im => im.id === c.id)[0];

  const nm = document.createElement('div');
  nm.className = 'gal-ins-nm';
  nm.textContent = img ? img.name : 'Photo';
  host.appendChild(nm);

  // caption
  const fLabel = document.createElement('div');
  fLabel.className = 'gal-fld';
  fLabel.innerHTML = '<span>Label</span>';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = c.label || ''; inp.placeholder = 'Living room';
  inp.addEventListener('input', () => { c.label = inp.value; redraw(); });
  fLabel.appendChild(inp);
  host.appendChild(fLabel);

  // a stepper row: label, -, value, +
  const stepper = (label, get, set, fmt) => {
    const row = document.createElement('div');
    row.className = 'gal-fld';
    row.innerHTML = '<span>' + label + '</span>';
    const wrap = document.createElement('div');
    wrap.className = 'gal-step';
    const mk = (txt, delta) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = txt;
      b.addEventListener('click', () => { edited(); set(delta); redraw(); renderGalleryPanel(); });
      return b;
    };
    const val = document.createElement('span');
    val.className = 'gal-val'; val.textContent = fmt(get());
    wrap.appendChild(mk('−', -1));
    wrap.appendChild(val);
    wrap.appendChild(mk('+', 1));
    row.appendChild(wrap);
    host.appendChild(row);
  };

  stepper('Width', () => c.w || 1,
    d => { c.w = Math.max(CELL_MIN, Math.round(((c.w || 1) + d * 0.25) * 100) / 100); },
    v => v.toFixed(2));
  stepper('Height', () => hit.row.h || 1,
    d => { hit.row.h = Math.max(CELL_MIN, Math.round(((hit.row.h || 1) + d * 0.25) * 100) / 100); },
    v => v.toFixed(2));

  // zoom
  const fz = document.createElement('div');
  fz.className = 'gal-fld';
  fz.innerHTML = '<span>Zoom</span>';
  const rng = document.createElement('input');
  rng.type = 'range'; rng.min = '1'; rng.max = '3'; rng.step = '0.05';
  rng.value = String(c.z || 1);
  rng.addEventListener('input', () => { c.z = parseFloat(rng.value); redraw(); });
  fz.appendChild(rng);
  host.appendChild(fz);

  // moves
  const btns = document.createElement('div');
  btns.className = 'gal-ins-btns';
  const mkBtn = (txt, fn, title) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn sm'; b.textContent = txt;
    if (title) b.title = title;
    b.addEventListener('click', fn);
    return b;
  };
  btns.appendChild(mkBtn('Recentre', () => {
    edited();
    c.fx = 50; c.fy = 50; c.z = 1; redraw(); renderGalleryPanel();
  }, 'Put the crop back to the middle at 1x'));
  btns.appendChild(mkBtn('Own row', () => cellToOwnRow(c.id),
    'Pull this photo out onto a row of its own'));
  btns.appendChild(mkBtn('Take off', () => unusePhoto(c.id),
    'Take this photo off the page — it stays in the Photos list as Unused'));
  host.appendChild(btns);

  // move to another gallery page
  if (galPages().length > 1) {
    const row = document.createElement('div');
    row.className = 'gal-fld';
    row.innerHTML = '<span>Page</span>';
    const sel = document.createElement('select');
    galPages().forEach((_, i) => {
      const o = document.createElement('option');
      o.value = String(i); o.textContent = 'Page ' + (i + 1);
      if (i === hit.pi) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => moveCellToPage(c.id, parseInt(sel.value, 10)));
    row.appendChild(sel);
    host.appendChild(row);
  }

  const tip = document.createElement('div');
  tip.className = 'gal-tip';
  tip.textContent = 'Drag the photo to move its crop. Drag the lines between photos to resize. ' +
    'Shift-drag onto another photo to swap them.';
  host.appendChild(tip);
}

/* kept as an alias so the older call sites read the same */
function updateBentoNote() { renderGalleryPanel(); }

wireDrop('#imgDrop', '#imgFile', addFiles);
wireDrop('#fpDrop', '#fpFile', addFloorplans);

document.querySelectorAll('[data-field]').forEach(el => {
  el.addEventListener('input', () => { state[el.dataset.field] = el.value; redraw(); });
});
$('#strategy').addEventListener('change', e => {
  state.strategy = e.target.value;
  redraw(); renderImgList(); updateBentoNote();
});
$('#btnShuffle').addEventListener('click', shuffleGallery);
$('#btnGalAdd').addEventListener('click', addGalleryPage);
$('#btnGalDel').addEventListener('click', () => removeGalleryPage(state.galPage));
$('#galCaps').addEventListener('change', e => {
  state.galCaptions = e.target.checked; redraw();
});
$('#btnResetPos').addEventListener('click', () => {
  edited();
  state.coverPos = { x: 50, y: 50 };
  state.infoTopPos = { x: 50, y: 50 };
  redraw();
});

// seed inputs from state defaults (website, bio, marketing copy, footnote)
document.querySelectorAll('[data-field]').forEach(el => {
  if (state[el.dataset.field]) el.value = state[el.dataset.field];
});

/* what the printed PDF should be called: the property, falling back to the
   deck's own name when nothing has been typed yet */
function printName() {
  const addr = String(state.address || '').trim();
  const where = cityLine();
  return [addr, where].filter(Boolean).join(', ') || 'Brochure';
}

/* ---------------- paper size ----------------
   The canvas height and the print scale are pure CSS (see the PAPER SIZE
   block above); this switches the class, rewrites the @page size so 'Save as
   PDF' produces a real sheet of the right size, and re-renders so the reflowed
   pages are re-measured for overflow. */
const PAPER = {
  letter: { w: 8.5, h: 11,  label: '8.5 × 11 in',  dialog: 'Letter' },
  half:   { w: 5.5, h: 8.5, label: '5.5 × 8.5 in', dialog: 'Statement (5.5 × 8.5 in) — or "Half Letter"' }
};

function syncPaper() {
  const p = PAPER[state.paper] || PAPER.letter;
  document.body.classList.toggle('paper-half', state.paper === 'half');
  document.querySelectorAll('#paperSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === state.paper));
  $('#pagesize').textContent = `@page{size:${p.w}in ${p.h}in;margin:0;}`;
  const pn = $('#btnPrint');
  if (pn) pn.title = `In the print dialog: Destination 'Save as PDF' · Paper '${p.dialog}' · Margins 'None' · enable 'Background graphics'.`;
}

builder = Builder.init({ pages: pagePlan().length, label: 'Page',
                         render: renderPage, printName: printName,
                         sizeLabel: () => (PAPER[state.paper] || PAPER.letter).label });

$('#paperSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.dataset.v === state.paper) return;
  state.paper = b.dataset.v;
  syncPaper();
  redraw();            // the canvas height changed — reflow and re-measure
});
syncPaper();
renderRoster = GVC_PICKER($('#rosterPick'), state, { max: MAX_AGENTS, onChange: redraw });
renderImgList(); renderFpList();
redraw(); updateBentoNote();
/* The browser asks before a reload throws unsaved work away. Dropped
   photos and dragged crops fire no input event of their own — hence the
   touch() calls in the drag and drop code. */
GVC_UNSAVED.watch();
