/* ============================================================
   The GVC floorplan house style. Every size, weight and colour the drawer uses lives here;
   nothing else may hard-code one. Sizes are in points on the 810 x 630 pt canvas.
   Tuned once against 106 CPS 8A (unbranded); after that these values are fixed.
   ============================================================ */
'use strict';

const NAVY = '#00273a';
const ROOM_NAME_PT = 7.2;

module.exports = {
  /* page and drawing boxes */
  PAGE: { w: 810, h: 630 },
  PNG: { w: 3375, h: 2625 },   // px, the PNG copy of each plan (810 x 630 pt at 300 dpi)
  BOX_UNBRANDED: { x0: 36, y0: 36, x1: 774, y1: 594 },
  BOX_BRANDED: { x0: 36, y0: 96, x1: 774, y1: 560 },

  /* colours */
  NAVY,
  WHITE: '#ffffff',
  TERRACE_FILL: '#EEF3F5',
  SKY: '#53C7DC',
  CYAN: '#00A1C4',

  /* linework */
  WALL_EXTERIOR: 4,          // pt, square ends (106 CPS 8A: ~16 px at 4.17 px/pt)
  WALL_INTERIOR: 2.5,        // pt (106 CPS 8A: ~10-11 px)
  WALL_GLASS: 0.8,           // pt, glass partitions and shower screens
  THIN: 0.5,                 // fixtures, door leaves and arcs, windows, areas
  CLOSET_DASH: '2 2',
  STAIR_TREAD: 6,            // pt between treads
  STAIR_ARROW: 3,            // pt arrow-head length
  SLIDING_PANEL: 1.6,        // pt thickness of a sliding / pocket panel
  DOOR_OPEN_OUTSIDE: 90,     // degrees a door leaf stands open: doors to a terrace, balcony or the hall
  DOOR_OPEN_INSIDE: 45,      // every other door (Matt, 10-26)

  /* type (Nunito Sans, outlined); tracking is letter-spacing in em */
  FONT_FILE: 'assets/fonts/nunito-sans-{weight}-latin.woff2',
  LABEL_EM: 0.62,            // average capital width in em, for the "label wider than its room" warning
  ROOM_NAME_PT,
  ROOM_NAME: { weight: 900, sizePt: ROOM_NAME_PT, tracking: 0 },
  ROOM_SIZE: { weight: 400, sizePt: 7, tracking: 0, gap: 4.5 },  // gap: pt from name baseline to size cap top
  SMALL_LABEL: { weight: 800, sizePt: 6, tracking: 0 },

  /* branded frame */
  HEADER: { h: 80, x: 36, lineGap: 8 },
  HEADER_ADDRESS: { weight: 900, sizePt: 15, tracking: 0 },
  HEADER_FACTS: { weight: 800, sizePt: 7, tracking: 0.2 },
  FOOTER: { y: 610 },
  FOOTER_TEXT: { weight: 800, sizePt: 5, tracking: 0.2, text: 'ARTIST RENDERING · ALL MEASUREMENTS ARE APPROX.' },
  LOGO: { file: 'assets/logos/sheet/lockup-navy.svg', w: 70, x: 36 },
  COMPASS: { size: 28, ring: 9, letter: { weight: 900, sizePt: 6, tracking: 0 } },
  LEVEL_NAME: { weight: 900, sizePt: 8, tracking: 0, baseline: 586 }
};
