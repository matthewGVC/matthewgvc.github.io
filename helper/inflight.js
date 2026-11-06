/* One Asana run at a time across the whole helper: scheduled jobs and the
   Sync now routes all go through here.

     runAsana(kind, fn)   kind: 'plain' | 'full' | 'people' | 'events'

   A caller whose work the running run already covers shares it (a full read
   covers a plain one). Any other caller waits for the running one to finish
   and then runs its own, so a nightly full read or People read is never lost
   to a plain run that happened to be in flight. No read covers an events run (the
   one-minute sync): a read already running may have missed a change the feed
   collected after it started, so events waits and then runs. */
'use strict';
const COVERS = { plain: ['plain'], full: ['plain', 'full'], people: ['people'], events: ['events'] };
let running = null;

function runAsana(kind, fn) {
  if (running) {
    if (COVERS[running.kind].indexOf(kind) !== -1) return running.promise;
    return running.promise.then(() => undefined, () => undefined).then(() => runAsana(kind, fn));
  }
  const entry = { kind };
  entry.promise = Promise.resolve().then(fn).finally(() => { if (running === entry) running = null; });
  running = entry;
  return entry.promise;
}
module.exports = { runAsana };
