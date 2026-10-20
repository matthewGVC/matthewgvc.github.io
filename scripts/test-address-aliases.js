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

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
