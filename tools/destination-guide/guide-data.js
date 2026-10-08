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
      coverImage: '../../assets/img/nj/monmouth-cover.jpg',
      coverAlt: 'Asbury Park Convention Hall on the ocean under a stormy sky',
      /* Page photographs (Pexels, free licence): cover 22765211, field
         22765206, places 37329949, favorites 13570584. `pos` is the crop focus. */
      photos: {
        field: { src: '../../assets/img/nj/monmouth-boardwalk.jpg', alt: 'The Asbury Park boardwalk lined with murals', caption: 'The Asbury Park boardwalk', pos: 'center 62%' },
        places: { src: '../../assets/img/nj/monmouth-surf.jpg', alt: 'A wave breaking at Asbury Park beach', caption: 'Surf at Asbury Park', pos: 'center 55%' },
        favorites: { src: '../../assets/img/nj/monmouth-beach.jpg', alt: 'Asbury Park beach and the Atlantic on a calm day', caption: 'Asbury Park beach', pos: 'center 60%' }
      },
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
      coverAlt: 'Barnegat Lighthouse rising above the dune grass on Long Beach Island',
      /* Page photographs (Pexels, free licence): cover 23407598, field
         8932871, places 18500756, favorites 38647881. `pos` is the crop focus. */
      photos: {
        field: { src: '../../assets/img/nj/ocean-lagoons.jpg', alt: 'Lagoon streets and salt marsh in Little Egg Harbor Township from the air', caption: 'Lagoon streets in Little Egg Harbor Township', pos: 'center 55%' },
        places: { src: '../../assets/img/nj/ocean-casino-pier.jpg', alt: 'The Casino Pier Ferris wheel against a summer sky', caption: 'Casino Pier, Seaside Heights', pos: 'center 45%' },
        favorites: { src: '../../assets/img/nj/ocean-dunes.jpg', alt: 'Dune grass and a sand fence at sunset on the Jersey Shore', caption: 'The dunes at sunset', pos: 'center 70%' }
      },
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

  /* ------------------------------------------------------------ MIDDLESEX */
  /* Middlesex County follows the same structure as Monmouth and Ocean: nine
     places, ten bucket-list items and 48 points of interest in the same nine
     groups. Every venue was checked on 8 October 2026 for 2025-26 evidence
     that it is open (a live site with current content, dated events, recent
     press). Coordinates are OpenStreetMap geocodes of the street address.
     County facts come from Wikipedia and the county and state park pages.
     The map's shorelines (Raritan Bay, the Arthur Kill, Staten Island's shore
     and the Raritan River) are OpenStreetMap data, simplified.
     Page photographs are Wikimedia Commons: the cover (Carol M. Highsmith,
     CC0), the Cheesequake marsh (State of New Jersey, public domain) and the
     Perth Amboy Victorians (public domain) need no credit; the New Brunswick
     skyline is CC BY 3.0 (Forevaclevah) and carries its credit in the caption. */
  const middlesex = (function () {
    const sources = {
      wikiMiddlesex: { label: 'Wikipedia - Middlesex County, New Jersey', url: 'https://en.wikipedia.org/wiki/Middlesex_County,_New_Jersey' },
      wikiNewBrunswick: { label: 'Wikipedia - New Brunswick, New Jersey', url: 'https://en.wikipedia.org/wiki/New_Brunswick,_New_Jersey' },
      wikiPerthAmboy: { label: 'Wikipedia - Perth Amboy, New Jersey', url: 'https://en.wikipedia.org/wiki/Perth_Amboy,_New_Jersey' },
      wikiMenlo: { label: 'Wikipedia - Menlo Park, New Jersey', url: 'https://en.wikipedia.org/wiki/Menlo_Park,_New_Jersey' },
      wikiEdison: { label: 'Wikipedia - Edison, New Jersey', url: 'https://en.wikipedia.org/wiki/Edison,_New_Jersey' },
      wikiCranbury: { label: 'Wikipedia - Cranbury, New Jersey', url: 'https://en.wikipedia.org/wiki/Cranbury,_New_Jersey' },
      wikiMetuchen: { label: 'Wikipedia - Metuchen, New Jersey', url: 'https://en.wikipedia.org/wiki/Metuchen,_New_Jersey' },
      wikiHighlandPark: { label: 'Wikipedia - Highland Park, New Jersey', url: 'https://en.wikipedia.org/wiki/Highland_Park,_New_Jersey' },
      wikiSouthAmboy: { label: 'Wikipedia - South Amboy, New Jersey', url: 'https://en.wikipedia.org/wiki/South_Amboy,_New_Jersey' },
      wikiOldBridge: { label: 'Wikipedia - Old Bridge Township, New Jersey', url: 'https://en.wikipedia.org/wiki/Old_Bridge_Township,_New_Jersey' },
      cheesequakeWiki: { label: 'Wikipedia - Cheesequake State Park', url: 'https://en.wikipedia.org/wiki/Cheesequake_State_Park' },
      stateTheatreWiki: { label: 'Wikipedia - State Theatre (New Brunswick, New Jersey)', url: 'https://en.wikipedia.org/wiki/State_Theatre_(New_Brunswick,_New_Jersey)' },
      canal: { label: 'Wikipedia - Delaware and Raritan Canal', url: 'https://en.wikipedia.org/wiki/Delaware_and_Raritan_Canal' },
      football1869: { label: 'Wikipedia - 1869 college football season', url: 'https://en.wikipedia.org/wiki/1869_college_football_season' }
    };
    const { pois, P } = poiBook(sources);

    /* Restaurants 1-11 */
    P(1, 'restaurants', 'Catherine Lombardi', 'New Brunswick', 'Italian restaurant with fresh pasta, steaks and seafood on Livingston Avenue', 40.49379, -74.44382, 'https://www.catherinelombardi.com/');
    P(2, 'restaurants', 'Efe\'s Mediterranean Grill', 'New Brunswick', 'Turkish and Greek grill on Easton Avenue', 40.49739, -74.44805, 'https://efesgrill.com/');
    P(3, 'restaurants', 'Terzo', 'Metuchen', 'Farm-fresh Italian with pasta made daily', 40.54174, -74.3625, 'https://www.terzonj.com/');
    P(4, 'restaurants', 'Wood Stack Pizza Kitchen', 'Metuchen', 'Pizza kitchen on Lake Avenue, with a second location in Pine Brook', 40.5384, -74.36454, 'https://woodstacknj.com/');
    P(5, 'restaurants', 'Merey Venezuelan Cuisine', 'Highland Park', 'Arepas, cachapas and empanadas made from scratch', 40.49817, -74.43119, 'https://www.mereyrestaurant.com/');
    P(6, 'restaurants', 'Edison Diner', 'Edison', 'Route 1 diner serving food made from scratch', 40.49734, -74.41198, 'https://edisondiner.com/');
    P(7, 'restaurants', 'Quintana\'s Mexican Restaurant & Bakery', 'Perth Amboy', 'Family-owned Mexican restaurant and bakery on Smith Street', 40.51131, -74.27726, 'https://www.quintanasmexicanrestaurant.com');
    P(8, 'restaurants', 'Mezcal', 'Old Bridge', 'Modern Mexican steakhouse with dry-aged steaks and rare tequilas', 40.41047, -74.35512, 'https://www.mezcalnj.com/');
    P(9, 'restaurants', 'The Cranbury Inn', 'Cranbury', 'Historic village inn on South Main Street, said to have hosted Aaron Burr in 1804', 40.3078, -74.51753, 'https://www.thecranburyinn.com/');
    P(10, 'restaurants', 'Blue Moon', 'South Amboy', 'Gastropub and blues bar with a large tap list and live music', 40.48263, -74.27985, 'https://www.bluemoonsouthamboy.com/');
    P(11, 'restaurants', 'The Armory', 'Perth Amboy', 'Seafood and steaks in a restored wartime ammunition building on the waterfront', 40.5039, -74.26311, 'https://www.armorynj.com/');

    /* Grocery 12-16 */
    P(12, 'grocery', 'George Street Co-op', 'New Brunswick', 'Member-owned natural foods store on Morris Street', 40.49177, -74.44501, 'https://georgestreetcoop.com');
    P(13, 'grocery', 'Highland Park Farmers Market', 'Highland Park', 'Seasonal Friday market in Market Square on Raritan Avenue', 40.49835, -74.42911, 'https://www.hpboro.com/', 'Borough of Highland Park');
    P(14, 'grocery', 'Patel Brothers', 'Edison', 'Indian grocery on Oak Tree Road', 40.57148, -74.34364, 'https://www.patelbros.com/');
    P(15, 'grocery', 'Stults Farm', 'Cranbury', 'Family farm stand that sells only what it grows, plus a CSA', 40.3094, -74.5534, 'https://stultsfarm.com/');
    P(16, 'grocery', 'SuperFresh Market', 'Highland Park', 'Neighborhood supermarket on Raritan Avenue', 40.49929, -74.42475, 'https://www.superfreshmarket.com/highland');

    /* Shopping 17-20 */
    P(17, 'shopping', 'Menlo Park Mall', 'Edison', 'Two-level regional mall', 40.54717, -74.33545, 'https://www.simon.com/mall/menlo-park-mall');
    P(18, 'shopping', 'Downtown Metuchen', 'Metuchen', 'Walkable Main Street of independent shops and restaurants', 40.54075, -74.3608, 'https://www.downtownmetuchen.org/', 'Metuchen Downtown Alliance');
    P(19, 'shopping', 'Oak Tree Road', 'Edison', 'A 1.5-mile South Asian shopping and dining strip across Edison and Iselin', 40.57299, -74.33636, 'https://en.wikipedia.org/wiki/Edison,_New_Jersey', 'Wikipedia, Edison');
    P(20, 'shopping', 'Woodbridge Center', 'Woodbridge', 'Regional mall with more than 50 stores, a cinema and an arcade', 40.55587, -74.29858, 'https://www.woodbridgecenter.com/');

    /* Fitness 21-25 */
    P(21, 'fitness', 'Kinetics NJ', 'Highland Park', 'Group classes and personal training on Raritan Avenue', 40.49997, -74.4261, 'https://kineticsnj.com/');
    P(22, 'fitness', 'Hot Yoga Revolution', 'Metuchen', 'Hot yoga studio on Pearl Street, with a second studio in Cranford', 40.54077, -74.36313, 'https://www.hotyogarevolution.com/metuchen');
    P(23, 'fitness', 'KING Strength', 'Metuchen', 'Semi-private personal training and group classes on Pearl Street', 40.54208, -74.36363, 'https://www.kingstrengthperformance.com');
    P(24, 'fitness', 'Garden of Healing Yoga & Wellness', 'New Brunswick', 'Yoga and wellness studio on Church Street', 40.49583, -74.4437, 'https://www.gardenofhealingyoga.com/');
    P(25, 'fitness', 'EZ Fit Personal Training', 'Metuchen', 'Private-studio personal training on Spear Street', 40.54395, -74.34851, 'https://www.ezfitpersonaltraining.com/');

    /* Coffee 26-30 */
    P(26, 'coffee', 'Penstock Coffee Roasters', 'Highland Park', 'Roaster and cafe on South 3rd Avenue', 40.49881, -74.42762, 'https://www.penstockcoffee.com/');
    P(27, 'coffee', 'Khyber Coffee & Tea House', 'New Brunswick', 'Chai, espresso drinks and South Asian desserts on Church Street', 40.49573, -74.44492, 'https://www.drinkkhyber.com/');
    P(28, 'coffee', 'Pastry Lu', 'Metuchen', 'Family bakery and coffee shop on Main Street, known for tres leches cookies', 40.54277, -74.3625, 'https://www.pastrylu.com/');
    P(29, 'coffee', 'CLO Coffee Co.', 'Edison', 'Coffee roaster and cafe on Stephenville Parkway', 40.56504, -74.38257, 'https://www.clocoffeecompany.com/');
    P(30, 'coffee', 'Semicolon Cafe', 'New Brunswick', 'Korean-style cafe with bingsoo, sandwiches and pastries on George Street', 40.49483, -74.44399, 'https://www.semicoloncafe.com/');

    /* Great outdoors 31-35 */
    P(31, 'outdoors', 'Cheesequake State Park', 'Old Bridge', 'Salt marsh, cedar swamp and hardwood hills; five marked trails', 40.43254, -74.25164, 'https://dep.nj.gov/parksandforests/state-park/cheesequake-state-park/', 'NJDEP State Parks page');
    P(32, 'outdoors', 'Johnson Park', 'Piscataway', 'Raritan riverside park with East Jersey Old Town Village', 40.51216, -74.47067, 'https://middlesexcountynj.gov/Home/Components/FacilityDirectory/FacilityDirectory/61/1024', 'Middlesex County park page');
    P(33, 'outdoors', 'Thompson Park', 'Monroe', '675 acres with a 30-acre lake, trails and disc golf', 40.33648, -74.43277, 'https://www.middlesexcountynj.gov/Home/Components/FacilityDirectory/FacilityDirectory/71/36', 'Middlesex County park page');
    P(34, 'outdoors', 'Rutgers Gardens', 'New Brunswick', '180-acre botanic garden with farms and natural habitats', 40.47404, -74.42037, 'https://rutgersgardens.rutgers.edu/');
    P(35, 'outdoors', 'Raritan Bay Waterfront Park', 'South Amboy', 'Bayfront park with a free summer concert series', 40.47689, -74.27247, 'https://www.southamboynj.gov/News/View/4173/music-in-the-park-2025-summer-concert-series', 'City of South Amboy concert page');

    /* Public transportation 36-39 */
    P(36, 'transit', 'New Brunswick Station', 'New Brunswick', 'NJ TRANSIT, Northeast Corridor, 33 miles from Penn Station', 40.49684, -74.44619, 'https://www.njtransit.com/station/new-brunswick-station', 'NJ TRANSIT station page');
    P(37, 'transit', 'Metropark Station', 'Iselin', 'NJ TRANSIT, Northeast Corridor', 40.56811, -74.32965, 'https://www.njtransit.com/station/metropark-station', 'NJ TRANSIT station page');
    P(38, 'transit', 'Metuchen Station', 'Metuchen', 'NJ TRANSIT, Northeast Corridor', 40.54083, -74.36039, 'https://www.njtransit.com/station/metuchen-station', 'NJ TRANSIT station page');
    P(39, 'transit', 'South Amboy Station', 'South Amboy', 'NJ TRANSIT, North Jersey Coast Line', 40.48481, -74.2805, 'https://www.njtransit.com/station/south-amboy-station', 'NJ TRANSIT station page');

    /* Healthcare 40-41 */
    P(40, 'healthcare', 'Robert Wood Johnson University Hospital', 'New Brunswick', 'RWJBarnabas Health hospital', 40.49531, -74.44961, 'https://www.rwjbh.org/rwj-university-hospital-new-brunswick/');
    P(41, 'healthcare', 'JFK University Medical Center', 'Edison', 'Hackensack Meridian Health hospital', 40.55636, -74.35018, 'https://www.hackensackmeridianhealth.org/en/locations/jfk-university-medical-center');

    /* Entertainment 42-48 */
    P(42, 'entertainment', 'State Theatre New Jersey', 'New Brunswick', 'Performing arts center in a 1921 theater', 40.49334, -74.44475, 'https://www.stnj.org/');
    P(43, 'entertainment', 'Crossroads Theatre Company', 'New Brunswick', 'Theatre company at the New Brunswick Performing Arts Center', 40.49361, -74.44437, 'https://crossroadstheatrecompany.org/');
    P(44, 'entertainment', 'Zimmerli Art Museum', 'New Brunswick', 'Rutgers art museum on Hamilton Street', 40.50008, -74.44579, 'https://zimmerli.rutgers.edu/');
    P(45, 'entertainment', 'Starland Ballroom', 'Sayreville', 'Concert venue on Jernee Mill Road', 40.44049, -74.35528, 'https://www.starlandballroom.com/');
    P(46, 'entertainment', 'SHI Stadium', 'Piscataway', 'Home of Rutgers football', 40.5135, -74.46514, 'https://scarletknights.com/', 'Rutgers Athletics site');
    P(47, 'entertainment', 'Thomas Edison Center at Menlo Park', 'Edison', 'Museum and 1938 memorial tower at Edison\'s lab site', 40.56356, -74.33928, 'https://menloparkmuseum.org/');
    P(48, 'entertainment', 'Rutgers Geology Museum', 'New Brunswick', 'University geology museum on Somerset Street', 40.4987, -74.44672, 'https://geologymuseum.rutgers.edu/geology-museum');

    /* Shorelines, from OpenStreetMap and simplified. BAY_SHORE runs west along
       the Raritan Bay shore from Keyport to the river mouth; KILL_WEST follows
       the Arthur Kill's New Jersey bank north from Perth Amboy; ISLAND_WEST and
       ISLAND_SOUTH are Staten Island's west and south shores; RARITAN is the
       river, from Piscataway down to the bay. */
    const BAY_SHORE = [[40.4370, -74.0833], [40.4378, -74.0871], [40.4412, -74.0943], [40.4409, -74.0950], [40.4422, -74.1009], [40.4433, -74.1030], [40.4437, -74.1028], [40.4438, -74.1032], [40.4427, -74.1040], [40.4434, -74.1075], [40.4465, -74.1154], [40.4472, -74.1160], [40.4472, -74.1171], [40.4557, -74.1318], [40.4569, -74.1344], [40.4575, -74.1369], [40.4574, -74.1377], [40.4562, -74.1398], [40.4513, -74.1456], [40.4502, -74.1474], [40.4489, -74.1479], [40.4480, -74.1516], [40.4484, -74.1542], [40.4487, -74.1550], [40.4522, -74.1561], [40.4511, -74.1563], [40.4483, -74.1553], [40.4474, -74.1564], [40.4467, -74.1585], [40.4475, -74.1588], [40.4480, -74.1602], [40.4478, -74.1615], [40.4486, -74.1622], [40.4486, -74.1636], [40.4480, -74.1642], [40.4479, -74.1658], [40.4495, -74.1645], [40.4522, -74.1695], [40.4554, -74.1735], [40.4557, -74.1734], [40.4556, -74.1749], [40.4575, -74.1778], [40.4574, -74.1810], [40.4565, -74.1823], [40.4530, -74.1854], [40.4512, -74.1863], [40.4494, -74.1859], [40.4479, -74.1863], [40.4471, -74.1872], [40.4473, -74.1884], [40.4470, -74.1882], [40.4460, -74.1894], [40.4452, -74.1892], [40.4425, -74.1917], [40.4413, -74.1938], [40.4407, -74.1964], [40.4403, -74.1961], [40.4403, -74.1967], [40.4400, -74.1966], [40.4393, -74.1987], [40.4392, -74.2032], [40.4360, -74.2071], [40.4363, -74.2079], [40.4358, -74.2083], [40.4360, -74.2087], [40.4365, -74.2093], [40.4373, -74.2092], [40.4373, -74.2107], [40.4365, -74.2122], [40.4354, -74.2132], [40.4356, -74.2139], [40.4374, -74.2125], [40.4383, -74.2103], [40.4384, -74.2082], [40.4389, -74.2071], [40.4396, -74.2069], [40.4450, -74.2087], [40.4458, -74.2084], [40.4473, -74.2100], [40.4504, -74.2173], [40.4504, -74.2184], [40.4535, -74.2247], [40.4527, -74.2260], [40.4528, -74.2299], [40.4546, -74.2330], [40.4574, -74.2361], [40.4583, -74.2449], [40.4590, -74.2455], [40.4589, -74.2463], [40.4601, -74.2482], [40.4620, -74.2502], [40.4616, -74.2511], [40.4625, -74.2533], [40.4623, -74.2549], [40.4630, -74.2571], [40.4633, -74.2578], [40.4653, -74.2565], [40.4613, -74.2594], [40.4608, -74.2609], [40.4604, -74.2639], [40.4598, -74.2648], [40.4568, -74.2669], [40.4547, -74.2695], [40.4549, -74.2702], [40.4553, -74.2712], [40.4562, -74.2688], [40.4573, -74.2674], [40.4597, -74.2659], [40.4606, -74.2649], [40.4622, -74.2598], [40.4656, -74.2571], [40.4640, -74.2585], [40.4646, -74.2602], [40.4642, -74.2609], [40.4647, -74.2619], [40.4678, -74.2640], [40.4688, -74.2651], [40.4718, -74.2661], [40.4735, -74.2658], [40.4804, -74.2684], [40.4850, -74.2705], [40.4849, -74.2722], [40.4840, -74.2739], [40.4845, -74.2739], [40.4846, -74.2746], [40.4851, -74.2744], [40.4863, -74.2754], [40.4875, -74.2743], [40.4874, -74.2749], [40.4884, -74.2754], [40.4895, -74.2723], [40.4901, -74.2729], [40.4889, -74.2760], [40.4892, -74.2762], [40.4896, -74.2754], [40.4893, -74.2769], [40.4904, -74.2766], [40.4908, -74.2769], [40.4912, -74.2794], [40.4922, -74.2802], [40.4920, -74.2808], [40.4928, -74.2822], [40.4926, -74.2825], [40.4931, -74.2825], [40.5007, -74.2782], [40.5001, -74.2774], [40.5000, -74.2751], [40.4997, -74.2749], [40.4998, -74.2739], [40.4995, -74.2736], [40.4997, -74.2725], [40.4993, -74.2722], [40.4989, -74.2693], [40.4998, -74.2661]];
    const KILL_WEST = [[40.4998, -74.2661], [40.5005, -74.2662], [40.5024, -74.2644], [40.5023, -74.2639], [40.5039, -74.2626], [40.5040, -74.2630], [40.5061, -74.2623], [40.5085, -74.2610], [40.5095, -74.2612], [40.5104, -74.2606], [40.5105, -74.2611], [40.5131, -74.2602], [40.5131, -74.2592], [40.5161, -74.2578], [40.5168, -74.2566], [40.5167, -74.2557], [40.5163, -74.2557], [40.5169, -74.2550], [40.5169, -74.2565], [40.5183, -74.2561], [40.5194, -74.2562], [40.5199, -74.2551], [40.5210, -74.2546], [40.5210, -74.2518], [40.5215, -74.2510], [40.5222, -74.2510], [40.5231, -74.2501], [40.5242, -74.2504], [40.5243, -74.2511], [40.5245, -74.2509], [40.5265, -74.2516], [40.5267, -74.2522], [40.5270, -74.2519], [40.5282, -74.2521], [40.5313, -74.2536], [40.5328, -74.2537], [40.5330, -74.2531], [40.5335, -74.2531], [40.5342, -74.2533], [40.5341, -74.2539], [40.5371, -74.2547], [40.5375, -74.2539], [40.5403, -74.2546], [40.5430, -74.2537], [40.5451, -74.2542], [40.5454, -74.2537], [40.5458, -74.2544], [40.5475, -74.2550], [40.5502, -74.2552], [40.5541, -74.2562], [40.5558, -74.2560], [40.5565, -74.2553], [40.5562, -74.2552], [40.5563, -74.2544], [40.5559, -74.2529], [40.5570, -74.2511], [40.5568, -74.2508], [40.5556, -74.2525], [40.5559, -74.2549], [40.5556, -74.2554], [40.5536, -74.2557], [40.5497, -74.2545], [40.5537, -74.2518], [40.5538, -74.2508], [40.5552, -74.2486], [40.5547, -74.2477], [40.5573, -74.2427], [40.5571, -74.2423], [40.5588, -74.2381], [40.5595, -74.2370], [40.5600, -74.2373], [40.5603, -74.2352], [40.5617, -74.2344], [40.5617, -74.2331], [40.5630, -74.2320], [40.5622, -74.2300], [40.5611, -74.2244], [40.5597, -74.2222], [40.5591, -74.2205], [40.5612, -74.2176], [40.5627, -74.2166], [40.5641, -74.2167], [40.5650, -74.2152], [40.5683, -74.2139], [40.5690, -74.2147], [40.5709, -74.2146], [40.5713, -74.2143], [40.5710, -74.2129], [40.5714, -74.2127], [40.5721, -74.2131], [40.5727, -74.2126], [40.5745, -74.2121], [40.5756, -74.2125], [40.5772, -74.2124], [40.5779, -74.2118], [40.5817, -74.2108], [40.5818, -74.2111], [40.5831, -74.2108], [40.5845, -74.2099], [40.5856, -74.2098], [40.5860, -74.2102], [40.5870, -74.2096], [40.5886, -74.2095], [40.5907, -74.2084], [40.5914, -74.2072], [40.5946, -74.2045], [40.5960, -74.2028], [40.5978, -74.2018], [40.5999, -74.2012], [40.6009, -74.2012], [40.6017, -74.2019], [40.6040, -74.2054], [40.6055, -74.2065], [40.6065, -74.2067], [40.6093, -74.2058], [40.6103, -74.2060], [40.6110, -74.2053], [40.6120, -74.2051], [40.6133, -74.2054], [40.6179, -74.2049], [40.6193, -74.2051], [40.6196, -74.2058], [40.6201, -74.2053], [40.6226, -74.2055], [40.6233, -74.2061], [40.6239, -74.2075], [40.6241, -74.2067], [40.6268, -74.2062], [40.6278, -74.2044], [40.6295, -74.2047], [40.6330, -74.2031], [40.6338, -74.2032], [40.6341, -74.2050], [40.6345, -74.2042], [40.6343, -74.2006], [40.6348, -74.1996], [40.6357, -74.1985], [40.6371, -74.2003], [40.6374, -74.2000]];
    const ISLAND_WEST = [[40.6327, -74.1984], [40.6315, -74.2001], [40.6297, -74.2004], [40.6296, -74.2007], [40.6261, -74.2014], [40.6261, -74.2011], [40.6245, -74.2006], [40.6226, -74.2016], [40.6223, -74.2012], [40.6205, -74.2009], [40.6205, -74.2004], [40.6202, -74.2005], [40.6203, -74.2009], [40.6182, -74.2002], [40.6177, -74.2009], [40.6170, -74.2006], [40.6162, -74.1973], [40.6154, -74.1961], [40.6141, -74.1957], [40.6140, -74.1949], [40.6136, -74.1956], [40.6119, -74.1958], [40.6083, -74.1984], [40.6071, -74.1985], [40.6053, -74.1969], [40.6034, -74.1959], [40.6026, -74.1961], [40.6026, -74.1967], [40.6022, -74.1960], [40.6017, -74.1969], [40.6017, -74.1962], [40.6015, -74.1969], [40.5988, -74.1970], [40.5983, -74.1974], [40.5973, -74.1974], [40.5965, -74.1969], [40.5964, -74.1979], [40.5936, -74.1997], [40.5918, -74.2020], [40.5916, -74.2018], [40.5910, -74.2020], [40.5911, -74.2031], [40.5909, -74.2019], [40.5907, -74.2027], [40.5899, -74.2032], [40.5898, -74.2045], [40.5894, -74.2047], [40.5887, -74.2040], [40.5880, -74.2045], [40.5857, -74.2043], [40.5856, -74.2038], [40.5855, -74.2044], [40.5837, -74.2044], [40.5816, -74.2051], [40.5804, -74.2060], [40.5776, -74.2063], [40.5762, -74.2071], [40.5755, -74.2070], [40.5753, -74.2074], [40.5714, -74.2068], [40.5697, -74.2088], [40.5688, -74.2089], [40.5652, -74.2106], [40.5631, -74.2114], [40.5606, -74.2112], [40.5597, -74.2118], [40.5583, -74.2121], [40.5576, -74.2127], [40.5572, -74.2125], [40.5571, -74.2131], [40.5562, -74.2137], [40.5566, -74.2148], [40.5561, -74.2148], [40.5549, -74.2179], [40.5558, -74.2188], [40.5547, -74.2187], [40.5558, -74.2192], [40.5547, -74.2191], [40.5546, -74.2199], [40.5559, -74.2204], [40.5554, -74.2219], [40.5562, -74.2258], [40.5563, -74.2287], [40.5556, -74.2293], [40.5553, -74.2309], [40.5528, -74.2329], [40.5525, -74.2335], [40.5530, -74.2349], [40.5524, -74.2363], [40.5521, -74.2365], [40.5505, -74.2362], [40.5502, -74.2375], [40.5476, -74.2406], [40.5469, -74.2421], [40.5476, -74.2436], [40.5457, -74.2462], [40.5431, -74.2480], [40.5421, -74.2463], [40.5408, -74.2455], [40.5390, -74.2451], [40.5385, -74.2444], [40.5369, -74.2451], [40.5369, -74.2441], [40.5362, -74.2440], [40.5346, -74.2421], [40.5336, -74.2420], [40.5335, -74.2410], [40.5333, -74.2423], [40.5310, -74.2415], [40.5298, -74.2425], [40.5294, -74.2422], [40.5282, -74.2430], [40.5263, -74.2432], [40.5252, -74.2438], [40.5237, -74.2428], [40.5223, -74.2426], [40.5213, -74.2430], [40.5210, -74.2411], [40.5201, -74.2399], [40.5192, -74.2406], [40.5195, -74.2410], [40.5190, -74.2417], [40.5193, -74.2421], [40.5188, -74.2418], [40.5183, -74.2426], [40.5185, -74.2443], [40.5182, -74.2454], [40.5180, -74.2457], [40.5173, -74.2452], [40.5167, -74.2465], [40.5178, -74.2476], [40.5159, -74.2458], [40.5161, -74.2465], [40.5158, -74.2475], [40.5165, -74.2482], [40.5156, -74.2496], [40.5152, -74.2493], [40.5155, -74.2498], [40.5136, -74.2522], [40.5129, -74.2520], [40.5122, -74.2531], [40.5100, -74.2534], [40.5076, -74.2557], [40.5040, -74.2554], [40.5004, -74.2535]];
    const ISLAND_SOUTH = [[40.5004, -74.2535], [40.4990, -74.2512], [40.4980, -74.2510], [40.4965, -74.2493], [40.4960, -74.2468], [40.4975, -74.2441], [40.4975, -74.2399], [40.4999, -74.2368], [40.5008, -74.2331], [40.5018, -74.2311], [40.5022, -74.2267], [40.5018, -74.2248], [40.5024, -74.2231], [40.5027, -74.2196], [40.5033, -74.2175], [40.5056, -74.2156], [40.5064, -74.2144], [40.5065, -74.2136], [40.5076, -74.2122], [40.5104, -74.2100], [40.5119, -74.2071], [40.5129, -74.1999], [40.5124, -74.2004], [40.5114, -74.1997], [40.5099, -74.1969], [40.5098, -74.1956], [40.5129, -74.1917], [40.5153, -74.1897], [40.5151, -74.1889], [40.5155, -74.1891], [40.5183, -74.1862], [40.5195, -74.1844], [40.5192, -74.1838], [40.5197, -74.1841], [40.5199, -74.1837], [40.5203, -74.1821], [40.5201, -74.1818], [40.5205, -74.1818], [40.5207, -74.1811], [40.5202, -74.1794], [40.5196, -74.1792], [40.5201, -74.1791], [40.5201, -74.1787], [40.5196, -74.1786], [40.5193, -74.1775], [40.5225, -74.1735], [40.5233, -74.1721], [40.5235, -74.1712], [40.5231, -74.1700], [40.5273, -74.1623], [40.5271, -74.1615], [40.5276, -74.1604], [40.5273, -74.1596], [40.5287, -74.1574], [40.5286, -74.1562], [40.5290, -74.1562], [40.5301, -74.1551], [40.5301, -74.1545], [40.5320, -74.1524], [40.5326, -74.1507], [40.5334, -74.1497], [40.5339, -74.1497], [40.5350, -74.1476], [40.5358, -74.1448], [40.5372, -74.1438], [40.5370, -74.1417], [40.5372, -74.1415], [40.5377, -74.1424], [40.5385, -74.1418], [40.5392, -74.1425], [40.5393, -74.1419], [40.5401, -74.1417], [40.5416, -74.1423], [40.5428, -74.1411], [40.5430, -74.1414], [40.5429, -74.1408], [40.5435, -74.1401], [40.5439, -74.1404], [40.5439, -74.1400], [40.5450, -74.1387], [40.5459, -74.1380], [40.5456, -74.1375], [40.5459, -74.1365], [40.5462, -74.1365], [40.5468, -74.1341], [40.5466, -74.1317], [40.5458, -74.1299], [40.5430, -74.1275], [40.5420, -74.1274], [40.5407, -74.1280], [40.5357, -74.1337], [40.5352, -74.1356], [40.5355, -74.1403], [40.5338, -74.1409], [40.5317, -74.1393], [40.5299, -74.1389], [40.5300, -74.1377], [40.5294, -74.1371], [40.5295, -74.1364], [40.5315, -74.1335], [40.5334, -74.1316], [40.5406, -74.1266], [40.5451, -74.1227], [40.5456, -74.1209], [40.5448, -74.1206], [40.5450, -74.1199], [40.5454, -74.1194], [40.5461, -74.1196], [40.5462, -74.1189], [40.5472, -74.1184], [40.5471, -74.1176], [40.5477, -74.1168], [40.5479, -74.1160], [40.5474, -74.1157], [40.5481, -74.1139], [40.5475, -74.1125], [40.5477, -74.1128], [40.5516, -74.1101], [40.5540, -74.1078], [40.5542, -74.1065], [40.5530, -74.1049], [40.5544, -74.1045], [40.5561, -74.1029], [40.5555, -74.1013], [40.5559, -74.1018], [40.5575, -74.1012], [40.5590, -74.0998], [40.5594, -74.0988], [40.5591, -74.0979], [40.5594, -74.0984], [40.5599, -74.0982], [40.5632, -74.0958], [40.5628, -74.0941], [40.5639, -74.0935], [40.5670, -74.0906], [40.5674, -74.0900], [40.5670, -74.0892], [40.5690, -74.0872], [40.5685, -74.0862], [40.5690, -74.0869], [40.5702, -74.0861], [40.5795, -74.0750]];
    const RARITAN = [[40.5592, -74.5252], [40.5583, -74.5231], [40.5563, -74.5206], [40.5524, -74.5175], [40.5444, -74.5155], [40.5417, -74.5139], [40.5399, -74.5118], [40.5314, -74.4982], [40.5294, -74.4956], [40.5141, -74.4840], [40.5116, -74.4811], [40.5110, -74.4788], [40.5100, -74.4709], [40.5089, -74.4671], [40.5076, -74.4526], [40.5064, -74.4494], [40.5017, -74.4416], [40.4978, -74.4380], [40.4910, -74.4354], [40.4897, -74.4342], [40.4876, -74.4297], [40.4876, -74.4231], [40.4892, -74.4191], [40.4913, -74.4166], [40.4921, -74.4148], [40.4927, -74.4122], [40.4921, -74.4082], [40.4908, -74.4038], [40.4903, -74.3992], [40.4893, -74.3972], [40.4867, -74.3951], [40.4857, -74.3935], [40.4857, -74.3912], [40.4869, -74.3885], [40.4876, -74.3850], [40.4863, -74.3832], [40.4821, -74.3830], [40.4803, -74.3822], [40.4789, -74.3804], [40.4780, -74.3781], [40.4785, -74.3756], [40.4799, -74.3744], [40.4817, -74.3716], [40.4822, -74.3698], [40.4816, -74.3674], [40.4798, -74.3660], [40.4782, -74.3657], [40.4747, -74.3674], [40.4723, -74.3670], [40.4715, -74.3652], [40.4715, -74.3633], [40.4728, -74.3593], [40.4749, -74.3568], [40.4760, -74.3564], [40.4808, -74.3569], [40.4826, -74.3558], [40.4833, -74.3546], [40.4839, -74.3530], [40.4837, -74.3498], [40.4817, -74.3445], [40.4815, -74.3422], [40.4818, -74.3388], [40.4827, -74.3352], [40.4847, -74.3307], [40.4873, -74.3268], [40.4906, -74.3236], [40.4962, -74.3210], [40.5010, -74.3172], [40.5049, -74.3131], [40.5086, -74.3049], [40.5091, -74.2972], [40.5081, -74.2928], [40.5052, -74.2886], [40.5026, -74.2878], [40.4998, -74.2879], [40.4983, -74.2860], [40.4963, -74.2808], [40.4935, -74.2707]];

    return {
      id: 'middlesex',
      label: 'Middlesex County',
      state: 'New Jersey',
      title: 'Middlesex County',
      subtitle: 'The Raritan River, the university towns and the bay shore',
      issue: 'The GVC Team / Local Guide',
      coverImage: '../../assets/img/nj/middlesex-cover.jpg',
      coverAlt: 'A wrought-iron gate and a brick hall on the Rutgers campus in New Brunswick',
      /* Page photographs (Wikimedia Commons): cover Carol M. Highsmith (CC0),
         field State of New Jersey (public domain), places Great One (public
         domain), favorites Forevaclevah (CC BY 3.0). `pos` is the crop focus. */
      photos: {
        field: { src: '../../assets/img/nj/middlesex-marsh.jpg', alt: 'Salt marsh and autumn hardwoods at Cheesequake State Park', caption: 'The marsh at Cheesequake State Park', pos: 'center 55%' },
        places: { src: '../../assets/img/nj/middlesex-perth-amboy.jpg', alt: 'Victorian houses along High Street in Perth Amboy', caption: 'Victorian houses on High Street, Perth Amboy', pos: 'center 45%' },
        favorites: { src: '../../assets/img/nj/middlesex-new-brunswick.jpg', alt: 'The New Brunswick skyline reflected in the Raritan River at sunset', caption: 'New Brunswick at dusk. Photo: Forevaclevah, CC BY 3.0', pos: 'center 62%' }
      },
      teamImage: '../../assets/team/founders-lifestyle.jpg',
      teamAlt: 'The GVC Team founders together outside a residence',
      welcomeTitle: 'A county on the river',
      welcome: [
        'Middlesex County sits in the middle of the state\'s busiest corridor. The Raritan River crosses it from Piscataway to the bay, New Brunswick anchors it with a university and a theater district, and the Northeast Corridor stations from Metuchen to New Brunswick connect it to New York Penn Station.',
        'Away from the tracks the county changes pace: the Raritan Bay shore at South Amboy and Perth Amboy, the salt marsh at Cheesequake, and the farm country around Cranbury. This guide is a practical first pass from The GVC Team: where things sit, what makes each town distinct, and the places we send clients first.'
      ],
      overview: {
        knownFor: 'Rutgers, the state\'s flagship university, and the Johnson & Johnson world headquarters in New Brunswick; a county of 863,162 residents bisected by the Raritan River and bounded by Raritan Bay; Thomas Edison\'s Menlo Park laboratory; and a spine of Northeast Corridor rail stations.',
        history: 'Middlesex was formed within East Jersey on 7 March 1683, and Perth Amboy was named the capital of East Jersey in 1686. The trustees of Queen\'s College, later Rutgers, were founded in 1766, and Rutgers and Princeton played what is counted as the first intercollegiate football game in New Brunswick on 6 November 1869. Thomas Edison set up his Menlo Park laboratory in 1876.',
        architecture: 'Perth Amboy keeps Georgian civic buildings: its City Hall, finished in 1767, is the oldest in continuous use in the country, and the Proprietary House dates to 1764. Cranbury\'s historic district holds 177 contributing buildings, many from the 18th and 19th centuries. Elsewhere, railroad-era boroughs such as Metuchen and Highland Park sit beside large townships such as Edison and Old Bridge.',
        sourceKeys: ['wikiMiddlesex', 'wikiNewBrunswick', 'wikiPerthAmboy', 'wikiMenlo', 'football1869', 'wikiCranbury', 'wikiMetuchen', 'wikiHighlandPark', 'wikiEdison', 'wikiOldBridge', 'wikiSouthAmboy']
      },
      places: [
        { name: 'Cranbury', zone: 'Village', fallback: 'A village on Cranbury Brook whose historic district holds 177 contributing buildings, many from the 18th and 19th centuries.' },
        { name: 'Edison', zone: 'Corridor', fallback: 'The sixth-largest municipality in New Jersey, home to Menlo Park\'s Edison history and the shops and restaurants of Oak Tree Road.' },
        { name: 'Highland Park', zone: 'River', fallback: 'A Raritan River borough across from New Brunswick, with a walkable downtown on Raritan Avenue.' },
        { name: 'Metuchen', zone: 'Downtown', fallback: 'The "Brainy Borough", with a Great American Main Street award winner and a Northeast Corridor station.' },
        { name: 'New Brunswick', zone: 'City', fallback: 'The county seat, home to Rutgers, the Johnson & Johnson headquarters and the State Theatre.' },
        { name: 'Old Bridge', zone: 'Bay', fallback: 'A large township with a Raritan Bay beachfront at Laurence Harbor and Cheesequake State Park.' },
        { name: 'Perth Amboy', zone: 'Waterfront', fallback: 'The "City by the Bay", a colonial capital with a Raritan Bay waterfront and the 1764 Proprietary House.' },
        { name: 'Piscataway', zone: 'River', fallback: 'A Raritan River township with Johnson Park and Rutgers\' SHI Stadium.' },
        { name: 'South Amboy', zone: 'Bay', fallback: 'A Raritan Bay city at the mouth of the river, with a North Jersey Coast Line station.' }
      ],
      bucketLede: 'a show, an inventor\'s lab, a towpath walk, a Rutgers game, Oak Tree Road and the bay shore',
      bucket: [
        { title: 'Catch a show at the State Theatre', note: 'Opened on 26 December 1921, the New Brunswick theater now hosts Broadway tours, orchestras, comedy and rock.', source: 'stateTheatreWiki' },
        { title: 'See where Edison worked at Menlo Park', note: 'Edison set up his laboratory in 1876. A museum and the 1938 Edison Memorial Tower mark the site.', source: 'poi47' },
        { title: 'Walk the Delaware & Raritan Canal towpath', note: 'The canal opened in 1834 and runs from Bordentown to New Brunswick; most of it is now a state park.', source: 'canal' },
        { title: 'Eat your way down Oak Tree Road', note: 'A 1.5-mile South Asian shopping and dining strip across Edison and Iselin.', source: 'wikiEdison' },
        { title: 'Watch Rutgers at SHI Stadium', note: 'Rutgers and Princeton played what is counted as the first intercollegiate football game in New Brunswick on 6 November 1869.', source: 'football1869' },
        { title: 'Spend an afternoon at the Zimmerli', note: 'The Rutgers art museum, on Hamilton Street in New Brunswick.', source: 'poi44' },
        { title: 'Paddle the lake at Thompson Park', note: 'The 675-acre county park has a 30-acre lake open to canoes, kayaks and electric-powered boats.', source: 'poi33' },
        { title: 'Hike the marsh at Cheesequake', note: 'Five marked trails cross salt marsh, cedar swamp and hardwood hills.', source: 'cheesequakeWiki' },
        { title: 'Walk the Perth Amboy waterfront', note: 'Victorian houses line High Street above the bay, and the 1764 Proprietary House was the last royal governor\'s residence.', source: 'wikiPerthAmboy' },
        { title: 'Stroll Main Street in Metuchen', note: 'The downtown won the 2023 Great American Main Street Award.', source: 'poi18' }
      ],
      categories: categories,
      pois: pois,
      map: {
        title: 'River to bay',
        bounds: [[40.625, -74.785], [40.27, -74.14]],
        water: [
          BAY_SHORE.concat(ISLAND_SOUTH, [[40.58, -73.9], [40.437, -73.9]]),
          KILL_WEST.concat([[40.70, -74.205], [40.70, -74.1984]], ISLAND_WEST)
        ],
        coasts: [BAY_SHORE.concat(KILL_WEST.slice(1)), ISLAND_WEST.concat(ISLAND_SOUTH.slice(1)), RARITAN],
        labels: [
          { text: 'RARITAN BAY', lat: 40.49, lon: -74.2 }
        ]
      },
      favorites: [
        { person: 'Team favorite', pick: 'A morning at Rutgers Gardens', location: 'New Brunswick', note: 'Walk the designed gardens and farm fields, then head into New Brunswick for lunch.' },
        { person: 'Team favorite', pick: 'Main Street, Metuchen', location: 'Metuchen', note: 'Coffee at Pastry Lu, a walk along Main Street, then the train home.' },
        { person: 'Team favorite', pick: 'An evening at the State Theatre', location: 'New Brunswick', note: 'Dinner on Church or George Street, then a show on Livingston Avenue.' },
        { person: 'Team favorite', pick: 'Sunset over Raritan Bay', location: 'South Amboy', note: 'Walk the waterfront park, then dinner downtown at Blue Moon.' }
      ],
      sources: sources,
      sourceSummary: 'official venue sites, NJ TRANSIT, NJDEP State Parks, Middlesex County park pages, Rutgers and Wikipedia for history and park facts',
      sourceNote: 'Sources checked 8 October 2026. Verify seasonal access, transit schedules and business details before distribution.'
    };
  })();

  global.GVC_DESTINATION_GUIDES = {
    defaultRegion: 'monmouth',
    regions: { monmouth: monmouth, ocean: ocean, middlesex: middlesex }
  };
})(typeof window !== 'undefined' ? window : globalThis);
