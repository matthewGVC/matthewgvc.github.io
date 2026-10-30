# GVC helper

A small program that runs on Matt's desktop PC and does the jobs a browser can't
(workspace v2 plan §4): it reads Douglas Elliman's team page for listing statuses,
and it saves finished PDFs straight into Drive folders, and it makes a job's pieces on request. The workspace reaches it at
`http://127.0.0.1:47610`. It answers only the workspace's own web address, and only
from a browser that has been paired with it once.

## Pieces made from a job (migration 0017)

Make / Rebuild on a job page (from any device) adds a row to `piece_requests`. The helper
(`piece-build.js`) checks every 15 seconds, and at once when a paired browser here calls
`POST /pieces/run`: it claims the oldest waiting request, reads the job and the piece's record,
reads the job folder itself (Floorplan, Photos and Marketing only; never paperwork), opens the
piece's own page in its hidden browser to lay it out (`pdf/lay.js`), draws it (`pdf/render.js`),
writes it into the folder (never overwriting; its own older file to `Archive\`) and records it
with `save_piece_build`. A request it can't make is marked failed with the reason, which the job
page shows. While the helper is off, requests wait. `POST /job-tree` and `POST /job-file` let a
piece page on this PC read its photos through the helper. Run migration 0017 before starting this
code (until then the helper waits quietly). Pages are loaded from `siteBase` (the live site), so
the matching site code must be on `main`.

## Install (once per PC)

```bash
cd helper
npm install
node install-browser.js
node pair.js
powershell -ExecutionPolicy Bypass -File install-task.ps1
```

`pair.js` prints a six-digit code to type into the workspace's "Pair" box.
`install-task.ps1` adds the Task Scheduler task **GVC Helper**, which starts the helper
hidden at every log on and restarts it if it stops. Run it from the main repo folder.

## Where its files live

- Settings, pairing code, caches: `%USERPROFILE%\.gvc-helper\` (never in this repo). Not under
  AppData: Windows gives the Claude desktop app its own private copy of AppData.
- Log: `%USERPROFILE%\.gvc-helper\helper.log`.
- DE dry-run reports: `exports/de-dry-run-<date>.md` (gitignored).
- Asana (read-only, never written to): `node helper/asana-sync.js --plan` writes the first link plan,
  `exports/asana-link-plan-<date>.md`, for Matt to tick; `--apply-plan <that file>` makes the jobs;
  `--write` is one sync after that. Needs `asanaToken` in the helper's config.
- Development budgets (read-only, D113): the helper reads each linked pro-forma sheet every hour as
  Matt. Sign in once with `node helper/budget/sign-in.js <client.json>` (the "GVC Helper budget read"
  Desktop app client from Google Cloud); it saves `%USERPROFILE%\.gvc-helper\google-auth.json`. Restart
  the helper afterwards. If the sign-in expires, run the command again.
- Real DE recordings: `helper/fixtures/recorded/` (gitignored). The repo's tests use the
  made-up `helper/fixtures/synthetic/`.

## Stop or remove

Stop: end the `node.exe` running `helper\server.js` in Task Manager (it comes back at the
next log on). Remove: `powershell -ExecutionPolicy Bypass -File install-task.ps1 -Uninstall`.

## Tests

`node scripts/test-helper-server.js`, `node scripts/test-de-sync.js`, `node scripts/test-pdf-name.js`, `node scripts/test-de-apply.js`,
`node scripts/test-asana-allow.js`, `node scripts/test-asana-sync.js`, `node scripts/test-budget.js`,
`node scripts/test-asana-map.js`, `node scripts/test-asana-posts.js`, `node scripts/test-helper-db.js`,
`node scripts/test-pdf-render.js`, `node scripts/test-scan.js`, `node scripts/test-seed.js`,
`node scripts/test-piece-build.js` (with `BASE=http://localhost:8080` it also lays out and draws real pages).
