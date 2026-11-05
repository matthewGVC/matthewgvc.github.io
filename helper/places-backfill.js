/* ============================================================
   PLACES BACKFILL — the one-time move from "a job is a place" to places and deals
   (migration 0025, Matt 11-05).

     node helper/places-backfill.js                 reads the live rows, writes the plan:
         exports/places-backfill-<date>.md   for Matt to read
         exports/places-backfill-<date>.json what --apply reads
     node helper/places-backfill.js --apply exports/places-backfill-<date>.json
         applies it, and skips anything already done (safe to run twice)
     --out <folder>   where the plan goes instead of this checkout's exports\ (the
                      worktree's exports\ is not the real one: point it at the main
                      checkout's exports\)

   The plan reads and writes nothing; applying it writes through the helper's account
   (supabase.js), each change logged as a `changes` row, source 'Helper', note
   "Places backfill (11-05)". Nothing goes to Asana or Drive.

     planBackfill({ properties, pitches, devs, tasks })
       → { buildings, places, links, newDevs, pitchesToDeals, skipped, questions }   pure
     applyPlan({ client, plan }) → { linked, devs, pitches }
     reportOf(plan, date) → the .md text

   What it does:
     - Every job with a stage and an address gets a place (a sale and a rental on one unit
       share it); NYC units also get their building. A link says which town, since one
       street address can be two places.
     - Skipped, never placed: jobs with no stage, and archived jobs with no Asana task (the
       merged copies), which would read as false past deals.
     - A job with no address or no market, or a pitch with no address, is a question: never a guess.
     - A job in Asana's "TJ New Dev" section with no development gets one (decision 71: one
       house, one row: the development carries the house's drive folder, and the house and its
       place take the development's id). A house that already has its development only
       carries it onto its place (a link's devId).
     - The open pitch becomes a deal on its place (stage Pitch) and the pitch is marked won.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const GP = require('../assets/js/places.js');
const P = require('../assets/js/property-library.js');
const { findOrMakePlace } = require('./place-store.js');

const NOTE = 'Places backfill (11-05)';
const TJ_SECTION = /TJ New Dev/i;

function planBackfill({ properties, pitches, devs, tasks }) {
  const plan = { buildings: [], places: [], links: [], newDevs: [], pitchesToDeals: [], skipped: [], questions: [] };
  const sectionOf = {};
  (tasks || []).forEach(t => { sectionOf[t.gid] = t.section; });
  const slugs = new Set((properties || []).map(p => p.slug).filter(Boolean));
  const devSlugs = new Set((devs || []).map(d => d.slug).filter(Boolean));

  /* the plan's place for this core, added when new; null when there is no street */
  function placeOf(core, market) {
    const split = P.unitOf(core), key = GP.placeKey(split, market);
    if (!key) return null;
    const address = GP.cleanStreet(split.address), town = (core && core.city) || null;
    let hit = plan.places.find(p => p.key === key && GP.samePlace(p, { address, town }));
    if (!hit) {
      hit = { key, address, town, label: P.labelOf(core), market };
      plan.places.push(hit);
      const bKey = GP.buildingKey(split, market);
      if (bKey && !plan.buildings.some(b => b.key === bKey)) plan.buildings.push({ key: bKey, label: address, market });
    } else if (!hit.town && town) hit.town = town;
    return hit;
  }

  (properties || []).forEach(p => {
    const who = { id: p.id, label: p.label || null };
    if (!p.stage) { plan.skipped.push(Object.assign(who, { why: 'no stage' })); return; }
    if (p.stage === 'Archived' && !p.asana_gid) { plan.skipped.push(Object.assign(who, { why: 'archived, no Asana task (a merged copy)' })); return; }
    if (p.place_id) return;
    if (!p.market) { plan.questions.push(Object.assign(who, { why: 'no market' })); return; }
    const place = placeOf(p.core, p.market);
    if (!place) { plan.questions.push(Object.assign(who, { why: 'no street address' })); return; }

    const house = (devs || []).find(d => d.house_listing_id === p.id);
    const link = { propertyId: p.id, placeKey: place.key, address: place.address, town: (p.core && p.core.city) || null };
    if (p.dev_project_id || house) link.devId = p.dev_project_id || house.id;
    plan.links.push(link);

    if (!link.devId && TJ_SECTION.test(sectionOf[p.asana_gid] || '')) {
      let slug = P.slugOf(place.address), n = 2;
      while (devSlugs.has(slug)) slug = P.slugOf(place.address) + '-' + n++;
      devSlugs.add(slug);
      plan.newDevs.push({ slug, label: place.address, market: p.market, house_listing_id: p.id,
        drive_folder: p.drive_folder || null, folder_state: p.folder_state || 'unlinked' });
    }
  });

  (pitches || []).filter(q => q.outcome === 'open').forEach(q => {
    const who = { id: q.id, label: q.label || null };
    const place = q.market ? placeOf(q.core, q.market) : null;
    if (!place) { plan.questions.push(Object.assign(who, { why: q.market ? 'pitch with no street address' : 'pitch with no market' })); return; }
    let slug = q.slug;
    if (slugs.has(slug)) slug += '-pitch';
    slugs.add(slug);
    plan.pitchesToDeals.push({ id: q.id, slug, label: q.label, market: q.market, asana_gid: q.asana_gid || null, pitched_on: q.pitched_on || null,
      placeKey: place.key, address: place.address, town: place.town });
  });
  return plan;
}

/* ---------- applying ---------- */

function logOf(owner, field, oldValue, newValue) {
  return Object.assign({ field, old_value: oldValue, new_value: newValue, source: 'Helper', note: NOTE }, owner);
}

async function applyPlan({ client, plan }) {
  const cache = { places: await client.select('places'), buildings: await client.select('buildings') };
  const done = { linked: 0, devs: 0, pitches: 0 };
  const devOfHouse = {};

  for (const d of plan.newDevs) {
    let dev = (await client.select('dev_projects', { house_listing_id: d.house_listing_id }))[0];
    if (!dev) {
      dev = (await client.insert('dev_projects', d))[0];
      await client.insert('changes', logOf({ dev_project_id: dev.id }, 'created', null, d.label));
      done.devs++;
    }
    devOfHouse[d.house_listing_id] = dev.id;
  }

  for (const l of plan.links) {
    const row = (await client.select('properties', { id: l.propertyId }))[0];
    if (!row || row.place_id) continue;
    const devId = devOfHouse[row.id] || l.devId || null;
    const place = await findOrMakePlace(client, cache, { core: row.core, market: row.market, devId });
    const patch = { place_id: place.id };
    if (devId && !row.dev_project_id) patch.dev_project_id = devId;
    await client.update('properties', { id: row.id }, patch, { version: row.version });
    await client.insert('changes', logOf({ property_id: row.id }, 'place', null, place.id));
    if (patch.dev_project_id) await client.insert('changes', logOf({ property_id: row.id }, 'dev_project_id', null, devId));
    done.linked++;
  }

  for (const d of plan.pitchesToDeals) {
    const pitch = (await client.select('pitches', { id: d.id }))[0];
    if (!pitch || pitch.outcome !== 'open') continue;
    let deal = (await client.select('properties', { from_pitch_id: pitch.id }))[0];
    if (!deal) {
      const place = await findOrMakePlace(client, cache, { core: pitch.core, market: pitch.market });
      deal = (await client.insert('properties', {
        slug: d.slug, label: pitch.label, market: pitch.market, place_id: place.id, from_pitch_id: pitch.id, stage: 'Pitch', stage_source: 'Asana',
        kind: 'sale', asana_gid: pitch.asana_gid || null, core: pitch.core, drive_folder: pitch.drive_folder || null,
        folder_state: pitch.folder_state || 'unlinked', milestones: { pitchedOn: pitch.pitched_on || null }
      }))[0];
      await client.insert('changes', logOf({ property_id: deal.id }, 'stage', null, 'Pitch'));
    }
    await client.update('pitches', { id: pitch.id }, { outcome: 'won', won_property_id: deal.id }, { version: pitch.version });
    await client.insert('changes', logOf({ pitch_id: pitch.id }, 'outcome', 'open', 'won'));
    done.pitches++;
  }
  return done;
}

/* ---------- the report ---------- */

function reportOf(plan, date) {
  const L = ['# Places backfill, ' + date, '',
    'Nothing is written until this plan is applied. Every job with a stage and an address gets a place;',
    'a sale and a rental on one unit share it.', '',
    '- Places: ' + plan.places.length + ' (' + plan.buildings.length + ' NYC buildings)',
    '- Jobs linked to a place: ' + plan.links.length,
    '- New developments: ' + plan.newDevs.length,
    '- Open pitches that become deals: ' + plan.pitchesToDeals.length,
    '- Skipped: ' + plan.skipped.length,
    '- Questions: ' + plan.questions.length, ''];
  function section(title, rows, line) {
    if (!rows.length) return;
    L.push('## ' + title + ' (' + rows.length + ')', '');
    rows.forEach(r => L.push('- ' + line(r)));
    L.push('');
  }
  section('New developments', plan.newDevs, d => d.label + ' · ' + d.market + ' · the house `' + d.house_listing_id + '`');
  section('Pitches that become deals', plan.pitchesToDeals, d => [d.label, d.market, d.pitched_on].filter(Boolean).join(' · ') + ' `' + d.id + '`');
  section('Skipped, never placed', plan.skipped, s => [s.label || '(no name)', s.why].join(' · ') + ' `' + s.id + '`');
  section('Questions (no place made)', plan.questions, q => [q.label || '(no name)', q.why].join(' · ') + ' `' + q.id + '`');
  return L.join('\n');
}

module.exports = { planBackfill, applyPlan, reportOf, NOTE };

if (require.main === module) {
  const { loadConfig } = require('./config.js');
  const { createClient } = require('./supabase.js');
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i === -1 ? null : a[i + 1]; };
  const cfg = loadConfig(), client = createClient(cfg);
  if (!client.ready()) { console.log('No helper account yet: add helperEmail and helperPassword to ' + path.join(cfg.home, 'config.json') + '.'); process.exit(1); }
  (async () => {
    const applyFile = arg('--apply');
    if (applyFile) {
      const done = await applyPlan({ client, plan: JSON.parse(fs.readFileSync(applyFile, 'utf8')) });
      console.log('Applied: ' + done.linked + ' jobs linked, ' + done.devs + ' developments made, ' + done.pitches + ' pitches made into deals.');
      return;
    }
    const [properties, pitches, devs, tasks] = await Promise.all([
      client.select('properties', {}, 'id,slug,kind,market,stage,asana_gid,label,core,place_id,dev_project_id,drive_folder,folder_state'),
      client.select('pitches', {}, 'id,slug,label,market,outcome,asana_gid,pitched_on,core'),
      client.select('dev_projects', {}, 'id,slug,house_listing_id'),
      client.select('asana_tasks', {}, 'gid,section')]);
    const plan = planBackfill({ properties, pitches, devs, tasks });
    const date = new Date().toISOString().slice(0, 10), dir = arg('--out') || path.join(__dirname, '..', 'exports');
    fs.mkdirSync(dir, { recursive: true });
    const base = path.join(dir, 'places-backfill-' + date);
    fs.writeFileSync(base + '.json', JSON.stringify(plan, null, 2));
    fs.writeFileSync(base + '.md', reportOf(plan, date));
    console.log('Plan written to ' + base + '.md and .json. Nothing was changed.');
  })().catch(e => { console.log('PLACES BACKFILL FAILED: ' + e.message); process.exit(1); });
}
