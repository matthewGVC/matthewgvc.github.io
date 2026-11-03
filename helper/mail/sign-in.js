/* ============================================================
   GMAIL SIGN-IN — once, so the helper can send the Sunday email.

     node helper/mail/sign-in.js [client.json]

   Uses the GVC Helper project's "Desktop app" OAuth client (the one the
   budget sign-in uses; default <helper home>\google-client.json). Google's
   page opens: sign in as helper@gvcrealestateteam.com and allow "Send email
   on your behalf". The refresh token goes to <helper home>\google-mail.json
   (gmail.js reads it). Restart the helper afterwards.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { authUrl, exchange, listen } = require('../budget/sign-in.js');
const { SCOPE, mailFile } = require('./gmail.js');

const b64url = buf => buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function main(file) {
  const cfg = require('../config.js').loadConfig();
  const raw = JSON.parse(fs.readFileSync(file || path.join(cfg.home, 'google-client.json'), 'utf8'));
  const client = raw.installed || raw;
  if (!client.client_id) throw new Error('That isn\'t a "Desktop app" OAuth client file.');
  const verifier = b64url(crypto.randomBytes(32)), state = b64url(crypto.randomBytes(16));
  const { redirect, code: codeP } = await listen(state);
  const url = authUrl({ clientId: client.client_id, redirect, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), state,
    scope: SCOPE, hint: 'helper@gvcrealestateteam.com' });
  console.log('Opening Google: sign in as helper@gvcrealestateteam.com and allow sending email. If no browser opens, visit:\n' + url);
  require('child_process').spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();
  const saved = await exchange({ client, code: await codeP, verifier, redirect, fetch: globalThis.fetch, scope: SCOPE });
  fs.writeFileSync(mailFile(cfg), JSON.stringify(saved, null, 2), { mode: 0o600 });
  console.log('Saved to ' + mailFile(cfg) + '. Restart the helper so the Sunday email starts.');
}

if (require.main === module) main(process.argv[2]).catch(e => { console.log(e.message); process.exit(1); });
