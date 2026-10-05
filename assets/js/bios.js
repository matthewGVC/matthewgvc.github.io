/* ============================================================
   GVC TEAM BIOS — the one place to write or edit what an agent says
   about themselves.

   roster.js reads this file and attaches each entry to the matching
   person (same `id`), so any tool that shows an agent can show their bio:
   `GVC_AGENT('john-gasdaska').bio`. Load this file BEFORE roster.js.
   Today the Buyer's Guide's "Meet Your Agent" page uses it.

   Per agent, all optional — leave a field out and the page simply leaves
   that part out:

     role    the small line above the name ("Co-Founder", "New Jersey")
     blurb   one or two sentences, set large. The short bio from
             gvcrealestateteam.com/about.
     bio     the full bio: an array of paragraphs. When there is one, the
             Meet Your Agent page sets it in two columns under the blurb.
             Keep it to roughly 2,000 characters (about 300 words); a longer
             one will not fit and the builder will say so.
     facts   [label, value] pairs for the "At a glance" list. State only
             what is true and documented.

   Where the words come from: `blurb` is the team site's text for the
   person; `bio` is the team's master "All Team Bios" Google Doc (GVC -
   Bios in the Marketing drive). A few sentences are trimmed here so the
   page fits; the full text stays in the Doc. An agent with no full bio
   there (`bio: []`) shows the blurb only. When the master doc gets a bio
   for someone, paste it in here as paragraphs.

   TO ADD SOMEONE: add their roster.js row first (same `id`), then a block
   here.
   ============================================================ */
window.GVC_BIOS = {
  'john-gasdaska': {
    role: 'Co-Founder',
    blurb: 'John Gasdaska, a trusted real estate advisor with over 25 years of experience, is known for his expertise as a broker, mentor, and client-focused professional in the luxury market.',
    facts: [['Experience', '25+ years'], ['In real estate since', '1999'], ['Role', 'Co-Founder, GVC Team']],
    bio: [
      'John Gasdaska has forged a remarkable career in real estate over the past 25+ years. His strong commitment to serving others has earned him the reputation of trusted advisor, expert broker, mentor, and friend.',
      'Originally from Pennsylvania, John began his real estate career in 1999 after working in the luxury hotel service industry for twelve years, last working as the Chief Concierge and Front Office Manager at Ian Schrager’s Royalton Hotel. In 2006, he formed a strong and lasting business partnership with Jonathan Conlon: The Gasdaska Conlon Team. Then, in 2024, John, Jonathan, and TJ Verdiglione came together to form The GVC Real Estate Team, also known as the Gasdaska Verdiglione Conlon Team. This new venture allowed John to not only offer residential NYC services, but expanded those offerings to include residential, commercial, and new development in NYC, Upstate New York, New Jersey, and Florida.',
      'During his long career at The Corcoran Group from 1999-2024, John consistently placed in the top 1% of all NRT agents nationwide, has routinely been a member of the Multi-Million-Dollar Club and Sales Councils, and in 2024, both he and his business partner Jonathan were awarded the prestigious Robby Browne Spirit Award for their charitable works, contributions to the industry, and willingness to mentor and forge deep and meaningful relationships with their peers and colleagues. John also served as Director of North America for Corcoran’s International Division and collaborated closely with founder Barbara Corcoran.',
      'Known for his personalized approach, market expertise, team leadership, and adept negotiation skills, John’s clients benefit from his unwavering guidance throughout their buying, selling, or new development journeys.',
      'John holds a degree in Finance from Villanova University and has resided in Manhattan since 1988 and Garrison, NY since 2017. He is married to his husband Wright, with a dog named Elly May, is actively involved in his Catholic Parish of the Blessed Sacrament on the Upper West Side, enjoys gardening, golf, theater, opera, travel, and serving on the Board of the Abingdon Theatre Company.'
    ]
  },

  'tj-verdiglione': {
    role: 'Co-Founder',
    blurb: 'TJ Verdiglione has excelled in luxury real estate across NY, NJ, and FL, achieving over $1 billion in career transactions and specializing in new development and asset management.',
    facts: [['Career sales', '$1B+ in transactions'], ['Licensed in', 'New York · New Jersey · Florida'],
            ['Focus', 'New development and asset management']],
    bio: [
      'Since 2014, TJ Verdiglione has been an unstoppable force in the luxury real estate industry across residential, commercial, and new development sectors. He has closely collaborated with prominent developers, affording him deep insight into the world of luxury development and redevelopment, and his investments in his own projects have further refined his understanding of the complexities and opportunities within the industry, granting him a unique perspective. TJ has also served countless clients in the luxury residential market, and he is valued for his discretion and dedication to the purchase or sale at hand.',
      'TJ’s robust background in real estate development, investment, and construction has allowed him to broker major land acquisitions, manage full leases and sellouts of residential developments, and achieve over $1 billion in career sales and transactions. His specialties include new development marketing and high-net-worth asset management. He is a licensed agent in New York, New Jersey, and Florida, and currently splits his time between each of these unique locations enjoying everything they have to offer.'
    ]
  },

  'jonathan-conlon': {
    role: 'Co-Founder',
    blurb: 'Jonathan Conlon, co-founder of GVC Real Estate, is known for his market expertise, integrity, and exceptional client service, delivering results with a compassionate, results-driven approach.',
    facts: [['In real estate since', '2002'], ['Role', 'Co-Founder, GVC Team']],
    bio: [
      'Jonathan Conlon’s unwavering integrity, wealth of experience, and in-depth market knowledge have fueled his success both as an agent and as a co-founder of The GVC Real Estate Team. Clients who work with him insist that they “could not have been successful without him,” and appreciate “the qualities we all seek in a real estate professional but rarely find”: honesty, compassion, an unwavering focus on execution, and a deep knowledge of what it takes to provide an incredible client experience every step of the way.',
      'Originally from Dubuque, Iowa, Jonathan began his real estate career in 2002 after earning a business degree from Iowa State University. In 2006, he formed a strong and lasting business partnership with John Gasdaska: The Gasdaska Conlon Team. Then, in 2024, Jonathan, John, and TJ Verdiglione came together to form The GVC Real Estate Team, also known as the Gasdaska Verdiglione Conlon Team. This new venture allowed Jonathan to not only offer residential NYC services, but expanded those offerings to include residential, commercial, and new development in NYC, Upstate New York, New Jersey, and Florida.',
      'During his long career at The Corcoran Group from 2006-2024, Jonathan consistently placed in the top 1% of all NRT agents nationwide, has routinely been a member of the Multi-Million-Dollar Club and Sales Councils, and in 2024, both he and his business partner John were awarded the prestigious Robby Browne Spirit Award for their charitable works, contributions to the industry, and willingness to mentor and forge deep and meaningful relationships with their peers and colleagues.',
      'Jonathan’s approach goes beyond transactions; it’s about making strategic, well-informed moves that set his clients up for success in the long term. His unwavering dedication to transparency and integrity isn’t just rhetoric; it is the bedrock of his professional ethos, influencing his team and earning the confidence of both his clients and peers.',
      'Jonathan travels the country as business dictates, but when he’s at home, he splits his time between NYC and his home in upstate New York with his wife and teenage daughter.'
    ]
  },

  'katie-cook': {
    role: 'New York',
    blurb: 'Katie Cook is a New York–based real estate professional with a background in advertising, culinary arts, and client-focused service. Known for her transparency, creativity, and strong listening skills, she brings a thoughtful, solutions-driven approach to every client relationship.',
    facts: [['Market', 'New York'], ['Background', 'Advertising and culinary arts'], ['Known for', 'Transparency, creativity, listening']],
    bio: []
  },

  'nicole-sobol': {
    role: 'New York',
    blurb: 'Nicole Sobol, with over 15 years of experience, specializes in high-end rentals in Manhattan’s Midtown East, delivering exceptional client service with a well-informed perspective.',
    facts: [['Market', 'New York'], ['Experience', '15+ years'], ['Focus', 'High-end rentals, Midtown East']],
    bio: [
      'For more than a decade, Nicole Sobol has been delivering customized experiences for her valued clients. Whether they’re looking to buy, rent, or sell a property, she consistently tailors each experience for the individual. Her focus on customer service, deep knowledge of the market combined with her expert negotiation skills, ensure she exceeds the outcome each client is looking for.',
      'Working alongside investors, tenants, buyers, and sellers over the last 10 years, Nicole has built an incredible network of connections and unique insights. She has cultivated strong relationships throughout Manhattan with developers and management companies, which are now a significant benefit for her clients.',
      'Nicole offers a promise of undivided attention and exceptional service. Her deep knowledge of the market, proven track record of impeccable customer service and successful transactions, have propelled her to consistently exceed client expectations.',
      'Born and raised in New Jersey, Nicole has been a resident of the Upper East Side for fifteen years. In her free time, she enjoys playing the piano and traveling the globe practicing yoga.'
    ]
  },

  'gary-kasparov': {
    role: 'New York',
    blurb: 'Gary Kasparov brings a client-first, family-oriented approach to New York City real estate, combining honesty, persistence, and creative problem-solving to guide clients through even the most challenging transactions. With more than a decade of experience at McKinsey & Co., Accenture, and Bank of America, he leverages his analytical, advisory, and negotiation skills to deliver exceptional results and a seamless experience.',
    facts: [['Market', 'New York City'], ['Before real estate', 'McKinsey & Co., Accenture, Bank of America'], ['Strengths', 'Analysis, advising, negotiation']],
    bio: []
  },

  'ayuen-gai': {
    role: 'NY Operations Manager',
    blurb: 'Ayuen Gai offers clients a rare blend of talents including analytical expertise, operational precision, and luxury service.',
    facts: [['Market', 'New York'], ['Role', 'NY Operations Manager']],
    bio: []
  },

  'marli-silver': {
    role: 'New Jersey',
    blurb: 'Marli Silver is a Monmouth County native with nearly a decade of experience serving buyers, sellers, investors, developers, and relocating clients throughout New Jersey. She is also co-founder and Chief of Development of Power Haus, a national referral network of 60+ female real estate professionals.',
    facts: [['Market', 'New Jersey, Monmouth County'], ['Experience', 'Nearly 10 years'], ['Also', 'Co-founder, Power Haus referral network']],
    bio: []
  },

  'george-putykewycz': {
    role: 'New Jersey',
    blurb: 'George Putykewycz is a luxury real estate expert and senior property manager, combining sales, management, and business expertise to guide clients through high-end transactions.',
    facts: [['Market', 'New Jersey'], ['Also', 'Senior property manager']],
    bio: []
  },

  'james-huber': {
    role: 'NJ Operations Manager',
    blurb: 'James Huber combines finance and operations expertise to streamline luxury real estate transactions and provide exceptional service to clients.',
    facts: [['Market', 'New Jersey'], ['Role', 'NJ Operations Manager'], ['Background', 'Finance and operations']],
    bio: []
  },

  'nicole-melveney': {
    role: 'Florida',
    blurb: 'Nicole Melveney, Director of Florida Sales at GVC Real Estate Team, specializes in luxury and investment properties across South Florida, delivering exceptional client service with a well-informed perspective.',
    facts: [['Market', 'South Florida'], ['Role', 'Director of Florida Sales'], ['Focus', 'Luxury and investment properties']],
    bio: [
      'With extensive experience in International Commercial Real Estate, Luxury Residential properties, and luxury new developments, Nicole enriches the Florida real estate market with her invaluable insights in South Florida’s ever-changing and evolving landscape.',
      'She is known among her clients and peers for her informed perspective, comprehensive market knowledge, and gracious demeanor. Guided by her belief that there is a perfect match for every client, she dedicates herself to helping them discover properties that align with their aspirations and goals. She firmly believes in real estate as the optimal choice for investment, leveraging her knowledge to cater to every client’s unique needs, whether they seek commercial properties or their dream homes.',
      'As a dedicated professional, she started her career as the Managing Director of a prominent real estate company in Dubai, UAE, from 2007 to 2011. Initiating the sales department and subsequently establishing the leasing and property management department, her unwavering commitment and unparalleled work ethic earned her a growing network of international loyal clients and referrals who entrust her with their real estate endeavors.',
      'Committed to delivering the highest level of service from initiation to closure, Nicole takes pride in offering creative solutions, attention to detail, and a commitment to follow-through. Her keen ability to listen, anticipate client needs, and exceed expectations distinguishes her as a trusted resource in the real estate industry.',
      'Born and raised in Spring Lake, New Jersey at the Shore, she later attended Barry University on a golf scholarship, gaining a Bachelor’s Degree in Communications, in North Miami Shores. Her world travels have provided her with a passion, gratitude and appreciation for cultures, food, and travel. She enjoys golf, networking, scuba diving & snorkeling, yoga, kayaking and everything under the sun that brings happiness.'
    ]
  },

  'karl-brisard': {
    role: 'FL Operations Manager',
    blurb: 'Karl Brisard is a dedicated South Florida Realtor with the GVC Real Estate Team in Boca Raton, specializing in helping clients buy, sell, and invest with confidence in the South Florida market.',
    facts: [['Market', 'South Florida, Boca Raton'], ['Role', 'FL Operations Manager']],
    bio: []
  }
};
