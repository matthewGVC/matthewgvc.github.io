/* ============================================================
   DE APPLY — writes one DE run into the database (plan §8, D6, D7, D31).

     await applyRun({ client, report, rows, now, courtesy })
       client    helper/supabase.js (or a fake with the same shape)
       report    the dry-run report (de-sync.js): ok/aborted, totals, live[]
                 with each live listing's matched folder
       rows      every normalised DE row of the run, each with .stage
       courtesy  async row → { gvcListed, line }: the GVC-listed check (D35),
                 asked once per DE listing, then remembered in de_listings
     → { runId, changes, created, errors }

   What it does:
   - a listing already linked to a DE id: DE's price, beds, baths, half baths
     and square feet win (D6); city/state/zip/neighbourhood fill only when
     empty; the stage moves forward (In contract → Live is the one way back);
     every changed value is one `changes` row, source DE.
   - a new GVC-listed live listing: becomes a job, with its matched folder.
   - sold / rented: only by the listing's own DE id, never by address (an old
     sale of the same unit must not close today's listing). Transactions that
     aren't a job are remembered and otherwise ignored (D31).
   - an aborted run writes nothing but its `sync_runs` row.
   - a row someone else changed meanwhile (version check) is skipped and
     logged, never overwritten.
   It never touches Drive (D7).
   ============================================================ */
'use strict';

const P = require('../../assets/js/property-library.js');
const A = require('../../assets/js/address-aliases.js');

const ORDER = ['Won', 'Floorplan', 'Showsheet', 'Photos', 'Brochure', 'Live', 'In contract', 'Sold', 'Rented', 'Archived'];
const RANK = s => (s === 'Rented' ? ORDER.indexOf('Sold') : ORDER.indexOf(s));
const DE_FACTS = ['price', 'beds', 'baths', 'halfBaths', 'sqft'];
const FILL_FACTS = ['city', 'state', 'zip', 'neighborhood'];
const MARKET = { NY: 'NYC', NJ: 'NJ', FL: 'FL' };
const CLOSED = ['Sold', 'Rented', 'Archived'];

function canMove(from, to) {
  if (!to || from === to || from === 'Archived') return false;
  if (!from) return true;
  if (from === 'In contract' && to === 'Live') return true;
  return RANK(to) > RANK(from);
}

function snapshot(r) {
  return { status: r.status, price: r.price, closePrice: r.closePrice, beds: r.beds, baths: r.baths, halfBaths: r.halfBaths,
    sqft: r.sqft, priceChangePercent: r.priceChangePercent, openHouses: r.openHouses, listingUrl: r.listingUrl, cover: r.cover };
}
function sameValue(k, a, b) { return a === b || (k === 'halfBaths' && (a == null ? 0 : a) === (b == null ? 0 : b)); }

async function applyRun(o) {
  const { client, report } = o;
  const now = (o.now || new Date()).toISOString();
  const run = (await client.insert('sync_runs', { kind: 'de', started_at: now, rows_read: report.rowsRead || null,
    totals: report.totals || null, helper_version: o.helperVersion || null }))[0];
  const out = { runId: run.id, changes: 0, created: 0, errors: [] };
  const finish = (ok, errs) => client.update('sync_runs', { id: run.id },
    { finished_at: new Date().toISOString(), ok, changes: out.changes, errors: errs && errs.length ? errs : null });

  if (!report.ok) { await finish(false, [{ what: 'aborted', detail: report.aborted }]); return out; }
  try {
    await writeRows(o, run, out, now);
  } catch (e) {
    // the run row is always finished, with the reason
    await finish(false, out.errors.concat([{ what: 'failed', detail: e.message }]));
    throw e;
  }
  await finish(true, out.errors);
  return out;
}

async function writeRows(o, run, out, now) {
  const { client, report } = o;
  const props = await client.select('properties');
  const known = new Map((await client.select('de_listings')).map(d => [d.de_listing_id, d]));
  const byDe = new Map(props.filter(p => p.de_listing_id).map(p => [p.de_listing_id, p]));
  const folders = new Map((report.live || []).map(x => [x.id, x]));
  const cache = [];

  const log = (pid, field, oldV, newV, note) => ({ property_id: pid, at: now, field, old_value: oldV === undefined ? null : oldV,
    new_value: newV === undefined ? null : newV, note: note || null, source: 'DE', run_id: run.id });

  async function write(p, patch, changes) {
    if (!changes.length && !Object.keys(patch).length) return;
    try {
      await client.update('properties', { id: p.id }, patch, { version: p.version });
      if (changes.length) await client.insert('changes', changes);
      out.changes += changes.length;
    } catch (e) {
      if (e.name !== 'ConflictError') throw e;
      out.errors.push({ what: 'conflict', detail: e.message, property: p.slug });
    }
  }

  for (const r of o.rows) {
    const cached = known.get(r.id) || {};
    const entry = { de_listing_id: r.id, feed: r.feed, kind: r.kind, last_seen: now, raw: snapshot(Object.assign({ street: r.street, unit: r.unit }, r)) };
    try {
    let p = byDe.get(r.id);

    if (r.feed === 'featured' && !p) {
      // an open job for this address that hasn't been tied to DE yet (never an old sold or archived one)
      p = props.find(x => !x.de_listing_id && x.kind === r.kind && CLOSED.indexOf(x.stage) === -1 && (() => {
        const u = P.unitOf(x.core); return A.same(u.address, r.street) && A.unitKey(u.unit) === A.unitKey(r.unit);
      })());
    }

    if (p) {
      const core = Object.assign({}, p.core), changes = [], patch = {};
      DE_FACTS.forEach(k => {
        if (r[k] == null || sameValue(k, core[k], r[k])) return;
        const note = k === 'price' && r.priceChangePercent < 0 ? 'Price reduced ' + Math.abs(r.priceChangePercent).toFixed(1) + '% on DE' : null;
        changes.push(log(p.id, k, core[k], r[k], note));
        core[k] = r[k];
      });
      FILL_FACTS.forEach(k => { if (!core[k] && r[k]) core[k] = r[k]; });
      if (r.listingUrl && core.listingUrl !== r.listingUrl) core.listingUrl = r.listingUrl;
      if (r.feed === 'transactions' && r.closePrice != null && core.closePrice !== r.closePrice) {
        changes.push(log(p.id, 'closePrice', core.closePrice, r.closePrice));
        core.closePrice = r.closePrice;
      }
      if (JSON.stringify(core) !== JSON.stringify(p.core)) patch.core = core;
      const snap = snapshot(r);
      if (JSON.stringify(snap) !== JSON.stringify(p.de)) { patch.de = snap; patch.de_status = r.status; }
      if (p.de_listing_id !== r.id) patch.de_listing_id = r.id;
      // starter mode: a library row that isn't on the overview yet gets DE's facts but no stage
      if (canMove(p.stage, r.stage) && (p.stage || o.addNew !== false)) {
        changes.push(log(p.id, 'stage', p.stage || null, r.stage));
        patch.stage = r.stage; patch.stage_source = 'DE';
      }
      await write(p, patch, changes);
      entry.property_id = p.id;
    } else if (r.feed === 'featured' && o.addNew !== false) {   // starter mode (deAddsNew: false) only updates known jobs
      let gvc = cached.gvc_listed;
      if (gvc === undefined || gvc === null) {
        const c = await o.courtesy(r);
        gvc = !!c.gvcListed; entry.gvc_listed = gvc; entry.courtesy = c.line || null; entry.checked_at = now;
      }
      if (gvc) {
        const f = folders.get(r.id) || {};
        const core = { address: r.street, unit: r.unit, city: r.city, state: r.state, zip: r.zip, neighborhood: r.neighborhood,
          price: r.price, beds: r.beds, baths: r.baths, halfBaths: r.halfBaths, sqft: r.sqft, listingUrl: r.listingUrl };
        const made = (await client.insert('properties', {
          slug: P.slugOfCore(core), label: P.labelOf(core), core, kind: r.kind, market: MARKET[r.state] || null,
          stage: r.stage, stage_source: 'DE', units: r.unit ? [r.unit] : [], de_listing_id: r.id, de_status: r.status, de: snapshot(r),
          drive_folder: f.folder || null, folder_state: f.folder ? 'linked' : 'unlinked'
        }))[0];
        await client.insert('changes', log(made.id, null, null, null, 'Found on DE'));
        out.created++; out.changes++;
        entry.property_id = made.id;
      }
    }
    } catch (e) {
      // one listing failing (a network blip, a slug clash) is logged; the rest still sync
      out.errors.push({ what: 'listing', detail: e.message, listing: r.id });
    }
    cache.push(entry);
  }

  // PostgREST writes one column list per batch and fills the gaps with null, so
  // entries are sent in groups with the same fields: a cached GVC check is never blanked
  const groups = new Map();
  cache.forEach(e => { const k = Object.keys(e).sort().join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i += 500) await client.upsert('de_listings', g.slice(i, i + 500), 'de_listing_id');
  }
}

module.exports = { applyRun, canMove };
