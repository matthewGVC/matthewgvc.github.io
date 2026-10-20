/* ============================================================
   SCHEDULE — when the helper runs its jobs (plan §4, spec §2.5).

     due(now, last) → ['de', 'scan', 'backup'] that should run now
       last = { de: Date, scan: Date, backup: Date } (latest start of each)

   Each job has a daily time (local clock). A job is due when its last run
   started before the most recent occurrence of that time, so a PC that was
   off at 7:00 catches up as soon as the helper starts, and a job never runs
   twice for the same slot.
   ============================================================ */
'use strict';

const TIMES = { de: [7, 0], scan: [2, 0], backup: [2, 30] };

function lastSlot(now, h, m) {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (t > now) t.setDate(t.getDate() - 1);
  return t;
}

function due(now, last) {
  return Object.keys(TIMES).filter(k => {
    const slot = lastSlot(now, TIMES[k][0], TIMES[k][1]);
    return !(last && last[k]) || new Date(last[k]) < slot;
  });
}

module.exports = { due, TIMES };
