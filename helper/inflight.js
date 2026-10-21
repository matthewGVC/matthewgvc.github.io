/* One Asana run at a time across the whole helper: scheduled jobs and the
   Sync now routes all go through here, so a click during a read joins it. */
'use strict';
let running = null;
function runAsana(fn) {
  if (!running) running = Promise.resolve().then(fn).finally(() => { running = null; });
  return running;
}
module.exports = { runAsana };
