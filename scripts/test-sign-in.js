/* ============================================================
   Tests for per-person sign-in (workspace v2 D3) in
   assets/js/property-library.js:

     signIn(email, password)   a person's own account
     signIn(password)          the shared team account, as before
     whoAmI()                  name + initials from the members table
     askSignIn(reason)         the shared dialog every tool uses

   Part 1 runs in plain Node with Supabase mocked. Part 2 opens the To-do
   tool in Chromium (Supabase mocked by request interception) and uses the
   dialog the way a person would. Needs a static server for part 2:
     BASE=http://localhost:8080 node scripts/test-sign-in.js
   ============================================================ */
'use strict';

const path = require('path'), fs = require('fs');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const URL_ = 'https://example.supabase.co';
const calls = [];
let membersReply = [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }];
function reply(status, body) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
}
global.GVC_SUPABASE = { url: URL_, publishableKey: 'pk', teamEmail: 'team@example.com' };
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.fetch = (url, opts) => {
  const body = opts && opts.body ? JSON.parse(opts.body) : null;
  calls.push({ url, method: (opts && opts.method) || 'GET', body });
  if (/\/auth\/v1\/token/.test(url)) {
    if (body.password !== 'right') return reply(400, { error_description: 'Invalid login credentials' });
    return reply(200, { access_token: 'tok-' + body.email, refresh_token: 'r', expires_in: 3600 });
  }
  if (/\/auth\/v1\/user/.test(url)) return reply(200, { id: 'u-1', email: 'matt@example.com' });
  if (/\/rest\/v1\/members/.test(url) && membersReply === 'fail') return reply(400, { message: 'could not read' });
  if (/\/rest\/v1\/members/.test(url)) return membersReply === 404 ? reply(404, { message: 'relation "members" does not exist' }) : reply(200, membersReply);
  return reply(404, {});
};

const P = require('../assets/js/property-library.js');

(async () => {
  /* ---------- part 1: the library ---------- */
  await P.signIn('right');
  check('one argument = the team account', calls.pop().body.email, 'team@example.com');
  await P.signIn('matt@example.com', 'right');
  check('two arguments = that person', calls.pop().body.email, 'matt@example.com');
  await P.signIn('', 'right');
  check('empty email = the team account', calls.pop().body.email, 'team@example.com');
  let err = null;
  try { await P.signIn('matt@example.com', 'wrong'); } catch (e) { err = e.message; }
  check('wrong password says why', err, 'Invalid login credentials');

  await P.signIn('matt@example.com', 'right');
  check('who am I', await P.whoAmI(), { email: 'matt@example.com', name: 'Matt Bloomfield', initials: 'MB', role: 'owner' });
  membersReply = [];
  P.signOut(); await P.signIn('matt@example.com', 'right');
  check('not a member yet', await P.whoAmI(), { email: 'matt@example.com', name: 'matt@example.com', initials: 'MA', role: null });
  // B5-fix: a members read that fails is not "not a member": it says it couldn't check, and isn't kept
  membersReply = 'fail';
  P.signOut(); await P.signIn('matt@example.com', 'right');
  check('members read failed: initials still work, role unknown, flagged', await P.whoAmI(),
    { email: 'matt@example.com', name: 'matt@example.com', initials: 'MA', role: null, checkFailed: true });
  membersReply = [{ name: 'Matt Bloomfield', initials: 'MB', role: 'owner' }];
  check('a failed check is not kept: the next ask reads again', (await P.whoAmI()).role, 'owner');
  membersReply = [];
  P.signOut(); await P.signIn('matt@example.com', 'right');
  check('a true empty answer is not flagged', 'checkFailed' in (await P.whoAmI()), false);
  membersReply = 404;
  P.signOut(); await P.signIn('matt@example.com', 'right');
  check('before the migration', (await P.whoAmI()).initials, 'MA');
  P.signOut(); global.fetch = ((orig) => (url, o) => /auth\/v1\/user/.test(url) ? reply(200, { id: 'u-2', email: 'm.1@example.com' }) : orig(url, o))(global.fetch);
  await P.signIn('m.1@example.com', 'right');
  check('initials are letters only', (await P.whoAmI()).initials, 'M');
  check('askSignIn exists', typeof P.askSignIn, 'function');

  /* ---------- part 2: the dialog, in a real tool ---------- */
  const BASE = process.env.BASE;
  if (BASE) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const seen = [];
    await page.route('**/auth/v1/token**', async r => {
      const b = JSON.parse(r.request().postData()); seen.push(b.email);
      if (b.password !== 'right') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error_description: 'Invalid login credentials' }) });
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600 }) });
    });
    await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(BASE + '/tools/todo/', { waitUntil: 'networkidle' });
    await page.click('#btnSignIn');
    const dlg = page.locator('dialog.gvc-signin');
    await dlg.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    check('dialog opens instead of a prompt', await dlg.isVisible(), true);
    if (await dlg.isVisible()) {
      await page.fill('dialog.gvc-signin input[type=email]', 'matt@example.com');
      await page.fill('dialog.gvc-signin input[type=password]', 'wrong');
      await page.click('dialog.gvc-signin button[type=submit]');
      await page.waitForFunction(() => /Invalid/.test(document.querySelector('dialog.gvc-signin .gvc-signin-msg').textContent));
      check('wrong password shown in the dialog', await dlg.isVisible(), true);
      await page.fill('dialog.gvc-signin input[type=password]', 'right');
      await page.click('dialog.gvc-signin button[type=submit]');
      await dlg.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      check('signed in and closed', await dlg.isVisible(), false);
      check('person sign-in sent', seen.slice(-1)[0], 'matt@example.com');
      check('email remembered', await page.evaluate(() => localStorage.getItem('gvc.signin.email')), 'matt@example.com');
    }
    /* cancel resolves false and leaves the page usable */
    const p2 = await browser.newPage();
    await p2.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p2.goto(BASE + '/tools/todo/', { waitUntil: 'networkidle' });
    await p2.click('#btnSignIn');
    const d2 = p2.locator('dialog.gvc-signin');
    await d2.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await d2.isVisible()) {
      await p2.click('dialog.gvc-signin button[value=cancel]');
      check('cancel closes', await d2.isVisible(), false);
    } else check('cancel closes (dialog present)', false, true);
    await browser.close();
  } else {
    console.log('  (part 2 skipped: set BASE to a running static server)');
  }

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
