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
const { fitScale, arcOf, levelPoints, resolveDoor } = require('./plan.js');

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
  return { len: L, at, dir: () => d, straight: true, seg: (t0, t1, k = 0) => 'L' + pt(at(t1, k)) };
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
      /* a free end runs on half a wall; on a straight run that is the run's own end point, not an extra one */
      const runOn = startOf(first) && !closed, runOff = endOf(last) && !closed;
      let path = 'M' + pt(runOn ? addv(first.sp.C.at(f0), mul(travel(first, f0), -hw)) : first.sp.C.at(f0));
      if (runOn && !first.sp.C.straight) path += 'L' + pt(first.sp.C.at(f0));
      chain.forEach((c, i) => {
        const [t0, t1] = piece(c);
        path += i === chain.length - 1 && runOff && c.sp.C.straight ? 'L' + pt(addv(c.sp.C.at(t1), mul(travel(c, t1), hw))) : c.sp.C.seg(t0, t1);
      });
      if (closed) path += 'Z';
      else if (runOff && !last.sp.C.straight) path += 'L' + pt(addv(last.sp.C.at(l1), mul(travel(last, l1), hw)));
      d.push(path);
    });
    if (d.length) out.push('<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + width + '" stroke-linejoin="miter" stroke-miterlimit="8" d="' + d.join('') + '"/>');
  });
  return out.join('');
}

/* ---------- openings: doors, windows, sliders ---------- */
function drawOpenings(level, T, s = 1) {
  const walls = level.walls || [], out = [];
  const stroke = 'fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '"';
  (level.openings || []).forEach((o0) => {
    /* an opening on a wall (wall, from, to), or a free one across a gap in traced wall masses (a, b, t:
       its ends, and the wall's thickness in plan units) */
    const free = isPt(o0.a) && isPt(o0.b);
    const w = free ? { a: o0.a, b: o0.b, type: 'interior' } : walls[o0.wall];
    const o = Object.assign(resolveDoor(o0, w), free ? { from: 0, to: 1 } : {});
    if (!w || !isPt(w.a) || !isPt(w.b)) return;
    const C = course(w, T);
    if (!C.len) return;
    const hw = Math.max((free && o0.t > 0 ? o0.t * s : wallWidth(w.type)) / 2 - STYLE.THIN / 2, 0);

    if (o.type === 'window') {
      /* Matt's window: a white frame across the wall's full thickness, closed at each end (so neighbouring
         panes show their mullion), and the glass, a narrower frame inside it */
      const along = (t0, t1, k) => 'M' + pt(C.at(t0, k)) + C.seg(t0, t1, k);
      const frame = (t0, t1, k) => along(t0, t1, k) + along(t0, t1, -k) + line(C.at(t0, k), C.at(t0, -k)) + line(C.at(t1, k), C.at(t1, -k));
      const inset = Math.min(hw * 0.5, (o.to - o.from) * C.len * 0.1) / (C.len || 1);
      const g = hw * STYLE.WINDOW_GLASS;
      /* the pane filled white as one closed ring (the frame's four open lines enclose nothing to fill) */
      const ring = 'M' + pt(C.at(o.from, hw)) + C.seg(o.from, o.to, hw) + 'L' + pt(C.at(o.to, -hw)) + C.seg(o.to, o.from, -hw) + 'Z';
      out.push('<path fill="' + STYLE.WHITE + '" d="' + ring + '"/>');
      out.push('<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.DOOR_LINE + '" d="' + frame(o.from, o.to, hw) + frame(o.from + inset, o.to - inset, g) + '"/>');
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
      /* Matt's leaf: a thin hollow panel, white inside; it and the swing in a fine line */
      const lw = STYLE.DOOR_LEAF / 2, nn = [-(tip[1] - hinge[1]) / r, (tip[0] - hinge[0]) / r];
      const leaf = poly([addv(hinge, mul(nn, lw)), addv(tip, mul(nn, lw)), addv(tip, mul(nn, -lw)), addv(hinge, mul(nn, -lw))]);
      const fine = 'stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.DOOR_LINE + '"';
      out.push('<path fill="' + STYLE.WHITE + '" ' + fine + ' d="' + leaf + '"/>');
      out.push('<path fill="none" ' + fine + ' d="M' + pt(tip) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 ' + sweep + ' ' + pt(free) + '"/>');
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
/* over: false draws the plain lines (under the fixtures), true the dashed ones (over them: an overhead
   cabinet's dashes run across the counter below it, as Matt's and the sources' do) */
function drawLines(level, T, over = false) {
  const out = [];
  (level.lines || []).forEach((l) => {
    if (!l || !Array.isArray(l.pts) || l.pts.length < 2 || !l.pts.every(isPt) || !!l.dash !== over) return;
    const P = l.pts.map(T);
    /* dash: a dashed line (overhead cabinets, a track); arrow: an arrowhead at the last point (UP, DN) */
    const dash = l.dash ? ' stroke-dasharray="' + STYLE.LINE_DASH + '"' : '';
    out.push(l.closed ? '<path ' + thin(dash) + ' d="' + poly(P) + '"/>'
      : '<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '"' + dash + ' d="M' + P.map(pt).join('L') + '"/>');
    if (l.arrow && !l.closed) {
      const e = P[P.length - 1], d = sub(e, P[P.length - 2]), L = len(d) || 1, u = mul(d, 1 / L), n = [-u[1], u[0]], a = STYLE.STAIR_ARROW;
      out.push('<path fill="' + STYLE.NAVY + '" d="' + poly([e, addv(addv(e, mul(u, -a)), mul(n, a * 0.45)), addv(addv(e, mul(u, -a)), mul(n, -a * 0.45))]) + '"/>');
    }
  });
  return out.join('');
}

/* ---------- solids and areas ---------- */
/* a solid is one outline [[x, y], ...], or several [[[x, y], ...], ...]: an outline and the holes in it
   (a wall mass traced round a room), filled even-odd */
const ringsOfSolid = (s) => (Array.isArray(s) && s.length && Array.isArray(s[0]) && isPt(s[0][0]) ? s : [s]);
function drawSolids(level, T) {
  /* each solid its own path, so a solid laid over another adds to it rather than cutting a hole */
  return (level.solids || []).map(ringsOfSolid).map((rs) => rs.filter((r) => Array.isArray(r) && r.length >= 3 && r.every(isPt)).map((r) => poly(r.map(T))).join(''))
    .filter(Boolean).map((d) => '<path fill="' + STYLE.NAVY + '" fill-rule="evenodd" d="' + d + '"/>').join('');
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
  /* square floor tile, light cyan (Matt's baths, e.g. 347 W Broadway) */
  tile: { w: STYLE.TILE, h: STYLE.TILE, body: (w, h) => '<path fill="none" stroke="' + STYLE.TILE_LINE + '" stroke-width="' + STYLE.PATTERN_LINE + '" d="M0 0L' + w + ' 0M0 0L0 ' + h + '"/>' },
  /* terrace pavers: the same square grid, fainter (Matt's roof terraces, e.g. 225 E79) */
  pavers: { w: STYLE.PAVER, h: STYLE.PAVER, body: (w, h) => '<path fill="none" stroke="' + STYLE.PAVER_LINE + '" stroke-width="' + STYLE.PATTERN_LINE + '" d="M0 0L' + w + ' 0M0 0L0 ' + h + '"/>' },
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
/* symbol `name` in a w x h pt box centred on 0,0, wall side at the top as drawn. It keeps Matt's
   proportions: scaled to the box's width (its run along the wall) and set against the wall side, so a
   range or toilet is never squashed. Clothes are the exception: they stretch to fill the closet. */
function drawSymbol(name, w, h) {
  const sym = SYMBOLS[name];
  const stretch = /^clothes-/.test(name);
  const sx = w / sym.size[0], sy = stretch ? h / sym.size[1] : sx, sk = (sx + sy) / 2;
  const dy = stretch ? 0 : -h / 2 + sym.size[1] * sy / 2;   // the wall side stays on the box's top edge
  const out = sym.paths.map((p) => {
    const d = p.d.replace(/([MLCQZ])([^MLCQZ]*)/g, (m, c, nums) => {
      const v = nums.trim() ? nums.trim().split(/\s+/).map(Number) : [];
      return c + v.map((x, i) => r2(i % 2 ? x * sy + dy : x * sx)).join(' ');
    });
    const a = ['fill="' + (p.fill ? PAINT[p.fill] || p.fill : 'none') + '"'];
    let sw = 0, stroke = p.stroke ? PAINT[p.stroke] || p.stroke : null;
    if (p.stroke) sw = p.weight === 'fine' ? STYLE.FINE : p.weight === 'thin' ? STYLE.THIN : (p.sw || 0) * sk;
    if (stroke) a.push('stroke="' + stroke + '"', 'stroke-width="' + r2(sw) + '"', 'stroke-linejoin="round"');
    if (p.opacity !== undefined) a.push('opacity="' + p.opacity + '"');
    return { d, back: sym.mode === 'line' && p.weight === 'thin' && !p.fill && /Z\s*$/.test(d), el: '<path ' + a.join(' ') + ' d="' + d + '"/>' };
  });
  /* line art drawn over a counter or a floor swatch hides what is under it: each closed outline is backed
     in white, under all of the symbol's lines */
  const back = out.filter((p) => p.back).map((p) => '<path data-back="1" fill="' + STYLE.WHITE + '" d="' + p.d + '"/>').join('');
  return back + out.map((p) => p.el).join('');
}
/* the symbol a fixture draws with, when Matt has drawn one */
function symbolFor(f) {
  const name = f.type === 'range' ? (f.griddle ? 'range-6-griddle' : f.burners === 6 ? 'range-6' : 'range-4')
    : f.type === 'clothes' ? 'clothes-' + (f.variant || 1) : f.type;
  /* a plain rod is drawn as Matt's first clothes symbol */
  return SYMBOLS[name] ? name : f.type === 'rod' && SYMBOLS['clothes-1'] ? 'clothes-1' : null;
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
/* a square-cornered basin bw wide centred at x in a counter h deep, its faucet a solid bar from the wall */
const basin = (x, bw, h) => {
  const top = -h / 2 + h * 0.2, bh = h * 0.66, fw = Math.max(bw * 0.1, 0.9);
  return [rect(x - bw / 2, top, bw, bh), { raw: '<path fill="' + STYLE.NAVY + '" d="' + rect(x - fw / 2, -h / 2, fw, h * 0.42) + '"/>' }];
};
const FIXTURE_DRAW = {
  /* tank against the wall, elongated bowl with its seat opening */
  toilet: (w, h) => {
    const tank = h * 0.3, yt = -h / 2 + tank, yb = h / 2, bw = w * 0.38, ry = Math.min(bw * 1.25, (yb - yt) * 0.7);
    const iw = bw * 0.62, iyt = yt + (yb - yt) * 0.18, iyb = yb - (yb - yt) * 0.14;
    return [rrect(-w / 2, -h / 2, w, tank, Math.min(w, tank) * 0.15), uShape(bw, yt, yb, ry), uShape(iw, iyt, iyb, Math.min(iw * 1.25, (iyb - iyt) * 0.7))];
  },
  /* vanity, as Matt draws it: the counter, a square-cornered basin, a solid faucet bar from the wall */
  sink: (w, h) => [rect(-w / 2, -h / 2, w, h), ...basin(0, w * 0.62, h)],
  /* pedestal or vessel basin (Matt's): a round bowl, a small square faucet at the wall, a solid drain */
  'round-sink': (w, h) => {
    const r = Math.min(w, h) / 2, f = r * 0.18;
    return [ell(0, 0, r, r), rect(-f, -r - f * 0.2, 2 * f, f * 1.6), { raw: '<path fill="' + STYLE.NAVY + '" d="' + ell(0, r * 0.05, r * 0.12, r * 0.12) + '"/>' }];
  },
  'double-sink': (w, h) => [rect(-w / 2, -h / 2, w, h), ...basin(-w / 4, w * 0.34, h), ...basin(w / 4, w * 0.34, h)],
  /* the tub (Matt's): its box, a softly rounded basin, the drain at the end; "cross": true is a tub the
     source draws as a crossed box (some of Matt's older sheets), the box crossed corner to corner */
  tub: (w, h, f) => {
    if (f.cross) return [rect(-w / 2, -h / 2, w, h), line([-w / 2, -h / 2], [w / 2, h / 2]) + line([w / 2, -h / 2], [-w / 2, h / 2])];
    const ix = Math.min(w, h) * 0.12, iy = h * 0.12, r = Math.min(w, h) * 0.16;
    return [rect(-w / 2, -h / 2, w, h), rrect(-w / 2 + ix, -h / 2 + iy, w - 2 * ix, h - 2 * iy, r), ell(-w / 2 + ix + r * 1.1, 0, r * 0.28, r * 0.28)];
  },
  /* the pan crossed corner to corner, as Matt draws it */
  shower: (w, h) => [rect(-w / 2, -h / 2, w, h), line([-w / 2, -h / 2], [w / 2, h / 2]) + line([w / 2, -h / 2], [-w / 2, h / 2])],
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
  /* the box: Matt labels it REF (in labels), with no door line */
  refrigerator: (w, h) => [rect(-w / 2, -h / 2, w, h)],
  /* the firebox: narrow at the back wall, opening wide into the room */
  fireplace: (w, h) => [poly([[-w * 0.32, -h / 2], [w * 0.32, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]])],
  counter: (w, h) => [rect(-w / 2, -h / 2, w, h)],
  /* a closet rod along its length with hangers across it */
  /* ---- laundry and utility (labels W, D, W/D, WH, DW go in `labels`) ---- */
  /* Matt draws laundry as plain boxes, labelled W, D or W/D (in labels), like DW and REF */
  washer: (w, h) => [rect(-w / 2, -h / 2, w, h)],
  dryer: (w, h) => [rect(-w / 2, -h / 2, w, h)],
  'washer-dryer': (w, h) => [rect(-w / 2, -h / 2, w, h)],
  'water-heater': (w, h) => [ell(0, 0, w / 2, h / 2), ell(0, 0, w * 0.3, h * 0.3)],
  /* under the counter: its box, labelled DW (in labels), as Matt draws it */
  dishwasher: (w, h) => [rect(-w / 2, -h / 2, w, h)],

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
    const n = f.seats || 3, back = h * 0.25, arm = Math.min(w * 0.12, h * 0.3), cw = (w - 2 * arm) / n, out = [rrect(-w / 2, -h / 2, w, h, h * 0.08)];
    /* the seat's edge: down each arm and along the back as one line, so its corners join */
    out.push('M' + pt([-w / 2 + arm, h / 2]) + 'L' + pt([-w / 2 + arm, -h / 2 + back]) + 'L' + pt([w / 2 - arm, -h / 2 + back]) + 'L' + pt([w / 2 - arm, h / 2]));
    for (let i = 1; i < n; i++) out.push(line([-w / 2 + arm + cw * i, -h / 2 + back], [-w / 2 + arm + cw * i, h / 2]));
    return out;
  },
  armchair: (w, h) => FIXTURE_DRAW.sofa(w, h, { seats: 1 }),
  /* an L: the long run against the top wall, the return down the f.side ('left' by default) */
  sectional: (w, h, f) => {
    const dep = Math.min(w, h) * 0.42, back = dep * 0.3, sx = f.side === 'right' ? -1 : 1;
    const X = (x) => x * sx;
    const outline = poly([[X(-w / 2), -h / 2], [X(w / 2), -h / 2], [X(w / 2), -h / 2 + dep], [X(-w / 2 + dep), -h / 2 + dep], [X(-w / 2 + dep), h / 2], [X(-w / 2), h / 2]]);
    return [outline, 'M' + pt([X(w / 2), -h / 2 + back]) + 'L' + pt([X(-w / 2 + back), -h / 2 + back]) + 'L' + pt([X(-w / 2 + back), h / 2]),
      line([X(-w / 2 + dep), -h / 2 + back], [X(-w / 2 + dep), -h / 2 + dep]) + line([X((-w / 2 + dep + w / 2) / 2), -h / 2 + back], [X((-w / 2 + dep + w / 2) / 2), -h / 2 + dep]) +
      line([X(-w / 2 + back), (-h / 2 + dep + h / 2) / 2], [X(-w / 2 + dep), (-h / 2 + dep + h / 2) / 2])];
  },
  'coffee-table': (w, h, f) => [f.shape === 'round' ? ell(0, 0, w / 2, h / 2) : rrect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.12)],
  table: (w, h, f) => [f.shape === 'round' ? ell(0, 0, w / 2, h / 2) : rect(-w / 2, -h / 2, w, h)],
  /* the table (w x h) with f.seats chairs round it (4 by default): along the long sides, then the ends */
  'dining-table': (w, h, f) => {
    const n = f.seats || 4, c = Math.min(w, h) * 0.36;
    /* each chair pulled in to the table, its back away from it: Matt's chair when there is one. Its front
       third tucks under the table, which is drawn over it, so chair and table read as one set */
    const out = [], chair = SYMBOLS.chair, ch = (x, y, rot) => {
      const q = rot * Math.PI / 180;
      if (chair) {
        const cw = Math.min(w, h) * 0.5, cd = cw * chair.size[1] / chair.size[0];
        const tuck = f.shape === 'round' ? Math.max(cd * 0.3, Math.min(w, h) / 2 - Math.sqrt(Math.max(0, (Math.min(w, h) / 2) ** 2 - (cw / 2) ** 2)) + cd * 0.08) : cd * 0.3;
        const at = [x - Math.sin(q) * (cd / 2 - tuck), y + Math.cos(q) * (cd / 2 - tuck)];
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
  /* until Matt's car comes: its footprint, rounded */
  car: (w, h) => [rrect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.25)],
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
/* k scales the text (the all-floors sheet sets it a little smaller, as Matt does) */
function drawRooms(level, T, k = 1) {
  const out = [];
  const NAME = { ...STYLE.ROOM_NAME, sizePt: STYLE.ROOM_NAME.sizePt * k, lineGap: STYLE.ROOM_NAME.lineGap * k };
  const SIZE = { ...STYLE.ROOM_SIZE, sizePt: STYLE.ROOM_SIZE.sizePt * k, gap: STYLE.ROOM_SIZE.gap * k };
  const SMALL = { ...STYLE.SMALL_LABEL, sizePt: STYLE.SMALL_LABEL.sizePt * k };
  const nameCap = capHeight(NAME), sizeCap = capHeight(SIZE);
  (level.rooms || []).forEach((r) => {
    if (typeof r.name !== 'string' || !r.name.trim() || !isPt(r.at)) return;
    const c = T(r.at), hasSize = typeof r.size === 'string' && r.size;
    /* a name breaks where it has a line break ("LIVING\nROOM"), as the source sets it */
    const lines = r.name.split('\n').map((t) => t.trim()).filter(Boolean), gap = NAME.lineGap;
    const names = nameCap + (lines.length - 1) * gap;
    const block = hasSize ? names + SIZE.gap + sizeCap : names;
    const nameBase = c[1] - block / 2 + nameCap;
    const paths = lines.map((t, i) => '<path d="' + outline(t, { ...NAME, x: c[0], y: nameBase + i * gap, anchor: 'middle' }) + '"/>');
    /* sizes print with typographic marks, as Matt sets them: 12’ x 19’6” */
    if (hasSize) paths.push('<path d="' + outline(r.size.replace(/'/g, '\u2019').replace(/"/g, '\u201D'), { ...SIZE, x: c[0], y: nameBase + (lines.length - 1) * gap + SIZE.gap + sizeCap, anchor: 'middle' }) + '"/>');
    const rot = Number.isFinite(r.rot) && r.rot ? ' transform="rotate(' + r2(r.rot) + ' ' + pt(c) + ')"' : '';
    out.push('<g data-label="' + esc(r.name) + '" fill="' + STYLE.NAVY + '"' + rot + '>' + paths.join('') + '</g>');
  });
  (level.labels || []).forEach((t) => {
    if (typeof t.text !== 'string' || !t.text || !isPt(t.at)) return;
    const c = T(t.at);
    const d = outline(t.text, { ...SMALL, x: c[0], y: c[1] + capHeight(SMALL) / 2, anchor: 'middle' });
    out.push('<g data-label="' + esc(t.text) + '" fill="' + STYLE.NAVY + '"><path d="' + d + '"/></g>');
  });
  return out.join('');
}

/* ---------- branded frame ---------- */
/* the facts, as Matt sets them: beds and baths on the first line; half baths, then the size, below */
function factsLines(facts) {
  if (!facts) return [];
  const n = (v, one, many) => v + ' ' + (v === 1 ? one : many);
  const first = [], second = [];
  if (Number.isFinite(facts.beds)) first.push(facts.beds === 0 ? 'STUDIO' : n(facts.beds, 'BEDROOM', 'BEDROOMS'));
  if (Number.isFinite(facts.baths)) first.push(n(facts.baths, 'BATHROOM', 'BATHROOMS'));
  if (Number.isFinite(facts.half) && facts.half > 0) second.push(n(facts.half, 'HALF BATHROOM', 'HALF BATHROOMS'));
  if (Number.isFinite(facts.sqft) && facts.sqft > 0) second.push('APPROX. ' + Math.round(facts.sqft).toLocaleString('en-US') + ' SF');
  return [first.join(' · '), second.join(' · ')].filter(Boolean);
}

/* the address on one line when it fits left of the bar, else split at its first comma: street over unit */
function addressLines(address) {
  const A = STYLE.HEADER.address, text = address.toUpperCase();
  const room = A.right - A.minX;   // it may start left of x, back to minX, to stay on one line (435 E57)
  if (measure(text, A) <= room || !text.includes(',')) return [text];
  const i = text.indexOf(',');   // street over the rest: 401 EAST 89TH STREET / FLOORS 18, 19E
  return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
}

function drawHeader(plan, facts) {
  const H = STYLE.HEADER, A = H.address, F = H.facts;
  const address = plan.job && typeof plan.job.address === 'string' ? plan.job.address.trim() : '';
  const block = (lines, style) => {   /* baselines of lines centred on the header's middle line */
    const cap = capHeight(style), top = H.middle - (cap + (lines.length - 1) * style.lineGap) / 2;
    return lines.map((t, i) => [t, top + cap + i * style.lineGap]);
  };
  const paths = [];
  if (address) {
    const lines = addressLines(address);
    const x = Math.max(A.minX, Math.min(A.x, A.right - Math.max(...lines.map((t) => measure(t, A)))));
    block(lines, A).forEach(([t, y]) => paths.push(outline(t, { ...A, x, y, anchor: 'start' })));
  }
  const fl = factsLines(facts);
  block(fl, F).forEach(([t, y]) => paths.push(outline(t, { ...F, x: F.right, y, anchor: 'end' })));
  const bar = address && fl.length ? '<rect x="' + r2(H.bar.x - H.bar.w / 2) + '" y="' + r2(H.middle - H.bar.h / 2) + '" width="' + H.bar.w + '" height="' + H.bar.h + '"/>' : '';
  const stops = H.stops.map(([o, c]) => '<stop offset="' + o + '" stop-color="' + c + '"/>').join('');
  return '<defs><linearGradient id="fp-header-gradient" x1="0" y1="0" x2="0" y2="1">' + stops + '</linearGradient></defs>' +
    '<g data-frame="header"><rect x="0" y="0" width="' + STYLE.PAGE.w + '" height="' + H.fade + '" fill="url(#fp-header-gradient)"/>' +
    '<g fill="' + STYLE.WHITE + '">' + paths.map((d) => '<path d="' + d + '"/>').join('') + bar + '</g></g>';
}

function drawFooter() {
  const T = STYLE.FOOTER_TEXT;
  return '<g data-frame="footer" fill="' + STYLE.NAVY + '"><path d="' + outline(T.text, { ...T, x: T.x, y: T.baseline, anchor: 'middle' }) + '"/></g>';
}

/* Matt's compass at the bottom centre, turned to north; slid along the bottom into the nearest empty
   space when the drawing is there (929 Park: beside the bedroom wing), never over the drawing or inside
   it. "Empty" is found on a 2 pt grid: everything the level draws is marked, and the space outside it is
   what a flood from the page edge reaches. */
function occupancy(parts, rects = []) {
  const G = 2, W = Math.ceil(STYLE.PAGE.w / G), H = Math.ceil(STYLE.PAGE.h / G), hit = new Uint8Array(W * H);
  const mark = (p) => { const x = Math.floor(p[0] / G), y = Math.floor(p[1] / G); if (x >= 0 && y >= 0 && x < W && y < H) hit[y * W + x] = 1; };
  parts.forEach(([level, T]) => {
    const seg = (a, b) => { const n = Math.max(1, Math.ceil(len(sub(b, a)) / (G / 2))); for (let i = 0; i <= n; i++) mark(lerp(a, b, i / n)); };
    const ring = (r, closed = true) => { const P = r.filter(isPt).map(T); for (let i = 0; i + 1 < P.length; i++) seg(P[i], P[i + 1]); if (closed && P.length > 2) seg(P[P.length - 1], P[0]); };
    (level.walls || []).forEach((w) => { if (isPt(w.a) && isPt(w.b)) seg(T(w.a), T(w.b)); });
    (level.solids || []).forEach((sd) => ringsOfSolid(sd).forEach((r) => Array.isArray(r) && ring(r)));
    (level.areas || []).forEach((ar) => ar && Array.isArray(ar.poly) && ring(ar.poly));
    (level.openings || []).forEach((o) => { if (isPt(o.a) && isPt(o.b)) seg(T(o.a), T(o.b)); });
    (level.lines || []).forEach((l) => l && Array.isArray(l.pts) && ring(l.pts, !!l.closed));
  });
  /* rects: text on the page (a floor's name), wholly taken */
  rects.forEach(([x0, y0, x1, y1]) => { for (let y = Math.floor(y0 / G); y <= Math.floor(y1 / G); y++) for (let x = Math.floor(x0 / G); x <= Math.floor(x1 / G); x++) if (x >= 0 && y >= 0 && x < W && y < H) hit[y * W + x] = 1; });
  const out = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (out[i] || hit[i]) continue;
    out[i] = 1;
    const x = i % W, y = (i - x) / W;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
  }
  /* is a circle of radius r at c wholly outside the drawing? */
  const free = (c, r) => {
    for (let y = Math.floor((c[1] - r) / G); y <= Math.ceil((c[1] + r) / G); y++) for (let x = Math.floor((c[0] - r) / G); x <= Math.ceil((c[0] + r) / G); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      if (Math.hypot(x * G + G / 2 - c[0], y * G + G / 2 - c[1]) < r - G && !out[y * W + x]) return false;   // a cell's slack: a plan just r away is clear
    }
    return true;
  };
  return Object.assign(free, { G, W, H, out });
}
function compassAt(parts, rects) {
  const C = STYLE.COMPASS, B = STYLE.BOX_BRANDED, r = C.h / 2 + STYLE.COMPASS_CLEAR, free = occupancy(parts, rects);
  for (let d = 0; d <= (B.x1 - B.x0) / 2; d += 6) {
    for (const x of d ? [C.at[0] - d, C.at[0] + d] : [C.at[0]]) {
      if (x - r < B.x0 || x + r > B.x1) continue;
      if (free([x, C.at[1]], r)) return [x, C.at[1]];
    }
  }
  return null;
}

function drawCompass(north, at) {
  const C = STYLE.COMPASS;
  if (SYMBOLS.compass) {
    /* the star turns to north about its centre; the N stays upright, just past the north point (Matt's) */
    const sym = SYMBOLS.compass, w = C.h * sym.size[0] / sym.size[1], k = C.h / sym.size[1];
    const box = (q) => { const v = (q.d.match(/-?[\d.]+/g) || []).map(Number); return [Math.min(...v.filter((_, i) => i % 2 === 0)), Math.min(...v.filter((_, i) => i % 2)), Math.max(...v.filter((_, i) => i % 2 === 0)), Math.max(...v.filter((_, i) => i % 2))]; };
    const boxes = sym.paths.map(box), top = Math.min(...boxes.map((b, i) => (boxes.every((o) => b[3] < o[1] || o === b) ? Infinity : b[1])));
    const isN = boxes.map((b) => b[3] < top);
    if (!isN.some(Boolean)) return '<g data-frame="compass" transform="translate(' + pt(at) + ') rotate(' + r2(north) + ')">' + drawSymbol('compass', w, C.h) + '</g>';
    const rose = boxes.filter((b, i) => !isN[i]), nb = boxes.filter((b, i) => isN[i]);
    const rc = [(Math.min(...rose.map((b) => b[0])) + Math.max(...rose.map((b) => b[2]))) / 2, (Math.min(...rose.map((b) => b[1])) + Math.max(...rose.map((b) => b[3]))) / 2];
    const nc = [(Math.min(...nb.map((b) => b[0])) + Math.max(...nb.map((b) => b[2]))) / 2, (Math.min(...nb.map((b) => b[1])) + Math.max(...nb.map((b) => b[3]))) / 2];
    const part = (keep) => { SYMBOLS['compass:part'] = Object.assign({}, sym, { paths: sym.paths.filter((q, i) => keep(i)) }); const out = drawSymbol('compass:part', w, C.h); delete SYMBOLS['compass:part']; return out; };
    const q = north * Math.PI / 180, dx = (nc[0] - rc[0]) * k, dy = (nc[1] - rc[1]) * k;
    const nAt = [dx * Math.cos(q) - dy * Math.sin(q), dx * Math.sin(q) + dy * Math.cos(q)];
    const rcp = [rc[0] * k, rc[1] * k];   // the star's centre in the drawn symbol
    return '<g data-frame="compass" transform="translate(' + pt(sub(at, rcp)) + ')">' +
      '<g transform="rotate(' + r2(north) + ' ' + pt(rcp) + ')">' + part((i) => !isN[i]) + '</g>' +
      '<g transform="translate(' + pt(addv(rcp, sub(nAt, [nc[0] * k, nc[1] * k]))) + ')">' + part((i) => isN[i]) + '</g></g>';
  }
  const R = C.h * 0.3, letterCap = capHeight(C.letter);
  const ring = ell(0, 0, R, R);
  const needle = poly([[0, -R + 1], [R * 0.35, R * 0.45], [0, R * 0.2], [-R * 0.35, R * 0.45]]);
  const letter = outline('N', { ...C.letter, x: 0, y: -R - 1, anchor: 'middle' });
  return '<g data-frame="compass" transform="translate(' + pt(at) + ') rotate(' + r2(north) + ') translate(0 ' + r2(letterCap / 2) + ')">' +
    '<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '" d="' + ring + '"/>' +
    '<path fill="' + STYLE.NAVY + '" d="' + needle + letter + '"/></g>';
}

/* bottom right: the level's name on a plan of several levels, then ALTERNATE (an alternate layout) or
   CURRENT (plan.current: the current layout of a job that also has an alternate) */
function drawStatus(text) {
  const S = STYLE.STATUS;
  return '<g data-frame="status" fill="' + STYLE.NAVY + '"><path d="' + outline(text, { ...S, x: S.right, y: S.baseline, anchor: 'end' }) + '"/></g>';
}

/* ---------- the page ---------- */
/* one level's drawing, every layer in order, through T (plan units -> page points, scale s);
   also used by style-sheet.js to draw single elements at a fixed scale */
function drawLevel(level, T, s, textK = 1) {
  /* fixtures and linework under the walls, as Matt's are: a counter stops at the wall, it never covers it */
  return [drawAreas(level, T), drawLines(level, T), drawFixtures(level, T, s), drawLines(level, T, true), drawSolids(level, T), drawWalls(level, T),
    drawOpenings(level, T, s), drawRooms(level, T, textK)].filter(Boolean).join('\n');
}

function draw(plan, levelIndex = 0, opts = {}) {
  const branded = !!opts.branded;
  const level = plan.levels[levelIndex];
  if (!level) throw new Error('no level ' + levelIndex);
  let box = branded ? STYLE.BOX_BRANDED : STYLE.BOX_UNBRANDED;
  const b = bounds(level);
  const fit = (bx) => {
    const k = fitScale(level, bx);
    const x = bx.x0 + ((bx.x1 - bx.x0) - (b.x1 - b.x0) * k) / 2, y = bx.y0 + ((bx.y1 - bx.y0) - (b.y1 - b.y0) * k) / 2;
    return { s: k, ox: x, oy: y, extent: { x0: x, y0: y, x1: x + (b.x1 - b.x0) * k, y1: y + (b.y1 - b.y0) * k } };
  };
  let F = fit(box);
  /* the compass needs its corner at the bottom: when the plan leaves no room for it, the plan stops above it */
  const place = (f) => compassAt([[level, (p) => [f.ox + (p[0] - b.x0) * f.s, f.oy + (p[1] - b.y0) * f.s]]]);
  let compass = branded && Number.isFinite(plan.north) ? place(F) : null;
  if (branded && Number.isFinite(plan.north) && !compass) {
    box = Object.assign({}, box, { y1: STYLE.COMPASS.at[1] - STYLE.COMPASS.h / 2 - STYLE.COMPASS_CLEAR });
    F = fit(box);
    compass = place(F) || STYLE.COMPASS.at;
  }
  const { s, ox, oy } = F;
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
    if (Number.isFinite(plan.north)) parts.push(drawCompass(plan.north, compass));
    /* the floor's name (also on a sheet of one floor of several: FLOOR 1 ALTERNATE), then the layout */
    const status = [level.name || '', plan.layout === 'alternate' ? 'ALTERNATE' : plan.current ? 'CURRENT' : ''].filter(Boolean).join(' ');
    if (status) parts.push(drawStatus(status));
    parts.push(drawFooter());
  }
  parts.push('</svg>');
  return parts.filter(Boolean).join('\n') + '\n';
}

/* ---------- the all-floors sheet ---------- */
/* Matt's sheet of a home on several floors, beside a sheet of its own for each: every floor at one scale
   (level.unitsPerFoot evens out floors traced from different pictures), each named on the page. Either
   in a row, bottoms lined up and each named centred below (225 E79: MAIN LEVEL, LOWER LEVEL), or two
   floors stepped from top left to bottom right, the first named below its left end and the second above
   its right end (401 E89). It takes whichever draws the floors larger, as Matt fills the page;
   plan.sheet ("row" or "stagger") picks one. */
function levelName(name, at, anchor) {
  const N = STYLE.LEVEL_NAME, words = String(name).split(' ');
  /* MAIN in black, LEVEL light (Matt's); FLOOR 2 black throughout */
  const runs = words.length > 1 && words[words.length - 1] === 'LEVEL'
    ? [[words.slice(0, -1).join(' ') + ' ', N.weight], ['LEVEL', N.light]] : [[String(name), N.weight]];
  const widths = runs.map(([t, w]) => measure(t, { ...N, weight: w })), total = widths.reduce((a, b) => a + b, 0);
  const x0 = at[0] - (anchor === 'middle' ? total / 2 : anchor === 'end' ? total : 0);
  let x = x0;
  const d = runs.map(([t, w], i) => { const o = outline(t, { ...N, weight: w, x, y: at[1] }); x += widths[i]; return o; }).join('');
  return { svg: '<path fill="' + STYLE.NAVY + '" d="' + d + '"/>', box: [x0, at[1] - capHeight(N), x0 + total, at[1]] };
}

/* a level's plan units per foot: as given, or read off its rooms that give both a size and their extent
   (box), the longer side against the longer side; null when neither is there */
function unitsPerFoot(level) {
  if (Number.isFinite(level.unitsPerFoot) && level.unitsPerFoot > 0) return level.unitsPerFoot;
  const ft = (v) => { const m = /^(\d+)'(?:(\d+(?:\.\d+)?)")?$/.exec(v.trim()); return m ? +m[1] + (+m[2] || 0) / 12 : null; };
  const est = [];
  (level.rooms || []).forEach((r) => {
    if (typeof r.size !== 'string' || !Array.isArray(r.box) || r.box.length !== 4) return;
    const sz = r.size.split(' x ').map(ft);
    if (sz.length !== 2 || !sz[0] || !sz[1]) return;
    const bw = Math.abs(r.box[2] - r.box[0]), bh = Math.abs(r.box[3] - r.box[1]);
    est.push(Math.max(bw, bh) / Math.max(...sz), Math.min(bw, bh) / Math.min(...sz));
  });
  if (!est.length) return null;
  est.sort((a, b) => a - b);
  return est[est.length >> 1];
}

function arrangeLevels(plan, box, reserve = 0) {
  const L = plan.levels, n = L.length, N = STYLE.LEVEL_NAME, cap = capHeight(N);
  const u = L.map(unitsPerFoot), k = L.map((l, i) => (u[0] && u[i] ? u[0] / u[i] : 1));
  const b = L.map(bounds), w = b.map((q, i) => (q.x1 - q.x0) * k[i]), h = b.map((q, i) => (q.y1 - q.y0) * k[i]);
  const W = box.x1 - box.x0, H = box.y1 - box.y0, sum = (a) => a.reduce((x, y) => x + y, 0);
  /* level i drawn at scale s (pt per common unit) with its top left corner at x, y */
  const at = (i, s, x, y) => { const q = s * k[i]; return { s: q, x, y, w: w[i] * s, h: h[i] * s, T: (p) => [x + (p[0] - b[i].x0) * q, y + (p[1] - b[i].y0) * q] }; };
  const ways = [];
  {
    const s = Math.min((W - N.gap * (n - 1)) / (sum(w) || 1), (H - N.below) / (Math.max(...h) || 1));
    const gw = sum(w) * s + N.gap * (n - 1), bottom = box.y0 + (H - Math.max(...h) * s - N.below) / 2 + Math.max(...h) * s;
    let x = box.x0 + (W - gw) / 2;
    const places = L.map((l, i) => { const q = at(i, s, x, bottom - h[i] * s); x += w[i] * s + N.gap; return q; });
    ways.push({ kind: 'row', s, places, names: places.map((q, i) => levelName(L[i].name || '', [q.x + q.w / 2, bottom + N.below], 'middle')) });
  }
  if (n === 2) {
    const make = (s) => {
      /* reserve: the bottom right corner kept for ALTERNATE or CURRENT */
      const p1 = at(0, s, box.x0, box.y0), p2 = at(1, s, box.x1 - w[1] * s, box.y1 - reserve - h[1] * s);
      return { kind: 'stagger', s, places: [p1, p2],
        names: [levelName(L[0].name || '', [p1.x, p1.y + p1.h + N.stagger], 'start'), levelName(L[1].name || '', [p2.x + p2.w, p2.y - N.above], 'end')] };
    };
    /* the floors (and their names) may share the page's corners, never touch: each floor's drawing, kept
       N.clear apart from the other's */
    const clash = (way) => {
      const A = occupancy([[L[0], way.places[0].T]], [way.names[0].box]), B = occupancy([[L[1], way.places[1].T]], [way.names[1].box]);
      const r = Math.ceil(N.clear / A.G), dil = new Uint8Array(A.W * A.H);
      for (let y = 0; y < A.H; y++) for (let x = 0; x < A.W; x++) if (!A.out[y * A.W + x]) {
        for (let dy = -r; dy <= r; dy++) { const Y = y + dy; if (Y < 0 || Y >= A.H) continue; for (let dx = -r; dx <= r; dx++) { const X = x + dx; if (X >= 0 && X < A.W) dil[Y * A.W + X] = 1; } }
      }
      for (let i = 0; i < dil.length; i++) if (dil[i] && !B.out[i]) return true;
      return false;
    };
    const fits = (s) => w[0] * s <= W && w[1] * s <= W && h[0] * s + N.stagger <= H && h[1] * s + N.above + cap + reserve <= H;
    let lo = 0, hi = Math.min(W / Math.max(w[0], w[1], 1e-9), (H - N.stagger) / Math.max(h[0], 1e-9), (H - N.above - cap - reserve) / Math.max(h[1], 1e-9));
    if (fits(hi) && !clash(make(hi))) lo = hi;
    else for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (fits(m) && !clash(make(m))) lo = m; else hi = m; }
    if (lo > 0) ways.push(make(lo));
  }
  /* a row unless stepping them draws the floors clearly larger (Matt's 225 E79 is a row; 401 E89, two long
     floors, steps) */
  const pick = ways.find((v) => v.kind === plan.sheet);
  return pick || ways.reduce((a, v) => (v.s > a.s * N.preferRow ? v : a));
}

function drawAll(plan, opts = {}) {
  const branded = !!opts.branded;
  if (plan.levels.length < 2) return draw(plan, 0, opts);
  let box = branded ? STYLE.BOX_BRANDED : STYLE.BOX_UNBRANDED;
  const status = branded ? (plan.layout === 'alternate' ? 'ALTERNATE' : plan.current ? 'CURRENT' : '') : '';
  const reserve = status ? capHeight(STYLE.STATUS) + STYLE.COMPASS_CLEAR : 0;
  let A = arrangeLevels(plan, box, reserve);
  const north = branded && Number.isFinite(plan.north);
  const spot = (a) => compassAt(a.places.map((q, i) => [plan.levels[i], q.T]), a.names.map((m) => m.box));
  let compass = north ? spot(A) : null;
  if (north && !compass) {
    box = Object.assign({}, box, { y1: STYLE.COMPASS.at[1] - STYLE.COMPASS.h / 2 - STYLE.COMPASS_CLEAR });
    A = arrangeLevels(plan, box, reserve);
    compass = spot(A) || STYLE.COMPASS.at;
  }
  const W = STYLE.PAGE.w, H = STYLE.PAGE.h;
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">',
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + STYLE.WHITE + '"/>'
  ];
  if (branded) parts.push(drawHeader(plan, opts.facts));
  parts.push(patternDefs([].concat(...plan.levels.map((l) => (l.areas || []).map((a) => a.pattern)))));
  /* the text a little smaller than on a floor's own sheet, as Matt sets it: about the cube root of how much
     smaller the floor is drawn (225 E79: 0.9, 401 E89: 0.8), never under 0.7 */
  const single = branded ? STYLE.BOX_BRANDED : STYLE.BOX_UNBRANDED;
  const textK = Math.max(0.7, Math.min(1, ...plan.levels.map((l, i) => Math.cbrt(A.places[i].s / fitScale(l, single)))));
  plan.levels.forEach((l, i) => parts.push('<g data-level="' + (i + 1) + '">' + drawLevel(l, A.places[i].T, A.places[i].s, textK) + '</g>'));
  parts.push('<g data-frame="level-names">' + A.names.map((m) => m.svg).join('') + '</g>');
  if (branded) {
    if (north) parts.push(drawCompass(plan.north, compass));
    if (status) parts.push(drawStatus(status));
    parts.push(drawFooter());
  }
  parts.push('</svg>');
  return parts.filter(Boolean).join('\n') + '\n';
}

module.exports = { draw, drawAll, drawLevel, drawSymbol, SYMBOLS, patternDefs, PATTERNS, outline, measure };
