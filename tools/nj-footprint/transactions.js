/* NJ Footprint — TRANSACTIONS.

   *** DRAFT: MARLI SILVER'S SALES ONLY. TJ and James are not in here yet. ***
   Source: the Sold list on Marli's public Zillow profile (read 2026-10-06), buyer and seller
   side both counted. Zillow only gives "3 years ago", so dates are approximate: a month for
   sales under a year old, otherwise a year (+/- 1). Three Manhattan buyer-side sales are left
   out (NJ page), and one Asbury Park sale Zillow listed twice is counted once. No street
   addresses are kept; the page only needs town, county and price.

   When the full MLS list (TJ, James, Marli) arrives:
     1. replace the rows in NJ_TRANSACTIONS (fields: date, town, county, price, agent; `side` is
        optional and not used by the page),
     2. set NJ_DRAFT_NOTE to '' — that removes the stamp from the printed page,
     3. update NJ_SOURCE to say where the figures come from,
     4. run  node scripts/test-nj-footprint.js
   County must be the plain name used on the map ("Monmouth", not "Monmouth County").
   Agent must be one of the three names in footprint.js. */
window.NJ_DRAFT_NOTE = "Draft — Marli Silver's sales only";
window.NJ_SOURCE = "Figures are Marli Silver's closed sales, buyer and seller side, as listed on Zillow; dates are approximate.";
window.NJ_TRANSACTIONS = [
 {"date":"2026-08","town":"Lanoka Harbor","county":"Ocean","price":845000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2026-07","town":"Freehold","county":"Monmouth","price":750000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2026-07","town":"Neptune","county":"Monmouth","price":532000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2026-06","town":"Atlantic Highlands","county":"Monmouth","price":732000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2026-06","town":"Manalapan","county":"Monmouth","price":985000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2026-06","town":"Lanoka Harbor","county":"Ocean","price":900000,"agent":"Marli Silver","side":"Both"},
 {"date":"2026-05","town":"Englishtown","county":"Monmouth","price":600000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2026-01","town":"Tinton Falls","county":"Monmouth","price":465000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2025-11","town":"Tinton Falls","county":"Monmouth","price":450000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2025","town":"Manalapan","county":"Monmouth","price":700000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2025","town":"Port Monmouth","county":"Monmouth","price":685000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2025","town":"Eatontown","county":"Monmouth","price":760000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2024","town":"Keansburg","county":"Monmouth","price":290000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2024","town":"Freehold","county":"Monmouth","price":695000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2024","town":"Tinton Falls","county":"Monmouth","price":305000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2024","town":"Middletown","county":"Monmouth","price":450000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2024","town":"Toms River","county":"Ocean","price":650000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2023","town":"Red Bank","county":"Monmouth","price":520000,"agent":"Marli Silver","side":"Seller"},
 {"date":"2023","town":"Wall","county":"Monmouth","price":825000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2023","town":"Manalapan","county":"Monmouth","price":860000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2022","town":"Red Bank","county":"Monmouth","price":347500,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2022","town":"Neptune","county":"Monmouth","price":405000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2022","town":"Freehold","county":"Monmouth","price":640000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2022","town":"Point Pleasant","county":"Ocean","price":535000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2021","town":"Union Beach","county":"Monmouth","price":705000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2021","town":"South Amboy","county":"Middlesex","price":340000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2021","town":"Morganville","county":"Monmouth","price":1499999,"agent":"Marli Silver","side":"Seller"},
 {"date":"2021","town":"Matawan","county":"Monmouth","price":349900,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2021","town":"Sea Bright","county":"Monmouth","price":350000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2021","town":"Asbury Park","county":"Monmouth","price":660000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2020","town":"Beachwood","county":"Ocean","price":265000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2020","town":"Atlantic Highlands","county":"Monmouth","price":575000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2020","town":"Middletown","county":"Monmouth","price":226000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2019","town":"East Brunswick","county":"Middlesex","price":159000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2019","town":"Holmdel","county":"Monmouth","price":410000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2019","town":"Tinton Falls","county":"Monmouth","price":549000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2018","town":"Cliffwood","county":"Monmouth","price":355000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2018","town":"Ocean Township","county":"Monmouth","price":345000,"agent":"Marli Silver","side":"Buyer"},
 {"date":"2018","town":"Keansburg","county":"Monmouth","price":132000,"agent":"Marli Silver","side":"Buyer"}
];
