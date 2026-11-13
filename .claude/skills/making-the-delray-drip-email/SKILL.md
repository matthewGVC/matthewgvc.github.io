---
name: making-the-delray-drip-email
description: Use when asked to make, build, draft, test or schedule the monthly Delray Drip email (the "Coastal Living Delray" newsletter, the Delray Drip Campaign in MailerLite that goes out on the 15th), or when Matt gives this month's Delray market figures or says its header is in the folder.
---

# Making the Delray Drip email

One email a month to the Delray list: a market banner, a short note, three events left this
month, three next month, a featured local spot. Matt supplies **only the header**: the "How's
the Market?" banner, or just its three figures. Everything else is yours: find the events, write
the copy, pick the pictures, build the email, load it into MailerLite, send Matt a test, and
schedule it on his OK.

**The one rule that matters: every event's date comes from its own page, read today.** The
planning doc's event lists are often wrong, and a wrong date in 290 inboxes cannot be taken back.

**It always sends on the 15th at 10:00 AM Eastern**, weekend or not.

## Where things are

| What | Where |
|---|---|
| Month's content and images | `assets/email/delray-drip/<yyyy-mm>/` (`email.json`, built `email.html`, `preview.html`) |
| Scripts and template | this folder: `build.py`, `header.py`, `compare.py`, `template*.html`, `fonts/` |
| Matt's header | `G:\Shared drives\GVC - Marketing\02 - Assets\Emails\Delray Drip Campaign\<Month yy>\` (e.g. `November 26`) |
| Photo library (hero, spot) | same Drive folder, `Delray Photos\Delray Photos- Horizontal\` |
| Planning doc (themes, subject ideas, spots) | Google Doc `1WDbklzsgcnqyHrM0qy-utr5mXXzqx2-QCaEON270DT8`, one section per month |
| Events | `https://downtowndelraybeach.com/events/calendar`, each event at `/do/<slug>` |
| MailerLite | sender `info@gvcrealestateteam.com`, name `GVC Real Estate Team`; groups `170238093485409379` (Delray Drip Campaign) and `169447831118021824` (GVC Subscribers (NEW)) |

## Steps

1. **Header.** Three cases:
   - Matt's banner is in the month's Drive folder: set `header.src` to it.
   - Matt gives figures (Karl sends them): draw the banner with `header.py`, below.
   - Neither: build with `"header": {"placeholder": true}`, say the header is missing, and
     **do not schedule**.
2. **Theme.** Read that month's section of the planning doc for the headline, subject ideas,
   the featured spot and the closing line. Use its ideas, never its event dates. Look at the
   last two sent "Delray Drip" campaigns (`list_campaigns`, status sent) so the subject, hero
   photo and featured spot are not repeats.
3. **Events.** Read the calendar, then open each event's own page. Pick three this month that
   happen **on or after the 15th** and three next month. Prefer the signature events over store
   openings and trunk shows. Take from the page: exact date, time, place, link, a photo. Write
   each description yourself in one or two plain sentences.
4. **Write `email.json`.** Copy last month's as the starting point and remove its `feature`.
   Every event needs `start` (and `end` for more than one day), `url`, `image` and
   `"checked": "<today>"`, which says you read its page today. Body: two short paragraphs; the
   second links Casa Avenida (`https://casaavenidadelray.com/`) unless Matt names a different
   project. Subject at most 60 characters. Hero and spot pictures come from the photo library
   first.
5. **Build and look.**
   `python .claude/skills/making-the-delray-drip-email/build.py assets/email/delray-drip/<yyyy-mm> --check-links`
   It stops and says why if an event is over before the 15th, a slot is empty, the header is
   missing or the HTML is unbalanced. Open `preview.html` through the local server
   (CLAUDE.md §6) and read it top to bottom. A picture that crops badly: change its `image`,
   delete its file in the month folder, build again.
6. **Publish the images.** The email's pictures are served from the live site, so the month's
   folder must be on `main` before the draft is any use (CLAUDE.md §5; Matt's own changes go
   straight to `main` once checked). Build again with `--check-links`: every link must be OK.
   The site takes a minute or two to show new files.
7. **MailerLite draft.** `create_campaign`: name `Delray Drip <Month>`, type `regular`, the
   sender and groups above, and `content` = the whole of `email.html`, unchanged (about 55 KB;
   there is no shorter way). Never `editor: "simple"`. Later changes: `update_campaign` with the
   whole new `content`. The answer is too big to show and is saved to a file; check it:
   `python .claude/skills/making-the-delray-drip-email/compare.py assets/email/delray-drip/<yyyy-mm> "<saved result file>"`
8. **Test email.** The MailerLite connector cannot send a test. In Chrome, open the link from
   `get_dashboard_link` (resource_type `campaign`), click **Send a test**, change the address to
   `matthew@gvcrealestateteam.com`, click the dialog's Send, and wait for "Test email sent."
   That page also has a green **Send** at the bottom right that sends the real campaign: never
   click it. Dismiss the 2FA reminder with "Remind me later".
9. **Schedule, on Matt's OK only.** Give him the six events with their dates and anything you
   decided for him. Then `schedule_campaign`: delivery `scheduled`, date the 15th, hours `10`,
   minutes `00`, `timezone_id` 152 (America/New_York). Never `instant`. MailerLite answers in
   UTC: 14:00 in summer, 15:00 in winter. To change a scheduled email, `cancel_campaign` first,
   edit, test, schedule again.

## Drawing the header from figures

Karl's message gives last month's Palm Beach County figures: sold & closed, average days on
market, and the 30-year mortgage rate. So the November email shows October's figures. His
year-over-year numbers are not used; a days line like "(-56 days) compared to 79 last year
(-29 YOY)" means 56 days, 29% fewer than last year. Read the three figures back to Matt.

```
python .claude/skills/making-the-delray-drip-email/header.py assets/email/delray-drip/<yyyy-mm>/header-source.png \
  --sold 961 --sold-prev 1015 --days 56 --days-prev 60 --rate 7.27 --rate-prev 7.60 --compared "September 2026"
```

The `-prev` figures are the big numbers on the previous email's banner (`header.figures` in its
`email.json`, or its `header.png`), and `--compared` is the month those belong to. Set
`header.src` to the new file and record the figures in `header.figures` for next month.

**Replacing a picture after the draft exists** (a late header, a better photo): change its source
in `email.json`, delete the built file from the month folder, build, publish. The file name and
link are unchanged, so the draft picks it up by itself. Load the content again only when
`email.html` itself changed.

## A one-off block

When Matt wants something extra in one edition (an event invitation, a launch), add a `feature`
to that month's `email.json`: `heading`, `image`, `alt`, `url`, `button`, and `text` (a list of
paragraphs). It sits after the next-month events; `"position": "top"` puts it above the events.
For a designed image, make a version with no QR code and large type: a button carries the link,
and print-size text is unreadable at 540px wide. Take the facts and links from the job's own
folder (its HANDOFF note) and from Matt, not from memory. November 2026 has a worked example.

## What goes wrong

| Mistake | Instead |
|---|---|
| Copying events from the planning doc | Open each event page; the doc's dates are unreliable |
| Listing a "this month" event that is over by the 15th | Only events on or after the 15th; the build refuses the rest |
| Moving the send to a weekday | Always the 15th, 10:00 AM Eastern |
| Scheduling with the stand-in header | A placeholder build is for checking the rest only |
| Creating the draft before the images are on `main` | Push first, re-run `--check-links`, then create |
| Trusting that a 55 KB paste went in whole | Run `compare.py` on every create and update |
| Rebuilding the layout in MailerLite's editor | The layout is `template.html`; change it there |
| Editing `email.html` by hand | Change `email.json` and build again |
| Removing `{$name}`, `{$url}` or `{$unsubscribe}` | MailerLite fills these in; the build checks they are present |
| Worrying that MailerLite shows "Preheader: -" | The preview line is inside the HTML (`preheader` in `email.json`) |

## The template

`template.html` is the October 2026 email as MailerLite's own editor produced it, with the
changing parts turned into slots. The featured local spot is a live block (a photo, a name, two
sentences), not a designed image. A change to how every month looks goes in the template files;
then rebuild and compare against the last sent campaign.
