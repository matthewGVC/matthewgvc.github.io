/* ============================================================
   BUYER'S GUIDE — the words that change with the market.

   The guide prints for one of three markets, chosen on the Cover panel:
   New York City, New Jersey or Florida. Everything in here is either
   per-market (the cover photo, the "Why Work With Us" photo, the testimonial,
   the state-specific lines on the "50 Things" and "Don't Forget to Ask"
   pages). Agent bios are not here: they are in assets/js/bios.js, shared by
   every package. index.html owns the layout; this file owns
   the copy, so a teammate can correct a sentence without touching markup.

   Nothing here is a quote written by us: the testimonials are the clients'
   own words from gvcrealestateteam.com.

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
      why: 'static/why-nyc.jpg',
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
      why: 'static/why-nj.jpg',
      quote: {
        text: 'This is my third closing with Marli and she is the best realtor I have ever worked with ' +
              '— and trust me, I have worked with quite a few. She makes finding and buying a home ' +
              'very easy, and her real estate expertise is outstanding.',
        who: 'Melinda B., Buyer'
      }
    },
    fl: {
      id: 'fl', label: 'FL', name: 'Florida',
      cover: 'static/cover-fl.jpg',
      why: 'static/why-fl.jpg',
      /* A client of the whole team, from gvcrealestateteam.com/about, with
         no state in it. Swap in a Florida client's own words when there is
         one: { text: '...', who: 'Name, Buyer' }. */
      quote: {
        text: 'The whole team is a pleasure to work with. Super responsive, knowledgeable and helpful. ' +
              'They helped us with both buying and selling and did a fantastic job. Highly recommend!',
        who: 'Jenny Sharfstein Kane, Buyer & Seller'
      }
    }
  };

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
      'Coordinate lender, appraiser, attorney and title company',
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
      'Introduce movers, designers and trusted vendors',
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
        'Flag key sponsor terms in the offering plan for your attorney'
      ],
      [ /* 6 */
        'Assemble and submit your co-op or condo board package',
        'Prepare you for the board interview',
        'Go through minutes and financials with your attorney',
        'Walk you through the closing taxes and fees; your attorney confirms',
        'Track the mortgage commitment and contract deadlines',
        'Arrange the managing agent’s move-in requirements'
      ],
      [ /* 4 */
        'Confirm your move-in date with the building',
        'Book the elevator and certificate of insurance for move day',
        'Coordinate keys and fobs with the managing agent',
        'Introduce New York architects and contractors'
      ]
    ],
    nj: [
      [ /* 2 */
        'Compare towns by taxes, schools and commute',
        'Line up your NJ attorney before you make an offer'
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
        'Run the three-business-day attorney review with your lawyer',
        'Order the survey and coordinate the title search',
        'Arrange radon, sewer-line and oil-tank checks',
        'Confirm the smoke/CO certificate and the town’s CO where required',
        'Get a flood insurance quote before inspections end',
        'Check permits on basements, additions and decks'
      ],
      [ /* 4 */
        'Check property tax and escrow figures at closing',
        'Confirm the proration of taxes, fuel and utilities',
        'Remind you of tax-relief filings you may qualify for',
        'Introduce local landscapers and contractors'
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
        'Write the offer on the FR/BAR contract',
        'Set the deposit, inspection and financing deadlines',
        'Build in an insurability check, not just price'
      ],
      [ /* 6 */
        'Order home, wind-mitigation and roof inspections',
        'Get homeowner’s and flood quotes before inspections end',
        'Review the condo SIRS and milestone inspection reports',
        'Coordinate title, survey and closing agent',
        'Track the inspection period and financing deadlines',
        'Check open permits and claims history'
      ],
      [ /* 4 */
        'Help you file for the Florida homestead exemption',
        'Line up hurricane prep and insurance papers',
        'Coordinate HOA or condo approval and move-in',
        'Introduce pool, landscaping and shutter pros'
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
      'Have you lost a home before, and what happened?'
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
      'Do you have an attorney lined up for the three-business-day review?',
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
     THE DRAWN PAGES, MADE TO FIT THE MARKET

     "The Buying Process", "Financing Options" and "Offer & Negotiation" are
     still Matt's artwork (static/*.jpg). One sentence on each reads wrongly
     outside New Jersey — "attorney review" is a NJ step, "board package" a
     New York one — so index.html draws the corrected sentence over the
     picture. Those are the strings below. The costs page and the FAQ are
     live HTML, so their numbers and questions are here too.

     Figures are for budgeting and are checked against official sources as of
     the date in each comment; rates and limits move, so re-read them before
     a season's guides go out.
     ============================================================ */

  /* Step 2 of the buying process: one line, about 88 characters at most. The
     drawn line assumed a mortgage and said nothing for cash buyers. */
  var PROCESS_STEP2 = 'Mortgage buyers get a written pre-approval; cash buyers, proof of funds. Both come first.';

  /* The last two lines of the Financing Options header, set right-aligned,
     about 70 characters each. The drawn ones promised "days rather than
     weeks" and said nothing was possible without a pre-approval. */
  var OPTIONS_LEAD = [
    'Gather it once and it works for every lender.',
    'Cash buyers need only proof of funds; either way, that comes first.'
  ];

  /* Step 6 of the buying process: one line, about 78 characters at most. */
  var PROCESS_STEP6 = {
    nyc: 'Contract signing, inspection, board package if applicable, and the appraisal.',
    nj:  'Attorney review, inspections, title, condo or HOA papers, and the appraisal.',
    fl:  'Inspection period, HOA or condo documents, insurance quotes, and the appraisal.'
  };

  /* The six financing cards, in the order they sit on the page. Only the ones
     that differ by market are listed per market; the rest come from COMMON.
     `title` replaces the card's drawn heading (the first card was a stray copy
     of step 1, "Consultation"). */
  var OPTIONS_COMMON = [
    { title: 'Conventional',
      body: 'Down payments from 3% to 20%. Put 20% down and there is no private mortgage insurance; below that, you can ask to drop it once you reach 20% equity.' },
    { body: 'As little as 3.5% down and far more forgiving on credit. The trade is mortgage insurance that lasts the life of the loan if you put down under 10%.' },
    { body: 'Nothing down and no monthly mortgage insurance for eligible service members, veterans and surviving spouses. A one-time funding fee applies unless exempt.' },
    { body: 'Anything above the county conforming limit. Tighter underwriting, larger reserves, and worth using a lender who writes them every week.' },
    { body: 'A fixed rate buys thirty years of certainty. An adjustable one only makes sense if you genuinely know you are gone before it resets.' },
    { body: 'The fastest and strongest offer on the table. You can still put a mortgage on the house afterwards and take the money back out.' }
  ];
  var OPTIONS_BY_REGION = {
    nyc: {
      0: 'Down payments from 3% to 20% on condos and houses. Co-ops lend differently: most boards want at least 20% down, many more, and can say no even when the bank says yes.',
      5: 'The fastest, strongest offer on the table, and the only kind some all-cash buildings accept.'
    },
    nj: {},
    fl: {
      5: 'The fastest, strongest offer on the table, and sometimes the only way into a condo that lenders will not finance.'
    }
  };

  /* The six cards on Offer & Negotiation. */
  var OFFER_COMMON = [
    'Closing date, contingencies and financing type often matter more to a seller than the last $10,000.',
    'We check recent sales and what is on the market nearby before we name a number, not after.',
    'Inspection, financing and appraisal contingencies are your exits. We waive them deliberately, never casually.',
    'Good homes go fast. We settle your number and your terms in advance, so you can move quickly and still decide with a clear head.',
    'Escalation clauses can win a bidding war or reveal your ceiling. We use them situationally.',
    'Verbal agreements are not agreements. Every accepted term goes into the contract.'
  ];
  var OFFER_BY_REGION = {
    nyc: {
      2: 'Financing, inspection and board-approval conditions are your exits. We waive them deliberately, never casually.',
      3: 'Good apartments go fast. We settle your number and your terms in advance, so you can move quickly and still decide with a clear head.',
      4: 'Escalation clauses can win a bidding war or reveal your ceiling. They are rare in New York, so we use them situationally.',
      5: 'Verbal agreements are not agreements. Every accepted term goes into the contract your attorney reviews.'
    },
    nj: {
      2: 'Inspection, financing and appraisal contingencies are your exits, and attorney review is another. We waive them deliberately, never casually.',
      5: 'Verbal agreements are not agreements. Every accepted term goes into the contract your attorney reviews.'
    },
    fl: {
      2: 'The inspection period, financing and appraisal contingencies are your exits. We waive them deliberately, never casually.',
      5: 'Verbal agreements are not agreements. Every accepted term goes into the contract.'
    }
  };

  function optionCards(region) {
    var over = OPTIONS_BY_REGION[region] || {};
    return OPTIONS_COMMON.map(function (c, i) {
      return { title: c.title || '', body: over[i] || c.body };
    });
  }
  function offerCards(region) {
    var over = OFFER_BY_REGION[region] || {};
    return OFFER_COMMON.map(function (t, i) { return over[i] || t; });
  }

  /* ============================================================
     WHAT IT COSTS — live HTML now, because almost every line differs by
     market. Each row is [what, when/why, amount]. `heads` are the three big
     figures across the top. Sources, as of October 2026:
       NYC  tax.ny.gov (mansion tax, mortgage recording tax), NYC DOF
       NJ   nj.gov/treasury/taxation (realty transfer fee; the 2025 graduated
            fee on the seller), N.J.A.C. 11:5-6.2 (attorney review)
       FL   floridarevenue.com (doc stamps ch. 201 F.S.), FR/BAR contract
     Ranges marked "estimate" in the notes are budgeting figures, not quotes.
     ============================================================ */
  var COST_OPTIONAL = [
    ['Staging', 'Only if you are selling a home to buy this one', '$1,500 – $5,000'],
    ['Movers', 'A local move, two bedrooms or so', '$1,200 – $4,000'],
    ['Repairs and paint', 'What you want done before you move in', 'Varies']
  ];
  var COSTS = {
    nyc: {
      heads: [['2 – 5%+', 'Closing costs · share of price'],
              ['20%', 'Down payment that avoids PMI'],
              ['$2k – 4k', 'Before you own anything · deposit extra']],
      before: [
        ['Home inspection', 'Booked once your offer is accepted, before you sign', '$500 – $900'],
        ['Specialty inspections', 'Houses: radon, oil tank, sewer, termite — each', '$100 – $500'],
        ['Appraisal', 'Ordered by your lender, paid by you', '$600 – $1,000'],
        ['Deposit', 'At contract, held in escrow — credited back to you at closing', '10% of price']
      ],
      table: [
        ['Attorney', 'Contract through closing, flat fee', '$2,000 – $5,000'],
        ['Title insurance', 'Condos and houses; co-ops get a lien search instead', '0.4 – 0.6% of price'],
        ['Lender fees & points', 'Origination, underwriting, any rate buy-down', '0.5 – 1.5% of loan'],
        ['Mortgage recording tax', 'On your loan, condos and houses only — none on co-op loans', '1.8 – 1.925% of loan'],
        ['Recording & filing fees', 'Deed and mortgage recording; UCC filing for co-ops', '$300 – $1,200'],
        ['Mansion tax', 'Buyer pays, on the whole price: 1% from $1M, up to 3.9%', '1 – 3.9% of price'],
        ['Board package & move-in', 'Application, managing agent, move-in deposit, capital contribution', '$500 – $2,500+'],
        ['First year of insurance', 'HO-6 for a co-op or condo; a house costs more', '$300 – $1,500']
      ],
      optional: COST_OPTIONAL.concat([['Reserves', 'What lenders and co-op boards like to see left over', '2 – 12+ months']]),
      note: 'Ranges for budgeting, not quotes. The seller pays the NYC and NY State transfer taxes on a resale; ' +
            'on new development the buyer usually does. Your attorney and lender give the real figures once ' +
            'there is an actual apartment and an actual loan.'
    },
    nj: {
      heads: [['2 – 5%', 'Closing costs · share of price'],
              ['20%', 'Down payment that avoids PMI'],
              ['$2k – 4k', 'Before you own anything · deposit extra']],
      before: [
        ['Home inspection', 'Once the contract is signed; the window is usually 7–14 days', '$500 – $900'],
        ['Specialty inspections', 'Radon, oil tank, sewer, termite — each', '$100 – $500'],
        ['Appraisal', 'Ordered by your lender, paid by you', '$600 – $1,000'],
        ['Deposit', 'At contract — credited back to you at closing', '5 – 10% of price']
      ],
      table: [
        ['Attorney', 'Contract through closing, flat fee', '$1,500 – $3,500'],
        ['Title search & insurance', 'Owner’s policy protects you; your lender requires its own', '0.3 – 0.5% of price'],
        ['Lender fees & points', 'Origination, underwriting, any rate buy-down', '0.5 – 1.5% of loan'],
        ['Survey', 'Most lenders and title companies ask for one', '$600 – $1,200'],
        ['Recording & municipal fees', 'Deed and mortgage recording, town certificates and searches', '$300 – $900'],
        ['Mansion tax', 'Paid by the seller in New Jersey — not a buyer cost', 'None'],
        ['Escrow set-up', 'Prepaid property taxes and insurance', '2 – 6 months'],
        ['First year of insurance', 'Homeowner’s, due at closing', '$900 – $2,500']
      ],
      optional: COST_OPTIONAL.concat([['Reserves', 'What lenders like to see left over afterwards', '2 – 6 months of payments']]),
      note: 'Ranges for budgeting, not quotes. On a resale, the seller pays the New Jersey realty transfer fee. ' +
            'Percentages bill against the purchase price unless the line says otherwise, and the real ' +
            'figures come from your attorney and your lender once there is an actual house and an actual loan.'
    },
    fl: {
      heads: [['2 – 5%', 'Closing costs · share of price'],
              ['20%', 'Down payment that avoids PMI'],
              ['$3k – 6k', 'Before you own anything · deposit extra']],
      before: [
        ['Home inspection', 'Booked in your inspection period, usually 15 days', '$500 – $900'],
        ['Specialty inspections', 'Wind mitigation, 4-point, roof, termite, sewer scope — each', '$75 – $600'],
        ['Appraisal', 'Ordered by your lender, paid by you', '$500 – $1,000'],
        ['Deposit', 'At contract, more after the inspection period — credited at closing', '1 – 10% of price']
      ],
      table: [
        ['Closing agent', 'A title company usually closes; an attorney is optional', '$500 – $2,500'],
        ['Title insurance', 'Seller pays in most counties; buyers often pay in Miami-Dade and Broward', '0 – 0.6% of price'],
        ['Lender fees & points', 'Origination, underwriting, any rate buy-down', '0.5 – 1.5% of loan'],
        ['Survey', 'Buyer usually orders it; lenders and title often require one', '$400 – $1,000'],
        ['Doc stamps & intangible tax', 'On your loan, plus recording fees: 0.35% + 0.2%', '0.55% of loan'],
        ['Condo or HOA fees', 'Transfer, approval and capital contribution, where they apply', '$300 – $5,000+'],
        ['Home insurance, first year', 'Wind-rated, due at closing, lenders escrow it (condo HO-6 costs far less)', '$4,000 – $12,000+'],
        ['Flood insurance', 'If required or advised — not part of a homeowner’s policy', '$700 – $4,000+']
      ],
      optional: COST_OPTIONAL.concat([['Reserves', 'What lenders like to see left over afterwards', '2 – 6 months of payments']]),
      note: 'Ranges for budgeting, not quotes. Florida has no mansion tax, and the seller customarily pays the ' +
            'deed doc stamps. Insurance is the line that surprises people — get quotes for the actual house ' +
            'before your inspection period ends.'
    }
  };

  /* ============================================================
     QUESTIONS TO ASK — the buyer's checklist (live HTML; it was a picture
     with New Jersey assumptions in it). Six groups; `icon` is an icons.js
     name. A market overrides individual lines by "group index:line index".
     ============================================================ */
  var FAQ_GROUPS = [
    { icon: 'home', title: 'At every showing', items: [
      'Why are they selling, and how soon?',
      'How long has it been listed, and at what prices?',
      'What are the taxes, insurance and monthly fees?',
      'How old are the roof, furnace and water heater?',
      'What is not staying with the house?',
      'Has there ever been water in the basement?'] },
    { icon: 'chart', title: 'Ask your lender', items: [
      'What is the rate, and what would it take to lock it?',
      'What do the fees add up to, all in?',
      'Which loan types do I qualify for?',
      'What could change my approval before closing?',
      'How long do you need once we are under contract?'] },
    { icon: 'building', title: 'About the building or HOA', items: [
      'What does the monthly fee actually cover?',
      'Is an assessment planned or being discussed?',
      'How healthy are the reserves?',
      'What are the rules on pets, rentals and renovations?',
      'What share of the units are owner-occupied?'] },
    { icon: 'users', title: 'What we will ask you', items: [
      'What has to be true on day one?',
      'What would you trade, and what will you not?',
      'Where is the down payment coming from?',
      'Who else has a say in the decision?',
      'What would make you walk away?'] },
    { icon: 'pin', title: 'About the area', items: [
      'What is the tax rate, and when was the last reassessment?',
      'Is any part of the lot in a flood zone?',
      'Which schools does this address actually feed?',
      'What is the commute at 7am, not at noon?',
      'What is approved to be built nearby?'] },
    { icon: 'pen', title: 'Once under contract', items: [
      'Have I read the inspection report myself?',
      'Is my deposit in escrow, and with whom?',
      'When does attorney review end?',
      'What happens if the appraisal comes in low?'] }
  ];
  var FAQ_BY_REGION = {
    nyc: {
      '0:3': 'How old are the windows, appliances and heating system?',
      '0:4': 'What is not staying with the unit?',
      '0:5': 'Has there ever been a leak or water damage in the unit?',
      '1:2': 'Which loan types do I qualify for, and do you lend on co-ops?',
      '2:4': 'What does the board ask for, and how long does approval take?',
      '4:0': 'What are the taxes or abatement, and when does the abatement end?',
      '4:1': 'Is the building in a flood or evacuation zone?',
      '4:3': 'What is the commute at 8am, not at noon?',
      '5:0': 'Have I read the inspection report and the building financials myself?',
      '5:2': 'When are the mortgage commitment and board approval due?'
    },
    nj: {
      '5:2': 'When does attorney review end?'
    },
    fl: {
      '0:3': 'How old are the roof, AC and water heater?',
      '0:5': 'Any past leaks, water intrusion or flood claims?',
      '1:2': 'Which loan types do I qualify for, and is this condo approved?',
      '2:4': 'Is the milestone inspection and reserve study (SIRS) done and funded?',
      '4:0': 'What will the taxes be after purchase, and is homestead available?',
      '4:1': 'Is it in a flood zone, and what do wind and flood insurance cost?',
      '5:2': 'When does my inspection period end?'
    }
  };
  /* extra lines appended to the last group, per market */
  var FAQ_EXTRA = {
    nj: ['Have I read the seller’s disclosure and the flood-risk disclosure?'],
    nyc: [], fl: []
  };
  function faqFor(region) {
    var over = FAQ_BY_REGION[region] || {};
    return FAQ_GROUPS.map(function (g, gi) {
      var items = g.items.map(function (t, i) { return over[gi + ':' + i] || t; });
      if (gi === FAQ_GROUPS.length - 1) items = items.concat(FAQ_EXTRA[region] || []);
      return { icon: g.icon, title: g.title, items: items };
    });
  }

  global.GVC_GUIDE = {
    REGIONS: REGIONS, fiftyFor: fiftyFor, askFor: askFor,
    PROCESS_STEP2: PROCESS_STEP2, OPTIONS_LEAD: OPTIONS_LEAD, PROCESS_STEP6: PROCESS_STEP6, optionCards: optionCards, offerCards: offerCards,
    COSTS: COSTS, faqFor: faqFor
  };
})(window);
