/* ============================================================
   Drive through Google (assets/js/drive-web.js, overhaul step 9): the
   team reads the shared drives over the web, and drive.js's rules hold.
     BASE=http://localhost:8080 node scripts/test-drive-web.js
   Google is faked: nothing leaves this computer.
   ============================================================ */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('  FAIL ' + name + '\n      expected ' + JSON.stringify(want) + '\n      got      ' + JSON.stringify(got));
}

const F = 'application/vnd.google-apps.folder';
const FILES = {   // folder id → its children
  d1: [{ id: 'f1', name: 'ACTIVE LISTINGS & DEALS', mimeType: F }],
  f1: [{ id: 'f2', name: '1 Test St', mimeType: F }],
  f2: [{ id: 'f3', name: 'Photos', mimeType: F }, { id: 'f4', name: 'Contracts', mimeType: F }, { id: 'x1', name: 'Listing Agreement.pdf', mimeType: 'application/pdf', size: '9' }],
  f3: [{ id: 'p1', name: 'a.jpg', mimeType: 'image/jpeg', size: '3', modifiedTime: '2026-11-01T10:00:00.000Z' }],
  f4: [{ id: 'c1', name: 'contract.pdf', mimeType: 'application/pdf', size: '5' }]
};
const META = {   // files.get answers, for a pasted folder link (ids as long as Google's)
  f2linkedfold: { id: 'f2linkedfold', name: '1 Test St', mimeType: F, parents: ['f1'], driveId: 'd1' },
  f1: { id: 'f1', name: 'ACTIVE LISTINGS & DEALS', mimeType: F, parents: ['d1'], driveId: 'd1' },
  f5abcdefghij: { id: 'f5abcdefghij', name: 'brochure.pdf', mimeType: 'application/pdf', parents: ['f1'], driveId: 'd1' }
};

// server: what the drive-token function answers for a fresh pass (409: no permission kept)
async function page(browser, who, token, server) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const asked = [];
  await p.route('https://www.googleapis.com/drive/v3/**', r => {
    const u = new URL(r.request().url()); asked.push(u.pathname + (u.searchParams.get('q') ? ' ' + u.searchParams.get('q') : '') + (u.searchParams.get('alt') ? ' media' : ''));
    if (r.request().headers().authorization !== 'Bearer tok') return r.fulfill({ status: 401, body: '{}' });
    if (u.pathname.endsWith('/drives')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ drives: [{ id: 'd1', name: 'GVC - New York' }] }) });
    const one = u.pathname.match(/\/drives\/([^/]+)$/);
    if (one) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'GVC - New York' }) });
    const meta = u.pathname.match(/\/files\/([^/]+)$/);
    if (meta && !u.searchParams.get('alt')) return r.fulfill(META[meta[1]] ? { status: 200, contentType: 'application/json', body: JSON.stringify(META[meta[1]]) } : { status: 404, body: '{}' });
    const media = u.pathname.match(/\/files\/([^/]+)$/);
    if (media) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: 'abc' });
    const parent = (u.searchParams.get('q') || '').match(/'([^']+)' in parents/)[1];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: FILES[parent] || [] }) });
  });
  await p.goto(BASE + '/tools/todo/', { waitUntil: 'domcontentloaded' });
  await p.evaluate(([w, t, sv]) => {
    window.__passes = 0; window.__signIns = [];
    window.GVC_PROPS = { signedIn: () => true, whoAmI: () => Promise.resolve(w),
      drivePass: () => { window.__passes++; return Promise.resolve(new Response(JSON.stringify(sv ? sv.body : { need: 'consent' }), { status: sv ? sv.status : 409 })); },
      googleSignIn: o => window.__signIns.push(o) };
    if (t) sessionStorage.setItem('gvc.drive.web.token', JSON.stringify({ value: t, until: Date.now() + 3600e3 }));
  }, [who, token, server]);
  for (const f of ['drive-rules.js', 'drive-web.js', 'drive.js']) await p.addScriptTag({ url: BASE + '/assets/js/' + f });
  return { p, ctx, asked };
}

(async () => {
  const browser = await chromium.launch();
  const MATT = { email: 'matthew@gvcrealestateteam.com', role: 'owner' };

  let t = await page(browser, MATT, 'tok');
  const p = t.p;
  check('Matt: Drive through Google, connected', [await p.evaluate(() => GVC_DRIVE_WEB.active()), await p.evaluate(() => GVC_DRIVE.state())], [true, 'connected']);
  check('list a shared drive folder', await p.evaluate(() => GVC_DRIVE.list('GVC - New York/ACTIVE LISTINGS & DEALS')), [{ name: '1 Test St', kind: 'directory' }]);
  const tree = await p.evaluate(() => GVC_DRIVE.tree('GVC - New York/ACTIVE LISTINGS & DEALS/1 Test St'));
  check('the job tree: photos with size and date, paperwork never opened', [JSON.stringify(tree).includes('"a.jpg"'), JSON.stringify(tree).includes('2026-11-01'),
    JSON.stringify(tree).includes('contract.pdf'), t.asked.some(a => a.includes("'f4' in parents")), t.asked.some(a => / media$/.test(a))], [true, true, false, false, false]);
  const file = await p.evaluate(() => GVC_DRIVE.readJobFile('GVC - New York/ACTIVE LISTINGS & DEALS/1 Test St', 'Photos/a.jpg').then(f => f.text()));
  check('a photo is read through Google', file, 'abc');
  check('a paperwork file is refused before Google is asked', await p.evaluate(() => GVC_DRIVE.readJobFile('GVC - New York/ACTIVE LISTINGS & DEALS/1 Test St', 'Contracts/contract.pdf').then(() => 'read', e => 'refused')), 'refused');
  check('a missing job folder is "broken", as with the local folder', await p.evaluate(() => GVC_DRIVE.tree('GVC - New York/ACTIVE LISTINGS & DEALS/Gone St').then(t => t.broken)), true);
  check('Google is only ever asked to read', t.asked.every(a => !/POST|PATCH|DELETE/.test(a)), true);
  await t.ctx.close();

  // 9b: the hour runs out, the server hands a fresh pass, nobody clicks
  const FRESH = { status: 200, body: { access_token: 'tok', expires_in: 3600 } };
  t = await page(browser, MATT, null, FRESH);
  check('no pass in this tab: a fresh one from the server, connected, no click', [await t.p.evaluate(() => GVC_DRIVE.state()),
    await t.p.evaluate(() => GVC_DRIVE.list('GVC - New York').then(x => x.length)), await t.p.evaluate(() => window.__passes), await t.p.evaluate(() => window.__signIns.length)], ['connected', 1, 1, 0]);
  await t.ctx.close();
  t = await page(browser, MATT, 'expired-or-wrong', FRESH);
  check('a pass Google refuses: one fresh pass and it carries on', await t.p.evaluate(() => GVC_DRIVE.list('GVC - New York').then(x => x.length, e => e.message)), 1);
  await t.ctx.close();
  t = await page(browser, MATT, null);
  check('no permission kept: one click, which signs in with Google showing its page', [await t.p.evaluate(() => GVC_DRIVE.state()),
    await t.p.evaluate(async () => { GVC_DRIVE.connect(); await new Promise(r => setTimeout(r, 100)); return window.__signIns; })], ['needs-click', [{ consent: true }]]);
  await t.ctx.close();
  t = await page(browser, MATT, null, { status: 503, body: { error: 'Drive through Google isn\'t set up yet (the server key is missing).' } });
  check('the server key not set yet: an error, not an endless click', [await t.p.evaluate(() => GVC_DRIVE.state()),
    await t.p.evaluate(() => GVC_DRIVE.list('GVC - New York').then(() => 'ok', e => e.message))], ['error', 'Drive through Google isn\'t set up yet (the server key is missing).']);
  await t.ctx.close();

  t = await page(browser, { email: 'katie@gvcrealestateteam.com', role: 'team' }, 'tok');
  check('everyone on a GVC Google sign-in gets Drive through Google', await t.p.evaluate(() => GVC_DRIVE_WEB.active()), true);
  await t.ctx.close();
  t = await page(browser, { email: null, name: 'Team (shared)', role: 'shared' }, 'tok');
  check('the shared team password: the local folder, as before', await t.p.evaluate(() => GVC_DRIVE_WEB.active()), false);
  await t.ctx.close();
  t = await page(browser, { email: 'someone@gmail.com', role: null }, 'tok');
  check('a Google account outside GVC: the local folder', await t.p.evaluate(() => GVC_DRIVE_WEB.active()), false);
  await t.ctx.close();
  t = await page(browser, { email: null, name: 'Team (shared)', role: 'shared' }, 'tok');
  check('no Google account: Connect Drive, and nothing is read', [await t.p.evaluate(() => GVC_DRIVE.state()),
    await t.p.evaluate(() => GVC_DRIVE.list('GVC - New York').then(() => 'read', e => e.message))], ['not-connected', 'Drive isn\'t connected. Sign in with Google to read it.']);
  await t.ctx.close();

  // a pasted folder link → its path, walking up to the shared drive
  t = await page(browser, MATT, 'tok');
  check('a pasted Drive folder link → its path', await t.p.evaluate(() => GVC_DRIVE.pathOfLink('https://drive.google.com/drive/folders/f2linkedfold?usp=sharing')), 'GVC - New York/ACTIVE LISTINGS & DEALS/1 Test St');
  check('a link that isn\'t Drive is refused before Google is asked', await t.p.evaluate(() => GVC_DRIVE.pathOfLink('https://example.com/x').then(() => 'ok', e => e.message)), 'That isn\'t a Google Drive folder link.');
  check('a file link is not a folder', await t.p.evaluate(() => GVC_DRIVE.pathOfLink('https://drive.google.com/drive/folders/f5abcdefghij').then(() => 'ok', e => e.message)), 'That link is a file, not a folder.');
  await t.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
  process.exit(fail ? 1 : 0);
})();
