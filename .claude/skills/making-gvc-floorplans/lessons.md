# Floorplan lessons

What earlier runs learned that `SKILL.md`, `plan-format.md` and `sources.md` don't already say.
**Newest first, under a dated heading.** Read the whole file before every run. When a lesson comes up
a third time, move it into `SKILL.md` or `sources.md` and delete it here. Fixes that went into the
scripts are not lessons: they live in the code and its tests.

(Pruned 2026-10-30: lessons already moved into the other files, fixed in the scripts, or overruled by
a later one were taken out.)

## 2026-10-28: 366 N 3rd v3, Matt's markups on v2 (pink = wrong or missing, red circle = joint, red tick = good)

- **Arcs outside a wall are doors, not casements.** The first floor's west wall had swing arcs outside
  it: two pairs of glazed French doors opening out. Look for the leaf hinges and where the arcs meet.
- **A long thin line beside a stair or wall may be the architect's dimension line.** One at the entry
  stair was drawn as a stair line. A dimension line runs on past the drawing and has ticks; leave it out.
- **Round columns over a wall split the trace.** The ground floor's stair wall had white breaks where
  the source draws column circles on it. `clean_solids.close` joins masses split by less than 60 px;
  run it on the traced walls before adding free-standing columns with round holes.
- **Draw a stair's foot:** its last tread and the closing edge line (both were missing).
- **A balcony's open side has a rail** (a double line), like the 2nd floor's, not a single line.
- **Sidelights in a thin wall join it:** fill the thin wall from each sidelight to the next wall's face.

## 2026-10-27: labels on the all-floors sheet (366 N 3rd)

Matt: "scale and move them, they should fit nicely". `fit-labels.js` does it; what to expect of it:
- **A label stays in its own room**, smaller, and never wanders into the next room.
- **Small labels (W, D, REF) never move,** only shrink. **Labels backed in white (ELEVATOR, SHOWERS)
  stay put** and only shrink clear of the walls.
- **Still look at it.** FOYER found clear space above the foyer stair, which is open to the hall and
  read wrong. It was set by hand inside the foyer, with `allLock`.

## 2026-10-27: 366 N 3rd St, windows and Matt's library sheet

- **A window beside a column:** the measured wall band takes in the column, which made the window too
  wide and laid it over the post. Give such windows the plain wall's own centre and thickness.
- **Reading Matt's returned library sheet:** compare it with a fresh `style-sheet.js` run, cell by cell.
  Take each named group's bounding box from the browser, render both sheets at 4x, rank the cells by
  how many pixels differ, then look at side-by-side crops and read sizes and weights in the browser.
  Also search for shapes he drew **outside** the named groups (the tub faucet and fridge handle sat
  loose on the layer). Illustrator rounds to one decimal place, so FINE 0.25 comes back as .2: a weight
  that changed for real is one rounding can't explain.
- **Still to ask Matt:** the 6-burner range keeps one small ring on its back right burner, as he drew
  it; the other rings were removed.

## 2026-10-27: 366 N 3rd St FIRST FLOOR v2 (revising one floor of a hand-edited job)

- **Revising one floor of a hand-edited job: run the maker in a scratch copy.** It moves every other
  version's files to the archive, so a v2 run in the job folder would have swept Matt's hand-edited v1
  2ND FLOOR out of Unbranded/. Copy the job's `Design/plan.json` to `tmp/<x>/Floorplan/Design/`, run
  there, and copy only that floor's `v<N> - <LEVEL>` files across. Archive the old `plan.json` first.
- **Always check the cleaned walls against the raw trace** (red lost, green added) before using them:
  `clean_solids.py` can drop slivers. Look at anything over a few hundred pixels.
- **Read grid crops by their printed labels, not by row offsets.** Several first readings were off by
  the crop's origin. Measure windows by scanning the wall centre for gaps instead (exact ends, and
  pane splits where the source shows mullions).
- **Setting a fixture flush (`clean_solids.run` to the wall face) needs a probe point beside the window**
  when a window opens behind the fixture (a tub or a bed under a window): read the wall face beside the
  window, and keep the fixture's own centre along the wall.
- **Label pass on both PNGs.** A label clear on the Unbranded sheet can touch a bed or a wall on the
  Branded one (smaller plan, same type size). Check both. A label never goes on the far side of a
  wall from its object (WET BAR first landed in bedroom 3).

## 2026-10-27: 366 N 3rd St, 2ND FLOOR (Matt's review and his hand edits)

- **Look for walls drawn as an outline, not solid.** A thin low wall ran from the west wall across the
  living room and turned down to the balcony wall. The tracer skips outlined walls: find every
  double-line wall in the source and draw it as `lines`.
- **Counters follow the source's outline.** Both ends of the kitchen run step (a deeper return at one
  end, a turn down the wall at the other): one box per run is wrong where the source steps.
- **A vanity counter runs the full wall** when the source's counter-front line runs from wall to wall
  with the sinks in it.
- **Measure fixtures at their real size** (a toilet is about 90 x 142 px at 54 px/ft). Sinks and the
  shower must match the source's drawing: a shower drawn as a glass box with an inner tray and an X is
  `glass` walls plus `lines`, not the plain crossed-box fixture.
- **One range is one range.** A 48" range is a single `range` the width of its space, not two 30"
  ranges. The library has 4 or 6 burners only; use 6 and say so.
- **Furniture the architect draws** comes in from the library (bed, nightstands, armchairs, sectional,
  coffee table, dining table, sofa, `chair` for stools) at the source's placement and size. Armchairs
  in pairs are angled to match (rot 45 / 315).
- **Labels we do not use:** OVEN'S. Leave the box, drop the label.
- **Read each thing as the source draws it, not as the nearest library item.** The living-room
  sectional is a U with a round-ended arm and a thin outer back line, drawn as `lines`; the library
  `sectional` is only an L. Use a library symbol only when its shape is the source's.
- **Count every cell of a cabinet run.** The oven bank was one box in the plan but two cells (oven,
  then a plain cabinet) down to the fridge.
- **One door per opening:** the pantry showed two swings in the source but is one door.
- **Do not invent arrows.** The stair's walking line ends at the break mark with no arrowhead; the
  direction is the UP label and the line's path.
- **Stairs are not a pile of treads.** Read the whole stair: the walking line (it climbs, then turns),
  the flights and their rails (double lines with end caps), each flight's own tread positions (not
  evenly spaced), the break line with its jog and `>` mark, and every dashed line above the cut. Give
  stairs their own zoomed pass at 3x, in two crops, and check them on the overlay before moving on.

## 2026-10-27: 366 N 3rd St (NJ architect PDF, three floors)

- **The plans in these PDFs are pictures** (only dimension lines are vector). Render each plan at 216 dpi (54 px to the foot at 1/4" = 1'-0") and give every level `unitsPerFoot: 54`.
- **`trace-walls.py` drops big parts of a plan when thin grid lines or dimension ticks join the wall masses** (its small-bump trim then removes real walls). Fix: make a copy of the render keeping only dark runs at least 9 px thick (`skimage.morphology.opening`), then trace that copy. Light-grey partitions (value about 196) need `--dark 222`; shadows are about 242.
- Columns drawn as a square with a round post are dropped by the tracer; add them as a square plus a round hole.
- Casement windows are drawn as a thin V or triangle outside the wall; French doors as arc-and-leaf pairs. Do not mix them up.
- Lines are not counted when the all-floors sheet is laid out: an exterior stair drawn as `lines` ran off its floor's canvas and under the title. Add a `floor` area (no pattern) over it.

## 2026-10-26: real-plan test, round 1 (six of Matt's jobs)

- **What Matt adds that the source lacks** (fixtures in a Cubicasa plan, renamed rooms, a second level,
  CL labels, sizes) comes from sales agents' requests (Matt, 10-26). Never learn it as house style, and
  never add it unless the prompt asks.

## 2026-10-26: Matt's style sheet, round 3

- The compass "N" was live Avenir LT Pro Black text. Avenir isn't on file, so it was outlined in
  Nunito Sans Black. If Matt wants Avenir, he outlines the N in Illustrator (Type > Create Outlines).

## 2026-10-26: pilot on the sample plan (555 W59 PHC, `tools/showsheet/sample/floorplan.jpg`)

The worked result is `scripts/floorplan/fixtures/555-w59-phc.json`.

- **"FIRST FLOOR" with a stair going UP but only one floor supplied:** draw that floor and say in
  `missing` that the upper floor wasn't given. (The pilot used `name: null`; since 10-27 a floor the
  source names keeps its name, `plan-format.md`.) Never draw a floor you weren't given.
- **Small labels next to walls** (a CL beside a closet door) were placed on top of the wall on the
  first pass. Always check the PNG for labels touching linework, and nudge them into the space.

## 2026-10-26: audit of the last ten NYC plans

- 333 E43 and 310 W99 contain a pasted picture rather than a drawing. Treat files like these as
  picture sources.
