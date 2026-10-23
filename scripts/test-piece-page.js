/* ============================================================
   Browser tests for the Brochure, the Postcards, the Seller pitch and Map
   Studio opened from a job (Slice 5): /tools/<tool>/?listing=<slug> (or
   ?pitch=<slug>) opens filled from the job, reads its photos, floorplans and
   map from Drive, and saves back through save_job, save_piece_of and the
   helper's POST /piece. Supabase, Drive and the helper are mocked by request
   interception (made-up rows and names; nothing real).

     BASE=http://127.0.0.1:8097 node scripts/test-piece-page.js
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

  await browser.close();
  console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
  if (failures.length) { console.log('\n  ' + failures.join('\n\n  ') + '\n'); process.exit(1); }
  console.log();
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
