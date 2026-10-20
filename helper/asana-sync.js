/* ============================================================
   ASANA SYNC — reads Asana (read-only) and reports what the helper would keep.
   For now this is a DRY RUN shell: it writes a report and nothing else (no
   Supabase, no Drive, and never anything written to Asana).

     node helper/asana-sync.js --whoami
     node helper/asana-sync.js --dry-run [--record]

   --whoami   prints the name on the Asana account the token belongs to
   --dry-run  reads the listing, development and loose-task projects through the
              allowlist and writes exports/asana-dry-run-<date>.md: projects,
              task counts, the Listing Status and section values seen, how many
              tasks fill each kept field, and kept fields no task has
   --record   also saves the KEPT data (never the raw answer) to
              helper/fixtures/recorded/<date>/ (gitignored)
   Needs asanaToken in the helper's config. Without it: "No Asana token yet…",
   exit 1. The report holds no addresses, names or figures.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const { createAsana, NO_TOKEN } = require('./asana/client.js');
const allow = require('./asana/allow.js');
const { recordKept } = require('./asana/record.js');

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
  const miss = allow.missingKept(listingTasks);
  L.push('', 'missing kept fields: ' + (miss.length ? miss.join(', ') : 'none'), '');
  return L.join('\n');
}

async function dryRun(opts) {
  const o = opts || {};
  const cfg = o.cfg || require('./config.js').loadConfig();
  const asana = createAsana(cfg, { fetch: o.fetch });
  if (!asana.ready()) return { ok: false, aborted: NO_TOKEN };
  const date = o.date || today();
  const projects = projectsOf(cfg.asana), listingTasks = [];

  for (const p of projects) {
    try {
      const raw = await asana.get('/projects/' + p.gid + '/tasks', { opt_fields: allow.TASK_FIELDS });
      const kept = raw.map(r => allow.keepTask(r, p.gid));
      p.tasks = kept.length;
      p.open = kept.filter(t => !t.completed).length;
      if (p.kind === 'listings') listingTasks.push.apply(listingTasks, kept);
      if (o.record) recordKept(p.kind === 'listings' ? 'listings-' + p.label : p.label, kept, { dir: o.recordDir, date });
    } catch (e) {
      if (e.status === 401 || e.status === 403) return { ok: false, aborted: e.message };
      p.error = e.message;
    }
  }

  const outDir = o.outDir || path.join(REPO, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const reportFile = path.join(outDir, 'asana-dry-run-' + date + '.md');
  fs.writeFileSync(reportFile, reportText(date, projects, listingTasks));
  return { ok: true, reportFile, projects, missing: allow.missingKept(listingTasks) };
}

module.exports = { dryRun, projectsOf };

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--whoami')) {
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
    console.log('Usage: node helper/asana-sync.js --whoami  |  --dry-run [--record]');
  }
}
