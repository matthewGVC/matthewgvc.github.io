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
  port: 47610,
  /* Asana: the gids aren't secret. The token (asanaToken) is the only private
     value and lives in the helper's own config.json. devPortfolios is filled
     in if the token can read them. */
  asana: {
    workspace: '1209165478401017',
    listings: { NYC: '1209188026968555', NJ: '1209188026968552', FL: '1209188026968549' },
    devs: ['1210736852899934', '1213810602302634', '1215033298674200', '1217076234712017'],
    devPortfolios: [],
    loose: ['1211384244337827', '1211306429530596', '1209322192180451'],
    people: '1209434796793215'
  }
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

/* The project address and its public key come from the site's own
   assets/js/supabase-config.js, so the helper and the pages never disagree. */
function siteSupabase() {
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'supabase-config.js'), 'utf8');
    const win = {};
    require('vm').runInNewContext(src, { window: win });
    return { supabaseUrl: win.GVC_SUPABASE.url, publishableKey: win.GVC_SUPABASE.publishableKey };
  } catch (e) { return {}; }
}

function loadConfig() {
  const dir = home(), file = path.join(dir, 'config.json');
  fs.mkdirSync(dir, { recursive: true });
  let saved = {};
  if (fs.existsSync(file)) saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!saved.pairCode) {
    saved.pairCode = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    fs.writeFileSync(file, JSON.stringify(Object.assign({}, DEFAULTS, saved), null, 2));
  }
  return Object.assign({}, DEFAULTS, siteSupabase(), saved, { home: dir });
}

module.exports = { loadConfig, home };
