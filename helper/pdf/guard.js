/* The helper writes only inside its configured output roots
   (Slice 0: G:\My Drive\GVC Workspace Lab). "..", look-alike prefixes
   ("…Lab2") and relative paths are refused.
     insideRoots('G:\\My Drive\\GVC Workspace Lab\\x', roots) → true */
'use strict';

const path = require('path');

function insideRoots(dir, roots) {
  if (!dir || !path.win32.isAbsolute(dir)) return false;
  const d = path.win32.resolve(dir).toLowerCase();
  return (roots || []).some(r => {
    const root = path.win32.resolve(r).toLowerCase();
    return d === root || d.indexOf(root + '\\') === 0;
  });
}

module.exports = { insideRoots };
