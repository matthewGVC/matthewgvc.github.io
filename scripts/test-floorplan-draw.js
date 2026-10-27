/* ============================================================
   Tests for scripts/floorplan/draw.js — the floorplan drawer (SVG, text outlined).
   Plain Node:  node scripts/test-floorplan-draw.js
   ============================================================ */
'use strict';

const path = require('path');
const fontkit = require('fontkit');
const { draw, drawAll } = require('./floorplan/draw.js');
const { validate } = require('./floorplan/plan.js');
const STYLE = require('./floorplan/style.js');
const studio = require('./floorplan/fixtures/studio.json');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}
function near(name, got, want, tol) {
  if (Number.isFinite(got) && Math.abs(got - want) <= tol + 1e-9) { pass++; return; }
  failures.push(name + '\n      expected ' + want + ' (±' + tol + ')\n      got      ' + got);
}
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---- helpers: find a label group and measure its paths ---- */
function group(svg, attr, value) {
  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = svg.match(new RegExp('<g[^>]*' + attr + '="' + esc + '"[^>]*>([\\s\\S]*?)</g>'));
  return m ? m[1] : null;
}
const pathsIn = (inner) => (inner.match(/<path[^>]*\sd="([^"]*)"/g) || []).map((p) => p.match(/\sd="([^"]*)"/)[1]);

/* exact bbox of an absolute M/L/Q/C/Z path (quadratic and cubic extremes included) */
function bbox(d) {
  const toks = d.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  const num = () => parseFloat(toks[i++]);
  const quadExt = (p0, p1, p2) => { const den = p0 - 2 * p1 + p2; if (!den) return []; const t = (p0 - p1) / den; return t > 0 && t < 1 ? [t] : []; };
  const cubicExt = (p0, p1, p2, p3) => {
    const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0, out = [];
    if (Math.abs(a) < 1e-12) { if (b) out.push(-c / b); } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) { out.push((-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a)); }
    }
    return out.filter((t) => t > 0 && t < 1);
  };
  let cmd = null;
  while (i < toks.length) {
    if (/[MLQCZ]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'Z') { cx = sx; cy = sy; continue; }
    if (cmd === 'M') { cx = sx = num(); cy = sy = num(); add(cx, cy); cmd = 'L'; continue; }
    if (cmd === 'L') { cx = num(); cy = num(); add(cx, cy); continue; }
    if (cmd === 'Q') {
      const qx = num(), qy = num(), x = num(), y = num();
      add(x, y);
      quadExt(cx, qx, x).forEach((t) => add((1 - t) * (1 - t) * cx + 2 * (1 - t) * t * qx + t * t * x, cy));
      quadExt(cy, qy, y).forEach((t) => add(cx, (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * qy + t * t * y));
      cx = x; cy = y; continue;
    }
    if (cmd === 'C') {
      const ax = num(), ay = num(), bx = num(), by = num(), x = num(), y = num();
      add(x, y);
      const B = (p0, p1, p2, p3, t) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
      cubicExt(cx, ax, bx, x).forEach((t) => add(B(cx, ax, bx, x, t), cy));
      cubicExt(cy, ay, by, y).forEach((t) => add(cx, B(cy, ay, by, y, t)));
      cx = x; cy = y; continue;
    }
    i++;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/* the height a string should have at a given size, straight from the font (independent of draw.js) */
const fonts = {};
function expectedHeight(text, weight, sizePt) {
  const file = path.join(__dirname, '..', 'assets', 'fonts', 'nunito-sans-' + weight + '-latin.woff2');
  const font = fonts[weight] || (fonts[weight] = fontkit.openSync(file));
  let lo = Infinity, hi = -Infinity;
  font.layout(text).glyphs.forEach((g) => { const b = g.path.bbox; if (b.maxY > b.minY) { lo = Math.min(lo, b.minY); hi = Math.max(hi, b.maxY); } });
  return (hi - lo) * sizePt / font.unitsPerEm;
}
const nameHeight = (svg, name) => bbox(pathsIn(group(svg, 'data-label', name))[0]).h;

/* ---- the tests ---- */
const unbranded = draw(studio, 0, { branded: false });
const branded = draw(studio, 0, { branded: true, facts: { beds: 0, baths: 1 } });

check('output is an SVG document', /^<svg[^>]*viewBox="0 0 810 630"/.test(unbranded), true);

check('no text elements (unbranded)', /<text/.test(unbranded), false);
check('no text elements (branded)', /<text/.test(branded), false);

check('no external references (unbranded)', /href="(http|\.\.|\/)/.test(unbranded), false);
check('no external references (branded)', /href="(http|\.\.|\/)/.test(branded), false);
check('no <image> in branded', /<image/.test(branded), false);

const allowed = ['#00273a', '#ffffff', '#eef3f5', 'none'];
const colours = [...unbranded.matchAll(/\b(?:fill|stroke)="([^"]*)"/g)].map((m) => m[1].toLowerCase());
check('only navy and white in unbranded', colours.filter((c) => !allowed.includes(c)), []);
check('unbranded uses navy', colours.includes('#00273a'), true);

/* fixed room name size: every name is drawn at exactly ROOM_NAME_PT, whatever its letters.
   (Round letters overshoot the cap height, so LIVING ROOM and BATH differ in raw bbox by the
   font's overshoot; we compare each against the font's own height for that string at the fixed size.) */
const liv = nameHeight(unbranded, 'LIVING ROOM'), bath = nameHeight(unbranded, 'BATH');
const livWant = expectedHeight('LIVING ROOM', STYLE.ROOM_NAME.weight, STYLE.ROOM_NAME_PT);
const bathWant = expectedHeight('BATH', STYLE.ROOM_NAME.weight, STYLE.ROOM_NAME_PT);
near('fixed room name size: LIVING ROOM', liv, livWant, 0.01);
near('fixed room name size: BATH', bath, bathWant, 0.01);
near('fixed room name size: same scale for LIVING ROOM and BATH', liv / livWant, bath / bathWant, 0.004);
/* coordinates are rounded to 2 decimals, so each drawn height is within ±0.01 of exact:
   drawn-vs-font compares at ±0.01, drawn-vs-drawn at ±0.02, scale ratios at ±0.004 */
near('fixed room name size: LIVING ROOM equals KITCHEN', liv, nameHeight(unbranded, 'KITCHEN'), 0.02);

check('room without size draws name only', pathsIn(group(unbranded, 'data-label', 'WIC')).length, 1);
check('room with size draws name and size', pathsIn(group(unbranded, 'data-label', 'LIVING ROOM')).length, 2);

let p = clone(studio);
p.levels[0].rooms[1].name = 'PRIMARY BEDROOM / LIBRARY';
const longSvg = draw(p, 0, { branded: false });
const longH = nameHeight(longSvg, 'PRIMARY BEDROOM / LIBRARY');
const longWant = expectedHeight('PRIMARY BEDROOM / LIBRARY', STYLE.ROOM_NAME.weight, STYLE.ROOM_NAME_PT);
near('long name keeps the fixed size', longH, longWant, 0.01);
near('long name keeps the same scale as LIVING ROOM', longH / longWant, liv / livWant, 0.004);

check('unbranded has no frame', /data-frame=/.test(unbranded), false);
check('branded has a header', /data-frame="header"/.test(branded), true);
check('branded has a footer', /data-frame="footer"/.test(branded), true);

check('compass only with north (null)', /data-frame="compass"/.test(branded), false);
p = clone(studio); p.north = 0;
check('compass only with north (0)', /data-frame="compass"/.test(draw(p, 0, { branded: true })), true);
check('no compass when unbranded', /data-frame="compass"/.test(draw(p, 0, { branded: false })), false);

check('same plan, same output (unbranded)', draw(studio, 0, { branded: false }) === unbranded, true);
check('same plan, same output (branded)', draw(studio, 0, { branded: true, facts: { beds: 0, baths: 1 } }) === branded, true);

/* ---- walls: connected runs are one line, curves are real arcs ---- */
const wallPaths = (svg, width) => (svg.match(new RegExp('<path fill="none" stroke="#00273a" stroke-width="' + width + '" stroke-linejoin="miter"[^>]*d="([^"]*)"')) || [, ''])[1];
const box4 = { schema: 1, job: { label: 'x', address: 'x' }, sources: [], north: null, levels: [{ name: null,
  walls: [{ a: [0, 0], b: [100, 0], type: 'exterior' }, { a: [100, 0], b: [100, 80], type: 'exterior' },
    { a: [100, 80], b: [0, 80], type: 'exterior' }, { a: [0, 80], b: [0, 0], type: 'exterior' }] }] };
let ext = wallPaths(draw(box4, 0, {}), STYLE.WALL_EXTERIOR);
check('four walls meeting end to end are one closed line', [(ext.match(/M/g) || []).length, (ext.match(/Z/g) || []).length], [1, 1]);
p = clone(box4); { const w = p.levels[0].walls; p.levels[0].walls = [w[2], w[0], { a: [100, 80], b: [100, 0], type: 'exterior' }, w[3]]; }   /* shuffled, one reversed */
ext = wallPaths(draw(p, 0, {}), STYLE.WALL_EXTERIOR);
check('walls drawn in any direction still join', [(ext.match(/M/g) || []).length, (ext.match(/Z/g) || []).length], [1, 1]);
p = clone(box4); p.levels[0].openings = [{ wall: 0, from: 0.4, to: 0.6, type: 'opening' }];
ext = wallPaths(draw(p, 0, {}), STYLE.WALL_EXTERIOR);
check('an opening breaks the loop into one open line', [(ext.match(/M/g) || []).length, (ext.match(/Z/g) || []).length], [1, 0]);
p = clone(box4); p.levels[0].walls[0].via = [50, -20];
check('a wall with via is drawn as an arc', /A/.test(wallPaths(draw(p, 0, {}), STYLE.WALL_EXTERIOR)), true);
p.levels[0].openings = [{ wall: 0, from: 0, to: 1, type: 'window' }];
check('a window on a curved wall follows the curve', (draw(p, 0, {}).match(/stroke-width="0.3" d="M[^"]*A[^"]*A/) || []).length, 1);
p = clone(box4); p.levels[0].walls.push({ a: [50, 0], b: [50, 80], type: 'glass' });
check('glass walls are drawn at their own weight', wallPaths(draw(p, 0, {}), STYLE.WALL_GLASS) !== '', true);

/* ---- fixtures, linework, stairs ---- */
const fx = (type, extra) => { const q = clone(box4); q.levels[0].fixtures = [Object.assign({ type, at: [50, 40], w: 20, h: 24, rot: 0 }, extra)]; return draw(q, 0, {}); };
const paths = (svg) => (svg.match(/<g transform="translate[^>]*>([\s\S]*?)<\/g>/) || [, ''])[1].match(/<path/g).length;
['toilet', 'sink', 'round-sink', 'shower', 'range', 'kitchen-sink', 'refrigerator', 'fireplace', 'counter', 'rod'].forEach((t) =>
  check('fixture ' + t + ' draws', /<g transform="translate/.test(fx(t)), true));
check('a one-bowl kitchen sink has one bowl', paths(fx('kitchen-sink', { bowls: 1 })), 3);
check('a two-bowl kitchen sink has two', paths(fx('kitchen-sink')), 5);
p = clone(box4); p.levels[0].lines = [{ pts: [[10, 10], [30, 10], [30, 20]], closed: true }, { pts: [[40, 40], [60, 60]] }];
const ln = draw(p, 0, {});
check('lines: a closed one is filled white, an open one is not', [/fill="#ffffff"[^>]*d="M[^"]*Z"/.test(ln), /fill="none" stroke="#00273a" stroke-width="0.5" d="M[\d. L]*"\/>/.test(ln)], [true, true]);
p = clone(box4); p.levels[0].areas = [{ type: 'stair', poly: [[0, 0], [20, 0], [20, 80], [0, 80]], treads: 9, arrow: false }];
const st = draw(p, 0, {}).match(/<path fill="none" stroke="#00273a" stroke-width="0.5" d="([^"]*)"\/>/)[1];
check('a stair with treads: 9 draws nine treads and no arrow', (st.match(/M/g) || []).length, 9);
check('the worked example draws', /<svg/.test(draw(require('./floorplan/fixtures/555-w59-phc.json'), 0, { branded: true })), true);
check('underlay is only drawn when asked', /<image/.test(draw(box4, 0, {})), false);

/* ---- doors: Matt's rule, fully open to the outside, half open inside ---- */
const leafAngle = (outside) => {
  const q = clone(box4); q.levels[0].openings = [{ wall: 0, from: 0.3, to: 0.7, type: 'door', hinge: 'from', side: 'left', outside }];
  /* the leaf is a hollow panel: its first edge runs from beside the hinge to beside the tip */
  const m = draw(q, 0, {}).match(/fill="#ffffff" stroke="#00273a" stroke-width="0.3" d="M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)L[^"]*Z"/);
  return Math.round(Math.atan2(-(+m[4] - +m[2]), +m[3] - +m[1]) * 180 / Math.PI);
};
check('a door to the outside stands at ' + STYLE.DOOR_OPEN_OUTSIDE + '°', leafAngle(true), STYLE.DOOR_OPEN_OUTSIDE);
check('an inside door stands at ' + STYLE.DOOR_OPEN_INSIDE + '°', leafAngle(undefined), STYLE.DOOR_OPEN_INSIDE);
check('a door leaf is a hollow panel ' + STYLE.DOOR_LEAF + ' pt wide, white, in the fine door line (Matt\'s)', (() => {
  const q = clone(box4); q.levels[0].openings = [{ wall: 0, from: 0.3, to: 0.7, type: 'door', hinge: 'from', side: 'left' }];
  const m = draw(q, 0, {}).match(/fill="#ffffff" stroke="#00273a" stroke-width="0.3" d="M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/);
  return Math.abs(Math.hypot(+m[5] - +m[3], +m[6] - +m[4]) - STYLE.DOOR_LEAF) < 0.03;   // to the 2-decimal rounding of the points
})(), true);
check('a window is a white frame across the wall with its glass inside (two frames, fine lines)', (() => {
  const q = clone(box4); q.levels[0].openings = [{ wall: 0, from: 0.3, to: 0.7, type: 'window' }];
  const svg = draw(q, 0, {});
  return [/<path fill="#ffffff" d="M[^"]*"\/><path fill="none" stroke="#00273a" stroke-width="0.3" d="([^"]*)"/.test(svg), ((svg.match(/<path fill="none" stroke="#00273a" stroke-width="0.3" d="([^"]*)"/) || [, ''])[1].match(/M/g) || []).length];
})(), [true, 8]);

/* ---- the style sheet: every element in its own named group ---- */
const { sheet, ELEMENTS } = require('./floorplan/style-sheet.js');
const SYM = require('./floorplan/symbols.json');
const sh = sheet();
check('style sheet: one group per element, plus the branded frame', ELEMENTS.map(([id]) => sh.includes('<g id="' + id + '">')).filter((x) => !x).length, 0);
const emptyGroup = (id) => sh.includes('<g id="' + id + '"></g>');
check('style sheet: every element draws something', ELEMENTS.filter(([id, , level]) => level && emptyGroup(id)).map(([id]) => id), []);
const symbolCells = ELEMENTS.filter(([id]) => id.startsWith('symbol-')).map(([id]) => id.slice(7)).sort();
check('style sheet: a symbol-<name> cell for every one of Matt\'s symbols', symbolCells, Object.keys(SYM).sort());
check('style sheet: the swatch patterns are defined once each', ['tile', 'brick-patio', 'brick-roof'].map((n) => sh.split('id="fp-pat-' + n + '"').length - 1), [1, 1, 1]);
check('style sheet: has the frame and the four layers', ['frame-branded-page', 'GUIDES', 'ELEMENTS', 'CAPTIONS', 'NOTES'].every((id) => sh.includes('id="' + id + '"')), true);

/* ---- ranges, furniture, swatches, stair break ---- */
const fpaths = (type, extra) => paths(fx(type, extra));
/* Matt's symbols (symbols.json) are what the fixtures draw */
check('range: 4 burners by default, 6 on request, 6 with a griddle, each Matt\'s own',
  [(fx('range').match(/<path/g) || []).length, (fx('range', { burners: 6 }).match(/<path/g) || []).length, (fx('range', { burners: 6, griddle: true }).match(/<path/g) || []).length],
  ['range-4', 'range-6', 'range-6-griddle'].map((n) => SYM[n].paths.length + SYM[n].paths.filter((q) => q.weight === 'thin' && !q.fill && /Z\s*$/.test(q.d)).length + (fx('box').match(/<path/g) || []).length));
check('a symbol\'s closed outlines are backed in white, under its lines, so a counter edge does not show through', /<g transform="translate[^>]*"><path data-back="1" fill="#ffffff" d="/i.test(fx('range')), true);
/* at a real plan's scale (an 80 ft wide unit) Matt's thin filled outlines are thickened to the house weight */
const bigPlan = clone(box4); bigPlan.levels[0].walls = [{ a: [0, 0], b: [960, 0], type: 'exterior' }, { a: [960, 0], b: [960, 600], type: 'exterior' }];
bigPlan.levels[0].fixtures = [{ type: 'toilet', at: [100, 100], w: 19, h: 30, rot: 0 }];
check('the toilet is Matt\'s, thickened to the house weight', /stroke-linejoin="round"/.test(draw(bigPlan, 0, {})), true);
check('lounge-chair draws Matt\'s symbol', (fx('lounge-chair').match(/<path/g) || []).length > SYM['lounge-chair'].paths.length - 1, true);
check('until Matt\'s car comes, a car is its rounded footprint', [!SYM.car, /<g transform="translate[^>]*><path [^>]*d="M[^"]*A/.test(fx('car', { w: 190, h: 75 }))], [true, true]);
check('a closet rod is drawn as Matt\'s clothes', (fx('rod', { w: 72, h: 20 }).match(/stroke="#00A1C4"/g) || []).length > 0, true);
/* Matt's symbols keep his proportions: scaled to the box's width, set against its wall side */
const symBox = (svg) => {
  const g = [...svg.matchAll(/<g transform="translate\(([\d.-]+) ([\d.-]+)\)">(.*?)<\/g>/g)].pop()[3];
  const v = [...g.matchAll(/d="([^"]*)"/g)].flatMap((m) => (m[1].match(/-?[\d.]+/g) || []).map(Number));
  const xs = v.filter((_, i) => i % 2 === 0), ys = v.filter((_, i) => i % 2);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const rq = symBox(fx('range', { w: 30, h: 24 })), rw = SYM['range-4'].size, rk = (rq.x1 - rq.x0) / 30;
check('a range in a shallower box is not squashed: its depth is Matt\'s, its back on the wall',
  [Math.abs((rq.y1 - rq.y0) / (rq.x1 - rq.x0) - rw[1] / rw[0]) < 0.02, Math.abs(rq.y0 + 24 * rk / 2) < 0.2], [true, true]);
check('clothes variants 1-3 draw Matt\'s three', [1, 2, 3].map((v) => (fx('clothes', { variant: v }).match(/stroke="#00A1C4"/g) || []).length > 0), [true, true, true]);
['washer', 'dryer', 'washer-dryer', 'water-heater', 'dishwasher', 'bed', 'nightstand', 'side-table', 'sofa', 'armchair', 'sectional', 'coffee-table', 'table', 'dining-table'].forEach((t) =>
  check('furniture ' + t + ' draws', /<g transform="translate/.test(fx(t)), true));
check('a twin bed has one pillow, a queen two', [fpaths('bed', { w: 38, h: 75 }), fpaths('bed', { w: 60, h: 80 })], [4, 5]);
check('a dining table for 6 has six of Matt\'s chairs', (fx('dining-table', { w: 72, h: 36, seats: 6 }).match(/<g transform="translate/g) || []).length - 1, 6);
check('a round table for 4 has four', (fx('dining-table', { w: 42, h: 42, shape: 'round' }).match(/<g transform="translate/g) || []).length - 1, 4);
/* chairs pull in under the table: each chair's centre is closer to the table's than its edge plus half a chair */
const chairAt = (svg) => [...svg.matchAll(/<g transform="translate\(([\d.-]+) ([\d.-]+)\) rotate/g)].map((m) => Math.hypot(+m[1], +m[2]));
const rt = fx('dining-table', { w: 42, h: 42, shape: 'round' }), half = +rt.match(/<\/g><path [^>]*d="M[^"]*A([\d.]+)/)[1], cdepth = half * SYM.chair.size[1] / SYM.chair.size[0];
check('…tucked under the round table, which is drawn over them', [chairAt(rt).length, chairAt(rt).every((d) => d < half + cdepth / 2 - cdepth * 0.25), /<\/g><path fill="#ffffff"[^>]*d="M[^"]*A/i.test(rt)], [4, true, true]);
/* a sofa's seat edge runs down one arm, along the back and down the other as one line, so its corners join */
check('a sofa\'s inner corners are joined', /d="M[\d. -]+L[\d. -]+L[\d. -]+L[\d. -]+"/.test(fx('sofa', { w: 84, h: 36 })), true);
check('a sectional\'s inner corner is joined', /d="M[\d. -]+L[\d. -]+L[\d. -]+"/.test(fx('sectional', { w: 110, h: 90 })), true);
p = clone(box4); p.levels[0].areas = [{ type: 'floor', pattern: 'tile', poly: [[0, 0], [50, 0], [50, 50], [0, 50]] }];
const tl = draw(p, 0, {});
check('a tiled floor uses the tile swatch, defined once', [tl.includes('fill="url(#fp-pat-tile)"'), tl.split('id="fp-pat-tile"').length - 1], [true, 1]);
check('no swatch, no pattern defs', /<pattern/.test(draw(box4, 0, {})), false);
p = clone(box4); p.levels[0].areas = [{ type: 'stair', poly: [[0, 0], [20, 0], [20, 80], [0, 80]], treads: 9, arrow: false, break: true }];
const stb = draw(p, 0, {});
const dottedPart = (stb.match(/stroke-dasharray="1 1" d="([^"]*)"/) || [, ''])[1];
check('a stair with a break: treads past it are dotted, the rest solid', [(dottedPart.match(/M/g) || []).length > 2, /stroke-width="0.5" d="M[^"]*"\/>/.test(stb)], [true, true]);
check('…past it is the way the arrow points', (() => { const q = clone(p); q.levels[0].areas[0].dir = [0, -1]; const m = draw(q, 0, {}).match(/stroke-dasharray="1 1" d="M[\d.]+ ([\d.]+)/); const m2 = stb.match(/stroke-dasharray="1 1" d="M[\d.]+ ([\d.]+)/); return +m[1] < +m2[1]; })(), true);

p = clone(box4); p.levels[0].openings = [{ wall: 0, from: 0.3, to: 0.7, type: 'bifold', side: 'right' }];
check('a bi-fold door draws its folded panels', /stroke-width="0.5" d="M[^"]*L[^"]*L[^"]*M/.test(draw(p, 0, {})), true);

/* a straight run's free end is run on half a wall at its own end point, with no extra point beside it */
p = clone(box4); p.levels[0].walls = [{ a: [0, 0], b: [100, 0], type: 'exterior' }, { a: [100, 0], b: [100, 60], type: 'exterior' }]; p.levels[0].openings = [];
const wallD = draw(p, 0, {}).match(/stroke-width="4"[^>]*d="([^"]*)"/)[1];
check('a corner of two walls is three points, its free ends run on', (wallD.match(/[ML]/g) || []).length, 3);

/* ---- the branded frame, as Matt lays it out ---- */
const br = (plan, facts) => draw(plan, 0, { branded: true, facts });
const hdr = (svg) => svg.slice(svg.indexOf('data-frame="header"'), svg.indexOf('</g></g>', svg.indexOf('data-frame="header"')));
p = clone(studio); p.job.address = '225 East 79th Street, Penthouse A';
const two = br(p, { beds: 3, baths: 3 });
check('a long address breaks at its last comma: street over unit, white, with the bar before the facts', [(hdr(two).match(/<path d=/g) || []).length, /<rect x="404.15"/.test(hdr(two))], [3, true]);
p.job.address = '401 East 89th Street, Floors 18, 19E';
const e89 = br(p, { beds: 4, baths: 3 }), e89h = hdr(e89);
check('it breaks at the first comma: 401 EAST 89TH STREET over FLOORS 18, 19E', [(e89h.match(/<path d=/g) || []).length, (() => {
  const ds = [...e89h.matchAll(/<path d="([^"]*)"/g)].map((m) => Math.max(...(m[1].match(/-?[\d.]+/g) || []).filter((_, i) => i % 2 === 0).map(Number)));
  return ds[1] < 389.5;   // the second address line ends left of the bar, clear of the facts
})()], [3, true]);
p.job.address = '929 Park Avenue, 4C';
check('a short address stays on one line', (hdr(br(p, { beds: 2, baths: 2 })).match(/<path d=/g) || []).length, 2);
p.job.address = '435 East 57th Street, 12B';
check('…and one that fits by starting further left (Matt\'s 435 E57)', (hdr(br(p, { beds: 2, baths: 2 })).match(/<path d=/g) || []).length, 2);
p.job.address = '929 Park Avenue, 4C';
check('half baths and the size make a second facts line', (hdr(br(p, { beds: 3, baths: 3, half: 1, sqft: 3369 })).match(/<path d=/g) || []).length, 3);
check('the header fades from cyan down to white', /linearGradient id="fp-header-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03A1C4"\/>.*stop-color="#FFFFFF"/.test(two), true);
check('no logo; the footer is the approx. note alone', [/data-frame="footer" fill="#00273a"><path d="[^"]*"\/><\/g>/.test(two), /scale\(/.test(two.slice(two.indexOf('data-frame="footer"')))], [true, false]);
p = clone(studio); p.layout = 'alternate';
check('an alternate says ALTERNATE bottom right; a current one with an alternate says CURRENT; otherwise nothing', [/data-frame="status"/.test(br(p)), (() => { const q = clone(studio); q.current = true; return /data-frame="status"/.test(br(q)); })(), /data-frame="status"/.test(br(studio))], [true, true, false]);
/* a wide plan (it fits by width) leaves the bottom centre empty */
p = clone(studio); p.north = 0; p.levels[0].walls = [{ a: [0, 0], b: [400, 0], type: 'exterior' }, { a: [400, 0], b: [400, 100], type: 'exterior' }, { a: [400, 100], b: [0, 100], type: 'exterior' }, { a: [0, 100], b: [0, 0], type: 'exterior' }];
p.levels[0].openings = []; p.levels[0].fixtures = []; p.levels[0].rooms = []; p.levels[0].labels = [];
const wide = clone(p);
const roseAt = (svg) => { const m = svg.match(/data-frame="compass" transform="translate\(([\d.-]+) ([\d.-]+)\)"><g transform="rotate\([\d.-]+ ([\d.-]+) ([\d.-]+)\)"/); return m && [Math.round(+m[1] + +m[3]), Math.round(+m[2] + +m[4])]; };
check('the compass sits at the bottom centre when that space is empty', roseAt(br(p)), [400, 554]);
p = clone(wide); p.north = 90;
check('its star turns to north; its N stays upright, beside the star (east of it when north is east)', (() => {
  const svg = br(p), m = svg.match(/data-frame="compass"[^>]*>(<g transform="rotate[^"]*">.*?<\/g>)<g transform="translate\(([\d.-]+) ([\d.-]+)\)">/);
  return !!m && !/rotate/.test(svg.slice(svg.indexOf(m[1]) + m[1].length, svg.indexOf('</g></g>', svg.indexOf('data-frame="compass"'))));
})(), true);
/* a T-shaped plan whose stem reaches into the bottom centre: the compass slides into the empty space beside
   the stem, under the bar, and the plan keeps its size */
p = clone(wide); p.levels[0].walls = [{ a: [0, 0], b: [300, 0], type: 'exterior' }, { a: [300, 0], b: [300, 80], type: 'exterior' }, { a: [300, 80], b: [180, 80], type: 'exterior' }, { a: [180, 80], b: [180, 200], type: 'exterior' },
  { a: [180, 200], b: [120, 200], type: 'exterior' }, { a: [120, 200], b: [120, 80], type: 'exterior' }, { a: [120, 80], b: [0, 80], type: 'exterior' }, { a: [0, 80], b: [0, 0], type: 'exterior' }];
p.levels[0].openings = []; p.levels[0].fixtures = []; p.levels[0].rooms = []; p.levels[0].labels = [];
const slid = br(p), sAt = roseAt(slid);
check('…and slides along the bottom into empty space beside the drawing', !!sAt && Math.abs(sAt[0] - 400) > 60 && sAt[1] === 554, true);
check('…the plan keeping its size and place', (() => { const q = clone(p); delete q.north; return slid.split('\n').filter((l) => !/data-frame="compass"/.test(l)).join('\n') === br(q); })(), true);
/* a plan filling the bottom edge to edge: no space beside it, so the plan stops above the compass */
p = clone(studio); p.north = 0; p.levels[0].walls = [{ a: [0, 0], b: [300, 0], type: 'exterior' }, { a: [300, 0], b: [300, 200], type: 'exterior' }, { a: [300, 200], b: [0, 200], type: 'exterior' }, { a: [0, 200], b: [0, 0], type: 'exterior' }];
p.levels[0].openings = []; p.levels[0].fixtures = []; p.levels[0].rooms = []; p.levels[0].labels = [];
check('…and when there is no such space, the plan stops above the compass at the bottom centre', roseAt(br(p)), [400, 554]);

/* an overhead cabinet's dashes run across the counter under it; a plain line stays under the fixtures */
p = clone(box4); p.levels[0].fixtures = [{ type: 'counter', at: [50, 40], w: 40, h: 10, rot: 0 }];
p.levels[0].lines = [{ pts: [[25, 40], [75, 40]], dash: true }, { pts: [[25, 38], [75, 38]] }];
check('dashed lines draw over the fixtures, plain ones under them', (() => { const t = draw(p, 0, {}), c = t.indexOf('<g transform="translate'), d = t.indexOf('stroke-dasharray'), l = t.search(/<path fill="none" stroke="#00273a" stroke-width="[\d.]+" d="M/); return [d > c, l > -1 && l < c]; })(), [true, true]);

/* a door given as points read off the source (hinge near its turning end, into a point in the room it
   opens into) draws exactly as the same door given by names */
p = clone(box4); p.levels[0].walls = []; p.levels[0].solids = [[[[0, 0], [100, 0], [100, 80], [0, 80]], [[6, 6], [94, 6], [94, 74], [6, 74]]]];
p.levels[0].openings = [{ type: 'door', a: [94, 30], b: [94, 50], t: 6, hinge: 'from', side: 'right' }];
const named = draw(p, 0, {});
p.levels[0].openings = [{ type: 'door', a: [94, 30], b: [94, 50], t: 6, hinge: [95, 29], into: [70, 40] }];
check('a door by points (hinge, into) is the door by names', [validate(p).errors, draw(p, 0, {}) === named], [[], true]);
p.levels[0].openings = [{ type: 'door', a: [94, 30], b: [94, 50], t: 6, hinge: [95, 51], into: [99, 40] }];
check('…its other hinge and side', draw(p, 0, {}) === (() => { const q = clone(p); q.levels[0].openings = [{ type: 'door', a: [94, 30], b: [94, 50], t: 6, hinge: 'to', side: 'left' }]; return draw(q, 0, {}); })(), true);
p.levels[0].openings = [{ type: 'door', a: [94, 30], b: [94, 50], t: 6, hinge: 'middle', into: 'room' }];
check('a hinge or into that is neither is an error', validate(p).errors.length, 2);
p = clone(box4); p.levels[0].openings = [{ wall: 1, from: 0.3, to: 0.6, type: 'door', hinge: [100, 25], into: [50, 40] }];
check('…and works for a door on a traced wall too', draw(p, 0, {}) === (() => { const q = clone(p); q.levels[0].openings = [{ wall: 1, from: 0.3, to: 0.6, type: 'door', hinge: 'from', side: 'right' }]; return draw(q, 0, {}); })(), true);

/* a window pane is filled white as one closed ring, so nothing under it (the header's fade) shows through */
p = clone(box4); p.levels[0].openings = [{ wall: 0, from: 0.3, to: 0.6, type: 'window' }];
check('a window pane is filled white, closed', /<path fill="#ffffff" d="M[^"MZ]*Z"\/>/i.test(draw(p, 0, {})), true);

/* a tub the source draws as a crossed box */
p = clone(box4); p.levels[0].fixtures = [{ type: 'tub', at: [50, 40], w: 30, h: 15, rot: 0, cross: true }];
check('a crossed tub validates, and draws its box crossed corner to corner, with no basin', [validate(p).errors, (() => { const t = draw(p, 0, {}).split('\n').find((l) => /^<g transform="translate/.test(l)) || ''; return [/A/.test(t), /d="M[-\d.]+ [-\d.]+L[-\d.]+ [-\d.]+M[-\d.]+ [-\d.]+L[-\d.]+ [-\d.]+"/.test(t)]; })()], [[], [false, true]]);

/* ---- walls traced from a picture: solids with holes, free openings across their gaps ---- */
p = clone(box4); p.levels[0].walls = []; p.levels[0].openings = [];
p.levels[0].solids = [[[[0, 0], [100, 0], [100, 80], [0, 80]], [[6, 6], [94, 6], [94, 74], [6, 74]]]];
p.levels[0].openings = [{ type: 'window', a: [30, 3], b: [60, 3], t: 6 }, { type: 'door', a: [94, 30], b: [94, 50], t: 6, hinge: 'from', side: 'right' }];
check('a free plan (wall masses, free openings) validates', validate(p).errors, []);
const ring = draw(p, 0, {});
check('a wall mass with a hole is filled even-odd', /fill="#00273a" fill-rule="evenodd" d="M[^"]*ZM[^"]*Z"/.test(ring), true);
check('a free window and a free door draw across their gaps', [(ring.match(/stroke-width="0.3"/g) || []).length >= 3, /A[\d.]+ [\d.]+ 0 0 [01] /.test(ring)], [true, true]);

/* ---- labels ---- */
p = clone(studio); p.levels[0].rooms = [{ name: 'LIVING\nROOM', size: '13\' x 24\'', at: [75, 120] }];
const lr = draw(p, 0, {});
const lg = lr.match(/<g data-label="LIVING\nROOM"[^>]*>(.*?)<\/g>/s);
check('a name with a line break prints on two lines, the size below, with typographic marks', [lg && (lg[1].match(/<path/g) || []).length, validate(p).errors], [3, []]);
p = clone(box4); p.levels[0].areas = [{ type: 'terrace', pattern: 'pavers', poly: [[0, 0], [50, 0], [50, 50], [0, 50]] }];
const pv = draw(p, 0, {});
check('a terrace is white; pavers lay the faint grid over it', [/fill="#ffffff" fill="none"|fill="#ffffff" [^>]*stroke/.test(pv), pv.includes('fill="url(#fp-pat-pavers)"')], [true, true]);

p = clone(box4); p.levels[0].lines = [{ pts: [[10, 10], [40, 10]], dash: true }, { pts: [[10, 30], [10, 60]], arrow: true }];
const dl2 = draw(p, 0, {});
check('a line can be dashed, and end in an arrowhead', [/stroke-dasharray="1.5 1" d="M/.test(dl2), /<path fill="#00273a" d="M[^"]*L[^"]*L[^"]*Z"\/>/.test(dl2), validate(p).errors], [true, true, []]);

p = clone(studio); p.layout = 'alternate'; p.levels[0].name = 'FLOOR 1';
check('one named floor of several: its name prints before ALTERNATE', /data-frame="status"/.test(br(p)) && validate(p).errors.length === 0, true);
p = clone(box4); p.levels[0].solids = [[[0, 0], [20, 0], [20, 20], [0, 20]], [[10, 10], [30, 10], [30, 30], [10, 30]]];
check('two overlapping solids add up: each is its own path', (draw(p, 0, {}).match(/fill-rule="evenodd"/g) || []).length, 2);
p = clone(box4); p.levels[0].fixtures = [{ type: 'counter', at: [50, 5], w: 60, h: 10, rot: 0 }];
const order = draw(p, 0, {});
check('fixtures lie under the walls, so a counter never hides one', order.indexOf('<g transform="translate') >= 0 && order.indexOf('stroke-width="4"') > order.indexOf('<g transform="translate'), true);

/* ---- the all-floors sheet: every floor at one scale, each named on the page ---- */
const twoFloors = (w1, h1, w2, h2, extra) => {
  const lv = (w, h, name) => ({ name, walls: [{ a: [0, 0], b: [w, 0], type: 'exterior' }, { a: [w, 0], b: [w, h], type: 'exterior' }, { a: [w, h], b: [0, h], type: 'exterior' }, { a: [0, h], b: [0, 0], type: 'exterior' }],
    rooms: [{ name: 'BEDROOM', size: "12' x 10'", at: [w / 2, h / 2] }] });
  return Object.assign({ schema: 1, job: { label: 'x', address: '225 East 79th Street, PHA' }, sources: [], north: 0, levels: [lv(w1, h1, 'MAIN LEVEL'), lv(w2, h2, 'LOWER LEVEL')] }, extra || {});
};
/* a floor's outside walls on the page: the first wall line in its group */
const levelBox = (svg, i) => { const g = svg.slice(svg.indexOf('data-level="' + i + '"')); const n = (g.match(/ d="(M[^"]*)"/)[1].match(/-?[\d.]+/g) || []).map(Number); const xs = n.filter((_, j) => j % 2 === 0), ys = n.filter((_, j) => j % 2); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
p = twoFloors(300, 200, 150, 120);
let all = drawAll(p, { branded: true });
check('both floors are drawn, each named, with the frame and the compass', [/data-level="1"/.test(all), /data-level="2"/.test(all), /data-frame="level-names"/.test(all), /data-frame="compass"/.test(all), /data-frame="footer"/.test(all)], [true, true, true, true, true]);
let b1 = levelBox(all, 1), b2 = levelBox(all, 2);
check('a wide floor and a small one sit in a row, bottoms lined up, at one scale', [b1[2] < b2[0], Math.abs(b1[3] - b2[3]) < 0.5, Math.abs((b1[2] - b1[0]) / 300 - (b2[2] - b2[0]) / 150) < 0.02], [true, true, true]);
check('each floor\'s name is one path, under its floor', (() => { const g = all.slice(all.indexOf('data-frame="level-names"')); return (g.slice(0, g.indexOf('</g>')).match(/<path/g) || []).length; })(), 2);
check('the validator takes the sheet field', [validate({ ...p, sheet: 'stagger' }).errors, validate({ ...p, sheet: 'grid' }).errors.length], [[], 1]);
p = twoFloors(300, 120, 300, 120);
all = drawAll(p, { branded: true }); b1 = levelBox(all, 1); b2 = levelBox(all, 2);
check('two long floors step from top left to bottom right, larger than a row would draw them', [b1[0] < b2[0], b1[1] < b2[1], (b1[2] - b1[0]) > (738 - 48) / 2], [true, true, true]);
p = twoFloors(300, 120, 300, 120, { sheet: 'row' });
all = drawAll(p, { branded: true }); b1 = levelBox(all, 1); b2 = levelBox(all, 2);
check('sheet: "row" keeps them in a row', b1[2] < b2[0] && Math.abs(b1[1] - b2[1]) < 0.5, true);
p = twoFloors(300, 200, 150, 120); p.levels[1].unitsPerFoot = 2; p.levels[0].unitsPerFoot = 1;
all = drawAll(p, { branded: true }); b1 = levelBox(all, 1); b2 = levelBox(all, 2);
check('unitsPerFoot draws floors traced at different scales at one scale', Math.abs((b1[2] - b1[0]) / 300 - 2 * (b2[2] - b2[0]) / 150) < 0.02, true);
p = twoFloors(300, 200, 150, 120); p.levels[0].rooms[0].box = [0, 0, 300, 200]; p.levels[0].rooms[0].size = "30' x 20'"; p.levels[1].rooms[0].box = [0, 0, 150, 120]; p.levels[1].rooms[0].size = "60' x 48'";
all = drawAll(p, { branded: true }); b1 = levelBox(all, 1); b2 = levelBox(all, 2);
check('…and without it, the rooms\' boxes and sizes say how many units make a foot', Math.abs(4 * (b1[2] - b1[0]) / 300 - (b2[2] - b2[0]) / 150) < 0.05, true);
p = twoFloors(300, 200, 150, 120);
all = drawAll(p, { branded: true }); const one = draw(p, 0, { branded: true });
check('the room text is a little smaller than on a floor\'s own sheet, never under 0.7 of it', (() => { const w = (svg) => { const g = svg.slice(svg.indexOf('<path', svg.indexOf('data-label="BEDROOM"'))); const xs = (g.slice(0, g.indexOf('</g>')).match(/-?[\d.]+/g) || []).map(Number).filter((_, j) => j % 2 === 0); return Math.max(...xs) - Math.min(...xs); }; const k = w(all) / w(one); return k < 1 && k >= 0.69; })(), true);
check('one floor alone is just its own sheet', drawAll(clone(studio), { branded: false }) === draw(clone(studio), 0, { branded: false }), true);

/* ---- report ---- */
if (failures.length) {
  console.log(failures.length + ' failed, ' + pass + ' passed\n');
  failures.forEach((f) => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
