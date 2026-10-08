/* ============================================================
   SOUTH STREET DEVELOPMENT GROUP — the starting document for the New
   Development tool, and the shape every saved development follows.

   Every word and figure is from "REFERENCE DOC - SSDG Pipeline.pdf" (the
   two-page Private Preview, October 2026). The tool loads this only until
   the development has been saved to the library; after that the saved copy
   (Supabase, table developments) is the one that counts and this file is a
   starting point, not the truth. Do not add anything not in a source Matt
   supplied: the printed PDF goes to buyers.

   Home fields:
     address   as printed
     town      only where a source states it
     status    'construction' | 'planned' — the counts and the timeline are
               worked out from this, never typed
     price     asking price, as printed
     done      estimated completion; blank when the source gives none
     plans     printed in place of a completion date ("In development")
     beds, baths, living, basement, garage   as printed; blank when not given
     note      the source's sentence about the home
     image     'seed:<file>' (in seed/) or 'store:<path>' (uploaded); high-res only
     imageNote the caption under the picture
     site      homes sharing a site are one subdivision, shown side by side
   ============================================================ */
window.GVC_DEV_SEED = {
  slug: 'south-street',
  kicker: 'Private preview',
  title: 'New Construction Opportunities',
  developer: {
    name: 'South Street Development Group',
    logo: 'seed:ssd-logo.png'
  },
  marketing: 'the GVC Team at Douglas Elliman',
  subdivisionsIntro: 'Six additional homes are shown below, with each subdivision residence listed individually.',
  nextStep: 'Contact the GVC Team at Douglas Elliman for current pricing, plans, availability, and private appointment options.',
  disclaimer: 'Preliminary information only. Pricing, plans, timing, specifications, and availability are subject to change.',

  homes: [
    { address: '619 Bradley Ave', town: 'Brielle, New Jersey', status: 'construction',
      price: '$1,895,000', done: 'Q1 2027', beds: '4', baths: '4.5',
      living: '2,550 sq. ft.', basement: '694 sq. ft.',
      note: 'Currently under construction in Brielle. Request the latest plans, specifications, and construction update.',
      image: 'seed:619-bradley-2400.webp', imageNote: 'Exterior rendering - subject to change' },

    { address: '610 Agnes Ave', town: 'Brielle, New Jersey', status: 'construction',
      price: '$2,695,000', done: 'Q2 2027', beds: '5', baths: '4.5',
      living: '3,564 sq. ft.', basement: '1,515 sq. ft.',
      note: 'Demo is complete and foundation work is next. Includes a first-floor bedroom and 2-car garage.',
      image: 'seed:610-agnes-2400.webp', imageNote: 'Exterior rendering - subject to change' },

    { address: '806 Riverview Dr', town: 'Brielle, New Jersey', status: 'planned',
      price: '$3,495,000', done: 'Q3-Q4 2027', beds: '5', baths: '6.5',
      living: '3,819 sq. ft.', basement: '1,672 sq. ft.',
      note: 'Planned with an elevator, first-floor bedroom, 2-car garage and pool.',
      image: 'seed:806-riverview-2400.webp', imageNote: 'Architect’s 3D view - subject to change' },

    /* 405 Old Bridge Rd, Brielle (town from SSDG's project folder). The concept
       renderings are the architect's 3D isometrics, rendered at 2400px from the
       design PDFs (House 1: LOT 2.02 ELEVATIONS sheet A301; House 2: LOT 2.01
       DESIGN DOCS sheet A301). */
    { address: '405 Old Bridge Rd - Home 1', site: '405 Old Bridge Rd', town: 'Brielle', status: 'planned',
      price: '$2,650,000', beds: '4', baths: '4.5', living: '3,556 sq. ft.', basement: 'basement',
      garage: '2-car garage',
      image: 'seed:405-old-bridge-1.jpg', imageNote: 'Concept rendering - subject to change' },
    { address: '405 Old Bridge Rd - Home 2', site: '405 Old Bridge Rd', town: 'Brielle', status: 'planned',
      price: '$2,250,000', beds: '4', baths: '4.5', living: '3,123 sq. ft.', basement: 'basement',
      garage: '1-car garage',
      image: 'seed:405-old-bridge-2.jpg', imageNote: 'Concept rendering - subject to change' },

    { address: '304 Union Ln - Home 1', site: '304 Union Ln', town: 'Brielle', status: 'planned',
      price: '$3,500,000', plans: 'In development',
      note: 'One of two planned single-family homes in a new Brielle subdivision. Specifications and timing will be shared when finalized.' },
    { address: '304 Union Ln - Home 2', site: '304 Union Ln', town: 'Brielle', status: 'planned',
      price: '$3,350,000', plans: 'In development',
      note: 'One of two planned single-family homes in a new Brielle subdivision. Specifications and timing will be shared when finalized.' },

    { address: '315 Foreman Ave - Home 1', site: '315 Foreman Ave', town: 'Point Pleasant Beach', status: 'planned',
      price: '$2,750,000', plans: 'In development',
      note: 'One of two planned single-family homes in a new Point Pleasant Beach subdivision. Specifications and timing are forthcoming.' },
    { address: '315 Foreman Ave - Home 2', site: '315 Foreman Ave', town: 'Point Pleasant Beach', status: 'planned',
      price: '$2,750,000', plans: 'In development',
      note: 'One of two planned single-family homes in a new Point Pleasant Beach subdivision. Specifications and timing are forthcoming.' }
  ]
};
