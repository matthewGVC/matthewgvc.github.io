/* ============================================================
   The GVC floorplan house style. Every size, weight and colour the drawer uses lives here;
   nothing else may hard-code one. Sizes are in points on the 810 x 630 pt canvas.
   Tuned once against 106 CPS 8A (unbranded); after that these values are fixed.
   ============================================================ */
'use strict';

const NAVY = '#00273a';
const ROOM_NAME_PT = 7.5;   // Matt's PRIMARY BEDROOM (435 E57) is 76.8 pt wide

module.exports = {
  /* page and drawing boxes */
  PAGE: { w: 810, h: 630 },
  PNG: { w: 3375, h: 2625 },   // px, the PNG copy of each plan (810 x 630 pt at 300 dpi)
  BOX_UNBRANDED: { x0: 36, y0: 36, x1: 774, y1: 594 },
  BOX_BRANDED: { x0: 36, y0: 96, x1: 774, y1: 586 },   // Matt's: the page's width, from the pale end of the fade to the note (929 Park's top wall is at 96)

  /* colours */
  NAVY,
  WHITE: '#ffffff',
  TERRACE_FILL: '#ffffff',   // Matt's terraces and balconies are white, outlined (pavers only when drawn)
  TILE_LINE: '#A9E2ED',      // bath tile grid
  PAVER_LINE: '#E1F3F8',     // terrace paver grid
  SKY: '#53C7DC',
  CYAN: '#00A1C4',

  /* linework */
  WALL_EXTERIOR: 4,          // pt, square ends (106 CPS 8A: ~16 px at 4.17 px/pt)
  WALL_INTERIOR: 2.5,        // pt (106 CPS 8A: ~10-11 px)
  WALL_GLASS: 0.8,           // pt, glass partitions and shower screens
  THIN: 0.5,                 // fixtures, door leaves and arcs, windows, areas
  CLOSET_DASH: '2 2',
  LINE_DASH: '1.5 1',         // a dashed line: overhead cabinets, a sliding door's track (Matt's 347 W Broadway)
  FINE: 0.25,                // pt, the inner detail of Matt's symbols
  STAIR_DOTTED: '1 1',       // a stair past its break line
  PATTERN_LINE: 0.25,        // pt, swatch lines (tile, brick)
  TILE: 2.6,                 // pt, floor tile square (Matt's: 2.6)
  PAVER: 2.64,               // pt, terrace paver square
  BRICK: { w: 6, h: 2 },     // pt, one brick
  STAIR_TREAD: 6,            // pt between treads
  STAIR_ARROW: 3,            // pt arrow-head length
  SLIDING_PANEL: 1.6,        // pt thickness of a sliding / pocket panel
  DOOR_OPEN_OUTSIDE: 90,     // degrees a door leaf stands open: doors to a terrace, balcony or the hall
  DOOR_OPEN_INSIDE: 45,      // every other door (Matt, 10-26)
  DOOR_LEAF: 1.45,           // pt, the width of a door leaf's hollow panel (Matt's 435 E57)
  DOOR_LINE: 0.3,            // pt, a door leaf's outline, its swing, and a window's frames
  DINING_LINE: 0.3,          // pt, a dining table and every line of its chairs (Matt's library sheet, 10-27)
  SYMBOL_WEIGHT: { chair: 0.3 },   // symbols drawn at one weight throughout, over the THIN / FINE split
  WINDOW_GLASS: 0.35,        // the glass frame's half-width, as a share of the wall's

  /* type (Nunito Sans, outlined); tracking is letter-spacing in em */
  FONT_FILE: 'assets/fonts/nunito-sans-{weight}-latin.woff2',
  LABEL_EM: 0.62,            // average capital width in em, for the "label wider than its room" warning
  ROOM_NAME_PT,
  ROOM_NAME: { weight: 900, sizePt: ROOM_NAME_PT, tracking: 0, lineGap: ROOM_NAME_PT * 1.24 },   // lineGap: baseline to baseline of a two-line name
  ROOM_SIZE: { weight: 400, sizePt: 7, tracking: 0, gap: 4 },  // gap: pt from name baseline to size cap top (Matt's 12' x 19'6" is 35 pt wide)
  SMALL_LABEL: { weight: 800, sizePt: 7.2, tracking: 0 },  // CL, REF, W/D, DW: as tall as a room name in Matt's (cap about 5.2 pt)

  /* branded frame: measured off Matt's own sheets (435 E57, 225 E79, 347 W Broadway, 929 Park and others,
     all laid out the same), in pt on the 810 x 630 page */
  HEADER: {
    fade: 132,                 // the cyan holds at the top, then eases to white by here
    stops: [[0, '#03A1C4'], [0.18, '#0CA5C5'], [0.27, '#1CABCB'], [0.45, '#4DBDD5'], [0.64, '#91D6E5'], [0.82, '#D7F0F5'], [1, '#FFFFFF']],
    middle: 55.5,              // the address block, the bar and the facts are centred on this line
    address: { weight: 800, sizePt: 22.4, tracking: 0, x: 90.4, minX: 72, right: 389, lineGap: 26.4 },   // lineGap: baseline to baseline
    bar: { x: 405, w: 1.7, h: 15 },
    facts: { weight: 600, sizePt: 13.9, tracking: 0.265, right: 720, lineGap: 16.8 }
  },
  FOOTER_TEXT: { weight: 800, sizePt: 6.1, tracking: 0.25, x: 405, baseline: 595.9, text: 'ARTIST RENDERING - ALL MEASUREMENTS ARE APPROX.' },
  STATUS: { weight: 900, sizePt: 12.77, tracking: 0, right: 761, baseline: 596 },   // CURRENT, ALTERNATE, the level name
  COMPASS: { h: 60, at: [400, 554], letter: { weight: 900, sizePt: 15, tracking: 0 } },   // Matt's compass, bottom centre
  /* the all-floors sheet (225 E79, 401 E89): each floor's name, MAIN in black and LEVEL light, cap 7.9 pt */
  LEVEL_NAME: { weight: 900, light: 300, sizePt: 11.4, tracking: 0, below: 31, gap: 48, stagger: 18, above: 3, clear: 14, preferRow: 1.15 },
  COMPASS_CLEAR: 6             // pt kept between the compass and the plan when it moves aside
};
