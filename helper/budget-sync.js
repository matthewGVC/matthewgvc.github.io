/* ============================================================
   BUDGET SYNC — each development's pro-forma sheet into dev_budgets (D113).

     await syncNow({ cfg, client, sheets?, now? })
       → { runId, ok, read, changed, errors: [{ what, detail, row }] }

   For every dev_budgets row (a sheet Matt linked on the job page): the sheet's
   tabs, then the pro-forma and Expense_Tracker tabs, kept through
   budget/allow.js. A budget that changed is written with synced_at; an
   unchanged one only moves synced_at. A sheet that fails keeps its last
   budget and gets the failure in `error` (the job page shows it); the run
   goes on. A row someone changed meanwhile (version check) is skipped.
   Every run is a sync_runs row of kind 'budget', finished even when the
   run itself fails (then ok false, the error kept, and thrown on).
   Reads only: nothing is ever written to the sheet or to Drive.
   ============================================================ */
'use strict';

const allow = require('./budget/allow.js');
const { createSheets } = require('./budget/sheets.js');

const eq = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

async function readOne(sheets, id) {
  const meta = await sheets.tabs(id);
  const costs = allow.costsTab(meta.tabs), paid = allow.paymentsTab(meta.tabs);
  if (!costs) throw new Error('The sheet has no tabs.');
  return allow.keepBudget({ title: meta.title, costs: await sheets.grid(id, costs), payments: paid ? await sheets.grid(id, paid) : null });
}

/* every linked sheet, one at a time; fills out.read / changed / errors → the rows read */
async function syncRows(client, sheets, now, out) {
  const rows = await client.select('dev_budgets');
  for (const row of rows) {
    let patch;
    try {
      const budget = await readOne(sheets, row.sheet_id);
      out.read++;
      patch = Object.assign({ synced_at: now, error: null }, eq(budget, row.budget) ? {} : { budget });
      if (patch.budget) out.changed++;
    } catch (e) {
      out.errors.push({ what: 'sheet', detail: e.message, row: row.dev_project_id });
      patch = { error: e.message };
    }
    try { await client.update('dev_budgets', { dev_project_id: row.dev_project_id }, patch, { version: row.version }); }
    catch (e) {
      if (e.name !== 'ConflictError') throw e;
      out.errors.push({ what: 'conflict', detail: e.message, row: row.dev_project_id });
    }
  }
  return rows;
}

async function syncNow(o) {
  const { client } = o;
  const sheets = o.sheets || createSheets(o.cfg);
  const now = (o.now || new Date()).toISOString();
  const run = (await client.insert('sync_runs', { kind: 'budget', started_at: now }))[0];
  const out = { runId: run.id, ok: true, read: 0, changed: 0, errors: [] };
  const finish = rowsRead => client.update('sync_runs', { id: run.id }, { finished_at: new Date().toISOString(), ok: out.ok, changes: out.changed,
    rows_read: rowsRead, errors: out.errors.length ? out.errors : null });
  let rows;
  try { rows = await syncRows(client, sheets, now, out); }
  catch (e) {
    out.ok = false;
    out.errors.push({ what: 'run', detail: e.message });
    await finish(null);
    throw e;
  }
  out.ok = !out.errors.some(e => e.what === 'sheet') || out.read > 0;
  await finish({ sheets: rows.length });
  return out;
}

module.exports = { syncNow };
