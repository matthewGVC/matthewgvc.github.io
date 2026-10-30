---
name: operating-the-showsheet-generator
description: Use when asked to make, remake or rebuild a job's showsheet in the GVC Workspace repo (matthewgvc.github.io) by operating the Showsheet Generator from the job - filling its wording and facts, picking photos, asking the helper for the PDF, fixing the Drive link and, on Matt's OK, ticking "Create Show Sheet" in Asana. Also for the Errors page's M8 showsheet lines and any showsheet made before 2026, which Matt treats as out of date.
---

# Operating the Showsheet Generator

## Overview

You operate the generator the way Matt would: in the built-in browser, signed in as Matt, from the
job (`/tools/showsheet/?listing=<slug>`). You do not edit the tool's code, and you never make the
PDF yourself: **Make PDF** queues a `piece_requests` row and the desktop helper lays the sheet out,
draws it and saves it into the job's `Marketing\Showsheet\` folder (an older one of its own goes to
`Archive\` there). Matt reviews every sheet before Asana is touched.

Matt's rule (10-30): **any showsheet from before 2026 is out of date and is remade with the
generator.** The old file stays where it is.

Files beside this one:
- `lessons.md`: what earlier runs learned. Read it first; add to it after every job.

## Hard rules

- **Never type a password.** If the page shows a Sign in box, ask Matt to sign in on the browser pane.
- **Drive:** never delete, move or rename anything. The helper writes the sheet; you only read
  (`G:\Shared drives\...`). Deal paperwork (listing agreements, deal sheets, tax bills, anything
  `assets/js/drive-rules.js` calls paperwork) may be read, e.g. for a price or charges (Matt 10-30),
  but is never written, moved or changed.
- **Asana is written only on Matt's OK for that job** (D77): tick that job's "Create Show Sheet"
  subtask and nothing else, then log it in `docs/workspace-v2-status.md` under "One-off Asana
  writes" straight away (account swaps lose chat).
- **Never invent a number.** A price, charge, tax or assessment you can't confirm is left as found
  and named to Matt as unconfirmed. Wording may be rewritten; facts may not be guessed.
- **Change job facts through the workspace**, as Matt would: the job page's Facts and Agents cards,
  photo picks through `GVC_JP.save`, sheet fields in the generator. Raw SQL is only for reading, and
  for the one known link fix in step 7.

## The process

1. **Read `lessons.md`.** Find the job: Supabase `hoszxrrlfhzbbrzenqvp`, table `properties`
   (`slug`, `label`, `drive_folder`, `core`, `photo_hero`, `photo_order`, `scan->'pieces'`).
   The folder on disk is `G:\Shared drives\<drive_folder>`.
2. **Gather.** List the folder (names only). Read the old showsheet's wording (for a .docx:
   `word/document.xml`, tags stripped). Note the current price from the job, not the old sheet.
   Look at `Floorplan\` (an `Unbranded\` plan wins over a branded one; see lessons) and `Photos\`.
3. **Fix the job's facts on the job page** (`/workspace/job/?listing=<slug>`), Facts card:
   - Address: the full street ("15 East 69th Street"), as other jobs store it. The sheet prints the
     job's address; typing it on the sheet doesn't stick.
   - Neighborhood (prints on the back's tag), and anything else the old sheet proves.
   Agents card: the agents Matt wants on the sheet, in print order. **John Gasdaska goes before
   Katie Cook, always** (Matt 10-30).
4. **Photos.** The generator fills photos by itself only from an edited-photo folder
   (`Photos\Edited`, `Finals`, `Selects`...). Otherwise pick them: make a contact sheet of the best
   set (PIL, in the scratchpad), choose a strong wide living-room or hero shot first, then up to 11
   more, and save `photo_hero` + `photo_order` (paths inside the job folder, `/` separators) with
   `GVC_JP.save('properties', {id, version}, {photo_hero, photo_order}, [{field:'photo_order', old_value, new_value}])`
   from the job page. That is the same save the page's photo picker makes.
5. **Fill the generator** (`/tools/showsheet/?listing=<slug>`). Open every section. Set each field's
   value and fire `input` and `change` on it (`[data-field="..."]`):
   - `positioning`: one sentence, your own words, from the old description.
   - Numbers: `commonCharges` / `taxesMonthly` (condo) or `maintenance` (co-op), `maxFinancing`,
     `flipTax`, `assessments`; `baths` as "3.5" for 3 full + 1 half.
   - Building: `building.builtYear`, `stories`, `residences`, `service`, `policy`, `amenities` (one per line).
   - Residence: `residence.exposures`, `ceiling`, `climate`, `outdoor`, `features` (one per line, about 10, short).
   - Check Ownership (Co-op / Condo) and Market are right.
   Widen the pane to 1400 px (`resize_window`) to see the preview; put it back to desktop when done.
   The preview shows no photos or plan when Drive isn't connected in the pane. That is fine: the
   helper reads them. **Save sheet**, and wait for "Saved."
6. **Make PDF.** Wait for the bar to say "Made: <name> is in the job's folder." If it sits on
   "Waiting for the helper" for more than a minute, see lessons (restart the helper).
7. **Check the PDF and fix its link.** Render both pages (PyMuPDF, 110 dpi, scratchpad) and look at
   them: header, price, beds/baths, photo, plan, numbers, agents, no overflow. Then read the file's
   real Drive id from its `:user.drive.id` stream (PowerShell
   `Get-Content -LiteralPath <file> -Stream user.drive.id`). If `documents.output.url` holds a
   `local-…` id, set it to the real one (update only that row's `output.url`, and only where it
   still says `local-`).
8. **Show Matt** the link and two pictures' worth of description, what you changed on the job, and
   every number you could not confirm. Wait for his verdict. Adjust and **Make PDF** again if he
   asks (the helper archives the older one). On "good to go", tick "Create Show Sheet" (a subtask
   of the job's Asana task, `properties.asana_gid`) and log it.
9. **Add to `lessons.md`** whatever this job taught.
