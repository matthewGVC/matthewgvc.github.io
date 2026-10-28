# Floorplan lessons

What earlier runs learned. **Newest first, under a dated heading.** Read the whole file before every
run. When a lesson comes up a third time, move it into `SKILL.md` or `sources.md` and delete it here.

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
- **Furniture faces into the room.** Two armchairs faced the wall. After rotating a chair, check which
  way its seat opens.
- **Folding Matt's hand edits in: tick off every red-only shape in the diff.** His v1 DW bar at the
  island was missed. List them and check each one is in the generator.
- **Place nothing against a wall by eye** (a balcony rail, a bed, nightstands): read the wall face off
  the raster. Under a window there is no wall to read, so read it beside the window.

## 2026-10-27: Matt's red circle = gaps and corners that don't join

His circle at the primary bath window marked a frame meeting its wall badly. At 40x it was three faults,
all fixed at the cause, not by hand:
- **Wall thickness one pixel too thick.** The raster fills both edge pixels, so `band` counted one too
  many; every window frame stood half a pixel proud of the wall faces. `band` now returns `hi - lo`.
- **Frame inset by the wrong weight** (THIN, not the frame's own DOOR_LINE), so its outer line sat inside
  the wall face: a step at the corner. Glass now sits flush, is drawn before the walls, and its white runs
  on under a wall at each end that meets one (not between panes); the frame lines stop at the opening.
- **Wall ends that weren't square** (a jamb's jog, a slanted end), leaving a wedge beside the frame.
  `clean_solids.square` straightens chamfers and jogs, and `square_ends` cuts every wall end straight at
  its opening and fills the notch behind it.
Then `check-joints` found the rest: fixtures set half a pixel off their wall and rounded (fridge, wet bar,
sinks, toilets), a window measured on its thicker side, the stair's outer rail and a newel post short of
their wall. Now: exact flush, the thinner band, faces read off the raster. Its first pass flagged every
X and hinge; it now counts only slivers that run along a wall.
Process cleanups in the same pass: the maker fits the all-floors labels itself, and each job keeps its
generators in `Design\gen\` with `rebuild.sh` (one command).

## 2026-10-27: fitting the labels on the all-floors sheet (366 N 3rd)

Matt: "scale and move them, they should fit nicely", then, about two POWDER rooms and the PANTRY:
"These can be scaled down even more to fit better". **A label stays in its own room, smaller, and
never wanders into the next room.** `scripts/floorplan/fit-labels.js` now does this; what it took:
- **Masks must use the sheet's own layout.** A copy of the plan with the labels or fixtures left out is
  laid out differently, because the floors' bounds change. Its masks sat offset from the labels, so
  every room check was wrong and labels swapped rooms (BATH into the CL beside it). `drawAll` takes
  `opts.layout` to reuse the full sheet's layout.
- **A label's room** is a flood fill from its centre, bounded by walls, columns and every door or
  window opening shut with a line. The line runs a little past each end, and the borders are
  thickened 1 pt so hairline gaps can't leak.
- **Search order:** each size tries near the label first, then anywhere in its room, before the next
  smaller size (1 down to 0.5). Otherwise bedrooms shrank to half size beside free space.
- **Small labels (W, D, REF) never move,** only shrink: they belong in their own box. **Labels backed in
  white (ELEVATOR, SHOWERS) stay put** and only shrink clear of the walls.
- **Still look at it.** FOYER found clear space above the foyer stair, which is open to the hall and
  read wrong. It is set by hand inside the foyer, with `allLock`.

## 2026-10-27: 366 N 3rd St, all floors v2; new rules from Matt

- **Only PNGs in Unbranded/ and Branded/.** The SVG masters go to `Design/Unbranded/` and
  `Design/Branded/`. The maker does this now, and any SVG of ours left in Unbranded/ or Branded/ moves
  to the archive. The site's job page falls back to the PNG, so nothing there changed.
- **Always CL, never CLOSET** (PRIMARY CL, UTILITY CL). The validator warns on CLOSET.
- **Fold Matt's hand edits into the generator before regenerating a floor he edited.** Map his shapes
  back to plan coordinates: take the scale and offset from one shape you know in both files (the
  elevator box). Read his shapes with `getBoundingClientRect`, not `getBBox`, because his rects carry
  rotate transforms. Then diff the regeneration against his file again; only the deliberate changes
  should be left.
- **French doors take `"glazed": true`:** the window's glass in the opening, one pane per leaf.
- **Stools and single chairs are `chair`** (Matt's dining chair; `rot` 0 faces the table above it).
- **A window beside a column:** the measured wall band takes in the column, which made the window too
  wide and laid it over the post. Give such windows the plain wall's own centre and thickness.
- **Labels on dashed X lines** (an open area, outdoor showers) take `"backing": true`, like ELEVATOR.
- **Check the all-floors sheet's labels too.** Each floor is drawn smaller there, so labels that fit on
  the single sheets touch walls, beds and swings. Fixed with fit-labels.js (section above).

## 2026-10-27: Matt's edits to the library sheet (scripts/floorplan/library.svg)

How it was read: his returned sheet against a fresh `style-sheet.js` run, cell by cell. Each named group's
bounding box comes from the browser, both sheets are rendered at 4x, and cells are ranked by how many
pixels differ. Then side-by-side crops, and the shapes' sizes and weights read in the browser. Also look
for shapes he drew **outside** the named groups: the tub faucet and the fridge handle sat loose on the
layer, and only a search for loose shapes found them. Illustrator rounds to one decimal place, so FINE
0.25 comes back as .2: a weight that changed for real is one that rounding can't explain (the dining
set at .3).
What he changed, now in the drawer and symbols:
- **Beds:** the pillows fill the band above the sheet, with an even margin; the sheet's corner is
  turned down at the right as an open fold about 18 in square (not a closed shape: a Z draws a diagonal
  across the bed).
- **Vanity basins** have softly rounded corners. **The double vanity has no faucets.**
- **Round sink:** the faucet is an outlined spout from the wall and the drain an open ring (was a solid dot).
- **Tub:** a faucet at the drain end, a spout with a handle each side, over the rim.
- **One-bowl kitchen sink:** a faucet at the back (spout and two handles); the drain sits lower.
- **Refrigerator:** a small handle on its front.
- **Dining table and its chairs at 0.3** (`DINING_LINE`, and `SYMBOL_WEIGHT.chair`: the importer turns
  his heaviest weight into THIN, so a symbol he wants lighter needs that override).
- **Sectional:** the back and cushion seams are open lines, so no white fill hides a seam.
- **Symbols re-imported:** the lounge chair is redrawn; the cars are navy now (they were cyan); the
  ranges have lost the small rings on their back burners (one is left on the 6-burner's back right,
  as he drew it: ask him); the toilet and chair outlines are adjusted.
- **The example page** at the bottom was the test studio, whose made-up sizes drew fixtures out of
  proportion and a WIC with no walls. It is now the skill's worked example (555 W59 PHC), a real plan
  traced at its own scale.
- Unchanged, despite showing in the pixel diff: the brick-patio swatch (Illustrator only moved its
  origin), the labels, the stair break, the closet dashes.

## 2026-10-27: 366 N 3rd St FIRST FLOOR v2 (rebuilt with the 2nd-floor lessons)

- **Revising one floor of a hand-edited job: run the maker in a scratch copy.** It moves every other
  version's files to the archive, so a v2 run in the job folder would have swept Matt's hand-edited v1
  2ND FLOOR out of Unbranded/. Copy the job's `Design/plan.json` to `tmp/<x>/Floorplan/Design/`, run
  there, and copy only that floor's `v<N> - <LEVEL>` files across. Archive the old `plan.json` first.
- **`clean_solids.py` collapsed the outside walls on a busy plan.** Its edge snapping chained near values,
  so a group drifted across a whole wall. A group now spans at most the tolerance. Always check the
  cleaned walls against the raw trace (red lost, green added) before using them.
- **Read grid crops by their printed labels, not by row offsets.** Several first readings were off by
  the crop's origin. Measure windows by scanning the wall centre for gaps instead (exact ends, and
  pane splits where the source shows mullions).
- **`flush` needs a probe point where a window opens behind the fixture** (a tub or a bed under a
  window): find the wall face beside the window, and keep the fixture's own centre along the wall.
- **Label pass on both PNGs.** A label clear on the Unbranded sheet can touch a bed or a wall on the
  Branded one (smaller plan, same type size). Check both. A label never goes on the far side of a
  wall from its object (WET BAR first landed in bedroom 3).
- **Room labels take `"backing": true`** for a white box behind them (an elevator's X).
- Done on this floor from the 2nd-floor list: wall-to-wall vanity where the source's line runs on,
  glass showers with a tray and X, balcony posts, rail and balusters, walking lines, dashed flights
  above, nosings. No French doors on this floor (its swings are casement windows).

## 2026-10-27: full scan of Matt's 2ND FLOOR edits against a fresh regeneration

How: copy `Design/plan.json` to a scratch `Floorplan/Design/`, run the maker there, then
`node scripts/floorplan/compare-edits.js "<his.svg>" "<regenerated.svg>" tmp/cmp` (red only in his
file, blue only in ours). Then put the two renders side by side, crop by crop. His file is Illustrator output rounded to one
decimal place, so a 0.25 stroke comes back as .2 or .3: **compare shapes, not weights under 0.1.**
What he changed:
- **French doors get glazing in the wall opening.** Each leaf has a window frame across the wall's
  thickness (outer box plus an inner pane), like the `window` symbol, with the leaf and swing outside.
  Our French doors had the swings only.
- **Balcony rail and posts.** A thin double-line rail on the open sides, a square post at each outer
  corner (one with an inner square, as the source draws it), and the bottom rail broken where the source
  breaks it. Ours was a bare outline.
- **A missed low wall.** A thin wall drawn as an outline (not solid) runs from the west wall across the
  living room and turns down to the balcony wall. The tracer skips outlined walls: look for every
  double-line wall in the source and draw it as `lines`.
- **Counters follow the source's outline.** Both ends of the kitchen run step: the west end is a
  deeper return, the east end turns down along the wall. One box per run is wrong where the source steps.
- **Vanity counter runs the full wall.** The source's counter-front line runs from wall to wall with the
  sinks in it, so the counter does too (this overrides "ended where the source's counter ends" when that
  line runs on).
- **Stools are drawn.** He added four stools at the island; the library has no stool, so he used the
  dining-chair shape. Draw them with `chair` rather than leaving them out.
- **Labels:** POWDER moved below the door's swing; ELEVATOR centred in its box with a white backing
  over the X; BALCONY moved to the middle of the balcony.
- **Armchairs** re-angled into tidy pairs (rot 45 / 315 matched across each pair).
- **The sectional's back line** extended along the bottom too.
- **He removed** a stray horizontal at the foot of the stair.
- **Still open:** a red circle on the left end of the primary bath's window. Ask Matt what it marks.

## 2026-10-27: Matt's hand edits to the 2ND FLOOR svg (what he changed, so the next plan comes out that way)

His edited file is `Unbranded/366 N 3rd St, Surf City v1 - 2ND FLOOR.svg` (saved from Illustrator 10:59). **Never run the maker on a version Matt has hand-edited: it overwrites his file. Any regeneration is the next version.**

- **Scan Matt's edits against our file, every time.** After he hand-edits a floor, diff his SVG against a fresh regeneration (scratch folder, never over his file) and learn from each difference before the next floor. Done for the 366 N 3rd 2ND FLOOR (section above).
- **Room names (now a validator warning):** a bathroom is `BATH` when it has a shower or tub and `POWDER` when it does not (so no TOILET, BATHROOM or POWDER ROOM); the owner's suite is `PRIMARY`, never `MASTER` (PRIMARY BEDROOM, PRIMARY BATH, PRIMARY CLOSET).
- **Stair linework is 0.2 (0.0025 in), finer than the 0.5 of other thin lines.** Lines now take `"w": 0.2` for the stair's rails, treads, walking line, break line and the dashed flight above.
- **Labels fit their room.** He moved room labels to sit clear of walls and fixtures, and gave a label that sits on a crossed box (ELEVATOR) a white background. Check every label on the PNG; consider a white backing for labels over an X box.
- **Furniture:** he only lined the chairs up better; the layout, which follows the architect's plan, was right.
- **Missed (to catch next time):**
  - glazing on the French-door openings, left and bottom walls: the source draws window panes beside and in the leaves, not just the swing;
  - the foundation and columns around the balcony (the corner posts and the rail lines);
  - a section of wall at the bottom right (Matt flagged it with a question mark; confirm which one before assuming);
  - checking my cleaned walls against the raw trace for lost pieces: `clean_solids.py` drops slivers, so diff the raw and cleaned wall rasters and look at anything over a few hundred pixels.
- **Library symbols Matt will redraw:** bed, side tables (nightstand), sink, toilet, couches (sofa, armchair, sectional), stove (range) and windows. Wait for his returned style sheet (SKILL.md, "changing the house style") before relying on them; until then expect them to look rough.

## 2026-10-27: 366 N 3rd St, 2ND FLOOR review (Matt, page by page)

- **Traced walls need cleaning before they are used.** Raw `trace-walls.py` masses had gaps, edges a few pixels off from the next wall and little nubs. Run them through `scripts/floorplan/clean_solids.py` (snap, union, drop nubs) and measure every opening (`gap`: both ends and the wall's centre and thickness) and every fixture (`flush`) against the cleaned wall raster, not by eye. Never hand-place an opening's ends.
- **Toilets, counters and vanities sit flat on the wall face.** Compute the face from the wall raster; a fixture centred by eye leaves a gap.
- **Measure fixtures at their real size** (a toilet is about 90 x 142 px at 54 px/ft; a double vanity ended where the source's counter ends, not at the room edge). Sinks and the shower must match the source's drawing: the shower is a glass box with an inner tray and an X, drawn with `glass` walls plus `lines`, not the plain crossed-box fixture.
- **One range is one range.** A 48" range is a single `range` the width of its space (216 px), not two 30" ranges. The library has 4 or 6 burners only; use 6 and say so.
- **Furniture:** when the architect's plan draws it, bring it in from the library (bed, nightstands, armchairs, sectional, coffee table, dining table, sofa) at the source's placement and size; leave out what the library lacks (stools). Armchairs are about 100 x 108 px; the sectional's `w` is the long back run and `h` the whole extent, `rot` 90 puts its back on the right.
- **Labels we do not use:** OVEN'S. Leave the box, drop the label.
- **Stairs are not a pile of treads.** Read the whole stair: the walking line (it climbs, then turns), the flights and their rails, the break line, and the dashed flight that runs above the cut (here it crosses the master closet). Dashed treads are `lines` with `dash`.
- **Second pass on the 2ND FLOOR (Matt: "you missed a bunch still"):**
  - Read each thing as the source draws it, not as the nearest library item. The living-room sectional is a U with a round-ended arm and a thin outer back line, drawn as `lines`; the library `sectional` is only an L. Use a library symbol only when its shape is the source's.
  - Count every cell of a cabinet run. The oven bank was one box in the plan but two cells (oven, then a plain cabinet) down to the fridge.
  - One door per opening: the pantry showed two swings in the source but is one door. Do not draw the second swing.
  - Do not invent arrows. The stair's walking line ends at the break mark with no arrowhead; the direction is the UP label and the line's path.
  - Stairs take their own zoomed pass at 3x, in two crops: lay out the rails (double lines, with their end caps), each flight's own tread positions (they are not evenly spaced), the break line with its jog and `>` mark, and every dashed line above the cut. Compare with the overlay before moving on.

## 2026-10-27: 366 N 3rd St (NJ architect PDF, three floors)

- **The plans in these PDFs are pictures** (only dimension lines are vector). Render each plan at 216 dpi (54 px to the foot at 1/4" = 1'-0") and give every level `unitsPerFoot: 54`.
- **`trace-walls.py` drops big parts of a plan when thin grid lines or dimension ticks join the wall masses** (its small-bump trim then removes real walls). Fix: make a copy of the render keeping only dark runs at least 9 px thick (`skimage.morphology.opening`), then trace that copy. Light-grey partitions (value about 196) need `--dark 222`; shadows are about 242.
- Columns drawn as a square with a round post are dropped by the tracer; add them as a square plus a round hole.
- Casement windows are drawn as a thin V or triangle outside the wall; French doors as arc-and-leaf pairs. Do not mix them up.
- Lines are not counted when the all-floors sheet is laid out: an exterior stair drawn as `lines` ran off its floor's canvas and under the title. Add a `floor` area (no pattern) over it.

## 2026-10-27: skill audit before the first real jobs

- **The prompt now carries the job's `Address:` and `Facts:`** (beds, baths, half baths, and the size
  outside NYC). In the test rounds the address had to be typed in by hand, and an agent guessing it
  from the label is how a header goes wrong.
- **The all-floors sheet is built:** a home on several floors gets one sheet with every floor at one
  scale, plus a sheet for each. Floors from separate pictures need `unitsPerFoot`.
- **Matt's two cars are in** (`car`, `car-2`), split from his garage drawing.
- Rules that had come up three times moved out of here: the door angles (`plan-format.md`), doors by
  points and thin partitions the tracer misses (`sources.md`), researching north (`sources.md`).
- Agents in the test rounds often stopped before writing "Checked against the source". The run is
  not done until it is written (SKILL step 7).

## 2026-10-27: Matt's answers after the real-plan tests (rounds 2-5)

- **Scale:** Matt fills the artboard with the plan. The drawer already fits it as large as the box allows.
- **Compass on every branded sheet:** when the source has none, research the building's orientation and
  set `north` (plan-format). Leave it `null` only when it can't be found, and say so in `missing`.
- **Several floors:** Matt makes one sheet with every floor on it, and a separate sheet for each floor.
  The maker writes both.
- **Labels:** `BI` is always written `BUILT-INS`.
- **Cubicasa:** its door gaps are drawn as doors with their swings. Hatched masses (a chimney, a
  fireplace) are solid blocks.
- Rounds 2-5 fixed in the scripts: walls lifted from the picture, the frame measured off Matt's sheets,
  the compass placed in empty space with an upright N, white-filled windows, dashes over counters,
  doors given by points (`hinge`, `into`), `--cut` for fixtures fused to walls.

## 2026-10-26: real-plan test, round 1 (six of Matt's jobs, two element audits)

Six of Matt's real jobs were run from the source he was given and compared with what he made:
435 E57, 347 W Broadway, 225 E79 PHA, 241 E76, 401 E89 (picture sources) and 929 Park (Cubicasa).
- **Walls traced by hand were the biggest failure:** missed walls, centre lines 10-30 px off, one weight
  where Matt keeps the source's (6-18 pt). Walls now come straight from the picture (`trace-walls.py`).
- **The branded frame was wrong on every sheet.** It is now measured off seven of Matt's: the cyan fading
  down to white, the address street over unit when long, the bar, the letter-spaced facts (half baths and
  size on a second line), the approx. note centred with a hyphen, no logo, the compass at the bottom
  centre, ALTERNATE or CURRENT bottom right.
- Sizes print exactly as the source gives them (13' x 24', never padded to 13'0" x 24'0"), with curly
  marks. Names break where the source breaks them. Terraces are white; bath tile is light cyan.
- **What Matt adds that the source lacks** (fixtures in a Cubicasa plan, renamed rooms, a second level,
  CL labels, sizes) comes from sales agents' requests (Matt, 10-26). Never learn it as house style, and
  never add it unless the prompt asks.

## 2026-10-26: Matt's review of his symbols, round 4

- **Filled outlines traced point by point look wrong.** The first centre lines followed the skeleton
  pixel by pixel: hundreds of points, gaps at every junction, shortcuts across corners. `centreline.py`
  now joins junctions where their lines meet, drops spurs, carries a line that stops short onto its
  neighbour, chains lines straight through junctions, keeps sharp corners and fits the rest with a
  few smooth curves. Check the result at large size before handing it back. `mirror` (exactly
  symmetrical: the toilet, the lounge chair) and `merge` (cushions drawn edge to edge) are map options.
- **Best of all is stroked art.** Ask Matt to send strokes, not "Outline Stroke" shapes: those import
  exactly, with no tracing.
- **One weight rule for his symbols:** the symbol's own outline is THIN, every detail inside it FINE.
  A thin filled frame or ring counts as a line, and a solid bar becomes its outline. The range
  handle was a solid bar, so its ends didn't match.
- **Symbols keep Matt's proportions.** They are scaled to the box's width, along the wall, with their
  back on the wall. A range measured shallower than his drawing is no longer squashed.
- The dining chair was redrawn clean by hand: its seat lines crossed the cushion roll. Dining chairs
  tuck a third under the table, which is drawn over them.
- Sofa and sectional seat edges are one line, so their inside corners join.
- A straight wall's free end no longer carries an extra point.
- The first car was retired (Matt's two new cars came 10-27). The old rod-and-hangers cell is gone
  too: `rod` draws Matt's clothes 1.

## 2026-10-26: Matt's style sheet, round 3

- Matt returned the sheet with his own car, closet clothes (3 variations), three pro ranges (2 × 2,
  2 × 3, 2 × 3 with a griddle), an elongated toilet, a compass, a dining table with his chair, and a
  terrace lounge chair. None was to scale or at house weights. They are now `symbols.json`, at true
  size and house weights, and the drawer uses them.
- **Swapped:** patio brick is now the basket weave, roof brick the running bond.
- **Stairs past the break line are dotted.**
- His toilet and lounge chair were filled outlines (Illustrator "Outline Stroke"), which no stroke
  weight can fix. The importer turns such art into centre lines. His car was an image trace with
  18,000 points, thinned to about 1/10 of a point at plan size, and its filled area was checked
  against his original (19.1% against 19.2%).
- The compass "N" was live Avenir LT Pro Black text. Avenir isn't on file, so it was outlined in
  Nunito Sans Black. If Matt wants Avenir, he outlines the N in Illustrator (Type > Create Outlines).
- His symbols have a front, so `rot` matters. The 555 W59 range was drawn facing the wall until his
  symbol showed it.

## 2026-10-26: house-style decisions from Matt

- Matt is reviewing every element on the style sheet (`scripts/floorplan/style-sheet.js`). Apply his
  returned sheet as SKILL.md describes.
- **Fireplaces all differ:** never one fixed symbol. Trace each from its source.
- The sheet now includes: rectangular shower, 4- and 6-burner ranges, swatches (tile, patio brick,
  roof brick), the stair break line (the "lightning bolt", needed often), and furniture at true size
  (beds king to twin, nightstands and side tables, sofas, a sectional, coffee, dining and plain
  tables). Matt draws his own car, compass and closet clothes into the empty boxes.

## 2026-10-26: Matt's review of the pilot (v3 → v4)

Matt: "Across the board accuracy is 100000% the most important thing here, detail specific." v3 had
many errors. Each one, and the fix:

- **Closets, cabinets and the REF box had no outlines.** Always draw every closet, cabinet, counter,
  built-in and appliance box the source draws. Only furniture is left out.
- **Curved walls were choppy** (straight pieces). Walls now take `via` and draw as true arcs. The
  curved corners on this plan are curved windows.
- **Walls had odd gaps.** Some walls didn't reach each other, and corners were drawn as separate
  blocks. Walls meeting end to end on the same point now draw as one line with clean corners, so
  make every corner share its point exactly.
- **The bath looked wrong.** The toilet, sink and shower were guessed from a busy corner and didn't
  sit against their walls. Measure every fixture off the grid and set `rot` so its back is flush on
  its wall. There are now better toilet, vanity and round-sink symbols, and a drain in the shower.
- **The fireplace didn't match.** It is now the source's shape: a firebox narrow at the back, opening
  wide into the room.
- **Sliding and pocket doors were missing.** Look for the thin panel at a wall end, or the white slot
  in a wall. This plan has two, at the bedroom and at the bath.
- **The trace was read off a scaled-down view.** That put every coordinate about 12% off. Always
  trace in the picture's real pixels, and prove it with the overlay.
- **What made v4 right:** zoomed views with a coordinate grid (`sources.md`), a generator script, and
  the red/navy overlay, repeated until nothing red was left. The overlay caught a missing wall mass
  over the shower, which a by-eye check had missed.
- **Questions you can answer yourself, don't ask:** a bare `15'` is written `15'0"`; a curve is a
  curve; a busy area means measure closer.

## 2026-10-26: pilot on the sample plan, v1 to v3 (555 W59 PHC, `tools/showsheet/sample/floorplan.jpg`)

The worked result is `scripts/floorplan/fixtures/555-w59-phc.json`.

- **A source in the old GVC style** (navy header, GVC lockup, compass, "FIRST FLOOR" title) is just a
  picture. Take `north` from its compass (upright = `0`), and leave the header, logo and floor title
  behind.
- **"FIRST FLOOR" with a stair going UP but only one floor supplied:** draw that floor with `name: null`
  and say in `missing` that the upper floor wasn't given. Never draw a floor you weren't given.
- **A wraparound terrace:** trace the terrace's outer edge, then come back along the unit's outside
  wall through the same points as the walls (curve points included). The first pass took a shortcut
  across the curved corners, and the shading left a stray diagonal line.
- ~~Curved corners as 4 short walls~~: replaced by true arcs (`via`), see Matt's review above.
- **A size printed as `15'`** has to be written `15'0"` for the validator. Note it in `uncertain`.
- **Small labels next to walls** (a CL beside a closet door) were placed on top of the wall on the
  first pass. Always check the PNG for labels touching linework, and nudge them into the space.
- **Tracing in the picture's own pixel coordinates** (y down) worked well. A small Python generator
  that appended walls and openings kept the wall indexes for the openings right.
- **Found and fixed in the maker:** a new version used to leave the previous version's files in
  `Unbranded/` and `Branded/`. It now archives the same layout's other versions, so those folders
  hold only the current plan.

## 2026-10-26: audit of the last ten NYC plans (from the design)

- The hand-drawn plans varied inside the same frame: room labels from 3.4 to 10.5 pt, different wall
  weights and colours, three compass styles, and terraces sometimes shaded and sometimes not. This is
  why the style is fixed in `style.js` and must never be adjusted for one plan.
- 333 E43 and 310 W99 contain a pasted picture rather than a drawing. Treat files like these as
  picture sources.
- References used to be thrown away, so nothing could be redrawn the same way twice. Leave every
  reference in `Design/`, and list each one in `sources`.
- The NJ architect PDFs (806 Riverview, 366 N 3rd) are colour pictures cut into strips, with lawns,
  furniture and cars. Their words are real text, and they give room names but no sizes.
- The Hamilton phone screenshot is cut off. A source like that gets drawn only as far as it goes,
  with the rest listed in `missing`.
