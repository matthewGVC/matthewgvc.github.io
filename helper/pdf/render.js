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
   the three files dropped into its file inputs. Slice 3 adds "open the
   job's saved state" (spec §1 C). Nothing here writes a file: name.js does.
   ============================================================ */
'use strict';

require('../config.js');   // points Playwright at the helper's own browser

const TOOLS = {
  showsheet: {
    path: '/tools/showsheet/',
    inputs: { docx: '#docxFile', photo: '#phFile', floorplan: '#fpFile' },
    ready: () => typeof state !== 'undefined' && !!state.address,          // eslint-disable-line no-undef
    label: () => [state.address, state.unit].filter(Boolean).join(' '),    // eslint-disable-line no-undef
    paper: async (page, paper) => { await page.click('#paperSeg button[data-v="' + paper + '"]'); }
  }
};

async function renderPiece(opts) {
  const tool = TOOLS[opts.tool];
  if (!tool) throw Object.assign(new Error('The helper can\'t make a ' + opts.tool + ' yet.'), { status: 400 });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(opts.siteBase.replace(/\/$/, '') + tool.path, { waitUntil: 'networkidle', timeout: 90000 });
    for (const k of Object.keys(tool.inputs)) {
      if (opts.inputs && opts.inputs[k]) await page.setInputFiles(tool.inputs[k], opts.inputs[k]);
    }
    await page.waitForFunction(tool.ready, null, { timeout: 30000 });
    if (opts.paper) await tool.paper(page, opts.paper);
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

module.exports = { renderPiece, TOOLS };
