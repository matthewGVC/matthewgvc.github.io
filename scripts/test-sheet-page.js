/* ============================================================
   Browser tests for the Showsheet in job mode (Slice 4, Tasks 6 and 8):
   /tools/showsheet/?listing=<slug> opens filled from the job, with its
   photos and floorplan read from Drive, and saves back through save_job,
   save_piece and the helper's POST /piece. Supabase, Drive and the helper
   are mocked by request interception (made-up rows and names; nothing real).

     BASE=http://localhost:8096 node scripts/test-sheet-page.js
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
  const T = {
    properties: [
      { id: 'p1', slug: '100-example-st-4a', label: 'x', kind: 'sale', market: 'NYC', stage: 'Live', version: 7,
        core: { address: '100 Example St', unit: '4A', neighborhood: 'Testville', propertyType: 'Condo', price: 4500000, beds: 3, baths: 2,
          commonCharges: 2100, taxesMonthly: 1900, agentIds: ['john-gasdaska'],
          buildingFeatures: ['Pre-war', 'Full-time doorman'], interiorFeatures: ['South exposure', 'Wood floors'],
          facts: {
            price: rec(4500000, 'DE'), beds: rec(3, 'DE'), baths: rec(2, 'DE'),
            commonCharges: rec(2200, 'Matt', { DE: 2100, Matt: 2200 }), taxesMonthly: rec(1900, 'DE'),
            buildingFeatures: rec(['Pre-war', 'Full-time doorman'], 'DE'), interiorFeatures: rec(['South exposure', 'Wood floors'], 'DE')
          } },
        de: { listingUrl: 'https://www.elliman.com/new-york-city/100-example-st/4a/9001' },
        drive_folder: 'GVC - New York/Building Information/100 Example St/4A', folder_state: 'linked',
        photo_hero: null, photo_order: [] },
      { id: 'p9', slug: 'evil', label: 'e', kind: 'sale', market: 'FL', stage: 'Prep', version: 1,
        core: { address: '<img src=x onerror="window.__xss=1">', unit: '"><b>', propertyType: 'Condo',
          facts: { headline: rec('<script>window.__xss=3</script>', 'Matt') } }, folder_state: 'unlinked' }
    ],
    documents: over.documents || [],
    floorplans: []
  };
  return T;
}

const FAKE_DRIVE = `(function () {
  var cfg = window.__FAKE_DRIVE || {};
  var PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), function (c) { return c.charCodeAt(0); });
  function f(name, day) { return { name: name, kind: 'file', size: 1000, modified: '2026-10-' + day + 'T10:00:00.000Z' }; }
  function d(name, children) { return { name: name, kind: 'directory', children: children }; }
  var plans = cfg.pdfOnly ? [d('v2', [f('Plan v2.pdf', '09'), f('Plan v2.ai', '09')])]
    : cfg.plans === 'standard' ? [d('v2', [f('x v2.jpg', '09')]), d('Unbranded', [f('x v3.svg', '20'), f('x v3.png', '20')]),
        d('Branded', [f('x v3.svg', '20')]), d('Design', [f('cubicasa v9.png', '21')])]
    : cfg.plans === 'old' ? [d('v2', [f('x v2.jpg', '09')])]
    : cfg.plans === 'design' ? [d('Design', [f('cubicasa.png', '21'), f('plan.json', '21')])]
    : [d('v1', [f('Plan v1.jpg', '04')]), d('v2', [f('Plan v2.jpg', '09'), f('Plan v2 unbranded.png', '09')])];
  // an SVG plan arrives with no type, as a file from disk may: the reader must still draw it
  var SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 810 630" width="810" height="630"><rect width="810" height="630" fill="#fff"/><path d="M100 100H700V530H100Z" fill="none" stroke="#0a2240" stroke-width="6"/></svg>';
  var tree = d('4A', [
    f('Exclusive - Jane Client.pdf', '02'),
    d('Marketing', [d('Showsheet', [f('Showsheet - 100 Example St 4A - 2026-10-12.pdf', '12')])]),
    d('Floorplan', plans),
    d('Photos', [d('Edited', [f('01.jpg', '08'), f('02.jpg', '08'), f('03.jpg', '08'), f('Signed contract Jane Client.jpg', '08')])])
  ]);
  var log = window.__driveLog = { tree: 0, read: [] };
  window.GVC_DRIVE = {
    supported: function () { return true; },
    state: function () { return cfg.stateThrows ? Promise.reject(new Error('Drive went away.')) : Promise.resolve(cfg.state || 'connected'); },
    connect: function () { cfg.state = 'connected'; return Promise.resolve(['GVC - New York']); },
    reconnect: function () { cfg.state = 'connected'; return Promise.resolve(true); },
    list: function () { return Promise.resolve([]); }, relPathOf: function () { return Promise.resolve(null); },
    tree: function () { log.tree++; return cfg.slowTree ? new Promise(function () {}) : Promise.resolve(JSON.parse(JSON.stringify(tree))); },
    listJob: function () { return Promise.resolve([]); },
    readJobFile: function (folder, path) {
      log.read.push(path);
      if (path === cfg.slow) return new Promise(function () {});
      var svg = /\.svg$/i.test(path);
      return new Promise(function (res) { setTimeout(function () { res(new File([svg ? SVG : PNG], path.split('/').pop(), { type: svg ? '' : 'image/png' })); }, 30); });
    }
  };
})();`;

async function open(browser, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], saves = [], pieces = [], helper = [];
  // print confirms and other dialogs: accepted unless a test asks to dismiss them
  const dialog = { answer: 'accept', seen: [] };
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { dialog.seen.push(d.message()); if (dialog.answer === 'dismiss') d.dismiss(); else d.accept(); });
  await page.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  await page.addInitScript(() => localStorage.setItem('gvc.helper.pair', 'PAIR'));
  await page.addInitScript(cfg => { window.__FAKE_DRIVE = cfg; window.__sheetTimeoutMs = 300; window.__sheetRetryMs = 30; window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, opts.drive || {});
  await page.route('**/assets/js/drive.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_DRIVE }));
  const T = opts.rows || rowsFor(opts);
  await page.route('**/rest/v1/**', r => {
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), m = r.request().method();
    const json = (status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (table === 'members') return json(200, opts.members || [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }]);
    if (table === 'save_job') {
      const body = JSON.parse(r.request().postData() || '{}');
      saves.push(body);
      if (opts.conflict) { T.properties.find(x => x.id === body.p_id).version += 1; return json(400, { code: 'P0001', message: 'conflict' }); }
      const row = T.properties.find(x => x.id === body.p_id);
      Object.assign(row, body.p_set, { version: row.version + 1 });
      return json(200, row);
    }
    if (table === 'save_piece') {
      const body = JSON.parse(r.request().postData() || '{}');
      pieces.push(body);
      if (opts.pieceFails && pieces.length <= opts.pieceFails) return json(500, { message: 'boom' });
      const doc = Object.assign({ property_id: body.p_property_id, tool: body.p_tool, version: (body.p_version || 0) + 1, state: body.p_state, outputs: [] },
        body.p_built_from ? { built_from: body.p_built_from, output: body.p_output } : {});
      T.documents = [doc];
      if (opts.pieceLost && pieces.length <= opts.pieceLost) return json(500, { message: 'the reply was lost' });
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
    helper.push({ path: new URL(r.request().url()).pathname, body, pair: r.request().headers()['x-gvc-pair'] });
    const reply = opts.helperReply || { ok: true, path: 'Marketing/Showsheet/Showsheet - 100 Example St 4A - 2026-10-22.pdf', name: 'Showsheet - 100 Example St 4A - 2026-10-22.pdf',
      size: 12345, modified: '2026-10-22T15:00:00.000Z', url: 'https://drive.google.com/file/d/NEW/view', pages: 2, archived: { from: 'a', to: 'b' } };
    r.fulfill({ status: opts.helperStatus || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(reply) });
  });
  await page.goto(BASE + (opts.path || '/tools/showsheet/?listing=100-example-st-4a'), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.GVC_SHEETMODE && window.GVC_SHEETMODE.ready, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { page, errors, saves, pieces, helper, ctx, T, dialog, printed: () => page.evaluate(() => window.__printed || 0) };
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const st = page => page.evaluate(() => window.__test.state);
const typeIn = async (page, field, value) => {
  await page.$eval('[data-field="' + field + '"]', e => { const d = e.closest('details'); if (d) d.open = true; });
  await page.fill('[data-field="' + field + '"]', value);
  await page.waitForTimeout(250);
};

(async () => {
  const browser = await chromium.launch();
  let t, p, s;

  /* ---------- opening a job's sheet (Task 6) ---------- */
  t = await open(browser, {});
  p = t.page;
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  check('job mode: no page errors', t.errors, []);
  check('job mode: the bar names the job', (await text(p, '#jobBar')).includes('Showsheet for 100 Example St · 4A'), true);
  check('job mode: link back to the job page', await p.$eval('#jobBar a[data-back]', a => a.getAttribute('href')), '../../workspace/job/?listing=100-example-st-4a');
  check('job mode: no property bar', await p.$eval('#propBar', e => e.children.length), 0);
  s = await st(p);
  check('job mode: facts on the sheet', [s.address, s.unit, s.price, s.commonCharges, s.ownership, s.market, s.listingUrl, s.agentIds],
    ['100 Example St', '4A', '$4,500,000', '$2,200', 'condo', 'nyc', 'https://www.elliman.com/new-york-city/100-example-st/4a/9001', ['john-gasdaska']]);
  check('job mode: lists through the reader rules', [s.building.service, s.residence.exposures], ['Full-time doorman', 'South exposure']);
  check('job mode: badges', [await text(p, '[data-jf="price"] .chip'), await text(p, '[data-jf="commonCharges"] .chip')], ['DE', 'Matt']);
  check('job mode: Matt vs DE warning', (await text(p, '[data-jf="commonCharges"] .jfw')) || '', 'DE says $2,100');
  check('job mode: photos from Drive, by name', s.photos.map(x => x.path), ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg', 'Photos/Edited/03.jpg']);
  check('job mode: front and back', [s.photos[s.heroIndex].path, s.photos[s.secondaryIndex].path], ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg']);
  check('job mode: photo files are inline images', /^data:image\//.test(s.photos[0].src), true);
  check('job mode: paperwork never read or shown', [(await p.evaluate(() => window.__driveLog.read)).some(x => /Jane Client/.test(x)), (await p.content()).includes('Jane Client')], [false, false]);
  check('job mode: newest branded floorplan', await p.evaluate(() => window.GVC_SHEETMODE.floorplan), { version: 2, render: 'branded', path: 'Floorplan/v2/Plan v2.jpg', modified: '2026-10-09T10:00:00.000Z' });
  check('job mode: the plan is on the sheet', /^data:image\//.test(s.floorplan || ''), true);
  check('job mode: address is read-only', await p.$eval('[data-field="address"]', e => e.readOnly), true);
  check('job mode: agents are the job\'s', (await text(p, '#agentPick')).includes('Change agents on the job page'), true);
  check('job mode: a file there but no record', (await text(p, '#jobBar')).includes('Made before the workspace kept track'), true);

  // a fact typed on the sheet saves to the job (S4), with the typo tick
  await typeIn(p, 'price', '$4.2M');
  check('fact edit: says it saves to the job', (await text(p, '[data-jf="price"]')).includes('yours, saves to the job'), true);
  await p.click('#btnSaveSheet');
  await p.waitForTimeout(600);
  check('Save sheet: one save_job', t.saves.length, 1);
  check('Save sheet: the price change', (t.saves[0] || {}).p_changes, [{ field: 'price', old_value: 4500000, new_value: 4200000, note: 'on the Showsheet', no_rebuild: false }]);
  check('Save sheet: as Matt\'s value', [(t.saves[0] || {}).p_version, ((t.saves[0] || {}).p_set || {}).core.facts.price.source], [7, 'Matt']);
  check('Save sheet: then one draft save_piece', [t.pieces.length, (t.pieces[0] || {}).p_built_from, (t.pieces[0] || {}).p_output, (t.pieces[0] || {}).p_version], [1, null, null, null]);
  check('Save sheet: no image data stored, paths kept', [JSON.stringify((t.pieces[0] || {}).p_state).includes('data:'), ((t.pieces[0] || {}).p_state.photos || []).map(x => x.path)],
    [false, ['Photos/Edited/01.jpg', 'Photos/Edited/02.jpg', 'Photos/Edited/03.jpg']]);
  check('Save sheet: the plan record kept', ((t.pieces[0] || {}).p_state || {}).floorplanFrom, { version: 2, render: 'branded', path: 'Floorplan/v2/Plan v2.jpg', modified: '2026-10-09T10:00:00.000Z' });
  check('Save sheet: said so', (await text(p, '#jobMsg')).includes('Saved'), true);
  const savedLists = (((t.pieces[0] || {}).p_state) || {}).listsFrom || null;
  check('Save sheet: keeps the lists its wording came from', Object.keys(savedLists || {}).sort(), ['buildingFeatures', 'interiorFeatures']);
  await typeIn(p, 'beds', '4');
  await p.check('[data-typo="beds"]');
  await p.click('#btnSaveSheet');
  await p.waitForTimeout(600);
  check('Typo, no rebuild', ((t.saves[1] || {}).p_changes || []).map(c => [c.field, c.no_rebuild]), [['beds', true]]);
  check('second draft uses the saved version', (t.pieces[1] || {}).p_version, 1);
  check('job mode: no page errors after saves', t.errors, []);
  await t.ctx.close();

  // a weird value is refused with a sentence, nothing saved
  t = await open(browser, {});
  await typeIn(t.page, 'price', 'Call for price');
  await t.page.click('#btnSaveSheet');
  await t.page.waitForTimeout(400);
  check('weird price refused', [await text(t.page, '#jobMsg'), t.saves.length, t.pieces.length], ['Type a number, like 2250000 or $2.25M.', 0, 0]);
  await t.ctx.close();

  // conflict: the job reloads, the sheet keeps its typing
  t = await open(browser, { conflict: true });
  await typeIn(t.page, 'price', '4100000');
  await t.page.click('#btnSaveSheet');
  await t.page.waitForTimeout(600);
  check('conflict: sentence, nothing else saved, typing kept', [await text(t.page, '#jobMsg'), t.pieces.length, (await st(t.page)).price],
    ['This job changed a moment ago. Reloaded; try again.', 0, '4100000']);
  check('conflict: the job was reloaded', await t.page.evaluate(() => window.GVC_SHEETMODE.row.version), 8);
  await t.ctx.close();

  // a photo Drive hasn't downloaded
  t = await open(browser, { drive: { slow: 'Photos/Edited/01.jpg' } });
  await t.page.waitForTimeout(500);
  check('photo times out: said on the panel', (await text(t.page, '#jobPhotoMsg')).includes('Drive hasn\'t downloaded this yet: 01.jpg'), true);
  check('photo times out: facts still filled', (await st(t.page)).price, '$4,500,000');
  await t.ctx.close();

  // Drive not connected here
  t = await open(browser, { drive: { state: 'needs-click' } });
  check('no Drive: says so with Reconnect', [(await text(t.page, '#jobPhotoMsg')).includes('Connect Drive on this desktop to bring in photos and the floorplan'), !!(await t.page.$('#jobReconnect'))], [true, true]);
  check('no Drive: facts filled', (await st(t.page)).price, '$4,500,000');
  await t.page.click('#jobReconnect');
  await t.page.waitForTimeout(800);
  check('Reconnect brings the photos in', (await st(t.page)).photos.length, 3);
  await t.ctx.close();

  // no Drive folder saved in this browser at all: Connect Drive (the picker), not Reconnect
  t = await open(browser, { drive: { state: 'not-connected' } });
  check('not connected: Connect Drive, not Reconnect', [!!(await t.page.$('#jobConnect')), !!(await t.page.$('#jobReconnect'))], [true, false]);
  check('not connected: Save PDF greyed, the reason beside it', [await t.page.$eval('#btnSavePdf', e => e.disabled), /Connect Drive on this desktop first/.test(await text(t.page, '#jobPdfWhy'))], [true, true]);
  await t.page.click('#jobConnect');
  await t.page.waitForTimeout(800);
  check('Connect Drive brings the photos in', (await st(t.page)).photos.length, 3);
  check('Connect Drive: Save PDF ready again, no reason', [await t.page.$eval('#btnSavePdf', e => e.disabled), await t.page.$('#jobPdfWhy')], [false, null]);
  await t.ctx.close();

  // a floorplan folder with only PDF / Illustrator files (S8)
  t = await open(browser, { drive: { pdfOnly: true } });
  check('PDF-only floorplan: says what to do', (await text(t.page, '#jobPlanMsg')), 'No floorplan image in Floorplan\\v2\\ (only PDF). Export a JPG there, or drop one here for this sheet.');
  check('PDF-only floorplan: drop zone shown', await t.page.$eval('#fpDrop', e => getComputedStyle(e).display !== 'none' && !e.closest('[hidden]')), true);
  await t.ctx.close();

  // a plan dropped by hand is recorded as dropped
  t = await open(browser, { drive: { pdfOnly: true } });
  await t.page.evaluate(async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    await window.__sheet.setFloorplanFile(new File([png], 'mine.png', { type: 'image/png' }));
  });
  await t.page.waitForTimeout(300);
  await t.page.click('#btnSaveSheet');
  await t.page.waitForTimeout(600);
  check('dropped plan: recorded as dropped', ((t.pieces[0] || {}).p_state || {}).floorplanFrom, { dropped: true });
  await t.ctx.close();

  // Save sheet with Drive not connected keeps the crops saved earlier (review I1)
  const CROPS = { property_id: 'p1', tool: 'showsheet', version: 3, state: { photos: [{ path: 'Photos/Edited/01.jpg', fx: 20, fy: 70, name: '01.jpg' }, { path: 'Photos/Edited/02.jpg', fx: 40, fy: 10, name: '02.jpg' }], heroIndex: 0, secondaryIndex: 1 } };
  t = await open(browser, { documents: [CROPS], drive: { state: 'needs-click' } });
  await t.page.click('#btnSaveSheet');
  await t.page.waitForTimeout(600);
  check('no Drive: Save sheet keeps the saved crops', (((t.pieces[0] || {}).p_state || {}).photos || []).map(x => [x.path, x.fx, x.fy]),
    [['Photos/Edited/01.jpg', 20, 70], ['Photos/Edited/02.jpg', 40, 10]]);
  await t.ctx.close();
  t = await open(browser, { documents: [CROPS], drive: { slow: 'Photos/Edited/02.jpg' } });
  await t.page.waitForTimeout(500);
  await t.page.click('#btnSaveSheet');
  await t.page.waitForTimeout(600);
  check('a photo not downloaded: its crop kept too', (((t.pieces[0] || {}).p_state || {}).photos || []).filter(x => x.path === 'Photos/Edited/02.jpg').map(x => [x.fx, x.fy]), [[40, 10]]);
  await t.ctx.close();

  // Drive failing after the job loaded leaves the bar alone (review I2)
  t = await open(browser, { drive: { stateThrows: true } });
  check('Drive throws: bar and Save stay', [(await text(t.page, '#jobBar')).includes('Showsheet for 100 Example St'), !!(await t.page.$('#btnSaveSheet'))], [true, true]);
  check('Drive throws: said on the panel', (await text(t.page, '#jobPhotoMsg')).includes('Drive went away.'), true);
  await t.ctx.close();

  // the standalone Showsheet never loads job mode
  t = await open(browser, { path: '/tools/showsheet/' });
  check('standalone: no job mode', [await t.page.evaluate(() => typeof window.GVC_SHEETMODE), await t.page.$eval('#jobBar', e => e.hidden)], ['undefined', true]);
  await t.ctx.close();

  /* ---------- Save PDF to Drive (Task 8) ---------- */
  const savePdf = async t => { await t.page.click('#btnSavePdf'); await t.page.waitForTimeout(900); };
  t = await open(browser, {});
  p = t.page;
  await typeIn(p, 'price', '4200000');
  await savePdf(t);
  check('PDF: the fact edit saved first', [t.saves.length, ((t.saves[0] || {}).p_changes || []).map(c => c.field)], [1, ['price']]);
  const pc = (t.helper.filter(h => h.path === '/piece')[0] || {}).body || {};
  check('PDF: one /piece call with the job and paper', [t.helper.filter(h => h.path === '/piece').length, pc.propertyId, pc.tool, pc.paper], [1, 'p1', 'showsheet', 'a5']);
  check('PDF: the printed state has exactly the two photos, inline', [((pc.state || {}).photos || []).length, ((pc.state || {}).photos || []).every(x => /^data:image\//.test(x.src)), (pc.state || {}).heroIndex, (pc.state || {}).secondaryIndex], [2, true, 0, 1]);
  check('PDF: the plan travels inline', /^data:image\//.test((pc.state || {}).floorplan || ''), true);
  check('PDF: the sheet prints the saved price', String((pc.state || {}).price).replace(/[^0-9]/g, ''), '4200000');
  const sp = t.pieces[0] || {};
  check('PDF: then save_piece with built_from from the saved row', [t.pieces.length, ((sp.p_built_from || {}).facts || {}).price, (((sp.p_built_from || {}).photos || {}).front || {}).path, (((sp.p_built_from || {}).photos || {}).back || {}).path, (sp.p_built_from || {}).via],
    [1, 4200000, 'Photos/Edited/01.jpg', 'Photos/Edited/02.jpg', 'helper']);
  check('PDF: the output from the helper reply', [(sp.p_output || {}).name, (sp.p_output || {}).path, (sp.p_output || {}).url, (sp.p_output || {}).via, (sp.p_output || {}).paper],
    ['Showsheet - 100 Example St 4A - 2026-10-22.pdf', 'Marketing/Showsheet/Showsheet - 100 Example St 4A - 2026-10-22.pdf', 'https://drive.google.com/file/d/NEW/view', 'helper', 'a5']);
  check('PDF: the move passed through, no image data stored', [sp.p_archived, JSON.stringify(sp.p_state || {}).includes('data:')], [{ from: 'a', to: 'b' }, false]);
  check('PDF: the bar says made today, with Open and Copy Drive link', [(await text(p, '#jobBar')).includes('Made today'), await p.$eval('#jobBar a[data-open]', a => a.href).catch(() => null), !!(await p.$('#jobBar [data-copy]'))],
    [true, 'https://drive.google.com/file/d/NEW/view', true]);
  check('PDF: no page errors', t.errors, []);
  await t.ctx.close();

  // conflict before the PDF: no file, the typing kept
  t = await open(browser, { conflict: true });
  await typeIn(t.page, 'price', '4100000');
  await savePdf(t);
  check('conflict before the PDF', [t.helper.filter(h => h.path === '/piece').length, t.pieces.length, await text(t.page, '#jobMsg'), (await st(t.page)).price],
    [0, 0, 'This job changed a moment ago. Reloaded; try again.', '4100000']);
  await t.ctx.close();

  // helper down: the print dialog, recorded as printed by hand
  t = await open(browser, { helperDown: true });
  await savePdf(t);
  check('helper down: printed once', await t.printed(), 1);
  check('helper down: recorded as printed', [((t.pieces[0] || {}).p_output || {}).via, ((t.pieces[0] || {}).p_built_from || {}).via, /^Showsheet - 100 Example St 4A - \d{4}-\d{2}-\d{2}\.pdf$/.test(((t.pieces[0] || {}).p_output || {}).name || ''), (t.pieces[0] || {}).p_archived],
    ['print', 'print', true, null]);
  check('helper down: the bar says so', (await text(t.page, '#jobBar')).includes('printed by hand, file not tracked'), true);
  await t.ctx.close();

  // the print dialog cancelled, and the user says it didn't finish: not recorded as made
  t = await open(browser, { helperDown: true });
  t.dialog.answer = 'dismiss';
  await savePdf(t);
  check('print cancelled: asked once, nothing recorded', [t.dialog.seen.length, /Did the print finish/.test(t.dialog.seen[0] || ''), t.pieces.length, await t.printed()], [1, true, 0, 1]);
  check('print cancelled: says it is not made', (await text(t.page, '#jobMsg')).startsWith('Not marked as made'), true);
  await t.ctx.close();

  // the helper refuses with a sentence: shown, nothing recorded, no print
  t = await open(browser, { helperStatus: 409, helperReply: { ok: false, error: 'This job has no Drive folder linked.' } });
  await savePdf(t);
  check('helper refusal: shown, nothing recorded', [await text(t.page, '#jobMsg'), t.pieces.length, await t.printed()], ['This job has no Drive folder linked.', 0, 0]);
  await t.ctx.close();

  // the file is written but the job can't record it
  t = await open(browser, { pieceFails: 3 });
  await savePdf(t);
  check('save_piece failing 3 times', [t.pieces.length, await text(t.page, '#jobMsg')],
    [3, 'Saved to Drive, but the job didn\'t record it. Press Save PDF to Drive again or reload.']);
  await t.ctx.close();
  t = await open(browser, { pieceFails: 2 });
  await savePdf(t);
  check('save_piece failing twice then working', [t.pieces.length, (await text(t.page, '#jobMsg')).startsWith('Saved to Drive')], [3, true]);
  await t.ctx.close();

  // a printed photo Drive hasn't downloaded: refused, nothing made
  t = await open(browser, { drive: { slow: 'Photos/Edited/01.jpg' } });
  await t.page.waitForTimeout(800);
  check('photo not downloaded: Save PDF greyed, the reason beside it', [await t.page.$eval('#btnSavePdf', e => e.disabled), /Drive hasn\'t downloaded 01\.jpg yet/.test(await text(t.page, '#jobPdfWhy')), t.helper.filter(h => h.path === '/piece').length, t.pieces.length], [true, true, 0, 0]);
  await t.ctx.close();
  t = await open(browser, { drive: { state: 'needs-click' } });
  check('Drive not connected: Save PDF greyed, nothing made', [await t.page.$eval('#btnSavePdf', e => e.disabled), (await text(t.page, '#jobPdfWhy')).includes('Connect Drive'), t.helper.filter(h => h.path === '/piece').length], [true, true, 0]);
  await t.ctx.close();

  // review fixes (Task 8)
  t = await open(browser, { drive: { slowTree: true }, rows: Object.assign(rowsFor({}), {}) });
  await t.page.evaluate(() => { window.__sheetTimeoutMs = 60000; });
  check('Drive still reading the folder: Save PDF greyed, says so', [await t.page.$eval('#btnSavePdf', e => e.disabled), /Drive (didn't finish|is still) reading/.test(await text(t.page, '#jobPdfWhy'))], [true, true]);
  check('Drive still reading the folder: nothing made', [t.helper.filter(h => h.path === '/piece').length, t.pieces.length], [0, 0]);
  await t.ctx.close();
  t = await open(browser, { helperDown: true, pieceFails: 3 });
  await savePdf(t);
  check('printed but not recorded: says printed, not saved to Drive', await text(t.page, '#jobMsg'), 'Printed, but the job didn\'t record it. Press Save PDF to Drive again or reload.');
  await t.ctx.close();
  t = await open(browser, {});
  Object.assign(t.T.properties[0].core, { price: 3900000 });
  t.T.properties[0].core.facts.price = rec(3900000, 'Matt');
  t.T.properties[0].version = 9;
  await savePdf(t);
  check('the job changed elsewhere since the sheet opened: no PDF made', [t.helper.filter(h => h.path === '/piece').length, t.pieces.length, (await text(t.page, '#jobMsg')).includes('changed')], [0, 0, true]);
  await t.ctx.close();

  // team role: read-only
  t = await open(browser, { members: [{ name: 'Katie Cook', initials: 'KC', role: 'team' }] });
  check('team: no save buttons', [await t.page.$('#btnSaveSheet'), await t.page.$('#btnSavePdf')], [null, null]);
  check('team: Get PDF or Ask Matt, never a dead end', /Get PDF|Ask Matt/.test(await text(t.page, '#jobBar')), true);
  check('team: fields read-only, print stays', [await t.page.$eval('[data-field="price"]', e => e.readOnly || e.disabled), !!(await t.page.$('#btnPrint'))], [true, true]);
  await t.ctx.close();

  // unknown slug
  t = await open(browser, { path: '/tools/showsheet/?listing=no-such-job' });
  check('unknown slug', (await text(t.page, '#jobBar')).includes('No job called "no-such-job"'), true);
  await t.ctx.close();

  // hostile values never run
  t = await open(browser, { path: '/tools/showsheet/?listing=evil' });
  check('hostile job: nothing runs', [await t.page.evaluate(() => window.__xss || 0), t.errors], [0, []]);
  await t.ctx.close();

  // Rebuild: the banner lists what changed since the last build
  const BF = { v: 1, market: 'NYC', kind: 'sale', ownership: 'condo', facts: { price: 4750000, beds: 3, baths: 2, halfBaths: null, neighborhood: 'Testville', yearBuilt: null, headline: null,
    interiorFeatures: ['South exposure', 'Wood floors'], buildingFeatures: ['Pre-war'], assessments: null, commonCharges: 2200, taxesMonthly: 1900 },
    agents: ['john-gasdaska'], agentsConfirmed: true, listingUrl: 'https://www.elliman.com/new-york-city/100-example-st/4a/9001',
    photos: { front: { path: 'Photos/Edited/01.jpg', modified: '2026-10-08T10:00:00.000Z' }, back: { path: 'Photos/Edited/02.jpg', modified: '2026-10-08T10:00:00.000Z' } },
    floorplan: { version: 2, render: 'branded', path: 'Floorplan/v2/Plan v2.jpg', modified: '2026-10-09T10:00:00.000Z' }, print: { paper: 'a5', bleed: false }, via: 'helper' };
  const DOC = { property_id: 'p1', tool: 'showsheet', version: 4, built_from: BF, built_at: '2026-10-20T10:00:00Z',
    output: { name: 'Showsheet - 100 Example St 4A - 2026-10-20.pdf', path: 'Marketing/Showsheet/Showsheet - 100 Example St 4A - 2026-10-20.pdf', paper: 'a5', madeAt: '2026-10-20T10:00:00Z', via: 'helper' },
    state: { building: { service: 'My own service line', amenities: ['Roof deck'] }, residence: { features: ['Mine'] }, textScale: { residence: 120 } } };
  t = await open(browser, { documents: [DOC], path: '/tools/showsheet/?listing=100-example-st-4a&rebuild=1' });
  p = t.page;
  check('rebuild: stale in the bar', (await text(p, '#jobBar')).includes('Stale: price, building features'), true);
  check('rebuild: banner lists the price', (await text(p, '#jobBanner')).includes('Price $4,750,000 → $4,500,000'), true);
  check('rebuild: building redone, said so', [(await text(p, '#jobBanner')).includes('Building features changed on the job; The Building was redone from it'), (await st(p)).building.service], [true, 'Full-time doorman']);
  check('rebuild: the sheet\'s own wording kept elsewhere', [(await st(p)).residence.features, (await st(p)).textScale.residence], [['Mine'], 120]);
  await t.ctx.close();

  // the job moved elsewhere (agents only, nothing the sheet edits) after the sheet opened: no PDF, no record (review I3)
  t = await open(browser, {});
  const jp = t.T.properties.find(x => x.id === 'p1');
  jp.core = Object.assign({}, jp.core, { agentIds: ['someone-else'] });
  jp.version += 1;
  await savePdf(t);
  check('moved elsewhere: no PDF, no record, told to reload', [t.helper.length, t.pieces.length, (await text(t.page, '#jobMsg')).includes('Reload the page')], [0, 0, true]);
  await t.ctx.close();
  // the sheet's own fact save moves the version too: that alone never stops it
  t = await open(browser, {});
  await t.page.evaluate(() => { window.__test.state.price = '$4,200,000'; });
  await savePdf(t);
  check('own save then PDF: goes through', [t.saves.length, t.helper.length, t.pieces.length], [1, 1, 1]);
  await t.ctx.close();

  // the record landed but its reply was lost: the retry finds it and doesn't record the file twice (review M4)
  t = await open(browser, { pieceLost: 1 });
  await savePdf(t);
  check('reply lost: recorded once, said saved', [t.pieces.length, (await text(t.page, '#jobMsg')).startsWith('Saved to Drive')], [1, true]);
  await t.ctx.close();

  // a saved draft (never built) opens with its own wording when the job's lists haven't moved (review I1)
  const DRAFT = { property_id: 'p1', tool: 'showsheet', version: 3, built_from: null,
    state: { building: { amenities: ['Roof deck'] }, residence: { features: ['Mine'] }, listsFrom: savedLists } };
  t = await open(browser, { documents: [DRAFT], path: '/tools/showsheet/?listing=100-example-st-4a' });
  check('draft: its own wording kept on reopen', [(await st(t.page)).building.amenities, (await st(t.page)).residence.features], [['Roof deck'], ['Mine']]);
  await t.ctx.close();

  // the standard Unbranded/ plan replaces a saved hand-made one: the old crop belonged to the old picture
  const CROPPED = { property_id: 'p1', tool: 'showsheet', version: 3, built_from: null,
    state: { floorplanFrom: { version: 2, render: 'branded', path: 'Floorplan/v2/x v2.jpg', modified: '2026-10-09T10:00:00.000Z' },
      floorplanView: { zoom: 1.6, x: 30, y: 70 }, floorplan2View: { zoom: 2, x: 10, y: 90 } } };
  t = await open(browser, { documents: [JSON.parse(JSON.stringify(CROPPED))], drive: { plans: 'standard' } });
  await t.page.waitForTimeout(400);
  check('a new plan: the standard Unbranded SVG is picked', ((await t.page.evaluate(() => window.GVC_SHEETMODE.floorplan)) || {}).path, 'Floorplan/Unbranded/x v3.svg');
  check('a new plan: the SVG is drawn onto the sheet', /^data:image\/jpeg/.test((await st(t.page)).floorplan || ''), true);
  check('a new plan resets the saved floorplan crop', [(await st(t.page)).floorplanView, (await st(t.page)).floorplan2View], [{ zoom: 1, x: 50, y: 50 }, { zoom: 1, x: 50, y: 50 }]);
  check('a new plan: Design files never read', (await t.page.evaluate(() => window.__driveLog.read)).some(x => /Design/.test(x)), false);
  check('a new plan: the sheet draws the plan uncropped', await t.page.$$eval('.fp-wrap', els => els.length > 0 && els.every(e => !e.classList.contains('is-zoomed'))), true);
  await t.page.click('#btnSaveSheet');
  await t.page.waitForTimeout(600);
  const resetSaved = (t.pieces[0] || {}).p_state || {};
  check('a new plan: the next save keeps the reset crop and the new plan', [resetSaved.floorplanView, resetSaved.floorplan2View, (resetSaved.floorplanFrom || {}).path],
    [{ zoom: 1, x: 50, y: 50 }, { zoom: 1, x: 50, y: 50 }, 'Floorplan/Unbranded/x v3.svg']);
  await t.ctx.close();
  // only Design/ files: the plain no-floorplan note, never "No floorplan image in Floorplan\Design\"
  t = await open(browser, { drive: { plans: 'design' } });
  check('only Design/ files: says there is no floorplan yet', await text(t.page, '#jobPlanMsg'), 'No floorplan in the job\'s folder yet. Drop one here for this sheet, or leave it blank.');
  await t.ctx.close();
  t = await open(browser, { documents: [JSON.parse(JSON.stringify(CROPPED))], drive: { plans: 'old' } });
  await t.page.waitForTimeout(400);
  check('the same plan as saved: the crop is kept', [(await st(t.page)).floorplanView, (await st(t.page)).floorplan2View], [{ zoom: 1.6, x: 30, y: 70 }, { zoom: 2, x: 10, y: 90 }]);
  await t.ctx.close();

  console.log('\n  ' + pass + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''));
  if (failures.length) { console.log('\n  ' + failures.join('\n\n  ') + '\n'); process.exit(1); }
  console.log();
  await browser.close();
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
