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
const { fitScale } = require('./plan.js');

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

/* the same points fitScale measures: wall ends, solid corners, area corners */
function bounds(level) {
  const pts = [];
  (level.walls || []).forEach((w) => { if (isPt(w.a)) pts.push(w.a); if (isPt(w.b)) pts.push(w.b); });
  (level.solids || []).forEach((s) => (s || []).forEach((p) => { if (isPt(p)) pts.push(p); }));
  (level.areas || []).forEach((a) => ((a && a.poly) || []).forEach((p) => { if (isPt(p)) pts.push(p); }));
  if (!pts.length) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const poly = (pts) => 'M' + pts.map(pt).join('L') + 'Z';
const thin = (extra = '') => 'fill="' + STYLE.WHITE + '" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '"' + extra;
const line = (a, b) => 'M' + pt(a) + 'L' + pt(b);

/* ---------- walls with openings cut out ---------- */
function drawWalls(level, T) {
  const walls = level.walls || [], out = [];
  ['exterior', 'interior'].forEach((type) => {
    const width = type === 'exterior' ? STYLE.WALL_EXTERIOR : STYLE.WALL_INTERIOR;
    walls.forEach((w, wi) => {
      if (w.type !== type || !isPt(w.a) || !isPt(w.b)) return;
      const a = T(w.a), b = T(w.b), L = len(sub(b, a));
      if (!L) return;
      const cuts = (level.openings || []).filter((o) => o.wall === wi).map((o) => [o.from, o.to]).sort((p, q) => p[0] - q[0]);
      const spans = [];
      let t = 0;
      cuts.forEach(([f, to]) => { if (f > t) spans.push([t, f]); t = Math.max(t, to); });
      if (t < 1) spans.push([t, 1]);
      const d = mul(sub(b, a), 1 / L), n = [d[1], -d[0]], hw = width / 2;
      spans.forEach(([s, e]) => {
        /* square ends only at the wall's real ends; a cut into an opening ends flush */
        const p = addv(lerp(a, b, s), mul(d, s === 0 ? -hw : 0));
        const q = addv(lerp(a, b, e), mul(d, e === 1 ? hw : 0));
        out.push(poly([addv(p, mul(n, hw)), addv(q, mul(n, hw)), addv(q, mul(n, -hw)), addv(p, mul(n, -hw))]));
      });
    });
  });
  return out.length ? '<path fill="' + STYLE.NAVY + '" d="' + out.join('') + '"/>' : '';
}

/* ---------- openings: doors, windows, sliders ---------- */
function drawOpenings(level, T) {
  const walls = level.walls || [], out = [];
  (level.openings || []).forEach((o) => {
    const w = walls[o.wall];
    if (!w || !isPt(w.a) || !isPt(w.b)) return;
    const a = T(w.a), b = T(w.b), L = len(sub(b, a));
    if (!L) return;
    const width = w.type === 'exterior' ? STYLE.WALL_EXTERIOR : STYLE.WALL_INTERIOR;
    const d = mul(sub(b, a), 1 / L), left = [d[1], -d[0]];
    const n = o.side === 'right' ? mul(left, -1) : left;
    const p0 = lerp(a, b, o.from), p1 = lerp(a, b, o.to), span = L * (o.to - o.from);
    const hw = width / 2 - STYLE.THIN / 2;

    const swing = (hinge, free, r) => {
      const tip = addv(hinge, mul(n, r));
      const u = sub(tip, hinge), v = sub(free, hinge);
      const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
      out.push('<path ' + thin() + ' d="' + line(hinge, tip) + '"/>');
      out.push('<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '" d="M' + pt(tip) + 'A' + r2(r) + ' ' + r2(r) + ' 0 0 ' + sweep + ' ' + pt(free) + '"/>');
    };

    if (o.type === 'door') {
      const [h, f] = o.hinge === 'to' ? [p1, p0] : [p0, p1];
      swing(h, f, span);
    } else if (o.type === 'double-door') {
      const mid = lerp(p0, p1, 0.5);
      swing(p0, mid, span / 2);
      swing(p1, mid, span / 2);
    } else if (o.type === 'window') {
      const lines = [line(addv(p0, mul(left, hw)), addv(p1, mul(left, hw))), line(addv(p0, mul(left, -hw)), addv(p1, mul(left, -hw)))];
      out.push('<path fill="none" stroke="' + STYLE.NAVY + '" stroke-width="' + STYLE.THIN + '" d="' + lines.join('') + '"/>');
    } else if (o.type === 'sliding' || o.type === 'pocket') {
      const t = STYLE.SLIDING_PANEL;
      const panel = (s, e, off) => {
        const q0 = addv(lerp(p0, p1, s), mul(left, off)), q1 = addv(lerp(p0, p1, e), mul(left, off));
        return poly([addv(q0, mul(left, t / 2)), addv(q1, mul(left, t / 2)), addv(q1, mul(left, -t / 2)), addv(q0, mul(left, -t / 2))]);
      };
      const d2 = o.type === 'sliding' ? panel(0, 0.55, t / 2) + panel(0.45, 1, -t / 2) : panel(0, 1, 0);
      out.push('<path ' + thin() + ' d="' + d2 + '"/>');
    }
    /* 'opening' is just the gap */
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
      if (alongX) for (let x = x0 + STYLE.STAIR_TREAD; x < x1 - 0.01; x += STYLE.STAIR_TREAD) tr += line([x, y0], [x, y1]);
      else for (let y = y0 + STYLE.STAIR_TREAD; y < y1 - 0.01; y += STYLE.STAIR_TREAD) tr += line([x0, y], [x1, y]);
      const back = Array.isArray(a.dir) && (alongX ? a.dir[0] < 0 : a.dir[1] < 0);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, h = STYLE.STAIR_ARROW;
      let s0, s1;
      if (alongX) { s0 = [back ? x1 - h : x0 + h, cy]; s1 = [back ? x0 + h : x1 - h, cy]; } else { s0 = [cx, back ? y1 - h : y0 + h]; s1 = [cx, back ? y0 + h : y1 - h]; }
      const dv = mul(sub(s1, s0), 1 / (len(sub(s1, s0)) || 1)), nv = [dv[1], -dv[0]];
      const head = line(addv(s1, addv(mul(dv, -h), mul(nv, h * 0.6))), s1) + 'L' + pt(addv(s1, addv(mul(dv, -h), mul(nv, -h * 0.6))));
      out.push('<path ' + thin() + ' d="' + d + '"/>');
      out.push('<path fill="none" ' + stroke + ' d="' + tr + line(s0, s1) + head + '"/>');
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

const FIXTURE_DRAW = {
  toilet: (w, h) => [rect(-w / 2, -h / 2, w, h * 0.3), ell(0, -h / 2 + h * 0.3 + h * 0.35, w * 0.4, h * 0.35)],
  sink: (w, h) => [rect(-w / 2, -h / 2, w, h), ell(0, 0, w * 0.32, h * 0.3)],
  'double-sink': (w, h) => [rect(-w / 2, -h / 2, w, h), ell(-w / 4, 0, w * 0.15, h * 0.3), ell(w / 4, 0, w * 0.15, h * 0.3)],
  tub: (w, h) => [rect(-w / 2, -h / 2, w, h), rrect(-w / 2 + w * 0.06, -h / 2 + h * 0.12, w * 0.88, h * 0.76, h * 0.35)],
  shower: (w, h) => [rect(-w / 2, -h / 2, w, h), line([-w / 2, -h / 2], [w / 2, h / 2]) + line([w / 2, -h / 2], [-w / 2, h / 2])],
  range: (w, h) => [rect(-w / 2, -h / 2, w, h), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => ell(i * w / 4, j * h / 4, Math.min(w, h) * 0.15, Math.min(w, h) * 0.15))],
  'kitchen-sink': (w, h) => [rect(-w / 2, -h / 2, w, h), rrect(-w / 2 + w * 0.08, -h / 2 + h * 0.15, w * 0.38, h * 0.7, 1), rrect(w * 0.04, -h / 2 + h * 0.15, w * 0.38, h * 0.7, 1)],
  fireplace: (w, h) => [rect(-w / 2, -h / 2, w, h), rect(-w / 2 + w * 0.15, -h / 2, w * 0.7, h * 0.6)],
  counter: (w, h) => [rect(-w / 2, -h / 2, w, h)]
};

function drawFixtures(level, T, s) {
  const out = [];
  (level.fixtures || []).forEach((f) => {
    const fn = FIXTURE_DRAW[f.type];
    if (!fn || !isPt(f.at) || !(f.w > 0) || !(f.h > 0)) return;
    const c = T(f.at), w = f.w * s, h = f.h * s;
    const rot = Number.isFinite(f.rot) && f.rot ? ' rotate(' + r2(f.rot) + ')' : '';
    out.push('<g transform="translate(' + pt(c) + ')' + rot + '">' + fn(w, h).map((d) => '<path ' + thin() + ' d="' + d + '"/>').join('') + '</g>');
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
  if (branded) parts.push(drawHeader(plan, opts.facts));
  parts.push(
    drawAreas(level, T),
    drawSolids(level, T),
    drawWalls(level, T),
    drawFixtures(level, T, s),
    drawOpenings(level, T),
    drawRooms(level, T)
  );
  if (branded) {
    if (Number.isFinite(plan.north)) parts.push(drawCompass(plan.north));
    if (plan.levels.length > 1 && level.name) parts.push(drawLevelName(level.name));
    parts.push(drawFooter());
  }
  parts.push('</svg>');
  return parts.filter(Boolean).join('\n') + '\n';
}

module.exports = { draw, outline, measure };
