/* ============================================================
   JOB PAGE: a development's units, as Elliman lists them (overhaul 7b).

     GVC_JP.units.of(deRows, slug)  → the development's units: Elliman listings at its
                                      street (GVC_DEV_ADDRESSES), for sale first, then by unit
     GVC_JP.units.html(ctx)         → the Units card ('' when Elliman lists none)

   Elliman's site is the source (Matt, 11-03): Casa Avenida and Le Reve list
   their units there one by one. The page reads them from de_listings, which
   the helper's daily Elliman read keeps; nothing here is typed by hand.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var WORD = { Active: 'For sale', Pending: 'In contract', 'Under Contract': 'In contract', Sold: 'Sold', Closed: 'Sold' };
  var ORDER = { 'For sale': 0, 'In contract': 1, Sold: 2 };

  function of(rows, slug) {
    var D = global.GVC_DEV_ADDRESSES, A = global.GVC_ADDR, streets = D && D.of ? D.of(slug) : [];
    if (!streets.length || !A) return [];
    return (rows || []).map(function (r) { return Object.assign({ id: r.de_listing_id }, r.raw || {}); })
      .filter(function (u) { return u.street && streets.some(function (s) { return A.sameStreet(u.street, s); }); })
      .map(function (u) { u.word = WORD[u.status] || u.status || ''; return u; })
      .sort(function (a, b) {
        var o = (ORDER[a.word] == null ? 3 : ORDER[a.word]) - (ORDER[b.word] == null ? 3 : ORDER[b.word]);
        return o || String(a.unit || '').localeCompare(String(b.unit || ''), undefined, { numeric: true });
      });
  }

  function money(n) { return n ? '$' + Number(n).toLocaleString('en-US') : ''; }

  function html(ctx) {
    var esc = ctx.esc, I = ctx.I, units = ctx.units || [];
    if (!units.length) return '';
    var count = {}; units.forEach(function (u) { count[u.word] = (count[u.word] || 0) + 1; });
    var line = Object.keys(count).sort(function (a, b) { return (ORDER[a] == null ? 3 : ORDER[a]) - (ORDER[b] == null ? 3 : ORDER[b]); })
      .map(function (w) { return count[w] + ' ' + w.toLowerCase(); }).join(' · ');
    return '<div class="card" id="unitsCard"><div class="card-h"><div><h2>Units</h2><p>' + esc(line) + '. As listed on Elliman, read each morning.</p></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Unit</th><th>Beds / baths</th><th class="r">Size</th><th class="r">Price</th><th>Status</th><th></th></tr></thead><tbody>' +
      units.map(function (u) {
        var baths = (u.baths || 0) + (u.halfBaths ? ' + ' + u.halfBaths + ' half' : '');
        return '<tr><td><b>' + esc(u.unit || '—') + '</b></td><td>' + esc((u.beds != null ? u.beds + ' bd' : '') + (u.baths != null ? ' / ' + baths + ' ba' : '')) + '</td>' +
          '<td class="r">' + esc(u.sqft ? Number(u.sqft).toLocaleString('en-US') + ' sq ft' : '') + '</td>' +
          '<td class="r">' + esc(money(u.word === 'Sold' && u.closePrice ? u.closePrice : u.price)) + '</td><td>' + esc(u.word) + '</td>' +
          '<td>' + (u.listingUrl && /^https:\/\//.test(u.listingUrl) ? '<a href="' + esc(u.listingUrl) + '" target="_blank" rel="noopener">' + I('arrow') + 'Elliman</a>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  JP.units = { of: of, html: html };
})(typeof window !== 'undefined' ? window : globalThis);
