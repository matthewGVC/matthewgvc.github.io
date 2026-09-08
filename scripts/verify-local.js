const { chromium } = require('playwright');

const BASE = 'http://localhost:8080';

async function loadAndCheck(page, url, label) {
  const consoleErrors = [];
  const pageErrors = [];
  const sriBlocked = [];
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.removeAllListeners('requestfailed');
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('requestfailed', r => {
    const f = r.failure();
    if (f && /integrity|blocked/i.test(f.errorText)) sriBlocked.push(r.url() + ' :: ' + f.errorText);
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  // give chrome.js fetch + motion.js a beat
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => ({
    gsap: typeof window.gsap !== 'undefined',
    gsapVer: (window.gsap && window.gsap.version) || null,
    masthead: !!document.querySelector('.masthead'),
    footer: !!document.querySelector('.site-foot'),
    monogramSvg: !!document.querySelector('#mast-monogram svg'),
    monogramPaths: document.querySelectorAll('#mast-monogram svg path').length,
    // asset hrefs as they appear in DOM
    cssHrefs: [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href')),
    iconHrefs: [...document.querySelectorAll('link[rel*="icon"]')].map(l => l.getAttribute('href')),
    gsapSrc: (document.querySelector('script[src*="gsap"]') || {}).getAttribute ? document.querySelector('script[src*="gsap"]').getAttribute('integrity') : null,
    btnHref: (document.querySelector('a.btn') || {}).getAttribute ? document.querySelector('a.btn').getAttribute('href') : null,
    h1: (document.querySelector('h1') || {}).textContent || null,
  }));

  console.log(`\n===== ${label} (${url}) =====`);
  console.log('GSAP defined         :', r.gsap, '(version', r.gsapVer + ')');
  console.log('SRI integrity attr   :', r.gsapSrc ? r.gsapSrc.slice(0, 24) + '...' : null);
  console.log('SRI-blocked requests :', sriBlocked.length, sriBlocked);
  console.log('masthead injected    :', r.masthead);
  console.log('footer injected      :', r.footer);
  console.log('monogram SVG present :', r.monogramSvg, '| paths:', r.monogramPaths);
  console.log('h1 text              :', JSON.stringify(r.h1));
  console.log('.btn href            :', r.btnHref);
  console.log('CSS hrefs            :', r.cssHrefs);
  console.log('icon hrefs           :', r.iconHrefs);
  console.log('console errors       :', consoleErrors.length, consoleErrors);
  console.log('uncaught pageerrors  :', pageErrors.length, pageErrors);
  return { r, consoleErrors, pageErrors, sriBlocked };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await loadAndCheck(page, BASE + '/', 'HOMEPAGE');
  const f = await loadAndCheck(page, BASE + '/404.html', '404 PAGE');

  // Click "Back to home" and confirm navigation to root
  await page.click('a.btn');
  await page.waitForLoadState('networkidle');
  console.log('\n[404] after clicking Back to home → URL:', page.url());
  console.log('[404] landed on homepage h1:', JSON.stringify(await page.evaluate(() => document.querySelector('h1') && document.querySelector('h1').textContent)));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
