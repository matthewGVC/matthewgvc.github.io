/* ============================================================
   Drag photos around every builder that has a photo tray and fail if the
   gestures misbehave.

     python -m http.server 8080          (from the repo root)
     cd scripts && npm install           (once - playwright)
     node scripts/dnd-local.js                   brochure, seller, buyer, showsheet
     node scripts/dnd-local.js brochure          one tool

   The four builders share assets/js/photo-dnd.js (tray, grip, drop zones,
   the X buttons, reframing), so one script covers them. It loads six
   solid-colour photos, so "which photo is this?" is answered by sampling a
   pixel rather than trusting a filename, then checks that:

     - dragging a tray photo onto each slot puts THAT photo in the slot
     - no photo is ever showing in two slots at once
     - a photo can be moved between slots by its grip, and dragged off a
       page onto the tray
     - the X on a slot and the X on a tray row take the photo away
     - dragging inside a slot pans the photo

   Drops are driven with real mouse events, because the system is built on
   pointer events and a synthetic drop would skip the part that breaks.
   ============================================================ */
/* BROWSER=webkit runs the same checks in Safari's engine (npx playwright install webkit, once) */
const ENGINE = process.env.BROWSER || 'chromium';
const engine = require('playwright')[ENGINE];

const BASE = 'http://localhost:8080';
const TOOLS = {
  'brochure':       '#imgFile',
  'seller-package': '#filePhotos',
  'buyer-package':  '#filePhotos',
  'showsheet':      '#phFile'
};
const WANTED = process.argv[2] ? process.argv[2].split(',') : Object.keys(TOOLS);
const PALETTE = [[220, 40, 40], [40, 160, 60], [40, 80, 220], [230, 180, 30], [150, 50, 200], [30, 190, 190]];
/* a placed photo is "ours" if its average colour is near one of the six */
const TOLERANCE = 60;

/* Six solid-colour JPEGs, made in the page so no files are needed. Handed to
   the tool through the file input's own change event, exactly as a drop would. */
async function loadPhotos(page, inputSel) {
  await page.evaluate(async ([sel, palette]) => {
    const files = [];
    for (let i = 0; i < palette.length; i++) {
      const c = document.createElement('canvas'); c.width = 1500; c.height = 1000;
      const x = c.getContext('2d'); x.fillStyle = 'rgb(' + palette[i].join(',') + ')'; x.fillRect(0, 0, 1500, 1000);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      files.push(new File([blob], 'p' + (i + 1) + '.jpg', { type: 'image/jpeg' }));
    }
    const dt = new DataTransfer(); files.forEach(f => dt.items.add(f));
    const input = document.querySelector(sel); input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [inputSel, PALETTE]);
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await page.waitForTimeout(200);
}

/* Which of the six photos is this src? 'P1'..'P6', or 'x' for anything else
   (a stock image, a video still, a logo). */
const identify = (page, src) => page.evaluate(async ([src, palette, tol]) => {
  if (!src) return null;
  const im = new Image(); im.src = src; await im.decode().catch(() => {});
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  let best = -1, bd = 1e9;
  palette.forEach((p, k) => { const dd = Math.hypot(p[0] - d[0], p[1] - d[1], p[2] - d[2]); if (dd < bd) { bd = dd; best = k; } });
  return bd < tol ? 'P' + (best + 1) : 'x';
}, [src, PALETTE, TOLERANCE]);

/* every slot on the pages, and the src it is showing (not the gallery wrapper,
   which contains the cells and would count their photos twice) */
const slots = page => page.evaluate(() => [...document.querySelectorAll('[data-drop]:not([data-drop="gal-add"])')]
  .map(z => ({ drop: z.dataset.drop, src: (z.querySelector('img') || {}).src || null })));

async function drag(page, from, to) {
  await to.evaluate(e => e.scrollIntoView({ block: 'center' }));
  await from.evaluate(e => (e.closest('.ph-slot') || e).scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(150);
  // a slot's grip only exists on hover, so hover the slot first
  const slot = await from.evaluate(e => {
    const s = e.closest('.ph-slot');
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (slot) { await page.mouse.move(slot.x, slot.y); await page.waitForTimeout(120); }
  const a = await from.boundingBox();
  if (!a) throw new Error('nothing to grab');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  await page.waitForTimeout(80);
  /* measured once the drag is under way: the Showsheet's empty back-photo
     slot only opens up while a photo is being carried */
  const c = await to.boundingBox();
  if (!c) throw new Error('nowhere to drop');
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 14 });
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function run(browser, tool) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const problems = [], notes = [];
  const fail = m => problems.push(m);
  page.on('pageerror', e => fail('uncaught: ' + e.message.slice(0, 120)));
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|net::|mapbox|supabase/.test(m.text())) fail('console: ' + m.text().slice(0, 120));
  });
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(BASE + '/tools/' + tool + '/', { waitUntil: 'networkidle' });
  await loadPhotos(page, TOOLS[tool]);

  const rows = page.locator('#imgList .img-row');
  const nRows = await rows.count();
  notes.push(nRows + ' photos in the tray');
  if (nRows < 2) {
    fail('tray has ' + nRows + ' rows after loading six photos');
    await page.close();
    return { tool, problems, notes };
  }

  const shownTwice = async when => {
    const ids = [];
    for (const s of await slots(page)) if (s.src) ids.push(await identify(page, s.src));
    const dup = ids.filter((id, i) => id !== 'x' && ids.indexOf(id) !== i);
    if (dup.length) fail(when + ': the same photo is showing in two slots (' + dup.join(',') + ')');
  };
  await shownTwice('on load');

  // 1. tray -> every slot
  const kinds = [...new Set((await slots(page)).map(s => s.drop))];
  notes.push('slots: ' + kinds.join(', '));
  for (let i = 0; i < kinds.length; i++) {
    const row = (i + 2) % nRows;
    const want = await identify(page, await rows.nth(row).locator('.img-grab img').getAttribute('src'));
    try {
      await drag(page, rows.nth(row).locator('.img-grab'), page.locator('[data-drop="' + kinds[i] + '"]').first());
    } catch (e) { fail('tray -> ' + kinds[i] + ': ' + e.message); continue; }
    const got = await identify(page, (await slots(page)).find(s => s.drop === kinds[i]).src);
    if (got !== want) fail('tray photo ' + want + ' dropped on "' + kinds[i] + '" but the slot shows ' + got);
    await shownTwice('after dropping on ' + kinds[i]);
  }

  // 2. grip: move a placed photo to another slot
  /* only slots on screen: a slot on a hidden sheet cannot be grabbed */
  const placed = page.locator('.ph-slot:visible');
  const nPlaced = await placed.count();
  notes.push(nPlaced + ' photos placed');
  if (nPlaced >= 2) {
    try { await drag(page, placed.nth(0).locator('.ph-grip'), placed.nth(1)); } catch (e) { fail('grip move: ' + e.message); }
    await shownTwice('after moving a photo by its grip');
  }

  // 3. grip -> tray takes the photo off every page
  if (await placed.count()) {
    const before = await identify(page, await placed.first().locator('img').first().getAttribute('src'));
    try { await drag(page, placed.first().locator('.ph-grip'), page.locator('#imgList')); } catch (e) { fail('grip -> tray: ' + e.message); }
    const after = [];
    for (const s of await slots(page)) if (s.src) after.push(await identify(page, s.src));
    if (before !== 'x' && after.includes(before)) fail('photo ' + before + ' was dragged to the tray but is still on a page');
    await shownTwice('after dragging a photo to the tray');
  }

  // 4. the X on a slot
  const kills = page.locator('.ph-slot:visible .ph-kill');
  if (await kills.count()) {
    /* the slot may refill from the unused photos, so the test is that THIS
       photo is gone, not that the slot is empty */
    const gone = await identify(page, await page.locator('.ph-slot:visible').first().locator('img').first().getAttribute('src'));
    await kills.first().evaluate(e => e.click());
    await page.waitForTimeout(300);
    const now = [];
    for (const s of await slots(page)) if (s.src) now.push(await identify(page, s.src));
    if (gone !== 'x' && now.includes(gone)) fail('the X on a slot did not take its photo (' + gone + ') off the page');
    await shownTwice('after the X on a slot');
  }

  // 5. reframe: dragging inside a slot pans the photo
  const framed = page.locator('[data-pos]');
  const nFramed = await framed.count();
  let panned = 0;
  for (let i = 0; i < nFramed; i++) {
    const z = framed.nth(i);
    await z.evaluate(e => e.scrollIntoView({ block: 'center' }));
    const bb = await z.boundingBox();
    if (!bb) continue;
    const before = await z.locator('img').first().evaluate(e => e.style.objectPosition);
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 - 30, bb.y + bb.height / 2 - 20, { steps: 5 });
    await page.mouse.up();
    if (before !== await z.locator('img').first().evaluate(e => e.style.objectPosition)) panned++;
  }
  notes.push(panned + ' of ' + nFramed + ' framed photos panned');
  if (nFramed && !panned) fail('no photo could be panned inside its slot');

  // 6. the X on a tray row deletes the photo outright
  const xs = page.locator('#imgList .img-row .img-x');
  if (await xs.count()) {
    const n0 = await rows.count();
    await xs.first().evaluate(e => e.click());
    await page.waitForTimeout(300);
    const n1 = await rows.count();
    if (n1 !== n0 - 1) fail('the X on a tray row did not delete it (' + n0 + ' -> ' + n1 + ')');
    await shownTwice('after deleting a tray photo');
  }
  await page.close();
  return { tool, problems, notes };
}

(async () => {
  const browser = await engine.launch();
  console.log('\nDragging photos on ' + WANTED.length + ' tool(s) at ' + BASE + '\n');
  let failed = 0;
  for (const tool of WANTED) {
    if (!TOOLS[tool]) { console.log('  ??   ' + tool + ' has no photo tray'); failed++; continue; }
    const r = await run(browser, tool);
    console.log((r.problems.length ? '  FAIL ' : '  ok   ') + tool.padEnd(16) + ' ' + r.notes.join(' · '));
    r.problems.forEach(p => console.log('         - ' + p));
    if (r.problems.length) failed++;
  }
  await browser.close();
  console.log('\n' + (failed ? failed + ' tool(s) failed' : 'all photo gestures behave'));
  process.exit(failed ? 1 : 0);
})();
