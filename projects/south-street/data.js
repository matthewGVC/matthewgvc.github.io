/* ============================================================
   SOUTH STREET DEVELOPMENT GROUP — new-construction pipeline.
   Drawn by assets/js/development.js; this file is the only thing to
   change when a price, a date or a home changes.

   Every word and figure here is from "REFERENCE DOC - SSDG Pipeline.pdf"
   (the two-page Private Preview, October 2026). Do not add anything that is
   not in a source Matt has supplied: a prospective buyer reads this as fact.

   Home fields:
     id        anchor on the page (#619-bradley)
     address   as printed
     town      only where the source states it (405 Old Bridge Rd: not stated)
     status    'construction' | 'planned'  — the at-a-glance counts and the
               timeline are worked out from this, never typed
     price     asking price, as printed
     done      estimated completion; null when the source gives none
     plans     printed in place of a completion date ("In development")
     beds, baths, living, basement, garage   as printed; omit when not given
     note      the source's sentence about the home
     image     base name in img/ (-1200.webp and -2400.webp); high-res only
     imageNote the caption under the picture
     site      homes sharing a site are one subdivision, shown side by side
   ============================================================ */
window.GVC_DEVELOPMENT = {
  kicker: 'Private preview',
  title: 'New Construction Opportunities',
  lede: 'A concise look at homes underway now and the projects coming next.',
  developer: {
    name: 'South Street Development Group',
    logo: 'img/ssd-logo.png',
    logoWhite: 'img/ssd-logo-white.png'
  },
  marketing: 'the GVC Team at Douglas Elliman',
  hero: '619-bradley',
  subdivisionsIntro: 'Six additional homes are shown below, with each subdivision residence listed individually.',
  nextStep: 'Contact the GVC Team at Douglas Elliman for current pricing, plans, availability, and private appointment options.',
  contactUrl: 'https://gvcrealestateteam.com/contact',
  disclaimer: 'Preliminary information only. Pricing, plans, timing, specifications, and availability are subject to change.',

  homes: [
    { id: '619-bradley', address: '619 Bradley Ave', town: 'Brielle, New Jersey', status: 'construction',
      price: '$1,895,000', done: 'Q1 2027', beds: '4', baths: '4.5',
      living: '2,550 sq. ft.', basement: '694 sq. ft.',
      note: 'Currently under construction in Brielle. Request the latest plans, specifications, and construction update.',
      image: '619-bradley', imageNote: 'Exterior rendering - subject to change' },

    { id: '610-agnes', address: '610 Agnes Ave', town: 'Brielle, New Jersey', status: 'construction',
      price: '$2,695,000', done: 'Q2 2027', beds: '5', baths: '4.5',
      living: '3,564 sq. ft.', basement: '1,515 sq. ft.',
      note: 'Demo is complete and foundation work is next. Includes a first-floor bedroom and 2-car garage.',
      image: '610-agnes', imageNote: 'Exterior rendering - subject to change' },

    { id: '806-riverview', address: '806 Riverview Dr', town: 'Brielle, New Jersey', status: 'planned',
      price: '$3,495,000', done: 'Q3-Q4 2027', beds: '5', baths: '6.5',
      living: '3,819 sq. ft.', basement: '1,672 sq. ft.',
      note: 'Planned with an elevator, first-floor bedroom, 2-car garage and pool.',
      image: '806-riverview', imageNote: 'Architect’s 3D view - subject to change' },

    /* 405 Old Bridge Rd: the only renderings are ~700px copies inside the PDF,
       too small to use. Add image/imageNote once the originals are found. */
    { id: '405-old-bridge-1', address: '405 Old Bridge Rd - Home 1', site: '405 Old Bridge Rd', status: 'planned',
      price: '$2,650,000', beds: '4', baths: '4.5', living: '3,556 sq. ft.', basement: 'basement',
      garage: '2-car garage' },
    { id: '405-old-bridge-2', address: '405 Old Bridge Rd - Home 2', site: '405 Old Bridge Rd', status: 'planned',
      price: '$2,250,000', beds: '4', baths: '4.5', living: '3,123 sq. ft.', basement: 'basement',
      garage: '1-car garage' },

    { id: '304-union-1', address: '304 Union Ln - Home 1', site: '304 Union Ln', town: 'Brielle', status: 'planned',
      price: '$3,500,000', plans: 'In development',
      note: 'One of two planned single-family homes in a new Brielle subdivision. Specifications and timing will be shared when finalized.' },
    { id: '304-union-2', address: '304 Union Ln - Home 2', site: '304 Union Ln', town: 'Brielle', status: 'planned',
      price: '$3,350,000', plans: 'In development',
      note: 'One of two planned single-family homes in a new Brielle subdivision. Specifications and timing will be shared when finalized.' },

    { id: '315-foreman-1', address: '315 Foreman Ave - Home 1', site: '315 Foreman Ave', town: 'Point Pleasant Beach', status: 'planned',
      price: '$2,750,000', plans: 'In development',
      note: 'One of two planned single-family homes in a new Point Pleasant Beach subdivision. Specifications and timing are forthcoming.' },
    { id: '315-foreman-2', address: '315 Foreman Ave - Home 2', site: '315 Foreman Ave', town: 'Point Pleasant Beach', status: 'planned',
      price: '$2,750,000', plans: 'In development',
      note: 'One of two planned single-family homes in a new Point Pleasant Beach subdivision. Specifications and timing are forthcoming.' }
  ]
};
