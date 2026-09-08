const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');

const TARGETS = [
  { url: 'https://theedgedelray.com/', out: path.join(repo, 'projects', 'the-edge', 'hero.webp') },
  { url: 'https://gvcrealestateteam.com/', out: path.join(repo, 'projects', 'gvc-team', 'hero.webp') },
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,              // 1440x900 output, matches existing heroes
  });

  for (const t of TARGETS) {
    try {
      fs.mkdirSync(path.dirname(t.out), { recursive: true });
      const page = await ctx.newPage();
      await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60000 });
      // nudge lazy assets, then settle back at the top for the hero
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1200);

      const png = await page.screenshot({ type: 'png' }); // viewport only -> 1440x900
      // encode to webp inside chromium via canvas
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
      fs.writeFileSync(t.out, Buffer.from(webpB64, 'base64'));
      console.log('wrote', t.out, fs.statSync(t.out).size, 'bytes  <-', t.url);
      await conv.close();
      await page.close();
    } catch (e) {
      console.error('FAILED', t.url, '::', e.message);
    }
  }

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
