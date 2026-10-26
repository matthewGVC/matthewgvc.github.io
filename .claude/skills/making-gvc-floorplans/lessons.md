# Floorplan lessons

What earlier runs learned. **Newest first, one dated line each.** Read the whole file before every
run. When a lesson comes up a third time, move it into `SKILL.md` or `sources.md` and delete it here.

## 2026-10-26: pilot on the sample plan (555 W59 PHC, `tools/showsheet/sample/floorplan.jpg`)

The worked result is `scripts/floorplan/fixtures/555-w59-phc.json`.

- **A source in the old GVC style** (navy header, GVC lockup, compass, "FIRST FLOOR" title) is just a
  picture. Take `north` from its compass (upright = `0`), and leave the header, logo and floor title
  behind.
- **"FIRST FLOOR" with a stair going UP but only one floor supplied:** draw that floor with `name: null`
  and say in `missing` that the upper floor wasn't given. Never draw a floor you weren't given.
- **A wraparound terrace:** trace the terrace's outer edge, then come back along the unit's outside
  wall through the same points as the walls (curve points included). The first pass took a shortcut
  across the curved corners, and the shading left a stray diagonal line.
- **Curved corners:** 4 short walls per quarter-circle look right at this size. Note them in
  `uncertain`.
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
