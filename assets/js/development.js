/* ============================================================
   NEW-DEVELOPMENT PAGE — the shared template.

   A development's page is a folder under projects/ holding index.html (a
   mount point), data.js (window.GVC_DEVELOPMENT) and img/. This file turns
   the data into the page, so a new development is a data change, never a
   redesign. Styles: assets/css/development.css (screen and print).

   Everything a buyer reads comes from data.js. The only words written here
   are the page's own furniture: section names, field labels, button text.
   The counts and the timeline are worked out from each home's status and
   completion date, so they cannot disagree with the homes listed below them.
   ============================================================ */
(function () {
  'use strict';
  const D = window.GVC_DEVELOPMENT;
  const root = document.getElementById('dev');
  if (!D || !root) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* "Q3-Q4 2027" sets with a proper range dash; the data keeps the source's hyphen */
  const range = s => esc(s).replace(/(Q\d)-(Q\d)/g, '$1–$2');
  const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const word = n => WORDS[n] || String(n);
  const homesWord = n => n === 1 ? 'home' : 'homes';

  const STAGES = [
    { key: 'construction', name: 'Under construction' },
    { key: 'planned',      name: 'Yet to break ground' }
  ];
  const homes = D.homes;
  const of = key => homes.filter(h => h.status === key);

  /* homes with a site are subdivisions; the rest are shown one to a spread */
  const features = homes.filter(h => !h.site);
  const sites = [];
  homes.filter(h => h.site).forEach(h => {
    let s = sites.find(x => x.name === h.site);
    if (!s) sites.push(s = { name: h.site, homes: [] });
    s.homes.push(h);
  });

  /* ---------- pieces ---------- */
  const img = (base, alt, sizes, eager) =>
    '<img src="img/' + esc(base) + '-1200.webp" srcset="img/' + esc(base) + '-1200.webp 1200w, img/' +
      esc(base) + '-2400.webp 2400w" sizes="' + sizes + '" alt="' + esc(alt) + '"' +
      (eager ? ' fetchpriority="high"' : '') + ' decoding="async">';

  const stageName = h => (STAGES.find(s => s.key === h.status) || {}).name || '';

  function facts(h) {
    const rows = [];
    if (h.done) rows.push(['Estimated completion', range(h.done)]);
    if (h.plans) rows.push(['Plans', esc(h.plans)]);
    if (h.beds || h.baths) rows.push(['Beds / baths', esc(h.beds) + ' / ' + esc(h.baths)]);
    if (h.living) rows.push([h.basement && /sq/.test(h.basement) ? 'Living + basement' : 'Living',
      esc(h.living) + (h.basement ? ' + ' + esc(h.basement) : '')]);
    if (h.garage) rows.push(['Garage', esc(h.garage)]);
    return '<dl class="facts">' + rows.map(([k, v]) =>
      '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>';
  }

  function feature(h, i) {
    const pic = h.image
      ? '<figure class="sp-pic">' + img(h.image, 'Rendering of ' + h.address, '(min-width: 960px) 58vw, 100vw') +
          '<figcaption>' + esc(h.imageNote) + '</figcaption></figure>'
      : '';
    return '<article class="spread' + (i % 2 ? ' flip' : '') + (pic ? '' : ' nopic') + '" id="' + esc(h.id) + '">' + pic +
      '<div class="sp-txt">' +
        '<p class="stage s-' + esc(h.status) + '">' + stageName(h) + '</p>' +
        '<h3>' + esc(h.address) + '</h3>' +
        (h.town ? '<p class="town">' + esc(h.town) + '</p>' : '') +
        '<p class="price"><span>Asking</span>' + esc(h.price) + '</p>' +
        facts(h) +
        (h.note ? '<p class="note">' + esc(h.note) + '</p>' : '') +
      '</div></article>';
  }

  /* A subdivision: one heading for the site, the homes side by side. A note
     every home on the site shares is said once, under the heading. */
  function site(s) {
    const notes = s.homes.map(h => h.note || '');
    const shared = notes.every(n => n && n === notes[0]) ? notes[0] : '';
    const town = s.homes[0].town;
    return '<article class="site">' +
      '<header><h3>' + esc(s.name) + '</h3>' +
        '<p class="site-meta">' + (town ? esc(town) + ', ' : '') + s.homes.length + '-home subdivision</p>' +
        (shared ? '<p class="note">' + esc(shared) + '</p>' : '') +
      '</header>' +
      '<div class="pair">' + s.homes.map(h => {
        const name = h.address.replace(s.name, '').replace(/^\s*[-–]\s*/, '') || h.address;
        return '<section class="unit" id="' + esc(h.id) + '">' +
          '<h4>' + esc(name) + '</h4>' +
          '<p class="price">' + esc(h.price) + '</p>' + facts(h) +
          (!shared && h.note ? '<p class="note">' + esc(h.note) + '</p>' : '') +
        '</section>';
      }).join('') + '</div></article>';
  }

  /* The timeline: one stop per completion date, in the order the homes are
     listed, then one stop for every home with no date yet. Grouped under the
     stage each stop belongs to. */
  function timeline() {
    const stops = [];
    homes.forEach(h => {
      const when = h.done || '';
      let s = stops.find(x => x.when === when && x.status === h.status);
      if (!s) stops.push(s = { when, status: h.status, homes: [] });
      s.homes.push(h);
    });
    stops.sort((a, b) => (a.when ? 0 : 1) - (b.when ? 0 : 1));
    const short = h => h.site ? h.site : h.address;
    const bands = STAGES.map(st => {
      const mine = stops.filter(s => s.status === st.key);
      if (!mine.length) return '';
      const n = of(st.key).length;
      return '<div class="band b-' + st.key + '" style="--stops:' + mine.length + '">' +
        '<p class="band-h"><b>' + st.name + '</b><span>' + n + ' ' + homesWord(n) + '</span></p>' +
        '<ol class="stops">' + mine.map(s => {
          /* subdivision homes collapse to their site, with a count */
          const seen = [];
          s.homes.forEach(h => {
            const k = short(h), e = seen.find(x => x.k === k);
            if (e) e.n++; else seen.push({ k, n: 1, id: h.id });
          });
          return '<li><span class="dot" aria-hidden="true"></span>' +
            '<p class="when">' + (s.when ? range(s.when) : 'Timing not yet set') + '</p>' +
            '<ul>' + seen.map(x => '<li><a href="#' + esc(x.id) + '">' + esc(x.k) + '</a>' +
              (x.n > 1 ? '<span class="x">' + x.n + ' homes</span>' : '') + '</li>').join('') + '</ul></li>';
        }).join('') + '</ol></div>';
    }).join('');
    return '<section class="line" aria-labelledby="line-h">' +
      '<h2 id="line-h" class="vh">The pipeline</h2>' +
      '<p class="line-total"><b>' + homes.length + '</b> ' + homesWord(homes.length) + ' in the pipeline</p>' +
      '<div class="track">' + bands + '</div></section>';
  }

  const hero = homes.find(h => h.id === D.hero) || features.find(h => h.image);
  const credits = '<p class="credits">Development by ' + esc(D.developer.name) +
    '<span class="sep" aria-hidden="true"></span>Sales &amp; Marketing by ' + esc(D.marketing) + '</p>';

  root.innerHTML =
    '<header class="mast">' +
      '<img class="m-dev" src="' + esc(D.developer.logo) + '" alt="' + esc(D.developer.name) + '">' +
      '<p class="m-kick">' + esc(D.kicker) + '</p>' +
      '<img class="m-gvc" src="../../assets/logos/sheet/lockup-navy.svg" alt="The Gasdaska Verdiglione Conlon Team">' +
    '</header>' +

    '<section class="hero">' +
      '<div class="h-txt">' +
        '<h1>' + esc(D.title) + '</h1>' +
        '<p class="lede">' + esc(D.lede) + '</p>' +
        credits +
      '</div>' +
      (hero ? '<figure class="h-pic">' + img(hero.image, 'Rendering of ' + hero.address, '(min-width: 960px) 62vw, 100vw', true) +
        '<figcaption><a href="#' + esc(hero.id) + '">' + esc(hero.address) + '</a>' + esc(hero.imageNote) + '</figcaption></figure>' : '') +
    '</section>' +

    timeline() +

    STAGES.map(st => {
      const list = features.filter(h => h.status === st.key);
      if (!list.length) return '';
      return '<section class="stage-sec" aria-label="' + st.name + '">' +
        list.map(h => feature(h, features.indexOf(h))).join('') + '</section>';
    }).join('') +

    (sites.length ? '<section class="sites" aria-labelledby="sites-h">' +
      '<div class="sites-h"><h2 id="sites-h">' + word(sites.length) + ' new subdivisions</h2>' +
        '<p>' + esc(D.subdivisionsIntro) + '</p></div>' +
      sites.map(site).join('') + '</section>' : '') +

    '<section class="next" aria-labelledby="next-h">' +
      '<div class="n-txt"><h2 id="next-h">Next step</h2><p>' + esc(D.nextStep) + '</p></div>' +
      '<div class="n-act">' +
        '<a class="btn" href="' + esc(D.contactUrl) + '" target="_blank" rel="noopener">Contact the GVC Team</a>' +
        '<button class="btn ghost" type="button" id="printBtn">Print or save as PDF</button>' +
      '</div>' +
    '</section>' +

    '<footer class="foot">' +
      '<div class="f-logos">' +
        '<img src="' + esc(D.developer.logoWhite) + '" alt="' + esc(D.developer.name) + '">' +
        '<img class="f-gvc" src="../../assets/logos/sheet/lockup-navy.svg" alt="The Gasdaska Verdiglione Conlon Team">' +
      '</div>' +
      credits +
      '<p class="disc">' + esc(D.disclaimer) + '</p>' +
    '</footer>';

  document.getElementById('printBtn').addEventListener('click', () => window.print());
  requestAnimationFrame(() => document.documentElement.classList.add('ready'));
})();
