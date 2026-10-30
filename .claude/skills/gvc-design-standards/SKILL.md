---
name: gvc-design-standards
description: Use when designing, restyling or building any GVC Workspace output: a tool under tools/, a printed listing sheet, brochure, buyer or seller package, showsheet, signage, destination guide, NJ footprint, office-screen loop, a workspace page (workspace/), or any page or deck for GVC. Use before writing styling or layout, and when a request says make it look better, polish, redesign or match the brand.
---

# GVC design standards

## Overview

GVC Workspace is one editorial system: navy ink on paper, one restrained accent, a well-set print spread. Every output (site page, tool, printed PDF, TV loop) must read as the same team's work. The product is the printed page or the screen the client sees, so judge by that output, not by the source.

Core principle: **restraint, real content, and a print that is right.** A polished output carries real facts in a calm layout. Decoration never substitutes for content, and a change must never invent a fact to fill a gap.

This skill sets the rules. For the wiring of a new tool (head, shell, panel, tests) use `building-gvc-tools`. For reviewing finished work use `gvc-design-review`.

## Step 1: Identify the surface before touching styles

Each surface uses a different token set and different rules. Find the row first.

| Surface | Tokens | Type | Market rules | Extra rules |
|---|---|---|---|---|
| Site page or site tool UI (`tokens.css`) | `--ink`, `--paper`, `--sky`, `--cyan`, `--bone`, `--ink-soft`, `--rule`, `--danger` | Fraunces display, Nunito Sans caps labels, Raleway body, JetBrains Mono meta | Shared chrome | 16px gutter at 640px and below, no sideways scroll at 375px |
| Printed page inside a builder (`builder.css`) | `--navy`, `--sky`, `--sky2`, `--ow`, `--page`, `--ui-rule`, `--ui-ink-soft` | Playfair Display `--serif`, Nunito Sans `--sans`, Raleway `--body` | NJ, NYC and FL each independent | Letter or A5 (see the print reference) |
| Office TV loop (canvas) | Same five GVC colours | Labels 7.5–10.5% of screen height | Not market-based | Landscape and portrait composed separately |
| Frozen output | Do not restyle | | | See "Frozen and standing decisions" |

Read `references/palette-and-type.md` before choosing any colour or type size.

## Non-negotiables

These are rules, not preferences. Each one exists because it broke something before.

1. **Tokens only, no new hex.** Use the token that already exists for the surface. Older tools carry hard-coded hex in `<style>`; do not copy them. `check-tools.js` warns on them and that is expected.
2. **Use all five GVC colours across a set.** Navy `#00273A`, Sky `#53C7DC`, Cyan `#00A1C4`, Bone `#E5E5E5`, Paper `#EFEDE8`. Earlier office-screen rounds leaned on Bone and Sky over Navy and read as one-note. A set gives Cyan real presence and includes at least one Paper-ground piece with Navy ink.
3. **Contrast is a hard rule.** Sky is never text on Paper (1.7:1). Cyan is text only on Navy (5:1); on Paper it is decorative only. Body text on Paper uses Navy or `--ink-soft`.
4. **Navy ink on paper, one accent.** Sky is for hairlines, hover and active states.
5. **Fonts come from `assets/css/fonts.css` only.** Tools never link Google Fonts: variable fonts print as Type3 outlines and fail the embed check. The listing rules page and the 404, which never print, are the only exception. (The old Cubicasa converter, `tools/floorplan/floorplan.js`, still writes a Google Fonts `@import` into the SVG it exports: a known leftover in an exported file, not a printed page.)
6. **Real content only.** Names, figures, quotes, testimonials, referral partners, towns, regions, taglines and form fields come from a real source. If the source is missing, show a visible stamp (see `references/copy-and-content.md`). Never fill a gap with plausible sample data, and never present a Claude-made grouping as established.
7. **Boilerplate is fixed.** The lockup, the Douglas Elliman legal footer and the team QR codes are never editable fields.
8. **Images are verified.** No low-resolution images. Stock only when verifiably of the stated place, from Pexels or Unsplash with the photo ID in a code comment. Never publish a "Check License First" image. Where a real photo is needed and missing, stamp it; do not draw a stand-in that looks like a photo.
9. **Markets stay independent.** A change for NJ must not move NYC or FL output. NJ is the design reference for all markets, but a parity pass is a deliberate, separately reviewed change.
10. **Print is the product.** A printed page is finished only when the PDF is right: no half-empty page, nothing past the edge, fonts embedded, no overflow. Check both paper sizes the surface supports.
11. **Accessibility.** WCAG AA contrast, `:focus-visible` sky outlines, tap targets of at least 40px on mobile, full `prefers-reduced-motion` support, one visually-hidden page `h1`, labels linked to controls (`field-labels.js`).

## Voice and avoiding the generic look

The brand is restrained, editorial and precise. It is not a SaaS landing page. Headings name the actual thing ("Buyer package: New Jersey", not "Your journey starts here").

Do not use:
- taglines, mottos or invented claims ("Work, made useful.")
- decorative eyebrows or meta text on every section ("GVC Real Estate · Tool")
- gradient text (`background-clip: text`), hero-metric templates, identical card grids, glassmorphism by default, rounded-everything, icon-grid filler

Bold choices are welcome when they are deliberate and few: a large serif headline, a strong grid, generous margins, one big shape, one accent moved at a time. Matt has asked for bold, deliberate motion (one move at a time, big shapes), not busy random patterns.

Refine a design in two passes at most. First make it correct and complete, then make one elevation pass against the checklist in `references/elevation.md`. Stop when the next change is taste, not a defect, and say so.

## Frozen and standing decisions

These are settled. Do not re-propose them or restyle them unless Matt asks.

- The showsheet's `.sheet` output is print- and pixel-verified and frozen: change it only when Matt asks, and then diff it against the print baseline at A5 and Letter.
- NYC's boxed cost tables in the seller and buyer packages stay.
- The NJ seller deck uses NJ stock photos only, never specific home shots.
- The NYC buyer packet keeps Don't Forget to Ask and the FAQs.
- The seller Professional Videos page keeps its justified-text spacing.
- Placeholder stamps stay visible until real content arrives. Do not clear one without the real data.

## Small calls and what to ask about

Decide small layout and data-mapping calls yourself, pick the sensible option, and mention it in one line at most. Matt has said "make these decisions yourself."

Ask before acting on anything that changes the live site's content for clients, adds or changes a stamp's claim, touches another person's work, or needs a source only Matt holds.

## Workflow

1. **Scope.** Name the surface (Step 1 table) and the markets it prints for.
2. **Functional first.** Build the correct, complete version using existing tokens and components. Use `building-gvc-tools` for a new tool's wiring.
3. **One elevation pass** against `references/elevation.md`.
4. **Verify** with `references/print-and-verify.md`. For tools: `node scripts/check-tools.js <slug>` must show no FAIL lines (a new tool should print `<slug>  ok`, no warnings either), then the local checks. For printed output: PDF from Chromium at every paper size, a Safari print check by hand (Playwright cannot make a Safari PDF), and the other markets' PDFs diffed against `main` when a shared file moved. The `gvc-design-review` skill has the capture script.
5. **Sweep** what you touched for dead CSS, dangling `getElementById` lookups and unreferenced files (see the standing dead-code practice in memory).
6. **Report** what changed, the judgement calls made (one line each), and every open stamp.

## Git and data hygiene

- Work on a branch. Teammates send a pull request; Matt merges his own work to `main` after verifying (per `CLAUDE.md`). Never force-push.
- Never commit MLS exports or anything with owner or client personal data. `exports/` is gitignored; scratch lives in `tmp/`.
- Delete temp files and merged branches after the work ships, as Matt has asked.
- Keep "Claude" out of workspace docs and client-facing copy.
- If the Edit tool hangs in this workspace (it has before, and auto-opens files in the browser pane), make small exact-match Python replacements through Bash instead, asserting that the old text occurs exactly once. Stop and tell Matt if a tool hangs repeatedly.

## Quick reference

| Need | Where |
|---|---|
| Colours, contrast, type stack, token names | `references/palette-and-type.md` |
| Print sizes, PDF checks, WebKit, pixel diff | `references/print-and-verify.md` |
| TV loops, seamless motion, safe area, brand marks | `references/motion-and-screens.md` |
| Stamps, never-invent list, copy voice, image sourcing | `references/copy-and-content.md` |
| Pre-delivery design checklist and elevation moves | `references/elevation.md` |
| Tool shell, wiring, test lists | `building-gvc-tools` skill |

## Common mistakes

| Mistake | Fix |
|---|---|
| Sky used as body text on Paper | Navy or `--ink-soft` on Paper; Sky on Navy or as a hairline |
| Copying a hex from an old tool's `<style>` | Use the surface's token |
| Filling a missing testimonial, referral or figure with plausible text | Stamp it, ask for the source |
| "Improving" the showsheet or NYC cost tables | Frozen; leave them |
| Restyling NJ and changing NYC/FL output as a side effect | Diff the other markets' PDFs against `main` |
| Google Fonts link added to a tool | `fonts.css` only |
| Only checking the screen | Check the printed PDF at every supported paper size |
| Gradient text, glass cards, hero metric | Rejected by the brand; use a plain type hierarchy |
| One accent colour across a whole office-screen set | Use all five colours; include a Paper-ground piece |
