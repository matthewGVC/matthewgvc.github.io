/* ============================================================
   DE STATUS MAP — DE's status words → the workspace's stages (plan §8).

     mapStage(row) → 'Live' | 'In contract' | 'Sold' | 'Rented'

   Any status not listed here throws UnknownStatusError, which aborts the
   whole run: DE adding a status must never quietly move a listing.
   "Pending" (seen on NJ and FL listings, 2026-10-19) is a contract further
   along than "ActiveUnderContract"; both are In contract. "Price reduced"
   on DE's page is priceChangePercent, not a status (checks.js).
   ============================================================ */
'use strict';

const MAP = {
  Active: 'Live',
  ActiveUnderContract: 'In contract',
  Pending: 'In contract',
  Sold: 'Sold',
  Rented: 'Rented'
};

class UnknownStatusError extends Error {
  constructor(status, row) {
    super('DE used a status the workspace doesn\'t know: "' + status + '"' + (row ? ' (' + row.street + ' ' + row.unit + ')' : '') + '. Nothing was changed.');
    this.name = 'UnknownStatusError';
    this.status = status;
  }
}

function mapStage(row) {
  const stage = MAP[row.status];
  if (!stage) throw new UnknownStatusError(row.status, row);
  return stage;
}

module.exports = { mapStage, UnknownStatusError, MAP };
