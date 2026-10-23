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
  // a given state may only bring inline pictures: an address elsewhere is dropped, never fetched
  const probe = require('http').createServer((q, r) => { probe.hits++; r.end(); });
  probe.hits = 0;
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const far = 'http://127.0.0.1:' + probe.address().port;
  const hostile = Object.assign({}, NJ, { photos: [{ src: far + '/p.jpg', fx: 50, fy: 50, name: 'p' }, { src: DOT, fx: 50, fy: 50, name: 'ok' }],
    floorplan: far + '/f.png', floorplan2: 'file:///C:/Windows/win.ini' });
  await draw(hostile);
  const kept = await page.evaluate(() => { const s = window.__test.state; return [s.photos.map(p => p.name), s.floorplan, s.floorplan2]; });
  check('only inline pictures are kept from a given state', kept, [['ok'], null, null]);
  check('nothing outside the page is fetched', probe.hits, 0);
  /* ---------- Slice 5: the Brochure drawn from a given state ---------- */
  const BRO = { address: '12 Sample Lane', city: 'Testville', state: 'NJ', zip: '07000', price: '1850000', beds: '4', baths: '3.5', sqft: '2800',
    blurb: 'A made-up house.', features: 'Pool\nFinished basement', agents: ['john-gasdaska'], paper: 'letter',
    images: [1, 2, 3].map(i => ({ id: i, name: 'p' + i, url: DOT, ar: 1.5, role: 'auto' })),
    floorplans: [{ id: 4, name: 'plan', url: DOT, label: 'Level 1', zoom: 1, tx: 0, ty: 0 }] };
  await page.goto(BASE + '/tools/brochure/', { waitUntil: 'networkidle' });
  const bro = async s => {
    await page.evaluate(s => window.__render(s), s);
    return page.evaluate(() => ({ rendered: window.__rendered === true, pages: document.querySelectorAll('.page').length,
      market: GVC_LEGAL.marketOf(window.__piece.state), addr: window.__piece.state.address, paper: window.__piece.state.paper,
      text: document.body.innerText.indexOf('A made-up house.') !== -1, prop: !!document.querySelector('#propBar').children.length }));
  };
  const b1 = await bro(BRO);
  check('brochure: rendered, five pages (cover, gallery, info, plan, closing)', [b1.rendered, b1.pages], [true, 5]);
  check('brochure: market from the state, the words on the page', [b1.market, b1.addr, b1.text], ['nj', '12 Sample Lane', true]);
  check('brochure: printed through the print dialog\'s path', await pages(), 5);
  const b2 = await bro(Object.assign({}, BRO, { paper: 'half', floorplans: [] }));
  check('brochure: half letter, no plan page', [b2.paper, b2.pages], ['half', 4]);
  await bro(Object.assign({}, BRO, { images: [{ id: 1, name: 'far', url: far + '/b.jpg', ar: 1, role: 'auto' }, { id: 2, name: 'ok', url: DOT, ar: 1, role: 'auto' }],
    floorplans: [{ id: 3, name: 'farplan', url: 'file:///C:/x.png' }], agents: null, gallery: 'nope', address: evil }));
  check('brochure: only inline pictures kept, nothing fetched, nothing run', [await page.evaluate(() => window.__piece.state.images.map(i => i.name).concat(window.__piece.state.floorplans.map(f => f.name))), probe.hits, await page.evaluate(() => window.__xss || 0)],
    [['ok'], 0, 0]);
  const b3 = await bro(Object.assign({}, BRO, { state: 'FL', zip: '33000' }));
  check('brochure: Florida legal follows the state', b3.market, 'fl');

  /* ---------- Slice 5: the Postcard drawn from a given state ---------- */
  const CARD = { kind: 'sale', address: '12 Sample Lane', unit: '', town: 'Testville', price: '1850000', agents: ['john-gasdaska'], bleed: 'bleed',
    photos: [{ url: DOT, name: 'a', x: 50, y: 50, w: 3000 }, { url: DOT, name: 'b', x: 50, y: 50, w: 3000 }] };
  await page.goto(BASE + '/tools/postcard/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('gvc.postcard.state', JSON.stringify({ headline: 'Saved in this browser' })));
  const card = async s => {
    await page.evaluate(s => window.__render(s), s);
    return page.evaluate(() => ({ rendered: window.__rendered === true, kind: window.__piece.state.kind, text: document.querySelector('#pages').innerText,
      size: document.querySelector('#pagesize').textContent, stored: localStorage.getItem('gvc.postcard.state') }));
  };
  const c1 = await card(CARD);
  check('postcard listed: rendered, its own headlines', [c1.rendered, c1.kind, /For Sale/i.test(c1.text), /Now Available/i.test(c1.text), /1,850,000/.test(c1.text)], [true, 'sale', true, true, true]);
  check('postcard: drawing never touches this browser\'s saved card', c1.stored, JSON.stringify({ headline: 'Saved in this browser' }));
  check('postcard: 2 pages', await pages(), 2);
  const c2 = await card(Object.assign({}, CARD, { kind: 'sold', price: '1800000', bleed: 'trim' }));
  check('postcard sold: Just Sold headlines, trim size', [/Just Sold/i.test(c2.text), /Sold in Your Neighborhood/i.test(c2.text), /9in 6in/.test(c2.size)], [true, true, true]);
  await card(Object.assign({}, CARD, { photos: [{ url: far + '/c.jpg', name: 'far' }, { url: DOT, name: 'ok' }, { url: DOT, name: 'x' }, { url: DOT, name: 'y' }], headline: evil, agents: 'nope' }));
  check('postcard: inline pictures only, two at most, nothing fetched or run',
    [await page.evaluate(() => window.__piece.state.photos.map(p => p.name)), probe.hits, await page.evaluate(() => window.__xss || 0)], [['ok', 'x'], 0, 0]);

  /* ---------- Slice 5: the Seller pitch drawn from a given state ---------- */
  const DECK = { address: '12 Sample Lane', city: 'Testville', state: 'NJ', zip: '07000', beds: '4', baths: '3.5', sqft: '2800', ptype: 'Single family',
    market: 'nj', agents: ['john-gasdaska'], comps: [{ address: '14 Sample Lane', price: '1,900,000', sqft: '2,700', bb: '4/3', date: '2026-08' }],
    priceLow: '1800000', priceMid: '1900000', priceHigh: '2000000', recBand: 'mid',
    photos: [{ id: 1, name: 'p1', url: DOT, role: 'auto' }], map: { name: 'map', url: DOT } };
  await page.goto(BASE + '/tools/seller-package/', { waitUntil: 'networkidle' });
  const deck = async s => {
    await page.evaluate(s => window.__render(s), s);
    return page.evaluate(() => ({ rendered: window.__rendered === true, pages: document.querySelectorAll('.page').length, market: window.__piece.state.market,
      map: !!window.__piece.state.map, text: document.querySelector('#pages, body').innerText.indexOf('14 Sample Lane') !== -1 }));
  };
  const d1 = await deck(DECK);
  check('seller: rendered, 12 pages, NJ, the map and comps in', [d1.rendered, d1.pages, d1.market, d1.map, d1.text], [true, 12, 'nj', true, true]);
  check('seller: 12 printed pages', await pages(), 12);
  const d2 = await deck(Object.assign({}, DECK, { showProperty: false, market: 'fl' }));
  check('seller: no property page, an unknown market speaks New York', [d2.pages, d2.market], [11, 'nyc']);
  await deck(Object.assign({}, DECK, { photos: [{ id: 1, name: 'far', url: far + '/s.jpg', role: 'auto' }], map: { name: 'farmap', url: far + '/m.png' }, address: evil, videos: 'x', reviews: [1, 'a'] }));
  check('seller: inline pictures only, nothing fetched or run',
    [await page.evaluate(() => [window.__piece.state.photos.length, window.__piece.state.map, window.__piece.state.reviews]), probe.hits, await page.evaluate(() => window.__xss || 0)], [[0, null, ['a']], 0, 0]);

  /* review fix: a picture that only starts like an inline one, or a position that isn't a number,
     must not get into the page (every tool, the Showsheet too) */
  const BAD = 'data:image/png;base64,"><img src=x onerror="window.__xss=1">';
  for (const [tool, s] of [
    ['showsheet', Object.assign({}, NJ, { photos: [{ src: BAD, fx: 50, fy: 50, name: 'bad' }], floorplan: BAD })],
    ['brochure', Object.assign({}, BRO, { images: [{ id: 1, name: 'bad', url: BAD, ar: 1, role: 'auto' }, { id: 2, name: 'ok', url: DOT, ar: 1, role: 'hero' }],
      coverPos: { x: '1%" onerror="window.__xss=2', y: 1 }, floorplans: [{ id: 3, name: 'p', url: DOT, zoom: '2) " onload="window.__xss=3', tx: 0, ty: 0 }],
      gallery: [{ rows: [{ h: 1, cells: [{ id: 2, w: '1" onclick="x', fx: 'evil', label: evil }] }] }] })],
    ['postcard', Object.assign({}, CARD, { photos: [{ url: BAD, name: 'bad' }, { url: DOT, name: 'ok', x: '1%" onerror="window.__xss=4', y: 2 }] })],
    ['seller-package', Object.assign({}, DECK, { photos: [{ id: 1, name: 'bad', url: BAD, role: 'auto' }], map: { name: 'm', url: BAD },
      pos: { hero: { x: '1%" onerror="window.__xss=5', y: 1 } }, comps: [{ address: evil, price: '1', note: evil }] })]
  ]) {
    await page.goto(BASE + '/tools/' + tool + '/', { waitUntil: 'networkidle' });
    await page.evaluate(s => window.__render(s), s);
    await page.waitForTimeout(300);
    check(tool + ': nothing injected runs', await page.evaluate(() => window.__xss || 0), 0);
  }
  check('brochure: positions and zoom come back as numbers', await (async () => {
    await page.goto(BASE + '/tools/brochure/', { waitUntil: 'networkidle' });
    await page.evaluate(s => window.__render(s), Object.assign({}, BRO, { coverPos: { x: '7', y: 'x' }, floorplans: [{ id: 3, name: 'p', url: DOT, zoom: '2', tx: 'a' }] }));
    return page.evaluate(() => [window.__piece.state.coverPos, window.__piece.state.floorplans[0].zoom, window.__piece.state.floorplans[0].tx]);
  })(), [{ x: 7, y: 50 }, 2, 0]);

  // security review: a comp's beds / baths line is printed as text
  await page.goto(BASE + '/tools/seller-package/', { waitUntil: 'networkidle' });
  await page.evaluate(s => window.__render(s), Object.assign({}, DECK, { comps: [{ address: '1 A St', price: '1', bb: '<img src=x onerror="window.__xss=9">' }] }));
  await page.waitForTimeout(300);
  check('seller: a comp\'s beds and baths never run', [await page.evaluate(() => window.__xss || 0), await page.evaluate(() => document.body.innerText.indexOf('<img src=x') !== -1)], [0, true]);

  /* ---------- Slice 6: the Open House flyer drawn from a given state ---------- */
  const FLY = { address: '12 Sample Lane', unit: '', town: 'Testville, NJ', price: '1850000', priceLabel: 'List Price', beds: '4', baths: '3.5', sqft: '2800',
    blurb: 'A made-up house.', market: 'nj', agents: ['john-gasdaska', 'tj-verdiglione'], listingUrl: 'https://www.elliman.com/x/1',
    dates: [{ start: '2026-10-25T15:00:00', end: '2026-10-25T17:00:00', broker: false }, { start: '2026-10-27T12:00:00', end: '2026-10-27T13:30:00', broker: true }],
    photos: [{ url: DOT, name: 'a', x: 50, y: 50, w: 3000 }, { url: DOT, name: 'b', x: 50, y: 50, w: 3000 }, { url: DOT, name: 'c', x: 50, y: 50, w: 3000 }] };
  await page.goto(BASE + '/tools/open-house/', { waitUntil: 'networkidle' });
  const fly = async s => {
    await page.evaluate(s => window.__render(s), s);
    return page.evaluate(() => ({ rendered: window.__rendered === true, dates: [...document.querySelectorAll('.oh-date')].map(d => d.textContent),
      legal: (document.querySelector('.oh-legal') || {}).textContent, njLegal: GVC_LEGAL.listing('nj'), addr: (document.querySelector('.oh-addr') || {}).textContent,
      strip: [...document.querySelectorAll('.oh-strip span')].map(s => s.textContent), photos: document.querySelectorAll('.oh-ph img').length,
      agents: document.querySelectorAll('.oh-ag').length, qr: !!document.querySelector('.oh-qr svg') }));
  };
  const f1 = await fly(FLY);
  check('flyer: rendered, DE dates as New York wall clock, broker marked', [f1.rendered, f1.dates],
    [true, ['Sunday, October 25 · 3:00 PM to 5:00 PM', 'Broker open houseTuesday, October 27 · 12:00 PM to 1:30 PM']]);
  check('flyer: the property, rooms, three photos, two agents, QR, NJ legal', [f1.addr, f1.strip, f1.photos, f1.agents, f1.qr, f1.legal === f1.njLegal],
    ['12 Sample Lane', ['Bedrooms', 'Bathrooms', 'Sq Ft'], 3, 2, true, true]);
  check('flyer: one Letter page', await pages(), 1);
  check('flyer: no dates prints By appointment; typed lines print as typed', [(await fly(Object.assign({}, FLY, { dates: [] }))).dates,
    (await fly(Object.assign({}, FLY, { dates: [{ day: 'Broker Saturday 11 to 1' }, { day: 'Sunday 1 to 3' }] }))).dates],
    [['By appointment'], ['Broker open houseSaturday 11 to 1', 'Sunday 1 to 3']]);
  await fly(Object.assign({}, FLY, { photos: [{ url: BAD, name: 'bad' }, { url: far + '/x.jpg', name: 'far' }, { url: DOT, name: 'ok', x: '1%" onerror="window.__xss=7', y: 2 }],
    address: evil, blurb: evil, dates: [{ day: evil }, { start: evil }], agents: 'x', market: 'zz' }));
  await page.waitForTimeout(300);
  check('flyer: hostile state never runs or fetches', [await page.evaluate(() => window.__piece.state.photos.map(p => [p.name, p.x])), probe.hits, await page.evaluate(() => window.__xss || 0), await page.evaluate(() => window.__piece.state.market)],
    [[['ok', 50]], 0, 0, 'nj']);
  await page.evaluate(() => localStorage.setItem('gvc.open-house.state', JSON.stringify({ address: 'From this browser' })));
  await fly(FLY);
  check('flyer: drawing never touches this browser\'s saved words', await page.evaluate(() => localStorage.getItem('gvc.open-house.state')), JSON.stringify({ address: 'From this browser' }));

  /* ---------- Slice 6: the signs drawn from a given state ---------- */
  await page.goto(BASE + '/tools/signage/', { waitUntil: 'networkidle' });
  const sgn = async s => {
    await page.evaluate(s => window.__render(s), s);
    return page.evaluate(() => ({ rendered: window.__rendered === true, kind: window.__piece.state.kind, names: [...document.querySelectorAll('.sg-nm')].map(n => n.textContent),
      phones: [...document.querySelectorAll('.sg-ph')].map(n => n.textContent), foot: (document.querySelector('.sg-foot, .sg-web') || {}).textContent,
      office: (document.querySelector('.sg-office') || {}).textContent || null, two: !!document.querySelector('.fs.two'), left: !!document.querySelector('.dr.left'),
      size: document.querySelector('#pagesize').textContent, heights: [...document.querySelectorAll('.sg-agents')].map(a => a.getBoundingClientRect().height > 0) }));
  };
  const s1 = await sgn({ kind: 'for-sale', market: 'nj', agents: ['george-putykewycz'], qrUrl: 'https://www.elliman.com/x/1' });
  check('sign: For Sale, one agent, M line, NJ office line, 24 x 30', [s1.rendered, s1.kind, s1.names, s1.phones, /^O 732\.387\.3807\|gvcrealestateteam\.com\|/.test(s1.foot), /24in 30in/.test(s1.size), s1.heights],
    [true, 'for-sale', ['George Putykewycz'], ['M 732.546.7375'], true, true, [true]]);
  check('sign: one 24 x 30 in page', await pages(), 1);
  const s2 = await sgn({ kind: 'for-sale', market: 'fl', agents: ['tj-verdiglione', 'marli-silver', 'john-gasdaska'] });
  check('sign: two agents at most, stacked; Florida has no office number', [s2.names, s2.two, /^gvcrealestateteam\.com/.test(s2.foot)], [['TJ Verdiglione', 'Marli Silver'], true, true]);
  const s3 = await sgn({ kind: 'directional', market: 'nj', arrow: 'left' });
  check('sign: the Open House arrow, left, 24.4 x 18.4, office line', [s3.kind, s3.left, /24\.4in 18\.4in/.test(s3.size), s3.office], ['directional', true, true, 'office: 732.387.3807']);
  check('sign: arrow sign one page', await pages(), 1);
  await sgn({ kind: 'nope', market: evil, agents: [evil, 7], qrUrl: 'javascript:alert(1)', arrow: evil });
  await page.waitForTimeout(200);
  check('sign: hostile state never runs, kind and market fall back', [await page.evaluate(() => [window.__piece.state.kind, window.__piece.state.market, window.__piece.state.arrow]), await page.evaluate(() => window.__xss || 0)],
    [['for-sale', 'nj', 'right'], 0]);
  check('sign: a QR that is not a web link points at the team site', await page.evaluate(() => !!document.querySelector('.sg-qr svg')), true);

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
      const ob = await renderPiece({ tool: 'brochure', state: BRO, siteBase: BASE });
      check('renderPiece brochure: 5 pages, label', [ob.pages, ob.label], [5, '12 Sample Lane']);
      const oc = await renderPiece({ tool: 'postcard-sold', state: Object.assign({}, CARD, { kind: 'sold' }), siteBase: BASE });
      check('renderPiece postcard: 2 pages, label', [oc.pages, oc.label], [2, '12 Sample Lane']);
      const os2 = await renderPiece({ tool: 'seller', state: DECK, siteBase: BASE });
      check('renderPiece seller: 12 pages, label', [os2.pages, os2.label], [12, '12 Sample Lane']);
      const ofl = await renderPiece({ tool: 'open-house', state: FLY, siteBase: BASE });
      check('renderPiece open house flyer: 1 page, label', [ofl.pages, ofl.label], [1, '12 Sample Lane']);
      const osg = await renderPiece({ tool: 'signage', state: { kind: 'for-sale', market: 'nj', agents: ['tj-verdiglione'], address: '12 Sample Lane' }, siteBase: BASE });
      check('renderPiece sign: 1 page', osg.pages, 1);
      // the hidden browser itself refuses pictures from anywhere but the site
      probe.hits = 0;
      const { chromium: ch } = require('playwright');
      const pg = await (await ch.launch()).newPage();
      const { guardRequests } = require('../helper/pdf/render.js');
      await guardRequests(pg, BASE);
      const seen = await pg.goto(BASE + '/tools/showsheet/', { waitUntil: 'networkidle' }).then(() => pg.evaluate(u => new Promise(r => {
        const i = new Image(); i.onload = () => r('loaded'); i.onerror = () => r('blocked'); i.src = u;
      }), far + '/x.png'));
      check('renderPiece: an outside picture is blocked', [seen, probe.hits], ['blocked', 0]);
      // security review: a script in a drawn page reaches nothing outside the site either
      const fetched = await pg.evaluate(u => fetch(u).then(() => 'reached', () => 'blocked'), far + '/leak');
      const styled = await pg.evaluate(u => new Promise(r => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = u; l.onload = () => r('loaded'); l.onerror = () => r('blocked'); document.head.appendChild(l); }), far + '/x.css');
      check('renderPiece: an outside fetch or stylesheet is blocked', [fetched, styled, probe.hits], ['blocked', 'blocked', 0]);
      check('renderPiece: the CDN scripts the tools need still load', await pg.evaluate(() => typeof window.gsap), 'object');
      await pg.context().browser().close();
    } catch (e) { failures.push('renderPiece with a state: ' + e.message); }
  }

  probe.closeAllConnections(); probe.close();
  console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
  if (failures.length) { console.log('\n  ' + failures.join('\n\n  ') + '\n'); process.exit(1); }
  console.log();
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
