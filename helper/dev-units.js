/* ============================================================
   DEV UNITS — a development's units on Elliman become its deals (decision 72).

     await syncDevUnits(client, { now?, log? }) → { created, moved }
       client  helper/supabase.js (or a fake with the same shape)
       log     where a row it can't read is reported (default console.error)

   Le Reve (200 E Boca Raton Rd, units B, C, E) and Casa Avenida (102 SE 5th Ave, units
   2 and 8) sell their units through the development, so they have no Asana task. Run by
   de-sync.js after every good Elliman read (never an aborted one):
   - a GVC-listed de_listings row that isn't set aside, at a street of a development that
     isn't archived (GVC_DEV_ADDRESSES), with no property_id, becomes a deal in that
     development: slug as an Asana-made deal's (the Elliman id's last six on a clashing slug),
     label by the naming rule (GVC_NAME.nameOf: "200 E Boca Raton Rd - B", " (Rental)" last on a
     rental), the development's own spelling of the street and its market, stage source 'DE',
     no Asana task, no folder (decision 21), its place (place-store.js), and
     de_listings.property_id set. The next Elliman read fills its price and facts through
     the de_listing_id, as for any job (de/apply.js).
   - such a deal made before the naming rule takes its rule label on its next run (one `changes`
     row, field label, note "Named by the naming rule").
   - such a deal's stage follows Elliman (de/status.js mapStage; Sold and Rented become
     Archived), one `changes` row each move, its note in the workspace's stage words
     ("Elliman shows it In contract", workspace-data.js stageWord), until an Asana task takes it
     over (asana_gid set) or someone else set its stage (stage_source no longer 'DE').
   - every de_listings row is read, whatever its last_seen: a unit Elliman stopped listing keeps
     its stage, and a unit Elliman shows Active again after Sold moves back from Archived to Live.
     Both are left for stage 4's archive rules.
   - a status mapStage doesn't know is logged for that row, which is left alone; the rest run.
   This is the one exception to D54 ("jobs are never made from Elliman") and D50 ("Elliman
   never moves the stage"): de/apply.js keeps both rules. Nothing here touches Asana or Drive.
   ============================================================ */
'use strict';

const P = require('../assets/js/property-library.js');
const A = require('../assets/js/address-aliases.js');
const DA = require('../assets/js/dev-addresses.js');
const W = require('../assets/js/workspace-data.js');
const N = require('../assets/js/naming.js');
const { mapStage } = require('./de/status.js');
const { findOrMakePlace } = require('./place-store.js');

const ARCHIVES = { Sold: 'Archived', Rented: 'Archived' };

/* an Elliman-only unit's name, by the naming rule (it has no Asana task to name it); '' with no street */
function ruleLabel(core, market, kind) {
  core = core || {};
  if (!String(core.address || '').trim()) return '';
  return N.nameOf({ street: core.address, unit: core.unit }, market, { rental: kind === 'rental' });
}

/* the development whose street this is, and that street as the workspace spells it */
function devStreet(street) {
  for (const slug of Object.keys(DA.BY_SLUG)) {
    const s = DA.BY_SLUG[slug].find(x => A.sameStreet(x, street));
    if (s) return { slug, street: s };
  }
  return null;
}

async function syncDevUnits(client, o) {
  o = o || {};
  const now = (o.now || new Date()).toISOString(), log = o.log || (m => console.error(m));
  const out = { created: 0, moved: 0 };
  const units = (await client.select('de_listings'))
    .map(d => ({ d, at: d.gvc_listed && !d.ignored && d.raw && d.raw.street ? devStreet(d.raw.street) : null }))
    .filter(u => u.at);
  if (!units.length) return out;   // nothing at a development's street: the other tables aren't read
  const devs = await client.select('dev_projects'), props = await client.select('properties');
  const cache = { places: await client.select('places'), buildings: await client.select('buildings') };
  const slugs = new Set(props.map(p => p.slug));
  const change = (pid, field, oldV, newV, note) => ({ property_id: pid, at: now, field, old_value: oldV === undefined ? null : oldV,
    new_value: newV === undefined ? null : newV, note: note || null, source: 'DE' });

  for (const { d, at } of units) {
    try {
      const raw = d.raw, mapped = mapStage(raw), stage = ARCHIVES[mapped] || mapped;
      if (d.property_id) {
        const p = props.find(x => x.id === d.property_id);
        if (!p || !p.dev_project_id || p.asana_gid) continue;
        const patch = {}, rows = [];
        // a unit made before the naming rule takes its rule name on its next run
        const label = ruleLabel(p.core, p.market, p.kind);
        if (label && label !== p.label) { patch.label = label; rows.push(change(p.id, 'label', p.label || null, label, 'Named by the naming rule')); }
        const moves = p.stage_source === 'DE' && p.stage !== stage;
        if (moves) { patch.stage = stage; patch.stage_source = 'DE'; rows.push(change(p.id, 'stage', p.stage, stage, 'Elliman shows it ' + W.stageWord(mapped, p.kind))); }
        if (!rows.length) continue;
        await client.update('properties', { id: p.id }, patch, { version: p.version });
        await client.insert('changes', rows);
        if (moves) out.moved++;
        continue;
      }
      const dev = devs.find(x => x.slug === at.slug && !x.archived_at);
      if (!dev) continue;
      // made on an earlier run whose last step failed: only the pointer is missing
      const had = props.find(x => x.de_listing_id === d.de_listing_id);
      if (had) { await client.update('de_listings', { de_listing_id: d.de_listing_id }, { property_id: had.id }); continue; }
      const core = { address: at.street, unit: raw.unit || '', city: raw.city || null, state: raw.state || null };
      const place = await findOrMakePlace(client, cache, { core, market: dev.market || null, devId: dev.id });
      const kind = d.kind || 'sale';
      let slug = P.slugOfCore(core);
      if (slugs.has(slug)) slug = slug + '-' + String(d.de_listing_id).slice(-6);
      slugs.add(slug);
      const made = (await client.insert('properties', { slug, label: ruleLabel(core, dev.market || null, kind) || P.labelOf(core), core, kind, market: dev.market || null, stage,
        stage_source: 'DE', units: core.unit ? [core.unit] : [], asana_gid: null, de_listing_id: d.de_listing_id, folder_state: 'unlinked',
        dev_project_id: dev.id, place_id: place ? place.id : null }))[0];
      props.push(made);
      await client.insert('changes', [change(made.id, null, null, null, 'Found on Elliman: a unit of ' + (dev.label || dev.slug)),
        change(made.id, 'stage', null, stage), change(made.id, 'kind', null, kind)]);
      await client.update('de_listings', { de_listing_id: d.de_listing_id }, { property_id: made.id });
      out.created++;
    } catch (e) {
      log('dev units: ' + e.message);
    }
  }
  return out;
}

module.exports = { syncDevUnits };
