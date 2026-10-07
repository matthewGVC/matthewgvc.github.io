# matthewgvc.github.io

GVC Workspace — tool hub. Matt Bloomfield, for The GVC Team (Douglas Elliman).

Static site, no build step. GSAP via CDN.

## Local preview

    python -m http.server 8080
    # open http://localhost:8080

## Deploy

Push to `main`. GitHub Pages serves the repo root.

## Scripts

Python — `pip install -r scripts/requirements.txt`:

- `build_photos.py` — regenerate web-optimized property galleries from the
  sibling Personal Photo Editing Project folder
- `publish_photos.py` — build the galleries, then commit and push to `main`
- `test_build_photos.py` — unit tests for the gallery builder

Plain Node, no install — each exits non-zero on a failure:

- `test-property-model.js` — the shared property model (units, merges, resets)
- `test-area-data.js` — the ranking claims in the area datasets ("fastest", "slowest") against their own figures
- `test-destination-guide.js` — destination-guide POIs, source links, coordinates, and required page data
- `test-listing.js` — the Showsheet's Word-document reader and its money math
- `test-nj-footprint.js` — the NJ Footprint sales list (counties, agents, prices) and its totals

Node + Playwright — `cd scripts && npm install`:

- `shoot-heroes.js` — re-screenshot both project heroes into `projects/*/hero.webp`
- `reshoot-gvc.js` — the same, for the GVC team site only
- `make-png.js` — regenerate the monogram PNG favicons from `assets/logos/monogram.svg`
- `check-svgs.js` — render-check the monogram and lockup SVGs
- `verify-local.js` — load every page on localhost:8080 and fail on console errors,
  uncaught errors, SRI blocks, missing files, missing chrome or sideways scroll.
  Needs `cd scripts && npm install` once; exits non-zero, so it is worth running
  before a publish
- `interact-local.js` — click through every editor control on every tool (sections, buttons,
  dropdowns, checkboxes, sliders, awkward text), print each to PDF, and fail on any error.
  `node scripts/interact-local.js brochure` runs one tool. A tool's own "text runs past the
  page" warning is listed, not failed
- `dnd-local.js` — drag photos around the brochure, seller pitch, buyer package and showsheet with
  real mouse events: tray to every slot, slot to slot by the grip, slot to tray, the X buttons and
  panning. Uses six solid-colour photos so it can tell which photo landed where, and fails if a
  photo ever shows in two places

## Showsheet tool

`tools/showsheet/` is a listing-showsheet generator (drop a `.docx`, photo, and
floorplan → print-ready A5 or US Letter). The page is `index.html`; what it reads
out of a listing — the Word document and the money fields — is `listing.js`, kept
apart so `scripts/test-listing.js` can run it without a browser. Its editor panel
uses the builders' shared `assets/css/builder.css`; photo and floorplan handling is
`assets/js/images.js`, shared with the Brochure; its logos are files in
`assets/logos/sheet/`, read once at startup and placed inline.

A sample listing lives in `tools/showsheet/sample/` (555 W59th PHC — `listing.docx`,
`hero.jpg`, `floorplan.jpg`); open "Listing files" and drop those three onto the tool
to see a fully populated sheet. There is no button that loads them for you (an older
one was retired). Needs the site served over http (fetch can't read `file://`
siblings).

## Destination Guide tool

`tools/destination-guide/` builds a sourced, print-ready US Letter regional
guide. Its first complete dataset is Monmouth County. Guide facts, POIs, map
coordinates, team picks, and source URLs live in `guide-data.js`; the page
renderer and editor are separate so research can be corrected without touching
the layouts. The preview supports live cover/welcome edits, session-only image
replacement, an optional Team Favorites page, JSON handoff, and Print / Save
PDF.

## NJ Footprint tool

`tools/nj-footprint/` is a one-page, print-ready US Letter sheet — where the team
sells in New Jersey, with counts and dollar volume. It has no editor panel: the
sheet draws itself from `transactions.js` (one row per sale), and `footprint.js`
does the arithmetic. **The rows there are currently Marli Silver's sales only**, read
from her public Zillow profile with approximate dates, and the page prints a "Draft"
stamp. To finish it, paste in the full MLS list (TJ, James, Marli), set
`NJ_DRAFT_NOTE = ''`, update `NJ_SOURCE`, and run `node scripts/test-nj-footprint.js`.

## Docs

- Design spec: `docs/superpowers/specs/2026-06-10-gvc-workspace-site-design.md`
  (local only — `docs/` is gitignored, so it does not ship with a clone)
