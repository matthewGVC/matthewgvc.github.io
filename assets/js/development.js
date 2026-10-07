/* ============================================================
   NEW DEVELOPMENT — the printed Private Preview, drawn from one document.
   Styles: assets/css/development.css. Used by tools/new-development/.

   A document is plain data (see tools/new-development/seed.js for the shape):
   the header copy, the developer, and one record per home. Everything a
   buyer reads comes from it; the only words written here are the page's own
   furniture (section names, field labels, "continued"). The counts and the
   timeline are worked out from each home's status and completion date, so
   they cannot disagree with the homes listed after them.

   pages(doc, urlFor, measure) returns one HTML string per Letter page. The
   body is a run of blocks (homes in pairs, single homes, subdivisions, the
   next step) laid onto pages by measuring them on an unscaled page off
   screen, so more homes means another page rather than an overflow.
   ============================================================ */
(function (global) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* "Q3-Q4 2027" sets with a range dash; the document keeps what was typed */
  const range = s => esc(s).replace(/(Q\d)\s*-\s*(Q\d)/g, '$1–$2');
  const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const word = n => WORDS[n] || String(n);
  const homesWord = n => n === 1 ? 'home' : 'homes';
  const GVC_LOCKUP = '../../assets/logos/sheet/lockup-navy.svg';

  const STAGES = [
    { key: 'construction', name: 'Under construction' },
    { key: 'planned',      name: 'Yet to break ground' }
  ];
  const stageOf = h => h.status === 'construction' ? 'construction' : 'planned';
  const stageName = key => (STAGES.find(s => s.key === key) || STAGES[1]).name;

  /* Homes with a site are subdivisions, shown side by side under one
     heading (their pictures small, under it); the rest are feature homes
     with a large picture. */
  function organise(doc) {
    const homes = (doc.homes || []).filter(h => h && (h.address || h.price));
    const features = homes.filter(h => !h.site);
    const sites = [];
    homes.filter(h => h.site).forEach(h => {
      let s = sites.find(x => x.name === h.site);
      if (!s) sites.push(s = { name: h.site, homes: [] });
      s.homes.push(h);
    });
    return { homes, features, sites };
  }

  function factRows(h) {
    const rows = [];
    if (h.done) rows.push(['Estimated completion', range(h.done)]);
    if (h.plans) rows.push(['Plans', esc(h.plans)]);
    if (h.beds || h.baths) rows.push(['Beds / baths', esc(h.beds || '–') + ' / ' + esc(h.baths || '–')]);
    if (h.living) rows.push([/sq/.test(h.basement || '') ? 'Living + basement' : 'Living',
      esc(h.living) + (h.basement ? ' + ' + esc(h.basement) : '')]);
    if (h.garage) rows.push(['Garage', esc(h.garage)]);
    return rows;
  }
  function facts(h) {
    const rows = factRows(h);
    return rows.length ? '<dl class="dv-facts">' + rows.map(([k, v]) =>
      '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>' : '';
  }

  function homeText(h) {
    return '<div class="dv-home">' +
      '<p class="dv-stage s-' + stageOf(h) + '">' + stageName(stageOf(h)) + '</p>' +
      '<h3>' + esc(h.address) + '</h3>' +
      (h.town ? '<p class="dv-town">' + esc(h.town) + '</p>' : '') +
      (h.price ? '<p class="dv-price"><span class="dv-ask">Asking</span>' + esc(h.price) + '</p>' : '') +
      facts(h) +
      (h.note ? '<p class="dv-note">' + esc(h.note) + '</p>' : '') +
    '</div>';
  }

  function pic(h, urlFor) {
    const url = h.image ? urlFor(h.image) : '';
    if (!url) return '';
    return '<figure class="dv-pic"><img src="' + esc(url) + '" alt="Rendering of ' + esc(h.address) + '">' +
      (h.imageNote ? '<figcaption>' + esc(h.imageNote) + '</figcaption>' : '') + '</figure>';
  }

  /* A subdivision: a heading line for the site (a note every home on it
     shares is said once, beside it), then one tile per home. */
  function siteInner(s, urlFor) {
    const town = (s.homes.find(h => h.town) || {}).town;
    const unitName = h => (h.address || '').replace(s.name, '').replace(/^\s*[-–,]\s*/, '') || h.address;
    const meta = (town ? esc(town) + ', ' : '') + s.homes.length + '-home subdivision';
    const notes = s.homes.map(h => h.note || '');
    const shared = notes.every(n => n && n === notes[0]) ? notes[0] : '';
    return '<div class="dv-site-h"><div><h3>' + esc(s.name) + '</h3><p class="dv-site-meta">' + meta + '</p></div>' +
        (shared ? '<p class="dv-note">' + esc(shared) + '</p>' : '') + '</div>' +
      '<div class="dv-pair">' + s.homes.map(h => {
        const rows = factRows(h);
        return '<section class="dv-unit"><p class="dv-tag">' + esc(unitName(h)) + '</p>' + pic(h, urlFor) +
          (h.price ? '<p class="dv-price">' + esc(h.price) + '</p>' : '') +
          (rows.length ? '<dl class="dv-ufacts">' + rows.map(([k, v]) =>
            '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>' : '') +
          (!shared && h.note ? '<p class="dv-note">' + esc(h.note) + '</p>' : '') +
        '</section>';
      }).join('') + '</div>';
  }

  /* The timeline: one stop per completion date in the order the homes are
     listed, then one stop for every home with no date yet, each under the
     stage it belongs to. Subdivision homes collapse to their site. */
  function timeline(o) {
    const stops = [];
    o.homes.forEach(h => {
      const status = stageOf(h), when = h.done || '';
      let s = stops.find(x => x.when === when && x.status === status);
      if (!s) stops.push(s = { when, status, homes: [] });
      s.homes.push(h);
    });
    stops.sort((a, b) => (a.when ? 0 : 1) - (b.when ? 0 : 1));
    const bands = STAGES.map(st => {
      const mine = stops.filter(s => s.status === st.key);
      if (!mine.length) return '';
      const n = o.homes.filter(h => stageOf(h) === st.key).length;
      return '<div class="dv-band b-' + st.key + '" style="--stops:' + mine.length + '">' +
        (st.key === 'construction'
          ? '<p class="dv-band-h"><b>' + st.name + '</b><span>' + n + ' ' + homesWord(n) + '</span></p>'
          : '<p class="dv-band-h" aria-hidden="true">&nbsp;</p>') +
        '<ol class="dv-stops">' + mine.map(s =>
          '<li><span class="dv-dot">' + s.homes.length + '</span>' +
            '<p class="dv-when">' + (s.when ? range(s.when) : 'Timing not yet set') + '</p></li>').join('') + '</ol></div>';
    }).join('');
    return '<section class="dv-line"><p class="dv-total"><b>' + o.homes.length + '</b> ' +
      homesWord(o.homes.length) + ' in the pipeline</p><div class="dv-track">' + bands + '</div></section>';
  }

  /* ---------- the page furniture ---------- */
  function mast(doc, urlFor) {
    const dev = doc.developer || {};
    const logo = dev.logo ? urlFor(dev.logo) : '';
    return '<header class="dv-mast">' +
      (logo ? '<img class="dev-logo" src="' + esc(logo) + '" alt="' + esc(dev.name) + '">'
            : '<span class="dev-name">' + esc(dev.name) + '</span>') +
      '<p class="dv-kick">' + esc(doc.kicker) + '</p>' +
      '<img class="gvc" src="' + GVC_LOCKUP + '" alt="The Gasdaska Verdiglione Conlon Team">' +
    '</header>';
  }
  const creditParts = doc => ['Development by ' + esc((doc.developer || {}).name), 'Sales &amp; Marketing by ' + esc(doc.marketing)];

  function head(doc, urlFor, o, first) {
    if (!first) return mast(doc, urlFor);
    return mast(doc, urlFor) +
      '<div class="dv-title"><h1>' + esc(doc.title) + '</h1>' +
      '</div>' +
      (o.homes.length ? timeline(o) : '');
  }
  const foot = (doc, n, of) => '<footer class="dv-foot"><div>' +
    '<p>' + creditParts(doc).join('  |  ') + '</p>' +
    (doc.disclaimer ? '<p class="dv-disc">' + esc(doc.disclaimer) + '</p>' : '') +
    '</div><span class="dv-pn">' + n + ' of ' + of + '</span></footer>';

  /* ---------- the body, as blocks ---------- */
  function blocks(doc, urlFor, o) {
    const out = [];
    o.features.forEach((h, i) => {
      const p = pic(h, urlFor);
      out.push('<article class="dv-blk dv-wide' + (p ? '' : ' nopic') + (i % 2 ? ' flip' : '') + '">' + p + homeText(h) + '</article>');
    });
    o.sites.forEach((s, i) => {
      out.push(i === 0
        ? '<div class="dv-blk"><div class="dv-sites-h"><h2>' + word(o.sites.length) +
            ' new subdivision' + (o.sites.length === 1 ? '' : 's') + '</h2>' +
            (doc.subdivisionsIntro ? '<p>' + esc(doc.subdivisionsIntro) + '</p>' : '') + '</div>' +
            '<div class="dv-site">' + siteInner(s, urlFor) + '</div></div>'
        : '<div class="dv-blk dv-site">' + siteInner(s, urlFor) + '</div>');
    });
    if (doc.nextStep) out.push('<section class="dv-blk dv-next"><h2>Next step</h2><p>' + esc(doc.nextStep) + '</p></section>');
    return out;
  }

  /* Lay the blocks onto pages. `measure` is an unscaled 8.5 x 11in element
     off screen with this stylesheet applied. A block taller than a whole
     page still gets a page of its own; the tool's overflow check flags it. */
  function pages(doc, urlFor, measure) {
    const o = organise(doc);
    const shell = (first, body, n, of) =>
      '<div class="dv">' + head(doc, urlFor, o, first) + '<div class="dv-body">' + body + '</div>' + foot(doc, n, of) + '</div>';
    if (!o.homes.length) return [shell(true,
      '<p class="dv-empty">Add the development’s homes in the panel on the left.</p>', 1, 1)];

    const bl = blocks(doc, urlFor, o);
    const runs = [[]];
    const fits = (first, list) => {
      measure.innerHTML = shell(first, list.join(''), 9, 9);
      const body = measure.querySelector('.dv-body');
      return body.scrollHeight <= body.clientHeight + 1;
    };
    bl.forEach(b => {
      const run = runs[runs.length - 1];
      if (!run.length || fits(runs.length === 1, run.concat(b))) run.push(b);
      else runs.push([b]);
    });
    measure.innerHTML = '';
    return runs.map((run, i) => shell(i === 0, run.join(''), i + 1, runs.length));
  }

  global.GVC_DEV = { pages, organise, STAGES };
})(window);
