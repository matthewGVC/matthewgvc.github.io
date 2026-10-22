/* ============================================================
   Tests for assets/js/sheet-job.js: a job's facts laid onto the Showsheet,
   the sheet's edits turned back into job changes, and what a build records.
   Made-up rows only.

     node scripts/test-sheet-job.js
   ============================================================ */
'use strict';

const S = require('../assets/js/sheet-job.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const rec = (value, source, by) => ({ value, source: source || 'DE', bySource: by || { [source || 'DE']: value } });
function job(over) {
  const core = Object.assign({ address: '100 Example St', unit: '4A' }, over.core || {});
  const facts = {};
  Object.keys(over.facts || {}).forEach(k => { facts[k] = rec(over.facts[k]); core[k] = over.facts[k]; });
  core.facts = Object.assign(facts, over.rawFacts || {});
  return Object.assign({ id: 'p1', slug: 'x', kind: 'sale', market: 'NYC', version: 3, core, de: over.de || {} }, over.row || {});
}
const blank = () => ({ ownership: 'co-op', market: 'nyc', kind: 'sale', address: '', unit: '', neighborhood: '', borough: 'Manhattan', positioning: '',
  listingUrl: '', price: '', beds: '', baths: '', maintenance: '', commonCharges: '', taxesMonthly: '', maxFinancing: '', assessments: '', flipTax: '',
  capitalContributions: '', taxDeductible: '', sqft: '', lotSize: '', parking: '', propertyType: '',
  building: { builtYear: '', architect: '', stories: '', residences: '', service: '', policy: '', amenities: [] },
  residence: { exposures: '', outdoor: '', ceiling: '', climate: '', features: [] }, agentIds: ['x'], paper: 'a5', bleed: false });

/* ---------- small pieces ---------- */
check('marketKey', ['NYC', 'NJ', 'FL', '', null].map(S.marketKey), ['nyc', 'nj', 'fl', 'nyc', 'nyc']);
check('ownershipOf', ['Co-op', 'Condo', 'Condop', 'Townhouse', 'Single family', 'Other'].map(t => S.ownershipOf(job({ core: { propertyType: t } }))),
  ['co-op', 'condo', 'condo', 'house', 'house', 'house']);
check('ownershipOf: none in NYC', S.ownershipOf(job({})), null);
check('ownershipOf: none in NJ is a house', S.ownershipOf(job({ row: { market: 'NJ' } })), 'house');
check('listingUrlOf: core first', S.listingUrlOf(job({ core: { listingUrl: 'https://www.elliman.com/a/1' }, de: { listingUrl: 'https://www.elliman.com/b/2' } })), 'https://www.elliman.com/a/1');
check('listingUrlOf: DE snapshot', S.listingUrlOf(job({ de: { listingUrl: 'https://www.elliman.com/b/2' } })), 'https://www.elliman.com/b/2');
check('listingUrlOf: not https', S.listingUrlOf(job({ core: { listingUrl: 'javascript:alert(1)' } })), null);
check('agentsOf confirmed', S.agentsOf(job({ core: { agentIds: ['a', 'b'], suggestedAgentIds: ['c'] } })), { ids: ['a', 'b'], confirmed: true });
check('agentsOf suggested', S.agentsOf(job({ core: { suggestedAgentIds: ['c'] } })), { ids: ['c'], confirmed: false });

/* ---------- FIELDS ---------- */
const coop = job({ core: { propertyType: 'Co-op' }, facts: { price: 2250000, beds: 3, baths: 2, maintenance: 4200, maxFinancing: 80, flipTax: '2%' } });
const fc = S.FIELDS(coop);
check('NYC co-op prints maintenance, financing, flip tax', ['maintenance', 'maxFinancing', 'flipTax'].every(n => fc.includes(n)), true);
check('NYC co-op: no taxes, no sq ft', ['taxesMonthly', 'sqft', 'lotSize', 'commonCharges'].filter(n => fc.includes(n)), []);
const njHouse = job({ row: { market: 'NJ' }, core: { propertyType: 'Single family', city: 'Testville', address: '12 Sample Lane', unit: '' },
  facts: { price: 1850000, beds: 4, baths: 3, halfBaths: 1, taxesMonthly: 1200, commonCharges: 150, lotSize: '0.5 acre', sqft: 2800, parking: '2-car garage' } });
const fn = S.FIELDS(njHouse);
check('NJ house prints sq ft, lot, taxes, HOA, parking, city', ['sqft', 'lotSize', 'taxesMonthly', 'commonCharges', 'parking', 'city'].every(n => fn.includes(n)), true);
check('NJ house: no co-op lines', ['maintenance', 'maxFinancing', 'flipTax'].filter(n => fn.includes(n)), []);
const rental = job({ row: { kind: 'rental' }, core: { propertyType: 'Condo' }, facts: { rent: 5000, beds: 1, baths: 1 } });
check('rental prints rent, no price, no carrying lines', [S.FIELDS(rental).includes('rent'), S.FIELDS(rental).includes('price'), S.FIELDS(rental).includes('commonCharges')], [true, false, false]);

/* ---------- fill ---------- */
const a = S.fill(blank(), coop, {}).state;
check('co-op fill', [a.market, a.ownership, a.address, a.unit, a.price, a.beds, a.baths, a.maintenance, a.maxFinancing, a.flipTax, a.taxesMonthly],
  ['nyc', 'co-op', '100 Example St', '4A', '$2,250,000', '3', '2', '$4,200', '80%', '2%', '']);
const condo = job({ core: { propertyType: 'Condo', neighborhood: 'Testville' }, facts: { price: 3100000, commonCharges: 2100, taxesMonthly: 1900 } });
const b = S.fill(blank(), condo, {}).state;
check('NYC condo fill', [b.ownership, b.commonCharges, b.taxesMonthly, b.neighborhood], ['condo', '$2,100', '$1,900', 'Testville']);
const r = S.fill(blank(), rental, {}).state;
check('rental fill: rent in the price line', [r.kind, r.price, r.ownership], ['rental', '$5,000', 'condo']);
const n = S.fill(blank(), njHouse, {}).state;
check('NJ house fill', [n.market, n.ownership, n.propertyType, n.neighborhood, n.sqft, n.lotSize, n.parking, n.baths, n.taxesMonthly, n.commonCharges],
  ['nj', 'house', 'Single family', 'Testville', '2800', '0.5 acre', '2-car garage', '3.5', '$1,200', '$150']);
const njCondo = S.fill(blank(), job({ row: { market: 'NJ' }, core: { propertyType: 'Condo', city: 'Testville' }, facts: { commonCharges: 600 } }), {}).state;
check('NJ condo', [njCondo.market, njCondo.ownership, njCondo.commonCharges], ['nj', 'condo', '$600']);
const fl = S.fill(blank(), job({ row: { market: 'FL' }, core: { propertyType: 'Condo', city: 'Sampleton' }, facts: { price: 990000 } }), {}).state;
check('FL condo', [fl.market, fl.ownership, fl.neighborhood, fl.price], ['fl', 'condo', 'Sampleton', '$990,000']);
check('unknown type in NYC keeps the sheet\'s ownership', S.fill(Object.assign(blank(), { ownership: 'condo' }), job({}), {}).state.ownership, 'condo');
check('fill does not change its input', (() => { const s = blank(); S.fill(s, coop, {}); return s.price; })(), '');
const hd = S.fill(blank(), job({ facts: { headline: 'Light-filled corner classic' } }), {}).state;
check('headline is the lede', hd.positioning, 'Light-filled corner classic');
check('no headline keeps the sheet\'s lede', S.fill(Object.assign(blank(), { positioning: 'Mine' }), job({}), {}).state.positioning, 'Mine');
check('year built', S.fill(blank(), job({ facts: { yearBuilt: 1929 } }), {}).state.building.builtYear, '1929');
check('listing link and agents', (() => { const s = S.fill(blank(), job({ core: { agentIds: ['a'] }, de: { listingUrl: 'https://www.elliman.com/x/9' } }), {}).state; return [s.listingUrl, s.agentIds]; })(),
  ['https://www.elliman.com/x/9', ['a']]);

const lists = job({ facts: { buildingFeatures: ['Pre-war', 'Full-time doorman'], interiorFeatures: ['South exposure', 'Wood floors'] } });
const l1 = S.fill(blank(), lists, {});
check('lists go through the reader rules', [l1.state.building.service, l1.state.building.amenities, l1.state.residence.exposures, l1.state.residence.features],
  ['Full-time doorman', ['Pre-war'], 'South exposure', ['Wood floors']]);
check('lists redone when nothing was built', l1.redone, ['building', 'residence']);
const saved = Object.assign(blank(), { building: Object.assign(blank().building, { service: 'My words' }), residence: Object.assign(blank().residence, { features: ['Mine'] }) });
const l2 = S.fill(saved, lists, { previous: { facts: { buildingFeatures: ['Pre-war', 'Full-time doorman'], interiorFeatures: ['South exposure', 'Wood floors'] } } });
check('same lists as last build: wording kept', [l2.state.building.service, l2.state.residence.features, l2.redone], ['My words', ['Mine'], []]);
const l3 = S.fill(saved, lists, { previous: { facts: { buildingFeatures: ['Pre-war'], interiorFeatures: ['South exposure', 'Wood floors'] } } });
check('building list changed: only that section redone', [l3.state.building.service, l3.state.residence.features, l3.redone], ['Full-time doorman', ['Mine'], ['building']]);
check('no list on the job: saved section stays', S.fill(saved, job({}), {}).state.building.service, 'My words');

/* ---------- photos and floorplan ---------- */
check('photosOf: hero and order', S.photosOf(job({ row: { photo_hero: 'Photos/Edited/03.jpg', photo_order: ['Photos/Edited/01.jpg', 'Photos/Edited/03.jpg', 'Photos/Edited/02.jpg'] } }), null),
  { front: 'Photos/Edited/03.jpg', back: 'Photos/Edited/01.jpg', tray: ['Photos/Edited/01.jpg', 'Photos/Edited/03.jpg', 'Photos/Edited/02.jpg'] });
check('photosOf: order only', S.photosOf(job({ row: { photo_order: ['P/2.jpg', 'P/1.jpg'] } }), null), { front: 'P/2.jpg', back: 'P/1.jpg', tray: ['P/2.jpg', 'P/1.jpg'] });
check('photosOf: nothing picked, edited by name', S.photosOf(job({}), ['Photos/Edited/b.jpg', 'Photos/Edited/a.jpg']),
  { front: 'Photos/Edited/a.jpg', back: 'Photos/Edited/b.jpg', tray: ['Photos/Edited/a.jpg', 'Photos/Edited/b.jpg'] });
check('photosOf: nothing picked, Drive unknown', S.photosOf(job({}), null), null);
check('photosOf: hero alone joins the tray', S.photosOf(job({ row: { photo_hero: 'P/9.jpg' } }), ['P/1.jpg']), { front: 'P/9.jpg', back: 'P/1.jpg', tray: ['P/9.jpg', 'P/1.jpg'] });
check('photosOf: one photo, no back', S.photosOf(job({}), ['P/1.jpg']), { front: 'P/1.jpg', back: null, tray: ['P/1.jpg'] });

const fp = [
  { path: 'Floorplan/v1/Unit 4A v1.jpg', name: 'Unit 4A v1.jpg', modified: '2026-09-01' },
  { path: 'Floorplan/v2/Unit 4A v2.jpg', name: 'Unit 4A v2.jpg', modified: '2026-10-01' },
  { path: 'Floorplan/v2/Unit 4A v2 unbranded.png', name: 'Unit 4A v2 unbranded.png', modified: '2026-10-02' },
  { path: 'Floorplan/v3/Unit 4A v3.pdf', name: 'Unit 4A v3.pdf', modified: '2026-10-05' },
  { path: 'Floorplan/v3/Unit 4A v3.ai', name: 'Unit 4A v3.ai', modified: '2026-10-05' },
  { path: 'Floorplan/v2/Unit 4A v2 alt.jpg', name: 'Unit 4A v2 alt.jpg', modified: '2026-10-09' },
  { path: 'Floorplan/source/trace.jpg', name: 'trace.jpg', modified: '2026-10-09' }
];
check('pickFloorplan: newest version with an image, branded first', S.pickFloorplan(fp), { version: 2, render: 'branded', path: 'Floorplan/v2/Unit 4A v2.jpg', modified: '2026-10-01' });
check('pickFloorplan: unbranded when no branded', S.pickFloorplan(fp.slice(2, 3)), { version: 2, render: 'unbranded', path: 'Floorplan/v2/Unit 4A v2 unbranded.png', modified: '2026-10-02' });
check('pickFloorplan: PDF only gives nothing', S.pickFloorplan(fp.slice(3, 5)), null);
check('pickFloorplan: nothing', S.pickFloorplan([]), null);

/* ---------- edits back to the job ---------- */
const filled = S.fill(blank(), coop, {}).state;
check('no edits when untouched', S.factEdits(filled, coop), { edits: [], errors: [] });
const e1 = S.factEdits(Object.assign({}, filled, { price: '$2.1M' }), coop);
check('factEdits parse: price', e1, { edits: [{ field: 'price', from: 2250000, to: 2100000 }], errors: [] });
const e2 = S.factEdits(Object.assign({}, filled, { price: 'Call for price' }), coop);
check('factEdits parse: words refused', [e2.edits, e2.errors.map(x => x.field)], [[], ['price']]);
const e3 = S.factEdits(Object.assign({}, filled, { baths: '3.5' }), coop);
check('factEdits parse: half bath', e3.edits, [{ field: 'baths', from: 2, to: 3 }, { field: 'halfBaths', from: null, to: 1 }]);
check('same value retyped is no edit', S.factEdits(Object.assign({}, filled, { price: '2250000', maintenance: '4,200' }), coop).edits, []);
check('address and unit never', S.factEdits(Object.assign({}, filled, { address: '1 Other St', unit: '9Z' }), coop).edits, []);
check('emptied field is no edit', S.factEdits(Object.assign({}, filled, { maintenance: '' }), coop).edits, []);
check('maintenance with /mo', S.factEdits(Object.assign({}, filled, { maintenance: '$4,400/mo' }), coop).edits, [{ field: 'maintenance', from: 4200, to: 4400 }]);
check('max financing with %', S.factEdits(Object.assign({}, filled, { maxFinancing: '75%' }), coop).edits, [{ field: 'maxFinancing', from: 80, to: 75 }]);
check('lede to headline', S.factEdits(Object.assign({}, filled, { positioning: 'New lede' }), coop).edits, [{ field: 'headline', from: null, to: 'New lede' }]);
check('built wording is not a year: no edit', S.factEdits(Object.assign({}, filled, { building: Object.assign({}, filled.building, { builtYear: '1929, renovated 2005' }) }), coop).edits, []);
const nf = S.fill(blank(), njHouse, {}).state;
check('NJ town shown from city is no neighbourhood edit', S.factEdits(nf, njHouse).edits, []);
check('rental edits rent', S.factEdits(Object.assign({}, S.fill(blank(), rental, {}).state, { price: '5,200' }), rental).edits, [{ field: 'rent', from: 5000, to: 5200 }]);

const ap = S.applyEdits(coop, e1.edits, { noRebuild: {} });
check('applyEdits: Matt\'s value', [ap.set.core.price, ap.set.core.facts.price.source, ap.set.core.facts.price.bySource.DE], [2100000, 'Matt', 2250000]);
check('applyEdits: change row', ap.changes, [{ field: 'price', old_value: 2250000, new_value: 2100000, note: 'on the Showsheet', no_rebuild: false }]);
check('applyEdits: typo tick', S.applyEdits(coop, e1.edits, { noRebuild: { price: true } }).changes[0].no_rebuild, true);
check('applyEdits leaves the row alone', coop.core.price, 2250000);

const hb = job({ facts: { baths: 2, halfBaths: 1 } });
hb.core.facts.halfBaths = { value: 1, source: 'Matt', bySource: { Matt: 1 } };
const hbEd = S.factEdits(Object.assign({}, S.fill(blank(), hb, {}).state, { baths: '3' }), hb);
check('removing a half bath is an edit to null', hbEd.edits, [{ field: 'baths', from: 2, to: 3 }, { field: 'halfBaths', from: 1, to: null }]);
const hbAp = S.applyEdits(hb, hbEd.edits, {});
check('…and it sticks', [hbAp.set.core.facts.halfBaths, hbAp.set.core.halfBaths], [undefined, null]);
check('decimal baths from DE are not doubled', S.fill(blank(), job({ facts: { baths: 2.5, halfBaths: 1 } }), {}).state.baths, '2.5');
check('https link on DE wins over a bad core link', S.listingUrlOf(job({ core: { listingUrl: 'http://x.example' }, de: { listingUrl: 'https://www.elliman.com/y/3' } })), 'https://www.elliman.com/y/3');
check('NYC with only a city: the chip and FIELDS agree', [S.fill(blank(), job({ core: { city: 'Brooklyn' } }), {}).state.neighborhood, S.FIELDS(job({ core: { city: 'Brooklyn' } })).includes('city')], ['Brooklyn', true]);
check('no row does not throw', [typeof S.fill(blank(), null, {}).state, typeof S.builtFrom(null, null, {}).facts, S.factEdits(null, null).edits], ['object', 'object', []]);

/* ---------- built_from ---------- */
const bf = S.builtFrom(filled, coop, { photos: { front: { path: 'P/1.jpg', modified: 'm1' }, back: null }, floorplan: { version: 2, render: 'branded', path: 'F/v2/a.jpg', modified: 'm2' }, via: 'helper' });
check('builtFrom shape', Object.keys(bf), ['v', 'market', 'kind', 'ownership', 'facts', 'agents', 'agentsConfirmed', 'listingUrl', 'photos', 'floorplan', 'print', 'via']);
check('builtFrom facts are job values', [bf.facts.price, bf.facts.maintenance, bf.facts.maxFinancing], [2250000, 4200, 80]);
check('builtFrom NYC has no sq ft', 'sqft' in bf.facts, false);
check('builtFrom NJ has sq ft', S.builtFrom(nf, njHouse, {}).facts.sqft, 2800);
check('builtFrom keeps an unset printed fact as null', bf.facts.assessments, null);
check("builtFrom agents are the job's", S.builtFrom(Object.assign({}, filled, { agentIds: ['z'] }), job({ core: { agentIds: ['a'] } }), {}).agents, ['a']);
check('builtFrom print and via', [bf.print, bf.via, bf.market], [{ paper: 'a5', bleed: false }, 'helper', 'NYC']);

console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
if (failures.length) {
  console.log('\n  ' + failures.join('\n\n  ') + '\n');
  process.exit(1);
}
console.log();
