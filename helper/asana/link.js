/* ============================================================
   ASANA LINK — which workspace row an Asana task is, and the first link plan.

     addrOf(name)              → { street, unit, town }  from an Asana task name
                                 ("(House 2)" becomes the unit "House 2")
     sameAddress(name, core)   → one address: street, unit and (when both name
                                 one) town agree. sameStreet() finds the
                                 candidates, then the unit decides (D62).
     matchTask(task, { properties, pitches }, kind)
         → { propertyId } | { pitchId } | { taken: id } | { tie: [ids] } | {}
         Order (D62): the stored asana_gid → Asana's Drive Link (core.driveLink)
         → address + unit. `taken`: the address belongs to a job already linked
         to another Asana task (never two jobs, never a guessed link).
     makePlan(run, existing)   → { rows: [{ gid, name, kind, stage, market, tick,
                                   match, why }] }                     S5, D54
         existing = { properties, pitches, devs }
         listed:   List-Side tasks (D51) at Prep → In contract (ticked), Sold /
                   Rented / Off market (unticked, no history import, D31),
                   pitches with a 🗓️ Pitch date (ticked when dated 2026 on),
                   and each 🚧 project with the development it names (ticked
                   when one matches).
         left out: Buy-Side and Tenant rows, Leads with no pitch date, and the
                   old Graveyard imports (Off market, created before 2026).
         A task with no street number is listed unticked, never guessed.
     writePlanFiles(plan, dir, date) → { md, json }  exports/asana-link-plan-<date>.*
     readPlanFile(file)        → the plan, with the ticks as the .md now shows
                                 them (Matt ticks the .md; the .json beside it
                                 holds the rest)
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const A = require('../../assets/js/address-aliases.js');
const P = require('../../assets/js/property-library.js');
const MAP = require('../../assets/js/asana-map.js');

const ACTIVE = ['Prep', 'Live', 'Accepted offer', 'In contract'];
const IMPORTED_BEFORE = '2026-01-01';

function addrOf(name) {
  const s = A.splitName(name);
  return { street: s.street, unit: s.unit || (s.house ? 'House ' + s.house : ''), town: s.town };
}
function townKey(t) {
  return String(t || '').toUpperCase().replace(/[.,]/g, ' ').replace(/\b(NJ|NY|FL)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function hasNumber(name) { return /^\s*\d/.test(addrOf(name).street); }

function sameAddress(name, core) {
  const a = addrOf(name), u = P.unitOf(core || {});
  if (!a.street || !u.address || !A.sameStreet(a.street, u.address)) return false;
  if (A.unitKey(a.unit) !== A.unitKey(u.unit)) return false;
  const ta = townKey(a.town), tb = townKey((core || {}).city);
  return !ta || !tb || ta === tb;
}

function matchTask(task, existing, kind) {
  const props = (existing && existing.properties) || [], pitches = (existing && existing.pitches) || [];
  const own = props.find(p => p.asana_gid === task.gid);
  if (own) return { propertyId: own.id };
  const ownPitch = pitches.find(p => p.asana_gid === task.gid);
  if (ownPitch && kind === 'pitch') return { pitchId: ownPitch.id };
  const drive = task.fields && task.fields['🛜 Google Drive Link'];
  if (drive) {
    const byDrive = props.filter(p => !p.asana_gid && p.core && p.core.driveLink === drive);
    if (byDrive.length === 1) return { propertyId: byDrive[0].id };
  }
  const at = props.filter(p => p.stage !== 'Archived' && sameAddress(task.name, p.core));
  const free = at.filter(p => !p.asana_gid);
  if (kind === 'pitch') {
    const pf = pitches.filter(p => !p.asana_gid && p.outcome === 'open' && sameAddress(task.name, p.core));
    if (pf.length === 1) return { pitchId: pf[0].id };
    if (pf.length > 1) return { tie: pf.map(p => p.id) };
    return {};
  }
  if (free.length === 1) return { propertyId: free[0].id };
  if (free.length > 1) return { tie: free.map(p => p.id) };
  if (at.length) return { taken: at[0].id };
  return {};
}

function devAddresses(dev, project) {
  return [dev && dev.label, project && project.name]
    .filter(Boolean).map(s => String(s).replace(/^[^\p{L}\p{N}]+/u, '').trim()).filter(s => /^\d/.test(s));
}
function plain(s) { return String(s || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
function devFor(project, devs) {
  const linked = (devs || []).find(d => d.asana_project_gid === project.gid);
  if (linked) return { dev: linked, why: 'already linked' };
  const name = plain(project.name);
  const hits = (devs || []).filter(d => !d.asana_project_gid && name && (plain(d.label) === name ||
    devAddresses(d, null).some(x => devAddresses(null, project).some(y => A.sameStreet(x, y)))));
  if (hits.length === 1) return { dev: hits[0], why: 'same name' };
  if (hits.length > 1) return { why: 'more than one development has this name' };
  return { why: 'no development with this name on the overview' };
}

function makePlan(run, existing) {
  const ex = existing || {};
  const rows = [];
  (run.listings || []).forEach(t => {
    if (!MAP.isGvcListing(t)) return;
    const base = { gid: t.gid, name: t.name, market: t.market || null };
    const st = MAP.stageOf(t);
    if (st.unknown) { rows.push(Object.assign(base, { kind: 'listing', stage: null, tick: false, match: null, why: 'Listing Status not known yet: ' + st.unknown })); return; }
    let kind = 'listing', tick, why;
    if (st.stage === 'Pitch') {
      const on = t.fields && t.fields['🗓️ Pitch'];
      if (!on) return;   // a lead, not a pitch yet (D54)
      kind = 'pitch'; tick = String(on).slice(0, 4) >= '2026';
      why = 'pitched ' + String(on).slice(0, 10) + (tick ? '' : ': before 2026');
    } else if (ACTIVE.indexOf(st.stage) !== -1) {
      tick = true; why = st.stage + ' in Asana';
    } else if (st.stage === 'Off market' && t.createdAt && t.createdAt < IMPORTED_BEFORE) {
      return;   // the old long-name Graveyard imports
    } else {
      tick = false; why = st.stage + ': no history import (tick to bring it in)';
    }
    if (!hasNumber(t.name)) { tick = false; why = 'no street number, so never guessed'; }
    const m = matchTask(t, ex, kind);
    let match = null;
    if (m.propertyId) { match = { propertyId: m.propertyId }; why += '; links to an existing job'; }
    else if (m.pitchId) { match = { pitchId: m.pitchId }; why += '; links to an existing pitch'; }
    else if (m.tie) { tick = false; why = 'more than one job at this address: pick one by hand'; }
    else if (m.taken) { tick = false; why = 'same address as a job already linked to another Asana task'; }
    else why += '; new ' + kind;
    rows.push(Object.assign(base, { kind, stage: st.stage, tick, match, why }));
  });
  // two ticked rows at one address: the first (the more active) keeps the tick
  const order = s => (ACTIVE.indexOf(s) === -1 ? 9 : ACTIVE.indexOf(s));
  rows.filter(r => r.kind === 'listing' && r.tick).sort((x, y) => order(x.stage) - order(y.stage)).forEach((r, i, all) => {
    const first = all.slice(0, i).find(o => o.tick && sameAddress(r.name, addrCore(o.name)));
    if (first) { r.tick = false; r.why = 'same address as ' + first.gid + ': one job per address'; }
  });
  (run.devs || []).forEach(d => {
    const f = devFor(d.project, ex.devs);
    rows.push({ gid: d.project.gid, name: d.project.name || d.project.gid, kind: 'dev', stage: null, market: f.dev ? f.dev.market || null : null,
      tick: !!f.dev, match: f.dev ? { devId: f.dev.id } : null, why: f.why });
  });
  return { rows };
}
function addrCore(name) { const a = addrOf(name); return { address: a.street, unit: a.unit, city: a.town }; }

/* ---------- the plan as files ---------- */
const HEADS = { listing: 'Listings', pitch: 'Pitches', dev: 'Developments' };

function writePlanFiles(plan, dir, date) {
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, 'asana-link-plan-' + date);
  fs.writeFileSync(base + '.json', JSON.stringify(Object.assign({ date }, plan), null, 2));
  const L = ['# Asana link plan, ' + date, '',
    'Tick a line to bring that Asana task into the workspace; untick it to leave it out for good.',
    'Ticked lines become jobs (or pitches, or a development\'s Asana link) when this file is applied.',
    'Nothing is written to Asana. The number in backticks is the Asana task; leave it as it is.', ''];
  ['listing', 'pitch', 'dev'].forEach(k => {
    const rs = plan.rows.filter(r => r.kind === k);
    if (!rs.length) return;
    L.push('## ' + HEADS[k] + ' (' + rs.length + ')', '');
    rs.forEach(r => L.push('- [' + (r.tick ? 'x' : ' ') + '] ' + [r.name, r.stage, r.market, r.why].filter(Boolean).join(' · ') + ' `' + r.gid + '`'));
    L.push('');
  });
  fs.writeFileSync(base + '.md', L.join('\n'));
  return { md: base + '.md', json: base + '.json' };
}

function readPlanFile(file) {
  const isMd = /\.md$/i.test(file);
  const plan = JSON.parse(fs.readFileSync(isMd ? file.replace(/\.md$/i, '.json') : file, 'utf8'));
  if (isMd) {
    const ticks = {};
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
      const m = /^- \[( |x|X)\] .*`([^`]+)`\s*$/.exec(line);
      if (m) ticks[m[2]] = m[1] !== ' ';
    });
    plan.rows.forEach(r => { if (r.gid in ticks) r.tick = ticks[r.gid]; });
  }
  return plan;
}

module.exports = { addrOf, sameAddress, matchTask, makePlan, writePlanFiles, readPlanFile, devAddresses, devFor, ACTIVE };
