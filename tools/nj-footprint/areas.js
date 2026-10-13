/* NJ Footprint — AREAS, for the "Areas" version of the sheet (no sales figures).
   Every Monmouth and Ocean County town belongs to exactly one area; the back page colours the
   map by area and lists every town under its area. Town names must match nj-towns.js
   (scripts/test-nj-footprint.js checks that each town is in one area and only one).
   Colours: neighbouring areas are kept far apart in tone so the borders read on paper. */
window.NJ_AREAS = [
  { name: 'Bayshore', county: 'Monmouth', color: '#00A1C4',
    towns: ['Aberdeen', 'Atlantic Highlands', 'Hazlet', 'Highlands', 'Keansburg', 'Keyport', 'Matawan', 'Middletown', 'Union Beach'] },
  { name: 'Two River', county: 'Monmouth', color: '#00273A',
    towns: ['Eatontown', 'Fair Haven', 'Little Silver', 'Monmouth Beach', 'Oceanport', 'Red Bank', 'Rumson', 'Sea Bright',
      'Shrewsbury Boro', 'Shrewsbury Twp', 'Tinton Falls'] },
  { name: 'Northern Shore', county: 'Monmouth', color: '#BCE8F0',
    towns: ['Allenhurst', 'Asbury Park', 'Avon-by-the-Sea', 'Belmar', 'Bradley Beach', 'Deal', 'Interlaken', 'Lake Como',
      'Loch Arbour', 'Long Branch', 'Neptune', 'Neptune City', 'Ocean Twp', 'West Long Branch'] },
  { name: 'Southern Shore', county: 'Monmouth', color: '#53C7DC',
    towns: ['Brielle', 'Manasquan', 'Sea Girt', 'Spring Lake', 'Spring Lake Heights', 'Wall'] },
  { name: 'Western Monmouth', county: 'Monmouth', color: '#A9BCC4',
    towns: ['Allentown', 'Colts Neck', 'Englishtown', 'Farmingdale', 'Freehold Boro', 'Freehold Twp', 'Holmdel', 'Howell',
      'Manalapan', 'Marlboro', 'Millstone', 'Roosevelt', 'Upper Freehold'] },
  { name: 'Northern Ocean', county: 'Ocean', color: '#2C5A6E',
    towns: ['Bay Head', 'Brick', 'Jackson', 'Lakewood', 'Plumsted', 'Point Pleasant', 'Point Pleasant Beach'] },
  { name: 'Central Ocean', county: 'Ocean', color: '#9C8560',
    towns: ['Beachwood', 'Berkeley', 'Island Heights', 'Lakehurst', 'Manchester', 'Ocean Gate', 'Pine Beach',
      'South Toms River', 'Toms River'] },
  { name: 'Barrier Islands', county: 'Ocean', color: '#D8C9AE',
    towns: ['Barnegat Light', 'Beach Haven', 'Harvey Cedars', 'Lavallette', 'Long Beach', 'Mantoloking', 'Seaside Heights',
      'Seaside Park', 'Ship Bottom', 'Surf City'] },
  { name: 'Southern Ocean', county: 'Ocean', color: '#6E98A8',
    towns: ['Barnegat', 'Eagleswood', 'Lacey', 'Little Egg Harbor', 'Ocean Twp', 'Stafford', 'Tuckerton'] }
];
