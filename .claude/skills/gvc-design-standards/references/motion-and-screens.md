# Motion and office screens

The office TVs play these loops for hours. Calm beats clever. Each piece must loop without a visible seam.

## Pipeline (summary)

Full detail: `exports/office-screens/source/README.md` (the pieces, the source files, the 3D rules).

1. Each renderer is a pure function `RENDER[name](ctx, W, H, p, portrait)` with `p` in [0,1) as loop phase, so frames are deterministic.
2. Build the page from the template, then render through headless Chromium piped to ffmpeg: one continuous H.264 encode per video (High@5.1, CRF 15, 30 fps, yuv420p). Do not split a video into chunks; each join shows a bump.
3. Finish, then run the checks in `exports/office-screens/source/checks/` (`seam.js`, the stills `shoot.js` / `shoot4k.js`, and the contact sheet `sweep.js`; for any 3D piece also `../overlap.js`). Run `seam.js` after every change.
4. Output delivered as 4K. Matt wants only 4K files in the delivery folder: no test copies, no thumbnails cluttering `v03`.
5. Site page `tools/office-screens/` plays all loops live. Regenerate `screens.js` with `site_build.py` when a renderer changes.

## Loop rules

- Every moving term completes a **whole number** of cycles per loop. Use `(p*2)%1`, not `(p*1.6)%1`. A lattice that drifts exactly one row flips its row offset at the seam; drift two rows.
- A seam should differ by about the same amount as an ordinary frame-to-frame step. Measured in the encoded MP4 it is roughly 0.2–0.3 out of 255, which is normal keyframe noise, not a cut.
- Particles drift; they never burst. Keep motion slow.
- One move at a time, big shapes. Matt pushed back twice on Quarter Turns and once on Panels for being busy and random. A piece that reads as a noisy pattern needs fewer elements, not more.
- Texture on simple pieces is welcome: blur, overlays, long-exposure trails, halftone, reeded glass, fine grain. Matt likes this on simple shapes. Use a fixed, seeded grain (no flicker) to prevent banding.

## Layout rules

- Keep essential content inside the **8% safe area** on every edge.
- Label type for reading across a room: 7.5–10.5% of screen height in landscape.
- Compose landscape and portrait **separately**. Landscape moves sideways; portrait stacks and moves vertically. Do not just rotate a landscape render.
- Draw text and lines on a surface inside its face draw, not in a post-pass.

## Brand marks

- Monogram: `assets/logos/monogram.svg` (5 paths, viewBox `603.7 329.9 792.7 1340.3`). Draw from the SVG paths at uniform scale. Only the monogram may be taken apart into layered planes.
- Lockup: `assets/logos/sheet/lockup-sky.svg` (37 outlined paths). Always whole, never split.
- Douglas Elliman badge: `assets/logos/sheet/badge-de.svg`. At least one or two pieces in a set carry the DE line, smaller than the GVC mark and outside its clear space.
- Clear space: one quarter of the monogram's height; for the lockup, the height of its word THE.
- Minimum size at 4K: monogram 160 px tall; lockup 1,400 px wide in landscape, 1,600 px in portrait.
- Colours: Bone or Sky on Navy; Navy on Paper; one accent. See `palette-and-type.md` for the full set.

## Copy on screens

Approved words only: the three state names (NY, NJ, FL), the capability labels, and the team name as spelled in the lockup. Do not invent taglines, statistics or claims about what GVC stands for. Anything new needs Matt's OK.

## Delivery and review

- Start a set with 5–7 short treatments shown in a live concept preview in both orientations. Matt picks; then polish and render the picks only.
- Matt's standing requests on sets: use all five colours; include a Paper-ground piece; keep the lockup intact; no busy random patterns.
- Open items: which TVs (unknown; keep delivering H.264 4K30 plus 1080p and pre-rotated portrait test copies if asked).
- Nothing from the office-screens project is committed to git; `exports/` is gitignored.
