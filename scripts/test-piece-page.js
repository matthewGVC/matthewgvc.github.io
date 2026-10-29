/* ============================================================
   Browser tests for the Brochure, the Postcards, the Seller pitch and Map
   Studio opened from a job (Slice 5): /tools/<tool>/?listing=<slug> (or
   ?pitch=<slug>) opens filled from the job, reads its photos, floorplans and
   map from Drive, and saves back through save_job, save_piece_of and the
   helper's POST /piece. Supabase, Drive and the helper are mocked by request
   interception (made-up rows and names; nothing real).

     BASE=http://localhost:8080 node scripts/test-piece-page.js

   Needs the static server running from the repo root first:
     python -m http.server 8080
   A full run takes about a minute; give it a timeout of at least 180s.
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

const rec = (value, source, by) => ({ value, source: source || 'DE', bySource: by || { [source || 'DE']: value } });
function rowsFor(over) {
  over = over || {};
  return {
    properties: [
      { id: 'p1', slug: '100-example-st-4a', label: 'x', kind: 'sale', market: 'NJ', stage: 'Live', version: 7,
        core: { address: '100 Example St', unit: '4A', city: 'Testville', state: 'NJ', zip: '07000', neighborhood: 'Testville', propertyType: 'Condo',
          price: 4500000, beds: 3, baths: 2, sqft: 1800, description: 'A made-up home.', agentIds: ['john-gasdaska'],
          interiorFeatures: ['South exposure', 'Wood floors'], buildingFeatures: ['Doorman'],
          comps: [{ address: '14 Example St', price: '4,100,000', sqft: '1,700', bb: '3/2', date: '2026-08' }],
          facts: {
            price: rec(4600000, 'Matt', { DE: 4500000, Matt: 4600000 }), beds: rec(3, 'DE'), baths: rec(2, 'DE'), sqft: rec(1800, 'DE'),
            city: rec('Testville', 'Asana'), state: rec('NJ', 'Asana'), zip: rec('07000', 'Asana'), description: rec('A made-up home.', 'Matt'),
            interiorFeatures: rec(['South exposure', 'Wood floors'], 'DE'), buildingFeatures: rec(['Doorman'], 'DE')
          } },
        de: { listingUrl: 'https://www.elliman.com/new-jersey/100-example-st/9001' },
        drive_folder: 'GVC - New Jersey/1. Residential Sales/1. Resale/Testville/100 Example St', folder_state: 'linked',
        photo_hero: 'Photos/Edited/02.jpg', photo_order: ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg', 'Photos/Edited/03.jpg'] },
      { id: 'p9', slug: 'evil', label: 'e', kind: 'sale', market: 'FL', stage: 'Prep', version: 1,
        core: { address: '<img src=x onerror="window.__xss=1">', unit: '"><b>', propertyType: 'Condo',
          facts: { description: rec('<script>window.__xss=3</script>', 'Matt') } }, folder_state: 'unlinked' }
    ],
    pitches: [
      { id: 'q1', slug: '12-sample-ln-2026-10-01', label: '12 Sample Ln', market: 'NJ', version: 2, outcome: 'open',
        core: { address: '12 Sample Ln', city: 'Testville', state: 'NJ', zip: '07000', suggestedAgentIds: ['john-gasdaska'],
          comps: [{ address: '14 Sample Ln', price: '1,900,000', sqft: '', bb: '4/3', date: '' }], priceMid: 1900000 },
        drive_folder: 'GVC - Marketing/02 - Assets/Pitches/2026-10-01 12 Sample Ln', folder_state: 'linked' }
    ],
    documents: over.documents || []
  };
}

const FAKE_DRIVE = `(function () {
  var cfg = window.__FAKE_DRIVE || {};
  var PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), function (c) { return c.charCodeAt(0); });
  function f(name, day) { return { name: name, kind: 'file', size: 1000, modified: '2026-10-' + day + 'T10:00:00.000Z' }; }
  function d(name, children) { return { name: name, kind: 'directory', children: children }; }
  var trees = {
    listing: d('100 Example St', [
      f('Exclusive - Jane Client.pdf', '02'),
      d('Marketing', [d('Brochure', [f('Brochure - 100 Example St 4A - 2026-10-12.pdf', '12')])]),
      d('Floorplan', [d('v1', [f('Level 1 v1.jpg', '04')]), d('v2', [f('Level 1 v2.jpg', '09'), f('Level 2 v2.jpg', '09'), f('Level 1 v2 unbranded.png', '09')])]),
      d('Photos', [d('Edited', [f('01.jpg', '08'), f('02.jpg', '08'), f('03.jpg', '08'), f('Signed contract Jane Client.jpg', '08')])])
    ]),
    pitch: d('2026-10-01 12 Sample Ln', [
      f('12 Sample Ln.indd', '01'), f('img.jpg', '01'),
      d('Photos', [f('front.jpg', '03'), f('back.jpg', '03')]),
      d('Marketing', [d('Pitch', [f('Map - 12 Sample Ln - 2026-10-20.png', '20')])])
    ])
  };
  var log = window.__driveLog = { tree: 0, read: [] };
  window.GVC_DRIVE = {
    supported: function () { return true; },
    state: function () { return Promise.resolve(cfg.state || 'connected'); },
    connect: function () { return Promise.resolve([]); },
    reconnect: function () { cfg.state = 'connected'; return Promise.resolve(true); },
    list: function () { return Promise.resolve([]); }, relPathOf: function () { return Promise.resolve(null); },
    tree: function (folder) { log.tree++; return Promise.resolve(JSON.parse(JSON.stringify(/Pitches/.test(folder) ? trees.pitch : trees.listing))); },
    listJob: function () { return Promise.resolve([]); },
    readJobFile: function (folder, path) {
      log.read.push(path);
      if (path === cfg.slow) return new Promise(function () {});
      return new Promise(function (res) { setTimeout(function () { res(new File([PNG], path.split('/').pop(), { type: 'image/png' })); }, 20); });
    }
  };
})();`;

async function open(browser, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], saves = [], pieces = [], helper = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  await page.addInitScript(() => localStorage.setItem('gvc.helper.pair', 'PAIR'));
  await page.addInitScript(cfg => { window.__FAKE_DRIVE = cfg; window.__pieceTimeoutMs = 300; window.__pieceRetryMs = 30; window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, opts.drive || {});
  await page.route('**/assets/js/drive.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_DRIVE }));
  const T = opts.rows || rowsFor(opts);
  await page.route('**/rest/v1/**', r => {
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), m = r.request().method();
    const json = (status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (table === 'members') return json(200, opts.members || [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }]);
    if (table === 'save_job') {
      const body = JSON.parse(r.request().postData() || '{}');
      saves.push(body);
      const list = T[body.p_table], row = list.find(x => x.id === body.p_id);
      if (opts.conflict) { row.version += 1; return json(400, { code: 'P0001', message: 'conflict' }); }
      Object.assign(row, body.p_set, { version: row.version + 1 });
      return json(200, row);
    }
    if (table === 'save_piece_of') {
      const body = JSON.parse(r.request().postData() || '{}');
      pieces.push(body);
      if (opts.pieceFails && pieces.length <= opts.pieceFails) return json(500, { message: 'boom' });
      const owner = body.p_table === 'pitches' ? { pitch_id: body.p_id } : { property_id: body.p_id };
      const doc = Object.assign(owner, { tool: body.p_tool, version: (body.p_version || 0) + 1, state: body.p_state, outputs: [] },
        body.p_built_from ? { built_from: body.p_built_from, output: body.p_output } : {});
      T.documents = T.documents.filter(d => !(d.tool === body.p_tool && (d.property_id || d.pitch_id) === body.p_id)).concat([doc]);
      return json(200, doc);
    }
    if (m !== 'GET') return json(201, []);
    const eqs = [...u.searchParams].filter(([, v]) => /^eq\./.test(v)).map(([k, v]) => [k, v.slice(3)]);
    const hit = row => eqs.every(([k, v]) => String(row[k]) === v);
    json(200, (T[table] || []).filter(hit));
  });
  await page.route('**/auth/v1/user', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', email: 'matt@example.com' }) }));
  await page.route('http://localhost:47610/**', r => {
    if (opts.helperDown) return r.abort();
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const body = JSON.parse(r.request().postData() || '{}');
    helper.push({ path: new URL(r.request().url()).pathname, body });
    const name = (opts.prefix || 'Brochure') + ' - 100 Example St 4A - 2026-10-22.pdf';
    const reply = opts.helperReply || { ok: true, path: 'Marketing/Brochure/' + name, name, size: 12345, modified: '2026-10-22T15:00:00.000Z',
      url: 'https://drive.google.com/file/d/NEW/view', pages: 5, archived: null };
    r.fulfill({ status: opts.helperStatus || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(reply) });
  });
  await page.goto(BASE + opts.path, { waitUntil: 'networkidle' });
  // only job-mode pages (?listing= / ?pitch= on a piece tool) ever set GVC_PIECEMODE;
  // waiting 15s for it on Map Studio or a standalone page made the run take 3+ minutes
  if (/[?&](listing|pitch)=/.test(opts.path) && !/map-studio/.test(opts.path))
    await page.waitForFunction(() => window.GVC_PIECEMODE && window.GVC_PIECEMODE.ready, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { page, errors, saves, pieces, helper, ctx, T, printed: () => page.evaluate(() => window.__printed || 0) };
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const pstate = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__piece.state)));
async function typeIn(page, sel, value) {
  await page.$eval(sel, e => { let d = e.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } });
  await page.fill(sel, value);
  await page.waitForTimeout(250);
}
const noData = x => !/data:image/.test(JSON.stringify(x));

(async () => {
  const browser = await chromium.launch();
  const BRO = '/tools/brochure/?listing=100-example-st-4a';

  /* ---------- the Brochure from a job ---------- */
  let o = await open(browser, { path: BRO });
  let s = await pstate(o.page);
  check('brochure: the bar names the job', /^Brochure for 100 Example St · 4A/.test(await text(o.page, '#pieceBar .jb-t')), true);
  check('brochure: property bar hidden', await o.page.$eval('#propBar', e => getComputedStyle(e).display), 'none');
  check('brochure: facts on the piece', [s.address, s.city, s.state, s.zip, s.price, s.beds, s.sqft, s.blurb, s.agents],
    ['100 Example St, Residence 4A', 'Testville', 'NJ', '07000', '4600000', '3', '1800', 'A made-up home.', ['john-gasdaska']]);
  check('brochure: features from the job\'s lists', s.features, 'South exposure\nWood floors\nDoorman');
  check('brochure: listing link from DE', s.listingUrl, 'https://www.elliman.com/new-jersey/100-example-st/9001');
  check('brochure: price badge and DE\'s warning', [await text(o.page, '[data-jf="price"] .chip'), /DE says \$4,500,000/.test(await text(o.page, '[data-jf="price"]'))], ['Matt', true]);
  check('brochure: photos from Drive, hero first, paperwork photo never read', [s.images.length, await o.page.evaluate(() => window.__driveLog.read.filter(p => /contract/i.test(p)).length)], [3, 0]);
  check('brochure: every level of the newest floorplan, branded', [s.floorplans.length, s.floorplans.map(f => f.name)], [2, ['Level 1 v2.jpg', 'Level 2 v2.jpg']]);
  check('brochure: a brochure file found in the folder', await text(o.page, '#pieceState'), 'Made before the workspace kept track');
  check('brochure: drop zones hidden in job mode', await o.page.$eval('#imgDrop', e => getComputedStyle(e).display), 'none');
  check('brochure: agents read-only', /Change agents on the job page/.test(await text(o.page, '#rosterPick')), true);

  // Save sheet: a fact typed on the brochure goes to the job; the brochure keeps paths, not pictures
  await typeIn(o.page, '[data-field="price"]', '4,400,000');
  check('brochure: an edited fact offers the typo tick', !!(await o.page.$('[data-typo="price"]')), true);
  await o.page.click('#btnPieceSave');
  await o.page.waitForTimeout(500);
  check('brochure: Save sheet → one save_job', [o.saves.length, o.saves[0] && o.saves[0].p_table, o.saves[0] && o.saves[0].p_changes],
    [1, 'properties', [{ field: 'price', old_value: 4600000, new_value: 4400000, note: 'on the Brochure', no_rebuild: false }]]);
  const draft = o.pieces[0] || {};
  check('brochure: then one save_piece_of, a draft', [o.pieces.length, draft.p_table, draft.p_tool, draft.p_built_from, draft.p_output], [1, 'properties', 'brochure', null, null]);
  check('brochure: the draft holds paths, never pictures', [noData(draft.p_state), (draft.p_state.images || []).map(i => i.path)],
    [true, ['Photos/Edited/02.jpg', 'Photos/Edited/01.jpg', 'Photos/Edited/03.jpg']]);
  check('brochure: the draft remembers the lists its wording came from', Object.keys(draft.p_state.listsFrom || {}).sort(), ['buildingFeatures', 'interiorFeatures']);

  // Save PDF to Drive
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(700);
  const h = o.helper[0] || { body: {} };
  check('brochure: the helper is asked for the brochure', [h.path, h.body.tool, h.body.propertyId, h.body.paper, h.body.state && h.body.state.images.length], ['/piece', 'brochure', 'p1', 'letter', 3]);
  check('brochure: the helper gets the pictures inline', /data:image/.test(JSON.stringify(h.body.state || {})), true);
  const build = o.pieces[1] || {};
  check('brochure: the build is recorded', [build.p_tool, build.p_built_from && build.p_built_from.v, build.p_built_from && build.p_built_from.tool, build.p_output && build.p_output.name],
    ['brochure', 2, 'brochure', 'Brochure - 100 Example St 4A - 2026-10-22.pdf']);
  check('brochure: built_from holds the facts, photos and plans it printed', [build.p_built_from.facts.price, build.p_built_from.photos.map(p => p.path), build.p_built_from.plans.map(p => [p.path, p.version])],
    [4400000, ['Photos/Edited/02.jpg', 'Photos/Edited/01.jpg', 'Photos/Edited/03.jpg'], [['Floorplan/v2/Level 1 v2.jpg', 2], ['Floorplan/v2/Level 2 v2.jpg', 2]]]);
  check('brochure: made today in the bar', /^Made today/.test(await text(o.page, '#pieceState')), true);
  check('brochure: no page errors', o.errors, []);
  await o.ctx.close();

  // helper not running: print dialog, recorded by hand
  o = await open(browser, { path: BRO, helperDown: true });
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(600);
  check('brochure: helper down → print, recorded by hand', [await o.printed(), o.pieces[0] && o.pieces[0].p_output.via, o.pieces[0] && o.pieces[0].p_built_from.via], [1, 'print', 'print']);
  await o.ctx.close();

  // a helper refusal is said, nothing recorded
  o = await open(browser, { path: BRO, helperStatus: 409, helperReply: { error: 'This job has no Drive folder linked.' } });
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(500);
  check('brochure: a refusal is shown, nothing recorded', [await text(o.page, '#pieceMsg'), o.pieces.length, await o.printed()], ['This job has no Drive folder linked.', 0, 0]);
  await o.ctx.close();

  // a conflict before the PDF: nothing drawn
  o = await open(browser, { path: BRO, conflict: true });
  await typeIn(o.page, '[data-field="price"]', '4,400,000');
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(500);
  check('brochure: conflict → no PDF, said, the typed price kept', [o.helper.length, /changed a moment ago/.test(await text(o.page, '#pieceMsg')), (await pstate(o.page)).price], [0, true, '4,400,000']);
  await o.ctx.close();

  // a photo Drive hasn't downloaded
  o = await open(browser, { path: BRO, drive: { slow: 'Photos/Edited/01.jpg' } });
  check('brochure: a slow photo is named', /hasn't downloaded this yet: 01\.jpg/.test(await text(o.page, '#piecePhotoMsg')), true);
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(300);
  check('brochure: and Save PDF waits for it', [/01\.jpg yet/.test(await text(o.page, '#pieceMsg')), o.helper.length], [true, 0]);
  await o.ctx.close();

  // a saved brochure reopens with its own roles and ids; a rebuild lists what changed
  const SAVED = { property_id: 'p1', tool: 'brochure', version: 3, state: { images: [{ id: 7, path: 'Photos/Edited/03.jpg', role: 'hero', name: '03.jpg' }], paper: 'half', fpNote: 'Mine' },
    built_from: { v: 2, tool: 'brochure', facts: { price: 4750000 }, agents: ['john-gasdaska'], photos: [], plans: [] }, output: { name: 'old.pdf', via: 'helper', madeAt: '2026-10-01T10:00:00Z', paper: 'half' } };
  o = await open(browser, { path: BRO + '&rebuild=1', documents: [SAVED] });
  s = await pstate(o.page);
  check('brochure: a saved photo keeps its id and role', s.images.filter(i => i.id === 7).map(i => i.role), ['hero']);
  check('brochure: the saved paper and note kept', [s.paper, s.fpNote], ['half', 'Mine']);
  check('brochure: the rebuild banner', /Price \$4,750,000 → \$4,600,000/.test(await text(o.page, '#pieceBanner')), true);
  check('brochure: stale in the bar', /^Stale: /.test(await text(o.page, '#pieceState')), true);
  await o.ctx.close();

  // the team sees it read-only
  o = await open(browser, { path: BRO, members: [{ name: 'Team', initials: 'T', role: 'team' }] });
  check('brochure: team read-only', [!!(await o.page.$('#btnPiecePdf')), /Read only/.test(await text(o.page, '#pieceBar'))], [false, true]);
  await o.ctx.close();

  // an unknown job, a hostile job, and the standalone tool
  o = await open(browser, { path: '/tools/brochure/?listing=nope' });
  check('brochure: unknown job', /No job called "nope"/.test(await text(o.page, '#pieceBar')), true);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/brochure/?listing=evil' });
  await o.page.waitForTimeout(300);
  check('brochure: hostile job text never runs', await o.page.evaluate(() => window.__xss || 0), 0);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/brochure/?pitch=12-sample-ln-2026-10-01' });
  check('brochure: not made from a pitch', /isn't made from a pitch/.test(await text(o.page, '#pieceBar')), true);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/brochure/' });
  check('brochure: standalone has no job mode', await o.page.evaluate(() => [!!window.GVC_PIECEMODE, !!document.getElementById('pieceBar')]), [false, false]);
  await o.ctx.close();

  // review fixes: saved ids never handed to another photo; saved plan labels survive a Save sheet before Drive is in
  const SAVED2 = { property_id: 'p1', tool: 'brochure', version: 4, state: {
    images: [{ id: 1, path: 'Photos/Edited/03.jpg', role: 'info-top', name: '03.jpg' }, { id: 2, path: 'Photos/Edited/01.jpg', role: 'exclude', name: '01.jpg' }],
    floorplans: [{ id: 5, path: 'Floorplan/v2/Level 2 v2.jpg', label: 'Upper floor', zoom: 1.4, tx: 3, ty: 0 }],
    gallery: [{ rows: [{ cells: [{ id: 1 }] }] }] } };
  o = await open(browser, { path: BRO, documents: [SAVED2] });
  s = await pstate(o.page);
  const byName = n => s.images.filter(i => i.name === n)[0] || {};
  check('brochure: a new hero never takes a saved photo\'s id', [byName('03.jpg').id, byName('03.jpg').role, byName('01.jpg').id, byName('01.jpg').role, byName('02.jpg').id !== 1 && byName('02.jpg').id !== 2],
    [1, 'info-top', 2, 'exclude', true]);
  check('brochure: ids are all different', new Set(s.images.map(i => i.id).concat(s.floorplans.map(f => f.id))).size, s.images.length + s.floorplans.length);
  check('brochure: a saved plan keeps its label and crop', s.floorplans.filter(f => f.name === 'Level 2 v2.jpg').map(f => [f.id, f.label, f.zoom, f.tx]), [[5, 'Upper floor', 1.4, 3]]);
  await o.ctx.close();
  o = await open(browser, { path: BRO, documents: [SAVED2], drive: { slow: 'Floorplan/v2/Level 1 v2.jpg' } });
  await o.page.click('#btnPieceSave');
  await o.page.waitForTimeout(400);
  check('brochure: a plan Drive did not bring in keeps its saved label in the draft', ((o.pieces[0] || {}).p_state || {}).floorplans.map(f => [f.id, f.label]).sort(), [[5, 'Upper floor']]);
  await o.ctx.close();
  o = await open(browser, { path: BRO, documents: [SAVED2], drive: { state: 'prompt' } });
  await o.page.click('#btnPieceSave');
  await o.page.waitForTimeout(400);
  const kept = (o.pieces[0] || {}).p_state || {};
  check('brochure: with Drive not connected, a draft keeps the saved photos and plans', [(kept.images || []).map(i => i.id), (kept.floorplans || []).map(f => [f.id, f.label])], [[1, 2], [[5, 'Upper floor']]]);
  await o.ctx.close();
  o = await open(browser, { path: BRO, members: [{ name: 'Team', initials: 'T', role: 'team' }] });
  check('brochure: team read-only covers the rows Drive filled in', await o.page.evaluate(() => [...document.querySelectorAll('#editor .fp-label, #editor input[type=range]')].every(e => e.readOnly || e.disabled)), true);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/brochure/?pitch=12-sample-ln-2026-10-01' });
  check('brochure: a pitch address never shows the property bar or reads saved work', await o.page.$eval('#propBar', e => getComputedStyle(e).display), 'none');
  await o.ctx.close();

  /* ---------- the Postcards from a job ---------- */
  const PCL = '/tools/postcard/?listing=100-example-st-4a';
  o = await open(browser, { path: PCL, prefix: 'Just Listed Postcard' });
  await o.page.evaluate(() => localStorage.setItem('gvc.postcard.state', JSON.stringify({ headline: 'From this browser' })));
  s = await pstate(o.page);
  check('postcard listed: the bar', /^Just Listed postcard for 100 Example St · 4A/.test(await text(o.page, '#pieceBar .jb-t')), true);
  check('postcard listed: from the job', [s.kind, s.address, s.unit, s.town, s.price, s.agents, s.headline], ['sale', '100 Example St', '4A', 'Testville', '4600000', ['john-gasdaska'], '']);
  check('postcard: two photos, hero first', [s.photos.length, o.T && (await o.page.evaluate(() => window.__driveLog.read.slice(0, 2)))], [2, ['Photos/Edited/02.jpg', 'Photos/Edited/01.jpg']]);
  check('postcard: kind and address are the job\'s', await o.page.evaluate(() => [document.querySelector('#kindPick button').disabled, document.querySelector('#fAddress').readOnly]), [true, true]);
  await typeIn(o.page, '#fHeadline', 'Open Sunday');
  await typeIn(o.page, '#fPrice', '4,450,000');
  await o.page.click('#btnPieceSave');
  await o.page.waitForTimeout(500);
  check('postcard: the price goes to the job, logged on the Postcard', o.saves.map(x => x.p_changes.map(c => [c.field, c.new_value, c.note])), [[['price', 4450000, 'on the Postcard']]]);
  check('postcard: its own words kept with the card, photos by path', [o.pieces[0] && o.pieces[0].p_tool, o.pieces[0] && o.pieces[0].p_state.headline, noData(o.pieces[0] && o.pieces[0].p_state),
    (o.pieces[0] && o.pieces[0].p_state.photos || []).map(p => p.path)], ['postcard-listed', 'Open Sunday', true, ['Photos/Edited/02.jpg', 'Photos/Edited/01.jpg']]);
  check('postcard: this browser\'s saved card untouched', await o.page.evaluate(() => localStorage.getItem('gvc.postcard.state')), JSON.stringify({ headline: 'From this browser' }));
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(700);
  check('postcard: Save PDF asks for the listed card with two inline photos', [o.helper[0] && o.helper[0].body.tool, o.helper[0] && o.helper[0].body.state.photos.length,
    o.helper[0] && /data:image/.test(JSON.stringify(o.helper[0].body.state))], ['postcard-listed', 2, true]);
  check('postcard: built_from', [o.pieces[1] && o.pieces[1].p_built_from.tool, o.pieces[1] && o.pieces[1].p_built_from.photos.length, o.pieces[1] && o.pieces[1].p_built_from.facts.price],
    ['postcard-listed', 2, 4450000]);
  check('postcard: no page errors', o.errors, []);
  await o.ctx.close();

  // Just Sold: DE's closing price when it has one; no price goes back to the job
  const soldRows = rowsFor(); soldRows.properties[0].core.closePrice = 4300000; soldRows.properties[0].stage = 'Sold';
  o = await open(browser, { path: PCL + '&card=sold', rows: soldRows, prefix: 'Just Sold Postcard' });
  s = await pstate(o.page);
  check('postcard sold: the closing price', [s.kind, s.price, /^Just Sold postcard/.test(await text(o.page, '#pieceBar .jb-t'))], ['sold', '4300000', true]);
  await o.page.click('#btnPieceSave');
  await o.page.waitForTimeout(400);
  check('postcard sold: its own record, nothing saved to the job', [o.pieces[0] && o.pieces[0].p_tool, o.saves.length], ['postcard-sold', 0]);
  await o.ctx.close();
  o = await open(browser, { path: PCL + '&card=sold', prefix: 'Just Sold Postcard' });
  check('postcard sold before DE has a closing price: said', /no closing price/.test(await text(o.page, '#pieceBar')), true);
  await o.ctx.close();
  // a saved card's crops come back for the same photo
  o = await open(browser, { path: PCL, documents: [{ property_id: 'p1', tool: 'postcard-listed', version: 2, state: { headline: 'Kept', photos: [{ path: 'Photos/Edited/01.jpg', x: 10, y: 90 }] } }] });
  s = await pstate(o.page);
  check('postcard: saved words and crops come back', [s.headline, s.photos[1] && [s.photos[1].x, s.photos[1].y]], ['Kept', [10, 90]]);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/postcard/' });
  check('postcard: standalone has no job mode', await o.page.evaluate(() => !!window.GVC_PIECEMODE), false);
  await o.ctx.close();

  /* ---------- the Seller pitch from a listing and from a pitch ---------- */
  o = await open(browser, { path: '/tools/seller-package/?listing=100-example-st-4a', prefix: 'Seller Pitch' });
  s = await pstate(o.page);
  check('seller on a listing: the bar', /^Seller pitch for 100 Example St · 4A/.test(await text(o.page, '#pieceBar .jb-t')), true);
  check('seller on a listing: subject facts, comps, market', [s.address, s.beds, s.sqft, s.city, s.comps.length, s.comps[0].address, s.market, s.agents],
    ['100 Example St, Residence 4A', '3', '1800', 'Testville', 1, '14 Example St', 'nj', ['john-gasdaska']]);
  check('seller on a listing: photos from the picks', s.photos.length, 3);
  check('seller: Make the map opens Map Studio for this job', await o.page.$eval('#makeMap', a => a.getAttribute('href')), '../map-studio/?listing=100-example-st-4a');
  await typeIn(o.page, '[data-f="priceMid"]', '4,350,000');
  await o.page.click('#btnPieceSave');
  await o.page.waitForTimeout(500);
  check('seller on a listing: the price band saves to the job', o.saves.map(x => [x.p_table, x.p_changes.map(c => [c.field, c.new_value, c.note])]),
    [['properties', [['priceMid', 4350000, 'on the Seller pitch']]]]);
  check('seller on a listing: the draft is on the listing, paths only', [o.pieces[0] && o.pieces[0].p_table, o.pieces[0] && o.pieces[0].p_tool, noData(o.pieces[0] && o.pieces[0].p_state)], ['properties', 'seller', true]);
  check('seller: no page errors', o.errors, []);
  await o.ctx.close();

  const PITCH = '/tools/seller-package/?pitch=12-sample-ln-2026-10-01';
  const mapDoc = { pitch_id: 'q1', tool: 'pitch-map', version: 1, state: {}, built_from: { v: 2, tool: 'pitch-map', facts: {} },
    output: { path: 'Marketing/Pitch/Map - 12 Sample Ln - 2026-10-20.png', name: 'Map - 12 Sample Ln - 2026-10-20.png', via: 'helper', modified: '2026-10-20T10:00:00.000Z' } };
  o = await open(browser, { path: PITCH, documents: [mapDoc], prefix: 'Seller Pitch',
    helperReply: { ok: true, path: 'Marketing/Pitch/Seller Pitch - 12 Sample Ln - 2026-10-22.pdf', name: 'Seller Pitch - 12 Sample Ln - 2026-10-22.pdf', size: 1, modified: '2026-10-22T15:00:00.000Z', url: null, pages: 12, archived: null } });
  s = await pstate(o.page);
  check('seller on a pitch: the bar points at the pitch page', [/^Seller pitch for 12 Sample Ln/.test(await text(o.page, '#pieceBar .jb-t')), await o.page.$eval('#pieceBar [data-back]', a => a.getAttribute('href'))],
    [true, '../../workspace/job/?pitch=12-sample-ln-2026-10-01']);
  check('seller on a pitch: facts from the pitch, Asana\'s agents flagged', [s.address, s.priceMid, s.comps.length, /Agents not confirmed on the pitch/.test(await text(o.page, '#pieceBar'))], ['12 Sample Ln', '1900000', 1, true]);
  check('seller on a pitch: photos from its Photos folder only, never loose files', [s.photos.map(p => p.name), await o.page.evaluate(() => window.__driveLog.read.indexOf('img.jpg'))], [['back.jpg', 'front.jpg'], -1]);
  check('seller on a pitch: the map from the map record\'s file', [!!s.map, s.map && s.map.name], [true, 'Map - 12 Sample Ln - 2026-10-20.png']);
  await typeIn(o.page, '[data-f="beds"]', '4');
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(800);
  check('seller on a pitch: a fact saves to the pitch', o.saves.map(x => [x.p_table, x.p_id, x.p_changes.map(c => c.field)]), [['pitches', 'q1', ['beds']]]);
  check('seller on a pitch: the helper is asked with the pitch', [o.helper[0] && o.helper[0].body.pitchId, o.helper[0] && o.helper[0].body.propertyId, o.helper[0] && o.helper[0].body.tool], ['q1', undefined, 'seller']);
  const pb = o.pieces[0] || {};
  check('seller on a pitch: recorded on the pitch with the map it printed', [pb.p_table, pb.p_id, pb.p_built_from && pb.p_built_from.map && pb.p_built_from.map.path, pb.p_built_from && pb.p_built_from.photos.length],
    ['pitches', 'q1', 'Marketing/Pitch/Map - 12 Sample Ln - 2026-10-20.png', 2]);
  check('seller on a pitch: no page errors', o.errors, []);
  await o.ctx.close();
  // Florida: the New Jersey wording, said
  const flRows = rowsFor(); flRows.properties[0].market = 'FL';
  o = await open(browser, { path: '/tools/seller-package/?listing=100-example-st-4a', rows: flRows });
  check('seller in Florida: New Jersey wording, said', [(await pstate(o.page)).market, /Florida has no seller deck/.test(await text(o.page, '#pieceBar'))], ['nj', true]);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/seller-package/' });
  check('seller: standalone has no job mode', await o.page.evaluate(() => !!window.GVC_PIECEMODE), false);
  await o.ctx.close();

  /* ---------- Map Studio for a pitch ---------- */
  const mapPage = async (opts) => {
    const x = await open(browser, Object.assign({ path: '/tools/map-studio/?pitch=12-sample-ln-2026-10-01',
      helperReply: { ok: true, path: 'Marketing/Pitch/Map - 12 Sample Ln - 2026-10-22.png', name: 'Map - 12 Sample Ln - 2026-10-22.png', size: 48, modified: '2026-10-22T15:00:00.000Z', url: null, archived: null } }, opts));
    x.geo = [];
    await x.page.route('https://api.mapbox.com/**', r => { x.geo.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"features":[]}' }); });
    await x.page.waitForFunction(() => window.GVC_MAPJOB && window.GVC_MAPJOB.ready, null, { timeout: 15000 }).catch(() => {});
    return x;
  };
  o = await mapPage({});
  check('map: the bar names the pitch', /^Map for 12 Sample Ln/.test(await text(o.page, '#mapJobBar')), true);
  check('map: the subject and comps listed, read-only', await o.page.$eval('#addresses', t => [t.value, t.readOnly]), ['12 Sample Ln\n14 Sample Ln', true]);
  check('map: the owner saves to the pitch', await text(o.page, '#export'), 'Save map to the pitch');
  await o.page.fill('#token', 'pk.test');
  await o.page.$eval('#token', t => t.dispatchEvent(new Event('change')));
  await o.page.evaluate(() => window.__mapStudio.build());
  await o.page.waitForTimeout(600);
  check('map: looked for in the pitch\'s town, near Monmouth County', [o.geo.length, /q=12%20Sample%20Ln%2C%20Testville%2C%20NJ/.test(o.geo[0] || ''), /proximity=-74\.064,40\.347/.test(o.geo[0] || '')], [2, true, true]);
  check('map: the token remembered on this computer', await o.page.evaluate(() => localStorage.getItem('gvc.mapStudio.token')), 'pk.test');
  // the finished picture goes to the helper, then onto the pitch's record
  await o.page.evaluate(() => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; window.__downloads = 0; return window.__mapExport(c, () => { window.__downloads++; }); });
  await o.page.waitForTimeout(300);
  const mh = o.helper[0] || { body: {} };
  check('map: Save map sends a PNG for the pitch', [mh.body.tool, mh.body.pitchId, /^data:image\/png;base64,/.test(mh.body.image || '')], ['pitch-map', 'q1', true]);
  const mp = o.pieces[0] || {};
  check('map: recorded on the pitch with the addresses mapped', [mp.p_table, mp.p_tool, mp.p_built_from && mp.p_built_from.facts.mapAddresses, mp.p_output && mp.p_output.name],
    ['pitches', 'pitch-map', ['12 Sample Ln', '14 Sample Ln'], 'Map - 12 Sample Ln - 2026-10-22.png']);
  check('map: said, nothing downloaded', [/Saved to Drive: Map - 12 Sample Ln/.test(await text(o.page, '#mapJobMsg')), await o.page.evaluate(() => window.__downloads)], [true, 0]);
  check('map: no page errors', o.errors.filter(e => !/mapbox/i.test(e)), []);
  await o.ctx.close();
  o = await mapPage({ helperDown: true });
  await o.page.evaluate(() => { const c = document.createElement('canvas'); window.__downloads = 0; return window.__mapExport(c, () => { window.__downloads++; }); });
  await o.page.waitForTimeout(300);
  check('map: helper down → downloaded as today, said, nothing recorded', [await o.page.evaluate(() => window.__downloads), /downloaded/.test(await text(o.page, '#mapJobMsg')), o.pieces.length], [1, true, 0]);
  await o.ctx.close();
  o = await mapPage({ members: [{ name: 'Team', initials: 'T', role: 'team' }] });
  await o.page.evaluate(() => { const c = document.createElement('canvas'); window.__downloads = 0; return window.__mapExport(c, () => { window.__downloads++; }); });
  check('map: a teammate exports as today, nothing saved', [await text(o.page, '#export'), await o.page.evaluate(() => window.__downloads), o.helper.length], ['⬇ Export static image (PNG)', 1, 0]);
  await o.ctx.close();
  o = await mapPage({ path: '/tools/map-studio/' });
  await o.page.evaluate(() => localStorage.setItem('gvc.mapStudio.token', 'pk.remembered'));
  await o.page.reload({ waitUntil: 'networkidle' });
  check('map: standalone untouched (no bar, no remembered token, Manhattan)', await o.page.evaluate(() => [!!document.getElementById('mapJobBar'), document.getElementById('token').value, typeof window.__mapRecords]),
    [false, '', 'undefined']);
  await o.ctx.close();

  /* review fixes (Tasks 9-12) */
  o = await open(browser, { path: PCL, prefix: 'Just Listed Postcard' });
  await o.page.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__piece.state)); s.photos.reverse(); s.photos[0].x = 11; window.__piece.set(s); });
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(700);
  check('postcard: Make main records the photos in their new order, crops on the right file', [(o.pieces[0] || {}).p_built_from && o.pieces[0].p_built_from.photos.map(p => p.path),
    ((o.pieces[0] || {}).p_state || {}).photos && o.pieces[0].p_state.photos.map(p => [p.path, p.x])],
    [['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg'], [['Photos/Edited/01.jpg', 11], ['Photos/Edited/02.jpg', 50]]]);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/seller-package/?listing=100-example-st-4a', prefix: 'Seller Pitch' });
  await o.page.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__piece.state)); s.photos[2].role = 'exclude'; window.__piece.set(s); });
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(700);
  check('seller: an unused photo is recorded, flagged', ((o.pieces[0] || {}).p_built_from || { photos: [] }).photos.map(p => !!p.excluded), [false, false, true]);
  await o.ctx.close();
  const commaRows = rowsFor(); commaRows.pitches[0].core.comps = [{ address: '7 Elm St, Red Bank' }];
  o = await mapPage({ rows: commaRows });
  check('map: a comp with its town looks there, not as a unit', await o.page.evaluate(() => window.__mapRecords().map(r => [r.number, r.street, r.unit, r.place])),
    [['12', 'Sample Ln', '', 'Testville, NJ'], ['7', 'Elm St', '', 'Red Bank, NJ']]);
  await o.ctx.close();

  /* ---------- Slice 6: the For Sale sign from a job ---------- */
  const SGP = '/tools/signage/?listing=100-example-st-4a';
  o = await open(browser, { path: SGP, prefix: 'For Sale Sign',
    helperReply: { ok: true, path: 'Marketing/Signage/For Sale Sign - 100 Example St 4A - 2026-10-22.pdf', name: 'For Sale Sign - 100 Example St 4A - 2026-10-22.pdf', size: 9, modified: '2026-10-22T15:00:00.000Z', url: null, pages: 1, archived: null } });
  s = await pstate(o.page);
  check('sign from a job: the bar', /^For Sale sign for 100 Example St · 4A/.test(await text(o.page, '#pieceBar .jb-t')), true);
  check('sign from a job: For Sale, the job\'s agents, the DE link, NJ', [s.kind, s.agents, s.qrUrl, s.market], ['for-sale', ['john-gasdaska'], 'https://www.elliman.com/new-jersey/100-example-st/9001', 'nj']);
  check('sign from a job: kind, market and QR are the job\'s', await o.page.evaluate(() => [document.querySelector('#kindPick button').disabled, document.querySelector('#fQr').readOnly]), [true, true]);
  check('sign from a job: no photos read', await o.page.evaluate(() => window.__driveLog.read.length), 0);
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(700);
  const hs = o.helper[0] || { body: {} };
  check('sign: Save PDF asks for the sign', [hs.body.tool, hs.body.propertyId, hs.body.state && hs.body.state.kind], ['signage', 'p1', 'for-sale']);
  const bfs = ((o.pieces[0] || {}).p_built_from) || {};
  check('sign: built_from holds the agents and link', [bfs.tool, bfs.agents, bfs.listingUrl, ((o.pieces[0] || {}).p_output || {}).name], ['signage', ['john-gasdaska'], 'https://www.elliman.com/new-jersey/100-example-st/9001', 'For Sale Sign - 100 Example St 4A - 2026-10-22.pdf']);
  check('sign: no page errors', o.errors, []);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/signage/' });
  check('sign: standalone has no job mode', await o.page.evaluate(() => !!window.GVC_PIECEMODE), false);
  await o.ctx.close();

  await browser.close();
  console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
  if (failures.length) { console.log('\n  ' + failures.join('\n\n  ') + '\n'); process.exit(1); }
  console.log();
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
