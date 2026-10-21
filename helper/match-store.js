/* ============================================================
   MATCH STORE — keeps each job's Match check result after a sync run
   (spec §5, S14). Used by helper/asana/apply.js and helper/de/apply.js.

     matchUpdate(row, list, nowIso, owner, runId) → { match, changes } | null
         the new `match` ({ list, dismissed }, since carried over) and one
         `changes` row (source 'match') per mismatch found or cleared;
         null when the stored result is already this one
     await storeMatches({ client, rows, now, runId, roster?, initials?, people?, skip? })
         runs GVC_MATCH.check on every staged listing in `rows` (the run's
         in-memory rows, already updated) and writes `match` where it changed,
         version-checked: a row someone changed meanwhile is skipped, and one
         row failing (a network blip) is noted while the rest are stored.
         skip: a Set of row ids that already conflicted in this run (left alone).
       → { stored, errors: [{ what: 'conflict' | 'match', detail, row }] }
     await latestPeople(client) → asana_people rows from the latest People run

   Dismissals (match.dismissed) are kept as they are: the pages write them.
   ============================================================ */
'use strict';

const M = require('../assets/js/match-check.js');

function matchUpdate(row, list, now, owner, runId) {
  const r = M.merge(row.match, list, now);
  if (!r.changed) return null;
  const was = new Map(((row.match || {}).list || []).map(m => [m.key || m.code, m]));
  const is = new Map(r.match.list.map(m => [m.key, m]));
  const log = (key, oldV, newV, note) => Object.assign({ at: now, field: 'match', old_value: oldV, new_value: newV, note, source: 'match', run_id: runId || null }, owner);
  const changes = r.found.map(k => log(k, null, k, 'Mismatch found: ' + is.get(k).text))
    .concat(r.cleared.map(k => log(k, k, null, 'Mismatch cleared: ' + was.get(k).text)));
  return { match: r.match, changes };
}

async function latestPeople(client) {
  let rows;
  try { rows = await client.select('asana_people'); } catch (e) { return []; }
  rows = rows || [];
  const latest = rows.reduce((m, r) => (r.seen_at && r.seen_at > m ? r.seen_at : m), '');
  return rows.filter(r => (r.seen_at || '') === latest);
}

async function storeMatches(o) {
  const { client, rows, now, runId } = o;
  const roster = o.roster || require('./roster.js').roster();
  const initials = o.initials || require('./roster.js').rosterInitials();
  const people = o.people || await latestPeople(client);
  const out = { stored: 0, errors: [] };
  for (const p of rows) {
    if (!p.stage || (o.skip && o.skip.has(p.id))) continue;   // library rows aren't jobs
    const u = matchUpdate(p, M.check(p, { roster, initials, people, now }), now, { property_id: p.id }, runId);
    if (!u) continue;
    try {
      const r = await client.update('properties', { id: p.id }, { match: u.match }, { version: p.version });
      Object.assign(p, { match: u.match }, (r && r[0]) || {});
      if (u.changes.length) await client.insert('changes', u.changes);
      out.stored++;
    } catch (e) {
      out.errors.push({ what: e.name === 'ConflictError' ? 'conflict' : 'match', detail: 'Match not stored: ' + e.message, row: p.slug || p.id });
    }
  }
  return out;
}

module.exports = { matchUpdate, storeMatches, latestPeople };
