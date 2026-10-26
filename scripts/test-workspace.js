/* ============================================================
   Browser tests for the /workspace/ pages, with Supabase and the desktop
   helper mocked by request interception (made-up rows; nothing real).

     BASE=http://localhost:8080 node scripts/test-workspace.js
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const SJ = require('../assets/js/sheet-job.js');
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
    // 💬 Social Media posts (0012): two posted, one coming, one that didn't post, one with an unsafe link
    asana_tasks: [
      { gid: 's1', kind: 'post', property_id: 'p1', name: 'Carousel: the kitchen', due_on: '2026-10-01', completed_at: '2026-10-01T15:00:00Z', fields: { format: 'Carousel', stage: 'Completed', link: 'https://www.instagram.com/p/abc/' } },
      { gid: 's2', kind: 'post', property_id: 'p1', name: 'Reel <b>tour</b>', due_on: '2026-10-08', completed_at: '2026-10-08T15:00:00Z', fields: { format: 'Reel', link: 'javascript:alert(1)' } },
      { gid: 's3', kind: 'post', property_id: 'p1', name: 'Just sold story', due_on: '2026-11-02', completed_at: null, fields: { format: 'Story', stage: 'Production' } },
      { gid: 's4', kind: 'post', property_id: 'p1', name: 'Dropped idea', due_on: '2026-09-01', completed_at: null, fields: { stage: 'Did Not Post' } },
      { gid: 's5', kind: 'post', property_id: null, dev_project_id: 'd1', name: 'Construction update reel', due_on: '2026-10-10', completed_at: '2026-10-10T15:00:00Z', fields: { format: 'Reel' } }
    ],
    todos: [{ id: 't1', section: 'Up next', body: 'Florida office signage', done: false, position: 1 },
      { id: 't2', section: 'Waiting on others', body: 'Real headshot for an agent\nOnly a small temporary photo', done: false, position: 2 }]
  };
  return Object.assign(T, over || {});
}

async function open(browser, opts) {
  const ctx = await browser.newContext();
  await ctx.route(/mammoth\.browser\.min\.js/, r => r.abort());   // the job page's Word reader: tests never use the network
  const page = await ctx.newPage();
  const errors = [], writes = [], reads = [];
  page.on('pageerror', e => errors.push(e.message));
  if (opts.signedIn !== false) {
    await page.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
    await page.addInitScript(() => localStorage.setItem('gvc.collapse.all', 'open'));   // every card open: these tests read inside them
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
  check('signed out: footer says why there is no sync status', await t.page.$eval('#wsFootSync', e => e.title), 'Sign in to see the DE sync');
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

  /* Slice 4 (S21): the overview row's small "stale" mark */
  {
    const RS = rowsFor();
    const row = RS.properties.find(x => x.id === 'p1');
    const was = SJ.builtFrom({}, row, {});
    was.facts.price = 3900000;
    RS.documents = [{ property_id: 'p1', tool: 'showsheet', built_from: was, output: { name: 'a.pdf' } },
      { property_id: 'p2', tool: 'showsheet', built_from: SJ.builtFrom({}, RS.properties.find(x => x.id === 'p2'), {}), output: { name: 'b.pdf' } }];
    let ts = await open(browser, { rows: RS });
    check('overview stale: one documents read, the record columns only', ts.reads.filter(x => / documents$/.test(x)).length, 1);
    check('overview stale: the stale job has the mark', await ts.page.$$eval('a.pj', els => els.filter(a => a.querySelector('.chip.stalemark')).map(a => [a.getAttribute('href'), a.querySelector('.chip.stalemark').textContent.trim(), a.querySelector('.chip.stalemark').getAttribute('title')])),
      [['job/?listing=100-example-st-residence-4a', 'stale', 'Showsheet stale: price']]);
    check('overview stale: no page errors', ts.errors, []);
    await ts.ctx.close();
    ts = await open(browser, { rows: RS, missing: ['documents'] });
    check('overview stale: documents not readable yet (0009 not run): the board still loads, no marks', [await visible(ts.page, '#board'), await ts.page.$$eval('.chip.stalemark', e => e.length), ts.errors], [true, 0, []]);
    await ts.ctx.close();
  }
  {
    // the To-do page is Matt's own: the team sign-in sees a note, and the list is never read
    const tt = await open(browser, { path: '/tools/todo/', members: [{ name: 'Team (shared)', initials: 'GVC', role: 'shared' }] });
    check('to-do page, team sign-in: no list, a plain note, nothing read', [((await text(tt.page, '#sections')) || '').includes('Florida office signage'),
      ((await text(tt.page, '#status')) || '').includes('only for Matt'), tt.reads.includes('GET todos')], [false, true, false]);
    await tt.ctx.close();
    const to = await open(browser, { path: '/tools/todo/' });
    check('to-do page, owner: the list shows', ((await text(to.page, '#sections')) || '').includes('Florida office signage'), true);
    await to.ctx.close();
  }
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
  check('nav: Overview, Resell, New Dev, Errors', await p.$$eval('.nav a', els => els.map(e => e.textContent)), ['Overview', 'Resell', 'New Dev', 'Errors']);
  check('footer: links to the rest of the site', await p.$$eval('.foot .foot-links a', els => els.map(e => [e.textContent, e.getAttribute('href')])),
    [['Team tools', './../#tools'], ['Listing rules', './../listing-rules/'], ['Tasks', './#tasks']]);
  check('Asana card ok', [await p.$eval('#asCard', e => e.className), (await text(p, '#asText')).startsWith('Asana last synced')], ['card health', true]);
  check('top bar: Asana pill beside DE, the time on hover', [await text(p, '#wsFootAsana'), (await p.$eval('#wsFootAsana', e => e.title)).startsWith('Asana last synced'), await p.$eval('#wsFootAsana', e => e.className)], ['Asana synced', true, 'pill-ok']);
  check('deal-date markers, planned hollow', [await p.$$eval('a.pj[href*="100-example"] .dmk', els => els.length), await p.$$eval('a.pj[href*="100-example"] .dmk.planned', els => els.length)], [2, 1]);
  check('mismatch count on the row', (await text(p, 'a.pj[href*="100-example"] .r')).includes('3 errors'), true);
  check('mismatch total in the header', [await text(p, '#mmTotal'), await p.$eval('#mmTotal', a => a.getAttribute('href'))], ['4 errors', 'match/']);
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
  await pp.addInitScript(() => localStorage.setItem('gvc.collapse.all', 'open'));   // every card open: these tests read inside them
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
  check('jobs: rows (Resell: no developments)', await t.page.$$eval('#rows tr', els => els.length), 5);
  check('jobs: link to the job page', await t.page.$eval('#rows a[href*="100-example"]', a => a.getAttribute('href')), '../job/?listing=100-example-st-residence-4a');
  check('jobs: DE status in words', (await text(t.page, '#rows')).includes('Contract signed'), true);
  const firstName = () => t.page.$eval('#rows tr:first-child td.nm a', a => a.textContent);
  const sortState = () => t.page.$$eval('thead th[aria-sort]', ths => ths.map(th => th.querySelector('button').dataset.sort + ':' + th.getAttribute('aria-sort')));
  check('jobs: every column has a sort button', await t.page.$$eval('thead th button[data-sort]', bs => bs.length), 8);
  check('jobs: Posts column: posted, then coming', [await text(t.page, '#rows tr:has(a[href*="100-example"]) td.posts'), await text(t.page, '#rows tr:has(a[href*="20-sample"]) td.posts')], ['21 coming', '0']);
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
  await t.page.focus('#typ button[data-v="listing"]'); await t.page.keyboard.press('Enter');
  check('jobs: keyboard focus stays on the Type button', await t.page.evaluate(() => [document.activeElement.dataset.v, document.activeElement.getAttribute('aria-pressed'), document.querySelector('#typ button[data-v="pitch"]').getAttribute('aria-pressed')]), ['listing', 'true', 'false']);
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
  check('match: total in the header', (await text(mp, '#lead')).startsWith('4 errors'), true);
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
  check('match: they count in the header', (await text(mp, '#lead')).startsWith('6 errors'), true);
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
  check('match M6: the header total still counts them', (await text(mp, '#lead')).startsWith('6 errors'), true);
  check('match M6: other groups unchanged', await mp.$$eval('.mg > .card-h h2', els => els.map(e => e.textContent.trim())), ['Asana', 'DE', 'Drive', 'Roster']);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/match/', rows: rowsFor({ properties: [], dev_projects: [], asana_people: [] }) });
  check('match: nothing to fix', (await text(t.page, '#groups')).includes('Nothing to fix'), true);
  await t.ctx.close();

  /* deepen: M18 (folder found on Drive) and M19 (probably the same listing) are the workspace's to fix;
     the DE line M19 names says which job, and keeps Link to a job / Not ours */
  const RD = rowsFor({ de_listings: [{ de_listing_id: '9301', kind: 'rental', gvc_listed: true, property_id: null, ignored: false, raw: { street: '20 SAMPLE AVE', unit: '7C', state: 'NY' }, checked_at: iso(NOW - 864e5) }] });
  RD.properties[1].match = { list: [
    { code: 'M18', key: 'M18', text: 'A folder for this job is on Drive at GVC - New York/Building Information/20 Sample Ave/7B; link it.', values: { candidate: 'GVC - New York/Building Information/20 Sample Ave/7B', stage: 'Live' }, fixAt: 'Matt', who: ['Elyse Gutman'], since: '2026-10-20' },
    { code: 'M19', key: 'M19:9301', text: 'DE has 20 Sample Ave 7C (rental, Active) with no job; this job is 7B. Probably the same listing: check the unit in Asana, or link the DE listing to this job.',
      values: { deListingId: '9301', deUnit: '7C', deKind: 'rental', unit: '7B', kind: 'rental' }, fixAt: 'Matt', who: ['Elyse Gutman'], since: '2026-10-20' }], dismissed: {} };
  t = await open(browser, { path: '/workspace/match/', rows: RD });
  mp = t.page;
  check('deepen: no page errors', t.errors, []);
  const mattGroup = await mp.$$eval('.mg', gs => gs.filter(g => g.querySelector('h2').textContent.trim() === 'Matt').map(g => [g.querySelector('.card-h p').textContent.trim(), g.querySelectorAll('.mline').length]));
  check('deepen: M18 and M19 sit in the workspace (Matt) group, which says what it holds', mattGroup,
    [['Fix in the workspace.', 2]]);
  check('deepen: M18 is its own line, not folded into the Drive group', await mp.$$eval('.bulk', els => els.length), 0);
  const deLine = (await text(mp, '.mline[data-key="M2:de:9301"]')) || '';
  check('deepen: the DE line names the job M19 points at, and keeps its buttons', [deLine.includes('Probably the same listing as 20 Sample Ave 7B'),
    await mp.$$eval('.mline[data-key="M2:de:9301"] button[data-link], .mline[data-key="M2:de:9301"] button[data-aside]', els => els.length)], [true, 2]);
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
  await sphone.route(/mammoth\.browser\.min\.js/, r => r.abort());
  const spp = await sphone.newPage();
  await spp.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  await spp.addInitScript(() => localStorage.setItem('gvc.collapse.all', 'open'));   // every card open: these tests read inside them
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
  check('job: agent from the roster', (await text(jp, '#agentsCard')).includes('Elyse Gutman'), true);   // Slice 3: the Agents tile moved into the Agents card
  check('job: current stage', await text(jp, '.step.cur'), '5In contract' + (await jp.$eval('.step.cur .d', e => e.textContent)));
  check('job: DE status in words', (await text(jp, '.facts')).includes('Contract signed'), true);
  check('job: skipped stages dashed', await jp.$$eval('.step.skip', els => els.map(e => e.childNodes[1].textContent.trim())), ['Pitch', 'Prep', 'Accepted offer']);
  check('job: social posts counted, Did Not Post left out', await text(jp, '#postsCount'), '2 posted · 1 coming');
  check('job: posts newest first, coming above posted', await jp.$$eval('#postsCard .pn', els => els.map(e => e.textContent)), ['Just sold story', 'Reel <b>tour</b>', 'Carousel: the kitchen']);
  check('job: a post links only over https', await jp.$$eval('#postsCard .pn a', as => as.map(a => a.getAttribute('href'))), ['https://www.instagram.com/p/abc/']);
  check('job: DE pill, the time on hover', [await text(jp, '#wsFootSync'), (await jp.$eval('#wsFootSync', e => e.title)).startsWith('DE synced ')], ['DE synced', true]);
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
  check('job: broken folder flagged', [(await text(t.page, '#link')).includes('Relink'), await t.page.$eval('#link', b => b.classList.contains('ok')), (await text(t.page, '.path')).includes('moved or renamed')], [true, false, true]);
  await t.ctx.close();

  t = await open(browser, { path: '/workspace/job/?listing=nobody-lives-here' });
  check('job: unknown address', (await text(t.page, '#page')).includes('No job called "nobody-lives-here"'), true);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/job/?pitch=90-pitch-st-11b-2026-08-04' });
  check('pitch page', [(await text(t.page, 'h1')).startsWith('90 Pitch St 11B'), (await text(t.page, '.facts')).includes('Open')], [true, true]);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/job/?dev=619-example-ave' });
  check('development page: D66\'s 18 milestones', await t.page.$$eval('#msList li', els => els.length), 18);
  check('development page: its social posts', [await text(t.page, '#postsCount'), await t.page.$$eval('#postsCard .pn', els => els.map(e => e.textContent))], ['1 posted', ['Construction update reel']]);
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
  check('B7 match: Archived jobs left out', [((await text(t.page, '#groups')) || '').includes('9 Gone St'), (await text(t.page, '#lead')).startsWith('4 errors')], [false, true]);
  await t.ctx.close();
  // B8: the "not linked" list comes from the newest ok Asana run only
  t = await open(browser, { path: '/workspace/match/', rows: rowsFor({ sync_runs: [
    { kind: 'asana', started_at: iso(NOW - 7200e3), ok: true, totals: { unlinked: [{ gid: '1700', name: '70 Good Run Pl', why: 'same address' }] } },
    { kind: 'asana', started_at: iso(NOW - 3600e3), ok: false, totals: { unlinked: [{ gid: '1701', name: '71 Failed Run Pl', why: 'same address' }] } }] }) });
  const g8 = (await text(t.page, '#groups')) || '';
  // asked of the database directly, so a long Asana outage (many failed runs) can't push the good run out of reach
  const runAsk = await t.page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(u => /sync_runs\?select=[^&]*totals.*kind=eq\.asana/.test(u)));
  check('match: the key lists every code, folded away until opened', [await t.page.$$eval('#key li', li => li.length), await t.page.$eval('#key', d => d.open)], [27, false]);
  check('match: a line\'s code says what it means on hover', await t.page.$$eval('#groups .mline .code[title]', els => els.length > 0), true);
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

  // D88: an off-market listing on the overview, the Jobs list and its job page
  const ROM = rowsFor();
  ROM.properties.push({ id: 'pom', slug: '619-sample-ave-brielle', label: 'om', kind: 'sale', market: 'NJ', stage: 'Off market', stage_source: 'Asana', version: 1,
    core: { address: '619 Sample Ave', city: 'Brielle', price: 1250000 }, folder_state: 'linked', drive_folder: 'GVC - New Jersey/619 Sample Ave',
    asana_gid: '1301', asana: { gid: '1301', permalink: 'https://app.asana.com/0/1/1301', status: 'Graveyard', section: 'Graveyard', stageFromStatus: 'Off market', stageFromSection: 'Off market', checklist: [] },
    milestones: { listedOn: { on: iso(NOW - 120 * 864e5).slice(0, 10), planned: false }, offMarketOn: { on: iso(NOW - 10 * 864e5).slice(0, 10), planned: false } }, match: { list: [], dismissed: {} } });
  t = await open(browser, { rows: ROM });
  const omCard = await t.page.$$eval('#jobs .pj', els => { const e = els.find(x => x.textContent.includes('619 Sample Ave')); return e ? [e.querySelector('.chip').className, e.querySelector('.sub').textContent, e.querySelector('.prog span').textContent, e.querySelectorAll('.track i').length] : null; });
  check('D88 overview: the off-market job is listed with its own chip, its town, and when it went off market',
    omCard && [omCard[0], omCard[1].includes('Brielle'), /^Off market since \d+ \w{3}\. Prep can carry on\.$/.test(omCard[2]), omCard[3]], ['chip off', true, true, 4]);
  check('D88 overview: Live still counts only Live jobs', await t.page.$eval('#stats .stat .v', v => parseInt(v.textContent, 10)), 2);
  await t.page.click('#view [data-v="time"]').catch(() => {});
  check('D88 overview timeline: the legend names Off market', ((await text(t.page, '#jobs')) || '').includes('Off market'), true);
  check('D88 overview: no page errors', t.errors, []);
  await t.ctx.close();
  // overview Jobs card: stage filter and sort (Matt, 2026-10-26)
  t = await open(browser, { rows: ROM });
  const stages = await t.page.$$eval('#stg option', o => o.map(x => x.textContent));
  check('overview jobs: the stage list offers All stages and the stages on the board', [stages[0], stages.includes('Off market'), stages.includes('Archived')], ['All stages', true, false]);
  await t.page.selectOption('#stg', 'Off market');
  const omOnly = await t.page.$$eval('#jobs .pj h3', h => h.map(x => x.textContent));
  check('overview jobs: Off market shows only the off-market job', [omOnly.length, omOnly.every(x => x.includes('Off market'))], [1, true]);
  await t.page.selectOption('#stg', '');
  await t.page.selectOption('#srt', 'name');
  const ovNames = await t.page.$$eval('#jobs .pj h3', h => h.map(x => x.childNodes[0].textContent.trim()));
  check('overview jobs: Name sorts A to Z', ovNames, ovNames.slice().sort((x, y) => x.localeCompare(y)));
  await t.page.selectOption('#srt', 'stage');
  const ovOrder = await t.page.$$eval('#jobs .pj .chip:not(.stalemark)', c => c.map(x => x.textContent));
  const OST = ['Prep', 'Live', 'Accepted offer', 'In contract', 'Sold', 'Rented', 'Off market', 'Archived'];
  const ovIdx = ovOrder.map(x => OST.indexOf(x) === -1 ? 999 : OST.indexOf(x));
  check('overview jobs: Stage sorts Prep to Sold', ovIdx, ovIdx.slice().sort((x, y) => x - y));
  check('overview jobs: no page errors', t.errors, []);
  await t.ctx.close();
  t = await open(browser, { rows: ROM, path: '/workspace/jobs/' });
  const omRow = await t.page.$$eval('#rows tr', trs => { const r = trs.find(x => x.textContent.includes('619 Sample Ave')); return r ? r.querySelector('.stg .chip').className + ' ' + r.querySelector('.stg .chip').textContent : null; });
  await t.page.click('#typ [data-v="listing"]').catch(() => {});
  check('D88 jobs list: the row has the Off market chip, and the Listings filter keeps it',
    [omRow, ((await text(t.page, '#rows')) || '').includes('619 Sample Ave'), t.errors], ['chip off Off market', true, []]);
  await t.ctx.close();
  t = await open(browser, { rows: ROM, path: '/workspace/job/?listing=619-sample-ave-brielle' });
  await t.page.waitForSelector('.steps .step', { timeout: 5000 }).catch(() => {});
  check('D88 job page: the stage track is the stages it reached, then Off market (current)',
    await t.page.$$eval('.steps .step', els => els.map(e => e.textContent.replace(/[\d\s]+\w{3}$/, '').replace(/^\d+/, '').trim() + (e.classList.contains('cur') ? '*' : ''))).catch(() => null),
    ['Pitch', 'Prep', 'Live', 'Off market*']);
  check('D88 job page: the Asana card shows Off market', await t.page.$eval('#asanaCard .chip', c => [c.textContent.trim(), c.className]).catch(() => null), ['Off market', 'chip off']);
  check('D88 job page: no page errors', t.errors, []);
  await t.ctx.close();

  /* ---------- tune-ups 2 (Matt's notes, 10-23) ---------- */
  // the tabs: Overview | Resell | New Dev | Errors
  t = await open(browser, { path: '/workspace/jobs/' });
  check('tabs: the four names', await t.page.$$eval('.nav a', as => as.map(a => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')])),
    [['Overview', '../', null], ['Resell', '../jobs/', 'page'], ['New Dev', '../new-dev/', null], ['Errors', '../match/', null]]);
  check('Resell: listings, rentals and pitches, no developments', await t.page.$$eval('#rows .nm a', as => as.map(a => a.textContent.trim()).sort()),
    ['100 Example St 4A', '12 Sample Lane', '20 Sample Ave 7B', '90 Pitch St 11B', '<img src=x onerror="window.__xss=1">'].sort());
  check('Resell: the Table view is the status table', await t.page.$eval('[aria-label="View"] a[href="../status/"]', a => a.textContent), 'Table');
  check('Resell: sync badges per job (100 Example St: all three linked)', await t.page.$$eval('#rows tr:first-child .sb', bs => bs.map(b => b.className + ':' + b.textContent.replace(/:.*/, ''))),
    ['sb ok:✓Asana', 'sb ok:✓Drive', 'sb ok:✓DE']);
  check('Resell: no page errors', t.errors, []);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/new-dev/' });
  check('New Dev: only developments', await t.page.$$eval('#rows .nm a', as => as.map(a => a.textContent.trim())), ['619 Example Ave']);
  check('New Dev: Posts column', await text(t.page, '#rows td.posts'), '1');
  check('New Dev: the tab is current', await t.page.$eval('.nav a[aria-current="page"]', a => a.textContent.trim()), 'New Dev');
  check('New Dev: no page errors', t.errors, []);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/status/' });
  check('Table view: under the Resell tab', await t.page.$eval('.nav a[aria-current="page"]', a => a.textContent.trim()), 'Resell');
  await t.ctx.close();

  // the badges on the overview: a broken folder is a cross, a Prep job has no DE yet
  t = await open(browser, {});
  const sbOf = name => t.page.$$eval('.pj', (els, n) => { const e = els.find(x => x.querySelector('h3').textContent.indexOf(n) === 0); return e ? [...e.querySelectorAll('.sb')].map(b => b.className.replace('sb ', '') + ' ' + b.title) : null; }, name);
  check('overview badges: 12 Sample Lane (folder moved, not on DE while Live)', await sbOf('12 Sample Lane'),
    ['no Asana: No Asana task linked', 'no Drive: The Drive folder moved or was renamed', 'no DE: Not matched to a DE listing']);
  await t.ctx.close();

  // folding: the Jobs list opens, Tasks starts folded, and a choice is remembered
  {
    const ctx = await browser.newContext(), pg = await ctx.newPage();
    await ctx.route(/mammoth\.browser\.min\.js/, r => r.abort());
    await pg.addInitScript(() => { localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })); delete window.showDirectoryPicker; });
    const T = rowsFor();
    await pg.route('**/rest/v1/**', r => { const tb = new URL(r.request().url()).pathname.split('/').pop();
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tb === 'members' ? [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }] : T[tb] || []) }); });
    await pg.route('**/auth/v1/user', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', email: 'matt@example.com' }) }));
    await pg.route('http://localhost:47610/**', r => r.abort());
    await pg.goto(BASE + '/workspace/', { waitUntil: 'networkidle' });
    await pg.waitForTimeout(300);
    const shut = sel => pg.$eval(sel, c => c.classList.contains('cz-shut'));
    check('fold: the Jobs list starts open, Tasks folded', [await shut('section[aria-labelledby="pipe-h"]'), await shut('#tasks'), await visible(pg, '#newTask')], [false, true, false]);
    await pg.click('#tasks .cz-btn');
    check('fold: Tasks opens from its button', [await shut('#tasks'), await pg.$eval('#tasks .cz-btn', b => b.getAttribute('aria-expanded'))], [false, 'true']);
    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForTimeout(300);
    check('fold: the choice is remembered', await shut('#tasks'), false);
    await pg.goto(BASE + '/workspace/job/?listing=100-example-st-residence-4a', { waitUntil: 'networkidle' });
    await pg.waitForTimeout(500);
    check('fold: a job page opens Stages, folds the rest', await pg.$$eval('.card.cz-head, .card', cs => cs.filter(c => c.querySelector(':scope > .cz-head')).map(c => (c.querySelector('h2') || {}).textContent + ':' + (c.classList.contains('cz-shut') ? 'shut' : 'open'))
      .filter(x => /^(Stages|Change log|Agents):/.test(x))), ['Change log:shut', 'Agents:shut']);
    await ctx.close();
  }

  // Errors: claim, mark fixed, still wrong; only owner, admin or marketing may
  const CL = (over) => rowsFor(Object.assign({ match_claims: [
    { owner_table: 'properties', owner_id: 'p1', key: 'M3', claimed_name: 'Matt Bloomfield', claimed_at: iso(NOW - 864e5) },
    { owner_table: 'properties', owner_id: 'p1', key: 'M7:drive', claimed_name: 'Matt Bloomfield', claimed_at: iso(NOW - 864e5), fixed_name: 'Matt Bloomfield', fixed_at: iso(NOW - 600e3) },
    { owner_table: 'properties', owner_id: 'p1', key: 'M5:closedOn', fixed_name: 'Matt Bloomfield', fixed_at: iso(NOW - 2 * 3600e3) }] }, over || {}));
  t = await open(browser, { path: '/workspace/match/', rows: CL() });
  const lineOf = key => t.page.$eval('.mline[data-key="' + key + '"]', li => [li.classList.contains('waiting'), (li.querySelector('.claim') || {}).textContent || null,
    [...li.querySelectorAll('.meta button')].map(b => b.textContent)]).catch(() => null);
  check('errors: claimed', await lineOf('M3'), [false, 'Matt Bloomfield is on it', ['Mark fixed', 'Unclaim', 'Dismiss']]);
  const m7 = await lineOf('M7:drive');
  check('errors: fixed since the last sync waits, with Undo', [m7[0], /^Fixed by Matt Bloomfield .+ · waiting for the next sync$/.test(m7[1]), m7[2]], [true, true, ['Copy', 'Undo', 'Dismiss']]);
  check('errors: fixed before a later sync that still finds it', await lineOf('M5:closedOn'), [false, 'Still wrong after Matt Bloomfield marked it fixed ' + await t.page.evaluate(d => window.GVC_WS.fmtDay(d), iso(NOW - 2 * 3600e3)), ['Mark fixed', 'Dismiss']]);
  check('errors: an unclaimed line offers I\'m on it', (await lineOf('M12:g7'))[2], ["I'm on it", 'Dismiss']);
  await t.page.click('.mline[data-key="M12:g7"] [data-claim]');
  await t.page.waitForTimeout(400);
  const cw = t.writes.filter(w => /POST match_claims/.test(w));
  check('errors: I\'m on it writes one claim row', cw.length === 1 && /"owner_table":"dev_projects","owner_id":"d1","key":"M12:g7","claimed_at"/.test(cw[0]), true);
  check('errors: no page errors', t.errors, []);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/match/', rows: CL(), members: [{ name: 'Team (shared)', initials: 'GVC', role: 'shared' }] });
  check('errors: the shared login sees who is on it, but no buttons', [(await lineOf('M3'))[1], (await lineOf('M3'))[2], (await lineOf('M12:g7'))[2]],
    ['Matt Bloomfield is on it', ['Dismiss'], ['Dismiss']]);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/match/', rows: CL(), members: [{ name: 'Sydney', initials: 'S', role: 'marketing' }] });
  check('errors: the marketing team may claim', (await lineOf('M12:g7'))[2], ["I'm on it", 'Dismiss']);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/match/', rows: rowsFor(), missing: ['match_claims'] });
  check('errors: before 0011, no claim buttons and nothing breaks', [(await lineOf('M3'))[2], t.errors], [['Dismiss'], []]);
  await t.ctx.close();

  await browser.close();
  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
