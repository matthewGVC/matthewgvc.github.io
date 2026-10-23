/* ============================================================
   ASANA POSTS — the 💬 Social Media project's posts, counted per job (Matt's notes, 10-22).

     await readPosts(asana, gid)        → keepPost rows (allow.js), routines left out
     jobFor(tag, props)                 → the job a "🏡2026 Properties" tag names, or null
     await applyPosts({ client, posts, now })
       → { linked, unlinked: [tag], rows }

   A post's tag is free text ("555 W 59th PHC", "1050 fifth 2E", "40 chapel lane"). It
   names a job when its street matches the job's address (the tag itself, the tag less
   its last word, or less a trailing "6th Floor"); with more than one job on that street
   the tag must also carry the job's unit ("PHC", "#204", "18/19"). Only jobs with a
   stage are looked at. A tag naming no job (a development, Le Reve, an old listing) is
   cached unlinked.

   Every post is cached in asana_tasks as kind 'post' (read-only, D77): name, section,
   due_on, completed_at and { tags, format, stage, link } in fields. A post that has left
   the project keeps its row but loses its job, so it stops being counted.
   Writes nothing to Asana; touches no job row.
   ============================================================ */
'use strict';

const allow = require('./allow.js');
const A = require('../../assets/js/address-aliases.js');

const ROUTINES = /tasks?\s*&\s*routines/i;

async function readPosts(asana, gid) {
  const raw = await asana.get('/projects/' + gid + '/tasks', { opt_fields: allow.POST_FIELDS });
  return raw.map(r => allow.keepPost(r, gid)).filter(p => !ROUTINES.test(p.section || ''));
}

const squash = s => String(s || '').toLowerCase().replace(/[#\s]/g, '');

/* [{ street, unit }]: the tag as written (a unit after " - "), less its last word
   (the unit), less a trailing "6th Floor" */
function streetForms(tag) {
  const head = String(tag || '').replace(/,.*/, '').trim(), words = head.split(/\s+/).filter(Boolean);
  const forms = [{ street: head, unit: (A.splitName(head) || {}).unit || '' }];
  if (words.length > 2) forms.push({ street: words.slice(0, -1).join(' '), unit: words[words.length - 1] });
  if (words.length > 3 && /^floor$/i.test(words[words.length - 1])) forms.push({ street: words.slice(0, -2).join(' '), unit: words.slice(-2).join(' ') });
  return forms;
}

function sameStreet(addr, street) {
  try { return !!addr && A.sameStreet(addr, street); } catch (e) { return false; }
}

/* one unit, however written: "PHC" = "phc", "6th Floor" = "6", "#204" = "204", and a
   tag may leave off the line letter ("18/19" for "18/19E") */
const unitKey = u => squash(u).replace(/^(unit|apt|residence)/, '').replace(/(\d)(st|nd|rd|th)?(floor|fl)$/, '$1');
function unitsAgree(a, b) {
  const x = unitKey(a), y = unitKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const stem = s => s.replace(/[a-z]+$/, '');
  return /\d/.test(x) && (stem(y) === x || stem(x) === y);
}

/* a job on the tag's street whose unit the tag doesn't contradict: a tag naming a unit
   ("1050 Fifth - 10C") never lands on another unit of that building (1050 Fifth 2E) */
function jobFor(tag, props) {
  const forms = streetForms(tag);
  const unitOf = p => (p.core || {}).unit || (p.units || [])[0] || '';
  const fits = (p, f) => sameStreet((p.core || {}).address || p.label, f.street) && (!f.unit || !unitOf(p) || unitsAgree(f.unit, unitOf(p)));
  const here = (props || []).filter(p => p.stage && forms.some(f => fits(p, f)));
  if (here.length === 1) return here[0];
  const byUnit = here.filter(p => forms.some(f => f.unit && fits(p, f) && unitOf(p)));
  return byUnit.length === 1 ? byUnit[0] : null;
}

async function applyPosts(o) {
  const { client, posts } = o;
  const now = (o.now || new Date()).toISOString();
  const props = await client.select('properties', {}, 'id,label,stage,units,core');
  const cached = await client.select('asana_tasks', { kind: 'post' }, 'gid,project_gid');
  const unlinked = new Set();
  const rows = posts.map(p => {
    let job = null;
    for (const tag of p.tags) { job = jobFor(tag, props); if (job) break; }
    if (!job) p.tags.forEach(t => unlinked.add(t));
    return { gid: p.gid, project_gid: p.projectGid, kind: 'post', section: p.section, name: p.name,
      fields: { tags: p.tags, format: p.format, stage: p.stage, link: p.link },
      due_on: p.dueOn, completed_at: p.completedAt, last_seen: now, property_id: job ? job.id : null };
  });
  const seen = new Set(rows.map(r => r.gid));
  const gone = cached.filter(c => !seen.has(c.gid))
    .map(c => ({ gid: c.gid, project_gid: c.project_gid, kind: 'post', property_id: null }));
  // two writes: one upsert must send the same columns on every row
  for (const set of [rows, gone]) {
    for (let i = 0; i < set.length; i += 500) await client.upsert('asana_tasks', set.slice(i, i + 500), 'gid');
  }
  return { linked: rows.filter(r => r.property_id).length, unlinked: [...unlinked].sort(), rows };
}

module.exports = { readPosts, jobFor, applyPosts, streetForms, unitsAgree };
