'use strict';

require('../tools/destination-guide/guide-data.js');

const data = global.GVC_DESTINATION_GUIDES;
const errors = [];

function check(ok, message) {
  if (!ok) errors.push(message);
}

check(data && data.regions, 'guide registry is missing');
check(data && data.regions && data.regions[data.defaultRegion], 'default guide is missing');

Object.values((data && data.regions) || {}).forEach(region => {
  check(region.title && region.state && region.subtitle, region.id + ': cover identity is incomplete');
  check(Array.isArray(region.welcome) && region.welcome.length >= 2, region.id + ': welcome needs two paragraphs');
  check(region.overview && region.overview.knownFor && region.overview.history && region.overview.architecture,
    region.id + ': overview is incomplete');
  check(Array.isArray(region.places) && region.places.length >= 6, region.id + ': needs at least six featured places');
  check(Array.isArray(region.bucket) && region.bucket.length === 8, region.id + ': bucket list must contain eight items');
  check(Array.isArray(region.favorites) && region.favorites.length === 4, region.id + ': editor expects four favorites');

  const ids = new Set();
  (region.pois || []).forEach(poi => {
    check(Number.isInteger(poi.id) && poi.id > 0, region.id + ': invalid POI id');
    check(!ids.has(poi.id), region.id + ': duplicate POI id ' + poi.id);
    ids.add(poi.id);
    check(Number.isFinite(poi.lat) && poi.lat >= -90 && poi.lat <= 90, region.id + ': invalid latitude for ' + poi.name);
    check(Number.isFinite(poi.lon) && poi.lon >= -180 && poi.lon <= 180, region.id + ': invalid longitude for ' + poi.name);
    check(region.sources[poi.source], region.id + ': missing source ' + poi.source + ' for ' + poi.name);
  });

  Object.entries(region.sources || {}).forEach(([key, source]) => {
    check(source.label && /^https:\/\//.test(source.url || ''), region.id + ': invalid source ' + key);
  });
});

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Destination guide data is valid.');
