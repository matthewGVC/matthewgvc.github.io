/* ============================================================
   Tests for scripts/floorplan/plan.js — the plan description and its validator.
   Plain Node:  node scripts/test-floorplan-plan.js
   ============================================================ */
'use strict';

const { validate } = require('./floorplan/plan.js');
const studio = require('./floorplan/fixtures/studio.json');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const has = (r, msg) => r.errors.includes(msg);

check('fixture is valid', validate(studio).errors, []);
check('the skill\'s worked example (555 W59 PHC) is valid', validate(require('./floorplan/fixtures/555-w59-phc.json')), { errors: [], warnings: [] });
check('fixture has no warnings', validate(studio).warnings, []);

check('schema must be 1', has(validate({ ...clone(studio), schema: 2 }), 'schema must be 1'), true);

let p = clone(studio); p.levels[0].fixtures[0].type = 'piano';
check('unknown fixture type', has(validate(p), 'level 1 fixture 1: unknown type "piano"'), true);

p = clone(studio); p.levels[0].openings[0].wall = 99;
check('opening points at a missing wall', has(validate(p), 'level 1 opening 1: no wall 99'), true);

p = clone(studio); p.levels[0].rooms[0].name = 'Living room';
check('room name must be capitals', has(validate(p), 'level 1 room "Living room": name must be in capitals'), true);

p = clone(studio); p.levels[0].rooms[0].size = '12 by 20';
check('size format', has(validate(p), 'level 1 room "LIVING ROOM": size must look like 12\'0" x 20\'3"'), true);
p = clone(studio); p.levels[0].rooms[0].size = null;
check('null size is fine', validate(p).errors, []);

p = clone(studio);
p.levels[0].rooms = [{ name: 'PRIMARY BEDROOM / LIBRARY', size: null, at: [20, 20], rot: 0, box: [0, 0, 40, 40] }];
let r = validate(p);
check('label wider than its room warns', [r.warnings.length, r.errors], [1, []]);

p = clone(studio); p.levels.push(clone(p.levels[0])); p.levels[0].name = 'LOWER LEVEL';
check('multi-level needs names', has(validate(p), 'level 2: a plan with several levels needs every level named'), true);

if (failures.length) {
  console.log(failures.join('\n'));
  console.log(pass + ' passed, ' + failures.length + ' FAILED');
  process.exit(1);
}
console.log(pass + ' passed');
