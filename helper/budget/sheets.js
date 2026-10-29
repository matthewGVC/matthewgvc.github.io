/* ============================================================
   GOOGLE SHEETS CLIENT — the helper's read-only door into a pro-forma sheet.

   It signs in as a Google service account (D113): the key file lives in the
   helper's home (%USERPROFILE%\.gvc-helper\google-key.json, or googleKeyFile
   in its config), never in the repo, and the account sees only the sheets
   shared with it as Viewer. The scope asked for is spreadsheets.readonly, so
   Google itself refuses any change. The one request that isn't a read is the
   sign-in (the token exchange); the key and the token are never logged.

     const sheets = createSheets(cfg, { fetch, now? })
     sheets.ready()                   → true once the key file is there
     await sheets.tabs(id)            → { title, tabs: [tab title] }
     await sheets.grid(id, tab)       → the tab's cells as rows (formatted dates)

   Errors are plain sentences: "Google refused the service account", "This
   sheet isn't shared with the helper's Google account (…)", "Google couldn't
   be reached", "Google didn't answer in time".
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path'), crypto = require('crypto');

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const b64url = s => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function keyFile(cfg) { return cfg.googleKeyFile || path.join(cfg.home || '', 'google-key.json'); }

function createSheets(cfg, opts) {
  const doFetch = (opts && opts.fetch) || globalThis.fetch;
  const clock = (opts && opts.now) || (() => Date.now());
  let token = null;

  const ready = () => fs.existsSync(keyFile(cfg));
  const readKey = () => JSON.parse(fs.readFileSync(keyFile(cfg), 'utf8'));
  const plain = message => new Error(message);

  async function call(url, init) {
    try { return await doFetch(url, Object.assign({ signal: AbortSignal.timeout(30000) }, init)); }
    catch (e) { throw plain(e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'Google didn\'t answer in time' : 'Google couldn\'t be reached'); }
  }

  async function signIn() {
    if (token && token.until > clock() + 60000) return token.value;
    const key = readKey();
    const iat = Math.floor(clock() / 1000);
    const body = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
      b64url(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
    const sig = crypto.createSign('RSA-SHA256').update(body).sign(key.private_key, 'base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const r = await call(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: body + '.' + sig }).toString() });
    if (!r.ok) throw plain('Google refused the service account');
    const j = await r.json();
    token = { value: j.access_token, until: clock() + (Number(j.expires_in) || 3600) * 1000 };
    return token.value;
  }

  async function get(url) {
    const r = await call(url, { headers: { authorization: 'Bearer ' + await signIn(), accept: 'application/json' } });
    if (r.ok) return r.json();
    if (r.status === 403 || r.status === 404) {
      throw plain('This sheet isn\'t shared with the helper\'s Google account (' + readKey().client_email + '). Share it as Viewer.');
    }
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

module.exports = { createSheets, SCOPE };
