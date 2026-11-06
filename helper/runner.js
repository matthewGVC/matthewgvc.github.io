/* ============================================================
   RUNNER — runs the helper's daily jobs when they're due (schedule.js).

     const r = createRunner({ jobs: { de, scan, backup }, last })
     await r.tick(now)     runs every due job, one at a time
     r.lastRuns()          → { de: { at, ok, error? }, … }  (for /health)
   Asana jobs (asana every 30 min, asanaFull 03:00, people 03:15, asanaWrite and
   asanaEvents each minute) exist only when the config holds a token; the full
   read also counts as the plain one. asanaWrite also runs the Asana name fix
   (asana-name-fix.js) when the config says asanaNameFix: true.
   The budget job (hourly) exists only once Google sign-in is saved (budget/sign-in.js).
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
      const withAsana = !!(o.jobs.asana || o.jobs.asanaFull || o.jobs.people || o.jobs.asanaWrite || o.jobs.asanaEvents);
      for (const k of due(at, last, { asana: withAsana, budget: !!o.jobs.budget, weekly: !!o.jobs.weekly })) {
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

/* the Asana jobs, only when the config holds a token; all share one in-flight run
   (opts.fetch: a stand-in for Asana, for tests) */
function asanaJobs(cfg, client, syncNow, opts) {
  if (!cfg.asanaToken) return {};
  const sync = syncNow || (o => require('./asana-sync.js').syncNow(o));
  const go = (kind, extra) => () => require('./inflight.js').runAsana(kind, () => sync(Object.assign({ cfg, client }, extra)));
  // the one-minute sync (Asana's events feed): its reads call sync directly, never through runAsana
  // again (a plain read would wait for ever on the events run that asked for it)
  const asanaEvents = () => require('./inflight.js').runAsana('events', async () => {
    const { createAsana } = require('./asana/client.js');
    const home = cfg.home || require('./config.js').home();
    const r = await require('./asana-events.js').checkEvents({ cfg, client, asana: createAsana(cfg, { fetch: opts && opts.fetch }),
      sync: o => sync(Object.assign({ cfg, client }, o)), stateFile: path.join(home, 'asana-events.json') });
    return r.ok ? r : Object.assign({}, r, { aborted: r.detail });
  });
  // the team's edits to Asana (0021): a write left half-done when the helper stopped is tried again
  let first = true;
  const asanaWrite = async () => {
    if (first) { first = false; await client.update('asana_writes', { status: 'working' }, { status: 'waiting' }).catch(() => {}); }
    let r = null, failed = null;
    try { r = await require('./asana-write.js').writeWaiting({ db: client, cfg, fetch: opts && opts.fetch }); } catch (e) { failed = e; }
    // the name fix (off unless asanaNameFix is true): its failure never fails or hides the edits' result
    if (cfg.asanaNameFix === true) {
      let names;
      try { names = await require('./asana-name-fix.js').fixNames({ db: client, cfg, fetch: opts && opts.fetch }); }
      catch (e) { names = { error: e.message }; }
      if (r) r = Object.assign({}, r, { names });
    }
    if (failed) throw failed;
    return r;
  };
  return { asana: go('plain', {}), asanaFull: go('full', { full: true }), people: go('people', { kind: 'people' }), asanaWrite, asanaEvents };
}

/* the budget job, only once the helper holds a Google sign-in (D113) */
function budgetJobs(cfg, client) {
  const { createSheets } = require('./budget/sheets.js');
  const sheets = createSheets(cfg);
  return sheets.ready() ? { budget: () => require('./budget-sync.js').syncNow({ cfg, client, sheets }) } : {};
}

/* the Sunday email, only once the helper holds its Gmail sign-in (helper/mail/sign-in.js) */
function weeklyJobs(cfg, client) {
  const { createMail } = require('./mail/gmail.js');
  const mail = createMail(cfg);
  return mail.ready() ? { weekly: () => require('./weekly-report.js').sendWeekly({ cfg, client, mail }) } : {};
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

/* backups aren't in sync_runs: the newest nightly folder with a manifest is the last run */
function lastBackup(exportsDir) {
  let dirs = [];
  try { dirs = fs.readdirSync(exportsDir).filter(f => /^supabase-nightly-\d{4}-\d{2}-\d{2}$/.test(f)).sort().reverse(); }
  catch (e) { return null; }
  for (const d of dirs) {
    try { return fs.statSync(path.join(exportsDir, d, 'manifest.json')).mtime; } catch (e) { /* unfinished: try the one before */ }
  }
  return null;
}

async function startRunner(cfg) {
  const client = require('./supabase.js').createClient(cfg);
  if (!client.ready()) return null;
  let last = {};
  try {
    last = lastFromRuns(await readLastRuns(client));
  } catch (e) { /* table not there yet: everything is due */ }
  const exportsDir = path.join(__dirname, '..', 'exports');
  const backedUp = lastBackup(exportsDir);
  if (backedUp) last.backup = backedUp;
  const sent = require('./weekly-report.js').lastSent(cfg);
  if (sent) last.weekly = sent;
  const runner = createRunner({
    last,
    jobs: {
      de: () => require('./de-sync.js').syncNow({ cfg, client }),
      ...asanaJobs(cfg, client),
      ...budgetJobs(cfg, client),
      ...weeklyJobs(cfg, client),
      scan: () => require('./scan.js').scanAll({ client, driveRoot: 'G:\\Shared drives', ask: require('./folder-ai.js').makeAsk(cfg) }),
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

module.exports = { createRunner, startRunner, asanaJobs, budgetJobs, weeklyJobs, lastFromRuns, readLastRuns, lastBackup };
