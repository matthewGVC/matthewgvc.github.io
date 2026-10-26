/* ============================================================
   Browser tests for the job page's database cards (Slice 3, Task 7):
   facts, agents, archive, change-log notes, development ticks, pitch view.
   Supabase and the desktop helper are mocked by request interception
   (made-up rows and names; nothing real). Every save_job call is captured.

     BASE=http://127.0.0.1:8096 node scripts/test-job-page.js
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const SJ = require('../assets/js/sheet-job.js');
const ST = require('../assets/js/piece-stale.js');
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
const ymd = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

function rowsFor() {
  return {
    properties: [
      { id: 'p1', slug: '100-example-st-4a', label: 'x', kind: 'sale', market: 'NYC', stage: 'Live', stage_source: 'Asana', version: 7,
        core: { address: '100 Example St', unit: '4A', neighborhood: 'Testville', propertyType: 'Co-op', price: 2400000, beds: 4, sqft: 1500,
          suggestedAgentIds: ['john-gasdaska', 'katie-cook'],
          facts: {
            price: { value: 2400000, source: 'Matt', bySource: { DE: 2250000, Matt: 2400000, Asana: 2300000 } },
            beds: { value: 4, source: 'Matt', bySource: { Asana: 3, Matt: 4 } },
            sqft: { value: 1500, source: 'Asana', bySource: { Asana: 1500 } }
          } },
        de: { price: 2250000, beds: 4, baths: 3 }, de_listing_id: '9001', drive_folder: 'GVC - New York/Building Information/100 Example St/4A', folder_state: 'linked',
        asana_gid: '1201', asana: { gid: '1201', permalink: 'https://app.asana.com/0/1/1201', status: 'Active', stageFromStatus: 'Live', pointPerson: 'JG/KC/CB', checklist: [
          { block: 'prep', steps: [{ name: 'Create Show Sheet', done: true, doneOn: '2026-10-12', who: 'Ayuen' }, { name: 'Brand Floor Plan', done: false },
            { name: 'Advertising Spots', done: true, doneOn: '2026-10-13' }, { name: 'Send Just Listed Email', done: false }] }] },
        match: { list: [], dismissed: {} },
        details_doc: { file: '100 Example St 4A details.docx', size: 1234, modified: '2026-10-10T10:00:00.000Z', readAt: '2026-10-11T09:00:00.000Z', found: ['price'] },
        photo_hero: 'Photos/Edited/03.jpg', photo_order: ['Photos/Edited/03.jpg', 'Photos/Edited/99.jpg'],
        scan: { weeks: [], found: {}, scannedAt: iso(NOW - 0.4 * 864e5), folderUrl: 'https://drive.google.com/drive/folders/FOLDER1',
          pieces: { showsheet: [{ name: 'Showsheet - 100 Example St 4A - 2026-10-12.pdf', modified: '2026-10-12T10:00:00.000Z', archived: false, url: 'https://drive.google.com/file/d/SS1/view' }],
            floorplan: [{ name: 'Floorplan - 100 Example St 4A v2.pdf', modified: '2026-10-09T10:00:00.000Z', archived: false, url: 'https://drive.google.com/file/d/FP2/view' }] },
          health: { notes: [{ code: 'pieceAtTop', text: 'A brochure file sits loose at the top of the folder. The standard keeps it in its own folder.' }],
            counts: { photos: { edited: 6, staged: 1, print: 0, web: 0, raw: 2 }, looseTop: 1 } },
          detailsDoc: { name: '100 Example St 4A details.docx', size: 1234, modified: '2026-10-10T10:00:00.000Z' } } },
      { id: 'p2', slug: '20-sample-ave-7b', label: 'y', kind: 'sale', market: 'NYC', stage: 'Archived', stage_source: 'Matt', version: 2,
        core: { address: '20 Sample Ave', unit: '7B', agentIds: ['katie-cook', 'gone-agent'], agentsConfirmed: { from: ['katie-cook'], on: '2026-09-01', by: 'Matt Bloomfield' } },
        folder_state: 'unlinked', asana_gid: '1202', asana: { gid: '1202', stageFromStatus: 'Live', pointPerson: 'KC' } },
      { id: 'p3', slug: 'evil', label: 'e', kind: 'sale', market: 'FL', stage: 'Prep', stage_source: 'seed', version: 1,
        core: { address: '<img src=x onerror="window.__xss=1">', unit: '"><b>', agentIds: ['<img src=y onerror="window.__xss=2">'],
          facts: { headline: { value: '<script>window.__xss=3</script>', source: 'Matt', bySource: { Matt: '<script>window.__xss=3</script>' } } } },
        folder_state: 'linked', drive_folder: 'q' }
    ],
    pitches: [{ id: 'q1', slug: '90-pitch-st-11b', label: '90 Pitch St 11B', market: 'NYC', pitched_on: '2026-08-04', outcome: 'open', version: 3,
      asana_gid: '1301', core: { address: '90 Pitch St', unit: '11B', suggestedAgentIds: ['elyse-gutman'] }, folder_state: 'linked', drive_folder: 'z' }],
    dev_projects: [{ id: 'd1', slug: '619-example-ave', label: '619 Example Ave', market: 'NJ', version: 4, folder_state: 'linked', drive_folder: 'v', asana_project_gid: '1300',
      milestones: { agreement: { done: true, on: '2026-01-10', source: 'Matt' }, landClosed: { done: true, on: '2026-02-01', asanaGid: 'g1', confirmedBy: 'Matt Bloomfield' } },
      asana_map: {}, milestone_hints: [],
      next_milestone: { key: 'permits', dueOn: ymd(NOW + 12 * 864e5), slips: { g1: { count: 2, days: 9 } }, construction: { done: 3, total: 12 } } }],
    floorplans: [{ id: 'f1', property_id: 'p1', version: 3, layout: 'current', note: 'Move the kitchen door', asked_by: 'Katie Cook', created_at: iso(NOW - 2 * 864e5) }],
    changes: [
      { id: 'c1', property_id: 'p1', at: iso(NOW - 3 * 864e5), field: 'beds', old_value: 3, new_value: 4, source: 'Matt', no_rebuild: true },
      { id: 'c2', property_id: 'p1', at: iso(NOW - 2 * 864e5), field: null, note: 'Katie says the price drops Friday', asked_by: 'Katie Cook', source: 'Matt' },
      { id: 'c3', property_id: 'p1', at: iso(NOW - 864e5), field: 'agentIds', old_value: [], new_value: ['katie-cook'], source: 'Matt' }
    ]
  };
}

/* A fake GVC_DRIVE served in place of assets/js/drive.js: a made-up job folder, deliberately RAW
   (paperwork loose at the top, an Offers folder, paperwork files inside Marketing and Photos), so the
   page's own filtering is what keeps paperwork names off the page. One file never arrives. */
const FAKE_DRIVE = `(function () {
  var cfg = window.__FAKE_DRIVE || {};
  var PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), function (c) { return c.charCodeAt(0); });
  function f(name, day, size) { return { name: name, kind: 'file', size: size || 1000, modified: '2026-10-' + day + 'T10:00:00.000Z' }; }
  function d(name, children) { return { name: name, kind: 'directory', children: children }; }
  var tree = d('4A', [
    f('Exclusive - Jane Client.pdf', '02'), f('Brochure draft.pdf', '03'), f('100 Example St 4A details.docx', '10', 1234),
    d('Offers', [f('Offer from Jane Client.pdf', '05')]), d('Docs', [f('Contract.pdf', '01')]),
    d('Marketing', [f('Offer from Jane Client.pdf', '06'), d('Showsheet', [f('Showsheet - 100 Example St 4A - 2026-10-12.pdf', '12'),
      d('Archive', [f('Showsheet - 100 Example St 4A - 2026-09-14.pdf', '01')])])]),
    d('Floorplan', [d('v1', [f('Floorplan - 100 Example St 4A.pdf', '04')]), d('v2', [f('Floorplan - 100 Example St 4A v2.pdf', '09'), f('Floorplan unbranded v2.pdf', '09')])]),
    d('Video', [f('GVC Video Clips.m4v', '05'), f('GVC Video Clips.m4v.xmpses.xmp', '11'), f('desktop.ini', '11')]),
    d('Photos', [d('Edited', ['01', '02', '03', '04', '05', '06'].map(function (n) { return f(n + '.jpg', '08'); }).concat([f('Signed contract Jane Client.jpg', '08'), f('Thumbs.db', '12'), f('._01.jpg', '12'), f('03.jpg.xmp', '12')])),
      d('Staged', [f('03.jpg', '09')]), d('Raw', [f('IMG_1.CR3', '07'), f('IMG_2.CR3', '07')])])
  ]);
  if (cfg.noSheet) tree.children = tree.children.filter(function (c) { return c.name !== 'Marketing'; });
  if (cfg.design) tree.children.filter(function (c) { return c.name === 'Floorplan'; })[0].children.push(d('Design', [f('cubicasa.png', '20'), f('architect.pdf', '22'), f('Signed contract plan.pdf', '22')]));
  if (cfg.html) tree.children.push(d('Signage', [f('Signage - 100 Example St 4A.html', '11')]));
  var log = window.__driveLog ={ tree: 0, list: [], read: [], inflight: 0, max: 0 };
  function find(path) {
    var node = tree;
    String(path).split('/').filter(Boolean).forEach(function (seg) {
      node = node && (node.children || []).filter(function (c) { return c.name === seg; })[0];
    });
    return node;
  }
  window.GVC_DRIVE = {
    supported: function () { return true; },
    state: function () { return Promise.resolve(cfg.state || 'connected'); },
    connect: function () { return Promise.resolve([]); }, reconnect: function () { return Promise.resolve(true); },
    list: function () { return Promise.resolve([]); }, relPathOf: function () { return Promise.resolve(null); },
    tree: function () { log.tree++; return Promise.resolve(JSON.parse(JSON.stringify(tree))); },
    listJob: function (folder, sub) {
      log.list.push(sub);
      var n = find(sub);
      if (!n || n.kind !== 'directory') { var e = new Error('not found'); e.name = 'NotFoundError'; return Promise.reject(e); }
      return Promise.resolve(n.children.map(function (c) { return { name: c.name, kind: c.kind, size: c.size, modified: c.modified }; }));
    },
    readJobFile: function (folder, path) {
      log.read.push(path);
      if (path === (cfg.slow || 'Photos/Edited/05.jpg')) return new Promise(function () {});
      log.inflight++; log.max = Math.max(log.max, log.inflight);
      return new Promise(function (res) {
        setTimeout(function () {
          log.inflight--;
          res(/docx$/.test(path) ? new File([new Uint8Array([80, 75, 3, 4])], path) : new File([PNG], path.split('/').pop(), { type: 'image/png' }));
        }, 60);
      });
    }
  };
})();`;
/* mammoth: the CDN is never asked (SRI would refuse a fake body anyway); an init script stands in for it */
const DOC_HTML = '<p>100 Example St - 4A</p><table><tr><td>Price</td><td>$2,350,000</td></tr><tr><td>Maintenance/CC</td><td>$1,900/mo</td></tr></table>';
const MAMMOTH_URL = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';

async function open(browser, opts) {
  const ctx = await browser.newContext(opts.phone ? { viewport: { width: 375, height: 812 } } : {});
  if (opts.drive) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  const errors = [], saves = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  await page.addInitScript(() => localStorage.setItem('gvc.collapse.all', 'open'));   // every card open: these tests read inside them
  await page.addInitScript(() => { delete window.showDirectoryPicker; });
  await page.route(MAMMOTH_URL, r => r.abort());
  if (opts.staleThrows) await page.route('**/assets/js/piece-stale.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.GVC_STALE = { stale: function () { throw new Error("bad record"); }, words: function () { return ""; } };' }));
  if (opts.drive) {
    await page.addInitScript(([cfg, html]) => {
      window.__FAKE_DRIVE = cfg;
      window.GVC_JP_TIMEOUT_MS = 300;
      window.__mammothCalls = 0;
      window.mammoth = { convertToHtml: () => { window.__mammothCalls++; return Promise.resolve({ value: html }); } };
    }, [opts.drive, opts.docHtml || DOC_HTML]);
    await page.route('**/assets/js/drive.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_DRIVE }));
  }
  const T = opts.rows || rowsFor();
  await page.route('**/rest/v1/**', r => {
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), m = r.request().method();
    if (table === 'members') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.members || [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }]) });
    if (table === 'documents' && opts.documentsFail) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'column documents.built_from does not exist' }) });
    if (table === 'save_job') {
      const body = JSON.parse(r.request().postData() || '{}');
      saves.push(body);
      if (opts.conflict) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'conflict' }) });
      const row = (T[body.p_table] || []).find(x => x.id === body.p_id) || {};
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({}, row, body.p_set, { version: row.version + 1 })) });
    }
    if (m !== 'GET') { writes.push(m + ' ' + table + ' ' + (r.request().postData() || '')); return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    const eqs = [...u.searchParams].filter(([, v]) => /^eq\./.test(v)).map(([k, v]) => [k, v.slice(3)]);
    const hit = row => eqs.every(([k, v]) => String(row[k]) === v);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify((T[table] || []).filter(hit)) });
  });
  await page.route('**/auth/v1/user', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', email: 'matt@example.com' }) }));
  await page.route('http://localhost:47610/**', r => r.abort());
  await page.goto(BASE + opts.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { page, errors, saves, writes, ctx };
}
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const settle = page => page.waitForTimeout(400);
const LISTING = '/workspace/job/?listing=100-example-st-4a';

(async () => {
  const browser = await chromium.launch();
  let t, p, s;

  /* ---------- facts ---------- */
  t = await open(browser, { path: LISTING });
  p = t.page;
  check('facts: no page errors', t.errors, []);
  check('facts: warning sign, DE says', await text(p, 'tr[data-fact="price"] .fw'), 'DE says $2,250,000');
  check('facts: the other source on a quiet line', await text(p, 'tr[data-fact="price"] .fo'), 'Asana says $2,300,000');
  check('facts: badges', [await text(p, 'tr[data-fact="price"] .chip'), await text(p, 'tr[data-fact="sqft"] .chip')], ['Matt', 'Asana']);
  check('facts: the tile shows the job\'s price with its warning', [(await text(p, '.facts')).includes('$2,400,000'), (await text(p, '.facts')).includes('DE says $2,250,000')], [true, true]);
  check('facts: extras closed with a count', [await p.$eval('details.fx', d => d.open), (await text(p, 'details.fx summary'))], [false, 'Extras · 0 filled']);
  await p.click('tr[data-fact="price"] [data-edit]');
  check('facts: DE-held field says so', (await text(p, '.fed')).includes('DE has this. Yours holds until DE\'s own value changes'), true);
  await p.fill('#fIn', 'lots');
  await p.click('#fSave');
  check('facts: a weird value is refused with a sentence', [await text(p, '#fMsg'), t.saves.length], ['Type a number, like 2250000 or $2.25M.', 0]);
  await p.fill('#fIn', '$2.1M');
  await p.click('#fSave');
  await settle(p);
  check('facts: one save_job call', t.saves.length, 1);
  s = t.saves[0] || {};
  check('facts: price save', [s.p_table, s.p_id, s.p_version, s.p_set && s.p_set.core.price, s.p_set && s.p_set.core.facts.price.source, s.p_set && s.p_set.core.facts.price.bySource.DE],
    ['properties', 'p1', 7, 2100000, 'Matt', 2250000]);
  check('facts: one change, the price', (s.p_changes || []).map(c => [c.field, c.old_value, c.new_value, c.no_rebuild]), [['price', 2400000, 2100000, false]]);
  check('facts: only core is sent', Object.keys(s.p_set || {}), ['core']);
  check('facts: editor closed after the save', await p.$$eval('#fIn', e => e.length), 0);
  // typo tick
  await p.click('tr[data-fact="sqft"] [data-edit]');
  await p.fill('#fIn', '1,550');
  await p.check('#fTypo');
  await p.click('#fSave');
  await settle(p);
  s = t.saves[1] || {};
  check('facts: Typo, no rebuild', (s.p_changes || []).map(c => [c.field, c.new_value, c.no_rebuild]), [['sqft', 1550, true]]);
  // baths: 3.5 is 3 baths and 1 half
  await p.click('tr[data-fact="baths"] [data-edit]');
  await p.fill('#fIn', '3.5');
  await p.click('#fSave');
  await settle(p);
  s = t.saves[2] || {};
  check('facts: 3.5 baths saves baths and half baths', (s.p_changes || []).map(c => [c.field, c.new_value]), [['baths', 3], ['halfBaths', 1]]);
  check('facts: half baths kept as Matt\'s too', s.p_set && [s.p_set.core.baths, s.p_set.core.halfBaths, s.p_set.core.facts.halfBaths.source], [3, 1, 'Matt']);
  // Clear: Matt's beds dropped, Asana's back
  await p.click('tr[data-fact="beds"] [data-edit]');
  await p.click('#fClear');
  await settle(p);
  s = t.saves[3] || {};
  check('facts: Clear sends Asana\'s value back', s.p_set && [s.p_set.core.beds, s.p_set.core.facts.beds.source, 'Matt' in s.p_set.core.facts.beds.bySource], [3, 'Asana', false]);
  check('facts: Clear logged', (s.p_changes || []).map(c => [c.field, c.old_value, c.new_value, c.note]), [['beds', 4, 3, 'Cleared; back to Asana\'s value.']]);
  // empty text means Clear
  await p.click('tr[data-fact="beds"] [data-edit]');
  await p.fill('#fIn', '');
  await p.click('#fSave');
  await settle(p);
  s = t.saves[4] || {};
  check('facts: empty text is Clear', s.p_set && s.p_set.core.beds, 3);
  // change log words
  check('log: worded by changeTitle, newest first', await p.$$eval('#changeLog li > div', els => els.map(e => e.childNodes[0].textContent)),
    ['Agents: Katie Cook', 'Katie says the price drops Friday', 'Beds 3 → 4']);
  check('log: who asked and the typo mark', [(await text(p, '#changeLog')).includes('Asked by Katie Cook.'), (await text(p, '#changeLog')).includes('Typo, no rebuild.')], [true, true]);
  // a note
  await p.fill('#noteText', 'Katie says the price drops Friday');
  await p.selectOption('#noteWho', 'Katie Cook');
  await p.click('#noteAdd');
  await settle(p);
  s = t.saves[5] || {};
  check('note: a change with no field', [s.p_table, JSON.stringify(s.p_set), (s.p_changes || []).map(c => [c.field, c.note, c.asked_by])],
    ['properties', '{}', [[null, 'Katie says the price drops Friday', 'Katie Cook']]]);
  // the header (tune-ups 3): Link Google Drive / Asana / DE, green Relink once linked; no Copy or Archive buttons
  check('header: Open in Asana, no copy or archive buttons', [await p.$eval('#asanaLink', a => a.getAttribute('href')), await p.$$eval('#copyLink, #copy, #archive', e => e.length)], ['https://app.asana.com/0/1/1201', 0]);
  check('header: the three link buttons', await p.$$eval('.acts .lk', bs => bs.map(b => [b.id, b.textContent.trim(), b.classList.contains('ok')])),
    [['link', 'Relink Google Drive', true], ['linkAsana', 'Relink Asana', true], ['linkDe', 'Relink DE', true]]);
  check('facts: no page errors after saving', t.errors, []);
  await t.ctx.close();

  /* conflict keeps the typed value */
  t = await open(browser, { path: LISTING, conflict: true });
  p = t.page;
  await p.click('tr[data-fact="price"] [data-edit]');
  await p.fill('#fIn', '$2.1M');
  await p.click('#fSave');
  await settle(p);
  check('conflict keeps the typed value', [await text(p, '#fMsg'), await p.$eval('#fIn', i => i.value).catch(() => null)],
    ['This job changed a moment ago. Reloaded; try again.', '$2.1M']);
  check('conflict: the job was read again', t.saves.length, 1);
  await t.ctx.close();

  /* ---------- agents ---------- */
  t = await open(browser, { path: LISTING });
  p = t.page;
  check('agents: Asana suggests, with the initials', (await text(p, '#agentsCard .asug')), 'Asana suggests John Gasdaska, Katie Cook (from JG/KC/CB). Confirm?');
  check('agents: why CB is not suggested', (await text(p, '#agentsCard .awhy')).includes('CB could be more than one person'), true);
  await p.click('#agConfirm');
  await settle(p);
  s = t.saves[0] || {};
  const c0 = (s.p_set && s.p_set.core) || {};
  check('agents: Confirm saves the suggestion', [c0.agentIds, c0.agentsConfirmed && c0.agentsConfirmed.from, c0.agentsConfirmed && c0.agentsConfirmed.by, c0.agentsConfirmed && c0.agentsConfirmed.on],
    [['john-gasdaska', 'katie-cook'], ['john-gasdaska', 'katie-cook'], 'Matt Bloomfield', ymd(NOW)]);
  check('agents: logged', (s.p_changes || []).map(c => [c.field, c.new_value]), [['agentIds', ['john-gasdaska', 'katie-cook']]]);
  // change the list: reorder, add someone from another market
  await p.click('#agChange');
  await p.click('#agentsCard [data-down="0"]');
  check('agents: picker shows the job market first', [(await text(p, '.apick')).includes('Elyse Gutman'), (await text(p, '.apick')).includes('Marli Silver')], [true, false]);
  await p.click('#agAll');
  await p.click('#agentsCard [data-add="marli-silver"]');
  await p.fill('#agSearch', 'gut');
  check('agents: search narrows the list', await p.$$eval('.apick [data-add]', els => els.map(e => e.dataset.add)), ['elyse-gutman']);
  await p.click('#agSave');
  await settle(p);
  s = t.saves[1] || {};
  check('agents: change list reorder', s.p_set && s.p_set.core.agentIds, ['katie-cook', 'john-gasdaska', 'marli-silver']);
  await t.ctx.close();

  t = await open(browser, { path: '/workspace/job/?listing=20-sample-ave-7b' });
  p = t.page;
  check('agents: unknown id shown with ×', [(await text(p, '#agentsCard')).includes('Unknown agent (gone-agent)'), await p.$$eval('[data-drop="gone-agent"]', e => e.length)], [true, 1]);
  await p.click('[data-drop="gone-agent"]');
  await settle(p);
  check('agents: × removes the unknown id', t.saves[0] && t.saves[0].p_set.core.agentIds, ['katie-cook']);
  await t.ctx.close();

  /* ---------- a teammate: read-only, note box ---------- */
  t = await open(browser, { path: LISTING, members: [{ name: 'Katie Cook', initials: 'KC', role: 'team' }] });
  p = t.page;
  check('team: no edit controls', [await p.$$eval('[data-edit], #agConfirm, #agChange, #archive, [data-drop]', e => e.length)], [0]);
  check('team: note box present', await p.$$eval('#noteText', e => e.length), 1);
  await p.fill('#noteText', 'Seller asked about Friday');
  await p.click('#noteAdd');
  await settle(p);
  check('team: a note saves', t.saves.map(x => [JSON.stringify(x.p_set), x.p_changes[0].field, x.p_changes[0].note]), [['{}', null, 'Seller asked about Friday']]);
  check('team: the note row is a note and nothing else (save_job refuses more)', t.saves.map(x => Object.keys(x.p_changes[0]).sort()), [['asked_by', 'note']]);
  await t.ctx.close();
  t = await open(browser, { path: LISTING, members: [] });
  check('not on the team: no note box, no edits', await t.page.$$eval('#noteText, [data-edit], #agConfirm', e => e.length), 0);
  await t.ctx.close();

  /* ---------- pitch ---------- */
  t = await open(browser, { path: '/workspace/job/?pitch=90-pitch-st-11b' });
  p = t.page;
  check('pitch: date and outcome read-only', [(await text(p, '.facts')).includes('4 Aug 2026'), (await text(p, '.facts')).includes('Open'), await p.$$eval('[data-edit], #factsCard', e => e.length)], [true, true, 0]);
  check('pitch: no Archive', await p.$$eval('#archive', e => e.length), 0);
  await p.click('#agConfirm');
  await settle(p);
  check('pitch: agents editable', t.saves[0] && [t.saves[0].p_table, t.saves[0].p_version, t.saves[0].p_set.core.agentIds], ['pitches', 3, ['elyse-gutman']]);
  check('pitch: no page errors', t.errors, []);
  await t.ctx.close();

  /* ---------- development ---------- */
  t = await open(browser, { path: '/workspace/job/?dev=619-example-ave' });
  p = t.page;
  check('dev: 18 milestones', await p.$$eval('#msList li', e => e.length), 18);
  check('dev: slips on the milestone', (await text(p, 'li[data-ms="landClosed"]')).includes('re-dated 2 times, +9 days'), true);
  await p.click('[data-tick="permits"]');
  check('dev: the date starts at today', await p.$eval('#msDate', i => i.value), ymd(NOW));
  await p.fill('#msDate', '2026-10-03');
  await p.click('#msSave');
  await settle(p);
  s = t.saves[0] || {};
  const pm = (s.p_set && s.p_set.milestones && s.p_set.milestones.permits) || {};
  check('dev: tick by hand with a date', [s.p_table, s.p_version, pm.done, pm.on, pm.source, pm.confirmedBy, s.p_set && !!s.p_set.milestones.agreement],
    ['dev_projects', 4, true, '2026-10-03', 'Matt', 'Matt Bloomfield', true]);
  check('dev: tick logged', (s.p_changes || []).map(c => [c.field, c.note]), [['milestones', 'Permits / zoning ticked by hand: 3 Oct.']]);
  await p.click('[data-untick="agreement"]');
  await settle(p);
  s = t.saves[1] || {};
  check('dev: untick', [s.p_set && 'agreement' in s.p_set.milestones, s.p_set && !!s.p_set.milestones.landClosed, (s.p_changes || []).map(c => [c.field, c.new_value, c.note])],
    [false, true, [['milestones', null, 'Agreement unticked.']]]);
  await t.ctx.close();
  t = await open(browser, { path: '/workspace/job/?dev=619-example-ave', members: [{ name: 'Katie Cook', initials: 'KC', role: 'team' }] });
  check('dev: no ticks for a teammate', await t.page.$$eval('[data-tick], [data-untick]', e => e.length), 0);
  await t.ctx.close();
  /* final review 3: Asana's suggestions and the folder link are the owner's */
  const RH = rowsFor();
  RH.dev_projects[0].milestone_hints = [{ key: 'permits', date: '2026-10-01', source: 'Asana', asanaGid: 'g9' }];
  t = await open(browser, { rows: RH, path: '/workspace/job/?dev=619-example-ave' });
  check('owner: suggestion buttons and folder link', await t.page.$$eval('#hints [data-ok], #hints [data-no], #link', e => e.length), 3);
  await t.ctx.close();
  for (const path of ['/workspace/job/?dev=619-example-ave', LISTING]) {
    t = await open(browser, { rows: RH, path, members: [{ name: 'Katie Cook', initials: 'KC', role: 'team' }] });
    check('team: no suggestion buttons, no Link / Change / Relink folder: ' + path, await t.page.$$eval('[data-ok], [data-no], #link', e => e.length), 0);
    check('team: no page errors: ' + path, t.errors, []);
    await t.ctx.close();
  }

  /* ---------- Drive cards (Task 8), Drive connected, the owner ---------- */
  const FOLDER = 'GVC - New York/Building Information/100 Example St/4A';
  const allText = page => page.evaluate(() => document.body.innerHTML + ' ' + document.body.innerText);
  t = await open(browser, { path: LISTING, drive: {} });
  p = t.page;
  await p.waitForSelector('#kitCard .kr');
  await p.waitForSelector('#folderBody .tree');
  /* folder tree and health */
  const fb = await text(p, '#folderBody');
  check('folder: readable folders in the tree', ['Floorplan\\', 'Marketing\\', 'Photos\\'].map(n => fb.includes(n)), [true, true, true]);
  check('folder: two levels open, deeper closed', [await p.$$eval('#folderBody .tree > details, #folderBody .tree > details > .tri > details', ds => ds.length > 3 && ds.every(d => d.open)),
    await p.$$eval('#folderBody .tri .tri details', ds => ds.length > 0 && ds.every(d => !d.open))], [true, true]);
  check('folder: Docs never read, Offers only counted', [fb.includes('Docs\\ · never read'), fb.includes('1 paperwork folder · never read'), fb.includes('Offers')], [true, true, false]);
  check('folder: loose top files a count only', /Loose files at the top ?1, not read/.test(fb), true);
  check('folder: health note from the tree', (await text(p, '#folderBody [data-note="pieceAtTop"]')) || '', 'A brochure file sits loose at the top of the folder. The standard keeps it in its own folder.');
  check('folder: the tree is read once for every card', await p.evaluate(() => window.__driveLog.tree), 1);
  /* the marketing track */
  check('kit: eight rows (Slice 5 adds the Seller pitch)', await p.$$eval('#kitCard .kr', e => e.length), 8);
  const kit = async key => text(p, '#kitCard [data-kit="' + key + '"]');
  check('kit: showsheet done, Asana ticked', [(await kit('showsheet')).includes('Done'), (await kit('showsheet')).includes('Asana: Create Show Sheet, ticked 12 Oct by Ayuen'), (await kit('showsheet')).includes('1 older')], [true, true, true]);
  check('kit: floorplan file, Asana open', [(await kit('floorplan')).includes('File, Asana open'), (await kit('floorplan')).includes('Asana: Brand Floor Plan, open')], [true, true]);
  check('kit: brochure says there is no Asana step', (await kit('brochure')).includes('No Asana step for this piece'), true);
  check('kit: signage not used in NYC, video tracked', [(await kit('signage')).includes('Not used here'), (await kit('video')).includes('Tracked only')], [true, true]);
  check('kit: the video piece is the film, never its sidecar (tune-up 3)', [(await kit('video')).includes('GVC Video Clips.m4v ·'), /xmp|desktop\.ini/i.test(await kit('video'))], [true, false]);
  check('kit: checklist only', await p.$$eval('#kitCard .ck-block li', els => els.map(e => e.textContent.replace(/\d+ \w+$/, '').trim())), ['Advertising Spots', 'Send Just Listed Email']);
  check('kit: count', await text(p, '#kitCount'), '3 of 5 done');
  const links = [];
  await p.route('http://localhost:47610/drive-link', r => { links.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"url":"https://drive.google.com/file/d/SS1live/view"}' }); });
  await p.click('#kitCard [data-kit="showsheet"] [data-copy]');
  await settle(p);
  check('kit: Copy Drive link asks the helper for the file', links, [{ folder: FOLDER, file: 'Marketing/Showsheet/Showsheet - 100 Example St 4A - 2026-10-12.pdf' }]);
  check('kit: the link is copied', [await text(p, '#kitMsg'), await p.evaluate(() => navigator.clipboard.readText())], ['Copied the Drive link.', 'https://drive.google.com/file/d/SS1live/view']);
  /* floorplans */
  check('floorplans: versions down, the recorded one first', await p.$$eval('#fpCard .ver', els => els.map(e => e.dataset.ver)), ['3', '2', '1']);
  check('floorplans: a recorded version with no file yet', (await text(p, '#fpCard .ver[data-ver="3"]')).includes('no file yet'), true);
  check('floorplans: v2 branded and unbranded, no blank sheet', await p.evaluate(() => {
    const cells = [...document.querySelectorAll('#fpCard .fpm > *')], i = cells.findIndex(c => c.dataset && c.dataset.ver === '2');
    return cells.slice(i + 1, i + 4).map(c => c.classList.contains('empty') ? 'none' : c.title);
  }), ['Floorplan - 100 Example St 4A v2.pdf', 'Floorplan unbranded v2.pdf', 'none']);
  check('floorplans: MLS-safe label', (await text(p, '#fpCard .fpm')).includes('Unbranded (MLS-safe)'), true);
  check('floorplans: Unbranded and Branded folders fill their columns, Design skipped', await p.evaluate(() => {
    const F = (path, modified) => ({ path, name: path.split('/').pop(), modified });
    const g = window.GVC_JP.floorplans.group([
      F('Floorplan/v4/x v4.jpg', '2026-10-20'),
      F('Floorplan/Unbranded/x v5.png', '2026-10-26'), F('Floorplan/Unbranded/x v5.svg', '2026-10-25'),
      F('Floorplan/Unbranded/x v5 - Second Floor.png', '2026-10-27'),
      F('Floorplan/Branded/x v5.svg', '2026-10-25'), F('Floorplan/Branded/x v5.png', '2026-10-26'),
      F('Floorplan/Design/plan.json', '2026-10-26'), F('Floorplan/Design/cubicasa v9.png', '2026-10-26'), F('Floorplan/Design/alt option v8.jpg', '2026-10-26')
    ]);
    const v5 = g.versions[5] || {};
    return [Object.keys(g.versions), (v5.branded || {}).path, (v5.unbranded || {}).path, !!v5.blank, g.alternates.length, (g.versions[4] || {}).branded && g.versions[4].branded.path];
  }), [['4', '5'], 'Floorplan/Branded/x v5.svg', 'Floorplan/Unbranded/x v5.svg', false, 0, 'Floorplan/v4/x v4.jpg']);
  await p.click('#fpNew');
  await p.fill('#fpNote', 'Swap the bedroom labels');
  await p.selectOption('#fpWho', 'Katie Cook');
  await p.click('#fpSave');
  await settle(p);
  const fpPost = t.writes.find(w => /^POST floorplans /.test(w)) || '';
  check('floorplans: Record new version adds a floorplans row', JSON.parse(fpPost.slice('POST floorplans '.length) || '{}'),
    { property_id: 'p1', version: 4, layout: 'current', note: 'Swap the bedroom labels', asked_by: 'Katie Cook' });
  s = t.saves.find(x => (x.p_changes || []).some(c => c.field === 'floorplan')) || {};
  check('floorplans: and a change-log row through save_job', [s.p_table, JSON.stringify(s.p_set), s.p_changes], ['properties', '{}', [{ field: 'floorplan', new_value: { version: 4, note: 'Swap the bedroom labels' }, asked_by: 'Katie Cook' }]]);
  /* Make Floorplan: the reason with no Design files, then the exact prompt with some */
  check('prompt: button present', await p.$$eval('#fpMake', e => e.length), 1);
  await p.click('#fpMake');
  check('prompt: no Design files shows the reason', await text(p, '#fpReason'), 'There is nothing in Floorplan\\Design yet. Drop the reference (Cubicasa file, screenshot, architect\'s PDF or DWG) there.');
  const t2 = await open(browser, { path: LISTING, drive: { design: true } });
  const p2 = t2.page;
  await p2.waitForSelector('#fpCard .ver');
  await p2.click('#fpMake');
  const dd = d => { const x = new Date(d), q = n => String(n).padStart(2, '0'); return x.getFullYear() + '-' + q(x.getMonth() + 1) + '-' + q(x.getDate()); };
  check('prompt: the textarea holds the exact text', await p2.$eval('#fpText', e => e.value), [
    'Make the floorplan for x (NYC, sale, 4 bed).', '',
    'Floorplan folder: G:\\Shared drives\\GVC - New York\\Building Information\\100 Example St\\4A\\Floorplan',
    'References in Design\\:',
    '- cubicasa.png (modified ' + dd('2026-10-20T10:00:00.000Z') + ')', '- architect.pdf (modified ' + dd('2026-10-22T10:00:00.000Z') + ')',
    'Save as version v4.', '', 'Use the making-gvc-floorplans skill.'].join('\n'));
  await p2.click('#fpCopy');
  await p2.waitForFunction(() => document.querySelector('#fpCopy').textContent === 'Copied', null, { timeout: 3000 }).catch(() => {});
  check('prompt: Copy reads Copied and the clipboard has the text', [await text(p2, '#fpCopy'), (await p2.evaluate(() => navigator.clipboard.readText())).startsWith('Make the floorplan for x')], ['Copied', true]);
  await t2.ctx.close();
  /* photos */
  await p.$eval('#photosCard', e => e.scrollIntoView());
  await p.waitForFunction(() => document.querySelectorAll('#phGrid img').length >= 5 && /downloaded/.test(document.querySelector('#phGrid').textContent), null, { timeout: 5000 }).catch(() => {});
  check('photos: sets with counts, raws a count only', await p.$$eval('#photosCard .phs > *', els => els.map(e => e.textContent.trim())), ['Edited6', 'Staged1', 'Raws2']);
  check('photos: the edited grid', await p.$$eval('#phGrid [data-ph]', els => els.map(e => e.dataset.ph.split('/').pop())), ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg']);
  check('photos: thumbnails four at a time', await p.evaluate(() => [window.__driveLog.max <= 4, window.__driveLog.max >= 2]), [true, true]);
  check('slow file times out on its own tile', [await text(p, '#phGrid [data-ph="Photos/Edited/05.jpg"] .pi'), await p.$$eval('#phGrid img', e => e.length)],
    ['Drive hasn\'t downloaded this yet.', 5]);
  check('photos: the hero and a pick missing on Drive', [await text(p, '#phPicks .phh'), (await text(p, '#phPicks [data-pk="Photos/Edited/99.jpg"]')).includes('Missing on Drive'),
    (await text(p, '#phPicks [data-pk="Photos/Edited/03.jpg"]')).includes('Missing')], ['Hero: 03.jpg', true, false]);
  await p.click('#phGrid [data-ph="Photos/Edited/01.jpg"] [data-pick]');
  await p.click('#phGrid [data-ph="Photos/Edited/02.jpg"] [data-hero]');
  await p.click('#phPicks [data-up="2"]');
  check('photos: picks reorder', await p.$$eval('#phPicks [data-pk]', els => els.map(e => e.dataset.pk.split('/').pop())), ['03.jpg', '01.jpg', '99.jpg']);
  await p.click('#phSave');
  await settle(p);
  s = t.saves.find(x => x.p_set && 'photo_order' in x.p_set) || {};
  check('photos: Save picks saves hero and order', [s.p_set && s.p_set.photo_hero, s.p_set && s.p_set.photo_order],
    ['Photos/Edited/02.jpg', ['Photos/Edited/03.jpg', 'Photos/Edited/01.jpg', 'Photos/Edited/99.jpg']]);
  check('photos: one change-log line', (s.p_changes || []).map(c => c.field), ['photo_order']);
  /* the details doc: unchanged, so not read on open; Read details doc reads it anyway */
  check('doc: unchanged file not read on open', [await p.evaluate(() => window.__mammothCalls), await p.evaluate(() => window.__driveLog.read.filter(x => /docx$/.test(x)).length),
    (await text(p, '#docNow')).includes('unchanged')], [0, 0, true]);
  await p.click('#docRead');
  await settle(p);
  s = t.saves.find(x => x.p_set && x.p_set.details_doc) || {};
  const dc = (s.p_set && s.p_set.core) || {};
  check('doc: Read details doc reads it regardless', await p.evaluate(() => window.__mammothCalls), 1);
  check('doc: the record', s.p_set && [s.p_set.details_doc.file, s.p_set.details_doc.size, s.p_set.details_doc.modified, s.p_set.details_doc.found, !!s.p_set.details_doc.readAt],
    ['100 Example St 4A details.docx', 1234, '2026-10-10T10:00:00.000Z', ['address', 'unit', 'price', 'maintenance'], true]);
  check('doc: values at source doc, under the others', [dc.facts && dc.facts.maintenance, dc.facts && dc.facts.price.value, dc.facts && dc.facts.price.bySource.doc, dc.maintenance],
    [{ value: 1900, source: 'doc', bySource: { doc: 1900 } }, 2400000, 2350000, 1900]);
  check('doc: change rows only for what now shows', (s.p_changes || []).map(c => c.field), ['maintenance']);
  check('no paperwork name on the page', /Jane Client|Offer from/.test(await allText(p)), false);
  check('drive cards: no page errors', t.errors, []);
  await t.ctx.close();

  /* Open: a PDF opens as a blob with noopener; an .html piece is never opened as a blob */
  t = await open(browser, { path: LISTING, drive: { html: true } });
  p = t.page;
  await p.evaluate(() => {
    window.__opened = []; window.__blobs = [];
    const mk = URL.createObjectURL.bind(URL);
    URL.createObjectURL = b => { window.__blobs.push(b.type); return mk(b); };
    window.open = (u, n, f) => { window.__opened.push([String(u).slice(0, 5), n, f]); return null; };
    window.__urls = []; window.__revoked = []; window.__later = [];
    const mk2 = URL.createObjectURL;
    URL.createObjectURL = b => { const u = mk2(b); window.__urls.push(u); return u; };
    const rv = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = u => { window.__revoked.push(u); rv(u); };
    const st = window.setTimeout;
    window.setTimeout = function (fn, ms) { if (ms === 60000) { window.__later.push(fn); return 0; } return st.apply(window, arguments); };
  });
  await p.waitForSelector('#kitCard [data-kit="signage"] [data-open]');
  await p.click('#kitCard [data-kit="signage"] [data-open]');
  await settle(p);
  check('Open: an .html piece is never opened as a blob', [await p.evaluate(() => window.__blobs), await p.evaluate(() => window.__opened),
    await p.evaluate(() => window.__driveLog.read.filter(x => /html$/.test(x)).length), await text(p, '#kitMsg')], [[], [], 0, 'Open it from the folder in File Explorer.']);
  await p.click('#kitCard [data-kit="showsheet"] [data-open]');
  await settle(p);
  check('Open: a PDF opens as a blob, with noopener', [await p.evaluate(() => window.__blobs.length), await p.evaluate(() => window.__opened)], [1, [['blob:', '_blank', 'noopener']]]);
  check('Open: the blob URL is let go after 60 s', await p.evaluate(() => {
    const before = window.__revoked.length;
    window.__later.forEach(fn => fn());
    return [before, window.__later.length, window.__revoked.length === 1 && window.__revoked[0] === window.__urls[0]];
  }), [0, 1, true]);
  await t.ctx.close();

  /* the doc changed since the last read: read on open, once */
  let R8 = rowsFor();
  R8.properties[0].details_doc = null;
  t = await open(browser, { rows: R8, path: LISTING, drive: {} });
  await t.page.waitForTimeout(900);
  s = t.saves.find(x => x.p_set && x.p_set.details_doc) || {};
  check('doc: changed file read on open', [await t.page.evaluate(() => window.__mammothCalls), s.p_set && s.p_set.details_doc.file], [1, '100 Example St 4A details.docx']);
  check('doc: read once, not again after the reload', [await t.page.evaluate(() => window.__driveLog.read.filter(x => /docx$/.test(x)).length), t.saves.filter(x => x.p_set && x.p_set.details_doc).length], [1, 1]);
  await t.ctx.close();

  /* a doc still headed with another listing's address never renames the job: its
     address and unit are left out, the one an earlier read gave is dropped, the card warns */
  const R9 = rowsFor(), c9 = R9.properties[0].core;
  R9.properties[0].details_doc = null;
  c9.address = '340 East 23rd St'; c9.unit = '5M';
  c9.facts.address = { value: '340 East 23rd St', source: 'doc', bySource: { legacy: '100 Example St', doc: '340 East 23rd St' } };
  c9.facts.unit = { value: '5M', source: 'doc', bySource: { legacy: '4A', doc: '5M' } };
  t = await open(browser, { rows: R9, path: LISTING, drive: {}, docHtml: DOC_HTML.replace('100 Example St - 4A', '340 East 23rd St - 5M') });
  await t.page.waitForTimeout(900);
  s = t.saves.find(x => x.p_set && x.p_set.details_doc) || {};
  const c9s = (s.p_set && s.p_set.core) || {};
  check('doc, other address: the job keeps its own', [c9s.address, c9s.unit, c9s.facts && c9s.facts.address, c9s.facts && c9s.facts.unit],
    ['100 Example St', '4A', { value: '100 Example St', source: 'legacy', bySource: { legacy: '100 Example St' } }, { value: '4A', source: 'legacy', bySource: { legacy: '4A' } }]);
  check('doc, other address: recorded, its other facts read', s.p_set && [s.p_set.details_doc.mismatch, s.p_set.details_doc.found],
    [{ doc: '340 East 23rd St 5M', job: '100 Example St 4A' }, ['price', 'maintenance']]);
  check('doc, other address: logged', (s.p_changes || []).map(c => [c.field, c.new_value]), [['address', '100 Example St'], ['unit', '4A'], ['maintenance', 1900]]);
  await t.ctx.close();
  const R10 = rowsFor();
  R10.properties[0].details_doc.mismatch = { doc: '340 East 23rd St 5M', job: '100 Example St 4A' };
  t = await open(browser, { rows: R10, path: LISTING });
  check('doc, other address: the card warns', await text(t.page, '#docWarn'),
    'This doc names 340 East 23rd St 5M, not 100 Example St 4A, so its address was left out. Check the doc is the right one.');
  check('doc, other address: no page errors', t.errors, []);
  await t.ctx.close();

  /* a doc Drive won't serve: its card says so on its own, the rest keeps working */
  t = await open(browser, { rows: R8, path: LISTING, drive: { slow: '100 Example St 4A details.docx' } });
  await t.page.waitForTimeout(900);
  check('slow file times out: the doc card says so', await text(t.page, '#docMsg'), 'Drive hasn\'t downloaded this yet.');
  check('slow file times out: nothing saved, other cards fine', [t.saves.length, await t.page.$$eval('#kitCard .kr', e => e.length), await t.page.$$eval('#factsCard tr', e => e.length) > 5], [0, 8, true]);
  await t.ctx.close();

  /* a teammate on the desktop: everything read-only, the doc not read for them */
  t = await open(browser, { rows: R8, path: LISTING, drive: {}, members: [{ name: 'Katie Cook', initials: 'KC', role: 'team' }] });
  await t.page.waitForSelector('#kitCard .kr');
  await t.page.waitForTimeout(400);
  check('team: no Drive-card edits', [await t.page.$$eval('#fpNew, #docRead, [data-hero], [data-pick], [data-drop]', e => e.length), await t.page.evaluate(() => window.__mammothCalls), t.saves.length], [0, 0, 0]);
  await t.ctx.close();

  /* Drive not connected here: last night's scan */
  t = await open(browser, { path: LISTING, drive: { state: 'not-connected' } });
  p = t.page;
  check('scan: every Drive card says where it came from', await p.$$eval('#kitCard .scanl, #fpCard .scanl, #photosCard .scanl, #docCard .scanl, #folderCard .scanl', els => els.map(e => e.textContent.startsWith('From last night\'s scan'))), [true, true, true, true, true]);
  check('scan: the line', (await text(p, '#kitCard .scanl')).endsWith('Connect Drive on the desktop to see it live.'), true);
  check('scan: kit from the stored pieces', [(await text(p, '#kitCard [data-kit="showsheet"]')).includes('Done'), await p.$eval('#kitCard [data-kit="showsheet"] a', a => a.getAttribute('href')).catch(() => null)],
    [true, 'https://drive.google.com/file/d/SS1/view']);
  check('scan: health notes and counts', [(await text(p, '#folderBody')).includes('brochure file sits loose'), (await text(p, '#folderBody')).includes('edited 6 · raws 2')], [true, true]);
  check('scan: floorplans from the stored names', await p.$$eval('#fpCard .ver', els => els.map(e => e.dataset.ver)), ['3', '2']);
  check('scan: picks as names', [await text(p, '#phPicks .phh'), await p.$$eval('#phPicks [data-pk]', els => els.length)], ['Hero: 03.jpg', 2]);
  check('scan: doc card says when it was last read', (await text(p, '#docRec')).startsWith('Last read 11 Oct from 100 Example St 4A details.docx'), true);
  check('scan: Drive never touched', await p.evaluate(() => [window.__driveLog.tree, window.__driveLog.read.length]), [0, 0]);
  links.length = 0;
  await p.route('http://localhost:47610/drive-link', r => r.abort());
  await p.click('#kitCard [data-kit="showsheet"] [data-copy]');
  await settle(p);
  check('scan: Copy Drive link falls back to the stored link', await p.evaluate(() => navigator.clipboard.readText()), 'https://drive.google.com/file/d/SS1/view');
  check('scan: no page errors', t.errors, []);
  await t.ctx.close();

  /* the real drive.js walker over made-up handles: rules before any handle is opened */
  t = await open(browser, { path: LISTING });
  check('Drive reads wait 20 s by default', await t.page.evaluate(() => GVC_JP.drive.ms()), 20000);
  const walked = await t.page.evaluate(async () => {
    const opened = [], listed = [];
    const file = (name, day) => ({ kind: 'file', name, getFile: async () => { opened.push(name); return { size: 10, lastModified: Date.parse('2026-10-' + day + 'T10:00:00Z') }; } });
    const dir = (name, kids) => ({ kind: 'directory', name, values: () => { listed.push(name); return (async function* () { yield* kids; })(); },
      getDirectoryHandle: async n => { const k = kids.find(x => x.name === n && x.kind === 'directory'); if (!k) { const e = new Error('nf'); e.name = 'NotFoundError'; throw e; } return k; } });
    const root = dir('4A', [file('Exclusive - Jane Client.pdf', '02'), file('Brochure draft.pdf', '03'), file('4A details.docx', '10'),
      dir('Offers', [file('Offer from Jane Client.pdf', '05')]), dir('Old', [file('x.pdf', '01')]),
      dir('Marketing', [file('Offer from Jane Client.pdf', '06'), dir('Showsheet', [file('Showsheet 1.pdf', '12')]), dir('Docs', [file('Seller ID.pdf', '03')])]),
      dir('Photos', [dir('Edited', [file('e1.jpg', '08'), file('Thumbs.db', '09'), file('._e1.jpg', '09'), file('e1.jpg.xmp', '09'), file('~$notes.docx', '09')]),
        dir('Raw', [file('IMG_1.CR3', '07'), file('IMG_2.CR3', '07'), file('.DS_Store', '07')]), dir('Raws', [file('IMG_3.CR3', '07')]),
        dir('Dock photos', [file('d1.jpg', '08')])]), file('desktop.ini', '01')]);
    const tree = await GVC_DRIVE._treeOf(root, { depth: 4 });
    const list = await GVC_DRIVE._listOf(root, 'Marketing', {});
    const edited = await GVC_DRIVE._listOf(root, 'Photos/Edited', {});
    const docs = await GVC_DRIVE._listOf(root, 'Marketing/Docs', {}).then(() => 'listed', e => 'refused');
    return { tree, list, opened, listed, docs, edited: edited.map(x => x.name) };
  });
  check('walker: only allowed files opened', walked.opened.sort(), ['4A details.docx', 'Showsheet 1.pdf', 'd1.jpg', 'e1.jpg', 'e1.jpg']);
  check('walker: sidecar and system files never listed or counted (tune-up 3)', [/Thumbs|\._e1|\.xmp|~\$|DS_Store|desktop\.ini/i.test(JSON.stringify(walked.tree)), walked.edited], [false, ['e1.jpg']]);
  check('walker: a paperwork folder below the top is never opened', walked.listed.filter(n => n === 'Docs'), []);
  check('walker: Marketing/Docs not in the tree', walked.tree.children.find(c => c.name === 'Marketing').children.map(c => c.name), ['Showsheet']);
  check('walker: Marketing/Docs refused by listJob', walked.docs, 'refused');
  check('walker: Seller ID never named', JSON.stringify(walked).includes('Seller ID'), false);
  const ph = walked.tree.children.find(c => c.name === 'Photos');
  check('walker: Dock photos kept', ph.children.map(c => c.name), ['Dock photos', 'Edited', 'Raw', 'Raws']);
  check('walker: raw photos counted by name, never read', [ph.children.find(c => c.name === 'Raw').children, ph.children.find(c => c.name === 'Raws').children],
    [[{ name: 'IMG_1.CR3', kind: 'file' }, { name: 'IMG_2.CR3', kind: 'file' }], [{ name: 'IMG_3.CR3', kind: 'file' }]]);
  check('walker: tree shape', [walked.tree.looseCount, walked.tree.otherCount, walked.tree.children.map(c => c.name + (c.skipped ? ' (skipped)' : ''))],
    [1, 1, ['4A details.docx', 'Brochure draft.pdf', 'Marketing', 'Paperwork (skipped)', 'Photos']]);
  check('walker: nested paperwork dropped, dates kept', walked.tree.children.find(c => c.name === 'Marketing').children[0].children, [{ name: 'Showsheet 1.pdf', kind: 'file', size: 10, modified: '2026-10-12T10:00:00.000Z' }]);
  check('walker: listJob leaves paperwork out', walked.list.map(x => x.name), ['Showsheet']);
  check('walker: no paperwork name', /Jane Client|Offer/.test(JSON.stringify(walked)), false);
  await t.ctx.close();

  /* ---------- slice3 tune-up: the log in words, DE's 0 sq ft, sidecars, City vs Neighborhood ---------- */
  {
    const RT = rowsFor(), j = RT.properties[0];
    delete j.core.neighborhood;
    j.core.city = 'Point Pleasant Beach';
    j.core.sqft = 0;
    j.core.facts.sqft = { value: 0, source: 'DE', bySource: { DE: 0 } };
    j.de = Object.assign({}, j.de, { sqft: 0, baths: 0 });
    j.scan.pieces.video = [{ name: 'GVC Video Clips.m4v.xmpses.xmp', modified: '2026-10-14T10:00:00.000Z', archived: false },
      { name: 'GVC Video Clips.m4v', modified: '2026-10-05T10:00:00.000Z', archived: false }];
    RT.changes = [
      { id: 'k1', property_id: 'p1', at: iso(NOW - 6 * 864e5), field: 'asana_gid', old_value: null, new_value: '1201', note: 'Linked to Asana', source: 'Asana' },
      { id: 'k2', property_id: 'p1', at: iso(NOW - 5 * 864e5), field: 'kind', old_value: null, new_value: 'sale', source: 'Asana' },
      { id: 'k3', property_id: 'p1', at: iso(NOW - 4 * 864e5), field: 'exclusiveOn', old_value: null, new_value: '2026-05-27', source: 'Asana' },
      { id: 'k4', property_id: 'p1', at: iso(NOW - 3 * 864e5), field: 'de_stage', old_value: 'Live', new_value: 'In contract', source: 'DE' },
      { id: 'k5', property_id: 'p1', at: iso(NOW - 2 * 864e5), field: 'mlsId', old_value: null, new_value: '123456', source: 'DE' },
      { id: 'k6', property_id: 'p1', at: iso(NOW - 864e5), field: 'sqft', old_value: null, new_value: 0, source: 'DE' }
    ];
    t = await open(browser, { rows: RT, path: LISTING, drive: { state: 'not-connected' } });
    p = t.page;
    check('tune-up: every log line in plain words with its value', await p.$$eval('#changeLog li > div', els => els.map(e => e.childNodes[0].textContent)),
      ['Sq ft is blank on DE', 'MLS number set to 123456', 'DE stage moved to In contract', 'Exclusive date set to 27 May', 'Sale or rental set to Sale', 'Linked to Asana']);
    check('tune-up: DE\'s 0 sq ft is Not set in the tile and the facts list', [await text(p, '.facts > div:nth-child(3)'), await text(p, 'tr[data-fact="sqft"] td')], ['Sq ftNot set', 'Not set']);
    check('tune-up: no neighborhood shows the city under City', await text(p, '.facts > div:nth-child(5)'), 'CityPoint Pleasant Beach');
    check('tune-up: kit video from the scan is the film, not its sidecar', [(await text(p, '#kitCard [data-kit="video"]')).includes('GVC Video Clips.m4v ·'), /xmp/.test(await text(p, '#kitCard [data-kit="video"]'))], [true, false]);
    check('tune-up: US spelling only', /neighbour/i.test(await p.evaluate(() => document.body.innerText)), false);
    check('tune-up: no page errors', t.errors, []);
    await t.ctx.close();
    t = await open(browser, { path: LISTING });
    check('tune-up: a neighborhood shows under Neighborhood', await text(t.page, '.facts > div:nth-child(5)'), 'NeighborhoodTestville');
    await t.ctx.close();
  }

  /* ---------- Slice 5: every piece on the Kit, the pitch's Pieces card (S16) ---------- */
  {
    const PJ = require('../assets/js/piece-job.js');
    const v2 = (tool, row, over) => {
      const bf = PJ.builtFrom(tool, {}, row, { photos: (PJ.photosFor(tool, row, null) || []).map(p => ({ path: p })) });
      Object.assign(bf.facts, (over && over.facts) || {});
      return { property_id: row.id, tool, version: 2, built_from: bf, built_at: '2026-10-22T14:00:00.000Z',
        output: { name: tool + '.pdf', url: 'https://drive.google.com/file/d/' + tool.replace(/-/g, '') + '/view', paper: 'letter', madeAt: '2026-10-22T14:00:00.000Z', via: 'helper' } };
    };
    const line = (pg, tool) => text(pg, '#kitCard [data-piece-line="' + tool + '"]');
    const acts = (pg, kit) => pg.$$eval('#kitCard [data-kit="' + kit + '"] [data-piece]', els => els.map(a => [a.textContent.trim(), a.getAttribute('href')]));

    const RA = rowsFor();
    delete RA.properties[0].scan.pieces.showsheet;
    RA.documents = [v2('brochure', RA.properties[0], { facts: { price: 2250000 } }), v2('postcard-listed', RA.properties[0])];
    t = await open(browser, { rows: RA, path: LISTING });
    let p = t.page;
    check('kit: eight rows, the seven pieces and the Seller pitch', await p.$$eval('#kitCard .kr', e => e.map(x => x.dataset.kit)),
      ['floorplan', 'photos', 'showsheet', 'brochure', 'postcard', 'signage', 'video', 'seller']);
    check('kit: the brochure is stale on its price', [await line(p, 'brochure'), await acts(p, 'brochure')],
      ['Stale: price', [['Rebuild brochure', '../../tools/brochure/?listing=100-example-st-4a&rebuild=1']]]);
    check('kit: the brochure made line', await text(p, '#kitCard [data-piece-made="brochure"]'), 'Made 22 Oct · LETTER · Open');
    check('kit: Just Listed up to date, Just Sold once sold', [await line(p, 'postcard-listed'), await line(p, 'postcard-sold')],
      ['Just Listed postcard: Up to date', 'Just Sold postcard: once the job is sold']);
    check('kit: the postcard row opens the listed card', await acts(p, 'postcard'), [['Open Just Listed postcard', '../../tools/postcard/?listing=100-example-st-4a']]);
    check('kit: the seller pitch and its map, not made yet', [await line(p, 'seller'), await line(p, 'pitch-map'), await acts(p, 'seller')],
      ['Not made yet', 'Map: Not made yet', [['Make seller pitch', '../../tools/seller-package/?listing=100-example-st-4a'], ['Make the map', '../../tools/map-studio/?listing=100-example-st-4a']]]);
    check('kit: Rebuild n stale counts every piece, opens the first stale one', await p.$$eval('#rebuildStale', els => els.map(a => [a.textContent.trim(), a.getAttribute('href')])),
      [['Rebuild 1 stale', '../../tools/brochure/?listing=100-example-st-4a&rebuild=1']]);
    check('kit: the documents read asks for this job\'s pieces', await p.evaluate(() => performance.getEntriesByType('resource').map(e => e.name)
      .filter(u => /\/rest\/v1\/documents\?/.test(u)).map(u => /property_id=eq\.p1/.test(u) && !/tool=eq/.test(u))), [true]);
    check('kit slice 5: no page errors', t.errors, []);
    await t.ctx.close();

    // a sold job offers the Just Sold card
    const RSOLD = rowsFor();
    RSOLD.properties[0].stage = 'Sold'; RSOLD.documents = [];
    t = await open(browser, { rows: RSOLD, path: LISTING });
    check('kit: a sold job offers Just Sold', (await acts(t.page, 'postcard')).map(a => a[0]), ['Make Just Listed postcard', 'Make Just Sold postcard']);
    check('kit: Just Sold opens the sold card', (await acts(t.page, 'postcard'))[1][1], '../../tools/postcard/?listing=100-example-st-4a&card=sold');
    await t.ctx.close();

    // a rental: no postcard, no seller pitch
    const RR = rowsFor();
    RR.properties[0].kind = 'rental'; RR.documents = [];
    t = await open(browser, { rows: RR, path: LISTING });
    check('kit rental: no postcard or seller pitch offered', [(await acts(t.page, 'postcard')).length, await t.page.$$eval('#kitCard [data-kit="seller"]', e => e.length)], [0, 0]);
    await t.ctx.close();

    // the team opens, never makes; two stale pieces count two
    const R2 = rowsFor();
    R2.documents = [v2('brochure', R2.properties[0], { facts: { price: 1 } }), v2('postcard-listed', R2.properties[0], { facts: { price: 1 } })];
    t = await open(browser, { rows: R2, path: LISTING });
    check('kit: two stale pieces, Rebuild 2 stale', await t.page.$$eval('#rebuildStale', els => els.map(a => a.textContent.trim())), ['Rebuild 2 stale']);
    await t.ctx.close();
    t = await open(browser, { rows: R2, path: LISTING, members: [{ name: 'Katie Cook', initials: 'KC', role: 'team' }] });
    check('kit team: opens pieces, never makes or rebuilds', [(await acts(t.page, 'brochure')).map(a => a[0]), (await acts(t.page, 'seller')).map(a => a[0]),
      await t.page.$$eval('#rebuildStale', e => e.length)], [['Open brochure'], ['Open seller pitch', 'Open map'], 0]);
    await t.ctx.close();

    // a pitch's own page: Pieces, its seller pitch and map
    const RQ = rowsFor();
    const q = RQ.pitches[0];
    q.core = Object.assign({ address: '90 Pitch St', unit: '11B', comps: [{ address: '1 Comp St' }] }, q.core || {});
    const sellerBf = PJ.builtFrom('seller', {}, q, {}); sellerBf.facts.beds = 9;
    RQ.documents = [{ pitch_id: 'q1', tool: 'seller', version: 1, built_from: sellerBf, output: { name: 's.pdf', via: 'helper', madeAt: '2026-10-21T10:00:00Z' } }];
    t = await open(browser, { rows: RQ, path: '/workspace/job/?pitch=90-pitch-st-11b' });
    p = t.page;
    check('pitch page: a Pieces card', await p.$$eval('#pitchPieces [data-kit]', e => e.map(x => x.dataset.kit)), ['seller', 'pitch-map']);
    check('pitch page: the seller pitch stale, Rebuild; the map not made', [await text(p, '#pitchPieces [data-piece-state="seller"]'),
      await p.$$eval('#pitchPieces [data-piece]', els => els.map(a => [a.textContent.trim(), a.getAttribute('href')]))],
      ['Stale: beds', [['Rebuild seller pitch', '../../tools/seller-package/?pitch=90-pitch-st-11b&rebuild=1'], ['Make the map', '../../tools/map-studio/?pitch=90-pitch-st-11b']]]);
    check('pitch page: Rebuild 1 stale in the header', await p.$$eval('#rebuildStale', els => els.map(a => a.textContent.trim())), ['Rebuild 1 stale']);
    check('pitch page: the documents read asks for the pitch\'s pieces', await p.evaluate(() => performance.getEntriesByType('resource').map(e => e.name)
      .filter(u => /\/rest\/v1\/documents\?/.test(u)).map(u => /pitch_id=eq\.q1/.test(u))), [true]);
    check('pitch page: no page errors', t.errors, []);
    await t.ctx.close();
  }

  /* ---------- Slice 6: the Signage row ---------- */
  {
    const line = (pg, tool) => text(pg, '#kitCard [data-piece-line="' + tool + '"]');
    const acts = (pg, kit) => pg.$$eval('#kitCard [data-kit="' + kit + '"] [data-piece]', els => els.map(a => [a.textContent.trim(), a.getAttribute('href')]));

    const RO = rowsFor();
    RO.properties[0].market = 'NJ'; RO.documents = [];
    t = await open(browser, { rows: RO, path: LISTING });
    let p = t.page;
    check('kit: the sign not made, Make sign (NJ)', [await line(p, 'signage'), await acts(p, 'signage')],
      ['Not made yet', [['Make sign', '../../tools/signage/?listing=100-example-st-4a']]]);
    check('kit: no open house flyer row', await p.$$eval('#kitCard [data-kit="openHouse"], #kitCard [data-piece-line="open-house"]', e => e.length), 0);
    check('kit slice 6: no page errors', t.errors, []);
    await t.ctx.close();

    const RN = rowsFor();
    RN.properties[0].market = 'NYC'; RN.documents = [];
    t = await open(browser, { rows: RN, path: LISTING });
    check('kit: no sign offered in New York', await t.page.$$eval('#kitCard [data-kit="signage"] [data-piece]', e => e.length), 0);
    await t.ctx.close();

    const RR = rowsFor();
    RR.properties[0].kind = 'rental'; RR.properties[0].market = 'NJ'; RR.documents = [];
    t = await open(browser, { rows: RR, path: LISTING });
    check('kit: no sign offered for a rental', await t.page.$$eval('#kitCard [data-kit="signage"] [data-piece]', e => e.length), 0);
    await t.ctx.close();
  }

  /* ---------- Slice 4: the Kit's Showsheet row, Rebuild n stale (S15, S20, S21) ---------- */
  {
    const SHEET = '/tools/showsheet/?listing=100-example-st-4a';
    const docFor = (row, over) => {
      over = over || {};
      const bf = SJ.builtFrom({}, row, { photos: { front: { path: 'Photos/Edited/03.jpg', modified: '2026-10-08T10:00:00.000Z' }, back: { path: 'Photos/Edited/99.jpg' } } });
      Object.assign(bf.facts, over.facts || {});
      if (over.photos) bf.photos = over.photos;
      return { id: 'doc1', property_id: 'p1', tool: 'showsheet', version: 2, built_from: bf, built_at: '2026-10-22T14:00:00.000Z',
        output: Object.assign({ path: 'Marketing/Showsheet/Showsheet - 100 Example St 4A - 2026-10-22.pdf', name: 'Showsheet - 100 Example St 4A - 2026-10-22.pdf',
          url: 'https://drive.google.com/file/d/NEW1/view', paper: 'a5', madeAt: '2026-10-22T14:00:00.000Z', via: 'helper' }, over.output || {}) };
    };
    const kitRow = '#kitCard [data-kit="showsheet"]';
    const sheetBits = async pg => ({
      state: await text(pg, kitRow + ' [data-sheet-state]'),
      made: await text(pg, kitRow + ' [data-sheet-made]'),
      acts: await pg.$$eval(kitRow + ' [data-sheet]', els => els.map(a => [a.textContent.trim(), a.getAttribute('href')])),
      header: await pg.$$eval('#rebuildStale', els => els.map(a => [a.textContent.trim(), a.getAttribute('href')]))
    });

    // the fixture itself: fresh as built
    const R0 = rowsFor();
    check('fixture: the built_from is fresh against its row', ST.stale(docFor(R0.properties[0]), R0.properties[0], {}).state, 'fresh');

    // none: no record, no file in the folder
    const RN = rowsFor();
    delete RN.properties[0].scan.pieces.showsheet;
    RN.documents = [];
    t = await open(browser, { rows: RN, path: LISTING });
    check('kit none: Make showsheet, no header button', await sheetBits(t.page),
      { state: 'Not made yet', made: null, acts: [['Make showsheet', '../..' + SHEET]], header: [] });
    check('kit none: no page errors', t.errors, []);
    await t.ctx.close();

    // untracked: a file in the folder, no record (S15)
    const RU = rowsFor();
    RU.documents = [];
    t = await open(browser, { rows: RU, path: LISTING });
    check('kit untracked: made before the workspace kept track, Open sheet', await sheetBits(t.page),
      { state: 'Made before the workspace kept track', made: null, acts: [['Open sheet', '../..' + SHEET]], header: [] });
    await t.ctx.close();

    // fresh
    const RF = rowsFor();
    RF.documents = [docFor(RF.properties[0])];
    t = await open(browser, { rows: RF, path: LISTING, drive: { state: 'not-connected' } });
    p = t.page;
    check('kit fresh: up to date, made line with Open and Copy Drive link, Open sheet', await sheetBits(p),
      { state: 'Up to date', made: 'Made 22 Oct · A5 · Open · Copy Drive link', acts: [['Open sheet', '../..' + SHEET]], header: [] });
    check('kit fresh: Open is the recorded Drive link', await p.$eval(kitRow + ' [data-sheet-made] a', a => a.getAttribute('href')), 'https://drive.google.com/file/d/NEW1/view');
    await p.click(kitRow + ' [data-sheet-made] [data-sheet-copy]');
    await settle(p);
    check('kit fresh: Copy Drive link copies the recorded link', [await text(p, '#kitMsg'), await p.evaluate(() => navigator.clipboard.readText())],
      ['Drive link copied.', 'https://drive.google.com/file/d/NEW1/view']);
    check('kit fresh: no page errors', t.errors, []);
    await t.ctx.close();

    // stale on price, owner
    const RS = rowsFor();
    RS.documents = [docFor(RS.properties[0], { facts: { price: 2250000 } })];
    t = await open(browser, { rows: RS, path: LISTING });
    p = t.page;
    check('kit stale: Stale: price, Rebuild, header Rebuild 1 stale', await sheetBits(p),
      { state: 'Stale: price', made: 'Made 22 Oct · A5 · Open · Copy Drive link', acts: [['Rebuild', '../..' + SHEET + '&rebuild=1']],
        header: [['Rebuild 1 stale', '../..' + SHEET + '&rebuild=1']] });
    check('kit stale: the documents read asks for this job\'s pieces (Slice 5: every piece)', await p.evaluate(() => performance.getEntriesByType('resource').map(e => e.name)
      .filter(u => /\/rest\/v1\/documents\?/.test(u)).map(u => /property_id=eq\.p1/.test(u))), [true]);
    check('kit stale: no page errors', t.errors, []);
    await t.ctx.close();

    // a teammate: Open sheet (read-only there), never Make or Rebuild
    for (const [name, rows, state, made] of [['stale', RS, 'Stale: price', 'Made 22 Oct · A5 · Open · Copy Drive link'], ['none', RN, 'Not made yet', null]]) {
      t = await open(browser, { rows, path: LISTING, members: [{ name: 'Katie Cook', initials: 'KC', role: 'team' }] });
      check('kit team ' + name + ': Open sheet, no Make or Rebuild', await sheetBits(t.page), { state, made, acts: [['Open sheet', '../..' + SHEET]], header: [] });
      await t.ctx.close();
    }

    // printed by hand: no Open or Copy Drive link, says so
    const RP = rowsFor();
    RP.documents = [docFor(RP.properties[0], { output: { via: 'print', url: null, path: null, paper: 'letter' } })];
    t = await open(browser, { rows: RP, path: LISTING });
    check('kit printed by hand: says so, no file links', await text(t.page, kitRow + ' [data-sheet-made]'), 'Made 22 Oct · LETTER · printed by hand, file not tracked');
    await t.ctx.close();

    // Drive connected: the photo dates count (a front photo with a new date is stale only live)
    const RL = rowsFor();
    RL.documents = [docFor(RL.properties[0], { photos: { front: { path: 'Photos/Edited/03.jpg', modified: '2026-10-01T10:00:00.000Z' }, back: { path: 'Photos/Edited/99.jpg' } } })];
    t = await open(browser, { rows: RL, path: LISTING });
    check('kit scan: a photo date is unknown, so fresh', (await sheetBits(t.page)).state, 'Up to date');
    await t.ctx.close();
    t = await open(browser, { rows: RL, path: LISTING, drive: {} });
    await t.page.waitForTimeout(800);
    const live = await sheetBits(t.page);
    check('kit live: front photo file updated on Drive is stale, header follows', [live.state, live.header.map(h => h[0])], ['Stale: front photo', ['Rebuild 1 stale']]);
    check('kit live: no page errors', t.errors, []);
    await t.ctx.close();

    // live Drive without the showsheet folder: last night's scan still proves a file (as the sheet's own bar does)
    t = await open(browser, { rows: RU, path: LISTING, drive: { noSheet: true } });
    await t.page.waitForTimeout(800);
    check('kit live, folder not listed now: the scan\'s file still counts', (await sheetBits(t.page)).state, 'Made before the workspace kept track');
    await t.ctx.close();

    // a stale check that throws never takes the page down
    t = await open(browser, { rows: RS, path: LISTING, staleThrows: true });
    check('kit stale check throws: page up, no sheet line, no header button', [await t.page.$$eval('#factsCard', e => e.length), (await sheetBits(t.page)).state, (await sheetBits(t.page)).header, t.errors], [1, null, [], []]);
    await t.ctx.close();

    // a documents read that fails (0009 not run yet): the page still opens, state from the folder
    t = await open(browser, { path: LISTING, documentsFail: true });
    check('kit documents unreadable: page opens, state from the folder', [(await sheetBits(t.page)).state, t.errors], ['Made before the workspace kept track', []]);
    await t.ctx.close();

    // hostile record: shown as text
    const RX = rowsFor();
    RX.documents = [docFor(RX.properties[0], { output: { name: '<img src=x onerror="window.__xss=7">', paper: '<b onmouseover=1>', url: 'javascript:alert(1)', madeAt: '<i>' } })];
    t = await open(browser, { rows: RX, path: LISTING });
    check('kit hostile record stays inert', [await t.page.evaluate(() => window.__xss || null), await t.page.$$eval(kitRow + ' [data-sheet-made] a', els => els.length),
      await t.page.$$eval(kitRow + ' b, ' + kitRow + ' img, ' + kitRow + ' i:not(.ic)', els => els.length), t.errors], [null, 0, 0, []]);
    await t.ctx.close();

    // phone: the state and what's stale, no Make or Rebuild buttons, no sideways scroll (S20)
    for (const [name, rows] of [['stale', RS], ['none', RN]]) {
      t = await open(browser, { rows, path: LISTING, phone: true });
      p = t.page;
      check('375 px kit ' + name + ': state shown, no Make or Rebuild', [await p.isVisible(kitRow + ' [data-sheet-state]'),
        await p.evaluate(() => [...document.querySelectorAll('[data-sheet], #rebuildStale')].filter(e => e.getClientRects().length).map(e => e.textContent.trim()))],
        [true, []]);
      check('375 px kit ' + name + ': no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= 376), true);
      await t.ctx.close();
    }
  }

  /* ---------- phone, hostile text, dashes ---------- */
  t = await open(browser, { path: LISTING, phone: true });
  p = t.page;
  await p.click('tr[data-fact="description"] [data-edit]');
  await p.click('#agChange');
  check('375 px: no element wider than the viewport', await p.evaluate(() => {
    const W = document.documentElement.clientWidth, out = [];
    document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > W + 0.5 || r.left < -0.5)) out.push(e.tagName + '.' + e.className); });
    return out;
  }), []);
  check('375 px: no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= 376), true);
  await t.ctx.close();

  t = await open(browser, { path: '/workspace/job/?listing=evil' });
  p = t.page;
  await p.click('details.fx summary');
  check('hostile row stays inert', [await p.evaluate(() => window.__xss || null), (await text(p, '#factsCard')).includes('<script>'), (await text(p, '#agentsCard')).includes('Unknown agent (<img'), t.errors], [null, true, true, []]);
  await t.ctx.close();

  for (const path of [LISTING, '/workspace/job/?pitch=90-pitch-st-11b', '/workspace/job/?dev=619-example-ave', '/workspace/job/?listing=20-sample-ave-7b']) {
    t = await open(browser, { path });
    check('no em or en dash shown: ' + path, (await t.page.evaluate(() => document.body.innerText)).match(/[–—]/g), null);
    await t.ctx.close();
  }

  await browser.close();
  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
