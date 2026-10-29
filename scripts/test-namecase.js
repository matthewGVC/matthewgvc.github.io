/* ============================================================
   Name casing (assets/js/roster.js GVC_NAMECASE) and the initials table.
   No browser or server needed:   node scripts/test-namecase.js
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const win = {};
const ctx = { window: win, document: { currentScript: null }, URL };
ctx.window = win;
vm.runInNewContext('(function(){' + fs.readFileSync(path.join(__dirname, '../assets/js/roster.js'), 'utf8') + '}).call(window)', Object.assign(ctx, win));
const G = ctx.GVC_NAMECASE ? ctx : win;
const nc = G.GVC_NAMECASE;

let pass = 0; const failures = [];
const check = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else failures.push(name + ': expected ' + JSON.stringify(want) + ', got ' + JSON.stringify(got)); };

[
  ['john gasdaska', 'John Gasdaska'],
  ['TJ verdiglione', 'TJ Verdiglione'],
  ['mary-kate o\'brien', 'Mary-Kate O\'Brien'],
  ['juan de la cruz', 'Juan de la Cruz'],
  ['ludwig van der rohe', 'Ludwig van der Rohe'],
  ['de la hoya', 'De la Hoya'],
  ['Juan De La Cruz', 'Juan De La Cruz'],
  ['john smith iii', 'John Smith III'],
  ['john smith ii', 'John Smith II'],
  ['henry ford iv', 'Henry Ford IV'],
  ['john smith jr', 'John Smith Jr'],
  ['john smith jr.', 'John Smith Jr.'],
  ['ronald mcdonald', 'Ronald McDonald'],
  ['McKenzie', 'McKenzie'],
  ['j.r. smith', 'J.R. Smith'],
  ['', ''],
  [null, '']
].forEach(([i, w]) => check('nameCase(' + JSON.stringify(i) + ')', nc(i), w));

const ini = G.GVC_ROSTER_INITIALS;
check('initials keys are upper case', Object.keys(ini).filter(k => k !== k.toUpperCase()), []);
check('Mariana Santelli keyed MSA', ini.MSA, 'past:Mariana Santelli');

if (failures.length) { failures.forEach(f => console.log('  FAIL ' + f)); console.log(pass + ' passed, ' + failures.length + ' failed'); process.exit(1); }
console.log(pass + ' passed');
