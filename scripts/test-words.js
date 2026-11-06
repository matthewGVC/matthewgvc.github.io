/* ============================================================
   The team's plain words (assets/js/words.js, overhaul step 2).
     node scripts/test-words.js
   ============================================================ */
const W = require('../assets/js/words.js');
const MK = require('../assets/js/markets.js');
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('  FAIL ' + name + '\n      expected ' + JSON.stringify(want) + '\n      got      ' + JSON.stringify(got));
}
check('DE says', W.plain('Asana says $2.1M; DE says $2.25M.'), 'Asana says $2.1M; Elliman says $2.25M.');
check('DE id and status', W.plain('DE STATUS · DE id 31794304'), 'ELLIMAN STATUS · Elliman listing ID 31794304');
check('a word with DE inside is left alone', W.plain('DEPOSIT, IDEA'), 'DEPOSIT, IDEA');
check('the helper', W.plain('Sync now works only on the PC that runs the helper.'), 'Sync now works only on Matt\'s computer.');
check('a and an', W.plain('Not matched to a DE listing. A DE row.'), 'Not matched to an Elliman listing. An Elliman row.');
check('the emoji', W.plain('from the 🚧 Asana project'), 'from the Asana project');
check('plain twice is the same', W.plain(W.plain('DE says')), 'Elliman says');
check('a check by name', [W.check('M3'), W.check('M28'), W.check('roster')], ['Price', 'Closed, task open', 'roster']);
check('M30 has a short name', W.check('M30'), 'Name rule');
check('every check has a name', Array.from({ length: 28 }, (_, i) => 'M' + (i + 1)).filter(c => !W.CHECK[c]), []);
check('markets', [MK.CODES, MK.byState('ny').code, MK.signage('NYC'), MK.signage('NJ'), MK.houses('FL'), MK.deck('FL'), MK.name('NJ'), MK.get('XX')],
  [['NYC', 'NJ', 'FL'], 'NYC', false, true, true, 'nj', 'New Jersey', null]);
console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
