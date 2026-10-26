/* ============================================================
   The floorplan plan description (plan.json) and its validator.

   Coordinates are in any consistent unit; the drawer fits them to the page.
   {
     "schema": 1,
     "job": { "label", "address" },
     "sources": [{ "file", "kind", "note" }],
     "north": null | degrees clockwise from page-up,
     "levels": [{
       "name": null | "LOWER LEVEL"   (every level must be named when there are several)
       "walls":    [{ "a": [x,y], "b": [x,y], "type": "exterior|interior|glass", "via": [x,y] optional }],
                     via: a point the wall passes through between a and b; the wall is then the circular
                     arc through a, via and b (only windows and plain openings may sit on an arc)
       "solids":   [ [[x,y], ...] ]                       filled polygons (columns, chimneys)
       "openings": [{ "wall": index, "from": 0-1, "to": 0-1, "type", "hinge": "from|to", "side": "left|right",
                      "outside": true for a door to a terrace, balcony or the hall (drawn fully open) }],
       "fixtures": [{ "type", "at": [x,y], "w", "h", "rot", "bowls": 1|2 (kitchen-sink) }],
                     rot 0: the wall the fixture backs onto is at the top
       "areas":    [{ "type", "poly": [[x,y], ...], "pattern": "tile|brick-patio|brick-roof",
                      stair only: "treads", "dir", "arrow": false, "break": true | 0-1 }],
       "rooms":    [{ "name": "CAPITALS", "size": null | "12'0\" x 20'3\"", "at": [x,y], "rot",
                      "box": [x0,y0,x1,y1] optional — the room's extent in plan units;
                      only when present is the "label wider than its room" warning checked }],
       "labels":   [{ "text", "at": [x,y] }],
       "lines":    [{ "pts": [[x,y], ...], "closed": bool }]   thin linework the fixed set doesn't cover:
                                                               cabinet and built-in outlines, stair winders
     }],
     "missing": [], "uncertain": []
   }
   ============================================================ */
'use strict';

const STYLE = require('./style.js');

const SCHEMA = 1;
const WALLS = ['exterior', 'interior', 'glass'];
const OPENINGS = ['door', 'double-door', 'sliding', 'pocket', 'bifold', 'window', 'opening'];
const FIXTURES = ['toilet', 'sink', 'round-sink', 'double-sink', 'tub', 'shower', 'range', 'kitchen-sink', 'refrigerator', 'fireplace', 'counter', 'rod',
  'washer', 'dryer', 'washer-dryer', 'water-heater', 'dishwasher',
  'lounge-chair', 'car', 'clothes',
  'bed', 'nightstand', 'side-table', 'sofa', 'armchair', 'sectional', 'coffee-table', 'table', 'dining-table'];
const PATTERNS = ['tile', 'brick-patio', 'brick-roof'];
const AREAS = ['terrace', 'balcony', 'closet', 'stair', 'void', 'floor', 'roof'];

const SIZE_RE = /^\d+'\d+(\.\d+)?" x \d+'\d+(\.\d+)?"$/;
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

/* The circular arc through a, via and b: { c, r, a0, sweep } with angles in radians (y down, so a positive
   sweep turns clockwise on the page). null when the three points are in a line. */
function arcOf(a, b, via) {
  const d = 2 * (a[0] * (via[1] - b[1]) + via[0] * (b[1] - a[1]) + b[0] * (a[1] - via[1]));
  if (Math.abs(d) < 1e-9) return null;
  const sq = (p) => p[0] * p[0] + p[1] * p[1];
  const c = [(sq(a) * (via[1] - b[1]) + sq(via) * (b[1] - a[1]) + sq(b) * (a[1] - via[1])) / d,
    (sq(a) * (b[0] - via[0]) + sq(via) * (a[0] - b[0]) + sq(b) * (via[0] - a[0])) / d];
  const ang = (p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const TAU = 2 * Math.PI, norm = (x) => ((x % TAU) + TAU) % TAU;
  const a0 = ang(a), toB = norm(ang(b) - a0), toV = norm(ang(via) - a0);
  const sweep = toV < toB ? toB : toB - TAU;   // turn the way that passes through via
  return { c, r: Math.hypot(a[0] - c[0], a[1] - c[1]), a0, sweep };
}
const arcPoint = (arc, t) => [arc.c[0] + arc.r * Math.cos(arc.a0 + arc.sweep * t), arc.c[1] + arc.r * Math.sin(arc.a0 + arc.sweep * t)];

/* every point a level draws: wall ends, solid corners, area corners */
function levelPoints(level) {
  const pts = [];
  (level.walls || []).forEach((w) => {
    if (isPt(w.a)) pts.push(w.a);
    if (isPt(w.b)) pts.push(w.b);
    const arc = isPt(w.a) && isPt(w.b) && isPt(w.via) ? arcOf(w.a, w.b, w.via) : null;
    if (arc) for (let i = 1; i < 16; i++) pts.push(arcPoint(arc, i / 16));
  });
  (level.solids || []).forEach((s) => (s || []).forEach((p) => { if (isPt(p)) pts.push(p); }));
  (level.areas || []).forEach((a) => ((a && a.poly) || []).forEach((p) => { if (isPt(p)) pts.push(p); }));
  /* a door to the outside stands fully open, often past the walls: its swing is part of the drawing */
  (level.openings || []).forEach((o) => {
    const w = (level.walls || [])[o && o.wall];
    if (!o || !o.outside || !['door', 'double-door'].includes(o.type) || !w || !isPt(w.a) || !isPt(w.b) || isPt(w.via)) return;
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    if (!L) return;
    const d = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], left = [d[1], -d[0]], k = o.side === 'right' ? -1 : 1;
    const at = (t) => [w.a[0] + (w.b[0] - w.a[0]) * t, w.a[1] + (w.b[1] - w.a[1]) * t];
    const leaves = o.type === 'double-door' ? [[o.from, (o.from + o.to) / 2], [o.to, (o.from + o.to) / 2]] : [o.hinge === 'to' ? [o.to, o.from] : [o.from, o.to]];
    leaves.forEach(([h, f]) => {
      const hp = at(h), r = Math.abs(f - h) * L, dir = h < f ? 1 : -1;
      for (let i = 1; i <= 8; i++) {
        const q = (i / 8) * Math.PI / 2;
        pts.push([hp[0] + (d[0] * dir * Math.cos(q) + left[0] * k * Math.sin(q)) * r, hp[1] + (d[1] * dir * Math.cos(q) + left[1] * k * Math.sin(q)) * r]);
      }
    });
  });
  return pts;
}

/* the uniform scale that fits the level's bounding box inside box, keeping aspect */
function fitScale(level, box) {
  const pts = levelPoints(level);
  if (!pts.length) return 1;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
  const sx = w > 0 ? bw / w : Infinity, sy = h > 0 ? bh / h : Infinity;
  const s = Math.min(sx, sy);
  return Number.isFinite(s) ? s : 1;
}

function validate(plan) {
  const errors = [], warnings = [];
  if (!plan || typeof plan !== 'object') return { errors: ['plan must be an object'], warnings };
  if (plan.schema !== SCHEMA) errors.push('schema must be ' + SCHEMA);
  if (plan.north !== null && plan.north !== undefined && !Number.isFinite(plan.north)) errors.push('north must be a number of degrees or null');
  if (!Array.isArray(plan.levels) || !plan.levels.length) {
    errors.push('plan needs at least one level');
    return { errors, warnings };
  }

  plan.levels.forEach((level, li) => {
    const L = 'level ' + (li + 1);
    if (plan.levels.length > 1 && !level.name) errors.push(L + ': a plan with several levels needs every level named');
    const walls = level.walls || [];

    walls.forEach((w, i) => {
      const W = L + ' wall ' + (i + 1);
      if (!isPt(w.a) || !isPt(w.b)) errors.push(W + ': a and b must each be [x, y]');
      if (!WALLS.includes(w.type)) errors.push(W + ': unknown type "' + w.type + '"');
      if (w.via !== undefined && (!isPt(w.via) || (isPt(w.a) && isPt(w.b) && !arcOf(w.a, w.b, w.via)))) errors.push(W + ': via must be [x, y], off the line from a to b');
    });

    (level.solids || []).forEach((s, i) => {
      if (!Array.isArray(s) || s.length < 3 || !s.every(isPt)) errors.push(L + ' solid ' + (i + 1) + ': needs at least 3 [x, y] points');
    });

    (level.openings || []).forEach((o, i) => {
      const O = L + ' opening ' + (i + 1);
      if (!Number.isInteger(o.wall) || o.wall < 0 || o.wall >= walls.length) errors.push(O + ': no wall ' + o.wall);
      if (!OPENINGS.includes(o.type)) errors.push(O + ': unknown type "' + o.type + '"');
      if (OPENINGS.includes(o.type) && walls[o.wall] && walls[o.wall].via !== undefined && !['window', 'opening'].includes(o.type)) errors.push(O + ': only a window or an opening can sit on a curved wall');
      if (o.outside !== undefined && typeof o.outside !== 'boolean') errors.push(O + ': outside must be true or false');
      if (!(Number.isFinite(o.from) && Number.isFinite(o.to) && o.from >= 0 && o.to <= 1 && o.from < o.to)) errors.push(O + ': from and to must satisfy 0 <= from < to <= 1');
    });

    (level.fixtures || []).forEach((f, i) => {
      const F = L + ' fixture ' + (i + 1);
      if (!FIXTURES.includes(f.type)) errors.push(F + ': unknown type "' + f.type + '"');
      if (!isPt(f.at)) errors.push(F + ': at must be [x, y]');
      if (!(f.w > 0) || !(f.h > 0)) errors.push(F + ': w and h must be more than 0');
      if (f.bowls !== undefined && f.bowls !== 1 && f.bowls !== 2) errors.push(F + ': bowls must be 1 or 2');
      if (f.burners !== undefined && f.burners !== 4 && f.burners !== 6) errors.push(F + ': burners must be 4 or 6');
      if (f.griddle !== undefined && typeof f.griddle !== 'boolean') errors.push(F + ': griddle must be true or false');
      if (f.variant !== undefined && ![1, 2, 3].includes(f.variant)) errors.push(F + ': variant must be 1, 2 or 3');
      if (f.seats !== undefined && !(Number.isInteger(f.seats) && f.seats >= 1 && f.seats <= 12)) errors.push(F + ': seats must be a whole number from 1 to 12');
      if (f.shape !== undefined && f.shape !== 'rect' && f.shape !== 'round') errors.push(F + ': shape must be "rect" or "round"');
    });

    (level.areas || []).forEach((a, i) => {
      const A = L + ' area ' + (i + 1);
      if (!AREAS.includes(a.type)) errors.push(A + ': unknown type "' + a.type + '"');
      if (!Array.isArray(a.poly) || a.poly.length < 3 || !a.poly.every(isPt)) errors.push(A + ': poly needs at least 3 [x, y] points');
      if (a.pattern !== undefined && !PATTERNS.includes(a.pattern)) errors.push(A + ': unknown pattern "' + a.pattern + '"');
      if (a.break !== undefined && a.break !== true && a.break !== false && !(Number.isFinite(a.break) && a.break > 0 && a.break < 1)) errors.push(A + ': break must be true or a number between 0 and 1');
    });

    const scale = fitScale(level, STYLE.BOX_UNBRANDED);
    (level.rooms || []).forEach((r, i) => {
      const R = L + ' room "' + r.name + '"';
      if (typeof r.name !== 'string' || !r.name.trim()) { errors.push(L + ' room ' + (i + 1) + ': needs a name'); return; }
      if (r.name !== r.name.toUpperCase()) errors.push(R + ': name must be in capitals');
      if (r.size !== null && r.size !== undefined && !SIZE_RE.test(r.size)) errors.push(R + ': size must look like 12\'0" x 20\'3"');
      if (!isPt(r.at)) errors.push(R + ': at must be [x, y]');
      if (r.box !== undefined) {
        if (!Array.isArray(r.box) || r.box.length !== 4 || !r.box.every(Number.isFinite)) {
          errors.push(R + ': box must be [x0, y0, x1, y1]');
        } else {
          const labelPt = r.name.length * STYLE.LABEL_EM * STYLE.ROOM_NAME_PT;
          const roomPt = (r.box[2] - r.box[0]) * scale;
          if (labelPt > roomPt) warnings.push(R + ': label is wider than its room');
        }
      }
    });

    (level.labels || []).forEach((t, i) => {
      const T = L + ' label ' + (i + 1);
      if (typeof t.text !== 'string' || !t.text) errors.push(T + ': needs text');
      if (!isPt(t.at)) errors.push(T + ': at must be [x, y]');
    });

    (level.lines || []).forEach((l, i) => {
      if (!l || !Array.isArray(l.pts) || l.pts.length < 2 || !l.pts.every(isPt)) errors.push(L + ' line ' + (i + 1) + ': pts needs at least 2 [x, y] points');
    });
  });

  return { errors, warnings };
}

module.exports = { SCHEMA, FIXTURES, OPENINGS, AREAS, WALLS, PATTERNS, validate, fitScale, levelPoints, arcOf, arcPoint };
