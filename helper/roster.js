/* Loads the team roster (assets/js/roster.js, the site's one list of agents)
   into Node, so the helper and the site always agree on who is GVC.
     rosterNames() → ['John Gasdaska', 'TJ Verdiglione', …] */
'use strict';

const fs = require('fs'), path = require('path'), vm = require('vm');

let cached = null;

function roster() {
  if (cached) return cached;
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'roster.js'), 'utf8');
  const win = {};
  vm.runInNewContext(src, { window: win, document: { currentScript: null }, URL });
  cached = win.GVC_ROSTER || [];
  return cached;
}

function rosterNames() { return roster().map(p => p.name); }

module.exports = { roster, rosterNames };
