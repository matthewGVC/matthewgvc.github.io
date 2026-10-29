/* ============================================================
   Tests for the budget read (D112, D113): the allowlist on a made-up
   pro-forma, the read-only Google client against a fake Google, the sync
   against a fake database, and the hourly schedule.

     node scripts/test-budget.js

   Every figure and name here is made up; no real sheet is ever copied into
   the repo (D2).
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const allow = require('../helper/budget/allow.js');
const { createSheets, SCOPE } = require('../helper/budget/sheets.js');
const { syncNow } = require('../helper/budget-sync.js');
const { due } = require('../helper/schedule.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

/* a pro-forma laid out like the SSDG template: purchase costs left, hard costs middle, investors right */
const COSTS = [
  ['', '1 Sample Lane, Exampleton'],
  [],
  ['', 'PURCHASE COSTS:', '', '', 'Hard Costs', 'Estimated Price', 'Estimated Start Date', 'Time Line', 'Actual', 'Remaining', '', 'Draw Schedule', ''],
  ['', 'Purchase Price', ' $ 999,111.00 ', '', 'Architect', ' $ 10,000.00 ', '', '', '$6,000.00', '$4,000.00', '', 'Immediately', '$777,000.00'],
  ['', 'Closing Costs', ' $ 5,000.00 ', '', 'Lumber ', ' $ 40,000.00 ', '5/5/2026', '5/7/2026', '$52,500.00', '-$12,500.00', '', 'Name', 'Amount'],
  ['', '', '', '', 'Misc. Inspections', '-', '', '', '', '$0.00', '', 'Investor Zed', '$123,456'],
  ['', '', '', '', '', '', '', '', '', '', '', 'Snowbank Lending', '11.50%'],
  ['', 'Selling Price', ' $ 2,222,000.00 ', '', 'Cleanup ', '-', '11/15/2026', '12/15/26', '', '-'],
  ['', '', '', '', 'Pool (Upgrade)', ' $ 30,000.00 '],
  ['', '', '', '', 'TOTAL: (Not Including Pool)', ' $ 49,999.00 ', '', '', '$58,500.00', '$1,000.00'],
  ['', '', '', '', 'Pool Cost (Upgrade)', ' $ 30,000.00 '],
  ['', 'Net Proceeds', ' $ 444,000.00 ', '', 'Total (Including Pool)', ' $ 79,999.00 ']
];
const PAID = [
  ['DEVELOPMENT SPENDING TRACKER'],
  ['', '1 Sample Lane'],
  ['', 'Total Spent', '', 'Missing Receipts'],
  [],
  ['', 'Date', 'Category', 'Vendor', 'Description', 'Amount', 'Check #', 'Status', 'Receipt Link', 'Notes'],
  ['', '12/16/2025', 'Architect', 'Example Design Co', 'Permit set', 6000, '4401', 'Paid', 'invoice-1.pdf', 'Pat Madeup says hi'],
  ['', '5/20/26', 'Lumber', 'Example Lumber', 'Deposit', '$52,500.00', '4402', 'Paid', '', ''],
  ['', '', '', '', '', '', '', '', '', '']
];

(async () => {
  /* ---------- allowlist ---------- */
  const b = allow.keepBudget({ title: 'Pro-forma 1 Sample Lane', costs: COSTS, payments: PAID });
  check('lines: the Hard Costs block to its TOTAL row', b.lines.map(l => [l.name, l.estimate, l.actual, l.upgrade]), [
    ['Architect', 10000, 6000, false], ['Lumber', 40000, 52500, false], ['Misc. Inspections', null, null, false],
    ['Cleanup', null, null, false], ['Pool', 30000, null, true]]);
  check('the sheet\'s own total', b.sheetTotal, { estimate: 49999, actual: 58500, remaining: 1000 });
  check('payments: dated rows only, receipt as yes / no', b.payments, [
    { date: '2025-12-16', category: 'Architect', vendor: 'Example Design Co', description: 'Permit set', amount: 6000, status: 'Paid', receipt: true },
    { date: '2026-05-20', category: 'Lumber', vendor: 'Example Lumber', description: 'Deposit', amount: 52500, status: 'Paid', receipt: false }]);
  const dump = JSON.stringify(b);
  ['999111', '999,111', 'Investor Zed', '123456', 'Snowbank', '777000', '2222000', '444000', 'Purchase', 'Selling', 'Proceeds', '4401', 'invoice-1', 'Pat Madeup', 'Draw']
    .forEach(w => check('never kept: ' + w, dump.indexOf(w), -1));
  check('no Hard Costs table: a plain sentence', (() => { try { allow.keepBudget({ costs: [['a', 'b']] }); return null; } catch (e) { return e.message; } })(),
    'The pro-forma has no Hard Costs table with Estimated Price and Actual columns.');
  check('no Expense_Tracker tab: no payments', allow.keepBudget({ costs: COSTS, payments: null }).payments, []);
  check('money', [' $ 13,500.00 ', '-$4,132.54', '-', ' $ -   ', '(250)', 12, ''].map(allow.money), [13500, -4132.54, null, null, -250, 12, null]);
  check('day', ['12/16/2025', '4/10/26', '2026-05-20', 'June 15', ''].map(allow.day), ['2025-12-16', '2026-04-10', '2026-05-20', null, null]);
  check('tabs picked by name', [allow.costsTab(['Notes', 'Updated Pro-Forma', 'Copy of Expense_Tracker']), allow.paymentsTab(['Updated Pro-Forma', 'Copy of Expense_Tracker'])],
    ['Updated Pro-Forma', 'Copy of Expense_Tracker']);
  check('no pro-forma tab: the first one; no tracker: none', [allow.costsTab(['Sheet1', 'Sheet2']), allow.paymentsTab(['Sheet1'])], ['Sheet1', null]);

  /* ---------- the Google client: read-only, signs in once ---------- */
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-budget-'));
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  fs.writeFileSync(path.join(home, 'google-key.json'), JSON.stringify({ client_email: 'reader@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }));
  const log = [];
  const send = (body, status) => ({ ok: !status || status < 400, status: status || 200, json: async () => body });
  const google = async (url, init) => {
    log.push({ url: String(url), method: (init && init.method) || 'GET', body: init && init.body });
    if (url.startsWith('https://oauth2.googleapis.com/token')) return send({ access_token: 'tok', expires_in: 3600 });
    if (/\/values\//.test(url)) return send({ values: decodeURIComponent(url).includes('Expense_Tracker') ? PAID : COSTS });
    if (url.includes('/spreadsheets/locked')) return send({ error: {} }, 403);
    return send({ properties: { title: 'Pro-forma 1 Sample Lane' }, sheets: [{ properties: { title: 'Updated Pro-Forma' } }, { properties: { title: 'Copy of Expense_Tracker' } }] });
  };
  const sheets = createSheets({ home }, { fetch: google });
  check('ready with the key file', [sheets.ready(), createSheets({ home: path.join(home, 'none') }).ready()], [true, false]);
  check('tabs', await sheets.tabs('sheet1'), { title: 'Pro-forma 1 Sample Lane', tabs: ['Updated Pro-Forma', 'Copy of Expense_Tracker'] });
  await sheets.grid('sheet1', "Bob's Tab");
  check('a tab name is quoted', decodeURIComponent(log[log.length - 1].url).includes("/values/'Bob''s Tab'?"), true);
  check('signed in once for both reads', log.filter(l => l.method === 'POST').length, 1);
  check('the only non-read is the sign-in', log.filter(l => l.method !== 'GET').every(l => l.url === 'https://oauth2.googleapis.com/token'), true);
  const claims = JSON.parse(Buffer.from(new URLSearchParams(log[0].body).get('assertion').split('.')[1], 'base64').toString());
  check('asks for read-only sheets', [claims.scope, SCOPE], ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly']);
  check('a sheet not shared: says who to share it with', await sheets.tabs('locked').then(() => null, e => e.message),
    'This sheet isn\'t shared with the helper\'s Google account (reader@example.iam.gserviceaccount.com). Share it as Viewer.');
  const src = fs.readFileSync(path.join(__dirname, '..', 'helper', 'budget', 'sheets.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'helper', 'budget-sync.js'), 'utf8');
  check('no write verb but the sign-in', (src.match(/\b(POST|PUT|PATCH|DELETE)\b/g) || []), ['POST']);

  /* ---------- the sync ---------- */
  const T = { dev_budgets: [{ dev_project_id: 'd1', sheet_id: 'sheet1', budget: null, version: 1 }, { dev_project_id: 'd2', sheet_id: 'locked', budget: { lines: [] }, version: 4 }], sync_runs: [] };
  const db = {
    insert: async (t, row) => { const r = Object.assign({ id: 'run' + (T[t].length + 1) }, row); T[t].push(r); return [r]; },
    select: async t => JSON.parse(JSON.stringify(T[t])),
    update: async (t, m, patch, o) => {
      const hit = T[t].find(r => Object.keys(m).every(k => r[k] === m[k]) && (!o || r.version === o.version));
      if (!hit) { const e = new Error('conflict'); e.name = 'ConflictError'; throw e; }
      Object.assign(hit, patch); if (hit.version !== undefined) hit.version++;
      return [hit];
    }
  };
  const NOW = new Date('2026-10-29T15:00:00Z');
  const r1 = await syncNow({ client: db, sheets, now: NOW });
  check('sync: one read, one failure, the run still ok', [r1.read, r1.changed, r1.ok, r1.errors.map(e => e.row)], [1, 1, true, ['d2']]);
  check('sync: budget and time stored', [T.dev_budgets[0].budget.lines.length, T.dev_budgets[0].synced_at, T.dev_budgets[0].error], [5, NOW.toISOString(), null]);
  check('sync: a failing sheet keeps its budget and says why', [T.dev_budgets[1].budget, /Share it as Viewer/.test(T.dev_budgets[1].error)], [{ lines: [] }, true]);
  check('sync: the run is logged as budget', [T.sync_runs[0].kind, T.sync_runs[0].ok, T.sync_runs[0].changes], ['budget', true, 1]);
  const r2 = await syncNow({ client: db, sheets, now: NOW });
  check('sync: an unchanged budget isn\'t rewritten', r2.changed, 0);
  T.dev_budgets.splice(0, 1);
  check('sync: every sheet failing is a failed run', (await syncNow({ client: db, sheets, now: NOW })).ok, false);

  /* ---------- the schedule ---------- */
  const at = s => new Date(s);
  check('budget due hourly when switched on', [
    due(at('2026-10-29T10:00:00'), { de: at('2026-10-29T07:00:00'), scan: at('2026-10-29T02:00:00'), backup: at('2026-10-29T02:30:00') }, { budget: true }),
    due(at('2026-10-29T10:00:00'), { de: at('2026-10-29T07:00:00'), scan: at('2026-10-29T02:00:00'), backup: at('2026-10-29T02:30:00'), budget: at('2026-10-29T09:30:00') }, { budget: true }),
    due(at('2026-10-29T10:00:00'), { de: at('2026-10-29T07:00:00'), scan: at('2026-10-29T02:00:00'), backup: at('2026-10-29T02:30:00') }, {})], [['budget'], [], []]);

  fs.rmSync(home, { recursive: true, force: true });
  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
