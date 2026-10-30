---
name: building-gvc-tools
description: Use when adding a new tool, builder, sheet or piece under tools/ in the GVC Workspace repo (matthewgvc.github.io), when making a tool open from a job (piece mode, the helper's Make / Rebuild), or when changing an existing tool's head, shell, side panel, print setup, saved state or Tools page entry.
---

# Building GVC tools

## Overview

GVC Workspace is the front door: `/` forwards to `workspace/` (Overview, Resell, New Dev, Errors,
Tools). Every listing, pitch and development is a **job** with its own page
(`workspace/job/?listing=` / `?pitch=` / `?dev=`). The tools under `tools/<slug>/` make the
**pieces**, and are reached two ways:

- **From a job** (piece tools): `tools/<slug>/?listing=<slug>` or `?pitch=<slug>`. The tool loads
  the job's facts, agents, photos and floorplans (piece mode), and the desktop helper makes the PDF
  into the job's Drive folder when someone presses Make / Rebuild on the job page or Make PDF on the
  piece (`piece_requests`, migration 0017).
- **From the Tools page** (`workspace/tools/`, sections Listing pieces, Team, Utilities): the same
  page with no job, everything typed or dropped in.

Every tool is the **shared shell** (head, chrome, tokens, builder or plain page, collapsible panel,
print) plus **one tool script**. A new tool copies the shell from `templates.md` exactly and spends
its effort on the tool script. "Done" means the printed PDF is right (print tools), or the tool works
at phone width and in WebKit (everything else), not that the page loads.

Read `gvc-design-standards` (brand, content rules) and `CLAUDE.md` (git rules) once per session.
Every file in `assets/js/` opens with a comment explaining its API and wiring: read the header of
each shared module before you call it.

## 1. Before any code

Use superpowers:brainstorming. These questions are the minimum: skip a row only when it plainly
doesn't apply. Ask whoever asked for the tool; brand, data-source and library questions go to Matt.
**In a hurry, send them as one message and build once answered.** Never guess them:

| Question | Why it matters |
|---|---|
| Is it a piece made from a job (it belongs in a job's kit), or a team tool / utility with no job? | Picks the wiring (§3 vs §3 + §4) |
| What does it print? Paper size, page count, which markets (NJ / NYC / FL)? | Picks the shell; markets stay independent |
| Where does the content come from? For a piece: which job facts, photos, floorplans? Otherwise: columns, copy, figures? | **Never invent** names, figures, quotes, partners, towns, form fields. Missing → a visible stamp ("List needed") |
| Where does each QR code point? | Team QR is fixed; a piece's own QR (the DE listing) comes from the job |
| Tools page section: Listing pieces, Team, or Utilities? | Where it is listed |

Write the answers into the commit message or the job's notes; there is no specs folder.

**Start from the team's own recent designs, not a fresh restyle.** If the tool makes collateral the
team already produces by hand (postcards, sheets, signs), find the **most recent** examples on the
shared drive (`G:\Shared drives\GVC - Marketing\02 - Assets\...`, sorted by date folder) and match
their layout, hierarchy and fixed copy (taglines, team paragraph, legal). Render them with PyMuPDF and
pull exact text, sizes and colours from `page.get_text('dict')`. A "cleaner" house-style
reinterpretation was sent back once (Postcards, 2026-10-15): the recent cards are the brief.

## 2. Pick the shell

| Tool kind | Shell | Reference tool |
|---|---|---|
| Prints pages (sheet, package, sign) | Builder: `#app > aside#editor + #stage + #stageBar`, `builder.js` | `tools/signage/` (smallest piece tool), `tools/agent-info/` (smallest team tool), `tools/postcard/` (non-Letter paper) |
| Converter / calculator, no print | Plain page: `main.page > .page-head + .app`, `components.css` | `tools/calculator/` |
| Full-height canvas with sidebar | `.mapstudio > aside.sidebar` | `tools/map-studio/` |

Take the **markup from `templates.md`**, not from the reference tool. Older tools carry drift (hex
values, a second `<main>`); `node scripts/check-tools.js` lists it. Never copy a pattern from a tool
that check-tools flags for it.

## 3. Wiring every tool needs

- [ ] `tools/<slug>/index.html` (add `<slug>.js` / `.css` beside it only past ~800 lines of script)
- [ ] Head, body and script order exactly as `templates.md`
- [ ] `panel-collapse.js` **and** `field-labels.js` after the tool script (any side panel / any form control)
- [ ] `unsaved.js`: `GVC_UNSAVED.watch()` after first render; `touch()` after drags, crops, and other changes that don't fire an input event
- [ ] Listed on the Tools page (`workspace/tools/index.html`), in the right section. Exempt: Map Studio (opened from a job), the redirect stubs (`tools/cma`, `tools/properties`) and archived tools (`ARCHIVED` in `check-tools.js`)
- [ ] Test lists: `verify-local.js` `PAGES`, `interact-local.js` `ALL`, and `dnd-local.js` `TOOLS` (`'<slug>': '#fileInputId'`) if photos are dropped
- [ ] `README.md`: a `## <Name> tool` section, 2–4 lines: what it makes, where its data lives, its test

Reuse before you write: agents `roster.js` (`GVC_PICKER`), legal footer `legal.js`, QR `qr.js`,
images `images.js`, photo drag `photo-dnd.js`, page furniture + overflow warnings `pitch.js`,
icons `icons.js`.

## 4. Extra wiring for a piece made from a job

A piece is registered in many small tables. The reliable way to find them all: search for an existing
piece's id (`signage` is the simplest) across `assets/js`, `helper`, `workspace`, `scripts` and
`supabase`, and add yours beside it. Today that means:

- [ ] **The tool page** exposes `window.__piece` (`state`, `sanitize`, `ready`, `set(state)`) and
      `window.__render(state)` (draws a given state with no network, then sets `window.__rendered`),
      and loads `<script src="../../assets/js/piece-loader.js" data-job="job-mode.js"></script>`
      before `panel-collapse.js`. Copy the pattern from `tools/signage/index.html`.
- [ ] **`tools/<slug>/job-mode.js`**: calls `GVC_PIECEMODE.start({...})` (the adapter's fields are
      listed in the header of `assets/js/piece-mode.js`). piece-loader loads it only when the page
      has `?listing=` or `?pitch=`, so the standalone tool never runs job code.
- [ ] **Shared tables:** `piece-job.js` (`TOOLS`, names, agents, how the job fills the piece),
      `piece-stale.js` (what makes it stale), `piece-mode.js` (`HELPER_MAKES`),
      `workspace-data.js` (its label), `job-page/kit.js` (its row and tool folder); and, when it is a
      new kit row, `kit-track.js`, `folder-health.js` (`KEYS` and folder names) and `drive-rules.js`.
- [ ] **The helper:** `helper/pieces.js` (`PIECES`: file prefix, Marketing folder, page, owners) and
      `helper/pdf/render.js` (the page with `?draw=1`).
- [ ] **The database:** `piece_requests.tool` only accepts the ids listed in migration 0017; adding
      one is a new migration. `documents.tool` takes any lower-case slug (0009). From a second
      Claude account, hand Matt the SQL file.
- [ ] **Tests:** add the piece to `test-piece-job.js`, `test-piece-stale.js`, `test-piece-build.js`,
      `test-piece-page.js`, `test-pdf-render.js`, `test-kit-track.js` and `test-migrations.js` where
      the existing pieces appear. To find every other list that names the pieces, search the repo for
      an existing piece id (`signage`): `test-folder-health.js`, `test-workspace-data.js`,
      `test-workspace.js`, `test-helper-server.js`, `test-job-page.js` and `verify-local.js` name it too.

The finished file lands in the job folder's `Marketing\<piece>\` as
`<Piece> - <Address Unit> - <YYYY-MM-DD>.pdf`; a rebuild moves the helper's own older file to
`Archive\` (`docs/folder-standard.md`). Nothing rebuilds by itself: a changed fact only marks the
piece stale.

## 5. Rules that have bitten before

- **Colour, two token sets.** Site UI (editor panel, plain pages) uses `tokens.css`: `--ink`, `--paper`, `--sky`, `--cyan`, `--bone`, `--ink-soft`, `--rule`, `--danger`. **Printed pages** inside a builder use `builder.css`: `--navy`, `--sky`, `--sky2`, `--ow`, `--page`, `--ui-rule`, `--ui-ink-soft`. No new hex either way. Sky is never text on paper. Navy ink on paper, one accent.
- **Type:** fonts come from `assets/css/fonts.css` only (static faces, so PDFs embed them); never link Google Fonts. Printed pages use `--serif` (Playfair Display), `--sans` (Nunito Sans), `--body` (Raleway); the site's display face is Fraunces.
- **Copy:** headings name the actual thing. No taglines, mottos or decorative eyebrows ("GVC Real Estate · Tool").
- **Boilerplate:** lockup, Douglas Elliman legal and team QR are fixed, never editable fields.
- **Images:** no low-res. Stock only if verifiably of the place, with the Pexels/Unsplash ID in a comment.
- **CDN:** exact version **and** `integrity` + `crossorigin="anonymous"` (hash command in templates.md).
- **Saved state:** a piece's wording, crops and layout save to the job with the piece (piece mode's
  Save sheet). Standalone, keep only what the user would hate to retype: `localStorage` key
  `gvc.<slug>.<thing>`, wrapped in try/catch. Never image data URLs. **Never store client or visitor
  personal data** (names, emails, phones) anywhere; property addresses are fine.
- **The property bar** (`property-bar.js`, saving to the property library from a standalone tool) is
  the pre-workspace way and is used only by the Showsheet, Brochure and Seller Package
  (`TOOLS` in `property-library.js`). A new tool gets its job data through piece mode, not the bar.
- **Sign-in:** `GVC_PROPS.signIn(email, password)` (per person); an empty email is the team account.
  Test signed-in paths by mocking `GVC_PROPS.call`; never type a password.
- **Class names:** check `components.css` before naming a class. Watermark once inherited a retired homepage tile's border and padding by reusing its class name.
- **Other tools' folders:** don't load another tool's files; move shared data to `assets/js/`.
- **`data-foot="none"`** on full-height tools, or chrome.js adds the site footer under the app and the page scrolls.
- **Not US Letter?** Set `--pw`/`--ph` on `body` (builder.js reads the size off the body, and
  `builder.css` puts Letter on `:root`), write `@page` into a `<style id="pagesize">` you rewrite
  when the size changes, and pass `sizeLabel` to `Builder.init`. Chrome rounds the page to whole
  CSS px, so a size that is not a whole number of px (6.21in = 596.16px) prints a hair smaller. Reference: `tools/postcard/` (9.21 x 6.21 bleed / 9 x 6 trim).
- **Mailed pieces** carry `GVC_LEGAL.MAILER` (the "if your property is currently listed" wording)
  and keep the back's lower right clear for the mail house (about 3.9 x 2.35 in).
- **Agent not in the roster?** Asana's 👋 People project is the master roster: the agent goes there
  first, then into `roster.js` (`CLAUDE.md`, "The team roster"). For the headshot, look in
  `G:\Shared drives\GVC - Marketing\GVC - Headshots\` (folder names carry the title). Cut the largest
  portrait out with `rembg`, frame it to 1100 px like the others (the roster's header says how), and
  run `node scripts/test-agent-photos.js`. A field with no current source stays blank; tools skip blanks.
- **Shared brand art:** `assets/logos/sheet/douglas-elliman.svg` (the wordmark, `currentColor`),
  `assets/img/where-we-work.png` (NY/NJ/FL map from the postcards). Inline SVGs with `fetch`, as the
  Showsheet does.
- **Comments in `<head>`:** check-tools finds the first `<body` in the file, so a CSS comment that
  says "`<body>`" fails it. Write "the body element".

## 6. Verify, in this order

```bash
node scripts/check-tools.js <slug>      # conventions: no FAIL lines; a new tool prints "<slug>  ok" (no warnings either)
node scripts/verify-local.js            # server on :8080 first (preview_start "gvc-workspace")
node scripts/interact-local.js <slug>
BROWSER=webkit node scripts/interact-local.js <slug>   # PowerShell: $env:BROWSER='webkit'; node ...
node scripts/dnd-local.js <slug>        # photo tools only
node scripts/test-piece-page.js         # piece tools: the piece opened from a job
node scripts/test-piece-build.js        # piece tools: the helper's build of it
node scripts/test-pdf-render.js         # piece tools: __render for each market
node scripts/test-job-page.js           # piece tools: the job page's Pieces card
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

A piece's helper code only runs on Matt's desktop after the helper restarts (stop the "GVC Helper"
task, end node on port 47610, start the task); say so when you hand it over.

## 7. Ship

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
| Mounted the property bar on a new tool | Job data comes through piece mode (§4) |
| A piece in some of the tables but not all | Search an existing piece id everywhere (§4) |
| A piece whose `piece_requests` row is refused | Its id must be in 0017's list: new migration |
| Redesigned collateral the team already makes | Match their most recent files on the drive first |
