/* ============================================================
   GVC DESTINATION GUIDES - region-specific editorial data.

   Page layout and editing behavior live beside this file. Facts, POIs, map
   coordinates and citations live here so they can be reviewed without
   touching markup. Town positioning lines are supplemented at runtime from
   assets/js/nj-towns.js when a matching town exists there.

   Each region is built in its own block below. The Monmouth guide follows the structure of the local-guide example the
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

  /* One point of interest. `url` is the venue's own site wherever there is one;
     `kind` says what the link is when it is not (a transit page, the county's
     park page, a town directory). Registering the source here keeps each
     entry one line. Each region keeps its own sources and POIs. */
  function poiBook(sources) {
    const pois = [];
    function P(id, category, name, place, note, lat, lon, url, kind, shared) {
      let key = shared;
      if (!key) {
        key = 'poi' + id;
        sources[key] = { label: name + (kind ? ' - ' + kind : ' - official site'), url: url };
      }
      pois.push({ id, category, name, place, note, lat, lon, source: key });
    }
    return { pois, P };
  }

  /* The nine directory groups, in the order of the team's example guide. */
  const categories = [
    { id: 'restaurants', label: 'Restaurants' },
    { id: 'grocery', label: 'Grocery' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'fitness', label: 'Fitness' },
    { id: 'coffee', label: 'Coffee' },
    { id: 'outdoors', label: 'Great outdoors' },
    { id: 'transit', label: 'Public transportation' },
    { id: 'healthcare', label: 'Healthcare' },
    { id: 'entertainment', label: 'Entertainment' }
  ];

  /* ---------------------------------------------------------- MONMOUTH */
  const monmouth = (function () {
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

    const { pois, P } = poiBook(sources);

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

    /* The Atlantic coast and the north-shore bays, from real shoreline points.
       Each water polygon runs out past the frame and is clipped there. */
    const SHORE_OCEAN = [[40.4672, -74.0105], [40.4540, -73.9990], [40.4300, -73.9880], [40.4000, -73.9800], [40.3620, -73.9690],
      [40.3340, -73.9690], [40.3040, -73.9730], [40.2480, -73.9980], [40.2200, -73.9990], [40.2000, -74.0100],
      [40.1780, -74.0200], [40.1255, -74.0330]];
    const SHORE_BAY = [[40.4672, -74.0105], [40.4400, -74.0300], [40.4040, -74.0000], [40.4085, -74.0330], [40.4170, -74.0600],
      [40.4170, -74.0990], [40.4400, -74.1300], [40.4370, -74.2000], [40.4350, -74.2400]];

    return {
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
      bucketLede: 'coffee, a show, the ferry, a round of golf, dinner by the water and a day at the track',
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
      categories: categories,
      pois: pois,
      map: {
        title: 'From bay to ocean',
        bounds: [[40.4672, -74.3846], [40.1255, -73.969]],
        water: [
          SHORE_OCEAN.concat([[40.1255, -72.5], [41.5, -72.5], [41.5, -74.0105]]),
          SHORE_BAY.concat([[40.4350, -75.5], [41.5, -75.5], [41.5, -74.0105]])
        ],
        coasts: [SHORE_OCEAN, SHORE_BAY],
        labels: [
          { text: 'ATLANTIC OCEAN', corner: 'br' },
          { text: 'SANDY HOOK BAY / RARITAN BAY', corner: 'tl' }
        ]
      },
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
  })();

  /* ------------------------------------------------------------ OCEAN */
  /* Ocean County follows the Monmouth structure: nine places, ten bucket-list
     items and 48 points of interest in the same nine groups. Every venue was
     checked on 8 October 2026 for 2025-26 evidence that it is open (a current
     site, dated menus or events, recent press). Seasonal places are marked in
     their notes. Coordinates are OpenStreetMap geocodes (Nominatim or Photon)
     or US Census geocodes of the street address; districts, parks and the LBI
     shuttle use a representative point. Park facts come from Wikipedia where
     the NJDEP pages refuse automated reads. */
  const ocean = (function () {
    const sources = {
      wikiOcean: { label: 'Wikipedia - Ocean County, New Jersey', url: 'https://en.wikipedia.org/wiki/Ocean_County,_New_Jersey' },
      huddy: { label: 'Wikipedia - Joshua Huddy', url: 'https://en.wikipedia.org/wiki/Joshua_Huddy' },
      barnegatLight: { label: 'Wikipedia - Barnegat Lighthouse', url: 'https://en.wikipedia.org/wiki/Barnegat_Lighthouse' },
      hindenburg: { label: 'Wikipedia - Hindenburg disaster', url: 'https://en.wikipedia.org/wiki/Hindenburg_disaster' },
      doubleTrouble: { label: 'Wikipedia - Double Trouble State Park', url: 'https://en.wikipedia.org/wiki/Double_Trouble_State_Park' },
      islandBeach: { label: 'Wikipedia - Island Beach State Park', url: 'https://en.wikipedia.org/wiki/Island_Beach_State_Park' },
      bayHead: { label: 'Wikipedia - Bay Head, New Jersey', url: 'https://en.wikipedia.org/wiki/Bay_Head,_New_Jersey' },
      islandHeights: { label: 'Wikipedia - Island Heights, New Jersey', url: 'https://en.wikipedia.org/wiki/Island_Heights,_New_Jersey' },
      lbi: { label: 'Wikipedia - Long Beach Island', url: 'https://en.wikipedia.org/wiki/Long_Beach_Island' },
      manchester: { label: 'Wikipedia - Manchester Township, New Jersey', url: 'https://en.wikipedia.org/wiki/Manchester_Township,_New_Jersey' },
      tuckerton: { label: 'Tuckerton Seaport - About', url: 'https://www.tuckertonseaport.org/about/' },
      tuckertonFerry: { label: 'Tuckerton Seaport - ferry tickets', url: 'https://tuckertonseaport.org/booknow/' },
      vikingVillage: { label: 'Viking Village - official site', url: 'https://www.vikingvillage.net/' },
      surflightHistory: { label: 'Wikipedia - Surflight Theatre', url: 'https://en.wikipedia.org/wiki/Surflight_Theatre' }
    };
    const { pois, P } = poiBook(sources);

    /* Restaurants 1-11 */
    P(1, 'restaurants', 'The Shrimp Box', 'Point Pleasant Beach', 'Seafood restaurant with patio bar on the Manasquan Inlet', 40.10185, -74.03709, 'https://theshrimpbox.com/');
    P(2, 'restaurants', 'Half Moon Point', 'Point Pleasant', 'Seafood, steaks and American fare on Bridge Avenue', 40.07162, -74.06664, 'https://www.halfmoonpoint.com/');
    P(3, 'restaurants', 'Klotz\'s Kitchen', 'Point Pleasant', 'Breakfast and lunch luncheonette with daily specials', 40.07232, -74.07102, 'https://www.klotzskitchen.com/');
    P(4, 'restaurants', 'Charlie\'s of Bay Head', 'Bay Head', 'Contemporary American dining near Twilight Lake', 40.07063, -74.04601, 'https://www.charliesofbayhead.com/');
    P(5, 'restaurants', 'River Rock Restaurant & Marina Bar', 'Brick', 'Waterfront bar and eatery on the Manasquan River', 40.09715, -74.0867, 'https://riverrockbricknj.com/');
    P(6, 'restaurants', 'Ohana Grill', 'Lavallette', 'Hawaiian-inspired BYOB restaurant', 39.98012, -74.06705, 'https://www.theohanagrill.com/');
    P(7, 'restaurants', 'Villa Amalfi', 'Toms River', 'Italian restaurant on Route 166', 39.97094, -74.20463, 'https://www.villaamalfitomsriver.com/');
    P(8, 'restaurants', 'Artisan\'s Restaurant & Brewery', 'Toms River', 'Brewpub with house beers, seafood and steaks', 39.97676, -74.18287, 'https://www.artisanstomsriver.com/');
    P(9, 'restaurants', 'The Chicken or the Egg', 'Beach Haven', 'LBI breakfast and wings spot known as the Chegg', 39.56456, -74.23921, 'https://www.letschegg.com/');
    P(10, 'restaurants', 'Daddy O', 'Brant Beach', 'Hotel restaurant with a rooftop bar on LBI', 39.62985, -74.19082, 'https://www.daddyolbi.com/');
    P(11, 'restaurants', 'Surf City Hotel', 'Surf City', 'Historic LBI hotel with bistro, clam bar and sushi bar', 39.65979, -74.16725, 'https://surfcityhotel.com/');

    /* Grocery 12-16 */
    P(12, 'grocery', 'Spike\'s Seafood', 'Point Pleasant Beach', 'Fish market and casual seafood restaurant', 40.10055, -74.04791, 'https://www.spikesseafood.com/');
    P(13, 'grocery', 'Big Ed\'s Produce', 'Lavallette', 'Seasonal Jersey produce stand on Route 35', 39.97775, -74.06764, 'http://bigedsproduce.com/');
    P(14, 'grocery', 'Trader Joe\'s', 'Brick', 'Neighborhood grocery, mostly private-label products', 40.05724, -74.14088, 'https://locations.traderjoes.com/nj/brick/615/');
    P(15, 'grocery', 'Downtown Toms River Farmers Market', 'Toms River', 'Seasonal Wednesday market in the Town Hall courtyard', 39.95285, -74.19583, 'https://downtowntomsriver.com/farmers-market/', 'Downtown Toms River organizer page');
    P(16, 'grocery', 'Murphy\'s Market', 'Beach Haven', 'Family-run grocery with deli on Bay Avenue', 39.56349, -74.23997, 'https://www.murphysmarkets.com/');

    /* Shopping 17-20 */
    P(17, 'shopping', 'Ocean County Mall', 'Toms River', 'Regional shopping mall on Hooper Avenue', 39.9851, -74.17915, 'https://www.simon.com/mall/ocean-county-mall');
    P(18, 'shopping', 'Bay Head shops', 'Bay Head', 'Independent shops and cafes along Bridge Avenue', 40.07031, -74.0446, 'https://www.bayhead.org/', 'Bay Head Business Association');
    P(19, 'shopping', 'Bay Village', 'Beach Haven', 'Fishing-village-style cluster of shops and eateries', 39.56915, -74.2363, 'https://www.bayvillagelbi.com/');
    P(20, 'shopping', 'Point Pleasant Antique Emporium', 'Point Pleasant Beach', 'Antiques, collectibles and nautical decor', 40.09178, -74.05013, 'https://www.pointpleasantantiques.com/');

    /* Fitness 21-25 */
    P(21, 'fitness', 'Xhale Hot Yoga Studio', 'Point Pleasant Beach', 'Infrared hot yoga, barre and Pilates on Arnold Avenue', 40.09174, -74.04876, 'https://www.xhalehotyoga.com/');
    P(22, 'fitness', 'Regimen', 'Point Pleasant Beach', 'Group training classes plus a recovery lounge', 40.09174, -74.04871, 'https://regimennj.com/');
    P(23, 'fitness', 'This Is Yoga NJ', 'Lavallette', 'Yoga studio that also runs beach yoga in Lavallette', 39.97178, -74.06861, 'https://www.thisisyoganj.com/');
    P(24, 'fitness', 'Yoga Bohemia', 'Surf City', 'LBI yoga studio with four island locations', 39.65489, -74.17162, 'https://www.yogabohemianj.com/');
    P(25, 'fitness', 'Crunch Fitness', 'Toms River', 'Full-service gym in the Bay Avenue shopping plaza', 39.97646, -74.18115, 'https://www.crunch.com/locations/toms-river');

    /* Coffee 26-30 */
    P(26, 'coffee', 'Spire Coffeehouse', 'Toms River', 'Local favorite on Hooper Avenue, second shop on Main Street', 40.01781, -74.1461, 'https://www.spirecoffeehouse.com/');
    P(27, 'coffee', 'How You Brewin Coffee Company', 'Surf City', 'LBI coffeehouse since 2004 with a cafe menu', 39.65504, -74.17112, 'https://www.howyoubrewin.com/');
    P(28, 'coffee', 'Divi Tree Coffee', 'Point Pleasant', 'Family-owned cafe; house blends ground to order', 40.07443, -74.0795, 'https://www.divitreecoffee.com/');
    P(29, 'coffee', 'Taylor Sam\'s', 'Bay Head', 'Scratch kitchen with a coffee bar on Bridge Avenue', 40.07055, -74.04482, 'https://www.taylorsams.com/');
    P(30, 'coffee', 'Guapo\'s Coffee House', 'Beach Haven', 'Small-batch coffee and matcha; open May to January', 39.56413, -74.24009, 'https://guaposcoffee.com/');

    /* Great outdoors 31-35 */
    P(31, 'outdoors', 'Island Beach State Park', 'Seaside Park', 'Ten miles of undeveloped barrier-island beach', 39.90632, -74.08149, 'https://dep.nj.gov/parksandforests/state-park/island-beach-state-park/', 'NJDEP State Parks page');
    P(32, 'outdoors', 'Barnegat Lighthouse State Park', 'Barnegat Light', '217-step lighthouse climb and maritime forest trail', 39.76434, -74.10621, 'https://dep.nj.gov/parksandforests/state-park/barnegat-lighthouse-state-park/', 'NJDEP State Parks page');
    P(33, 'outdoors', 'Cattus Island County Park', 'Toms River', '530 acres of trails, boardwalk and a nature center', 39.9777, -74.13383, 'https://www.oceancountyparks.org/frmRegContentPrks.aspx?ID=0751673c-9513-4ecc-8f3e-3e65b0f2ec45', 'Ocean County Parks page');
    P(34, 'outdoors', 'Double Trouble State Park', 'Bayville', 'Pinelands trails, a cranberry village and paddling', 39.8979, -74.2207, 'https://dep.nj.gov/parksandforests/state-park/double-trouble-state-park/', 'NJDEP State Parks page');
    P(35, 'outdoors', 'Jenkinson\'s Beach', 'Point Pleasant Beach', 'Guarded ocean beach beside the boardwalk', 40.0944, -74.03731, 'https://www.jenkinsons.com/beach/');

    /* Public transportation 36-39 */
    P(36, 'transit', 'Point Pleasant Beach Station', 'Point Pleasant Beach', 'NJ TRANSIT, North Jersey Coast Line to Penn Station', 40.09286, -74.04806, 'https://www.njtransit.com/station/point-pleasant-beach-station', 'NJ TRANSIT station page');
    P(37, 'transit', 'Bay Head Station', 'Bay Head', 'Southern end of the North Jersey Coast Line', 40.07722, -74.04607, 'https://www.njtransit.com/station/bay-head-station', 'NJ TRANSIT station page');
    P(38, 'transit', 'Toms River Park & Ride', 'Toms River', 'NJ TRANSIT commuter buses at Parkway Exit 81', 39.95181, -74.20525, 'https://www.njtransit.com/station/toms-river-park-ride', 'NJ TRANSIT station page');
    P(39, 'transit', 'LBI Shuttle', 'Long Beach Island', 'Seasonal shuttle along Long Beach Boulevard', 39.61618, -74.19947, 'https://www.longbeachtownship.com/lbi-shuttle/', 'Long Beach Township page');

    /* Healthcare 40-41: Toms River for the mainland, Manahawkin for LBI */
    P(40, 'healthcare', 'Community Medical Center', 'Toms River', 'RWJBarnabas Health hospital', 39.96394, -74.21576, 'https://www.rwjbh.org/community-medical-center/');
    P(41, 'healthcare', 'Southern Ocean Medical Center', 'Manahawkin', 'Hackensack Meridian hospital', 39.72106, -74.28469, 'https://www.hackensackmeridianhealth.org/en/locations/southern-ocean-medical-center');

    /* Entertainment 42-48 */
    P(42, 'entertainment', 'Jenkinson\'s Boardwalk & Aquarium', 'Point Pleasant Beach', 'Rides, arcades, mini golf and an aquarium', 40.09433, -74.0373, 'https://www.jenkinsons.com/');
    P(43, 'entertainment', 'Casino Pier & Breakwater Beach', 'Seaside Heights', 'Oceanfront pier rides plus a summer waterpark', 39.94296, -74.06944, 'https://www.casinopiernj.com/');
    P(44, 'entertainment', 'Surflight Theatre', 'Beach Haven', 'Professional theatre, since 1950', 39.56266, -74.23909, 'https://www.surflight.org/');
    P(45, 'entertainment', 'Fantasy Island Amusement Park', 'Beach Haven', 'Family rides, games and an arcade', 39.56837, -74.2378, 'https://fantasyislandlbi.com/');
    P(46, 'entertainment', 'Jersey Shore BlueClaws', 'Lakewood', 'Phillies High-A baseball', 40.07507, -74.18689, 'https://www.milb.com/jersey-shore');
    P(47, 'entertainment', 'Grunin Center for the Arts', 'Toms River', 'Concerts, theatre and talks at Ocean County College', 40.00934, -74.16636, 'https://www.grunincenter.org/');
    P(48, 'entertainment', 'Martell\'s Tiki Bar', 'Point Pleasant Beach', 'Oceanfront boardwalk bar with live bands and DJs', 40.09488, -74.03608, 'https://www.tikibar.com/');

    /* Shorelines, north to south, where OSM coastline crosses each latitude.
       The ocean beach runs from the Manasquan Inlet to Holgate; the barrier
       islands' back shore and the mainland shore bound Barnegat Bay and
       Little Egg Harbor (the mainland line dips into the Toms River mouth). */
    const OCEAN = [[40.1026, -74.0345], [40.09, -74.036], [40.07, -74.0414], [40.05, -74.0459], [40.03, -74.0508], [40.01, -74.0557],
      [39.97, -74.0646], [39.935, -74.0707], [39.9, -74.0787], [39.86, -74.084], [39.82, -74.0888], [39.78, -74.0938],
      [39.76, -74.0971], [39.72, -74.1248], [39.68, -74.1484], [39.64, -74.1794], [39.6, -74.2071], [39.56, -74.2363],
      [39.52, -74.2774], [39.5, -74.3002]];
    const BAYSIDE = [[40.06, -74.0488], [40.03, -74.0546], [40.01, -74.0594], [39.97, -74.0742], [39.935, -74.0796], [39.9, -74.0866],
      [39.86, -74.0878], [39.82, -74.0946], [39.78, -74.1004], [39.76, -74.1105], [39.72, -74.13], [39.68, -74.1547],
      [39.64, -74.1854], [39.6, -74.2153], [39.56, -74.2457], [39.52, -74.283]];
    const MAINLAND = [[40.06, -74.067], [40.05, -74.0804], [40.03, -74.08], [40.01, -74.1071], [39.99, -74.1137], [39.95, -74.1138],
      [39.942, -74.15], [39.92, -74.1101], [39.9, -74.1336], [39.86, -74.1295], [39.82, -74.1616], [39.78, -74.1871],
      [39.74, -74.178], [39.72, -74.1832], [39.68, -74.1893], [39.64, -74.2504], [39.62, -74.263], [39.6, -74.308],
      [39.58, -74.3267]];

    return {
      id: 'ocean',
      label: 'Ocean County',
      state: 'New Jersey',
      title: 'Ocean County',
      subtitle: 'Ocean, bay and pines: forty miles of barrier beach and the woods behind',
      issue: 'The GVC Team / Local Guide',
      coverImage: '../../assets/img/nj/ocean-county-cover.jpg',
      coverAlt: 'A sandy path through beach grass to the ocean',
      teamImage: '../../assets/team/founders-lifestyle.jpg',
      teamAlt: 'The GVC Team founders together outside a residence',
      welcomeTitle: 'A county built in layers',
      welcome: [
        'Ocean County is built in layers. On the east, roughly forty miles of barrier beach hold back the Atlantic, from Bay Head\'s shingled cottages to the full length of Long Beach Island. Behind them, Barnegat Bay and Little Egg Harbor form a sheltered inland water, and the river towns of Toms River and Island Heights look out across it.',
        'Further west the county turns to the Pine Barrens, where Cedar Creek feeds old cranberry bogs and Manchester\'s quieter communities sit among the trees. This guide follows that line from shore to woods: the boardwalks and the lighthouse, the bay towns and seaports, and the places we send our own clients first.'
      ],
      overview: {
        knownFor: 'Roughly forty miles of barrier beach on the Atlantic, enclosing Barnegat Bay and Little Egg Harbor. Behind the bays the county opens into the Pine Barrens, where Double Trouble State Park preserves a cranberry company town on 8,495 acres.',
        history: 'Ocean County was formed from part of Monmouth County on 15 February 1850, with Toms River as its seat. In March 1782 Loyalists overran Captain Joshua Huddy\'s blockhouse at Toms River and burned the village. Barnegat Lighthouse was first lit in 1859, and the Hindenburg burned at Lakehurst on 6 May 1937.',
        architecture: 'Bay Head\'s historic district holds more than 550 contributing buildings, many Shingle, Stick and Queen Anne style. Island Heights keeps Queen Anne and Gothic Revival houses on a bluff above the Toms River. On the islands, post-Sandy flood maps decide how high a house sits; inland, Whiting is largely retirement communities.',
        sourceKeys: ['wikiOcean', 'huddy', 'barnegatLight', 'hindenburg', 'doubleTrouble', 'bayHead', 'islandHeights', 'lbi', 'manchester']
      },
      places: [
        { name: 'Bay Head', zone: 'Coast', fallback: 'A small shore borough whose historic district holds more than 550 Shingle, Stick and Queen Anne buildings.' },
        { name: 'Beach Haven', zone: 'Island', fallback: 'Long Beach Island\'s town center, with a theater, an amusement park and a summer market.' },
        { name: 'Brick', zone: 'Bay', fallback: 'A large township along the Metedeconk River and Barnegat Bay.' },
        { name: 'Island Heights', zone: 'River', fallback: 'An 1878 camp-meeting town on a bluff above the Toms River, now a historic district.' },
        { name: 'Lavallette', zone: 'Peninsula', fallback: 'A small borough on the Barnegat Peninsula with protected ocean beaches and bayside beaches.' },
        { name: 'Point Pleasant', zone: 'River', fallback: 'A year-round river town next door to the boardwalk.' },
        { name: 'Point Pleasant Beach', zone: 'Coast', fallback: 'A mile-long boardwalk running south from the Manasquan Inlet, with Jenkinson\'s at its center.' },
        { name: 'Toms River', zone: 'Downtown', fallback: 'The county seat, running from a riverfront downtown to Ortley Beach on the barrier island.' },
        { name: 'Whiting', zone: 'Pines', fallback: 'Active-adult communities among the pines in Manchester Township.' }
      ],
      bucketLede: 'a lighthouse, a boardwalk, a seaport, scallops off the dock, a show and a walk in the pines',
      bucket: [
        { title: 'Climb Barnegat Lighthouse', note: '217 steps to the top of "Old Barney", designed by George Meade and first lit in 1859.', source: 'barnegatLight' },
        { title: 'Walk the dunes at Island Beach', note: 'A barrier-island state park preserved in its natural state, south of Seaside Park.', source: 'islandBeach' },
        { title: 'Ride the Jenkinson\'s Boardwalk', note: 'Rides, arcades, mini golf and an aquarium with penguins and seals in Point Pleasant Beach.', source: 'poi42' },
        { title: 'Explore Tuckerton Seaport', note: 'A 40-acre baymen\'s museum on Tuckerton Creek, with historic buildings and a decoy collection.', source: 'tuckerton' },
        { title: 'Take the Seaport ferry to Beach Haven', note: 'A narrated summer crossing of the bay. Check the season dates before you go.', source: 'tuckertonFerry' },
        { title: 'Buy scallops at Viking Village', note: 'Barnegat Light\'s commercial fishing dock, in use since the 1920s, sells its catch at the dock.', source: 'vikingVillage' },
        { title: 'Catch a show at Surflight Theatre', note: 'Beach Haven\'s professional theatre, founded in 1950, runs a full mainstage season.', source: 'surflightHistory' },
        { title: 'Tour Double Trouble\'s cranberry village', note: 'Restored bogs, a sawmill and a packing house from a Pine Barrens company town.', source: 'doubleTrouble' },
        { title: 'Spend an evening at Fantasy Island', note: 'Beach Haven\'s family amusement park, with rides, games and an arcade.', source: 'poi45' },
        { title: 'Walk Island Heights', note: 'A historic district of Victorian houses on a bluff above the Toms River.', source: 'islandHeights' }
      ],
      categories: categories,
      pois: pois,
      map: {
        title: 'Inlet to inlet',
        tall: true,
        bounds: [[40.1026, -74.0345], [39.53, -74.30]],
        water: [
          OCEAN.concat([[39.5, -72.5], [41.5, -72.5], [41.5, -74.0345]]),
          BAYSIDE.concat([[39.5, -74.3002], [39.5, -74.34]], MAINLAND.slice().reverse())
        ],
        coasts: [OCEAN, BAYSIDE, MAINLAND],
        labels: [
          { text: 'ATLANTIC OCEAN', corner: 'br' },
          { text: 'BARNEGAT BAY', lat: 39.84, lon: -74.118, rotate: -68 }
        ]
      },
      favorites: [
        { person: 'Team favorite', pick: 'An early walk at Island Beach', location: 'Seaside Park', note: 'Go past the first lots and keep walking; the dunes stay undeveloped for miles.' },
        { person: 'Team favorite', pick: 'The top of Old Barney', location: 'Barnegat Light', note: 'Climb the lighthouse, then walk out along the jetty toward the inlet.' },
        { person: 'Team favorite', pick: 'Bay Head before the crowds', location: 'Bay Head', note: 'Coffee on Bridge Avenue, then a loop past the shingled cottages to the beach.' },
        { person: 'Team favorite', pick: 'A summer night on LBI', location: 'Beach Haven', note: 'Dinner downtown, a show at Surflight, then a lap of Bay Village.' }
      ],
      sources: sources,
      sourceSummary: 'official venue sites, NJ TRANSIT, NJDEP State Parks, Ocean County Parks, Tuckerton Seaport and Wikipedia for history and park facts',
      sourceNote: 'Sources checked 8 October 2026. Many shore businesses are seasonal: verify hours, transit schedules and business details before distribution.'
    };
  })();

  global.GVC_DESTINATION_GUIDES = {
    defaultRegion: 'monmouth',
    regions: { monmouth: monmouth, ocean: ocean }
  };
})(typeof window !== 'undefined' ? window : globalThis);
