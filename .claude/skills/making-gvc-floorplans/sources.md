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
2. Trace the outline, then the walls. Exterior walls are the thick outer and demising walls; interior
   walls are the thinner ones. Long straight dark runs are walls. If the picture is large or busy, a
   short script (Python with PIL, run with `-I`) can find them: scan rows and columns for runs of
   dark pixels. Its numbers are a check on your reading, not a replacement for it.
3. Add the openings (gaps in the walls, door leaves and arcs, the double lines of windows, the thin
   panels of pocket and sliding doors), then the closets and cabinets, the fixtures, the terraces and
   the stairs. Go room by room, and in each room list everything the source draws before you write
   it, so nothing is skipped.
4. Read every label and size exactly as printed. When a size can't be read, leave it out and say so
   in `uncertain`. Never estimate it from the drawing.
5. A **screenshot or phone capture** may be cropped or skewed. If part of the plan is off the edge,
   draw what is there and list the rest in `missing`. If the picture is too small to read, stop and
   ask Matt for a better copy.
6. An **old GVC plan** (navy or gradient header, GVC lockup, compass, "FIRST FLOOR" title): take the
   compass angle for `north` and the floor title for the level name only when there are several
   levels. Leave the header, logo and address behind.

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
