/* ============================================================
   tools/seller-package/content.js: the deck's state and its fixed copy
   (marketing plan, testimonials, prep lists, films, markets, agents), and
   which films and quotes a deck shows.

   The Seller Package's script is five classic scripts sharing one global
   scope, loaded in this order by index.html: content.js, photos.js,
   pages.js, panel.js, piece.js. Code that runs while a file loads may only
   use what an earlier file defines; functions called later may use any.
   ============================================================ */
'use strict';

const P = window.Pitch, esc = P.esc;
const PD = window.GVC_PHOTODND;
const DECK = 'Seller Package';

/* The website printed in every footer. Not editable — the footer, the
   social handles and the links are all fixed team boilerplate in all three
   builders, so none of them can print a wrong one. */
const SITE = 'gvcrealestateteam.com';

/* ============================================================
   STATE
   ============================================================ */
const state = {
  address:'', city:'', state:'', zip:'',
  beds:'', baths:'', sqft:'', ptype:'', year:'', taxes:'', cc:'',
  blurb:'', features:'',
  client:'', date:'',
  photos:[], map:null,
  comps:[],
  priceLow:'', priceMid:'', priceHigh:'', recBand:'mid',
  showProperty:true,
  agents:[],
  /* a roster agent id, or '' - the Version pick: any agent presents their own copy */
  version:'',
  /* Which market's verbiage the deck speaks - 'nj' or 'nyc'. Defaults from
     the State field typed on the property; 'nyc' for a deck with no property
     yet, the firm being New York-headquartered. */
  market:'nyc',
  /* Both null mean "follow": the video selection follows the market, the
     testimonials follow the Agents section. An array of ids means the agent
     has taken the choice over by hand. */
  videos:null,
  reviews:null,
  pos:{}
};

/* What a deck looks like before any property is loaded. The reset a property
   switch performs is derived from this rather than hand-listed, so a field
   added above is covered the day it is added — a hand-list is how the previous
   seller's name, recommended price and price band came to survive onto the
   next listing's deck. */
const BLANK = structuredClone(state);

/* Default copy — the parts that are GVC boilerplate rather than
   per-client. Overwrite in the panel; these are only a starting point.
   Plan rows are Phase | Group | Title | detail — the phase groups the row
   into one of the three columns on the page.

   Four of the eighteen rows are market-specific, and used to print New York
   institutions to New Jersey sellers: REBNY is the Real Estate Board of *New
   York*, StreetEasy does not cover New Jersey, a New Jersey house has no
   offering plan to check against, and "targeted buildings" is a city idea.
   Those four carry an object of variants keyed by market; the other fourteen
   are plain strings and stay written once.

   The New Jersey rows name "the MLS" generically rather than a board.
   Monmouth Ocean would match the Fair Haven office and every NJ film, but
   naming an institution invites being wrong or going stale, and the generic
   reads correctly for any NJ listing. Matt has read all four New Jersey
   rows on the page and signed them off. */
const PLAN_ROWS = [
  'Pre-Launch | Media Creation | Custom photography | A full shoot with our in-house photographer, timed to the property at its best.',
  'Pre-Launch | Media Creation | Professional floor plan | Produced in-house for every listing.',
  'Pre-Launch | Media Creation | Property video | A cinematic walkthrough cut for the launch and for social.',
  { nyc:'Pre-Launch | Property Info | Verify all pertinent information | Confirmed against the deed, offering plan and building records before anything goes out.',
    nj: 'Pre-Launch | Property Info | Verify all pertinent information | Confirmed against the deed, survey and tax records before anything goes out.' },
  { nyc:'Pre-Launch | Pre-Launch Marketing | Elliman &amp; REBNY notice | Immediate notice to all Elliman brokers, REBNY members and co-broke firms.',
    nj: 'Pre-Launch | Pre-Launch Marketing | Elliman &amp; MLS notice | Immediate notice to all Elliman brokers, MLS members and co-broke firms.' },
  'Pre-Launch | Pre-Launch Marketing | Teaser announcement | Social teaser ahead of the public listing date.',
  'Launch | Digital Launch | Elliman.com listing | Posted with professional photos, floor plan, description and all marketing information.',
  'Launch | Digital Launch | Brokerage &amp; contact announcement | Emailed to the entire brokerage community and our private contact lists.',
  { nyc:'Launch | Digital Launch | StreetEasy syndication | Posted with full professional details and marketing information.',
    nj: 'Launch | Digital Launch | MLS syndication | Posted to the MLS with full professional details, and syndicated to the major search portals.' },
  'Launch | Print Marketing | Marketing sheet | A professional sheet detailing the property, distributed to agents and prospective buyers.',
  'Launch | Print Marketing | Print placements | Placed in appropriate print publications.',
  { nyc:'Launch | Print Marketing | Just Listed cards | Sent to targeted buildings in the surrounding area.',
    nj: 'Launch | Print Marketing | Just Listed cards | Sent to targeted streets and neighborhoods in the surrounding area.' },
  'On-Going | Communication | Weekly seller updates | Market traffic feedback, both buyer and web, delivered on a weekly cadence.',
  'On-Going | Communication | Offer qualification | Every offer qualified before it is presented.',
  'On-Going | Communication | Showings &amp; open houses | Scheduled as needed, public or broker-specific.',
  'On-Going | Communication | Comparable tracking | Continued tracking of similar sales, so pricing stays defensible.',
  'On-Going | Ongoing Marketing | Bi-weekly email blasts | Sent to the entire brokerage community.',
  'On-Going | Ongoing Marketing | Continued print &amp; web ads | As needed through the life of the listing.'
];
/* One market's eighteen rows as Phase | Group | Title | detail cells. */
const planFor = m => PLAN_ROWS.map(r =>
  (typeof r === 'string' ? r : r[m]).split('|').map(x => x.trim()));

/* Client testimonials — the library the page picks four from.

   Each entry names the agents it credits, so the page can follow the Agents
   section: pick John and Marli and the fill takes two of each, which reads
   better in a listing presentation than four of one voice. `agents: []`
   marks a review that names nobody, usable with any presenter. `market` is
   where the sale was, so a deck whose agents have no reviews of their own
   tops up from its own market: an NYC deck should not print a New Jersey
   seller's quote.

   Order within an agent matters, because the fill takes reviews in library
   order: seller-side reviews go first. A listing presentation should lead on
   what a seller is actually deciding between — pricing, and whether anyone
   will look after the sale — and several of the best-written reviews on the
   team site are buyer-side, which makes them weaker here.

   Sources: Marli's three were already in this file, abbreviated. The rest
   come from the carousel on gvcrealestateteam.com/about, which publishes
   them under full client names, so they keep those names here. Long ones are
   trimmed to fit the page, never reworded.

   Three reviews are deliberately absent and should not be reinstated without
   asking Matt: one names Jessica Wolf, who has left the team, and two name a
   Daniel Champoli, who is not on the roster. All three are strong, and the
   loss of the Jessica one is real — it is seller-side. But a client-facing
   deck cannot name someone it has no way to introduce, and cutting the name
   out of a quote is rewording rather than trimming.

   TJ Verdiglione has no publicly attributed review. At Matt's request
   (2026-10-15) he leads with a team review that credits nobody (generic:true):
   it sits in TJ's group and queue, and still counts as a Team review for
   everyone else. Never invent an attributed quote for him. */
const REVIEWS = [
  { id:'lenny-z', agents:['marli-silver'], market:'nj',
    quote:'Marli was absolutely fantastic. We were selling a property in New Jersey while living in Florida, and she was instrumental in reducing the stress of a long-distance sale — incredibly responsive, and very open and honest about our expectations.',
    who:'Lenny Z., Seller' },
  { id:'jeff-b', agents:['marli-silver'], market:'nj',
    quote:'Marli has great knowledge of the area and is skilled in determining a strategic asking price. She is incredibly responsive in helping to work through any challenge that comes up along the way. The process was smooth and quick.',
    who:'Jeff B., Seller' },
  { id:'melinda-b', agents:['marli-silver'], market:'nj',
    quote:'This is my third closing with Marli and she is the best realtor I have ever worked with — and trust me, I have worked with quite a few. She makes finding and buying a home very easy, and her real estate expertise is outstanding.',
    who:'Melinda B., Buyer' },
  { id:'sally-siebold', agents:['john-gasdaska'], market:'nyc',
    quote:'I have had many experiences buying and selling real estate. My experience with the GVC Real Estate team was by far the best. They were honest and very experienced from start to finish. They handled everything, from the listing, pictures, to staging the apartment for us.',
    who:'Sally Siebold, Seller' },
  { id:'edward-whittemore', agents:['john-gasdaska','jonathan-conlon'], market:'nyc',
    quote:'My family worked with the GVC Team over the course of 2+ years to successfully sell two apartments in a small UES co-op in the East 70s. John and Jonathan and their entire team were professional, very responsive and outcome oriented. Top rate!',
    who:'Edward Whittemore, Seller' },
  { id:'conor-hagen', agents:['john-gasdaska'], market:'nyc',
    quote:'John and his associates at Gasdaska Conlon are top notch professionals. It was a very smooth, easy and overall enjoyable experience working with them to buy and sell our apartment in NYC.',
    who:'Conor Hagen, Buyer & Seller' },
  /* held out of the fill (fill:false): a referring agent's note, not a client review */
  { id:'bardia-fd', agents:['john-gasdaska'], market:'nyc', fill:false,
    quote:'I am a realtor in Orange County, California and I referred a client to John Gasdaska to work with. I knew John was the right recommendation for my client based on his knowledge and his style. He successfully navigated my buyer to a successful closing.',
    who:'Bardia Fd, Referring Agent' },
  { id:'jenny-kane', agents:['tj-verdiglione'], generic:true,
    quote:'The whole team is a pleasure to work with. Super responsive, knowledgeable and helpful. They helped us with both buying and selling and did a fantastic job. Highly recommend!',
    who:'Jenny Sharfstein Kane, Buyer & Seller' },
  { id:'megan-grant', agents:[], market:'nyc',
    quote:'Simply the best real estate team in NYC! Charismatic and treats you like family. Goes above and beyond for clients and expects nothing in return. I never thought buying a home could be so stress free and FUN!',
    who:'Megan Grant, Buyer' }
];
/* How many quotes page 10 has room for. */
const REVIEW_SLOTS = 4;

/* Where the closing page's QR sends a reader: the team's property page
   rather than the homepage, so a scan lands on the listings. */
const TEAM_QR_URL = 'https://www.gvcrealestateteam.com/property';

/* p9 footer — one QR per channel, drawn as vector art so it stays sharp at
   any print size. label/handle are what's printed under the code. */
const PLAN_SOCIAL = [
  ['YouTube',  '@gvcrealestateteam',       'https://youtube.com/@gvcrealestateteam'],
  ['Instagram','@gvcrealestateteam',       'https://instagram.com/gvcrealestateteam'],
  ['LinkedIn', 'The GVC Real Estate Team', 'https://www.linkedin.com/company/the-gvc-real-estate-team']
];

/* ------------------------------------------------------------
   PREPARING YOUR HOME — the seller checklist, verbatim from the
   team's printed sales plan. Group | icon | items (semicolon-separated).
   ------------------------------------------------------------ */
const PREP = [
  ['General Maintenance', 'box',
   'Oil squeaky doors;Tighten doorknobs;Replace burned out lights;Clean and repair windows;' +
   'Touch up chipped paint;Repair cracked plaster;Repair leaking taps and toilets'],
  ['Cleaning', 'home',
   'Shampoo carpets;Clean washer, dryer, and tubs;Clean furnace;Clean fridge and stove;' +
   'Clean and freshen bathrooms'],
  ['Showing Ready', 'pen',
   'Clean and tidy entrance;Functional doorbell;Polish door hardware;' +
   'Paint doors, railings, etc. <em>(as necessary)</em>'],
  ['Curb Appeal 101', 'trees',
   'Cut lawns;Trim shrubs and lawns;Weed and edge gardens;Pick up any litter;' +
   'Clear walk and driveway of leaves;Repair gutters and eaves;Touch up exterior paint'],
  ['That Extra Touch', 'sun',
   'Be absent during showings;Turn on all lights;Light fireplace;Open drapes in the day time;' +
   'Play quiet background music;Keep pets outdoors'],
  ['Tidy and Organized', 'check',
   'Clear stairs and halls;Store excess furniture;Clear counters and stove;Make closets neat and tidy']
];

/* The New York version, for an apartment rather than a house (drafted
   2026-10-07 for Matt's review, not from the printed plan): same six-group
   page, with the building taking Curb Appeal's place and the house-only lines
   (lawns, furnace, doorbell, fireplace) swapped for their apartment ones. */
const PREP_NYC = [
  ['General Maintenance', 'box',
   'Oil squeaky doors;Tighten doorknobs and cabinet pulls;Replace burned out lights;Clean and repair windows;' +
   'Touch up chipped paint;Repair cracked plaster;Repair leaking taps and toilets'],
  ['Cleaning', 'home',
   'Shampoo carpets and clean rugs;Clean washer, dryer, and tubs;Clean radiators and AC units;' +
   'Clean fridge, stove and dishwasher;Clean and freshen bathrooms'],
  ['Showing Ready', 'pen',
   'Clean and tidy entry;Check the buzzer and intercom;Polish door hardware;' +
   'Touch up the front door <em>(as necessary)</em>'],
  ['The Building', 'building',
   'Tell the managing agent and front desk you are selling;Confirm the building’s showing rules;' +
   'Leave keys and access for showings;Find your deed or co-op share certificate and lease;' +
   'Keep recent maintenance or common charge statements;Note any assessments or building projects'],
  ['That Extra Touch', 'sun',
   'Be absent during showings;Turn on all lights;Open blinds and shades in the day time;' +
   'Set the heat or AC to a comfortable temperature;Play quiet background music;Keep pets out during showings'],
  ['Tidy and Organized', 'check',
   'Clear entry and hallways;Store excess furniture;Clear counters and stove;Clear windowsills for the light;' +
   'Make closets neat and tidy']
];

/* ============================================================
   PROFESSIONAL VIDEOS  (page 11)  —  EDIT THIS BLOCK
   ------------------------------------------------------------
   The library the page picks up to three cards from. Today that is one
   New Jersey film and three New York; there are no Florida films, so a
   Florida property prints the neutral copy below with no cards. Fields:

     id      Stable key. This is what the panel's ticks and a saved deck
             store, so renaming one drops it out of any deck that had it.
     market  'nj' or 'nyc'. Groups the picker, and sets which three the
             deck offers when the video selection is still following the
             market toggle.
     title   The address printed on the band across the bottom.
     photo   Path to the listing still, relative to this file.
     qr      Path to a QR image you already have, same style of path.
             Use this if you would rather drop in your own PNGs.
     url     A video link. If `qr` is empty and this is set, the page draws
             the QR itself as vector art, which stays sharp at any print
             size — this is the better option of the two.

   With neither `qr` nor `url`, the card prints a "video link needed"
   placeholder rather than a dead code.

   Paths must be repo-relative, not G:\ paths — the published site is served
   from GitHub Pages, where nobody has the shared drive mounted, and a
   browser cannot read a local drive from an http page anyway. All the
   stills are committed in assets/videos/ at 1600x1067, cropped so the
   top-right stays light (the QR sits there) and the bottom third is floor
   (the address band sits there).

   `url` is used rather than `qr` throughout: these strings were decoded
   from the team's own QR PNGs, so they scan to exactly the same place, but
   drawn as vector they stay sharp at any print size.

   All four are real films the team chose, which is why the page no longer
   carries a "swap these out" stamp. Add another by adding a row here: it
   appears in the picker under its market with no other change. The page
   prints only the films that exist, so a market with one film shows one
   card. (A 'fl' row would also need a Florida tick list in the panel.)

   The two New York ZIPs, 10019 and 10022, were inferred from the street
   addresses rather than confirmed. Matt has read both and let them stand.
   ============================================================ */
const VIDEOS = [
  { id:'14-ridge-road', market:'nj',
    title:'14 Ridge Road, Rumson, NJ 07760',
    photo:'../../assets/videos/14-ridge-road.jpg',
    qr:'', url:'https://youtube.com/shorts/CHApl_TPuz0?feature=shared' },
  /* 205 Parkway and 50 North Way were taken out 2026-10-28 (James's seller comments). */
  { id:'105-norfolk', market:'nyc',
    title:'105 Norfolk Street, Tower 15, NY 10002',
    photo:'../../assets/videos/105-norfolk.jpg',
    qr:'', url:'https://www.youtube.com/watch?v=ENtscLOAae8' },
  { id:'555-w59th', market:'nyc',
    title:'555 W59th Street, PHC, NY 10019',
    photo:'../../assets/videos/555-w59th.jpg',
    qr:'', url:'https://www.youtube.com/watch?v=ZfUhrrHpiPY' },
  { id:'200-e-57th', market:'nyc',
    title:'200 E 57th Street, 17A, NY 10022',
    photo:'../../assets/videos/200-e-57th.jpg',
    qr:'', url:'https://www.youtube.com/watch?v=PhLajvl1p7M' }
];
/* How many video cards page 11 has room for. Picking fewer is fine — .vid
   is flex:1, so the cards simply grow. */
const VIDEO_SLOTS = 3;

/* The prose beside the cards. Paragraph 3 is market-neutral and shared;
   1, 2 and 4 name a market, which is what the NJ/NYC toggle is for — a
   Manhattan selection under New Jersey copy contradicts itself.

   The New Jersey text is the approved marketing copy verbatim, with one
   correction Matt authorised: its closing line used to name "Bergen, Hudson
   and Essex County", which are North Jersey. GVC's New Jersey office is in
   Fair Haven and every NJ film is Monmouth or Ocean — Rumson, Point
   Pleasant Beach, Sea Bright — so the line now names those two counties.

   The New York paragraph 4 says New York City: the films are Manhattan,
   but the deck goes to every NYC seller, Brooklyn included. The NJ
   paragraph 2 used to promise "Manhattan skyline views", which contradicts
   the Monmouth / Ocean copy; it now says the Shore. */
const VIDEO_COPY_SHARED =
  'Our team works with professional videographers whose skill and expertise capture the essence of ' +
  'these spaces, utilizing cutting-edge equipment and techniques to highlight every architectural ' +
  'detail and luxurious amenity. But don&rsquo;t take our word for it, watch examples of our listing ' +
  'videos by scanning the QR codes on this page.';
const VIDEO_COPY = {
  nj: [
    'In the competitive landscape of the New Jersey real estate market, buyers have a wealth of media ' +
    'to sift through, and there are only a few ways to stand out. Price, photography, and copy writing ' +
    'are all important, but high-quality, professional video content has shown time and time again to ' +
    'be the most impactful.',
    'From center-hall colonials on tree-lined streets to waterfront homes along the Shore, ' +
    'each property tells a unique story.',
    VIDEO_COPY_SHARED,
    'In a digital age where first impressions are everything, investing in top-tier video content is a ' +
    'necessity for sellers looking to stand out across Monmouth and Ocean County, ultimately ' +
    'attracting discerning buyers and maximizing property value.'
  ],
  nyc: [
    'In the competitive landscape of the New York City real estate market, buyers have a wealth of media ' +
    'to sift through, and there are only a few ways to stand out. Price, photography, and copy writing ' +
    'are all important, but high-quality, professional video content has shown time and time again to ' +
    'be the most impactful.',
    'From prewar co-ops on Park Avenue to full-floor lofts and penthouses with skyline and river views, ' +
    'each property tells a unique story.',
    VIDEO_COPY_SHARED,
    'In a digital age where first impressions are everything, investing in top-tier video content is a ' +
    'necessity for sellers looking to stand out across New York City, ultimately attracting discerning ' +
    'buyers and maximizing property value.'
  ],
  /* Florida: no market names and no films yet, so no "scan the QR codes" line. */
  fl: [
    'In a competitive real estate market, buyers have a wealth of media to sift through, and there are ' +
    'only a few ways to stand out. Price, photography, and copy writing are all important, but ' +
    'high-quality, professional video content has shown time and time again to be the most impactful.',
    'Our team works with professional videographers whose skill and expertise capture the essence of ' +
    'each home, utilizing cutting-edge equipment and techniques to highlight every architectural ' +
    'detail and luxurious amenity.',
    'In a digital age where first impressions are everything, investing in top-tier video content is a ' +
    'necessity for sellers looking to stand out, ultimately attracting discerning buyers and ' +
    'maximizing property value.'
  ]
};
/* A Florida property. The deck has no Florida market of its own (the toggle,
   plan and legal stay NJ / NYC), but the Videos page must not sell Florida
   with New York or New Jersey films: it prints VIDEO_COPY.fl and no cards.
   Florida is the property's State, or, with no State yet, a Florida agent's
   version. */
const isFL = () => {
  const st = String(state.state || '').trim().toUpperCase();
  if (st) return st === 'FL';
  return !!(state.version && window.GVC_AGENT && (GVC_AGENT(state.version) || {}).market === 'FL');
};
const videoMarket = () => (isFL() ? 'fl' : state.market);

/* The two markets, in the order the toggle prints them. */
const MARKETS = [['nj', 'New Jersey'], ['nyc', 'New York']];
/* The three states, with the market's own first (as in the Buyer Package). */
const STATE_LINE = () => state.market === 'nj'
  ? ['New Jersey', 'New York', 'Florida'] : ['New York', 'New Jersey', 'Florida'];

/* New Jersey stock photos, used in a slot nobody has dropped a photo into.
   Pexels (free licence): cover 22765211 (Asbury Park Convention Hall), hero 18500756 (Casino Pier,
   Seaside Heights), strategy 8932871 (Connor McKenzie, Little Egg Harbor canals). Copies are in the
   shared Stock Photos folder. */
const NJ_STOCK = {
  cover:    '../../assets/img/nj/stock-cover.jpg',
  hero:     '../../assets/img/nj/stock-hero.jpg',
  /* Marli's drone shot, a Monmouth County aerial (2026-10-28; final pick still open) */
  strategy: '../../assets/img/nj/marli-drone.webp'
};
const photoFor = name => slot(name) || (state.market === 'nj' ? NJ_STOCK[name] : null) || null;

/* ============================================================
   HELPERS
   ============================================================ */
const headshotFor = a => a.photo;
const hasMarli = () => state.agents.indexOf('marli-silver') >= 0;
/* The version's agent (roster row), or null for a team copy. */
const verAgent = () => { const v = P.versionId(state.version); return v ? GVC_AGENT(v) : null; };
/* A version agent's own Instagram (from the roster) replaces the team's
   channels in their copy. Agents without one keep the team's. */
const verIG = () => { const a = verAgent(); const h = a && (a.instagram || '').trim(); return h ? h.replace(/^@?/, '@') : ''; };
/* Marli Silver's admin is James Huber; a New Jersey deck's closing page prints him on her row
   (Pitch.agentRow's "Admin" line). His details come from the roster. */
const ADMINS = { 'marli-silver': 'james-huber' };
const agents = () => P.agentsOf(state).map(a => {
  const ad = state.market === 'nj' && ADMINS[a.id] && window.GVC_AGENT(ADMINS[a.id]);
  return ad ? Object.assign({}, a, { admin: ad.name + (ad.email ? ' · ' + ad.email : '') }) : a;
});
const listOf = txt => String(txt || '').split('\n').map(l => l.trim()).filter(Boolean);
/* Lazily creates the crop position for a photo slot, so a render function
   can always read state.pos.<key>.x/.y even before the drag helper wires
   the box after paint. */
function posFor(key) { return state.pos[key] || (state.pos[key] = { x: 50, y: 50 }); }

/* ---------- the three selections ----------
   All three answer the same question: given what the agent has ticked, and
   what they have left alone, what does this page print? Each degrades
   quietly past a stale id — a film or a review dropped from the library
   above should not throw in a deck that still names it, so every lookup
   ends in .filter(Boolean), the discipline P.agentsOf() already uses.

   Selections are always rebuilt in library order rather than click order,
   so a deck comes out the same however its ticks were reached. */

/* Page 11's cards. state.videos === null means the selection is still
   following the market toggle, which offers that market's three films. */
function videoIds() {
  return state.videos === null
    ? VIDEOS.filter(v => v.market === videoMarket()).map(v => v.id)
    : state.videos;
}
function chosenVideos() {
  const ids = videoIds();
  return VIDEOS.filter(v => ids.indexOf(v.id) > -1).slice(0, VIDEO_SLOTS);
}

/* Page 10's quotes. state.reviews === null means the selection is still
   following the Agents section.

   Following fills round-robin across the picked agents in roster order,
   taking each agent's reviews in library order, then tops up from the
   reviews that name nobody, then from the deck's own market, then from
   whatever is left. Round-robin rather
   than agent-by-agent because John and Marli together should print two of
   each: four quotes in one voice reads like one agent's page, and this one
   is titled Testimonials. Most of the roster has no attributed
   review at all, so picking one of them fills from the team reviews and
   then the remainder — which is right rather than awkward. */
/* Credits nobody: unattributed, or a generic team review lent to an agent. */
const teamReview = r => !r.agents.length || r.generic;
function followedReviewIds() {
  const usable = REVIEWS.filter(r => r.fill !== false);
  const picked = agents().map(a => a.id);
  const queues = picked.map(id => usable.filter(r => r.agents.indexOf(id) > -1));
  const out = [];
  const take = r => { if (r && out.indexOf(r.id) < 0) out.push(r.id); };
  for (let i = 0; out.length < REVIEW_SLOTS && i < usable.length; i++)
    queues.forEach(q => { if (out.length < REVIEW_SLOTS) take(q[i]); });
  /* unattributed reviews: this market's own first, then any */
  usable.filter(r => teamReview(r) && r.market === state.market).forEach(r => { if (out.length < REVIEW_SLOTS) take(r); });
  usable.filter(teamReview).forEach(r => { if (out.length < REVIEW_SLOTS) take(r); });
  usable.filter(r => r.market === state.market).forEach(r => { if (out.length < REVIEW_SLOTS) take(r); });
  usable.forEach(r => { if (out.length < REVIEW_SLOTS) take(r); });
  return out;
}
function reviewIds() {
  return state.reviews === null ? followedReviewIds() : state.reviews;
}
function chosenReviews() {
  const ids = reviewIds();
  return REVIEWS.filter(r => ids.indexOf(r.id) > -1).slice(0, REVIEW_SLOTS);
}

/* QR as vector SVG — shared by all four builders, assets/js/qr.js */
const qrSvg = window.GVC_QR;

