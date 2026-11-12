---
name: making-the-delray-drip-email
description: Use when asked to make, build, draft or schedule the monthly Delray Drip email (the "Coastal Living Delray" newsletter, the Delray Drip Campaign in MailerLite that goes out on the 15th), or when Matt says this month's Delray header is in its folder.
---

# Making the Delray Drip email

One email a month to the Delray list: a market banner, a short note, three events left this month,
three next month, a featured local spot. Matt makes **only the header** (the "How's the Market?"
banner). Everything else is yours: find the events, write the copy, pick the pictures, build the
email, load it into MailerLite as a draft, and schedule it once Matt has seen it.

**The one rule that matters: every event's date comes from its own page, read today.** The planning
doc's event lists are often wrong, and a wrong date in 290 inboxes cannot be taken back.

## Where things are

| What | Where |
|---|---|
| Month's content and images | `assets/email/delray-drip/<yyyy-mm>/` (`email.json`, built `email.html`, `preview.html`) |
| Builder and template | this folder: `build.py`, `template*.html` |
| Matt's header | `G:\Shared drives\GVC - Marketing\02 - Assets\Emails\Delray Drip Campaign\<Month yy>\` (e.g. `November 26`) |
| Photo library (hero, spot) | same Drive folder, `Delray Photos\Delray Photos- Horizontal\` |
| Planning doc (themes, subject ideas, spots) | Google Doc `1WDbklzsgcnqyHrM0qy-utr5mXXzqx2-QCaEON270DT8`, one section per month |
| Events | `https://downtowndelraybeach.com/events/calendar`, each event at `/do/<slug>` |
| MailerLite | sender `info@gvcrealestateteam.com`, name `GVC Real Estate Team`; groups `170238093485409379` (Delray Drip Campaign) and `169447831118021824` (GVC Subscribers (NEW)) |

## Steps

1. **Send date.** The 15th at 14:00 account time. When the 15th is a Saturday or Sunday, the Friday
   before. `build.py` prints it.
2. **Header.** Look in the month's Drive folder. If it is empty, do everything else with
   `"header": {"placeholder": true}`, tell Matt the header is missing, and **do not schedule**.
3. **Theme.** Read that month's section of the planning doc for the headline, subject ideas, the
   featured spot and the closing line. Use its ideas, never its event dates. Check the last two
   sent "Delray Drip" campaigns (`list_campaigns`, status sent) so the subject, hero photo and
   featured spot are not repeats.
4. **Events.** Read the calendar, then open each event's own page. Pick three this month that
   happen **on or after the send date** and three next month. Prefer the signature events over
   store openings and trunk shows. Take from the page: exact date, time, place, link, a photo.
   Write each description yourself in one or two plain sentences.
5. **Write `email.json`.** Copy last month's as the starting point. Every event needs `start`
   (and `end` for more than one day), `url`, `image` and `"checked": "<today>"`, which says you
   read its page today. Body: two short paragraphs; the second links Casa Avenida
   (`https://casaavenidadelray.com/`) unless Matt names a different project. Subject at most
   60 characters. Hero and spot pictures come from the photo library first.
6. **Build and look.**
   `python .claude/skills/making-the-delray-drip-email/build.py assets/email/delray-drip/<yyyy-mm> --check-links`
   It stops and says why if an event is already over, a slot is empty or the header is missing.
   Open `preview.html` through the local server (CLAUDE.md §6) and read it top to bottom at
   760px and at phone width. Pictures that crop badly: change the `image`, add `--refresh-images`.
7. **Publish the images.** The email's pictures are served from the live site, so the month's
   folder must be on `main` before the draft is any use. Follow CLAUDE.md §5 (Matt's own changes
   go straight to `main` once checked). Then run the build again with `--check-links`: every link
   must be OK.
8. **MailerLite draft.** `create_campaign`: name `Delray Drip <Month>`, type `regular`, the
   sender and groups above, and `content` = the whole of `email.html`, unchanged. To change a
   draft later use `update_campaign` with the new `content`. Do not pass `editor: "simple"`.
   Open the draft's preview and compare it with `preview.html`.
9. **Show Matt, then schedule.** Give him the preview link and the six events with their dates.
   Only on his OK: `schedule_campaign`, delivery `scheduled`, the send date, hours `14`,
   minutes `00`. Never `instant`.

## What goes wrong

| Mistake | Instead |
|---|---|
| Copying events from the planning doc | Open each event page; the doc's dates are unreliable |
| Listing a "this month" event that is over by the 15th | Only events on or after the send date; the build refuses the rest |
| Scheduling with the stand-in header | A placeholder build is for checking the rest only |
| Creating the draft before the images are on `main` | Push first, re-run `--check-links`, then create |
| Rebuilding the layout in MailerLite's editor | The layout is `template.html`; change it there |
| Editing `email.html` by hand | Change `email.json` and build again |
| Removing `{$name}`, `{$url}` or `{$unsubscribe}` | MailerLite fills these in; the build checks they are present |

## The template

`template.html` is the October 2026 email as MailerLite's own editor produced it, with the changing
parts turned into slots. The featured local spot is a live block (a photo, a name, two sentences),
not a designed image. A change to how every month looks goes in the template files, then rebuild
and compare against the last sent campaign.
