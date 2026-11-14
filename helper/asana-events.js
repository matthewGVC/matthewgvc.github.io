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
       stateFile  <helper home>/asana-events.json, { [projectGid]: token, failures?, firstFailedAt?, lastFailedAt?,
                  plainWaiting?, lastPlainAt? }
                  after 3 failed checks in a row, at most one check in 10 minutes until one succeeds
                  (a skipped minute returns { skipped: true } and writes nothing)
     → { ok, gids, gap, detail }

   For each listing project it reads the feed from the saved token until Asana
   says there's no more, collecting the tasks named: a 'task' event's own gid, or
   a 'story' (a comment, a field change) whose parent is a task. A task cached as
   ignored (asana_tasks.ignored) with no deal is dropped: no read for it (one linked to a deal is read). A gid no deal is
   linked to (asana_tasks.property_id, read once; a pitch alone doesn't count:
   the dormant pitch-won path would make a deal with no development) is looked
   up for its parent (up to three levels), so a ticked subtask counts as its
   listing; a 404 there (a deleted task or checklist item) drops the gid, neither
   a failure nor a gap, and any other failure of that lookup but a refused token
   (a 403, a 500) makes it a gap, so one bad task never holds up the feed.

   A gid already in asana_tasks (any kind) with no property_id, no pitch_id and not ignored is
   known (a task linked only by a pitch keeps the at-once plain read above): no parent lookup
   (it's a top task the plain read already met), and it no longer makes the check a gap. It sets
   plainWaiting (the time the first one was seen) instead. A gid not in asana_tasks goes through
   the parent lookup as before and, if still not linked, is a gap (a new Lead or listing appears
   within a minute). The plain read runs when the check is a gap, or when plainWaiting is set and
   lastPlainAt is missing or at least PLAIN_EVERY (15 minutes) old, which also fires on a minute
   with no events at all. After a successful plain read plainWaiting is cleared and lastPlainAt
   set. A deferred read shows in detail as '... (N waiting for the 15-minute read)'.

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
const { stopFor } = require('./asana/read.js');

const KIND = 'asana-events';
const MAX_PAGES = 50;          // 5,000 events in one check: read the rest as a gap
const GAP = 'caught up from the last full read';
const SLOW_AFTER = 3;           // failed checks in a row before the back-off
const SLOW_EVERY = 10 * 60000;  // then at most one check in 10 minutes
const PLAIN_EVERY = 15 * 60000; // a plain read for edits to known tasks with no deal waits this long

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
  let deferred = 0, waitingSince = saved.plainWaiting || null;
  const failures = Number(saved.failures) || 0;
  const lastTry = Date.parse(saved.lastFailedAt);
  if (failures >= SLOW_AFTER && lastTry && now.getTime() - lastTry < SLOW_EVERY) {
    return { ok: false, skipped: true, gids: {}, gap: false, detail: 'waiting: the last ' + failures + ' checks failed' };
  }

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
      const links = await client.select('asana_tasks', null, 'gid,property_id,pitch_id,ignored');
      // a task linked to a deal always counts, even when it was once cached as ignored (a closed task first
      // met that way, later linked by hand): only an ignored task with no deal is dropped
      const linked = new Set((links || []).filter(c => c.property_id).map(c => String(c.gid)));
      const ignored = new Set((links || []).filter(c => c.ignored && !c.property_id).map(c => String(c.gid)));
      const known = new Set((links || []).filter(c => !c.property_id && !c.pitch_id && !c.ignored).map(c => String(c.gid)));
      for (const [gid, market] of found) {
        if (known.has(gid)) { deferred++; waitingSince = waitingSince || now.toISOString(); continue; }   // read in 15 minutes
        let g = gid;
        for (let depth = 0; g && !linked.has(g) && !ignored.has(g) && depth < 3; depth++) {
          let row;
          try { row = (await asana.get('/tasks/' + g, { opt_fields: 'parent.gid', limit: null }))[0] || {}; }
          catch (e) {
            if (e && e.status === 404) { g = null; break; }
            if (stopFor(e)) throw e;
            g = ''; break;                                     // can't tell: the plain read covers it
          }
          g = row.parent && row.parent.gid ? String(row.parent.gid) : '';
          if (!g) break;
        }
        if (g === null || ignored.has(g)) continue;            // gone from Asana, or set aside: nothing to read
        if (g && linked.has(g)) out.gids[g] = out.gids[g] || market;
        else out.gap = true;                                    // no deal yet: the plain read makes it
      }
    }

    /* read them */
    const n = Object.keys(out.gids).length;
    const run = async opts => { const why = failure(await sync(opts)); if (why) throw new Error(why); };
    const lastPlain = Date.parse(saved.lastPlainAt);
    const plain = out.gap || (!!waitingSince && (!lastPlain || now.getTime() - lastPlain >= PLAIN_EVERY));
    if (plain) await run({ kind: 'plain' });
    if (n) await run({ kind: 'events', gids: out.gids });
    delete next.failures; delete next.firstFailedAt; delete next.lastFailedAt;
    if (plain) { delete next.plainWaiting; next.lastPlainAt = now.toISOString(); }
    else if (waitingSince) next.plainWaiting = waitingSince;
    saveTokens(stateFile, next);
    out.detail = plain ? GAP : n + (n === 1 ? ' task changed' : ' tasks changed') + (deferred ? ' (' + deferred + ' waiting for the 15-minute read)' : '');
  } catch (e) {
    out.ok = false;
    out.detail = (e && e.message) || String(e);
  }

  /* a check that fails the same way every time shouldn't re-read the same window each minute */
  if (!out.ok) {
    try {
      saveTokens(stateFile, Object.assign({}, saved, waitingSince ? { plainWaiting: waitingSince } : {}, { failures: failures + 1,
        firstFailedAt: failures ? saved.firstFailedAt || now.toISOString() : now.toISOString(), lastFailedAt: now.toISOString() }));
    } catch (e) { out.stateError = e.message; }
  }

  try { await client.upsert('sync_state', [{ kind: KIND, checked_at: now.toISOString(), ok: out.ok, detail: out.detail }], 'kind'); }
  catch (e) { out.stateError = e.message; }
  return out;
}

module.exports = { checkEvents, taskOf, PLAIN_EVERY };
