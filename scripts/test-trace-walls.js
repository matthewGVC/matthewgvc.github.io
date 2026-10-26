/* ============================================================
   Tests for scripts/floorplan/trace-walls.py: wall masses straight from a picture.
   A drawn test plan (thick outer walls, a thinner partition, a column, a window gap, thin text-like
   strokes and a door swing) must come back as its masses only, straight and exact.
   Needs python3 with Pillow, scipy and scikit-image (skipped without them).
   Plain Node:  node scripts/test-trace-walls.js
   ============================================================ */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
if (cp.spawnSync(py, ['-c', 'import skimage, scipy, PIL'], { stdio: 'ignore' }).status !== 0) {
  console.log('(scikit-image, scipy or Pillow not installed: trace-walls checks skipped)');
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-trace-'));
try {
  /* the test picture, drawn with Pillow: 600 x 400, navy walls */
  const draw = `
from PIL import Image, ImageDraw
im = Image.new('RGB', (600, 400), 'white'); d = ImageDraw.Draw(im); N = (0, 39, 58)
d.rectangle([50, 50, 549, 349], fill=N); d.rectangle([70, 70, 529, 329], fill='white')   # outer walls, 20 px
d.rectangle([200, 50, 300, 69], fill='white')                                            # a window gap in the top wall
d.line([200, 60, 300, 60], fill=N, width=2)                                              # its thin glazing line
d.rectangle([301, 70, 310, 329], fill=N)                                                 # a 10 px partition, in line with the gap end
d.rectangle([400, 150, 429, 179], fill=N)                                                # a column
for i in range(8): d.line([100 + i * 12, 200, 106 + i * 12, 215], fill=N, width=3)       # text-like strokes
d.arc([120, 260, 200, 340], 180, 270, fill=N, width=2)                                   # a door swing
d.polygon([(440, 329), (460, 329), (450, 319)], fill=N)                                    # a marker triangle on a wall face (Cubicasa)
d.line([529, 118, 506, 135, 529, 152], fill=N, width=5); d.line([518, 127, 518, 143], fill=N, width=5)   # a bold A, its feet on the right wall
im.save(r'${path.join(dir, 'plan.png')}')`;
  cp.execFileSync(py, ['-c', draw]);
  const out = cp.execFileSync(py, ['-I', path.join(__dirname, 'floorplan', 'trace-walls.py'), path.join(dir, 'plan.png'), path.join(dir, 'walls.json')], { encoding: 'utf8' });
  const res = JSON.parse(fs.readFileSync(path.join(dir, 'walls.json'), 'utf8'));
  check('the picture size is kept', res.size, [600, 400]);
  /* masses: the outer walls and partition as one (the window gap opens the left room to the outline,
     the closed right room is its hole), and the column on its own */
  check('two masses: the walls (with the partition) and the column; no text, swing or glazing', res.solids.length, 2);
  const big = res.solids.find((s) => s.length > 1) || [];
  check('the walls: their outline, gapped at the window, and one hole (the closed room)', [big.length, big[0].length], [2, 10]);
const hole = big[1] || [];
check('a marker or a label touching a wall is no part of it (the triangle cut to a sliver, the strokes gone)',
  [hole.filter(([x, y]) => x > 430 && x < 470).every(([, y]) => y > 324), hole.filter(([x, y]) => y > 110 && y < 160).every(([x]) => x > 527)], [true, true]);
  const col = res.solids.find((s) => s.length === 1) || [[]];
  check('the column is a square, where it was drawn', col[0].length === 4 && col[0].every(([x, y]) => x > 395 && x < 435 && y > 145 && y < 185), true);
  const xs = big[0].map((p) => p[0]), ys = big[0].map((p) => p[1]);
  check('the outline sits on the drawn edge (within 1 px), its corners square', [Math.abs(Math.min(...xs) - 49.5) <= 1, Math.abs(Math.max(...xs) - 549.5) <= 1, Math.abs(Math.min(...ys) - 49.5) <= 1, Math.abs(Math.max(...ys) - 349.5) <= 1,
    big[0].every((p, i) => { const q = big[0][(i + 1) % big[0].length]; return p[0] === q[0] || p[1] === q[1]; })], [true, true, true, true, true]);
  const gapEdges = big[0].filter(([x, y]) => y < 75 && (Math.abs(x - 199.5) <= 1 || Math.abs(x - 300.5) <= 1)).length;
  check('the window gap is a gap, at its drawn ends (the partition runs on from its right end)', gapEdges, 3);
  check('it measures the thin linework, not the walls, to decide what is wall', res.min_wall < 10, true);
  check('and says what it found', /2 wall masses/.test(out), true);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

if (failures.length) { console.log(failures.join('\n')); console.log(pass + ' passed, ' + failures.length + ' FAILED'); process.exit(1); }
console.log(pass + ' passed');
