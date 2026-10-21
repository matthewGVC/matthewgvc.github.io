/* ============================================================
   ASANA SYNC — reads Asana (read-only, D77) and writes it into the workspace.
   Nothing is ever written to Asana, and nothing here touches Drive.

     node helper/asana-sync.js --whoami
     node helper/asana-sync.js --dry-run [--record]
     node helper/asana-sync.js --plan [--fixtures <dir>]
     node helper/asana-sync.js --apply-plan exports/asana-link-plan-<date>.md
     node helper/asana-sync.js --write [--full]
     node helper/asana-sync.js --people

   --whoami      prints the name on the Asana account the token belongs to
   --dry-run     reads the projects through the allowlist and writes
                 exports/asana-dry-run-<date>.md (counts and field names only)
   --record      also saves the KEPT data (never the raw answer) to
                 helper/fixtures/recorded/asana-<date>/ (gitignored); loose-project
                 tasks only when they name a linked development (D65, as the
                 sync keeps them; none when no development is linked or the
                 database can't be read)
   --plan        the first link plan (S5, D54): reads every listing task and
                 writes exports/asana-link-plan-<date>.md/.json for Matt to tick.
                 Reads the database (to match existing jobs) but writes nothing.
   --apply-plan  the first real write: ticked rows become jobs / pitches /
                 development links; everything read is cached
   --write       one sync: tasks changed since the last good run (--full: all)
   --people      reads 👋 People into asana_people
   --fixtures    answers from made-up files instead of Asana (helper/asana/replay.js);
                 refused for anything that would write the real database

     syncNow({ cfg, client, fetch?, fixturesDir?, full?, plan?, kind?, now? })
       → applyRun's result + { report }      one sync at a time; a second call
                                             joins the one running
     planNow({ cfg, client?, fetch?, fixturesDir?, outDir?, date? }) → { plan, files, report }

   Needs asanaToken in the helper's config. Without it: "No Asana token yet…",
   exit 1. Reports hold no figures; the plan names addresses (exports/ is
   gitignored and stays on Matt's PC).
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { createAsana, NO_TOKEN } = require('./asana/client.js');
const allow = require('./asana/allow.js');
const { recordKept } = require('./asana/record.js');
const { readRun, looseNeedles, namesOne } = require('./asana/read.js');
const { makePlan, writePlanFiles, readPlanFile } = require('./asana/link.js');
const { applyRun } = require('./asana/apply.js');
const { replayFetch } = require('./asana/replay.js');

const REPO = path.join(__dirname, '..');

function today() { return new Date().toISOString().slice(0, 10); }

/* [{ label, kind, gid }] for every project the config names */
function projectsOf(asanaCfg) {
  const a = asanaCfg || {}, out = [];
  Object.keys(a.listings || {}).forEach(k => out.push({ label: k, kind: 'listings', gid: a.listings[k] }));
  (a.devs || []).forEach((g, i) => out.push({ label: 'dev-' + (i + 1), kind: 'devs', gid: g }));
  (a.loose || []).forEach((g, i) => out.push({ label: 'loose-' + (i + 1), kind: 'loose', gid: g }));
  return out;
}

function tally(list) {
  const m = {};
  list.forEach(v => { if (v !== null && v !== undefined) m[v] = (m[v] || 0) + 1; });
  return Object.keys(m).sort().map(k => k + ' (' + m[k] + ')').join(', ') || 'none';
}

function reportText(date, projects, listingTasks) {
  const L = ['# Asana dry run, ' + date, '',
    'Read-only. Addresses, names, figures and notes are not in this report.', '', '## Projects', ''];
  projects.forEach(p => {
    L.push('- ' + p.label + ' (' + p.gid + '): ' + (p.error ? 'could not be read: ' + p.error
      : p.tasks + ' tasks (' + p.open + ' open)'));
  });
  L.push('', '## Listing projects', '', 'Listing Status values seen: ' + tally(listingTasks.map(t => t.fields['Listing Status'])),
    '', 'Sections seen: ' + tally(listingTasks.map(t => t.section)), '', '## Kept fields, tasks that fill each', '');
  allow.KEPT_FIELDS.forEach(n => {
    L.push('- ' + n + ': ' + listingTasks.filter(t => t.fields[n] !== null && t.fields[n] !== undefined).length + ' of ' + listingTasks.length);
  });
  const miss = missingOf(projects, listingTasks);
  L.push('', 'missing kept fields: ' + (miss === null ? 'no verdict (a listing project could not be read)' : miss.length ? miss.join(', ') : 'none'), '');
  return L.join('\n');
}

/* a listing project that failed to read leaves a partial set: no verdict */
function missingOf(projects, listingTasks) {
  return projects.some(p => p.kind === 'listings' && p.error) ? null : allow.missingKept(listingTasks);
}

async function dryRun(opts) {
  const o = opts || {};
  const cfg = o.cfg || require('./config.js').loadConfig();
  const asana = createAsana(cfg, { fetch: o.fetch });
  if (!asana.ready()) return { ok: false, aborted: NO_TOKEN };
  const date = o.date || today();
  const projects = projectsOf(cfg.asana), listingTasks = [];
  // D65: a recorded loose task must name a linked development (o.looseNames, else from the database)
  let looseNames = o.looseNames || [];
  if (o.record && !o.looseNames) {
    try {
      const client = o.client || require('./supabase.js').createClient(cfg);
      if (client.ready()) looseNames = looseNeedles((await client.select('dev_projects')).filter(d => d.asana_project_gid));
    } catch (e) { looseNames = []; }
  }

  for (const p of projects) {
    try {
      const raw = await asana.get('/projects/' + p.gid + '/tasks', { opt_fields: allow.TASK_FIELDS });
      const kept = raw.map(r => allow.keepTask(r, p.gid));
      p.tasks = kept.length;
      p.open = kept.filter(t => !t.completed).length;
      if (p.kind === 'listings') listingTasks.push.apply(listingTasks, kept);
      if (o.record) recordKept(p.kind === 'listings' ? 'listings-' + p.label : p.label,
        p.kind === 'loose' ? kept.filter(t => namesOne(t.name, looseNames)) : kept, { dir: o.recordDir, date });
    } catch (e) {
      if (e.status === 401 || e.status === 403) return { ok: false, aborted: e.message };
      p.error = e.message;
    }
  }

  const outDir = o.outDir || path.join(REPO, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const reportFile = path.join(outDir, 'asana-dry-run-' + date + '.md');
  fs.writeFileSync(reportFile, reportText(date, projects, listingTasks));
  return { ok: true, reportFile, projects, missing: missingOf(projects, listingTasks) };
}

/* ---------- the real sync ---------- */

function asanaFor(cfg, o) {
  const fetch = o.fetch || (o.fixturesDir ? replayFetch(o.fixturesDir) : undefined);
  const c = o.fixturesDir && !cfg.asanaToken ? Object.assign({}, cfg, { asanaToken: 'fixtures' }) : cfg;
  const asana = createAsana(c, { fetch });
  if (!asana.ready()) throw new Error(NO_TOKEN);
  return asana;
}

function summary(run) {
  return { ok: run.ok, aborted: run.aborted || null, full: run.full, listings: run.listings.length, devs: run.devs.length,
    loose: run.loose.length, people: run.people ? run.people.length : null, missing: run.missing, warnings: run.warnings };
}

let running = null;
function syncNow(opts) {
  if (!running) running = syncOnce(opts || {}).finally(() => { running = null; });
  return running;
}

async function syncOnce(o) {
  const cfg = o.cfg || require('./config.js').loadConfig();
  if (o.fixturesDir && !o.client) throw new Error('Refusing to write made-up Asana tasks (fixtures) into the real database.');
  const client = o.client || require('./supabase.js').createClient(cfg);
  if (!client.ready()) throw new Error('No helper account yet: add helperEmail and helperPassword to the helper\'s config.');
  const asana = asanaFor(cfg, o);
  const now = o.now || new Date();
  let run;
  if (o.kind === 'people') run = await readRun({ asana, cfg, only: 'people' });
  else {
    const runs = (await client.select('sync_runs', { kind: 'asana' })).filter(r => r.ok && r.finished_at)
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    const last = runs[0], lastOpen = {};
    runs.filter(r => r.totals && r.totals.full).reverse().forEach(r => Object.assign(lastOpen, r.totals.open || {}));
    const linked = (await client.select('dev_projects')).filter(d => d.asana_project_gid);
    const full = !!(o.full || o.plan || !last);
    // since is only for the modified_since query; a full read asks for (and details) every task
    run = await readRun({ asana, cfg, full, since: full ? null : last.started_at, lastOpen, looseNames: looseNeedles(linked) });
  }
  const res = await applyRun({ client, run, now, plan: o.plan, helperVersion: require('./package.json').version });
  return Object.assign(res, { report: summary(run) });
}

/* The first link plan: read everything, match it to what the workspace has, write the plan. */
async function planNow(opts) {
  const o = opts || {};
  const cfg = o.cfg || require('./config.js').loadConfig();
  const asana = asanaFor(cfg, o);
  const client = o.client || (o.fixturesDir ? null : require('./supabase.js').createClient(cfg));
  const existing = { properties: [], pitches: [], devs: [] };
  const warnings = [];
  if (client && client.ready()) {
    existing.properties = await client.select('properties');
    existing.pitches = await client.select('pitches');
    existing.devs = await client.select('dev_projects');
  } else warnings.push('No helper account here, so existing jobs weren\'t matched.');
  const run = await readRun({ asana, cfg, full: true, since: null, looseNames: looseNeedles(existing.devs.filter(d => d.asana_project_gid)) });
  if (!run.ok) return { ok: false, aborted: run.aborted };
  const plan = makePlan(run, existing);
  const date = o.date || today();
  const files = writePlanFiles(plan, o.outDir || path.join(REPO, 'exports', o.fixturesDir ? 'fixture-runs' : ''), date);
  return { ok: true, plan, files, report: Object.assign(summary(run), { warnings: run.warnings.concat(warnings) }) };
}

module.exports = { dryRun, projectsOf, syncNow, planNow };

function done(r) {
  const rep = r.report || {};
  if (rep.ok === false) { console.log('Asana sync stopped (nothing changed): ' + rep.aborted); process.exit(1); }
  console.log('Asana sync done: ' + r.changes + ' change(s), ' + r.created + ' new row(s), ' + r.errors.length + ' note(s), ' +
    r.unlinked.length + ' task(s) not linked.');
  r.errors.forEach(e => console.log('  ' + e.what + ': ' + e.detail));
  (rep.warnings || []).forEach(w => console.log('  warning: ' + w));
  process.exit(r.errors.some(e => e.what === 'no plan') ? 1 : 0);
}
const failed = e => { console.log('Asana sync failed: ' + e.message); process.exit(1); };

if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i === -1 ? null : a[i + 1]; };
  const fixturesDir = arg('--fixtures');
  if (a.includes('--plan')) {
    planNow({ fixturesDir }).then(r => {
      if (!r.ok) { console.log('Plan stopped: ' + r.aborted); process.exit(1); }
      console.log('Link plan: ' + r.plan.rows.length + ' row(s), ' + r.plan.rows.filter(x => x.tick).length + ' ticked. Tick it here: ' + r.files.md);
      r.report.warnings.forEach(w => console.log('  warning: ' + w));
    }, failed);
  } else if (a.includes('--apply-plan')) {
    syncNow({ fixturesDir, plan: readPlanFile(arg('--apply-plan')) }).then(done, failed);
  } else if (a.includes('--write')) {
    syncNow({ fixturesDir, full: a.includes('--full') }).then(done, failed);
  } else if (a.includes('--people')) {
    syncNow({ fixturesDir, kind: 'people' }).then(done, failed);
  } else if (a.includes('--whoami')) {
    const asana = createAsana(require('./config.js').loadConfig());
    if (!asana.ready()) { console.log(NO_TOKEN); process.exit(1); }
    asana.whoami().then(me => { console.log(me.name); }, e => { console.log(e.message); process.exit(1); });
  } else if (a.includes('--dry-run')) {
    dryRun({ record: a.includes('--record') }).then(r => {
      console.log(r.ok ? 'Dry run OK: ' + r.projects.length + ' project(s) read. Report: ' + r.reportFile
        : 'Dry run stopped: ' + r.aborted);
      process.exit(r.ok ? 0 : 1);
    }, e => { console.log('Dry run failed: ' + e.message); process.exit(1); });
  } else {
    console.log('Usage: node helper/asana-sync.js --whoami | --dry-run [--record] | --plan | --apply-plan <file> | --write [--full] | --people  [--fixtures <dir>]');
  }
}
