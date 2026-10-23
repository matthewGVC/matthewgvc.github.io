/* ============================================================
   Tests for assets/js/piece-stale.js: when a printed piece no longer
   matches its job (spec S15). Made-up rows only.

     node scripts/test-piece-stale.js
   ============================================================ */
'use strict';

const S = require('../assets/js/sheet-job.js');
const ST = require('../assets/js/piece-stale.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

function job(over) {
  const core = Object.assign({ address: '100 Example St', unit: '4A', propertyType: 'Condo', agentIds: ['a', 'b'] }, over.core || {});
  const facts = {};
  const f = Object.assign({ price: 2250000, beds: 3, baths: 2, commonCharges: 2100, taxesMonthly: 1900, sqft: 1400 }, over.facts || {});
  Object.keys(f).forEach(k => { facts[k] = { value: f[k], source: 'DE', bySource: { DE: f[k] } }; core[k] = f[k]; });
  core.facts = facts;
  return Object.assign({ id: 'p1', kind: 'sale', market: 'NYC', core, de: { listingUrl: 'https://www.elliman.com/x/1' },
    photo_hero: 'Photos/Edited/01.jpg', photo_order: ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg'] }, over.row || {});
}
const state = { ownership: 'condo', agentIds: ['a', 'b'], paper: 'a5', bleed: false };
const built = row => ({
  built_from: S.builtFrom(state, row, { photos: { front: { path: 'Photos/Edited/01.jpg', modified: '2026-10-01T10:00:00Z' }, back: { path: 'Photos/Edited/02.jpg', modified: '2026-10-01T10:00:00Z' } },
    floorplan: { version: 1, render: 'branded', path: 'Floorplan/v1/Plan v1.jpg', modified: '2026-10-02T10:00:00Z' }, via: 'helper' }),
  output: { name: 'Showsheet - 100 Example St 4A - 2026-10-03.pdf' }
});
const files = { 'Photos/Edited/01.jpg': { modified: '2026-10-01T10:00:00Z' }, 'Photos/Edited/02.jpg': { modified: '2026-10-01T10:00:00Z' } };
const plan1 = { version: 1, render: 'branded', path: 'Floorplan/v1/Plan v1.jpg', modified: '2026-10-02T10:00:00Z' };

const r0 = job({});
const d0 = built(r0);
check('fresh when nothing moved', ST.stale(d0, r0, { files, floorplan: plan1 }), { state: 'fresh', changes: [] });
check('fresh when Drive is unknown', ST.stale(d0, r0, {}), { state: 'fresh', changes: [] });

const r1 = job({ facts: { price: 2100000 } });
check('price changed', ST.stale(d0, r1, {}), { state: 'stale', changes: [{ field: 'price', label: 'Price', was: 2250000, now: 2100000 }] });

// "Typo, no rebuild": save_job wrote the new value into built_from too
const dTypo = JSON.parse(JSON.stringify(d0)); dTypo.built_from.facts.price = 2100000;
check('typo-ticked change flags nothing', ST.stale(dTypo, r1, {}).state, 'fresh');

check('agent order', ST.stale(d0, job({ core: { agentIds: ['b', 'a'] } }), {}).changes, [{ field: 'agents', label: 'Agents', was: ['a', 'b'], now: ['b', 'a'] }]);
check('listing link', ST.stale(d0, job({ row: { de: { listingUrl: 'https://www.elliman.com/x/2' } } }), {}).changes.map(c => c.field), ['listingUrl']);
check('front photo path changed', ST.stale(d0, job({ row: { photo_hero: 'Photos/Edited/02.jpg', photo_order: ['Photos/Edited/02.jpg', 'Photos/Edited/03.jpg'] } }), {}).changes.map(c => [c.field, c.label]),
  [['photos.front', 'Front photo'], ['photos.back', 'Back photo']]);
const newer = Object.assign({}, files, { 'Photos/Edited/01.jpg': { modified: '2026-10-09T10:00:00Z' } });
check('same photo, new date: file updated on Drive', ST.stale(d0, r0, { files: newer }).changes, [{ field: 'photos.front', label: 'Front photo', was: 'Photos/Edited/01.jpg', now: 'file updated on Drive' }]);
check('photo dates unknown: not judged', ST.stale(d0, r0, { files: {} }).state, 'fresh');
check('nothing picked and Drive unknown: photos not judged', ST.stale(d0, job({ row: { photo_hero: null, photo_order: [] } }), {}).state, 'fresh');
check('nothing picked, edited by name differ', ST.stale(d0, job({ row: { photo_hero: null, photo_order: [] } }), { editedPaths: ['Photos/Edited/00.jpg', 'Photos/Edited/01.jpg'] }).changes.map(c => c.field),
  ['photos.front', 'photos.back']);

check('newer floorplan version', ST.stale(d0, r0, { floorplan: { version: 2, render: 'branded', path: 'Floorplan/v2/Plan v2.jpg', modified: '2026-10-09' } }).changes,
  [{ field: 'floorplan', label: 'Floorplan', was: 'v1', now: 'v2' }]);
check('same version, newer file', ST.stale(d0, r0, { floorplan: Object.assign({}, plan1, { modified: '2026-10-09T10:00:00Z' }) }).changes.map(c => c.now), ['file updated on Drive']);
check('same version, another file', ST.stale(d0, r0, { floorplan: Object.assign({}, plan1, { path: 'Floorplan/v1/Plan v1 new.jpg', modified: '2026-10-09T10:00:00Z' }) }).changes.map(c => c.field), ['floorplan']);
check('floorplan unknown: not judged', ST.stale(d0, r0, { floorplan: undefined }).state, 'fresh');
const dDrop = JSON.parse(JSON.stringify(d0)); dDrop.built_from.floorplan = { dropped: true };
check('a plan dropped by hand never goes stale', ST.stale(dDrop, r0, { floorplan: { version: 5, path: 'x.jpg', modified: '2026-12-01' } }).state, 'fresh');

check('NYC sheet ignores sq ft', ST.stale(d0, job({ facts: { sqft: 1500 } }), {}).state, 'fresh');
const nj = job({ row: { market: 'NJ' }, core: { propertyType: 'Single family' } });
const dNj = built(nj);
check('NJ sheet counts sq ft', ST.stale(dNj, job({ row: { market: 'NJ' }, core: { propertyType: 'Single family' }, facts: { sqft: 1500 } }), {}).changes.map(c => c.field), ['sqft']);
check('label for an NJ house fee is HOA', ST.stale(dNj, job({ row: { market: 'NJ' }, core: { propertyType: 'Single family' }, facts: { commonCharges: 200 } }), {}).changes[0].label, 'HOA');

const town = job({ row: { market: 'NJ' }, core: { propertyType: 'Single family', city: 'Testville' } });
const dTown = built(town);
const hood = job({ row: { market: 'NJ' }, core: { propertyType: 'Single family', city: 'Testville', neighborhood: 'Riverside' } });
check('town to neighbourhood on the chip is stale', ST.stale(dTown, hood, {}).changes.map(c => c.field), ['neighborhood']);
check('no record: none', ST.stale(null, r0, {}), { state: 'none', changes: [] });
check('no built_from and no file: none', ST.stale({ state: {} }, r0, { fileFound: false }).state, 'none');
check('made before the workspace kept track', ST.stale({ state: {} }, r0, { fileFound: true }), { state: 'untracked', changes: [] });
const dPrint = JSON.parse(JSON.stringify(d0)); dPrint.built_from.via = 'print';
check('printed by hand is still checked', ST.stale(dPrint, r1, {}).state, 'stale');
const dPaper = JSON.parse(JSON.stringify(d0)); dPaper.built_from.print = { paper: 'letter', bleed: true };
check('paper never counts', ST.stale(dPaper, r0, {}).state, 'fresh');
check('a fact the sheet no longer prints is ignored', ST.stale(Object.assign({}, d0, { built_from: Object.assign({}, d0.built_from, { facts: Object.assign({ maintenance: 1 }, d0.built_from.facts) }) }), r0, {}).state, 'fresh');
check('words', ST.words([{ label: 'Price' }, { label: 'Agents' }, { label: 'Front photo' }]), 'price, agents, front photo');

// a hero with no tray order and Drive unknown (overview, phone): the back photo is unknown, not "gone"
const heroOnly = job({ row: { photo_order: [] } });
check('hero only, Drive unknown: back photo not judged', ST.stale(built(heroOnly), heroOnly, {}).state, 'fresh');
check('hero only, Drive unknown: a new hero still counts', ST.stale(built(heroOnly), job({ row: { photo_hero: 'Photos/Edited/09.jpg', photo_order: [] } }), {}).changes.map(c => c.field), ['photos.front']);
check('hero only, Drive known: the back photo is judged', ST.stale(built(heroOnly), heroOnly, { editedPaths: ['Photos/Edited/01.jpg', 'Photos/Edited/05.jpg'] }).changes.map(c => c.field), ['photos.back']);


/* ---------- Slice 5: every other piece (built_from v2, GVC_PIECEJOB) ---------- */
const J = require('../assets/js/piece-job.js');
const brochureRow = job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' } });
// built with the photos the job offered then, unless a test says otherwise
const v2 = (tool, row, ctx) => ({ built_from: J.builtFrom(tool, {}, row, Object.assign({ via: 'helper',
  photos: (J.photosFor(tool, row, null) || []).map(p => ({ path: p })) }, ctx || {})) });
check('brochure fresh', ST.stale(v2('brochure', brochureRow), brochureRow, {}).state, 'fresh');
check('brochure: price moved', ST.stale(v2('brochure', brochureRow), job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.', price: 2100000 } }), {}).changes,
  [{ field: 'price', label: 'Price', was: 2250000, now: 2100000 }]);
check('brochure: a showsheet-only fact never counts', ST.stale(v2('brochure', brochureRow), job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.', commonCharges: 1 } }), {}).state, 'fresh');
check('brochure: a third agent added doesn\'t count (two print)', ST.stale(v2('brochure', brochureRow), job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, core: { agentIds: ['a', 'b', 'c'] } }), {}).state, 'fresh');
check('brochure: agent order counts', ST.stale(v2('brochure', brochureRow), job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, core: { agentIds: ['b', 'a'] } }), {}).changes.map(c => c.field), ['agents']);
check('brochure: listing link counts', ST.stale(v2('brochure', brochureRow), job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, row: { de: {} } }), {}).changes.map(c => c.field), ['listingUrl']);
check('postcard: listing link never counts', ST.stale(v2('postcard-listed', brochureRow), job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, row: { de: {} } }), {}).state, 'fresh');

// photos as a list
const ph = [{ path: 'Photos/Edited/01.jpg', modified: '2026-10-01T00:00:00Z' }, { path: 'Photos/Edited/02.jpg', modified: '2026-10-01T00:00:00Z' }];
const withPh = v2('brochure', brochureRow, { photos: ph });
check('photos same: fresh', ST.stale(withPh, brochureRow, {}).state, 'fresh');
const reordered = job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, row: { photo_hero: 'Photos/Edited/02.jpg', photo_order: ['Photos/Edited/02.jpg', 'Photos/Edited/01.jpg'] } });
check('photos reordered: stale', ST.stale(withPh, reordered, {}).changes.map(c => [c.field, c.label]), [['photos', 'Photos']]);
check('photos: a file updated on Drive', ST.stale(withPh, brochureRow, { files: { 'Photos/Edited/02.jpg': { modified: '2026-10-05T00:00:00Z' } } }).changes.map(c => c.now), ['file updated on Drive']);
check('photos: no picks and Drive unknown, not judged', ST.stale(withPh, job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, row: { photo_hero: null, photo_order: [] } }), {}).state, 'fresh');
check('photos: a photo added to the picks', ST.stale(withPh, job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, row: { photo_order: ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg', 'Photos/Edited/03.jpg'] } }), {}).changes.map(c => c.field), ['photos']);
check('postcard: a third pick never counts (two print)', ST.stale(v2('postcard-listed', brochureRow, { photos: ph }), job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, row: { photo_order: ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg', 'Photos/Edited/03.jpg'] } }), {}).state, 'fresh');
check('photos: given straight (a pitch folder)', ST.stale(v2('seller', brochureRow, { photos: [{ path: 'img.jpg' }] }), brochureRow, { photoPaths: ['img.jpg', 'b.jpg'] }).changes.map(c => c.field), ['photos']);

// floorplans
const pl1 = [{ version: 1, render: 'branded', path: 'Floorplan/v1/A v1.jpg', modified: '2026-09-01T00:00:00Z' }];
const withPl = v2('brochure', brochureRow, { plans: pl1 });
check('plans: newer version', ST.stale(withPl, brochureRow, { plans: [{ version: 2, render: 'branded', path: 'Floorplan/v2/A v2.jpg', modified: '2026-10-01T00:00:00Z' }] }).changes,
  [{ field: 'floorplan', label: 'Floorplan', was: 'v1', now: 'v2' }]);
check('plans: same file, newer date', ST.stale(withPl, brochureRow, { plans: [Object.assign({}, pl1[0], { modified: '2026-10-02T00:00:00Z' })] }).changes.map(c => c.now), ['file updated on Drive']);
check('plans: a level added', ST.stale(withPl, brochureRow, { plans: pl1.concat([{ version: 1, render: 'branded', path: 'Floorplan/v1/B v1.jpg', modified: '2026-09-01T00:00:00Z' }]) }).changes.map(c => c.field), ['floorplan']);
check('plans: unknown, not judged', ST.stale(withPl, brochureRow, {}).state, 'fresh');
check('plans: none printed and none now', ST.stale(v2('brochure', brochureRow), brochureRow, { plans: [] }).state, 'fresh');

// the map
const mapRow = { id: 'q1', market: 'NJ', core: { address: '12 Sample Ln', comps: [{ address: '14 Sample Ln' }] } };
const mapDoc = v2('pitch-map', mapRow);
check('map piece fresh', ST.stale(mapDoc, mapRow, {}).state, 'fresh');
check('map piece: a comp added makes it stale', ST.stale(mapDoc, { id: 'q1', market: 'NJ', core: { address: '12 Sample Ln', comps: [{ address: '14 Sample Ln' }, { address: '9 Other Rd' }] } }, {}).changes.map(c => [c.field, c.label]),
  [['mapAddresses', 'Mapped addresses']]);
check('map piece: a comp price change doesn\'t', ST.stale(mapDoc, { id: 'q1', market: 'NJ', core: { address: '12 Sample Ln', comps: [{ address: '14 Sample Ln', price: '9' }] } }, {}).state, 'fresh');
const sellerDoc = v2('seller', mapRow, { map: { path: 'Map - 12 Sample Ln - 2026-10-20.png', modified: '2026-10-20T00:00:00Z' } });
check('seller: a newer map', ST.stale(sellerDoc, mapRow, { map: { path: 'Map - 12 Sample Ln - 2026-10-22.png', modified: '2026-10-22T00:00:00Z' } }).changes.map(c => [c.field, c.label]), [['map', 'Map']]);
check('seller: same map', ST.stale(sellerDoc, mapRow, { map: { path: 'Map - 12 Sample Ln - 2026-10-20.png', modified: '2026-10-20T00:00:00Z' } }).state, 'fresh');
check('seller: a dropped map never counts', ST.stale(v2('seller', mapRow, { map: { dropped: true } }), mapRow, { map: { path: 'x.png', modified: '2026-10-22T00:00:00Z' } }).state, 'fresh');
check('seller: a band change counts', ST.stale(sellerDoc, { id: 'q1', market: 'NJ', core: { address: '12 Sample Ln', comps: [{ address: '14 Sample Ln' }], priceMid: 5 } }, {}).changes.map(c => [c.field, c.label]), [['priceMid', 'Recommended price']]);
check('seller: comps change counts', ST.stale(sellerDoc, { id: 'q1', market: 'NJ', core: { address: '12 Sample Ln', comps: [{ address: '15 Sample Ln' }] } }, {}).changes.map(c => c.field), ['comps']);
check('words of new labels', ST.words([{ label: 'Photos' }, { label: 'Mapped addresses' }]), 'photos, mapped addresses');
check('a v2 record of an unknown piece is never stale and never throws', ST.stale({ built_from: { v: 2, tool: 'flyer', facts: { price: 1 }, agents: ['a', 'b'] } }, brochureRow, {}).state, 'fresh');
// review fixes: plans only for pieces that print them, junk entries, unknown map dates
check('postcard: a floorplan appearing never counts', ST.stale(v2('postcard-listed', brochureRow, { plans: [] }), brochureRow, { plans: pl1 }).state, 'fresh');
check('junk plan entries never throw', ST.stale({ built_from: Object.assign({}, withPl.built_from, { plans: [null, pl1[0]] }) }, brochureRow, { plans: [null].concat(pl1) }).state, 'fresh');
check('a map with no dates on either side is not judged', ST.stale(v2('seller', mapRow, { map: { path: 'a.png' } }), mapRow, { map: { path: 'b.png' } }).state, 'fresh');
// review fixes (Tasks 9-12): an excluded photo is recorded, so it never reads as a change; a hero-only job without Drive judges the hero only
const exRow = job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' } });
const exDoc = v2('seller', exRow, { photos: [{ path: 'Photos/Edited/01.jpg' }, { path: 'Photos/Edited/02.jpg', excluded: true }] });
check('an excluded photo recorded with its flag is no change', ST.stale(exDoc, exRow, {}).state, 'fresh');
const heroRow = job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, row: { photo_order: [] } });
const heroDoc = v2('postcard-listed', heroRow, { photos: [{ path: 'Photos/Edited/01.jpg' }, { path: 'Photos/Edited/05.jpg' }] });
check('hero only, Drive unknown: the second photo is not judged', ST.stale(heroDoc, heroRow, {}).state, 'fresh');
check('hero only, Drive unknown: a new hero still counts', ST.stale(heroDoc, job({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, row: { photo_hero: 'Photos/Edited/09.jpg', photo_order: [] } }), {}).changes.map(c => c.field), ['photos']);
// Slice 6: the sign
const ohJob = (oh, over) => job(Object.assign({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' }, core: { openHouses: oh } }, over || {}));
const OH1 = [{ type: 'Public', startTime: '2099-05-03T13:00:00', endTime: '2099-05-03T15:00:00' }];
const sign = v2('signage', ohJob(OH1));
check('sign fresh', ST.stale(sign, ohJob(OH1), {}).state, 'fresh');
check('sign: a price change never counts', ST.stale(sign, ohJob(OH1, { facts: { price: 1, city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' } }), {}).state, 'fresh');
check('sign: the agents and the link count', ST.stale(sign, ohJob(OH1, { core: { openHouses: OH1, agentIds: ['b'] }, row: { de: {} } }), {}).changes.map(c => c.field), ['agents', 'listingUrl']);
// final review fixes (Slice 6)
const sgJob = (over) => job(Object.assign({ facts: { city: 'New York', state: 'NY', zip: '10024', description: 'Sunny.' } }, over || {}));
const sgDoc = v2('signage', sgJob({ row: { market: 'NYC' } }));
check('sign: a market move counts (the office line changes)', ST.stale(sgDoc, sgJob({ row: { market: 'NJ' } }), {}).changes.map(c => c.field), ['market']);
check('sign: an outside link never counts as the listing link', ST.stale(sgDoc, sgJob({ row: { market: 'NYC' }, core: { listingUrl: 'https://evil.example/x' } }), {}).state, 'fresh');
console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
if (failures.length) {
  console.log('\n  ' + failures.join('\n\n  ') + '\n');
  process.exit(1);
}
console.log();
