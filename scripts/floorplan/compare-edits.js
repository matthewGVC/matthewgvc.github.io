// Compare Matt's hand-edited floorplan SVG with a fresh regeneration of the same plan.
//
//   node scripts/floorplan/compare-edits.js "<his.svg>" "<regenerated.svg>" "<out folder>" [--zoom 4]
//
// Renders both at the zoom and writes into the out folder:
//   matt.png, gen.png   the two renders
//   diff.png            black where they agree, red only in his file, blue only in ours
// Regenerate into a scratch folder (copy Design/plan.json to <scratch>/Floorplan/Design/ and run the
// maker there), never over his file. His file is Illustrator output rounded to one decimal place, so
// compare shapes, not stroke weights under 0.1.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const args = process.argv.slice(2);
  const zi = args.indexOf('--zoom');
  const zoom = zi >= 0 ? +args.splice(zi, 2)[1] : 4;
  const [mattSvg, genSvg, out] = args;
  if (!out) { console.error('usage: compare-edits.js <his.svg> <regenerated.svg> <out folder> [--zoom 4]'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  const box = (svg) => { const m = svg.match(/viewBox="([\d.\s-]+)"/); return m ? m[1].trim().split(/\s+/).map(Number) : [0, 0, 810, 630]; };
  const a = fs.readFileSync(mattSvg, 'utf8'), b = fs.readFileSync(genSvg, 'utf8');
  const [, , w, h] = box(a);
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: zoom, viewport: { width: Math.ceil(w), height: Math.ceil(h) } });
  const shots = [];
  for (const [svg, name] of [[a, 'matt'], [b, 'gen']]) {
    await page.setContent(`<html><body style="margin:0">${svg.replace(/<\?xml[^>]*>/, '')}</body></html>`);
    await page.evaluate(([W, H]) => { const s = document.querySelector('svg'); s.setAttribute('width', W); s.setAttribute('height', H); }, [w, h]);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
    fs.writeFileSync(path.join(out, name + '.png'), png);
    shots.push(png.toString('base64'));
  }
  const res = await page.evaluate(async ([m, g]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [im, ig] = await Promise.all([load(m), load(g)]);
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    const px = (img) => { x.clearRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const A = px(im), B = px(ig), D = x.createImageData(c.width, c.height);
    let red = 0, blue = 0;
    for (let i = 0; i < A.length; i += 4) {
      const da = (A[i] + A[i + 1] + A[i + 2]) / 3 < 200, db = (B[i] + B[i + 1] + B[i + 2]) / 3 < 200;
      const col = da && db ? [0, 0, 0] : da ? (red++, [230, 0, 0]) : db ? (blue++, [0, 90, 255]) : [255, 255, 255];
      D.data.set([...col, 255], i);
    }
    x.putImageData(D, 0, 0);
    return { red, blue, png: c.toDataURL('image/png').split(',')[1] };
  }, shots);
  fs.writeFileSync(path.join(out, 'diff.png'), Buffer.from(res.png, 'base64'));
  await browser.close();
  console.log(`Only in his file (red): ${res.red} px; only in ours (blue): ${res.blue} px. Wrote matt.png, gen.png, diff.png to ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
