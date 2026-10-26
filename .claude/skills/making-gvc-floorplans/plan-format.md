# plan.json: the plan description

The single source of truth is the validator in `scripts/floorplan/plan.js` (its header comment and
`validate()`). This page explains how to fill the fields in. Worked examples:
- `scripts/floorplan/fixtures/studio.json`: the smallest valid plan.
- `scripts/floorplan/fixtures/555-w59-phc.json`: a real plan traced from
  `tools/showsheet/sample/floorplan.jpg`, with curved corners, a wraparound terrace, a stair, a
  fireplace and a kitchen run.

## Coordinates

- Use **any one unit** for the whole file. The drawer fits each level to the page, keeping its shape,
  so the scale doesn't matter. Only the proportions do.
- **y runs down the page**, like an image. For a picture source, use the picture's own pixel
  coordinates: read a corner off the picture and write that number. This is the easiest, least
  error-prone choice.
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

`{ "a": [x, y], "b": [x, y], "type": "exterior" | "interior" }`, one straight run each.
- **exterior** is the unit's outside wall and its demising walls (4 pt). **interior** is a wall between
  rooms (2.5 pt).
- Put corners on exactly the same point so the walls meet cleanly.
- **Curves:** split each quarter-circle into 4 short walls, and say so in `uncertain`.
- Walls are referenced by their **index** (0 = first) from `openings`, so write all the walls first
  and add openings after. A generator script in your scratch folder (Python or Node) that appends
  walls and openings as it goes makes the index bookkeeping safe. The 555 W59 example was made that
  way.

### openings

`{ "wall": <index>, "from": 0-1, "to": 0-1, "type": …, "hinge": "from" | "to", "side": "left" | "right" }`
- `from` and `to` are fractions along the wall, measured from its `a` end. A door between 2.0 and 3.0
  units along a wall 10 units long is `from 0.2, to 0.3`.
- `type`: `door`, `double-door`, `sliding`, `pocket`, `window`, `opening` (a plain gap).
- Doors only: `hinge` is the end the leaf turns on. `side` is the side the door opens into, as seen
  walking along the wall from `a` to `b` on the page: on a wall running left to right across the
  page, `left` is up the page.
- Check every door in the rendered PNG. A swing drawn the wrong way is the most common mistake.

### solids

Filled navy polygons, `[[x, y], …]` with at least 3 points: columns, chimney breasts, chases, and the
thick wall masses the source fills in.

### fixtures

`{ "type": …, "at": [x, y], "w": …, "h": …, "rot": degrees }`. `at` is the **centre**. `w` and `h` are
in plan units, measured on the source.
- Types: `toilet`, `sink`, `double-sink`, `tub`, `shower`, `range`, `kitchen-sink`, `fireplace`,
  `counter`.
- They draw in list order, so put a `counter` before the sink and range that sit on it.
- A toilet's tank is at the top when `rot` is 0. Turn it so the tank sits against its wall.
- Nothing outside this list gets drawn, so no furniture, refrigerators or washers. Use a small label
  (REF, W/D, DW) for those.

### areas

`{ "type": …, "poly": [[x, y], …] }`
- `terrace`, `balcony`: shaded outdoor space. A terrace that wraps the unit must trace its outer edge
  and come back **along the unit's outside wall, using the same points** (curve points included).
  Otherwise the shading cuts across the corners.
- `closet`: a dashed outline (built-ins and shallow closets drawn without walls).
- `stair`: treads across the long side. Add `"dir": [dx, dy]` to point the arrow the way the source's
  arrow points.
- `void`: a crossed box (open to below, shafts).

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
