# GVC helper

A small program that runs on Matt's desktop PC and does the jobs a browser can't
(workspace v2 plan §4): it reads Douglas Elliman's team page for listing statuses,
and it saves finished PDFs straight into Drive folders. The workspace reaches it at
`http://127.0.0.1:47610`. It answers only the workspace's own web address, and only
from a browser that has been paired with it once.

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
- Real DE recordings: `helper/fixtures/recorded/` (gitignored). The repo's tests use the
  made-up `helper/fixtures/synthetic/`.

## Stop or remove

Stop: end the `node.exe` running `helper\server.js` in Task Manager (it comes back at the
next log on). Remove: `powershell -ExecutionPolicy Bypass -File install-task.ps1 -Uninstall`.

## Tests

`node scripts/test-helper-server.js`, `node scripts/test-de-sync.js`, `node scripts/test-pdf-name.js`, `node scripts/test-de-apply.js`,
`node scripts/test-asana-allow.js`, `node scripts/test-asana-sync.js`.
