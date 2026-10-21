/* ============================================================
   Tests for assets/js/address-aliases.js — matching DE's address
   spelling ("347 W BROADWAY") to the team's folder names
   ("347 West Broadway", "404 PAS", "565 WEA").

   Plain Node, no install:  node scripts/test-address-aliases.js
   ============================================================ */
'use strict';

const A = require('../assets/js/address-aliases.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

check('W BROADWAY', A.same('347 W BROADWAY', '347 West Broadway'), true);
check('PARK AVE S', A.same('404 PARK AVE S', '404 PAS'), true);
check('W END AVE', A.same('565 W END AVE', '565 WEA'), true);
check('EAST END AVE', A.same('45 EAST END AVE', '45 EEA'), true);
check('Fifth', A.same('1050 5TH AVE', '1050 Fifth Ave'), true);
check('E71', A.same('176 E 71ST ST', '176 E71'), true);
check('W59', A.same('555 W 59TH ST', '555 W59'), true);
check('different street', A.same('176 E 71ST ST', '176 E 72ND ST'), false);
check('different number', A.same('1050 PARK AVE', '1050 FIFTH AVE'), false);
check('St is not Ave', A.same('1 WASHINGTON ST', '1 WASHINGTON AVE'), false);
check('Rd is not Ln', A.same('12 OAK RD', '12 Oak Ln'), false);
check('type missing on one side', A.same('176 E 71ST ST', '176 E71'), true);
check('Park without Ave',A.same('1050 PARK AVE', '1050 Park'), true);
check('Fifth without Ave', A.same('1270 FIFTH AVE', '1270 Fifth'), true);
check('Avenue dropped only as a suffix', A.same('929 PARK AVE', '929 WEA'), false);
check('unit 6 Floor', A.unitKey('6 Floor'), '6');
check('unit 6th Floor', A.unitKey('6th Floor'), '6');
check('unit 10th Floor', A.unitKey('10th Floor'), '10');
check('unit 6FL',A.unitKey('6FL'), '6');
check('unit #10', A.unitKey('#10'), '10');
check('floor folder', A.matchFolder('347 W BROADWAY', '6', [{ name: '6 Floor', path: 'x/6 Floor' }]).path, 'x/6 Floor');
check('normalize',A.normalize('347 W BROADWAY'), '347 west broadway');

const units = [
  { name: '13C', path: 'Building Information/1050 Park Ave/13C' },
  { name: '11B Rental', path: 'Building Information/1050 Park Ave/11B Rental' }
];
check('unit folder', A.matchFolder('1050 PARK AVE', '13C', units).path, 'Building Information/1050 Park Ave/13C');
check('rental-named folder', A.matchFolder('1050 PARK AVE', '11B', units).path, 'Building Information/1050 Park Ave/11B Rental');
check('no unit (house)', A.matchFolder('6 Johnny Dr', '', [{ name: '6 Johnny Dr', path: 'Resale/6 Johnny Dr' }]).path, 'Resale/6 Johnny Dr');
check('no match', A.matchFolder('1 Main St', '2A', units), null);

/* Slice 2: Asana's short task names (D62) */
check('W59 short form', A.same('555 W59', '555 West 59th Street'), true);
check('WEA short form', A.same('565 WEA', '565 West End Avenue'), true);
check('CPS short form', A.same('106 CPS', '106 Central Park South'), true);
check('E86 short form', A.same('170 E86', '170 East 86th Street'), true);
check('Park S short form', A.same('404 Park S', '404 Park Avenue South'), true);
check('SPS short form', A.same('2 SPS', '2 Sutton Place South'), true);
check('NJ town and "- 1st" suffix', A.same('619 Bradley Ave, Brielle - 1st', '619 Bradley Ave'), true);
check('NJ "Ln, Wall"', A.same('1006 Pheasant Ln, Wall', '1006 Pheasant Lane'), true);
check('a unit on one side is another address', A.same('555 W59 - PHC', '555 W 59TH ST'), false);
check('sameStreet ignores the unit', A.sameStreet('555 W59 - PHC', '555 W 59TH ST'), true);
check('long form with Apt: sameStreet', A.sameStreet('250 East 99th Street, Apt. 504', '250 E99'), true);
check('long form with Apt: same unit', A.same('250 East 99th Street, Apt. 504', '250 E99 - 504'), true);
check('other unit refused', A.same('100 Main St - 3C', '100 MAIN ST'), false);
check('different units refused', A.same('100 Main St - 3C', '100 Main St - 2B'), false);
check('unit-less listing never gets a unit folder', A.matchFolder('555 W59', '', [{ name: '555 W59 - PHC' }]), null);
check('two different towns', A.same('12 Ocean Ave, Sea Bright', '12 Ocean Ave, Monmouth Beach'), false);
check('two different " - " towns', A.same('207 Example Ct - Brick', '207 Example Ct - Wall'), false);
check('same town, state suffix', A.same('14 Ridge Rd, Rumson NJ', '14 Ridge Rd, Rumson'), true);
check('sameStreet ignores towns', A.sameStreet('12 Ocean Ave, Sea Bright', '12 Ocean Ave, Monmouth Beach'), true);
check('sameStreet keeps houses apart', A.sameStreet('405 Old Bridge Rd (House 1)', '405 Old Bridge Rd (House 2)'), false);
check('House 1 is not House 2', A.same('405 Old Bridge Rd (House 1)', '405 Old Bridge Rd (House 2)'), false);
check('House 1 is House 1', A.same('405 Old Bridge Rd (House 1)', '405 Old Bridge Road (house 1)'), true);
check('combined units stable', A.unitKey('10BCD'), '10BCD');
check('combined units with slash', A.unitKey('18/19E'), '1819E');
check('split NYC name', A.splitName('555 W59 - PHC'), { street: '555 W59', unit: 'PHC', town: '', house: '' });
check('split NJ name', A.splitName('619 Bradley Ave, Brielle - 1st'), { street: '619 Bradley Ave', unit: '', town: 'Brielle', house: '' });
check('split NJ " - town" name', A.splitName('207 Example Ct - Brick'), { street: '207 Example Ct', unit: '', town: 'Brick', house: '' });
check('split long form', A.splitName('250 East 99th Street, Apt. 504'), { street: '250 East 99th Street', unit: '504', town: '', house: '' });
check('split house', A.splitName('405 Old Bridge Rd (House 2)'), { street: '405 Old Bridge Rd', unit: '', town: '', house: '2' });
check('split combined unit', A.splitName('401 E89 - 18/19E'), { street: '401 E89', unit: '18/19E', town: '', house: '' });
check('split trims whitespace', A.splitName('  12 Dup Street - 4A\n'), { street: '12 Dup Street', unit: '4A', town: '', house: '' });

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
