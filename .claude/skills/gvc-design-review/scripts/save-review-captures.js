/* ============================================================
   save-review-captures.js — save what a reviewer needs to LOOK at.

   interact-local.js and verify-local.js prove that controls work; they do
   not keep the output. This saves, for one page:
     desktop.png    full page at 1440 wide
     mobile.png     full page at 375 wide (the 16px gutter and no sideways scroll)
     print.pdf      the printed output, Chromium, preferCSSPageSize
   and reports the PDF page count and any sideways scroll at 375px.

     python -m http.server 8080                         (from the repo root, first)
     node .claude/skills/gvc-design-review/scripts/save-review-captures.js <slug> [path]

   <slug> is a tool folder (tools/<slug>/); pass a path such as /workspace/tools/ for
   any other page. Output goes to tmp/review/<slug>/ (untracked, not committed).
   Tools that need data first (the showsheet needs its sample files dropped
   on "Listing files") are only as good as the state you put them in: set the
   state, then run this, and say so in the review.

   WebKit cannot produce PDFs through Playwright. For the Safari print check,
   open the page in Safari and print, or ask Matt to. Say in the review that
   this part was not automated.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const { chromium } = require(path.join(ROOT, 'scripts/node_modules/playwright'));

const [slug, pagePath] = process.argv.slice(2);
if (!slug) {
  console.error('usage: node save-review-captures.js <tool-slug> [/path/]');
  process.exit(2);
}

const BASE = process.env.BASE || 'http://localhost:8080';
const url = BASE + (pagePath || `/tools/${slug}/`);
const outDir = path.join(ROOT, 'tmp', 'review', slug);
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const result = { url, outDir, problems: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text().slice(0, 140)); });

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    if (consoleErrors.length) result.problems.push(...consoleErrors);

    await page.screenshot({ path: path.join(outDir, 'desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) result.problems.push(`sideways scroll at 375px: ${overflow}px wider than the screen`);
    await page.screenshot({ path: path.join(outDir, 'mobile.png'), fullPage: true });

    /* print to PDF: Chromium only */
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    fs.writeFileSync(path.join(outDir, 'print.pdf'), pdf);
    result.pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    result.pdfBytes = pdf.length;
  } catch (e) {
    result.problems.push('capture failed: ' + e.message.split('\n')[0]);
  } finally {
    await browser.close();
  }

  console.log(`captures for ${result.url}`);
  console.log(`  ${path.relative(ROOT, outDir)}/desktop.png, mobile.png, print.pdf`);
  if (result.pdfPages !== undefined) console.log(`  print.pdf: ${result.pdfPages} page(s), ${(result.pdfBytes / 1024).toFixed(0)} KB`);
  if (result.problems.length) result.problems.forEach(p => console.log('  PROBLEM ' + p));
  else console.log('  no console errors, no sideways scroll at 375px');
  process.exit(result.problems.length ? 1 : 0);
})();
