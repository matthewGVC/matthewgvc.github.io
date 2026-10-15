/* ============================================================
   Render every agent's photo in every layout that prints one, and fail on
   any photo that is missing, broken or too coarse to print.

     python -m http.server 8080          (from the repo root)
     cd scripts && npm install           (once - playwright)
     node scripts/test-agent-photos.js

   For each tool, market and agent count (one agent alone, then pairs - or
   up to four on the Showsheet - rotated so every agent lands in every
   slot), it picks the agents in the real picker, then measures each agent
   photo on the page at PRINT size: did it load, is it visible, and how many
   pixels per inch it prints at once object-fit is taken into account.
   Under 150 ppi is a WARN, under 100 a FAIL.

   It also crops every photo out of the preview into tmp/agent-photos/,
   one strip per agent, so the framing can be checked by eye.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const ENGINE = process.env.BROWSER || 'chromium';
const engine = require('playwright')[ENGINE];

const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = path.resolve(__dirname, '../tmp/agent-photos');
const WARN_PPI = 150, FAIL_PPI = 100;

/* tool, its market control (null: one market), markets, most agents a page takes */
const TOOLS = [
  { tool:'showsheet',      pick:'#agentPick',  seg:null,         markets:[''],              max:4 },
  { tool:'brochure',       pick:'#rosterPick', seg:null,         markets:[''],              max:2 },
  { tool:'seller-package', pick:'#rosterPick', seg:'#marketPick', attr:'data-market', markets:['nj', 'nyc'],       max:2 },
  { tool:'buyer-package',  pick:'#rosterPick', seg:'#regionPick', attr:'data-region', markets:['nj', 'nyc', 'fl'], max:2 }
];

/* every agent in every slot: for n agents a page, rotate the roster in
   groups of n so each id turns up once in each position */
function groups(ids, n) {
  if (n === 1) return ids.map(id => [id]);
  const out = [];
  for (let shift = 0; shift < n; shift++) {
    const r = ids.slice(shift).concat(ids.slice(0, shift));
    for (let i = 0; i < r.length; i += n) {
      const g = r.slice(i, i + n);
      while (g.length < n) g.push(r[g.length]);
      out.push(g);
    }
  }
  return out;
}

async function choose(page, pick, ids) {
  /* clear, then click in order: the order is the order on the page */
  for (;;) {
    const sel = await page.$(pick + ' .ag-chip.sel');
    if (!sel) break;
    await sel.click();
  }
  for (const id of ids) {
    const name = await page.evaluate(id => window.GVC_AGENT(id).name, id);
    await page.locator(pick + ' .ag-chip', { hasText: name }).first().click();
  }
}

/* every agent photo on the page, measured under print media */
const MEASURE = () => {
  const re = /assets\/agents\/([a-z-]+)\.png|static\/agent-([a-z-]+)\.jpg/;
  const root = document.querySelector('#sheets') || document.querySelector('#stage');
  return [...root.querySelectorAll('img')].map((img, i) => {
    const m = (img.currentSrc || img.src).match(re);
    if (!m) return null;
    img.dataset.apt = String(i);
    const cs = getComputedStyle(img);
    const w = img.offsetWidth, h = img.offsetHeight, nw = img.naturalWidth, nh = img.naturalHeight;
    let ppi = 0;
    if (nw && w && h) {
      const sx = w / nw, sy = h / nh;
      const s = cs.objectFit === 'cover' ? Math.max(sx, sy)
              : cs.objectFit === 'contain' || cs.objectFit === 'scale-down' ? Math.min(sx, sy)
              : Math.max(sx, sy);                       /* fill: the stretched axis is the coarse one */
      ppi = Math.round(96 / s);
    }
    const pg = img.closest('[data-key]');
    const holder = img.parentElement;
    return {
      i, agent: m[1] || m[2], file: (m[0] || '').split('/').pop(),
      layout: (pg ? pg.dataset.key + ' > ' : '') + (holder.className || holder.tagName.toLowerCase()).toString().trim(),
      loaded: img.complete && nw > 0,
      visible: w > 0 && h > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
      inches: (w / 96).toFixed(2) + ' x ' + (h / 96).toFixed(2),
      natural: nw + 'x' + nh, fit: cs.objectFit, pos: cs.objectPosition, ppi
    };
  }).filter(Boolean);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));

  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase|mapbox|net::/i.test(m.text())) errors.push(m.text()); });

  const rows = [];
  for (const T of TOOLS) {
    await page.goto(BASE + '/tools/' + T.tool + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    const ids = await page.evaluate(() => window.GVC_ROSTER.map(a => a.id));

    for (const mk of T.markets) {
      if (T.seg) await page.click(T.seg + ' [' + T.attr + '="' + mk + '"]');
      for (let n = 1; n <= T.max; n++) {
        for (const g of groups(ids, n)) {
          await choose(page, T.pick, g);
          await page.waitForTimeout(150);
          await page.waitForFunction(() => [...document.images].every(i => i.complete));
          await page.emulateMedia({ media: 'print' });
          const found = await page.evaluate(MEASURE);
          await page.emulateMedia({ media: 'screen' });
          const where = T.tool + (mk ? ' ' + mk : '') + ' x' + n;
          for (const id of g) {
            if (!found.some(r => r.agent === id)) rows.push({ where, agent: id, layout: '(none on page)', missing: true });
          }
          for (const r of found) {
            rows.push(Object.assign({ where, group: g.join(',') }, r));
            if (n === 1 || n === T.max) {
              const el = await page.$('[data-apt="' + r.i + '"]');
              const box = el && await el.evaluateHandle(e => e.parentElement);
              try {
                await box.asElement().screenshot({ path: path.join(OUT,
                  [r.agent, T.tool, mk || 'all', 'x' + n, r.layout.replace(/[^a-z0-9]+/gi, '-')].join('_') + '.png') });
              } catch (e) { /* off-screen or zero-size: already reported as not visible */ }
            }
          }
        }
      }
    }
  }
  await browser.close();

  /* one line per distinct agent / tool / layout, worst ppi seen */
  const seen = new Map();
  for (const r of rows) {
    const k = [r.agent, r.where.replace(/ x\d$/, ''), r.layout].join('|');
    const prev = seen.get(k);
    if (!prev || (r.ppi || 0) < (prev.ppi || 0) || r.missing || !r.loaded || !r.visible) seen.set(k, Object.assign({}, r, { counts: ((prev && prev.counts) || '') }));
  }
  let fails = 0, warns = 0;
  const lines = [];
  for (const r of [...seen.values()].sort((a, b) => a.agent.localeCompare(b.agent) || a.where.localeCompare(b.where))) {
    let st = 'ok  ';
    const why = [];
    if (r.missing) { st = 'MISS'; why.push('agent picked but no photo printed'); }
    else {
      if (!r.loaded) { st = 'FAIL'; why.push('did not load'); }
      if (!r.visible) { st = 'FAIL'; why.push('zero size / hidden'); }
      if (r.ppi && r.ppi < FAIL_PPI) { st = 'FAIL'; why.push(r.ppi + ' ppi'); }
      else if (r.ppi && r.ppi < WARN_PPI && st === 'ok  ') { st = 'WARN'; why.push(r.ppi + ' ppi'); }
    }
    if (st === 'FAIL') fails++; if (st === 'WARN') warns++;
    lines.push([st, r.agent.padEnd(18), r.where.replace(/ x\d$/, '').padEnd(19), (r.layout || '').padEnd(34),
      (r.file || '').padEnd(28), (r.inches || '').padEnd(12), r.ppi ? String(r.ppi).padStart(4) + ' ppi' : '', why.join('; ')].join(' '));
  }
  const report = lines.join('\n');
  fs.writeFileSync(path.join(OUT, 'report.txt'), report + '\n');
  fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(rows, null, 1));
  console.log(report);
  if (errors.length) console.log('\nPage errors:\n  ' + [...new Set(errors)].join('\n  '));
  console.log('\n' + rows.length + ' photo placements measured, ' + seen.size + ' distinct; ' +
    fails + ' FAIL, ' + warns + ' WARN. Crops in tmp/agent-photos/');
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
