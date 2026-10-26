# Floorplan lessons

What earlier runs learned. **Newest first, one dated line each.** Read the whole file before every
run. When a lesson comes up a third time, move it into `SKILL.md` or `sources.md` and delete it here.

## 2026-10-26: house-style decisions from Matt

- **Doors:** 90° for any door leading outside (terrace, balcony, the front door to the hall), and 45°
  for every interior door. Mark outside doors `"outside": true`.
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
