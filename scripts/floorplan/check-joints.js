// Render each floor of a plan for check-joints.py: its own unbranded sheet at 8x, with the room names
// and labels left out (their letters are not joints). See check-joints.py.
//   node scripts/floorplan/check-joints.js "<plan.json>" <out folder>
'use strict';
const fs = require('fs');
const path = require('path');
const { draw } = require('./draw.js');
const STYLE = require('./style.js');

const ZOOM = 8;

(async () => {
  const [file, out] = process.argv.slice(2);
  if (!out) { console.error('usage: check-joints.js "<plan.json>" <out folder>'); process.exit(1); }
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.mkdirSync(out, { recursive: true });
  const bare = JSON.parse(JSON.stringify(plan));
  bare.levels.forEach((l) => { l.rooms = []; l.labels = []; });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const meta = { zoom: ZOOM, levels: [] };
  try {
    for (let i = 0; i < bare.levels.length; i++) {
      let T;
      const svg = draw(bare, i, { onLayout: (L) => { T = L.T; } });
      const page = await browser.newPage({ viewport: { width: STYLE.PAGE.w, height: STYLE.PAGE.h }, deviceScaleFactor: ZOOM });
      await page.setContent('<body style="margin:0">' + svg + '</body>');
      const name = (plan.levels[i].name || 'level ' + (i + 1)).replace(/[^\w -]/g, '');
      await page.screenshot({ path: path.join(out, name + '.png'), clip: { x: 0, y: 0, width: STYLE.PAGE.w, height: STYLE.PAGE.h } });
      await page.close();
      /* page pt = o + plan * k, so the sliver list can be read in plan.json's coordinates */
      const o = T([0, 0]), k = T([1, 0])[0] - o[0];
      meta.levels.push({ name, png: name + '.png', k, ox: o[0], oy: o[1] });
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta));
  console.log('Rendered ' + meta.levels.length + ' floors to ' + out);
})().catch((e) => { console.error(e); process.exit(1); });
