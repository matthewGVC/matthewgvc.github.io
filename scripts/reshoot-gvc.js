const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const url = 'https://gvcrealestateteam.com/';
const out = path.join(repo, 'projects', 'gvc-team', 'hero.webp');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  // let any timed newsletter popup fire, then dismiss it aggressively
  await page.waitForTimeout(4000);
  await page.keyboard.press('Escape').catch(() => {});
  // try common close affordances
  for (const sel of ['[aria-label*="close" i]', 'button:has-text("×")', 'button:has-text("Close")', '[class*="close" i]']) {
    try { const el = await page.$(sel); if (el) await el.click({ timeout: 1000 }); } catch (_) {}
  }
  // JS sweep: remove fixed/absolute overlays that look like a popup or its backdrop
  await page.evaluate(() => {
    const kws = ['stay informed', 'sign up', 'subscribe', 'newsletter', 'market updates'];
    const kill = [];
    document.querySelectorAll('body *').forEach(el => {
      const s = getComputedStyle(el);
      if (s.position !== 'fixed' && s.position !== 'absolute') return;
      const r = el.getBoundingClientRect();
      const z = parseInt(s.zIndex) || 0;
      const txt = (el.innerText || '').toLowerCase();
      const coversLots = r.width > window.innerWidth * 0.5 && r.height > window.innerHeight * 0.35;
      const isBackdrop = r.width >= window.innerWidth * 0.95 && r.height >= window.innerHeight * 0.95 && z >= 5;
      if ((coversLots && z >= 5 && kws.some(k => txt.includes(k))) || isBackdrop) kill.push(el);
    });
    kill.forEach(el => el.remove());
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);

  const png = await page.screenshot({ type: 'png' });
  const dataUrl = 'data:image/png;base64,' + png.toString('base64');
  const conv = await ctx.newPage();
  const webpB64 = await conv.evaluate(async (src) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.85).split(',')[1];
  }, dataUrl);
  fs.writeFileSync(out, Buffer.from(webpB64, 'base64'));
  console.log('wrote', out, fs.statSync(out).size, 'bytes');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
