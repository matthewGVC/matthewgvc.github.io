/* ============================================================
   Browser tests for the /workspace/ pages, with Supabase and the desktop
   helper mocked by request interception (made-up rows; nothing real).

     BASE=http://localhost:8080 node scripts/test-workspace.js
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

const iso = d => new Date(d).toISOString();
const NOW = Date.now();
function rowsFor(over) {
  const T = {
    properties: [
      { id: 'p1', slug: '100-example-st-residence-4a', label: 'x', kind: 'sale', market: 'NYC', stage: 'In contract', stage_source: 'DE', version: 3,
        core: { address: '100 EXAMPLE ST', unit: '4A', neighborhood: 'Testville' }, de: { status: 'ActiveUnderContract', price: 4500000, beds: 4, baths: 4 },
        de_listing_id: '9001', drive_folder: 'GVC - New York/Building Information/100 Example St/4A', folder_state: 'linked',
        scan: { weeks: { [iso(NOW - 20 * 864e5).slice(0, 10)]: 12 }, found: { floorplan: iso(NOW - 30 * 864e5).slice(0, 10) } } },
      { id: 'p2', slug: '20-sample-ave-7b', label: 'y', kind: 'rental', market: 'NYC', stage: 'Live', stage_source: 'DE', version: 1,
        core: { address: '20 Sample Ave', unit: '7B', price: 5000 }, de_listing_id: '9002', folder_state: 'unlinked' },
      { id: 'p3', slug: '12-sample-lane', label: 'z', kind: 'sale', market: 'NJ', stage: 'Live', stage_source: 'seed', version: 1,
        core: { address: '12 Sample Lane' }, folder_state: 'broken', drive_folder: 'GVC - New Jersey/x' },
      { id: 'p4', slug: 'evil', label: 'e', kind: 'sale', market: 'FL', stage: 'Won', stage_source: 'seed', version: 1,
        core: { address: '<img src=x onerror="window.__xss=1">' }, folder_state: 'linked', drive_folder: 'q' }
    ],
    pitches: [{ id: 'q1', slug: '90-pitch-st-11b-2026-08-04', label: '90 Pitch St 11B', market: 'NYC', pitched_on: '2026-08-04', outcome: 'open', folder_state: 'linked', drive_folder: 'z' }],
    dev_projects: [{ id: 'd1', slug: '619-example-ave', label: '619 Example Ave', market: 'NJ', milestones: {}, folder_state: 'linked', drive_folder: 'v' }],
    changes: [
      { id: 'c1', property_id: 'p1', at: iso(NOW - 40 * 864e5), field: 'stage', new_value: 'Live', source: 'DE' },
      { id: 'c2', property_id: 'p1', at: iso(NOW - 5 * 864e5), field: 'stage', old_value: 'Live', new_value: 'In contract', source: 'DE' },
      { id: 'c3', property_id: 'p1', at: iso(NOW - 2 * 864e5), field: 'price', old_value: 4750000, new_value: 4500000, source: 'DE' }
    ],
    sync_runs: [{ kind: 'de', started_at: iso(NOW - 3 * 3600e3), ok: true }],
    todos: [{ id: 't1', section: 'Up next', body: 'Florida office signage', done: false, position: 1 },
      { id: 't2', section: 'Waiting on others', body: 'Real headshot for an agent\nOnly a small temporary photo', done: false, position: 2 }]
  };
  return Object.assign(T, over || {});
}

async function open(browser, opts) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  if (opts.signedIn !== false) {
    await page.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  }
  if (!opts.drive) await page.addInitScript(() => { delete window.showDirectoryPicker; });
  const T = opts.rows || rowsFor();
  await page.route('**/rest/v1/**', r => {
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), m = r.request().method();
    if (table === 'members') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }]) });
    const eqs = [...u.searchParams].filter(([, v]) => /^eq\./.test(v)).map(([k, v]) => [k, v.slice(3)]);
    const hit = row => eqs.every(([k, v]) => String(row[k]) === v);
    if (m === 'PATCH') {
      writes.push(m + ' ' + table + ' ' + u.search + ' ' + (r.request().postData() || ''));
      const rows = opts.conflict ? [] : (T[table] || []).filter(hit);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (m === 'POST' && table === 'changes' && opts.changeFails) { writes.push('POST changes (refused)'); return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'connection lost' }) }); }
    if (m !== 'GET') { writes.push(m + ' ' + table + ' ' + (r.request().postData() || '')); return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    if (eqs.length) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify((T[table] || []).filter(hit)) });
    if (opts.missing && opts.missing.indexOf(table) !== -1) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'relation "public.' + table + '" does not exist' }) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(T[table] || []) });
  });
  await page.route('**/auth/v1/user', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', email: 'matt@example.com' }) }));
  await page.route('http://localhost:47610/**', r => opts.helper === false ? r.abort() :
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, version: '0.1.0', paired: true }) }));
  await page.goto(BASE + (opts.path || '/workspace/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { page, errors, writes, ctx };
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const visible = (page, sel) => page.isVisible(sel).catch(() => false);

(async () => {
  const browser = await chromium.launch();

  /* signed out: sign-in only, nothing else */
  let t = await open(browser, { signedIn: false });
  check('signed out: gate shown', [await visible(t.page, '#gate'), await visible(t.page, '#board')], [true, false]);
  await t.page.click('#gateBtn');
  check('signed out: sign-in dialog', await visible(t.page, 'dialog.gvc-signin'), true);
  await t.ctx.close();

  /* the board */
  t = await open(browser, {});
  const p = t.page;
  check('no page errors', t.errors, []);
  check('stats', await p.$$eval('#stats .v', els => els.map(e => e.firstChild.textContent.trim())), ['2', '1', '2']);
  check('job rows', await p.$$eval('.pj h3', els => els.length), 6);
  check('readable name', (await p.$$eval('.pj h3', els => els.map(e => e.childNodes[0].textContent.trim()))).includes('100 Example St 4A'), true);
  check('job links per job', await p.$eval('a.pj[href*="100-example"]', a => a.getAttribute('href')), 'job/?listing=100-example-st-residence-4a');
  check('hostile text shown as text', [await p.evaluate(() => window.__xss || null), (await p.$$eval('.pj h3', els => els.map(e => e.textContent))).some(s => s.includes('<img'))], [null, true]);
  check('recent: newest first', (await text(p, '#recent')).includes('Price $4,750,000 → $4,500,000'), true);
  check('tasks: flags and own items', [(await text(p, '#tlist')).includes('20 Sample Ave 7B: Link the Drive folder'), (await text(p, '#tlist')).includes('Florida office signage')], [true, true]);
  check('no won-or-lost task', /won or lost/i.test(await text(p, '#tlist')), false);
  check('waiting on others', (await text(p, '#wait')).includes('Real headshot for an agent'), true);
  check('sync card ok', [await p.$eval('#deCard', e => e.className), (await text(p, '#deTitle'))], ['card health', 'DE sync ran']);
  check('read-only banner without Drive', [(await text(p, '.banner')).includes('Read-only here'), await text(p, '#wsDrive')], [true, 'Read-only here']);
  check('avatar initials', await text(p, '#wsMe'), 'MB');

  /* filters */
  await p.click('#mkt button[data-v="NJ"]');
  check('market filter', await p.$$eval('.pj h3', els => els.length), 2);
  await p.click('#mkt button[data-v=""]'); await p.click('#typ button[data-v="pitch"]');
  check('type filter', await p.$$eval('.pj h3', els => els.map(e => e.childNodes[0].textContent.trim())), ['90 Pitch St 11B']);
  await p.click('#typ button[data-v=""]'); await p.fill('#wsSearch', 'sample');
  check('search', await p.$$eval('.pj h3', els => els.length), 2);
  await p.fill('#wsSearch', '');
  await p.click('#view button[data-v="time"]');
  check('timeline rows and bars', [await p.$$eval('.tl-row', els => els.length), await p.$$eval('.tl-row .bar', els => els.length) > 0], [6, true]);

  /* tasks write to todos */
  await p.click('#view button[data-v="list"]');
  await p.fill('#newTask', 'Call the printer');
  await p.click('#addBtn');
  await p.waitForTimeout(300);
  check('add task posts', t.writes.some(w => /^POST todos .*Call the printer/.test(w)), true);
  await p.click('#tlist [data-done="t1"]');
  await p.waitForTimeout(300);
  check('tick task patches', t.writes.some(w => /^PATCH todos .*"done":true/.test(w)), true);
  await t.ctx.close();

  /* sync status colours */
  t = await open(browser, { rows: rowsFor({ sync_runs: [{ kind: 'de', started_at: iso(NOW - 40 * 3600e3), ok: true }] }) });
  check('36 h: amber', [await t.page.$eval('#deCard', e => e.className), (await text(t.page, '#deText')).includes('Is the PC on?')], ['card health amber', true]);
  await t.ctx.close();
  t = await open(browser, { rows: rowsFor({ sync_runs: [{ kind: 'de', started_at: iso(NOW - 3600e3), ok: false, errors: [{ what: 'aborted', detail: 'DE showed 9 live listings against 44 last time, so nothing was changed.' }] }] }) });
  check('failed: red with the reason', [await t.page.$eval('#deCard', e => e.className), (await text(t.page, '#deWhy')).includes('9 live listings')], ['card health red', true]);
  await t.ctx.close();
  t = await open(browser, { rows: rowsFor({ sync_runs: [] }) });
  check('never synced', await text(t.page, '#deTitle'), 'DE hasn\'t synced yet');
  await t.ctx.close();

  /* helper off: Sync greyed with the reason */
  t = await open(browser, { helper: false });
  check('helper off', [await t.page.$eval('#wsSync', b => b.disabled), (await t.page.$eval('#wsSync', b => b.title)).includes('isn\'t running')], [true, true]);
  check('helper off: the DE card\'s Sync is greyed too', await t.page.$eval('#deBtn', b => b.disabled), true);
  await t.ctx.close();

  /* before the migrations; and an empty database */
  t = await open(browser, { missing: ['pitches'] });
  check('tables missing: plain message', (await text(t.page, '#gate')).includes('aren\'t set up yet'), true);
  await t.ctx.close();
  t = await open(browser, { rows: rowsFor({ properties: [], pitches: [], dev_projects: [], changes: [], todos: [] }) });
  check('empty database', [(await text(t.page, '#jobs')).includes('ready but empty'), await p.evaluate(() => 1).catch(() => 1), t.errors], [true, 1, []]);
  check('empty: zeros, no NaN', (await text(t.page, '#stats')).includes('NaN'), false);
  check('empty: recent changes says so', (await text(t.page, '#recent')).includes('No changes yet'), true);
  // the account menu works from the keyboard
  await t.page.click('#wsMe');
  const opened = [await visible(t.page, '#wsMenu'), await t.page.$eval('#wsMe', b => b.getAttribute('aria-expanded'))];
  await t.page.keyboard.press('Escape');
  check('account menu: opens, Escape closes', [opened, await visible(t.page, '#wsMenu'), await t.page.$eval('#wsMe', b => b.getAttribute('aria-expanded'))], [[true, 'true'], false, 'false']);
  await t.page.click('#wsMe'); await t.page.mouse.click(5, 400);
  check('account menu: a click elsewhere closes it', await visible(t.page, '#wsMenu'), false);
  await t.ctx.close();

  /* phone width */
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pp = await phone.newPage();
  await pp.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  const T0 = rowsFor();
  await pp.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(T0[new URL(r.request().url()).pathname.split('/').pop()] || []) }));
  await pp.route('**/auth/v1/user', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"u1","email":"m@x"}' }));
  await pp.goto(BASE + '/workspace/', { waitUntil: 'networkidle' });
  check('phone: no sideways scroll', await pp.evaluate(() => document.documentElement.scrollWidth <= 376), true);
  await pp.goto(BASE + '/workspace/jobs/', { waitUntil: 'networkidle' });
  check('phone: jobs boxes stack', await pp.evaluate(() => { const g = document.getElementById('n2').closest('.grid3'); return getComputedStyle(g).gridTemplateColumns.split(' ').length; }), 1);
  await phone.close();

  /* ---------- the jobs list ---------- */
  t = await open(browser, { path: '/workspace/jobs/' });
  check('jobs: rows', await t.page.$$eval('#rows tr', els => els.length), 6);
  check('jobs: link to the job page', await t.page.$eval('#rows a[href*="100-example"]', a => a.getAttribute('href')), '../job/?listing=100-example-st-residence-4a');
  check('jobs: DE status in words', (await text(t.page, '#rows')).includes('Contract signed'), true);
  await t.page.click('#typ button[data-v="pitch"]');
  check('jobs: type filter', await t.page.$$eval('#rows tr', els => els.length), 1);
  check('jobs: to link box', (await text(t.page, '#n2')).includes('20 Sample Ave 7B'), true);
  await t.page.focus('#typ button[data-v="development"]'); await t.page.keyboard.press('Enter');
  check('jobs: keyboard focus stays on the Type button', await t.page.evaluate(() => [document.activeElement.dataset.v, document.activeElement.getAttribute('aria-pressed'), document.querySelector('#typ button[data-v="pitch"]').getAttribute('aria-pressed')]), ['development', 'true', 'false']);
  check('jobs: no page errors', t.errors, []);
  await t.ctx.close();

  /* ---------- one job ---------- */
  const R = rowsFor();
  R.properties[0].core.listingUrl = 'https://www.elliman.com/listing/x/9001';
  R.properties[0].core.agentIds = ['elyse-gutman'];
  R.properties[2].core.listingUrl = 'javascript:alert(1)';
  t = await open(browser, { rows: R, path: '/workspace/job/?listing=100-example-st-residence-4a' });
  let jp = t.page;
  check('job: its own name', (await text(jp, 'h1')).startsWith('100 Example St 4A'), true);
  check('job: facts from DE', (await text(jp, '.facts')).includes('$4,500,000'), true);
  check('job: agent from the roster', (await text(jp, '.facts')).includes('Elyse Gutman'), true);
  check('job: current stage', await text(jp, '.step.cur'), '8In contract' + (await jp.$eval('.step.cur .d', e => e.textContent)));
  check('job: DE status in words', (await text(jp, '.facts')).includes('Contract signed'), true);
  check('job: skipped stages dashed', await jp.$$eval('.step.skip', els => els.map(e => e.childNodes[1].textContent.trim())), ['Pitch', 'Won', 'Showsheet', 'Photos', 'Brochure']);
  check('job: footer shows the sync', (await text(jp, '#wsFootSync')).startsWith('DE synced'), true);
  check('job: change log', await jp.$$eval('.log li', els => els.length), 3);
  check('job: DE listing link', await jp.$eval('a.b[href^="https://www.elliman.com"]', a => a.target), '_blank');
  check('job: folder path shown', (await text(jp, '.path')).includes('G:\\Shared drives\\GVC - New York\\Building Information\\100 Example St\\4A'), true);
  await jp.route('http://localhost:47610/open-folder', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }));
  await jp.click('#open');
  await jp.waitForTimeout(200);
  check('job: open folder through the helper', await text(jp, '#actMsg'), 'Opened in File Explorer.');
  check('job: no page errors', t.errors, []);
  await t.ctx.close();

  t = await open(browser, { rows: R, path: '/workspace/job/?listing=12-sample-lane' });
  check('job: unsafe link never rendered', await t.page.$$eval('a[href^="javascript"]', els => els.length), 0);
  check('job: broken folder flagged', [(await text(t.page, '#link')).includes('Relink'), (await text(t.page, '.path')).includes('moved or renamed')], [true, true]);
  await t.ctx.close();

  t = await open(browser, { path: '/workspace/job/?listing=nobody-lives-here' });
  check('job: unknown address', (await text(t.page, '#page')).includes('No job called "nobody-lives-here"'), true);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/job/?pitch=90-pitch-st-11b-2026-08-04' });
  check('pitch page', [(await text(t.page, 'h1')).startsWith('90 Pitch St 11B'), (await text(t.page, '.facts')).includes('Open')], [true, true]);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/job/?dev=619-example-ave' });
  check('development page', await t.page.$$eval('.log li', els => els.length), 10);
  await t.ctx.close();

  /* ---------- linking a folder ---------- */
  const FAKE = `window.__fakeDrive = {
    state: async () => 'connected',
    list: async p => ({ 'GVC - New York/Building Information': [{ name: '20 Sample Ave', kind: 'directory' }, { name: '21 Other St', kind: 'directory' }],
      'GVC - New York/Building Information/20 Sample Ave': [{ name: '7B', kind: 'directory' }, { name: '8C', kind: 'directory' }] })[p] || [],
    relPathOf: async () => null };`;
  t = await open(browser, { path: '/workspace/job/?listing=20-sample-ave-7b' });
  jp = t.page;
  await jp.click('#link');
  check('link: needs Drive here', (await text(jp, 'dialog.gvc-link')).includes('Connect Drive'), true);
  await jp.click('#lkCancel');
  await jp.evaluate(FAKE + 'window.GVC_DRIVE = window.__fakeDrive;');
  await jp.click('#link');
  await jp.waitForSelector('dialog.gvc-link button[data-i]');
  check('link: suggestion for the unit first', await jp.$eval('dialog.gvc-link button[data-i="0"]', b => b.textContent), 'GVC - New York/Building Information/20 Sample Ave/7B');
  await jp.click('dialog.gvc-link button[data-i="0"]');
  await jp.waitForTimeout(400);
  const patch = t.writes.find(w => /^PATCH properties/.test(w)) || '';
  check('link: saved with the version check', [/id=eq\.p2/.test(patch), /version=eq\.1/.test(patch), /"folder_state":"linked"/.test(patch)], [true, true, true]);
  check('link: logged in the change log', t.writes.some(w => /^POST changes .*"field":"drive_folder".*"source":"Matt"/.test(w)), true);
  check('link: dialog closed', await visible(jp, 'dialog.gvc-link'), false);
  await t.ctx.close();

  t = await open(browser, { path: '/workspace/job/?listing=20-sample-ave-7b', conflict: true });
  await t.page.evaluate(FAKE + 'window.GVC_DRIVE = window.__fakeDrive;');
  await t.page.click('#link');
  await t.page.waitForSelector('dialog.gvc-link button[data-i]');
  await t.page.click('dialog.gvc-link button[data-i="0"]');
  await t.page.waitForTimeout(400);
  check('link: conflict refused, not overwritten', [(await text(t.page, '#lkMsg')).includes('Someone changed this job'), t.writes.some(w => /^POST changes/.test(w))], [true, false]);
  await t.ctx.close();

  // the folder saves but the change log doesn't: say so, don't invite a retry that can only conflict
  t = await open(browser, { path: '/workspace/job/?listing=20-sample-ave-7b', changeFails: true });
  await t.page.evaluate(FAKE + 'window.GVC_DRIVE = window.__fakeDrive;');
  await t.page.click('#link');
  await t.page.waitForSelector('dialog.gvc-link button[data-i]');
  await t.page.dblclick('dialog.gvc-link button[data-i="0"]');
  await t.page.waitForTimeout(400);
  check('link: one save for a double click', t.writes.filter(w => /^PATCH properties/.test(w)).length, 1);
  const half = await text(t.page, '#lkMsg');
  check('link: half-saved says Linked, with the reason', [/^Linked/.test(half), /change log/.test(half), /Someone changed/.test(half)], [true, true, false]);
  check('link: half-saved offers Close, not Browse', [await text(t.page, '#lkCancel'), await t.page.$eval('#lkBrowse', b => b.disabled)], ['Close', true]);
  await t.page.click('#lkCancel');
  await t.page.waitForTimeout(300);
  check('link: Close after a half save reloads the job', [await visible(t.page, 'dialog.gvc-link'), t.errors], [false, []]);
  await t.ctx.close();

  await browser.close();
  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
