/* ============================================================
   GVC TEAM BIOS — the one place to write or edit what an agent says
   about themselves.

   roster.js reads this file and attaches each entry to the matching
   person (same `id`), so any tool that shows an agent can show their bio:
   `GVC_AGENT('john-gasdaska').bio`. Load this file BEFORE roster.js.
   Today the Buyer’s Guide’s "Meet Your Agent" page uses it.

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

   Where the words come from: `blurb` is the team site’s text for the
   person; `bio` is the team’s master "All Team Bios" Google Doc (GVC -
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
      'During his long career at The Corcoran Group from 1999–2024, John consistently placed in the top 1% of all NRT agents nationwide, has routinely been a member of the Multi-Million-Dollar Club and Sales Councils, and in 2024, both he and his business partner Jonathan were awarded the prestigious Robby Browne Spirit Award for their charitable works, contributions to the industry, and willingness to mentor and forge deep and meaningful relationships with their peers and colleagues. John also served as Director of North America for Corcoran’s International Division and collaborated closely with founder Barbara Corcoran.',
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
      'During his long career at The Corcoran Group from 2006–2024, Jonathan consistently placed in the top 1% of all NRT agents nationwide, has routinely been a member of the Multi-Million-Dollar Club and Sales Councils, and in 2024, both he and his business partner John were awarded the prestigious Robby Browne Spirit Award for their charitable works, contributions to the industry, and willingness to mentor and forge deep and meaningful relationships with their peers and colleagues.',
      'Jonathan’s approach goes beyond transactions; it’s about making strategic, well-informed moves that set his clients up for success in the long term. His unwavering dedication to transparency and integrity isn’t just rhetoric; it is the bedrock of his professional ethos, influencing his team and earning the confidence of both his clients and peers.',
      'Jonathan travels the country as business dictates, but when he’s at home, he splits his time between NYC and his home in upstate New York with his wife and teenage daughter.'
    ]
  },

  'katie-cook': {
    role: 'New York',
    blurb: 'Katie Cook is a New York–based real estate professional with a background in advertising, culinary arts, and client-focused service. Known for her transparency, creativity, and strong listening skills, she brings a thoughtful, solutions-driven approach to every client relationship.',
    facts: [['Market', 'New York'], ['Background', 'Advertising and culinary arts'], ['Known for', 'Transparency, creativity, listening']],
    bio: [
      'Katie Cook is originally from Long Island and has lived in New York City for over 15 years. Her passion and knowledge for the city runs deep, from its neighborhoods and buildings to the small details that make each block feel different. She brings a grounded, thoughtful approach to helping buyers and sellers navigate the market with confidence.',
      'Coming from a family background in construction and real estate, and having purchased her own New York City apartment, Katie brings both practical insight and firsthand perspective to her work, fueling her passion for helping others make informed, confident decisions.',
      'Katie is known for being a great listener and a steady presence throughout the process. She takes the time to understand what matters most to her clients and works patiently and collaboratively to help them achieve their goals and successfully navigate the complex market.',
      'With a background in communications and client-focused roles, Katie values clear communication, transparency, and trust. She is a creative problem solver who stays calm under pressure and is committed to guiding her clients with care from the first conversation through closing. Above all, Katie approaches her work with integrity, persistence, and genuine respect for the people she represents, and she takes pride in building lasting relationships long after the transaction is complete.'
    ]
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
    bio: [
      'Gary treats his clients like family. With a genuine passion for real estate, he believes there is no better place in the world to pursue this exciting profession than New York City.',
      'At the heart of Gary’s philosophy is a simple belief: put the interests and aspirations of others before your own and always be honest and sincere in your dealings with people. He firmly believes that when you stay true to these principles, remain passionate about what you do, and are genuinely committed to helping others achieve their goals, success naturally follows. This philosophy served him well throughout his previous career in Management Consulting and Financial Services, and he has carried these same principles into his work as a Real Estate Professional at Douglas Elliman.',
      'Gary is known for his ability to navigate even the most challenging deals, approaching each deal with the dedication, persistence, and creative thinking required to achieve a successful outcome. He combines a thoughtful, analytical approach with a deep commitment to understanding his clients’ unique needs and objectives, enabling him to negotiate exceptional results while providing a seamless and enjoyable experience throughout the process.',
      'Before transitioning to real estate and joining Douglas Elliman, Gary graduated from Southern Methodist University, a prestigious private university in Dallas, and went on to spend more than a decade with leading management consulting and financial services firms, including McKinsey & Company, Accenture, and Bank of America Corporation. Throughout his career, he developed extensive experience in analytics and strategic advisory work, collaborating with senior executives, building trusted relationships, and helping clients achieve and exceed their goals.',
      'While Gary considers his work a top priority, he also values time with family and friends, traveling, reading books focused on personal development, and pursuing his own spiritual growth.'
    ]
  },

  'ayuen-gai': {
    role: 'NY Operations Manager',
    blurb: 'Ayuen Gai offers clients a rare blend of talents including analytical expertise, operational precision, and luxury service.',
    facts: [['Market', 'New York'], ['Role', 'NY Operations Manager']],
    bio: [
      'Ayuen offers clients a rare blend of talents including analytical expertise, operational precision, and luxury service. His background in corporate finance and digital marketing allows him to evaluate properties with a strategic lens, while his real estate knowledge ensures a seamless, white-glove experience throughout every transaction. This consummate professional brings a calm, solutions-oriented approach to complex deals, and is committed to protecting his clients’ interests with integrity, transparency, and results-driven focus.',
      'Whether it’s walking first-time buyers through the co-op application process or advising seasoned sellers on pricing strategy, Ayuen leverages real-time market data, comparative analysis, and historical trends to empower confident decision-making. He keeps clients informed through clear, consistent communication at every stage of the journey, and provides hands-on guidance to deliver the optimal outcome they deserve.',
      'Ayuen offers full-service representation to his clients, from pre-market strategy and pricing through to closing and beyond. He excels at streamlining processes, anticipating roadblocks, and managing deadlines to make sure transactions stay on track. Trust, education, and long-term value are the foundation of his philosophy, as he sees every encounter as a partnership, not just a deal. “I aim to demystify the real estate process, set realistic expectations, and advocate fiercely for my clients.”',
      'Originally from Upstate New York, Ayuen currently resides just outside of Manhattan in Westchester County, NY. He holds an MBA as well as a Master’s in Digital Marketing and Marketing Analytics, along with a Bachelor’s degree in Finance and Business Analytics. Prior to real estate he worked for industry-leading firms such as Morgan Stanley and BNY Mellon. Among his personal passions are architecture, design, and culture.'
    ]
  },

  'marli-silver': {
    role: 'New Jersey',
    blurb: 'Marli Silver is a Monmouth County native with nearly a decade of experience serving buyers, sellers, investors, developers, and relocating clients throughout New Jersey. She is also co-founder and Chief of Development of Power Haus, a national referral network of 60+ female real estate professionals.',
    facts: [['Market', 'New Jersey, Monmouth County'], ['Experience', '10+ years'], ['Leadership', 'Co-founder, Power Haus']],
    bio: [
      'In New Jersey’s competitive real estate market, Marli Silver stands out with nearly a decade of experience specializing in all facets of residential sales — buyers, sellers, investors, developers, and relocations. With a deep-rooted family background in real estate, she combines industry expertise with a modern approach, delivering seamless and successful transactions. Her refined marketing strategies — blending strategic branding, social media, her large network, and targeted property promotion — ensure exceptional results.',
      'Beyond individual sales, Marli is the co-founder and Chief of Development of Power Haus, a national real estate referral network designed to connect and elevate female agents across the country. Through this platform, she has built a dynamic network of 60+ professionals, facilitating referrals and business growth nationwide. Her commitment to collaboration and innovation empowers agents while providing clients with trusted connections in markets beyond New Jersey.',
      'A Monmouth County native, Marli’s local expertise and sharp negotiation skills make her a trusted advisor, ensuring every client’s experience is both effortless and rewarding. She prides herself on delivering concierge-level service, guiding clients through every step with transparency, efficiency, and a keen eye for detail.'
    ]
  },

  'george-putykewycz': {
    role: 'New Jersey',
    blurb: 'George Putykewycz is a luxury real estate expert and senior property manager, combining sales, management, and business expertise to guide clients through high-end transactions.',
    facts: [['Market', 'New Jersey'], ['Background', 'Senior property manager']],
    bio: [
      'With a diverse background in real estate sales, property management, and business administration, George Putykewycz brings a unique blend of expertise to the GVC Team at Douglas Elliman. As both a luxury real estate specialist and a senior property manager, he provides clients with strategic insight into buying, selling, and managing high-end properties. His ability to navigate complex transactions, assess investment potential, and optimize property value makes him a trusted advisor in the competitive real estate market.',
      'George’s experience spans both residential and commercial real estate, giving him a comprehensive understanding of market dynamics and asset management. As a senior property manager at JBL Asset Management, he has overseen operations for a diverse portfolio of properties, ensuring efficiency, profitability, and long-term value for investors. His background in business administration and human resources further enhances his ability to manage transactions with professionalism, organization, and a client-first approach.',
      'A graduate of Rutgers University with a degree in Human Resources Management and an associate’s degree in Business Administration from Brookdale Community College, George combines academic knowledge with real-world experience to deliver results. His strategic mindset, strong negotiation skills, and dedication to client success set him apart in the luxury real estate space.',
      'Beyond his professional achievements, George is committed to leadership and service. As an Eagle Scout, he developed a strong foundation in teamwork, problem-solving, and community engagement - qualities that continue to shape his approach to real estate. With a reputation built on integrity, market expertise, and personalized service, George Putykewycz is a valuable asset to the GVC Team and the clients he serves.'
    ]
  },

  'james-huber': {
    role: 'NJ Operations Manager',
    blurb: 'James Huber combines finance and operations expertise to streamline luxury real estate transactions and provide exceptional service to clients.',
    facts: [['Market', 'New Jersey'], ['Role', 'NJ Operations Manager'], ['Background', 'Finance and operations']],
    bio: [
      'As New Jersey Operations Manager for the GVC Team, James Huber plays a vital role in ensuring seamless transactions and top-tier client service across the state’s luxury real estate market. With a strong background in finance, sales, and operations, he brings a strategic and analytical approach to every deal, optimizing processes and enhancing the overall client experience. His ability to coordinate complex transactions, manage relationships, and provide data-driven insights makes him an invaluable asset to the team.',
      'James has an extensive history in real estate, specializing in both high-end resales and new developments across New Jersey’s most sought-after communities. Before joining the GVC Team, he worked with The Verdiglione Group, where he gained hands-on experience in luxury property sales and investment strategies. He also served as a real estate specialist at Brown Harris Stevens in New York City, further refining his market expertise and negotiation skills.',
      'With a Bachelor’s degree in Finance and Real Estate from Monmouth University, James combines academic knowledge with real-world experience to drive success in New Jersey’s competitive market. His financial background provides a strong foundation for assessing investment opportunities, structuring deals, and maximizing property values for both buyers and sellers.',
      'A lifelong New Jersey resident, James has a deep appreciation for the state’s unique coastal, suburban, and commuter-friendly communities. His knowledge of key markets—including Rumson, Fair Haven, Colt’s Neck, and the surrounding areas—allows him to provide expert guidance to clients looking to buy, sell, or invest in New Jersey’s premier real estate destinations. His commitment to excellence, integrity, and client satisfaction makes him a trusted resource for both buyers and sellers seeking a seamless and successful transaction.'
    ]
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
    bio: [
      'As a member of the GVC Real Estate Team at Douglas Elliman, Karl brings over 15 years of experience in sales, marketing, and real estate to one of Florida’s most competitive luxury markets. Based in South Florida since 2010, he has developed deep expertise across Palm Beach, Broward, and Miami-Dade counties, with a particular focus on new development and high-end residential transactions.',
      'A New York native, Karl understands firsthand what drives Northeast buyers and investors to South Florida and what they need to move confidently in an unfamiliar market. That perspective, combined with 13 years as an advertising sales executive before real estate, gives him a rare ability to read a market, position an opportunity, and guide clients through complex decisions with clarity and conviction.',
      'A key point of contact for two of South Florida’s newest boutique luxury developments, Casa Avenida in Delray Beach and Le Reve in Boca Raton, Karl brings buyers direct access to exclusive pre-construction and new development opportunities in the region’s most supply-constrained luxury markets. Assertive but approachable, he leads with results and earns the trust of clients who expect both market intelligence and a seamless experience from first conversation to closing.'
    ]
  }
};
