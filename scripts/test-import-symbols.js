/* ============================================================
   Tests for scripts/floorplan/import-symbols.js: a style sheet round-trips. The sheet's symbol-<name>
   cells, read straight back, give the same symbols (same size, same weights, same colours).
   Needs Playwright, and scikit-image only for fill-line art (none on the sheet: it is stored as lines).
   Plain Node:  node scripts/test-import-symbols.js
   ============================================================ */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { sheet } = require('./floorplan/style-sheet.js');
const SYM = require('./floorplan/symbols.json');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-symbols-'));
try {
  const svg = path.join(dir, 'sheet.svg'), out = path.join(dir, 'symbols.json');
  fs.writeFileSync(svg, sheet());
  fs.copyFileSync(path.join(__dirname, 'floorplan', 'symbols.json'), out);   // keeps each symbol's mode
  cp.execFileSync(process.execPath, [path.join(__dirname, 'floorplan', 'import-symbols.js'), svg, '--out', out], { stdio: 'pipe' });
  const back = JSON.parse(fs.readFileSync(out, 'utf8'));
  const names = Object.keys(SYM).filter((n) => n !== 'compass');   // the compass cell is drawn at the frame's size, not inches
  check('every symbol comes back', names.filter((n) => !back[n]), []);
  names.forEach((n) => {
    const a = SYM[n], b = back[n];
    if (!b) return;
    check(n + ': same size (within 0.3 in)', [Math.abs(a.size[0] - b.size[0]) < 0.3, Math.abs(a.size[1] - b.size[1]) < 0.3], [true, true]);
    const look = (s) => [...new Set(s.paths.map((p) => [p.fill || '-', p.stroke || '-', p.weight || (p.sw ? 'sw' : '')].join('/')))].sort();
    check(n + ': same colours and weights', look(b), look(a));
  });
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

if (failures.length) { console.log(failures.join('\n')); console.log(pass + ' passed, ' + failures.length + ' FAILED'); process.exit(1); }
console.log(pass + ' passed');
