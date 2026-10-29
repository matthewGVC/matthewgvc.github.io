/* ============================================================
   Browser tests for the Brochure, the Postcards, the Seller pitch and Map
   Studio opened from a job (Slice 5): /tools/<tool>/?listing=<slug> (or
   ?pitch=<slug>) opens filled from the job, reads its photos, floorplans and
   map from Drive (or through the helper), and saves back through save_job and
   save_piece_of; Make PDF adds a piece request for the helper (0017) and
   buildPayload() is what the helper's page would print. Map Studio still
   sends its map to POST /piece. Supabase, Drive and the helper are mocked by
   request interception (made-up rows and names; nothing real).

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
    connect: function () { log.connect = (log.connect || 0) + 1; cfg.state = 'connected'; return Promise.resolve(['GVC - New Jersey']); },
    reconnect: function () { log.reconnect = (log.reconnect || 0) + 1; cfg.state = 'connected'; return Promise.resolve(true); },
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

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const HELPER_TREE = { name: '100 Example St', kind: 'directory', looseCount: 1, otherCount: 0, children: [
  { name: 'Floorplan', kind: 'directory', children: [{ name: 'v2', kind: 'directory', children: [
    { name: 'Level 1 v2.jpg', kind: 'file', size: 1000, modified: '2026-10-09T10:00:00.000Z' }, { name: 'Level 2 v2.jpg', kind: 'file', size: 1000, modified: '2026-10-09T10:00:00.000Z' }] }] },
  { name: 'Photos', kind: 'directory', children: [{ name: 'Edited', kind: 'directory', children: [
    { name: '01.jpg', kind: 'file', size: 1000, modified: '2026-10-08T10:00:00.000Z' }, { name: '02.jpg', kind: 'file', size: 1000, modified: '2026-10-08T10:00:00.000Z' },
    { name: '03.jpg', kind: 'file', size: 1000, modified: '2026-10-08T10:00:00.000Z' }] }] }] };

async function open(browser, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], saves = [], pieces = [], helper = [], asks = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  await page.addInitScript(() => localStorage.setItem('gvc.helper.pair', 'PAIR'));
  await page.addInitScript(cfg => { window.__FAKE_DRIVE = cfg; window.__pieceTimeoutMs = 300; window.__pieceRetryMs = 30; window.__piecePollMs = 60; window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, opts.drive || {});
  await page.route('**/assets/js/drive.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_DRIVE }));
  const T = opts.rows || rowsFor(opts);
  T.piece_requests = T.piece_requests || opts.requests || [];
  await page.route('**/rest/v1/**', r => {
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), m = r.request().method();
    const json = (status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (table === 'members') return json(200, opts.members || [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }]);
    if (table === 'piece_requests' && m === 'POST') {
      const body = JSON.parse(r.request().postData() || '{}');
      asks.push(body);
      if (opts.askStatus) return json(opts.askStatus, { message: 'refused' });
      const open = T.piece_requests.find(x => x.tool === body.tool && (x.property_id || x.pitch_id) === (body.property_id || body.pitch_id) && /waiting|working/.test(x.status));
      if (open) return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
      const row = Object.assign({ id: 'req' + asks.length, status: 'waiting', asked_at: new Date().toISOString(), asked_name: 'Matt Bloomfield', message: null, result: null }, body);
      T.piece_requests.unshift(row);
      return json(201, [row]);
    }
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
    const body = JSON.parse(r.request().postData() || '{}'), where = new URL(r.request().url()).pathname;
    helper.push({ path: where, body });
    const name = (opts.prefix || 'Brochure') + ' - 100 Example St 4A - 2026-10-22.pdf';
    const send = (x, status) => r.fulfill({ status: status || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x) });
    if (where === '/health') return send({ ok: true, version: 't', paired: !opts.unpaired });
    if (where === '/pieces/run') return send({ ok: true });
    // the helper reading the job's folder for a browser that has no Drive (0017)
    if (where === '/job-tree') return send({ ok: true, tree: HELPER_TREE });
    if (where === '/job-file') return send({ ok: true, name: String(body.file).split('/').pop(), type: 'image/png', modified: '2026-10-08T10:00:00.000Z', data: PNG_B64 });
    const reply = opts.helperReply || { ok: true, path: 'Marketing/Brochure/' + name, name, size: 12345, modified: '2026-10-22T15:00:00.000Z',
      url: 'https://drive.google.com/file/d/NEW/view', pages: 5, archived: null };
    send(reply, opts.helperStatus);
  });
  await page.goto(BASE + opts.path, { waitUntil: 'networkidle' });
  // only job-mode pages (?listing= / ?pitch= on a piece tool) ever set GVC_PIECEMODE;
  // waiting 15s for it on Map Studio or a standalone page made the run take 3+ minutes
  if (/[?&](listing|pitch)=/.test(opts.path) && !/map-studio/.test(opts.path))
    await page.waitForFunction(() => window.GVC_PIECEMODE && window.GVC_PIECEMODE.ready, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { page, errors, saves, pieces, helper, asks, ctx, T, printed: () => page.evaluate(() => window.__printed || 0) };
}
/* the helper finishes the newest request: the piece's record gets the file, the request is done */
function helperMakes(o, tool, name) {
  const req = o.T.piece_requests.find(x => x.tool === tool) || {};
  const doc = o.T.documents.find(d => d.tool === tool) || {};
  const pay = o.lastPayload || {};
  Object.assign(doc, { built_from: pay.builtFrom || { v: 2, tool, facts: {} }, version: (doc.version || 0) + 1,
    output: { name, path: 'Marketing/' + name, via: 'helper', paper: pay.paper || null, madeAt: new Date().toISOString(), url: 'https://drive.google.com/file/d/NEW/view' } });
  Object.assign(req, { status: 'done', result: { name } });
}
const payload = async o => (o.lastPayload = await o.page.evaluate(() => window.GVC_PIECEMODE.buildPayload()));
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

  // what the helper's page answers for this brochure (0017: it lays the piece the same way)
  const bp = await payload(o);
  check('brochure: what prints has the pictures inline, on its paper', [bp.why, bp.paper, bp.state.images.length, /data:image/.test(JSON.stringify(bp.state))], [undefined, 'letter', 3, true]);
  check('brochure: built_from holds the facts, photos and plans it printed', [bp.builtFrom.v, bp.builtFrom.tool, bp.builtFrom.via, bp.builtFrom.facts.price, bp.builtFrom.photos.map(p => p.path), bp.builtFrom.plans.map(p => [p.path, p.version])],
    [2, 'brochure', 'helper', 4400000, ['Photos/Edited/02.jpg', 'Photos/Edited/01.jpg', 'Photos/Edited/03.jpg'], [['Floorplan/v2/Level 1 v2.jpg', 2], ['Floorplan/v2/Level 2 v2.jpg', 2]]]);
  check('brochure: what is kept holds paths, never pictures', noData(bp.storable), true);

  // Make PDF: saves the sheet, then asks the helper; the browser never draws a PDF
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(500);
  check('brochure: Make PDF saves, then asks the helper for the brochure', [o.pieces.length, o.pieces[1] && o.pieces[1].p_built_from, o.asks.length, o.asks[0] && o.asks[0].tool, o.asks[0] && o.asks[0].property_id],
    [2, null, 1, 'brochure', 'p1']);
  check('brochure: the helper on this desktop is told to start, never sent a PDF', [o.helper.filter(x => x.path === '/pieces/run').length, o.helper.filter(x => x.path === '/piece').length, await o.printed()], [1, 0, 0]);
  check('brochure: the bar follows the request', /Waiting for the helper/.test(await text(o.page, '#pieceBar')), true);
  helperMakes(o, 'brochure', 'Brochure - 100 Example St 4A - 2026-10-22.pdf');
  await o.page.waitForTimeout(500);
  check('brochure: made today once the helper is done, the file named', [/^Made today/.test(await text(o.page, '#pieceState')), /Made: Brochure - 100 Example St 4A/.test(await text(o.page, '#pieceMsg')),
    /Waiting for the helper/.test(await text(o.page, '#pieceBar'))], [true, true, false]);
  check('brochure: no page errors', o.errors, []);
  await o.ctx.close();

  // the helper isn't on this computer: the request still waits for it; nothing printed, nothing recorded
  o = await open(browser, { path: BRO, helperDown: true });
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(500);
  check('brochure: helper away → asked all the same, no print, no record', [o.asks.length, await o.printed(), o.pieces.filter(x => x.p_output).length, /makes it on Matt's desktop/.test(await text(o.page, '#pieceMsg'))], [1, 0, 0, true]);
  check('brochure: the bar says it waits', /Waiting for the helper on Matt's desktop \(asked .* by Matt Bloomfield\)/.test(await text(o.page, '#pieceBar')), true);
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(400);
  check('brochure: asking again joins the waiting request', [o.asks.length, o.T.piece_requests.length, /Waiting for the helper/.test(await text(o.page, '#pieceBar'))], [2, 1, true]);
  await o.ctx.close();

  // the helper couldn't: its reason on the bar, nothing recorded, nothing printed
  o = await open(browser, { path: BRO, requests: [{ id: 'old', property_id: 'p1', tool: 'brochure', status: 'failed', asked_at: '2026-10-22T10:00:00Z', message: 'Drive hasn\'t downloaded 01.jpg on Matt\'s desktop yet.' }] });
  check('brochure: a failed request says why', /The helper couldn't make it: Drive hasn't downloaded 01\.jpg/.test(await text(o.page, '#pieceBar')), true);
  check('brochure: and nothing printed', await o.printed(), 0);
  await o.ctx.close();

  // a conflict before the request: nothing asked
  o = await open(browser, { path: BRO, conflict: true });
  await typeIn(o.page, '[data-field="price"]', '4,400,000');
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(500);
  check('brochure: conflict → nothing asked, said, the typed price kept', [o.asks.length, /changed a moment ago/.test(await text(o.page, '#pieceMsg')), (await pstate(o.page)).price], [0, true, '4,400,000']);
  await o.ctx.close();

  // a photo Drive hasn't downloaded in this browser: the helper reads Drive itself, so it is still asked
  o = await open(browser, { path: BRO, drive: { slow: 'Photos/Edited/01.jpg' } });
  check('brochure: a slow photo is named', /hasn't downloaded this yet: 01\.jpg/.test(await text(o.page, '#piecePhotoMsg')), true);
  check('brochure: the helper\'s own page would refuse it, naming the photo', /hasn't downloaded 01\.jpg/.test((await payload(o)).why || ''), true);
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(400);
  check('brochure: Make PDF still asks the helper', o.asks.length, 1);
  await o.ctx.close();

  // no Drive folder linked: Make PDF is greyed out, with the reason
  const unlinked = rowsFor(); delete unlinked.properties[0].drive_folder;
  o = await open(browser, { path: BRO, rows: unlinked });
  check('brochure: no folder → Make PDF off, the reason beside it', [await o.page.$eval('#btnPiecePdf', b => b.disabled), /Link the job's Drive folder on the job page first/.test(await text(o.page, '#pieceBar'))], [true, true]);
  await o.ctx.close();

  // Drive never connected in this browser and no helper here: Connect Drive opens the picker
  o = await open(browser, { path: BRO, helperDown: true, drive: { state: 'not-connected' } });
  check('brochure: never connected → Connect Drive', await text(o.page, '#pieceReconnect'), 'Connect Drive');
  await o.page.click('#pieceReconnect');
  await o.page.waitForTimeout(500);
  check('brochure: Connect Drive asks for the folder, then the photos come in', [await o.page.evaluate(() => [window.__driveLog.connect || 0, window.__driveLog.reconnect || 0]), (await pstate(o.page)).images.length], [[1, 0], 3]);
  await o.ctx.close();
  o = await open(browser, { path: BRO, helperDown: true, drive: { state: 'needs-click' } });
  await o.page.click('#pieceReconnect');
  await o.page.waitForTimeout(500);
  check('brochure: held once → Reconnect Drive, one click', [await o.page.evaluate(() => [window.__driveLog.connect || 0, window.__driveLog.reconnect || 0]), (await pstate(o.page)).images.length], [[0, 1], 3]);
  await o.ctx.close();

  // Drive not connected but the helper runs here: the photos come through the helper
  o = await open(browser, { path: BRO, drive: { state: 'not-connected' } });
  check('brochure: photos and plans through the helper', [(await pstate(o.page)).images.length, (await pstate(o.page)).floorplans.length, o.helper.filter(x => x.path === '/job-file').length, await o.page.evaluate(() => window.__driveLog.read.length)],
    [3, 2, 5, 0]);
  check('brochure: no Connect button then', await o.page.$('#pieceReconnect'), null);
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
  // the team's shared account may ask the helper (0017), never save the wording
  o = await open(browser, { path: BRO, members: [{ name: 'Team (shared)', initials: 'GVC', role: 'shared' }] });
  check('brochure: the shared account sees Make PDF, not Save sheet', [!!(await o.page.$('#btnPiecePdf')), !!(await o.page.$('#btnPieceSave')), /Make PDF asks the helper to make it as last saved/.test(await text(o.page, '#pieceBar'))], [true, false, true]);
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(400);
  check('brochure: the shared account asks without saving anything', [o.asks.length, o.saves.length, o.pieces.length], [1, 0, 0]);
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
  o = await open(browser, { path: BRO, documents: [SAVED2], drive: { state: 'prompt' }, helperDown: true });
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
  const pcp = await payload(o);
  check('postcard: what prints is the listed card with two inline photos', [pcp.state.photos.length, /data:image/.test(JSON.stringify(pcp.state))], [2, true]);
  check('postcard: built_from', [pcp.builtFrom.tool, pcp.builtFrom.photos.length, pcp.builtFrom.facts.price], ['postcard-listed', 2, 4450000]);
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(500);
  check('postcard: Make PDF asks for the listed card', o.asks.map(a => [a.tool, a.property_id]), [['postcard-listed', 'p1']]);
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
  o = await open(browser, { path: '/tools/seller-package/?listing=100-example-st-4a', prefix: 'Seller Package' });
  s = await pstate(o.page);
  check('seller on a listing: the bar', /^Seller Package for 100 Example St · 4A/.test(await text(o.page, '#pieceBar .jb-t')), true);
  check('seller on a listing: subject facts, comps, market', [s.address, s.beds, s.sqft, s.city, s.comps.length, s.comps[0].address, s.market, s.agents],
    ['100 Example St, Residence 4A', '3', '1800', 'Testville', 1, '14 Example St', 'nj', ['john-gasdaska']]);
  check('seller on a listing: photos from the picks', s.photos.length, 3);
  check('seller: Make the map opens Map Studio for this job', await o.page.$eval('#makeMap', a => a.getAttribute('href')), '../map-studio/?listing=100-example-st-4a');
  await typeIn(o.page, '[data-f="priceMid"]', '4,350,000');
  await o.page.click('#btnPieceSave');
  await o.page.waitForTimeout(500);
  check('seller on a listing: the price band saves to the job', o.saves.map(x => [x.p_table, x.p_changes.map(c => [c.field, c.new_value, c.note])]),
    [['properties', [['priceMid', 4350000, 'on the Seller Package']]]]);
  check('seller on a listing: the draft is on the listing, paths only', [o.pieces[0] && o.pieces[0].p_table, o.pieces[0] && o.pieces[0].p_tool, noData(o.pieces[0] && o.pieces[0].p_state)], ['properties', 'seller', true]);
  check('seller: no page errors', o.errors, []);
  await o.ctx.close();

  const PITCH = '/tools/seller-package/?pitch=12-sample-ln-2026-10-01';
  const mapDoc = { pitch_id: 'q1', tool: 'pitch-map', version: 1, state: {}, built_from: { v: 2, tool: 'pitch-map', facts: {} },
    output: { path: 'Marketing/Pitch/Map - 12 Sample Ln - 2026-10-20.png', name: 'Map - 12 Sample Ln - 2026-10-20.png', via: 'helper', modified: '2026-10-20T10:00:00.000Z' } };
  o = await open(browser, { path: PITCH, documents: [mapDoc], prefix: 'Seller Package',
    helperReply: { ok: true, path: 'Marketing/Pitch/Seller Package - 12 Sample Ln - 2026-10-22.pdf', name: 'Seller Package - 12 Sample Ln - 2026-10-22.pdf', size: 1, modified: '2026-10-22T15:00:00.000Z', url: null, pages: 12, archived: null } });
  s = await pstate(o.page);
  check('seller on a pitch: the bar points at the pitch page', [/^Seller Package for 12 Sample Ln/.test(await text(o.page, '#pieceBar .jb-t')), await o.page.$eval('#pieceBar [data-back]', a => a.getAttribute('href'))],
    [true, '../../workspace/job/?pitch=12-sample-ln-2026-10-01']);
  check('seller on a pitch: facts from the pitch, Asana\'s agents flagged', [s.address, s.priceMid, s.comps.length, /Agents not confirmed on the pitch/.test(await text(o.page, '#pieceBar'))], ['12 Sample Ln', '1900000', 1, true]);
  check('seller on a pitch: photos from its Photos folder only, never loose files', [s.photos.map(p => p.name), await o.page.evaluate(() => window.__driveLog.read.indexOf('img.jpg'))], [['back.jpg', 'front.jpg'], -1]);
  check('seller on a pitch: the map from the map record\'s file', [!!s.map, s.map && s.map.name], [true, 'Map - 12 Sample Ln - 2026-10-20.png']);
  await typeIn(o.page, '[data-f="beds"]', '4');
  await o.page.click('#btnPiecePdf');
  await o.page.waitForTimeout(800);
  check('seller on a pitch: a fact saves to the pitch', o.saves.map(x => [x.p_table, x.p_id, x.p_changes.map(c => c.field)]), [['pitches', 'q1', ['beds']]]);
  check('seller on a pitch: the helper is asked with the pitch', o.asks.map(a => [a.pitch_id, a.property_id, a.tool]), [['q1', undefined, 'seller']]);
  const pb = await payload(o);
  check('seller on a pitch: built from the pitch with the map it prints', [pb.builtFrom.map && pb.builtFrom.map.path, pb.builtFrom.photos.length, !!pb.state.map],
    ['Marketing/Pitch/Map - 12 Sample Ln - 2026-10-20.png', 2, true]);
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
  const mm = await payload(o);
  check('postcard: Make main records the photos in their new order, crops on the right file', [mm.builtFrom.photos.map(p => p.path),
    ((o.pieces[0] || {}).p_state || {}).photos && o.pieces[0].p_state.photos.map(p => [p.path, p.x])],
    [['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg'], [['Photos/Edited/01.jpg', 11], ['Photos/Edited/02.jpg', 50]]]);
  await o.ctx.close();
  o = await open(browser, { path: '/tools/seller-package/?listing=100-example-st-4a', prefix: 'Seller Package' });
  await o.page.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__piece.state)); s.photos[2].role = 'exclude'; window.__piece.set(s); });
  check('seller: an unused photo is recorded, flagged', (await payload(o)).builtFrom.photos.map(p => !!p.excluded), [false, false, true]);
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
  check('sign: Make PDF asks for the sign', o.asks.map(a => [a.tool, a.property_id]), [['signage', 'p1']]);
  const sp = await payload(o);
  check('sign: what prints, and built_from with the agents and link', [sp.state.kind, sp.builtFrom.tool, sp.builtFrom.agents, sp.builtFrom.listingUrl],
    ['for-sale', 'signage', ['john-gasdaska'], 'https://www.elliman.com/new-jersey/100-example-st/9001']);
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
