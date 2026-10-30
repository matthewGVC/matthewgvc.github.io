# GVC tool templates

Copy verbatim. Replace `<Name>`, `<slug>`, `<one sentence>` and the tool script.
Paths assume `tools/<slug>/index.html`.

## Head (all tools)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><Name> · GVC Workspace</title>
<meta name="description" content="<one sentence: what it makes, for whom>">
<meta property="og:title" content="<Name> · GVC Workspace">
<meta property="og:description" content="<same sentence>">
<meta property="og:url" content="https://matthewgvc.github.io/tools/<slug>/">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../assets/logos/monogram.svg" type="image/svg+xml">
<link rel="icon" type="image/png" sizes="32x32" href="../../assets/logos/monogram-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="../../assets/logos/apple-touch-icon-180.png">
<!-- Self-hosted STATIC fonts. Chrome turns VARIABLE fonts into Type3 outlines when
     printing to PDF, which validators reject as "fonts not embedded". Do not put a
     fonts.googleapis.com link back on this page. See assets/css/fonts.css. -->
<link rel="stylesheet" href="../../assets/css/fonts.css">
<link rel="stylesheet" href="../../assets/css/tokens.css">
<link rel="stylesheet" href="../../assets/css/base.css">
<link rel="stylesheet" href="../../assets/css/builder.css">       <!-- plain page: components.css instead -->
<link rel="stylesheet" href="../../assets/css/pitch.css">         <!-- the .warn box in the Warnings section below -->
<!-- other feature CSS here, only what you use: photo-dnd.css, property-bar.css ... -->
<link rel="stylesheet" href="../../assets/css/panel-collapse.css"> <!-- last; omit on plain pages -->
<style>
/* tool styles: tokens only (var(--ink) etc.), sizes in in/pt on printed pages */
</style>
</head>
```

Internal-only pages (not for search, e.g. the To-do list): add
`<meta name="robots" content="noindex, nofollow">` and drop the og/twitter lines.

## Builder body (prints pages)

```html
<body data-root="../../" data-nav="tools" data-foot="none">
<main>
<h1 class="visually-hidden"><Name></h1>

<div id="app">
  <aside id="editor">
    <div class="ed-body">
      <details class="ed-sec" open>
        <summary>Section name <span class="hint">short real hint</span></summary>
        <div class="sec-in">
          <div class="field">
            <label>Caption</label>   <!-- field-labels.js links it to the input -->
            <input type="text" id="fooInput">
          </div>
        </div>
      </details>
      <details class="ed-sec">
        <summary>Warnings</summary>
        <div class="sec-in"><div class="warn" id="warnGeneral" hidden></div></div>
      </details>
    </div>
  </aside>

  <div id="stage"><div id="pages"></div></div>   <!-- a div: one <main> per page -->

  <div id="stageBar">
    <div class="sp"></div>
    <span class="zlab" id="zoomInfo"></span>
    <button type="button" class="btn sm ghost" id="btnZoom">Zoom 100%</button>
    <button type="button" class="btn lg" id="btnPrint" title="In the print dialog: Destination 'Save as PDF' &middot; Paper 'Letter' &middot; Margins 'None' &middot; enable 'Background graphics'.">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></svg>
      Print / Save PDF
    </button>
  </div>
</div>
</main>
```

`data-nav` is no longer read by `chrome.js` (the masthead's lockup links back to the Tools page);
the existing tools still carry it and it does no harm.

A piece tool's job bar and facts block are placed by piece mode at the top of the panel you name in
its adapter (`panel: '#editor'`); nothing goes in the markup for them.

## Builder script tail

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js" integrity="sha384-HOvlOYPIs/zjoIkWUGXkVmXsjr8GuZLV+Q+rcPwmJOVZVpvTSXQChiN4t9Euv9Vc" crossorigin="anonymous"></script>
<script src="../../assets/js/chrome.js"></script>
<script src="../../assets/js/motion.js"></script>
<script src="../../assets/js/builder.js"></script>
<script src="../../assets/js/unsaved.js"></script>
<!-- then only what you use: roster.js, legal.js, qr.js, images.js, photo-dnd.js, pitch.js, icons.js -->
<script>
'use strict';
const state = { /* everything the page renders from */ };
let builder = null;

function redraw() { if (builder) builder.rebuild(); }

document.addEventListener('DOMContentLoaded', () => {
  builder = Builder.init({
    pages: 1, label: 'Page',
    printName: () => '<Name>',            // becomes the PDF file name
    render: (page, i) => { page.innerHTML = '' /* build page i from state */; }
  });
  GVC_UNSAVED.watch();
});
</script>
<!-- piece tools only (opened from a job): window.__piece and window.__render go in the tool
     script above (copy tools/signage/), then this line, which loads job mode only with ?listing= / ?pitch= -->
<script src="../../assets/js/piece-loader.js" data-job="job-mode.js"></script>
<script src="../../assets/js/panel-collapse.js"></script>
<script src="../../assets/js/field-labels.js"></script>
</body>
</html>
```

CDN libraries go first, right after GSAP. QR codes need:
```html
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js" integrity="sha384-lQXOAyZwHXE55JFyrOMB7nY2Wv+m5ZWNtJcHrd1rceRQXAYNLak8ukN5TjBTcIwz" crossorigin="anonymous"></script>
```

Paper: `builder.css` sets `@page{size:letter portrait;margin:0}` and an 8.5x11in page
(`--pw`/`--ph`). Other sizes: see the brochure's `<style id="pagesize">` and `--print-scale`.

## Plain page body (no print)

`.page` and `.page-head` come from `base.css`; `components.css` adds buttons, panels, tiles.

```html
<body data-root="../../" data-nav="tools">
<main class="page">
  <div class="page-head" data-reveal>
    <h1><Name></h1>
    <span class="t-mono"><what it does, plainly — no "Tool ·" prefix></span>
  </div>
  <div class="app">
    <!-- tool UI -->
  </div>
</main>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js" integrity="sha384-HOvlOYPIs/zjoIkWUGXkVmXsjr8GuZLV+Q+rcPwmJOVZVpvTSXQChiN4t9Euv9Vc" crossorigin="anonymous"></script>
<script src="../../assets/js/chrome.js"></script>
<script src="../../assets/js/motion.js"></script>
<script> /* tool script */ </script>
<script src="../../assets/js/field-labels.js"></script>
</body>
```

## Tools page entry (workspace/tools/index.html)

Inside the right section's `<ul class="tl">` (Listing pieces, Team or Utilities). The line under the
name says what it makes, in plain words, like the tool's own meta description.

```html
        <li><a href="../../tools/<slug>/"><b><Name></b><span>What it makes.</span></a></li>
```

## Test lists

```js
// scripts/verify-local.js  PAGES
  ['<Short name>',    '/tools/<slug>/'],
// scripts/interact-local.js  ALL  — add '<slug>'
// scripts/dnd-local.js  TOOLS    — only if photos are dragged onto the page
```

## Saved state (standalone use only; from a job, piece mode saves with the job)

```js
const KEY = 'gvc.<slug>.state';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window or full */ } };
```

## SRI hash for a new CDN file

```bash
curl -s https://cdn.jsdelivr.net/npm/<pkg>@<x.y.z>/<file> | openssl dgst -sha384 -binary | openssl base64 -A
```
Then `integrity="sha384-<hash>" crossorigin="anonymous"`.
