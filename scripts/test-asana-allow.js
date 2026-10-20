/* ============================================================
   Tests for the Asana reader's front door (helper/asana/): the GET-only
   client, the field allowlist and the dry-run report, against made-up data
   (helper/fixtures/synthetic/asana/). Nothing here touches the real Asana.

   Plain Node:  node scripts/test-asana-allow.js
   ============================================================ */
'use strict';

// never this computer's own helper settings
process.env.GVC_HELPER_HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'gvc-asana-'));
const fs = require('fs'), path = require('path'), os = require('os');
const allow = require('../helper/asana/allow.js');
const { createAsana } = require('../helper/asana/client.js');
const { recordKept } = require('../helper/asana/record.js');
const { dryRun } = require('../helper/asana-sync.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const FIX = path.join(__dirname, '..', 'helper', 'fixtures', 'synthetic', 'asana');
const fx = f => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));

/* ---------- a fake Asana that serves the made-up files ---------- */
function fixtureFetch(log) {
  return async (url, init) => {
    const u = new URL(url);
    if (log) log.push({ url: String(url), init });
    const send = (body, status) => ({ ok: !status || status < 400, status: status || 200, headers: { get: () => null }, json: async () => body });
    let m;
    if (u.pathname.endsWith('/users/me')) return send(fx('me.json'));
    if ((m = u.pathname.match(/\/projects\/(\d+)\/tasks$/))) {
      const f = 'tasks-' + m[1] + '.json';
      if (fs.existsSync(path.join(FIX, f))) return send(fx(f));
      return send({ data: [], next_page: null });
    }
    return send({ errors: [{ message: 'not found' }] }, 404);
  };
}

const field = (name, v) => Object.assign({ name, display_value: null, number_value: null, date_value: null, enum_value: null, multi_enum_values: null }, v);

(async () => {
  /* ---------- keepTask ---------- */
  const raw = {
    gid: '1', name: '3 Example Ave - 4C', completed: false, completed_at: null, due_on: '2026-11-01', modified_at: 'm', created_at: 'c',
    assignee: { name: 'Agent A' }, notes: 'secret', html_notes: '<b>secret</b>', permalink_url: 'https://app.asana.com/0/1/1',
    memberships: [{ project: { gid: '777' }, section: { name: 'Other' } }, { project: { gid: '555' }, section: { name: 'Active' } }],
    parent: null,
    custom_fields: [
      field('Listing Status', { enum_value: { name: 'Active' }, display_value: 'Active' }),
      field('💵 Current Price', { number_value: 2250000, display_value: '2250000' }),
      field('🗓️ Listing Date', { date_value: { date: '2026-09-01' } }),
      field('ℹ️ Property Type', { multi_enum_values: [{ name: 'Condo' }, { name: 'Co-op' }] }),
      field('📍 City/Hood', { display_value: null }),
      field('👤 Client 1', { display_value: 'Pat Madeup' }),
      field('💵 GCI $', { number_value: 41250 }),
      field('💵 Contract Price', { number_value: 2175000 }),
      field('🧑‍💼 Source of Business', { display_value: 'Past client' })
    ]
  };
  const t = allow.keepTask(raw, '555');
  const dump = JSON.stringify(t);
  ['Client', 'GCI', 'Contract', 'Source of Business', 'secret', 'Pat Madeup', '41250', '2175000'].forEach(w =>
    check('keepTask drops forbidden fields: ' + w, dump.indexOf(w) === -1, true));
  check('keepTask keeps Listing Status', t.fields['Listing Status'], 'Active');
  check('keepTask keeps Current Price', t.fields['💵 Current Price'], 2250000);
  check('keepTask keeps a date', t.fields['🗓️ Listing Date'], '2026-09-01');
  check('keepTask keeps a multi-select as a list', t.fields['ℹ️ Property Type'], ['Condo', 'Co-op']);
  check('keepTask: an empty kept field is present and null', t.fields['📍 City/Hood'], null);
  check('keepTask: a kept field the task lacks is absent', '🗓️ AO Date' in t.fields, false);
  check('keepTask picks the section of the asked project', [t.section, t.projectGid], ['Active', '555']);
  check('keepTask shape', Object.keys(t), ['gid', 'name', 'completed', 'completedAt', 'dueOn', 'modifiedAt', 'createdAt', 'assignee', 'section', 'projectGid', 'parentGid', 'permalink', 'fields']);
  check('keepTask assignee is a name', t.assignee, 'Agent A');
  check('keepSubtask has no fields it was not given', Object.keys(allow.keepSubtask({ gid: '2', name: 's', completed: true, completed_at: 'x', due_on: null, parent: { gid: '1' }, notes: 'secret' })),
    ['gid', 'name', 'completed', 'completedAt', 'dueOn', 'assignee', 'parentGid']);
  check('every opt_fields entry avoids notes and text', /notes|html_text|\btext\b|attachments/.test(allow.TASK_FIELDS), false);
  check('Zip Code is read as the kept Zip field', allow.keepTask({ gid: '3', custom_fields: [field('📍 Zip Code', { display_value: '10001' })] }).fields['📍 Zip'], '10001');

  /* ---------- keepStory ---------- */
  check('keepStory drops comments', allow.keepStory({ resource_subtype: 'comment_added', text: 'x', created_at: 'a' }), null);
  check('keepStory drops other kinds', allow.keepStory({ resource_subtype: 'assigned', text: 'x', created_at: 'a' }), null);
  check('keepStory section', allow.keepStory({ resource_subtype: 'section_changed', created_at: 'T', old_section: { name: 'Leads' }, new_section: { name: 'Active' } }),
    { type: 'section', at: 'T', from: 'Leads', to: 'Active' });
  check('keepStory Listing Status', allow.keepStory({ resource_subtype: 'enum_custom_field_changed', created_at: 'T', custom_field: { name: 'Listing Status' }, old_enum_value: { name: 'Lead' }, new_enum_value: { name: 'Active' } }),
    { type: 'status', at: 'T', from: 'Lead', to: 'Active' });
  check('keepStory drops any other field change', allow.keepStory({ resource_subtype: 'enum_custom_field_changed', created_at: 'T', custom_field: { name: '💵 Contract Price' }, new_enum_value: { name: 'x' } }), null);
  check('keepStory due date', allow.keepStory({ resource_subtype: 'due_date_changed', created_at: 'T', old_dates: { due_on: '2026-04-01' }, new_dates: { due_on: '2026-04-15' } }),
    { type: 'due', at: 'T', from: '2026-04-01', to: '2026-04-15' });
  check('keepStory ticks', [allow.keepStory({ resource_subtype: 'marked_complete', created_at: 'T' }), allow.keepStory({ resource_subtype: 'marked_incomplete', created_at: 'U' })],
    [{ type: 'complete', at: 'T', from: null, to: null }, { type: 'incomplete', at: 'U', from: null, to: null }]);
  const kept = fx('stories-sample.json').data.map(allow.keepStory).filter(Boolean);
  check('the sample history keeps only the five kept kinds', kept.map(s => s.type), ['section', 'status', 'due', 'complete']);
  check('kept stories carry no text', JSON.stringify(kept).indexOf('flexible'), -1);

  /* ---------- keepPerson / keepLoose ---------- */
  const person = {
    gid: 'p1', name: 'Agent A', completed: false, notes: 'private', memberships: [{ section: { name: 'Sales Agents' } }],
    custom_fields: [
      field('Title', { display_value: 'Licensed Salesperson' }), field('Agent Title', { display_value: 'a@example.com 555-0100' }),
      field('📍 State', { enum_value: { name: 'NY' } }), field('GVC Internal Team', { multi_enum_values: [{ name: 'Sales' }] }),
      field('DE Bio', { display_value: 'https://example.com/bio' }), field('Douglas Elliman', { display_value: 'https://example.com/p' }),
      field('Phone Number', { display_value: '555-0100' }), field('Birthday', { date_value: { date: '1990-01-02' } }), field('GVC Email', { display_value: 'a@example.com' })
    ]
  };
  const pk = allow.keepPerson(person);
  check('keepPerson keys', Object.keys(pk), ['gid', 'name', 'section', 'title', 'state', 'team', 'deBioUrl', 'deProfileUrl', 'past']);
  check('keepPerson values', [pk.title, pk.state, pk.team, pk.deBioUrl, pk.deProfileUrl, pk.past], ['Licensed Salesperson', 'NY', ['Sales'], 'https://example.com/bio', 'https://example.com/p', false]);
  const pd = JSON.stringify(pk);
  ['555', 'Birthday', '1990', 'Agent Title', 'a@example.com', 'private'].forEach(w => check('keepPerson drops private: ' + w, pd.indexOf(w) === -1, true));
  check('keepPerson past by section', allow.keepPerson({ gid: 'p2', name: 'Former E', completed: false, memberships: [{ section: { name: 'Past Team Members' } }], custom_fields: [] }).past, true);
  check('keepPerson team defaults to a list', allow.keepPerson({ gid: 'p3', name: 'X', memberships: [], custom_fields: [] }).team, []);
  check('keepLoose shape', allow.keepLoose({ gid: 'l1', name: 'Render', due_on: '2026-09-01', completed_at: 'c', assignee: { name: 'Agent A' }, notes: 'secret',
    memberships: [{ project: { gid: '321' }, section: { name: 'x' } }] }),
    { gid: 'l1', name: 'Render', projectGid: '321', dueOn: '2026-09-01', completedAt: 'c', assignee: 'Agent A' });

  /* ---------- missingKept ---------- */
  const tasks = [allow.keepTask(raw, '555')];
  check('missing kept field lists names no task has', allow.missingKept(tasks).includes('Listing Status'), false);
  check('missing kept field: renamed field shows up',
    allow.missingKept([allow.keepTask({ gid: '9', custom_fields: [field('Status', { display_value: 'Active' })] })]).includes('Listing Status'), true);
  check('missing kept field: lacking Listing Status', allow.missingKept([{ fields: { 'Sale/Rent': 'Sale' } }]).includes('Listing Status'), true);
  check('missing kept field: only Listing Status when the rest are present',
    allow.missingKept([{ fields: allow.KEPT_FIELDS.filter(n => n !== 'Listing Status').reduce((o, n) => (o[n] = null, o), {}) }]), ['Listing Status']);
  check('missing kept field: no tasks, nothing to judge', allow.missingKept([]), []);

  /* ---------- client ---------- */
  const files = fs.readdirSync(path.join(__dirname, '..', 'helper', 'asana')).map(f => fs.readFileSync(path.join(__dirname, '..', 'helper', 'asana', f), 'utf8'))
    .concat([fs.readFileSync(path.join(__dirname, '..', 'helper', 'asana-sync.js'), 'utf8')]);
  files.forEach((src, i) => {
    check('client is GET-only (verb strings) #' + i, /method:\s*['"](POST|PUT|PATCH|DELETE)/i.test(src), false);
    check('client is GET-only (calls) #' + i, /\.(post|put|patch|delete)\(/i.test(src), false);
  });
  check('client has helper files to scan', files.length >= 3, true);

  const mkRes = (body, status, headers) => ({ ok: !status || status < 400, status: status || 200, headers: { get: k => (headers || {})[k.toLowerCase()] || null }, json: async () => body });
  const cfg = { asanaToken: 'tok-secret-123' };
  check('client not ready without a token', createAsana({}, { fetch: async () => mkRes({}) }).ready(), false);
  check('client ready with a token', createAsana(cfg, { fetch: async () => mkRes({}) }).ready(), true);

  const seen = [];
  const pageFetch = async (url, init) => {
    seen.push({ url: String(url), init });
    const off = new URL(url).searchParams.get('offset');
    if (!off) return mkRes({ data: Array.from({ length: 100 }, (_, i) => ({ gid: 'a' + i })), next_page: { offset: 'OFF1' } });
    return mkRes({ data: Array.from({ length: 50 }, (_, i) => ({ gid: 'b' + i })), next_page: null });
  };
  const rows = await createAsana(cfg, { fetch: pageFetch }).get('/projects/1/tasks', { opt_fields: 'name' });
  check('client pages to 150 rows', rows.length, 150);
  check('client asks 100 at a time with the token', [new URL(seen[0].url).searchParams.get('limit'), seen[0].init.headers.authorization, seen[1].url.includes('offset=OFF1')], ['100', 'Bearer tok-secret-123', true]);
  check('client sends no method (a plain GET)', seen.every(s => !s.init.method || s.init.method === 'GET'), true);
  check('client starts at the Asana API', seen[0].url.startsWith('https://app.asana.com/api/1.0/projects/1/tasks?'), true);

  let dupMsg = '';
  try {
    await createAsana(cfg, { fetch: async url => new URL(url).searchParams.get('offset')
      ? mkRes({ data: [{ gid: 'a1' }], next_page: null }) : mkRes({ data: [{ gid: 'a1' }], next_page: { offset: 'X' } }) }).get('/projects/1/tasks');
  } catch (e) { dupMsg = e.message; }
  check('client: a repeated gid across pages throws', dupMsg, 'Asana sent a task twice');

  let calls = 0;
  const flaky = async () => (++calls === 1 ? mkRes({}, 429, { 'retry-after': '0' }) : mkRes({ data: [{ gid: 'z' }], next_page: null }));
  check('client retries a 429', (await createAsana(cfg, { fetch: flaky }).get('/x')).length, 1);
  check('client made two calls for the 429', calls, 2);

  let refused = null;
  try { await createAsana(cfg, { fetch: async () => mkRes({ errors: [{ message: 'Not Authorized' }] }, 401) }).get('/x'); } catch (e) { refused = e; }
  check('client: a refused token is a plain message with .status', [refused && refused.status, refused && refused.message], [401, 'Asana refused the token']);
  check('client never prints the token', JSON.stringify(refused.message).includes('tok-secret'), false);
  let gone = null;
  try { await createAsana(cfg, { fetch: async () => mkRes({}, 404) }).get('/x'); } catch (e) { gone = e; }
  check('client: other failures carry .status', gone && gone.status, 404);
  let noTok = '';
  try { await createAsana({}, { fetch: async () => mkRes({}) }).get('/x'); } catch (e) { noTok = e.message; }
  check('client without a token says so', noTok, 'No Asana token yet: add asanaToken to the helper\'s config.');
  check('whoami returns the name', (await createAsana(cfg, { fetch: fixtureFetch() }).whoami()).name, 'Matt Example');

  /* ---------- recording writes only kept data ---------- */
  const rec = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-rec-'));
  const file = recordKept('listings-nyc', [t], { dir: rec, date: '2026-10-20' });
  const saved = fs.readFileSync(file, 'utf8');
  check('record lands in the dated folder', path.relative(rec, file).replace(/\\/g, '/'), '2026-10-20/asana-listings-nyc.json');
  check('record holds no forbidden text', ['secret', 'Pat Madeup', 'GCI'].some(w => saved.indexOf(w) !== -1), false);

  /* ---------- the dry run, against the made-up Asana ---------- */
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-dry-'));
  const log = [];
  const cfgDry = Object.assign({ asanaToken: 'tok-dry-secret' }, require('../helper/config.js').loadConfig());
  const dr = await dryRun({ cfg: cfgDry, fetch: fixtureFetch(log), outDir: out, date: '2026-10-20', recordDir: rec, record: true });
  check('dry run ok', dr.ok, true);
  const md = fs.readFileSync(dr.reportFile, 'utf8');
  check('dry run report lands in the out folder', path.basename(dr.reportFile), 'asana-dry-run-2026-10-20.md');
  check('report names Listing Status values', ['Active', 'TOTM', 'Graveyard', 'In Contract'].every(w => md.includes(w)), true);
  check('report names sections', ['Fully Executed/Board Package', 'TJ New Dev'].every(w => md.includes(w)), true);
  check('report counts tasks per project', md.includes('13 tasks'), true);
  check('report lists missing kept fields', /missing kept fields:/i.test(md), true);
  check('report carries no addresses, people or secrets', ['Sample Ave', 'Pat Madeup', 'SECRET', 'Agent A', 'tok-dry-secret'].some(w => md.includes(w)), false);
  check('dry run only ever asked with GET', log.every(l => !l.init.method || l.init.method === 'GET'), true);
  check('dry run never asked for notes', log.every(l => !/notes|html_text|attachments/.test(decodeURIComponent(l.url))), true);
  check('dry run recorded the kept tasks', fs.existsSync(path.join(rec, '2026-10-20', 'asana-listings-NYC.json')), true);
  const recText = fs.readFileSync(path.join(rec, '2026-10-20', 'asana-listings-NYC.json'), 'utf8');
  check('the recording holds no forbidden text', ['SECRET', 'Pat Madeup', 'GCI', 'Contract Price', '2175000'].some(w => recText.indexOf(w) !== -1), false);

  const noTokenRun = await dryRun({ cfg: {}, fetch: fixtureFetch(), outDir: out });
  check('dry run without a token says so and writes nothing', [noTokenRun.ok, noTokenRun.aborted], [false, 'No Asana token yet: add asanaToken to the helper\'s config.']);

  failures.forEach(f => console.log('FAIL ' + f));
  console.log(pass + ' passed, ' + failures.length + ' failed');
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.log('FAIL (threw) ' + (e && e.stack || e)); process.exit(1); });
