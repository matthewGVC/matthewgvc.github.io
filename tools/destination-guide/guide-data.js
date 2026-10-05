/* ============================================================
   GVC DESTINATION GUIDES - region-specific editorial data.

   Page layout and editing behavior live beside this file. Facts, POIs, map
   coordinates and citations live here so they can be reviewed without
   touching markup. Town positioning lines are supplemented at runtime from
   assets/js/nj-towns.js when a matching town exists there.

   Sources were checked 5 October 2026. Avoid storing operating hours here:
   those change too quickly for a printed guide.
   ============================================================ */
(function (global) {
  'use strict';

  const sources = {
    tourism: {
      label: 'Monmouth County Tourism - Travel Guide',
      url: 'https://tourism.visitmonmouth.com/wp-content/uploads/2024/04/Travel-Guide-Online.pdf'
    },
    sandyHook: {
      label: 'National Park Service - Gateway / Sandy Hook',
      url: 'https://www.nps.gov/gate/index.htm'
    },
    battlefield: {
      label: 'NJDEP - Monmouth Battlefield State Park',
      url: 'https://dep.nj.gov/parksandforests/state-park/monmouth-battlefield-state-park/'
    },
    manasquan: {
      label: 'Monmouth County Park System - Manasquan Reservoir',
      url: 'https://www.monmouthcountyparks.com/page.aspx?ID=2531'
    },
    hartshorne: {
      label: 'Monmouth County Park System - Hartshorne Woods Park',
      url: 'https://www.monmouthcountyparks.com/page.aspx?Id=2524'
    },
    longstreet: {
      label: 'Monmouth County Park System - Historic Longstreet Farm',
      url: 'https://www.monmouthcountyparks.com/page.aspx?ID=2530&lang=en'
    },
    transit: {
      label: 'NJ TRANSIT - North Jersey Coast Line',
      url: 'https://www.njtransit.com/abc_NORTH_JERSEY_COAST_LINE'
    }
  };

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
      knownFor: 'A long Atlantic shoreline, the Navesink and Shrewsbury rivers, year-round downtowns, protected parkland, and unusually varied housing within one county.',
      history: 'The county preserves both an 18th-century battlefield and a 19th-century working farm. Monmouth Battlefield marks one of the longest battles of the American Revolution; Historic Longstreet Farm interprets rural life in the 1890s.',
      architecture: 'Victorian beach houses, early Dutch farmhouses, mid-century ranches, river estates, downtown lofts and new oceanfront condominiums coexist here. The right housing type depends as much on the submarket as the town name.',
      sourceKeys: ['battlefield', 'longstreet', 'tourism']
    },
    places: [
      { name: 'Atlantic Highlands', zone: 'Harbor', fallback: 'A harbor downtown with the county\'s fastest ferry connection to Lower Manhattan.' },
      { name: 'Asbury Park', zone: 'Coast', fallback: 'Music, restaurants and a boardwalk city that stays active beyond summer.' },
      { name: 'Colts Neck', zone: 'Country', fallback: 'Horse farms, orchards and large-lot homes in the county\'s rural center.' },
      { name: 'Freehold', zone: 'Downtown', fallback: 'The county seat, with a walkable borough surrounded by a separate township.' },
      { name: 'Highlands', zone: 'Harbor', fallback: 'A compact bay town beside Sandy Hook, with ferry access and steep wooded streets.' },
      { name: 'Long Branch', zone: 'Coast', fallback: 'Oceanfront redevelopment beside established residential neighborhoods.' },
      { name: 'Middletown', zone: 'River', fallback: 'A large township of distinct neighborhoods, rail stations, riverfront and bayfront.' },
      { name: 'Red Bank', zone: 'Downtown', fallback: 'The county\'s cultural downtown, with theater, dining and a direct rail station.' },
      { name: 'Sea Bright', zone: 'Coast', fallback: 'A narrow ocean-and-river borough with beach clubs and a compact main street.' }
    ],
    bucket: [
      { title: 'Walk Sandy Hook', note: 'Pair the ocean beach with the historic lighthouse and harbor views.', source: 'sandyHook' },
      { title: 'See a show in Asbury Park', note: 'Build an evening around the boardwalk, music venues and downtown.', source: 'tourism' },
      { title: 'Hike above the Navesink', note: 'Hartshorne Woods combines challenging trails, water views and coastal-defense history.', source: 'hartshorne' },
      { title: 'Cross the reservoir loop', note: 'The Manasquan Reservoir\'s perimeter trail is the county\'s big all-season circuit.', source: 'manasquan' },
      { title: 'Take the ferry from Highlands', note: 'The harbor-to-harbor trip makes the region\'s New York connection tangible.', source: 'transit' },
      { title: 'Spend an afternoon in Red Bank', note: 'Start with Broad Street, then continue to the river or a performance.', source: 'tourism' },
      { title: 'Visit the battlefield', note: 'Walk the preserved landscape and visitor-center exhibits in Manalapan.', source: 'battlefield' },
      { title: 'Step into farm life', note: 'Historic Longstreet Farm recreates Monmouth County agriculture in the 1890s.', source: 'longstreet' }
    ],
    categories: [
      { id: 'shore', label: 'Shore & water' },
      { id: 'outdoors', label: 'Parks & trails' },
      { id: 'culture', label: 'Culture & history' },
      { id: 'downtowns', label: 'Downtowns' },
      { id: 'connections', label: 'Connections' }
    ],
    pois: [
      { id: 1, category: 'shore', name: 'Sandy Hook', place: 'Middletown', note: 'Ocean beaches, lighthouse and Fort Hancock', lat: 40.4638, lon: -73.9893, source: 'sandyHook' },
      { id: 2, category: 'shore', name: 'Asbury Park Boardwalk', place: 'Asbury Park', note: 'Beach, music and dining', lat: 40.2204, lon: -74.0000, source: 'tourism' },
      { id: 3, category: 'shore', name: 'Seven Presidents Oceanfront Park', place: 'Long Branch', note: 'County oceanfront park', lat: 40.3033, lon: -73.9791, source: 'tourism' },
      { id: 4, category: 'outdoors', name: 'Hartshorne Woods Park', place: 'Highlands', note: '831 acres above the Navesink', lat: 40.3943, lon: -73.9977, source: 'hartshorne' },
      { id: 5, category: 'outdoors', name: 'Manasquan Reservoir', place: 'Howell', note: 'Reservoir, wildlife and perimeter trail', lat: 40.1775, lon: -74.2153, source: 'manasquan' },
      { id: 6, category: 'outdoors', name: 'Holmdel Park', place: 'Holmdel', note: 'Trails, arboretum and historic farm', lat: 40.3742, lon: -74.1807, source: 'longstreet' },
      { id: 7, category: 'culture', name: 'Monmouth Battlefield', place: 'Manalapan', note: 'Revolutionary War landscape and museum', lat: 40.2667, lon: -74.3206, source: 'battlefield' },
      { id: 8, category: 'culture', name: 'Historic Longstreet Farm', place: 'Holmdel', note: 'Living history of the 1890s', lat: 40.3709, lon: -74.1838, source: 'longstreet' },
      { id: 9, category: 'downtowns', name: 'Red Bank', place: 'Red Bank', note: 'Theater, restaurants and riverfront', lat: 40.3471, lon: -74.0643, source: 'tourism' },
      { id: 10, category: 'downtowns', name: 'Freehold Borough', place: 'Freehold', note: 'County-seat main street', lat: 40.2601, lon: -74.2738, source: 'tourism' },
      { id: 11, category: 'connections', name: 'Highlands Ferry', place: 'Highlands', note: 'Passenger ferry to Manhattan', lat: 40.3978, lon: -73.9814, source: 'transit' },
      { id: 12, category: 'connections', name: 'North Jersey Coast Line', place: 'Monmouth County', note: 'Rail spine through the eastern county', lat: 40.3260, lon: -74.0740, source: 'transit' }
    ],
    favorites: [
      { person: 'Team favorite', pick: 'A first walk at Sandy Hook', location: 'Middletown', note: 'Start at the lighthouse, then keep going until the harbor and skyline open up.' },
      { person: 'Team favorite', pick: 'Red Bank before a show', location: 'Red Bank', note: 'Dinner downtown, a walk toward the river, then the Count Basie Center.' },
      { person: 'Team favorite', pick: 'The high trail at Hartshorne', location: 'Highlands', note: 'The county feels completely different from the wooded ridge above the Navesink.' },
      { person: 'Team favorite', pick: 'A slow reservoir lap', location: 'Howell', note: 'Go early, take the perimeter trail, and leave enough time for the wildlife overlooks.' }
    ],
    sources: sources,
    sourceNote: 'Sources checked 5 October 2026. Verify seasonal access, transit schedules and business details before distribution.'
  };

  global.GVC_DESTINATION_GUIDES = {
    defaultRegion: 'monmouth',
    regions: { monmouth: monmouth }
  };
})(typeof window !== 'undefined' ? window : globalThis);
