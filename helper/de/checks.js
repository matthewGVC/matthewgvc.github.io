/* ============================================================
   DE SAFETY CHECKS — the rules that stop a bad DE run from changing
   anything (plan §8).

     checkTotals(feed, total, rowsRead)  throws unless DE's own total = rows read
     checkDrop(liveNow, liveLast)        throws when live listings fall by more
                                         than a quarter since the last good run
     diffRuns(prevRows, nowRows)         → { stageMoves, missing, priceReduced }
                                           `missing` listings keep their stage:
                                           absence is never a change.
   ============================================================ */
'use strict';

const { mapStage } = require('./status.js');

function checkTotals(feed, total, rowsRead) {
  if (total !== rowsRead) {
    throw new Error(feed + ': DE said ' + total + ' listings but ' + rowsRead + ' were read, so nothing was changed.');
  }
}

function checkDrop(liveNow, liveLast) {
  if (liveLast && liveNow < 0.75 * liveLast) {
    throw new Error('DE showed ' + liveNow + ' live listings against ' + liveLast + ' last time, so nothing was changed.');
  }
}

function diffRuns(prev, now) {
  const before = new Map((prev || []).map(r => [r.id, r]));
  const seen = new Set();
  const stageMoves = [], priceReduced = [];
  (now || []).forEach(r => {
    seen.add(r.id);
    const p = before.get(r.id);
    if (p) {
      const from = mapStage(p), to = mapStage(r);
      if (from !== to) stageMoves.push({ id: r.id, from, to });
    }
    if (r.priceChangePercent !== null && r.priceChangePercent < 0) priceReduced.push({ id: r.id, percent: r.priceChangePercent });
  });
  const missing = Array.from(before.keys()).filter(id => !seen.has(id));
  return { stageMoves, missing, priceReduced };
}

module.exports = { checkTotals, checkDrop, diffRuns };
