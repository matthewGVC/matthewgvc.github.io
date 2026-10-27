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
check('fixture has no warnings but its missing north (every branded sheet carries the compass)', [validate({ ...clone(studio), north: 0 }).warnings, validate(studio).warnings.length, /no north/.test(validate(studio).warnings[0])], [[], 1, true]);

check('schema must be 1', has(validate({ ...clone(studio), schema: 2 }), 'schema must be 1'), true);

let p = clone(studio); p.levels[0].fixtures[0].type = 'piano';
check('unknown fixture type', has(validate(p), 'level 1 fixture 1: unknown type "piano"'), true);

p = clone(studio); p.levels[0].openings[0].wall = 99;
check('opening points at a missing wall', has(validate(p), 'level 1 opening 1: no wall 99'), true);

p = clone(studio); p.levels[0].rooms[0].name = 'Living room';
check('room name must be capitals', has(validate(p), 'level 1 room "Living room": name must be in capitals'), true);

p = clone(studio); p.levels[0].rooms[0].size = '12 by 20';
check('size format', has(validate(p), 'level 1 room "LIVING ROOM": size must look like 12\'0" x 20\'3" (or 13\' x 24\', as printed)'), true);
p = clone(studio); p.levels[0].rooms[0].size = '12\' x 19\'6"';
check('a size printed in feet alone on a side is fine', validate(p).errors, []);
p = clone(studio); p.levels[0].rooms[0].size = null;
check('null size is fine', validate(p).errors, []);

p = clone(studio); p.north = 0;
p.levels[0].rooms = [{ name: 'PRIMARY BEDROOM / LIBRARY', size: null, at: [20, 20], rot: 0, box: [0, 0, 40, 40] }];
let r = validate(p);
check('label wider than its room warns', [r.warnings.length, r.errors], [1, []]);

p = clone(studio); p.levels.push(clone(p.levels[0])); p.levels[0].name = 'LOWER LEVEL';
check('multi-level needs names', has(validate(p), 'level 2: a plan with several levels needs every level named'), true);

/* curves, glass, lines */
const arcPlan = (wall, opening) => { const q = clone(studio); q.levels[0].walls[0] = Object.assign({}, q.levels[0].walls[0], wall); if (opening) q.levels[0].openings = [opening]; return validate(q); };
check('a curved wall is valid', arcPlan({ via: [120, -30] }).errors, []);
check('via on the line is refused', has(arcPlan({ via: [120, 0] }), 'level 1 wall 1: via must be [x, y], off the line from a to b'), true);
check('a door on a curved wall is refused', has(arcPlan({ via: [120, -30] }, { wall: 0, from: 0.2, to: 0.4, type: 'door', hinge: 'from', side: 'left' }), 'level 1 opening 1: only a window or an opening can sit on a curved wall'), true);
check('a window on a curved wall is fine', arcPlan({ via: [120, -30] }, { wall: 0, from: 0, to: 1, type: 'window' }).errors, []);
check('glass is a wall type', arcPlan({ type: 'glass' }).errors, []);
let lp = clone(studio); lp.levels[0].lines = [{ pts: [[0, 0]] }];
check('a line needs two points', has(validate(lp), 'level 1 line 1: pts needs at least 2 [x, y] points'), true);
lp = clone(studio); lp.levels[0].fixtures[0].bowls = 3;
check('bowls is 1 or 2', has(validate(lp), 'level 1 fixture 1: bowls must be 1 or 2'), true);

/* furniture, ranges, swatches */
lp = clone(studio); lp.levels[0].fixtures[0] = { type: 'range', at: [0, 0], w: 10, h: 10, burners: 5 };
check('burners is 4 or 6', has(validate(lp), 'level 1 fixture 1: burners must be 4 or 6'), true);
lp = clone(studio); lp.levels[0].fixtures.push({ type: 'dining-table', at: [0, 0], w: 10, h: 10, seats: 6, shape: 'round' }, { type: 'bed', at: [0, 0], w: 10, h: 10 });
check('furniture is valid', validate(lp).errors, []);
lp = clone(studio); lp.levels[0].areas = [{ type: 'floor', pattern: 'marble', poly: [[0, 0], [1, 0], [1, 1]] }];
check('an unknown pattern is refused', has(validate(lp), 'level 1 area 1: unknown pattern "marble"'), true);
lp = clone(studio); lp.levels[0].areas = [{ type: 'stair', break: 2, poly: [[0, 0], [1, 0], [1, 1]] }];
check('break is true or between 0 and 1', has(validate(lp), 'level 1 area 1: break must be true or a number between 0 and 1'), true);

if (failures.length) {
  console.log(failures.join('\n'));
  console.log(pass + ' passed, ' + failures.length + ' FAILED');
  process.exit(1);
}
console.log(pass + ' passed');
