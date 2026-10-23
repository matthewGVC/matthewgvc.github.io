/* ============================================================
   Tests for assets/js/piece-job.js: a job laid onto the Brochure, the
   Postcards, the Seller pitch and the pitch's map; their edits turned back
   into job changes; what a build records. Made-up rows only.

     node scripts/test-piece-job.js
   ============================================================ */
'use strict';

const J = require('../assets/js/piece-job.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const rec = (value, source) => ({ value, source: source || 'DE', bySource: { [source || 'DE']: value } });
function job(over) {
  over = over || {};
  const core = Object.assign({ address: '100 Example St', unit: '4A' }, over.core || {});
  const facts = {};
  Object.keys(over.facts || {}).forEach(k => { facts[k] = rec(over.facts[k]); core[k] = over.facts[k]; });
  core.facts = facts;
  return Object.assign({ id: 'p1', slug: 'x', kind: 'sale', market: 'NYC', version: 3, core, de: {} }, over.row || {});
}
const pitch = over => Object.assign({ id: 'q1', slug: '12-sample-ln', label: '12 Sample Ln', market: 'NJ', version: 2,
  core: Object.assign({ address: '12 Sample Ln', city: 'Testville', state: 'NJ', zip: '07000' }, (over || {}).core || {}) }, (over || {}).row || {});

/* ---------- small pieces ---------- */
check('tools', J.TOOLS, ['brochure', 'postcard-listed', 'postcard-sold', 'seller', 'pitch-map']);
check('labels', J.TOOLS.map(J.label), ['Brochure', 'Just Listed postcard', 'Just Sold postcard', 'Seller pitch', 'Map']);
check('joinUnit', [J.joinUnit('100 Example St', '4A'), J.joinUnit('12 Sample Ln', ''), J.joinUnit('1 Main St', 'Penthouse North')],
  ['100 Example St, Residence 4A', '12 Sample Ln', '1 Main St, Penthouse North']);
check('mapAddresses: subject then comps, blanks dropped', J.mapAddresses(pitch({ core: { comps: [{ address: '14 Sample Ln' }, { address: ' ' }, { price: '1' }, { address: '9 Other Rd' }] } })),
  ['12 Sample Ln', '14 Sample Ln', '9 Other Rd']);
check('mapAddresses: no comps', J.mapAddresses(job()), ['100 Example St, Residence 4A']);

/* ---------- FIELDS ---------- */
const nycCondo = job({ facts: { price: 2250000, beds: 2, baths: 2, sqft: 1100, city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.', interiorFeatures: ['Washer/dryer'], buildingFeatures: ['Doorman'] },
  core: { propertyType: 'Condo', neighborhood: 'Upper West Side', listingUrl: 'https://www.elliman.com/x/1', agentIds: ['a', 'b', 'c'] } });
check('brochure FIELDS', J.FIELDS('brochure', nycCondo), ['price', 'beds', 'baths', 'halfBaths', 'sqft', 'parking', 'city', 'state', 'zip', 'description', 'interiorFeatures', 'buildingFeatures']);
check('brochure FIELDS: rental prints rent', J.FIELDS('brochure', job({ row: { kind: 'rental' } }))[0], 'rent');
check('brochure FIELDS: an older single list', J.FIELDS('brochure', job({ core: { features: ['Old list'] } })).slice(-1), ['features']);
check('postcard-listed FIELDS', J.FIELDS('postcard-listed', nycCondo), ['price', 'neighborhood']);
check('postcard-listed FIELDS: town when no neighbourhood', J.FIELDS('postcard-listed', job({ facts: { city: 'Rumson' } })), ['price', 'city']);
check('postcard-sold FIELDS: closing price when DE has one', J.FIELDS('postcard-sold', job({ core: { closePrice: 2100000, neighborhood: 'X' } })), ['closePrice', 'neighborhood']);
check('postcard-sold FIELDS: else the price', J.FIELDS('postcard-sold', nycCondo)[0], 'price');
check('seller FIELDS', J.FIELDS('seller', nycCondo), ['beds', 'baths', 'halfBaths', 'sqft', 'propertyType', 'yearBuilt', 'taxesMonthly', 'commonCharges', 'description',
  'interiorFeatures', 'city', 'state', 'zip', 'comps', 'priceLow', 'priceMid', 'priceHigh', 'recBand']);
check('pitch-map FIELDS', J.FIELDS('pitch-map', pitch()), ['mapAddresses']);
check('value: pitch facts read from core', J.value('seller', pitch({ core: { priceMid: 1500000, comps: [] } }), 'priceMid'), 1500000);
check('value: empty comps are none', J.value('seller', pitch({ core: { comps: [] } }), 'comps'), null);

/* ---------- fill ---------- */
const bro = J.fill('brochure', { address: '', features: 'old', blurb: 'kept', agents: [], paper: 'half' }, nycCondo, {});
check('brochure fill: address line, facts as figures', [bro.state.address, bro.state.price, bro.state.beds, bro.state.baths, bro.state.sqft, bro.state.city, bro.state.state, bro.state.zip],
  ['100 Example St, Residence 4A', '2250000', '2', '2', '1100', 'New York', 'NY', '10024']);
check('brochure fill: description, link, two agents, paper kept', [bro.state.blurb, bro.state.listingUrl, bro.state.agents, bro.state.paper],
  ['Sunny.', 'https://www.elliman.com/x/1', ['a', 'b'], 'half']);
check('brochure fill: features from both lists, redone', [bro.state.features, bro.redone], ['Washer/dryer\nDoorman', ['features']]);
const bro2 = J.fill('brochure', { features: 'My own wording' }, nycCondo, { previous: { facts: { interiorFeatures: ['Washer/dryer'], buildingFeatures: ['Doorman'] } } });
check('brochure fill: same lists since the build keep the wording', [bro2.state.features, bro2.redone], ['My own wording', []]);
const bro3 = J.fill('brochure', { features: 'My own wording' }, nycCondo, { previous: { facts: { interiorFeatures: ['Washer/dryer'], buildingFeatures: [] } } });
check('brochure fill: a changed list redoes them', bro3.redone, ['features']);
check('brochure fill: half bath', J.fill('brochure', {}, job({ facts: { baths: 2, halfBaths: 1 } }), {}).state.baths, '2.5');
check('brochure fill: rental prints the rent', J.fill('brochure', {}, job({ row: { kind: 'rental' }, facts: { rent: 9500 } }), {}).state.price, '9500');

const pl = J.fill('postcard-listed', { headline: 'Mine', agents: [] }, nycCondo, {}).state;
check('postcard-listed fill', [pl.kind, pl.address, pl.unit, pl.town, pl.price, pl.headline, pl.agents], ['sale', '100 Example St', '4A', 'Upper West Side', '2250000', 'Mine', ['a', 'b']]);
const ps = J.fill('postcard-sold', {}, job({ facts: { price: 2250000, city: 'Rumson' }, core: { closePrice: 2100000 } }), {}).state;
check('postcard-sold fill: closing price, town', [ps.kind, ps.price, ps.town], ['sold', '2100000', 'Rumson']);

const njHouse = job({ row: { market: 'NJ' }, facts: { beds: 4, baths: 3, halfBaths: 1, sqft: 2800, propertyType: 'Single family', yearBuilt: 1998, taxesMonthly: 1200, city: 'Testville', state: 'NJ', zip: '07000', interiorFeatures: ['Fireplace'] },
  core: { comps: [{ address: '14 Sample Ln', price: '1,900,000', sqft: '', bb: '4/3', date: '' }], priceLow: 1800000, priceMid: 1900000, priceHigh: 2000000, recBand: 'mid', agentIds: ['m'] } });
const se = J.fill('seller', { client: 'Kept', market: 'nyc', comps: [] }, njHouse, {}).state;
check('seller fill: subject facts', [se.address, se.beds, se.baths, se.sqft, se.ptype, se.year, se.taxes, se.city, se.state, se.zip], ['100 Example St, Residence 4A', '4', '3.5', '2800', 'Single family', '1998', '1200', 'Testville', 'NJ', '07000']);
check('seller fill: comps, band, market, sheet-only kept', [se.comps.length, se.priceMid, se.recBand, se.market, se.client, se.features], [1, '1900000', 'mid', 'nj', 'Kept', 'Fireplace']);
check('seller fill: Florida speaks New Jersey', J.fill('seller', {}, job({ row: { market: 'FL' } }), {}).state.market, 'nj');
const sp = J.fill('seller', { comps: [{ address: 'stale' }] }, pitch(), {}).state;
check('seller fill on a pitch with no comps empties them', [sp.address, sp.comps, sp.city], ['12 Sample Ln', [], 'Testville']);

/* ---------- factEdits / applyEdits ---------- */
const filled = J.fill('brochure', {}, nycCondo, {}).state;
check('brochure: nothing changed, no edits', J.factEdits('brochure', filled, nycCondo), { edits: [], errors: [] });
check('brochure: price typed', J.factEdits('brochure', Object.assign({}, filled, { price: '$2.1M' }), nycCondo).edits, [{ field: 'price', from: 2250000, to: 2100000 }]);
check('brochure: baths with a half', J.factEdits('brochure', Object.assign({}, filled, { baths: '2.5' }), nycCondo).edits, [{ field: 'halfBaths', from: null, to: 1 }]);
check('brochure: a price that is words is refused', J.factEdits('brochure', Object.assign({}, filled, { price: 'Call for price' }), nycCondo).errors.length, 1);
check('brochure: description typed', J.factEdits('brochure', Object.assign({}, filled, { blurb: 'New words.' }), nycCondo).edits, [{ field: 'description', from: 'Sunny.', to: 'New words.' }]);
check('brochure: features wording is the piece\'s own', J.factEdits('brochure', Object.assign({}, filled, { features: 'Other' }), nycCondo).edits, []);
check('brochure: empty field leaves the job', J.factEdits('brochure', Object.assign({}, filled, { sqft: '' }), nycCondo).edits, []);
const ap = J.applyEdits('brochure', nycCondo, [{ field: 'price', from: 2250000, to: 2100000 }], { noRebuild: { price: true } });
check('applyEdits: Matt\'s value, logged on the Brochure', [ap.set.core.price, ap.set.core.facts.price.source, ap.changes],
  [2100000, 'Matt', [{ field: 'price', old_value: 2250000, new_value: 2100000, note: 'on the Brochure', no_rebuild: true }]]);

const pfill = J.fill('postcard-listed', {}, nycCondo, {}).state;
check('postcard-listed: price typed', J.factEdits('postcard-listed', Object.assign({}, pfill, { price: '2,200,000' }), nycCondo).edits, [{ field: 'price', from: 2250000, to: 2200000 }]);
check('postcard-listed: town is the card\'s own', J.factEdits('postcard-listed', Object.assign({}, pfill, { town: 'UWS' }), nycCondo).edits, []);
check('postcard-sold: nothing goes back to the job', J.factEdits('postcard-sold', Object.assign({}, pfill, { price: '1' }), nycCondo).edits, []);

const sfill = J.fill('seller', {}, njHouse, {}).state;
check('seller: nothing changed, no edits', J.factEdits('seller', sfill, njHouse), { edits: [], errors: [] });
const comps2 = sfill.comps.concat([{ address: '20 Sample Ln', price: '2,000,000', sqft: '', bb: '', date: '' }, { address: '', price: '', sqft: '', bb: '', date: '' }]);
const se2 = J.factEdits('seller', Object.assign({}, sfill, { comps: comps2, priceMid: '1,950,000', taxes: '1300' }), njHouse);
check('seller: comps, band and taxes typed', se2.edits.map(e => e.field), ['taxesMonthly', 'priceMid', 'comps']);
check('seller: blank comp rows dropped', se2.edits[2].to.length, 2);
check('seller: band as a number', se2.edits[1].to, 1950000);
check('seller: a band that is words is refused', J.factEdits('seller', Object.assign({}, sfill, { priceLow: 'about two' }), njHouse).errors.length, 1);
const sap = J.applyEdits('seller', njHouse, se2.edits, {});
check('seller applyEdits: band and comps plain on core, taxes as Matt\'s', [sap.set.core.priceMid, sap.set.core.comps.length, sap.set.core.facts.taxesMonthly.source, !!sap.set.core.facts.priceMid],
  [1950000, 2, 'Matt', false]);
check('seller applyEdits: note', sap.changes.map(c => c.note), ['on the Seller pitch', 'on the Seller pitch', 'on the Seller pitch']);
const pfillP = J.fill('seller', {}, pitch(), {}).state;
const pe = J.factEdits('seller', Object.assign({}, pfillP, { beds: '3', comps: [{ address: '14 Sample Ln' }] }), pitch());
check('seller on a pitch: beds and comps', pe.edits.map(e => [e.field, e.to]), [['beds', 3], ['comps', [{ address: '14 Sample Ln' }]]]);   // the deck's rows as typed
const pap = J.applyEdits('seller', pitch(), pe.edits, {});
check('seller on a pitch: core gains a facts record only for the typed fact', [Object.keys(pap.set.core.facts), pap.set.core.beds], [['beds'], 3]);
check('a pitch with only band edits keeps no facts record', J.applyEdits('seller', pitch(), [{ field: 'priceMid', from: null, to: 1 }], {}).set.core.facts, undefined);

/* ---------- builtFrom ---------- */
const bf = J.builtFrom('brochure', { paper: 'half' }, nycCondo, { photos: [{ path: 'Photos/Edited/01.jpg', modified: 'x' }], plans: [{ path: 'Floorplan/v2/A.jpg', version: 2 }], via: 'helper' });
check('builtFrom shape', [bf.v, bf.tool, bf.market, bf.kind, bf.facts.price, bf.facts.parking, bf.agents, bf.agentsConfirmed, bf.listingUrl, bf.photos.length, bf.plans.length, bf.map, bf.print.paper, bf.via],
  [2, 'brochure', 'NYC', 'sale', 2250000, null, ['a', 'b'], true, 'https://www.elliman.com/x/1', 1, 1, null, 'half', 'helper']);
check('builtFrom: every printed fact, nulls kept', Object.keys(bf.facts), J.FIELDS('brochure', nycCondo));
const mb = J.builtFrom('pitch-map', {}, pitch({ core: { comps: [{ address: '14 Sample Ln' }] } }), {});
check('builtFrom: map keeps the addresses', [mb.facts.mapAddresses, mb.agents], [['12 Sample Ln', '14 Sample Ln'], []]);
check('builtFrom: postcard has no listing link', J.builtFrom('postcard-listed', {}, nycCondo, {}).listingUrl, null);

/* ---------- files ---------- */
check('photosFor: unknown', J.photosFor('brochure', job(), null), null);
const picked = job({ row: { photo_hero: 'Photos/Edited/03.jpg', photo_order: ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg', 'Photos/Edited/03.jpg'] } });
check('photosFor brochure: hero first, then picks', J.photosFor('brochure', picked, null), ['Photos/Edited/03.jpg', 'Photos/Edited/01.jpg', 'Photos/Edited/02.jpg']);
check('photosFor postcard: two', J.photosFor('postcard-listed', picked, null), ['Photos/Edited/03.jpg', 'Photos/Edited/01.jpg']);
check('photosFor: edited by name when nothing picked', J.photosFor('brochure', job(), ['Photos/Edited/b.jpg', 'Photos/Edited/a.jpg']), ['Photos/Edited/a.jpg', 'Photos/Edited/b.jpg']);
const plans = [
  { path: 'Floorplan/v1/Unit v1.jpg', modified: '2026-01-01' },
  { path: 'Floorplan/v2/Level 1 v2.jpg', modified: '2026-02-01' },
  { path: 'Floorplan/v2/Level 1 v2 unbranded.jpg', modified: '2026-03-01' },
  { path: 'Floorplan/v2/Level 2 v2.png', modified: '2026-02-01' },
  { path: 'Floorplan/v2/Level 2 v2.pdf', modified: '2026-02-01' },
  { path: 'Floorplan/Source/raw v3.jpg', modified: '2026-04-01' },
  { path: 'Floorplan/v2/Level 1 alt v2.jpg', modified: '2026-04-01' }
];
check('pickFloorplans: newest version, one per level, branded first', J.pickFloorplans(plans).map(p => p.path), ['Floorplan/v2/Level 1 v2.jpg', 'Floorplan/v2/Level 2 v2.png']);
check('pickFloorplans: none', J.pickFloorplans([{ path: 'Floorplan/v1/x.pdf' }]), []);
check('pitchPhotos', J.pitchPhotos([
  { path: 'img.jpg' }, { path: 'Photos/b.png' }, { path: 'gvc-3d-property-map.png' }, { path: 'Map - 12 Sample Ln - 2026-10-22.png' },
  { path: 'Assets/deep/x.jpg' }, { path: 'Photos/sub/y.jpg' }, { path: 'notes.pdf' }, { path: 'Archive/old.jpg' }
]), ['Photos/b.png']);   // Photos/ only: a folder's loose top-level files are never read (plan §9)

/* ---------- review fixes (Tasks 2-4) ---------- */
const untouched = J.fill('seller', { recBand: 'mid', comps: [] }, pitch(), {}).state;
check('seller: the tool\'s default band is no edit', J.factEdits('seller', untouched, pitch()), { edits: [], errors: [] });
check('seller: a band picked by hand is an edit', J.factEdits('seller', Object.assign({}, untouched, { recBand: 'high' }), pitch()).edits, [{ field: 'recBand', from: null, to: 'high' }]);
const banded = pitch({ core: { priceMid: 2100000 } });
check('seller: a price band retyped with commas is no edit', J.factEdits('seller', Object.assign({}, J.fill('seller', {}, banded, {}).state, { priceMid: '2,100,000' }), banded).edits, []);
const extra = pitch({ core: { comps: [{ address: '14 Sample Ln', price: '1', sqft: '', bb: '', date: '', url: 'https://example.com/x' }] } });
const ef = J.fill('seller', {}, extra, {}).state;
check('seller: comps with extra keys, untouched, no edit', J.factEdits('seller', ef, extra).edits, []);
const ef2 = Object.assign({}, ef, { comps: ef.comps.concat([{ address: '20 Sample Ln', price: '', sqft: '', bb: '', date: '' }]) });
check('seller: a comp added keeps the others\' extra keys', J.factEdits('seller', ef2, extra).edits[0].to[0].url, 'https://example.com/x');
if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
