/* The helper writes only inside its configured output roots
   (Slice 0: G:\My Drive\GVC Workspace Lab), or (Slice 4) into a job's
   showsheet folder and its Archive\. "..", look-alike prefixes ("…Lab2",
   "Showsheet2") and relative paths are refused.
     insideRoots('G:\\My Drive\\GVC Workspace Lab\\x', roots) → true
     insideJobPiece(file, jobAbs, dir) → true when file sits in dir or dir\Archive,
                                         and dir sits inside the job folder */
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

function insideJobPiece(file, jobAbs, dir) {
  if (!file || !jobAbs || !dir || !path.isAbsolute(file) || !path.isAbsolute(jobAbs) || !path.isAbsolute(dir)) return false;
  const low = p => path.resolve(p).toLowerCase();
  const job = low(jobAbs), d = low(dir), parent = path.dirname(low(file));
  if (d.indexOf(job + path.sep) !== 0) return false;
  return parent === d || parent === path.join(d, 'archive');
}

module.exports = { insideRoots, insideJobPiece };
