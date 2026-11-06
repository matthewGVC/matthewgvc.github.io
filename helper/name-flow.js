/* ============================================================
   NAME FLOW — an Asana task's name reaches its deal (decision 12).

     nameFlow(row, taskName) → { label, core, changes: [{ field, old, new, note }], moved }
       row       a properties row (label, core)
       taskName  the linked Asana task's name

   Pure: the row is never changed, the caller writes what comes back.
   - label is GVC_NAME.baseName(taskName): the name as the workspace shows it, "(Rental)" off.
     An empty name keeps the row's label.
   - A respelling ("200 E 57, Residence 17A" → "200 E57 - 17A", "435 East 57th Street" →
     "435 E57") changes nothing in core: the long form stays for print.
   - A new unit (A.unitKey differs) is Asana's now (decisions 13 and 15): the shown value is
     adopted first (GVC_FACTS.adoptEdit, as legacy), the team's own value forgotten (nobody can
     edit the address in the workspace any more, so it would outrank Asana's for good), then
     Asana's applied. A name with no unit never clears one.
   - A new street (the name's street starts with a number and isn't the same street) goes the
     same way through 'address'. A unit that lived inside the old address line ("69 West 9th
     Street, Residence 12E", unit empty) is copied to core.unit first, so it isn't lost.
   Each value shown that changes is one change, note "Renamed in Asana"; moved is true when the
   street or the unit changed (the caller then moves the deal's place: place-store followRename).
   Used by the Asana sync (helper/asana/apply.js updateListing).
   ============================================================ */
'use strict';

const N = require('../assets/js/naming.js');
const L = require('./asana/link.js');
const A = require('../assets/js/address-aliases.js');
const GP = require('../assets/js/places.js');
const F = require('../assets/js/job-facts.js');
const P = require('../assets/js/property-library.js');

const NOTE = 'Renamed in Asana';
const clone = x => (x === undefined || x === null ? x : JSON.parse(JSON.stringify(x)));
const blank = v => v === undefined || v === null || String(v).trim() === '';

/* Asana's value for one field: adopted, the team's forgotten, Asana's applied; the value shown */
function follow(facts, field, shown, value) {
  let f = F.adoptEdit(facts, field, shown, 'legacy');
  f = F.forget(f, field, 'Matt');
  f = F.applyFact(f, field, 'Asana', value).facts;
  return f;
}

function nameFlow(row, taskName) {
  row = row || {};
  const base = N.baseName(taskName);
  const label = base || row.label;
  const core = clone(row.core) || {};
  const changes = [];
  let moved = false;
  const a = L.addrOf(taskName);
  const cur = P.unitOf(core);

  if (a.unit && A.unitKey(a.unit) !== A.unitKey(cur.unit)) {
    const facts = follow(core.facts || {}, 'unit', blank(core.unit) ? cur.unit : core.unit, a.unit);
    const shown = facts.unit ? facts.unit.value : core.unit;
    core.facts = facts;
    if (shown !== (blank(core.unit) ? cur.unit : core.unit)) {
      changes.push({ field: 'unit', old: blank(core.unit) ? (cur.unit || null) : core.unit, new: shown, note: NOTE });
      core.unit = shown;
      moved = true;
    }
  }

  if (/^\d/.test(a.street || '') && !A.sameStreet(a.street, GP.cleanStreet(cur.address))) {
    const was = core.address;
    const facts = follow(core.facts || {}, 'address', was, a.street);
    const shown = facts.address ? facts.address.value : was;
    core.facts = facts;
    if (shown !== was) {
      if (blank(core.unit) && cur.unit) core.unit = cur.unit;   // the unit lived inside the old address line
      changes.push({ field: 'address', old: was === undefined ? null : was, new: shown, note: NOTE });
      core.address = shown;
      moved = true;
    }
  }

  return { label, core: changes.length ? core : clone(row.core) || {}, changes, moved };
}

module.exports = { nameFlow };
