/* ============================================================
   ASANA APPLY — writes one Asana run into the database (spec §3.3, plan §8a).

     await applyRun({ client, run, now, plan?, roster?, initials?, helperVersion? })
       client   helper/supabase.js (or a fake with the same shape)
       run      readRun()'s result (helper/asana/read.js)
       plan     the ticked link plan (link.js readPlanFile) on the first link run
     → { runId, changes, created, errors, unlinked: [{ gid, name, why, propertyId? }] }
       sync_runs.ok is false when the read was partial (run.partial); the
       read's warnings are stored in sync_runs.errors as { what: 'warning' }.

   What it writes:
   - asana_tasks: every task read (listing, dev, loose), allowlisted fields and
     kept history only, with its link to a listing / pitch / development.
   - a linked listing: stage (stage_source 'Asana'; never over Archived), the
     `asana` snapshot (status, section, the stage each implies, kept fields,
     checklist names and ticks), `milestones` (deal dates, planned flagged),
     facts at Asana's rank through GVC_FACTS (a fact DE or Matt holds stays
     theirs), core.suggestedAgentIds, dev_project_id for a TJ New Dev house.
     Every changed value is one `changes` row, source 'Asana'.
   - which tasks become rows: on the plan run, the ticked rows (unticked ones
     are cached as ignored and never come back by themselves); after that, an
     unlinked List-Side task at Pitch (with a pitch date) → In contract, checked
     again every run (a Lead gains its pitch date later). A task first met as a
     candidate already Sold / Rented / Off market is cached as ignored: that
     decision is kept and it never becomes a job (D54).
   - facts: a value changed in core outside the helper (a builder's save) is
     adopted first as Matt's (GVC_FACTS.adoptEdit), so Asana repeating its old
     value never undoes it.
   - pitches (D55): a pitch whose task reaches Prep or later is won and its
     listing made (from_pitch_id); Off market while a pitch → not won.
   - developments (D65): hints from the 🚧 project, the house row, the Buy-Side
     land row and the loose tasks naming it → milestone_hints (confirmed keys
     left out), next_milestone (+ family, slips, construction, early ticks).
   - a full read that no longer has a linked task: the job stays; `asana.gone`
     is set and `match.list` gets { code: 'M2', text: 'Asana task gone' }.
   - People (run.kind 'people'): asana_people rows upserted, seen_at = now.
   Never: a job deleted, a folder touched, anything written to Asana.
   A row someone changed meanwhile (version check) is skipped and logged,
   never overwritten. An aborted run writes only its sync_runs row; so does a
   run before any link plan was applied.
   ============================================================ */
'use strict';

const A = require('../../assets/js/address-aliases.js');
const P = require('../../assets/js/property-library.js');
const MAP = require('../../assets/js/asana-map.js');
const F = require('../../assets/js/job-facts.js');
const L = require('./link.js');
const { looseNeedles, namesOne } = require('./read.js');

const ACTIVE = L.ACTIVE;
const WON = ACTIVE.concat(['Sold', 'Rented']);
const CLOSED = ['Sold', 'Rented', 'Off market'];
const DE_KEYS = ['price', 'beds', 'baths', 'halfBaths', 'sqft'];
const NO_PLAN = 'No link plan applied yet: run node helper/asana-sync.js --plan, tick it, then --apply-plan <file>.';

const eq = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
const clone = x => (x === undefined || x === null ? x : JSON.parse(JSON.stringify(x)));

async function applyRun(o) {
  const { client, run } = o;
  const now = (o.now || new Date()).toISOString();
  const kind = run.kind === 'people' ? 'people' : 'asana';
  const sr = (await client.insert('sync_runs', { kind, started_at: now, rows_read: run.rowsRead || null, totals: run.totals || null,
    helper_version: o.helperVersion || null }))[0];
  const out = { runId: sr.id, changes: 0, created: 0, errors: [], unlinked: [] };
  // a project that failed to read (or a renamed field) is kept with the run, so the overview can say why
  const warned = (run.warnings || []).map(w => ({ what: 'warning', detail: w }));
  const finish = (ok, errs) => client.update('sync_runs', { id: sr.id }, {
    finished_at: new Date().toISOString(), ok, changes: out.changes, errors: errs.concat(warned).length ? errs.concat(warned) : null,
    totals: Object.assign({}, run.totals || {}, out.unlinked.length ? { unlinked: out.unlinked.map(u => ({ gid: u.gid, why: u.why })) } : {}) });

  if (!run.ok) { await finish(false, [{ what: 'aborted', detail: run.aborted }]); return out; }
  try {
    if (kind === 'people') await writePeople(client, run.people || [], now);
    else await writeRun(o, sr, out, now);
  } catch (e) {
    await finish(false, out.errors.concat([{ what: 'failed', detail: e.message }]));
    throw e;
  }
  // a run that missed a listing project isn't a good run: the next one asks from the last good one
  await finish(!out.stopped && !run.partial, out.errors);
  return out;
}

async function writePeople(client, people, now) {
  const rows = people.map(p => ({ gid: p.gid, name: p.name, section: p.section, title: p.title, state: p.state, team: p.team || [],
    de_bio_url: p.deBioUrl, de_profile_url: p.deProfileUrl, past: !!p.past, seen_at: now }));
  for (let i = 0; i < rows.length; i += 500) await client.upsert('asana_people', rows.slice(i, i + 500), 'gid');
}

/* the allowlisted snapshot kept on the job; both stages kept for M14 (D69) */
function snapshotOf(t, prev) {
  const f = t.fields || {}, status = f['Listing Status'] || null;
  const st = s => { const r = MAP.stageOf(s); return r.stage || null; };
  return {
    gid: t.gid, name: t.name, permalink: t.permalink || null, market: t.market || null, projectGid: t.projectGid || null,
    section: t.section || null, status,
    stageFromStatus: status ? st({ fields: { 'Listing Status': status, 'Sale/Rent': f['Sale/Rent'] } }) : null,
    stageFromSection: t.section ? st({ fields: { 'Sale/Rent': f['Sale/Rent'] }, section: t.section }) : null,
    dealSide: f['Deal Side'] || null, pointPerson: f['🧑‍💼 Point Person'] || null, assignee: t.assignee || null,
    completed: !!t.completed, fields: f,
    checklist: t.subtasks ? MAP.checklistOf(t.subtasks) : ((prev && prev.checklist) || [])
  };
}

function withMatch(match, item) {
  const m = Object.assign({ list: [], dismissed: {} }, clone(match) || {});
  m.list = (m.list || []).filter(x => !(x.code === item.code && x.text === item.text)).concat([item]);
  return m;
}
function withoutGone(match) {
  if (!match || !(match.list || []).some(x => x.code === 'M2' && x.text === 'Asana task gone')) return match;
  const m = clone(match);
  m.list = m.list.filter(x => !(x.code === 'M2' && x.text === 'Asana task gone'));
  return m;
}

async function writeRun(o, sr, out, now) {
  const { client, run } = o;
  const props = await client.select('properties');
  const pitches = await client.select('pitches');
  const devs = await client.select('dev_projects');
  const cacheRows = await client.select('asana_tasks');
  if (!o.plan && !cacheRows.length) { out.stopped = true; out.errors.push({ what: 'no plan', detail: NO_PLAN }); return; }

  const cache = new Map(cacheRows.map(r => [r.gid, r]));
  const planBy = o.plan ? new Map(o.plan.rows.map(r => [r.gid, r])) : null;
  const roster = o.roster || require('../roster.js').roster();
  const initials = o.initials || require('../roster.js').rosterInitials();
  const slugs = { properties: new Set(props.map(p => p.slug)), pitches: new Set(pitches.map(p => p.slug)) };
  const entries = [];
  const fresh = new Map(run.listings.map(t => [t.gid, t]));

  const log = (owner, field, oldV, newV, note) => Object.assign({ at: now, field: field || null, old_value: oldV === undefined ? null : oldV,
    new_value: newV === undefined ? null : newV, note: note || null, source: 'Asana', run_id: sr.id }, owner);

  async function save(table, row, patch, changes) {
    if (!Object.keys(patch).length) return true;
    try {
      const r = await client.update(table, { id: row.id }, patch, { version: row.version });
      Object.assign(row, clone(patch), (r && r[0]) || {});
      if (changes.length) await client.insert('changes', changes);
      out.changes += changes.length;
      return true;
    } catch (e) {
      if (e.name !== 'ConflictError') throw e;
      out.errors.push({ what: 'conflict', detail: e.message, row: row.slug || row.id });
      return false;
    }
  }
  function slugFor(table, core, gid) {
    let s = P.slugOfCore(core);
    if (slugs[table].has(s)) s = s + '-' + String(gid).slice(-6);
    slugs[table].add(s);
    return s;
  }
  function cacheEntry(t, kind, extra) {
    return Object.assign({ gid: t.gid, project_gid: t.projectGid, kind, section: t.section || null, name: t.name, fields: t.fields || {},
      history: t.history || [], due_on: t.dueOn || null, completed_at: t.completedAt || null, modified_at: t.modifiedAt || null,
      last_seen: now, batch_day: false, property_id: null, pitch_id: null, dev_project_id: null, ignored: false }, extra);
  }

  /* ---------- developments first: they say which house rows belong where ---------- */
  const devOfListing = {}, devOfLoose = {};
  const allListing = new Map(cacheRows.filter(c => c.kind === 'listing')
    .map(c => [c.gid, { gid: c.gid, name: c.name, section: c.section, fields: c.fields || {}, history: c.history || [] }]));
  fresh.forEach((t, g) => allListing.set(g, Object.assign({}, t, { history: t.history || (allListing.get(g) || {}).history || [] })));

  for (const d of run.devs || []) {
    let dev = devs.find(x => x.asana_project_gid === d.project.gid);
    const pr = planBy && planBy.get(d.project.gid);
    if (!dev && pr && pr.tick && pr.match && pr.match.devId) {
      const target = devs.find(x => x.id === pr.match.devId && !x.asana_project_gid);
      if (target && await save('dev_projects', target, { asana_project_gid: d.project.gid },
        [log({ dev_project_id: target.id }, 'asana_project_gid', null, d.project.gid, 'Linked to Asana: ' + (d.project.name || d.project.gid))])) dev = target;
    }
    const tasks = d.tasks.map(t => (t.history ? t : Object.assign({}, t, { history: (cache.get(t.gid) || {}).history || [] })));
    const batch = MAP.batchDays(tasks);
    tasks.forEach(t => entries.push(cacheEntry(t, 'dev', { dev_project_id: dev ? dev.id : null,
      batch_day: !!t.completedAt && batch.indexOf(MAP.localDay(t.completedAt)) !== -1 })));
    if (!dev) continue;
    const addrs = L.devAddresses(dev, d.project);
    const atDev = Array.from(allListing.values()).filter(t => addrs.some(x => A.sameStreet(t.name, x)));
    const houses = atDev.filter(t => MAP.isGvcListing(t)), lands = atDev.filter(t => !MAP.isGvcListing(t));
    houses.forEach(h => { devOfListing[h.gid] = dev.id; });
    const needles = looseNeedles([dev, { name: d.project.name }]);
    const loose = (run.loose || []).filter(l => namesOne(l.name, needles));
    loose.forEach(l => { devOfLoose[l.gid] = dev.id; });
    const res = MAP.devHints({ name: d.project.name || dev.label, family: dev.family }, tasks, { houses, lands, loose }, now);
    const confirmed = dev.milestones || {};
    const hints = res.hints.filter(h => !(confirmed[h.key] && confirmed[h.key].done));
    const next = Object.assign({ key: null, name: null, dueOn: null }, res.next || {},
      { family: res.family, slips: res.slips, construction: res.construction, early: res.early });
    const patch = {}, changes = [];
    if (!eq(hints, dev.milestone_hints || [])) {
      patch.milestone_hints = hints;
      changes.push(log({ dev_project_id: dev.id }, 'milestone_hints', (dev.milestone_hints || []).length, hints.length,
        hints.length + ' milestone' + (hints.length === 1 ? '' : 's') + ' suggested from Asana'));
    }
    if (!eq(next, dev.next_milestone)) patch.next_milestone = next;
    await save('dev_projects', dev, patch, changes);
  }
  (run.loose || []).forEach(l => entries.push(cacheEntry(Object.assign({}, l, { fields: {} }), 'loose', { dev_project_id: devOfLoose[l.gid] || null })));

  /* ---------- listings ---------- */
  const factsOf = t => { const f = MAP.factsOf(t); delete f.kind; return f; };

  async function createListing(t, stage, pitch, entry) {
    const a = L.addrOf(t.name);
    const core = { address: a.street, unit: a.unit || '' };
    let facts = {};
    const f0 = factsOf(t);
    Object.keys(f0).forEach(k => { facts = F.applyFact(facts, k, 'Asana', f0[k]).facts; core[k] = facts[k].value; });
    if (a.town && !core.city && !core.neighborhood) core.city = a.town;
    core.facts = facts;
    const agents = MAP.agentsOf(t, initials, roster);
    if (agents.ids.length) core.suggestedAgentIds = agents.ids;
    const kind = MAP.factsOf(t).kind || 'sale';
    const row = { slug: slugFor('properties', core, t.gid), label: P.labelOf(core), core, kind, market: t.market || null, stage,
      stage_source: 'Asana', units: core.unit ? [core.unit] : [], asana_gid: t.gid, asana: snapshotOf(t), milestones: MAP.datesOf(t, t.history, now),
      folder_state: 'unlinked', dev_project_id: devOfListing[t.gid] || null };
    if (pitch) row.from_pitch_id = pitch.id;
    const made = (await client.insert('properties', row))[0];
    props.push(made);
    entry.property_id = made.id;
    const own = { property_id: made.id };
    const changes = [log(own, null, null, null, pitch ? 'Pitch won in Asana' : 'Found in Asana'), log(own, 'stage', null, stage), log(own, 'kind', null, kind)]
      .concat(Object.keys(f0).map(k => log(own, k, null, core[k])));
    await client.insert('changes', changes);
    out.created++; out.changes += changes.length;
    return made;
  }

  async function createPitch(t, entry) {
    const a = L.addrOf(t.name);
    const core = { address: a.street, unit: a.unit || '' };
    if (a.town) core.city = a.town;
    const agents = MAP.agentsOf(t, initials, roster);
    if (agents.ids.length) core.suggestedAgentIds = agents.ids;
    const on = t.fields['🗓️ Pitch'] ? String(t.fields['🗓️ Pitch']).slice(0, 10) : null;
    const made = (await client.insert('pitches', { slug: slugFor('pitches', core, t.gid), label: P.labelOf(core), market: t.market || null,
      pitched_on: on, core, asana_gid: t.gid, outcome: 'open' }))[0];
    pitches.push(made);
    entry.pitch_id = made.id;
    await client.insert('changes', [log({ pitch_id: made.id }, null, null, null, 'Found in Asana')]);
    out.created++; out.changes++;
  }

  async function updateListing(p, t, stage, link, fromPitch) {
    const own = { property_id: p.id };
    const core = clone(p.core) || {}, patch = {}, changes = [];
    if (link) { patch.asana_gid = t.gid; changes.push(log(own, 'asana_gid', null, t.gid, fromPitch ? 'Pitch won in Asana' : 'Linked to Asana')); }
    if (fromPitch && p.from_pitch_id !== fromPitch.id) { patch.from_pitch_id = fromPitch.id; changes.push(log(own, 'from_pitch_id', p.from_pitch_id || null, fromPitch.id)); }
    if (stage !== 'Pitch' && p.stage !== 'Archived' && p.stage !== stage) {
      patch.stage = stage; patch.stage_source = 'Asana';
      changes.push(log(own, 'stage', p.stage || null, stage));
    } else if (link && p.stage === stage && p.stage_source !== 'Asana') patch.stage_source = 'Asana';

    // facts: values typed before v2 have no record yet; DE's own become DE's, the rest only fill gaps (D79)
    let facts = core.facts || {};
    const f0 = factsOf(t);
    Object.keys(f0).forEach(k => {
      // a value edited in a tool since the last run is Matt's; one with no record yet is legacy
      // (or DE's, for DE's own facts on a DE-linked job) and only fills gaps (D78, D79)
      facts = F.adoptEdit(facts, k, core[k], p.de_listing_id && DE_KEYS.indexOf(k) !== -1 ? 'DE' : 'legacy');
      facts = F.applyFact(facts, k, 'Asana', f0[k]).facts;
      const shown = facts[k].value;
      if (!eq(core[k], shown)) { changes.push(log(own, k, core[k], shown)); core[k] = shown; }
    });
    if (Object.keys(facts).length) core.facts = facts;
    const a = L.addrOf(t.name);
    if (a.town && !core.city && !core.neighborhood) core.city = a.town;
    const agents = MAP.agentsOf(t, initials, roster).ids;
    if (!eq(agents, core.suggestedAgentIds || [])) {
      changes.push(log(own, 'suggestedAgentIds', core.suggestedAgentIds || [], agents));
      if (agents.length) core.suggestedAgentIds = agents; else delete core.suggestedAgentIds;
    }
    if (!eq(core, p.core)) patch.core = core;

    const snap = snapshotOf(t, p.asana);
    if (p.asana && p.asana.gone) changes.push(log(own, null, null, null, 'Asana task back'));
    if (!eq(snap, p.asana)) patch.asana = snap;
    const ms = MAP.datesOf(t, t.history, now), old = p.milestones || {};
    if (!eq(ms, old)) {
      patch.milestones = ms;
      Object.keys(Object.assign({}, old, ms)).forEach(k => {
        const a1 = old[k] && old[k].on, b1 = ms[k] && ms[k].on;
        if (a1 !== b1) changes.push(log(own, k, a1 || null, b1 || null));
      });
    }
    const m = withoutGone(p.match);
    if (m !== p.match) patch.match = m;
    if (devOfListing[t.gid] && p.dev_project_id !== devOfListing[t.gid]) {
      patch.dev_project_id = devOfListing[t.gid];
      changes.push(log(own, 'dev_project_id', p.dev_project_id || null, devOfListing[t.gid]));
    }
    await save('properties', p, patch, changes);
  }

  async function updatePitch(pitch, t, link) {
    const on = t.fields['🗓️ Pitch'] ? String(t.fields['🗓️ Pitch']).slice(0, 10) : null;
    const patch = {}, changes = [];
    if (link) { patch.asana_gid = t.gid; changes.push(log({ pitch_id: pitch.id }, 'asana_gid', null, t.gid, 'Linked to Asana')); }
    if (on && on !== pitch.pitched_on) { patch.pitched_on = on; changes.push(log({ pitch_id: pitch.id }, 'pitched_on', pitch.pitched_on || null, on)); }
    await save('pitches', pitch, patch, changes);
  }

  /* link to an existing row, or make one; never two jobs at one address */
  async function linkOrCreate(t, stage, kind, planMatch, entry) {
    const live = L.matchTask(t, { properties: props, pitches }, kind);
    const m = planMatch && (planMatch.propertyId || planMatch.pitchId) ? planMatch : live;
    if (kind === 'pitch') {
      const target = m.pitchId && pitches.find(x => x.id === m.pitchId && !x.asana_gid);
      if (target) { entry.pitch_id = target.id; return updatePitch(target, t, true); }
      if (m.tie) { out.unlinked.push({ gid: t.gid, name: t.name, why: 'more than one pitch at this address' }); return; }
      return createPitch(t, entry);
    }
    const target = m.propertyId && props.find(x => x.id === m.propertyId && !x.asana_gid);
    if (target) { entry.property_id = target.id; return updateListing(target, t, stage, true); }
    if (live.taken) { out.unlinked.push({ gid: t.gid, name: t.name, why: 'same address', propertyId: live.taken }); return; }
    if (live.tie) { out.unlinked.push({ gid: t.gid, name: t.name, why: 'more than one job at this address' }); return; }
    return createListing(t, stage, null, entry);
  }

  async function oneTask(t, c, entry) {
    const st = MAP.stageOf(t);
    const prop = props.find(p => p.asana_gid === t.gid);
    const pitch = pitches.find(p => p.asana_gid === t.gid);
    if (prop) entry.property_id = prop.id;
    if (pitch) entry.pitch_id = pitch.id;
    if (st.unknown) { out.errors.push({ what: 'unknown status', detail: 'Listing Status not known yet: "' + st.unknown + '"', gid: t.gid }); return; }
    if (prop) return updateListing(prop, t, st.stage, false);
    if (pitch) {
      if (WON.indexOf(st.stage) !== -1 && pitch.outcome !== 'won') {
        // the job may already be there (a starter row at the address): link it, never a second one
        const live = L.matchTask(t, { properties: props, pitches }, 'listing');
        if (live.taken || live.tie) {
          out.unlinked.push({ gid: t.gid, name: t.name, why: live.taken ? 'same address' : 'more than one job at this address', propertyId: live.taken });
          return;
        }
        let made = live.propertyId && props.find(x => x.id === live.propertyId && !x.asana_gid);
        if (made) { entry.property_id = made.id; await updateListing(made, t, st.stage, true, pitch); }
        else made = await createListing(t, st.stage, pitch, entry);
        await save('pitches', pitch, { outcome: 'won', won_property_id: made.id },
          [log({ pitch_id: pitch.id }, 'outcome', pitch.outcome, 'won', 'Asana: ' + (t.fields['Listing Status'] || t.section))]);
      } else if (st.stage === 'Off market' && pitch.outcome === 'open') {
        await save('pitches', pitch, { outcome: 'not won' },
          [log({ pitch_id: pitch.id }, 'outcome', 'open', 'not won', 'Asana: ' + (t.fields['Listing Status'] || t.section))]);
      } else await updatePitch(pitch, t, false);
      return;
    }
    if (planBy) {
      const pr = planBy.get(t.gid);
      if (!pr) {                                        // not on the plan: cached; closed ones decided for good
        if (MAP.isGvcListing(t) && CLOSED.indexOf(st.stage) !== -1) entry.ignored = true;
        return;
      }
      if (!pr.tick) { entry.ignored = true; return; }   // Matt left it out
      // the task may have moved since the plan was made: its stage now decides pitch or listing
      if (st.stage === 'Pitch') return t.fields['🗓️ Pitch'] ? linkOrCreate(t, 'Pitch', 'pitch', pr.kind === 'pitch' ? pr.match : null, entry) : undefined;
      return linkOrCreate(t, st.stage, 'listing', pr.kind === 'listing' ? pr.match : null, entry);
    }
    if ((c && c.ignored) || !MAP.isGvcListing(t)) return;   // decided (by Matt or as closed), or not GVC-listed
    if (st.stage === 'Pitch') { if (t.fields['🗓️ Pitch']) await linkOrCreate(t, 'Pitch', 'pitch', null, entry); return; }
    if (ACTIVE.indexOf(st.stage) === -1) { entry.ignored = true; return; }   // first met closed: never a job, remembered
    return linkOrCreate(t, st.stage, 'listing', null, entry);
  }

  for (const t0 of run.listings) {
    const c = cache.get(t0.gid);
    const t = Object.assign({}, t0, { history: t0.history || (c && c.history) || [] });
    const entry = cacheEntry(t, 'listing', { property_id: (c && c.property_id) || null, pitch_id: (c && c.pitch_id) || null, ignored: !!(c && c.ignored) });
    entries.push(entry);
    try { await oneTask(t, c, entry); }
    catch (e) { out.errors.push({ what: 'task', detail: e.message, gid: t.gid }); }
  }

  /* tasks left unlinked at the address of a job linked to another task */
  entries.filter(e => e.kind === 'listing' && !e.property_id && !e.pitch_id).forEach(e => {
    const t = fresh.get(e.gid);
    if (!t || !MAP.isGvcListing(t) || out.unlinked.some(u => u.gid === e.gid)) return;
    const hit = props.find(p => p.asana_gid && p.asana_gid !== e.gid && L.sameAddress(t.name, p.core));
    if (hit) out.unlinked.push({ gid: e.gid, name: t.name, why: 'same address', propertyId: hit.id });
  });

  /* ---------- absence is not deletion (plan §8a) ---------- */
  if (run.full) {
    for (const c of cacheRows) {
      if (c.kind !== 'listing' || !c.property_id || fresh.has(c.gid) || (run.readProjects || []).indexOf(c.project_gid) === -1) continue;
      const p = props.find(x => x.id === c.property_id);
      if (!p || (p.asana && p.asana.gone)) continue;
      await save('properties', p, {
        asana: Object.assign({}, p.asana || {}, { gone: now }),
        match: withMatch(p.match, { code: 'M2', text: 'Asana task gone', values: { asanaGid: c.gid }, fixAt: 'Asana', who: null, since: now })
      }, [log({ property_id: p.id }, null, null, null, 'Asana task gone')]);
    }
  }

  /* ---------- the cache: one row per task (a listing row wins over the same task in a 🚧 project),
     in batches with one column list each (PostgREST can't touch a row twice in one batch) ---------- */
  const byGid = new Map();
  entries.forEach(e => { if (!byGid.has(e.gid) || e.kind === 'listing') byGid.set(e.gid, e); });
  const rows = Array.from(byGid.values());
  for (let i = 0; i < rows.length; i += 500) await client.upsert('asana_tasks', rows.slice(i, i + 500), 'gid');
}

module.exports = { applyRun, snapshotOf, NO_PLAN };
