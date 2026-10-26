/* ============================================================
   Matt's symbol artwork -> scripts/floorplan/symbols.json, the drawer's symbol library.

     node scripts/floorplan/import-symbols.js "<Matt's style sheet.svg>" [--map map.json] [--out symbols.json]

   With no map, every group whose id is "symbol-<name>" on the sheet (style-sheet.js draws them at
   true size, wall side up, 8 pt to the foot) becomes symbol <name>, keeping that symbol's mode.
   A map imports artwork that is not yet in its cell: a list of
     { "name", "select": "#id" | "Layer_1>9", "within": [x0, y0, x1, y1], "rotate": 0|90|180|270,
       "w": inches | "h": inches, "mode": "line" | "fill-line" | "art", "mirror": true, "merge": inches }
   rotate turns the art so its wall (or front-of-table) side is at the top; w or h is its true size.
   fill-line only: mirror makes a symmetrical symbol exactly so, from its left half; merge draws lines
   closer than that as one (pieces drawn edge to edge, as the lounge chair's cushions are).

   Every shape is flattened to absolute M / L / C / Q / Z in its own inches, centred on 0,0.
   Modes set how weights are kept:
     line       strokes become the house weights: his heaviest THIN and the rest FINE (all one weight:
                the outer shapes THIN, the small or inner ones FINE). A thin filled shape (an
                outlined frame) becomes its centre line, weighted by its thickness; a solid one its outline
     fill-line  line art drawn as filled outlines: turned into its centre lines (centreline.py, needs
                scikit-image), then drawn at THIN like line art
     art        an emblem (car, compass): fills kept, strokes scaled with the symbol
   Colours become the house's: dark to navy, white stays white, blue to cyan.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const svgpath = require('svgpath');
const { outline } = require('./draw.js');
const STYLE = require('./style.js');

let OUT = path.join(__dirname, 'symbols.json');
const S = 8 / 12;   // the style sheet's pt per inch

/* the shapes under each selected element, read in a browser so CSS classes and transforms resolve */
async function readShapes(file, picks) {
  const { chromium } = require('playwright');
  const svg = fs.readFileSync(file, 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: Math.ceil(vb[2]), height: Math.ceil(vb[3]) } });
    await page.setContent('<body style="margin:0">' + svg.replace(/<svg\b/, '<svg width="' + vb[2] + '" height="' + vb[3] + '"') + '</body>');
    return await page.evaluate((picks) => {
      const SHAPES = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text'];
      const find = (sel) => {
        if (sel.startsWith('#')) return document.getElementById(sel.slice(1));
        const [layer, i] = sel.split('>');
        return document.getElementById(layer).children[+i];
      };
      const out = {};
      picks.forEach((p) => {
        const root = find(p.select);
        if (!root) { out[p.name] = null; return; }
        const list = SHAPES.includes(root.tagName) ? [root] : [...root.querySelectorAll(SHAPES.join(','))];
        /* the drawer's own white backings (data-back) are not Matt's artwork */
        out[p.name] = list.filter((el) => getComputedStyle(el).display !== 'none' && !el.closest('text tspan') && !el.hasAttribute('data-back')).map((el) => {
          const cs = getComputedStyle(el), m = el.getCTM(), b = el.getBoundingClientRect();
          const a = {};
          for (const at of el.attributes) a[at.name] = at.value;
          return { tag: el.tagName, a, text: el.tagName === 'text' ? el.textContent : null,
            m: [m.a, m.b, m.c, m.d, m.e, m.f], box: [b.x, b.y, b.x + b.width, b.y + b.height],
            fill: cs.fill, stroke: cs.stroke, sw: parseFloat(cs.strokeWidth) || 0,
            opacity: +cs.opacity * (+cs.fillOpacity || 1), sopacity: +cs.opacity * (+cs.strokeOpacity || 1),
            dash: cs.strokeDasharray === 'none' ? null : cs.strokeDasharray,
            font: { size: parseFloat(cs.fontSize) || 12, weight: cs.fontWeight } };
        });
      });
      return out;
    }, picks.map(({ name, select }) => ({ name, select })));
  } finally {
    await browser.close();
  }
}

const n = (v) => parseFloat(v) || 0;
/* one shape -> path data in its own coordinates */
function shapeD(s) {
  const a = s.a;
  switch (s.tag) {
    case 'path': return a.d;
    case 'rect': {
      const x = n(a.x), y = n(a.y), w = n(a.width), h = n(a.height);
      let rx = Math.min(n(a.rx || a.ry), w / 2), ry = Math.min(n(a.ry || a.rx), h / 2);
      if (!rx || !ry) return 'M' + x + ' ' + y + 'H' + (x + w) + 'V' + (y + h) + 'H' + x + 'Z';
      return 'M' + (x + rx) + ' ' + y + 'H' + (x + w - rx) + 'A' + rx + ' ' + ry + ' 0 0 1 ' + (x + w) + ' ' + (y + ry) + 'V' + (y + h - ry) +
        'A' + rx + ' ' + ry + ' 0 0 1 ' + (x + w - rx) + ' ' + (y + h) + 'H' + (x + rx) + 'A' + rx + ' ' + ry + ' 0 0 1 ' + x + ' ' + (y + h - ry) +
        'V' + (y + ry) + 'A' + rx + ' ' + ry + ' 0 0 1 ' + (x + rx) + ' ' + y + 'Z';
    }
    case 'circle': case 'ellipse': {
      const cx = n(a.cx), cy = n(a.cy), rx = s.tag === 'circle' ? n(a.r) : n(a.rx), ry = s.tag === 'circle' ? n(a.r) : n(a.ry);
      return 'M' + (cx - rx) + ' ' + cy + 'A' + rx + ' ' + ry + ' 0 1 0 ' + (cx + rx) + ' ' + cy + 'A' + rx + ' ' + ry + ' 0 1 0 ' + (cx - rx) + ' ' + cy + 'Z';
    }
    case 'line': return 'M' + n(a.x1) + ' ' + n(a.y1) + 'L' + n(a.x2) + ' ' + n(a.y2);
    case 'polyline': case 'polygon': {
      const p = (a.points || '').trim().split(/[\s,]+/).map(Number);
      let d = '';
      for (let i = 0; i + 1 < p.length; i += 2) d += (i ? 'L' : 'M') + p[i] + ' ' + p[i + 1];
      return s.tag === 'polygon' ? d + 'Z' : d;
    }
    case 'text':   /* outlined in the house font: the symbol never needs the font Matt used */
      return outline(s.text.trim(), { weight: 900, sizePt: s.font.size, x: n(a.x), y: n(a.y), anchor: 'start' });
    default: return '';
  }
}

/* absolute M L C Q Z commands, with the transform matrix applied */
function commands(d, m) {
  const out = [];
  svgpath(d).matrix(m).unarc().unshort().abs().iterate((seg, i, x, y) => {
    const c = seg[0];
    if (c === 'H') out.push(['L', seg[1], y]);
    else if (c === 'V') out.push(['L', x, seg[1]]);
    else if ('MLCQZ'.includes(c)) out.push(seg.slice());
  });
  return out;
}

/* every point a list of commands visits, curves sampled */
function points(cmds) {
  const pts = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  cmds.forEach((c) => {
    if (c[0] === 'M') { cx = sx = c[1]; cy = sy = c[2]; pts.push([cx, cy]); }
    else if (c[0] === 'L') { cx = c[1]; cy = c[2]; pts.push([cx, cy]); }
    else if (c[0] === 'C') {
      for (let k = 1; k <= 8; k++) { const t = k / 8, u = 1 - t;
        pts.push([u * u * u * cx + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * cy + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]]); }
      cx = c[5]; cy = c[6];
    } else if (c[0] === 'Q') {
      for (let k = 1; k <= 8; k++) { const t = k / 8, u = 1 - t;
        pts.push([u * u * cx + 2 * u * t * c[1] + t * t * c[3], u * u * cy + 2 * u * t * c[2] + t * t * c[4]]); }
      cx = c[3]; cy = c[4];
    } else if (c[0] === 'Z') { cx = sx; cy = sy; pts.push([cx, cy]); }
  });
  return pts;
}
const bboxOf = (pts) => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);

/* line art's thickness: about 2 x filled area / outline length. Each contour counts + or - by how
   deep it is nested inside the path's other contours (the even-odd rule), so a ring's hole is taken out */
function thickness(paths) {
  let area = 0, length = 0;
  const inPoly = (pt, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  paths.forEach((p) => {
    const rings = [];
    let i = 0;
    while (i < p.cmds.length) {
      const seg = [p.cmds[i++]];
      while (i < p.cmds.length && p.cmds[i][0] !== 'M') seg.push(p.cmds[i++]);
      const ring = points(seg);
      if (ring.length > 2) rings.push(ring);
    }
    let nested = 0, signed = 0;
    rings.forEach((ring, ri) => {
      let a = 0;
      for (let k = 0; k < ring.length; k++) { const [x0, y0] = ring[k], [x1, y1] = ring[(k + 1) % ring.length]; a += x0 * y1 - x1 * y0; length += Math.hypot(x1 - x0, y1 - y0); }
      /* nudged off its vertex, so a ray along a run of points level with it still counts true */
      const at = [ring[0][0] + 1.3e-6, ring[0][1] + 0.7e-6];
      const depth = rings.filter((o, oi) => oi !== ri && inPoly(at, o)).length;
      nested += (depth % 2 ? -1 : 1) * Math.abs(a) / 2;
      signed += a / 2;
    });
    /* a ring thinner than its points are precise can seem to cross itself; then its contours' own
       directions (a hole runs the other way) give the area */
    area += nested > 0 ? nested : Math.abs(signed);
  });
  return length ? (2 * Math.max(area, 0)) / length : 0;
}

/* drop points that lie within tol of the straight run between their neighbours (Ramer-Douglas-Peucker),
   on runs of straight segments only; curves are kept as they are */
function simplify(cmds, tol) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length > 2) {
      const keep = new Array(run.length).fill(false);
      keep[0] = keep[run.length - 1] = true;
      const rdp = (a, b) => {
        let far = -1, fd = tol;
        const [ax, ay] = run[a], [bx, by] = run[b], L = Math.hypot(bx - ax, by - ay);
        for (let k = a + 1; k < b; k++) {
          /* distance from the chord, or from its point when the run closes on itself */
          const d = L < 1e-9 ? Math.hypot(run[k][0] - ax, run[k][1] - ay) : Math.abs((bx - ax) * (ay - run[k][1]) - (ax - run[k][0]) * (by - ay)) / L;
          if (d > fd) { fd = d; far = k; }
        }
        if (far > 0) { keep[far] = true; rdp(a, far); rdp(far, b); }
      };
      rdp(0, run.length - 1);
      run.forEach((q, k) => { if (k && keep[k]) out.push(['L', q[0], q[1]]); });
    } else run.slice(1).forEach((q) => out.push(['L', q[0], q[1]]));
    run = [];
  };
  let cx = 0, cy = 0;
  cmds.forEach((c) => {
    if (c[0] === 'L') { if (!run.length) run.push([cx, cy]); run.push([c[1], c[2]]); }
    else { flush(); out.push(c); }
    if (c[0] === 'M' || c[0] === 'L') { cx = c[1]; cy = c[2]; } else if (c[0] === 'C') { cx = c[5]; cy = c[6]; } else if (c[0] === 'Q') { cx = c[3]; cy = c[4]; }
  });
  flush();
  return out;
}

/* curves -> short straight runs (for traced artwork with thousands of curves, before simplify) */
function flatten(cmds) {
  const out = [];
  let cx = 0, cy = 0;
  cmds.forEach((c) => {
    if (c[0] === 'C' || c[0] === 'Q') {
      points([['M', cx, cy], c]).slice(1).forEach(([x, y]) => out.push(['L', x, y]));
      cx = c[c.length - 2]; cy = c[c.length - 1];
    } else { out.push(c); if (c[0] !== 'Z') { cx = c[1]; cy = c[2]; } }
  });
  return out;
}
/* drop subpaths too small to see */
function dropSpecks(cmds, min) {
  const out = [];
  let i = 0;
  while (i < cmds.length) {
    const seg = [cmds[i++]];
    while (i < cmds.length && cmds[i][0] !== 'M') seg.push(cmds[i++]);
    const b = bboxOf(points(seg));
    if (Math.max(b[2] - b[0], b[3] - b[1]) >= min) out.push(...seg);
  }
  return out;
}

/* run centreline.py on groups of filled contours: [{ rings, line, mirror }] -> [[path data]] */
function centrelines(groups) {
  const os = require('os'), cp = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-centre-'));
  try {
    fs.writeFileSync(path.join(dir, 'rings.json'), JSON.stringify({ groups }));
    if (process.env.GVC_KEEP) fs.copyFileSync(path.join(dir, 'rings.json'), process.env.GVC_KEEP);
    const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    const r = cp.spawnSync(py, ['-I', path.join(__dirname, 'centreline.py'), path.join(dir, 'rings.json'), path.join(dir, 'paths.json')], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('centreline.py failed (it needs: pip install scikit-image): ' + [r.status, r.signal, r.error, r.stderr].filter(Boolean).join(' '));
    return JSON.parse(fs.readFileSync(path.join(dir, 'paths.json'), 'utf8')).groups;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
/* path data (absolute M L C Q Z, as symbols.json holds it) -> commands */
const cmdsOf = (d) => d.match(/[MLCQZ][^MLCQZ]*/g).map((t) => [t[0], ...(t.slice(1).trim() ? t.slice(1).trim().split(/\s+/).map(Number) : [])]);
/* a path's contours, each as its sampled points */
const ringsOf = (cmds) => {
  const rings = [];
  let i = 0;
  while (i < cmds.length) { const seg = [cmds[i++]]; while (i < cmds.length && cmds[i][0] !== 'M') seg.push(cmds[i++]); rings.push(points(seg)); }
  return rings;
};

function colour(c) {
  const m = /rgba?\(([^)]+)\)/.exec(c || '');
  if (!m) return null;
  const [r, g, b, a] = m[1].split(',').map((v) => parseFloat(v));
  if (a === 0) return null;
  if (r > 235 && g > 235 && b > 235) return 'white';
  if (b > 150 && r < 120) return 'cyan';
  if (r < 90 && g < 90 && b < 110) return 'navy';
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

const round = (v) => Math.round(v * 100) / 100;
/* shapes (sheet units) -> a symbol: rotated wall side up, centred, scaled to true inches */
function build(name, shapes, opt) {
  const raw = shapes.map((s) => ({ s, cmds: commands(shapeD(s), s.m) })).filter((p) => p.cmds.length);
  const all = bboxOf(raw.flatMap((p) => points(p.cmds)));
  const cx = (all[0] + all[2]) / 2, cy = (all[1] + all[3]) / 2;
  const q = ((opt.rotate || 0) * Math.PI) / 180, cos = Math.round(Math.cos(q) * 1e9) / 1e9, sin = Math.round(Math.sin(q) * 1e9) / 1e9;
  const turn = ([x, y]) => [(x - cx) * cos - (y - cy) * sin, (x - cx) * sin + (y - cy) * cos];
  const turned = raw.map((p) => ({ s: p.s, cmds: p.cmds.map((c) => { const o = [c[0]]; for (let i = 1; i < c.length; i += 2) o.push(...turn([c[i], c[i + 1]])); return o; }) }));
  const tb = bboxOf(turned.flatMap((p) => points(p.cmds)));
  const tw = tb[2] - tb[0], th = tb[3] - tb[1];
  const k = opt.w ? opt.w / tw : opt.h ? opt.h / th : 1 / S;   // sheet units -> inches
  const ox = (tb[0] + tb[2]) / 2, oy = (tb[1] + tb[3]) / 2;
  const traced = raw.reduce((t, p) => t + p.cmds.length, 0) > 3000;   // image-trace artwork: flatten and thin it out
  const paths = turned.map((p) => {
    let cmds = p.cmds.map((c) => { const o = [c[0]]; for (let i = 1; i < c.length; i += 2) o.push((c[i] - ox) * k, (c[i + 1] - oy) * k); return o; });
    cmds = dropSpecks(traced ? flatten(cmds) : cmds, 0.02);
    cmds = simplify(cmds, traced ? 0.06 : 0.04).map((c) => [c[0], ...c.slice(1).map(round)]);
    return { s: p.s, cmds };
  }).filter((p) => p.cmds.length);
  const W = round(tw * k), H = round(th * k), big = Math.max(W, H);

  const boxes = paths.map((p) => bboxOf(points(p.cmds)));
  /* in line art, a thin filled shape (an outlined frame or burner ring) is a line too: it becomes its centre
     line, weighted by its own thickness; a solid navy shape (a bar) becomes its outline */
  if (opt.mode === 'line') paths.forEach((p, i) => {
    if (colour(p.s.fill) !== 'navy' || (p.s.sw > 0 && colour(p.s.stroke))) return;
    const b = boxes[i], t = thickness([p]);
    if (t > 0 && t < 0.25 * Math.min(b[2] - b[0], b[3] - b[1])) p.lineFill = t / k;   // in sheet units, like sw
    else p.solid = true;
  });
  const weightOf = (p) => (p.lineFill ? p.lineFill : p.s.sw > 0 && colour(p.s.stroke) ? p.s.sw : 0);
  /* when Matt drew lines at more than one weight, his heaviest become THIN and the rest FINE */
  const weights = [...new Set(paths.map(weightOf).filter((w) => w > 0).map((w) => Math.round(w * 100) / 100))].sort((x, y) => y - x);
  const heavy = (w) => w >= weights[0] * 0.75;
  const inside = (a, b) => a !== b && a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 && a[2] <= b[2] + 1e-6 && a[3] <= b[3] + 1e-6 && (b[2] - b[0]) * (b[3] - b[1]) > (a[2] - a[0]) * (a[3] - a[1]);
  const several = weights.length > 1 && !heavy(weights[weights.length - 1]);
  /* all drawn at one weight: the symbol's own outline (a shape spanning it) is THIN and every detail FINE;
     with no such outline, the outer shapes THIN and the small or inner ones FINE */
  const spans = (b) => b[2] - b[0] >= W * 0.85 && b[3] - b[1] >= H * 0.85;
  const lineFills = paths.filter((p) => p.lineFill);
  const centres = lineFills.length ? centrelines(lineFills.map((p) => ({ rings: ringsOf(p.cmds), line: p.lineFill * k }))) : [];
  const drawn = paths.map((p, i) => (p.lineFill ? centres[lineFills.indexOf(p)].map((d) => bboxOf(points(cmdsOf(d)))) : [boxes[i]]));
  const outlined = drawn.flat().some(spans);
  const oneWeight = (b) => (outlined ? (spans(b) ? 'thin' : 'fine') : Math.max(b[2] - b[0], b[3] - b[1]) < big * 0.15 || boxes.some((c) => inside(b, c)) ? 'fine' : 'thin');
  const out = paths.flatMap((p, i) => {
    const s = p.s, b = boxes[i];
    if (p.lineFill) return centres[lineFills.indexOf(p)].map((d, j) => ({ d, stroke: 'navy', weight: several ? (heavy(p.lineFill) ? 'thin' : 'fine') : oneWeight(drawn[i][j]) }));
    const fill = p.solid ? null : colour(s.fill), stroke = p.solid ? 'navy' : s.sw > 0 ? colour(s.stroke) : null;
    const o = { d: p.cmds.map((c) => c[0] + c.slice(1).join(' ')).join('') };
    if (fill) o.fill = fill;
    if (stroke) {
      o.stroke = stroke;
      if (opt.mode === 'art') o.sw = round(s.sw * k);
      else if (p.solid) o.weight = several ? 'fine' : oneWeight(b);
      else if (several) o.weight = heavy(s.sw) ? 'thin' : 'fine';
      else if (Math.abs(s.sw - STYLE.THIN) < 0.01 || Math.abs(s.sw - STYLE.FINE) < 0.01) o.weight = Math.abs(s.sw - STYLE.THIN) < 0.01 ? 'thin' : 'fine';   // already at a house weight (a sheet coming back)
      else o.weight = oneWeight(b);
    }
    const op = stroke && !fill ? s.sopacity : s.opacity;
    if (op < 0.999) o.opacity = round(op);
    return [o];
  }).filter((o) => o.fill || o.stroke);
  const sym = { mode: opt.mode, size: [W, H], paths: out };
  if (opt.mode === 'fill-line') {
    /* filled outlines can't take a stroke weight, so they become their own centre lines (centreline.py),
       drawn at the house weight like any other line art */
    const filled = paths.filter((p) => colour(p.s.fill));
    sym.mode = 'line';
    sym.from = 'fill-line';
    sym.paths = centrelines([{ rings: filled.flatMap((p) => ringsOf(p.cmds)), line: thickness(filled), mirror: !!opt.mirror, merge: opt.merge || 0 }])[0].map((d) => ({ d, stroke: 'navy', weight: 'thin' }));
  }
  if (opt.note) sym.note = opt.note;
  /* the size is what is finally drawn (centre lines, specks dropped), centred on 0,0 */
  const fb = bboxOf(sym.paths.flatMap((p) => points(cmdsOf(p.d))));
  const mx = (fb[0] + fb[2]) / 2, my = (fb[1] + fb[3]) / 2;
  if (Math.abs(mx) > 0.005 || Math.abs(my) > 0.005) {
    sym.paths.forEach((p) => { p.d = p.d.replace(/([MLCQZ])([^MLCQZ]*)/g, (m, c, nums) => c + (nums.trim() ? nums.trim().split(/\s+/).map((v, i) => round(+v - (i % 2 ? my : mx))).join(' ') : '')); });
  }
  sym.size = [round(fb[2] - fb[0]), round(fb[3] - fb[1])];
  return sym;
}

async function main(file, mapFile) {
  const lib = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  let picks;
  if (mapFile) picks = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  else {
    const ids = [...fs.readFileSync(file, 'utf8').matchAll(/<g[^>]*\sid="symbol-([^"]+)"/g)].map((m) => m[1]);
    picks = ids.map((name) => ({ name, select: '#symbol-' + name, mode: (lib[name] || {}).mode || 'line' }));
  }
  const shapes = await readShapes(file, picks);
  picks.forEach((p) => {
    let list = shapes[p.name];
    if (!list || !list.length) { console.log('  ' + p.name + ': nothing found at ' + p.select); return; }
    if (p.within) list = list.filter((s) => s.box[0] >= p.within[0] && s.box[1] >= p.within[1] && s.box[2] <= p.within[2] && s.box[3] <= p.within[3]);
    lib[p.name] = build(p.name, list, p);
    console.log('  ' + p.name + ': ' + lib[p.name].paths.length + ' shapes, ' + lib[p.name].size.join(' x ') + ' in');
  });
  const sorted = {};
  Object.keys(lib).sort().forEach((k) => { sorted[k] = lib[k]; });
  fs.writeFileSync(OUT, JSON.stringify(sorted) + '\n');
  console.log('Saved ' + Object.keys(sorted).length + ' symbols to ' + OUT);
}

module.exports = { build, commands, thickness, simplify, points };

if (require.main === module) {
  const file = process.argv[2], mi = process.argv.indexOf('--map'), oi = process.argv.indexOf('--out');
  if (oi > 0) OUT = path.resolve(process.argv[oi + 1]);
  if (!file) { console.error('Usage: node scripts/floorplan/import-symbols.js "<style sheet.svg>" [--map map.json]'); process.exit(1); }
  main(file, mi > 0 ? process.argv[mi + 1] : null).catch((e) => { console.error(e.message); process.exit(1); });
}
