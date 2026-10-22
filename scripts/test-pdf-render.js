/* ============================================================
   The Showsheet drawn from a given state (window.__render), the way the
   helper prints a job's sheet: New York, New Jersey and Florida sheets,
   a rental, and the helper's own renderPiece(). Made-up listings only.

     BASE=http://localhost:8096 node scripts/test-pdf-render.js
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const NYC = { market: 'nyc', ownership: 'co-op', address: '100 Example Street', unit: '4A', neighborhood: 'Testville', price: '$2,250,000',
  beds: '3', baths: '2', maintenance: '$4,200', maxFinancing: '80%', photos: [{ src: DOT, fx: 50, fy: 50, name: 'a' }], heroIndex: 0, agentIds: ['john-gasdaska'] };
const NJ = { market: 'nj', ownership: 'house', propertyType: 'Single family', address: '12 Sample Lane', unit: '', neighborhood: 'Testville',
  price: '$1,850,000', beds: '4', baths: '3.5', sqft: '2800', lotSize: '0.5 acre', parking: '2-car garage', taxesMonthly: '$1,200', commonCharges: '$150',
  building: { builtYear: '1998', architect: '', stories: '', residences: '', service: '', policy: '', amenities: ['Pool', 'Finished basement'] },
  photos: [{ src: DOT, fx: 50, fy: 50, name: 'a' }], heroIndex: 0, agentIds: ['john-gasdaska'] };
const FL = { market: 'fl', ownership: 'condo', propertyType: 'Condo', address: '9 Sample Way', unit: '12B', neighborhood: 'Sampleton',
  price: '$990,000', beds: '2', baths: '2', commonCharges: '$900', taxesMonthly: '$700', agentIds: ['john-gasdaska'] };
const NJ_RENT = Object.assign({}, NJ, { kind: 'rental', price: '$6,500', taxesMonthly: '', commonCharges: '' });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/tools/showsheet/', { waitUntil: 'networkidle' });

  async function draw(s) {
    await page.evaluate(s => window.__render(s), s);
    return page.evaluate(() => ({
      rendered: window.__rendered === true,
      addr: (document.querySelector('#sheetFront .addr') || {}).textContent,
      chip: (document.querySelector('#sheetBack .b-own') || {}).textContent || '',
      strip: [...document.querySelectorAll('#sheetFront .scell .slabel')].map(e => e.textContent),
      heads: [...document.querySelectorAll('#sheetFront .col-h span:last-child')].map(e => e.textContent),
      numbers: [...document.querySelectorAll('#sheetBack .num-fit .lg-row')].map(r => [r.querySelector('.lg-lab').textContent, r.querySelector('.lg-val').textContent]),
      foot: (document.querySelector('#sheetBack .lg-foot') || {}).textContent || '',
      ask: (document.querySelector('#sheetFront .al') || {}).textContent || '',
      dis: (document.querySelector('#sheetBack .dis') || {}).textContent,
      logos: document.querySelectorAll('#sheetFront .sh-logo svg').length,
      spill: [...document.querySelectorAll('#sheetFront .scell')].filter(c => c.scrollWidth > c.clientWidth + 1).length,
      legal: { nyc: GVC_LEGAL.listing('nyc'), nj: GVC_LEGAL.listing('nj'), fl: GVC_LEGAL.listing('fl') }
    }));
  }
  async function pages() {
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  }

  const a = await draw(NYC);
  check('NYC: rendered', [a.rendered, a.addr, a.chip], [true, '100 Example Street', 'CO-OP·TESTVILLE']);
  check('NYC: strip unchanged (no sq ft)', a.strip, ['Bedrooms', 'Bathrooms']);
  check('NYC: New York legal text', a.dis, a.legal.nyc);
  check('NYC: one logo', a.logos, 1);
  check('NYC: maintenance line', a.numbers.map(x => x[0]).includes('Maintenance'), true);
  check('NYC: 2 pages', await pages(), 2);

  const n = await draw(NJ);
  check('NJ: chip is type and town', n.chip, 'SINGLE FAMILY·TESTVILLE');
  check('NJ: strip adds sq ft, short labels', n.strip, ['Beds', 'Baths', 'Sq Ft']);
  check('NJ: every stat box holds its line', n.spill, 0);
  check('NJ: The Property for a house', n.heads.includes('The Property') && !n.heads.includes('The Building'), true);
  check('NJ: money block', n.numbers, [['Asking Price', '$1,850,000'], ['Property Taxes', '$14,400 / yr'], ['HOA', '$150 / mo'], ['Lot Size', '0.5 acre'], ['Est. Monthly Carrying', '$1,350']]);
  check('NJ: carrying footnote names HOA', n.foot, 'HOA & taxes; excludes mortgage financing.');
  check('NJ: legal text', n.dis, n.legal.nj);
  check('NJ: DE logo beside the lock-up', n.logos, 2);
  check('NJ: 2 pages', await pages(), 2);

  const f = await draw(FL);
  check('FL: condo money block', f.numbers.map(x => x[0]), ['Asking Price', 'Property Taxes', 'Common Charges', 'Est. Monthly Carrying']);
  check('FL: chip', f.chip, 'CONDO·SAMPLETON');
  check('FL: legal text', f.dis, f.legal.fl);
  check('FL: The Building for a condo', f.heads.includes('The Property'), false);

  const r = await draw(NJ_RENT);
  check('rental: Monthly Rent, no carrying', [r.ask, r.numbers.map(x => x[0])], ['Monthly Rent', ['Monthly Rent', 'Lot Size']]);

  check('assessments only when present', (await draw(Object.assign({}, NJ, { assessments: '$100/mo' }))).numbers.map(x => x[0]).includes('Assessments'), true);
  // hostile and broken states: escaped, never thrown, never hung
  const evil = '<img src=x onerror="window.__xss=1">';
  await draw(Object.assign({}, NJ, { propertyType: evil, sqft: evil, lotSize: evil, parking: evil, neighborhood: evil, address: evil }));
  check('hostile text never runs', await page.evaluate(() => window.__xss || 0), 0);
  const odd = await draw(Object.assign({}, NJ, { market: 'xx', photos: null, agentIds: null, building: 'nope' }));
  check('unknown market is New York, nulls ignored', [odd.rendered, odd.dis === odd.legal.nyc, odd.logos], [true, true, 1]);
  const coopNj = await draw(Object.assign({}, FL, { ownership: 'co-op', maintenance: '$3,000' }));
  check('a co-op in Florida prints as a condo', [coopNj.chip, coopNj.numbers.map(x => x[0]).includes('Maintenance')], ['CONDO·SAMPLETON', false]);
  check('no page errors', errors, []);
  await browser.close();

  // the helper's own path: renderPiece with a state
  if (process.env.SKIP_HELPER !== '1') {
    process.env.GVC_HELPER_HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gvc-render-'));
    const { renderPiece } = require('../helper/pdf/render.js');
    try {
      const out = await renderPiece({ tool: 'showsheet', state: NJ, paper: 'a5', siteBase: BASE });
      check('renderPiece: 2 pages', out.pages, 2);
      check('renderPiece: label', out.label, '12 Sample Lane');
    } catch (e) { failures.push('renderPiece with a state: ' + e.message); }
  }

  console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
  if (failures.length) { console.log('\n  ' + failures.join('\n\n  ') + '\n'); process.exit(1); }
  console.log();
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
