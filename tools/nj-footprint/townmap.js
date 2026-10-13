/* NJ Footprint — the town-by-town map on the back page. Draws Monmouth and Ocean by
   municipality (nj-towns.js), shades each town by how many sales it has, and names every town
   with a sale in one column beside the map, joined by a leader line. Neighbouring
   counties are drawn in grey for context; a sale there is shaded and named the same way.
   Returns an SVG string; the page supplies the numbers from NJFootprint.byTown(). */
(function (root) {
  'use strict';

  // Sales-per-town bands, lightest to darkest: each starts at `from` sales.
  const SHADES = [{ from: 1, c: '#BCE8F0' }, { from: 2, c: '#53C7DC' }, { from: 4, c: '#00A1C4' }, { from: 8, c: '#00273A' }];
  const shade = n => SHADES.filter(b => n >= b.from).pop().c;
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
    const GL = 46, GR = 236;                            // inland margin, and the label column out at sea
    const W = T.width;
    const hit = new Map(sales.map(s => [s.town, s]));
    const monmouth = T.towns.filter(t => t.county === 'Monmouth').map(t => yRange(t.d));
    let top = Math.min.apply(null, monmouth.map(r => r[0]));
    let bottom = Math.max.apply(null, monmouth.map(r => r[1]));
    sales.forEach(s => { const r = yRange(s.town.d); top = Math.min(top, r[0]); bottom = Math.max(bottom, r[1]); });
    top -= 26;
    const x0 = -GL, vw = W + GL + GR;
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

    // Every town is named in one column out in the Atlantic, in north-to-south order. Each leader
    // runs level from its town to the coast, then slants to its label, so no two leaders cross.
    // The rows tighten (and the type shrinks with them) as the list grows.
    const list = sales.map(s => ({ s, want: s.town.c[1] }));
    const gap = Math.min(23, (vh - 32) / Math.max(1, list.length)), size = Math.min(12.5, gap * .62);
    spread(list, gap, top + 16, bottom - 16);
    const col = W + 92, coast = W + 8;
    const callouts = '<g style="font-size:' + size.toFixed(1) + 'px">' + list.map(it => {
      const t = it.s.town, [cx, cy] = t.c;
      return '<path class="ld" d="M' + cx + ' ' + cy + 'L' + coast + ' ' + cy + 'L' + (col - 8) + ' ' + it.y + 'L' + col + ' ' + it.y + '"/>' +
        '<circle class="dt" cx="' + cx + '" cy="' + cy + '" r="3.4"/>' +
        '<text class="lb" x="' + (col + 5) + '" y="' + it.y + '"><tspan class="ln">' + it.s.deals + '</tspan>' +
        '<tspan dx="' + (size * .6).toFixed(1) + '">' + esc(t.name) + '</tspan></text>';
    }).join('') + '</g>';

    // Locator: all of New Jersey, bottom left over the inland grey, with the two home counties in navy.
    const lw = 112, ls = lw / counties.width, lh = counties.height * ls;
    const lx = x0 + 10, ly = bottom - lh - 14;
    const locator = '<rect class="lbg" x="' + (lx - 8) + '" y="' + (ly - 24) + '" width="' + (lw + 16) + '" height="' + (lh + 32) + '" rx="3"/>' +
      '<g transform="translate(' + lx + ' ' + ly + ') scale(' + ls + ')">' +
      counties.counties.map(c => '<path d="' + c.d + '" fill="' + (T.core.indexOf(c.name) !== -1 ? '#00273A' : '#E7E4DC') + '"/>').join('') +
      '</g><text class="lc" x="' + (lx + lw / 2) + '" y="' + (ly - 9) + '">NEW JERSEY</text>';

    // "Atlantic Ocean" goes in the widest gap in the label column, or below it.
    const ys = list.map(it => it.y).concat([bottom]);
    let seaY = (top + ys[0]) / 2, room = ys[0] - top;
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > room) { room = ys[i] - ys[i - 1]; seaY = (ys[i] + ys[i - 1]) / 2; }
    const sea = room > 40 ? '<text class="sea" x="' + (col + 64) + '" y="' + seaY + '">Atlantic Ocean</text>' : '';

    return '<svg class="townmap" viewBox="' + x0 + ' ' + top + ' ' + vw + ' ' + vh + '" preserveAspectRatio="xMidYMid meet" role="img" ' +
      'aria-label="Map of Monmouth and Ocean county towns, shaded by number of sales">' +
      '<defs><clipPath id="tmclip"><rect x="' + x0 + '" y="' + top + '" width="' + (W + GL + 30) + '" height="' + vh + '"/></clipPath>' +
      '<linearGradient id="tmfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>' +
      '<g clip-path="url(#tmclip)">' + fills + lines + '</g>' +
      (bottom < T.height ? '<rect x="' + x0 + '" y="' + (bottom - 50) + '" width="' + vw + '" height="50" fill="url(#tmfade)"/>' : '') +
      cname + sea + callouts + locator + '</svg>';
  }

  /* The "Towns" version: both counties whole, every town outlined and filled with its county's
     colour, no labels (the page lists the towns beside the map). colours: { county: '#hex' }. */
  function countySvg(T, colours, counties) {
    const GL = 40, GR = 40, W = T.width, top = -14, vh = T.height + 28;
    const fills = T.towns.map(t => {
      const c = colours[t.county], core = T.core.indexOf(t.county) !== -1;
      return '<path class="tn' + (core ? '' : ' nb') + '" d="' + t.d + '" fill="' + (c || '#F3F1EC') + '"><title>' +
        esc(t.full + ', ' + t.county + ' County') + '</title></path>';
    }).join('');
    const lines = T.core.map(c => '<path class="co" d="' + T.outlines[c] + '"/>').join('');
    const lw = 96, ls = lw / counties.width, lh = counties.height * ls, lx = -GL + 8, ly = T.height - lh - 6;
    const locator = '<rect class="lbg" x="' + (lx - 7) + '" y="' + (ly - 22) + '" width="' + (lw + 14) + '" height="' + (lh + 28) + '" rx="3"/>' +
      '<g transform="translate(' + lx + ' ' + ly + ') scale(' + ls + ')">' +
      counties.counties.map(c => '<path d="' + c.d + '" fill="' + (T.core.indexOf(c.name) !== -1 ? '#00273A' : '#E7E4DC') + '"/>').join('') +
      '</g><text class="lc" x="' + (lx + lw / 2) + '" y="' + (ly - 8) + '">NEW JERSEY</text>';
    return '<svg class="townmap" viewBox="' + (-GL) + ' ' + top + ' ' + (W + GL + GR) + ' ' + vh + '" preserveAspectRatio="xMidYMid meet" role="img" ' +
      'aria-label="Map of the towns of Monmouth and Ocean counties">' +
      '<defs><clipPath id="amclip"><rect x="' + (-GL) + '" y="' + top + '" width="' + (W + GL + GR) + '" height="' + vh + '"/></clipPath></defs>' +
      '<g clip-path="url(#amclip)">' + fills + lines + '</g>' + locator + '</svg>';
  }

  root.NJTownMap = { svg, countySvg, SHADES };
})(window);
