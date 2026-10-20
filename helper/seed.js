/* ============================================================
   SEED — the jobs the overview starts with (spec §2.6; D31: only what's
   active now). Two steps, with Matt in between:

     node helper/seed.js --plan [--existing exports/existing-properties.json] [--fixtures <DE recording>]
        → exports/seed-plan-<date>.md (to read and tick) and .json
     node helper/seed.js --apply exports/seed-plan-<date>.json     (needs the helper account)

   What the plan proposes:
   - every GVC-listed Live / In contract listing on DE (ticked), merged into
     an existing library row when the address matches, with its folder;
   - shortcuts in ACTIVE LISTINGS & DEALS that aren't on DE (unticked, stage
     Won); shortcuts to a whole building or to a missing folder: review only;
     shortcuts DE shows as sold: left out (D31);
   - NYC unit folders made in the last 120 days that nothing else claimed
     (unticked);
   - 2026 pitch folders whose name reads as an address (open), and a pitch of
     any year that matches a proposed listing (won, linked both ways). A
     folder named after a person is never stored: it's listed for Matt;
   - development folders, listed unticked (D30: not scanned), skipping
     templates, archives and admin folders.
   Reads folder names and dates only.
   ============================================================ */
'use strict';

const fs = require('fs'), path = require('path');
const A = require('../assets/js/address-aliases.js');
const P = require('../assets/js/property-library.js');

const TYPE_WORD = /^(st|street|ave|avenue|av|blvd|dr|drive|ln|lane|rd|road|pl|place|ct|court|ter|terrace|pkwy|way)\.?$/i;
const UNIT_LIKE = /^(\d+[a-z]*|[a-z]{1,2}\d+[a-z]?|ph[a-z0-9]*)$/i;
const MARKET = { NY: 'NYC', NJ: 'NJ', FL: 'FL' };
const PITCHES_DIR = 'GVC - Marketing/02 - Assets/Pitches';
const NYC_UNITS = 'GVC - New York/Building Information';
const DEV_DIRS = { NJ: 'GVC - New Jersey/New Development', FL: 'GVC - Florida/New Development' };
const DEV_SKIP = /^0+(\s|-)|templat|^archive$|^master template|^new dev -|^print ready|\.[a-z]{2,4}$/i;
const UNIT_SKIP = /due diligence|archive|building|^0+\s/i;
const UNIT_NAME = /^(\d+[a-z]*|[a-z]{1,2}\d+[a-z]?|ph-?[a-z0-9]{0,2}|garden)(\s|$)/i;   // "PHA", "PH-2", not "Photos"

function cleanUnit(u) { return String(u || '').trim().replace(/^(apt\.?|apartment|unit|no\.)\s*/i, '').replace(/^#\s*/, '').trim(); }

function parsePitch(name) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.+)$/.exec(String(name || '').trim());
  if (!m) return null;
  const rest = m[4].trim();
  if (!/^\d/.test(rest)) return null;
  const date = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  return Object.assign({ date }, splitStreetUnit(rest));
}

/* "1050 Park Ave - 13C", "370 Riverside Dr, Apt. 12C", "105 Norfolk #15",
   "60 East 9th St 428", "347 West Broadway, 6th Floor" → { street, unit } */
function splitStreetUnit(rest) {
  rest = String(rest || '').trim();
  let street = rest, unit = '';
  if (rest.indexOf(' - ') !== -1) { const i = rest.lastIndexOf(' - '); street = rest.slice(0, i); unit = rest.slice(i + 3); }
  else if (rest.indexOf(',') !== -1) { const i = rest.lastIndexOf(','); street = rest.slice(0, i); unit = rest.slice(i + 1); }
  else if (rest.indexOf('#') !== -1) { const i = rest.indexOf('#'); street = rest.slice(0, i); unit = rest.slice(i); }
  else {
    const t = rest.split(/\s+/);
    const last = t[t.length - 1], prev = t[t.length - 2] || '';
    if (t.length > 2 && UNIT_LIKE.test(last) && (TYPE_WORD.test(prev) || /^\d+[a-z]+$/i.test(last)) && !TYPE_WORD.test(last)) {
      street = t.slice(0, -1).join(' '); unit = last;
    }
  }
  return { street: street.trim(), unit: cleanUnit(unit) };
}

/* a library row's address and unit, also when the unit sits in the address line */
function streetUnitOf(core) {
  const u = P.unitOf(core);
  return u.unit ? u : splitStreetUnit(u.address);
}

function sameUnit(a, b) { return A.unitKey(a) === A.unitKey(b); }

function buildPlan(o) {
  const today = o.today;
  const cutoff = new Date(new Date(today + 'T00:00:00Z').getTime() - 120 * 864e5).toISOString().slice(0, 10);
  const listings = [], review = [], used = new Set();
  const liveFolder = new Map((o.report.live || []).map(x => [x.id, x.folder]));
  const createdOf = new Map((o.drive.units || []).map(u => [NYC_UNITS + '/' + u.building + '/' + u.name, u.created]));
  const existing = o.existing || [], merged = new Set();
  const findExisting = (street, unit) => existing.find(e => {
    const u = streetUnitOf(e.core); return A.same(u.street || u.address, street) && sameUnit(u.unit, unit);
  });

  // a library row merges into one listing only: sales choose first, then rentals
  const featured = (o.rows || []).filter(r => r.feed === 'featured');
  const mergeFor = new Map();
  featured.slice().sort((a, b) => (a.kind === 'sale' ? 0 : 1) - (b.kind === 'sale' ? 0 : 1)).forEach(r => {
    const ex = findExisting(r.street, r.unit);
    if (ex && !merged.has(ex.id)) { merged.add(ex.id); mergeFor.set(r.id, ex); }
  });

  featured.forEach(r => {
    const folder = liveFolder.get(r.id) || null;
    const ex = mergeFor.get(r.id);
    if (folder) used.add(folder);
    listings.push({ source: 'DE', include: true, street: r.street, unit: r.unit, kind: r.kind, market: MARKET[r.state] || null,
      stage: r.stage, deId: r.id, deStatus: r.status, price: r.price, beds: r.beds, baths: r.baths, state: r.state,
      folder, opened: folder ? createdOf.get(folder) || null : null, existingId: ex ? ex.id : null, existingLabel: ex ? ex.label : null });
  });

  (o.report.lnk || []).forEach(l => {
    if (!l.target) return review.push({ name: l.name, why: 'The shortcut points to a folder that no longer exists.' });
    if (l.onDE) return;   // live ones came in from DE; sold ones stay out (D31)
    const segs = l.target.split('/'), i = segs.indexOf('Building Information');
    const building = segs[i + 1], unitSeg = segs[i + 2];
    if (i === -1 || !unitSeg || /building/i.test(unitSeg) || /building/i.test(l.name)) {
      return review.push({ name: l.name, why: 'Points to a whole building, not one unit. Link it by hand if it is a job.' });
    }
    used.add(l.target);
    listings.push({ source: 'lnk', include: false, street: building, unit: unitSeg.split(' - ')[0].trim(), kind: 'sale', market: 'NYC',
      stage: 'Won', folder: l.target, opened: createdOf.get(l.target) || null, existingId: null, note: 'In ACTIVE LISTINGS & DEALS, not on DE' });
  });

  // Recent unit folders. A building folder whose subfolders aren't units
  // ("8 Woolley NJ/Raw", "194 RSD/Floorplan") is itself the job.
  const isClaimed = folder => [...used].some(f => f === folder || f.indexOf(folder + '/') === 0 || folder.indexOf(f + '/') === 0);
  const byBuilding = new Map();
  (o.drive.units || []).forEach(u => { if (!byBuilding.has(u.building)) byBuilding.set(u.building, []); byBuilding.get(u.building).push(u); });
  byBuilding.forEach((units, building) => {
    const unitLike = units.filter(u => UNIT_NAME.test(u.name.replace(/^#\s*/, '')) && !UNIT_SKIP.test(u.name));
    if (!unitLike.length) {
      const newest = units.map(u => u.created).sort().pop();
      const folder = NYC_UNITS + '/' + building;
      if (newest >= cutoff && !isClaimed(folder)) {
        listings.push({ source: 'recent folder', include: false, street: building, unit: '', kind: 'sale', market: 'NYC', stage: 'Won',
          folder, opened: units.map(u => u.created).sort()[0], existingId: null, note: 'Folder with ' + units.map(u => u.name).join(', ') });
      }
      return;
    }
    unitLike.forEach(u => {
      const folder = NYC_UNITS + '/' + building + '/' + u.name;
      if (u.created < cutoff || isClaimed(folder)) return;
      listings.push({ source: 'recent folder', include: false, street: building, unit: u.name.split(' - ')[0].replace(/\s*rental$/i, '').replace(/^#\s*/, '').trim(),
        kind: /rental/i.test(u.name) ? 'rental' : 'sale', market: 'NYC', stage: 'Won', folder, opened: u.created, existingId: null,
        note: 'Unit folder made ' + u.created });
    });
  });

  const pitches = [];
  (o.drive.pitches || []).forEach(name => {
    const p = parsePitch(name);
    if (!p) {
      if (/^\d{4}-\d{1,2}-\d{1,2}\s/.test(name)) review.push({ name, why: 'A pitch folder not named like an address. Left out: names of people are never stored. Rename it to the address to bring it in.' });
      return;
    }
    const sameStreet = listings.filter(l => A.same(l.street, p.street));
    const hit = p.unit ? sameStreet.find(l => sameUnit(l.unit, p.unit)) : (sameStreet.length === 1 ? sameStreet[0] : null);
    const base = { include: true, date: p.date, street: p.street, unit: p.unit, market: hit ? hit.market : 'NYC', folder: PITCHES_DIR + '/' + name };
    if (hit) pitches.push(Object.assign(base, { outcome: 'won', wonStreet: hit.street, wonUnit: hit.unit }));
    else if (p.date >= '2026-01-01') pitches.push(Object.assign(base, { outcome: 'open' }));
  });

  const devs = [];
  ['NJ', 'FL'].forEach(m => (o.drive.devs[m] || []).forEach(name => {
    if (DEV_SKIP.test(name)) return;
    devs.push({ include: false, label: name.replace(/^\d+\s*-\s*/, ''), market: m, folder: (o.drive.devFolders || DEV_DIRS)[m] + '/' + name });
  }));

  return { today, listings, pitches, devs, review, untouched: existing.filter(e => !merged.has(e.id)).map(e => ({ id: e.id, label: e.label })) };
}

async function applyPlan(o) {
  const { client, plan } = o;
  const now = (o.now || new Date()).toISOString();
  // safe to run again after ticking more: a job already in the database is skipped, never added twice
  const first = async (table, where) => (await client.select(table, where))[0];
  const run = (await client.insert('sync_runs', { kind: 'seed', started_at: now }))[0];
  const out = { listings: 0, pitches: 0, devs: 0 };
  const ids = new Map();
  const key = (s, u) => A.normalize(s) + '|' + A.unitKey(u);
  const hist = (owner, id, at, field, newV, note) => ({ [owner]: id, at, field, old_value: null, new_value: newV, note, source: 'seed', run_id: run.id });

  for (const l of plan.listings.filter(x => x.include)) {
    const fields = { kind: l.kind, market: l.market, stage: l.stage, stage_source: 'seed', units: l.unit ? [l.unit] : [],
      de_listing_id: l.deId || null, drive_folder: l.folder || null, folder_state: l.folder ? 'linked' : 'unlinked' };
    let row;
    const core = { address: l.street, unit: l.unit, state: l.state || null, price: l.price || null, beds: l.beds || null, baths: l.baths || null };
    Object.keys(core).forEach(k => { if (core[k] == null || core[k] === '') delete core[k]; });
    const there = l.existingId ? await first('properties', { id: l.existingId })
      : (l.deId && await first('properties', { de_listing_id: l.deId })) || await first('properties', { slug: P.slugOfCore(core) });
    if (there && there.stage) { ids.set(key(l.street, l.unit), there.id); continue; }   // seeded before
    if (l.existingId) {
      const cur = there;
      row = (await client.update('properties', { id: l.existingId }, fields, { version: cur.version }))[0];
    } else {
      row = (await client.insert('properties', Object.assign({ slug: P.slugOfCore(core), label: P.labelOf(core), core }, fields)))[0];
    }
    ids.set(key(l.street, l.unit), row.id);
    const changes = [];
    if (l.opened) changes.push(hist('property_id', row.id, l.opened + 'T12:00:00Z', 'stage', 'Won', 'Folder opened'));
    if (!(l.opened && l.stage === 'Won')) changes.push(hist('property_id', row.id, now, 'stage', l.stage, l.source === 'DE' ? 'On DE when the workspace started' : 'Added at the start'));
    await client.insert('changes', changes);
    out.listings++;
  }

  for (const p of plan.pitches.filter(x => x.include)) {
    const won = p.outcome === 'won' ? ids.get(key(p.wonStreet, p.wonUnit)) : null;
    // won by a listing Matt didn't tick: a 2026 pitch stays as an open one, an older one is left out
    if (p.outcome === 'won' && !won && p.date < '2026-01-01') continue;
    const label = [p.street, p.unit].filter(Boolean).join(' ');
    if (await first('pitches', { slug: P.slugOf(label + ' ' + p.date) })) continue;
    const row = (await client.insert('pitches', { slug: P.slugOf(label + ' ' + p.date), label, market: p.market, pitched_on: p.date,
      core: { address: p.street, unit: p.unit }, drive_folder: p.folder, folder_state: 'linked', outcome: won ? 'won' : 'open',
      won_property_id: won || null }))[0];
    if (won) {
      const cur = (await client.select('properties', { id: won }))[0];
      await client.update('properties', { id: won }, { from_pitch_id: row.id }, { version: cur.version });
    }
    await client.insert('changes', hist('pitch_id', row.id, p.date + 'T12:00:00Z', null, null, 'Pitched'));
    out.pitches++;
  }

  for (const d of plan.devs.filter(x => x.include)) {
    if (await first('dev_projects', { slug: P.slugOf(d.label) })) continue;
    await client.insert('dev_projects', { slug: P.slugOf(d.label), label: d.label, market: d.market, drive_folder: d.folder, folder_state: 'linked' });
    out.devs++;
  }

  await client.update('sync_runs', { id: run.id }, { finished_at: new Date().toISOString(), ok: true,
    changes: out.listings + out.pitches + out.devs, rows_read: out });
  return out;
}

/* ---------- reading Drive (names and dates only) ---------- */

function readDrive(root) {
  const dirs = abs => { try { return fs.readdirSync(abs, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { return []; } };
  const born = abs => { try { const s = fs.statSync(abs); return (s.birthtime.getTime() ? s.birthtime : s.mtime).toISOString().slice(0, 10); } catch (e) { return '0000-00-00'; } };
  const nyc = path.join(root, ...NYC_UNITS.split('/'));
  const units = [];
  dirs(nyc).forEach(b => dirs(path.join(nyc, b)).forEach(u => units.push({ building: b, name: u, created: born(path.join(nyc, b, u)) })));
  return {
    units,
    pitches: dirs(path.join(root, ...PITCHES_DIR.split('/'))),
    devs: { NJ: dirs(path.join(root, ...DEV_DIRS.NJ.split('/'))), FL: dirs(path.join(root, ...DEV_DIRS.FL.split('/'))) },
    devFolders: DEV_DIRS
  };
}

function planMarkdown(plan) {
  const box = x => (x.include ? '[x]' : '[ ]');
  const L = ['# Seed plan, ' + plan.today, '',
    'The jobs the overview would start with (D31: only what is active now). Ticked = in. Untick or tick anything; Claude edits the .json and applies it once the database is ready.', '',
    '## Listings (' + plan.listings.length + ')', '', '| In | Listing | Kind | Stage | From | Folder | Note |', '|---|---|---|---|---|---|---|'];
  plan.listings.forEach(l => L.push('| ' + box(l) + ' | ' + l.street + (l.unit ? ' ' + l.unit : '') + ' (' + (l.market || '?') + ') | ' + l.kind + ' | ' + l.stage + ' | ' + l.source +
    ' | ' + (l.folder || '**no folder yet**') + ' | ' + [l.existingLabel ? 'merges into library row "' + l.existingLabel + '"' : '', l.opened ? 'folder made ' + l.opened : '', l.note || ''].filter(Boolean).join('; ') + ' |'));
  L.push('', '## Pitches (' + plan.pitches.length + ')', '', '| In | Date | Pitch | Outcome | Folder |', '|---|---|---|---|---|');
  plan.pitches.forEach(p => L.push('| ' + box(p) + ' | ' + p.date + ' | ' + p.street + (p.unit ? ' ' + p.unit : '') + ' | ' + (p.outcome === 'won' ? 'won → ' + p.wonStreet + ' ' + p.wonUnit : 'open') + ' | ' + p.folder + ' |'));
  L.push('', '## Developments (' + plan.devs.length + ', listed only, not scanned)', '', '| In | Development | Market | Folder |', '|---|---|---|---|');
  plan.devs.forEach(d => L.push('| ' + box(d) + ' | ' + d.label + ' | ' + d.market + ' | ' + d.folder + ' |'));
  L.push('', '## For Matt to look at (not brought in)', '');
  plan.review.forEach(r => L.push('- **' + r.name + '**: ' + r.why));
  L.push('', '## Library rows left as they are (no stage, not on the overview)', '');
  plan.untouched.forEach(u => L.push('- ' + u.label));
  return L.join('\n') + '\n';
}

module.exports = { parsePitch, splitStreetUnit, buildPlan, applyPlan, readDrive, planMarkdown };

if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i === -1 ? null : a[i + 1]; };
  const exportsDir = path.join(__dirname, '..', 'exports');
  if (a.includes('--plan')) {
    (async () => {
      const report = await require('./de-sync.js').dryRun({ fixturesDir: arg('--fixtures') || undefined, outDir: path.join(exportsDir, 'seed-runs') });
      if (!report.ok) throw new Error('The DE read aborted: ' + report.aborted);
      const existing = arg('--existing') ? JSON.parse(fs.readFileSync(arg('--existing'), 'utf8')) : [];
      const today = new Date().toISOString().slice(0, 10);
      const plan = buildPlan({ report, rows: report.rows, drive: readDrive('G:\\Shared drives'), existing, today });
      fs.mkdirSync(exportsDir, { recursive: true });
      fs.writeFileSync(path.join(exportsDir, 'seed-plan-' + today + '.json'), JSON.stringify(plan, null, 2));
      fs.writeFileSync(path.join(exportsDir, 'seed-plan-' + today + '.md'), planMarkdown(plan));
      console.log('Seed plan: ' + plan.listings.filter(x => x.include).length + ' of ' + plan.listings.length + ' listings ticked, ' +
        plan.pitches.length + ' pitches, ' + plan.devs.length + ' developments, ' + plan.review.length + ' to look at. exports/seed-plan-' + today + '.md');
    })().catch(e => { console.log('Seed plan failed: ' + e.message); process.exit(1); });
  } else if (a.includes('--apply')) {
    const cfg = require('./config.js').loadConfig(), client = require('./supabase.js').createClient(cfg);
    if (!client.ready()) { console.log('No helper account yet.'); process.exit(1); }
    applyPlan({ client, plan: JSON.parse(fs.readFileSync(arg('--apply'), 'utf8')) })
      .then(o => console.log('Seeded ' + o.listings + ' listings, ' + o.pitches + ' pitches, ' + o.devs + ' developments.'),
        e => { console.log('Seed failed: ' + e.message); process.exit(1); });
  } else {
    console.log('Usage: node helper/seed.js --plan [--existing <json>] [--fixtures <dir>]  |  --apply <plan.json>');
  }
}
