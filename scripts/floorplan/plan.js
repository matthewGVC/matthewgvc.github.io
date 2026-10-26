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
       "walls":    [{ "a": [x,y], "b": [x,y], "type": "exterior|interior" }],
       "solids":   [ [[x,y], ...] ]                       filled polygons (columns, chimneys)
       "openings": [{ "wall": index, "from": 0-1, "to": 0-1, "type", "hinge": "from|to", "side": "left|right" }],
       "fixtures": [{ "type", "at": [x,y], "w", "h", "rot" }],
       "areas":    [{ "type", "poly": [[x,y], ...] }],
       "rooms":    [{ "name": "CAPITALS", "size": null | "12'0\" x 20'3\"", "at": [x,y], "rot",
                      "box": [x0,y0,x1,y1] optional — the room's extent in plan units;
                      only when present is the "label wider than its room" warning checked }],
       "labels":   [{ "text", "at": [x,y] }]
     }],
     "missing": [], "uncertain": []
   }
   ============================================================ */
'use strict';

const STYLE = require('./style.js');

const SCHEMA = 1;
const WALLS = ['exterior', 'interior'];
const OPENINGS = ['door', 'double-door', 'sliding', 'pocket', 'window', 'opening'];
const FIXTURES = ['toilet', 'sink', 'double-sink', 'tub', 'shower', 'range', 'kitchen-sink', 'fireplace', 'counter'];
const AREAS = ['terrace', 'balcony', 'closet', 'stair', 'void'];

const SIZE_RE = /^\d+'\d+(\.\d+)?" x \d+'\d+(\.\d+)?"$/;
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

/* every point a level draws: wall ends, solid corners, area corners */
function levelPoints(level) {
  const pts = [];
  (level.walls || []).forEach((w) => { if (isPt(w.a)) pts.push(w.a); if (isPt(w.b)) pts.push(w.b); });
  (level.solids || []).forEach((s) => (s || []).forEach((p) => { if (isPt(p)) pts.push(p); }));
  (level.areas || []).forEach((a) => ((a && a.poly) || []).forEach((p) => { if (isPt(p)) pts.push(p); }));
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
    });

    (level.solids || []).forEach((s, i) => {
      if (!Array.isArray(s) || s.length < 3 || !s.every(isPt)) errors.push(L + ' solid ' + (i + 1) + ': needs at least 3 [x, y] points');
    });

    (level.openings || []).forEach((o, i) => {
      const O = L + ' opening ' + (i + 1);
      if (!Number.isInteger(o.wall) || o.wall < 0 || o.wall >= walls.length) errors.push(O + ': no wall ' + o.wall);
      if (!OPENINGS.includes(o.type)) errors.push(O + ': unknown type "' + o.type + '"');
      if (!(Number.isFinite(o.from) && Number.isFinite(o.to) && o.from >= 0 && o.to <= 1 && o.from < o.to)) errors.push(O + ': from and to must satisfy 0 <= from < to <= 1');
    });

    (level.fixtures || []).forEach((f, i) => {
      const F = L + ' fixture ' + (i + 1);
      if (!FIXTURES.includes(f.type)) errors.push(F + ': unknown type "' + f.type + '"');
      if (!isPt(f.at)) errors.push(F + ': at must be [x, y]');
    });

    (level.areas || []).forEach((a, i) => {
      const A = L + ' area ' + (i + 1);
      if (!AREAS.includes(a.type)) errors.push(A + ': unknown type "' + a.type + '"');
      if (!Array.isArray(a.poly) || a.poly.length < 3 || !a.poly.every(isPt)) errors.push(A + ': poly needs at least 3 [x, y] points');
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
          const labelPt = r.name.length * 0.62 * STYLE.ROOM_NAME_PT;
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
  });

  return { errors, warnings };
}

module.exports = { SCHEMA, FIXTURES, OPENINGS, AREAS, WALLS, validate, fitScale };
