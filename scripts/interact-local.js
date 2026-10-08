/* ============================================================
   Click through every editor control on every tool and fail on any error.

     python -m http.server 8080          (from the repo root)
     cd scripts && npm install           (once - playwright)
     node scripts/interact-local.js              all tools
     node scripts/interact-local.js brochure     one tool (comma-separated for several)

   verify-local.js proves each page loads. This proves the controls do not
   break it: per tool it opens every collapsed section, clicks each button,
   cycles each dropdown, toggles each checkbox, drags each slider and types
   awkward text (markup characters, then 300 characters) into each field,
   then prints the deck to PDF. Any uncaught error or console error fails it.

   Not a failure: a tool's own "text runs past the page" warning. Those are
   the tools doing their job when a field is stuffed, so they are listed
   (WARN) for information. Print, sign-in, delete and download controls are
   skipped, and printing is stubbed. Anything behind the property library
   (needs a Supabase session) is out of reach, as in verify-local.js.
   ============================================================ */
const path = require('path');
/* BROWSER=webkit runs the same checks in Safari's engine (npx playwright install webkit, once) */
const ENGINE = process.env.BROWSER || 'chromium';
const engine = require('playwright')[ENGINE];

const BASE = 'http://localhost:8080';
const SAMPLE = path.resolve(__dirname, '../tools/showsheet/sample') + path.sep;
const ALL = ['showsheet', 'seller-package', 'brochure', 'buyer-package', 'agent-info', 'destination-guide',
  'nj-footprint', 'new-development', 'calculator', 'floorplan', 'map-studio', 'watermark', 'properties'];
const TOOLS = process.argv[2] ? process.argv[2].split(',') : ALL;

const CONTROLS = 'button, [role=button], select, input[type=checkbox], input[type=radio], input[type=range], ' +
  'input[type=text], input[type=number], textarea, summary';
const SKIP = /print|save pdf|sign in|sign out|delete|download|log ?out|clear all/i;
/* third-party and network noise, not the tool's own errors */
const NOISE = /Failed to load resource|mapbox|supabase|tiles|net::/i;

const openAll = page => page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));

async function exercise(el) {
  const info = await el.evaluate(e => ({
    tag: e.tagName, type: e.type || '',
    text: (e.textContent || e.value || e.getAttribute('aria-label') || e.title || '').trim().slice(0, 40),
    link: !!e.closest('a[href]')
  }));
  if (SKIP.test(info.text) || info.link) return 0;
  if (info.tag === 'SELECT') {
    const values = await el.evaluate(e => [...e.options].map(o => o.value));
    for (const v of values.slice(0, 8)) await el.selectOption(v, { timeout: 1500 });
    return Math.min(values.length, 8);
  }
  if (info.type === 'checkbox' || info.type === 'radio') {
    await el.click({ timeout: 1500, force: true });
    await el.click({ timeout: 1500, force: true }).catch(() => {});
    return 2;
  }
  if (info.type === 'range') {
    await el.evaluate(e => ['max', 'min'].forEach(k => { e.value = e[k]; e.dispatchEvent(new Event('input', { bubbles: true })); }));
    return 2;
  }
  if (info.tag === 'TEXTAREA' || info.type === 'text' || info.type === 'number') {
    const num = info.type === 'number';
    for (const v of [num ? '123' : 'Test <b>&"\' text 123', '', num ? '0' : 'Long '.repeat(60)]) await el.fill(v).catch(() => {});
    return 3;
  }
  await el.click({ timeout: 1500, force: true });
  return 1;
}

async function run(browser, tool) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = new Set();
  page.on('pageerror', e => errors.add('uncaught: ' + e.message.slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.add('console: ' + m.text().slice(0, 160)); });
  page.on('dialog', d => d.accept('test').catch(() => {}));
  await page.addInitScript(() => { window.print = () => {}; });
  await page.goto(BASE + '/tools/' + tool + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // give the builders something to lay out
  const feed = async (sel, files) => { try { await page.setInputFiles(sel, files); await page.waitForTimeout(900); } catch (e) { /* tool has no such input */ } };
  if (tool === 'showsheet') {
    await feed('#docxFile', SAMPLE + 'listing.docx'); await feed('#phFile', SAMPLE + 'hero.jpg'); await feed('#fpFile', SAMPLE + 'floorplan.jpg');
  }
  if (tool === 'brochure') await feed('#imgFile', [SAMPLE + 'hero.jpg', SAMPLE + 'hero.jpg']);
  if (tool === 'seller-package') await feed('#filePhotos', [SAMPLE + 'hero.jpg', SAMPLE + 'floorplan.jpg']);

  let actions = 0;
  const count = await page.locator(CONTROLS).count();
  for (let i = 0; i < count && errors.size < 6; i++) {
    await openAll(page);   // a repaint can fold the sections again
    const el = page.locator(CONTROLS).nth(i);
    try {
      if (!(await el.isVisible({ timeout: 200 })) || !(await el.isEnabled({ timeout: 200 }))) continue;
      actions += await exercise(el);
      await page.waitForTimeout(40);
    } catch (e) { /* the control vanished mid-repaint; not a tool error */ }
  }

  const warnings = await page.evaluate(() =>
    [...document.querySelectorAll('.warn-item, .warn-box')].filter(e => e.offsetParent).map(e => e.textContent.trim().slice(0, 70)));
  await page.emulateMedia({ media: 'print' });
  /* page.pdf() exists only in Chromium; other engines skip the print step */
  const pdf = ENGINE !== 'chromium' ? null : await page.pdf({ preferCSSPageSize: true, printBackground: true }).catch(e => { errors.add('print: ' + e.message.slice(0, 100)); return null; });
  const pages = pdf ? (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length : 0;
  await page.context().close();

  const ok = errors.size === 0;
  console.log((ok ? '  ok   ' : '  FAIL ') + tool.padEnd(18) + String(actions).padStart(4) + ' actions, ' + pages + ' printed page(s)');
  warnings.forEach(w => console.log('         WARN ' + w));
  errors.forEach(e => console.log('         - ' + e));
  return ok;
}

(async () => {
  const browser = await engine.launch();
  console.log('\nExercising ' + TOOLS.length + ' tool(s) on ' + BASE + '\n');
  let failed = 0;
  for (const t of TOOLS) if (!await run(browser, t)) failed++;
  await browser.close();
  console.log('\n' + (failed ? failed + ' tool(s) failed' : 'all ' + TOOLS.length + ' tools survived'));
  process.exit(failed ? 1 : 0);
})();
