/* ============================================================
   HELPER CONFIG — the desktop helper's settings, kept OUTSIDE the repo.

   Lives in %USERPROFILE%\.gvc-helper\config.json (or $GVC_HELPER_HOME, used by
   tests). Created on first use with a random six-digit pairing code. The
   repo is public: never copy this file, its pairing code or (from Slice 1)
   the helper account's password into it.

     const cfg = loadConfig();   // { home, pairCode, siteBase, teamUrl, outputRoots, port }
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path'), crypto = require('crypto');

const DEFAULTS = {
  siteBase: 'https://matthewgvc.github.io',
  teamUrl: 'https://www.elliman.com/team/gvc-real-estate-team/226645',
  outputRoots: ['G:\\My Drive\\GVC Workspace Lab'],
  port: 47610
};

/* Not under AppData: Windows gives packaged apps (the Claude desktop app) a
   private copy of AppData, so a pairing code written from there never reached
   the real helper (2026-10-19). The user folder itself isn't virtualised. */
function home() {
  return process.env.GVC_HELPER_HOME || path.join(require('os').homedir(), '.gvc-helper');
}

/* Playwright's browser lives in the helper's home as well (the default,
   AppData\Local\ms-playwright, has the same private-copy problem). Set on
   load, before anything requires playwright. Install it with
   `node helper/install-browser.js`. */
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(home(), 'browsers');

function loadConfig() {
  const dir = home(), file = path.join(dir, 'config.json');
  fs.mkdirSync(dir, { recursive: true });
  let saved = {};
  if (fs.existsSync(file)) saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!saved.pairCode) {
    saved.pairCode = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    fs.writeFileSync(file, JSON.stringify(Object.assign({}, DEFAULTS, saved), null, 2));
  }
  return Object.assign({}, DEFAULTS, saved, { home: dir });
}

module.exports = { loadConfig, home };
