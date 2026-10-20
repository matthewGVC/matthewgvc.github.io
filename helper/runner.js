/* ============================================================
   RUNNER — runs the helper's daily jobs when they're due (schedule.js).

     const r = createRunner({ jobs: { de, scan, backup }, last })
     await r.tick(now)     runs every due job, one at a time
     r.lastRuns()          → { de: { at, ok, error? }, … }  (for /health)
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
      for (const k of due(now || new Date(), last)) {
        if (!o.jobs[k]) continue;
        last[k] = now || new Date();
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

async function startRunner(cfg) {
  const client = require('./supabase.js').createClient(cfg);
  if (!client.ready()) return null;
  const last = {};
  try {
    const runs = await client.select('sync_runs', {}, 'kind,started_at');
    runs.forEach(r => { if (!last[r.kind] || r.started_at > last[r.kind]) last[r.kind] = r.started_at; });
    Object.keys(last).forEach(k => { last[k] = new Date(last[k]); });
  } catch (e) { /* table not there yet: everything is due */ }
  const exportsDir = path.join(__dirname, '..', 'exports');
  const runner = createRunner({
    last,
    jobs: {
      de: () => require('./de-sync.js').syncNow({ cfg, client }),
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

module.exports = { createRunner, startRunner };
