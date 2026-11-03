/* ============================================================
   GMAIL — the helper sends the Sunday email from Matt's Google account
   (overhaul step 3, docs/overhaul-plan.md). helper@ is only the helper's
   database login, not a mailbox (11-03); mailFrom in the helper's config
   names another account if one is made.

   `node helper/mail/sign-in.js` stores a refresh token for one permission,
   gmail.send ("Send email on your behalf"), in the helper's home
   (%USERPROFILE%\.gvc-helper\google-mail.json, or googleMailFile in its
   config), never in the repo. It can't read the mailbox. The tokens are
   never logged.

     const mail = createMail(cfg, { fetch, now? })
     mail.ready()                           → true once the sign-in file is there
     await mail.send({ to, subject, html }) → Gmail's message id
     mime({ from, to, subject, html, replyTo }) → the raw message (tested); replies go to Matt
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SENDER = 'matthew@gvcrealestateteam.com';   // the account signed in by sign-in.js
const FROM = 'GVC Workspace <' + SENDER + '>';
const REPLY_TO = 'matthew@gvcrealestateteam.com';   // a reply reaches Matt, not the helper's mailbox

function mailFile(cfg) { return cfg.googleMailFile || path.join(cfg.home || '', 'google-mail.json'); }
const b64url = s => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
// a header with anything past plain ASCII (the subject's "·") goes as encoded UTF-8
const header = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s).toString('base64') + '?=';

function mime(m) {
  const to = [].concat(m.to).join(', ');
  return ['From: ' + (m.from || FROM), 'To: ' + to, 'Reply-To: ' + (m.replyTo || REPLY_TO), 'Subject: ' + header(m.subject), 'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    Buffer.from(m.html).toString('base64').replace(/(.{76})/g, '$1\r\n')].join('\r\n');
}

function createMail(cfg, opts) {
  const doFetch = (opts && opts.fetch) || globalThis.fetch;
  const clock = (opts && opts.now) || (() => Date.now());
  let token = null;
  const ready = () => fs.existsSync(mailFile(cfg));

  async function call(url, init) {
    try { return await doFetch(url, Object.assign({ signal: AbortSignal.timeout(30000) }, init)); }
    catch (e) { throw new Error(e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'Google didn\'t answer in time' : 'Google couldn\'t be reached'); }
  }
  async function signIn() {
    if (token && token.until > clock() + 60000) return token.value;
    const a = JSON.parse(fs.readFileSync(mailFile(cfg), 'utf8'));
    const r = await call(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: a.client_id, client_secret: a.client_secret, refresh_token: a.refresh_token }).toString() });
    if (!r.ok) throw new Error('The helper\'s Gmail sign-in has expired or was removed. Run node helper/mail/sign-in.js again.');
    const j = await r.json();
    token = { value: j.access_token, until: clock() + (Number(j.expires_in) || 3600) * 1000 };
    return token.value;
  }
  async function send(m) {
    const r = await call(SEND_URL, { method: 'POST', headers: { authorization: 'Bearer ' + await signIn(), 'content-type': 'application/json' },
      body: JSON.stringify({ raw: b64url(mime(Object.assign({ from: cfg.mailFrom ? 'GVC Workspace <' + cfg.mailFrom + '>' : FROM }, m))) }) });
    if (!r.ok) {
      // Google's own sentence says what to fix (an API switched off, a permission missing)
      let why = ''; try { why = ((await r.json()).error || {}).message || ''; } catch (e) { /* not JSON */ }
      if (/has not been used|is disabled/.test(why)) throw new Error('Gmail is switched off in the GVC Helper Google project: enable the Gmail API there, then try again.');
      throw new Error('Gmail answered ' + r.status + ' when sending' + (why ? ': ' + why.split('. ')[0] : ''));
    }
    return (await r.json()).id;
  }
  return { ready, send };
}

module.exports = { createMail, mime, mailFile, SCOPE, FROM, SENDER };
