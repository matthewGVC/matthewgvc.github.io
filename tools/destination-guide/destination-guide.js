/* Destination Guide Builder - state, editor wiring and page renderers. */
(function () {
  'use strict';

  const DATA = window.GVC_DESTINATION_GUIDES;
  const TOWNS = (window.GVC_NJ_TOWNS && window.GVC_NJ_TOWNS.list) || [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const state = {
    region: DATA.defaultRegion,
    guide: clone(DATA.regions[DATA.defaultRegion]),
    showFavorites: true,
    objectUrls: []
  };

  const pageDefs = [
    { key: 'cover', title: 'Cover', render: pageCover },
    { key: 'welcome', title: 'From The GVC Team', heading: () => state.guide.welcomeTitle, render: pageWelcome },
    { key: 'overview', title: 'Field Notes', heading: () => 'What to expect', render: pageOverview },
    { key: 'places', title: 'Places', heading: () => 'Nine ways into the county', render: pagePlaces },
    { key: 'bucket', title: 'Do This First', heading: () => 'The local short list', render: pageBucket },
    { key: 'directory', title: 'Directory', heading: () => state.guide.pois.length + ' points of interest', render: pageDirectory },
    { key: 'map', title: 'Map', heading: () => state.guide.map.title, render: pageMap },
    { key: 'favorites', title: 'Team Favorites', optional: true, heading: () => 'The places we return to', render: pageFavorites },
    { key: 'back', title: 'Back', render: pageBack }
  ];

  let pages = activePages();
  let builder = null;

  function activePages() {
    return pageDefs.filter(page => page.key !== 'favorites' || state.showFavorites);
  }

  function touch() {
    if (window.GVC_UNSAVED) window.GVC_UNSAVED.touch();
  }

  function sourceLabel(key) {
    const source = state.guide.sources[key];
    return source ? source.label : key;
  }

  function pageTop(section) {
    return '<div class="dg-top"><span class="name">' + esc(section) + '</span>' +
      '<span class="region">' + esc(state.guide.title) + ' / ' + esc(state.guide.state) + '</span></div>';
  }

  function pageFoot(n, total, reverse) {
    return '<div class="dg-foot"><span>Destination Guide</span>' +
      '<span class="page-no">' + String(n).padStart(2, '0') + ' / ' + String(total).padStart(2, '0') + '</span></div>';
  }

  /* `review` marks the heading for the agent-review highlight; an empty title
     leaves the heading out (the map page gives its room to the map). */
  function shell(section, title, body, n, total, cls, review) {
    return '<article class="dg ' + (cls || '') + '"><div class="dg-shell">' + pageTop(section) +
      (title ? '<h2 class="dg-heading' + (review ? ' review' : '') + '">' + esc(title) + '</h2>' : '') + body + pageFoot(n, total) + '</div></article>';
  }

  /* One small line icon per directory group (24 x 24, drawn in currentColor). */
  const CAT_ICONS = {
    restaurants: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1.5-3 4-3 7v3h3v8M17 3v18"/>',
    grocery: '<path d="M3 4h2l2.4 11h10l2-8H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    shopping: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    fitness: '<path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/>',
    coffee: '<path d="M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8z"/><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M8 3v2M12 3v2"/>',
    outdoors: '<path d="M12 3l5 7h-3l4 6H6l4-6H7l5-7z"/><path d="M12 16v5"/>',
    transit: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l2-4M15 21l-2-4"/><circle cx="9.5" cy="14" r=".8"/><circle cx="14.5" cy="14" r=".8"/>',
    healthcare: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    entertainment: '<path d="M3 8a2 2 0 0 1 0 0V6h18v2a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2H3v-2a2 2 0 0 0 0-4v0a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>'
  };
  const catIcon = id => CAT_ICONS[id]
    ? '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CAT_ICONS[id] + '</svg>' : '';

  /* A captioned photograph that takes whatever height its page leaves. */
  function pagePhoto(key) {
    const photo = (state.guide.photos || {})[key];
    if (!photo) return '';
    return '<figure class="dg-photo"><div class="frame"><img src="' + esc(photo.src) + '" alt="' + esc(photo.alt) + '"' +
      (photo.pos ? ' style="object-position:' + esc(photo.pos) + '"' : '') + '></div>' +
      '<figcaption class="dg-caption">' + esc(photo.caption) + '</figcaption></figure>';
  }
  /* The cover panel is 2.35in of type wide; a long county name at 40pt runs out
     of it (Monmouth already touched the edge). Step the size down by the
     longest word so any region fits. */
  function coverTitleSize(title) {
    const longest = Math.max.apply(null, String(title).split(/\s+/).map(w => w.length));
    return longest >= 10 ? ' xs' : longest >= 8 ? ' sm' : '';
  }

  function pageCover(n, total) {
    const g = state.guide;
    /* what is inside, with the page each part starts on */
    const contents = pages.filter(page => page.heading).map(page =>
      '<li><span class="p">' + String(pages.findIndex(item => item.key === page.key) + 1).padStart(2, '0') + '</span><span class="t">' + esc(page.title) +
      '</span><span class="d">' + esc(page.heading()) + '</span></li>').join('');
    return '<article class="dg dg-cover">' +
      '<div class="cover-photo"><img src="' + esc(g.coverImage) + '" alt="' + esc(g.coverAlt) + '">' +
      '<img class="cover-mono' + (g.coverMono === 'dark' ? ' dark' : '') + '" src="../../assets/logos/' + (g.coverMono === 'dark' ? 'monogram' : 'monogram-white') + '.svg" alt=""></div>' +
      '<div class="cover-panel"><div class="cover-issue">' + esc(g.issue) + '</div>' +
      '<h2 class="cover-title' + coverTitleSize(g.title) + '">' + esc(g.title) + '</h2><div class="cover-state">' + esc(g.state) + '</div>' +
      '<p class="cover-sub">' + esc(g.subtitle) + '</p>' +
      '<ol class="cover-contents review" aria-label="Inside the guide">' + contents + '</ol></div>' +
      '<div class="cover-word">GVC Destination ' + String(n).padStart(2, '0') + '</div></article>';
  }

  function pageWelcome(n, total) {
    const g = state.guide;
    const body = '<div class="welcome-grid"><section class="welcome-copy"><p class="lede">' + esc(g.welcomeTitle) + '</p>' +
      '<div class="body">' + g.welcome.map((p, i) => '<p' + (i === 1 ? ' class="review"' : '') + '>' + esc(p) + '</p>').join('') + '</div>' +
      '<div class="welcome-signoff">The GVC Team / Douglas Elliman</div></section>' +
      '<figure class="welcome-visual"><div class="welcome-photo"><img src="' + esc(g.welcomeImage) + '" alt="' + esc(g.welcomeAlt) + '"></div></figure></div>';
    return shell('From The GVC Team', 'Welcome', body, n, total, 'dg-welcome');
  }

  function pageOverview(n, total) {
    const o = state.guide.overview;
    const body = '<p class="field-lede">' + esc(state.guide.subtitle) + '</p>' +
      '<div class="field-columns">' +
      '<section class="field-note"><h3>What it is known for</h3><p>' + esc(o.knownFor) + '</p></section>' +
      '<section class="field-note"><h3>History</h3><p>' + esc(o.history) + '</p></section>' +
      '<section class="field-note"><h3>Architecture</h3><p>' + esc(o.architecture) + '</p></section></div>' + pagePhoto('field') +
      '<div class="field-cite dg-source">Research: ' + o.sourceKeys.map(sourceLabel).map(esc).join(' / ') + '</div>';
    return shell('Field Notes', 'What to expect', body, n, total, 'dg-overview');
  }

  function pagePlaces(n, total) {
    const body = '<div class="place-rule" aria-hidden="true"></div><div class="place-index">' +
      state.guide.places.map(place => {
        const town = TOWNS.find(item => item.name === place.name);
        const text = town && town.tag ? town.tag : place.fallback;
        return '<section class="place"><div class="place-head"><h3>' + esc(place.name) + '</h3><span class="zone">' + esc(place.zone) +
          '</span></div><p>' + esc(text) + '</p></section>';
      }).join('') + '</div>' + pagePhoto('places');
    return shell('Places', 'Nine ways into the county', body, n, total, 'dg-places', true);
  }

  function pageBucket(n, total) {
    const body = '<p class="bucket-lede review">The fastest way to understand ' + esc(state.guide.title) + ' is to do ' + state.guide.bucket.length + ' ordinary things well: ' + esc(state.guide.bucketLede) + '.</p>' +
      '<div class="bucket-list">' + state.guide.bucket.map(item => '<section class="bucket"><div class="n"></div><div><h3>' +
        esc(item.title) + '</h3><p>' + esc(item.note) + '</p><div class="src">' + esc(sourceLabel(item.source)) + '</div></div>' +
        /* a picture or logo an agent adds; an empty slot shows on screen only */
        '<div class="bucket-pic' + (item.image ? '' : ' empty') + '">' + (item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<span>Logo<br>or photo</span>') + '</div></section>').join('') + '</div>';
    return shell('Do This First', 'The local short list', body, n, total, 'dg-bucket', true);
  }

  function pageDirectory(n, total) {
    const groups = state.guide.categories.map(category => ({
      category,
      items: state.guide.pois.filter(poi => poi.category === category.id)
    })).filter(group => group.items.length);
    const body = '<div class="dir-grid">' + groups.map(group => '<section class="dir-group cat-' + group.category.id + '"><h3>' + esc(group.category.label) + catIcon(group.category.id) + '</h3><ol>' +
        group.items.map(poi => '<li><span class="pin">' + String(poi.id).padStart(2, '0') + '</span><div><b>' + esc(poi.name) +
          '</b><span>' + esc(poi.place) + ' - ' + esc(poi.note) + '</span></div></li>').join('') + '</ol></section>').join('') + '</div>';
    return shell('Directory', 'Points of interest', body, n, total, 'dg-directory');
  }

  /* The schematic map. Pins are laid out by plain equirectangular projection
     (longitude scaled by the cosine of the region's middle latitude so shapes
     are not stretched), fitted to the frame, then nudged apart where they would
     overlap. Each region's water is drawn from real shoreline points in its
     `map` data (polygons may run far past the frame; the SVG clips them), so
     the water sits where it really is; everything inland is blank on purpose.
     It orients; it does not measure. */
  /* Fit a lat/lon box into a W x H frame (equirectangular, longitude scaled by
     the cosine of the middle latitude), centred, with `pad` kept clear. */
  function fitBounds(minLat, maxLat, minLon, maxLon, W, H, pad) {
    const k = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
    const scale = Math.min((W - 2 * pad) / ((maxLon - minLon) * k), (H - 2 * pad) / (maxLat - minLat));
    const w = (maxLon - minLon) * k * scale, h = (maxLat - minLat) * scale;
    const ox = (W - w) / 2, oy = (H - h) / 2;
    return {
      minLat, maxLat, minLon, maxLon,
      x: lon => ox + (lon - minLon) * k * scale,
      y: lat => oy + (maxLat - lat) * scale
    };
  }

  function mapFrame(W, H) {
    const pois = state.guide.pois, extra = state.guide.map.bounds || [];
    const lats = pois.map(p => p.lat).concat(extra.map(p => p[0]));
    const lons = pois.map(p => p.lon).concat(extra.map(p => p[1]));
    return fitBounds(Math.min.apply(null, lats), Math.max.apply(null, lats), Math.min.apply(null, lons), Math.max.apply(null, lons), W, H, 34);
  }

  /* Pins for a list of points of interest, nudged apart where they would
     overlap. Each keeps its true spot (tx, ty) for a leader line. */
  function placePins(list, f, W, H, gap) {
    const pts = list.map(poi => ({ poi, x: f.x(poi.lon), y: f.y(poi.lat) }));
    pts.forEach(p => { p.tx = p.x; p.ty = p.y; });
    for (let pass = 0; pass < 90; pass++) {
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d >= gap) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const push = (gap - d) / 2;
        pts[i].x -= dx / d * push; pts[i].y -= dy / d * push;
        pts[j].x += dx / d * push; pts[j].y += dy / d * push;
      }
    }
    pts.forEach(p => { p.x = Math.max(14, Math.min(W - 14, p.x)); p.y = Math.max(14, Math.min(H - 14, p.y)); });
    return pts;
  }

  /* Water labels sit in a frame corner, or at a lat/lon when the water is
     not at an edge (a bay between the mainland and the barrier islands). */
  function mapLabel(label, f, W, H) {
    const at = {
      tl: [20, 28, 'start'], tr: [W - 22, 28, 'end'],
      bl: [20, H - 40, 'start'], br: [W - 22, H - 40, 'end']
    }[label.corner] || [f.x(label.lon), f.y(label.lat), label.anchor || 'middle'];
    return '<text class="map-label" x="' + at[0].toFixed(1) + '" y="' + at[1].toFixed(1) + '" text-anchor="' + at[2] + '"' +
      (label.rotate ? ' transform="rotate(' + label.rotate + ' ' + at[0].toFixed(1) + ' ' + at[1].toFixed(1) + ')"' : '') + '>' + esc(label.text) + '</text>';
  }

  /* Optional layers a region can add to its map data (all drawn from real
     geometry, all optional, so a region that has none renders as before):
       land     [[lat, lon], ...] land polygons from the coastline; water is the rest of
                the frame (use instead of water/coasts)
       county   the county outline [[lat, lon], ...]; tints the land inside it
       boundaries  town outlines [[[lat, lon], ...], ...] drawn as fine dotted lines
       parks    [{ name, pts }] green park polygons
       rivers   [[lat, lon], ...] lines drawn as a channel
       rail     [{ n, lines: [...] }] railway lines
       roads    [{ k: 'motorway' | 'highway' | 'minor', n, lines: [...] }]
       roadLabels  [{ text, lat, lon, rot, rail }] set along the lines
       towns    [{ name, lat, lon, major, dx, dy }] place names; dx/dy set a
                name beside a crowd of pins with a hairline to the true spot;
                water: true sets the name in white for a label on the sea
       compass  'tl' | 'tr' | 'bl' | 'br'
       grid     true for the graticule and its degree ticks
       credit   one line of data credit for the map note
       insets   [{ title, bounds: [[lat, lon], [lat, lon]], at: { x, y, w, h },
                  towns, parkLabels }] zoomed panels for crowded cores (`inset`
                  takes a single one); the pins inside a panel's bounds are
                  numbered there and shown as dots on the main map */
  function mapScene(cfg, f, W, H) {
    const P = pts => pts.map(p => f.x(p[1]).toFixed(1) + ' ' + f.y(p[0]).toFixed(1)).join(' L');
    const path = (cls, pts, close) => '<path class="' + cls + '" d="M' + P(pts) + (close ? ' Z' : '') + '"></path>';
    const lines = (cls, list) => list.map(l => path(cls, l)).join('');
    const under = [], over = [], above = [];
    if (cfg.grid) {
      const lats = [], lons = [];
      for (let v = Math.ceil(f.minLat * 20) / 20; v <= f.maxLat; v += 0.05) lats.push(+v.toFixed(2));
      for (let v = Math.ceil(f.minLon * 10) / 10; v <= f.maxLon; v += 0.1) lons.push(+v.toFixed(1));
      under.push(lats.map(v => '<path class="map-grid" d="M0 ' + f.y(v).toFixed(1) + ' H' + W + '"></path>').join('') +
        lons.map(v => '<path class="map-grid" d="M' + f.x(v).toFixed(1) + ' 0 V' + H + '"></path>').join(''));
      over.push(lats.map(v => '<text class="map-tick" x="6" y="' + (f.y(v) - 3).toFixed(1) + '">' + v.toFixed(2) + '°N</text>').join('') +
        lons.map(v => '<text class="map-tick" x="' + (f.x(v) + 4).toFixed(1) + '" y="' + (H - 6) + '">' + Math.abs(v).toFixed(1) + '°W</text>').join(''));
    }
    if (cfg.county) under.push(path('map-county', cfg.county, true));
    if (cfg.boundaries) under.push(lines('map-town-border', cfg.boundaries));
    if (cfg.parks) under.push(cfg.parks.map(p => path('map-park', p.pts, true)).join(''));
    let water = cfg.water.map(poly => path('map-water', poly, true)).join('');
    let coast = cfg.coasts.map(pts => path('map-coast-glow', pts) + path('map-coast', pts)).join('');
    if (cfg.land) {
      /* water is the whole frame; the land shape goes over it, and the land layers
         (grid, county tint, town borders, parks) are clipped to the land */
      const id = 'dg-land-' + (mapScene.seq = (mapScene.seq || 0) + 1);
      const shape = cfg.land.map(r => 'M' + P(r) + ' Z').join(' ');
      const layers = under.splice(0, under.length).join('');
      water = '<rect class="map-water" x="-60" y="-60" width="' + (W + 120) + '" height="' + (H + 120) + '"></rect>' +
        '<path class="map-land" d="' + shape + '"></path>' +
        '<clipPath id="' + id + '"><path d="' + shape + '"></path></clipPath><g clip-path="url(#' + id + ')">' + layers + '</g>';
      coast = '<path class="map-coast-glow is-fine" d="' + shape + '"></path><path class="map-coast is-fine" d="' + shape + '"></path>';
    }
    (cfg.rivers || []).forEach(r => { above.push(path('map-river-edge', r), path('map-river', r)); });
    (cfg.rail || []).forEach(r => { above.push(lines('map-rail-bed', r.lines), lines('map-rail', r.lines)); });
    (cfg.roads || []).forEach(r => { above.push(lines('map-road-case map-road-' + r.k, r.lines), lines('map-road map-road-' + r.k, r.lines)); });
    (cfg.roadLabels || []).forEach(l => {
      const x = f.x(l.lon).toFixed(1), y = f.y(l.lat).toFixed(1);
      above.push('<text class="map-road-label' + (l.rail ? ' is-rail' : '') + '" x="' + x + '" y="' + y + '" transform="rotate(' + l.rot + ' ' + x + ' ' + y + ')" dy="-3" text-anchor="middle">' + esc(l.text) + '</text>');
    });
    if (cfg.parkLabels) {
      const seen = {};
      (cfg.parks || []).forEach(p => {
        if (seen[p.name]) return;
        const la = p.pts.map(q => q[0]), lo = p.pts.map(q => q[1]);
        const lat = (Math.min.apply(null, la) + Math.max.apply(null, la)) / 2, lon = (Math.min.apply(null, lo) + Math.max.apply(null, lo)) / 2;
        if (lat < f.minLat || lat > f.maxLat || lon < f.minLon || lon > f.maxLon) return;
        seen[p.name] = 1;
        above.push('<text class="map-park-label" x="' + f.x(lon).toFixed(1) + '" y="' + f.y(lat).toFixed(1) + '" text-anchor="middle">' + esc(p.name) + '</text>');
      });
    }
    /* A town name that would sit under a cluster of pins is set beside it (dx, dy
       in frame units) with a hairline back to the town's true centre. */
    (cfg.towns || []).forEach(t => {
      const cx = f.x(t.lon), cy = f.y(t.lat), x = cx + (t.dx || 0), y = cy + (t.dy || 0);
      if (t.dx || t.dy) above.push('<path class="map-town-leader" d="M' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' L' + x.toFixed(1) + ' ' + (y - 4).toFixed(1) + '"></path><circle class="map-dot" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="1.8"></circle>');
      above.push('<text class="map-town' + (t.major ? ' is-major' : '') + (t.water ? ' on-water' : '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + (t.anchor || 'middle') + '">' + esc(t.name) + '</text>');
    });
    if (cfg.compass) {
      const [cx, cy] = { tl: [46, 58], tr: [W - 46, 58], bl: [46, H - 64], br: [W - 46, H - 64] }[cfg.compass] || [46, 58];
      above.push('<g class="map-compass" transform="translate(' + cx + ' ' + cy + ')"><circle r="19"></circle><circle class="in" r="14"></circle>' +
        '<path class="n" d="M0 -17 L5 3 L0 -1 L-5 3 Z"></path><path class="s" d="M0 17 L5 -3 L0 1 L-5 -3 Z"></path><text y="-23">N</text></g>');
    }
    const labels = (cfg.labels || []).map(label => mapLabel(label, f, W, H)).join('');
    return under.join('') + water + coast + over.join('') + above.join('') + labels;
  }

  const pinMarkup = p => '<g class="map-pin cat-' + p.poi.category + '" transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')">' +
    '<circle class="halo" r="10.5"></circle><circle r="8.5"></circle><text y="1">' + p.poi.id + '</text></g>';
  /* a pin nudged clear of its neighbours keeps a leader back to the true spot */
  const leaderMarkup = p => Math.hypot(p.x - p.tx, p.y - p.ty) > 13
    ? '<path class="map-leader" d="M' + p.tx.toFixed(1) + ' ' + p.ty.toFixed(1) + ' L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + '"></path>' +
      '<circle class="map-dot" cx="' + p.tx.toFixed(1) + '" cy="' + p.ty.toFixed(1) + '" r="2"></circle>' : '';

  function pageMap(n, total) {
    /* A region longer than it is wide (Ocean County's coast) gets a portrait
       frame with the key beside it rather than below. */
    const m = state.guide.map, W = m.tall ? 380 : 650, H = m.tall ? 820 : 490, f = mapFrame(W, H);
    const pois = state.guide.pois;
    let scene = mapScene(m, f, W, H), pinned = pois, insetSvg = '', insetBox = '';

    /* zoomed panels for crowded cores: each takes the pins inside its bounds */
    (m.insets || (m.inset ? [m.inset] : [])).forEach(ins => {
      const a = ins.at, b = ins.bounds;
      const inBox = poi => poi.lat <= b[0][0] && poi.lat >= b[1][0] && poi.lon >= b[0][1] && poi.lon <= b[1][1];
      const inside = pinned.filter(inBox);
      pinned = pinned.filter(poi => !inBox(poi));
      const g = fitBounds(b[1][0], b[0][0], b[0][1], b[1][1], a.w, a.h, 12);
      const cfg = Object.assign({}, m, { towns: ins.towns || [], roadLabels: ins.roadLabels || [], compass: null, grid: false, labels: [], parkLabels: ins.parkLabels });
      const ip = placePins(inside, g, a.w, a.h, 18);
      insetSvg += '<svg class="map-inset" x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" viewBox="0 0 ' + a.w + ' ' + a.h + '">' +
        '<rect class="map-inset-bg" width="' + a.w + '" height="' + a.h + '"></rect>' + mapScene(cfg, g, a.w, a.h) +
        ip.map(leaderMarkup).join('') + ip.map(pinMarkup).join('') + '</svg>' +
        '<rect class="map-inset-edge" x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '"></rect>' +
        '<text class="map-inset-title" x="' + (a.x + 7) + '" y="' + (a.y + a.h - 8) + '">' + esc(ins.title) + '</text>';
      /* the zoomed area, boxed on the main map and tied to the panel */
      const x0 = f.x(b[0][1]), x1 = f.x(b[1][1]), y0 = f.y(b[0][0]), y1 = f.y(b[1][0]);
      const side = x1 < a.x ? [a.x, a.x] : [a.x + a.w, a.x + a.w];
      const fromX = x1 < a.x ? x1 : x0;
      insetBox += '<path class="map-inset-link" d="M' + fromX.toFixed(1) + ' ' + y0.toFixed(1) + ' L' + side[0] + ' ' + a.y + ' M' + fromX.toFixed(1) + ' ' + y1.toFixed(1) + ' L' + side[1] + ' ' + (a.y + a.h) + '"></path>' +
        '<rect class="map-inset-box" x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (x1 - x0).toFixed(1) + '" height="' + (y1 - y0).toFixed(1) + '"></rect>';
      /* the pins inside the box are numbered in the panel; here they are dots */
      insetBox += inside.map(poi => '<circle class="map-pin-dot cat-' + poi.category + '" cx="' + f.x(poi.lon).toFixed(1) + '" cy="' + f.y(poi.lat).toFixed(1) + '" r="2.6"></circle>').join('');
    });

    const placed = placePins(pinned, f, W, H, 18);
    const legend = state.guide.categories.map(category => {
      const items = pois.filter(poi => poi.category === category.id);
      return items.length ? '<section class="cat-' + category.id + '"><h3>' + esc(category.label) + catIcon(category.id) + '</h3><ol>' + items.map(poi =>
        '<li><span class="n">' + String(poi.id).padStart(2, '0') + '</span>' + esc(poi.name) + '</li>').join('') + '</ol></section>' : '';
    }).join('');
    const note = 'Schematic orientation / not to scale' + (m.credit ? '<br>' + esc(m.credit) : '');
    const body = '<div class="map-layout"><div class="map-frame" role="img" aria-label="Schematic map of the guide points of interest">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      scene + insetBox + placed.map(leaderMarkup).join('') + placed.map(pinMarkup).join('') + insetSvg + '</svg>' +
      '<div class="map-note">' + note + '</div></div>' +
      '<aside class="map-legend" aria-label="Map key">' + legend + '</aside></div>';
    return shell('Map', '', body, n, total, 'dg-map' + (m.tall ? ' map-tall' : ''));
  }

  function pageFavorites(n, total) {
    const favorites = state.guide.favorites.filter(item => item.pick.trim());
    const body = '<div class="favorite-intro"><div class="mark">G</div><p class="review">Personal recommendations belong to the people who know the area. Replace these starter picks with names and notes from the team before distribution.</p></div>' +
      '<div class="favorite-grid">' + favorites.map(item => '<section class="favorite"><div class="who">' + esc(item.person) + '</div><h3>' +
        esc(item.pick) + '</h3><div class="loc">' + esc(item.location) + '</div><p class="note">' + esc(item.note) + '</p></section>').join('') + '</div>' +
      pagePhoto('favorites');
    return shell('Team Favorites', 'The places we return to', body, n, total, 'dg-favorites');
  }

  function pageBack(n, total) {
    const sourceNames = Object.values(state.guide.sources).map(source => source.label).join(' / ');
    return '<article class="dg dg-back"><div class="back-photo"><img src="' + esc(state.guide.teamImage) + '" alt=""></div>' +
      '<div class="back-main"><img class="back-logo" src="../../assets/logos/sheet/lockup-sky.svg" alt="The Gasdaska Verdiglione Conlon Team">' +
      '<h2>Ready to find your place in ' + esc(state.guide.title) + '?</h2><div class="line"></div>' +
      '<div class="contact"><p>Whether you are buying or selling, you get a team that knows the ground, gives disciplined advice and works as one.</p>' +
      '<div class="site">gvcrealestateteam.com<br>@gvcrealestateteam</div></div>' +
      '<div class="back-sources">' + esc(state.guide.sourceNote) + (state.guide.photoCredits ? '<br>Photos: ' + esc(state.guide.photoCredits) : '') + '<br>Research set: ' + Object.keys(state.guide.sources).length + ' linked sources - ' + esc(state.guide.sourceSummary || sourceNames) + '.</div></div></article>';
  }

  function redraw() {
    pages = activePages();
    if (!builder) return;
    if (builder.state.pages !== pages.length) builder.setPages(pages.length);
    else builder.rebuild();
    document.getElementById('pageStatus').textContent = pages.length + ' pages';
    setTimeout(checkOverflow, 20);
  }

  function checkOverflow() {
    const bad = Array.from(document.querySelectorAll('.dg')).filter(page => page.scrollHeight > page.clientHeight + 2);
    const warning = document.getElementById('warnGeneral');
    warning.hidden = bad.length === 0;
    warning.textContent = bad.length ? bad.length + ' guide page' + (bad.length === 1 ? '' : 's') + ' overflow. Shorten the edited copy before printing.' : '';
  }

  const fills = [];

  function bindText(id, read, write, transform) {
    const input = document.getElementById(id);
    const fill = () => { input.value = transform ? transform(read()) : read(); };
    fills.push(fill);
    fill();
    input.addEventListener('input', () => {
      write(transform ? transform(input.value) : input.value);
      redraw(); touch();
    });
  }

  function bindImage(inputId, nameId, key) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      state.objectUrls.push(url);
      state.guide[key] = url;
      document.getElementById(nameId).textContent = file.name;
      redraw(); touch();
    });
  }

  function buildRegionPicker() {
    const host = document.getElementById('regionPick');
    host.innerHTML = Object.values(DATA.regions).map(region => '<button type="button" data-region="' + esc(region.id) +
      '" aria-pressed="false">' + esc(region.label) + '</button>').join('');
    host.addEventListener('click', event => {
      const button = event.target.closest('[data-region]');
      if (button && button.dataset.region !== state.region) switchRegion(button.dataset.region);
    });
    markRegion();
  }

  function markRegion() {
    document.querySelectorAll('#regionPick [data-region]').forEach(button => {
      const on = button.dataset.region === state.region;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    });
  }

  /* A new region starts from its own data: edited copy, favorites and any
     session images belong to the region they were made for. */
  function switchRegion(id) {
    state.region = id;
    state.guide = clone(DATA.regions[id]);
    markRegion();
    fills.forEach(fill => fill());
    buildSources();
    buildFavoriteFields();
    document.getElementById('coverName').textContent = 'Starter regional image';
    document.getElementById('welcomeName').textContent = 'Starter regional image';
    document.getElementById('teamName').textContent = 'Starter shore photograph';
    ['coverFile', 'welcomeFile', 'teamFile'].forEach(inputId => { document.getElementById(inputId).value = ''; });
    buildBucketFields();
    redraw(); touch();
  }

  function buildSources() {
    document.getElementById('sourceNote').textContent = state.guide.sourceNote;
    document.getElementById('sourceList').innerHTML = Object.values(state.guide.sources).map(source =>
      '<li><a href="' + esc(source.url) + '" target="_blank" rel="noreferrer">' + esc(source.label) + '</a></li>').join('');
  }

  function buildFavoriteFields() {
    const host = document.getElementById('favoriteFields');
    host.innerHTML = state.guide.favorites.map((item, index) => '<section class="favorite-editor" data-favorite="' + index + '">' +
      '<div class="fav-num">Pick ' + String(index + 1).padStart(2, '0') + '</div>' +
      '<div class="f-row"><div class="field"><label>Person</label><input type="text" data-key="person" value="' + esc(item.person) + '"></div>' +
      '<div class="field"><label>Location</label><input type="text" data-key="location" value="' + esc(item.location) + '"></div></div>' +
      '<div class="field"><label>Pick</label><input type="text" data-key="pick" value="' + esc(item.pick) + '"></div>' +
      '<div class="field"><label>Note</label><textarea rows="3" data-key="note">' + esc(item.note) + '</textarea></div></section>').join('');
  }

  /* One upload per short-list item, for the logo or photo beside it. */
  function buildBucketFields() {
    const host = document.getElementById('bucketFields');
    host.innerHTML = state.guide.bucket.map((item, index) => '<div class="bucket-editor" data-bucket="' + index + '">' +
      '<span class="b-num">' + String(index + 1).padStart(2, '0') + '</span><span class="b-title">' + esc(item.title) + '</span>' +
      '<label class="btn sm ghost upload-btn" for="bucketFile' + index + '">' + (item.image ? 'Replace' : 'Add') + '</label>' +
      '<input id="bucketFile' + index + '" type="file" accept="image/*" hidden>' +
      (item.image ? '<button class="btn sm ghost" type="button" data-clear="' + index + '">Remove</button>' : '') + '</div>').join('');
  }

  function watchBucketFields() {
    const host = document.getElementById('bucketFields');
    host.addEventListener('change', event => {
      const row = event.target.closest('[data-bucket]');
      const file = event.target.files && event.target.files[0];
      if (!row || !file) return;
      const url = URL.createObjectURL(file);
      state.objectUrls.push(url);
      state.guide.bucket[Number(row.dataset.bucket)].image = url;
      buildBucketFields(); redraw(); touch();
    });
    host.addEventListener('click', event => {
      const clear = event.target.closest('[data-clear]');
      if (!clear) return;
      delete state.guide.bucket[Number(clear.dataset.clear)].image;
      buildBucketFields(); redraw(); touch();
    });
  }

  function watchFavoriteFields() {
    document.getElementById('favoriteFields').addEventListener('input', event => {
      const field = event.target.closest('[data-key]');
      const section = event.target.closest('[data-favorite]');
      if (!field || !section) return;
      state.guide.favorites[Number(section.dataset.favorite)][field.dataset.key] = field.value;
      redraw(); touch();
    });
  }

  function downloadData() {
    const payload = clone(state.guide);
    if (String(payload.coverImage).startsWith('blob:')) payload.coverImage = '[session cover image]';
    if (String(payload.teamImage).startsWith('blob:')) payload.teamImage = '[session team image]';
    if (String(payload.welcomeImage).startsWith('blob:')) payload.welcomeImage = '[session welcome image]';
    payload.bucket.forEach(item => { if (String(item.image || '').startsWith('blob:')) item.image = '[session picture]'; });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = state.guide.id + '-destination-guide.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildRegionPicker();
    buildSources();
    buildFavoriteFields();
    watchFavoriteFields();

    bindText('guideTitle', () => state.guide.title, value => { state.guide.title = value; });
    bindText('guideSubtitle', () => state.guide.subtitle, value => { state.guide.subtitle = value; });
    bindText('guideIssue', () => state.guide.issue, value => { state.guide.issue = value; });
    bindText('welcomeTitle', () => state.guide.welcomeTitle, value => { state.guide.welcomeTitle = value; });
    bindText('welcomeCopy', () => state.guide.welcome.join('\n\n'), value => {
      state.guide.welcome = value.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
    });
    bindImage('coverFile', 'coverName', 'coverImage');
    bindImage('welcomeFile', 'welcomeName', 'welcomeImage');
    bindImage('teamFile', 'teamName', 'teamImage');
    buildBucketFields();
    watchBucketFields();

    /* Orange marks the copy agents should look over; the client copy turns it off. */
    const review = document.getElementById('showReview');
    const applyReview = () => document.body.classList.toggle('review-on', review.checked);
    review.addEventListener('change', applyReview);
    applyReview();

    document.getElementById('showFavorites').addEventListener('change', event => {
      state.showFavorites = event.target.checked;
      redraw(); touch();
    });
    document.getElementById('downloadData').addEventListener('click', downloadData);

    if (window.GVC_UNSAVED) window.GVC_UNSAVED.watch();
    window.addEventListener('beforeunload', () => state.objectUrls.forEach(url => URL.revokeObjectURL(url)));

    builder = window.Builder.init({
      pages: pages.length,
      label: 'Guide page',
      printName: () => state.guide.title + ' Destination Guide',
      render: (page, index) => {
        const def = pages[index];
        page.innerHTML = def.render(index + 1, pages.length);
        page.dataset.key = def.key;
      }
    });

    document.getElementById('pageStatus').textContent = pages.length + ' pages';
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(checkOverflow, 20));
    setTimeout(checkOverflow, 50);
  });
})();
