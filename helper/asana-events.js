/* ============================================================
   ASANA EVENTS — the one-minute sync (stage 2). Each minute the helper asks
   Asana's events feed what changed in each listing project since the last
   check, and reads just those tasks again. It only asks (GET); nothing here
   writes to Asana.

     await checkEvents({ cfg, client, asana, sync, stateFile, now? })
       cfg        the helper config (cfg.asana.listings: { market: projectGid })
       client     helper/supabase.js: reads asana_tasks' links, upserts sync_state
       asana      createAsana(...) (GET only; events() and get())
       sync       asana-sync.js syncNow itself, never through runAsana again
                  (runner.js asanaEvents: a plain read would wait on this run for ever)
       stateFile  <helper home>/asana-events.json, { [projectGid]: token }
     → { ok, gids, gap, detail }

   For each listing project it reads the feed from the saved token until Asana
   says there's no more, collecting the tasks named: a 'task' event's own gid, or
   a 'story' (a comment, a field change) whose parent is a task. A gid that no
   deal or pitch is linked to (asana_tasks.property_id / pitch_id, read once) is
   looked up for its parent (up to three levels), so a ticked subtask counts as
   its listing; a 404 there (a deleted task or checklist item) drops the gid,
   neither a failure nor a gap.

   An events run only updates deals it already has: it carries no development
   projects, so a new house couldn't join its development. So a gid still not
   linked (a new Lead, a new listing), a project with no token yet, or a token
   Asana says is too old (412, about a day) makes the check a gap: the ordinary
   plain read (since the last good run) runs instead, then an events run for the
   linked tasks the same pass collected (a subtask tick or a comment doesn't move
   modified_at, so the plain read would miss them). Checklist ticks and comments
   made while a token was dead wait for the 3:00 full read, as before.

   Tokens are saved only after every read the check asked for succeeded. A run
   failed when sync throws, or returns ok false or report.ok false (a stopped or
   partial read returns rather than throws): no token is saved, and sync_state
   says why. Every check upserts sync_state { kind: 'asana-events', checked_at,
   ok, detail } ('3 tasks changed', 'caught up from the last full read', or the
   error), which the header reads.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

const KIND = 'asana-events';
const MAX_PAGES = 50;          // 5,000 events in one check: read the rest as a gap
const GAP = 'caught up from the last full read';

function readTokens(file) {
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; }
  catch (e) { return {}; }
}
function saveTokens(file, tokens) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(tokens, null, 2));
  fs.renameSync(tmp, file);
}

/* the task an event is about, or null */
function taskOf(e) {
  const r = (e && e.resource) || {};
  if (r.resource_type === 'task' && r.gid) return String(r.gid);
  if (r.resource_type === 'story' && e.parent && e.parent.resource_type === 'task' && e.parent.gid) return String(e.parent.gid);
  return null;
}

/* why a sync's answer is a failed run, or null when it's good */
function failure(r) {
  if (!r || (r.ok !== false && !(r.report && r.report.ok === false))) return null;
  const rep = r.report || {};
  const err = (r.errors || []).find(x => x && x.what !== 'warning');
  return rep.aborted || (rep.warnings && rep.warnings[0]) || (err && err.detail) || 'the read didn\'t finish';
}

async function checkEvents(o) {
  const { cfg, client, asana, sync, stateFile } = o;
  const now = o.now || new Date();
  const listings = (cfg && cfg.asana && cfg.asana.listings) || {};
  const saved = readTokens(stateFile), next = Object.assign({}, saved);
  const out = { ok: true, gids: {}, gap: false, detail: '' };

  try {
    /* what changed, per listing project */
    const found = new Map();                                   // gid → market
    for (const market of Object.keys(listings)) {
      const project = listings[market];
      let token = saved[project] || null;
      for (let pages = 0; ; pages++) {
        if (pages >= MAX_PAGES) { out.gap = true; break; }
        const r = await asana.events(project, token);
        if (r.expired) { out.gap = true; next[project] = r.sync; break; }
        r.events.forEach(e => { const g = taskOf(e); if (g && !found.has(g)) found.set(g, market); });
        token = r.sync;
        next[project] = r.sync;
        if (!r.more) break;
      }
    }

    /* which of them a deal already has; a subtask counts as its listing */
    if (found.size) {
      const links = await client.select('asana_tasks', null, 'gid,property_id,pitch_id');
      const linked = new Set((links || []).filter(c => c.property_id || c.pitch_id).map(c => String(c.gid)));
      for (const [gid, market] of found) {
        let g = gid;
        for (let depth = 0; g && !linked.has(g) && depth < 3; depth++) {
          let row;
          try { row = (await asana.get('/tasks/' + g, { opt_fields: 'parent.gid', limit: null }))[0] || {}; }
          catch (e) { if (e && e.status === 404) { g = null; break; } throw e; }
          g = row.parent && row.parent.gid ? String(row.parent.gid) : '';
          if (!g) break;
        }
        if (g === null) continue;                              // gone from Asana: nothing to read
        if (g && linked.has(g)) out.gids[g] = out.gids[g] || market;
        else out.gap = true;                                    // no deal yet: the plain read makes it
      }
    }

    /* read them */
    const n = Object.keys(out.gids).length;
    const run = async opts => { const why = failure(await sync(opts)); if (why) throw new Error(why); };
    if (out.gap) {
      await run({ kind: 'plain' });
      if (n) await run({ kind: 'events', gids: out.gids });
    } else if (n) await run({ kind: 'events', gids: out.gids });
    saveTokens(stateFile, next);
    out.detail = out.gap ? GAP : n + (n === 1 ? ' task changed' : ' tasks changed');
  } catch (e) {
    out.ok = false;
    out.detail = (e && e.message) || String(e);
  }

  try { await client.upsert('sync_state', [{ kind: KIND, checked_at: now.toISOString(), ok: out.ok, detail: out.detail }], 'kind'); }
  catch (e) { out.stateError = e.message; }
  return out;
}

module.exports = { checkEvents, taskOf };
