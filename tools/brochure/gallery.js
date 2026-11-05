/* ============================================================
   tools/brochure/gallery.js: which photo goes where (computeAssignment)
   and the gallery's edits: presets, shuffle, swapping cells, adding and
   removing gallery pages. Second of the seven scripts (see state.js).
   ============================================================ */
'use strict';

/* ---------------- placement ---------------- */
function computeAssignment() {
  const res = { hero: null, infoTop: null, gallery: [] };
  const taken = new Set();
  const forcedGallery = [];

  state.images.forEach(im => {
    switch (im.role) {
      case 'hero':        if (!res.hero)        { res.hero = im;        taken.add(im.id); } break;
      case 'info-top':    if (!res.infoTop)     { res.infoTop = im;     taken.add(im.id); } break;
      case 'gallery':     forcedGallery.push(im); taken.add(im.id); break;
      case 'exclude':     taken.add(im.id); break;
    }
  });

  let pool = state.images.filter(im => !taken.has(im.id));

  if (state.strategy !== 'manual') {
    const take = slot => {
      if (res[slot] || !pool.length) return;
      let pick = pool[0];
      if (state.strategy === 'aspect') {
        const target = SLOT_AR[slot];
        pick = pool.reduce((best, im) =>
          Math.abs((im.ar || 1.5) - target) < Math.abs((best.ar || 1.5) - target) ? im : best, pool[0]);
      }
      res[slot] = pick;
      pool = pool.filter(im => im !== pick);
    };

    if (state.strategy === 'spotlight') {
      // the strongest photos go to the cover and the gallery's big cells;
      // page 3's banner takes what is left
      take('hero');
      const n = Math.max(0, pool.length - (res.infoTop ? 0 : 1));
      res.gallery = forcedGallery.concat(pool.slice(0, n));
      pool = pool.slice(n);
      take('infoTop');
    } else {
      take('hero'); take('infoTop');
    }
  }

  // manual means manual: untagged photos stay out of the gallery too
  if (!res.gallery.length) {
    res.gallery = state.strategy === 'manual' ? forcedGallery : forcedGallery.concat(pool);
  }
  /* No cap: the gallery is as many pages as it needs, and the layout keeps
     each page's own order, so there is nothing to sort here. */
  return res;
}

/* Keep the layout honest against the photo list: photos that are no longer
   in the gallery lose their cells, and photos newly in it get appended to
   the last page. Existing cells keep their size, crop and caption, so
   adding one photo never reshuffles the work already done. */
function syncGallery() {
  const ids = assign.gallery.map(i => i.id);
  const pages = galPages();

  // drop cells whose photo has left the gallery
  pages.forEach(pg => {
    (pg.rows || []).forEach(row => { row.cells = (row.cells || []).filter(c => ids.includes(c.id)); });
    pg.rows = (pg.rows || []).filter(row => row.cells.length);
  });
  /* Empty pages are kept on purpose. Adding a page and then moving photos
     onto it is a two-step job, and pruning here would delete the page
     between the two steps. Pages go only when the editor says so. */

  const placed = [];
  pages.forEach(pg => cellsOf(pg).forEach(x => placed.push(x.cell.id)));
  const fresh = ids.filter(id => placed.indexOf(id) === -1);

  if (!placed.length) {
    // first run, or every photo changed at once: lay the whole set out
    state.gallery = [layoutFor(ids)];
  } else if (fresh.length) {
    /* Land new photos on the page being edited — that is where the eye is,
       and an empty page just added is the usual reason for tagging more. */
    const host = pages[Math.min(state.galPage, pages.length - 1)] || pages[pages.length - 1];
    fresh.forEach(id => {
      const row = host.rows[host.rows.length - 1];
      if (row && row.cells.length < 4) row.cells.push(newCell(id));
      else host.rows.push({ h: 1, cells: [newCell(id)] });
    });
  }
  if (!galPages().length) state.gallery = [layoutFor(ids)];
  state.galPage = Math.max(0, Math.min(state.galPage, galPages().length - 1));
  if (state.galSel && !findCell(state.galSel)) state.galSel = null;
}

/* Re-lay the active page from a named preset, keeping its photos and their
   crops and captions — only the geometry is replaced. */
function applyPreset(name) {
  const pg = galPages()[state.galPage];
  if (!pg) return;
  edited();
  const old = cellsOf(pg).map(x => x.cell);
  const fresh = layoutFor(old.map(c => c.id), name);
  // carry each photo's crop and caption across to its new cell
  cellsOf(fresh).forEach(x => {
    const prev = old.filter(c => c.id === x.cell.id)[0];
    if (prev) { x.cell.fx = prev.fx; x.cell.fy = prev.fy; x.cell.z = prev.z; x.cell.label = prev.label; }
  });
  galPages()[state.galPage] = fresh;
  redraw(); renderGalleryPanel();
}

function shuffleGallery() {
  const pg = galPages()[state.galPage];
  if (!pg) return;
  const n = cellsOf(pg).length;
  const opts = PRESETS.filter(p => p.n === n);
  if (!opts.length) return;
  applyPreset(opts[Math.floor(Math.random() * opts.length)].name);
}

/* Swap two photos between cells, keeping each cell's geometry — the frames
   stay put and the pictures move, which is what dragging one onto another
   looks like it should do. */
function swapCells(idA, idB) {
  idA = Number(idA); idB = Number(idB);
  const A = findCell(idA), B = findCell(idB);
  if (!A || !B || idA === idB) return;
  edited();
  const a = A.cell, b = B.cell;
  const keep = { id: a.id, fx: a.fx, fy: a.fy, z: a.z, label: a.label };
  a.id = b.id; a.fx = b.fx; a.fy = b.fy; a.z = b.z; a.label = b.label;
  b.id = keep.id; b.fx = keep.fx; b.fy = keep.fy; b.z = keep.z; b.label = keep.label;
  redraw(); renderGalleryPanel();
}

function addGalleryPage() {
  if (galPages().length >= GAL_MAX_PAGES) { return; }
  edited();
  galPages().push({ rows: [] });
  state.galPage = galPages().length - 1;
  redraw(); renderGalleryPanel();
}

function removeGalleryPage(pi) {
  const pages = galPages();
  if (pages.length <= 1) return;
  edited();
  const dead = cellsOf(pages[pi]).map(x => x.cell);
  pages.splice(pi, 1);
  // its photos are not lost — they rejoin the page before it
  const host = pages[Math.max(0, pi - 1)];
  dead.forEach(c => {
    const row = host.rows[host.rows.length - 1];
    if (row && row.cells.length < 4) row.cells.push(c);
    else host.rows.push({ h: 1, cells: [c] });
  });
  state.galPage = Math.max(0, Math.min(state.galPage, pages.length - 1));
  redraw(); renderGalleryPanel();
}

/* Move a photo to another gallery page — the one control that cannot be
   done by dragging, since the pages are not on screen together. */
function moveCellToPage(id, pi) {
  const hit = findCell(id);
  const pages = galPages();
  if (!hit || !pages[pi] || hit.pi === pi) return;
  edited();
  const cell = hit.cell;
  hit.row.cells.splice(hit.ci, 1);
  if (!hit.row.cells.length) hit.page.rows.splice(hit.ri, 1);
  const host = pages[pi];
  const row = host.rows[host.rows.length - 1];
  if (row && row.cells.length < 4) row.cells.push(cell);
  else host.rows.push({ h: 1, cells: [cell] });
  state.galPage = pi;
  redraw(); renderGalleryPanel();
}

/* Split the selected cell's row, or pull the cell out into its own row. */
function cellToOwnRow(id) {
  const hit = findCell(id);
  if (!hit || hit.row.cells.length === 1) return;
  edited();
  hit.row.cells.splice(hit.ci, 1);
  hit.page.rows.splice(hit.ri + 1, 0, { h: 1, cells: [hit.cell] });
  redraw(); renderGalleryPanel();
}

/* ---------------- page plan ---------------- */
/* One list drives the deck and the contents page both, so a floor-plan
   page appearing or disappearing renumbers the contents automatically. */
