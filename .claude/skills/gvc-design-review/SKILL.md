---
name: gvc-design-review
description: Use when reviewing GVC Workspace design work before it ships: a branch or diff touching tools/, workspace/, assets/css, assets/js or listing-rules/, a printed PDF, listing sheet, package, brochure, showsheet, NJ footprint, office-screen loop or any client-facing page. Use when asked to critique, audit, check brand or copy, or decide "is this ready to send" or "is this on brand".
---

# GVC design review

## Overview

A review answers three questions about the same piece:

1. **Designer:** is it well made, with a clear hierarchy, grid, type and finish?
2. **Client:** does the buyer, seller or prospect holding it understand it, trust it, and know what to do next?
3. **Brand:** does it hold to the GVC standards?

It reports findings with evidence and a fix. It does not change code unless asked. Would Matt be comfortable handing this to a client? That is the verdict, and the client lens decides most of it.

Review the output a client sees (the PDF, the screen at phone width, the loop), then the source. The brand rules come from `gvc-design-standards`; read its SKILL.md first and open its reference for the surface under review. The designer and client lenses are in `references/perspectives.md`.

Core principle: **evidence before opinion.** Every finding cites a file and line, or a captured image or PDF page, and is checked in context before it is reported. A review that flags forty style nits and misses an invented figure has failed. So has a review that passes a page every token check clears but a buyer cannot read.

## Step 1: Scope the review

1. Find what changed: `git diff --stat main...HEAD` plus `git status --short`. Note the branch and whether the change is teammate work (PR) or Matt's own (direct to `main` after verifying).
2. Name each surface, its markets and **its reader** (buyer, seller, prospect, team member) using the tables in `gvc-design-standards` and `references/perspectives.md`. A seller pitch and a buyer package have different jobs, and the client lens depends on knowing which.
3. Note any frozen output in scope (showsheet `.sheet`, NYC cost tables): those are checked for unintended change only.
4. If the request is a whole tool or a whole set rather than a diff, say so and review the whole thing with `--all`.

## Step 2: Mechanical pass (cheap, run first)

```bash
node .claude/skills/gvc-design-review/scripts/diff-lint.js            # added lines vs main
node .claude/skills/gvc-design-review/scripts/diff-lint.js --all      # whole in-scope tree
node scripts/check-tools.js <slug>                                    # tools: no FAIL lines ("<slug>  ok" when there are no warnings either)
```

`diff-lint.js` is a grep, so every hit is a lead. For each one, read the line in context and decide: real defect, intentional (test data, a documented exception), or false positive. Report only the real ones and the ones you could not decide. Legacy hex in untouched lines is out of scope; `check-tools` already warns about it.

Run the tests the repo ships when the change touches what they cover (see `gvc-design-standards/references/print-and-verify.md`): `verify-local.js`, `interact-local.js`, `dnd-local.js` for photo tools, and the `scripts/test-*.js` data tests. Serve the repo first (`python -m http.server 8080`, or `preview_start` with `gvc-workspace`).

## Step 3: Look at the output

Capture what a reviewer can see:

```bash
node .claude/skills/gvc-design-review/scripts/save-review-captures.js <slug> [/path/]
```

This writes `tmp/review/<slug>/desktop.png`, `mobile.png` and `print.pdf`, and reports console errors, sideways scroll at 375px and the PDF page count. Then open the images and the PDF pages yourself. Use the PDF_Tools connector (`render_pdf_page`, load with ToolSearch) when you need a closer look at a PDF page.

Check at minimum:
- **Printed pages:** every page, both paper sizes the surface offers, no half-empty or overflowing page, text not cut at a page break, fonts embedded.
- **Screens:** the first screen at desktop and at 375px; the masthead and footer; focus outlines on a Tab press.
- **Motion:** for loops, the output of `exports/office-screens/source/checks/seam.js` (untracked, local only) and a still from the start and end; for live pages, that nothing animates under reduced motion.

WebKit cannot produce a PDF through Playwright. If the change touches print, say in the review that the Safari print check is outstanding unless someone has done it.

## Step 4: Three lenses

Work through them in order. Record each failure with its location. Mark each lens as passed, failed or not applicable.

### 4a. Designer lens

Read `references/perspectives.md` ("Lens 1: designer"). Check purpose and hierarchy, grid and rhythm, type craft, images as design, colour as design, finish, and the generic test. Name the element and the failure, then the fix in design terms.

### 4b. Client lens

This is the lens most likely to be skipped and the one that matters most for a piece that goes to a buyer or seller. Do the seven-step walkthrough in `references/perspectives.md` ("Lens 2: client"), as the reader named in Step 1, and write down what you did and what you noticed at each step. Specifically check:
- can the reader say what it is, who it is for and what to do next, from the headline alone
- every figure, name and claim is labelled, dated or sourced, and a worried reader would believe it
- jargon and acronyms are defined on the page
- stamps ("List needed", "Work in progress") on a piece that is due to ship
- print-size legibility for an older reader, and contrast on paper
- one clear next step, and a correct, current contact path

The client lens is an informed proxy, not user research. Say so in the review. For anything going to a client with real money or reputation at stake, recommend that one or two people outside the team read it cold before it ships.

### 4c. Brand lens

Walk `references/review-checklist.md`. Only record a failure you can point to. Give extra weight to the items that have gone wrong before:
- invented content: names, figures, quotes, partners, towns, claims, form fields
- a stamp removed without its real data
- a shared file changed so that another market or tool's output moved
- Sky used as text on Paper; gradient text; glass panels; a decorative eyebrow
- a Google Fonts link on a tool page, or a CDN script without a pinned version and integrity hash
  (the lint reads tool HTML only: a font `@import` written by a tool's script, like the old SVG
  converter's in `tools/floorplan/floorplan.js`, needs a look by eye)
- client or owner personal data in a file or in saved state
- a frozen output changed

Brand also means consistency across the set: does this piece look like it belongs beside the others?

## Step 5: Regression pass (when a shared file moved)

If `assets/js/*`, `assets/css/*`, `builder.js`, `pitch.js`, `photo-dnd.js`, `unsaved.js` or a logo or token file changed, the other tools must not move:

1. Capture each affected tool's PDF on `main`, then on the branch, with the same inputs. Use `git stash` or a worktree to get the `main` copy; do not discard the user's work to do it.
2. Pixel-diff the two. Zero differences is the bar; report any difference and whether it was intended.

## Step 6: Write the review

Report in chat. Order by impact, not by lens: a client misreading a figure outranks a kerning issue. Keep it short. Use this shape:

```
## Review: <surface or branch>
Reader: <buyer / seller / prospect / team member>

Verdict: ship / ship after fixes / do not ship. One sentence on why, led by the client lens.

### Blockers (a client would be misled, or a rule break that cannot ship)
1. <file>:<line or page> — <what is wrong>. Lens: <client / designer / brand>. Evidence: <how you checked>. Fix: <the change>.

### Fix before shipping
1. ...

### Polish (optional, two or three at most)
1. ...

### How the client lens was checked
<the walkthrough in brief: what you read first, what a reader would ask, where you got stuck>

### Checked and fine
<one line per area: designer, client, brand, print, screens, shared-file regression>

### Not verified
<anything you could not check, e.g. WebKit print, a live link, a source you do not have, a reader test not yet done>
```

Rules for findings:
- **Verify first.** Read the line in context. Do not report a hit from `diff-lint.js` you have not looked at.
- **Cite evidence**: file and line, or the captured image or PDF page.
- **Name the lens** for each finding, so Matt can see whether it came from design, client reading or brand.
- **Respect the frozen and standing decisions** in `gvc-design-standards`. Do not re-propose them.
- **Separate what this change created from what was already there.** Call pre-existing issues "already there".
- **Ask only about what needs Matt.** Small layout or data-mapping calls are yours to make; if you made one while reviewing, say so in one line rather than listing it as a question.
- **When the lenses disagree**, report both and say which way you lean and why.
- **Do not invent readers' data.** Personas are roles; never fill them with names, incomes, quotes or ages.
- **Do not fix in the review.** List the fixes. Apply them only when asked, and then on a branch.

If a teammate's change is ready for Matt, the review goes to Matt with the verdict on top. If it is Matt's own change, the verdict says whether it is safe to merge to `main` under the owner rule.

## Common mistakes

| Mistake | Fix |
|---|---|
| Passing a piece because every token and lint check is clean | Run the client walkthrough; a correct page can still mislead or confuse |
| Reporting every lint hit as a defect | Read each in context; most `hex-colour` and `img-no-alt` hits in legacy code are known |
| Saying "looks good" without opening the PDF | Open every page of the PDF at each paper size |
| Reviewing a seller piece as if it were a buyer piece | Name the reader first (Step 1) |
| Reading a print on a large screen and calling it the client's experience | Use the PDF or the 375px capture, and hold it at arm's length if a physical print exists |
| Missing an invented number because the layout looks right | Check each figure, name and claim against a source in the diff or the data file |
| Flagging a stamp as a defect | Stamps are deliberate until real content arrives; flag a stamp on a piece that is due to ship, or one removed without its data |
| Recommending a restyle of a frozen output | Frozen outputs are checked for unintended change, not restyled |
| Forgetting the other markets | Check NJ, NYC and FL separately when a shared file or a copy line moved |
| Calling a clean lint scan sign-off | A clean scan proves only the patterns it checks; the visual and client passes still apply |
| Presenting the client lens as user research | It is an informed proxy; recommend a cold read by real people for high-stakes pieces |
