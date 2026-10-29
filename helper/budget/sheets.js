/* ============================================================
   GOOGLE SHEETS CLIENT — the helper's read-only door into a pro-forma sheet.

   It reads as Matt (D113): `node helper/budget/sign-in.js` stores a refresh
   token for the spreadsheets.readonly scope in the helper's home
   (%USERPROFILE%\.gvc-helper\google-auth.json, or googleAuthFile in its
   config), never in the repo. Google itself refuses any change with that
   scope. The one request that isn't a read is the token refresh; the tokens
   are never logged.

     const sheets = createSheets(cfg, { fetch, now? })
     sheets.ready()                   → true once the sign-in file is there
     await sheets.tabs(id)            → { title, tabs: [tab title] }
     await sheets.grid(id, tab)       → the tab's cells as rows (formatted dates)

   Errors are plain sentences: "Google sign-in has expired…", "Matt's Google
   account can't open this sheet…", "Google couldn't be reached", "Google
   didn't answer in time".
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function authFile(cfg) { return cfg.googleAuthFile || path.join(cfg.home || '', 'google-auth.json'); }

function createSheets(cfg, opts) {
  const doFetch = (opts && opts.fetch) || globalThis.fetch;
  const clock = (opts && opts.now) || (() => Date.now());
  let token = null;

  const ready = () => fs.existsSync(authFile(cfg));
  const plain = message => new Error(message);

  async function call(url, init) {
    try { return await doFetch(url, Object.assign({ signal: AbortSignal.timeout(30000) }, init)); }
    catch (e) { throw plain(e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'Google didn\'t answer in time' : 'Google couldn\'t be reached'); }
  }

  async function signIn() {
    if (token && token.until > clock() + 60000) return token.value;
    const a = JSON.parse(fs.readFileSync(authFile(cfg), 'utf8'));
    const r = await call(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: a.client_id, client_secret: a.client_secret, refresh_token: a.refresh_token }).toString() });
    if (!r.ok) throw plain('Google sign-in has expired or was removed. Run node helper/budget/sign-in.js again.');
    const j = await r.json();
    token = { value: j.access_token, until: clock() + (Number(j.expires_in) || 3600) * 1000 };
    return token.value;
  }

  async function get(url) {
    const r = await call(url, { headers: { authorization: 'Bearer ' + await signIn(), accept: 'application/json' } });
    if (r.ok) return r.json();
    if (r.status === 403 || r.status === 404) throw plain('Matt\'s Google account can\'t open this sheet. Check the link, or that the sheet still exists.');
    throw plain('Google answered ' + r.status + ' for the sheet');
  }

  async function tabs(id) {
    const j = await get(API + encodeURIComponent(id) + '?fields=properties.title,sheets.properties.title');
    return { title: (j.properties && j.properties.title) || null, tabs: (j.sheets || []).map(s => s.properties.title) };
  }

  async function grid(id, tab) {
    const range = encodeURIComponent("'" + tab.replace(/'/g, "''") + "'");
    const j = await get(API + encodeURIComponent(id) + '/values/' + range + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING');
    return j.values || [];
  }

  return { ready, tabs, grid };
}

module.exports = { createSheets, authFile, SCOPE, TOKEN_URL };
