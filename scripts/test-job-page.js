/* ============================================================
   Browser tests for the job page's database cards (Slice 3, Task 7):
   facts, agents, archive, change-log notes, development ticks, pitch view.
   Supabase and the desktop helper are mocked by request interception
   (made-up rows and names; nothing real). Every save_job call is captured.

     BASE=http://127.0.0.1:8096 node scripts/test-job-page.js
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
        asana_gid: '1201', asana: { gid: '1201', permalink: 'https://app.asana.com/0/1/1201', status: 'Active', stageFromStatus: 'Live', pointPerson: 'JG/KC/CB', checklist: [] },
        match: { list: [], dismissed: {} } },
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
    changes: [
      { id: 'c1', property_id: 'p1', at: iso(NOW - 3 * 864e5), field: 'beds', old_value: 3, new_value: 4, source: 'Matt', no_rebuild: true },
      { id: 'c2', property_id: 'p1', at: iso(NOW - 2 * 864e5), field: null, note: 'Katie says the price drops Friday', asked_by: 'Katie Cook', source: 'Matt' },
      { id: 'c3', property_id: 'p1', at: iso(NOW - 864e5), field: 'agentIds', old_value: [], new_value: ['katie-cook'], source: 'Matt' }
    ]
  };
}

async function open(browser, opts) {
  const ctx = await browser.newContext(opts.phone ? { viewport: { width: 375, height: 812 } } : {});
  const page = await ctx.newPage();
  const errors = [], saves = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('gvc.props.session', JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: Date.now() + 1e8 })));
  await page.addInitScript(() => { delete window.showDirectoryPicker; });
  const T = opts.rows || rowsFor();
  await page.route('**/rest/v1/**', r => {
    const u = new URL(r.request().url()), table = u.pathname.split('/').pop(), m = r.request().method();
    if (table === 'members') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.members || [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }]) });
    if (table === 'save_job') {
      const body = JSON.parse(r.request().postData() || '{}');
      saves.push(body);
      if (opts.conflict) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'conflict' }) });
      const row = (T[body.p_table] || []).find(x => x.id === body.p_id) || {};
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({}, row, body.p_set, { version: row.version + 1 })) });
    }
    if (m !== 'GET') { writes.push(m + ' ' + table); return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
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
  // Archive
  await p.click('#archive');
  await settle(p);
  s = t.saves[6] || {};
  check('archive: stage Archived', [s.p_set && s.p_set.stage, (s.p_changes || []).map(c => [c.field, c.old_value, c.new_value])], ['Archived', [['stage', 'Live', 'Archived']]]);
  check('archive: says so', (await text(p, '#actMsg')).startsWith('Archived.'), true);
  check('header: Open in Asana and Copy Drive link', [await p.$eval('#asanaLink', a => a.getAttribute('href')), await p.$$eval('#copyLink', e => e.length)], ['https://app.asana.com/0/1/1201', 1]);
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
  // Unarchive goes back to Asana's stage
  check('unarchive: names the stage', await text(p, '#archive'), 'Unarchive (back to Live)');
  await p.click('#archive');
  await settle(p);
  check('unarchive: Asana\'s stage', t.saves[1] && t.saves[1].p_set, { stage: 'Live' });
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
