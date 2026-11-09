/* ============================================================
   ASANA NAME FIX — the helper writes a listing's name in Asana the one way
   (decision 12, stage 2). OFF unless the helper's config says
   "asanaNameFix": true, which Matt sets after reading the dry run.

   What it may write, and nothing else: the task's name; its 📍 City/Hood and
   📍 Zip, each only when that field is empty on the live task and only as part
   of a rename (City/Hood from the town the name carried, else the job's hood or
   town; Zip from the job); one comment (a story) saying what changed, holding
   only the new name, the town and the zip. A field the task lacks, or a value
   Asana refuses, is left out (logged) and never blocks the rename. Never a
   price, commission, contract field or client name. A name ruleName isn't sure of is
   never touched: it is left for Matt (Errors M30).

     planFixes(props, { skip }) → { fixes: [{ gid, propertyId, from, to, town, fill: { hood, zip }, why }], left: [{ gid, propertyId, name, why }] }
         pure. Rows with an Asana task and a stage; skip holds the gids Matt said no to (cfg.nameFixSkip).
         The newest deal wins (decision 13): deals on one place take the base name of the place's
         newest list-side deal, plus " (Rental)" for a rental, when that answer is sure and every
         deal's own name is the same place; otherwise each deal's own answer stands.
     await fixNames({ db, cfg, fetch, now }) → { done, failed, skipped }
         at most 20 a run. Each task is read first: a name already the rule (a fix the sync hasn't
         read yet) or changed since the snapshot is skipped. A failure is logged and not tried
         again until the next day.
     await dryRun({ db, cfg, outDir, date }) → { reportFile }   reads only, writes the report

     node helper/asana-name-fix.js --dry-run [--out <dir>]
         writes <dir>/asana-name-fix-<date>.md (default exports\): no Asana call, no database write.

   Loop safety: the rename reaches the deal through the events feed and the sync (name-flow.js);
   the next plan then finds the name already the rule and plans nothing. One comment per task.
   Requests go through asana-write.js's asanaCall; the token is in one header, never in a log.
   ============================================================ */
'use strict';

const path = require('path'), fs = require('fs');
const N = require('../assets/js/naming.js');
const A = require('../assets/js/address-aliases.js');
const GP = require('../assets/js/places.js');
const { asanaCall, valueFor } = require('./asana-write.js');

const HOOD = '📍 City/Hood', ZIP = '📍 Zip';
const PER_RUN = 20;
const NOTE = 'Renamed in Asana by the helper (naming rule)';
const TASK_FIELDS = 'name,custom_fields.name,custom_fields.type,custom_fields.resource_subtype,custom_fields.enum_options.name,'
  + 'custom_fields.enum_options.enabled,custom_fields.display_value';
const COLS = 'id,asana_gid,dev_project_id,asana,market,kind,side,stage,place_id,created_at,core';

const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const blank = v => v === undefined || v === null || norm(v) === '';
const fieldKey = s => norm(s).toLowerCase();

/* the place a name stands for, as ruleName's own guard reads it */
function placeOf(name, market) {
  const s = A.splitName(N.baseName(name));
  return GP.placeKey({ address: s.street, unit: s.unit || (s.house ? 'House ' + s.house : '') }, market);
}

function hoodOf(p) { const f = (p.asana && p.asana.fields) || {}; return f[HOOD]; }

function zipOf(p) { const f = (p.asana && p.asana.fields) || {}; return f[ZIP]; }

/* what the job itself knows to fill in when a rename happens: its hood (NYC) or town (NJ, FL), and its zip.
   null for a value the snapshot's field already holds, one the job doesn't know, or the name's own text. */
function fillOf(p, own) {
  const core = p.core || {};
  const place = p.market === 'NYC' ? core.neighborhood : core.city;
  const h = norm(place);
  const leftover = h && fieldKey(h) === fieldKey(N.baseName(p.asana.name));
  const hood = !own.town && blank(hoodOf(p)) && h && !leftover ? h : null;
  const z = norm(core.zip);
  return { hood, zip: blank(zipOf(p)) && /^\d{5}$/.test(z) ? z : null };
}

function answerOf(p) {
  return N.ruleName(p.asana.name, { market: p.market, cityHood: hoodOf(p), rental: p.kind === 'rental', devHouse: !!p.dev_project_id });
}

function planFixes(props, opts) {
  const skip = new Set(((opts && opts.skip) || []).map(String));
  const rows = (props || []).filter(p => p && p.asana_gid && p.stage && p.asana && !blank(p.asana.name));

  // the newest deal wins: per place, the base name every deal on it takes
  const byPlace = new Map();
  rows.forEach(p => { if (p.place_id) byPlace.set(p.place_id, (byPlace.get(p.place_id) || []).concat([p])); });
  const placeBase = new Map();
  byPlace.forEach(deals => {
    if (deals.length < 2) return;
    const lists = deals.filter(d => d.side !== 'buy').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    if (!lists.length) return;
    const win = answerOf(lists[0]);
    if (!win.sure) return;
    const key = placeOf(win.base, lists[0].market);
    if (!key || !deals.every(d => placeOf(d.asana.name, d.market) === key)) return;
    deals.forEach(d => placeBase.set(d, win.base));
  });

  const fixes = [], left = [];
  rows.forEach(p => {
    const gid = String(p.asana_gid);
    if (skip.has(gid)) return;
    const own = answerOf(p);
    if (!own.sure) { left.push({ gid, propertyId: p.id, name: p.asana.name, why: own.why }); return; }
    const to = placeBase.has(p) ? placeBase.get(p) + (p.kind === 'rental' ? ' (Rental)' : '') : own.name;
    if (norm(p.asana.name) === norm(to)) return;
    fixes.push({ gid, propertyId: p.id, from: p.asana.name, to, town: own.town && blank(hoodOf(p)) ? own.town : null, fill: fillOf(p, own), why: null });
  });
  return { fixes, left };
}

/* gids that failed, and the day they did: not tried again until the next day */
const failedOn = new Map();
/* gids skipped (already the rule, or renamed since the snapshot), with the day and the snapshot's
   name: not asked again that day unless the snapshot changes, so a task the sync no longer reads
   isn't fetched every minute and can't crowd out the fixes behind it */
const skippedOn = new Map();
const dayOf = d => { const x = new Date(d); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); };

async function fixNames(o) {
  const cfg = (o && o.cfg) || {}, db = o.db;
  const out = { done: 0, failed: 0, skipped: 0 };
  if (cfg.asanaNameFix !== true || !cfg.asanaToken) return out;
  const now = o.now ? new Date(o.now) : new Date(), today = dayOf(now);
  const call = asanaCall({ token: cfg.asanaToken, fetch: o.fetch });
  const props = await db.select('properties', null, COLS);
  const rowOf = new Map(props.filter(p => p && p.asana_gid).map(p => [String(p.asana_gid), p]));
  const plan = planFixes(props, { skip: cfg.nameFixSkip });
  const held = f => { const s = skippedOn.get(f.gid); return s && s.day === today && s.from === norm(f.from); };
  const due = plan.fixes.filter(f => failedOn.get(f.gid) !== today && !held(f)).slice(0, PER_RUN);
  const skip = f => { skippedOn.set(f.gid, { day: today, from: norm(f.from) }); out.skipped++; };
  const log = (f, newValue, note) => db.insert('changes', [{ property_id: f.propertyId, field: 'asana name', old_value: f.from,
    new_value: newValue, note, source: 'Helper', at: now.toISOString() }]).catch(() => {});

  for (const f of due) {
    const at = '/tasks/' + encodeURIComponent(f.gid);
    try {
      const task = await call('GET', at + '?opt_fields=' + encodeURIComponent(TASK_FIELDS));
      const live = norm(task.name);
      // already the rule (made on an earlier tick, not yet read by the sync), or renamed since: leave it
      if (live === norm(f.to) || live !== norm(f.from)) { skip(f); continue; }
      const data = { name: f.to };
      let town = null;
      const said = [], left = [];
      const field = (task.custom_fields || []).find(x => fieldKey(x.name) === fieldKey(HOOD));
      if (f.town) {
        if (!field) throw new Error('The Asana task has no ' + HOOD + ' field for ' + f.town + '.');
        if (blank(field.display_value)) { data.custom_fields = { [field.gid]: valueFor(field, f.town) }; town = f.town; }
        else if (fieldKey(field.display_value) !== fieldKey(f.town)) { skip(f); continue; }   // filled since with another town
      } else {
        // the name carried a town the snapshot's City/Hood already held: if it was cleared since, fill it too
        const row = rowOf.get(f.gid), own = row ? answerOf(row) : null;
        if (own && own.sure && own.town && field && blank(field.display_value)) {
          data.custom_fields = { [field.gid]: valueFor(field, own.town) }; town = own.town;
        }
      }
      // what the job knows, only when the live field is empty; never blocks the rename
      const extra = (label, want, key, f) => {
        if (!want) return;
        if (!f) { left.push(label + ' (the task has no such field)'); return; }
        if (!blank(f.display_value)) return;
        try { data.custom_fields = Object.assign({}, data.custom_fields, { [f.gid]: valueFor(f, want) }); said.push(key + ' set to ' + want); }
        catch (e) { left.push(label + ' (' + String(e.message).slice(0, 120) + ')'); }
      };
      const fields = task.custom_fields || [];
      const zipField = fields.find(x => fieldKey(x.name) === fieldKey(ZIP));
      if (!town && f.fill && f.fill.hood) extra('City/Hood', f.fill.hood, 'City/Hood', field);
      if (f.fill && f.fill.zip) extra('Zip', f.fill.zip, 'Zip', zipField);
      await call('PUT', at, { data });
      out.done++;
      let note = NOTE;
      if (left.length) note += '; left out: ' + left.join(', ');
      const say = (town ? [town + ' moved to City/Hood'] : []).concat(said);
      try {
        await call('POST', at + '/stories', { data: { text: 'Renamed to "' + f.to + '" to match the GVC naming rule' + say.map(s => '; ' + s).join('') + '.' } });
      } catch (e) { note += '; the comment could not be added: ' + e.message; }
      await log(f, f.to, note);
    } catch (e) {
      out.failed++;
      failedOn.set(f.gid, today);
      await log(f, null, 'Not renamed in Asana: ' + String(e.message).slice(0, 300));
    }
  }
  return out;
}

/* ---------------- the dry run: what it would do, for Matt to read ---------------- */

const TEAM = ['Asana', 'legacy', 'DE', 'seed'];

async function dryRun(o) {
  const cfg = o.cfg || {}, db = o.db;
  const date = o.date || new Date().toISOString().slice(0, 10);
  const outDir = o.outDir || path.join(__dirname, '..', 'exports');
  const props = await db.select('properties', null, COLS + ',label');
  const plan = planFixes(props, { skip: cfg.nameFixSkip });
  const fixOf = new Map(plan.fixes.map(f => [f.gid, f]));
  const { nameFlow } = require('./name-flow.js');

  const lines = ['# Asana name fix: dry run ' + date, '',
    'Nothing was written to Asana or the database. ' + plan.fixes.length + ' rename(s), ' + plan.left.length + ' left for Matt'
      + ((cfg.nameFixSkip || []).length ? ', ' + cfg.nameFixSkip.length + ' Matt said no to.' : '.'), '',
    '## Renames', ''];
  if (!plan.fixes.length) lines.push('None.');
  plan.fixes.forEach(f => lines.push('- ' + norm(f.from) + ' → ' + f.to + (f.town ? ' (City/Hood: ' + f.town + ')' : '')
      + (f.fill && (f.fill.hood || f.fill.zip) ? ' (' + [f.fill.hood ? 'City/Hood: ' + f.fill.hood : '', f.fill.zip ? 'Zip: ' + f.fill.zip : ''].filter(Boolean).join(', ') + ')' : '') + ' [' + f.gid + ']'));
  lines.push('', '## Left for Matt', '');
  if (!plan.left.length) lines.push('None.');
  plan.left.forEach(l => lines.push('- ' + norm(l.name) + ': ' + l.why + ' [' + l.gid + ']'));
  lines.push('', '## What the workspace will show after the merge', '');
  let shown = 0;
  props.filter(p => p.asana_gid && p.asana && !blank(p.asana.name)).forEach(p => {
    const f = fixOf.get(String(p.asana_gid));
    const r = nameFlow(p, f ? f.to : p.asana.name);
    if (r.label === p.label && !r.changes.length) return;
    shown++;
    lines.push('- ' + (p.label || '(no label)') + ' → ' + r.label);
    r.changes.forEach(c => {
      const fact = ((p.core || {}).facts || {})[c.field];
      const team = fact && fact.source && TEAM.indexOf(fact.source) === -1;
      lines.push('  - ' + c.field + ': ' + (c.old == null ? '(none)' : c.old) + ' → ' + c.new + (team ? ' (the team\'s value, Asana\'s now replaces it)' : ''));
    });
  });
  if (!shown) lines.push('No label or address changes.');

  fs.mkdirSync(outDir, { recursive: true });
  const reportFile = path.join(outDir, 'asana-name-fix-' + date + '.md');
  fs.writeFileSync(reportFile, lines.join('\n') + '\n');
  return { reportFile, fixes: plan.fixes.length, left: plan.left.length };
}

if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i === -1 ? null : a[i + 1]; };
  if (!a.includes('--dry-run')) {
    console.log('Usage: node helper/asana-name-fix.js --dry-run [--out <dir>]   (the fix itself runs inside the helper, when switched on)');
    process.exit(1);
  }
  const cfg = require('./config.js').loadConfig();
  const db = require('./supabase.js').createClient(cfg);
  if (!db.ready()) { console.log('The helper has no database sign-in yet.'); process.exit(1); }
  dryRun({ db, cfg, outDir: arg('--out') || undefined }).then(r => {
    console.log('Dry run: ' + r.fixes + ' rename(s), ' + r.left + ' left for Matt. Report: ' + r.reportFile);
  }, e => { console.log('Dry run failed: ' + e.message); process.exit(1); });
}

module.exports = { planFixes, fixNames, dryRun, norm };
