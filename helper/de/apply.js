/* ============================================================
   DE APPLY — writes one DE run into the database (plan §8, D6, D7, D31, D50, D54).

     await applyRun({ client, report, rows, now, courtesy })
       client    helper/supabase.js (or a fake with the same shape)
       report    the dry-run report (de-sync.js): ok/aborted, totals, live[]
       rows      every normalised DE row of the run, each with .stage (DE's own)
       courtesy  async row → { gvcListed, line }: the GVC-listed check (D35),
                 asked once per DE listing, then remembered in de_listings
     → { runId, changes, created (always 0), errors }

   What it does:
   - a listing linked to a DE id (or an open job at the same address + unit,
     which then gets the DE id): DE's price, beds, baths, half baths and square
     feet go through GVC_FACTS at DE's rank (D79): DE wins, except that a value
     Matt typed holds while DE's own value hasn't changed since (D78); the
     moment DE's value changes, DE takes over (logged). City/state/zip/
     neighbourhood fill only when empty. DE's status goes in `de_stage`; the
     stage itself belongs to Asana and is never moved here (D50, S8). Every
     changed value is one `changes` row, source DE.
   - jobs are never made here (D54): a GVC-looking DE listing with no job is
     kept in de_listings with its courtesy line, the evidence for Match's M2
     ("On DE, not in Asana"). `addNew` / the config's deAddsNew are retired.
   - sold / rented: only by the listing's own DE id, never by address (an old
     sale of the same unit must not close today's listing): de_stage, plus
     closePrice and closeDate in core. Transactions that aren't a job are
     remembered and otherwise ignored (D31).
   - the job's `de` snapshot keeps DE's closeDate when the row has one: Match's
     M5 compares it with Asana's Closing. It also keeps DE's zip, neighbourhood
     and property label (Match's M26 compares the zip). DE publishes no listing date, so
     there is none to keep (tune-up B2, checked 2026-10-21).
   - match: after the run, every staged job's Match check is stored in `match`
     where it changed (helper/match-store.js; found / cleared logged as 'match').
   - de_listings.raw is the DE snapshot plus the address (street, unit, city,
     state), so the Match page's "Link to a job" can put the jobs on the same
     street first (tune-up A). A job linked by hand has its de_listing_id
     stored, and that id is what finds it on the next run; `ignored` (Not ours)
     is never written here, so it stays.
   - an aborted run writes nothing but its `sync_runs` row.
   - a row someone else changed meanwhile (version check) is skipped and
     logged, never overwritten.
   It never touches Drive (D7).
   ============================================================ */
'use strict';

const P = require('../../assets/js/property-library.js');
const A = require('../../assets/js/address-aliases.js');
const F = require('../../assets/js/job-facts.js');
const { storeMatches } = require('../match-store.js');

const DE_FACTS = ['price', 'beds', 'baths', 'halfBaths', 'sqft'];
const FILL_FACTS = ['city', 'state', 'zip', 'neighborhood'];
const CLOSED = ['Sold', 'Rented', 'Archived'];

function snapshot(r) {
  const s = { status: r.status, price: r.price, closePrice: r.closePrice, beds: r.beds, baths: r.baths, halfBaths: r.halfBaths,
    sqft: r.sqft, priceChangePercent: r.priceChangePercent, openHouses: r.openHouses, listingUrl: r.listingUrl, cover: r.cover,
    zip: r.zip || null, neighborhood: r.neighborhood || null, propertyLabel: r.propertyLabel || null };
  if (r.closeDate) s.closeDate = r.closeDate;   // Match's M5 compares it with Asana's Closing (tune-up B2)
  return s;
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
  const cache = [], conflicted = new Set();

  const log = (pid, field, oldV, newV, note) => ({ property_id: pid, at: now, field, old_value: oldV === undefined ? null : oldV,
    new_value: newV === undefined ? null : newV, note: note || null, source: 'DE', run_id: run.id });

  async function write(p, patch, changes) {
    if (!changes.length && !Object.keys(patch).length) return;
    try {
      const r = await client.update('properties', { id: p.id }, patch, { version: p.version });
      Object.assign(p, JSON.parse(JSON.stringify(patch)), (r && r[0]) || {});   // the Match pass reads the row as it now is
      if (changes.length) await client.insert('changes', changes);
      out.changes += changes.length;
    } catch (e) {
      if (e.name !== 'ConflictError') throw e;
      out.errors.push({ what: 'conflict', detail: e.message, property: p.slug });
      conflicted.add(p.id);
    }
  }

  for (const r of o.rows) {
    const cached = known.get(r.id) || {};
    // the cache row also keeps the address (never the job's own snapshot), so the Match page can offer the job it belongs to
    const entry = { de_listing_id: r.id, feed: r.feed, kind: r.kind, last_seen: now,
      raw: Object.assign(snapshot(r), { street: r.street || null, unit: r.unit || null, city: r.city || null, state: r.state || null }) };
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
      let facts = core.facts || {};
      DE_FACTS.forEach(k => {
        if (r[k] == null) return;
        facts = F.adoptEdit(facts, k, core[k]);   // a builder's edit to core is Matt's (D78)
        const wasMatt = facts[k] && facts[k].source === 'Matt';
        facts = F.applyFact(facts, k, 'DE', r[k]).facts;
        const shown = facts[k].value;
        if (sameValue(k, core[k], shown)) return;
        const note = k === 'price' && r.priceChangePercent < 0 ? 'Price reduced ' + Math.abs(r.priceChangePercent).toFixed(1) + '% on DE'
          : wasMatt && facts[k].source === 'DE' ? 'DE\'s own value changed, so it replaces the one Matt typed' : null;
        changes.push(log(p.id, k, core[k], shown, note));
        core[k] = shown;
      });
      if (Object.keys(facts).length) core.facts = facts;
      FILL_FACTS.forEach(k => { if (!core[k] && r[k]) core[k] = r[k]; });
      if (r.listingUrl && core.listingUrl !== r.listingUrl) core.listingUrl = r.listingUrl;
      if (r.feed === 'transactions' && r.closePrice != null && core.closePrice !== r.closePrice) {
        changes.push(log(p.id, 'closePrice', core.closePrice, r.closePrice));
        core.closePrice = r.closePrice;
      }
      if (r.feed === 'transactions' && r.closeDate && core.closeDate !== r.closeDate) {
        changes.push(log(p.id, 'closeDate', core.closeDate, r.closeDate));
        core.closeDate = r.closeDate;
      }
      if (JSON.stringify(core) !== JSON.stringify(p.core)) patch.core = core;
      const snap = snapshot(r);
      if (JSON.stringify(snap) !== JSON.stringify(p.de)) { patch.de = snap; patch.de_status = r.status; }
      if (p.de_listing_id !== r.id) patch.de_listing_id = r.id;
      // DE's own stage, kept beside Asana's (D50, S8): DE never moves `stage`
      if (r.stage && p.de_stage !== r.stage) {
        changes.push(log(p.id, 'de_stage', p.de_stage || null, r.stage));
        patch.de_stage = r.stage;
      }
      await write(p, patch, changes);
      entry.property_id = p.id;
    } else if (r.feed === 'featured') {
      // no job: never made here (D54); the GVC check is kept as Match's evidence (M2)
      if (cached.gvc_listed === undefined || cached.gvc_listed === null) {
        const c = await o.courtesy(r);
        entry.gvc_listed = !!c.gvcListed; entry.courtesy = c.line || null; entry.checked_at = now;
      }
    }
    } catch (e) {
      // one listing failing (a network blip, a slug clash) is logged; the rest still sync
      out.errors.push({ what: 'listing', detail: e.message, listing: r.id });
    }
    cache.push(entry);
  }

  // Match, from the rows as they now stand (spec §5), with this run's DE listings as they will be cached (M19)
  const deListings = cache.map(e => Object.assign({}, known.get(e.de_listing_id) || {}, e));
  const ms = await storeMatches({ client, rows: props, now, runId: run.id, roster: o.roster, initials: o.initials, skip: conflicted, deListings });
  out.errors.push(...ms.errors);

  // PostgREST writes one column list per batch and fills the gaps with null, so
  // entries are sent in groups with the same fields: a cached GVC check is never blanked
  const groups = new Map();
  cache.forEach(e => { const k = Object.keys(e).sort().join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i += 500) await client.upsert('de_listings', g.slice(i, i + 500), 'de_listing_id');
  }
}

module.exports = { applyRun };
