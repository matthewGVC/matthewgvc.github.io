/* ============================================================
   REGRESSION BASELINE — pictures of every printed tool, to compare
   against after a shared file changes (workspace v2 plan §11).

     python -m http.server 8080            (from the repo root)
     node scripts/baseline.js              render → exports/baseline/<date>/ (--force replaces it)
     node scripts/baseline.js --compare 2026-10-19
                                           render again into a temp folder and
                                           fail on any page that moved

   Each tool is opened fresh (empty storage, clock fixed at 2026-10-19 noon),
   set to one variant, printed with Chrome's own PDF engine and rasterised at
   100 dpi with PyMuPDF. A page "moved" when its mean pixel difference is over
   0.5%, more than 0.1% of its pixels changed noticeably (a moved line of
   text), or a variant's page count changed. A deliberate design change gets a
   new baseline under a new date, and the commit says so.

   BASE=http://localhost:8094 tests another copy of the site.
   Needs Python with PyMuPDF, numpy and Pillow.
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8080';
const ROOT = path.join(__dirname, '..');
const SAMPLE = path.join(ROOT, 'tools', 'showsheet', 'sample');
const LIMIT = 0.005;          // mean pixel difference
const CHANGED = 0.001;       // share of pixels that changed by more than 32 of 255

const click = sel => page => page.click(sel);
const showsheet = paper => async page => {
  await page.setInputFiles('#docxFile', path.join(SAMPLE, 'listing.docx'));
  await page.setInputFiles('#phFile', path.join(SAMPLE, 'hero.jpg'));
  await page.setInputFiles('#fpFile', path.join(SAMPLE, 'floorplan.jpg'));
  await page.waitForFunction(() => typeof state !== 'undefined' && !!state.address);   // eslint-disable-line no-undef
  await page.click('#paperSeg button[data-v="' + paper + '"]');
};

/* New Jersey and Florida sheets (Slice 4), drawn from a made-up state through
   window.__render, the way the helper prints a job's sheet. */
const dataUrl = (file, type) => 'data:' + type + ';base64,' + fs.readFileSync(path.join(SAMPLE, file)).toString('base64');
const SHEET_BASE = () => ({ unit: '', agentIds: ['john-gasdaska', 'tj-verdiglione'],
  photos: [{ src: dataUrl('hero.jpg', 'image/jpeg'), fx: 50, fy: 50, name: 'Photo' }], heroIndex: 0, floorplan: dataUrl('floorplan.jpg', 'image/jpeg'),
  listingUrl: 'https://www.elliman.com/new-jersey/sales/detail/12-sample-lane/1234567' });
const sheetState = s => async page => {
  await page.evaluate(st => window.__render(st), Object.assign(SHEET_BASE(), s));
};
const NJ_HOUSE = { market: 'nj', ownership: 'house', propertyType: 'Single family', address: '12 Sample Lane', neighborhood: 'Testville',
  price: '$1,850,000', beds: '4', baths: '3.5', sqft: '2800', lotSize: '0.5 acre', parking: 'Two-car garage', taxesMonthly: '$1,200', commonCharges: '$150',
  positioning: 'A shingle-style colonial a short walk from the river.',
  building: { builtYear: '1998', amenities: ['Heated pool', 'Finished lower level', 'Bluestone patio'] },
  residence: { exposures: 'Southern light', outdoor: 'Wraparound porch', features: ["Chef's kitchen", 'Primary suite with dressing room', 'Wide-plank oak floors'] } };
const FL_CONDO = { market: 'fl', ownership: 'condo', propertyType: 'Condo', address: '9 Sample Way', unit: '12B', neighborhood: 'Sampleton',
  price: '$990,000', beds: '2', baths: '2', sqft: '1,350', commonCharges: '$900', taxesMonthly: '$700', assessments: '$75/mo',
  building: { builtYear: '2016', stories: '18', residences: '120', service: 'Full-time concierge', amenities: ['Oceanfront pool', 'Fitness center'] },
  residence: { exposures: 'East to the ocean', features: ['Floor-to-ceiling windows', 'Summer kitchen on the terrace'] } };

const VARIANTS = [
  ['showsheet', 'a5', showsheet('a5')],
  ['showsheet', 'letter', showsheet('letter')],
  ['showsheet', 'nj-house', sheetState(NJ_HOUSE)],
  ['showsheet', 'fl-condo', sheetState(FL_CONDO)],
  ['brochure', 'letter', click('#paperSeg button[data-v="letter"]')],
  ['brochure', 'half', click('#paperSeg button[data-v="half"]')],
  ['seller-package', 'default', null],
  ['buyer-package', 'nj', click('#regionPick button[data-region="nj"]')],
  ['buyer-package', 'nyc', click('#regionPick button[data-region="nyc"]')],
  ['buyer-package', 'fl', click('#regionPick button[data-region="fl"]')],
  ['postcard', 'sold', click('#kindPick button[data-kind="sold"]')],
  ['postcard', 'sale', click('#kindPick button[data-kind="sale"]')],
  ['agent-info', 'default', null],
  ['destination-guide', 'default', null],
  ['new-development', 'default', null],
  ['nj-footprint', 'sales', click('#viewSeg button[data-v="sales"]')],
  ['nj-footprint', 'towns', click('#viewSeg button[data-v="towns"]')]
];

const RASTER = [
  'import fitz, sys, os',
  'd = fitz.open(sys.argv[1])',
  'for i, p in enumerate(d):',
  '    p.get_pixmap(dpi=100).save(os.path.join(sys.argv[2], sys.argv[3] + "-p%d.png" % (i + 1)))',
  'print(d.page_count)'
].join('\n');

const DIFF = [
  'import sys, json',
  'import numpy as np',
  'from PIL import Image',
  'a = np.asarray(Image.open(sys.argv[1]).convert("RGB"), dtype=np.int16)',
  'b = np.asarray(Image.open(sys.argv[2]).convert("RGB"), dtype=np.int16)',
  'if a.shape != b.shape:',
  '    print(json.dumps({"size": True}))',
  'else:',
  '    d = np.abs(a - b)',
  '    print(json.dumps({"mean": float(d.mean() / 255), "changed": float((d.max(axis=2) > 32).mean())}))'
].join('\n');

async function render(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const manifest = [];
  try {
    for (const [tool, variant, setup] of VARIANTS) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
      const res = await page.goto(BASE + '/tools/' + tool + '/', { waitUntil: 'networkidle' });
      if (!res || !res.ok()) throw new Error(tool + ': the page answered ' + (res ? res.status() : 'nothing') + '. Is the server on ' + BASE + '?');
      if (setup) await setup(page);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => Array.from(document.images).every(i => !i.src || (i.complete && i.naturalWidth > 0)), null, { timeout: 30000 })
        .catch(() => { throw new Error(tool + ' ' + variant + ': an image never loaded, so this render can\'t be trusted.'); });
      await page.waitForTimeout(800);
      const pdfFile = path.join(outDir, tool + '-' + variant + '.pdf');
      fs.writeFileSync(pdfFile, await page.pdf({ preferCSSPageSize: true, printBackground: true }));
      const pages = Number(execFileSync('python', ['-c', RASTER, pdfFile, outDir, tool + '-' + variant], { encoding: 'utf8' }).trim());
      fs.unlinkSync(pdfFile);
      manifest.push({ tool, variant, pages, files: Array.from({ length: pages }, (_, i) => tool + '-' + variant + '-p' + (i + 1) + '.png') });
      console.log('  ' + tool + ' ' + variant + ': ' + pages + ' page' + (pages === 1 ? '' : 's'));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

async function main() {
  const i = process.argv.indexOf('--compare');
  if (i === -1) {
    const date = new Date().toISOString().slice(0, 10);
    const dir = path.join(ROOT, 'exports', 'baseline', date);
    if (fs.existsSync(path.join(dir, 'manifest.json')) && process.argv.indexOf('--force') === -1) {
      console.log('A baseline for ' + date + ' already exists. Compare against it, or pass --force to replace it.');
      process.exit(1);
    }
    console.log('Baseline → ' + dir);
    await render(dir);
    return;
  }
  const refDir = path.join(ROOT, 'exports', 'baseline', process.argv[i + 1]);
  const ref = JSON.parse(fs.readFileSync(path.join(refDir, 'manifest.json'), 'utf8'));
  const nowDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-baseline-'));
  console.log('Comparing with ' + refDir);
  const now = await render(nowDir);
  const bad = [];
  ref.forEach(r => {
    const n = now.find(x => x.tool === r.tool && x.variant === r.variant);
    if (!n) return bad.push(r.tool + ' ' + r.variant + ': not rendered');
    if (n.pages !== r.pages) return bad.push(r.tool + ' ' + r.variant + ': ' + r.pages + ' pages before, ' + n.pages + ' now');
    r.files.forEach(f => {
      const d = JSON.parse(execFileSync('python', ['-c', DIFF, path.join(refDir, f), path.join(nowDir, f)], { encoding: 'utf8' }));
      if (d.size) bad.push(f + ': the page size changed');
      else if (d.mean > LIMIT || d.changed > CHANGED) bad.push(f + ': ' + (d.changed * 100).toFixed(2) + '% of pixels changed (mean difference ' + (d.mean * 100).toFixed(2) + '%)');
    });
  });
  if (bad.length) {
    console.log('\nMOVED:\n  ' + bad.join('\n  '));
    console.log('\nNew pictures are in ' + nowDir);
    process.exit(1);
  }
  console.log('\nEvery page matches the baseline.');
}

main().catch(e => { console.error(e); process.exit(1); });
