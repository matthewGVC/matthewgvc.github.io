/* ============================================================
   Tests for scripts/floorplan/draw.js — the floorplan drawer (SVG, text outlined).
   Plain Node:  node scripts/test-floorplan-draw.js
   ============================================================ */
'use strict';

const path = require('path');
const fontkit = require('fontkit');
const { draw } = require('./floorplan/draw.js');
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
check('a window on a curved wall follows the curve', (draw(p, 0, {}).match(/stroke-width="0.5" d="M[^"]*A[^"]*A/) || []).length, 1);
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
  const m = draw(q, 0, {}).match(/fill="#ffffff" stroke="#00273a" stroke-width="0.5" d="M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)"/);
  return Math.round(Math.atan2(-(+m[4] - +m[2]), +m[3] - +m[1]) * 180 / Math.PI);
};
check('a door to the outside stands at ' + STYLE.DOOR_OPEN_OUTSIDE + '°', leafAngle(true), STYLE.DOOR_OPEN_OUTSIDE);
check('an inside door stands at ' + STYLE.DOOR_OPEN_INSIDE + '°', leafAngle(undefined), STYLE.DOOR_OPEN_INSIDE);

/* ---- the style sheet: every element in its own named group ---- */
const { sheet, ELEMENTS } = require('./floorplan/style-sheet.js');
const sh = sheet();
check('style sheet: one group per element, plus the branded frame', ELEMENTS.map(([id]) => sh.includes('<g id="' + id + '">')).filter((x) => !x).length, 0);
check('style sheet: every element draws something', ELEMENTS.filter(([id]) => /<g id="[^"]*"><\/g>/.test(sh.slice(sh.indexOf('<g id="' + id + '">'), sh.indexOf('<g id="' + id + '">') + id.length + 20))).length, 0);
check('style sheet: has the frame and the four layers', ['frame-branded-page', 'GUIDES', 'ELEMENTS', 'CAPTIONS', 'NOTES'].every((id) => sh.includes('id="' + id + '"')), true);

/* ---- report ---- */
if (failures.length) {
  console.log(failures.length + ' failed, ' + pass + ' passed\n');
  failures.forEach((f) => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
