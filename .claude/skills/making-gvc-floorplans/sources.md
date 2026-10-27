# Reading each kind of source

Whatever the source, the output is the same `plan.json`. Every source carries something that must
**not** reach it: logos, disclaimers, title blocks, area totals, dimension arrows, furniture, lawns,
cars, an old header or compass. Read the plan and leave all of that behind.

Work in a scratch folder (the repo's `tmp/`, which git ignores) for renders and helper scripts.
Never write those into the job's folder.

## Measuring a picture

Never read coordinates off a picture by eye at normal size. Cut it into zoomed views with a grid,
then read the numbers off the gridlines. Save this as `tmp/grid.py` and run it with `python -I`:

```python
# grid.py <image> <out> x0 y0 x1 y1 [zoom]: a zoomed crop with a 10 px grid, labelled every 50 px
import sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7]); k = float(sys.argv[7]) if len(sys.argv) > 7 else 3
im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1))
im = im.resize((int((x1 - x0) * k), int((y1 - y0) * k)), Image.NEAREST)
d = ImageDraw.Draw(im, 'RGBA')
for x in range((x0 // 10 + 1) * 10, x1, 10):
    X = (x - x0) * k; major = x % 50 == 0
    d.line([(X, 0), (X, im.height)], fill=(255, 0, 0, 110 if major else 40))
    if major: d.text((X + 2, 2), str(x), fill=(220, 0, 0, 255))
for y in range((y0 // 10 + 1) * 10, y1, 10):
    Y = (y - y0) * k; major = y % 50 == 0
    d.line([(0, Y), (im.width, Y)], fill=(255, 0, 0, 110 if major else 40))
    if major: d.text((2, Y + 2), str(y), fill=(220, 0, 0, 255))
im.save(out)
```

1. One overview of the whole plan (zoom 0.75 to 1) to find where everything is.
2. Then views of about 350 × 300 px at zoom 2.5 to 3, covering the whole plan: every corner, every
   wall run, the kitchen, each bath, the closets and the stair. For each wall, read both faces and
   take the middle as its centre line. Read where each window, door, closet and fixture starts and
   ends.
3. Write the plan with a generator script (the `555-w59-phc.gen.py` pattern). Then run the overlay
   (SKILL step 7) and zoom into it the same way.

## Pictures: Cubicasa PNG, other brokerages (Compass, outside agencies), old plans, screenshots, scans

1. Check the picture's real pixel size, and use its pixel coordinates as plan units.
2. **Lift the walls straight out of the picture; never trace them by hand.** Matt's plans keep each
   source's own wall masses, thick where it is thick (his walls run from about 6 pt to 18 pt), with
   the windows and doors set into gaps in them. `trace-walls.py` gives exactly that:
   ```
   python -I scripts/floorplan/trace-walls.py "<picture>" tmp/walls.json --preview tmp/walls.png [--crop x0,y0,x1,y1] [--erase x0,y0,x1,y1] [--cut x0,y0,x1,y1]
   ```
   Every dark part at least a wall thick becomes a solid, in the picture's own pixels, its edges made
   exactly level and plumb. Look at the preview: navy is what it kept. Use `--crop` to leave out the
   source's header, logo, compass and footer, `--erase` for a bold label or a fixture's thick bar
   that came through as a mass of its own, and `--cut` (a box cleared before tracing) for one fused to
   a wall: a toilet's tank, a sink's box or a door swing drawn thick against it. Draw the box round
   the fixture only, not the wall, and never erase a hole of a mass to close a gap: a window or door
   goes across the gap as an opening. Copy its `solids` into the level as they are: the solids are the walls.
   **Then compare the preview with the source, partition by partition.** A wall drawn as thin as the
   source's linework (a closet side, a shaft, a glass screen, often 2-4 px) can't be told from a line,
   so the tracer leaves it out, and it says so when many runs sit just under its cut. Add each one it
   missed as a `walls` entry (`interior`, or `glass`) on its centre line. Those are the only `walls`
   in a traced plan.
3. Add the openings across the gaps the masses leave, each a **free opening** with the two ends of
   its gap and the wall's thickness there: `{"type": "window", "a": [x, y], "b": [x, y], "t": 20}`
   A door takes `"hinge": [x, y]` (a point at its turning end) and `"into": [x, y]` (a point in the
   room it swings into), read straight off the source, and `outside`. Wrong door sides were the
   commonest error in the test rounds; points can't be backwards. A hole the tracer leaves where a
   window sits is the window's gap: keep it and draw the window across it; never fill it. The tracer
   trims Cubicasa's marker triangles and a label's letters off a wall's face; anything else fused to a
   wall is cleared with `--cut`. Then the closets and
   cabinets, the fixtures, the terraces and the stairs. Go room by room, and in each room list
   everything the source draws before you write it, so nothing is skipped.
4. Draw what the source draws and nothing more: a plain box is a box (a `counter` or `lines`), never a
   bed or a sofa because of where it sits; a fixture type only where the source draws that fixture.
   Read every label and size exactly as printed, its punctuation too (`CL.` stays `CL.`), except `BI`,
   which Matt always writes `BUILT-INS`: `13' x 24'` stays `13' x 24'` (the drawer prints it
   with curly marks). A name the source sets on two lines is written with a line break,
   `"LIVING\nROOM"`. When a size can't be read, leave it out and say so in `uncertain`. Never
   estimate it from the drawing.
5. A **screenshot or phone capture** may be cropped or skewed. If part of the plan is off the edge,
   draw what is there and list the rest in `missing`. If the picture is too small to read, stop and
   ask Matt for a better copy.
6. An **old GVC plan** (navy or gradient header, GVC lockup, compass, "FIRST FLOOR" title): take the
   compass angle for `north` and the floor title for the level name only when there are several
   levels. Leave the header, logo and address behind.

## North, when the source has no compass

Every branded sheet carries the compass, so work out which way is north. Never guess.
- **A label on the source** naming a street or an avenue beside a wall ("PARK AVENUE", "E 71ST ST")
  ties that wall to the street.
- **The listing** (the job's `listingUrl`, or the brokerage's page for the address) often shows the
  exposures ("south and west"), or a plan with a compass.
- **The address on a map.** Find which side of its block the building stands on, then which wall of
  the plan faces its street (the entry, the windows, a terrace). Manhattan's grid is turned: its
  avenues run about 29° east of true north, so "uptown" (the avenue, north on the grid) is 29° and a
  plan drawn with uptown at the top has `north` about 331. Outside Manhattan, read the street's own
  direction off the map.
- Say in the run note how you found it. If none of these settles it, leave `north` `null`, list it in
  `missing`, and tell Matt.

## Cubicasa SVG

The SVG is already a drawing, so read its geometry rather than the picture:
- Walls are filled paths and polygons. Use their coordinates as plan units.
- Room names and sizes are `<text>` elements. Copy them exactly, converting curly quotes to straight
  ones.
- Leave behind what the old converter (`tools/floorplan/floorplan.js`) strips. These are its proven
  rules, copied here so they outlive that tool:
  - **footer and disclaimer text:** any text containing `CUBICASA`, `cubicasa`,
    `FLOOR PLAN CREATED BY`, `MEASUREMENTS DEEMED`, `EXCLUDED AREAS`, `sq. ft` or `TOTAL:`;
  - **dimension arrows:** the small `<polygon>`s whose `points` (spaces removed) contain
    `-5,5,0,0,5,5`, `-5,-5,0,0,-5,5`, `-5,-5,0,0,5,-5` or `5,5,0,0,5,-5`, and the dimension lines
    they end;
  - **white blocks:** any element filled white (`#ffffff`, `#fff`, `white`) whose stroke is none,
    transparent or white. These are Cubicasa's masks, not plan geometry.
- Render the SVG to a PNG and view it before and after, the same way as a picture.
- **Doors:** Cubicasa draws a door as a plain gap, with no leaf or swing (its small triangles are
  dimension arrows, not doors). Draw every gap that is a door (a room's or a closet's entry) as a door
  with its swing, 45° inside and 90° to the outside (Matt, 10-27). A passage with no door stays an
  `opening`. The same goes for a Cubicasa PNG.

When the first Cubicasa SVG has gone through this process, add a lesson. That is also the trigger to
retire `tools/floorplan/` (tell Matt; it is a separate change).

## Architect PDFs

1. Look first: render each page with PyMuPDF and view it:
   ```
   python -I -c "import fitz,sys; d=fitz.open(sys.argv[1]); [p.get_pixmap(dpi=110).save(sys.argv[2]+f'/page{p.number+1}.png') for p in d]" "<pdf>" "<tmp folder>"
   ```
2. Take **only the floor-plan pages**. Skip the site plan, elevations, sections and schedules. One
   page per floor becomes one level.
3. Check how the page is built: `page.get_drawings()` (real vector lines) against
   `page.get_images()` (pictures).
   - **Vector:** read the wall lines from the drawings.
   - **Pictures** (the NJ examples, 806 Riverview and 366 N 3rd, are colour pictures cut into strips,
     with lawns, furniture and cars): trace the rendered page the way you would a picture.
4. The words are usually real text, so read room names exactly with `page.get_text("words")`.
   Architect plans usually **give no room sizes**. The plan then shows names only. Never measure
   sizes off the drawing.

## DWG and DXF

- A **DXF** is text. Read its `LINE`, `LWPOLYLINE` and `ARC` entities, taking walls from the wall
  layer (often `A-WALL` or similar) and room names from `TEXT` and `MTEXT`. A short script in the
  scratch folder does this.
- A **DWG** is binary and must be converted to DXF first. Use the free ODA File Converter
  (opendesign.com, "ODA File Converter"). Check whether it's installed. If not, **stop and tell Matt**
  which converter to install and why. When it is set up, record the install path and command line in
  `lessons.md`.
- Render the result to a PNG and check it against any picture or PDF of the same plan.

## Clean joints (Matt circles them)

Walls, windows and fixtures must meet exactly: at his zoom a tenth of a point shows. Build them so:
- **Clean the traced masses** with `scripts/floorplan/clean_solids.py` (`clean`): edges snap together,
  pieces union, nubs go, and `square` turns a chamfered corner or a jogged wall end square.
- **Measure on the cleaned raster.** `band` gives a wall's true centre and thickness; measure an
  opening's thickness on both sides of the gap and use the thinner, so a frame never stands proud.
- **Square the wall ends at every opening** once the openings are known:
  `solids = C.square_ends(solids, openings)`, then make the raster again before placing fixtures.
- **Fixtures flat on the wall face:** centre = face - direction x h/2, unrounded (no half-pixel margin).
  A run of boxes along a wall (cabinets, the fridge) takes the wall face from the raster.
- **Lines that meet a wall run to its face:** a stair's outer rail, a newel post. Read the face off the
  raster, not the picture.
- **Keep each job's generator in `Design\gen\`** beside its traced walls (`walls-*.json`), reading them
  from its own folder, with a `buildall.py` that writes `Design\plan.json` and a `rebuild.sh` that runs it
  and the maker. A rebuild is then one command: `bash "<Floorplan>\Design\gen\rebuild.sh" <version>`.
