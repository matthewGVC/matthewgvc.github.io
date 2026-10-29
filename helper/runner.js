/* ============================================================
   RUNNER — runs the helper's daily jobs when they're due (schedule.js).

     const r = createRunner({ jobs: { de, scan, backup }, last })
     await r.tick(now)     runs every due job, one at a time
     r.lastRuns()          → { de: { at, ok, error? }, … }  (for /health)
   Asana jobs (asana every 30 min, asanaFull 03:00, people 03:15) exist only
   when the config holds a token; the full read also counts as the plain one.
   The budget job (hourly) exists only when the Google key file is there.
     r.start()             ticks every minute

   A job that fails is still recorded as run for its slot, so a broken job
   waits for its next slot instead of retrying every minute; its error shows
   on /health and, through sync_runs, on the overview.
   startRunner(cfg) wires the real jobs; it does nothing without the helper's
   account.
   ============================================================ */
'use strict';

const path = require('path'), fs = require('fs');
const { due } = require('./schedule.js');

function createRunner(o) {
  const last = Object.assign({}, o.last || {});
  const results = {};
  let busy = false, timer = null;

  async function tick(now) {
    if (busy) return;
    busy = true;
    try {
      const at = now || new Date();
      const withAsana = !!(o.jobs.asana || o.jobs.asanaFull || o.jobs.people);
      for (const k of due(at, last, { asana: withAsana, budget: !!o.jobs.budget })) {
        if (!o.jobs[k]) continue;
        // the nightly full read already covers the plain read that is due beside it
        if (k === 'asana' && last.asana && last.asana >= at) continue;
        last[k] = at;
        if (k === 'asanaFull') last.asana = at;
        try {
          const r = await o.jobs[k]();
          // a job can finish without throwing yet report an abort (a DE run its checks stopped)
          const stopped = r && ((r.report && r.report.ok === false && r.report.aborted) || r.aborted);
          results[k] = stopped ? { at: last[k].toISOString(), ok: false, error: stopped } : { at: last[k].toISOString(), ok: true };
        }
        catch (e) { results[k] = { at: last[k].toISOString(), ok: false, error: e.message }; }
      }
    } finally { busy = false; }
  }

  return {
    tick,
    lastRuns: () => JSON.parse(JSON.stringify(results)),
    start: () => { tick(); timer = setInterval(() => tick(), 60000); return timer; },
    stop: () => clearInterval(timer)
  };
}

const NIGHTLY_KEEP = 14;

/* the Asana jobs, only when the config holds a token; all share one in-flight run */
function asanaJobs(cfg, client, syncNow) {
  if (!cfg.asanaToken) return {};
  const sync = syncNow || (o => require('./asana-sync.js').syncNow(o));
  const go = (kind, extra) => () => require('./inflight.js').runAsana(kind, () => sync(Object.assign({ cfg, client }, extra)));
  return { asana: go('plain', {}), asanaFull: go('full', { full: true }), people: go('people', { kind: 'people' }) };
}

/* the budget job, only when the helper has its Google key (D113) */
function budgetJobs(cfg, client) {
  const { createSheets } = require('./budget/sheets.js');
  const sheets = createSheets(cfg);
  return sheets.ready() ? { budget: () => require('./budget-sync.js').syncNow({ cfg, client, sheets }) } : {};
}

/* startup: only the newest run of each kind, and the newest full Asana read (C1) */
const RUN_KINDS = ['de', 'scan', 'asana', 'people', 'budget'];
async function readLastRuns(client) {
  const newest = { order: 'started_at.desc', limit: 1 };
  const rows = [];
  for (const kind of RUN_KINDS) rows.push.apply(rows, await client.select('sync_runs', { kind }, 'kind,started_at', newest));
  const full = await client.select('sync_runs', { kind: 'asana', 'totals->>full': 'true' }, 'kind,started_at', newest);
  return rows.concat(full.map(r => Object.assign({}, r, { totals: { full: true } })));
}

/* last-run map from sync_runs rows; the last full read is the asana row with totals.full */
function lastFromRuns(runs) {
  const last = {};
  runs.forEach(r => {
    if (!last[r.kind] || r.started_at > last[r.kind]) last[r.kind] = r.started_at;
    if (r.kind === 'asana' && r.totals && r.totals.full && (!last.asanaFull || r.started_at > last.asanaFull)) last.asanaFull = r.started_at;
  });
  Object.keys(last).forEach(k => { last[k] = new Date(last[k]); });
  return last;
}

async function startRunner(cfg) {
  const client = require('./supabase.js').createClient(cfg);
  if (!client.ready()) return null;
  let last = {};
  try {
    last = lastFromRuns(await readLastRuns(client));
  } catch (e) { /* table not there yet: everything is due */ }
  const exportsDir = path.join(__dirname, '..', 'exports');
  const runner = createRunner({
    last,
    jobs: {
      de: () => require('./de-sync.js').syncNow({ cfg, client }),
      ...asanaJobs(cfg, client),
      ...budgetJobs(cfg, client),
      scan: () => require('./scan.js').scanAll({ client, driveRoot: 'G:\\Shared drives' }),
      backup: async () => {
        const date = new Date().toISOString().slice(0, 10);
        await require('./backup.js').backup({ client, outDir: path.join(exportsDir, 'supabase-nightly-' + date) });
        const old = fs.readdirSync(exportsDir).filter(f => /^supabase-nightly-\d{4}-\d{2}-\d{2}$/.test(f)).sort().reverse().slice(NIGHTLY_KEEP);
        old.forEach(f => fs.rmSync(path.join(exportsDir, f), { recursive: true, force: true }));
      }
    }
  });
  runner.start();
  return runner;
}

module.exports = { createRunner, startRunner, asanaJobs, budgetJobs, lastFromRuns, readLastRuns };
