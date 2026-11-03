/* ============================================================
   SCHEDULE — when the helper runs its jobs (plan §4, spec §2.5).

     due(now, last, opts) → the job names that should run now
       last = { de, scan, backup, asana, asanaFull, people: Date } (latest start of each)
       opts.asana = true adds the three Asana jobs; without a token the runner
       leaves it off, so they are never due.
       opts.budget = true adds the hourly budget read (D113); without a
       Google sign-in the runner leaves it off.
       opts.weekly = true adds the Sunday email (Sundays 18:00, overhaul step
       3); without the helper's Gmail sign-in the runner leaves it off.

   Each job has a daily time (local clock). A job is due when its last run
   started before the most recent occurrence of that time, so a PC that was
   off at 7:00 catches up as soon as the helper starts, and a job never runs
   twice for the same slot.
   ============================================================ */
'use strict';

const TIMES = { de: [7, 0], scan: [2, 0], backup: [2, 30] };
const ASANA_TIMES = { asanaFull: [3, 0], people: [3, 15] };   // nightly full read, then People
const ASANA_EVERY_MS = 30 * 60 * 1000;                        // the plain read, all day
const BUDGET_EVERY_MS = 60 * 60 * 1000;                       // the pro-forma sheets, all day
const WEEKLY_TIME = [0, 18, 0];                               // the Sunday email: Sunday 18:00

function lastSlot(now, h, m) {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (t > now) t.setDate(t.getDate() - 1);
  return t;
}

// the most recent Sunday 18:00 at or before now
function lastWeekly(now) {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), WEEKLY_TIME[1], WEEKLY_TIME[2], 0, 0);
  t.setDate(t.getDate() - ((t.getDay() - WEEKLY_TIME[0] + 7) % 7));
  if (t > now) t.setDate(t.getDate() - 7);
  return t;
}

function due(now, last, opts) {
  const withAsana = !!(opts && opts.asana);
  const slots = Object.assign({}, TIMES, withAsana ? ASANA_TIMES : {});
  const out = Object.keys(slots).filter(k => {
    const slot = lastSlot(now, slots[k][0], slots[k][1]);
    return !(last && last[k]) || new Date(last[k]) < slot;
  });
  if (withAsana && (!(last && last.asana) || now - new Date(last.asana) >= ASANA_EVERY_MS)) out.push('asana');
  if (opts && opts.budget && (!(last && last.budget) || now - new Date(last.budget) >= BUDGET_EVERY_MS)) out.push('budget');
  // a week's email only on its own Sunday: a PC that was off all Sunday skips it rather than sending it on Wednesday
  if (opts && opts.weekly) {
    const slot = lastWeekly(now);
    if (now - slot < 24 * 60 * 60 * 1000 && (!(last && last.weekly) || new Date(last.weekly) < slot)) out.push('weekly');
  }
  return out;
}

module.exports = { due, lastWeekly, TIMES, ASANA_TIMES, ASANA_EVERY_MS, BUDGET_EVERY_MS, WEEKLY_TIME };
