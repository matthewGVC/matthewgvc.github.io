/* ============================================================
   The floorplan style sheet: every element the drawer can make (walls, windows, doors, fixtures, areas,
   labels and the branded frame), drawn by draw.js itself at true size, each in its own named group.
   Matt edits it in Illustrator and hands it back; the changes are then made in draw.js / style.js.

     node scripts/floorplan/style-sheet.js "<out.svg>"

   Elements are drawn at 8 pt to the foot (about the scale of a one-bedroom plan on the 810 x 630 pt
   sheet), so line weights and text sizes are exactly what a plan prints. Group ids name the element and
   the plan.json field that draws it; the CAPTIONS and GUIDES layers are only for reading the sheet.
   ============================================================ */
'use strict';

const fs = require('fs');
const STYLE = require('./style.js');
const { draw, drawLevel } = require('./draw.js');

const S = 8 / 12;                  // pt per plan unit: plan units are inches, 8 pt to the foot
const CELL = { w: 150, h: 120 };   // pt
const COLS = 8, X0 = 36, Y0 = 150;
const r2 = (v) => Math.round(v * 100) / 100;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* each element: id, caption, and the level that draws it (inches, centred on 0,0) */
const ext = (a, b) => ({ a, b, type: 'exterior' });
const int = (a, b) => ({ a, b, type: 'interior' });
const fixture = (type, w, h, extra) => ({ fixtures: [Object.assign({ type, at: [0, 0], w, h, rot: 0 }, extra || {})] });
const ELEMENTS = [
  /* walls and windows */
  ['wall-exterior', 'Exterior wall ' + STYLE.WALL_EXTERIOR + ' pt (corner)', { walls: [ext([-60, -40], [60, -40]), ext([60, -40], [60, 50])] }],
  ['wall-interior', 'Interior wall ' + STYLE.WALL_INTERIOR + ' pt (corner)', { walls: [int([-60, -40], [60, -40]), int([60, -40], [60, 50])] }],
  ['wall-glass', 'Glass wall ' + STYLE.WALL_GLASS + ' pt', { walls: [{ a: [-60, 0], b: [60, 0], type: 'glass' }] }],
  ['wall-junction', 'Interior meeting exterior (T)', { walls: [ext([-70, -40], [70, -40]), int([0, -40], [0, 50])] }],
  ['wall-solid', 'Column / chimney mass (solids)', { walls: [ext([-70, -40], [70, -40])], solids: [[[-20, -40], [20, -40], [20, 0], [-20, 0]]] }],
  ['wall-curved-window', 'Curved wall, all window', { walls: [{ a: [-60, 40], b: [40, -60], type: 'exterior', via: [-60 + 100 * (1 - Math.SQRT1_2), -60 + 100 * (1 - Math.SQRT1_2)] }],
    openings: [{ wall: 0, from: 0, to: 1, type: 'window' }] }],
  ['window', 'Windows, two panes (mullion)', { walls: [ext([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.15, to: 0.5, type: 'window' }, { wall: 0, from: 0.5, to: 0.85, type: 'window' }] }],
  ['opening', 'Plain opening', { walls: [int([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.3, to: 0.7, type: 'opening' }] }],
  /* doors */
  ['door-inside', 'Door, inside: ' + STYLE.DOOR_OPEN_INSIDE + '°', { walls: [int([-70, 20], [70, 20])], openings: [{ wall: 0, from: 0.37, to: 0.63, type: 'door', hinge: 'from', side: 'left' }] }],
  ['door-outside', 'Door to outside: ' + STYLE.DOOR_OPEN_OUTSIDE + '°', { walls: [ext([-70, 20], [70, 20])], openings: [{ wall: 0, from: 0.36, to: 0.64, type: 'door', hinge: 'from', side: 'left', outside: true }] }],
  ['double-door-inside', 'Double door, inside', { walls: [int([-80, 20], [80, 20])], openings: [{ wall: 0, from: 0.3, to: 0.7, type: 'double-door', side: 'left' }] }],
  ['double-door-outside', 'Double door to outside', { walls: [ext([-80, 20], [80, 20])], openings: [{ wall: 0, from: 0.3, to: 0.7, type: 'double-door', side: 'left', outside: true }] }],
  ['door-sliding', 'Sliding door', { walls: [ext([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.25, to: 0.75, type: 'sliding' }] }],
  ['door-pocket', 'Pocket door (part open)', { walls: [int([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.2, to: 0.5, type: 'pocket', hinge: 'to' }] }],
  /* bath */
  ['fixture-toilet', 'Toilet 20 × 28 in', { walls: [int([-40, -14], [40, -14])], ...fixture('toilet', 20, 28) }],
  ['fixture-sink', 'Vanity sink 30 × 21 in', { walls: [int([-40, -10.5], [40, -10.5])], ...fixture('sink', 30, 21) }],
  ['fixture-round-sink', 'Round sink 18 in', { walls: [int([-40, -9], [40, -9])], ...fixture('round-sink', 18, 18) }],
  ['fixture-double-sink', 'Double vanity 60 × 22 in', { walls: [int([-50, -11], [50, -11])], ...fixture('double-sink', 60, 22) }],
  ['fixture-tub', 'Tub 60 × 30 in', { ...fixture('tub', 60, 30) }],
  ['fixture-shower', 'Shower 36 × 36 in', { ...fixture('shower', 36, 36) }],
  /* kitchen and more */
  ['fixture-range', 'Range 30 × 26 in', { walls: [int([-40, -13], [40, -13])], ...fixture('range', 30, 26) }],
  ['fixture-kitchen-sink-1', 'Kitchen sink, one bowl 30 × 22 in', { ...fixture('kitchen-sink', 30, 22, { bowls: 1 }) }],
  ['fixture-kitchen-sink-2', 'Kitchen sink, two bowls 33 × 22 in', { ...fixture('kitchen-sink', 33, 22) }],
  ['fixture-refrigerator', 'Refrigerator 36 × 30 in', { walls: [int([-40, -15], [40, -15])], ...fixture('refrigerator', 36, 30) }],
  ['fixture-counter', 'Counter / cabinet / island', { ...fixture('counter', 72, 25) }],
  ['fixture-fireplace', 'Fireplace 48 × 20 in', { walls: [ext([-60, -22], [60, -22])], solids: [[[-40, -22], [40, -22], [40, 10], [24, 10], [15.36, -10], [-15.36, -10], [-24, 10], [-40, 10]]], ...fixture('fireplace', 48, 20) }],
  ['fixture-rod', 'Closet rod and hangers', { ...fixture('rod', 72, 20) }],
  ['line-built-in', 'Thin linework (lines)', { lines: [{ pts: [[-50, -10], [50, -10], [50, 10], [-50, 10]], closed: true }] }],
  /* areas */
  ['area-terrace', 'Terrace / balcony', { areas: [{ type: 'terrace', poly: [[-80, -45], [80, -45], [80, 45], [-80, 45]] }] }],
  ['area-closet', 'Closet / built-in, dashed', { areas: [{ type: 'closet', poly: [[-50, -25], [50, -25], [50, 25], [-50, 25]] }] }],
  ['area-stair', 'Stair, 10 treads, arrow', { areas: [{ type: 'stair', poly: [[-25, -75], [25, -75], [25, 75], [-25, 75]], treads: 10, dir: [0, -1] }] }],
  ['area-void', 'Void / open to below', { areas: [{ type: 'void', poly: [[-50, -35], [50, -35], [50, 35], [-50, 35]] }] }],
  /* labels */
  ['label-room', 'Room name over size', { rooms: [{ name: 'LIVING ROOM', size: '12\'0" x 20\'3"', at: [0, 0] }] }],
  ['label-room-name-only', 'Room name, no size', { rooms: [{ name: 'BATH', at: [0, 0] }] }],
  ['label-small', 'Small labels', { labels: [{ text: 'CL', at: [-45, 0] }, { text: 'W/D', at: [0, 0] }, { text: 'REF', at: [45, 0] }] }],
  ['label-rotated', 'Room name in a narrow room (rot 90)', { rooms: [{ name: 'HALL', at: [0, 0], rot: -90 }] }]
];

function sheet() {
  const rows = Math.ceil(ELEMENTS.length / COLS);
  const frameY = Y0 + rows * CELL.h + 50;
  const W = X0 * 2 + COLS * CELL.w, H = frameY + STYLE.PAGE.h + 50;
  const groups = [], captions = [], guides = [];
  ELEMENTS.forEach(([id, caption, level], i) => {
    const x = X0 + (i % COLS) * CELL.w, y = Y0 + Math.floor(i / COLS) * CELL.h;
    const cx = x + CELL.w / 2, cy = y + (CELL.h - 18) / 2;
    const T = (p) => [cx + p[0] * S, cy + p[1] * S];
    groups.push('<g id="' + id + '">' + drawLevel(Object.assign({ name: null }, level), T, S) + '</g>');
    guides.push('<rect x="' + x + '" y="' + y + '" width="' + CELL.w + '" height="' + CELL.h + '" fill="none" stroke="#c9d1d6" stroke-width="0.5" stroke-dasharray="2 2"/>');
    captions.push('<text x="' + (x + 6) + '" y="' + (y + CELL.h - 7) + '">' + esc(caption) + '</text>');
  });

  /* the branded frame: a whole small plan, as a plan prints */
  const studio = JSON.parse(fs.readFileSync(require.resolve('./fixtures/studio.json'), 'utf8'));
  studio.north = 0;
  const page = draw(studio, 0, { branded: true, facts: { beds: 0, baths: 1 } }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  groups.push('<g id="frame-branded-page" transform="translate(' + X0 + ' ' + frameY + ')">' + page + '</g>');
  guides.push('<rect x="' + X0 + '" y="' + frameY + '" width="' + STYLE.PAGE.w + '" height="' + STYLE.PAGE.h + '" fill="none" stroke="#c9d1d6" stroke-width="0.5"/>');
  captions.push('<text x="' + X0 + '" y="' + (frameY - 8) + '">Branded frame (header, logo, footer, compass), on a full 810 × 630 pt plan sheet</text>');

  const notes = [
    'GVC floorplan style sheet. Every element exactly as the drawing script makes it, at true size (8 pt to the foot).',
    'Edit any shape inside its group: line weights, shapes, sizes, positions. Keep the group names. Don\'t scale the whole page.',
    'Write any notes as text in the NOTES layer. Save as SVG (Illustrator: SVG 1.1, Styling: Presentation Attributes) and send it back.'
  ].map((t, i) => '<text x="' + X0 + '" y="' + (48 + i * 16) + '">' + esc(t) + '</text>');

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">\n' +
    '<rect id="background" x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>\n' +
    '<g id="GUIDES">' + guides.join('') + '</g>\n' +
    '<g id="ELEMENTS">\n' + groups.join('\n') + '\n</g>\n' +
    '<g id="CAPTIONS" font-family="Nunito Sans, Arial, sans-serif" font-size="7" fill="#5b6b75">' + captions.join('') + '</g>\n' +
    '<g id="NOTES" font-family="Nunito Sans, Arial, sans-serif" font-size="11" fill="#00273a">' + notes.join('') + '</g>\n' +
    '</svg>\n';
}

module.exports = { sheet, ELEMENTS };

if (require.main === module) {
  const out = process.argv[2];
  if (!out) { console.error('Usage: node scripts/floorplan/style-sheet.js "<out.svg>"'); process.exit(1); }
  fs.writeFileSync(out, sheet());
  console.log('Style sheet saved to ' + out + ' (' + ELEMENTS.length + ' elements and the branded frame)');
}
