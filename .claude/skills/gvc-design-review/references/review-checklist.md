# Review checklist

Use this with `gvc-design-standards`. Each question has a pass condition. Record a failure only with evidence.

## A. Content (always first)

- [ ] Every name, title, bio, headshot and contact detail traces to a real source (a file in the diff, a shared-drive path the author names, or Matt's message). Nothing is plausible-but-invented.
- [ ] Every figure (price, size, count, date, percentage, fee) traces to a source. Rounded or recomputed figures show the calculation or the source.
- [ ] Every quote and testimonial is real and attributed. None exist yet for Katie, Nicole, Gary, Ayuen or TJ; a quote for any of them is a blocker unless the source is in hand.
- [ ] Referral partners, towns, counties and regions are real GVC data. A grouping the author invented is labelled as a proposal, not presented as fact.
- [ ] No tagline, motto, statistic, award or "why GVC" claim without a source.
- [ ] Headings name the actual thing. No decorative eyebrow ("GVC Real Estate ·", "Tool ·") and no invented sub-heading style.
- [ ] Missing content shows a visible stamp in the existing style. A stamp removed in the diff has its real data in the diff or the data file.
- [ ] Links are real and current. Useful Links are re-checked before each print run (NJ); a new URL the author did not source is flagged.
- [ ] Copy is spelled as the lockup spells the team name; Douglas Elliman legal and affiliation text is the fixed boilerplate, unchanged.
- [ ] No "Claude" in client-facing copy or workspace docs.

## B. Data and privacy

- [ ] No owner or client personal data in any committed file (names, emails, phones on MLS rows). MLS exports (`.csv`, `textexport`) are not in git.
- [ ] Saved state holds no client or visitor personal data. Property addresses are fine.
- [ ] Sales or listing rows are filtered by the rules the surface states (for NJ: status C, rentals out, commercial under $50K out, one row per List Number). A changed filter is a data change, so check the count against the stated rule.
- [ ] A test or sample row is labelled as test data and not printed for a client.

## C. Brand and colour

- [ ] Only the surface's tokens are used; no new hex in tool code (legacy hex in untouched lines is out of scope).
- [ ] Sky is never text on Paper. Cyan is text only on Navy. Body text is Navy or `--ink-soft` on Paper.
- [ ] In a set: all five GVC colours have a real role; there is a Paper-ground piece with Navy ink (for sets of more than two pieces).
- [ ] One accent per surface, with the brand's restraint. No gradient text, glass panels, hero metrics, identical card grids or icon filler.
- [ ] Contrast meets AA. Check any new pairing numerically.

## D. Type

- [ ] Fonts come from `assets/css/fonts.css`. No Google Fonts link on a tool page (`diff-lint` ERROR `google-fonts`).
- [ ] Printed pages use the print serif and label face; site pages use the site display face. No third face appears.
- [ ] Label caps are tracked and small; body is readable at print size; no text below the print minimum for the surface.
- [ ] Figures in columns align; numerals are consistent.

## E. Layout and print

- [ ] Every printed page: no half-empty page, nothing past the page edge, no text cut at a break, no orphaned heading at the bottom of a page.
- [ ] Each paper size the surface supports (Letter, half-letter, A5 for the showsheet) checked from the captured PDF.
- [ ] Margins even; content within the safe margin; nothing closer to the edge than the surface's standard.
- [ ] Fonts embedded in the PDF (no Type3 outlines from variable fonts).
- [ ] Background colours and images print (the Chromium capture uses `printBackground`; confirm in Safari by hand when print changed).
- [ ] Each market's PDF checked separately (NJ, NYC, FL).

## F. Screens and interaction

- [ ] Desktop first screen: masthead, title and primary action visible and aligned.
- [ ] 375px wide: no sideways scroll (`save-review-captures` reports this), 16px gutter, tap targets at least 40px.
- [ ] Focus: a Tab press shows a Sky `:focus-visible` outline on every control.
- [ ] Every control has a label (`field-labels.js` loaded when the page has inputs); `aria-current` on the active nav item; one visually-hidden page `h1`.
- [ ] Full-height tools carry `data-foot="none"`; no footer lands under the app.
- [ ] Panel collapses (`panel-collapse.js`), and the remembered state works.
- [ ] Unsaved-changes warning fires after an edit and after a drag, crop or other change with no input event (`unsaved.js` `touch()`).
- [ ] Errors and warnings are readable and do not leak code or internal names.

## G. Images and media

- [ ] Every image is real, high-resolution, and in the right place. No drawn stand-in for a missing real photo.
- [ ] Stock is verifiably of the stated place, with the Pexels or Unsplash ID in a code comment; licence recorded.
- [ ] No "Check License First" image is published. Never delete one.
- [ ] Images have `alt` text (`diff-lint` WARN `img-no-alt`).
- [ ] Photos dropped on the page land where dropped and never show twice (`dnd-local.js`).
- [ ] Image files over 2 MB are justified (`why-nyc.png` is the known exception).
- [ ] Crops keep faces and the key subject at both paper sizes.

## H. Motion (loops and live animation)

- [ ] Loops are seamless: the seam difference matches a normal frame-to-frame step (`seam.js`).
- [ ] Every moving term completes a whole number of cycles per loop.
- [ ] Motion is slow; particles drift; one move at a time; big shapes; no busy random patterns.
- [ ] Landscape and portrait are composed separately, not one rotated.
- [ ] Essential content inside the 8% safe area; labels readable at room distance.
- [ ] Lockup whole; monogram only taken apart; clear space respected; minimum sizes met at 4K.
- [ ] Reduced-motion users get a static or no-animation state on the live page.
- [ ] Rendered loops are 4K only in the delivery folder; no test copies or thumbnails left in it.

## I. Repo and shipping

- [ ] `check-tools.js <slug>` prints `ok` with no FAIL. Warnings are listed and either fixed or excused.
- [ ] Test lists updated: `verify-local.js` PAGES, `interact-local.js` ALL, `dnd-local.js` TOOLS (photo tools).
- [ ] Homepage tile in the right `.tool-row`; `README.md` section present.
- [ ] CDN: pinned version in the URL and `integrity` plus `crossorigin="anonymous"`.
- [ ] Shared files: other tools' PDFs unchanged versus `main`.
- [ ] Dead CSS, dangling `getElementById` lookups and unreferenced files checked for what the change touched; dead code this change created is reported separately from what was already there.
- [ ] No secrets, passwords, keys or tokens in the diff.
- [ ] Branch is clean: no stray `_edit*.py` scripts, no temp files, no committed exports.
- [ ] Teammate change: a pull request to `main`. Matt's own change: merged to `main` after verifying (no force-push).

## J. Designer and client lenses (full detail in perspectives.md)

- [ ] Reader named (buyer, seller, prospect or team member) and the review judged against that reader's job.
- [ ] Designer: one primary element per page; a clear step-down in size, weight and colour; consistent margins; no orphaned lines, stranded headings or stub rows; line length about 45–85 characters; no widows; images cropped deliberately at both paper sizes.
- [ ] Client walkthrough done and written up: the headline alone says what it is, who it is for and what to do next.
- [ ] Every figure, name and claim is dated, labelled or sourced; a worried reader would believe it.
- [ ] Jargon and acronyms are defined on the page or familiar to that reader.
- [ ] No placeholder or stamp on a piece that is due to ship.
- [ ] Print-size legibility and contrast suitable for an older reader at arm's length.
- [ ] One clear next step; the contact path is the team's, correct and current.
- [ ] No pressure, no promised outcome, no timeline the team cannot keep.
- [ ] Nothing that assumes a single kind of buyer or household; flagged as a question if it does.
- [ ] High-stakes pieces: a cold read by one or two people outside the team recommended.

## K. Judgement

- [ ] Small layout and data-mapping calls made by the author are sensible and noted in one line at most.
- [ ] Anything that touches the live site's content for clients, another person's work, or a source only Matt holds is raised with Matt before it ships.
- [ ] The overall impression matches the brand: restrained, editorial, precise, a well-set print spread.

## Known false positives (do not report these)

- `hex-colour` in legacy tools' `<style>` blocks on lines the change did not touch (out of scope; `check-tools` already warns).
- `fonts.googleapis.com` in a comment explaining the rule (`brochure`, `showsheet`, and others carry this note; `diff-lint` skips comments).
- `Claude` in a code comment or in a README note about tooling (`diff-lint` skips comments; confirm the rest).
- Short class names that are substrings of other words (for example `sd`, `sn`, `bn`) in a dead-code sweep: check in context first.
- The "text runs past the page" warning from `interact-local.js` on deliberately long test text.
- Stamps that are supposed to be there (see `gvc-design-standards/references/copy-and-content.md`).
- `Tool ·` inside a generated string the tool never prints (verify in the captured output before reporting).
- The showcase pages (home, galleries, case studies, listing rules) loading Google Fonts: they are the documented exception.

## Known misses (check by hand)

- Whether the figures on a page are right: diff-lint cannot check numbers against a source.
- Whether a testimonial, bio or referral is real: only the source can say.
- Visual balance and hierarchy: needs the captured image and a human eye.
- WebKit print: not automated (Playwright cannot produce a Safari PDF).
- Whether a live link still works: check it when the print run is due.
