/* NJ Footprint — the town-by-town map on the back page. Draws Monmouth and Ocean by
   municipality (nj-towns.js), shades each town by how many sales it has, and names every town
   with a sale in a column either side of the map, joined by a leader line. Neighbouring
   counties are drawn in grey for context; a sale there is shaded and named the same way.
   Returns an SVG string; the page supplies the numbers from NJFootprint.byTown(). */
(function (root) {
  'use strict';

  const SHADES = ['#BCE8F0', '#53C7DC', '#00A1C4', '#00273A'];   // 1, 2, 3, 4+ sales
  const shade = n => SHADES[Math.min(n, SHADES.length) - 1];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // The y extent of an SVG path made of M/L/Z commands with absolute "x,y" pairs.
  function yRange(d) {
    let lo = Infinity, hi = -Infinity;
    d.replace(/-?[\d.]+,(-?[\d.]+)/g, (m, y) => { y = +y; if (y < lo) lo = y; if (y > hi) hi = y; return m; });
    return [lo, hi];
  }

  // Spread labels so none overlap: keep each as near its town as it can get, inside [top, bottom].
  function spread(items, gap, top, bottom) {
    items.sort((a, b) => a.want - b.want);
    items.forEach((it, i) => { it.y = Math.max(it.want, i ? items[i - 1].y + gap : top); });
    for (let i = items.length - 1; i >= 0; i--) {
      const max = i === items.length - 1 ? bottom : items[i + 1].y - gap;
      if (items[i].y > max) items[i].y = max;
    }
  }

  /* T: NJ_TOWNS. sales: byTown().list. counties: NJ_COUNTIES (for the locator inset).
     aspect: height / width of the box the map fills. The view always holds all of Monmouth and
     every town with a sale, then runs on south through Ocean until it fills the box. */
  function svg(T, sales, counties, aspect) {
    const G = 168;                                       // label gutter each side, map units
    const W = T.width, gap = 23;
    const hit = new Map(sales.map(s => [s.town, s]));
    const monmouth = T.towns.filter(t => t.county === 'Monmouth').map(t => yRange(t.d));
    let top = Math.min.apply(null, monmouth.map(r => r[0]));
    let bottom = Math.max.apply(null, monmouth.map(r => r[1]));
    sales.forEach(s => { const r = yRange(s.town.d); top = Math.min(top, r[0]); bottom = Math.max(bottom, r[1]); });
    top -= 26;
    const x0 = -G, vw = W + 2 * G;
    bottom = Math.min(T.height, Math.max(bottom + 40, top + vw * (aspect || 0)));
    const vh = bottom - top;

    const core = t => T.core.indexOf(t.county) !== -1;
    const fills = T.towns.map(t => {
      const s = hit.get(t);
      const fill = s ? shade(s.deals) : core(t) ? '#E7E4DC' : '#F3F1EC';
      return '<path class="tn' + (core(t) ? '' : ' nb') + '" d="' + t.d + '" fill="' + fill + '"><title>' +
        esc(t.full + ', ' + t.county + ' County') + (s ? ' — ' + s.deals + ' sale' + (s.deals === 1 ? '' : 's') : '') + '</title></path>';
    }).join('');
    const lines = T.core.map(c => '<path class="co" d="' + T.outlines[c] + '"/>').join('');

    // County names sit in the roomiest town without a sale, if it is in view.
    const cname = T.core.map(c => {
      const t = T.towns.filter(k => k.county === c && !hit.has(k) && k.c[1] > top + 30 && k.c[1] < bottom - 30)
        .sort((a, b) => b.r - a.r)[0];
      return t ? '<text class="cn" x="' + t.c[0] + '" y="' + t.c[1] + '">' + esc(c.toUpperCase()) + '</text>' : '';
    }).join('');

    // Callouts: towns east of the split are named in the Atlantic, the rest inland.
    const split = W * .66;
    const sides = { w: [], e: [] };
    sales.forEach(s => sides[s.town.c[0] >= split ? 'e' : 'w'].push({ s, want: s.town.c[1] }));
    const callouts = ['w', 'e'].map(k => {
      const list = sides[k], east = k === 'e';
      spread(list, gap, top + 16, bottom - 16);
      const col = east ? W + 14 : -14;
      return list.map(it => {
        const t = it.s.town, [cx, cy] = t.c, knee = east ? col - 18 : col + 18;
        const n = '<tspan class="ln">' + it.s.deals + '</tspan>', nm = '<tspan class="lt">' + esc(t.name) + '</tspan>';
        return '<path class="ld" d="M' + cx + ' ' + cy + 'L' + knee + ' ' + it.y + 'L' + col + ' ' + it.y + '"/>' +
          '<circle class="dt" cx="' + cx + '" cy="' + cy + '" r="3.4"/>' +
          '<text class="lb" x="' + (east ? col + 5 : col - 5) + '" y="' + it.y + '" text-anchor="' + (east ? 'start' : 'end') + '" xml:space="preserve">' +
          (east ? n + '  ' + nm : nm + '  ' + n) + '</text>';
      }).join('');
    }).join('');

    // Locator: all of New Jersey, bottom right, with the two home counties in navy.
    const lw = 118, ls = lw / counties.width, lh = counties.height * ls;
    const lx = W + G - lw - 6, ly = bottom - lh - 8;
    const locator = '<g class="loc" transform="translate(' + lx + ' ' + ly + ') scale(' + ls + ')">' +
      counties.counties.map(c => '<path d="' + c.d + '" fill="' + (T.core.indexOf(c.name) !== -1 ? '#00273A' : '#E7E4DC') + '"/>').join('') +
      '</g><text class="lc" x="' + (lx + lw / 2) + '" y="' + (ly - 8) + '">NEW JERSEY</text>';

    // "Atlantic Ocean" goes in the widest gap between the seaward labels (or below the last).
    const ys = sides.e.map(it => it.y).concat([ly - 30]);
    let seaY = ys[0] / 2 + top / 2, room = ys[0] - top;
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > room) { room = ys[i] - ys[i - 1]; seaY = (ys[i] + ys[i - 1]) / 2; }
    const sea = '<text class="sea" x="' + (W + G / 2 + 10) + '" y="' + seaY + '">Atlantic Ocean</text>';

    return '<svg class="townmap" viewBox="' + x0 + ' ' + top + ' ' + vw + ' ' + vh + '" preserveAspectRatio="xMidYMid meet" role="img" ' +
      'aria-label="Map of Monmouth and Ocean county towns, shaded by number of sales">' +
      '<defs><clipPath id="tmclip"><rect x="' + (-G + 4) + '" y="' + top + '" width="' + (W + 2 * G - 8) + '" height="' + vh + '"/></clipPath>' +
      '<linearGradient id="tmfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>' +
      '<g clip-path="url(#tmclip)">' + fills + lines + '</g>' +
      (bottom < T.height ? '<rect x="' + x0 + '" y="' + (bottom - 50) + '" width="' + vw + '" height="50" fill="url(#tmfade)"/>' : '') +
      cname + sea + callouts + locator + '</svg>';
  }

  root.NJTownMap = { svg, SHADES };
})(window);
