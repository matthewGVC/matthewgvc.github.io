# GVC Workspace v2: site contents

An internal production app for the creative team of The GVC Team (Douglas Elliman). Markets: NYC, NJ, FL. Main user: Matt Bloomfield (team designer). Used on a desktop computer, sometimes a phone.

---

## 1. Pages

| Page | What it holds |
|---|---|
| Sign in | One sign-in when the app opens. Nothing loads before it. |
| Overview (home) | Every job with its stage dates + the to-do list. |
| Jobs: Listings | List of all listing jobs (sales and rentals). |
| Jobs: Pitches | List of seller pitches not yet won. |
| Jobs: Developments | List of new developments. |
| Job page | One job: everything about it. |
| Tool (opened from a job) | One of the tools below, already filled with that job's facts, photos, floorplan and agents. |
| Team | Team pieces not tied to one job. |
| Reference | Listing rules, calculator. |
| To-do | Matt's to-do list (also shown on the Overview). |

### Navigation
- Main menu on every page: Overview · Jobs (Listings, Pitches, Developments) · Team · Reference · To-do.
- Available from every page: "New job", Drive connection status, last DE sync time.

### Connections between pages
- Overview → click a job → Job page.
- Jobs list → click a job → Job page.
- Job page → "Make" or "Rebuild" on a piece → that piece's tool, filled from the job.
- Tool → "Save" → finished file goes into the job's Drive folder → back to the Job page.
- Job page → "Open folder" / "Copy folder link" → the job's Google Drive folder.
- Job page → "DE listing" → the listing on elliman.com.
- Overview to-do item about a job → that Job page.
- Pitch job → "Won" → becomes a listing job (keeps its history and pitch).
- Team page → each item opens its tool.
- New job → form → creates the job record and its Drive folder → Job page.

---

## 2. Job types

| Type | Notes |
|---|---|
| Listing (sale) | The main job. Full kit. |
| Listing (rental) | Tracked; every piece available, none expected. |
| Pitch | A seller pitch before the listing is won. Becomes a listing when won. |
| New development | Overview and milestones only. No marketing kit for now. Size: boutique 1–4 homes, medium 5–40, large 41+. |

Buyers have no jobs (Buyer Package is a Team tool).

---

## 3. Listing stages (in order; any can be skipped)

Pitch → Won → Floorplan → Showsheet → Photos → Brochure → Live → In contract → Sold / Rented → Archived

- Live, In contract, Sold/Rented come automatically from Douglas Elliman's website (DE sync).
- Earlier stages come from what exists in the job's folder, or Matt sets them.
- DE status values: Active, Price reduced, Contract signed, Sold, Rented.

## 4. Development milestones

Pitch / agreement · Architecturals · Renders · Finishes · Floorplans · Branding · Launch / groundbreaking event · Showing assets · Contracts · Construction · Sales.
Each: date (or date range), or "no date yet".

---

## 5. Overview contents

- All jobs. Filters: market (All, NYC, NJ, FL), type (Listings, Pitches, Developments), show/hide archived.
- Date range covered: the last 6 months + the next month. Today's date.
- Per job:
  - name (address + unit), market, current stage, price (from DE)
  - each stage with its start and end dates
  - dates of DE status changes
  - dates of logged changes (price, floorplan, etc.)
  - dates pieces were made
  - folder activity: number of files touched per week
  - gaps: long stretches with nothing happening (e.g. "10 weeks: shoot to first collateral")
  - flags: number of stale pieces, folder not linked, not matched to DE
- Developments show milestones instead of stages.
- Jobs with only one file are still included.
- To-do list (see section 12).

---

## 6. Job page contents

1. **Basics:** address + unit, status, price, beds/baths, neighborhood, date pitched, date opened, Drive folder path. Actions: Open folder, Copy folder link, DE listing.
2. **History** of this job only: stage dates, change dates, piece dates.
3. **Facts** (section 7). Each value says whether it came from DE. Core facts always; extras optional.
4. **Agents** on the job (picked once from the roster; every piece uses them).
5. **Kit** (section 8): every piece with its state and actions. "Rebuild all stale" action.
6. **Floorplans** (section 9).
7. **Photos** (section 10).
8. **Change log** (section 11), with a quick "log a change" field.
9. **Drive folder:** folder tree of the marketing subfolders + folder health notes (section 13).

---

## 7. Facts per job (variables)

Sources: details doc (Word file dropped in folder, read automatically) · short agent form · DE sync (wins on conflict) · typed by Matt · found in folder · worked out automatically.
Tier: **Core** (needed) · **Extra** (optional) · **System** (never typed).

### Identity
| Field | Type | Tier |
|---|---|---|
| address | text | Core |
| unit | text | Core |
| city, state, zip | text | Core |
| market | NYC / NJ / FL | Core |
| neighborhood (NYC) / town (NJ, FL) | pick list | Core |
| borough | text | Extra |
| kind | sale / rental | Core |
| propertyType | Co-op / Condo / Condop / Townhouse / Single family / Other | Core |
| displayLabel | e.g. "176 E71 PHD" | System |
| deListingId | id | System |
| driveFolder | path | System |

### Status and dates
| Field | Type | Tier |
|---|---|---|
| stage | see section 3 | System |
| deStatus | Active / ActiveUnderContract / Sold / Rented | System |
| pitchedOn, listedOn, contractOn, closedOn | date | System |
| closePrice | money | System |
| openHouses | list of date + time | Core |

### Money
| Field | Type | Tier | Markets |
|---|---|---|---|
| price | money | Core | all |
| rent | money / month | Core | rentals |
| maintenance (co-op) / common charges (condo) / HOA | money / month | Core | all |
| taxesMonthly | money / month | Core | all |
| maxFinancing | % | Core | NYC co-op |
| flipTax | text | Core | NYC co-op |
| assessments | text | Core | mostly NYC |
| taxDeductible | % | Extra | NYC co-op |
| capitalContributions | text | Extra | NYC |
| lotSize | text | Core | houses (NJ, FL) |
| mlsId | text | System | all |

### Size and layout
| Field | Type | Tier |
|---|---|---|
| beds | number | Core |
| baths (full) | number | Core |
| halfBaths | number | Core |
| sqft (approx.) | number | Core |
| rooms | number | Extra |
| layoutType (Simplex, Duplex, Penthouse, Classic 6…) | pick list | Extra |
| floor | number | Extra |
| exposures (N/S/E/W) | multi pick | Extra |
| views | pick list | Extra |
| ceilingHeight | text | Extra |
| outdoorSpace + sq ft | pick list + number | Extra |
| climate (HVAC) | text | Extra |
| yearBuilt | year | Extra |
| stories | number | Extra |
| parking | text | Extra |

### Building (NYC, kept per unit)
architect, residences, service (doorman etc.), policy (pets, pied-à-terre, sublets), amenities: all Extra.

### Features and copy
| Field | Type | Tier |
|---|---|---|
| interiorFeatures | bullet list | Core |
| buildingFeatures | bullet list | Core |
| description | long text ("Draft with AI" action) | Core |
| shortDescription | 1–2 lines | Core |
| headline | short text (e.g. "Easy Living") | Extra |
| extras | ~150 more intake-form fields (kitchen, baths, HVAC, washer/dryer, amenities, policies) | Extra |

### People
| Field | Type | Tier |
|---|---|---|
| agents | 1+ from team roster | Core |
Client names are never stored.

### Media (pointers to Drive, never copies)
| Field | Notes |
|---|---|
| photos.print, photos.web | photographer's sets |
| photos.edited, photos.staged | staged ↔ original pairs |
| photos.hero, photos.order | chosen by Matt; used by every piece |
| floorplans | versions × layouts × renders (section 9) |
| video | tracked only |
| listingUrl | elliman.com listing link |

### Pitch-only facts
comps (list), priceLow / priceMid / priceHigh, recommended band, map pins.

---

## 8. The kit (pieces per job)

Each piece has a state: **Made** (date, file name) · **Stale** (built from an old fact, floorplan or photo; shows what changed) · **Not made**.
Each piece has actions: Make / Rebuild / Open / Copy Drive link.
Each piece records which fact values and floorplan version it was built from.

| Piece | Resale | Rental | Tool | Output |
|---|---|---|---|---|
| Seller pitch + CMA (incl. map) | ✓ before won | – | Seller Package (+ Map Studio) | PDF |
| Floorplan: branded | ✓ | ✓ | Floorplan engine | PDF/PNG |
| Floorplan: unbranded (for listing sites) | ✓ | ✓ | Floorplan engine | PNG/JPG |
| Floorplan: blank sheet (for showsheet) | ✓ | ✓ | Floorplan engine | SVG/PDF |
| Photo edits / virtual staging (watermarked) | ✓ | ✓ | outside app + Watermark | JPG |
| Showsheet (A5 or Letter, NYC) | ✓ | ✓ | Showsheet | PDF |
| Brochure (8.5×11 or 5.5×8.5) | ✓ | – | Brochure | PDF |
| Open house flyer | ✓ | ✓ | new tool | PDF |
| Social carousel (just listed / in contract / just sold) | ✓ | ✓ | new tool | PNG slides |
| Postcard 6×9 (Just Sold / For Sale) | ✓ | – | Postcard | PDF |
| Signage (yard sign, 4×6) | NJ, FL | – | new tool | PDF |
| Film | tracked only | – | not made here | — |

File naming: `<Piece> - <Address Unit> - <YYYY-MM-DD>.pdf`. Older versions move to that piece's `Archive\` folder.
Parked for later: listing-site pack (StreetEasy / MLS / Stellar upload folder).

---

## 9. Floorplans

- **Versions:** v1, v2, … each with date, note on what changed, who asked.
- **Layouts:** Current, Alternate 1, Alternate 2… (label "CURRENT" printed only when an alternate exists).
- **Renders** of each version × layout: Branded · Unbranded · Blank sheet.
- Source file (CubiCasa / traced plan) kept per job.
- A new version marks every piece built from the old one as stale.
- Restyling all floorplans is one action (the style is applied by the app).

## 10. Photos

- Sets: Print, Web (from photographer), Edited, Staged (paired with originals), plus Raws where used.
- Count per set; thumbnails read from Drive.
- Hero/cover pick and photo order, used by every piece.
- Film tracked if present.

## 11. Change log (per job)

Each entry: date · who asked (agent, Matt, DE, folder) · what changed · effect (which pieces went stale, stage moved).
Entries come from: Matt typing (one field), DE sync (price, status), folder (new files found).

## 12. To-do

- Matt's own items (add, tick, remove).
- "Waiting on others" items.
- Flags the app makes by itself:
  - pieces stale (job + count)
  - job on DE with no folder linked
  - job folder not matched to a DE listing
  - sold on DE → archive?
  - pitch with no listing after a long time → won or lost?

## 13. Drive folder and folder health

- Each job links to its existing Drive folder wherever it is. Folders are never moved or renamed.
- Deal paperwork (contracts, offers, commission) is never read or shown.
- Folder health notes: missing floorplan / details doc, duplicate pieces at top level, files outside the standard, duplicate folders.
- Standard for NEW jobs only:
  - Floorplan\ (Source\, v1\, v2\ …)
  - Photos\ (Print\, Web\, Edited\, Staged\)
  - Marketing\ (Pitch\, Showsheet\, Brochure\, Open House\, Postcard\, Social\, Signage\, Video\; each with Archive\)
  - Docs\ (never read)
- Where new jobs go: NYC `GVC - New York\Building Information\<Building>\<Unit>`, NJ `GVC - New Jersey\1. Residential Sales\1. Resale\<Town>\<Address>`, FL `GVC - Florida\Resale\<Address>`.

## 14. New job form

Fields: type (listing sale / rental / pitch / development), market, address, unit, city/town, agents, property type. Creates the record and the folder. Option: link an existing folder instead.

## 15. Team (not tied to a job)

| Item | What it is |
|---|---|
| Agents & bios | Roster, headshots, bios, phone, email, Instagram |
| Agent info | Agent crib sheets |
| Destination guides | County guides (NJ, FL) |
| NJ Footprint | NJ sales map (with figures / towns only versions) |
| Office screens | 13 TV loops, landscape + portrait |
| Buyer package | Buyer packet (NYC, NJ, FL); not tied to a job |
| Expired postcards | Postcards not tied to a listing |

## 16. Reference

- Listing rules (StreetEasy, MLS, Stellar)
- Calculator (feet and inches)

## 17. Data sources and status

| Source | What it gives | Shown as |
|---|---|---|
| Google Drive (G:\Shared drives) | all files | connected / not connected |
| Douglas Elliman team page | status, price, beds, baths, sq ft, close price, listing link | last sync time, "Refresh from DE" |
| App database | facts, change log, pieces, to-do | — |

## 18. Agent roster (real)

Founders: John Gasdaska, TJ Verdiglione, Jonathan Conlon.
NYC: Katie Cook, Nicole Sobol, Gary Kasparov, Elyse Gutman, Ayuen Gai.
NJ: Marli Silver, George Putykewycz, James Huber.
FL: Nicole Melveney, Karl Brisard.

## 19. Sample jobs (public on elliman.com, for filling the screens)

| Job | Market | Type | Stage | DE | Known dates |
|---|---|---|---|---|---|
| 1050 Park Ave 13C | NYC | Listing | In contract | Contract signed, $4,500,000, 4 bd 4 ba, Carnegie Hill | Pitched Jun 8; folder Sep 8; showsheet Sep 14 + Sep 17 (one stale); floorplan v1 Sep 15, unbranded Sep 23, v2 Oct 1 |
| 435 E57 12B | NYC | Listing | Live | Active | Opened Aug 18; showsheet + floorplan Sep 9; floorplan Sep 14, Oct 1 |
| 347 West Broadway 6 | NYC | Listing | Live | Active, $3,995,000, 2 bd 2 ba, 2,200 sq ft, SoHo-Nolita | Pitched Sep 5 2025 |
| 555 W 59th PHC | NYC | Listing | Live | Active, $8,650,000 (reduced 8.9%), 4 bd 4 ba, 3,369 sq ft, Lincoln Square | — |
| 1050 Fifth Ave 2E | NYC | Listing | In contract | Contract signed, $3,395,000, 3 bd 2 ba, Carnegie Hill | Pitched Jan 13 |
| 229 E29 6G | NYC | Listing | Photos | — | Opened Jul 30; 8 raws, 8 edits, 8 virtually staged |
| 255 E74 11B | NYC | Rental | Won | — | Opened Sep 23; paperwork only |
| 176 E71 PHD | NYC | Listing | Sold | Sold $2,100,000 (list $2,250,000), 2 bd 2 ba | Photos Apr 28–May 1; floorplan May 5; showsheet May 14; contract Aug; floorplan redrawn Sep 1, Oct 1; Instagram Oct 9; Just Sold postcard Oct 16. Agent: Elyse Gutman |
| 250 W94 11B | NYC | Pitch | Pitch | — | Pitched Aug 4 (comps + map) |
| 617 WEA 4B | NYC | Pitch | Pitch | — | Pitched Jun 10 |
| 1006 Pheasant Ln #204, Wall Township | NJ | Listing | Brochure | not matched | Shoot Jun 19–21 (59 photos print + web); film Aug 24; floorplan Aug 28; brochure Sep 3; carousel "Easy Living" Sep 9 |
| 619 Bradley Ave | NJ | Development | Showing assets | — | Renders May 21–Aug 17; fact sheet Aug 12; hold harmless Aug 20; upscaled interiors Sep 16; architecturals Oct 1; floorplans + showing assets Oct 7 |
| Casa Avenida | FL | Development | Construction | — | Launch event, groundbreaking, demolition, construction schedule, contracts (dates not recorded) |

Today's date for the samples: 19 Oct 2026.
