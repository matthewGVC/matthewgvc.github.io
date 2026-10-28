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
- `check-tools.js` — every tool against the house conventions (head, fonts, SRI, panel,
  labels, homepage tile, test lists); `node scripts/check-tools.js <slug>` for one
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

`tools/nj-footprint/` is a two-page, print-ready US Letter sheet — where the team
sells in New Jersey, with counts and dollar volume. It has no editor panel: the
sheet draws itself from `transactions.js` (one row per sale), and `footprint.js`
does the arithmetic. The rows are the team's 106 closed NJ sales from the MLS (TJ, James
and Marli). The front page is NJ by county and the back is a Monmouth + Ocean
town-by-town map; `?view=towns` gives a no-figures version. After replacing rows, run
`node scripts/test-nj-footprint.js`.

## Signage tool

`tools/signage/` makes the team's For Sale sign (24 x 30 in: up to two agents and a QR, as the sign files
in GVC - Marketing > GVC - For Sale Sign) and the Open House arrow sign (24.4 x 18.4 in, left or right).
Standalone the choices are kept in `localStorage`; opened from a job it makes the For Sale sign with the
job's agents and listing QR and saves through the helper (Slice 6). Tests: `scripts/test-pdf-render.js`.

## Postcards tool

`tools/postcard/` makes a two-sided 6 x 9 in Just Sold or For Sale postcard, at
Vistaprint's 9.21 x 6.21 in bleed size or at trim size. Everything is typed or dropped in
(photos are not saved; the words are, in `localStorage`); agents come from the roster.
The back keeps its lower right clear for the mail house. Tested by `node scripts/interact-local.js postcard`.

## Brochure tool

`tools/brochure/` builds a property brochure, printed at 8.5 x 11 or 5.5 x 8.5 in (toggle under the
preview). Photos are dragged onto the pages; the panel has the gallery layout and crops, the property
facts, floor plans (two per page) and up to two agents. The property bar at the top of the panel saves
the facts and the brochure, photos included, to the shared property library (team password) and loads
them back. Opened from a job (`?listing=<slug>`), `job-mode.js` fills it from the job instead.
Print / Save PDF prints it.

## Seller Pitch & CMA tool

`tools/seller-package/` builds an 8.5 x 11 listing presentation and CMA: a classic or guide page
design, a per-agent version, the property, the client and cover, comparable sales, the listing
strategy, professional videos, client testimonials and up to two agents. It saves and loads through the
same property bar as the Brochure. Opened from a job (`?listing=<slug>` or `?pitch=<slug>`),
`job-mode.js` takes the subject, comps, agents and photos from the job. Print / Save PDF prints it.

## Buyer Package tool

`tools/buyer-package/` builds the 8.5 x 11 buyer packet: the process, the costs and the questions to
ask, for New Jersey, New York City or Florida. The panel picks a per-agent version, the page design,
the cover market and title, photos, which pages show, the New Jersey offer and negotiation text and up
to two agents. Nothing is saved: the page asks before you leave with changes, and Print / Save PDF is
the output. The copy lives in `guide-data.js`.

## Useful Agent Info tool

`tools/agent-info/` prints the agent's own crib sheets: "Don't Forget to Ask", "FAQ's" and a draft
Buyer Cheat Sheet (marked Check, not for use until reviewed). Pick the market (NJ, NYC, FL) and the
pages; there is nothing to type and nothing is saved. The copy comes from
`tools/buyer-package/guide-data.js` through `assets/js/agent-pages.js`.

## Properties tool

`tools/properties/` is the shared property library's own page, behind the team password. It lists every
property, archived ones included, with what has been built for each, its photos and when it was
updated. Here you can rename a property, change its status (active, coming soon, sold, archived) and
"Free up photos", which deletes that property's photo files (the facts and saved documents stay).
It shows how much of the 1 GB photo storage is used.

## Floorplan Converter tool

`tools/floorplan/` turns a CubiCasa floorplan SVG into a GVC-branded SVG: navy palette, Nunito Sans
labels, CubiCasa footers and dimension arrows removed, named layers, ready for Illustrator. Drop the
SVG, compare Converted and Original, then download `<name>_gvc.svg`. It runs in the browser
(`floorplan.js`); nothing is uploaded or saved.

## Watermark tool

`tools/watermark/` adds a Virtually Staged or Virtually Renovated label to listing photos. Drop photos
or a folder, pick the label, the corner and the size (50 to 200%), then Download saves each photo as
`<name>-virtually-staged` (or `-virtually-renovated`), as JPG or PNG to match. It runs in the browser;
nothing is uploaded or saved, and the page asks before you leave with photos loaded.

## Map Studio tool

`tools/map-studio/` places numbered pins for a list of addresses on a 3D Mapbox map, with a legend,
and exports a PNG (`gvc-3d-property-map.png`) at a chosen shape. It needs a Mapbox access token, typed
into the page. Opened from a job (`?pitch=<slug>` or `?listing=<slug>`), `job-mode.js` maps the job and
its comps, remembers the token on that computer, and the owner can save the map to the job through the
helper. The page asks before you leave with unexported changes.

## Feet & Inches Calculator tool

`tools/calculator/` adds or subtracts measurements in feet and inches and shows the total as feet and
inches, total inches and decimal feet. Nothing is saved.

## Office Screens tool

`tools/office-screens/` previews the looping motion pieces for the office TVs, each in landscape and
portrait, drawn live by `screens.js`. There is a Pause / Play button. The finished 4K videos are not on
the site.

## Docs

- Design spec: `docs/superpowers/specs/2026-06-10-gvc-workspace-site-design.md`
  (local only — `docs/` is gitignored, so it does not ship with a clone)

## To-do tool

`tools/todo/` is Matt's to-do list (the team can see it; internal, not indexed). It mirrors `docs/todo.md` via `python scripts/sync_todo.py` (see the script). Rows live in the Supabase `todos` table (migration `0003_todos.sql`), behind the team sign-in. Tested by `node scripts/interact-local.js todo`.
