const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const svgPath = path.join(repo, 'assets', 'logos', 'monogram.svg');
const svg = fs.readFileSync(svgPath, 'utf8');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  async function render(size, outFile) {
    // Transparent background; SVG fills the box. The monogram viewBox is
    // 603.7 329.9 792.7 1340.3 (portrait); object-fit:contain centers it.
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <style>
        html,body{margin:0;padding:0;background:transparent}
        #box{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
        /* keep the portrait mark's aspect ratio — height-bound, auto width, centered */
        #box svg{height:100%;width:auto;display:block}
      </style></head>
      <body><div id="box">${svg}</div></body></html>`;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const el = await page.$('#box');
    await el.screenshot({ path: outFile, omitBackground: true });
    console.log('wrote', outFile, fs.statSync(outFile).size, 'bytes');
  }

  await render(32, path.join(repo, 'assets', 'logos', 'monogram-32.png'));
  await render(180, path.join(repo, 'assets', 'logos', 'apple-touch-icon-180.png'));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
