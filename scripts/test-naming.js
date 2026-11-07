/* ============================================================
   Tests for assets/js/naming.js: the one way a listing's name is written
   (decision 12), and when the rule is not sure enough to rename a task.
   Made-up addresses only. Every real Asana name is checked by the snapshot
   loop at the bottom, which reads a file kept off GitHub (GVC_NAMES_DIR).

   Plain Node:  node scripts/test-naming.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const N = require('../assets/js/naming.js');
const A = require('../assets/js/address-aliases.js');
const P = require('../assets/js/places.js');

let pass = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  failures.push(name + '\n      expected ' + w + '\n      got      ' + g);
}

const R = (name, market, cityHood, rental) => N.ruleName(name, { market, cityHood: cityHood || null, rental: !!rental });
const sureCases = [];
const sure = (name, market, cityHood, rental, want) => {
  sureCases.push({ name, market, cityHood, rental });
  check('rule: ' + JSON.stringify(name), [R(name, market, cityHood, rental).name, R(name, market, cityHood, rental).sure], [want, true]);
};
const unsure = (name, market, cityHood, rental) => check('unsure: ' + JSON.stringify(name), R(name, market, cityHood, rental).sure, false);

// NYC (decision 12's examples, and the shapes of real names)
sure('200 E 57 - 17A', 'NYC', 'Midtown East', false, '200 E57 - 17A');
sure('260 East 54th Street, Apt. 504', 'NYC', null, false, '260 E54 - 504');
sure('1050 Fifth Avenue, Apt. 10C', 'NYC', 'Carnegie Hill', false, '1050 Fifth - 10C');
sure('1050 Park - 13C', 'NYC', null, false, '1050 Park - 13C');
sure('220 Riverside Drive, Apt. 11H', 'NYC', null, false, '220 RSD - 11H');
sure('575 West End Avenue, Apt. 20C', 'NYC', null, false, '575 WEA - 20C');
sure('404 Park S - 6A ', 'NYC', 'Nomad', true, '404 PAS - 6A (Rental)');
sure('106 CPS - 8A', 'NYC', 'Midtown West', true, '106 CPS - 8A (Rental)');
sure('347 West Broadway - 6', 'NYC', 'SoHo', false, '347 West Broadway - 6');
sure('288 Bowery, Apt. 3D', 'NYC', null, false, '288 Bowery - 3D');
sure('45 Beekman Place, Apt. 17B', 'NYC', null, false, '45 Beekman Pl - 17B');
sure('235 East 80th Street, PHB', 'NYC', null, false, '235 E80 - PHB');
sure('6-16 West 78th Street, Apt. 5F', 'NYC', null, false, '6-16 W78 - 5F');
sure('320 East 87th Street, Apt.17C', 'NYC', null, false, '320 E87 - 17C');
sure('84 Sixth Avenue , Apt. 9C', 'NYC', null, false, '84 Sixth - 9C');
sure('2 West 73rd Street, Apartment 46', 'NYC', null, false, '2 W73 - 46');
sure('401 E89 - 18/19E', 'NYC', 'Upper East Side', false, '401 E89 - 18/19E');
sure('241 E76 - 10BCD', 'NYC', null, false, '241 E76 - 10BCD');
sure('52 E4 - 10FL', 'NYC', null, false, '52 E4 - 10FL');
sure('300 Third Avenue - 4B', 'NYC', null, false, '300 Third - 4B');
sure('10 1st Ave - 2', 'NYC', null, false, '10 First - 2');
sure('200 Lexington Avenue - 9C', 'NYC', null, false, '200 Lex - 9C');
sure('1 Gracie Square', 'NYC', null, false, '1 Gracie Sq');
sure('7 E 14', 'NYC', null, false, '7 E14');
sure('712 Hadley Avenue', 'NYC', null, false, '712 Hadley Ave');
// decision 12's own examples, each already in rule form
sure('333 E43 - 417', 'NYC', null, false, '333 E43 - 417');
sure('400 E59 - 3H', 'NYC', null, false, '400 E59 - 3H');
sure('1050 Fifth - 2E', 'NYC', null, false, '1050 Fifth - 2E');
sure('929 Park - 4C', 'NYC', null, false, '929 Park - 4C');
sure('45 Madison - 12', 'NYC', null, false, '45 Madison - 12');
sure('1-7 Beekman Pl', 'NYC', null, false, '1-7 Beekman Pl');
sure('2 Horatio St', 'NYC', null, false, '2 Horatio St');
sure('1 Plaza St W', 'NYC', null, false, '1 Plaza St W');
sure('1 Plaza Street West', 'NYC', null, false, '1 Plaza St W');
sure('148 Jonas Pl - 15', 'NJ', null, false, '148 Jonas Pl - 15');
unsure('444 Spruce - B508', 'NYC', 'Greenwich Village');
unsure('1160 Madison - Aria ', 'NYC', null);
check('a tail equal to City/Hood is dropped', R('45 Vernon Blvd - LIC', 'NYC', 'LIC').name, '45 Vernon Blvd');
unsure('70 E10 - 528 - VB', 'NYC', null);
unsure('1502 Cove Blvd. Long Beach, NY', 'NYC', null);
unsure('Hartwell House', 'NYC', null);
// NJ
sure('401 Brown st, Brielle', 'NJ', 'Brielle', false, '401 Brown St');
sure('1320 Charles Street', 'NJ', 'Point Pleasant', false, '1320 Charles St');
sure('50 N Way - Sea Bright', 'NJ', 'Sea Bright', false, '50 N Way');
sure('84 Diane Dr, Tinton Falls', 'NJ', 'Tinton Falls', true, '84 Diane Dr (Rental)');
sure('315 Foreman Ave, Point Pleasant Beach  (House 1)', 'NJ', 'Point Pleasant Beach', false, '315 Foreman Ave (House 1)');
sure('148 Jonas Pl, Unit 1, Red Bank', 'NJ', 'Red Bank', false, '148 Jonas Pl - 1');
sure('1 Plaza Street West', 'NJ', null, false, '1 Plaza St W');
sure('205 Parkway', 'NJ', 'Point Pleasant Beach', false, '205 Parkway');
check('an empty City/Hood takes the town', [R('441 Hartley Rd, Keyport', 'NJ', null).name, R('441 Hartley Rd, Keyport', 'NJ', null).town], ['441 Hartley Rd', 'Keyport']);
unsure('441 Hartley Rd, Keyport', 'NJ', 'Holmdel');
unsure('619 Bradley Ave, Brielle - 1st', 'NJ', 'Brielle');
unsure('1000 Nixon Lane (Solar Farm)', 'NJ', 'Edison');
check('a development house keeps its development', [N.ruleName('86 Montrose Ave (Abbey Farms)', { market: 'NJ', cityHood: 'Colts Neck', devHouse: true }).name, N.ruleName('86 Montrose Ave (Abbey Farms)', { market: 'NJ', cityHood: 'Colts Neck', devHouse: true }).sure], ['86 Montrose Ave (Abbey Farms)', true]);
unsure('86 Montrose Ave (Abbey Farms)', 'NJ', 'Colts Neck');   // not a development's house: a note
unsure('12 Sample rd, sample $3.5\n', 'NJ', null);
unsure('351 Aaron Pell Dr, Howell, NJ 07731\t', 'NJ', null);
unsure('9 Perry St, Rumson 07760', 'NJ', null);
unsure('151 Cambridge', 'NJ', null);
unsure('316 4th Ave Seaside Park ', 'NJ', 'Seaside Park');
unsure('Winter St, Red Bank', 'NJ', 'Red Bank');
unsure('1100 Creek Rd 6G, Belmar', 'NJ', 'Belmar');
// FL
unsure('4848 North Shore Boulevard Unit 1106', 'FL', null);
sure('58 Southwest 6th Avenue, Suite 4', 'FL', null, false, '58 Southwest 6th Ave - 4');
sure('200 E Boca Raton Rd - B', 'FL', null, false, '200 E Boca Raton Rd - B');
sure('2963 Cedar Moss Court', 'FL', null, false, '2963 Cedar Moss Ct');
// the rest of the interface
unsure('12 Elm St (Rental)', 'NJ', null, false);
check('baseName', N.baseName('  401 E89 - 18/19E  (Rental) '), '401 E89 - 18/19E');
check('baseName of nothing', N.baseName(null), '');
check('baseName folds tabs and newlines', N.baseName('12 Oak  St,\tRumson\n'), '12 Oak St, Rumson');
check('isRental', [N.isRental('106 CPS - 8A (Rental)'), N.isRental('106 CPS - 8A'), N.isRental('1 Oak St (rental)')], [true, false, true]);
check('folderNameOf', N.folderNameOf('401 E89 - 18/19E (Rental)'), '401 E89 - 18 19E');
check('TYPE_SHORT', [N.TYPE_SHORT.street, N.TYPE_SHORT.boulevard, N.TYPE_SHORT.highway], ['St', 'Blvd', 'Hwy']);
check('nameOf an Elliman unit', N.nameOf({ street: '200 E Boca Raton Rd', unit: 'B' }, 'FL', {}), '200 E Boca Raton Rd - B');
check('nameOf a house', N.nameOf({ street: '315 Foreman Ave', house: '2' }, 'NJ', {}), '315 Foreman Ave (House 2)');
check('nameOf a rental', N.nameOf({ street: '106 CPS', unit: '8A' }, 'NYC', { rental: true }), '106 CPS - 8A (Rental)');
check('a sure answer says why nothing', R('200 E 57 - 17A', 'NYC').why, null);
check('an unsure one says why', typeof R('151 Cambridge', 'NJ').why, 'string');
check('an unsure one keeps the name', R('151 Cambridge (Rental)', 'NJ', null, true).name, '151 Cambridge');
check('a sale named Rental says so', /Rental/.test(R('12 Elm St (Rental)', 'NJ').why), true);
check('a note in brackets says so', /bracket/.test(R('1000 Nixon Lane (Solar Farm)', 'NJ', 'Edison').why), true);

// decision 18: a sure answer is the same address and the same place
function placeOf(name, market) {
  const s = A.splitName(name);
  return P.placeKey({ address: s.street, unit: s.unit || (s.house ? 'House ' + s.house : '') }, market);
}
sureCases.forEach(c => {
  const out = R(c.name, c.market, c.cityHood, c.rental);
  check('every sure answer is the same address: ' + c.name, A.same(c.name, out.name), true);
  check('every sure answer is the same place: ' + c.name, placeOf(c.name, c.market), placeOf(out.name, c.market));
  const again = R(out.name, c.market, c.cityHood, c.rental);
  check('a sure answer is stable: ' + c.name, [again.sure, again.name], [true, out.name]);
});

// Every real Asana name (kept off GitHub): GVC_NAMES_DIR holds asana-names-2026-11-06.json
const dir = process.env.GVC_NAMES_DIR;
const snap = dir && path.join(dir, 'asana-names-2026-11-06.json');
if (snap && fs.existsSync(snap)) {
  const rows = JSON.parse(fs.readFileSync(snap, 'utf8'));
  const lines = [];
  let nSure = 0, nNot = 0;
  rows.forEach(row => {
    let out;
    try { out = N.ruleName(row.name, { market: row.market, cityHood: row.cityHood, rental: !!row.rental, devHouse: !!row.devHouse }); }
    catch (e) { failures.push('snapshot: ruleName threw on ' + JSON.stringify(row.name) + ': ' + e.message); return; }
    if (out.sure) {
      nSure++;
      if (!A.same(row.name, out.name)) failures.push('snapshot: not the same address: ' + JSON.stringify(row.name) + ' -> ' + JSON.stringify(out.name));
      else if (placeOf(row.name, row.market) !== placeOf(out.name, row.market)) failures.push('snapshot: not the same place: ' + JSON.stringify(row.name) + ' -> ' + JSON.stringify(out.name));
      else pass++;
      let again = null;
      try { again = N.ruleName(out.name, { market: row.market, cityHood: row.cityHood, rental: !!row.rental, devHouse: !!row.devHouse }); } catch (e) { again = { sure: false, name: e.message }; }
      if (!again.sure || again.name !== out.name) failures.push('snapshot: not stable: ' + JSON.stringify(row.name) + ' -> ' + JSON.stringify(out.name) + ' -> ' + JSON.stringify(again.name));
      else pass++;
      lines.push('- ' + JSON.stringify(row.name) + ' -> ' + JSON.stringify(out.name));
    } else {
      nNot++;
      if (out.name !== N.baseName(row.name)) failures.push('snapshot: an unsure name changed: ' + JSON.stringify(row.name));
      else pass++;
      lines.push('- NOT SURE ' + JSON.stringify(row.name) + ': ' + out.why);
    }
  });
  fs.writeFileSync(path.join(dir, 'asana-names-rule-2026-11-06.md'),
    '# The naming rule on every Asana listing name, 2026-11-06\n\n' + nSure + ' sure, ' + nNot + ' not sure, of ' + rows.length + '.\n\n' + lines.join('\n') + '\n');
  console.log('snapshot: ' + rows.length + ' names, ' + nSure + ' sure, ' + nNot + ' not sure');
} else {
  console.log('skipped: no name snapshot');
}

if (failures.length) {
  console.log(pass + ' passed, ' + failures.length + ' failed\n');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log(pass + ' passed');
