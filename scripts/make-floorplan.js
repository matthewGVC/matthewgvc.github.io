/* ============================================================
   The floorplan maker. Reads <Floorplan folder>/Design/plan.json, checks it, draws every level
   unbranded and branded, and saves an SVG master plus a PNG copy of each into
   <Floorplan folder>/Unbranded/ and /Branded/. Anything it would overwrite, and the same layout's
   files from other versions, are moved first to Design/archive/<date>/ (never deleted). Also writes Design/run-v<N>.md.

     node scripts/make-floorplan.js "<Floorplan folder>" --version 3 [--facts '{"beds":2,"baths":2}']
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { validate } = require('./floorplan/plan.js');
const { draw } = require('./floorplan/draw.js');
const STYLE = require('./floorplan/style.js');

function localDate() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function safe(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

/* Render one SVG string to PNG bytes (white ground, STYLE.PNG pixels); saved to outPath when given.
   Chromium now and then fails to capture a page this large, so a failed capture is tried again on a
   fresh page, up to three times. */
async function toPng(svgString, outPath, browser) {
  const { chromium } = require('playwright');
  const own = !browser;
  if (own) browser = await chromium.launch();
  try {
    for (let attempt = 1; ; attempt++) {
      const page = await browser.newPage({
        viewport: { width: STYLE.PAGE.w, height: STYLE.PAGE.h },
        deviceScaleFactor: STYLE.PNG.w / STYLE.PAGE.w
      });
      try {
        await page.setContent('<!doctype html><html><body style="margin:0;background:#fff">' +
          '<div style="width:' + STYLE.PAGE.w + 'px;height:' + STYLE.PAGE.h + 'px;overflow:hidden">' +
          svgString.replace(/<svg\b/, '<svg style="display:block;width:' + STYLE.PAGE.w + 'px;height:' + STYLE.PAGE.h + 'px"') +
          '</div></body></html>');
        const png = await page.screenshot({ clip: { x: 0, y: 0, width: STYLE.PAGE.w, height: STYLE.PAGE.h } });
        if (outPath) require('fs').writeFileSync(outPath, png);
        return png;
      } catch (e) {
        if (attempt >= 3) throw e;
      } finally {
        await page.close();
      }
    }
  } finally {
    if (own) await browser.close();
  }
}

async function make(folder, opts) {
  opts = opts || {};
  const version = opts.version;
  if (!Number.isInteger(version) || version < 1) throw new Error('version must be a whole number, 1 or more');
  const today = opts.today || localDate();
  const planPath = path.join(folder, 'Design', 'plan.json');
  if (!fs.existsSync(planPath)) throw new Error('Cannot find ' + planPath);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const res = validate(plan);
  if (res.errors.length) throw new Error('plan.json is not valid: ' + res.errors.join('; '));
  const warnings = res.warnings.slice();

  const label = safe(plan.job.label);
  const alt = plan.layout === 'alternate' ? ' Alternate' : '';
  const multi = plan.levels.length > 1;
  const written = [];
  const archived = [];
  const jobs = [];

  /* Move an existing file to Design/archive/<today>/<rel>, numbering a clash " (2)", " (3)"... */
  function archive(rel) {
    const abs = path.join(folder, rel);
    let arel = 'Design/archive/' + today + '/' + rel;
    for (let k = 2; fs.existsSync(path.join(folder, arel)); k++) {
      const dot = rel.lastIndexOf('.');
      arel = 'Design/archive/' + today + '/' + rel.slice(0, dot) + ' (' + k + ')' + rel.slice(dot);
    }
    const aabs = path.join(folder, arel);
    fs.mkdirSync(path.dirname(aabs), { recursive: true });
    fs.renameSync(abs, aabs);
    return arel;
  }

  plan.levels.forEach((lvl, i) => {
    const base = label + ' v' + version + alt + (multi ? ' - ' + safe(lvl.name) : '');
    for (const [dir, branded] of [['Unbranded', false], ['Branded', true]]) {
      jobs.push({ dir, base, svg: draw(plan, i, { branded, facts: opts.facts }) });
    }
  });

  /* Unbranded/ and Branded/ hold only the current plan: this layout's files from any other version
     move to the archive. Only names the maker itself writes are matched; anything else stays. */
  const ours = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' v(\\d+)( Alternate)?( - .+)?\\.(svg|png)$');
  const olderVersions = [];
  for (const dir of ['Unbranded', 'Branded']) {
    if (!fs.existsSync(path.join(folder, dir))) continue;
    fs.readdirSync(path.join(folder, dir)).sort().forEach((name) => {
      const m = ours.exec(name);
      if (m && +m[1] !== version && !!m[2] === !!alt) olderVersions.push(dir + '/' + name);
    });
  }

  /* every PNG is rendered before anything in the folder is moved, so a failed render changes nothing */
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const j of jobs) j.png = await toPng(j.svg, null, browser);
  } finally {
    await browser.close();
  }
  for (const a of olderVersions) archived.push(archive(a));
  for (const j of jobs) {
    fs.mkdirSync(path.join(folder, j.dir), { recursive: true });
    for (const ext of ['svg', 'png']) {
      const rel = j.dir + '/' + j.base + '.' + ext;
      if (fs.existsSync(path.join(folder, rel))) archived.push(archive(rel));
    }
    fs.writeFileSync(path.join(folder, j.dir, j.base + '.svg'), j.svg);
    fs.writeFileSync(path.join(folder, j.dir, j.base + '.png'), j.png);
    written.push(j.dir + '/' + j.base + '.svg', j.dir + '/' + j.base + '.png');
  }

  const noteRel = 'Design/run-v' + version + '.md';
  if (fs.existsSync(path.join(folder, noteRel))) archived.push(archive(noteRel));

  const list = (arr, none) => arr.length ? arr.map(x => '- ' + x).join('\n') : '- ' + none;
  const note = [
    '# Floorplan run, version ' + version,
    '',
    'Date: ' + today,
    'Job: ' + plan.job.label,
    'Version: ' + version + (alt ? ' (alternate layout)' : ''),
    '',
    '## Where the plan came from',
    list(plan.sources.map(s => s.file + ' (' + s.kind + ')' + (s.note ? ': ' + s.note : '')), 'no sources listed'),
    '',
    '## Files written',
    list(written, 'none'),
    '',
    '## Older files moved to the archive',
    list(archived, 'none, nothing was replaced'),
    '',
    '## Warnings',
    list(warnings, 'none'),
    '',
    '## Missing information',
    list(plan.missing || [], 'nothing noted as missing'),
    '',
    '## Uncertain, please check',
    list(plan.uncertain || [], 'nothing noted as uncertain'),
    ''
  ].join('\n');
  fs.writeFileSync(path.join(folder, noteRel), note);

  return { written, archived, warnings };
}

module.exports = { make, toPng };

if (require.main === module) {
  const args = process.argv.slice(2);
  const folder = args[0];
  const opt = n => { const i = args.indexOf(n); return i > 0 ? args[i + 1] : undefined; };
  (async () => {
    if (!folder || folder.startsWith('--')) throw new Error('Usage: node scripts/make-floorplan.js "<Floorplan folder>" --version <N> [--facts \'{"beds":2,"baths":2}\']');
    const v = Number(opt('--version'));
    let facts;
    if (opt('--facts')) {
      try { facts = JSON.parse(opt('--facts')); } catch (e) { throw new Error('--facts must be JSON like {"beds":2,"baths":2}'); }
    }
    const r = await make(folder, { version: v, facts });
    console.log('Floorplan version ' + v + ' is done.');
    console.log('Saved ' + r.written.length + ' files:');
    r.written.forEach(f => console.log('  ' + f));
    if (r.archived.length) { console.log('Moved ' + r.archived.length + ' older files to the archive:'); r.archived.forEach(f => console.log('  ' + f)); }
    if (r.warnings.length) { console.log('Things to look at:'); r.warnings.forEach(w => console.log('  ' + w)); }
    console.log('A run note is in Design/run-v' + v + '.md');
  })().catch(e => { console.error(e.message); process.exit(1); });
}
