/* ============================================================
   NEW YORK CITY AREA TEARSHEETS — the NYC half of the Buyer
   Package's optional area pages. Its New Jersey twin is
   assets/js/nj-towns.js, and the two are deliberately the same
   shape: same record, same renderer, same page. Only the labels
   and the sources differ, so the packet swaps market with one
   toggle.

   The list is the five boroughs, then the Manhattan submarkets a
   buyer actually shops in, in the order they appear in the panel.

   ------------------------------------------------------------
   EVERY FIGURE BELOW WAS LOOKED UP. HERE IS WHERE FROM.

   Checked 2 September 2026:

     price    StreetEasy Data Dashboard, median sale price, July
              2026 — the operator's own published CSV, using
              StreetEasy's own borough and neighbourhood
              boundaries. Not asking price; recorded sales.
     tax      NYC Dept. of Finance assessment roll, FY2025/26,
              via NYC Open Data (dataset 8y4t-faws). For every
              Manhattan area and for Manhattan itself this is the
              MEDIAN CONDO UNIT: Tax Class 2, one unit, building
              class R*. For the outer boroughs it is the MEDIAN
              CLASS 1 HOUSE, which is what people there buy.
              Computed as taxable value x the DOF rate for that
              class — 19.843% Class 1, 12.439% Class 2, both the
              published FY2026 rates.
     days     StreetEasy Data Dashboard, median days on market,
              July 2026. This replaces the NJ sheet's effective
              tax rate, which does not translate: see below.
     mins     Scheduled weekday-AM one-seat subway ride to a 42nd
              Street hub (Times Sq, Grand Central, Bryant Pk or
              Port Authority), computed from the MTA's own GTFS
              schedule feed, version 20260826. Where two figures
              are given, the first is the fastest line and the
              second the typical one. Staten Island is the NYC
              DOT ferry, 25 minutes, plus the subway north.
     transit  The lines that actually run that trip, from the
              same feed.
     schools  NYC DOE community school district, and how
              admission works — which in this city matters far
              more than the district number.
     crime    NYPD, seven major felony offences by precinct,
              full-year 2025, against 2020 Census population for
              the same precincts. The citywide figure is 1,376
              per 100,000, and every line quotes it as a yardstick.
              Precinct populations are John Keefe's published
              block-centroid aggregation of the 2020 Census,
              which is a derivation, not an NYPD product.
     notes    Three things that decide a deal here. Judgement,
              not data.

   WHY THERE IS NO "TAX RATE" COLUMN HERE. The NJ sheet shows
   effective tax rate because in New Jersey it is the number that
   explains the bill. In New York City it explains nothing you can
   act on: Class 1 houses run about 0.7% of market value and Class
   2 about 3.7%, the assessment is capped and phased so two
   identical apartments can carry very different bills, and co-ops
   are billed to the building, not the apartment. Days on market
   is the number a NYC buyer can actually use, so it takes the
   slot. The class rules are in each area's notes instead.

   WHAT THE NUMBERS DO NOT DO. A median sale price is not a
   valuation, and in Manhattan it mixes co-ops and condos, which
   price and carry very differently. The tax figure is a median
   condo unit, not this apartment. It excludes common charges or
   maintenance, which in most of Manhattan is the larger monthly
   number. A 2025 crime rate is a year behind by the time you hand
   this over.

   THREE CRIME FIGURES CARRY A CAVEAT AND SAY SO ON THE PAGE.
   A precinct rate is offences divided by RESIDENTS, so anywhere
   with far more daytime visitors than residents reads high:
   Midtown West (Times Square, 96,000 residents), Tribeca and the
   Financial District (both the 1st Precinct). The lines say so.

   TWO PAIRS SHARE A PRECINCT. Greenwich Village and the West
   Village are both the 6th; Tribeca and the Financial District
   are both the 1st. Their crime figures are therefore identical
   by construction, and the notes say so rather than implying the
   two markets are policed separately.

   TO RE-CHECK AN AREA: every source above is public and free.
   Correct the figures and bump AS_OF in the same commit. If you
   put a number in here you have not looked up, take the area's
   name out of VERIFIED so the page stamps itself.

   Fields, in order:
     name     the area as a buyer would say it
     county   printed as the eyebrow — the borough
     tag      one line on what the area actually is
     price    median sale price, short form
     tax      median annual property tax, and for which product
     days     median days on market
     mins     door-to-Midtown, the honest number
     transit  the lines that make that trip
     schools  district, and how admission works
     crime    major felonies per 100,000, against the city's 1,376
     notes    three things that decide a deal here
   ============================================================ */
(function (global) {
  'use strict';

  const AS_OF = 'Sources checked September 2026 — StreetEasy (Jul 2026), NYC DOF assessment roll ' +
                '(FY2025/26), MTA GTFS schedule feed, NYPD seven major felonies (2025)';

  /* Areas whose figures have been checked against the sources named at the
     top of this file. All of them, as of 2 September 2026. Take a name out
     the moment somebody edits its numbers without re-checking them. */
  const VERIFIED = [
    'Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island',
    'Upper East Side', 'Upper West Side', 'Midtown East', 'Midtown West',
    'Chelsea', 'Greenwich Village', 'West Village', 'Tribeca',
    'Financial District', 'East Village', 'Lower East Side',
    'Central Harlem', 'Washington Heights'
  ];

  const A = (name, county, tag, price, tax, days, mins, transit, schools, crime, notes) =>
    ({ name, county, tag, price, tax, days, mins, transit, schools, crime, notes,
       verified: VERIFIED.indexOf(name) > -1 });

  const list = [
    /* ---------- the five boroughs ---------- */
    A('Manhattan', 'New York City',
      'The borough the rest of the region commutes into — and the only one where almost nobody owns a house.',
      '$1.23M', '$17,415', '78 days', '8–11 min',
      '1/2/3, 4/5/6, A/C/E, B/D/F/M, N/Q/R/W — measured from 96 St',
      'Community school districts 1 through 6 · Manhattan has no zoned high schools at all; every family goes through the citywide match',
      '1,786 per 100K in 2025, against the city\'s 1,376.',
      ['The tax figure is the median condo unit. A Class 1 house here runs $32,000, and there are only 12,400 of them.',
       'Common charges or maintenance are the bigger monthly number, and they are not in any figure on this page.',
       'Co-ops are billed to the building and sold with a board interview; condos are neither. That choice comes before the neighbourhood.']),

    A('Brooklyn', 'New York City',
      'Now the second-priciest borough, and the one with real houses at the top of the market.',
      '$1.15M', '$7,578', '55 days', '20–22 min',
      '2/3, 4/5, B/D, N/Q, R/W — measured from Atlantic Av-Barclays Ctr',
      'Community school districts 13 through 23 and 32 · zoned high schools exist here, unlike Manhattan',
      '1,133 per 100K in 2025, below the city\'s 1,376.',
      ['The tax figure is the median Class 1 house — 405,000 of them, against 82,500 condo units at a $10,611 median.',
       'Second-fastest in the city at 55 days to contract, against 78 in Manhattan — only Staten Island moves quicker.',
       'A brownstone and a new condo three blocks apart are taxed under completely different rules.']),

    A('Queens', 'New York City',
      'The city\'s house market: more one- to three-family homes than any other borough, by a wide margin.',
      '$810K', '$7,810', '62 days', '16–18 min',
      'E/F express, M, R — measured from Jackson Hts-Roosevelt Av',
      'Community school districts 24 through 30 · zoned high schools, and the most-used school-choice programmes in the city',
      '1,098 per 100K in 2025, the second-lowest of the five boroughs.',
      ['557,000 Class 1 houses — more than Brooklyn and Staten Island put together.',
       'Sixteen minutes to Bryant Park on the F from Jackson Heights, which is faster than most of Manhattan north of 96th.',
       'Condo units here carry a lower median tax than houses do, at $6,488.']),

    A('The Bronx', 'New York City',
      'The cheapest borough to buy in, and the one carrying the city\'s highest crime rate.',
      '$670K', '$6,618', '78 days', '22 min',
      '4 from 161 St-Yankee Stadium; B/D a few minutes slower',
      'Community school districts 7 through 12 · zoned high schools',
      '2,059 per 100K in 2025 — half again the city\'s 1,376, and the highest of the five boroughs.',
      ['The lowest median price and the lowest median house tax bill in the city.',
       'Condo units are taxed at a $3,088 median, the lowest anywhere in New York.',
       'Riverdale, Throgs Neck and Mott Haven are three unrelated markets sharing one borough figure.']),

    A('Staten Island', 'New York City',
      'A suburb inside the city limits — houses, driveways, and a ferry instead of a subway.',
      '$680K', '$6,806', '49 days', '25 min + subway',
      'NYC DOT ferry, St George to Whitehall, free, every 15–20 min at peak · then the 1 or R north',
      'Community school district 31, the only one on the island · zoned high schools',
      '643 per 100K in 2025, less than half the city\'s 1,376 and the lowest by a distance.',
      ['The safest borough, and the fastest-selling anywhere in the city — 49 days to contract, against 78 in Manhattan.',
       'The ferry is free and takes 25 minutes; the subway on the far side is the part people forget to count.',
       '221,000 Class 1 houses and only 5,700 condo units, so this is a house market and prices like one.']),

    /* ---------- Manhattan submarkets ---------- */
    A('Upper East Side', 'Manhattan',
      'Prewar co-ops, the best express-train position in the city, and the museums on the doorstep.',
      '$1.31M', '$17,918', '76 days', '7–8 min',
      '4/5/6 on Lexington, Q on Second Avenue',
      'Community school district 2 below 96th Street, district 4 above it · no zoned high schools anywhere in Manhattan',
      '1,052 per 100K in 2025 — well under the city\'s 1,376, and down 5.4% on 2024.',
      ['Seven minutes to Grand Central on the 6. Nothing else in Manhattan is closer to Midtown for the money.',
       'Heavily co-op, which means board packages, interviews and financing minimums before you get a contract.',
       'The Second Avenue Q reset values east of Third — the blocks that were a walk from the train no longer are.']),

    A('Upper West Side', 'Manhattan',
      'The family end of Manhattan: bigger prewar layouts, the park on one side and the river on the other.',
      '$1.25M', '$16,495', '64 days', '4–7 min',
      '1/2/3 on Broadway, B/C on Central Park West',
      'Community school district 3, which runs 59th to 122nd and is known for its middle-school choice process',
      '997 per 100K in 2025, the lowest rate of any Manhattan submarket on this list.',
      ['Four minutes to Times Square on the 2 or 3 express from 72nd Street.',
       'Sells faster than the East Side — 64 days against 76 — on very similar money.',
       'Two parks, and the price difference between a Central Park West line and a West End Avenue one is large.']),

    A('Midtown East', 'Manhattan',
      'You are already there: the cheapest way into a Manhattan address if the commute is the whole point.',
      '$795K', '$16,283', '86 days', '2 min',
      '6 at 51 St, E/M at Lexington-53, Grand Central four blocks south',
      'Community school district 2 · no zoned high schools in Manhattan; admission is the citywide match',
      '958 per 100K in 2025, low for a district this busy by day.',
      ['The lowest median price of any Manhattan submarket here except the Lower East Side.',
       'Slow to sell — 86 days — because the buyer pool is pied-à-terre and investor, not family.',
       'The tax bill is Upper East Side money on an $795K apartment, which is the whole argument against it.']),

    A('Midtown West', 'Manhattan',
      'Hell\'s Kitchen and the theatre district: new towers, old tenements, and the transit hub of the country.',
      '$995K', '$17,632', '87 days', '2 min',
      '1/C/E at 50 St, plus every line at Times Square and Port Authority',
      'Community school district 2 · no zoned high schools in Manhattan',
      '6,061 per 100K in 2025 — but that is Times Square\'s offences divided by 96,000 residents. Read it as a daytime figure, not a residential one.',
      ['The crime rate here is a measurement artefact: the 14th and 18th Precincts police the busiest tourist district in America.',
       'New construction dominates, so expect 421-a tax abatements with expiry dates — ask when it burns off.',
       'Ninth and Tenth Avenue west of the towers is a completely different, quieter market.']),

    A('Chelsea', 'Manhattan',
      'Galleries, the High Line, and seven subway lines inside a few blocks.',
      '$1.41M', '$25,460', '73 days', '4 min',
      '1 at 23 St, C/E on Eighth, F/M on Sixth, R/W on Broadway',
      'Community school district 2 · no zoned high schools in Manhattan',
      '1,592 per 100K in 2025, above the city\'s 1,376.',
      ['A $25,460 median condo tax — the highest on this list bar Tribeca, on a $1.41M median price.',
       'Hudson Yards and West Chelsea new-build pulled the median tax up; older Chelsea co-ops are nothing like it.',
       'Seven lines within a few blocks, which is why it holds value even when the gallery district turns over.']),

    A('Greenwich Village', 'Manhattan',
      'Low buildings, landmarked blocks and the highest median price in Manhattan outside Tribeca.',
      '$2.25M', '$19,027', '73 days', '6–8 min',
      'A/B/C/D/E/F/M all at W 4 St-Wash Sq',
      'Community school district 2 · no zoned high schools in Manhattan',
      '2,406 per 100K in 2025 across the 6th Precinct — which it shares with the West Village, so the two read identically.',
      ['Eight lines at one station. Nothing else downtown matches it.',
       'Historic district rules govern most of it, so renovation is slower and dearer than the price suggests.',
       'Down 13.1% on crime year over year, the sharpest improvement of any area on this list.']),

    A('West Village', 'Manhattan',
      'The most expensive small blocks in the city, and the ones with the worst subway access.',
      '$1.77M', '$20,735', '67 days', '8 min',
      'Only the 1 at Christopher St-Stonewall; everything else is a walk east',
      'Community school district 2 · no zoned high schools in Manhattan',
      '2,406 per 100K in 2025 — the same 6th Precinct figure as Greenwich Village, not a separate measurement.',
      ['Sells faster than anywhere else on this list bar the East Village — 67 days.',
       'One train. Buyers who commute to Midtown East should test the trip before they fall in love.',
       'Townhouses set the tone but almost never trade; the median is co-ops and small condos.']),

    A('Tribeca', 'Manhattan',
      'Lofts, the highest median price in the city, and the biggest tax bill on this page.',
      '$3.45M', '$29,746', '72 days', '8–12 min',
      '1/2/3 at Chambers St, A/C two blocks east',
      'Community school district 2 · no zoned high schools in Manhattan',
      '2,120 per 100K in 2025 across the 1st Precinct, shared with the Financial District — and inflated by a daytime population many times the resident one.',
      ['$3.45M median and a $29,746 median condo tax, both the highest in New York.',
       'Loft conversions mean square footage is real but layouts are odd — measure, do not trust the floor plan.',
       'PS 234 is the reason a lot of these deals happen, and district 2 has no zoned high school to follow it.']),

    A('Financial District', 'Manhattan',
      'The value end of downtown: office-to-residential conversions at half the Tribeca price, four blocks away.',
      '$950K', '$18,228', '92 days', '12 min',
      '2/3 and 4/5 at Wall St, plus the Fulton Center complex',
      'Community school district 2 · no zoned high schools in Manhattan',
      '2,120 per 100K in 2025 — the same 1st Precinct figure as Tribeca, and likewise a daytime-population artefact.',
      ['Slow to trade at 92 days — only Central Harlem and Washington Heights sit longer — and the largest discount to its own neighbourhood.',
       'Mostly conversions, so ask what the building was and when: layouts, light and column spacing all follow from it.',
       'Battery Park City next door is on ground-lease land, which changes the maths entirely.']),

    A('East Village', 'Manhattan',
      'The fastest-selling market in Manhattan, and the cheapest tax bill below 96th Street.',
      '$1.08M', '$14,007', '57 days', '8 min',
      '6 at Astor Pl, L at First Avenue, F at Second Avenue',
      'Community school district 1, one of three districts in the city with no zoned elementary or middle schools — every family applies',
      '1,760 per 100K in 2025, above the city\'s 1,376.',
      ['57 days to contract, the fastest anywhere in Manhattan — demand here is deep and year-round.',
       'The lowest median condo tax in Manhattan south of Harlem, at $14,007.',
       'District 1 has no zoned schools at any level. Families should understand the match before they buy.']),

    A('Lower East Side', 'Manhattan',
      'The cheapest median price in Manhattan, sitting next to some of its newest luxury towers.',
      '$720K', '$18,405', '61 days', '14 min',
      'F/M at Delancey-Essex, J/Z above it',
      'Community school district 1 · no zoned elementary, middle or high schools — admission is entirely by application',
      '1,581 per 100K in 2025, and down 10.0% on 2024.',
      ['A $720K median price against an $18,405 median condo tax — the widest gap on this page, and it needs explaining to a buyer.',
       'That gap is Essex Crossing and One Manhattan Square: a handful of new towers carrying most of the tax base.',
       'Fourteen minutes to Bryant Park, the slowest downtown commute on this list.']),

    A('Central Harlem', 'Manhattan',
      'Brownstones at a fraction of downtown money, and the express train that makes it work.',
      '$950K', '$11,863', '108 days', '11–16 min',
      'A express at 125 St, plus B/C/D and the 2/3 on Lenox',
      'Community school district 5 · no zoned high schools in Manhattan',
      '1,727 per 100K in 2025, down 7.3% on 2024.',
      ['Eleven minutes to 42nd Street on the A express — faster than the Financial District.',
       'Slow to sell, at 108 days, so there is room to negotiate that downtown does not offer.',
       'Brownstone stock means Class 1 tax rules, not the condo figure shown — confirm the class before you underwrite.']),

    A('Washington Heights', 'Manhattan',
      'The last of Manhattan under $700K, and the tax bill to match.',
      '$670K', '$6,777', '111 days', '18–26 min',
      'A express from 168 St, 18 min; the 1 local takes 26',
      'Community school district 6 · no zoned high schools in Manhattan',
      '1,406 per 100K in 2025, almost exactly the city average of 1,376.',
      ['A $6,777 median condo tax — less than a house in Queens, and a quarter of Tribeca.',
       'The slowest market on this page at 111 days, and the only Manhattan area on it priced with the outer boroughs.',
       'The A express is the whole case: 18 minutes to 42nd Street. The 1 local is a different commute entirely.'])
  ];

  global.GVC_NYC_AREAS = { AS_OF: AS_OF, list: list };
})(window);
