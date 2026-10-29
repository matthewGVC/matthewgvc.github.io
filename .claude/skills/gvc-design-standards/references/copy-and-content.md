# Copy, content and images

The most expensive mistakes in this workspace have been invented content reaching a printed page that goes to a client. Settle content first, design second.

## The never-invent list

Never make up, round, or "fill in to show the layout":

- agent names, bios, headshots, titles, licence numbers or contact details
- testimonials and quotes (none exist yet for Katie, Nicole, Gary, Ayuen or TJ)
- preferred vendors (Marli has no mover, stager or designer yet; that category stays empty on purpose)
- property figures: prices, sizes, sale dates, days on market, fees
- towns, counties, neighbourhoods, regions or area groupings (a Claude-invented "9-area" grouping was removed at Matt's request)
- taglines, mottos, statistics, awards, "why GVC" claims
- form fields, URLs (re-check useful links before each print run; do not invent a URL)
- MLS data beyond what the export holds; owner names and other personal data in exports are never committed or printed

If a sample row or example is needed to test a layout, label it as test data and keep it out of anything committed or printed for clients.

## Stamps: a visible gap, not a hidden one

When real content is missing, show a stamp that a reader cannot miss. Existing stamps and where they live:

| Stamp | Meaning | Where used |
|---|---|---|
| "Work in progress" | Page is live but not cleaned up | NJ Meet Your Agent pages |
| Red "CHECK" tag | Item needs confirmation with the agents | NJ 50 Things, via `NJ_FIFTY_CHECK` (empty since 2026-10-28: Marli's own list) |
| Dashed "to be added" (editor only) | A vendor category has no name yet | Marli's Preferred Vendors, Useful Links page |
| "Needs updating" | Map or image is a stand-in | NJ buyer why-page map |
| "Draft" stamp | Draft status | Off for NJ Footprint since 2026-10-13 |

Rules for stamps:
- A stamp stays until the real content arrives. Clear it only when the data is in hand, and say which stamp came off.
- Do not hide a stamp to make a page look finished. If a stamp breaks the layout, fix the layout around it.
- A new gap gets a new stamp, worded plainly ("Testimonial needed"), in the existing stamp style.

## Copy voice

- Headings name the actual thing: "New Jersey buyer package", "Monmouth and Ocean towns", not "Find your perfect home".
- Labels carry real data only. No decorative eyebrows ("GVC Real Estate · Tool") and no "Tool ·" prefix on page heads.
- Plain, factual, confident. Avoid superlatives you cannot back up.
- Team name spelled as in the lockup. Douglas Elliman affiliation and legal footer are fixed boilerplate.

## Images

- **Real first.** Agent headshots and cut-outs, GVC film stills, Matt's own mockups and the listing photos come from the shared drives (`G:/Shared drives/GVC - Marketing/...`, `GVC - Videos Photos/...`).
- **Stock only when verifiable.** Pexels or Unsplash, free licence, verifiably of the stated place. Record the photo ID in a code comment. The NJ seller deck uses NJ stock only.
- **Stock Photos folder** (`G:/Shared drives/GVC - Marketing/02 - Assets/Stock Photos`): organised by place, with Destination Guide Photos holding every guide photo plus a sources and licences README. New stock goes in the matching folder named `Place - Subject - Source ID (Photographer)`.
- **Check License First** images: third-party credit, an MLS watermark or an unknown source. Do not publish them. Never delete them.
- **No low-res.** Print needs the high-resolution original. Recent exception: `why-nyc.png` is 2.0 MB and stays because it is in use.
- **No drawn stand-ins for photos.** A drawn camera or scene that stands in for a real photo looked fake; stamp the gap instead.
- Photos in printed tools are dragged in through `photo-dnd.js`; check each photo lands where it was dropped and never shows twice (`dnd-local.js`).

## Client data and privacy

- Never store client or visitor personal data (names, emails, phone numbers) in localStorage or any saved state. Property addresses are fine.
- Never commit exports containing owner PII. The NJ footprint MLS exports are the example: they stay in Downloads, and only the cleaned sales rows (no owner names) go into `transactions.js`.
- Do not put personal data in URL parameters.

## Writing for the reviewer

Matt asked "where did you come up with this?" about an invented grouping. When proposing anything Claude made up (a region, a category, a line of copy), say it is Claude's own proposal, not an established fact.
