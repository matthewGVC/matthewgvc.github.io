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
    } else if (o.type === 'bifold') {
      /* two pairs of panels folded into the room, a V at each half */
      const depth = span * 0.22, v = (q0, q1) => line(q0, addv(lerp(q0, q1, 0.5), mul(n, depth))) + 'L' + pt(q1);
      out.push('<path ' + stroke + ' d="' + v(p0, lerp(p0, p1, 0.5)) + v(lerp(p0, p1, 0.5), p1) + '"/>');
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
    /* a.pattern: a swatch laid over the area (PATTERNS below); its defs come from patternDefs() */
    const swatch = PATTERNS[a.pattern] ? '<path fill="url(#fp-pat-' + a.pattern + ')" stroke="none" d="' + d + '"/>' : '';
    if (a.type === 'terrace' || a.type === 'balcony') {
      out.push('<path fill="' + STYLE.TERRACE_FILL + '" ' + stroke + ' d="' + d + '"/>' + swatch);
    } else if (a.type === 'floor') {
      out.push(swatch);
    } else if (a.type === 'roof') {
      out.push(swatch + '<path fill="none" ' + stroke + ' d="' + d + '"/>');
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
      const back = Array.isArray(a.dir) && (alongX ? a.dir[0] < 0 : a.dir[1] < 0);
      /* with a break, everything past it (the way the arrow points) is dotted: treads and side rails */
      const hasBreak = a.break !== undefined && a.break !== false;
      const ub = hasBreak ? run * (a.break === true ? 0.6 : a.break) : null;
      const past = (u) => hasBreak && (back ? u < ub : u > ub);
      let dotted = '';
      for (let u = step; u < run - 0.01; u += step) {
        const seg = alongX ? line([x0 + u, y0], [x0 + u, y1]) : line([x0, y0 + u], [x1, y0 + u]);
        if (past(u)) dotted += seg; else tr += seg;
      }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, h = STYLE.STAIR_ARROW;
      let s0, s1;
      if (alongX) { s0 = [back ? x1 - h : x0 + h, cy]; s1 = [back ? x0 + h : x1 - h, cy]; } else { s0 = [cx, back ? y1 - h : y0 + h]; s1 = [cx, back ? y0 + h : y1 - h]; }
      const dv = mul(sub(s1, s0), 1 / (len(sub(s1, s0)) || 1)), nv = [dv[1], -dv[0]];
      const head = line(addv(s1, addv(mul(dv, -h), mul(nv, h * 0.6))), s1) + 'L' + pt(addv(s1, addv(mul(dv, -h), mul(nv, -h * 0.6))));
      /* a.break (0-1 along the flight, or true for 0.6): the break line, with its zig-zag, where the
         drawing cuts the stair */
      let brk = '';
      if (a.break !== undefined && a.break !== false) {
        const t = a.break === true ? 0.6 : a.break, wid = alongX ? y1 - y0 : x1 - x0, rise = wid * 0.35;
        const P0 = alongX ? (u, v) => [x0 + u, y1 - v] : (u, v) => [x0 + v, y0 + u];   // u along the flight, v across it
        const u0 = run * t - rise / 2, z = Math.min(wid * 0.16, run * 0.08);
        const at = (k) => u0 + rise * k;
        brk = 'M' + [P0(at(0), 0), P0(at(0.44), wid * 0.44), P0(at(0.44) + z, wid * 0.47), P0(at(0.56) - z, wid * 0.53), P0(at(0.56), wid * 0.56), P0(at(1), wid)].map(pt).join('L');
      }
      if (hasBreak) {
        /* the outline, split at the break: solid before it, dotted past it */
        const A = (u, v) => (alongX ? [x0 + u, v ? y1 : y0] : [v ? x1 : x0, y0 + u]);
        const [s0u, s1u] = back ? [ub, run] : [0, ub], [p0u, p1u] = back ? [0, ub] : [ub, run];
        const rails = (u0, u1) => line(A(u0, 0), A(u1, 0)) + line(A(u0, 1), A(u1, 1));
        out.push('<path fill="' + STYLE.WHITE + '" stroke="none" d="' + d + '"/>');
        tr += rails(s0u, s1u) + line(A(back ? run : 0, 0), A(back ? run : 0, 1));
        dotted += rails(p0u, p1u) + line(A(back ? 0 : run, 0), A(back ? 0 : run, 1));
        out.push('<path fill="none" ' + stroke + ' stroke-dasharray="' + STYLE.STAIR_DOTTED + '" d="' + dotted + '"/>');
      } else out.push('<path ' + thin() + ' d="' + d + '"/>');
      out.push('<path fill="none" ' + stroke + ' d="' + tr + (a.arrow === false ? '' : line(s0, s1) + head) + brk + '"/>');
    }
  });
  return out.join('');
}

/* ---------- swatches: patterns laid over floor, roof and terrace areas (sizes in page pt) ---------- */
const P_LINE = 'fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.PATTERN_LINE + '"';
const PATTERNS = {
  /* square floor tile */
  tile: { w: STYLE.TILE, h: STYLE.TILE, body: (w, h) => '<path ' + P_LINE + ' d="M0 0L' + w + ' 0M0 0L0 ' + h + '"/>' },
  /* patio brick: basket weave (Matt, 10-26: swapped with the roof's) */
  'brick-patio': { w: STYLE.BRICK.w * 2, h: STYLE.BRICK.w * 2, body: (w, h) => {
    const q = w / 2, b = q / 2;
    return '<path ' + P_LINE + ' d="M0 0L' + w + ' 0M0 0L0 ' + h + 'M' + q + ' 0L' + q + ' ' + h + 'M0 ' + q + 'L' + w + ' ' + q +
      'M0 ' + b + 'L' + q + ' ' + b + 'M' + (q + b) + ' 0L' + (q + b) + ' ' + q + 'M' + b + ' ' + q + 'L' + b + ' ' + h + 'M' + q + ' ' + (q + b) + 'L' + w + ' ' + (q + b) + '"/>';
  } },
  /* roof brick: running bond */
  'brick-roof': { w: STYLE.BRICK.w, h: STYLE.BRICK.h * 2, body: (w, h) => '<path ' + P_LINE + ' d="M0 0L' + w + ' 0M0 ' + h / 2 + 'L' + w + ' ' + h / 2 +
    'M0 0L0 ' + h / 2 + 'M' + w / 2 + ' ' + h / 2 + 'L' + w / 2 + ' ' + h + '"/>' }
};
/* the <defs> for the named patterns (ids fp-pat-<name>) */
function patternDefs(names) {
  const list = [...new Set(names)].filter((n) => PATTERNS[n]);
  if (!list.length) return '';
  return '<defs>' + list.map((n) => { const P = PATTERNS[n];
    return '<pattern id="fp-pat-' + n + '" patternUnits="userSpaceOnUse" width="' + P.w + '" height="' + P.h + '">' + P.body(P.w, P.h) + '</pattern>'; }).join('') + '</defs>';
}

/* ---------- Matt's symbols (symbols.json, from import-symbols.js): his artwork is the symbol ---------- */
const SYMBOLS = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'symbols.json'), 'utf8')); } catch (e) { return {}; } })();
const PAINT = { navy: STYLE.NAVY, white: STYLE.WHITE, cyan: STYLE.CYAN };
/* symbol `name` stretched into a w x h pt box centred on 0,0 (wall side at the top, as drawn) */
function drawSymbol(name, w, h) {
  const sym = SYMBOLS[name];
  const sx = w / sym.size[0], sy = h / sym.size[1], sk = (sx + sy) / 2;
  return sym.paths.map((p) => {
    const d = p.d.replace(/([MLCQZ])([^MLCQZ]*)/g, (m, c, nums) => {
      const v = nums.trim() ? nums.trim().split(/\s+/).map(Number) : [];
      return c + v.map((x, i) => r2(i % 2 ? x * sy : x * sx)).join(' ');
    });
    const a = ['fill="' + (p.fill ? PAINT[p.fill] || p.fill : 'none') + '"'];
    let sw = 0, stroke = p.stroke ? PAINT[p.stroke] || p.stroke : null;
    if (p.stroke) sw = p.weight === 'fine' ? STYLE.FINE : p.weight === 'thin' ? STYLE.THIN : (p.sw || 0) * sk;
    if (stroke) a.push('stroke="' + stroke + '"', 'stroke-width="' + r2(sw) + '"', 'stroke-linejoin="round"');
    if (p.opacity !== undefined) a.push('opacity="' + p.opacity + '"');
    return '<path ' + a.join(' ') + ' d="' + d + '"/>';
  }).join('');
}
/* the symbol a fixture draws with, when Matt has drawn one */
function symbolFor(f) {
  const name = f.type === 'range' ? (f.griddle ? 'range-6-griddle' : f.burners === 6 ? 'range-6' : 'range-4')
    : f.type === 'clothes' ? 'clothes-' + (f.variant || 1) : f.type;
  return SYMBOLS[name] ? name : null;
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
  /* burners 4 (2 x 2, the default) or 6 (3 x 2), each a ring round a grate */
  range: (w, h, f) => {
    const cols = f.burners === 6 ? 3 : 2, r = Math.min(w / cols, h / 2) * 0.32, out = [rect(-w / 2, -h / 2, w, h)];
    for (let c = 0; c < cols; c++) for (let j = 0; j < 2; j++) {
      const x = -w / 2 + w * (c + 0.5) / cols, y = -h / 2 + h * (j + 0.5) / 2;
      out.push(ell(x, y, r, r), ell(x, y, r * 0.5, r * 0.5));
    }
    return out;
  },
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
  /* ---- laundry and utility (labels W, D, W/D, WH, DW go in `labels`) ---- */
  washer: (w, h) => [rect(-w / 2, -h / 2, w, h), ell(0, h * 0.06, Math.min(w, h) * 0.34, Math.min(w, h) * 0.34)],
  dryer: (w, h) => [rect(-w / 2, -h / 2, w, h), rrect(-w * 0.32, -h * 0.26, w * 0.64, h * 0.64, Math.min(w, h) * 0.08)],
  /* one stacked unit: the washer's drum and the dryer's line across */
  'washer-dryer': (w, h) => [rect(-w / 2, -h / 2, w, h), line([-w / 2, -h / 2 + h * 0.18], [w / 2, -h / 2 + h * 0.18]), ell(0, h * 0.09, Math.min(w, h) * 0.3, Math.min(w, h) * 0.3)],
  'water-heater': (w, h) => [ell(0, 0, w / 2, h / 2), ell(0, 0, w * 0.3, h * 0.3)],
  /* under the counter: its box crossed */
  dishwasher: (w, h) => [rect(-w / 2, -h / 2, w, h), line([-w / 2, -h / 2], [w / 2, h / 2]) + line([w / 2, -h / 2], [-w / 2, h / 2])],

  /* ---- furniture: only when the source shows it, or Matt asks for a furnished plan ---- */
  /* headboard at the wall, pillows (1 on a bed narrower than 0.6 of its length), the turned-down sheet */
  bed: (w, h, f) => {
    const n = f.pillows || (w < h * 0.6 ? 1 : 2), hb = h * 0.05, pw = (w * 0.86 - (n - 1) * w * 0.04) / n, out = [rect(-w / 2, -h / 2, w, h), rect(-w / 2, -h / 2, w, hb)];
    for (let i = 0; i < n; i++) out.push(rrect(-w * 0.43 + i * (pw + w * 0.04), -h / 2 + hb + h * 0.03, pw, h * 0.14, h * 0.03));
    out.push(line([-w / 2, -h / 2 + h * 0.3], [w / 2, -h / 2 + h * 0.3]));
    return out;
  },
  nightstand: (w, h) => [rect(-w / 2, -h / 2, w, h), ell(0, 0, Math.min(w, h) * 0.25, Math.min(w, h) * 0.25)],
  'side-table': (w, h, f) => [f.shape === 'round' ? ell(0, 0, w / 2, h / 2) : rect(-w / 2, -h / 2, w, h)],
  /* back along the wall, arms at the ends, f.seats cushions (3 by default) */
  sofa: (w, h, f) => {
    const n = f.seats || 3, back = h * 0.25, arm = Math.min(w * 0.12, h * 0.3), cw = (w - 2 * arm) / n, out = [rrect(-w / 2, -h / 2, w, h, h * 0.08), line([-w / 2 + arm, -h / 2 + back], [w / 2 - arm, -h / 2 + back])];
    out.push(line([-w / 2 + arm, -h / 2 + back], [-w / 2 + arm, h / 2]), line([w / 2 - arm, -h / 2 + back], [w / 2 - arm, h / 2]));
    for (let i = 1; i < n; i++) out.push(line([-w / 2 + arm + cw * i, -h / 2 + back], [-w / 2 + arm + cw * i, h / 2]));
    return out;
  },
  armchair: (w, h) => FIXTURE_DRAW.sofa(w, h, { seats: 1 }),
  /* an L: the long run against the top wall, the return down the f.side ('left' by default) */
  sectional: (w, h, f) => {
    const dep = Math.min(w, h) * 0.42, back = dep * 0.3, sx = f.side === 'right' ? -1 : 1;
    const X = (x) => x * sx;
    const outline = poly([[X(-w / 2), -h / 2], [X(w / 2), -h / 2], [X(w / 2), -h / 2 + dep], [X(-w / 2 + dep), -h / 2 + dep], [X(-w / 2 + dep), h / 2], [X(-w / 2), h / 2]]);
    return [outline, line([X(-w / 2 + back), -h / 2 + back], [X(w / 2), -h / 2 + back]) + line([X(-w / 2 + back), -h / 2 + back], [X(-w / 2 + back), h / 2]),
      line([X(-w / 2 + dep), -h / 2 + back], [X(-w / 2 + dep), -h / 2 + dep]) + line([X((-w / 2 + dep + w / 2) / 2), -h / 2 + back], [X((-w / 2 + dep + w / 2) / 2), -h / 2 + dep]) +
      line([X(-w / 2 + back), (-h / 2 + dep + h / 2) / 2], [X(-w / 2 + dep), (-h / 2 + dep + h / 2) / 2])];
  },
  'coffee-table': (w, h, f) => [f.shape === 'round' ? ell(0, 0, w / 2, h / 2) : rrect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.12)],
  table: (w, h, f) => [f.shape === 'round' ? ell(0, 0, w / 2, h / 2) : rect(-w / 2, -h / 2, w, h)],
  /* the table (w x h) with f.seats chairs round it (4 by default): along the long sides, then the ends */
  'dining-table': (w, h, f) => {
    const n = f.seats || 4, c = Math.min(w, h) * 0.36;
    /* each chair at the table's edge, its back away from the table: Matt's chair when there is one */
    const out = [], chair = SYMBOLS.chair, ch = (x, y, rot) => {
      const q = rot * Math.PI / 180;
      if (chair) {
        const cw = Math.min(w, h) * 0.6, cd = cw * chair.size[1] / chair.size[0];
        const at = [x - Math.sin(q) * cd / 2, y + Math.cos(q) * cd / 2];
        out.push({ raw: '<g transform="translate(' + pt(at) + ') rotate(' + r2(rot) + ')">' + drawSymbol('chair', cw, cd) + '</g>' });
        return;
      }
      const k = c / 2, pts = [[-k, -k * 0.2], [k, -k * 0.2], [k, k * 1.1], [-k, k * 1.1]].map(([a, b]) => [x + a * Math.cos(q) - b * Math.sin(q), y + a * Math.sin(q) + b * Math.cos(q)]);
      out.push(poly(pts));
    };
    if (f.shape === 'round') {
      for (let i = 0; i < n; i++) { const q = (i / n) * 2 * Math.PI - Math.PI / 2; ch(Math.cos(q) * w / 2, Math.sin(q) * h / 2, q * 180 / Math.PI - 90); }
      out.push(ell(0, 0, w / 2, h / 2));
    } else {
      const ends = n >= 6 ? 2 : 0, side = (n - ends) / 2;
      for (let i = 0; i < side; i++) { const x = -w / 2 + w * (i + 0.5) / side; ch(x, -h / 2, 180); ch(x, h / 2, 0); }
      if (ends) { ch(-w / 2, 0, 90); ch(w / 2, 0, -90); }
      out.push(rect(-w / 2, -h / 2, w, h));
    }
    return out;
  },
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
    const fn = FIXTURE_DRAW[f.type] || (symbolFor(f) ? () => [] : null);
    if (!fn || !isPt(f.at) || !(f.w > 0) || !(f.h > 0)) return;
    const c = T(f.at), w = f.w * s, h = f.h * s;
    const rot = Number.isFinite(f.rot) && f.rot ? ' rotate(' + r2(f.rot) + ')' : '';
    const sym = symbolFor(f);
    const body = sym ? drawSymbol(sym, w, h) : fn(w, h, f).map((d) => (typeof d === 'object' ? d.raw : '<path ' + thin() + ' d="' + d + '"/>')).join('');
    out.push('<g transform="translate(' + pt(c) + ')' + rot + '">' + body + '</g>');
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
  if (SYMBOLS.compass) {
    const B = STYLE.BOX_BRANDED, C = STYLE.COMPASS, sym = SYMBOLS.compass, h = C.size * 1.3, w = h * sym.size[0] / sym.size[1];
    const c = [B.x1 - w / 2, B.y1 - h / 2];
    return '<g data-frame="compass" transform="translate(' + pt(c) + ') rotate(' + r2(north) + ')">' + drawSymbol('compass', w, h) + '</g>';
  }
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
  parts.push(patternDefs((level.areas || []).map((a) => a.pattern)), drawLevel(level, T, s));
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

module.exports = { draw, drawLevel, drawSymbol, SYMBOLS, patternDefs, PATTERNS, outline, measure };
