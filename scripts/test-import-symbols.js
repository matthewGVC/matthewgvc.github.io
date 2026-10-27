/* ============================================================
   Tests for scripts/floorplan/import-symbols.js: a style sheet round-trips. The sheet's symbol-<name>
   cells, read straight back, give the same symbols (same size, same weights, same colours).
   Then centreline.py (fill-line art) on simple shapes: a frame, a T, a ring.
   Needs Playwright; the centreline checks need scikit-image and are skipped without it.
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

/* centreline.py: filled outlines -> clean centre lines (skipped where scikit-image isn't installed) */
const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
if (cp.spawnSync(py, ['-c', 'import skimage'], { stdio: 'ignore' }).status === 0) {
  const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const ring = (r, n = 64) => Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]);
  const groups = [
    { rings: [sq(-10, -10, 10, 10), sq(-9.5, -9.5, 9.5, 9.5)], line: 0.5 },                          // an outlined frame
    { rings: [[[-10, -0.25], [10, -0.25], [10, 0.25], [0.25, 0.25], [0.25, 8], [-0.25, 8], [-0.25, 0.25], [-10, 0.25]]], line: 0.5 },   // a T
    { rings: [ring(6), ring(5.5)], line: 0.5 }                                                       // a ring
  ];
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-centre-test-'));
  try {
    fs.writeFileSync(path.join(d2, 'in.json'), JSON.stringify({ groups }));
    cp.execFileSync(py, ['-I', path.join(__dirname, 'floorplan', 'centreline.py'), path.join(d2, 'in.json'), path.join(d2, 'out.json')]);
    const [frame, tee, circle] = JSON.parse(fs.readFileSync(path.join(d2, 'out.json'), 'utf8')).groups;
    const nums = (d) => (d.match(/-?[\d.]+/g) || []).map(Number);
    check('centreline: an outlined frame is one closed line with four straight sides', [frame.length, /^M[^C]*Z$/.test(frame[0]), (frame[0].match(/L/g) || []).length], [1, true, 4]);
    check('…on its centre line', nums(frame[0]).every((v) => Math.abs(Math.abs(v) - 9.75) < 0.15), true);
    const stemEnd = tee.map(nums).find((v) => Math.max(...v.filter((_, i) => i % 2)) > 7);
    check('centreline: a T is its bar and its stem, the stem meeting the bar', [tee.length, !!stemEnd && Math.min(...stemEnd.filter((_, i) => i % 2)) < 0.15], [2, true]);
    check('centreline: a ring is one smooth closed curve, a few points round', [circle.length, /^M[^L]*Z$/.test(circle[0]), (circle[0].match(/C/g) || []).length <= 8], [1, true, true]);
  } finally {
    fs.rmSync(d2, { recursive: true, force: true });
  }
} else console.log('(scikit-image not installed: centreline checks skipped)');

if (failures.length) { console.log(failures.join('\n')); console.log(pass + ' passed, ' + failures.length + ' FAILED'); process.exit(1); }
console.log(pass + ' passed');
