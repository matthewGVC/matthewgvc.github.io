# matthewgvc.github.io

GVC Workspace — tool hub. Matt Bloomfield, for The GVC Team (Douglas Elliman).

Static site, no build step. GSAP via CDN.

## Local preview

    python -m http.server 8080
    # open http://localhost:8080

## Deploy

Push to `main`. GitHub Pages serves the repo root.

## Content updates (added by later plans)

- `scripts/build_photos.py` — regenerate web-optimized property photos
- `scripts/build_icons.py` — regenerate the icon library from the scan pipeline

## Showsheet tool

`tools/showsheet/` is a self-contained listing-showsheet generator (drop a `.docx`,
photo, and floorplan → print-ready A5). The bottom "Load preview" button loads the
bundled sample in `tools/showsheet/sample/` (555 W59th PHC) through the real import
pipeline, so the demo always reflects the current code. Needs the site served over
http (fetch can't read `file://` siblings).

## Docs

- Spec: `docs/superpowers/specs/2026-06-10-portfolio-site-design.md`
- Plans: `docs/superpowers/plans/`
