/* ============================================================
   check-tools.js — do the tools follow the house conventions?

   Static check of every tools/<slug>/index.html, no server needed:
     node scripts/check-tools.js            every tool
     node scripts/check-tools.js open-house one tool (or a,b,c)

   What it holds a tool to is written up in
   .claude/skills/building-gvc-tools/SKILL.md. FAIL lines are rules a new
   tool must meet; WARN lines are worth fixing but older tools may carry
   them for a reason. Exit code 1 on any FAIL.

   Redirect stubs (a meta refresh, like tools/cma/) are skipped.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const home = read('index.html');
const verify = read('scripts/verify-local.js');
const interact = read('scripts/interact-local.js');

const slugs = process.argv[2]
  ? process.argv[2].split(',')
  : fs.readdirSync(path.join(ROOT, 'tools')).filter(d => fs.existsSync(path.join(ROOT, 'tools', d, 'index.html')));

/* pinned = an exact x.y.z version in the URL */
const PINNED = /[@/]v?\d+\.\d+\.\d+/;

let failures = 0;

for (const slug of slugs) {
  const file = `tools/${slug}/index.html`;
  if (!fs.existsSync(path.join(ROOT, file))) { console.log(`\n${slug}\n  FAIL no ${file}`); failures++; continue; }
  /* comments stripped: several pages carry notes like "do not put a
     fonts.googleapis.com link back", which must not count as the link */
  const html = read(file).replace(/<!--[\s\S]*?-->/g, '');
  if (/http-equiv=["']refresh/i.test(html)) { console.log(`\n${slug}  (redirect stub, skipped)`); continue; }

  const fail = [], warn = [];
  const head = (html.match(/<head>([\s\S]*?)<\/head>/i) || [, ''])[1];
  const body = html.slice(html.search(/<body/i));
  const has = re => re.test(html);

  /* ---- head ---- */
  if (!has(/<html lang="en">/)) fail.push('<html lang="en"> missing');
  if (!/<meta charset="UTF-8"\s*\/?>/i.test(head)) fail.push('<meta charset="UTF-8"> missing');
  if (!/name="viewport" content="width=device-width, initial-scale=1(\.0)?[",]/.test(head)) fail.push('standard viewport meta missing');
  const title = (head.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
  if (!/ — Matt Bloomfield$/.test(title)) fail.push(`title should end " — Matt Bloomfield" (is "${title}")`);
  if (!/<meta name="description" content="[^"]+"\s*\/?>/.test(head)) fail.push('meta description missing');
  for (const icon of ['monogram.svg', 'monogram-32.png', 'apple-touch-icon-180.png'])
    if (!head.includes(`assets/logos/${icon}`)) fail.push(`icon link ${icon} missing`);
  if (/\/>/.test(head)) warn.push('XHTML-style "/>" in <head>; the house style is plain HTML');

  /* ---- type and styles ---- */
  if (has(/fonts\.googleapis\.com/)) fail.push('Google Fonts link: use ../../assets/css/fonts.css (static fonts embed in PDFs)');
  const css = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1].replace(/\?.*$/, ''));
  const local = css.filter(h => h.startsWith('../../assets/css/')).map(h => h.split('/').pop());
  if (local[0] !== 'fonts.css') fail.push('fonts.css must be the first shared stylesheet');
  if (local.indexOf('tokens.css') < 0 || local.indexOf('base.css') < local.indexOf('tokens.css'))
    fail.push('tokens.css then base.css must both be linked, in that order');

  /* ---- body / chrome ---- */
  const bodyTag = (html.match(/<body[^>]*>/i) || [''])[0];
  if (!/data-root="\.\.\/\.\.\/"/.test(bodyTag)) fail.push('<body data-root="../../"> missing');
  const scripts = [...body.matchAll(/<script([^>]*)>/g)].map(m => m[1]);
  const srcs = scripts.map(a => (a.match(/src="([^"]+)"/) || [, ''])[1]);
  const idx = name => srcs.findIndex(s => s.replace(/\?.*$/, '').endsWith('/' + name));
  if (idx('chrome.js') < 0) fail.push('assets/js/chrome.js not loaded (masthead, footer)');
  if (!/<h1[\s>]/.test(html)) fail.push('no <h1> (builders use <h1 class="visually-hidden">)');
  if ((html.match(/<main[\s>]/g) || []).length > 1) warn.push('more than one <main>: the builder #stage should be a <div>');

  /* ---- external scripts and styles ---- */
  const external = [...html.matchAll(/<(script|link)\b([^>]*(?:src|href)="(https?:\/\/[^"]+)"[^>]*)>/g)]
    .filter(m => m[1] === 'script' || /rel="stylesheet"/.test(m[2]));
  for (const [, , attrs, url] of external) {
    if (/fonts\.googleapis/.test(url)) continue;
    if (!PINNED.test(url)) fail.push(`CDN not pinned to an exact version: ${url}`);
    if (!/integrity="sha(256|384|512)-/.test(attrs)) fail.push(`CDN without SRI integrity: ${url}`);
    else if (!/crossorigin="anonymous"/.test(attrs)) fail.push(`SRI without crossorigin="anonymous": ${url}`);
  }

  /* ---- panel, labels, unsaved ---- */
  const panel = has(/id="editor"/) ? 'builder' : has(/class="sidebar"/) ? 'map' : has(/class="controls"/) ? 'watermark' : null;
  if (panel) {
    const pc = idx('panel-collapse.js');
    const lastInline = scripts.map((a, i) => (/src=/.test(a) ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
    if (pc < 0) fail.push('side panel without assets/js/panel-collapse.js');
    else if (pc < lastInline) fail.push('panel-collapse.js must load after the tool script');
    if (!local.includes('panel-collapse.css')) fail.push('side panel without assets/css/panel-collapse.css');
    else if (local[local.length - 1] !== 'panel-collapse.css') warn.push('panel-collapse.css should be the last stylesheet');
    if (panel !== 'watermark' && !/data-foot="none"/.test(bodyTag)) (panel === 'builder' ? fail : warn).push('full-height panel tool without <body data-foot="none"> (footer lands under the app)');
  }
  /* controls in markup, in template strings, or built with createElement */
  const controls = /<(input|select|textarea)\b|createElement\(\s*['"](input|select|textarea)['"]/.test(body);
  if (controls && idx('field-labels.js') < 0)
    fail.push('form controls without assets/js/field-labels.js (captions not linked to controls)');
  if (/id="editor"/.test(html) && controls && idx('unsaved.js') < 0)
    warn.push('builder with typed fields but no unsaved.js (no "leave page?" warning)');

  /* ---- colour: tokens, not hex, in the tool's own <style> ---- */
  const style = (head.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('')
    .replace(/<\/?style[^>]*>/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = [...new Set(style.match(/#[0-9a-fA-F]{3,8}\b/g) || [])].filter(h => !/^#f{3}(f{3})?$/i.test(h)); /* white is fine */
  if (hex.length) warn.push(`hex colours in <style> (use tokens): ${hex.slice(0, 6).join(' ')}${hex.length > 6 ? ' …' : ''}`);

  /* ---- builder shell ---- */
  if (/id="btnPrint"/.test(html) && !/id="btnPrint"[^>]*>[\s\S]{0,400}?Print \/ Save PDF/.test(html))
    warn.push('print button label differs from "Print / Save PDF"');

  /* ---- site wiring ---- */
  if (!home.includes(`href="tools/${slug}/"`)) fail.push('no tile on the homepage (index.html)');
  if (!verify.includes(`'/tools/${slug}/'`)) fail.push('not in scripts/verify-local.js PAGES');
  if (!new RegExp(`'${slug}'`).test(interact.match(/const ALL = \[[\s\S]*?\];/)[0])) fail.push('not in scripts/interact-local.js ALL');

  failures += fail.length;
  console.log(`\n${slug}${fail.length + warn.length ? '' : '  ok'}`);
  fail.forEach(m => console.log('  FAIL ' + m));
  warn.forEach(m => console.log('  warn ' + m));
}

console.log(failures ? `\n${failures} failure(s)` : '\nall tools follow the conventions');
process.exit(failures ? 1 : 0);
