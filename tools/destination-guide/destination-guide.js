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
    { key: 'contents', title: 'Contents', render: pageContents },
    { key: 'welcome', title: 'From The GVC Team', render: pageWelcome },
    { key: 'overview', title: 'Field Notes', render: pageOverview },
    { key: 'places', title: 'Places', render: pagePlaces },
    { key: 'bucket', title: 'Do This First', render: pageBucket },
    { key: 'directory', title: 'Directory', render: pageDirectory },
    { key: 'map', title: 'Map', render: pageMap },
    { key: 'favorites', title: 'Team Favorites', optional: true, render: pageFavorites },
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
    return '<div class="dg-foot"><span>The GVC Team / Destination Guide</span>' +
      '<span class="page-no">' + String(n).padStart(2, '0') + ' / ' + String(total).padStart(2, '0') + '</span></div>';
  }

  function shell(section, title, body, n, total, cls) {
    return '<article class="dg ' + (cls || '') + '"><div class="dg-shell">' + pageTop(section) +
      '<h2 class="dg-heading">' + esc(title) + '</h2>' + body + pageFoot(n, total) + '</div></article>';
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
    return '<article class="dg dg-cover">' +
      '<div class="cover-photo"><img src="' + esc(g.coverImage) + '" alt="' + esc(g.coverAlt) + '"></div>' +
      '<div class="cover-panel"><div class="cover-issue">' + esc(g.issue) + '</div>' +
      '<h2 class="cover-title' + coverTitleSize(g.title) + '">' + esc(g.title) + '</h2><div class="cover-state">' + esc(g.state) + '</div>' +
      '<p class="cover-sub">' + esc(g.subtitle) + '</p></div>' +
      '<div class="cover-word">GVC Destination ' + String(n).padStart(2, '0') + '</div></article>';
  }

  function pageContents(n, total) {
    const items = pages.filter(page => page.key !== 'cover' && page.key !== 'back');
    return '<article class="dg dg-contents"><div class="contents-grid">' +
      '<section class="contents-intro"><div class="roman">I</div><h2>Inside the guide</h2>' +
      '<p>One region, read through its communities, landscape, culture and useful connections.</p></section>' +
      '<section class="contents-list"><div class="issue">' + esc(state.guide.issue) + '</div><ol>' +
      items.map(page => {
        const index = pages.findIndex(item => item.key === page.key) + 1;
        return '<li><span class="n">' + String(index).padStart(2, '0') + '</span><span class="t">' + esc(page.title) +
          '</span><span class="p">' + String(index + 1).padStart(2, '0') + '</span></li>';
      }).join('') + '</ol><p class="note">Prepared as a practical orientation, not a ranking. Seasonal access and schedules should be checked before a visit.</p>' +
      '</section></div></article>';
  }

  function pageWelcome(n, total) {
    const g = state.guide;
    const body = '<div class="welcome-grid"><section class="welcome-copy"><p class="lede">' + esc(g.welcomeTitle) + '</p>' +
      '<div class="body">' + g.welcome.map(p => '<p>' + esc(p) + '</p>').join('') + '</div>' +
      '<div class="welcome-signoff">The GVC Team / Douglas Elliman</div></section>' +
      '<figure class="welcome-visual"><div class="welcome-photo"><img src="' + esc(g.teamImage) + '" alt="' + esc(g.teamAlt) + '"></div>' +
      '<figcaption class="welcome-caption">Local context, clear guidance, and a team perspective across New York, New Jersey and Florida.</figcaption></figure></div>';
    return shell('From The GVC Team', 'Welcome', body, n, total, 'dg-welcome');
  }

  function pageOverview(n, total) {
    const o = state.guide.overview;
    const body = '<div class="field-lede"><div class="big">NJ</div><p>' + esc(state.guide.subtitle) + '</p></div>' +
      '<div class="field-columns">' +
      '<section class="field-note"><h3>What it is known for</h3><p>' + esc(o.knownFor) + '</p></section>' +
      '<section class="field-note"><h3>History</h3><p>' + esc(o.history) + '</p></section>' +
      '<section class="field-note"><h3>Architecture</h3><p>' + esc(o.architecture) + '</p></section></div>' +
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
      }).join('') + '</div>';
    return shell('Places', 'Nine ways into the county', body, n, total, 'dg-places');
  }

  function pageBucket(n, total) {
    const body = '<p class="bucket-lede">The fastest way to understand ' + esc(state.guide.title) + ' is to do ' + state.guide.bucket.length + ' ordinary things well: ' + esc(state.guide.bucketLede) + '.</p>' +
      '<div class="bucket-list">' + state.guide.bucket.map(item => '<section class="bucket"><div class="n"></div><div><h3>' +
        esc(item.title) + '</h3><p>' + esc(item.note) + '</p><div class="src">' + esc(sourceLabel(item.source)) + '</div></div></section>').join('') + '</div>';
    return shell('Do This First', 'The local short list', body, n, total, 'dg-bucket');
  }

  function pageDirectory(n, total) {
    const groups = state.guide.categories.map(category => ({
      category,
      items: state.guide.pois.filter(poi => poi.category === category.id)
    })).filter(group => group.items.length);
    const body = '<div class="directory-lede"><p>' + state.guide.pois.length + ' places, numbered to match the map on the next page. Each one links to its own site or a maintained source in the guide data.</p></div>' +
      '<div class="dir-grid">' + groups.map(group => '<section class="dir-group"><h3>' + esc(group.category.label) + '</h3><ol>' +
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
  function mapFrame(W, H) {
    const pois = state.guide.pois, extra = state.guide.map.bounds || [];
    const lats = pois.map(p => p.lat).concat(extra.map(p => p[0]));
    const lons = pois.map(p => p.lon).concat(extra.map(p => p[1]));
    const minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    const minLon = Math.min.apply(null, lons), maxLon = Math.max.apply(null, lons);
    const k = Math.cos((minLat + maxLat) / 2 * Math.PI / 180), pad = 34;
    const scale = Math.min((W - 2 * pad) / ((maxLon - minLon) * k), (H - 2 * pad) / (maxLat - minLat));
    const w = (maxLon - minLon) * k * scale, h = (maxLat - minLat) * scale;
    const ox = (W - w) / 2, oy = (H - h) / 2;
    return {
      x: lon => ox + (lon - minLon) * k * scale,
      y: lat => oy + (maxLat - lat) * scale
    };
  }

  function projectedPois(W, H) {
    const f = mapFrame(W, H);
    const pts = state.guide.pois.map(poi => ({ poi, x: f.x(poi.lon), y: f.y(poi.lat) }));
    /* push apart anything closer than a pin diameter; a few passes settle it */
    const gap = 21;
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

  function pageMap(n, total) {
    /* A region longer than it is wide (Ocean County's coast) gets a portrait
       frame with the key beside it rather than below. */
    const m = state.guide.map, W = m.tall ? 380 : 650, H = m.tall ? 820 : 490, f = mapFrame(W, H);
    const line = pts => pts.map(p => f.x(p[1]).toFixed(1) + ' ' + f.y(p[0]).toFixed(1)).join(' L');
    const water = m.water.map(poly => '<path class="map-water" d="M' + line(poly) + ' Z"></path>').join('');
    const coast = m.coasts.map(pts => '<path class="map-coast" d="M' + line(pts) + '"></path>').join('');
    const pins = projectedPois(W, H).map(point => '<g class="map-pin" transform="translate(' + point.x.toFixed(1) + ' ' + point.y.toFixed(1) + ')">' +
      '<circle r="10"></circle><text y="1">' + point.poi.id + '</text></g>').join('');
    const legend = state.guide.categories.map(category => {
      const items = state.guide.pois.filter(poi => poi.category === category.id);
      return items.length ? '<section><h3>' + esc(category.label) + '</h3><ol>' + items.map(poi =>
        '<li><span class="n">' + String(poi.id).padStart(2, '0') + '</span>' + esc(poi.name) + '</li>').join('') + '</ol></section>' : '';
    }).join('');
    const body = '<div class="map-layout"><div class="map-frame" role="img" aria-label="Schematic map of the guide points of interest">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      water + coast + m.labels.map(label => mapLabel(label, f, W, H)).join('') + pins + '</svg>' +
      '<div class="map-note">Schematic orientation / not to scale</div></div>' +
      '<aside class="map-legend" aria-label="Map key">' + legend + '</aside></div>';
    return shell('Map', m.title, body, n, total, 'dg-map' + (m.tall ? ' map-tall' : ''));
  }

  function pageFavorites(n, total) {
    const favorites = state.guide.favorites.filter(item => item.pick.trim());
    const body = '<div class="favorite-intro"><div class="mark">G</div><p>Personal recommendations belong to the people who know the area. Replace these starter picks with names and notes from the team before distribution.</p></div>' +
      '<div class="favorite-grid">' + favorites.map(item => '<section class="favorite"><div class="who">' + esc(item.person) + '</div><h3>' +
        esc(item.pick) + '</h3><div class="loc">' + esc(item.location) + '</div><p class="note">' + esc(item.note) + '</p></section>').join('') + '</div>';
    return shell('Team Favorites', 'The places we return to', body, n, total, 'dg-favorites');
  }

  function pageBack(n, total) {
    const sourceNames = Object.values(state.guide.sources).map(source => source.label).join(' / ');
    return '<article class="dg dg-back"><div class="back-photo"><img src="' + esc(state.guide.teamImage) + '" alt=""></div>' +
      '<div class="back-main"><div class="back-lock">The GVC Team / Douglas Elliman</div>' +
      '<h2>Ready to find your place in ' + esc(state.guide.title) + '?</h2><div class="line"></div>' +
      '<div class="contact"><p>We help buyers and sellers move with local context, disciplined advice and a connected team.</p>' +
      '<div class="site">gvcrealestateteam.com<br>@gvcrealestateteam</div></div>' +
      '<div class="back-sources">' + esc(state.guide.sourceNote) + '<br>Research set: ' + Object.keys(state.guide.sources).length + ' linked sources - ' + esc(state.guide.sourceSummary || sourceNames) + '.</div></div></article>';
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
    document.getElementById('teamName').textContent = 'GVC founders photograph';
    ['coverFile', 'teamFile'].forEach(inputId => { document.getElementById(inputId).value = ''; });
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
    bindImage('teamFile', 'teamName', 'teamImage');

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
