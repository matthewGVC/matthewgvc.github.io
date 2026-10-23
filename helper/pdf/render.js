/* ============================================================
   PDF RENDER — prints a tool's pages to PDF in a hidden browser, the
   same way "Save as PDF" in Chrome would.

     const { pdf, label, pages } = await renderPiece({
       tool: 'showsheet',
       inputs: { docx, photo, floorplan },   // file paths the helper reads itself
       paper: 'a5' | 'letter',
       siteBase: 'https://matthewgvc.github.io'   // http://localhost:8080 in tests
     });

   Slice 0 knows one tool, the Showsheet, fed the way a person feeds it:
   the three files dropped into its file inputs. Slice 4 adds { state }: a
   job's sheet, photos and plans inline, drawn by window.__render.
   Nothing here writes a file: name.js does.
   ============================================================ */
'use strict';

require('../config.js');   // points Playwright at the helper's own browser

const TOOLS = {
  showsheet: {
    path: '/tools/showsheet/',
    inputs: { docx: '#docxFile', photo: '#phFile', floorplan: '#fpFile' },
    ready: () => typeof state !== 'undefined' && !!state.address,          // eslint-disable-line no-undef
    label: () => [state.address, typeof GVC_PROPS !== 'undefined' ? GVC_PROPS.unitDisplay(state.unit) : state.unit].filter(Boolean).join(' '),  // eslint-disable-line no-undef
    paper: async (page, paper) => { await page.click('#paperSeg button[data-v="' + paper + '"]'); }
  },
  /* Slice 5: drawn only from a given state, which carries its own paper */
  brochure: { path: '/tools/brochure/?draw=1', label: () => window.__piece.state.address },
  'postcard-listed': { path: '/tools/postcard/?draw=1', label: () => [window.__piece.state.address, window.__piece.state.unit].filter(Boolean).join(' ') },
  'postcard-sold': { path: '/tools/postcard/?draw=1', label: () => [window.__piece.state.address, window.__piece.state.unit].filter(Boolean).join(' ') },
  seller: { path: '/tools/seller-package/?draw=1', label: () => window.__piece.state.address },
  'open-house': { path: '/tools/open-house/?draw=1', label: () => [window.__piece.state.address, window.__piece.state.unit].filter(Boolean).join(' ') }
};

/* A drawn state may only show pictures it carries inline, and nothing it carries may reach out:
   the hidden browser loads from the site itself, plus the two outside hosts the tools' pages
   need (their pinned CDN scripts and Google's fonts), and nothing else, of any kind. */
const OUTSIDE = { 'https://cdn.jsdelivr.net': ['script'], 'https://fonts.googleapis.com': ['stylesheet'], 'https://fonts.gstatic.com': ['font'] };
async function guardRequests(page, siteBase) {
  const origin = new URL(siteBase).origin;
  await page.route('**/*', route => {
    const q = route.request(), kind = q.resourceType();
    let u;
    try { u = new URL(q.url()); } catch (e) { return route.abort(); }
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.origin === origin) return route.continue();
    if ((OUTSIDE[u.origin] || []).indexOf(kind) !== -1) return route.continue();
    return route.abort();
  });
  if (page.routeWebSocket) await page.routeWebSocket(/.*/, ws => ws.close());
}

async function renderPiece(opts) {
  const tool = Object.prototype.hasOwnProperty.call(TOOLS, opts.tool) ? TOOLS[opts.tool] : null;
  if (!tool) throw Object.assign(new Error('The helper can\'t make a ' + opts.tool + ' yet.'), { status: 400 });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (opts.state) await guardRequests(page, opts.siteBase);
    await page.goto(opts.siteBase.replace(/\/$/, '') + tool.path, { waitUntil: 'networkidle', timeout: 90000 });
    if (opts.state) {
      const drawn = await page.evaluate(s => window.__render(s).then(() => ({ ok: window.__rendered === true }), e => ({ error: String(e && e.message || e) })), opts.state);
      if (!drawn.ok) throw new Error('The ' + opts.tool + ' could not be drawn: ' + (drawn.error || 'it never finished'));
    } else {
      if (!tool.inputs) throw Object.assign(new Error('The ' + opts.tool + ' is drawn from a job only.'), { status: 400 });
      for (const k of Object.keys(tool.inputs)) {
        if (opts.inputs && opts.inputs[k]) await page.setInputFiles(tool.inputs[k], opts.inputs[k]);
      }
      await page.waitForFunction(tool.ready, null, { timeout: 30000 });
    }
    if (opts.paper && tool.paper) await tool.paper(page, opts.paper);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).every(i => !i.src || (i.complete && i.naturalWidth > 0)), null, { timeout: 30000 });
    await page.waitForTimeout(500);   // the sheet's autofit runs after images settle
    await page.emulateMedia({ media: 'print' });
    const label = await page.evaluate(tool.label);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (errors.length) throw new Error('The ' + opts.tool + ' page reported an error: ' + errors[0]);
    return { pdf, label, pages };
  } finally {
    await browser.close();
  }
}

module.exports = { renderPiece, guardRequests, TOOLS };
