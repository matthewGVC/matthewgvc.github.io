/* ============================================================
   Drive through Google (assets/js/drive-web.js, overhaul step 9): the
   testers read the shared drives over the web, and drive.js's rules hold.
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

async function page(browser, who, token) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const asked = [];
  await p.route('https://www.googleapis.com/drive/v3/**', r => {
    const u = new URL(r.request().url()); asked.push(u.pathname + (u.searchParams.get('q') ? ' ' + u.searchParams.get('q') : '') + (u.searchParams.get('alt') ? ' media' : ''));
    if (r.request().headers().authorization !== 'Bearer tok') return r.fulfill({ status: 401, body: '{}' });
    if (u.pathname.endsWith('/drives')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ drives: [{ id: 'd1', name: 'GVC - New York' }] }) });
    const media = u.pathname.match(/\/files\/([^/]+)$/);
    if (media) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: 'abc' });
    const parent = (u.searchParams.get('q') || '').match(/'([^']+)' in parents/)[1];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: FILES[parent] || [] }) });
  });
  await p.goto(BASE + '/tools/todo/', { waitUntil: 'domcontentloaded' });
  await p.evaluate(([w, t]) => {
    window.GVC_PROPS = { signedIn: () => true, whoAmI: () => Promise.resolve(w) };
    if (t) sessionStorage.setItem('gvc.drive.web.token', JSON.stringify({ value: t, until: Date.now() + 3600e3 }));
  }, [who, token]);
  for (const f of ['drive-rules.js', 'drive-web.js', 'drive.js']) await p.addScriptTag({ url: BASE + '/assets/js/' + f });
  return { p, ctx, asked };
}

(async () => {
  const browser = await chromium.launch();
  const MATT = { email: 'matthew@gvcrealestateteam.com', role: 'owner' };

  let t = await page(browser, MATT, 'tok');
  const p = t.p;
  check('a tester: Drive through Google, connected', [await p.evaluate(() => GVC_DRIVE_WEB.active()), await p.evaluate(() => GVC_DRIVE.state())], [true, 'connected']);
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

  t = await page(browser, MATT, null);
  check('a tester without a token: one click', await t.p.evaluate(() => GVC_DRIVE.state()), 'needs-click');
  await t.ctx.close();
  t = await page(browser, MATT, 'expired-or-wrong');
  check('a token Google refuses: says reconnect', await t.p.evaluate(() => GVC_DRIVE.list('GVC - New York').then(() => 'ok', e => e.message)), 'Drive needs one click to reconnect.');
  await t.ctx.close();

  t = await page(browser, { email: 'katie@gvcrealestateteam.com', role: 'team' }, 'tok');
  check('not a tester: the local folder, as before', await t.p.evaluate(() => GVC_DRIVE_WEB.active()), false);
  await t.ctx.close();
  t = await page(browser, MATT, 'tok');
  await t.p.evaluate(() => localStorage.setItem('gvc.drive.local', '1'));
  check('a tester can turn it off on one computer', await t.p.evaluate(() => GVC_DRIVE_WEB.active()), false);
  await t.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
  process.exit(fail ? 1 : 0);
})();
