/* ============================================================
   DE NORMALIZE — one DE listing row in the workspace's own words.

     normalize(raw, 'featured-sale') → NormRow
       { id, feed: 'featured'|'transactions', kind: 'sale'|'rental',
         status,            // DE's listingStatus on featured rows;
                            // 'Sold' / 'Rented' on transactions (DE sends none)
         street, unit,      // "555 W 59TH ST", "PHC" ('' for a house)
         city, state, zip, neighborhood,
         propertyLabel,     // "Condo", "Co-op", "Single Family Home" (transactions; null on featured rows)
         price, closePrice, closeDate, beds, baths, halfBaths, sqft,
         priceChangePercent, openHouses, listingUrl, cover }

   Field names were read off the 2026-10-19 recording. The street comes
   from samlsPartialAddress (streetName alone drops the "E"/"W" on
   transaction rows: "32ND" for "200 E 32ND St").
   ============================================================ */
'use strict';

function num(v) { return v === null || v === undefined || v === '' ? null : Number(v); }

function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function normalize(raw, feedName) {
  const [feed, kind] = feedName.split('-');
  const a = raw.address || {};
  const unit = String(a.unitNumber || '').replace(/^#/, '').trim();
  let street = String(a.samlsPartialAddress || ((a.streetNumber || '') + ' ' + (a.streetName || ''))).trim();
  if (a.unitNumber && street.toUpperCase().endsWith(' ' + String(a.unitNumber).toUpperCase())) {
    street = street.slice(0, -(String(a.unitNumber).length + 1)).trim();
  }
  const zip = a.postalCode || ((/\b(\d{5})\s*$/.exec(a.samlsFullAddress || '') || [])[1]) || null;
  const id = String(raw.coreListingId);
  return {
    id, feed, kind,
    status: feed === 'transactions' ? (kind === 'rental' ? 'Rented' : 'Sold') : raw.listingStatus,
    street: street.replace(/\s+/g, ' '), unit,
    city: a.city || null, state: a.stateOrProvince || null, zip,
    neighborhood: a.neighborhood || null,
    propertyLabel: raw.propertyLabel || null,
    price: num(raw.listPrice), closePrice: num(raw.closePrice), closeDate: raw.closeDate || null,
    beds: num(raw.bedroomsTotal), baths: num(raw.bathroomsFull), halfBaths: num(raw.bathroomsHalf),
    sqft: num(raw.livingAreaSquareFeet),
    priceChangePercent: num(raw.priceChangePercent),
    openHouses: raw.openHouses || [],
    listingUrl: a.samlsFullAddress ? 'https://www.elliman.com/listing/' + slugify(a.samlsFullAddress) + '/' + id : null,
    cover: raw.coverImage && raw.coverImage.url || null
  };
}

module.exports = { normalize, slugify };
