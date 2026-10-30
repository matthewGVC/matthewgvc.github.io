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
  p.north = 0;
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

  await t('one level writes four files: PNGs in Unbranded/ and Branded/, SVGs in Design/', async () => {
    const dir = folder(planWith());
    const r = await make(dir, { version: 3, today: '2026-10-27' });
    eq(r.written.slice().sort(), ['Branded/333 E43 417 v3.png', 'Design/Branded/333 E43 417 v3.svg', 'Design/Unbranded/333 E43 417 v3.svg', 'Unbranded/333 E43 417 v3.png']);
    for (const f of r.written) ok(fs.existsSync(path.join(dir, f)), f + ' missing');
  });

  await t('levels are named, and the floors also share one sheet', async () => {
    const p = planWith();
    const l2 = JSON.parse(JSON.stringify(p.levels[0]));
    p.levels[0].name = 'First Floor'; l2.name = 'Second Floor';
    p.levels.push(l2);
    const dir = folder(p);
    const r = await make(dir, { version: 3, today: '2026-10-27' });
    eq(r.written.length, 12);
    ok(r.written.some(f => f.endsWith(' v3 - First Floor.svg')), 'first');
    ok(r.written.some(f => f.endsWith(' v3 - Second Floor.svg')), 'second');
    ok(['Design/Unbranded/333 E43 417 v3.svg', 'Branded/333 E43 417 v3.png'].every(f => r.written.includes(f)), 'the all-floors sheet');
    ok(/data-level="2"/.test(fs.readFileSync(path.join(dir, 'Design', 'Branded', '333 E43 417 v3.svg'), 'utf8')), 'both floors on it');
  });

  await t('alternate layout and forbidden characters', async () => {
    const p = planWith({ layout: 'alternate' });
    p.job.label = '333 E43: 417?';
    const dir = folder(p);
    const r = await make(dir, { version: 2, today: '2026-10-27' });
    ok(r.written.includes('Design/Unbranded/333 E43 417 v2 Alternate.svg'), r.written.join('|'));
  });

  await t('second run archives the first', async () => {
    const dir = folder(planWith());
    const r1 = await make(dir, { version: 3, today: '2026-10-27' });
    const before = {};
    for (const f of r1.written) before[f] = fs.readFileSync(path.join(dir, f));
    const r2 = await make(dir, { version: 3, today: '2026-10-27' });
    eq(r2.archived.length, 5);  // four plan files + the run note
    for (const a of r2.archived) ok(a.startsWith('Design/archive/2026-10-27/'), a);
    const archivedBytes = r2.archived.map(a => fs.readFileSync(path.join(dir, a)));
    for (const f of r1.written) {
      ok(archivedBytes.some(b => b.equals(before[f])), 'not archived byte-identical: ' + f);
    }
  });

  await t('third run keeps every archived copy', async () => {
    const dir = folder(planWith());
    const r1 = await make(dir, { version: 3, today: '2026-10-27' });
    const r2 = await make(dir, { version: 3, today: '2026-10-27' });
    const r3 = await make(dir, { version: 3, today: '2026-10-27' });
    eq(r1.archived.length, 0);
    eq(r2.archived.length, 5);  // four plan files + the run note
    eq(r3.archived.length, 5);
    const all = listAll(dir).filter(f => f.startsWith('Design/archive/2026-10-27/'));
    eq(all.length, 10);
    ok(r3.archived.filter(a => !a.endsWith('.md')).every(a => / \(2\)\.(svg|png)$/.test(a)), r3.archived.join('|'));
    eq(r2.archived.concat(r3.archived).filter(a => !all.includes(a)), []);
  });

  await t('a new version archives the older versions, leaves other files alone', async () => {
    const dir = folder(planWith());
    await make(dir, { version: 2, today: '2026-10-27' });
    const alt = planWith({ layout: 'alternate' });
    fs.writeFileSync(path.join(dir, 'Design', 'plan.json'), JSON.stringify(alt));
    await make(dir, { version: 2, today: '2026-10-27' });
    fs.writeFileSync(path.join(dir, 'Unbranded', 'Matt hand drawn.png'), 'x');
    fs.writeFileSync(path.join(dir, 'Design', 'plan.json'), JSON.stringify(planWith()));
    const r = await make(dir, { version: 3, today: '2026-10-28' });
    eq(r.archived.slice().sort(), ['Design/archive/2026-10-28/Branded/333 E43 417 v2.png', 'Design/archive/2026-10-28/Design/Branded/333 E43 417 v2.svg',
      'Design/archive/2026-10-28/Design/Unbranded/333 E43 417 v2.svg', 'Design/archive/2026-10-28/Unbranded/333 E43 417 v2.png']);
    eq(listAll(dir).filter(f => f.startsWith('Unbranded/')), ['Unbranded/333 E43 417 v2 Alternate.png', 'Unbranded/333 E43 417 v3.png', 'Unbranded/Matt hand drawn.png']);
    eq(listAll(dir).filter(f => f.startsWith('Design/Unbranded/')), ['Design/Unbranded/333 E43 417 v2 Alternate.svg', 'Design/Unbranded/333 E43 417 v3.svg']);
  });

  await t('an SVG of ours left in Unbranded/ or Branded/ (the old layout) moves to the archive, even this version', async () => {
    const dir = folder(planWith());
    fs.mkdirSync(path.join(dir, 'Unbranded'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'Unbranded', '333 E43 417 v3.svg'), '<svg/>');
    fs.writeFileSync(path.join(dir, 'Unbranded', 'Matt hand drawn.svg'), '<svg/>');
    const r = await make(dir, { version: 3, today: '2026-10-28' });
    ok(r.archived.includes('Design/archive/2026-10-28/Unbranded/333 E43 417 v3.svg'), r.archived.join('|'));
    eq(listAll(dir).filter(f => f.startsWith('Unbranded/')), ['Unbranded/333 E43 417 v3.png', 'Unbranded/Matt hand drawn.svg']);
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
    ok(note.includes('## Where the plan came from\n- Design/example.png (cubicasa-png)\n'), 'sources line');
    ok(note.includes('## Missing information\n- ceiling heights\n'), 'missing');
    ok(note.includes('## Uncertain, please check\n- bath door swing\n'), 'uncertain');
    ok(note.includes('## Warnings\n- none\n'), 'no warnings');
    ok(note.includes('Date: 2026-10-27\n'), 'date');
  });

  await t('warnings appear verbatim in the note and result', async () => {
    const p = planWith();
    p.levels[0].rooms = [{ name: 'PRIMARY BEDROOM / LIBRARY', size: null, at: [20, 20], rot: 0, box: [0, 0, 40, 40] }];
    const expected = require('./floorplan/plan.js').validate(p).warnings;
    eq(expected.length, 1);
    const dir = folder(p);
    const r = await make(dir, { version: 4, today: '2026-10-27' });
    eq(r.warnings, expected);
    const note = fs.readFileSync(path.join(dir, 'Design', 'run-v4.md'), 'utf8');
    ok(note.includes('## Warnings\n- ' + expected[0] + '\n'), 'warning text');
  });

  await t('second run archives the first run note', async () => {
    const dir = folder(planWith());
    await make(dir, { version: 3, today: '2026-10-27' });
    const first = fs.readFileSync(path.join(dir, 'Design', 'run-v3.md'));
    const r2 = await make(dir, { version: 3, today: '2026-10-27' });
    const a = 'Design/archive/2026-10-27/Design/run-v3.md';
    ok(r2.archived.includes(a), r2.archived.join('|'));
    ok(fs.readFileSync(path.join(dir, a)).equals(first), 'note not byte-identical');
    ok(fs.readFileSync(path.join(dir, 'Design', 'run-v3.md'), 'utf8').includes(a), 'new note lists the archived note');
  });

  await t('an alternate run keeps the current layout\'s run note', async () => {
    const dir = folder(planWith());
    await make(dir, { version: 3, today: '2026-10-27' });
    const current = fs.readFileSync(path.join(dir, 'Design', 'run-v3.md'));
    fs.writeFileSync(path.join(dir, 'Design', 'plan.json'), JSON.stringify(planWith({ layout: 'alternate' })));
    const r = await make(dir, { version: 3, today: '2026-10-27' });
    eq(r.note, 'Design/run-v3 Alternate.md');
    ok(!r.archived.some(f => /run-v3\.md$/.test(f)), r.archived.join('|'));
    ok(fs.readFileSync(path.join(dir, 'Design', 'run-v3.md')).equals(current), 'current note changed');
  });

  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
