/* ============================================================
   The accuracy check: the plan drawn in navy with the source picture laid over it in red, multiplied,
   so anything drawn in the wrong place, or left out, shows as red or navy on its own.

     node scripts/floorplan/overlay.js "<plan.json>" "<source picture>" "<out.png>" [--level 1]

   Works only when the plan was traced in the picture's own pixel coordinates (plan-format.md). For a
   PDF or SVG source, overlay the PNG you traced from. The output is a check for the chat, never a
   plan: write it to the repo's tmp/ (or your own scratch folder), never into the job's Floorplan folder.
   It is drawn at the plan's page scale, not the source's; it prints the mapping between the two.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { draw } = require('./draw.js');
const { toPng } = require('../make-floorplan.js');
const STYLE = require('./style.js');

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

async function overlay(planPath, picPath, outPath, level = 0) {
  const type = TYPES[path.extname(picPath).toLowerCase()];
  if (!type) throw new Error('the source picture must be PNG, JPEG or WebP');
  const buf = fs.readFileSync(picPath);
  const [width, height] = type === 'image/webp' ? [null, null] : size(buf);
  if (!width) throw new Error('convert a WebP source to PNG first');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const svg = draw(plan, level, { branded: false, underlay: { href: 'data:' + type + ';base64,' + buf.toString('base64'), width, height } });
  await toPng(svg, outPath);
  /* where the source's pixels land in the overlay PNG, so a mismatch found there can be read back */
  const m = svg.match(/<image [^>]*transform="matrix\(([^)]+)\)"/)[1].split(/\s+/).map(Number);
  const k = STYLE.PNG.w / STYLE.PAGE.w, a = m[0] * k, bx = m[4] * k, by = m[5] * k, r = (v) => Math.round(v * 1000) / 1000;
  return { scale: r(a), offset: [r(bx), r(by)] };
}

module.exports = { overlay };

if (require.main === module) {
  const [planPath, picPath, outPath] = process.argv.slice(2);
  const li = process.argv.indexOf('--level');
  const level = li > 0 ? Number(process.argv[li + 1]) - 1 : 0;
  if (!planPath || !picPath || !outPath) {
    console.error('Usage: node scripts/floorplan/overlay.js "<plan.json>" "<source picture>" "<out.png>" [--level 1]');
    process.exit(1);
  }
  overlay(planPath, picPath, outPath, level).then((t) => console.log('Overlay saved to ' + outPath + '\n' +
    'Its pixels: overlay = source x ' + t.scale + ' + (' + t.offset.join(', ') + '); source = (overlay - (' + t.offset.join(', ') + ')) / ' + t.scale),
    (e) => { console.error(e.message); process.exit(1); });
}
