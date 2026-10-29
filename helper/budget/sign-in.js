/* ============================================================
   GOOGLE SIGN-IN — once, so the helper can read pro-forma sheets as Matt (D113).

     node helper/budget/sign-in.js <client.json>

   <client.json> is the "Desktop app" OAuth client downloaded from the GVC
   Helper project in Google Cloud. The browser opens Google's consent page
   for one permission, "See all your Google Sheets spreadsheets" (read-only);
   Google answers on a one-time local address and the refresh token is saved
   to the helper's home (google-auth.json, sheets.js reads it). Restart the
   helper afterwards so its hourly budget read starts. Nothing is printed but
   the address to open and where the file went.

     authUrl({ clientId, redirect, challenge, state })  → Google's consent page
     exchange({ client, code, verifier, redirect, fetch }) → { client_id, client_secret, refresh_token }
   ============================================================ */
'use strict';

const fs = require('fs'), http = require('http'), crypto = require('crypto');
const { SCOPE, TOKEN_URL, authFile } = require('./sheets.js');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const b64url = buf => buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function authUrl(o) {
  return AUTH_URL + '?' + new URLSearchParams({ client_id: o.clientId, redirect_uri: o.redirect, response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent', code_challenge: o.challenge, code_challenge_method: 'S256', state: o.state }).toString();
}

async function exchange(o) {
  const r = await o.fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: o.code, code_verifier: o.verifier, redirect_uri: o.redirect,
      client_id: o.client.client_id, client_secret: o.client.client_secret }).toString() });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) throw new Error('Google didn\'t give the helper a sign-in. Try again.');
  if (j.scope && j.scope.split(' ').indexOf(SCOPE) === -1) throw new Error('Google gave a different permission than read-only Sheets. Try again and allow it.');
  return { client_id: o.client.client_id, client_secret: o.client.client_secret, refresh_token: j.refresh_token };
}

/* a one-time local address for Google to come back to → { redirect, code: Promise<code> } */
function listen(state) {
  return new Promise((started, failed) => {
    let done;
    const code = new Promise((res, rej) => { done = { res, rej }; });
    const server = http.createServer((req, res) => {
      const q = new URL(req.url, 'http://127.0.0.1').searchParams;
      if (!q.has('code') && !q.has('error')) { res.writeHead(404).end(); return; }
      const ok = q.get('state') === state && q.has('code');
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(ok ? 'Signed in. You can close this tab.' : 'Sign-in didn\'t finish. Close this tab and try again.');
      server.close();
      if (ok) done.res(q.get('code'));
      else done.rej(new Error(q.get('error') === 'access_denied' ? 'The permission was declined.' : 'Sign-in didn\'t finish.'));
    });
    server.on('error', failed);
    server.listen(0, '127.0.0.1', () => started({ redirect: 'http://127.0.0.1:' + server.address().port, code }));
  });
}

async function main(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const client = raw.installed;
  if (!client || !client.client_id) throw new Error('That isn\'t a "Desktop app" OAuth client file.');
  const cfg = require('../config.js').loadConfig();
  const verifier = b64url(crypto.randomBytes(32)), state = b64url(crypto.randomBytes(16));
  const { redirect, code: codeP } = await listen(state);
  const url = authUrl({ clientId: client.client_id, redirect, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), state });
  console.log('Opening Google to allow read-only access to Sheets. If no browser opens, visit:\n' + url);
  require('child_process').spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
  const code = await codeP;
  const saved = await exchange({ client, code, verifier, redirect, fetch: globalThis.fetch });
  fs.writeFileSync(authFile(cfg), JSON.stringify(saved, null, 2), { mode: 0o600 });
  console.log('Saved to ' + authFile(cfg) + '. Restart the helper so the hourly budget read starts.');
}

if (require.main === module) {
  if (!process.argv[2]) { console.log('Usage: node helper/budget/sign-in.js <client.json>'); process.exit(1); }
  main(process.argv[2]).catch(e => { console.log(e.message); process.exit(1); });
}

module.exports = { authUrl, exchange };
