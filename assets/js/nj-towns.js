/* ============================================================
   NEW JERSEY TOWN TEARSHEETS — the data behind the Buyer Package's
   optional town pages.

   One record per town, in the order the towns appear in the panel.
   The list is the towns we actually sell in — it mirrors the folder
   names under
     G:\Shared drives\GVC - New Jersey\1. Residential Sales\Resale
   minus the one folder in there that is a property rather than a town.

   ------------------------------------------------------------
   EVERY FIGURE BELOW WAS LOOKED UP. HERE IS WHERE FROM.

   This file used to hold numbers Claude had written from general
   knowledge. It no longer does. Each field now traces to a named
   source, checked 2 September 2026:

     price    Redfin, median sale price over the three months ending
              July 2026, for the municipality (or, where Redfin has no
              municipal page, its principal ZIP — noted per town).
     tax      NJ Dept. of Community Affairs, 2025 average residential
              property-tax bill, per municipality.
     rate     NJ DCA, 2025 EFFECTIVE tax rate — tax as a percentage of
              true market value. This is what the bill actually costs
              per dollar of house, and it is why Rumson's enormous bill
              and Matawan's modest one are not the story they look like.
     mins     Scheduled time to Manhattan, read off the operator's own
              current timetable: NJ TRANSIT rail (North Jersey Coast
              Line and Morris & Essex, both as of 30 Aug 2026) and
              Seastreak (schedule effective 8 Sept 2026). Where a town
              has no station of its own, the figure is the train or boat
              time from the station named in `transit`, and the drive to
              it is called out.
     transit  The line, station or dock, from the same timetables.
     schools  District structure confirmed against the districts' own
              published material and the NJ DOE record.
     crime    NJ State Police Uniform Crime Report, 2023 (the most
              recent full year published) — total index-crime offenses
              per 100,000 people, for the municipality's own police
              agency. The statewide figure for the same year is 1,755
              per 100,000, and every line quotes it so the number has
              something to sit against.
     notes    Three things that decide a deal here. Judgement, not data.

   WHAT THE NUMBERS DO NOT DO. A median sale price is not a valuation.
   An average tax bill is not this house's tax bill. A 2023 crime rate
   is two years stale by the time you hand this over, and in a small
   town a single burglary moves it a lot. Say so if a client leans on
   one.

   TWO CRIME FIGURES ARE DELIBERATELY NOT PRINTED AS RATES. Matawan's
   agency reported one index offense for all of 2023, which is a
   reporting gap rather than a crime rate, so its line says that instead.
   Beach Haven's rate is computed on 1,275 year-round residents against
   a summer population many times that, so its line says that too.

   TO RE-CHECK A TOWN: the sources above are all public and all free.
   Correct the figures and bump AS_OF in the same commit. If you ever
   put a number in here you have not looked up, take the town's name
   out of VERIFIED so the page stamps itself.

   Fields, in order:
     name     the town as a buyer would say it
     county   printed as the eyebrow above the name
     tag      one line on what the town actually is
     price    median sale price, short form
     tax      average annual property-tax bill
     rate     effective tax rate, percent of market value
     mins     door-to-Manhattan, the honest number
     transit  how you make that commute
     schools  district, and anything a parent needs to know
     crime    index crime per 100,000, against the state's 1,755
     notes    three things that decide a deal here
   ============================================================ */
(function (global) {
  'use strict';

  const AS_OF = 'Sources checked September 2026 — Redfin (Jul 2026), NJ DCA (2025), ' +
                'NJ TRANSIT and Seastreak timetables, NJSP Uniform Crime Report (2023)';

  /* Towns whose figures have been checked against the sources named at the
     top of this file. All of them, as of 2 September 2026 — which is why no
     page carries the estimate stamp any more. Take a name out of here the
     moment somebody edits its numbers without re-checking them. */
  const VERIFIED = [
    'Asbury Park', 'Atlantic Highlands', 'Beach Haven', 'Brick', 'Brielle',
    'Colts Neck', 'Farmingdale', 'Freehold', 'Highlands', 'Hoboken', 'Keyport',
    'Little Silver', 'Long Branch', 'Matawan', 'Middletown', 'Morganville',
    'Morristown', 'Point Pleasant', 'Red Bank', 'Rumson', 'Sea Bright',
    'Shrewsbury', 'Tinton Falls', 'Wall Township', 'Whiting'
  ];

  const T = (name, county, tag, price, tax, rate, mins, transit, schools, crime, notes) =>
    ({ name, county, tag, price, tax, rate, mins, transit, schools, crime, notes,
       verified: VERIFIED.indexOf(name) > -1 });

  const list = [
    T('Asbury Park', 'Monmouth County',
      'A rebuilt beach city — music, restaurants and the most walkable boardwalk on the Jersey Shore.',
      '$895K', '$11,178', '1.76%', '≈ 95 min',
      'North Jersey Coast Line from Asbury Park, direct to Penn Station',
      'Asbury Park School District, PreK-12 · the district also hosts several charter schools, so confirm which school a given address feeds',
      '5,273 per 100K in 2023, against the state\'s 1,755.',
      ['Condo and multi-family stock you will not find elsewhere at the shore.',
       'Year-round nightlife and dining, not a summer-only town.',
       'Flood zone matters near Wesley Lake and the boardwalk — check the map, not the listing.']),

    T('Atlantic Highlands', 'Monmouth County',
      'Harbor town on Sandy Hook Bay with the fastest commute into Manhattan in the county.',
      '$705K', '$10,481', '1.54%', '≈ 40 min',
      'Seastreak ferry — 40 min to the Battery Maritime Building, 60 min to East 35th St',
      'Atlantic Highlands Elementary PreK-6 · consolidated with Highlands into the Henry Hudson Regional K-12 district in July 2024',
      '551 per 100K in 2023, against the state\'s 1,755.',
      ['Deep-water marina and a working harbor at the foot of the town.',
       'Hilltop lots look out over the bay to Sandy Hook and the city.',
       'The ferry sells this town — walk-on parking is the thing to check.']),

    T('Beach Haven', 'Ocean County',
      "Long Beach Island's town center: a summer market with a small, tight year-round core.",
      '$1.6M', '$12,295', '0.77%', '≈ 2 hr drive',
      'No transit — this is a second-home market, not a commute',
      'Beach Haven School District PreK-6, its own district · Southern Regional for grades 7-12',
      'The 2023 index rate reads high only because it is computed on 1,275 year-round residents against a summer population many times that.',
      ['Rental income underwrites a lot of these purchases — ask for the rental history.',
       'Flood elevation and insurance drive value more than square footage does.',
       'Bay side versus ocean side is the entire price conversation.']),

    T('Brick', 'Ocean County',
      'A big, affordable township spread along the Metedeconk River and Barnegat Bay.',
      '$528K', '$8,093', '1.58%', '≈ 75 min drive',
      'No station in the township — drive, or the commuter buses off Route 70',
      'Brick Public Schools, PreK-12 · two high schools, Brick Township and Brick Memorial, so ask which one an address feeds',
      '1,343 per 100K in 2023, below the state\'s 1,755.',
      ['Lagoon-front homes with private docks, at a fraction of Monmouth prices.',
       'Every price point from a first house to a waterfront rebuild.',
       'Car-dependent — the retail is all on Route 70 and Route 88.']),

    T('Brielle', 'Monmouth County',
      'A quiet river borough at the mouth of the Manasquan — boats, and not much else going on.',
      '$1.4M', '$14,907', '1.28%', '≈ 115 min',
      'North Jersey Coast Line from Manasquan, a few minutes away',
      'Brielle School District PreK-8 · Manasquan High School, on a sending relationship, shared with six other shore boroughs',
      '537 per 100K in 2023, against the state\'s 1,755.',
      ['Deep-water dockage on the Manasquan River, minutes from the inlet.',
       'Walk or bike to the Manasquan beaches without paying Manasquan prices.',
       'Inventory is thin and tightly held — expect to move quickly.']),

    T('Colts Neck', 'Monmouth County',
      'Horse country: five-acre zoning, no downtown, and the largest lots in the county.',
      '$1.7M', '$17,589', '1.49%', '≈ 75 min',
      'Drive to Red Bank or Aberdeen-Matawan; no station in the township',
      'Colts Neck Township K-8 · Colts Neck High School, one of six in the Freehold Regional district',
      '836 per 100K in 2023, half the state\'s 1,755.',
      ['Farms, orchards and equestrian properties, protected by the zoning.',
       'Well and septic on most lots — budget the inspections for both.',
       'No sidewalks anywhere. This is a driving town, and it is the point.']),

    T('Farmingdale', 'Monmouth County',
      'Half a square mile with a real Main Street and prices from another decade.',
      '$600K', '$9,493', '1.79%', '≈ 110 min',
      'Drive to Belmar or Manasquan for the North Jersey Coast Line',
      'Farmingdale School District K-8, about 160 pupils · Howell High School, in the Freehold Regional district',
      'No separate police agency files a UCR return for the borough, so there is no municipal rate to quote.',
      ['Victorian housing stock within walking distance of Main Street.',
       'Surrounded entirely by Howell, so most services are shared.',
       'The lowest entry price of any walkable town in the county.']),

    T('Freehold', 'Monmouth County',
      'The county seat — a walkable downtown borough ringed by a far larger township.',
      '$500K', '$8,842', '2.14%', '≈ 75 min drive',
      'No station — the Route 9 park-and-ride buses, or drive to Matawan',
      'Freehold Borough K-8 and Freehold Township K-8 are separate districts · both feed the Freehold Regional High School District',
      '1,015 per 100K in the borough in 2023; 1,627 in the township. State: 1,755.',
      ['Two municipalities share the name: the walkable borough, and the township around it.',
       'Courthouse, theater and thirty-odd restaurants inside the borough.',
       'The borough and the township price and tax very differently — confirm which one an address is in.']),

    T('Highlands', 'Monmouth County',
      'The bargain on the bay: a ferry commute and largely rebuilt housing stock.',
      '$600K', '$8,985', '1.94%', '≈ 40 min',
      'Seastreak ferry from the Highlands dock — 40 min to the Battery Maritime Building',
      'Highlands Elementary PreK-6 · consolidated with Atlantic Highlands into the Henry Hudson Regional K-12 district in July 2024',
      '493 per 100K in 2023, well under the state\'s 1,755.',
      ['Much of the town was raised or rebuilt after 2012 — ask what year, and how high.',
       'Flood insurance is the first question here, not the last one.',
       'Walk to Sandy Hook, the bridge and the Henry Hudson Trail.']),

    T('Hoboken', 'Hudson County',
      'A square mile across the river, and the shortest commute in New Jersey.',
      '$999K', '$9,531', '1.07%', '≈ 10 min',
      'PATH to the World Trade Center · NY Waterway ferry to Midtown',
      'Hoboken Public Schools · the district also hosts several charter schools, so confirm which school a given address feeds',
      '1,627 per 100K in 2023 — below the state\'s 1,755, in the densest square mile in the state.',
      ['Almost entirely condo and co-op — read the offering plan and the reserves.',
       'Parking is a monthly cost, not something that comes with the unit.',
       'Flood history west of Washington Street is real and well documented.']),

    T('Keyport', 'Monmouth County',
      'A working waterfront on Raritan Bay with the lowest entry price on the water.',
      '$650K', '$9,219', '2.06%', '≈ 60 min',
      'Drive to Aberdeen-Matawan — 56 to 65 min to Penn Station on the peak trains',
      'Keyport Public Schools, K-12 in one small district',
      '1,805 per 100K in 2023, a shade above the state\'s 1,755.',
      ['Antique shops and restaurants along Front Street and the waterfront.',
       'Bayfront sunsets and dockage — there is no ocean beach here.',
       'One K-12 district, which some families like and others want to check carefully.']),

    T('Little Silver', 'Monmouth County',
      'Its own station, top-rated elementary schools, and no through traffic.',
      '$1.3M', '$16,481', '1.64%', '≈ 80 min',
      'North Jersey Coast Line from Little Silver — 78 to 85 min on the peak trains',
      'Little Silver K-8, among the best regarded in the county · Red Bank Regional High School, which it co-founded with Red Bank and Shrewsbury in 1969',
      '887 per 100K in 2023, half the state\'s 1,755, with no violent index offenses reported.',
      ['Bought for the elementary schools, and priced accordingly.',
       'Walk to the Shrewsbury River, the train and Sickles Market.',
       'Very little turnover — when something good lists, expect company.']),

    T('Long Branch', 'Monmouth County',
      'Oceanfront redevelopment: Pier Village at one end, century-old neighborhoods at the other.',
      '$760K', '$12,635', '1.37%', '≈ 90 min',
      'North Jersey Coast Line from Long Branch — the end of the electrified track',
      'Long Branch Public Schools · a large, diverse PreK-12 district with strong specialized programs',
      '1,718 per 100K in 2023, level with the state\'s 1,755.',
      ['New oceanfront condos standing next to hundred-year-old cottages.',
       'Pier Village dining, shops and beach access without a beach-club membership.',
       'The most rental-friendly beach market in the county.']),

    T('Matawan', 'Monmouth County',
      "The commuter's pick — the county's fastest train is minutes from the middle of town.",
      '$615K', '$11,571', '2.26%', '≈ 60 min',
      'Aberdeen-Matawan — 56 to 65 min to Penn Station, the quickest in the county',
      'Matawan-Aberdeen Regional School District, K-12',
      'Matawan\'s agency reported one index offense for all of 2023. That is a reporting gap, not a crime rate, so no rate is quoted here.',
      ['The best value per commuting minute anywhere in the county.',
       'The highest effective tax rate on this list — 2.26% of market value.',
       'The park-and-ride fills early; older stock near Main Street, newer on the Aberdeen side.']),

    T('Middletown', 'Monmouth County',
      "The county's biggest township: 42 square miles and a dozen genuinely different neighborhoods.",
      '$785K', '$11,666', '1.74%', '≈ 70 min',
      'Middletown station on the North Jersey Coast Line, plus two more stations and the Belford ferry',
      'Middletown Township Public Schools, PreK-12 · two high schools, North and South — confirm which one an address feeds',
      '769 per 100K in 2023, well under half the state\'s 1,755, across 65,000 residents.',
      ['Navesink, Lincroft, Leonardo and River Plaza are all Middletown, and price very differently.',
       'Three rail stations and a ferry dock inside one township.',
       'Ask which high school an address feeds before you fall in love with it.']),

    T('Morganville', 'Monmouth County',
      'A Marlboro address with newer construction and some of the strongest schools in the county.',
      '$735K', '$12,779', '1.69%', '≈ 75 min',
      'Drive to Aberdeen-Matawan, or the Route 9 buses',
      'Marlboro Township K-8 · Marlboro High School, in the Freehold Regional district',
      '1,188 per 100K across Marlboro Township in 2023, below the state\'s 1,755.',
      ['Morganville is a section of Marlboro Township, not its own municipality — the tax and crime figures are the township\'s.',
       'The price shown is the 07751 ZIP; Marlboro Township as a whole runs higher, around $920K.',
       'Mostly 1990s and 2000s colonials on half-acre-plus lots, and no downtown.']),

    T('Morristown', 'Morris County',
      'A real small city: Midtown Direct trains, a green in the middle, and restaurants on every side of it.',
      '$788K', '$11,181', '1.68%', '≈ 60 min',
      'Morris & Essex Midtown Direct to Penn Station, no change at Hoboken',
      'Morris School District, a regional district shared with Morris Township',
      '586 per 100K in 2023, a third of the state\'s 1,755, for a downtown this busy.',
      ['The most urban downtown in Morris County, by a distance.',
       'Condos and townhomes downtown; colonials the moment you leave it.',
       'A different market from the shore entirely — price it on Morris County comps.']),

    T('Point Pleasant', 'Ocean County',
      'A year-round river town next door to the boardwalk, without the boardwalk prices.',
      '$850K', '$9,767', '1.44%', '≈ 120 min',
      'North Jersey Coast Line from Point Pleasant Beach — the far end of the line',
      'Point Pleasant Borough Schools, PreK-12 in one district',
      '454 per 100K in the borough in 2023, a quarter of the state\'s 1,755.',
      ['Point Pleasant Borough and Point Pleasant Beach are two separate towns — the Beach has the boardwalk, and its own taxes and figures.',
       'Manasquan River dockage, minutes from the inlet.',
       'The commute is the trade-off: two hours each way on the train.']),

    T('Red Bank', 'Monmouth County',
      "The county's cultural downtown — theater, a hundred restaurants, and a train to Manhattan.",
      '$862K', '$10,937', '1.78%', '≈ 75 min',
      'North Jersey Coast Line from Red Bank — 73 to 81 min on the peak trains',
      'Red Bank Borough Public Schools K-8 · Red Bank Regional High School, known for its performing-arts academy',
      '1,473 per 100K in 2023, under the state\'s 1,755, for a downtown that stays busy late.',
      ['Count Basie Center, Two River Theater, and the densest restaurant strip in the county.',
       'Condos and lofts downtown; Victorians on the west side.',
       'The most walkable non-beach town in Monmouth County.']),

    T('Rumson', 'Monmouth County',
      "The county's premier address: estate lots on the peninsula between two rivers.",
      '$2.7M', '$23,607', '1.11%', '≈ 80 min',
      'Drive to Little Silver — 78 to 85 min to Penn Station from there',
      'Rumson K-8 · Rumson-Fair Haven Regional, one of the best-regarded high schools in the state',
      '603 per 100K in 2023, a third of the state\'s 1,755.',
      ['Waterfront and estate properties on the Navesink and the Shrewsbury.',
       'The biggest tax bill in the county on one of its lowest rates — 1.11% of a very large number.',
       'Zoning protects the lot sizes, so there is very little new construction.']),

    T('Sea Bright', 'Monmouth County',
      'A barrier strip a block wide — ocean on one side, river on the other.',
      '$860K', '$10,002', '0.87%', '≈ 40 min',
      'Seastreak ferry from Highlands, a short drive north',
      'K-8 through Oceanport · Shore Regional High School. The borough won a NJ Supreme Court ruling in 2025 letting it petition to leave both — worth watching',
      '227 per 100K in 2023, on 1,323 year-round residents, against the state\'s 1,755.',
      ['The second-lowest effective tax rate on this list, at 0.87%.',
       'Rebuilt and raised after Sandy — ask for the elevation certificate every time.',
       'One road in and one road out, which matters in a storm and at 5pm.']),

    T('Shrewsbury', 'Monmouth County',
      'Small, central and quietly expensive — the geographic middle of everything.',
      '$1.2M', '$14,198', '1.79%', '≈ 75 min',
      'Little Silver or Red Bank, both a few minutes away',
      'Shrewsbury Borough K-8, a single well-regarded school · Red Bank Regional High School, which it co-founded',
      '2,780 per 100K in 2023, almost entirely retail larceny at The Grove; violent offenses were two.',
      ['The Grove shopping district and the Route 35 corridor are both in town.',
       'A colonial-era center at Broad and Sycamore, and real history to go with it.',
       'The borough is tiny — 4,000 people — so inventory is always thin.']),

    T('Tinton Falls', 'Monmouth County',
      "Central, well-priced, and the county's widest range of new construction.",
      '$524K', '$8,456', '1.42%', '≈ 80 min',
      'Little Silver or Red Bank · Route 18 and the Parkway for drivers',
      'Tinton Falls K-8 · Monmouth Regional High School, shared with Eatontown and Shrewsbury Township',
      '1,251 per 100K in 2023, under the state\'s 1,755, with no murders or robberies reported.',
      ['The lowest median price on this list outside Whiting and Freehold.',
       'Active-adult and new-build communities alongside much older neighborhoods.',
       'The township straddles the Parkway, so where you are inside it matters.']),

    T('Wall Township', 'Monmouth County',
      'Big lots, a low effective rate for the county, and a mile from the Manasquan beaches.',
      '$750K', '$10,477', '1.35%', '≈ 110 min',
      'North Jersey Coast Line from Manasquan or Belmar · Route 18 and I-195 for drivers',
      'Wall Township Public Schools, PreK-12 in one well-regarded district',
      '1,458 per 100K in 2023, below the state\'s 1,755, across 31 square miles.',
      ['The township runs from working farmland to a mile off the beach.',
       'One K-12 district for the whole township, which parents tend to like.',
       'Monmouth Executive Airport and the Route 34/35 corridors are both here.']),

    T('Whiting', 'Ocean County',
      'Active-adult country, and the lowest cost of ownership anywhere in the region.',
      '$248K', '$5,327', '1.51%', 'Not a commute',
      'No practical transit — this is a retirement market',
      'Manchester Township Schools · most of Whiting is age-restricted, so schools rarely come up',
      '450 per 100K across Manchester Township in 2023, a quarter of the state\'s 1,755.',
      ['Almost entirely 55+ communities, each with its own monthly association fee.',
       'The lowest median price and the smallest tax bill on this list, by a wide margin.',
       'Whiting is a section of Manchester Township, not a municipality of its own — the tax and crime figures are the township\'s.'])
  ];

  global.GVC_NJ_TOWNS = { AS_OF: AS_OF, list: list };
})(window);
