/* ============================================================
   The accuracy check: the plan drawn in navy with the source picture laid over it in red, multiplied,
   so anything drawn in the wrong place, or left out, shows as red or navy on its own.

     node scripts/floorplan/overlay.js "<plan.json>" "<source picture>" "<out.png>" [--level 1] [--zoom 2]

   Works only when the plan was traced in the picture's own pixel coordinates (plan-format.md). For a
   PDF or SVG source, overlay the PNG you traced from. The output is a check for the chat, never a
   plan: write it to the repo's tmp/ (or your own scratch folder), never into the job's Floorplan folder.
   It is cut to the source picture, in the source's own pixels times its zoom (printed), so the
   coordinates read off it are plan.json's: source px = overlay px / zoom.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { draw } = require('./draw.js');

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/* width and height of a PNG or JPEG, read from its header */
function size(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  for (let i = 2; i < buf.length;) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('cannot read the picture size (use a PNG or JPEG)');
}

/* The overlay is cut to the source picture and drawn in its own pixels (times zoom, at least 2000 px
   wide), so a mismatch is read straight off in the coordinates plan.json uses: source = overlay / zoom. */
async function overlay(planPath, picPath, outPath, level = 0, zoom = null) {
  const type = TYPES[path.extname(picPath).toLowerCase()];
  if (!type) throw new Error('the source picture must be PNG, JPEG or WebP');
  const buf = fs.readFileSync(picPath);
  const [width, height] = type === 'image/webp' ? [null, null] : size(buf);
  if (!width) throw new Error('convert a WebP source to PNG first');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const svg = draw(plan, level, { branded: false, underlay: { href: 'data:' + type + ';base64,' + buf.toString('base64'), width, height } });
  /* the picture's place on the page: page pt = source px * m + (e, f) */
  const [m, , , , e, f] = svg.match(/<image [^>]*transform="matrix\(([^)]+)\)"/)[1].split(/\s+/).map(Number);
  const z = zoom || Math.max(1, Math.min(4, 2000 / width)), W = Math.round(width * z), H = Math.round(height * z);
  const cut = svg.replace(/<svg [^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [e, f, width * m, height * m].map((v) => Math.round(v * 1e4) / 1e4).join(' ') + '" width="' + W + '" height="' + H + '" style="display:block">');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.setContent('<!doctype html><html><body style="margin:0;background:#fff">' + cut + '</body></html>');
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: W, height: H } });
  } finally {
    await browser.close();
  }
  return { zoom: Math.round(z * 1000) / 1000, size: [W, H] };
}

module.exports = { overlay };

if (require.main === module) {
  const [planPath, picPath, outPath] = process.argv.slice(2);
  const li = process.argv.indexOf('--level');
  const level = li > 0 ? Number(process.argv[li + 1]) - 1 : 0;
  if (!planPath || !picPath || !outPath) {
    console.error('Usage: node scripts/floorplan/overlay.js "<plan.json>" "<source picture>" "<out.png>" [--level 1] [--zoom 2]');
    process.exit(1);
  }
  const zi = process.argv.indexOf('--zoom');
  overlay(planPath, picPath, outPath, level, zi > 0 ? Number(process.argv[zi + 1]) : null).then((t) => console.log('Overlay saved to ' + outPath + ' (' + t.size.join(' x ') + ')\n' +
    'It is the source picture, at ' + t.zoom + 'x: source px = overlay px / ' + t.zoom),
    (e) => { console.error(e.message); process.exit(1); });
}
