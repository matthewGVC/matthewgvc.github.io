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
- `test-listing.js` — the Showsheet's Word-document reader and its money math

Node + Playwright — `cd scripts && npm install`:

- `shoot-heroes.js` — re-screenshot both project heroes into `projects/*/hero.webp`
- `reshoot-gvc.js` — the same, for the GVC team site only
- `make-png.js` — regenerate the monogram PNG favicons from `assets/logos/monogram.svg`
- `check-svgs.js` — render-check the monogram and lockup SVGs
- `verify-local.js` — load every page on localhost:8080 and fail on console errors,
  uncaught errors, SRI blocks, missing files, missing chrome or sideways scroll.
  Needs `cd scripts && npm install` once; exits non-zero, so it is worth running
  before a publish

## Showsheet tool

`tools/showsheet/` is a listing-showsheet generator (drop a `.docx`, photo, and
floorplan → print-ready A5 or US Letter). The page is `index.html`; what it reads
out of a listing — the Word document and the money fields — is `listing.js`, kept
apart so `scripts/test-listing.js` can run it without a browser. It shares the
editor styles (`assets/css/builder.css`), image handling (`assets/js/images.js`)
and the logo files in `assets/logos/sheet/` with the other builders. A sample listing lives in
`tools/showsheet/sample/` (555 W59th PHC — `listing.docx`, `hero.jpg`,
`floorplan.jpg`); drop those three onto the tool to see a fully populated sheet.
There is no button that loads them for you: one is described in older notes but
was never wired up. Needs the site served over http (fetch can't read `file://`
siblings).

## Docs

- Design spec: `docs/superpowers/specs/2026-06-10-gvc-workspace-site-design.md`
  (local only — `docs/` is gitignored, so it does not ship with a clone)
