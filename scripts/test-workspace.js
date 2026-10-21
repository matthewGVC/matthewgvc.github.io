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
        scan: { weeks: { [iso(NOW - 20 * 864e5).slice(0, 10)]: 12 }, found: { floorplan: iso(NOW - 30 * 864e5).slice(0, 10) } },
        asana_gid: '1201', asana: { gid: '1201', permalink: 'https://app.asana.com/0/1/1201', status: 'In Contract', section: 'In Contract', stageFromStatus: 'In contract',
          checklist: [{ block: 'prep', steps: [{ name: 'Create Show Sheet', done: true, doneOn: iso(NOW - 30 * 864e5).slice(0, 10) }, { name: 'Brand floor plan', done: false }] },
            { block: 'contract', steps: [{ name: 'Deal sheet', done: false }] }] },
        milestones: { listedOn: { on: iso(NOW - 40 * 864e5).slice(0, 10), planned: false }, closedOn: { on: iso(NOW + 30 * 864e5).slice(0, 10), planned: true } },
        match: { list: [
          { code: 'M3', key: 'M3', text: 'Asana says $4,750,000; DE says $4,500,000.', values: { asana: 4750000, de: 4500000 }, fixAt: 'Asana', who: ['Elyse Gutman'], since: '2026-10-13' },
          { code: 'M7', key: 'M7:drive', text: 'Asana\'s Drive Link is empty; paste https://drive.google.com/drive/folders/abc', values: { field: 'Drive Link', paste: 'https://drive.google.com/drive/folders/abc' }, fixAt: 'Asana', who: [], since: '2026-10-14' },
          { code: 'M5', key: 'M5:closedOn', text: 'Asana and DE differ on the closing date.', values: { asana: 'a', de: 'b' }, fixAt: 'DE', who: ['Elyse Gutman'], since: '2026-10-15' }], dismissed: {} } },
      { id: 'p2', slug: '20-sample-ave-7b', label: 'y', kind: 'rental', market: 'NYC', stage: 'Live', stage_source: 'DE', version: 1,
        core: { address: '20 Sample Ave', unit: '7B', price: 5000 }, de_listing_id: '9002', folder_state: 'unlinked' },
      { id: 'p3', slug: '12-sample-lane', label: 'z', kind: 'sale', market: 'NJ', stage: 'Live', stage_source: 'seed', version: 1,
        core: { address: '12 Sample Lane' }, folder_state: 'broken', drive_folder: 'GVC - New Jersey/x' },
      { id: 'p4', slug: 'evil', label: 'e', kind: 'sale', market: 'FL', stage: 'Prep', stage_source: 'seed', version: 1,
        core: { address: '<img src=x onerror="window.__xss=1">' }, folder_state: 'linked', drive_folder: 'q' }
    ],
    pitches: [{ id: 'q1', slug: '90-pitch-st-11b-2026-08-04', label: '90 Pitch St 11B', market: 'NYC', pitched_on: '2026-08-04', outcome: 'open', folder_state: 'linked', drive_folder: 'z' }],
    dev_projects: [{ id: 'd1', slug: '619-example-ave', label: '619 Example Ave', market: 'NJ', milestones: { agreement: { done: true, on: '2026-01-10' } }, folder_state: 'linked', drive_folder: 'v', version: 2,
      asana_project_gid: '1300', asana_map: {},
      milestone_hints: [{ key: 'renders', date: '2026-05-21', approx: false, rule: 'tick', source: 'Asana: Renders delivered', asanaGid: '777' },
        { key: 'finishes', date: '2026-06-02', approx: true, rule: 'late', source: 'Asana: Finishes selected', asanaGid: '778' }],
      next_milestone: { key: 'permits', name: 'Permits filed', dueOn: iso(NOW + 12 * 864e5).slice(0, 10), slips: { g1: { count: 2, days: 9 } }, construction: { done: 3, total: 12 }, early: [] },
      match: { list: [{ code: 'M12', key: 'M12:g7', text: 'Permits is 20 days past due in Asana.', values: { due: '2026-09-30' }, fixAt: 'Asana', who: ['Pat Builder'], since: '2026-10-14' }], dismissed: {} } }],
    changes: [
      { id: 'c1', property_id: 'p1', at: iso(NOW - 40 * 864e5), field: 'stage', new_value: 'Live', source: 'DE' },
      { id: 'c2', property_id: 'p1', at: iso(NOW - 5 * 864e5), field: 'stage', old_value: 'Live', new_value: 'In contract', source: 'DE' },
      { id: 'c3', property_id: 'p1', at: iso(NOW - 2 * 864e5), field: 'price', old_value: 4750000, new_value: 4500000, source: 'DE' }
    ],
    sync_runs: [{ kind: 'de', started_at: iso(NOW - 3 * 3600e3), ok: true }, { kind: 'asana', started_at: iso(NOW - 3600e3), ok: true }],
    asana_people: [{ gid: 'a1', name: 'Eve Newcomer', section: 'Partners', title: 'Licensed Salesperson', past: false, seen_at: iso(NOW - 3600e3) },
      { gid: 'a0', name: 'Old Person', section: 'Partners', title: 'Licensed Salesperson', past: false, seen_at: iso(NOW - 9 * 864e5) }],
    todos: [{ id: 't1', section: 'Up next', body: 'Florida office signage', done: false, position: 1 },
      { id: 't2', section: 'Waiting on others', body: 'Real headshot for an agent\nOnly a small temporary photo', done: false, position: 2 }]
  };
  return Object.assign(T, over || {});
}

async function open(browser, opts) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [], writes = [], reads = [];
  page.on('pageerror', e => errors.push(e.message));
  if (opts.signedIn !== false) {
    await page.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  }
  if (!opts.drive) await page.addInitScript(() => { delete window.showDirectoryPicker; });
  const T = opts.rows || rowsFor();
  await page.route('**/rest/v1/**', r => {
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), m = r.request().method();
    reads.push(m + ' ' + table);
    if (table === 'members' && opts.membersFail) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'could not read' }) });
    if (table === 'members') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.members || [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }]) });
    const eqs = [...u.searchParams].filter(([, v]) => /^eq\./.test(v)).map(([k, v]) => [k, v.slice(3)]);
    const hit = row => eqs.every(([k, v]) => String(row[k]) === v);
    if (m === 'PATCH') {
      writes.push(m + ' ' + table + ' ' + u.search + ' ' + (r.request().postData() || ''));
      const rows = opts.conflict ? [] : (T[table] || []).filter(hit);
      if (opts.slowPatch) return new Promise(res => setTimeout(res, 800)).then(() => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (m === 'POST' && table === 'changes' && opts.changeFails) { writes.push('POST changes (refused)'); return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'connection lost' }) }); }
    if (m !== 'GET') { writes.push(m + ' ' + table + ' ' + (r.request().postData() || '')); return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    if (eqs.length) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify((T[table] || []).filter(hit)) });
    if (opts.missing && opts.missing.indexOf(table) !== -1) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'relation "public.' + table + '" does not exist' }) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(T[table] || []) });
  });
  await page.route('**/auth/v1/user', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', email: 'matt@example.com' }) }));
  const helperCalls = [];
  await page.route('http://localhost:47610/**', r => {
    helperCalls.push(r.request().method() + ' ' + new URL(r.request().url()).pathname);
    if (opts.helper === false) return r.abort();
    const body = new URL(r.request().url()).pathname === '/sync' && opts.syncResult ? opts.syncResult : { ok: true, version: '0.1.0', paired: true };
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  await page.goto(BASE + (opts.path || '/workspace/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { page, errors, writes, reads, helperCalls, ctx };
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const visible = (page, sel) => page.isVisible(sel).catch(() => false);

(async () => {
  const browser = await chromium.launch();

  /* signed out: sign-in only, nothing else */
  let t = await open(browser, { signedIn: false });
  check('signed out: gate shown', [await visible(t.page, '#gate'), await visible(t.page, '#board')], [true, false]);
  check('signed out: footer says why there is no sync status', await text(t.page, '#wsFootSync'), 'Sign in to see the DE sync');
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
  {
    const tt = await open(browser, { members: [{ name: 'Team (shared)', initials: 'GVC', role: 'shared' }] });
    const tl = (await text(tt.page, '#tlist')) || '';
    check('team sign-in: workspace flags only, no personal tasks', [tl.includes('20 Sample Ave 7B: Link the Drive folder'), tl.includes('Florida office signage'),
      await visible(tt.page, '#addTask'), await visible(tt.page, '#waitCard')], [true, false, false, false]);
    await tt.ctx.close();
  }
  check('waiting on others', (await text(p, '#wait')).includes('Real headshot for an agent'), true);
  check('sync card ok', [await p.$eval('#deCard', e => e.className), (await text(p, '#deTitle'))], ['card health', 'DE sync ran']);
  check('read-only banner without Drive', [(await text(p, '.banner')).includes('Read-only here'), await text(p, '#wsDrive')], [true, 'Read-only here']);
  check('avatar initials', await text(p, '#wsMe'), 'MB');
  check('nav: Overview, Jobs, Match, Status', await p.$$eval('.nav a', els => els.map(e => e.textContent)), ['Overview', 'Jobs', 'Match', 'Status']);
  check('footer: links to the rest of the site', await p.$$eval('.foot .foot-links a', els => els.map(e => [e.textContent, e.getAttribute('href')])),
    [['Team tools', './../#tools'], ['Listing rules', './../listing-rules/'], ['Tasks', './#tasks']]);
  check('Asana card ok', [await p.$eval('#asCard', e => e.className), (await text(p, '#asText')).startsWith('Asana last synced')], ['card health', true]);
  check('footer: Asana beside DE', (await text(p, '#wsFootAsana')).startsWith('Asana last synced'), true);
  check('deal-date markers, planned hollow', [await p.$$eval('a.pj[href*="100-example"] .dmk', els => els.length), await p.$$eval('a.pj[href*="100-example"] .dmk.planned', els => els.length)], [2, 1]);
  check('mismatch count on the row', (await text(p, 'a.pj[href*="100-example"] .r')).includes('3 mismatches'), true);
  check('mismatch total in the header', [await text(p, '#mmTotal'), await p.$eval('#mmTotal', a => a.getAttribute('href'))], ['4 mismatches', 'match/']);
  check('development row: next, slips, construction, hints', [(await text(p, 'a.pj[href*="619"]')).includes('Next: Permits / zoning'), (await text(p, 'a.pj[href*="619"]')).includes('re-dated 2 times'),
    await p.$$eval('a.pj[href*="619"] .cons', els => els.length), (await text(p, 'a.pj[href*="619"]')).includes('2 milestones suggested from Asana')], [true, true, 1, true]);

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

  t = await open(browser, { rows: rowsFor({ sync_runs: [{ kind: 'de', started_at: iso(NOW - 3600e3), ok: true }, { kind: 'asana', started_at: iso(NOW - (6 * 3600e3 + 60e3)), ok: true }] }) });
  check('Asana 6 h 1 min: amber', [await t.page.$eval('#asCard', e => e.className), (await text(t.page, '#asText')).startsWith('Asana last synced')], ['card health amber', true]);
  await t.ctx.close();
  t = await open(browser, { rows: rowsFor({ sync_runs: [{ kind: 'de', started_at: iso(NOW - 3600e3), ok: true }, { kind: 'asana', started_at: iso(NOW - 3600e3), ok: false, errors: [{ what: 'token', detail: 'Asana refused the token' }] }] }) });
  check('Asana refused: red with the reason', [await t.page.$eval('#asCard', e => e.className), await text(t.page, '#asWhy')], ['card health red', 'Asana refused the token']);
  await t.ctx.close();
  t = await open(browser, { drive: true, syncResult: { ok: false, asana: { ok: false, error: 'No Asana token yet. Add asanaToken to the helper config.' }, de: { ok: true, changes: 2, created: 0, skipped: 0, aborted: null } } });
  let asked = null, answer = false;
  t.page.on('dialog', d => { asked = d.message(); return answer ? d.accept() : d.dismiss(); });
  await t.page.click('#wsSync');
  await t.page.waitForTimeout(300);
  check('Sync asks first; No runs nothing', [asked, t.helperCalls.includes('POST /sync')], ['This takes approx. 5 minutes, are you sure?', false]);
  answer = true;
  await t.page.click('#wsSync');
  await t.page.waitForTimeout(400);
  const st = await t.page.$eval('#wsSync', b => b.title);
  check('Sync now runs both through /sync', [t.helperCalls.includes('POST /sync'), t.helperCalls.includes('POST /de/sync')], [true, false]);
  check('Sync now reads each part', [st.includes('Asana didn\'t sync: No Asana token yet'), st.includes('DE: 2 changes'), /new job/.test(st)], [true, true, false]);
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
  const T0 = rowsFor({ members: [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }] });
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
  const firstName = () => t.page.$eval('#rows tr:first-child td.nm a', a => a.textContent);
  const sortState = () => t.page.$$eval('thead th[aria-sort]', ths => ths.map(th => th.querySelector('button').dataset.sort + ':' + th.getAttribute('aria-sort')));
  check('jobs: every column has a sort button', await t.page.$$eval('thead th button[data-sort]', bs => bs.length), 7);
  await t.page.click('thead th button[data-sort="price"]');
  const hi = await firstName();
  check('jobs: price sorts high to low first, arrow shown', [await sortState(), (await text(t.page, 'thead th[aria-sort] button')).includes('↓')], [['price:descending'], true]);
  await t.page.click('thead th button[data-sort="price"]');
  check('jobs: a second click flips it', [await sortState(), (await firstName()) !== hi], [['price:ascending'], true]);
  await t.page.click('thead th button[data-sort="name"]');
  const names = await t.page.$$eval('#rows tr td.nm a', as => as.map(a => a.textContent));
  check('jobs: name sorts A to Z', names, names.slice().sort((a, b) => a.localeCompare(b)));
  await t.page.click('#typ button[data-v="pitch"]');
  check('jobs: type filter', await t.page.$$eval('#rows tr', els => els.length), 1);
  check('jobs: to link box', (await text(t.page, '#n2')).includes('20 Sample Ave 7B'), true);
  await t.page.focus('#typ button[data-v="development"]'); await t.page.keyboard.press('Enter');
  check('jobs: keyboard focus stays on the Type button', await t.page.evaluate(() => [document.activeElement.dataset.v, document.activeElement.getAttribute('aria-pressed'), document.querySelector('#typ button[data-v="pitch"]').getAttribute('aria-pressed')]), ['development', 'true', 'false']);
  check('jobs: no page errors', t.errors, []);
  await t.ctx.close();

  /* ---------- the Match page ---------- */
  t = await open(browser, { path: '/workspace/match/' });
  let mp = t.page;
  check('match: no page errors', t.errors, []);
  check('match: groups by where to fix it, roster drift last', await mp.$$eval('.mg > .card-h h2', els => els.map(e => e.textContent.trim())), ['Asana', 'DE', 'Roster']);
  check('match: then by person', await mp.$$eval('.mg:first-of-type .who h3', els => els.map(e => e.textContent.trim())), ['Elyse Gutman', 'Pat Builder', 'No one named']);
  check('match: Open in Asana on each line', await mp.$eval('.mg:first-of-type .mline a.asana', a => [a.getAttribute('href'), a.target]), ['https://app.asana.com/0/1/1201', '_blank']);
  check('match: M7 shows the link to paste', await mp.$$eval('.mline .paste', els => els.map(e => e.textContent.trim())), ['https://drive.google.com/drive/folders/abc']);
  check('match: roster drift uses the latest People read only', [(await text(mp, '.mg:last-of-type')).includes('Eve Newcomer is in Asana'), (await text(mp, '.mg:last-of-type')).includes('Old Person')], [true, false]);
  check('match: total in the header', (await text(mp, '#lead')).startsWith('4 mismatches'), true);
  check('match: footer links resolve from a sub-page', await mp.$$eval('.foot .foot-links a', els => els.map(e => e.href.replace(location.origin, ''))),
    ['/#tools', '/listing-rules/', '/workspace/#tasks']);
  check('match: no Drive pill or read-only banner', [await visible(mp, '#wsDrive'), await visible(mp, '.banner')], [false, false]);
  await mp.click('.mline[data-key="M3"] [data-dismiss]');
  check('dismiss: asks for a reason', await visible(mp, '.mline[data-key="M3"] input.reason'), true);
  await mp.click('.mline[data-key="M3"] [data-confirm]');
  check('dismiss: refused without a reason', [(await text(mp, '.mline[data-key="M3"] .msg')).includes('reason'), t.writes.length], [true, 0]);
  await mp.fill('.mline[data-key="M3"] input.reason', 'Agent says Asana is right; DE updates Monday');
  await mp.click('.mline[data-key="M3"] [data-confirm]');
  await mp.waitForTimeout(400);
  const mpatch = t.writes.find(w => /^PATCH properties/.test(w)) || '';
  const mbody = JSON.parse(mpatch.slice(mpatch.indexOf('{')) || '{}');
  const dm = ((mbody.match || {}).dismissed || {}).M3 || {};
  check('dismiss: version-checked update', [/id=eq\.p1/.test(mpatch), /version=eq\.3/.test(mpatch)], [true, true]);
  check('dismiss: match.dismissed by key, with the values, reason and who', [dm.values, dm.reason, dm.by, !!dm.at, (mbody.match.list || []).length], [{ asana: 4750000, de: 4500000 }, 'Agent says Asana is right; DE updates Monday', 'Matt Bloomfield', true, 3]);
  check('dismiss: a changes row, source match', t.writes.some(w => /^POST changes .*"property_id":"p1".*"field":"match".*"source":"match"/.test(w) && /Agent says Asana is right/.test(w)), true);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/match/', conflict: true });
  await t.page.click('.mline[data-key="M3"] [data-dismiss]');
  await t.page.fill('.mline[data-key="M3"] input.reason', 'x');
  await t.page.click('.mline[data-key="M3"] [data-confirm]');
  await t.page.waitForTimeout(400);
  check('dismiss: conflict refused, nothing logged', [(await text(t.page, '.mline[data-key="M3"] .msg')).includes('Someone changed'), t.writes.some(w => /^POST changes/.test(w))], [true, false]);
  await t.ctx.close();
  /* lines with no job: GVC-listed on DE with no job, and tasks the last Asana sync couldn't link */
  t = await open(browser, { path: '/workspace/match/', rows: rowsFor({
    de_listings: [{ de_listing_id: '9101', gvc_listed: true, property_id: null, ignored: false, courtesy: 'Douglas Elliman: Test Agent', raw: { listingUrl: 'https://www.elliman.com/x/9101' }, checked_at: iso(NOW - 864e5) },
      { de_listing_id: '9103', gvc_listed: true, property_id: null, ignored: true }],
    sync_runs: [{ kind: 'asana', started_at: iso(NOW - 7200e3), ok: true, totals: { unlinked: [{ gid: '1499', name: '6 Old Pl', why: 'same address' }] } },
      { kind: 'asana', started_at: iso(NOW - 3600e3), ok: true, totals: { unlinked: [{ gid: '1500', name: '7 Lone Pl', why: 'no street number' }, { gid: '1501', name: '8 Ignored Pl', why: 'same address' }] } }],
    asana_tasks: [{ gid: '1501', ignored: true }] }) });
  mp = t.page;
  const asanaGroup = (await text(mp, '.mg:first-of-type')) || '';
  check('match: DE-only listing shows in the Asana group', [asanaGroup.includes('DE listing 9101'), asanaGroup.includes('On DE, not in Asana.'), asanaGroup.includes('9103')], [true, true, false]);
  check('match: Open on DE link', await mp.$eval('.mline[data-key="M2:de:9101"] a.de', a => a.getAttribute('href')).catch(() => null), 'https://www.elliman.com/x/9101');
  check('match: unlinked tasks from the latest run, ignored left out', [asanaGroup.includes('7 Lone Pl'), asanaGroup.includes('Asana task not linked'), asanaGroup.includes('8 Ignored Pl'), asanaGroup.includes('6 Old Pl')], [true, true, false, false]);
  check('match: they count in the header', (await text(mp, '#lead')).startsWith('6 mismatches'), true);
  check('match: no page errors with loose lines', t.errors, []);
  await t.ctx.close();
  /* Link by hand (tune-up A): a loose line can be linked to a job, or set aside */
  const handRows = over => {
    const R = rowsFor(Object.assign({
      de_listings: [{ de_listing_id: '9201', kind: 'sale', gvc_listed: true, property_id: null, ignored: false, courtesy: 'Douglas Elliman: Test Agent', raw: { street: '1006 PHEASANT LN', unit: '204', state: 'NJ' }, checked_at: iso(NOW - 864e5) },
        { de_listing_id: '9202', kind: 'rental', gvc_listed: true, property_id: null, ignored: false, raw: { street: '12 SAMPLE LN', state: 'NJ' }, checked_at: iso(NOW - 864e5) }],
      sync_runs: [{ kind: 'asana', started_at: iso(NOW - 3600e3), ok: true, totals: { unlinked: [{ gid: '1600', name: '52 E4 - 10', why: 'same address', market: 'NYC' }] } }],
      asana_tasks: [{ gid: '1600', ignored: false, property_id: null }] }, over));
    R.properties.push({ id: 'pw', slug: '1006-pheasant-ln-wall', label: 'w', kind: 'sale', market: 'NJ', stage: 'Live', stage_source: 'Asana', version: 2, core: { address: '1006 Pheasant Ln, Wall' }, folder_state: 'linked', drive_folder: 'w' },
      { id: 'pe', slug: '52-e4-10fl', label: 'e4', kind: 'sale', market: 'NYC', stage: 'Live', stage_source: 'Asana', version: 5, core: { address: '52 E4', unit: '10FL' }, folder_state: 'linked', drive_folder: 'e' });
    return R;
  };
  const pickerList = pg => pg.$$eval('dialog.gvc-mlink #mlList > *', els => els.map(e => e.tagName === 'P' ? '# ' + e.textContent.trim() : e.querySelector('span').textContent.trim()));
  t = await open(browser, { path: '/workspace/match/', rows: handRows() });
  mp = t.page;
  check('hand link: no page errors', t.errors, []);
  check('hand link: DE line offers Link to a job and Not ours', await mp.$$eval('.mline[data-key="M2:de:9201"] button[data-link], .mline[data-key="M2:de:9201"] button[data-aside]', els => els.map(e => e.textContent.trim())), ['Link to a job', 'Not ours']);
  check('hand link: Asana line offers Link to a job and Ignore', await mp.$$eval('.mline[data-key="link:1600"] button[data-link], .mline[data-key="link:1600"] button[data-aside]', els => els.map(e => e.textContent.trim())), ['Link to a job', 'Ignore']);
  check('hand link: a job\'s own mismatch has neither', await mp.$$eval('.mline[data-key="M3"] button[data-link], .mline[data-key="M3"] button[data-aside]', els => els.length), 0);
  check('hand link: the DE line shows its address', ((await text(mp, '.mline[data-key="M2:de:9201"]')) || '').includes('1006 Pheasant Ln 204 · DE listing 9201'), true);
  await mp.click('.mline[data-key="M2:de:9201"] button[data-link]').catch(() => {});
  check('picker: opens', await visible(mp, 'dialog.gvc-mlink'), true);
  check('picker: same street first, then the market\'s other jobs; no other market', await pickerList(mp).catch(() => null),
    ['# Same street', '1006 Pheasant Ln Wall', '# Other jobs in NJ', '12 Sample Lane']);
  await mp.fill('#mlSearch', 'sample').catch(() => {});
  check('picker: search', await mp.$$eval('dialog.gvc-mlink #mlList button span:first-child', els => els.map(e => e.textContent.trim())), ['12 Sample Lane']);
  await mp.click('#mlCancel').catch(() => {});
  check('picker: Cancel closes, nothing written', [await visible(mp, 'dialog.gvc-mlink'), t.writes], [false, []]);
  await mp.click('.mline[data-key="M2:de:9201"] button[data-link]').catch(() => {});
  const readsBefore = t.reads.length;
  await mp.click('dialog.gvc-mlink button[data-id="pw"]').catch(() => {});
  await mp.waitForTimeout(500);
  check('link DE: the job gets the DE id, versioned', t.writes.filter(w => /^PATCH properties/.test(w)), ['PATCH properties ?id=eq.pw&version=eq.2 {"de_listing_id":"9201"}']);
  check('link DE: the DE listing gets the job', t.writes.filter(w => /^PATCH de_listings/.test(w)), ['PATCH de_listings ?de_listing_id=eq.9201 {"property_id":"pw"}']);
  check('link DE: one change row, Linked to DE by hand, source Matt', t.writes.filter(w => /^POST changes/.test(w)).map(w => JSON.parse(w.slice(w.indexOf('{')))),
    [{ property_id: 'pw', field: 'de_listing_id', old_value: null, new_value: '9201', note: 'Linked to DE by hand', source: 'Matt' }]);
  check('link DE: the picker closes and the page reloads', [await visible(mp, 'dialog.gvc-mlink'), t.reads.length > readsBefore, t.errors], [false, true, []]);
  await t.ctx.close();

  t = await open(browser, { path: '/workspace/match/', rows: handRows() });
  mp = t.page;
  await mp.click('.mline[data-key="M2:de:9202"] button[data-link]').catch(() => {});
  await mp.click('dialog.gvc-mlink button[data-id="p3"]').catch(() => {});
  await mp.waitForTimeout(300);
  check('link DE: a rental DE listing and a sale job: refused in plain words, nothing written', [await text(mp, '#mlMsg'), t.writes],
    ['This DE listing is a rental and that job is a sale, so they can\'t be linked.', []]);
  await mp.click('#mlCancel').catch(() => {});
  await mp.click('.mline[data-key="link:1600"] button[data-link]').catch(() => {});
  check('link Asana: the job on the same street, in the task\'s market', await pickerList(mp).then(x => x.slice(0, 3)).catch(() => null),
    ['# Same street', '52 E4 10FL', '# Other jobs in NYC']);
  await mp.click('dialog.gvc-mlink button[data-id="pe"]').catch(() => {});
  await mp.waitForTimeout(500);
  check('link Asana: the job gets the gid, the task gets the job, one change row', [t.writes.filter(w => /^PATCH/.test(w)),
    t.writes.filter(w => /^POST changes/.test(w)).map(w => JSON.parse(w.slice(w.indexOf('{'))))],
    [['PATCH properties ?id=eq.pe&version=eq.5 {"asana_gid":"1600"}', 'PATCH asana_tasks ?gid=eq.1600 {"property_id":"pe"}'],
      [{ property_id: 'pe', field: 'asana_gid', old_value: null, new_value: '1600', note: 'Linked to Asana by hand', source: 'Matt' }]]);
  await t.ctx.close();

  t = await open(browser, { path: '/workspace/match/', rows: handRows() });
  mp = t.page;
  await mp.click('.mline[data-key="M2:de:9201"] button[data-aside]').catch(() => {});
  await mp.waitForTimeout(400);
  await mp.click('.mline[data-key="link:1600"] button[data-aside]').catch(() => {});
  await mp.waitForTimeout(400);
  check('not ours / ignore: ignored = true, no change row without an owner', t.writes,
    ['PATCH de_listings ?de_listing_id=eq.9201 {"ignored":true}', 'PATCH asana_tasks ?gid=eq.1600 {"ignored":true}']);
  check('not ours / ignore: no page errors', t.errors, []);
  await t.ctx.close();

  t = await open(browser, { path: '/workspace/match/', rows: handRows(), conflict: true });
  mp = t.page;
  await mp.click('.mline[data-key="M2:de:9201"] button[data-link]').catch(() => {});
  await mp.click('dialog.gvc-mlink button[data-id="pw"]').catch(() => {});
  await mp.waitForTimeout(400);
  check('link: a version conflict says so and writes nothing more', [(await text(mp, '#mlMsg')), t.writes.filter(w => !/^PATCH properties/.test(w))],
    ['Someone changed this job meanwhile. Reload the page and link it again.', []]);
  await t.ctx.close();

  const linkedRows = handRows();
  linkedRows.properties.find(p => p.id === 'pe').asana_gid = '1600';
  t = await open(browser, { path: '/workspace/match/', rows: linkedRows });
  check('link Asana: a task linked by hand since the last run is off the list', await t.page.$$eval('.mline[data-key="link:1600"]', els => els.length), 0);
  await t.ctx.close();

  /* M6 "no Drive folder linked" collapses to one line per fix group, with a show/hide list */
  const R6 = rowsFor();
  const m6 = (stage, who) => ({ list: [{ code: 'M6', key: 'M6', text: 'No Drive folder is linked, and the job is ' + stage + '.', values: { folder: null, stage }, fixAt: 'Drive', who, since: '2026-10-14' }], dismissed: {} });
  R6.properties[1].match = m6('Live', ['Elyse Gutman']);
  R6.properties[2].match = m6('Live', ['Pat Builder', 'Elyse Gutman']);
  t = await open(browser, { path: '/workspace/match/', rows: R6 });
  mp = t.page;
  check('match M6: no page errors', t.errors, []);
  check('match M6: one collapsed line in the Drive group', await mp.$$eval('.mg', gs => gs.filter(g => g.querySelector('h2').textContent.trim() === 'Drive').map(g =>
    [g.querySelectorAll('.bulk').length, g.querySelector('.bulk b').textContent.trim(), g.querySelectorAll('.who h3').length, g.querySelector('.chip').textContent.trim()])),
    [[1, '2 jobs have no Drive folder linked yet.', 0, '2']]);
  check('match M6: the list starts hidden', [await visible(mp, '.bulk .bulk-list'), await mp.$eval('.bulk [data-bulk]', b => b.getAttribute('aria-expanded'))], [false, 'false']);
  await mp.click('.bulk [data-bulk]');
  check('match M6: show lists each job once', [await visible(mp, '.bulk .bulk-list'), await mp.$$eval('.bulk .bulk-list .mline', els => els.length),
    await mp.$eval('.bulk [data-bulk]', b => [b.getAttribute('aria-expanded'), b.textContent.trim()])], [true, 2, ['true', 'Hide the jobs']]);
  await mp.click('.bulk [data-bulk]');
  check('match M6: hide again', await visible(mp, '.bulk .bulk-list'), false);
  check('match M6: the header total still counts them', (await text(mp, '#lead')).startsWith('6 mismatches'), true);
  check('match M6: other groups unchanged', await mp.$$eval('.mg > .card-h h2', els => els.map(e => e.textContent.trim())), ['Asana', 'DE', 'Drive', 'Roster']);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/match/', rows: rowsFor({ properties: [], dev_projects: [], asana_people: [] }) });
  check('match: nothing to fix', (await text(t.page, '#groups')).includes('Nothing to fix'), true);
  await t.ctx.close();

  /* ---------- the team Status page ---------- */
  t = await open(browser, { path: '/workspace/status/' });
  let sp = t.page;
  check('status: no page errors', t.errors, []);
  check('status: every staged job, by market', [await sp.$$eval('.mkt h2', els => els.map(e => e.textContent.trim())), await sp.$$eval('.mkt tbody tr', els => els.length)], [['NYC', 'NJ', 'FL'], 5]);
  check('status: stage order inside a market', await sp.$$eval('.mkt:first-of-type tbody tr .stg', els => els.map(e => e.textContent.trim())), ['Pitch', 'Live', 'In contract']);
  const row1 = await sp.$eval('.mkt tr[data-href*="100-example"]', tr => [...tr.querySelectorAll('td')].map(td => td.textContent.replace(/\s+/g, ' ').trim()));
  check('status: a row', [row1[0].startsWith('100 Example St 4A'), row1[2].startsWith('Listed'), row1[3].startsWith('Closing'), row1[5]], [true, true, true, '3']);
  check('status: no Drive pill needed', [await visible(sp, '#wsDrive'), await visible(sp, '.banner')], [false, false]);
  check('status: read-only, nothing written', t.writes, []);
  await t.ctx.close();
  const sphone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const spp = await sphone.newPage();
  await spp.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  const T1 = rowsFor({ members: [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }] });
  await spp.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(T1[new URL(r.request().url()).pathname.split('/').pop()] || []) }));
  await spp.route('**/auth/v1/user', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"u1","email":"m@x"}' }));
  await spp.goto(BASE + '/workspace/status/', { waitUntil: 'networkidle' });
  check('status: phone, rows shown', await spp.$$eval('.mkt tbody tr', els => els.length), 5);
  check('status: phone, no sideways scroll', await spp.evaluate(() => document.documentElement.scrollWidth <= 376), true);
  await spp.goto(BASE + '/workspace/match/', { waitUntil: 'networkidle' });
  check('match: phone, no sideways scroll', await spp.evaluate(() => document.documentElement.scrollWidth <= 376), true);
  /* the job page at 375 px: every stage in view, the M7 paste link wraps inside its card */
  T1.properties[0].asana.status = 'In Contract';
  T1.properties[0].match.list[1].text = 'Asana\'s Drive Link is empty; paste https://drive.google.com/drive/folders/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
  await spp.goto(BASE + '/workspace/job/?listing=100-example-st-residence-4a', { waitUntil: 'networkidle' });
  await spp.waitForTimeout(300);
  check('job: phone, no element wider than the viewport', await spp.evaluate(() => {
    const W = document.documentElement.clientWidth, out = [];
    document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > W + 0.5 || r.left < -0.5)) out.push(e.tagName + '.' + e.className); });
    return out;
  }), []);
  check('job: phone, all six stages in view', await spp.$$eval('.step', els => els.map(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })), [true, true, true, true, true, true]);
  check('job: phone, no sideways scroll', await spp.evaluate(() => document.documentElement.scrollWidth <= 376), true);
  await sphone.close();

  /* no em or en dashes in visible text on any /workspace/ page */
  for (const path of ['/workspace/', '/workspace/jobs/', '/workspace/match/', '/workspace/status/', '/workspace/job/?listing=20-sample-ave-7b', '/workspace/job/?listing=100-example-st-residence-4a', '/workspace/job/?pitch=90-pitch-st-11b-2026-08-04']) {
    t = await open(browser, { path });
    check('no em or en dash shown: ' + path, (await t.page.evaluate(() => document.body.innerText)).match(/[\u2013\u2014]/g), null);
    await t.ctx.close();
  }

  /* signed out: the sign-in box only, nothing asked of the database */
  for (const path of ['/workspace/match/', '/workspace/status/']) {
    t = await open(browser, { signedIn: false, path });
    check('signed out ' + path + ': sign-in box only', [await visible(t.page, '#gate'), await visible(t.page, '#board'), (await text(t.page, '#gate')).includes('Sign in')], [true, false, true]);
    check('signed out ' + path + ': no REST calls', t.reads, []);
    await t.ctx.close();
  }

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
  check('job: current stage', await text(jp, '.step.cur'), '5In contract' + (await jp.$eval('.step.cur .d', e => e.textContent)));
  check('job: DE status in words', (await text(jp, '.facts')).includes('Contract signed'), true);
  check('job: skipped stages dashed', await jp.$$eval('.step.skip', els => els.map(e => e.childNodes[1].textContent.trim())), ['Pitch', 'Prep', 'Accepted offer']);
  check('job: footer shows the sync', (await text(jp, '#wsFootSync')).startsWith('DE synced'), true);
  check('job: change log', await jp.$$eval('#changeLog li', els => els.length), 3);
  /* the Asana card (read-only) */
  check('job: Asana card stage', (await text(jp, '#asanaCard')).includes('In contract'), true);
  check('job: Asana card opens the task', await jp.$eval('#asanaCard a[href="https://app.asana.com/0/1/1201"]', a => [a.textContent.trim(), a.target]).catch(() => null), ['Open in Asana', '_blank']);
  check('job: checklist by block', await jp.$$eval('#asanaCard .ck-block h3', els => els.map(e => e.textContent.trim())), ['Prep', 'Contract']);
  check('job: checklist ticks', await jp.$$eval('#asanaCard .ck-block li.done', els => els.map(e => e.textContent.trim().split(' ')[0])), ['Create']);
  check('job: deal dates, planned hollow', [await jp.$$eval('#asanaCard .dmk', els => els.length), await jp.$$eval('#asanaCard .dmk.planned', els => els.length)], [2, 1]);
  check('job: its mismatches', await jp.$$eval('#asanaCard .mm li', els => els.length), 3);
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
  check('development page: D66\'s 18 milestones', await t.page.$$eval('#msList li', els => els.length), 18);
  check('development page: hints listed with ✓ and ✗', [await t.page.$$eval('#hints li', els => els.length), await t.page.$$eval('#hints [data-ok]', els => els.length), await t.page.$$eval('#hints [data-no]', els => els.length)], [2, 2, 2]);
  check('development page: next milestone and slips', [(await text(t.page, '#devNext')).includes('Permits / zoning'), (await text(t.page, '#devNext')).includes('re-dated 2 times')], [true, true]);
  await t.page.click('#hints [data-ok="0"]');
  await t.page.waitForTimeout(400);
  let dp = t.writes.find(w => /^PATCH dev_projects/.test(w)) || '';
  let dbody = JSON.parse(dp.slice(dp.indexOf('{')) || '{}');
  check('hint ✓: version-checked update', [/id=eq\.d1/.test(dp), /version=eq\.2/.test(dp)], [true, true]);
  check('hint ✓: moved into milestones', [dbody.milestones && dbody.milestones.renders && dbody.milestones.renders.done, dbody.milestones && dbody.milestones.renders.on, dbody.milestones && dbody.milestones.renders.asanaGid,
    !!(dbody.milestones && dbody.milestones.renders.confirmedBy), dbody.milestones && dbody.milestones.agreement && dbody.milestones.agreement.done], [true, '2026-05-21', '777', true, true]);
  check('hint ✓: off the hint list, into asana_map', [(dbody.milestone_hints || []).map(h => h.key), dbody.asana_map && dbody.asana_map.renders], [['finishes'], ['777']]);
  check('hint ✓: logged', t.writes.some(w => /^POST changes .*"dev_project_id":"d1".*"field":"milestones"/.test(w)), true);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/job/?dev=619-example-ave' });
  await t.page.click('#hints [data-no="1"]');
  await t.page.waitForTimeout(400);
  dp = t.writes.find(w => /^PATCH dev_projects/.test(w)) || '';
  dbody = JSON.parse(dp.slice(dp.indexOf('{')) || '{}');
  check('hint ✗: turned down, remembered, not a milestone', [(dbody.milestone_hints || []).map(h => h.key), dbody.asana_map && dbody.asana_map.dismissed && dbody.asana_map.dismissed.finishes, 'milestones' in dbody], [['renders'], ['778'], false]);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/job/?dev=619-example-ave', conflict: true });
  await t.page.click('#hints [data-ok="0"]');
  await t.page.waitForTimeout(400);
  check('hint: conflict refused, not overwritten', [(await text(t.page, '#hintMsg')).includes('Someone changed'), t.writes.some(w => /^POST changes/.test(w))], [true, false]);
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

  // while a link is saving, Cancel and Escape wait for it
  t = await open(browser, { path: '/workspace/job/?listing=20-sample-ave-7b', slowPatch: true });
  await t.page.evaluate(FAKE + 'window.GVC_DRIVE = window.__fakeDrive;');
  await t.page.click('#link');
  await t.page.waitForSelector('dialog.gvc-link button[data-i]');
  await t.page.click('dialog.gvc-link button[data-i="0"]');
  const midSave = await t.page.$eval('#lkCancel', b => b.disabled);
  await t.page.keyboard.press('Escape');
  check('link: Cancel and Escape wait while saving', [midSave, await visible(t.page, 'dialog.gvc-link')], [true, true]);
  await t.page.waitForTimeout(1200);
  check('link: closes once saved', await visible(t.page, 'dialog.gvc-link'), false);
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

  /* ---------- tune-up B ---------- */
  // B5: signed in, but not on the team list: say so, never an empty "all clear"
  for (const [name, path] of [['overview', '/workspace/'], ['match', '/workspace/match/'], ['status', '/workspace/status/']]) {
    t = await open(browser, { path, members: [] });
    check('B5 ' + name + ': not on the team list says so', [await visible(t.page, '#gate'), await visible(t.page, '#board'),
      ((await text(t.page, '#gate')) || '').includes('Your account isn\'t on the GVC team list yet. Ask Matt to add you.'), t.errors], [true, false, true, []]);
    await t.ctx.close();
    // B5-fix: the team list couldn't be read: say that, never "not on the team list"
    t = await open(browser, { path, membersFail: true });
    const g = (await text(t.page, '#gate')) || '';
    check('B5-fix ' + name + ': a failed team-list read says it couldn\'t check', [await visible(t.page, '#gate'), await visible(t.page, '#board'),
      g.includes('Couldn\'t check your account just now. Reload the page to try again.'), g.includes('team list'), /[\u2013\u2014]/.test(g), t.errors], [true, false, true, false, false, []]);
    await t.ctx.close();
  }
  // B6: the Asana card's chip follows the stage it shows (Asana's), not the job's
  const R6b = rowsFor();
  Object.assign(R6b.properties[0].asana, { stageFromStatus: 'Live', status: 'Active' });
  t = await open(browser, { rows: R6b, path: '/workspace/job/?listing=100-example-st-residence-4a' });
  check('B6 Asana card: chip colour follows the stage it shows', await t.page.$eval('#asanaCard .chip', c => [c.textContent.trim(), c.className]).catch(() => null), ['Live', 'chip live']);
  await t.ctx.close();
  // B7: an Archived job's stored mismatches stay off the Match page (as off the overview's total)
  const R7 = rowsFor();
  R7.properties.push({ id: 'pa', slug: '9-gone-st', label: 'a', kind: 'sale', market: 'NYC', stage: 'Archived', stage_source: 'Asana', version: 1, core: { address: '9 Gone St' },
    folder_state: 'linked', drive_folder: 'g', match: { list: [{ code: 'M3', key: 'M3', text: 'Asana says $1; DE says $2.', values: {}, fixAt: 'Asana', who: ['Elyse Gutman'], since: '2026-10-01' }], dismissed: {} } });
  t = await open(browser, { path: '/workspace/match/', rows: R7 });
  check('B7 match: Archived jobs left out', [((await text(t.page, '#groups')) || '').includes('9 Gone St'), (await text(t.page, '#lead')).startsWith('4 mismatches')], [false, true]);
  await t.ctx.close();
  // B8: the "not linked" list comes from the newest ok Asana run only
  t = await open(browser, { path: '/workspace/match/', rows: rowsFor({ sync_runs: [
    { kind: 'asana', started_at: iso(NOW - 7200e3), ok: true, totals: { unlinked: [{ gid: '1700', name: '70 Good Run Pl', why: 'same address' }] } },
    { kind: 'asana', started_at: iso(NOW - 3600e3), ok: false, totals: { unlinked: [{ gid: '1701', name: '71 Failed Run Pl', why: 'same address' }] } }] }) });
  const g8 = (await text(t.page, '#groups')) || '';
  // asked of the database directly, so a long Asana outage (many failed runs) can't push the good run out of reach
  const runAsk = await t.page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(u => /sync_runs\?select=[^&]*totals.*kind=eq\.asana/.test(u)));
  check('B8 match: only the newest ok run is asked for', [runAsk.length > 0, runAsk.every(u => /ok=is\.true/.test(u) && /limit=1(&|$)/.test(u))], [true, true]);
  check('B8 match: unlinked from the newest ok run, never a failed one', [g8.includes('70 Good Run Pl'), g8.includes('71 Failed Run Pl')], [true, false]);
  await t.ctx.close();
  // A1: a DE listing whose id a job already holds is left out (a half-saved hand link)
  const rA1 = handRows();
  rA1.properties.find(p => p.id === 'pw').de_listing_id = '9201';
  t = await open(browser, { path: '/workspace/match/', rows: rA1 });
  check('A1 match: a DE line a job already holds is gone', [await t.page.$$eval('.mline[data-key="M2:de:9201"]', els => els.length), await t.page.$$eval('.mline[data-key="M2:de:9202"]', els => els.length)], [0, 1]);
  await t.ctx.close();
  // A2: Ignore where only the log fails: the page reloads, then says so
  t = await open(browser, { path: '/workspace/match/', rows: handRows({ asana_tasks: [{ gid: '1600', ignored: false, property_id: null, pitch_id: 'q1' }] }), changeFails: true });
  const readsA2 = t.reads.length;
  await t.page.click('.mline[data-key="link:1600"] button[data-aside]').catch(() => {});
  await t.page.waitForTimeout(500);
  check('A2 ignore, log failed: reloaded, then the message', [t.reads.length > readsA2, ((await text(t.page, '#lead')) || '').startsWith('Set aside, but the change log didn\'t save'), t.errors], [true, true, []]);
  await t.ctx.close();

  await browser.close();
  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
