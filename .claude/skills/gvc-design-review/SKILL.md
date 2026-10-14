---
name: gvc-design-review
description: Use when reviewing GVC Workspace design work before it ships: a branch or diff touching tools/, assets/css, assets/js or index.html, a printed PDF, listing sheet, package, brochure, showsheet, NJ footprint, office-screen loop or any client-facing page. Use when asked to critique, audit, check brand or copy, or decide "is this ready to send" or "is this on brand".
---

# GVC design review

## Overview

A review answers one question: **would Matt be comfortable handing this to a client, and does it hold to the GVC standards?** It reports findings with evidence and a fix. It does not change code unless asked.

Review the output a client sees (the PDF, the screen at phone width, the loop), then the source. The rules come from `gvc-design-standards`; read its SKILL.md first and open its reference for the surface under review.

Core principle: **evidence before opinion.** Every finding cites a file and line, or a captured image or PDF page, and is checked in context before it is reported. A review that flags forty style nits and misses an invented testimonial has failed.

## Step 1: Scope the review

1. Find what changed: `git diff --stat main...HEAD` plus `git status --short`. Note the branch and whether the change is teammate work (PR) or Matt's own (direct to `main` after verifying).
2. Name each surface and its markets using the table in `gvc-design-standards`. Note any frozen output in scope (showsheet `.sheet`, NYC cost tables): those are checked for unintended change only.
3. If the request is a whole tool or a whole set rather than a diff, say so and review the whole thing with `--all`.

## Step 2: Mechanical pass (cheap, run first)

```bash
node .claude/skills/gvc-design-review/scripts/diff-lint.js            # added lines vs main
node .claude/skills/gvc-design-review/scripts/diff-lint.js --all      # whole in-scope tree
node scripts/check-tools.js <slug>                                    # tools: must print "<slug>  ok", no FAIL
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
- **Motion:** for loops, `seam.js` output and a still from the start and end; for live pages, that nothing animates under reduced motion.

WebKit cannot produce a PDF through Playwright. If the change touches print, say in the review that the Safari print check is outstanding unless someone has done it.

## Step 4: Standards pass

Walk `references/review-checklist.md`. It has the questions for each surface and the common failure modes. Only record a failure you can point to. Mark each checklist area as passed, failed, or not applicable.

Give extra weight to the items that have gone wrong before:
- invented content: names, figures, quotes, partners, towns, claims, form fields
- a stamp removed without its real data
- a shared file changed so that another market or tool's output moved
- Sky used as text on Paper; gradient text; glass panels; a decorative eyebrow
- a Google Fonts link on a tool, or a CDN script without a pinned version and integrity hash
- client or owner personal data in a file or in saved state
- a frozen output changed

## Step 5: Regression pass (when a shared file moved)

If `assets/js/*`, `assets/css/*`, `builder.js`, `pitch.js`, `photo-dnd.js`, `unsaved.js` or a logo or token file changed, the other tools must not move:

1. Capture each affected tool's PDF on `main`, then on the branch, with the same inputs. Use `git stash` or a worktree to get the `main` copy; do not discard the user's work to do it.
2. Pixel-diff the two. Zero differences is the bar; report any difference and whether it was intended.

## Step 6: Write the review

Report in chat. Order by severity and keep it short. Use this shape:

```
## Review: <surface or branch>

Verdict: ship / ship after fixes / do not ship. One sentence on why.

### Blockers (client-facing error or a rule break that cannot ship)
1. <file>:<line> — <what is wrong>. Evidence: <how you checked>. Fix: <the change>.

### Fix before shipping
1. ...

### Polish (optional)
1. ...

### Checked and fine
<one line per area: print, screens, copy, images, motion, shared-file regression>

### Not verified
<anything you could not check, e.g. WebKit print, a live link, a source you do not have>
```

Rules for findings:
- **Verify first.** Read the line in context. Do not report a hit from `diff-lint.js` you have not looked at.
- **Cite evidence**: file and line, or the captured image or PDF page.
- **Respect the frozen and standing decisions** in `gvc-design-standards`. Do not re-propose them.
- **Separate what this change created from what was already there.** Matt has asked for both to be reported, but they are different: call pre-existing issues "already there".
- **Ask only about what needs Matt.** Small layout or data-mapping calls are yours to make; if you made one while reviewing, say so in one line rather than listing it as a question.
- **Keep polish short.** Two or three elevation suggestions at most, each tied to a checklist item.
- **Do not fix in the review.** List the fixes. Apply them only when asked, and then on a branch.

If a teammate's change is ready for Matt, the review goes to Matt with the verdict on top. If it is Matt's own change, the verdict says whether it is safe to merge to `main` under the owner rule.

## Common mistakes

| Mistake | Fix |
|---|---|
| Reporting every lint hit as a defect | Read each in context; most `hex-colour` and `img-no-alt` hits in legacy code are known |
| Saying "looks good" without opening the PDF | Open every page of the PDF at each paper size |
| Missing an invented number because the layout looks right | Check each figure, name and claim against a source in the diff or the data file |
| Flagging a stamp as a defect | Stamps are deliberate until real content arrives; flag only a stamp removed without its data |
| Recommending a restyle of a frozen output | Frozen outputs are checked for unintended change, not restyled |
| Forgetting the other markets | Check NJ, NYC and FL separately when a shared file or a copy line moved |
| Calling a clean lint scan sign-off | A clean scan proves only the patterns it checks; the visual pass still applies |
