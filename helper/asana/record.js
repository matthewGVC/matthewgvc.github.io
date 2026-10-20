/* ============================================================
   ASANA RECORDER — saves what the allowlist kept, for tests to replay.

   Takes only the output of allow.js's keep* functions (never a raw Asana
   response), so a recording can't hold anything the allowlist drops. Files go
   to helper/fixtures/recorded/<date>/asana-<label>.json, which is gitignored:
   real job data never enters the repo (plan D2).

     recordKept('listings-NYC', keptRows, { dir?, date? })  → the file written
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');

function recordKept(label, kept, opts) {
  const o = opts || {};
  const date = o.date || new Date().toISOString().slice(0, 10);
  const dir = path.join(o.dir || path.join(__dirname, '..', 'fixtures', 'recorded'), date);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'asana-' + label + '.json');
  fs.writeFileSync(file, JSON.stringify(kept, null, 2) + '\n');
  return file;
}

module.exports = { recordKept };
