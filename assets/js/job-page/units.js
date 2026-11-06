/* ============================================================
   JOB PAGE: a development's units, as Elliman lists them (overhaul 7b).

     GVC_JP.units.of(deRows, slug)  → the development's units: Elliman listings at its
                                      street (GVC_DEV_ADDRESSES), for sale first, then by unit
     GVC_JP.units.houses(rows)      → (7b-2) the development's own house listings as units: the
                                      properties with its dev_project_id, archived ones and our own
                                      purchase of the land (side 'buy') left out
     GVC_JP.units.html(ctx)         → the Units card ('' when there are none); ctx.unitsFrom says
                                      where they came from ('elliman' or 'workspace')

   Elliman's site is the source (Matt, 11-03): Casa Avenida and Le Reve list
   their units there one by one. The page reads them from de_listings, which
   the helper's daily Elliman read keeps; nothing here is typed by hand. A
   development with no street on Elliman (619 Bradley, 315 Foreman, 405 Old
   Bridge, the NJ houses) shows its own house listings instead, each opening
   its job page; their facts are the ones kept on that page.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var WORD = { Active: 'For sale', Pending: 'In contract', 'Under Contract': 'In contract', Sold: 'Sold', Closed: 'Sold' };
  var ORDER = { 'For sale': 0, 'Accepted offer': 1, 'In contract': 1, Sold: 2 };
  // a house listing's stage, in the Units card's words
  var STAGE = { Pitch: 'Not listed yet', Prep: 'Not listed yet', Live: 'For sale', 'Accepted offer': 'Accepted offer', 'In contract': 'In contract',
    Sold: 'Sold', Rented: 'Rented', 'Off market': 'Off market' };
  function sortUnits(a, b) {
    var o = (ORDER[a.word] == null ? 3 : ORDER[a.word]) - (ORDER[b.word] == null ? 3 : ORDER[b.word]);
    return o || String(a.unit || '').localeCompare(String(b.unit || ''), undefined, { numeric: true });
  }

  function of(rows, slug) {
    var D = global.GVC_DEV_ADDRESSES, A = global.GVC_ADDR, streets = D && D.of ? D.of(slug) : [];
    if (!streets.length || !A) return [];
    return (rows || []).map(function (r) { return Object.assign({ id: r.de_listing_id }, r.raw || {}); })
      .filter(function (u) { return u.street && streets.some(function (s) { return A.sameStreet(u.street, s); }); })
      .map(function (u) { u.word = WORD[u.status] || u.status || ''; return u; })
      .sort(sortUnits);
  }
  function houses(rows) {
    return (rows || []).filter(function (r) { return r && r.slug && r.stage !== 'Archived' && r.side !== 'buy'; }).map(function (r) {
      var c = r.core || {};
      return { unit: c.unit || c.address || r.label, beds: c.beds, baths: c.baths, halfBaths: c.halfBaths, sqft: c.sqft,
        price: c.price, closePrice: c.closePrice, word: STAGE[r.stage] || r.stage || '', jobUrl: '../job/?listing=' + encodeURIComponent(r.slug) };
    }).sort(sortUnits);
  }

  function money(n) { return n ? '$' + Number(n).toLocaleString('en-US') : ''; }

  function html(ctx) {
    var esc = ctx.esc, I = ctx.I, units = ctx.units || [];
    if (!units.length) return '';
    var count = {}; units.forEach(function (u) { count[u.word] = (count[u.word] || 0) + 1; });
    var line = Object.keys(count).sort(function (a, b) { return (ORDER[a] == null ? 3 : ORDER[a]) - (ORDER[b] == null ? 3 : ORDER[b]); })
      .map(function (w) { return count[w] + ' ' + w.toLowerCase(); }).join(' · ');
    var from = ctx.unitsFrom === 'workspace' ? 'From its listings here; each opens its page.' : 'As listed on Elliman, read each morning.';
    return '<div class="card" id="unitsCard"><div class="card-h"><div><h2>Units</h2><p>' + esc(line) + '. ' + from + '</p></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Unit</th><th>Beds / baths</th><th class="r">Size</th><th class="r">Price</th><th>Status</th><th></th></tr></thead><tbody>' +
      units.map(function (u) {
        var baths = (u.baths || 0) + (u.halfBaths ? ' + ' + u.halfBaths + ' half' : '');
        return '<tr><td><b>' + esc(u.unit || '—') + '</b></td><td>' + esc((u.beds != null ? u.beds + ' bd' : '') + (u.baths != null ? ' / ' + baths + ' ba' : '')) + '</td>' +
          '<td class="r">' + esc(u.sqft ? Number(u.sqft).toLocaleString('en-US') + ' sq ft' : '') + '</td>' +
          '<td class="r">' + esc(money(u.word === 'Sold' && u.closePrice ? u.closePrice : u.price)) + '</td><td>' + esc(u.word) + '</td>' +
          '<td>' + (u.jobUrl ? '<a href="' + esc(u.jobUrl) + '">' + I('arrow') + 'Open</a>'
            : u.listingUrl && /^https:\/\//.test(u.listingUrl) ? '<a href="' + esc(u.listingUrl) + '" target="_blank" rel="noopener">' + I('arrow') + 'Elliman</a>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  JP.units = { of: of, houses: houses, html: html };
})(typeof window !== 'undefined' ? window : globalThis);
