/* Loads the team roster (assets/js/roster.js, the site's one list of agents)
   into Node, so the helper and the site always agree on who is GVC.
     rosterNames()    → ['John Gasdaska', 'TJ Verdiglione', …]
     rosterInitials() → { JG: 'john-gasdaska', KC: 'katie-cook', CB: null, … }
                        (window.GVC_ROSTER_INITIALS; roster.js explains the values) */
'use strict';

const fs = require('fs'), path = require('path'), vm = require('vm');

let cached = null;

function load() {
  if (cached) return cached;
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'roster.js'), 'utf8');
  const win = {};
  vm.runInNewContext(src, { window: win, document: { currentScript: null }, URL });
  cached = win;
  return cached;
}

function roster() { return load().GVC_ROSTER || []; }

function rosterNames() { return roster().map(p => p.name); }

function rosterInitials() { return load().GVC_ROSTER_INITIALS || {}; }

module.exports = { roster, rosterNames, rosterInitials };
