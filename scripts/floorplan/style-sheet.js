/* ============================================================
   The floorplan style sheet: every element the drawer can make (walls, windows, doors, fixtures, areas,
   labels and the branded frame), drawn by draw.js itself at true size, each in its own named group.
   Matt edits it in Illustrator and hands it back; the changes are then made in draw.js / style.js.

     node scripts/floorplan/style-sheet.js "<out.svg>"

   Cells named symbol-<name> show one of Matt's own symbols (symbols.json) alone, at true size and wall
   side up; edit one and import-symbols.js reads it straight back.
   Elements are drawn at 8 pt to the foot (about the scale of a one-bedroom plan on the 810 x 630 pt
   sheet), so line weights and text sizes are exactly what a plan prints. Group ids name the element and
   the plan.json field that draws it; the CAPTIONS and GUIDES layers are only for reading the sheet.
   ============================================================ */
'use strict';

const fs = require('fs');
const STYLE = require('./style.js');
const { draw, drawLevel, drawSymbol, SYMBOLS, patternDefs, PATTERNS } = require('./draw.js');

const S = 8 / 12;                  // pt per plan unit: plan units are inches, 8 pt to the foot
const CELL = { w: 150, h: 120 };   // pt
const COLS = 8, X0 = 36, Y0 = 130;
const r2 = (v) => Math.round(v * 100) / 100;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* the sheet, section by section. Each element: [id, caption, level drawn in inches centred on 0,0];
   a level of null is an empty box for Matt to draw in. */
const ext = (a, b) => ({ a, b, type: 'exterior' });
const int = (a, b) => ({ a, b, type: 'interior' });
const fixture = (type, w, h, extra) => ({ fixtures: [Object.assign({ type, at: [0, 0], w, h, rot: 0 }, extra || {})] });
const onWall = (type, w, h, extra) => ({ walls: [int([-Math.max(40, w / 2 + 10), -h / 2], [Math.max(40, w / 2 + 10), -h / 2])], ...fixture(type, w, h, extra) });
const box = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
/* a cell showing one of Matt's symbols on its own, at its true size and wall side up: its group is named
   symbol-<name>, which is how import-symbols.js reads it back */
const mine = (name, type, extra) => fixture(type || name, SYMBOLS[name].size[0], SYMBOLS[name].size[1], extra);
const SECTIONS = [
  ['Walls and openings', [
    ['wall-exterior', 'Exterior wall ' + STYLE.WALL_EXTERIOR + ' pt (corner)', { walls: [ext([-60, -40], [60, -40]), ext([60, -40], [60, 50])] }],
    ['wall-interior', 'Interior wall ' + STYLE.WALL_INTERIOR + ' pt (corner)', { walls: [int([-60, -40], [60, -40]), int([60, -40], [60, 50])] }],
    ['wall-glass', 'Glass wall ' + STYLE.WALL_GLASS + ' pt', { walls: [{ a: [-60, 0], b: [60, 0], type: 'glass' }] }],
    ['wall-junction', 'Interior meeting exterior (T)', { walls: [ext([-70, -40], [70, -40]), int([0, -40], [0, 50])] }],
    ['wall-solid', 'Column / chimney mass (solids)', { walls: [ext([-70, -40], [70, -40])], solids: [[[-20, -40], [20, -40], [20, 0], [-20, 0]]] }],
    ['wall-curved-window', 'Curved wall, all window', { walls: [{ a: [-60, 40], b: [40, -60], type: 'exterior', via: [-60 + 100 * (1 - Math.SQRT1_2), -60 + 100 * (1 - Math.SQRT1_2)] }],
      openings: [{ wall: 0, from: 0, to: 1, type: 'window' }] }],
    ['window', 'Windows, two panes (mullion)', { walls: [ext([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.15, to: 0.5, type: 'window' }, { wall: 0, from: 0.5, to: 0.85, type: 'window' }] }],
    ['opening', 'Plain opening', { walls: [int([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.3, to: 0.7, type: 'opening' }] }]
  ]],
  ['Doors', [
    ['door-inside', 'Door, inside: ' + STYLE.DOOR_OPEN_INSIDE + '°', { walls: [int([-70, 20], [70, 20])], openings: [{ wall: 0, from: 0.37, to: 0.63, type: 'door', hinge: 'from', side: 'left' }] }],
    ['door-outside', 'Door to outside: ' + STYLE.DOOR_OPEN_OUTSIDE + '°', { walls: [ext([-70, 20], [70, 20])], openings: [{ wall: 0, from: 0.36, to: 0.64, type: 'door', hinge: 'from', side: 'left', outside: true }] }],
    ['double-door-inside', 'Double door, inside', { walls: [int([-80, 20], [80, 20])], openings: [{ wall: 0, from: 0.3, to: 0.7, type: 'double-door', side: 'left' }] }],
    ['double-door-outside', 'Double door to outside', { walls: [ext([-80, 20], [80, 20])], openings: [{ wall: 0, from: 0.3, to: 0.7, type: 'double-door', side: 'left', outside: true }] }],
    ['door-sliding', 'Sliding door', { walls: [ext([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.25, to: 0.75, type: 'sliding' }] }],
    ['door-pocket', 'Pocket door (part open)', { walls: [int([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.2, to: 0.5, type: 'pocket', hinge: 'to' }] }],
    ['door-bifold', 'Bi-fold door (closets)', { walls: [int([-80, 0], [80, 0])], openings: [{ wall: 0, from: 0.25, to: 0.75, type: 'bifold', side: 'right' }] }]
  ]],
  ['Bath', [
    ['symbol-toilet', 'Toilet (Matt\'s), tank to the wall', mine('toilet')],
    ['fixture-sink', 'Vanity sink 30 × 21 in', onWall('sink', 30, 21)],
    ['fixture-round-sink', 'Round sink 18 in', onWall('round-sink', 18, 18)],
    ['fixture-double-sink', 'Double vanity 60 × 22 in', onWall('double-sink', 60, 22)],
    ['fixture-tub', 'Tub 60 × 30 in', fixture('tub', 60, 30)],
    ['fixture-shower', 'Shower, square 36 × 36 in', fixture('shower', 36, 36)],
    ['fixture-shower-rect', 'Shower, rectangular 60 × 32 in', fixture('shower', 60, 32)]
  ]],
  ['Kitchen and built-ins', [
    ['symbol-range-4', 'Range, 4 burners (Matt\'s) 30 in', mine('range-4', 'range')],
    ['symbol-range-6', 'Range, 6 burners (Matt\'s) 36 in', mine('range-6', 'range', { burners: 6 })],
    ['symbol-range-6-griddle', 'Range, 6 burners + griddle (Matt\'s) 48 in', mine('range-6-griddle', 'range', { burners: 6, griddle: true })],
    ['fixture-kitchen-sink-1', 'Kitchen sink, one bowl 30 × 22 in', fixture('kitchen-sink', 30, 22, { bowls: 1 })],
    ['fixture-kitchen-sink-2', 'Kitchen sink, two bowls 33 × 22 in', fixture('kitchen-sink', 33, 22)],
    ['fixture-refrigerator', 'Refrigerator 36 × 30 in', onWall('refrigerator', 36, 30)],
    ['fixture-counter', 'Counter / cabinet / island', fixture('counter', 72, 25)],
    ['fixture-rod', 'Closet rod and hangers', fixture('rod', 72, 20)],
    ['line-built-in', 'Thin linework (lines)', { lines: [{ pts: box(100, 20), closed: true }] }],
    ['fixture-dishwasher', 'Dishwasher 24 × 24 in (label DW)', { labels: [{ text: 'DW', at: [0, 26] }], ...onWall('dishwasher', 24, 24) }],
    ['fixture-fireplace', 'Fireplace: EXAMPLE ONLY, each is traced from its source', { walls: [ext([-60, -22], [60, -22])],
      solids: [[[-40, -22], [40, -22], [40, 10], [24, 10], [15.36, -10], [-15.36, -10], [-24, 10], [-40, 10]]], ...fixture('fireplace', 48, 20) }]
  ]],
  ['Laundry and utility', [
    ['fixture-washer', 'Washer 27 × 30 in (label W)', { labels: [{ text: 'W', at: [0, 30] }], ...onWall('washer', 27, 30) }],
    ['fixture-dryer', 'Dryer 27 × 30 in (label D)', { labels: [{ text: 'D', at: [0, 30] }], ...onWall('dryer', 27, 30) }],
    ['fixture-washer-dryer', 'Stacked washer / dryer 27 × 30 in (W/D)', { labels: [{ text: 'W/D', at: [0, 30] }], ...onWall('washer-dryer', 27, 30) }],
    ['fixture-water-heater', 'Water heater 22 in (label WH)', { labels: [{ text: 'WH', at: [0, 24] }], ...fixture('water-heater', 22, 22) }]
  ]],
  ['Beds and side tables (true size)', [
    ['bed-king', 'King bed 76 × 80 in', fixture('bed', 76, 80)],
    ['bed-cal-king', 'California king 72 × 84 in', fixture('bed', 72, 84)],
    ['bed-queen', 'Queen bed 60 × 80 in', fixture('bed', 60, 80)],
    ['bed-full', 'Full bed 54 × 75 in', fixture('bed', 54, 75)],
    ['bed-twin-xl', 'Twin XL bed 38 × 80 in', fixture('bed', 38, 80)],
    ['bed-twin', 'Twin bed 38 × 75 in', fixture('bed', 38, 75)],
    ['nightstand', 'Nightstand 24 × 18 in', fixture('nightstand', 24, 18)],
    ['side-table-round', 'Side table, round 20 in', fixture('side-table', 20, 20, { shape: 'round' })]
  ]],
  ['Seating', [
    ['sofa-3', 'Sofa, three seats 84 × 36 in', fixture('sofa', 84, 36)],
    ['sofa-2', 'Loveseat 60 × 36 in', fixture('sofa', 60, 36, { seats: 2 })],
    ['armchair', 'Armchair 34 × 34 in', fixture('armchair', 34, 34)],
    ['symbol-lounge-chair', 'Terrace lounge chair (Matt\'s)', mine('lounge-chair')],
    ['sectional-left', 'Sectional, return on the left 110 × 90 in', fixture('sectional', 110, 90)],
    ['sectional-right', 'Sectional, return on the right 110 × 90 in', fixture('sectional', 110, 90, { side: 'right' })]
  ]],
  ['Tables', [
    ['symbol-chair', 'Dining chair (Matt\'s): every dining table uses it', mine('chair')],
    ['coffee-table', 'Coffee table 48 × 24 in', fixture('coffee-table', 48, 24)],
    ['coffee-table-round', 'Coffee table, round 36 in', fixture('coffee-table', 36, 36, { shape: 'round' })],
    ['table-square', 'Table, square 36 in', fixture('table', 36, 36)],
    ['dining-4', 'Dining table, 4 seats 48 × 30 in', fixture('dining-table', 48, 30)],
    ['dining-6', 'Dining table, 6 seats 72 × 36 in', fixture('dining-table', 72, 36, { seats: 6 })],
    ['dining-8', 'Dining table, 8 seats 96 × 40 in', fixture('dining-table', 96, 40, { seats: 8 })],
    ['dining-round-4', 'Dining table, round, 4 seats 42 in', fixture('dining-table', 42, 42, { shape: 'round' })],
    ['dining-round-6', 'Dining table, round, 6 seats 54 in', fixture('dining-table', 54, 54, { shape: 'round', seats: 6 })]
  ]],
  ['Swatches, stairs and areas', [
    ['swatch-tile', 'Swatch: bathroom tile (pattern "tile")', { areas: [{ type: 'floor', pattern: 'tile', poly: box(150, 110) }] }],
    ['swatch-brick-patio', 'Swatch: patio brick ("brick-patio")', { areas: [{ type: 'terrace', pattern: 'brick-patio', poly: box(150, 110) }] }],
    ['swatch-brick-roof', 'Swatch: roof brick ("brick-roof")', { areas: [{ type: 'roof', pattern: 'brick-roof', poly: box(150, 110) }] }],
    ['area-terrace', 'Terrace / balcony', { areas: [{ type: 'terrace', poly: box(160, 90) }] }],
    ['area-closet', 'Closet / built-in, dashed', { areas: [{ type: 'closet', poly: box(100, 50) }] }],
    ['area-stair', 'Stair, 10 treads, arrow', { areas: [{ type: 'stair', poly: box(50, 150), treads: 10, dir: [0, -1] }] }],
    ['area-stair-break', 'Stair with its break line', { areas: [{ type: 'stair', poly: box(50, 150), treads: 10, dir: [0, -1], break: true }] }],
    ['area-void', 'Void / open to below', { areas: [{ type: 'void', poly: box(100, 70) }] }]
  ]],
  ['Labels', [
    ['label-room', 'Room name over size', { rooms: [{ name: 'LIVING ROOM', size: '12\'0" x 20\'3"', at: [0, 0] }] }],
    ['label-room-name-only', 'Room name, no size', { rooms: [{ name: 'BATH', at: [0, 0] }] }],
    ['label-small', 'Small labels', { labels: [{ text: 'CL', at: [-45, 0] }, { text: 'W/D', at: [0, 0] }, { text: 'REF', at: [45, 0] }] }],
    ['label-rotated', 'Room name in a narrow room (rot 90)', { rooms: [{ name: 'HALL', at: [0, 0], rot: -90 }] }]
  ]],
  ['Matt\'s artwork', [
    ['symbol-car', 'Car (Matt\'s) 190 in', mine('car')],
    ['symbol-compass', 'Compass (Matt\'s): the branded frame uses it', mine('compass', 'compass')],
    ['symbol-clothes-1', 'Clothes in a closet, 1 (Matt\'s)', mine('clothes-1', 'clothes', { variant: 1 })],
    ['symbol-clothes-2', 'Clothes in a closet, 2 (Matt\'s)', mine('clothes-2', 'clothes', { variant: 2 })],
    ['symbol-clothes-3', 'Clothes in a closet, 3 (Matt\'s)', mine('clothes-3', 'clothes', { variant: 3 })]
  ]]
];
const ELEMENTS = SECTIONS.flatMap(([, list]) => list);

function sheet() {
  const groups = [], captions = [], guides = [], heads = [];
  let y = Y0;
  SECTIONS.forEach(([title, list]) => {
    heads.push('<text x="' + X0 + '" y="' + (y - 8) + '">' + esc(title.toUpperCase()) + '</text>');
    list.forEach(([id, caption, level], i) => {
      const x = X0 + (i % COLS) * CELL.w, cy0 = y + Math.floor(i / COLS) * CELL.h;
      const cx = x + CELL.w / 2, cy = cy0 + (CELL.h - 18) / 2;
      const T = (p) => [cx + p[0] * S, cy + p[1] * S];
      const body = level && level.fixtures && level.fixtures[0].type === 'compass'
        ? '<g transform="translate(' + cx + ' ' + cy + ')">' + drawSymbol('compass', STYLE.COMPASS.size * 1.3 * level.fixtures[0].w / level.fixtures[0].h, STYLE.COMPASS.size * 1.3) + '</g>'
        : level ? drawLevel(Object.assign({ name: null }, level), T, S) : '';
      groups.push('<g id="' + id + '">' + body + '</g>');
      guides.push('<rect x="' + x + '" y="' + cy0 + '" width="' + CELL.w + '" height="' + CELL.h + '" fill="none" stroke="' + (level ? '#c9d1d6' : '#53C7DC') + '" stroke-width="' + (level ? 0.5 : 1) + '" stroke-dasharray="2 2"/>');
      captions.push('<text x="' + (x + 6) + '" y="' + (cy0 + CELL.h - 7) + '">' + esc(caption) + '</text>');
    });
    y += Math.ceil(list.length / COLS) * CELL.h + 34;
  });
  const frameY = y + 16;
  const W = X0 * 2 + COLS * CELL.w, H = frameY + STYLE.PAGE.h + 50;
  const defs = patternDefs(Object.keys(PATTERNS));

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
    defs + '\n<g id="GUIDES">' + guides.join('') + '</g>\n' +
    '<g id="SECTIONS" font-family="Nunito Sans, Arial, sans-serif" font-size="10" font-weight="800" fill="#00273a" letter-spacing="1">' + heads.join('') + '</g>\n' +
    '<g id="ELEMENTS">\n' + groups.join('\n') + '\n</g>\n' +
    '<g id="CAPTIONS" font-family="Nunito Sans, Arial, sans-serif" font-size="7" fill="#5b6b75">' + captions.join('') + '</g>\n' +
    '<g id="NOTES" font-family="Nunito Sans, Arial, sans-serif" font-size="11" fill="#00273a">' + notes.join('') + '</g>\n' +
    '</svg>\n';
}

module.exports = { sheet, ELEMENTS, SECTIONS };

if (require.main === module) {
  const out = process.argv[2];
  if (!out) { console.error('Usage: node scripts/floorplan/style-sheet.js "<out.svg>"'); process.exit(1); }
  fs.writeFileSync(out, sheet());
  console.log('Style sheet saved to ' + out + ' (' + ELEMENTS.length + ' elements and the branded frame)');
}
