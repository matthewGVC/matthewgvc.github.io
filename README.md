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

Node + Playwright — `cd scripts && npm install`:

- `shoot-heroes.js` — re-screenshot both project heroes into `projects/*/hero.webp`
- `reshoot-gvc.js` — the same, for the GVC team site only
- `make-png.js` — regenerate the monogram PNG favicons from `assets/logos/monogram.svg`
- `check-svgs.js` — render-check the monogram and lockup SVGs
- `verify-local.js` — load the site on localhost:8080 and report console/SRI errors

## Showsheet tool

`tools/showsheet/` is a self-contained listing-showsheet generator (drop a `.docx`,
photo, and floorplan → print-ready A5). A sample listing lives in
`tools/showsheet/sample/` (555 W59th PHC — `listing.docx`, `hero.jpg`,
`floorplan.jpg`); drop those three onto the tool to see a fully populated sheet.
There is no button that loads them for you: one is described in older notes but
was never wired up. Needs the site served over http (fetch can't read `file://`
siblings).

## Docs

- Design spec: `docs/superpowers/specs/2026-06-10-gvc-workspace-site-design.md`
  (local only — `docs/` is gitignored, so it does not ship with a clone)
