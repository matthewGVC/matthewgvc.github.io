/* Prints the helper's pairing code (making one on first run). Type it once
   into the workspace's "Pair with helper" box on this PC.
     node helper/pair.js */
'use strict';
console.log('Pairing code: ' + require('./config.js').loadConfig().pairCode);
