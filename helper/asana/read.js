/* ============================================================
   ASANA READ — one run's worth of Asana, read-only, through the allowlist.

     await readRun({ asana, cfg, full, since, lastOpen?, looseNames?, only? })
       asana       createAsana(...) (GET only)
       cfg         the helper config (cfg.asana: listings, devs, devPortfolios, loose, people)
       full        true: every listing task (catches deletions and moves);
                   false: only tasks modified since `since` (Asana's modified_since)
       since       the start of the last good run (ISO), or null on the first run
       lastOpen    { NYC: 40, … } open tasks per listing project at the last good
                   full run; a full read under half of that aborts (plan §8a)
       looseNames  lower-case names / streets of the linked developments; loose
                   tasks (Creative Requests etc.) naming none of them are dropped
                   before anything is kept (D65). Empty → loose projects not read.
       only        'people' → read just 👋 People (the 3:15 job)
     → { ok, aborted?, full, since, listings, devs, loose, people, warnings,
         missing, readProjects, totals, rowsRead }

   listings  allowlisted tasks (allow.keepTask) + market; tasks changed since
             `since` (all of them on the first run) also carry subtasks
             (allow.keepSubtask) and history (allow.keepStory, kept kinds only)
   devs      [{ project: { gid, name }, tasks }] for every 🚧 project: all its tasks
             (batch days need every tick), history for the changed ones
   loose     allow.keepLoose rows that name a linked development
   people    allow.keepPerson rows, or null when not asked
   missing   kept field names no listing task has (a renamed field), judged on a
             clean full read only; null when a listing project failed to read
             (a partial set gives no verdict)
   readProjects  listing project gids read in full without error (the writer
             only treats a task as gone when its project was read whole)

   Stops: a refused token ("Asana refused the token"), a page sequence that
   repeats a gid, or a full read under half the last good open count. Any other
   failure of one project is a warning and the rest is read.
   Writes nothing, anywhere.
   ============================================================ */
'use strict';

const allow = require('./allow.js');

const SUBTASK_FIELDS = 'name,completed,completed_at,due_on,assignee.name,parent.gid';
const LOOSE_FIELDS = 'name,completed_at,due_on,assignee.name,memberships.project.gid';
const PEOPLE_FIELDS = 'name,memberships.section.name,custom_fields.name,custom_fields.display_value,custom_fields.enum_value.name,custom_fields.multi_enum_values.name';

class StopRun extends Error {}

function stopFor(e) {
  if (e instanceof StopRun) return e.message;
  if (e && (e.status === 401 || e.status === 403)) return 'Asana refused the token';
  if (e && e.message === 'Asana sent a task twice') return 'Asana sent a task twice, so its pages can\'t be trusted. Nothing was changed.';
  return null;
}

/* the lower-case names a loose task must contain to be about a development */
function looseNeedles(devs) {
  const out = [];
  (devs || []).forEach(d => {
    [d.label, d.name].filter(Boolean).forEach(n => {
      const s = String(n).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!s) return;
      out.push(s);
      const w = s.split(' ');
      if (/^\d/.test(s) && w.length > 2) out.push(w.slice(0, 2).join(' '));   // "619 bradley ave" → "619 bradley"
      else if (!/^\d/.test(s) && w.length > 1 && w[0].length >= 4) out.push(w[0]);   // "casa avenida" → "casa"
    });
  });
  return Array.from(new Set(out));
}

function namesOne(name, needles) {
  const n = ' ' + String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase() + ' ';
  return (needles || []).some(x => n.indexOf(' ' + x + ' ') !== -1);
}

async function readRun(o) {
  const { asana } = o;
  const a = (o.cfg && o.cfg.asana) || {};
  const since = o.since || null;
  const full = !!(o.full || !since);
  const out = { ok: true, full, since, listings: [], devs: [], loose: [], people: null, warnings: [], missing: null,
    readProjects: [], totals: { full, open: {} }, rowsRead: {} };
  const changed = t => !since || (t.modifiedAt && t.modifiedAt > since);

  async function detail(t, withSubtasks) {
    if (withSubtasks) t.subtasks = (await asana.get('/tasks/' + t.gid + '/subtasks', { opt_fields: SUBTASK_FIELDS })).map(allow.keepSubtask);
    t.history = (await asana.get('/tasks/' + t.gid + '/stories', { opt_fields: allow.STORY_FIELDS })).map(allow.keepStory).filter(Boolean);
  }

  try {
    if (o.only === 'people') {
      out.kind = 'people';
      const raw = await asana.get('/projects/' + a.people + '/tasks', { opt_fields: PEOPLE_FIELDS });
      out.people = raw.map(allow.keepPerson);
      out.rowsRead.people = out.people.length;
      return out;
    }

    /* listings */
    let listingError = false;
    for (const market of Object.keys(a.listings || {})) {
      const gid = a.listings[market];
      let kept;
      try {
        const q = { project: gid, opt_fields: allow.TASK_FIELDS };
        if (!full) q.modified_since = since;
        kept = (await asana.get('/tasks', q)).map(r => Object.assign(allow.keepTask(r, gid), { market }));
      } catch (e) {
        if (stopFor(e)) throw e;
        listingError = true;
        out.warnings.push(market + ' listings could not be read: ' + e.message);
        continue;
      }
      for (const t of kept) if (changed(t)) await detail(t, true);
      const open = kept.filter(t => !t.completed).length;
      if (full) {
        out.totals.open[market] = open;
        out.readProjects.push(gid);
        const before = o.lastOpen && o.lastOpen[market];
        if (before && open < before / 2) {
          throw new StopRun('Asana sent fewer than half the open ' + market + ' tasks of the last good run (' + open + ' of ' + before + '), so nothing was changed.');
        }
      }
      out.rowsRead[market] = kept.length;
      out.listings.push.apply(out.listings, kept);
    }
    out.missing = full && !listingError ? allow.missingKept(out.listings) : null;
    if (out.missing && out.missing.length) out.warnings.push('kept field missing from every task: ' + out.missing.join(', '));

    /* 🚧 development projects (the config list, plus any the portfolios add) */
    const devGids = (a.devs || []).slice();
    for (const pf of a.devPortfolios || []) {
      try {
        (await asana.get('/portfolios/' + pf + '/items', { opt_fields: 'name,resource_type' }))
          .filter(i => i.resource_type === 'project' && devGids.indexOf(i.gid) === -1).forEach(i => devGids.push(i.gid));
      } catch (e) {
        if (stopFor(e)) throw e;
        out.warnings.push('a development portfolio could not be listed; the config list is used alone');
      }
    }
    for (const gid of devGids) {
      try {
        let name = null;
        try { name = ((await asana.get('/projects/' + gid, { opt_fields: 'name', limit: null }))[0] || {}).name || null; }
        catch (e) { if (stopFor(e)) throw e; }
        const tasks = (await asana.get('/projects/' + gid + '/tasks', { opt_fields: allow.TASK_FIELDS })).map(r => allow.keepTask(r, gid));
        for (const t of tasks) if (changed(t)) await detail(t, false);
        out.devs.push({ project: { gid, name }, tasks });
      } catch (e) {
        if (stopFor(e)) throw e;
        out.warnings.push('a development project (' + gid + ') could not be read: ' + e.message);
      }
    }

    /* loose tasks: dropped in code unless they name a linked development */
    if (o.looseNames && o.looseNames.length) {
      for (const gid of a.loose || []) {
        try {
          const raw = await asana.get('/projects/' + gid + '/tasks', { opt_fields: LOOSE_FIELDS });
          raw.filter(r => namesOne(r.name, o.looseNames)).forEach(r => out.loose.push(allow.keepLoose(r)));
        } catch (e) {
          if (stopFor(e)) throw e;
          out.warnings.push('a loose-task project (' + gid + ') could not be read: ' + e.message);
        }
      }
    }
    out.rowsRead.devs = out.devs.length;
    out.rowsRead.loose = out.loose.length;
    return out;
  } catch (e) {
    const why = stopFor(e);
    if (!why) throw e;
    return { ok: false, aborted: why, full, since, listings: [], devs: [], loose: [], people: null, warnings: out.warnings, missing: null,
      readProjects: [], totals: out.totals, rowsRead: out.rowsRead };
  }
}

module.exports = { readRun, looseNeedles, namesOne };
