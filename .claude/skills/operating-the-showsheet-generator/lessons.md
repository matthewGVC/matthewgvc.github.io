# Lessons from earlier showsheet runs

Add a dated line after each job. Newest last.

## 2026-10-30, 15 E69 5A (first run)
- **Sign-in:** the generator and job page need Matt signed in on the browser pane. The sign-in
  persists in the pane after that.
- **Address:** the sheet's Address field is overwritten by the job's `core.address` on every load.
  Change it on the job page's Facts card ("15 E69" → "15 East 69th Street").
- **Photos:** this folder had `Photos\ORIGINALS` and `Photos\TOUCHED-UP - Less Exposure\Print`, no
  edited-photo folder, so the scan found no photos. Picks set from the touched-up Print set.
- **Helper not taking requests:** the helper was listening on 47610 but its log had no "Piece
  requests on" line, and requests sat on "waiting". Restarting it (stop the "GVC Helper" task, end
  its node process, start the task) fixed it within a minute. Check the log line after any restart.
- **Link bug:** the helper saved `output.url` as `https://drive.google.com/file/d/local-NNNNNN/view`
  (Drive for Desktop's id before the upload finishes; `helper/drive-link.js` accepts it). The real id
  is in the file's `user.drive.id` stream a minute later. Fixed by hand on both 15 E69 builds; a code
  fix is still to do.
- **Floorplan band:** a branded plan with a coloured header band shows the band's fade at the top of
  the sheet's plan. Matt: normally make the Unbranded plan first with the making-gvc-floorplans skill
  (the pipeline will always make both); this time it was left.
- **Agents:** the sheet prints the job's agents. Matt added Jonathan Conlon beside John Gasdaska.
- **Old wording:** a Corcoran-era sheet's description, quick facts and feature lists gave the
  positioning line, residence features and building facts. Its price was out of date (the job's
  price wins). Its common charges and taxes (2024) were used and named as unconfirmed.

## 2026-10-30, 241 E76 10BCD and 400 Fifth 32C
- **2026 sheets can still be out of date.** 241 E76's May sheet had an old price and an agent who had
  left; Matt wanted it remade. 400 Fifth's March sheet was right, but Matt wanted the new design
  anyway, even off market. Default: remake, and show Matt what changed.
- **File names lie.** 400 Fifth's sheet was saved as "37C"; the sheet itself said 32C. Read the
  sheet, not the name.
- **The helper saves into the folder that's already there** (`Show Sheet\`, `Showsheet\` at the job's
  top), beside the old files, which it leaves alone.
- **Reload the job page between saves.** After a `GVC_JP.save` from the console, the page still holds
  the old version, and its next card save (Agents) fails as a conflict without saying so. Reload,
  then use the card.
- **No agents on the job** (agent left): Matt put John Gasdaska on alone (400 Fifth).
- **Staged photos:** a "VIRTUALLY STAGED" mark at the corner of a photo can be cropped off by the
  sheet's frame. Tell Matt when a staged photo is used.
- **Job facts sometimes don't reach the sheet's Building fields** (241 E76: stories, residences and
  climate came up empty though the saved sheet had them). Check every field after load, before Save.

## 2026-10-30, 565 West End Ave 10E
- **"Drive hasn't downloaded X" can be wrong.** The helper said it for a plan in a `Floor plans\`
  folder; the real reason was that the helper only read `Floorplan(s)\`. Fixed in `helper/pdf/lay.js`
  (034bac8, helper restarted). If the message comes back for a file that is on disk (`ls` shows its
  size, `cat` reads it), check `readJobFile`'s folder rule before blaming Drive.
- **Online-only files:** reading a file once (`cat file > /dev/null`) makes Drive download it.
- **404 Park Ave South 6A and 52 E4 10FL** went to the questions for Jonathan and Ayuen (28, 29):
  sale vs rental and prices didn't agree. When the job itself is unclear, ask, don't make.
- **Agent order (Matt, 10-30): when it's John and Katie, John always goes first.** The sheet prints
  the job's agents in order; fix the order on the job page's Agents card (↑), then Make PDF again.
- **Clearing the Errors line after a tick:** the 30-minute Asana sync only re-reads tasks changed
  since the last run, and ticking a subtask doesn't count, so the M8 line stays until the 3:00 full
  read. To clear it now: `node helper/asana-sync.js --write --full` (reads Asana, writes only the
  workspace; about a minute).
