/* ============================================================
   Tests for the helper's PDF saving rules (helper/pdf/name.js, guard.js):
   predictable names, never overwriting, and never writing outside the
   folders the helper is allowed to write to.

   Plain Node:  node scripts/test-pdf-name.js
   ============================================================ */
'use strict';

const fs = require('fs'), os = require('os'), path = require('path');
const { outputName, savePdf } = require('../helper/pdf/name.js');
const { insideRoots } = require('../helper/pdf/guard.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

(async () => {
  check('first', outputName('Showsheet', '1050 Park Ave 13C', '2026-10-19', []), 'Showsheet - 1050 Park Ave 13C - 2026-10-19.pdf');
  check('second', outputName('Showsheet', '1050 Park Ave 13C', '2026-10-19', ['Showsheet - 1050 Park Ave 13C - 2026-10-19.pdf']),
    'Showsheet - 1050 Park Ave 13C - 2026-10-19 (2).pdf');
  check('third', outputName('Showsheet', 'X 1', '2026-10-19', ['Showsheet - X 1 - 2026-10-19.pdf', 'Showsheet - X 1 - 2026-10-19 (2).pdf']),
    'Showsheet - X 1 - 2026-10-19 (3).pdf');
  check('case-insensitive clash', outputName('Showsheet', 'X 1', '2026-10-19', ['showsheet - x 1 - 2026-10-19.PDF']), 'Showsheet - X 1 - 2026-10-19 (2).pdf');
  check('no unit, clean spaces', outputName('Brochure', '6 Johnny Dr ', '2026-10-19', []), 'Brochure - 6 Johnny Dr - 2026-10-19.pdf');
  check('illegal chars', outputName('Showsheet', '401 E89 18/19E', '2026-10-19', []), 'Showsheet - 401 E89 18-19E - 2026-10-19.pdf');
  check('more illegal chars', outputName('Showsheet', 'A:B*C?"<>|', '2026-10-19', []), 'Showsheet - A-B-C - 2026-10-19.pdf');

  const ROOTS = ['G:\\My Drive\\GVC Workspace Lab'];
  check('inside', insideRoots('G:\\My Drive\\GVC Workspace Lab', ROOTS), true);
  check('inside sub', insideRoots('g:\\my drive\\gvc workspace lab\\a', ROOTS), true);
  check('forward slashes', insideRoots('G:/My Drive/GVC Workspace Lab/a', ROOTS), true);
  check('shared drives', insideRoots('G:\\Shared drives\\GVC - New York', ROOTS), false);
  check('dotdot escape', insideRoots('G:\\My Drive\\GVC Workspace Lab\\..\\..\\Shared drives', ROOTS), false);
  check('prefix trick', insideRoots('G:\\My Drive\\GVC Workspace Lab2', ROOTS), false);
  check('relative path', insideRoots('GVC Workspace Lab', ROOTS), false);
  check('empty', insideRoots('', ROOTS), false);

  /* the same-second double save: the second gets (2), the first is untouched */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-pdf-'));
  const A = Buffer.from('%PDF-first'), B = Buffer.from('%PDF-second');
  const names = await Promise.all([savePdf(A, tmp, 'Showsheet', 'T 1', '2026-10-19'), savePdf(B, tmp, 'Showsheet', 'T 1', '2026-10-19')]);
  check('double click files', fs.readdirSync(tmp).sort(), ['Showsheet - T 1 - 2026-10-19 (2).pdf', 'Showsheet - T 1 - 2026-10-19.pdf']);
  check('double click returns paths', names.map(n => path.basename(n)).sort(), ['Showsheet - T 1 - 2026-10-19 (2).pdf', 'Showsheet - T 1 - 2026-10-19.pdf']);
  const first = fs.readFileSync(path.join(tmp, 'Showsheet - T 1 - 2026-10-19.pdf'), 'utf8');
  await savePdf(Buffer.from('%PDF-third'), tmp, 'Showsheet', 'T 1', '2026-10-19');
  check('never overwrites', fs.readFileSync(path.join(tmp, 'Showsheet - T 1 - 2026-10-19.pdf'), 'utf8'), first);
  check('third save', fs.existsSync(path.join(tmp, 'Showsheet - T 1 - 2026-10-19 (3).pdf')), true);

  /* a write that fails half way (disk full, Drive dropped) leaves nothing behind */
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gvc-pdf-'));
  const real = fs.writeFileSync;
  fs.writeFileSync = function (file, data, opts) {
    real.call(fs, file, Buffer.from('%PDF-half'), opts);
    const e = new Error('ENOSPC: no space left on device'); e.code = 'ENOSPC'; throw e;
  };
  let failed = null;
  try { await savePdf(Buffer.from('%PDF-full'), tmp2, 'Showsheet', 'T 2', '2026-10-19'); } catch (e) { failed = e.code; }
  fs.writeFileSync = real;
  check('failed write reported', failed, 'ENOSPC');
  check('failed write leaves no file', fs.readdirSync(tmp2), []);

  if (failures.length) {
    console.log(pass + ' passed, ' + failures.length + ' failed\n');
    failures.forEach(f => console.log('  FAIL ' + f));
    process.exit(1);
  }
  console.log(pass + ' passed');
})().catch(e => { console.log('  FAIL ' + (e.stack || e)); process.exit(1); });
