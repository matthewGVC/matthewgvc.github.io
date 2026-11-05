/* ============================================================
   PLACE STORE — finds the place a deal is on, or makes it (migration 0025).

     const cache = { places: await client.select('places'), buildings: await client.select('buildings') };
     keyOfCore(core, 'NYC')                         → 'NYC|401 east 89|1819E'
     await findOrMakePlace(client, cache, { core, market, devId })
       → the place row (with its id), inserted when there was none

   `cache` is one run's two lists, read at its start; a place or building made here is pushed
   into it, so a second call in the same run finds it (two new tasks at one new address share
   one place, and a second unit in a known NYC building reuses the building: buildings.key is
   unique). A place is found by its key, then confirmed by GVC_PLACES.samePlace ("12 Elm St" in
   Brielle and in Manasquan are two places). Its address is the clean street, its label the
   job's own label today, its slug the property slug ("-2", "-3" on a clash). For NYC the
   building is found by buildingKey, and building_id is set either way. devId, when given,
   goes on a new place, or on a found one that has none.

   Used by the one-time backfill (places-backfill.js) and by the sync.
   Writes through the helper's Supabase client (supabase.js); only the helper may write places.
   ============================================================ */
'use strict';

const GP = require('../assets/js/places.js');
const P = require('../assets/js/property-library.js');

function keyOfCore(core, market) { return GP.placeKey(P.unitOf(core), market); }

function freeSlug(cache, base) {
  const taken = new Set(cache.places.map(p => p.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(base + '-' + n)) n++;
  return base + '-' + n;
}

async function findOrMakePlace(client, cache, { core, market, devId }) {
  const split = P.unitOf(core), key = GP.placeKey(split, market);
  const address = GP.cleanStreet(split.address), town = (core && core.city) || null;
  const found = cache.places.find(p => p.key === key && GP.samePlace(p, { address, town }));
  if (found) {
    if (devId && !found.dev_project_id) {
      await client.update('places', { id: found.id }, { dev_project_id: devId });
      found.dev_project_id = devId;
    }
    return found;
  }

  let building = null;
  const bKey = GP.buildingKey(split, market);
  if (bKey) {
    building = cache.buildings.find(b => b.key === bKey);
    if (!building) {
      building = (await client.insert('buildings', { key: bKey, label: address, market }))[0];
      cache.buildings.push(building);
    }
  }
  const place = (await client.insert('places', {
    slug: freeSlug(cache, P.slugOfCore(core)), key, address, town, label: P.labelOf(core), market,
    building_id: building ? building.id : null, dev_project_id: devId || null
  }))[0];
  cache.places.push(place);
  return place;
}

module.exports = { keyOfCore, findOrMakePlace };
