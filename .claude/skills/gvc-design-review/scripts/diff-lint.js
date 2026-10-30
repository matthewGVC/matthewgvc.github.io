/* ============================================================
   diff-lint.js — static design-rule scan for GVC Workspace changes.

   Flags the rules in gvc-design-standards that a pattern can decide.
   It is a first pass: every hit is a lead to read in context, not a
   verdict. Commented-out code is ignored (HTML comments and block
   comments are blanked before matching), and by default only lines the
   change ADDS are reported, so legacy hex in untouched lines never shows up.

     node .claude/skills/gvc-design-review/scripts/diff-lint.js            added lines vs main
     node .claude/skills/gvc-design-review/scripts/diff-lint.js <ref>      added lines vs another ref
     node .claude/skills/gvc-design-review/scripts/diff-lint.js --all      every in-scope file, whole

   Covers working-tree changes to tracked files and brand-new untracked
   files. Exit code 1 on any ERROR; WARN lines never fail the run.
   Run from the repo root (it shells out to git there).
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const BASE = args.find(a => !a.startsWith('--')) || 'main';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/* in scope: the places the design rules govern */
const IN_SCOPE = /^(tools\/|workspace\/|listing-rules\/|assets\/css\/|assets\/js\/|index\.html$|404\.html$|README\.md$)/;
const TEXT = /\.(html|css|js|md)$/;
const IMAGE = /\.(jpe?g|png)$/i;
const isLineComment = line => /^\s*(\/\/|\/\*|\*)/.test(line);

/* blank out comments but keep line numbers: lint what runs, not what is noted */
function codeLines(file, text) {
  let src = text;
  if (/\.html$/.test(file)) src = src.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  if (/\.(css|js|html)$/.test(file)) src = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  return src.split('\n');
}

/* ---- rules ----------------------------------------------------------
   applies(file) gates a rule to a file; test(line) is true when the line breaks it. */
const RULES = [
  { sev: 'ERROR', id: 'google-fonts', why: 'tools load fonts from assets/css/fonts.css only (variable fonts print as Type3)',
    applies: f => f.startsWith('tools/') && /\.html$/.test(f),
    test: l => /fonts\.googleapis\.com/.test(l) },
  { sev: 'ERROR', id: 'eyebrow', why: 'decorative eyebrow or "Tool ·" meta text is rejected (gvc-design-standards)',
    applies: f => /\.(html|js)$/.test(f),
    test: l => /GVC Real Estate\s*·|\bTool\s*·|·\s*Tool\b/.test(l) },
  { sev: 'ERROR', id: 'gradient-text', why: 'gradient text is rejected by the brand',
    applies: f => /\.(html|css|js)$/.test(f),
    test: l => /background-clip\s*:\s*text/.test(l) },
  { sev: 'ERROR', id: 'cdn-no-sri', why: 'every external script or stylesheet needs a pinned x.y.z version and an integrity hash',
    applies: f => f.startsWith('tools/') && /\.html$/.test(f),
    test: l => /<script\b[^>]*\bsrc=["']https:\/\/|<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']https:\/\//.test(l) &&
      !/fonts\.googleapis\.com/.test(l) && (!/integrity=/.test(l) || !/(src|href)=["']https:\/\/[^"']*[@/]v?\d+\.\d+\.\d+/.test(l)) },
  { sev: 'ERROR', id: 'bad-sri', why: 'an integrity value must be a real sha256/384/512 digest (base64), not a placeholder',
    applies: f => f.startsWith('tools/') && /\.html$/.test(f),
    test: l => /integrity=["'][^"']*["']/.test(l) && !/integrity=["']sha(256|384|512)-[A-Za-z0-9+/]{43,}={0,2}["']/.test(l) },
  { sev: 'WARN', id: 'hex-colour', why: 'use the surface tokens, not new hex (legacy hex is a known warning)',
    applies: f => (f.startsWith('tools/') || f.startsWith('workspace/') || f.startsWith('assets/css/') || f.startsWith('assets/js/')) &&
      /\.(html|css|js)$/.test(f) && f !== 'assets/css/tokens.css',
    test: l => /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/.test(l) },
  { sev: 'WARN', id: 'sky-or-cyan-text', why: 'Sky is never text on Paper; Cyan is decorative on Paper. Confirm the surface is Navy',
    applies: f => /\.(html|css|js)$/.test(f),
    test: l => /(^|[;{\s])color\s*:\s*var\(--(sky|sky2|cyan)\)/.test(l) },
  { sev: 'WARN', id: 'backdrop-filter', why: 'glass panels are rejected unless deliberate',
    applies: f => /\.(html|css|js)$/.test(f),
    test: l => /backdrop-filter\s*:/.test(l) },
  { sev: 'WARN', id: 'placeholder-text', why: 'invented or placeholder content: confirm it is test data kept out of the output',
    applies: f => /\.(html|js)$/.test(f),
    test: l => /lorem ipsum|John Doe|Jane Doe|123 Main St|example\.com/i.test(l) || /\bTODO\b|\bFIXME\b/.test(l) },
  { sev: 'WARN', id: 'img-no-alt', why: 'images need alt text (decorative images use alt="")',
    applies: f => /\.html$/.test(f),
    test: l => /<img\b/i.test(l) && !/\balt\s*=/.test(l) },
  { sev: 'WARN', id: 'claude-in-workspace', why: 'keep "Claude" out of workspace pages and docs (standing request)',
    applies: f => f.startsWith('tools/') || f.startsWith('workspace/') || f.startsWith('assets/') || f === 'index.html' || f === 'README.md',
    test: l => /\bClaude\b/.test(l) },
];

/* ---- which lines does this change add? ---------------------------------- */
function addedByFile() {
  const out = new Map(); /* file -> Set of line numbers */
  const diff = git('diff', '-U0', BASE, '--');
  let file = null, n = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '');
      if (file === '/dev/null' || !IN_SCOPE.test(file)) file = null;
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { n = parseInt(hunk[1], 10); continue; }
    if (!file || raw.startsWith('---')) continue;
    if (raw.startsWith('+')) { if (!out.has(file)) out.set(file, new Set()); out.get(file).add(n); n++; }
    else if (raw.startsWith(' ')) n++;
  }
  return out;
}

/* brand-new files: every line counts as added; the export-name check sees them too */
const UNTRACKED = git('ls-files', '--others', '--exclude-standard').split('\n').filter(f => f && fs.existsSync(f));

function trackedInScope() {
  return git('ls-files').split('\n').filter(f => f && IN_SCOPE.test(f) && fs.existsSync(f));
}

/* ---- run ---------------------------------------------------------------- */
const findings = [];
const seen = new Set();
function report(sev, file, line, id, why, text) {
  const key = [file, line, id].join('|');
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({ sev, file, line, id, why, text: text.trim().slice(0, 110) });
}

const added = ALL ? null : addedByFile();
const files = ALL ? trackedInScope() : [...new Set([...added.keys(), ...UNTRACKED])];

for (const file of files) {
  /* a data export that enters git is a finding by name, wherever it sits */
  if (/(\.csv$|textexport)/i.test(file)) report('ERROR', file, 0, 'data-export',
    'MLS and owner exports carry personal data and are never committed', '(file name)');

  /* scratch left at the repo root (out.txt, *-test.*) belongs in tmp/ */
  if (UNTRACKED.includes(file) && !file.includes('/') && !/\.(md|gitignore|gitattributes|nojekyll)$|^(index|404)\.html$/.test(file))
    report('WARN', file, 0, 'stray-file', 'untracked file at the repo root: scratch belongs in tmp/', '(file name)');

  if (!IN_SCOPE.test(file)) continue;

  if (IMAGE.test(file)) {
    const size = fs.statSync(file).size;
    if (size > 2 * 1024 * 1024) report('WARN', file, 0, 'large-image',
      'over 2 MB: confirm it is needed (no site image is over today)', (size / 1048576).toFixed(1) + ' MB');
    continue;
  }
  if (!TEXT.test(file)) continue;

  const lines = codeLines(file, fs.readFileSync(file, 'utf8'));
  const wanted = (ALL || UNTRACKED.includes(file)) ? null : (added.get(file) || new Set());
  lines.forEach((text, i) => {
    const n = i + 1;
    if (wanted && !wanted.has(n)) return;
    if (isLineComment(text)) return;
    for (const r of RULES) {
      if (r.applies(file) && r.test(text)) report(r.sev, file, n, r.id, r.why, text);
    }
  });
}

/* ---- stamps: removing one without its data is a finding ------------------ */
const STAMP = /List needed|Partner to be added|Work in progress|Needs updating|\bCHECK\b/;
if (!ALL) {
  const diff = git('diff', '-U0', BASE, '--');
  let file = null;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) { file = raw.slice(4).replace(/^b\//, ''); if (file === '/dev/null') file = null; continue; }
    if (raw.startsWith('--- ') || !file || !raw.startsWith('-') || !STAMP.test(raw)) continue;
    const label = raw.slice(1).trim();
    const still = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (!still.includes(label.slice(0, 20))) report('WARN', file, 0, 'stamp-removed',
      'a stamp was removed: confirm the real content arrived and is sourced', label);
  }
}

/* ---- report ---------------------------------------------------------- */
const order = { ERROR: 0, WARN: 1 };
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.file.localeCompare(b.file) || a.line - b.line);
console.log(`design-lint: ${ALL ? 'every in-scope file' : 'lines added since ' + BASE}\n`);
if (!findings.length) console.log('No findings. A clean scan is not sign-off: read the change and check the PDF or screen.');
for (const f of findings) {
  console.log(`${f.sev.padEnd(5)} ${f.file}${f.line ? ':' + f.line : ''}  [${f.id}]  ${f.why}`);
  console.log(`      ${f.text}`);
}
const errors = findings.filter(f => f.sev === 'ERROR').length;
console.log(`\n${errors} error(s), ${findings.length - errors} warning(s).`);
process.exit(errors ? 1 : 0);
