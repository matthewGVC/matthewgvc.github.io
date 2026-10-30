# Made-up DE fixtures

Same JSON shape as Douglas Elliman's team feeds (recorded 2026-10-19), with invented
addresses and prices, so the repo's tests never hold real listing data (plan D2, spec C10).
Real recordings go in `helper/fixtures/recorded/<date>/` (gitignored).

Files: `<feed>-p<n>.json`, feeds `featured-sale`, `featured-rental`, `transactions-sale`,
`transactions-rental`. Each page is `{ data: [...], totalCount }`. Also `de-page-condo.txt`,
`de-page-house.txt` and `de-page-nolot.txt`: made-up text of a DE listing page, for the page-facts
parser (`helper/de/page-facts.js`).

Field names that matter (from the recording):
- paging: query `pageNumber`, `pageSize` (100 accepted), `listingTypeClass` 1 = sale, 0 = rental;
  response `totalCount`.
- `listingStatus` on featured rows only: `Active`, `ActiveUnderContract`, `Pending`.
  Transactions rows have none: the feed says sold (sale) or rented (rental).
- `address.samlsPartialAddress` ("555 W 59TH ST PHC"), `address.unitNumber`, `address.samlsFullAddress`.
- The API needs the team page's own short-lived `cookies` request header (borrowed at run time,
  never stored).
