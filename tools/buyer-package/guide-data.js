/* ============================================================
   BUYER'S GUIDE — the words that change with the market.

   The guide prints for one of three markets, chosen on the Cover panel:
   New York City, New Jersey or Florida. Everything in here is either
   per-market (the cover photo, the testimonial, the state-specific lines on
   the "50 Things" and "Don't Forget to Ask" pages) or per-agent (the bios on
   the "Meet Your Agent" pages). index.html owns the layout; this file owns
   the copy, so a teammate can correct a sentence without touching markup.

   Nothing here is a quote or a bio written by us: the testimonials are the
   clients' own words from gvcrealestateteam.com and each bio is the
   team site's text for that person (gvcrealestateteam.com/about), with the
   name put back at the front where the site's card sets it in a heading.

   The state-specific lines are practice, not law. Rules and deadlines move —
   re-read them against the current forms before a season's guides go out.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- the three markets ---------- */
  var REGIONS = {
    nyc: {
      id: 'nyc', label: 'NYC', name: 'New York City',
      cover: 'static/cover-nyc.jpg',
      quote: {
        text: 'She was incredibly attentive, always responsive, and extremely professional & helpful ' +
              'throughout the entire process. She took the time to explain every step in detail, making ' +
              'what could have been a stressful experience feel smooth and manageable. I always felt ' +
              'informed and supported in every decision.',
        who: 'Andrya M., Buyer'
      }
    },
    nj: {
      id: 'nj', label: 'NJ', name: 'New Jersey',
      cover: 'static/cover-nj.jpg',
      quote: {
        text: 'This is my third closing with Marli and she is the best realtor I have ever worked with ' +
              '— and trust me, I have worked with quite a few. She makes finding and buying a home ' +
              'very easy, and her real estate expertise is outstanding.',
        who: 'Melinda B., Buyer'
      }
    },
    fl: {
      id: 'fl', label: 'FL', name: 'Florida',
      cover: 'static/cover-nyc.jpg',
      /* Florida fronts with the New York testimonial, same as the cover photo */
      quote: null
    }
  };
  REGIONS.fl.quote = REGIONS.nyc.quote;

  /* ============================================================
     50 THINGS WE DO AS YOUR BUYER'S AGENT

     Five groups, 50 lines in all. Each group is a shared run that every
     market gets, followed by a market's own lines; the totals are checked in
     index.html (a console warning if any market is not exactly 50).
     ============================================================ */
  var FIFTY_GROUPS = ['Getting ready', 'Finding the home', 'Making the offer',
                      'Contract & due diligence', 'Closing & beyond'];

  var FIFTY_COMMON = [
    [ /* getting ready — 6 */
      'Set a realistic budget and timeline with you',
      'Connect you with lenders for a written pre-approval',
      'Show the real monthly cost, not just the mortgage',
      'Sort your must-haves from your deal-breakers',
      'Explain the buyer agreement and how I am paid',
      'Set up listing alerts so you see new homes first'
    ],
    [ /* finding the home — 7 */
      'Pre-screen listings so you tour only the right ones',
      'Book and attend every private showing with you',
      'Tap my network for off-market homes',
      'Research price history and time on the market',
      'Pull recent nearby sales to show real prices',
      'Tell you honestly when a home is wrong for you',
      'Point out what photos hide: noise, light, layout, street'
    ],
    [ /* offer — 5 */
      'Price your offer against real comparable sales',
      'Structure terms and dates to make it competitive',
      'Find out what the seller actually needs',
      'Negotiate counter-offers, credits and repairs for you',
      'Keep every agreed term in writing'
    ],
    [ /* contract & diligence — 6 */
      'Recommend inspectors and specialists, and attend',
      'Review the report with you and decide what to ask for',
      'Track every deadline so nothing lapses',
      'Coordinate lender, appraiser and attorney or title',
      'Chase the paperwork you would otherwise forget',
      'Update you weekly, not just when things change'
    ],
    [ /* closing & beyond — 8 */
      'Do the final walk-through with you',
      'Check the closing figures before you sign',
      'Warn you to confirm wire instructions by phone',
      'Line up utilities, insurance and moving dates',
      'Be at the closing table with you',
      'Hand you the keys',
      'Introduce movers, contractors and designers',
      'Stay your real estate resource long after closing'
    ]
  ];

  /* each market: the lines added to each of the five groups above */
  var FIFTY_BY_REGION = {
    nyc: [
      [ /* 2 */
        'Explain co-ops, condos and townhouses, and which fits you',
        'Get your finances board-package ready before you shop'
      ],
      [ /* 3 */
        'Review building financials, reserves and pending assessments',
        'Compare buildings on fees, amenities, pet and sublet rules',
        'Check the block: transit, noise, construction nearby'
      ],
      [ /* 3 */
        'Prepare the offer letter and proof of funds package',
        'Work out the deposit and contract terms with your attorney',
        'Read the offering plan and sponsor terms on new development'
      ],
      [ /* 6 */
        'Assemble and submit your co-op or condo board package',
        'Prepare you for the board interview',
        'Go through minutes and financials with your attorney',
        'Explain the NYC and New York State taxes that apply to you',
        'Track the mortgage commitment and contract deadlines',
        'Arrange the managing agent’s move-in requirements'
      ],
      [ /* 4 */
        'Confirm your move-in date with the building',
        'Book the elevator and certificate of insurance for move day',
        'Coordinate keys and fobs with the managing agent',
        'Introduce New York architects, contractors and designers'
      ]
    ],
    nj: [
      [ /* 2 */
        'Compare towns by taxes, schools and commute',
        'Explain NJ’s attorney-review period up front'
      ],
      [ /* 3 */
        'Check flood zone, school feed and tax history',
        'Test the commute at rush hour, not at noon',
        'Look past the seller’s tax bill to your own'
      ],
      [ /* 3 */
        'Make the contract dates and review terms clear',
        'Negotiate the deposit and what conveys with the house',
        'Use escalation clauses carefully, never casually'
      ],
      [ /* 6 */
        'Run the three-day attorney review with your lawyer',
        'Order the survey and coordinate the title search',
        'Arrange radon, sewer-line and oil-tank checks',
        'Confirm the town’s CO and smoke/CO certificate',
        'Get a flood insurance quote before inspections end',
        'Check permits on basements, additions and decks'
      ],
      [ /* 4 */
        'Check property tax and escrow figures at closing',
        'Confirm the proration of taxes, fuel and utilities',
        'Remind you of tax-relief filings you may qualify for',
        'Introduce local contractors, landscapers and movers'
      ]
    ],
    fl: [
      [ /* 2 */
        'Explain Florida insurance, flood and HOA costs',
        'Explain condo reserves and milestone inspections'
      ],
      [ /* 3 */
        'Check flood zone, elevation and insurance quotes up front',
        'Read HOA or condo documents, fees and assessments',
        'Check roof, wiring, plumbing and HVAC ages (insurers will)'
      ],
      [ /* 3 */
        'Write the offer on the Florida Realtors/Bar contract',
        'Set the deposit, inspection and financing deadlines',
        'Build in an insurability check, not just price'
      ],
      [ /* 6 */
        'Order home, wind-mitigation and roof inspections',
        'Get homeowner’s and flood quotes before inspections end',
        'Review condo reserve study and milestone inspection',
        'Coordinate title, survey and closing agent',
        'Track the inspection period and financing deadlines',
        'Check open permits and claims history'
      ],
      [ /* 4 */
        'Help you file for the Florida homestead exemption',
        'Line up hurricane prep and insurance papers',
        'Coordinate HOA or condo approval and move-in',
        'Introduce local contractors, pool services and movers'
      ]
    ]
  };

  /* The five groups for a market, as [{title, items:[...]}]. */
  function fiftyFor(region) {
    var extra = FIFTY_BY_REGION[region] || FIFTY_BY_REGION.nyc;
    return FIFTY_GROUPS.map(function (title, i) {
      return { title: title, items: FIFTY_COMMON[i].concat(extra[i]) };
    });
  }

  /* ============================================================
     DON'T FORGET TO ASK

     The page for the agent, not the buyer: the questions that go missing
     from a first consultation. The first five groups are the same in every
     market; the sixth is the market's own.
     ============================================================ */
  var ASK_COMMON = [
    { title: 'The money', items: [
      'Do you need to sell or rent out a home before you can buy?',
      'Where is the down payment coming from: savings, a gift, a sale, retirement funds?',
      'Have you spoken to a lender, and what is your all-in monthly number?',
      'Any job, income or debt changes coming in the next year?',
      'How much cash do you want left in the bank after closing?'
    ]},
    { title: 'The plan for the home', items: [
      'Will you renovate, and is that money set aside separately?',
      'Is this a primary home, a second home or an investment?',
      'Might you rent it out, even occasionally?',
      'How long do you expect to stay?',
      'Is anyone moving in later: kids, parents, a roommate?'
    ]},
    { title: 'The people', items: [
      'Who else has a say: spouse, partner, parents, a co-buyer?',
      'Have you all agreed on the non-negotiables?',
      'Who needs to see a home before you make an offer?',
      'Do you already have a lawyer, lender, inspector or agent agreement?',
      'Can you decide within a day when the right one comes up?'
    ]},
    { title: 'Time & logistics', items: [
      'When does your lease end, and what notice do you owe?',
      'Is there a hard move-in date: school year, job, baby?',
      'Which days and times can you actually tour?',
      'Would a rent-back or a flexible closing help?',
      'If relocating: have you been to the area at rush hour?'
    ]},
    { title: 'What goes wrong', items: [
      'Which contingencies would you be comfortable waiving?',
      'How far over asking would you really go?',
      'What would make you walk away?',
      'Anything in your credit or finances I should hear from you first?',
      'Have you lost a house before, and what happened?'
    ]}
  ];

  var ASK_BY_REGION = {
    nyc: { title: 'New York specifics', items: [
      'Co-op, condo or townhouse: do you know the difference and the board process?',
      'Are you comfortable disclosing your finances to a co-op board?',
      'Do pet, sublet, pied-à-terre or investor rules matter to you?',
      'Doorman, laundry, outdoor space or parking: which are musts?',
      'Are you fine with monthly maintenance or common charges and assessments?'
    ]},
    nj: { title: 'New Jersey specifics', items: [
      'Which towns, and have you looked at the tax bill, not just the price?',
      'Do you need a particular school district or commute?',
      'Are you open to an older home: oil tank, old wiring, flood zone?',
      'Do you have an attorney lined up for the three-day review?',
      'Planning a finished basement, addition or pool that needs permits?'
    ]},
    fl: { title: 'Florida specifics', items: [
      'Primary, seasonal or investment, and will you claim homestead?',
      'Have you priced homeowner’s, wind and flood insurance for a home like this?',
      'Are you comfortable with an HOA or condo’s fees, rules and reserves?',
      'Do you want impact windows, a newer roof, a generator or elevation?',
      'Cash or financed, and are you closing remotely or from out of state?'
    ]}
  };

  function askFor(region) {
    return ASK_COMMON.concat([ASK_BY_REGION[region] || ASK_BY_REGION.nyc]);
  }

  /* ============================================================
     MEET YOUR AGENT — per-person copy

     `bio` is the team site's own paragraph for the person. `facts` are
     [label, value] pairs and only state what the site states; anything the
     site does not say is left out rather than guessed. Name, title, phone,
     email, Instagram and the cut-out come from roster.js.

     To give a new teammate a page, add their roster.js id here. Without a
     row the page still prints from the roster alone (name, title, contact).
     ============================================================ */
  var PROFILES = {
    'john-gasdaska': {
      role: 'Co-Founder',
      bio: 'John Gasdaska, a trusted real estate advisor with over 25 years of experience, is known for his ' +
           'expertise as a broker, mentor, and client-focused professional in the luxury market.',
      facts: [['Experience', '25+ years'], ['In real estate since', '1999'], ['Role', 'Co-Founder, GVC Team']]
    },
    'tj-verdiglione': {
      role: 'Co-Founder',
      bio: 'TJ Verdiglione has excelled in luxury real estate across NY, NJ, and FL, achieving over $1 billion ' +
           'in career transactions and specializing in new development and asset management.',
      facts: [['Career sales', '$1B+ in transactions'], ['Markets', 'New York · New Jersey · Florida'],
              ['Focus', 'New development and asset management']]
    },
    'jonathan-conlon': {
      role: 'Co-Founder',
      bio: 'Jonathan Conlon, co-founder of GVC Real Estate, is known for his market expertise, integrity, and ' +
           'exceptional client service, delivering results with a compassionate, results-driven approach.',
      facts: [['In real estate since', '2002'], ['Role', 'Co-Founder, GVC Team']]
    },
    'katie-cook': {
      role: 'New York',
      bio: 'Katie Cook is a New York–based real estate professional with a background in advertising, ' +
           'culinary arts, and client-focused service. Known for her transparency, creativity, and strong ' +
           'listening skills, she brings a thoughtful, solutions-driven approach to every client relationship.',
      facts: [['Market', 'New York'], ['Background', 'Advertising and culinary arts'],
              ['Known for', 'Transparency, creativity, listening']]
    },
    'nicole-sobol': {
      role: 'New York',
      bio: 'Nicole Sobol, with over 15 years of experience, specializes in high-end rentals in Manhattan’s ' +
           'Midtown East, delivering exceptional client service with a well-informed perspective.',
      facts: [['Market', 'New York'], ['Experience', '15+ years'], ['Focus', 'High-end rentals, Midtown East']]
    },
    'gary-kasparov': {
      role: 'New York',
      bio: 'Gary Kasparov brings a client-first, family-oriented approach to New York City real estate, ' +
           'combining honesty, persistence, and creative problem-solving to guide clients through even the most ' +
           'challenging transactions. With more than a decade of experience at McKinsey & Co., Accenture, and ' +
           'Bank of America, he leverages his analytical, advisory, and negotiation skills to deliver ' +
           'exceptional results and a seamless experience.',
      facts: [['Market', 'New York City'], ['Before real estate', 'McKinsey & Co., Accenture, Bank of America'],
              ['Strengths', 'Analysis, advising, negotiation']]
    },
    'ayuen-gai': {
      role: 'NY Operations Manager',
      bio: 'Ayuen Gai offers clients a rare blend of talents including analytical expertise, operational ' +
           'precision, and luxury service.',
      facts: [['Market', 'New York'], ['Role', 'NY Operations Manager']]
    },
    'marli-silver': {
      role: 'New Jersey',
      bio: 'Marli Silver is a Monmouth County native with nearly a decade of experience serving buyers, ' +
           'sellers, investors, developers, and relocating clients throughout New Jersey. She is also ' +
           'co-founder and Chief of Development of Power Haus, a national referral network of 60+ female real ' +
           'estate professionals.',
      facts: [['Market', 'New Jersey, Monmouth County'], ['Experience', 'Nearly 10 years'],
              ['Also', 'Co-founder, Power Haus referral network']]
    },
    'george-putykewycz': {
      role: 'New Jersey',
      bio: 'George Putykewycz is a luxury real estate expert and senior property manager, combining sales, ' +
           'management, and business expertise to guide clients through high-end transactions.',
      facts: [['Market', 'New Jersey'], ['Also', 'Senior property manager']]
    },
    'james-huber': {
      role: 'NJ Operations Manager',
      bio: 'James Huber combines finance and operations expertise to streamline luxury real estate ' +
           'transactions and provide exceptional service to clients.',
      facts: [['Market', 'New Jersey'], ['Role', 'NJ Operations Manager'], ['Background', 'Finance and operations']]
    },
    'nicole-melveney': {
      role: 'Florida',
      bio: 'Nicole Melveney, Director of Florida Sales at GVC Real Estate Team, specializes in luxury and ' +
           'investment properties across South Florida, delivering exceptional client service with a ' +
           'well-informed perspective.',
      facts: [['Market', 'South Florida'], ['Role', 'Director of Florida Sales'],
              ['Focus', 'Luxury and investment properties']]
    },
    'karl-brisard': {
      role: 'FL Operations Manager',
      bio: 'Karl Brisard is a dedicated South Florida Realtor with the GVC Real Estate Team in Boca Raton, ' +
           'specializing in helping clients buy, sell, and invest with confidence in the South Florida market.',
      facts: [['Market', 'South Florida, Boca Raton'], ['Role', 'FL Operations Manager']]
    }
  };

  global.GVC_GUIDE = {
    REGIONS: REGIONS, fiftyFor: fiftyFor, askFor: askFor, PROFILES: PROFILES
  };
})(window);
