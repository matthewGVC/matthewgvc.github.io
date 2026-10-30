---
name: building-gvc-tools
description: Use when adding a new tool, builder, sheet or page under tools/ in the GVC Workspace repo (matthewgvc.github.io), or when changing an existing tool's head, shell, side panel, print setup, saved state or Tools page entry.
---

# Building GVC tools

## Overview

GVC Workspace is one system: every tool is the **shared shell** (head, chrome, tokens,
builder or plain page, collapsible panel, print) plus **one tool script**. A new tool
copies the shell from `templates.md` exactly and spends its effort on the tool script.
"Done" means the printed PDF is right (print tools), or the tool works at phone width and
in WebKit (everything else), not that the page loads.

Read `PRODUCT.md` (brand, content rules) and `CLAUDE.md` (git rules) once per session.
Every file in `assets/js/` opens with a comment explaining its API and wiring: read the
header of each shared module before you call it.

## 1. Before any code

Use superpowers:brainstorming. These questions are the minimum: skip a row only when it
plainly doesn't apply (no print, no property). Ask whoever asked for the tool; brand,
data-source and library questions go to Matt. **In a hurry, send them as one message and
build once answered.** Never guess them:

| Question | Why it matters |
|---|---|
| What does it print? Paper size, page count, which markets (NJ / NYC / FL)? | Picks the shell; markets stay independent |
| Where does the content come from? Columns, copy, figures? | **Never invent** names, figures, quotes, partners, towns, form fields. Missing → a visible stamp ("List needed") |
| Does it read or save a property from the library? | Saving needs its slug in `TOOLS` (§4) |
| Where does each QR code point? | Team QR is fixed; a tool's own QR (listing, form) is a field |
| Tools page section: Listing pieces (made from a job), Team, or Utilities? | Where it is listed |

Record the answers in `docs/specs/YYYY-MM-DD-<slug>-design.md`.

**Start from the team's own recent designs, not a fresh restyle.** If the tool makes
collateral the team already produces by hand (postcards, sheets, social posts), find the
**most recent** examples on the shared drive (`G:\Shared drives\GVC - Marketing\02 - Assets\...`,
sorted by date folder) and match their layout, hierarchy and fixed copy (taglines, team
paragraph, legal). Render them with PyMuPDF and pull exact text, sizes and colours from
`page.get_text('dict')`. A "cleaner" house-style reinterpretation was sent back once
(Postcards, 2026-10-15): the recent cards are the brief.

## 2. Pick the shell

| Tool kind | Shell | Reference tool |
|---|---|---|
| Prints pages (sheet, package, guide) | Builder: `#app > aside#editor + #stage + #stageBar`, `builder.js` | `tools/agent-info/` (smallest), `tools/postcard/` (with roster data) |
| Converter / calculator, no print | Plain page: `main.page > .page-head + .app`, `components.css` | `tools/calculator/` |
| Full-height canvas with sidebar | `.mapstudio > aside.sidebar` | `tools/map-studio/` |

Take the **markup from `templates.md`**, not from the reference tool. Older tools carry
drift (hex values, missing SRI, a second `<main>`); `node scripts/check-tools.js`
lists it. Never copy a pattern from a tool that check-tools flags for it.

## 3. Wiring: every slot is required

- [ ] `tools/<slug>/index.html` (add `<slug>.js` / `.css` beside it only past ~800 lines of script)
- [ ] Head, body and script order exactly as `templates.md`
- [ ] `panel-collapse.js` **and** `field-labels.js` after the tool script (any side panel / any form control)
- [ ] `unsaved.js`: `GVC_UNSAVED.watch()` after first render; `touch()` after drags, crops, and other changes that don't fire an input event
- [ ] Listed on the workspace's Tools page (`workspace/tools/index.html`), in the right section
- [ ] Test lists: `verify-local.js` `PAGES`, `interact-local.js` `ALL`, and `dnd-local.js` `TOOLS` (`'<slug>': '#fileInputId'`) if photos are dropped
- [ ] `README.md`: a `## <Name> tool` section, 2–4 lines: what it makes, where its data lives, its test
- [ ] A tool that makes a piece from a job: an entry in `helper/pieces.js` (the PIECES list, with its page), and its tool name allowed by migration 0017 (`piece_requests`)

Reuse before you write: agents `roster.js` (`GVC_PICKER`), legal footer `legal.js`, QR `qr.js`,
images `images.js`, photo drag `photo-dnd.js`, page furniture + overflow warnings `pitch.js`,
icons `icons.js`, property library `property-library.js` (+ `property-bar.js` to save).

## 4. Rules that have bitten before

- **Colour, two token sets.** Site UI (editor panel, plain pages) uses `tokens.css`: `--ink`, `--paper`, `--sky`, `--cyan`, `--bone`, `--ink-soft`, `--rule`, `--danger`. **Printed pages** inside a builder use `builder.css`: `--navy`, `--sky`, `--sky2`, `--ow`, `--page`, `--ui-rule`, `--ui-ink-soft`. No new hex either way. Sky is never text on paper. Navy ink on paper, one accent.
- **Type:** fonts come from `assets/css/fonts.css` only (static faces, so PDFs embed them); never link Google Fonts. Printed pages use `--serif` (Playfair Display), `--sans` (Nunito Sans), `--body` (Raleway); the site's display face is Fraunces.
- **Copy:** headings name the actual thing. No taglines, mottos or decorative eyebrows ("GVC Real Estate · Tool").
- **Boilerplate:** lockup, Douglas Elliman legal and team QR are fixed, never editable fields.
- **Images:** no low-res. Stock only if verifiably of the place, with the Pexels/Unsplash ID in a comment.
- **CDN:** exact version **and** `integrity` + `crossorigin="anonymous"` (hash command in templates.md).
- **Saved state** is optional: keep only what the user would hate to retype. `localStorage` key `gvc.<slug>.<thing>`, wrapped in try/catch. Never image data URLs. **Never store client or visitor personal data** (names, emails, phones) anywhere; property addresses are fine.
- **Property library:**
  - *Reading* works for any tool: `GVC_PROPS.signedIn()`, `list()`, `load(id, '<slug>')`, `photoUrls()`. Sign-in is `GVC_PROPS.signIn(password)`, prompted from Matt's team; copy how `property-bar.js` asks.
  - *Saving* is allow-listed by `TOOLS` in `property-library.js`; add the slug there or `property-bar.js`'s Save fails with "Unknown tool". The database takes any lower-case slug (`documents_tool_check` in `0009_pieces.sql`), so a migration is needed only when the schema changes; from a second Claude account, hand Matt the SQL file.
  - Test signed-in paths by mocking `GVC_PROPS.call`; never type the team password.
- **Class names:** check `components.css` before naming a class. Watermark once inherited a retired homepage tile's border and padding by reusing its class name.
- **Other tools' folders:** don't load another tool's files; move shared data to `assets/js/`.
- **`data-foot="none"`** on full-height tools, or chrome.js adds the site footer under the app and the page scrolls.
- **Not US Letter?** Set `--pw`/`--ph` on `body` (builder.js reads the size off the body, and
  `builder.css` puts Letter on `:root`), write `@page` into a `<style id="pagesize">` you rewrite
  when the size changes, and pass `sizeLabel` to `Builder.init`. Chrome rounds the page to whole
  CSS px, so 6.21in prints as 6.207in. Reference: `tools/postcard/` (9.21 x 6.21 bleed / 9 x 6 trim).
- **Mailed pieces** carry `GVC_LEGAL.MAILER` (the "if your property is currently listed" wording)
  and keep the back's lower right clear for the mail house (about 3.9 x 2.35 in).
- **Agent not in the roster?** Look in `G:\Shared drives\GVC - Marketing\GVC - Headshots\`
  (folder names carry the title). Cut the largest portrait out with `rembg`, frame it to 1100 px
  like the others (head about 0.3–0.38 of the width, top of hair ~100 px down, torso off the
  bottom), add the row, run `node scripts/test-agent-photos.js`. A field with no current source
  (an old Corcoran email) stays blank; tools skip blanks.
- **Shared brand art:** `assets/logos/sheet/douglas-elliman.svg` (the wordmark, `currentColor`),
  `assets/img/where-we-work.png` (NY/NJ/FL map from the postcards). Inline SVGs with `fetch`, as the
  Showsheet does.
- **Comments in `<head>`:** check-tools finds the first `<body` in the file, so a CSS comment that
  says "`<body>`" fails it. Write "the body element".

## 5. Verify, in this order

```bash
node scripts/check-tools.js <slug>      # conventions: must print "<slug>  ok"
node scripts/verify-local.js            # server on :8080 first (preview_start "gvc-workspace")
node scripts/interact-local.js <slug>
BROWSER=webkit node scripts/interact-local.js <slug>   # PowerShell: $env:BROWSER='webkit'; node ...
node scripts/dnd-local.js <slug>        # photo tools only
node scripts/test-piece-build.js        # piece tools: the helper's piece build
node scripts/test-piece-page.js         # piece tools: the piece page
node scripts/test-sheet-page.js         # the showsheet page
node scripts/test-job-page.js           # the job page
```

check-tools can't see every control a script builds: if the page has inputs, load
`field-labels.js` even when check-tools passes.

interact-local types `'Long '.repeat(60)` into every field, so overflow WARN lines at the end are
expected and prove the warnings work. A warning box inside a closed `<details>` has an empty
`innerText`: read `textContent` in tests. If the browser pane refuses localhost, drive the page
with Playwright from `scripts/node_modules` against the :8080 server and `page.pdf({preferCSSPageSize:true,
printBackground:true})`, then look at the PDF (PyMuPDF render), not the screen.

Non-print tools: check the mobile preset (375px) and edge inputs (blank, zero, "$1,250,000").
Print tools: print → Save as PDF in Chromium **and** WebKit, for every paper size and market:
no half-empty page, nothing past the page edge, fonts embedded. Look at the PDF itself.
If you touched a shared file, run `node scripts/baseline.js --compare <latest date in exports/baseline>`: the other tools' printed pages must not move.
Sweep what you touched for dead CSS/ids/files.

## 6. Ship

`CLAUDE.md` decides, by who is asking:
- **Teammates:** branch → verify → show them the local preview and get their OK → commit → PR → Matt merges (§5, §7).
- **Matt himself:** branch → verify → merge into `main` and push (§6 owner exception), no PR.

Never force-push either way.

## Common mistakes

| Mistake | Fix |
|---|---|
| Added to `verify-local` but not `interact-local` | All test lists, plus `dnd-local` for photo tools |
| Forgot `field-labels.js` | Required whenever there's an input/select/textarea |
| Invented sample rows, columns or copy "to show the layout" | Stamp the gap, ask Matt for the source |
| Copied an old tool's `<style>` with its hex values | Templates + tokens only |
| Hard-coded hex or a new font link | Tokens + `fonts.css` |
| Unpinned or SRI-less CDN script | Pin + hash |
| Only checked the screen | The PDF is the product; check both engines |
| Mounted the property bar for a new tool | Read-only until Matt's migration runs |
| Redesigned collateral the team already makes | Match their most recent files on the drive first |
