/* ============================================================
   GVC DESTINATION GUIDES - region-specific editorial data.

   Page layout and editing behavior live beside this file. Facts, POIs, map
   coordinates and citations live here so they can be reviewed without
   touching markup. Town positioning lines are supplemented at runtime from
   assets/js/nj-towns.js when a matching town exists there.

   The Monmouth guide follows the structure of the local-guide example the
   team supplied (Marli Silver's Monmouth County guide): nine neighborhoods, a
   ten-item bucket list and 48 numbered points of interest in the same nine
   groups, in the same order. Every place was checked on 5 October 2026:
   two of the example's entries no longer exist as named (Sickles Market closed
   in March 2024; Jersey Strong became Crunch Fitness in 2025) and were
   replaced with their open equivalents; "Teak Rooftop" is TEAK in Red Bank.
   Avoid storing operating hours here: those change too quickly for print.

   Coordinates place the pins on the schematic map. They are OpenStreetMap
   geocodes of the street address where one matched, otherwise the best
   available point, and are good to a few hundred metres — enough for a map
   that says "not to scale".
   ============================================================ */
(function (global) {
  'use strict';

  /* Shared agencies and pages that several entries cite. */
  const sources = {
    tourism: { label: 'Monmouth County Tourism - Travel Guide', url: 'https://tourism.visitmonmouth.com/wp-content/uploads/2024/04/Travel-Guide-Online.pdf' },
    sandyHook: { label: 'National Park Service - Gateway / Sandy Hook', url: 'https://www.nps.gov/gate/planyourvisit/sandy-hook.htm' },
    battlefield: { label: 'NJDEP - Monmouth Battlefield State Park', url: 'https://dep.nj.gov/parksandforests/state-park/monmouth-battlefield-state-park/' },
    battlefieldHistory: { label: 'American Battlefield Trust - Battle of Monmouth', url: 'https://www.battlefields.org/learn/revolutionary-war/battles/monmouth' },
    manasquan: { label: 'Monmouth County Park System - Manasquan Reservoir', url: 'https://www.monmouthcountyparks.com/page.aspx?ID=2531' },
    hartshorne: { label: 'Monmouth County Park System - Hartshorne Woods Park', url: 'https://www.monmouthcountyparks.com/page.aspx?Id=2524' },
    holmdelPark: { label: 'Monmouth County Park System - Holmdel Park', url: 'https://www.monmouthcountyparks.com/Page.aspx?ID=2526' },
    longstreet: { label: 'Monmouth County Park System - Historic Longstreet Farm', url: 'https://www.monmouthcountyparks.com/page.aspx?ID=2530&lang=en' },
    golf: { label: 'Monmouth County Park System - Golf', url: 'https://www.monmouthcountyparks.com/page.aspx?Id=2482' },
    transit: { label: 'NJ TRANSIT - North Jersey Coast Line', url: 'https://www.njtransit.com/abc_NORTH_JERSEY_COAST_LINE' },
    covenhoven: { label: 'Monmouth County Historical Association - Covenhoven House', url: 'https://www.monmouthhistory.org/covenhoven-house' },
    monmouthPark: { label: 'Oceanport - Monmouth Park history', url: 'https://www.oceanportboro.com/visitor/history' },
    monmouthU: { label: 'Monmouth University - History', url: 'https://www.monmouth.edu/about/history/' },
    grownInMonmouth: { label: 'Grown in Monmouth - farms and farmers markets', url: 'https://www.growninmonmouth.com/' }
  };

  /* One point of interest. `url` is the venue's own site wherever there is one;
     `kind` says what the link is when it is not (a transit page, the county's
     park page, a town directory). Registering the source here keeps each
     entry one line. */
  const pois = [];
  function P(id, category, name, place, note, lat, lon, url, kind, shared) {
    let key = shared;
    if (!key) {
      key = 'poi' + id;
      sources[key] = { label: name + (kind ? ' - ' + kind : ' - official site'), url: url };
    }
    pois.push({ id, category, name, place, note, lat, lon, source: key });
  }

  /* Restaurants 1-11 */
  P(1, 'restaurants', 'Anjelica\'s Restaurant', 'Sea Bright', 'Italian restaurant: antipasti, seafood and homemade pasta', 40.36282, -73.97426, 'https://www.anjelicas.com');
  P(2, 'restaurants', 'The Butcher\'s Block', 'Long Branch', 'Butcher shop and BYOB restaurant', 40.29651, -73.98903, 'https://thebutchersblocknj.com');
  P(3, 'restaurants', 'One Willow', 'Highlands', 'Waterfront seafood restaurant and raw bar on the bay', 40.40886, -74.00055, 'https://www.onewillowhighlands.com');
  P(4, 'restaurants', 'La Lupa', 'Manalapan', 'Italian trattoria with handmade pasta and wood-fired pizza', 40.2535, -74.34064, 'https://www.lalupanj.com');
  P(5, 'restaurants', 'Tommy\'s Tavern + Tap', 'Sea Bright', 'American bar and grill; the original of the local group', 40.36417, -73.97457, 'https://www.tommystavernandtap.com');
  P(6, 'restaurants', 'Peking Pavilion', 'Manalapan', 'Chinese restaurant, in Manalapan since 1983', 40.25452, -74.33742, 'https://www.pekingpavilion.com');
  P(7, 'restaurants', 'Juanito\'s', 'Red Bank', 'Family-owned Mexican restaurant, BYOB', 40.34879, -74.07324, 'http://juanitosredbank.com');
  P(8, 'restaurants', 'Taka', 'Asbury Park', 'Japanese restaurant with sushi, ramen and a sake bar', 40.21558, -74.01201, 'https://www.takaasbury.com');
  P(9, 'restaurants', 'Brando\'s Citi Cucina', 'Asbury Park', 'Italian restaurant from chef-owner Steven Botta', 40.21562, -74.01316, 'https://brandosnj.com');
  P(10, 'restaurants', 'Pascal & Sabine', 'Asbury Park', 'French brasserie with brunch and cocktails', 40.2171, -74.01019, 'https://www.pascalandsabine.com');
  P(11, 'restaurants', 'Federici\'s Family Italian', 'Freehold', 'Family-run Italian restaurant, known for pizza since 1921', 40.26028, -74.2735, 'https://www.federicis.com');

  /* Grocery 12-16 */
  P(12, 'grocery', 'Wegmans', 'Manalapan', 'Supermarket with prepared foods; other county stores too', 40.28953, -74.2983, 'https://www.wegmans.com/stores/manalapan-nj/');
  P(13, 'grocery', 'Trader Joe\'s', 'Shrewsbury', 'Neighborhood grocery, mostly private-label products', 40.319, -74.066, 'https://locations.traderjoes.com/nj/shrewsbury/608/');
  P(14, 'grocery', 'Dean\'s Natural Food Market', 'Shrewsbury', 'Natural and organic grocery with a cafe', 40.333, -74.059, 'https://www.deansnaturalfoodmarket.com/contact/');
  P(15, 'grocery', 'Delicious Orchards', 'Colts Neck', 'Farm market with bakery, deli and produce', 40.2831, -74.1735, 'https://www.deliciousorchardsnj.com/');
  P(16, 'grocery', 'Eastmont Orchards', 'Colts Neck', 'Seasonal pick-your-own orchard and fall farm activities', 40.297, -74.133, 'https://eastmontorchards.com');

  /* Shopping 17-20 */
  P(17, 'shopping', 'Freehold Raceway Mall', 'Freehold', 'Enclosed regional shopping mall', 40.2533, -74.30039, 'https://www.freeholdracewaymall.com');
  P(18, 'shopping', 'Downtown Red Bank (Broad Street)', 'Red Bank', 'Walkable shopping and dining district', 40.3476, -74.065, 'https://www.redbank.org/directory-category/shopping/', 'Red Bank RiverCenter');
  P(19, 'shopping', 'The Grove at Shrewsbury', 'Shrewsbury', 'Open-air shops and restaurants', 40.33, -74.059, 'https://www.thegroveatshrewsbury.com');
  P(20, 'shopping', 'Jersey Shore Premium Outlets', 'Tinton Falls', 'Open-air outlet center', 40.2244, -74.0941, 'https://www.premiumoutlets.com/outlet/jersey-shore');

  /* Fitness 21-25 */
  P(21, 'fitness', 'Crunch Fitness', 'Tinton Falls', 'Full-service gym; the former Jersey Strong flagship', 40.31301, -74.06654, 'https://www.crunch.com/locations/tinton-falls');
  P(22, 'fitness', 'Rumble Boxing', 'Shrewsbury', 'Boxing-inspired group fitness studio', 40.3175, -74.0665, 'https://www.rumbleboxinggym.com/location/shrewsbury');
  P(23, 'fitness', 'The MAX Challenge', 'Shrewsbury', 'Fitness studio built around a 10-week program', 40.33215, -74.07418, 'https://www.themaxchallenge.com/max-challenge-locations/');
  P(24, 'fitness', 'Pilates Blast', 'Red Bank', 'Megaformer Pilates studio on Broad Street', 40.3489, -74.0647, 'https://www.pilatesblast.com');
  P(25, 'fitness', 'OVOX Gym & Training Center', 'Morganville', 'Gym with personal training and group classes', 40.364, -74.264, 'https://ovoxgym.com');

  /* Coffee 26-30 */
  P(26, 'coffee', 'Rook Coffee', 'Oakhurst', 'Local roaster; the original Little Oakhurst cafe', 40.2653, -74.0117, 'https://rookcoffee.com/pages/locations');
  P(27, 'coffee', 'Starbucks', 'Middletown', 'Coffeehouse on Route 35', 40.41021, -74.13303, 'https://www.starbucks.com/store-locator');
  P(28, 'coffee', 'Coffee Corral', 'Red Bank', 'Local roaster and cafe', 40.344, -74.0712, 'https://www.coffeecorral.net');
  P(29, 'coffee', 'Almost Home General', 'Lincroft', 'Cafe and grab-and-go deli, the first of the brand', 40.335, -74.1688, 'https://www.almosthomegeneral.com');
  P(30, 'coffee', 'Offshore Coffee Co.', 'Long Branch', 'Local small-batch roaster and cafe', 40.2846, -73.98473, 'https://www.offshorecoffeeco.com');

  /* Great outdoors 31-35 */
  P(31, 'outdoors', 'Hartshorne Woods Park', 'Middletown', 'County park with trails and Battery Lewis', 40.3937, -74.00059, null, null, 'hartshorne');
  P(32, 'outdoors', 'Sandy Hook', 'Middletown', 'National Park beaches, Fort Hancock and the lighthouse', 40.46172, -74.00202, null, null, 'sandyHook');
  P(33, 'outdoors', 'Happy Day Farm', 'Manalapan', 'Family farm with a fall festival and pick-your-own', 40.27275, -74.38479, 'https://www.happydayfarmnj.com/');
  P(34, 'outdoors', 'Manasquan Reservoir', 'Howell', 'County reservoir with a perimeter trail and boating', 40.1694, -74.20677, null, null, 'manasquan');
  P(35, 'outdoors', 'Holmdel Park', 'Holmdel', 'County park with an arboretum and Longstreet Farm', 40.3792, -74.17944, null, null, 'holmdelPark');

  /* Public transportation 36-39 */
  P(36, 'transit', 'Aberdeen-Matawan Station', 'Matawan', 'NJ TRANSIT, North Jersey Coast Line', 40.42019, -74.22361, null, null, 'transit');
  P(37, 'transit', 'Route 522 at Tennent Road bus stop', 'Manalapan', 'NJ TRANSIT Route 139 stop in Tennent', 40.27955, -74.33431, 'https://www.visitmonmouth.com/Page.aspx?Id=2906', 'Monmouth County transit information');
  P(38, 'transit', 'Seastreak Ferry', 'Highlands', 'Commuter ferry to Manhattan from the Highlands terminal', 40.4084, -73.9895, 'https://seastreak.com/what-to-know/port-locations-directions-parking/highlands-nj/');
  P(39, 'transit', 'Middletown Station', 'Middletown', 'NJ TRANSIT, North Jersey Coast Line', 40.38939, -74.11571, null, null, 'transit');

  /* Healthcare 40-41 */
  P(40, 'healthcare', 'CentraState Medical Center', 'Freehold', 'Acute-care hospital in the Atlantic Health System', 40.23806, -74.31194, 'https://www.centrastate.com');
  P(41, 'healthcare', 'Monmouth Medical Center', 'Long Branch', 'RWJBarnabas Health teaching hospital', 40.29527, -73.98561, 'https://www.rwjbh.org/monmouth-medical-center/');

  /* Entertainment 42-48 */
  P(42, 'entertainment', 'Watermark', 'Asbury Park', 'Boardwalk bar and music lounge with ocean views', 40.2236, -73.999, 'https://www.watermarkap.com/');
  P(43, 'entertainment', 'Donovan\'s Reef', 'Sea Bright', 'Beachfront bar and grill with live music', 40.362, -73.9715, 'https://www.donovansreefbeachbar.com/');
  P(44, 'entertainment', 'TEAK Restaurant & Bar', 'Red Bank', 'Restaurant and bar with an upstairs rooftop level', 40.3478, -74.064, 'https://www.exploretock.com/teakrestaurant/', 'reservations page');
  P(45, 'entertainment', 'Red Rock Tap + Grill', 'Red Bank', 'Bar and grill with an outdoor upstairs level', 40.3523, -74.0637, 'https://www.redbank.org/directory/red-rock-tap-grill/', 'Red Bank RiverCenter listing');
  P(46, 'entertainment', 'The Seafarer', 'Highlands', 'Seasonal waterfront bar on Sandy Hook Bay with live music', 40.4035, -73.9895, 'http://www.wanderlandpopup.com/seafarer', 'operator page');
  P(47, 'entertainment', 'Count Basie Center for the Arts', 'Red Bank', 'Historic theatre and performing arts center', 40.3479, -74.0646, 'https://thebasie.org/');
  P(48, 'entertainment', 'PNC Bank Arts Center', 'Holmdel', 'Outdoor amphitheater for touring concerts', 40.39359, -74.1756, 'https://www.pncbankartscenter.com/');

  /* The bucket list: ten items, as in the example. Each cites the page for
     the place it names. */
  sources.stLaurent = { label: 'The St. Laurent - official site', url: 'https://www.thestlaurent.com/' };
  sources.stonyPony = { label: 'The Stone Pony - official site', url: 'https://www.stoneponyonline.com/' };
  sources.strollos = { label: 'Strollo\'s Lighthouse - official site', url: 'https://strolloslighthouse.com/' };
  sources.monmouthParkSite = { label: 'Monmouth Park - official site', url: 'https://www.monmouthpark.com/' };

  const monmouth = {
    id: 'monmouth',
    label: 'Monmouth County',
    state: 'New Jersey',
    title: 'Monmouth County',
    subtitle: 'Shore towns, working harbors, historic farms and real downtowns',
    issue: 'The GVC Team / Local Guide',
    coverImage: '../buyer-package/static/cover-nj.jpg',
    coverAlt: 'New Jersey lighthouse against an open blue sky',
    teamImage: '../../assets/team/founders-lifestyle.jpg',
    teamAlt: 'The GVC Team founders together outside a residence',
    welcomeTitle: 'A county with more than one center',
    welcome: [
      'Monmouth County changes character every few miles. The north shore looks toward New York Harbor; the ocean towns run from working boardwalks to quiet residential beaches; farther west, horse farms and Revolutionary-era landscapes take over.',
      'This guide is a practical first pass from The GVC Team: where the places sit, what makes each one distinct, and which experiences help a newcomer understand the county quickly.'
    ],
    overview: {
      knownFor: 'Beaches on the Atlantic and the Navesink, Revolutionary War history, Monmouth Park Racetrack, parks and working farms, a lively arts and culture scene, and respected schools such as Monmouth University.',
      history: 'The Battle of Monmouth, fought near Freehold on 28 June 1778, ended with Washington rallying the Continental Army and holding the field. Monmouth Battlefield State Park preserves the ground, and Historic Longstreet Farm interprets rural life in the 1890s.',
      architecture: 'Colonial homes such as the 1752 Covenhoven House in Freehold stand alongside Victorian beach houses, river estates and modern oceanfront properties. The right housing type depends as much on the submarket as the town name.',
      sourceKeys: ['battlefieldHistory', 'battlefield', 'longstreet', 'covenhoven', 'monmouthPark', 'monmouthU', 'grownInMonmouth']
    },
    places: [
      { name: 'Asbury Park', zone: 'Coast', fallback: 'Music, restaurants and a boardwalk city that stays active beyond summer.' },
      { name: 'Colts Neck', zone: 'Country', fallback: 'Horse farms, orchards and large-lot homes in the county\'s rural center.' },
      { name: 'Freehold', zone: 'Downtown', fallback: 'The county seat, with a walkable borough surrounded by a separate township.' },
      { name: 'Highlands', zone: 'Harbor', fallback: 'A compact bay town beside Sandy Hook, with ferry access and steep wooded streets.' },
      { name: 'Long Branch', zone: 'Coast', fallback: 'Oceanfront redevelopment beside established residential neighborhoods.' },
      { name: 'Manasquan', zone: 'Coast', fallback: 'A shore borough with an ocean beach, an inlet for boating and a station on the North Jersey Coast Line.' },
      { name: 'Middletown', zone: 'River', fallback: 'A large township of distinct neighborhoods, rail stations, riverfront and bayfront.' },
      { name: 'Monmouth Beach', zone: 'Coast', fallback: 'A small borough between the ocean and the Shrewsbury River, with beach clubs and quiet residential streets.' },
      { name: 'Red Bank', zone: 'Downtown', fallback: 'The county\'s cultural downtown, with theater, dining and a direct rail station.' }
    ],
    bucket: [
      { title: 'Start the morning at Rook Coffee', note: 'The county\'s home-grown roaster, beginning with the original Little Oakhurst cafe.', source: 'poi26' },
      { title: 'Spend a day at The St. Laurent', note: 'An adults-only seaside social club in Asbury Park with a saltwater pool, open to the public by availability.', source: 'stLaurent' },
      { title: 'Go back in history at Monmouth Battlefield', note: 'Walk the preserved Revolutionary War landscape and visitor-center exhibits in Manalapan.', source: 'battlefield' },
      { title: 'Take the Seastreak to New York', note: 'The ferry from Highlands makes the region\'s Manhattan connection tangible.', source: 'poi38' },
      { title: 'Catch a show at the Stone Pony', note: 'The Asbury Park rock club on Ocean Avenue, operating since 1974.', source: 'stonyPony' },
      { title: 'Play a round at a county golf course', note: 'The county park system runs six public courses, among them Hominy Hill in Colts Neck.', source: 'golf' },
      { title: 'Have dinner at Anjelica\'s', note: 'Family-run Italian on Ocean Avenue in Sea Bright, using local seasonal ingredients.', source: 'poi1' },
      { title: 'Get Italian ice at Strollo\'s Lighthouse', note: 'A Long Branch shop known for homemade Italian ice served from a soft-serve machine.', source: 'strollos' },
      { title: 'Browse the boutiques of Red Bank', note: 'Broad Street mixes independent shops, national retailers and restaurants.', source: 'poi18' },
      { title: 'Spend a day at Monmouth Park', note: 'Thoroughbred racing in Oceanport since 1946. Check the racing calendar before you go.', source: 'monmouthParkSite' }
    ],
    categories: [
      { id: 'restaurants', label: 'Restaurants' },
      { id: 'grocery', label: 'Grocery' },
      { id: 'shopping', label: 'Shopping' },
      { id: 'fitness', label: 'Fitness' },
      { id: 'coffee', label: 'Coffee' },
      { id: 'outdoors', label: 'Great outdoors' },
      { id: 'transit', label: 'Public transportation' },
      { id: 'healthcare', label: 'Healthcare' },
      { id: 'entertainment', label: 'Entertainment' }
    ],
    pois: pois,
    favorites: [
      { person: 'Team favorite', pick: 'A first walk at Sandy Hook', location: 'Middletown', note: 'Start at the lighthouse, then keep going until the harbor and skyline open up.' },
      { person: 'Team favorite', pick: 'Red Bank before a show', location: 'Red Bank', note: 'Dinner downtown, a walk toward the river, then the Count Basie Center.' },
      { person: 'Team favorite', pick: 'The high trail at Hartshorne', location: 'Highlands', note: 'The county feels completely different from the wooded ridge above the Navesink.' },
      { person: 'Team favorite', pick: 'A slow reservoir lap', location: 'Howell', note: 'Go early, take the perimeter trail, and leave enough time for the wildlife overlooks.' }
    ],
    sources: sources,
    sourceSummary: 'official venue sites, Monmouth County Park System, NJ TRANSIT, National Park Service, NJDEP, Monmouth County Tourism and local historical sources',
    sourceNote: 'Sources checked 5 October 2026. Verify seasonal access, transit schedules and business details before distribution.'
  };

  global.GVC_DESTINATION_GUIDES = {
    defaultRegion: 'monmouth',
    regions: { monmouth: monmouth }
  };
})(typeof window !== 'undefined' ? window : globalThis);
