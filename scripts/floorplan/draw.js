/* ============================================================
   The floorplan drawer: plan.json level -> one SVG in the fixed GVC house style.

     draw(plan, levelIndex, { branded, facts: { beds, baths, sqft } }) -> SVG document string
     outline(text, { weight, sizePt, x, y, anchor, tracking }) -> SVG path "d"

   Every word is outlined to paths with fontkit (no <text>, no fonts needed to view it) and
   nothing is referenced from outside the file. Output is deterministic: coordinates are
   rounded to 2 decimals and ids are fixed. Every size, weight and colour comes from style.js.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');
const STYLE = require('./style.js');
const { fitScale, arcOf, levelPoints } = require('./plan.js');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- numbers and attributes ---------- */
const r2 = (v) => { const n = Math.round(v * 100) / 100; return Object.is(n, -0) ? 0 : n; };
const pt = (p) => r2(p[0]) + ' ' + r2(p[1]);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- text outlining ---------- */
const fonts = {};
function font(weight) {
  if (!fonts[weight]) fonts[weight] = fontkit.openSync(path.join(ROOT, STYLE.FONT_FILE.replace('{weight}', weight)));
  return fonts[weight];
}

/* width in pt of text at a size, letter-spacing included between glyphs */
function measure(text, { weight, sizePt, tracking = 0 }) {
  const f = font(weight), run = f.layout(text), k = sizePt / f.unitsPerEm;
  const adv = run.positions.reduce((s, p) => s + p.xAdvance, 0);
  return adv * k + Math.max(0, run.glyphs.length - 1) * tracking * sizePt;
}

/* cap height in pt (the font's own metric) */
const capHeight = (style) => font(style.weight).capHeight * style.sizePt / font(style.weight).unitsPerEm;

function outline(text, { weight, sizePt, x = 0, y = 0, anchor = 'start', tracking = 0 }) {
  const f = font(weight), run = f.layout(text), k = sizePt / f.unitsPerEm;
  const w = measure(text, { weight, sizePt, tracking });
  let pen = x - (anchor === 'middle' ? w / 2 : anchor === 'end' ? w : 0);
  const out = [];
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const ox = pen + pos.xOffset * k, oy = y - pos.yOffset * k;
    const X = (u) => r2(ox + u * k), Y = (v) => r2(oy - v * k);
    g.path.commands.forEach(({ command, args }) => {
      if (command === 'moveTo') out.push('M' + X(args[0]) + ' ' + Y(args[1]));
      else if (command === 'lineTo') out.push('L' + X(args[0]) + ' ' + Y(args[1]));
      else if (command === 'quadraticCurveTo') out.push('Q' + X(args[0]) + ' ' + Y(args[1]) + ' ' + X(args[2]) + ' ' + Y(args[3]));
      else if (command === 'bezierCurveTo') out.push('C' + X(args[0]) + ' ' + Y(args[1]) + ' ' + X(args[2]) + ' ' + Y(args[3]) + ' ' + X(args[4]) + ' ' + Y(args[5]));
      else if (command === 'closePath') out.push('Z');
    });
    pen += pos.xAdvance * k + tracking * sizePt;
  });
  return out.join('');
}

/* ---------- geometry ---------- */
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const len = (a) => Math.hypot(a[0], a[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/* the same points fitScale measures: wall ends and curves, solid corners, area corners */
function bounds(level) {
  const pts = levelPoints(level);
  if (!pts.length) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const poly = (pts) => 'M' + pts.map(pt).join('L') + 'Z';
const thin = (extra = '') => 'fill="' + STYLE.WHITE + '" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '"' + extra;
const line = (a, b) => 'M' + pt(a) + 'L' + pt(b);

/* ---------- a wall's centre line on the page, straight or curved ---------- */
/* at(t) and dir(t) for t in 0-1 (dir is the unit direction of travel from a to b); len in pt;
   seg(t0, t1, k): the path from at(t0) to at(t1) shifted k pt to the left, without its M. */
function course(w, T) {
  const a = T(w.a), b = T(w.b);
  const arc = isPt(w.via) ? arcOf(a, b, T(w.via)) : null;
  if (arc) {
    const sg = arc.sweep > 0 ? 1 : -1;
    const at = (t, k = 0) => {
      const q = arc.a0 + arc.sweep * t, r = arc.r + sg * k;
      return [arc.c[0] + r * Math.cos(q), arc.c[1] + r * Math.sin(q)];
    };
    return {
      len: Math.abs(arc.sweep) * arc.r, at,
      dir: (t) => { const q = arc.a0 + arc.sweep * t; return [-Math.sin(q) * sg, Math.cos(q) * sg]; },
      seg: (t0, t1, k = 0) => {
        const r = arc.r + sg * k;
        return 'A' + r2(r) + ' ' + r2(r) + ' 0 ' + (Math.abs(arc.sweep * (t1 - t0)) > Math.PI ? 1 : 0) + ' ' +
          ((t1 > t0) === (arc.sweep > 0) ? 1 : 0) + ' ' + pt(at(t1, k));
      }
    };
  }
  const L = len(sub(b, a)), d = L ? mul(sub(b, a), 1 / L) : [1, 0], left = [d[1], -d[0]];
  const at = (t, k = 0) => addv(lerp(a, b, t), mul(left, k));
  return { len: L, at, dir: () => d, seg: (t0, t1, k = 0) => 'L' + pt(at(t1, k)) };
}
const leftOf = (d) => [d[1], -d[0]];
const wallWidth = (type) => (type === 'exterior' ? STYLE.WALL_EXTERIOR : type === 'glass' ? STYLE.WALL_GLASS : STYLE.WALL_INTERIOR);
const keyOf = (p) => r2(p[0]) + ',' + r2(p[1]);

/* ---------- walls: openings cut out, connected runs drawn as one line ---------- */
/* Runs that meet end to end (same type, same point in plan.json) join into one stroked path with mitred
   corners, so corners and curves have no notches or gaps. A run's free end is squared off half a wall
   past its point; an end cut by an opening stops flush. */
function drawWalls(level, T) {
  const walls = level.walls || [], out = [];
  ['exterior', 'interior', 'glass'].forEach((type) => {
    const width = wallWidth(type), hw = width / 2;
    const spans = [];
    walls.forEach((w, wi) => {
      if (w.type !== type || !isPt(w.a) || !isPt(w.b)) return;
      const C = course(w, T);
      if (!C.len) return;
      const cuts = (level.openings || []).filter((o) => o.wall === wi).map((o) => [o.from, o.to]).sort((p, q) => p[0] - q[0]);
      let t = 0;
      const add = (s, e) => spans.push({ C, s, e, A: s === 0 ? keyOf(w.a) : null, B: e === 1 ? keyOf(w.b) : null });
      cuts.forEach(([f, to]) => { if (f > t) add(t, f); t = Math.max(t, to); });
      if (t < 1) add(t, 1);
    });

    const used = new Set();
    const endOf = (c) => (c.fwd ? c.sp.B : c.sp.A), startOf = (c) => (c.fwd ? c.sp.A : c.sp.B);
    const take = (key, wantStart) => {
      if (!key) return null;
      for (const sp of spans) {
        if (used.has(sp)) continue;
        /* forwards a span starting here; backwards a span ending here (either way it then runs a to b) */
        if ((wantStart ? sp.A : sp.B) === key) { used.add(sp); return { sp, fwd: true }; }
        if ((wantStart ? sp.B : sp.A) === key) { used.add(sp); return { sp, fwd: false }; }
      }
      return null;
    };
    const d = [];
    spans.forEach((sp) => {
      if (used.has(sp)) return;
      used.add(sp);
      const chain = [{ sp, fwd: true }];
      let next;
      while ((!startOf(chain[0]) || endOf(chain[chain.length - 1]) !== startOf(chain[0])) && (next = take(endOf(chain[chain.length - 1]), true))) chain.push(next);
      const closed = chain.length > 1 && !!startOf(chain[0]) && endOf(chain[chain.length - 1]) === startOf(chain[0]);
      if (!closed) while ((next = take(startOf(chain[0]), false))) chain.unshift(next);

      const piece = (c) => (c.fwd ? [c.sp.s, c.sp.e] : [c.sp.e, c.sp.s]);
      const travel = (c, t) => mul(c.sp.C.dir(t), c.fwd ? 1 : -1);
      const first = chain[0], last = chain[chain.length - 1];
      const [f0] = piece(first), [, l1] = piece(last);
      let path = 'M' + pt(startOf(first) && !closed ? addv(first.sp.C.at(f0), mul(travel(first, f0), -hw)) : first.sp.C.at(f0));
      if (startOf(first) && !closed) path += 'L' + pt(first.sp.C.at(f0));
      chain.forEach((c) => { const [t0, t1] = piece(c); path += c.sp.C.seg(t0, t1); });
      if (closed) path += 'Z';
      else if (endOf(last)) path += 'L' + pt(addv(last.sp.C.at(l1), mul(travel(last, l1), hw)));
      d.push(path);
    });
    if (d.length) out.push('<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + width + '" stroke-linejoin="miter" stroke-miterlimit="8" d="' + d.join('') + '"/>');
  });
  return out.join('');
}

/* ---------- openings: doors, windows, sliders ---------- */
function drawOpenings(level, T) {
  const walls = level.walls || [], out = [];
  const stroke = 'fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '"';
  (level.openings || []).forEach((o) => {
    const w = walls[o.wall];
    if (!w || !isPt(w.a) || !isPt(w.b)) return;
    const C = course(w, T);
    if (!C.len) return;
    const hw = Math.max(wallWidth(w.type) / 2 - STYLE.THIN / 2, 0);

    if (o.type === 'window') {
      /* two lines along the wall, closed at each end: neighbouring windows show their mullion */
      const along = (k) => 'M' + pt(C.at(o.from, k)) + C.seg(o.from, o.to, k);
      const across = (t) => line(C.at(t, hw), C.at(t, -hw));
      out.push('<path ' + stroke + ' d="' + along(hw) + along(-hw) + across(o.from) + across(o.to) + '"/>');
      return;
    }
    if (o.type === 'opening' || isPt(w.via)) return;   /* a plain gap; the validator keeps doors off curves */

    const d = C.dir(0), left = leftOf(d);
    const n = o.side === 'right' ? mul(left, -1) : left;
    const p0 = C.at(o.from), p1 = C.at(o.to), span = C.len * (o.to - o.from);
    /* Matt's rule: a door to the outside (o.outside) is drawn fully open, every other door half open */
    const open = (o.outside ? STYLE.DOOR_OPEN_OUTSIDE : STYLE.DOOR_OPEN_INSIDE) * Math.PI / 180;
    const swing = (hinge, free, r) => {
      const along = mul(sub(free, hinge), 1 / (len(sub(free, hinge)) || 1));
      const tip = addv(hinge, addv(mul(along, r * Math.cos(open)), mul(n, r * Math.sin(open))));
      const u = sub(tip, hinge), v = sub(free, hinge);
      const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
      out.push('<path ' + thin() + ' d="' + line(hinge, tip) + '"/>');
      out.push('<path ' + stroke + ' d="M' + pt(tip) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 ' + sweep + ' ' + pt(free) + '"/>');
    };

    if (o.type === 'door') {
      const [h, f] = o.hinge === 'to' ? [p1, p0] : [p0, p1];
      swing(h, f, span);
    } else if (o.type === 'double-door') {
      const mid = lerp(p0, p1, 0.5);
      swing(p0, mid, span / 2);
      swing(p1, mid, span / 2);
    } else if (o.type === 'sliding' || o.type === 'pocket') {
      const t = STYLE.SLIDING_PANEL;
      const panel = (s, e, off) => {
        const q0 = addv(lerp(p0, p1, s), mul(left, off)), q1 = addv(lerp(p0, p1, e), mul(left, off));
        return poly([addv(q0, mul(left, t / 2)), addv(q1, mul(left, t / 2)), addv(q1, mul(left, -t / 2)), addv(q0, mul(left, -t / 2))]);
      };
      /* a pocket door's panel stands part-way out of its pocket (at the hinge end, in the wall) */
      const pocketTo = o.hinge !== 'from';
      const d2 = o.type === 'sliding' ? panel(0, 0.55, t / 2) + panel(0.45, 1, -t / 2)
        : pocketTo ? panel(0.45, 1 + 0.45, 0) : panel(-0.45, 0.55, 0);
      out.push('<path ' + thin() + ' d="' + d2 + '"/>');
    }
  });
  return out.join('');
}

/* ---------- thin linework: cabinet and built-in outlines, stair winders ---------- */
function drawLines(level, T) {
  const out = [];
  (level.lines || []).forEach((l) => {
    if (!l || !Array.isArray(l.pts) || l.pts.length < 2 || !l.pts.every(isPt)) return;
    const P = l.pts.map(T);
    out.push(l.closed ? '<path ' + thin() + ' d="' + poly(P) + '"/>'
      : '<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '" d="M' + P.map(pt).join('L') + '"/>');
  });
  return out.join('');
}

/* ---------- solids and areas ---------- */
function drawSolids(level, T) {
  const d = (level.solids || []).filter((s) => Array.isArray(s) && s.length >= 3 && s.every(isPt)).map((s) => poly(s.map(T))).join('');
  return d ? '<path fill="' + STYLE.NAVY + '" d="' + d + '"/>' : '';
}

function drawAreas(level, T) {
  const out = [];
  (level.areas || []).forEach((a) => {
    if (!Array.isArray(a.poly) || a.poly.length < 3 || !a.poly.every(isPt)) return;
    const P = a.poly.map(T), d = poly(P);
    const stroke = 'stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '"';
    if (a.type === 'terrace' || a.type === 'balcony') {
      out.push('<path fill="' + STYLE.TERRACE_FILL + '" ' + stroke + ' d="' + d + '"/>');
    } else if (a.type === 'closet') {
      out.push('<path fill="none" ' + stroke + ' stroke-dasharray="' + STYLE.CLOSET_DASH + '" d="' + d + '"/>');
    } else if (a.type === 'void') {
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      out.push('<path fill="none" ' + stroke + ' d="' + d + line([x0, y0], [x1, y1]) + line([x1, y0], [x0, y1]) + '"/>');
    } else if (a.type === 'stair') {
      /* treads across the long side; the arrow runs along it, toward a.dir when the plan gives one */
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const alongX = x1 - x0 >= y1 - y0;
      let tr = '';
      /* a.treads: the source's own count, spread evenly; otherwise one every STAIR_TREAD pt */
      const run = alongX ? x1 - x0 : y1 - y0, step = Number.isInteger(a.treads) && a.treads > 0 ? run / (a.treads + 1) : STYLE.STAIR_TREAD;
      if (alongX) for (let x = x0 + step; x < x1 - 0.01; x += step) tr += line([x, y0], [x, y1]);
      else for (let y = y0 + step; y < y1 - 0.01; y += step) tr += line([x0, y], [x1, y]);
      const back = Array.isArray(a.dir) && (alongX ? a.dir[0] < 0 : a.dir[1] < 0);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, h = STYLE.STAIR_ARROW;
      let s0, s1;
      if (alongX) { s0 = [back ? x1 - h : x0 + h, cy]; s1 = [back ? x0 + h : x1 - h, cy]; } else { s0 = [cx, back ? y1 - h : y0 + h]; s1 = [cx, back ? y0 + h : y1 - h]; }
      const dv = mul(sub(s1, s0), 1 / (len(sub(s1, s0)) || 1)), nv = [dv[1], -dv[0]];
      const head = line(addv(s1, addv(mul(dv, -h), mul(nv, h * 0.6))), s1) + 'L' + pt(addv(s1, addv(mul(dv, -h), mul(nv, -h * 0.6))));
      out.push('<path ' + thin() + ' d="' + d + '"/>');
      out.push('<path fill="none" ' + stroke + ' d="' + tr + (a.arrow === false ? '' : line(s0, s1) + head) + '"/>');
    }
  });
  return out.join('');
}

/* ---------- fixtures: drawn in a local box centred on 0,0, w x h pt ---------- */
const rect = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const ell = (cx, cy, rx, ry) => 'M' + r2(cx - rx) + ' ' + r2(cy) + 'A' + r2(rx) + ' ' + r2(ry) + ' 0 1 0 ' + r2(cx + rx) + ' ' + r2(cy) + 'A' + r2(rx) + ' ' + r2(ry) + ' 0 1 0 ' + r2(cx - rx) + ' ' + r2(cy) + 'Z';
const rrect = (x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2);
  return 'M' + r2(x + r) + ' ' + r2(y) + 'L' + r2(x + w - r) + ' ' + r2(y) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(x + w) + ' ' + r2(y + r) +
    'L' + r2(x + w) + ' ' + r2(y + h - r) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(x + w - r) + ' ' + r2(y + h) +
    'L' + r2(x + r) + ' ' + r2(y + h) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(x) + ' ' + r2(y + h - r) +
    'L' + r2(x) + ' ' + r2(y + r) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(x + r) + ' ' + r2(y) + 'Z';
};

/* rot 0: the wall the fixture backs onto is at the top (-h/2); it faces down the page */
const uShape = (bw, yt, yb, ry) => 'M' + r2(-bw) + ' ' + r2(yt) + 'L' + r2(-bw) + ' ' + r2(yb - ry) +
  'A' + r2(bw) + ' ' + r2(ry) + ' 0 0 0 ' + r2(bw) + ' ' + r2(yb - ry) + 'L' + r2(bw) + ' ' + r2(yt) + 'Z';
const FIXTURE_DRAW = {
  /* tank against the wall, elongated bowl with its seat opening */
  toilet: (w, h) => {
    const tank = h * 0.3, yt = -h / 2 + tank, yb = h / 2, bw = w * 0.38, ry = Math.min(bw * 1.25, (yb - yt) * 0.7);
    const iw = bw * 0.62, iyt = yt + (yb - yt) * 0.18, iyb = yb - (yb - yt) * 0.14;
    return [rrect(-w / 2, -h / 2, w, tank, Math.min(w, tank) * 0.15), uShape(bw, yt, yb, ry), uShape(iw, iyt, iyb, Math.min(iw * 1.25, (iyb - iyt) * 0.7))];
  },
  /* vanity: counter, oval basin, faucet at the wall */
  sink: (w, h) => [rect(-w / 2, -h / 2, w, h), ell(0, h * 0.06, w * 0.33, h * 0.3), ell(0, -h / 2 + h * 0.13, Math.min(w, h) * 0.05, Math.min(w, h) * 0.05)],
  /* pedestal or vessel basin: a round bowl, the faucet reaching in from the wall, the drain */
  'round-sink': (w, h) => {
    const r = Math.min(w, h) / 2;
    return [ell(0, 0, r, r), line([0, -r], [0, -r * 0.45]), ell(0, r * 0.15, r * 0.08, r * 0.08)];
  },
  'double-sink': (w, h) => [rect(-w / 2, -h / 2, w, h), ell(-w / 4, h * 0.06, w * 0.15, h * 0.3), ell(w / 4, h * 0.06, w * 0.15, h * 0.3)],
  tub: (w, h) => [rect(-w / 2, -h / 2, w, h), rrect(-w / 2 + w * 0.06, -h / 2 + h * 0.12, w * 0.88, h * 0.76, h * 0.35)],
  /* the pan with its fall lines to a square drain */
  shower: (w, h) => {
    const k = Math.min(w, h) * 0.05;
    return [rect(-w / 2, -h / 2, w, h), line([-w / 2, -h / 2], [w / 2, h / 2]) + line([w / 2, -h / 2], [-w / 2, h / 2]), rect(-k, -k, 2 * k, 2 * k)];
  },
  /* four burners, each a ring round a grate */
  range: (w, h) => [rect(-w / 2, -h / 2, w, h), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(([i, j]) => {
    const r = Math.min(w, h) * 0.16;
    return [ell(i * w / 4, j * h / 4, r, r), ell(i * w / 4, j * h / 4, r * 0.5, r * 0.5)];
  })],
  'kitchen-sink': (w, h, f) => {
    const dot = (x) => ell(x, h * 0.12, Math.min(w, h) * 0.04, Math.min(w, h) * 0.04);
    if (f.bowls === 1) return [rect(-w / 2, -h / 2, w, h), rrect(-w / 2 + w * 0.1, -h / 2 + h * 0.15, w * 0.8, h * 0.7, Math.min(w, h) * 0.12), dot(0)];
    return [rect(-w / 2, -h / 2, w, h), rrect(-w / 2 + w * 0.08, -h / 2 + h * 0.15, w * 0.38, h * 0.7, Math.min(w, h) * 0.1), rrect(w * 0.04, -h / 2 + h * 0.15, w * 0.38, h * 0.7, Math.min(w, h) * 0.1), dot(-w * 0.23), dot(w * 0.23)];
  },
  /* the box, its door line at the front */
  refrigerator: (w, h) => [rect(-w / 2, -h / 2, w, h), line([-w / 2, h / 2 - h * 0.12], [w / 2, h / 2 - h * 0.12])],
  /* the firebox: narrow at the back wall, opening wide into the room */
  fireplace: (w, h) => [poly([[-w * 0.32, -h / 2], [w * 0.32, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]])],
  counter: (w, h) => [rect(-w / 2, -h / 2, w, h)],
  /* a closet rod along its length with hangers across it */
  rod: (w, h) => {
    const n = Math.max(3, Math.round(w / (h * 0.35)));
    let d = line([-w / 2, 0], [w / 2, 0]);
    for (let i = 0; i < n; i++) { const x = -w / 2 + w * (i + 0.5) / n; d += line([x, -h / 2], [x, h / 2]); }
    return [d];
  }
};

function drawFixtures(level, T, s) {
  const out = [];
  (level.fixtures || []).forEach((f) => {
    const fn = FIXTURE_DRAW[f.type];
    if (!fn || !isPt(f.at) || !(f.w > 0) || !(f.h > 0)) return;
    const c = T(f.at), w = f.w * s, h = f.h * s;
    const rot = Number.isFinite(f.rot) && f.rot ? ' rotate(' + r2(f.rot) + ')' : '';
    out.push('<g transform="translate(' + pt(c) + ')' + rot + '">' + fn(w, h, f).map((d) => '<path ' + thin() + ' d="' + d + '"/>').join('') + '</g>');
  });
  return out.join('');
}

/* ---------- labels ---------- */
function drawRooms(level, T) {
  const out = [];
  const nameCap = capHeight(STYLE.ROOM_NAME), sizeCap = capHeight(STYLE.ROOM_SIZE);
  (level.rooms || []).forEach((r) => {
    if (typeof r.name !== 'string' || !r.name.trim() || !isPt(r.at)) return;
    const c = T(r.at), hasSize = typeof r.size === 'string' && r.size;
    const block = hasSize ? nameCap + STYLE.ROOM_SIZE.gap + sizeCap : nameCap;
    const nameBase = c[1] - block / 2 + nameCap;
    const paths = ['<path d="' + outline(r.name, { ...STYLE.ROOM_NAME, x: c[0], y: nameBase, anchor: 'middle' }) + '"/>'];
    if (hasSize) paths.push('<path d="' + outline(r.size, { ...STYLE.ROOM_SIZE, x: c[0], y: nameBase + STYLE.ROOM_SIZE.gap + sizeCap, anchor: 'middle' }) + '"/>');
    const rot = Number.isFinite(r.rot) && r.rot ? ' transform="rotate(' + r2(r.rot) + ' ' + pt(c) + ')"' : '';
    out.push('<g data-label="' + esc(r.name) + '" fill="' + STYLE.NAVY + '"' + rot + '>' + paths.join('') + '</g>');
  });
  (level.labels || []).forEach((t) => {
    if (typeof t.text !== 'string' || !t.text || !isPt(t.at)) return;
    const c = T(t.at);
    const d = outline(t.text, { ...STYLE.SMALL_LABEL, x: c[0], y: c[1] + capHeight(STYLE.SMALL_LABEL) / 2, anchor: 'middle' });
    out.push('<g data-label="' + esc(t.text) + '" fill="' + STYLE.NAVY + '"><path d="' + d + '"/></g>');
  });
  return out.join('');
}

/* ---------- branded frame ---------- */
function factsLine(facts) {
  if (!facts) return '';
  const parts = [];
  if (Number.isFinite(facts.beds)) parts.push(facts.beds === 0 ? 'STUDIO' : facts.beds + (facts.beds === 1 ? ' BEDROOM' : ' BEDROOMS'));
  if (Number.isFinite(facts.baths)) parts.push(facts.baths + (facts.baths === 1 ? ' BATHROOM' : ' BATHROOMS'));
  return parts.join(' · ');
}

function drawHeader(plan, facts) {
  const H = STYLE.HEADER, address = plan.job && typeof plan.job.address === 'string' ? plan.job.address.trim() : '';
  const facts1 = factsLine(facts);
  const addrCap = capHeight(STYLE.HEADER_ADDRESS), factCap = capHeight(STYLE.HEADER_FACTS);
  const lines = [];
  if (address) lines.push([address.toUpperCase(), STYLE.HEADER_ADDRESS, addrCap]);
  if (facts1) lines.push([facts1, STYLE.HEADER_FACTS, factCap]);
  const block = lines.reduce((s, l) => s + l[2], 0) + Math.max(0, lines.length - 1) * H.lineGap;
  let y = H.h / 2 - block / 2;
  const paths = lines.map(([text, style, cap]) => {
    y += cap;
    const d = outline(text, { ...style, x: H.x, y, anchor: 'start' });
    y += H.lineGap;
    return '<path d="' + d + '"/>';
  });
  return '<defs><linearGradient id="fp-header-gradient" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="' + STYLE.SKY + '"/><stop offset="1" stop-color="' + STYLE.CYAN + '"/></linearGradient></defs>' +
    '<g data-frame="header"><rect x="0" y="0" width="' + STYLE.PAGE.w + '" height="' + H.h + '" fill="url(#fp-header-gradient)"/>' +
    '<g fill="' + STYLE.WHITE + '">' + paths.join('') + '</g></g>';
}

let logoCache = null;
function logo() {
  if (logoCache) return logoCache;
  const src = fs.readFileSync(path.join(ROOT, STYLE.LOGO.file), 'utf8');
  const vb = src.match(/viewBox="([^"]+)"/)[1].trim().split(/\s+/).map(Number);
  const paths = [...src.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map((m) => '<path d="' + m[1] + '"/>');
  logoCache = { vb, paths: paths.join('') };
  return logoCache;
}

function drawFooter() {
  const F = STYLE.FOOTER, cap = capHeight(STYLE.FOOTER_TEXT);
  const text = outline(STYLE.FOOTER_TEXT.text, { ...STYLE.FOOTER_TEXT, x: STYLE.PAGE.w / 2, y: F.y + cap / 2, anchor: 'middle' });
  const { vb, paths } = logo(), k = STYLE.LOGO.w / vb[2], lh = vb[3] * k;
  return '<g data-frame="footer" fill="' + STYLE.NAVY + '"><path d="' + text + '"/>' +
    '<g transform="translate(' + r2(STYLE.LOGO.x) + ' ' + r2(F.y - lh / 2) + ') scale(' + Math.round(k * 1e6) / 1e6 + ') translate(' + r2(-vb[0]) + ' ' + r2(-vb[1]) + ')">' + paths + '</g></g>';
}

function drawCompass(north) {
  const B = STYLE.BOX_BRANDED, C = STYLE.COMPASS, half = C.size / 2;
  const c = [B.x1 - half, B.y1 - half], R = C.ring;
  const letterCap = capHeight(C.letter);
  /* drawn pointing up around 0,0, then turned by north */
  const ring = ell(0, 0, R, R);
  const needle = poly([[0, -R + 1], [R * 0.35, R * 0.45], [0, R * 0.2], [-R * 0.35, R * 0.45]]);
  const letter = outline('N', { ...C.letter, x: 0, y: -R - 1, anchor: 'middle' });
  return '<g data-frame="compass" transform="translate(' + pt(c) + ') rotate(' + r2(north) + ') translate(0 ' + r2(letterCap / 2) + ')">' +
    '<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '" d="' + ring + '"/>' +
    '<path fill="' + STYLE.NAVY + '" d="' + needle + letter + '"/></g>';
}

function drawLevelName(name) {
  const d = outline(name, { ...STYLE.LEVEL_NAME, x: STYLE.BOX_BRANDED.x1, y: STYLE.LEVEL_NAME.baseline, anchor: 'end' });
  return '<g data-frame="level" fill="' + STYLE.NAVY + '"><path d="' + d + '"/></g>';
}

/* ---------- the page ---------- */
/* one level's drawing, every layer in order, through T (plan units -> page points, scale s);
   also used by style-sheet.js to draw single elements at a fixed scale */
function drawLevel(level, T, s) {
  return [drawAreas(level, T), drawSolids(level, T), drawLines(level, T), drawWalls(level, T),
    drawFixtures(level, T, s), drawOpenings(level, T), drawRooms(level, T)].filter(Boolean).join('\n');
}

function draw(plan, levelIndex = 0, opts = {}) {
  const branded = !!opts.branded;
  const level = plan.levels[levelIndex];
  if (!level) throw new Error('no level ' + levelIndex);
  const box = branded ? STYLE.BOX_BRANDED : STYLE.BOX_UNBRANDED;
  const s = fitScale(level, box), b = bounds(level);
  const ox = box.x0 + ((box.x1 - box.x0) - (b.x1 - b.x0) * s) / 2;
  const oy = box.y0 + ((box.y1 - box.y0) - (b.y1 - b.y0) * s) / 2;
  const T = (p) => [ox + (p[0] - b.x0) * s, oy + (p[1] - b.y0) * s];

  const W = STYLE.PAGE.w, H = STYLE.PAGE.h;
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">',
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + STYLE.WHITE + '"/>'
  ];
  /* opts.underlay { href, width, height }: the source picture, in plan units, drawn red and multiplied over
     the plan so every mismatch shows (scripts/floorplan/overlay.js). Never in a saved plan. */
  const U = opts.underlay, r6 = (v) => Math.round(v * 1e6) / 1e6;
  if (branded) parts.push(drawHeader(plan, opts.facts));
  parts.push(drawLevel(level, T, s));
  if (U) {
    parts.push('<filter id="fp-red"><feColorMatrix type="matrix" values="0 0 0 0 1 0.3 0.59 0.11 0 0 0.3 0.59 0.11 0 0 0 0 0 1 0"/></filter>' +
      '<image href="' + esc(U.href) + '" x="0" y="0" width="' + U.width + '" height="' + U.height + '" filter="url(#fp-red)" style="mix-blend-mode:multiply" ' +
      'transform="matrix(' + r6(s) + ' 0 0 ' + r6(s) + ' ' + r6(ox - b.x0 * s) + ' ' + r6(oy - b.y0 * s) + ')"/>');
  }
  if (branded) {
    if (Number.isFinite(plan.north)) parts.push(drawCompass(plan.north));
    if (plan.levels.length > 1 && level.name) parts.push(drawLevelName(level.name));
    parts.push(drawFooter());
  }
  parts.push('</svg>');
  return parts.filter(Boolean).join('\n') + '\n';
}

module.exports = { draw, drawLevel, outline, measure };
