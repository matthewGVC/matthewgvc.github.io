# plan.json: the plan description

The single source of truth is the validator in `scripts/floorplan/plan.js` (its header comment and
`validate()`). This page explains how to fill the fields in. Worked examples:
- `scripts/floorplan/fixtures/studio.json`: the smallest valid plan.
- `scripts/floorplan/fixtures/555-w59-phc.json`: a real plan traced from
  `tools/showsheet/sample/floorplan.jpg`, with curved window walls, a wraparound terrace, pocket
  doors, a turning stair, a fireplace, closets, a kitchen run and a bath. `555-w59-phc.gen.py` is the
  generator script that wrote it. Copy its pattern.

## Coordinates

- Use **any one unit** for the whole file. The drawer fits each level to the page, keeping its shape,
  so the scale doesn't matter. Only the proportions do.
- **y runs down the page**, like an image. For a picture source, use the picture's own pixel
  coordinates, **at its real size** (open the file and check its width and height). A viewer may
  show the picture scaled down, so never read coordinates off a scaled view. Trace in those pixels
  and `scripts/floorplan/overlay.js` can lay the source over your plan to check it (SKILL step 7).
- Each level is fitted on its own. Floors of a multi-level plan are therefore not drawn to one shared
  scale.

## Top level

| Field | What to write |
|---|---|
| `schema` | `1` |
| `job` | `{ "label": "<the prompt's label>", "address": "<street address, unit>" }`. The label names the files. The address prints in the branded header (in capitals), so write it the way GVC writes it ("555 West 59th Street, PHC"), never copied from the source's title block. |
| `layout` | Leave it out for the current layout. `"alternate"` for an alternate. |
| `sources` | One entry per reference used: `{ "file": "Design/<name>", "kind": "<cubicasa-svg, cubicasa-png, broker-plan, screenshot, architect-pdf, dwg, dxf, gvc-old-plan-jpg…>", "note": "<what you took from it, e.g. page 2 only>" }`. The maker needs this list. |
| `north` | Degrees clockwise from page-up that north points, read off the source's compass. `0` when the compass points straight up. **`null` when the source shows no compass.** Never guess it. |
| `levels` | One per floor (below). |
| `missing` | Plain sentences: what the source doesn't show, or what you left out. |
| `uncertain` | Plain sentences: anything you had to judge (a blurry size, a door swing you couldn't see). |

`missing` and `uncertain` go into the run note and the report, so write them for Matt.

## A level

`name` is `null` for a single-floor plan. With several levels every one needs a name, in capitals as
the source has it ("FIRST FLOOR", "LOWER LEVEL"). It prints on the branded sheet and in the file name.

### walls

`{ "a": [x, y], "b": [x, y], "type": "exterior" | "interior" | "glass", "via": [x, y] }`, one run each.
- **exterior** (4 pt): the unit's outside walls, demising walls, and any wall the source draws thick
  (about as thick as its outside walls). **interior** (2.5 pt): the thinner walls between rooms and
  closets. **glass** (0.8 pt): shower screens and glass partitions. Use the source's thickness to
  decide, never your guess about the building.
- Trace the **centre line** of each wall.
- Walls that meet **end to end on exactly the same point** are drawn as one continuous line, with
  clean corners and no gaps. Make every corner share its point exactly. A wall that butts into the
  middle of another (a T) ends on that wall's centre line.
- **Curves:** give `via`, any point on the curve between `a` and `b` (the middle is best). The wall is
  then the true circular arc through the three points. For a quarter-circle corner of radius r
  centred at c, the middle point is c plus r·0.7071 toward the corner. Only windows and plain
  openings can sit on a curve.
- Walls are referenced by their **index** (0 = first) from `openings`, so write all the walls first
  and add openings after. A generator script in your scratch folder (Python or Node) that appends
  walls and openings as it goes makes the index bookkeeping safe. The 555 W59 example was made that
  way.

### openings

`{ "wall": <index>, "from": 0-1, "to": 0-1, "type": …, "hinge": "from" | "to", "side": "left" | "right" }`
- `from` and `to` are fractions along the wall, measured from its `a` end. A door between 2.0 and 3.0
  units along a wall 10 units long is `from 0.2, to 0.3`.
- `type`: `door`, `double-door`, `sliding`, `pocket`, `bifold` (closets; `side` is the side it folds
  into), `window`, `opening` (a plain gap).
- Doors only: `hinge` is the end the leaf turns on. `side` is the side the door opens into, as seen
  walking along the wall from `a` to `b` on the page: on a wall running left to right across the
  page, `left` is up the page; on a wall running down the page, `left` is to the right.
- **`"outside": true`** on every door that opens to the outside: to a terrace or balcony, and the front
  door to the building's hall. Those draw fully open (90°). Every other door draws half open (45°).
  This is Matt's rule.
- **pocket:** `hinge` is the end with the pocket (the panel slides into the wall there).
- **Windows:** one opening per pane, edge to edge. Where two windows meet, the drawing shows the
  mullion, so split them where the source shows a divider.
- **Look for every pocket and sliding door.** They're easy to miss: a thin rectangle sticking out
  of a wall end, or a white slot inside a wall.
- Check every door in the rendered PNG. A swing drawn the wrong way is the most common mistake.

### solids

Filled navy polygons, `[[x, y], …]` with at least 3 points: columns, chimney breasts, chases, and the
thick wall masses the source fills in.

### fixtures

`{ "type": …, "at": [x, y], "w": …, "h": …, "rot": degrees }`. `at` is the **centre**. `w` and `h` are
in plan units, measured on the source.
- Types: `toilet`, `sink` (a vanity basin), `round-sink`, `double-sink`, `tub`, `shower` (square or
  rectangular: just its `w` and `h`), `range` (`"burners": 4` or `6`, default 4), `kitchen-sink`
  (`"bowls": 1` or `2`, default 2), `refrigerator`, `fireplace`, `counter` (any cabinet, island, desk
  or built-in box), `rod` (a closet rod, `w` along the rod).
- **Laundry and utility:** `washer`, `dryer`, `washer-dryer` (one stacked unit), `water-heater`,
  `dishwasher`. Put their labels (W, D, W/D, WH, DW) in `labels`.
- **Fireplaces are not a fixed symbol.** Every fireplace is traced from its own source: the chimney
  mass as `solids`, the firebox and hearth as `lines` (or the `fireplace` fixture only when its shape
  matches the source). The style sheet's fireplace is an example, not the rule.
- **Furniture:** `bed` (`"pillows": 1` or `2`; a bed narrower than 0.6 of its length gets 1),
  `nightstand`, `side-table`, `sofa` (`"seats"`, default 3), `armchair`, `sectional`
  (`"side": "left"` or `"right"`, the side its return runs down), `coffee-table`, `table`,
  `dining-table` (`"seats"`, default 4, chairs drawn round it). `side-table`, `coffee-table`,
  `table` and `dining-table` take `"shape": "round"`. Measure each piece off the source at its real
  size (a queen bed is 60 × 80 in). **Draw furniture only when the source shows it or Matt asks for
  a furnished plan**; otherwise leave it out.
- **`rot` 0 means the wall the fixture backs onto is at the top.** Turn each fixture so its back
  (toilet tank, faucet, firebox back, fridge back) **sits flush against its wall**: 90 for a wall to
  its right, 180 below, 270 to its left. Measure `at`, `w` and `h` so the fixture's edge lands on
  the wall face, not short of it or into it.
- They draw in list order, so put a `counter` before the sink and range that sit on it.
- **Draw every cabinet, closet and appliance box the source draws.** A box the list has no symbol for (a DW bay, a washer) is a `counter` or `lines` box
  with its small label.

### areas

`{ "type": …, "poly": [[x, y], …] }`
- `terrace`, `balcony`: shaded outdoor space. A terrace that wraps the unit must trace its outer edge
  and come back **along the unit's outside wall, using the same points** (curve points included).
  Otherwise the shading cuts across the corners.
- `closet`: a dashed outline (built-ins and shallow closets drawn without walls).
- `stair`: treads across the long side. Add `"treads": n` with the source's own count of treads, and
  `"dir": [dx, dy]` to point the arrow the way the source's arrow points. When the source's arrow
  isn't a straight run along the flight, use `"arrow": false` and draw it with `lines`. A stair that
  turns: the straight flight is the `stair` area, and the turn is drawn with `lines`, as the source
  draws it.
- `void`: a crossed box (open to below, shafts).
- `floor`: no outline, only its swatch, for a tiled bathroom floor. `roof`: a thin outline with its
  swatch.
- **`"pattern"`** lays a swatch over any area: `tile` (bathroom floors), `brick-patio` (a brick
  terrace or patio, over the terrace shading) and `brick-roof` (roof pavers). Use one only where the
  source shows that surface.
- Stairs also take **`"break": true`** (or a number 0-1 along the flight) for the break line with
  its zig-zag, wherever the source cuts the stair.

### rooms

`{ "name": "CAPITALS", "size": "12'0\" x 20'3\"" | null, "at": [x, y], "rot": 0, "box": [x0, y0, x1, y1] }`
- `name` in capitals, exactly as the source names the room.
- `size` exactly as printed, in feet and inches with straight quotes: `12'0" x 20'3"`. Write a bare
  feet value as `0"` inches (`15'` → `15'0"`) and note that in `uncertain`. Use `null`, or leave it
  out, when the source gives none.
- `at` is the centre of the label block. `rot` of 90 or -90 is for a long, narrow room, as the source
  does.
- `box` is optional: the room's extent. Give it for small rooms, so the validator can warn when the
  name won't fit.
- BATH, WIC, PDR, FOYER and similar named spaces are **rooms** (bold name, size if the source gives
  one).

### labels

`{ "text": "CL", "at": [x, y] }`: the small 6 pt words, such as CL, W/D, REF, DW, FP, UP, DN,
BUILT-IN and LAUNDRY. Place each one inside its space, clear of walls and fixtures.

### lines

`{ "pts": [[x, y], …], "closed": true | false }`: thin (0.5 pt) linework for what the fixed set doesn't
cover. Use it for a built-in's outline, a DW bay's dividers, a stair's turn and break line, an entry
arrow, or a planter edge. A closed line is filled white. Never use it for a wall, a door or a
fixture that has a type.
