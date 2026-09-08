const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const whiteSvg = fs.readFileSync(path.join(repo, 'assets/logos/monogram-white.svg'), 'utf8');
const lockupSvg = fs.readFileSync(path.join(repo, 'assets/logos/lockup.svg'), 'utf8');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Inline the SVG markup directly into a full HTML doc with a colored bg.
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    body{display:flex;align-items:center;justify-content:center;height:420px;background:#00273A}
    svg{height:380px;width:auto;display:block}
  </style></head><body>${whiteSvg}</body></html>`, { waitUntil: 'load' });
  await page.setViewportSize({ width: 300, height: 420 });
  await page.screenshot({ path: path.join(__dirname, 'out-white.png') });

  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    body{display:flex;align-items:center;justify-content:center;height:560px;background:#EFEDE8}
    svg{width:560px;height:auto;display:block}
  </style></head><body>${lockupSvg}</body></html>`, { waitUntil: 'load' });
  await page.setViewportSize({ width: 600, height: 560 });
  await page.screenshot({ path: path.join(__dirname, 'out-lockup.png') });

  console.log('done');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
