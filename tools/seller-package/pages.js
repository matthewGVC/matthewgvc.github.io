/* ============================================================
   tools/seller-package/pages.js: the page list and one builder per page
   (pgCover ... pgContact), keyed in RENDER. Third of the five scripts
   (see content.js).
   ============================================================ */
'use strict';

/* ============================================================
   PAGE LIST — order here drives the deck and its page numbers

   "Where We Have Sold" comes before the property page: the track record
   is the argument, and the seller's own home reads better once it has
   been made. The property page itself is optional — a first meeting is
   often about the team and the strategy, with the home to come — so the
   deck is assembled per render and every page number, running footer and
   page count follows from it.
   ============================================================ */
function pageList() {
  const pages = [
    { key:'cover',   title:'Cover' },
    { key:'about',   title:'About The GVC Team' }
  ];
  /* A Marli or James copy (the Version pick) carries the agent's own biography
     page, and Marli's her Power Haus page; an ordinary deck does not. */
  if (verAgent()) agents().forEach(a => pages.push({ key:'bio', title:'Meet Your Agent', agent:a }));
  /* Power Haus is Marli's own network (she co-founded it), so the page is
     Marli-specific content: it prints only in Marli's version. */
  if (P.versionId(state.version) === 'marli-silver') pages.push({ key:'powerhaus', title:'Power Haus' });
  pages.push(
    { key:'studio',  title:'In-House Marketing & Design' },
    { key:'map',     title:'Where We Have Sold' }
  );
  if (state.showProperty) pages.push({ key:'property', title:'Your Property' });
  pages.push(
    { key:'comps',   title:'Comparable Sales' },
    { key:'strategy',title:'The Listing Strategy' },
    { key:'plan',    title:'Marketing Plan' },
    { key:'prep',    title:'Preparing Your Home' },
    { key:'reviews', title:'Testimonials' },
    { key:'videos',  title:'Professional Videos' },
    { key:'contact', title:'Thank You' }
  );
  return pages;
}
let PAGES = pageList(), OF = PAGES.length;

/* ============================================================
   PAGE RENDERERS
   ============================================================ */
/* The front page is Pitch.frameCover(), the design measured off the drawn
   page 1 — the same one the Buyer Package fronts with. Its three text runs
   take what this deck knows: what the packet is, the address as the title,
   and who it was put together for. The agents are not on it; their cards
   are on the closing page. */
function pgCover() {
  return P.frameCover({
    kicker: 'Listing Presentation & Comparative Market Analysis',
    title: state.address || 'Property Address',
    foot: coverFoot(),
    image: photoFor('cover'),
    pos: posFor('cover')
  });
}

/* The caps line under the photo. Both halves are optional, and a deck with
   neither yet falls back to the markets line the Buyer Package prints — an
   unfinished cover should still look like a finished one. */
function coverFoot() {
  const who = state.client && 'Prepared for ' + window.GVC_NAMECASE(state.client);
  const line = [who, state.date].filter(Boolean).join(' · ');
  return line || STATE_LINE().join(' · ');
}

/* Company page — entirely static, including the photo. The three co-founders
   are always named here regardless of which agents are picked for the
   listing; this page is about the firm, not about who is presenting it. */
const FOUNDERS = ['jonathan-conlon', 'john-gasdaska', 'tj-verdiglione'];

function pgAbout(n) {
  const names = FOUNDERS.map(id => { const a = window.GVC_AGENT(id); return a ? a.name : ''; }).filter(Boolean).join(' &middot; ');
  /* New Jersey shows the agents picked for this listing; with none picked it
     falls back to the founders photo. */
  const team = state.market === 'nj' ? agents() : [];
  const duo = team.length
    ? '<div class="duo cut"><div class="people">' + team.map(a =>
        '<img src="' + esc(headshotFor(a)) + '" alt="">').join('') + '</div>' +
      '<div class="cap">' + team.map(a => esc(a.name)).join(' &middot; ') + '</div></div>'
    : '<div class="duo" data-pos="about0">' +
      '<img src="../../assets/team/founders-lifestyle.jpg" alt="" style="object-position:' +
        posFor('about0').x + '% ' + posFor('about0').y + '%">' +
      '<div class="cap">' + names + '</div>' +
    '</div>';
  const body =
    duo +
    '<div class="dline"><b>Over $3 Billion</b> Sold</div>' +
    '<div class="about-copy">Driven by their shared commitment to <b>excellence</b>, <b>integrity</b>, ' +
    '<b>innovation</b>, and <b>collaboration</b>, TJ, John, and Jonathan merged The Gasdaska Conlon Team ' +
    'and The Verdiglione Group in 2024 to form The Gasdaska Verdiglione Conlon Team. Their diverse ' +
    'knowledge, extensive experience, and unwavering commitment have earned them the trust of countless ' +
    'clients and partners. Known for consistently delivering <b>exceptional results</b>, the team has ' +
    'become a proven leader in <b>luxury residential transactions</b>, <b>major commercial deals</b>, and ' +
    'significant <b>new development</b> and redevelopment projects across ' +
    (state.market === 'nj' ? 'New Jersey, New York City, and Florida' : 'New York City, New Jersey, and Florida') +
    '.</div>' +
    '<div class="tri">' +
      '<div class="tb c1"><h4>Ethical and Client Centric</h4><p>Though we come from diverse backgrounds, ' +
        'we have the same values &mdash; integrity, putting our client&rsquo;s best interests first, and ' +
        'serving as advisors, not salespeople.</p></div>' +
      '<div class="tb c2"><h4>Excellence Through Experience</h4><p>With 50+ years of combined experience ' +
        'across our team, we have the knowledge required to stand as a pillar of excellence within the ' +
        'industry. We are consistently recognized as top producers.</p></div>' +
      '<div class="tb c3"><h4>Personalized Listings</h4><p>Each listing is unique, and we use our ' +
        'meticulous attention to detail, creativity, and comprehensive market knowledge to craft a ' +
        'customized strategy for selling your most precious asset: your home.</p></div>' +
    '</div>' +
    '<div class="dline sm">Present <b>Your Property</b> Right</div>' +
    '<div class="tri flat' + (hasMarli() ? ' two' : '') + '">' +
      '<div class="tb c0"><h4><b>Tailored Experience</b><br>for Each Client</h4></div>' +
      showingsTile() +
      '<div class="tb c2"><h4>We <b>Gather Info Directly</b><br>from the Buyer</h4></div>' +
    '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'Our Team', body });
}
/* The middle box under "Present Your Property Right". Marli uses lockboxes, so her
   copy leaves the line out; everyone else does not, so theirs keeps saying so,
   alongside the open houses James asked for (2026-10-28). */
function showingsTile() {
  if (hasMarli()) return '';
  return '<div class="tb c3"><h4>Hosted <b>Open Houses</b><br>Personal Showings, No Lockboxes</h4></div>';
}

/* The in-house marketing & design division. Static: these are the people who
   produce the work regardless of which agent is listing the home. */
function pgStudio(n) {
  /* id, name, title, panel colour, and which side of its photo the panel sits
     on — 'r' puts the panel left of the photo and right-aligns its text. */
  const crew = [
    ['ilin-graves',        'Ilin Graves-Stowe',  'Lead Graphic Designer',                        'n1', 'l'],
    ['sydney-manno',       'Sydney Manno',       'Digital Marketing &amp; Social Media Specialist','n2', 'r'],
    ['matthew-bloomfield', 'Matthew Bloomfield', 'Creative Design Assistant',                    'n3', 'r'],
    ['eric-elfstrom',      'Eric Elfstrom',      'Photographer &amp; Videographer',              'n4', 'l']
  ];
  const photo = (id, i) =>
    '<div class="cell ph" data-pos="crew' + i + '">' +
      '<img src="../../assets/team/' + id + '.jpg" alt="" style="object-position:' +
        posFor('crew' + i).x + '% ' + posFor('crew' + i).y + '%"></div>';
  const label = (nm, tt, tone, side) =>
    '<div class="cell lab ' + tone + (side === 'r' ? ' r' : '') + '">' +
      '<div class="nm">' + nm + '</div><div class="tt">' + tt + '</div></div>';
  const member = (c, i) => {
    const [id, nm, tt, tone, side] = c;
    return side === 'r'
      ? label(nm, tt, tone, side) + photo(id, i)   // panel first, photo outboard
      : photo(id, i) + label(nm, tt, tone, side);
  };
  const body =
    '<div class="crew">' + crew.map(member).join('') + '</div>' +
    '<div class="dline"><b>In-House</b> Design Team</div>' +
    '<div class="about-copy">Based in Boulder, Colorado, the GVC Team&rsquo;s Marketing &amp; Design ' +
    'division is the <b>creative force behind the brand</b>, delivering <b>high-impact visual ' +
    'storytelling, strategic marketing, and cutting-edge design</b> that elevate luxury real estate to ' +
    'its highest potential. From compelling digital campaigns and dynamic social media strategies to ' +
    'world-class photography, videography, and branding, this team ensures that every property and new ' +
    'development is positioned for <b>maximum exposure and success</b>.</div>' +
    '<div class="dline sm">Our Marketing <b>Advantage</b></div>' +
    '<div class="tri">' +
      '<div class="tb c1">' + (window.icon ? window.icon('pen', 'ci') : '') +
        '<h4>Immersive Visual Design</h4><p>Led by Ilin Graves-Stowe, Graphic Designer &amp; 3D Artist, we ' +
        'create stunning renderings and innovative visuals that bring properties to life and highlight ' +
        'every architectural detail.</p></div>' +
      '<div class="tb c2">' + (window.icon ? window.icon('megaphone', 'ci') : '') +
        '<h4>Digital Strategy &amp; Social Media Reach</h4><p>Sydney Manno, Digital Marketing &amp; ' +
        'Social Media Specialist, curates and executes cutting-edge campaigns to expand visibility and ' +
        'engage the right audience across all platforms.</p></div>' +
      '<div class="tb c3">' + (window.icon ? window.icon('clapper', 'ci') : '') +
        '<h4>Cinematic Storytelling</h4><p>Eric Elfstrom, our Photographer &amp; Videographer, produces ' +
        'breathtaking films and photography, capturing each home&rsquo;s essence and showcasing it at ' +
        'its absolute best.</p></div>' +
    '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'Marketing', body });
}

/* New Jersey's version: no crew and no Boulder. The same page furniture, saying
   only that every part of the marketing is produced in-house. */
function pgStudioNj(n) {
  const ico = name => (window.icon ? window.icon(name, 'ci') : '');
  const body =
    '<div class="showcase">' +
      '<div class="mock"><img src="../../assets/img/nj/marketing-mockup.jpg" alt="A GVC listing brochure and its film playing on a phone"></div>' +
    '</div>' +
    '<div class="dline sm">Made <b>In-House</b></div>' +
    '<div class="about-copy inhouse">Our own photographer and videographer shoot every New Jersey listing, and a ' +
    'full-time marketing and graphic design team produces everything around it: the brochure, signage, ' +
    'social campaigns, ads and email. One team, start to finish, so your home looks the same everywhere it appears.</div>' +
    '<div class="dline sm">Our Marketing <b>Advantage</b></div>' +
    '<div class="tri">' +
      '<div class="tb c1">' + ico('pen') +
        '<h4>Immersive Visual Design</h4><p>Renderings, brochures and listing design that bring the ' +
        'property to life and highlight every architectural detail.</p></div>' +
      '<div class="tb c2">' + ico('megaphone') +
        '<h4>Digital Strategy &amp; Social Media Reach</h4><p>Targeted campaigns that expand visibility ' +
        'and reach the right buyers across every platform.</p></div>' +
      '<div class="tb c3">' + ico('clapper') +
        '<h4>Cinematic Storytelling</h4><p>Films and photography that capture the home&rsquo;s ' +
        'essence and show it at its absolute best.</p></div>' +
    '</div>' +
    '<div class="dline sm">Virtual <b>Staging</b></div>' +
    '<div class="staging">' +
      /* 3 Crosby Lane, Drone 1, raw and edited (photos/pairs.json; copied here
         2026-10-28 so a gallery rebuild cannot renumber them). New Jersey only. */
      '<figure><img src="../../assets/img/nj/crosby-drone1-before.webp" alt="3 Crosby Lane from the air, as shot" style="object-position:50% 50%"><figcaption>Before</figcaption></figure>' +
      '<figure><img src="../../assets/img/nj/crosby-drone1-after.webp" alt="The same aerial, edited" style="object-position:50% 50%"><figcaption>After</figcaption></figure>' +
    '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE, title:'Marketing', body });
}

function pgProperty(n) {
  const specs = [
    ['Property type', state.ptype, 'home'], ['Bedrooms', state.beds, 'bed'], ['Bathrooms', state.baths, 'bath'],
    ['Interior', state.sqft ? state.sqft + ' sq ft' : '', 'ruler'], ['Year built', state.year, ''],
    ['Taxes', state.taxes ? P.money(state.taxes) + ' / yr' : '', ''],
    ['Common charges', state.cc ? P.money(state.cc) + ' / mo' : '', '']
  ].filter(r => r[1]);
  const feats = listOf(state.features);
  const body =
    '<div class="ph pb-hero" data-drop="hero"' + (photoFor('hero') ? ' data-pos="hero"' : '') + '>' + (photoFor('hero')
      ? '<img src="' + photoFor('hero') + '" alt="" style="object-position:' + posFor('hero').x + '% ' + posFor('hero').y + '%">'
      : '<div class="empty-note on-white">Tag a photo &ldquo;Property hero&rdquo;</div>') + '</div>' +
    (state.blurb ? '<div class="copy" style="margin-bottom:.24in">' + P.lines(state.blurb) + '</div>' : '') +
    '<div class="pb-grid">' +
      '<div class="pb-col">' +
        '<div class="rh-t" style="font:800 7pt var(--sans);letter-spacing:.16em;text-transform:uppercase;color:rgba(0,39,58,.5);margin-bottom:.1in">The Details</div>' +
        specs.map(([k, v, ic]) => '<div class="spec"><span class="k">' + (ic && window.icon ? window.icon(ic, 'hi') : '') + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>').join('') +
      '</div>' +
      '<div class="pb-col">' +
        '<div class="rh-t" style="font:800 7pt var(--sans);letter-spacing:.16em;text-transform:uppercase;color:rgba(0,39,58,.5);margin-bottom:.1in">Key Features</div>' +
        '<ul class="feat">' + feats.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
      '</div>' +
    '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title: state.address || 'Your Property', body });
}

function pgMap(n) {
  const body =
    '<div class="map-wrap"' + (state.map ? ' data-pos="map"' : '') + '>' + (state.map
      ? '<img src="' + state.map.url + '" alt="" style="object-position:' + posFor('map').x + '% ' + posFor('map').y + '%">'
      : '<div class="empty-note on-white">Drop a map export<br>in the Photos panel</div>') + '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'Where We Have Sold', body });
}

/* What the comparables say, worked out from the rows entered and nothing else:
   the median sold price and $/sq ft, and (once the three prices and the
   square footage are in) what each of the three prices comes to per square
   foot against that median. Left off a long list, which already fills the page. */
function compSummary(rows) {
  const priced = rows.filter(c => P.num(c.price) > 0);
  if (!priced.length || rows.length > 6) return '';
  const med = a => { const v = a.slice().sort((x, y) => x - y), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const prices = priced.map(c => P.num(c.price));
  const ppsf = priced.filter(c => P.num(c.sqft) > 0).map(c => P.num(c.price) / P.num(c.sqft));
  const stat = (v, l) => '<div class="stat"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>';
  let h = '<div class="comp-sum"><h3>What the comparables show</h3><div class="row">' +
    stat(P.moneyShort(med(prices)), 'Median sold price') +
    (ppsf.length ? stat(P.money(med(ppsf)), 'Median $ / sq ft') : '') +
    stat(P.moneyShort(Math.min.apply(null, prices)) + ' – ' + P.moneyShort(Math.max.apply(null, prices)), 'Sold price range') +
    '</div>';
  const sq = P.num(state.sqft), bands = [['Low', state.priceLow], ['Mid', state.priceMid], ['High', state.priceHigh]];
  if (sq > 0 && ppsf.length && bands.every(b => P.num(b[1]) > 0)) {
    h += '<div class="row">' + bands.map(b => stat(P.money(P.num(b[1]) / sq), b[0] + ' range, per sq ft')).join('') + '</div>' +
      '<p class="note">The three recommended prices work out to the figures above per square foot of this home, against a comparable median of ' +
      P.money(med(ppsf)) + '.</p>';
  }
  return h + '</div>';
}

function pgComps(n) {
  const rows = state.comps.filter(c => c.address);
  const sub = { address: state.address || 'Subject property', price:'', sqft: state.sqft,
                bb: [state.beds, state.baths].filter(Boolean).join(' / '), date:'Subject' };
  const tr = (c, isSub) =>
    '<tr' + (isSub ? ' class="subject"' : '') + '>' +
      '<td class="adr">' + esc(c.address) + (c.note ? '<span class="meta">' + esc(c.note) + '</span>' : '') + '</td>' +
      '<td class="num">' + (c.price ? P.money(c.price) : '—') + '</td>' +
      '<td class="num">' + (c.sqft ? esc(c.sqft) : '—') + '</td>' +
      '<td class="num">' + (c.price && P.num(c.sqft) ? P.money(P.num(c.price) / P.num(c.sqft)) : '—') + '</td>' +
      '<td class="num">' + esc(c.bb || '—') + '</td>' +
      '<td class="num">' + esc(c.date || '—') + '</td>' +
    '</tr>';
  const body =
    '<table class="tbl' + (rows.length <= 6 ? ' roomy' : '') + '" id="compTable"><thead><tr>' +
      '<th>Address</th><th class="num">Sold</th><th class="num">' + (window.icon ? window.icon('ruler','hi') : '') + 'Sq ft</th>' +
      '<th class="num">$ / sq ft</th><th class="num">' + (window.icon ? window.icon('bed','hi') : '') + 'Bed / Bath</th><th class="num">Date</th>' +
    '</tr></thead><tbody>' + tr(sub, true) + rows.map(c => tr(c, false)).join('') + '</tbody></table>' +
    compSummary(rows) +
    (rows.length ? '' : '<div class="empty-note on-white" style="position:relative;margin-top:.6in">Add comparables in the panel</div>');
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'Comparable Sales', body });
}

/* The three prices and which band is recommended come from the panel. The
   strategy/risk pairs are fixed — the same argument on every listing. */
const BANDS = [
  ['low',  'Low Range',  'priceLow',
   'Peak interest for a possible bidding war and sell quick', 'Leave money on the table'],
  ['mid',  'Mid Range',  'priceMid',
   'Highest chance for multiple offers and quicker sale', 'Low risk'],
  ['high', 'High Range', 'priceHigh',
   'Possibly get more money', 'Increased time it takes to sell or significant price drop']
];

function pgStrategy(n) {
  const body =
    '<div class="lede" style="text-align:center;max-width:none">A home priced right will attract a ' +
    'greater number of interested buyers.</div>' +
    '<div class="eval">After a personal consultation and a thorough assessment of your home, we will ' +
    'provide you with our expert evaluation of its value.</div>' +
    '<div class="bands">' + BANDS.map(([id, lab, key, strat, risk]) =>
      '<div class="band' + (id === 'mid' ? ' mid' : '') + '">' +
        '<div class="bl">' + lab + '</div>' +
        '<div class="bv">' + (state[key] ? P.money(state[key]) : '$ —') + '</div>' +
        '<div class="bsr">' +
          '<div><b>Strategy</b>' + strat + '</div>' +
          '<div><b>Risk</b>' + risk + '</div>' +
        '</div>' +
      '</div>').join('') + '</div>' +
    '<div class="strat-note">Price decides how the rest of the sale goes. Set it too high and the home sits, ' +
    'and buyers see the days on market before they see your photos. Set it too low and you give up money ' +
    'you cannot get back. The three figures above are the range the comparable sales support, and we would ' +
    'take the home to market at the middle one.</div>' +
    '<div class="ph strat-ph" data-drop="strategy"' + (photoFor('strategy') ? ' data-pos="strategy"' : '') + '>' + (photoFor('strategy')
      ? '<img src="' + photoFor('strategy') + '" alt="" style="object-position:' +
          posFor('strategy').x + '% ' + posFor('strategy').y + '%">'
      : '<div class="empty-note on-white">Tag a photo &ldquo;Strategy page&rdquo;</div>') + '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'The Listing Strategy', body });
}

/* Static GVC boilerplate — pre-launch, launch and on-going, grouped from
   PLAN_ROWS (Phase | Group | Title | detail). Not editor-driven, but four of
   its rows follow the market toggle — see PLAN_ROWS for which and why. */
function pgPlan(n) {
  const rows = planFor(state.market);
  const phases = ['Pre-Launch', 'Launch', 'On-Going'];
  /* p1/p2/p3 carry the phase accent — navy, mid, then light */
  const col = (phase, i) => {
    const rs = rows.filter(r => r[0] === phase);
    const groups = [];
    rs.forEach(r => {
      let g = groups.filter(x => x.name === r[1])[0];
      if (!g) { g = { name: r[1], items: [] }; groups.push(g); }
      g.items.push(r[2] + (r[3] ? ' — ' + r[3] : ''));
    });
    return '<div class="ph3 p' + (i + 1) + '"><div class="ph3-h">' + phase + '</div>' +
      groups.map(g => '<div class="grp"><div class="grp-t">' + g.name + '</div><ul>' +
        g.items.map(t => '<li>' + t + '</li>').join('') + '</ul></div>').join('') + '</div>';
  };
  const social = '<div class="plan-social">' + (verIG() ? [['Instagram', verIG(), 'https://instagram.com/' + verIG().slice(1)]] : PLAN_SOCIAL).map(([label, handle, url]) => {
    const code = qrSvg(url);
    return '<div class="ps">' +
      '<div class="qbox">' + (code || '') + '</div>' +
      '<div class="pl">' + esc(label) + '</div>' +
      '<div class="pv">' + esc(handle) + '</div>' +
    '</div>';
  }).join('') + '</div>';
  const body = '<div class="plan3">' + phases.map(col).join('') + '</div>' + social;
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'Marketing Plan', body });
}

/* The seller's own prep checklist. Boxes print empty — this page is meant to
   be handed over and ticked off, so nothing here is editor-driven. The list
   follows the market: an apartment one for New York. */
function pgPrep(n) {
  const body =
    '<div class="chk">' + (state.market === 'nyc' ? PREP_NYC : PREP).map(([name, ic, items]) =>
      '<div class="cgrp"><div class="cgrp-h">' + (window.icon ? window.icon(ic, 'ci') : '') +
        '<span>' + name + '</span></div><ul>' +
        items.split(';').map(t => '<li><i></i><span>' + t + '</span></li>').join('') +
      '</ul></div>').join('') + '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'The Sales Plan', body });
}

const REVIEWS_URL = 'https://gvcrealestateteam.com/about';

/* Four slots, filled from the REVIEWS library by the Client testimonials
   panel section — which follows the Agents section until the agent ticks
   something themselves. Picking fewer than four still looks right: .quotes
   is space-evenly, so the quotes simply grow. */
function pgReviews(n) {
  const rs = chosenReviews();
  const revQr = qrSvg(REVIEWS_URL);
  const body =
    '<div class="rev-badge">' +
      (revQr ? '<div class="rb-qr">' + revQr + '</div>' : '') +
      '<div class="rb-txt">' +
        '<div class="rb-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>' +
        '<div class="rb-n">50+</div>' +
        '<div class="rb-l">5-star reviews</div>' +
      '</div>' +
    '</div>' +
    '<div class="quotes">' + rs.map(r =>
    '<div class="quote"><p>' + esc(r.quote) + '</p>' +
    (r.who ? '<div class="who">' + esc(r.who) + '</div>' : '') + '</div>').join('') + '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'Testimonials', body });
}

/* Up to three of the six real listing films, picked in the Professional
   videos panel section — which follows the market toggle until the agent
   ticks something themselves. Picking fewer still looks right: .vid is
   flex:1, so the cards simply grow.

   The prose beside them follows the market outright; it is not editable, so
   there is nothing to protect from being overwritten.

   Photo falls back to the panel's Video N slot so a dropped photo still
   works. Those three slots stay positional rather than keyed per film:
   every library film ships with a real still, so the drop is now a
   rarely-used escape hatch and re-keying it would only complicate the photo
   tray. QR prefers a supplied image, else draws itself from the url, else
   prints a placeholder rather than a dead code. */
function pgVideos(n) {
  const body =
    '<div class="vids">' +
      '<div class="vids-copy">' + VIDEO_COPY[videoMarket()].map(p => '<p>' + p + '</p>').join('') + '</div>' +
      '<div class="vids-list">' + chosenVideos().map((v, i) => {
        /* A photo the user pinned to this card wins over the film's own still:
           dropping one here is a deliberate act and has to show. Auto-placed
           photos do not, so the library stills stay the default. */
        const key = 'video' + (i + 1), pinned = assign[key] && assign[key].role === key ? assign[key].url : null;
        const img = pinned || v.photo || slot(key);
        const code = v.qr
          ? '<img src="' + v.qr + '" alt="">'
          : qrSvg(v.url);
        return '<div class="vid" data-drop="' + key + '"' + (img ? ' data-pos="' + key + '"' : '') + '>' +
          (img
            ? '<img src="' + img + '" alt="" style="object-position:' + posFor(key).x + '% ' + posFor(key).y + '%">'
            : '<div class="empty-note on-white">Tag a photo &ldquo;' + esc('Video ' + (i + 1) + ' still') + '&rdquo;</div>') +
          '<div class="vqr' + (code ? '' : ' todo') + '">' + (code || 'Video<br>link<br>needed') + '</div>' +
          '<div class="vt">' + esc(v.title) + '</div>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  return P.page({ deck:DECK, n, of:OF, site:SITE,
    title:'Professional Videos', body });
}

/* Closing page. The agents as proper cards, then one tidy footer block. The
   headshots are transparent cutouts, so each sits on its own light panel —
   that is what carries the drop shadow and the name banner. A shadow on the
   bare cutout draws an empty rectangle. */
/* Closing page — the editorial close shared with the Buyer Package and the
   Brochure: the lockup and the team QR on a header line, the sign-off under
   it, then one row per agent with their cut-out standing in a rail down the
   left and their office number, mobile and email hung beside it. An agent
   with an Instagram in the roster also gets a row of their own in Social.

   All of it is built by Pitch.closingPage(), so the three closes are one
   design. Its markup carries the running footer itself, so the page is
   assembled here rather than through P.page(). */
function pgContact(n) {
  return '<div class="pg rev">' +
    P.closingPage({
      agents: agents(), headshotFor,
      qr: qrSvg(TEAM_QR_URL), qrCap: 'Our properties',
      legal: GVC_LEGAL.block('listing', state.market),
      referral: P.referralNote(STATE_LINE().slice(0, -1).join(', ') + ' or ' + STATE_LINE().slice(-1)),
      states: STATE_LINE().map(nm => P.STATES.filter(s => s[0] === nm)[0]),
      foot: P.foot(SITE, true, n, OF),
      socialTop: true,
      social: verIG() ? [['Instagram', verIG(), 'instagram']] : null
    }) +
  '</div>';
}

/* Biography page: the Buyer Package's Meet Your Agent page (Pitch.agentBioBody).
   The tall photographs live in the Buyer Package's static folder. */
const BIO_PHOTO = id => ['marli-silver', 'james-huber', 'tj-verdiglione', 'gary-kasparov', 'nicole-melveney',
  'katie-cook', 'john-gasdaska', 'jonathan-conlon', 'ayuen-gai', 'nicole-sobol', 'george-putykewycz']
  .indexOf(id) >= 0 ? '../buyer-package/static/agent-' + id + (id === 'james-huber' ? '-cut.webp' : '.jpg') : '';
function pgBio(n, p) {
  return P.page({ deck:DECK, n, of:OF, site:SITE, title:'Meet Your Agent', cls:'nohead',
    body: P.agentBioBody(p.agent, BIO_PHOTO(p.agent.id), headshotFor) });
}
/* Power Haus, Marli's copy only: the Buyer Package's page, told for a seller. */
function pgPowerhaus(n) {
  const G = window.GVC_GUIDE.POWERHAUS;
  const H = Object.assign({}, G, {
    kicker: 'Your property has exposure nationwide',
    cta: 'Scan to see the Power Haus market partners'
  });
  return P.page({ deck:DECK, n, of:OF, site:SITE, title:'Power Haus',
    body: P.powerhausBody(H, '../buyer-package/static/', qrSvg) });
}

const RENDER = {
  bio:pgBio, powerhaus:pgPowerhaus,
  cover:pgCover, about:pgAbout, studio:n => state.market === 'nj' ? pgStudioNj(n) : pgStudio(n), property:pgProperty,
  map:pgMap, comps:pgComps, strategy:pgStrategy, plan:pgPlan, prep:pgPrep,
  reviews:pgReviews, videos:pgVideos, contact:pgContact
};
