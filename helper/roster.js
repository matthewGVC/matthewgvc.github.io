/* Loads the team roster (assets/js/roster.js, the site's one list of agents)
   into Node, so the helper and the site always agree on who is GVC.
     rosterNames()    → ['John Gasdaska', 'TJ Verdiglione', …], plus each name
                        without its middle initials ("Elyse B. Gutman" also as
                        "Elyse Gutman"), since DE's pages print names both ways
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

function rosterNames() {
  const out = [];
  roster().forEach(p => {
    out.push(p.name);
    const bare = p.name.replace(/\s+[A-Z]\.(?=\s)/g, '');
    if (bare !== p.name) out.push(bare);
  });
  return out;
}

function rosterInitials() { return load().GVC_ROSTER_INITIALS || {}; }

module.exports = { roster, rosterNames, rosterInitials };
