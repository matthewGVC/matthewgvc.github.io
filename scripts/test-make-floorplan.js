/* ============================================================
   Tests for scripts/make-floorplan.js. Works only in temp folders under the repo's tmp/.
   Plain Node:  node scripts/test-make-floorplan.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { make } = require('./make-floorplan.js');
const studio = require('./floorplan/fixtures/studio.json');

const TMP_ROOT = path.join(__dirname, '..', 'tmp', 'test-make-floorplan');
let passed = 0, failed = 0, n = 0;

function planWith(over) {
  const p = JSON.parse(JSON.stringify(studio));
  p.job.label = '333 E43 417';
  return Object.assign(p, over || {});
}
function folder(plan) {
  const dir = path.join(TMP_ROOT, 'f' + (++n));
  fs.mkdirSync(path.join(dir, 'Design'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Design', 'plan.json'), JSON.stringify(plan));
  return dir;
}
async function t(name, fn) {
  try { await fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); }
}
function eq(a, b) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function ok(c, m) { if (!c) throw new Error(m); }
function listAll(dir) {
  const out = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : out.push(path.relative(dir, p).split(path.sep).join('/')); } })(dir);
  return out.sort();
}

(async () => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });

  await t('refuses an invalid plan', async () => {
    const dir = folder(planWith({ schema: 2 }));
    let msg = null;
    try { await make(dir, { version: 3 }); } catch (e) { msg = e.message; }
    ok(msg && msg.startsWith('plan.json is not valid:'), 'message was ' + msg);
    eq(listAll(dir), ['Design/plan.json']);
  });

  await t('one level writes four files', async () => {
    const dir = folder(planWith());
    const r = await make(dir, { version: 3, today: '2026-10-27' });
    eq(r.written.slice().sort(), ['Branded/333 E43 417 v3.png', 'Branded/333 E43 417 v3.svg', 'Unbranded/333 E43 417 v3.png', 'Unbranded/333 E43 417 v3.svg']);
    for (const f of r.written) ok(fs.existsSync(path.join(dir, f)), f + ' missing');
  });

  await t('levels are named', async () => {
    const p = planWith();
    const l2 = JSON.parse(JSON.stringify(p.levels[0]));
    p.levels[0].name = 'First Floor'; l2.name = 'Second Floor';
    p.levels.push(l2);
    const dir = folder(p);
    const r = await make(dir, { version: 3, today: '2026-10-27' });
    eq(r.written.length, 8);
    ok(r.written.some(f => f.endsWith(' v3 - First Floor.svg')), 'first');
    ok(r.written.some(f => f.endsWith(' v3 - Second Floor.svg')), 'second');
  });

  await t('alternate layout and forbidden characters', async () => {
    const p = planWith({ layout: 'alternate' });
    p.job.label = '333 E43: 417?';
    const dir = folder(p);
    const r = await make(dir, { version: 2, today: '2026-10-27' });
    ok(r.written.includes('Unbranded/333 E43 417 v2 Alternate.svg'), r.written.join('|'));
  });

  await t('second run archives the first', async () => {
    const dir = folder(planWith());
    const r1 = await make(dir, { version: 3, today: '2026-10-27' });
    const before = {};
    for (const f of r1.written) before[f] = fs.readFileSync(path.join(dir, f));
    const r2 = await make(dir, { version: 3, today: '2026-10-27' });
    eq(r2.archived.length, 4);
    for (const a of r2.archived) ok(a.startsWith('Design/archive/2026-10-27/'), a);
    const archivedBytes = r2.archived.map(a => fs.readFileSync(path.join(dir, a)));
    for (const f of r1.written) {
      ok(archivedBytes.some(b => b.equals(before[f])), 'not archived byte-identical: ' + f);
    }
  });

  await t('png size', async () => {
    const dir = folder(planWith());
    const r = await make(dir, { version: 3 });
    const b = fs.readFileSync(path.join(dir, r.written.find(f => f.endsWith('.png'))));
    eq([b.readUInt32BE(16), b.readUInt32BE(20)], [3375, 2625]);
  });

  await t('writes a run note', async () => {
    const p = planWith({ missing: ['ceiling heights'], uncertain: ['bath door swing'] });
    const dir = folder(p);
    await make(dir, { version: 3, today: '2026-10-27' });
    const note = fs.readFileSync(path.join(dir, 'Design', 'run-v3.md'), 'utf8');
    ok(note.includes('cubicasa-png') || note.includes('Design/example.png'), 'sources');
    ok(note.includes('ceiling heights'), 'missing');
    ok(note.includes('bath door swing'), 'uncertain');
    ok(/warning/i.test(note), 'warnings heading');
    ok(note.includes('2026-10-27'), 'date');
  });

  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
