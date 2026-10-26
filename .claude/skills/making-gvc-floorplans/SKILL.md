---
name: making-gvc-floorplans
description: Use when a prompt says "Use the making-gvc-floorplans skill" or asks to make, redraw or correct a job's floorplan in the GVC Workspace repo (matthewgvc.github.io) - turning a reference in a job's Floorplan\Design folder (Cubicasa SVG or PNG, another brokerage's plan, a screenshot or scan, an architect's PDF, a DWG or DXF) into the standard GVC plan, saved as SVG + PNG in Floorplan\Unbranded and Floorplan\Branded.
---

# Making GVC floorplans

## Overview

Every GVC floorplan comes out looking like it was drawn by the same hand, whatever the source looked
like. You don't draw anything yourself. You **read** the reference and write a plain description of
it (`Design/plan.json`). Then one fixed script (`scripts/make-floorplan.js`) draws it in the house
style, saves the SVG master and a PNG copy, and archives whatever it replaces. All the style lives
in `scripts/floorplan/style.js`. **Never change a size, weight or colour to make one plan look
better.** If the house style itself is wrong, that's Matt's decision and a separate change.

Matt opens this chat by pasting the prompt from the job page's **Make Floorplan** button:

```
Make the floorplan for <label> (<market>, <sale|rental>, <beds> bed / <baths> bath).

Floorplan folder: G:\Shared drives\...\<job>\Floorplan
References in Design\:
- <file> (modified <date>)
Save as version v<N>.

Use the making-gvc-floorplans skill.
```

He does not approve anything before you save, so the checks in step 7 are the only review the plan
gets. Work from the repo root. The scripts need `scripts/node_modules` (`npm install --prefix scripts`
once, if it's missing).

Files beside this one:
- `plan-format.md`: every field of `plan.json`, with worked examples.
- `sources.md`: how to read each kind of reference.
- `lessons.md`: what earlier runs learned. You add to it.

## Hard rules

- **Accuracy is the job, down to the detail.** Every wall, jog, column, chimney mass, window pane,
  door and its swing, pocket or sliding door, closet, cabinet, counter, appliance box, fixture, stair
  tread and label in the source is in the plan, in the same place. "Close enough" is a failure. Matt
  checks the result against the source, and so must you, with the overlay (step 7).
- **Never invent.** Draw no wall, room, size, fixture or label that isn't in the source. If the
  source gives no sizes (the NJ architect PDFs), the plan shows names only. If the source is cut off,
  draw what is there and list the rest in `missing`, or stop and tell Matt when too little is there
  to be useful.
- **No source branding** in the output: no Compass, Cubicasa or agency logo, disclaimer, address,
  title block, "TOTAL sq ft" line, watermark, or old GVC header or compass. The branded frame comes
  from the script alone.
- **Write only inside this job's Floorplan folder** (`Unbranded/`, `Branded/`, `Design/`). Never
  move, rename or edit the files at the top of the Floorplan folder. They are Matt's past
  Illustrator outputs. Never open, name or touch deal paperwork (contracts, offers, exclusives,
  closings, anything `assets/js/drive-rules.js` treats as paperwork), and never write in the SSDG
  folder.
- **Never delete or overwrite.** The maker moves anything it replaces to `Design/archive/<date>/`.
  Leave references in `Design/` where Matt put them.
- **The facts come from the prompt.** Pass the prompt's beds and baths to the maker. If the prompt
  has none, pass none. Never read them off the source picture.

## The process

1. **Read `lessons.md`** before anything else.
2. **Check the folder.** Make sure it exists and that `Design/` holds the references the prompt names.
   Create `Unbranded/` and `Branded/` if they're missing (the maker also creates them). Skip
   paperwork. If a reference named in the prompt is gone, say so and use the ones that are there.
3. **Identify each reference** and read it, following `sources.md`: a Cubicasa SVG (read its
   geometry), a DWG or DXF (convert it first), an architect PDF (vector or picture, floor-plan pages
   only), or a picture. Look at every reference yourself. For a PDF or SVG, render it to a PNG and
   view that. **Measure; don't eyeball.** Make zoomed views of each part with a coordinate grid
   (`sources.md`, "Measuring a picture"), and read every coordinate off the grid, in the picture's
   real pixels.
4. **Several references:**
   - One file per floor becomes one level each, named the way the source names them ("FIRST FLOOR").
   - Two files of the same floor: use the newest and name the other in the report. Never merge them.
   - A file is an **alternate** layout only when its name says alt, alternate or option. It gets its
     own `plan.json` with `"layout": "alternate"`, run separately (see "Alternates" below).
5. **Write `Design/plan.json`** (`plan-format.md`). Then validate it until it is clean:
   ```
   node -e "const r=require('./scripts/floorplan/plan.js').validate(require(process.argv[1]));console.log(JSON.stringify(r,null,1))" "<Floorplan folder>\Design\plan.json"
   ```
   Fix every error. Read every warning: "label is wider than its room" means use the standard
   abbreviation (BATH, CL, WIC, W/D, PDR) or move the label beside the room. **Never make it
   smaller.** Write everything you left out in `missing` and everything you guessed in `uncertain`.
6. **Run the maker** with the prompt's version and facts:
   ```
   node scripts/make-floorplan.js "<Floorplan folder>" --version <N> --facts "{\"beds\":2,\"baths\":2}"
   ```
   (Leave out `--facts` when the prompt gives no beds or baths. Use `0` beds for a studio.) It
   writes `<label> v<N>.svg` and `.png` (and `… - <Level>` for each level) into `Unbranded/` and
   `Branded/`, and archives older versions of the same layout. It also writes `Design/run-v<N>.md`.
7. **Check the result against the source**, in two passes.

   **a. The overlay. Required, and repeated until it is clean.**
   ```
   node scripts/floorplan/overlay.js "<Floorplan folder>\Design\plan.json" "<the picture you traced>" "tmp\overlay.png"
   ```
   The overlay draws your plan in navy with the source over it in red. Where they agree the lines
   go black. **Red with nothing under it is something you missed or misplaced. Navy on its own is
   something that isn't in the source.** Zoom into each part of the overlay and fix every one. Thin red
   edges along walls are fine: they are only the house style's wall weight against the source's.
   The overlay needs a picture traced in its own pixels. For a PDF or SVG, overlay the PNG you
   rendered and traced.

   **b. By eye.** Open the Unbranded PNG and the source and compare them:
   - every room in the source is in the drawing, with the same name and the same size;
   - every closet, cabinet, counter and appliance box is outlined;
   - curved walls are smooth curves;
   - corners join cleanly, with no gaps;
   - every door, window and opening is on the right wall and swings the right way;
   - the outline and the terraces match;
   - no label sits on a wall or on another label;
   - nothing from the source's branding is left, and nothing was invented.

   Open the Branded PNG too: the header holds the address and facts, and the compass appears only
   when the source showed one. If anything is wrong, fix `plan.json` and run the maker again with
   the **same** version (it archives the earlier attempt). Then add a `## Checked against the source`
   section to `Design/run-v<N>.md`, listing what you compared and what you fixed.
8. **Record the version** in the `floorplans` table, so the job page's version list stays one list.
   Use the Supabase MCP (project `hoszxrrlfhzbbrzenqvp`). Find the job with
   `select id, drive_folder from properties where label = '<label>'`. If more than one row comes back,
   use the one whose `drive_folder` matches the prompt's folder path. Then:
   ```sql
   insert into floorplans (property_id, version, layout, note, geometry_path)
   values ('<id>', <N>, 'current', 'Made from <reference names>', 'Floorplan/Design/plan.json');
   ```
   (`layout` is `'alternate'` for an alternate.) If the MCP can't be reached from this account, skip
   this and say so in the report. The file names already carry the version.
9. **Learn.** Did this run meet something new, such as a new kind of source, a new abbreviation, a
   way of reading that worked, or a mistake you or Matt caught? Then add a dated line at the top of
   `lessons.md`. When the same lesson has come up three times, move it into this file or
   `sources.md` and delete it from the lessons. A lesson is a repo change, so follow Matt's rule:
   branch → run `node scripts/test-floorplan-plan.js` → `merge --no-ff` to `main` → push. Never
   force-push.
10. **Report to Matt** in plain words, short:
    - what was made and where it was saved (the folder path);
    - anything missing or uncertain in the source;
    - anything you skipped (a second reference, the database row);
    - what you added to the lessons.

## The style sheet (changing the house style)

`node scripts/floorplan/style-sheet.js "<out.svg>"` writes every element the drawer makes at true
size, each in a group named after it: walls, windows, doors, bath and kitchen fixtures, furniture,
swatches, stairs, areas, labels and the branded frame. Its last section is empty boxes for Matt's
own artwork (a car, the compass, closet clothes). Matt edits that file in Illustrator and hands it
back. To apply it:
- Compare each group in his file with a freshly generated sheet.
- Make the changes in `style.js` (weights, sizes, colours, angles) or in the element's drawing
  function in `draw.js` (shapes).
- Regenerate the sheet and check it matches his.
- **Matt's drawings are the symbols.** Cells named `symbol-<name>` hold his artwork, drawn from
  `scripts/floorplan/symbols.json`. Read his edits straight back with
  `node scripts/floorplan/import-symbols.js "<his sheet.svg>"`, which picks up every `symbol-*` group.
  New artwork drawn anywhere else on the sheet needs a map (see the script's header): where it is,
  which way to turn it so its wall side is at the top, and its true size. The importer:
  - flattens Illustrator's transforms;
  - sets the house weights (his heaviest strokes become THIN, the rest FINE) and colours;
  - turns art drawn as filled outlines into centre lines (that step needs `pip install scikit-image`);
  - thins out traced artwork.

  After importing, regenerate the sheet, check his symbols look like his drawing, and run
  `node scripts/test-import-symbols.js`, which proves the sheet round-trips.
- Read his NOTES layer.
- Run the floorplan tests, then redraw the worked example and check it.

A house-style change affects every plan from then on, so it is only ever made from Matt's sheet or
his explicit say-so.

## Corrections in a later chat

When Matt says something like "the W/D is in the wrong closet":
- Edit `Design/plan.json`.
- Run the maker with the **next** version number. A correction is a new version, and the maker
  archives the old one.
- Check it as in step 7, record the version (step 8), and add the lesson.
- If Matt hasn't said which version is current, read the highest `v<N>` in `Unbranded/` and the
  `floorplans` rows.

## Alternates

An alternate layout gets its own description. Matt's references stay where he put them. Move the
current layout's `Design/plan.json` aside first, as `Design/plan-current.json`, then write the
alternate's `Design/plan.json` with `"layout": "alternate"`. Run the maker with the same version
number as the current layout and record it with `layout 'alternate'`. Then put the current plan back
as `Design/plan.json`. Alternate files are named `<label> v<N> Alternate…`, and the maker never
archives the current layout's files when it saves an alternate, or the reverse.
