# Print and verify

Print is the product. A tool or page is finished when its printed PDF is right, in every market and paper size it supports. Check the screen last.

## Paper sizes by surface

| Surface | Sizes | Notes |
|---|---|---|
| Buyer package, Seller Package, brochure, destination guide | US Letter portrait, 8.5 x 11in | `builder.css` sets `@page{size:letter portrait;margin:0}` and `--pw`/`--ph` |
| Brochure half-letter variant | Half-letter | Brochure's `<style id="pagesize">` and `--print-scale` |
| Showsheet | A5 and US Letter (toggle under the preview) | Fixed 11in-wide design canvas. A5 scales it down, Letter prints at full size. Test both |
| Postcards | 9.21 x 6.21 in with bleed, or 9 x 6 in trim | `<style id="pagesize">`; `body.trim` switches to trim |
| Signage | For Sale 24 x 30 in; Open House arrow 24.4 x 18.4 in | One PDF page per sign |
| NJ footprint | Letter, 2 pages | Front = state map, back = Monmouth and Ocean town map |
| New Development | PDF via its own print button | Internal builder |
| Office screens | 4K landscape and portrait video | See `motion-and-screens.md` |

If you change page geometry, test every paper size the surface offers, through the toggle, not only the default.

## Checklist for every printed output

- [ ] Opened the print dialog in **Chromium**: Destination "Save as PDF", Paper as required, Margins "None", "Background graphics" on. The button's title attribute states these settings; keep them in sync.
- [ ] Layout checked in **WebKit** (`BROWSER=webkit node scripts/interact-local.js <slug>`). Playwright cannot produce a PDF in WebKit, so print the page from Safari by hand and look at the result. Safari prints differently; say in the review whether this was done.
- [ ] Every page: no half-empty page (an empty "Floor Plans" page with only a footnote counts as half-empty), no overflow past the page edge, no text cut at a page break.
- [ ] Fonts embedded. A PDF with Type3 font outlines means a variable font or a Google Fonts link slipped in.
- [ ] Each market's PDF checked separately. NJ, NYC and FL have their own copy and page sets.
- [ ] If a shared file moved (`assets/js/pitch.js`, `photo-dnd.js`, `builder.css`, `builder.js`, `unsaved.js`), the other tools' PDFs are unchanged versus `main`.
- [ ] Look at the PDF itself. The PDF_Tools connector can render a page (`render_pdf_page`); load it with ToolSearch if it is deferred.

## Pixel diff method (proof that nothing moved)

When a change must not alter output (a refactor, a shared module, a parity pass):

1. Generate the PDF (or a screenshot per page) on `main`, keep it in `tmp/`.
2. Generate it again on the branch with the same inputs and paper size.
3. Pixel-diff the two. The bar is zero differences. Recent examples: the brochure audit and the NJ/FL parity pass diffed identical to `main`.
4. Report any difference, even a small one, and say whether it was intended.

## Local checks (run in this order)

Serve the repo first: `python -m http.server 8080` from the repo root, or `preview_start` with `gvc-workspace`. Opening a tool as `file://` breaks the Word-document reader and image handling.

```bash
node scripts/check-tools.js <slug>                 # conventions; must print "<slug>  ok"
node scripts/verify-local.js                       # every page loads, no console errors, SRI, no sideways scroll
node scripts/interact-local.js <slug>              # clicks and types every control, prints each to PDF
BROWSER=webkit node scripts/interact-local.js <slug>
node scripts/dnd-local.js <slug>                   # photo tools only
node scripts/test-<area>.js                        # data and logic tests, when the data changed
```

PowerShell: `$env:BROWSER='webkit'; node scripts/interact-local.js <slug>`.

`check-tools.js` cannot see every control a script builds. If a page has inputs, confirm `field-labels.js` is loaded even when the check passes.

Warnings you can ignore: hex colours in legacy `<style>`, the "text runs past the page" warning on deliberately long test text in `interact-local.js`.

Non-print tools: check at 375px wide (mobile preset) and with edge inputs (blank, zero, "$1,250,000").

## Sweep what you touched

When you touch `assets/css/*` or `assets/js/*`:
- orphaned CSS classes: for each selector, search every `.html` and `.js` on word boundaries. Treat every quoted string in JS as a possible class name (some tools build classes as bare string arguments or by concatenation). Short names like `sd` give false positives; check in context.
- dangling `getElementById('x')`: find where `id="x"` is defined. Guarded lookups are dead code; unguarded ones are latent crashes.
- Generated markup: `seller-package`, `pitch.js` and similar build markup at runtime. Search the built templates too.
- Report dead code this change created separately from dead code that was already there.
