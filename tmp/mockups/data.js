/* GVC Workspace v2 — mockup data.
   Sources: folder dates from the 2026-10-19 traces (docs/workspace-v2-plan.md, -audit.md)
   and DE's public team page (elliman.com/team/gvc-real-estate-team/226645), read 2026-10-19.
   `est: true` = the date is not in the traces; drawn dashed. Mockup only: nothing here is live. */
window.MOCK = {
  today: '2026-10-19',
  range: { from: '2026-04-13', to: '2026-11-23' },
  sync: { de: 'Mon 19 Oct, 6:02', drive: 'G:\\Shared drives' },

  jobs: [
    {
      id: 'park-1050-13c', name: '1050 Park 13C', market: 'NYC', type: 'listing',
      area: 'Carnegie Hill', agents: [], de: { status: 'Contract signed', price: '$4,500,000', beds: 4, baths: 4 },
      stage: 'In contract',
      status: [
        { s: 'pitch', from: '2026-06-08', to: '2026-09-08' },
        { s: 'won', from: '2026-09-08', to: '2026-09-17' },
        { s: 'live', from: '2026-09-17', to: '2026-10-12', est: true },
        { s: 'contract', from: '2026-10-12', to: null, est: true }
      ],
      work: [
        { k: 'photos', from: '2026-09-08', to: '2026-09-12', est: true, label: '25 raws, 25 edits' },
        { k: 'showsheet', d: '2026-09-14', label: 'Showsheet' },
        { k: 'floorplan', d: '2026-09-15', label: 'Floorplan v1' },
        { k: 'showsheet', d: '2026-09-17', label: 'Showsheet (2nd PDF)' },
        { k: 'floorplan', d: '2026-09-23', label: 'Unbranded' },
        { k: 'film', d: '2026-09-12', est: true, label: 'Film 1.4 GB' }
      ],
      changes: [{ d: '2026-10-01', text: 'Floorplan redrawn (new style)' }],
      deMarks: [{ d: '2026-10-12', text: 'DE: contract signed', est: true }],
      stale: 2,
      activity: { '2026-06-08': 3, '2026-09-07': 58, '2026-09-14': 9, '2026-09-21': 3, '2026-09-28': 4, '2026-10-05': 8 }
    },
    {
      id: 'e57-435-12b', name: '435 E57 12B', market: 'NYC', type: 'listing',
      area: '', agents: [], de: { status: 'Active' }, stage: 'Live',
      status: [
        { s: 'won', from: '2026-08-18', to: '2026-09-09' },
        { s: 'live', from: '2026-09-09', to: null, est: true }
      ],
      work: [
        { k: 'photos', from: '2026-08-18', to: '2026-08-28', est: true, label: '20 raw, 20 edits' },
        { k: 'film', d: '2026-08-28', est: true, label: 'Film 1.4 GB' },
        { k: 'showsheet', d: '2026-09-09', label: 'Showsheet' },
        { k: 'floorplan', d: '2026-09-09', label: 'Floorplan (SS FP)' },
        { k: 'floorplan', d: '2026-09-14', label: 'Floorplan v2' }
      ],
      changes: [{ d: '2026-10-01', text: 'Floorplan redrawn (new style)' }],
      deMarks: [],
      stale: 1,
      activity: { '2026-08-17': 44, '2026-08-24': 6, '2026-09-07': 7, '2026-09-14': 2, '2026-09-28': 2 }
    },
    {
      id: 'wbway-347-6', name: '347 West Broadway 6', market: 'NYC', type: 'listing',
      area: 'SoHo - Nolita', agents: [], de: { status: 'Active', price: '$3,995,000', beds: 2, baths: 2, sqft: '2,200' },
      stage: 'Live', note: 'Pitched 5 Sep 2025',
      status: [{ s: 'live', from: '2026-04-13', to: null, est: true, before: true }],
      work: [], changes: [], deMarks: [],
      folderMissing: 'DE says W BROADWAY, folder is "347 West Broadway": link once',
      activity: {}
    },
    {
      id: 'w59-555-phc', name: '555 W59 PHC', market: 'NYC', type: 'listing',
      area: 'Lincoln Square', agents: [], de: { status: 'Active', price: '$8,650,000', beds: 4, baths: 4, sqft: '3,369' },
      stage: 'Live',
      status: [{ s: 'live', from: '2026-04-13', to: null, est: true, before: true }],
      work: [], changes: [], deMarks: [{ d: '2026-10-05', text: 'DE: price reduced 8.9%', est: true }],
      folderMissing: 'On DE, no folder linked yet',
      activity: {}
    },
    {
      id: 'fifth-1050-2e', name: '1050 Fifth 2E', market: 'NYC', type: 'listing',
      area: 'Carnegie Hill', agents: [], de: { status: 'Contract signed', price: '$3,395,000', beds: 3, baths: 2 },
      stage: 'In contract', note: 'Pitched 13 Jan',
      status: [
        { s: 'live', from: '2026-04-13', to: '2026-09-21', est: true, before: true },
        { s: 'contract', from: '2026-09-21', to: null, est: true }
      ],
      work: [{ k: 'photos', d: '2026-05-04', est: true, label: 'Originals 15–25 MB each' }],
      changes: [], deMarks: [{ d: '2026-09-21', text: 'DE: contract signed', est: true }],
      activity: { '2026-05-04': 30 }
    },
    {
      id: 'e29-229-6g', name: '229 E29 6G', market: 'NYC', type: 'listing',
      area: '', agents: [], de: null, stage: 'Photos',
      status: [{ s: 'won', from: '2026-07-30', to: null }],
      work: [
        { k: 'photos', from: '2026-07-30', to: '2026-08-12', est: true, label: '8 raws → 8 edits' },
        { k: 'staging', d: '2026-08-14', est: true, label: '8 virtually staged' }
      ],
      changes: [], deMarks: [],
      activity: { '2026-07-27': 10, '2026-08-03': 14, '2026-08-10': 12 }
    },
    {
      id: 'e74-255-11b', name: '255 E74 11B', market: 'NYC', type: 'rental',
      area: '', agents: [], de: null, stage: 'Won', note: 'Folder: "11B Rental", paperwork only',
      status: [{ s: 'won', from: '2026-09-23', to: null }],
      work: [], changes: [], deMarks: [],
      activity: { '2026-09-21': 5 }
    },
    {
      id: 'e71-176-phd', name: '176 E71 PHD', market: 'NYC', type: 'listing',
      area: '', agents: ['Elyse Gutman'], de: { status: 'Sold', price: '$2,100,000', list: '$2,250,000', beds: 2, baths: 2 },
      stage: 'Sold',
      status: [
        { s: 'won', from: '2026-04-28', to: '2026-05-14' },
        { s: 'live', from: '2026-05-14', to: '2026-08-11', est: true },
        { s: 'contract', from: '2026-08-11', to: '2026-10-09', est: true },
        { s: 'sold', from: '2026-10-09', to: null, est: true }
      ],
      work: [
        { k: 'photos', from: '2026-04-28', to: '2026-05-01', label: '44 raw + film 1.2 GB' },
        { k: 'floorplan', d: '2026-05-05', label: 'Floorplan v1' },
        { k: 'showsheet', d: '2026-05-14', label: 'Showsheet (Illustrator)' },
        { k: 'social', d: '2026-10-09', label: 'Instagram carousel' },
        { k: 'postcard', d: '2026-10-16', label: 'Just Sold postcard' }
      ],
      changes: [
        { d: '2026-09-01', text: 'Floorplan redrawn' },
        { d: '2026-10-01', text: 'Floorplan redrawn (new style)' }
      ],
      deMarks: [{ d: '2026-10-09', text: 'DE: sold $2,100,000', est: true }],
      stale: 1,
      activity: { '2026-04-27': 52, '2026-05-04': 6, '2026-05-11': 2, '2026-08-03': 4, '2026-08-10': 3, '2026-08-31': 2, '2026-09-28': 2, '2026-10-05': 9, '2026-10-12': 4 }
    },
    {
      id: 'w94-250-11b', name: '250 W94 11B', market: 'NYC', type: 'pitch',
      area: '', agents: [], de: null, stage: 'Pitch', note: 'Comps only, Map Studio map',
      status: [{ s: 'pitch', from: '2026-08-04', to: null }],
      work: [], changes: [], deMarks: [],
      activity: { '2026-08-03': 6 }
    },
    {
      id: 'wea-617-4b', name: '617 WEA 4B', market: 'NYC', type: 'pitch',
      area: '', agents: [], de: null, stage: 'Pitch',
      status: [{ s: 'pitch', from: '2026-06-10', to: null }],
      work: [], changes: [], deMarks: [],
      activity: { '2026-06-08': 4 }
    },
    {
      id: 'pheasant-1006-204', name: '1006 Pheasant Ln #204', place: 'Wall Twp', market: 'NJ', type: 'listing',
      area: 'Wall Township', agents: [], de: null, stage: 'Brochure', note: 'DE status not matched yet',
      status: [{ s: 'won', from: '2026-06-19', to: null, est: true }],
      work: [
        { k: 'photos', from: '2026-06-19', to: '2026-06-21', label: '59 photos, print + web' },
        { k: 'film', d: '2026-08-24', label: 'Film' },
        { k: 'floorplan', d: '2026-08-28', label: 'Floorplan (all floors)' },
        { k: 'brochure', d: '2026-09-03', label: 'Brochure' },
        { k: 'social', d: '2026-09-09', label: 'Carousel "Easy Living"' }
      ],
      gap: { from: '2026-06-21', to: '2026-08-28', text: '10 weeks: shoot to first collateral' },
      changes: [], deMarks: [],
      activity: { '2026-06-15': 122, '2026-08-24': 9, '2026-08-31': 9, '2026-09-07': 8 }
    },
    {
      id: 'bradley-619', name: '619 Bradley Ave', market: 'NJ', type: 'development',
      area: '', size: 'Development', stage: 'Showing assets',
      milestones: [
        { m: 'Renders', from: '2026-05-21', to: '2026-08-17' },
        { m: 'Fact sheet', d: '2026-08-12' },
        { m: 'Hold harmless', d: '2026-08-20' },
        { m: 'Renders (upscaled interiors)', d: '2026-09-16' },
        { m: 'Architecturals', d: '2026-10-01' },
        { m: 'Floorplans', d: '2026-10-07' },
        { m: 'Showing assets', d: '2026-10-07' }
      ],
      undated: ['Finishes (167 files)'],
      activity: { '2026-04-13': 180, '2026-04-20': 210, '2026-04-27': 160, '2026-05-04': 150, '2026-05-11': 140, '2026-05-18': 130, '2026-05-25': 110, '2026-06-01': 90, '2026-06-08': 50, '2026-06-15': 39, '2026-08-10': 14, '2026-08-17': 22, '2026-09-14': 30, '2026-09-28': 18, '2026-10-05': 26 }
    },
    {
      id: 'casa-avenida', name: 'Casa Avenida', market: 'FL', type: 'development',
      area: '', size: 'Development', stage: 'Construction',
      milestones: [],
      undated: ['Launch event', 'Groundbreaking', 'Demolition footage', 'Construction schedule', 'Contracts of sale'],
      activity: { '2026-04-06': 300, '2026-04-13': 420, '2026-04-20': 380, '2026-04-27': 276, '2026-06-01': 20, '2026-08-03': 12 }
    }
  ],

  todo: [
    { t: 'Email James and Marli on Tuesday to discuss the NJ Buyer and Seller Packages.', src: 'Matt' },
    { t: 'Florida office signage', src: 'Matt' },
    { t: 'Marli\u2019s referral partners for the NJ buyer package', src: 'Waiting' },
    { t: 'Karl needs a real headshot', src: 'Waiting' }
  ]
};
