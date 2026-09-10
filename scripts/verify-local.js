/* ============================================================
   Load every page on the local site and fail if any of them is broken.

     python -m http.server 8080          (from the repo root)
     cd scripts && npm install           (once — playwright)
     node scripts/verify-local.js

   This used to visit the homepage and the 404 page, print what it found, and
   exit 0 regardless — console errors and missing elements were reported to a
   human who had to notice them. It now visits every page and returns a real
   exit code, so it can be trusted in a hurry and before a publish.

   What it will not catch: anything behind the property library, which needs a
   Supabase session. These are the checks that need no account.
   ============================================================ */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8080';

const PAGES = [
  ['Homepage',        '/'],
  ['404',             '/404.html'],
  ['Showsheet',       '/tools/showsheet/'],
  ['Seller Pitch',    '/tools/seller-package/'],
  ['Brochure',        '/tools/brochure/'],
  ['Buyer Package',   '/tools/buyer-package/'],
  ['Properties',      '/tools/properties/'],
  ['Calculator',      '/tools/calculator/'],
  ['Floorplan',       '/tools/floorplan/'],
  ['CMA',             '/tools/cma/'],
  ['Map Studio',      '/tools/map-studio/'],
  ['Watermark',       '/tools/watermark/']
];

/* Some browsers ask for these on their own whether or not a page links an
   icon, and every page here declares its real ones in <head>, so a 404 for
   one is the browser's doing rather than a broken reference. Headless
   Chromium does not currently request them — checked by turning this off and
   watching all 13 still pass — but a headed run does, and this is cheaper
   than a confusing failure. Nothing else is forgiven: a 404 for something a
   page actually references is a failure. */
const BROWSER_PROBES = [/\/favicon\.ico$/, /\/apple-touch-icon(-precomposed)?\.png$/];
const isProbe = url => BROWSER_PROBES.some(re => re.test(url));

async function check(page, label, path) {
  const consoleErrors = [], pageErrors = [], sriBlocked = [], notFound = [];

  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.removeAllListeners('requestfailed');
  page.removeAllListeners('response');

  page.on('console', m => {
    if (m.type() !== 'error') return;
    // a failed request is logged against the resource, not the page
    if (isProbe(m.location().url || '')) return;
    consoleErrors.push(m.text());
  });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('requestfailed', r => {
    const f = r.failure();
    if (f && /integrity|blocked/i.test(f.errorText)) sriBlocked.push(r.url() + ' :: ' + f.errorText);
  });
  page.on('response', r => {
    if (r.status() === 404 && !isProbe(r.url())) notFound.push(r.url());
  });

  const url = BASE + path;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);           // chrome.js fetch + motion.js

  const r = await page.evaluate(() => ({
    title: document.title,
    masthead: !!document.querySelector('.masthead'),
    monogram: !!document.querySelector('#mast-monogram svg'),
    h1: (document.querySelector('h1') || {}).textContent || null,
    // a page that renders nothing still passes every listener check above
    bodyText: (document.body.innerText || '').trim().length,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }));

  const problems = [];
  if (pageErrors.length)    problems.push(pageErrors.length + ' uncaught error(s): ' + pageErrors.join(' | '));
  if (consoleErrors.length) problems.push(consoleErrors.length + ' console error(s): ' + consoleErrors.join(' | '));
  if (sriBlocked.length)    problems.push(sriBlocked.length + ' SRI-blocked: ' + sriBlocked.join(' | '));
  if (notFound.length)      problems.push(notFound.length + ' missing file(s): ' + notFound.join(' | '));
  if (!r.masthead)          problems.push('no masthead — chrome.js did not run');
  if (!r.monogram)          problems.push('monogram SVG missing from the masthead');
  if (r.bodyText < 40)      problems.push('page rendered almost no text (' + r.bodyText + ' chars)');
  if (r.horizontalOverflow) problems.push('page scrolls sideways at this width');

  const ok = problems.length === 0;
  console.log((ok ? '  ok   ' : '  FAIL ') + label.padEnd(15) + path);
  if (!ok) problems.forEach(p => console.log('         - ' + p));
  return ok;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('\nChecking ' + PAGES.length + ' pages on ' + BASE + '\n');
  let failed = 0;
  for (const [label, path] of PAGES) {
    if (!await check(page, label, path)) failed++;
  }

  /* The 404 page's one job is to get somebody back to the site. */
  await page.goto(BASE + '/404.html', { waitUntil: 'networkidle' });
  await page.click('a.btn');
  await page.waitForLoadState('networkidle');
  const home = new URL(page.url()).pathname === '/';
  console.log((home ? '  ok   ' : '  FAIL ') + '404 "back to home" lands on ' + page.url());
  if (!home) failed++;

  await browser.close();

  if (failed) {
    console.error('\n  ' + failed + ' of ' + (PAGES.length + 1) + ' checks failed\n');
    process.exit(1);
  }
  console.log('\n  all ' + (PAGES.length + 1) + ' checks passed\n');
})().catch(e => { console.error(e); process.exit(1); });
