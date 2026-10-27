/* ============================================================
   Fit the labels on the all-floors sheet. That sheet draws each floor smaller than its own sheet, so a
   label placed for the floor's own sheet can land on a wall, a bed or a door swing there. This finds
   every room name and small label that touches linework on the all-floors sheet (branded and
   unbranded) and moves it to the nearest clear spot inside its own room (flood-filled from the label,
   bounded by walls and doors), writing that spot as "allAt"; where none is clear it tries the label a
   step smaller ("allScale"). A label backed in white stays put. The floor's own sheets keep "at".

     node scripts/floorplan/fit-labels.js "<plan.json>" [--scale 0.8] [--write]

   --scale sets "allSheet": { "textScale" } first (the text size on that sheet; leave it out to keep
   the drawer's own). Without --write it only reports. Run the maker afterwards and look at the sheet:
   a label it could not fit is listed, for a hand-set allAt, a smaller scale or a line break.
   ============================================================ */
'use strict';

const fs = require('fs');
const { drawAll } = require('./draw.js');

const Z = 4;           // render zoom: px per pt
const PAD = 1.2;       // pt kept clear round each room name
const PAD_SMALL = 0.4; // and round a small label (W, D, REF sit inside their own boxes)
const REACH = 30;      // pt, the furthest a label moves
const NEAR = 8;        // pt, tried at every size before going further
const SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5];   // then smaller, a step at a time, before giving up

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const si = args.indexOf('--scale');
  if (!file) { console.error('usage: fit-labels.js "<plan.json>" [--scale 0.8] [--write]'); process.exit(1); }
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (si >= 0) plan.allSheet = Object.assign({}, plan.allSheet, { textScale: Number(args[si + 1]) });
  if (plan.levels.length < 2) { console.log('One floor: there is no all-floors sheet.'); return; }
  /* "allLock": true keeps a hand-set allAt / allScale as it is (and the others keep clear of it) */
  plan.levels.forEach((l) => [...(l.rooms || []), ...(l.labels || [])].forEach((r) => { if (!r.allLock) { delete r.allAt; delete r.allScale; } }));
  const locks = [].concat(...plan.levels.map((l) => [...(l.rooms || []).filter((q) => typeof q.name === 'string' && q.name.trim() && Array.isArray(q.at)), ...(l.labels || []).filter((q) => q.text && Array.isArray(q.at))].map((q) => !!q.allLock)));

  const clone = (p) => JSON.parse(JSON.stringify(p));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const moved = new Map(), stuck = [];
  try {
    /* the branded sheet first (its floors are drawn smallest), then the unbranded one with those moves */
    for (const branded of [true, false]) {
      let layout;
      const full = drawAll(plan, { branded, onLayout: (L) => { layout = L; } });
      const bare = clone(plan); bare.levels.forEach((l) => { l.rooms = []; l.labels = []; });
      /* the rooms' borders: walls and columns, with every door and window opening shut by a line across
         it, so a label can't slip out through a doorway (open plan stays open: it has no opening) */
      const rooms = clone(plan); rooms.levels.forEach((l) => {
        /* each shut line runs a little past the opening, closing the slivers beside a door set in a thin wall */
        const shut = (l.openings || []).filter((o) => Array.isArray(o.a) && Array.isArray(o.b)).map((o) => {
          const dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], n = Math.hypot(dx, dy) || 1, e = Math.max(12, (o.t || 0));
          return { pts: [[o.a[0] - dx / n * e, o.a[1] - dy / n * e], [o.b[0] + dx / n * e, o.b[1] + dy / n * e]] };
        });
        ['openings', 'fixtures', 'areas', 'rooms', 'labels'].forEach((k) => { l[k] = []; });
        l.lines = shut;
      });
      const page = await browser.newPage({ viewport: { width: 810, height: 630 } });
      const res = await page.evaluate(async ([svgs, Z, PAD, PAD_SMALL, REACH, SCALES, NEAR, LOCKS]) => {
        const img = (svg) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        const W = 810 * Z, H = 630 * Z, c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d');
        const mask = async (svg) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(await img(svg), 0, 0, W, H);
          const d = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
          for (let i = 0; i < m.length; i++) m[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3 < 230 ? 1 : 0; return m; };
        const ink = await mask(svgs.bare), border0 = await mask(svgs.rooms);
        /* the borders thickened by 1 pt each way, so a hairline gap (a line's end short of a wall) can't let
           a label through into the next room */
        const border = new Uint8Array(W * H), R = Z;
        for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { if (!border0[y * W + xx]) continue;
          for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue;
            for (let dx = -R; dx <= R; dx++) { const x2 = xx + dx; if (x2 >= 0 && x2 < W) border[yy * W + x2] = 1; } } }
        document.body.innerHTML = svgs.full;
        const labels = [...document.querySelectorAll('[data-level] [data-label]')].map((g) => {
          const b = g.getBBox(); return { level: +g.closest('[data-level]').dataset.level, name: g.dataset.label, back: !!g.querySelector('rect'), small: g.dataset.small === '1', b: [b.x, b.y, b.width, b.height] };
        });
        const sum = (m, x0, y0, w, h) => { let n = 0;
          for (let y = Math.max(0, Math.floor(y0 * Z)); y < Math.min(H, Math.ceil((y0 + h) * Z)); y++)
            for (let xx = Math.max(0, Math.floor(x0 * Z)); xx < Math.min(W, Math.ceil((x0 + w) * Z)); xx++) n += m[y * W + xx];
          return n; };
        /* the label's own room: flood-filled from its centre across everything that is not a border,
           within reach of it; a label may only move inside it */
        const roomOf = (cx, cy, rw, rh) => {
          const X0 = Math.max(0, Math.floor((cx - rw) * Z)), Y0 = Math.max(0, Math.floor((cy - rh) * Z));
          const X1 = Math.min(W, Math.ceil((cx + rw) * Z)), Y1 = Math.min(H, Math.ceil((cy + rh) * Z)), w = X1 - X0;
          const m = new Uint8Array(w * (Y1 - Y0)); let sx = Math.round(cx * Z), sy = Math.round(cy * Z);
          /* a centre on a line starts from the nearest open pixel; none near means no room (stay put) */
          if (border[sy * W + sx]) {
            let best = null;
            for (let r = 1; r <= 3 * Z && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || border[(sy + dy) * W + sx + dx]) continue; best = [sx + dx, sy + dy]; break; }
            if (!best) return null;
            [sx, sy] = best;
          }
          const q = [[sx, sy]]; m[(sy - Y0) * w + sx - X0] = 1;
          while (q.length) { const [px, py] = q.pop();
            for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
              if (nx < X0 || ny < Y0 || nx >= X1 || ny >= Y1) continue;
              const i = (ny - Y0) * w + nx - X0; if (m[i] || border[ny * W + nx]) continue; m[i] = 1; q.push([nx, ny]); } }
          return { inside: (x0, y0, bw, bh) => { for (let y = Math.floor(y0 * Z); y < Math.ceil((y0 + bh) * Z); y++) for (let xx = Math.floor(x0 * Z); xx < Math.ceil((x0 + bw) * Z); xx++) {
            if (xx < X0 || y < Y0 || xx >= X1 || y >= Y1 || !m[(y - Y0) * w + xx - X0]) return false; } return true; } };
        };
        const placed = [];
        const clearOf = (x0, y0, w, h, under) => !sum(under, x0, y0, w, h) && !placed.some((p) => x0 < p[0] + p[2] && p[0] < x0 + w && y0 < p[1] + p[3] && p[1] < y0 + h);
        const steps = [[0, 0]];
        for (let r = 0.5; r <= REACH; r += 0.5) for (let a = 0; a < 360; a += Math.max(4, 90 / r)) steps.push([r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)]);
        return labels.map((L, li) => {
          L.noRoom = false;
          if (LOCKS[li]) { placed.push([L.b[0], L.b[1], L.b[2], L.b[3]]); return { ...L, d: [0, 0], f: 1 }; }
          const pad = L.small ? PAD_SMALL : PAD;
          const [bx, by, bw, bh] = L.b, cx = bx + bw / 2, cy = by + bh / 2;
          /* a label backed in white sits on linework on purpose (an elevator's X): it stays put, and only
             gets smaller until it clears the walls */
          const under = L.back ? border : ink, room = L.back ? null : roomOf(cx, cy, REACH + bw, REACH + bh);
          /* no room found, or a small label (W, D, REF sit in their own box): it only gets smaller in place */
          const still = L.back || L.small || !room; L.noRoom = !L.back && !L.small && !room;
          /* each size tries near where it was, then anywhere in its own room within reach, before a smaller
             size is tried: a label shrinks only when its room has no clear spot for it */
          for (const f of SCALES) for (const [r0, r1] of [[0, NEAR], [NEAR, REACH]]) {
            const w = bw * f + 2 * pad, h = bh * f + 2 * pad;
            for (const [dx, dy] of still ? (r0 ? [] : [[0, 0]]) : steps.filter(([a, b]) => { const d = Math.hypot(a, b); return d >= r0 && (d < r1 || (r1 === REACH && d <= r1)); })) {
              const x0 = cx + dx - w / 2, y0 = cy + dy - h / 2;
              if (x0 < 0 || y0 < 0 || x0 + w > 810 || y0 + h > 630) continue;
              if (!clearOf(x0, y0, w, h, under)) continue;
              if (room && !room.inside(x0 + pad, y0 + pad, w - 2 * pad, h - 2 * pad)) continue;
              placed.push([x0, y0, w, h]); return { ...L, d: [dx, dy], f };
            }
          }
          placed.push([bx - pad, by - pad, bw + 2 * pad, bh + 2 * pad]);
          return { ...L, d: null, f: 1 };
        });
      }, [{ full, bare: drawAll(bare, { branded, layout: layout.A }), rooms: drawAll(rooms, { branded, layout: layout.A }) }, Z, PAD, PAD_SMALL, REACH, SCALES, NEAR, locks]);
      await page.close();

      /* back to plan units on each floor */
      const counters = {};
      res.forEach((r) => {
        /* the floor's own scale, read off its transform (s alone leaves out its units per foot) */
        const li = r.level - 1, lvl = plan.levels[li], T = layout.places[li].T, k = T([1, 0])[0] - T([0, 0])[0];
        const list = [...(lvl.rooms || []).filter((q) => typeof q.name === 'string' && q.name.trim() && Array.isArray(q.at)), ...(lvl.labels || []).filter((q) => q.text && Array.isArray(q.at))];
        const i = counters[li] = (counters[li] || 0); counters[li]++;
        const item = list[i];
        if (!item) return;
        const who = lvl.name + ': ' + r.name.replace(/\n/g, ' ');
        if (r.d === null) { if (branded) stuck.push(who); return; }
        if (r.d[0] || r.d[1]) {
          const base = item.allAt || item.at;
          item.allAt = [Math.round(base[0] + r.d[0] / k), Math.round(base[1] + r.d[1] / k)];
          moved.set(item, who);
        }
        if (r.f < 1) { item.allScale = Math.round((item.allScale || 1) * r.f * 100) / 100; moved.set(item, who + ' (smaller, ' + item.allScale + ')'); }
      });
    }
  } finally {
    await browser.close();
  }
  console.log('Text scale on the all-floors sheet: ' + (plan.allSheet ? plan.allSheet.textScale : 'the drawer\'s own'));
  console.log(moved.size ? 'Moved ' + moved.size + ' labels:\n  ' + [...new Set(moved.values())].join('\n  ') : 'Every label already fits.');
  if (stuck.length) console.log('No clear spot within ' + REACH + ' pt (set allAt by hand, a smaller scale or a line break):\n  ' + stuck.join('\n  '));
  if (args.includes('--write')) { fs.writeFileSync(file, JSON.stringify(plan, null, 1)); console.log('Saved ' + file); }
}

main().catch((e) => { console.error(e); process.exit(1); });
