/* ============================================================
   WORKSPACE DATA — database rows → what the /workspace/ pages draw.

     buildJobs({ properties, pitches, devProjects, changes }, today, { archived })
       → Job[]: one per listing (with a stage), open pitch and development.
         A won pitch folds into its listing (its date shows as pitchedOn).
         Library rows without a stage (old tool saves) stay off; Archived
         jobs only when asked.
     overviewStats(jobs)             → { live, contract, toLink, total }
     taskFlags(jobs)                 → [{ job, href, text, market }]  (no "won or lost?", D32)
     recentChanges(changes, jobs, n) → [{ job, href, title, when, kind }]
     syncHealth(lastDeRun, now)      → { state: 'ok'|'amber'|'red'|'never', text, why }
     fmtDay('2026-10-12') → '12 Oct'; money(4500000) → '$4,500,000'

   Pure: no fetch, no DOM. Loads in the browser (window.GVC_WS) and in Node.
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_WS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var STAGES = ['Pitch', 'Won', 'Floorplan', 'Showsheet', 'Photos', 'Brochure', 'Live', 'In contract', 'Sold', 'Archived'];
  var DEV = ['Agreement', 'Architecturals', 'Renders', 'Finishes', 'Floorplans', 'Branding', 'Launch event', 'Showing assets', 'Construction', 'Contracts & sales'];
  var PIECE_STAGE = { floorplan: 'Floorplan', showsheet: 'Showsheet', photos: 'Photos', brochure: 'Brochure' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  /* a timestamp's day on this computer's clock (a 9:30 pm change in New York
     is that day, not the next UTC day); a plain date is left as it is */
  function day(s) {
    if (!s) return null;
    s = String(s);
    return s.indexOf('T') === -1 ? s.slice(0, 10) : ymd(new Date(s));
  }
  function today(now) { return ymd(now || new Date()); }
  function mondayOf(s) { var d = new Date(day(s) + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
  function fmtDay(s) { if (!s) return ''; var d = new Date(day(s) + 'T12:00:00'); return d.getDate() + ' ' + MON[d.getMonth()]; }
  function fmtWhen(iso) {
    var d = new Date(iso), h = d.getHours(), m = d.getMinutes();
    return DAY[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ', ' + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function money(n) { return n == null || n === '' || isNaN(n) ? '' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function stageIndex(s) { return s === 'Rented' ? STAGES.indexOf('Sold') : STAGES.indexOf(s); }

  /* DE writes addresses in capitals ("555 W 59TH ST"); make them readable,
     leave anything already mixed-case as typed */
  function readable(s) {
    s = String(s || '').trim();
    if (/[a-z]/.test(s)) return s;
    return s.split(/\s+/).map(function (w) {
      if (/^\d/.test(w)) return w.toLowerCase();
      if (w.length === 1) return w;
      return w.charAt(0) + w.slice(1).toLowerCase();
    }).join(' ');
  }

  /* the unit, also when an old library row keeps it inside the address line */
  function addrUnit(core) {
    core = core || {};
    var a = String(core.address || '').trim(), u = String(core.unit || '').trim();
    if (!u) { var c = a.lastIndexOf(','); if (c !== -1) { u = a.slice(c + 1).trim().replace(/^residence\s+/i, ''); a = a.slice(0, c).trim(); } }
    return { address: a, unit: u };
  }

  var BAR = { Won: 'won', Floorplan: 'won', Showsheet: 'won', Photos: 'won', Brochure: 'won', Live: 'live', 'In contract': 'contract', Sold: 'sold', Rented: 'sold' };
  var CHIP = { Live: 'live', 'In contract': 'contract', Sold: 'sold', Rented: 'sold' };

  function buildJobs(rows, today, opts) {
    var archived = !!(opts && opts.archived);
    var changes = (rows.changes || []).slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    var byProp = {}, byPitch = {}, byDev = {};
    changes.forEach(function (c) {
      var m = c.property_id ? byProp : c.pitch_id ? byPitch : byDev, k = c.property_id || c.pitch_id || c.dev_project_id;
      (m[k] = m[k] || []).push(c);
    });
    var wonPitch = {};
    (rows.pitches || []).forEach(function (p) { if (p.outcome === 'won' && p.won_property_id) wonPitch[p.won_property_id] = p; });
    var jobs = [];

    (rows.properties || []).forEach(function (p) {
      if (!p.stage || (p.stage === 'Archived' && !archived)) return;
      var core = p.core || {}, de = p.de || {}, au = addrUnit(core), ch = byProp[p.id] || [];
      var pitch = wonPitch[p.id];
      var done = {}, firstAt = {};
      ch.forEach(function (c) { if (c.field === 'stage' && c.new_value && !firstAt[c.new_value]) firstAt[c.new_value] = day(c.at); });
      var found = (p.scan && p.scan.found) || {};
      Object.keys(PIECE_STAGE).forEach(function (k) { if (found[k] && !firstAt[PIECE_STAGE[k]]) firstAt[PIECE_STAGE[k]] = found[k]; });
      STAGES.concat(['Rented']).forEach(function (s) { if (firstAt[s]) done[s] = firstAt[s]; });

      // timeline bars from the stage moves in the change log
      var moves = ch.filter(function (c) { return c.field === 'stage' && c.new_value; });
      var bars = [];
      if (pitch && pitch.pitched_on) bars.push({ s: 'pitch', from: pitch.pitched_on, to: moves.length ? day(moves[0].at) : null });
      moves.forEach(function (c, i) {
        bars.push({ s: BAR[c.new_value] || 'won', from: day(c.at), to: moves[i + 1] ? day(moves[i + 1].at) : null });
      });
      var ticks = Object.keys(found).map(function (k) { return { d: found[k], label: PIECE_STAGE[k] }; })
        .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });

      var dates = ch.map(function (c) { return day(c.at); }).concat(ticks.map(function (t) { return t.d; }))
        .filter(function (d) { return d && d <= today; }).sort();
      var flags = [];
      if (p.folder_state === 'unlinked') flags.push({ t: 'Link folder', k: 'link' });
      if (p.folder_state === 'broken') flags.push({ t: 'Relink folder', k: 'relink' });
      if (!p.de_listing_id && ['Live', 'In contract', 'Sold', 'Rented'].indexOf(p.stage) !== -1) flags.push({ t: 'Match DE', k: 'de' });
      var price = de.price != null ? de.price : core.price, beds = de.beds != null ? de.beds : core.beds, baths = de.baths != null ? de.baths : core.baths;

      jobs.push({
        id: p.id, slug: p.slug, type: p.kind === 'rental' ? 'rental' : 'listing', kind: p.kind, market: p.market || '',
        name: readable(au.address) + (au.unit ? ' ' + au.unit : ''), stage: p.stage, stageSource: p.stage_source || null,
        chip: CHIP[p.stage] || 'pre', price: price != null ? money(price) + (p.kind === 'rental' ? '/mo' : '') : '',
        rooms: beds != null && baths != null ? beds + ' bd · ' + baths + ' ba' : '', place: core.neighborhood || core.city || '',
        deStatus: p.de_status || de.status || null, deId: p.de_listing_id || null, listingUrl: core.listingUrl || de.listingUrl || null,
        folder: p.drive_folder || null, folderState: p.folder_state, pitchedOn: pitch ? pitch.pitched_on : null,
        steps: STAGES, stageIdx: stageIndex(p.stage), done: done, bars: bars, ticks: ticks,
        activity: (p.scan && p.scan.weeks) || {}, flags: flags, last: dates.length ? dates[dates.length - 1] : null,
        href: 'job/?listing=' + encodeURIComponent(p.slug), version: p.version
      });
    });

    (rows.pitches || []).forEach(function (q) {
      if (q.outcome === 'won' && q.won_property_id) return;
      var ch = byPitch[q.id] || [], flags = [];
      if (q.folder_state === 'unlinked') flags.push({ t: 'Link folder', k: 'link' });
      if (q.folder_state === 'broken') flags.push({ t: 'Relink folder', k: 'relink' });
      var dates = [q.pitched_on].concat(ch.map(function (c) { return day(c.at); })).filter(Boolean).sort();
      jobs.push({
        id: q.id, slug: q.slug, type: 'pitch', market: q.market || '', name: q.label, stage: q.outcome === 'not won' ? 'Not won' : 'Pitch',
        chip: 'pre', price: '', rooms: '', place: '', folder: q.drive_folder || null, folderState: q.folder_state,
        pitchedOn: q.pitched_on, steps: STAGES, stageIdx: 0, done: { Pitch: q.pitched_on }, outcome: q.outcome,
        bars: q.pitched_on ? [{ s: 'pitch', from: q.pitched_on, to: null }] : [], ticks: [], activity: (q.scan && q.scan.weeks) || {},
        flags: flags, last: dates.length ? dates[dates.length - 1] : null, href: 'job/?pitch=' + encodeURIComponent(q.slug), version: q.version
      });
    });

    (rows.devProjects || []).forEach(function (d) {
      var ms = d.milestones || {}, idx = -1, flags = [];
      DEV.forEach(function (m, i) { if (ms[m] && ms[m].done) idx = i; });
      if (d.folder_state === 'unlinked') flags.push({ t: 'Link folder', k: 'link' });
      if (d.folder_state === 'broken') flags.push({ t: 'Relink folder', k: 'relink' });
      var dated = DEV.filter(function (m) { return ms[m] && ms[m].on; }).map(function (m) { return { d: ms[m].on, label: m }; });
      jobs.push({
        id: d.id, slug: d.slug, type: 'development', market: d.market || '', name: d.label, stage: idx >= 0 ? DEV[idx] : 'No milestones yet',
        chip: 'pre', price: '', rooms: '', place: d.size_band ? d.size_band : '', folder: d.drive_folder || null, folderState: d.folder_state,
        steps: DEV, stageIdx: idx, done: {}, milestones: ms, bars: [], ticks: dated, activity: {}, flags: flags,
        last: dated.length ? dated.map(function (x) { return x.d; }).sort().pop() : null, href: 'job/?dev=' + encodeURIComponent(d.slug), version: d.version
      });
    });
    return jobs;
  }

  function overviewStats(jobs) {
    return {
      live: jobs.filter(function (j) { return j.stage === 'Live'; }).length,
      contract: jobs.filter(function (j) { return j.stage === 'In contract'; }).length,
      toLink: jobs.filter(function (j) { return j.flags.length > 0; }).length,
      total: jobs.length
    };
  }

  var TASK = { link: 'Link the Drive folder', relink: 'Relink the folder (moved or renamed)', de: 'Match to a DE listing' };
  function taskFlags(jobs) {
    var out = [];
    jobs.forEach(function (j) {
      j.flags.forEach(function (f) { out.push({ job: j.name, href: j.href, text: TASK[f.k], market: j.market, kind: f.k }); });
      if ((j.stage === 'Sold' || j.stage === 'Rented') && j.stageSource === 'DE') {
        out.push({ job: j.name, href: j.href, text: j.stage + ' on DE. Archive the job?', market: j.market, kind: 'archive' });
      }
    });
    return out;
  }

  function changeTitle(c) {
    if (c.field === 'stage') return 'Stage moved to ' + c.new_value;
    if (c.field === 'price') return 'Price ' + money(c.old_value) + ' → ' + money(c.new_value);
    if (c.field === 'closePrice') return 'Closed at ' + money(c.new_value);
    if (c.field === 'folder_state' && c.new_value === 'broken') return 'Folder moved or renamed';
    if (c.field === 'drive_folder') return 'Folder linked';
    if (c.field) return c.field + ' changed';
    return c.note || 'Changed';
  }

  function recentChanges(changes, jobs, n) {
    var owner = {};
    jobs.forEach(function (j) { owner[j.id] = j; });
    return (changes || []).slice().sort(function (a, b) { return a.at > b.at ? -1 : 1; })
      .filter(function (c) { return owner[c.property_id || c.pitch_id || c.dev_project_id]; })
      .slice(0, n).map(function (c) {
        var j = owner[c.property_id || c.pitch_id || c.dev_project_id];
        return { job: j.name, href: j.href, market: j.market, stage: j.stage, title: changeTitle(c), note: c.field === 'price' ? null : (c.field ? c.note : null),
          when: day(c.at), kind: c.field === 'stage' ? (CHIP[c.new_value] || 'pre') : 'pre' };
      });
  }

  function syncHealth(run, now) {
    now = now || new Date();
    if (!run) return { state: 'never', text: 'DE hasn\'t synced yet', why: null };
    var at = new Date(run.started_at);
    if (run.ok === false) {
      var e = (run.errors && run.errors[0]) || {};
      return { state: 'red', text: 'DE sync failed ' + fmtWhen(run.started_at), why: e.detail || e.what || 'No reason was recorded.' };
    }
    if (now - at > 36 * 3600e3) return { state: 'amber', text: 'DE hasn\'t synced since ' + fmtWhen(run.started_at) + '. Is the PC on?', why: null };
    return { state: 'ok', text: 'DE synced ' + fmtWhen(run.started_at), why: null };
  }

  /* DE's status codes in the words DE's own site uses */
  var DE_WORDS = { Active: 'Active', ActiveUnderContract: 'Contract signed', Pending: 'Pending', Sold: 'Sold', Rented: 'Rented' };
  function deLabel(s) { return s ? DE_WORDS[s] || s : ''; }

  return { STAGES: STAGES, DEV: DEV, deLabel: deLabel, day: day, today: today, mondayOf: mondayOf, buildJobs: buildJobs, overviewStats: overviewStats, taskFlags: taskFlags,
    recentChanges: recentChanges, syncHealth: syncHealth, fmtDay: fmtDay, fmtWhen: fmtWhen, money: money, readable: readable };
});
