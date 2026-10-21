/* ============================================================
   WORKSPACE DATA — database rows → what the /workspace/ pages draw.

     buildJobs({ properties, pitches, devProjects, changes }, today, { archived, agentName })
       → Job[]: one per listing (with a stage), open pitch and development.
         A won pitch folds into its listing (its date shows as pitchedOn).
         Library rows without a stage (old tool saves) stay off; Archived
         jobs only when asked. agentName(id) → name (default: roster.js's
         GVC_AGENT when the page loaded it).
         Every job also has:
           dates      [{ key, label, on, planned }]  deal dates from
                      properties.milestones, date order; planned = after today (S7)
           match      the stored Match result minus what was dismissed at
                      its current values; mismatches = its length
           asanaUrl   the task's Asana link (https only) or null
           agents     confirmed agent names, else the ones Asana suggests
         and a development: next { key, label, on, overdue } | null,
         slips (times a milestone was re-dated, D67), progress { done, total }
         (confirmed milestones of D66's 18), construction { done, total } | null,
         hints (Asana suggestions waiting for Matt, S13).
     overviewStats(jobs)             → { live, contract, toLink, total, mismatches }
     taskFlags(jobs)                 → [{ job, href, text, market }]  (no "won or lost?", D32)
     recentChanges(changes, jobs, n) → [{ job, href, title, when, kind }]
     syncHealth(lastDeRun, now)      → { state: 'ok'|'amber'|'red'|'never', text, why }   36 h
     asanaHealth(lastAsanaRun, now)  → the same for Asana, amber after 6 h
     statusRows(jobs)   → [{ market, rows: [{ name, href, stage, chip, lastMilestone,
                           nextDate, agents, mismatches }] }]   the team Status page (S9):
                           listings and open pitches, by market, then stage order
     matchGroups(jobs, drift) → [{ fixAt, people: [{ who, items: [{ job, href, id, table,
                           code, key, text, since, asanaUrl, paste }] }] }]   the Match
                           page (S10): Asana, DE, Drive, Matt, then 'Roster' (drift)
     fmtDay('2026-10-12') → '12 Oct'; money(4500000) → '$4,500,000'

   Pure: no fetch, no DOM. Loads in the browser (window.GVC_WS) and in Node.
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory(global);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_WS = api;
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  /* listing rows (S6); a pitch is its own row type, shown first on a listing's steps */
  var STAGES = ['Prep', 'Live', 'Accepted offer', 'In contract', 'Sold', 'Rented', 'Off market', 'Archived'];
  var ORDER = ['Pitch'].concat(STAGES);
  /* D66's 18 development milestones (asana-map.js MILESTONES), with their names */
  var DEV_MS = [['agreement', 'Agreement'], ['landClosed', 'Land closed'], ['architecturals', 'Architecturals'], ['permits', 'Permits / zoning'],
    ['renders', 'Renders'], ['finishes', 'Finishes'], ['floorplans', 'Floorplans'], ['branding', 'Branding'], ['listingAgreement', 'Listing agreement'],
    ['websiteLive', 'Website live'], ['groundbreaking', 'Groundbreaking'], ['launchEvent', 'Launch event'], ['showingAssets', 'Showing assets ready'],
    ['listedUnits', 'Listed units'], ['construction', 'Construction'], ['tco', 'TCO / CO'], ['contractsSales', 'Contracts & sales'], ['closedOut', 'Closed out']];
  var DEV_KEYS = DEV_MS.map(function (m) { return m[0]; });
  var DEV = DEV_MS.map(function (m) { return m[1]; });
  var DEV_LABEL = {}; DEV_MS.forEach(function (m) { DEV_LABEL[m[0]] = m[1]; });
  /* deal dates (asana-map.js datesOf): [done label, planned label] */
  var DATE_LABEL = {
    pitchedOn: ['Pitched', 'Pitch'], exclusiveOn: ['Exclusive', 'Exclusive'], estListingOn: ['Est. listing', 'Est. listing'],
    listedOn: ['Listed', 'Listing'], acceptedOfferOn: ['Accepted offer', 'Accepted offer'], contractOn: ['Contract signed', 'Contract'],
    boardPackageOn: ['Board package', 'Board package'], boardInterviewOn: ['Board interview', 'Board interview'], boardApprovedOn: ['Board approved', 'Board approval'],
    ccOn: ['CC', 'CC'], closedOn: ['Closed', 'Closing'], exclusiveExpiresOn: ['Exclusive expired', 'Exclusive expires'], offMarketOn: ['Off market', 'Off market']
  };
  var PIECE_LABEL = { floorplan: 'Floorplan', showsheet: 'Showsheet', photos: 'Photos', brochure: 'Brochure' };
  var FIX = ['Asana', 'DE', 'Drive', 'Matt'];
  var MARKETS = ['NYC', 'NJ', 'FL'];
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
  /* n months from d, kept inside the target month (31 Aug - 6 months = 28 Feb) */
  function addMonths(d, n) {
    var t = new Date(d.getFullYear(), d.getMonth() + n, 1), last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d.getDate(), last)); return t;
  }
  function mondayOf(s) { var d = new Date(day(s) + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
  function fmtDay(s) { if (!s) return ''; var d = new Date(day(s) + 'T12:00:00'); return d.getDate() + ' ' + MON[d.getMonth()]; }
  function fmtWhen(iso) {
    var d = new Date(iso), h = d.getHours(), m = d.getMinutes();
    return DAY[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ', ' + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function money(n) { return n == null || n === '' || isNaN(n) ? '' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function same(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
  function web(u) { return typeof u === 'string' && /^https:\/\//.test(u) ? u : null; }

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

  var BAR = { Prep: 'won', Live: 'live', 'Accepted offer': 'contract', 'In contract': 'contract', Sold: 'sold', Rented: 'sold', 'Off market': 'sold' };
  var CHIP = { Live: 'live', 'Accepted offer': 'contract', 'In contract': 'contract', Sold: 'sold', Rented: 'sold' };

  /* a listing's steps: the pitch, Prep → In contract, then Sold or Rented;
     Off market / Archived only when the job is there */
  function stepsOf(kind, stage) {
    var s = ['Pitch', 'Prep', 'Live', 'Accepted offer', 'In contract', kind === 'rental' || stage === 'Rented' ? 'Rented' : 'Sold'];
    if (stage === 'Off market' || stage === 'Archived') s.push(stage);
    return s;
  }

  /* the stored Match result minus what was dismissed at its current values */
  function activeMatch(m) {
    m = m || {};
    var d = m.dismissed || {};
    return (m.list || []).filter(function (x) { var k = d[x.key || x.code]; return !(k && same(k.values, x.values)); });
  }

  function datesOf(ms, today) {
    ms = ms || {};
    return Object.keys(DATE_LABEL).filter(function (k) { return ms[k] && ms[k].on; }).map(function (k) {
      var on = day(ms[k].on), planned = on > today;
      return { key: k, label: DATE_LABEL[k][planned ? 1 : 0], on: on, planned: planned };
    }).sort(function (a, b) { return a.on < b.on ? -1 : a.on > b.on ? 1 : 0; });
  }

  function asanaUrlOf(row) {
    var a = row.asana || {}, gid = row.asana_gid || a.gid;
    return web(a.permalink) || web(a.asanaUrl) || (gid && /^\d+$/.test(String(gid)) ? 'https://app.asana.com/0/' + (/^\d+$/.test(String(a.projectGid || '')) ? a.projectGid : '0') + '/' + gid : null);
  }

  function buildJobs(rows, today, opts) {
    opts = opts || {};
    var archived = !!opts.archived;
    var agentName = opts.agentName || function (id) { var a = global && global.GVC_AGENT && global.GVC_AGENT(id); return a ? a.name : null; };
    var namesOf = function (core) {
      var ids = (core.agentIds && core.agentIds.length ? core.agentIds : core.suggestedAgentIds) || [];
      return ids.map(agentName).filter(Boolean);
    };
    var changes = (rows.changes || []).slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    var byProp = {}, byPitch = {}, byDev = {};
    changes.forEach(function (c) {
      var m = c.property_id ? byProp : c.pitch_id ? byPitch : byDev, k = c.property_id || c.pitch_id || c.dev_project_id;
      (m[k] = m[k] || []).push(c);
    });
    var wonPitch = {};
    // a won pitch folds into its listing only when that listing is on the overview (it has a stage)
    var staged = {}; (rows.properties || []).forEach(function (p) { if (p.stage) staged[p.id] = true; });
    (rows.pitches || []).forEach(function (p) { if (p.outcome === 'won' && staged[p.won_property_id]) wonPitch[p.won_property_id] = p; });
    var jobs = [];

    (rows.properties || []).forEach(function (p) {
      if (!p.stage || (p.stage === 'Archived' && !archived)) return;
      var core = p.core || {}, de = p.de || {}, au = addrUnit(core), ch = byProp[p.id] || [];
      var pitch = wonPitch[p.id];
      var done = {};
      ch.forEach(function (c) { if (c.field === 'stage' && c.new_value && !done[c.new_value] && STAGES.indexOf(c.new_value) !== -1) done[c.new_value] = day(c.at); });
      var found = (p.scan && p.scan.found) || {};

      // timeline bars from the stage moves in the change log
      var moves = ch.filter(function (c) { return c.field === 'stage' && c.new_value; });
      var bars = [];
      if (pitch && pitch.pitched_on) bars.push({ s: 'pitch', from: pitch.pitched_on, to: moves.length ? day(moves[0].at) : null });
      moves.forEach(function (c, i) {
        bars.push({ s: BAR[c.new_value] || 'won', from: day(c.at), to: moves[i + 1] ? day(moves[i + 1].at) : null });
      });
      var ticks = Object.keys(found).map(function (k) { return { d: found[k], label: PIECE_LABEL[k] || k }; })
        .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });

      var dates = ch.map(function (c) { return day(c.at); }).concat(ticks.map(function (t) { return t.d; }))
        .filter(function (d) { return d && d <= today; }).sort();
      var flags = [];
      if (p.folder_state === 'unlinked') flags.push({ t: 'Link folder', k: 'link' });
      if (p.folder_state === 'broken') flags.push({ t: 'Relink folder', k: 'relink' });
      if (!p.de_listing_id && ['Live', 'In contract', 'Sold', 'Rented'].indexOf(p.stage) !== -1) flags.push({ t: 'Match DE', k: 'de' });
      var price = de.price != null ? de.price : core.price, beds = de.beds != null ? de.beds : core.beds, baths = de.baths != null ? de.baths : core.baths;
      var steps = stepsOf(p.kind, p.stage), match = activeMatch(p.match);

      jobs.push({
        id: p.id, slug: p.slug, type: p.kind === 'rental' ? 'rental' : 'listing', kind: p.kind, market: p.market || '',
        name: au.address ? readable(au.address) + (au.unit ? ' ' + au.unit : '') : (p.label || 'Untitled listing'), stage: p.stage, stageSource: p.stage_source || null,
        chip: CHIP[p.stage] || 'pre', price: price != null ? money(price) + (p.kind === 'rental' ? '/mo' : '') : '',
        rooms: beds != null && baths != null ? beds + ' bd · ' + baths + ' ba' : '', place: core.neighborhood || core.city || '',
        deStatus: p.de_status || de.status || null, deId: p.de_listing_id || null, listingUrl: core.listingUrl || de.listingUrl || null,
        folder: p.drive_folder || null, folderState: p.folder_state, pitchedOn: pitch ? pitch.pitched_on : null,
        steps: steps, stageIdx: steps.indexOf(p.stage === 'Rented' && steps.indexOf('Rented') === -1 ? 'Sold' : p.stage), done: done, bars: bars, ticks: ticks,
        dates: datesOf(p.milestones, today), match: match, mismatches: match.length, asanaUrl: asanaUrlOf(p), agents: namesOf(core),
        activity: (p.scan && p.scan.weeks) || {}, flags: flags, last: dates.length ? dates[dates.length - 1] : null,
        href: 'job/?listing=' + encodeURIComponent(p.slug), version: p.version
      });
    });

    (rows.pitches || []).forEach(function (q) {
      if (q.outcome === 'won' && staged[q.won_property_id]) return;
      var ch = byPitch[q.id] || [], flags = [];
      if (q.folder_state === 'unlinked') flags.push({ t: 'Link folder', k: 'link' });
      if (q.folder_state === 'broken') flags.push({ t: 'Relink folder', k: 'relink' });
      var dates = [q.pitched_on].concat(ch.map(function (c) { return day(c.at); })).filter(Boolean).sort();
      jobs.push({
        id: q.id, slug: q.slug, type: 'pitch', market: q.market || '', name: q.label, stage: q.outcome === 'not won' ? 'Not won' : 'Pitch',
        chip: 'pre', price: '', rooms: '', place: '', folder: q.drive_folder || null, folderState: q.folder_state,
        pitchedOn: q.pitched_on, steps: stepsOf('sale', 'Pitch'), stageIdx: 0, done: { Pitch: q.pitched_on }, outcome: q.outcome,
        dates: q.pitched_on ? [{ key: 'pitchedOn', label: q.pitched_on > today ? 'Pitch' : 'Pitched', on: q.pitched_on, planned: q.pitched_on > today }] : [],
        match: [], mismatches: 0, asanaUrl: asanaUrlOf({ asana_gid: q.asana_gid }), agents: [],
        bars: q.pitched_on ? [{ s: 'pitch', from: q.pitched_on, to: null }] : [], ticks: [], activity: (q.scan && q.scan.weeks) || {},
        flags: flags, last: dates.length ? dates[dates.length - 1] : null, href: 'job/?pitch=' + encodeURIComponent(q.slug), version: q.version
      });
    });

    (rows.devProjects || []).forEach(function (d) {
      var ms = d.milestones || {}, idx = -1, flags = [], nm = d.next_milestone || null;
      DEV_KEYS.forEach(function (k, i) { if (ms[k] && ms[k].done) idx = i; });
      if (d.folder_state === 'unlinked') flags.push({ t: 'Link folder', k: 'link' });
      if (d.folder_state === 'broken') flags.push({ t: 'Relink folder', k: 'relink' });
      var dated = DEV_KEYS.filter(function (k) { return ms[k] && ms[k].on && ms[k].done; }).map(function (k) { return { d: day(ms[k].on), label: DEV_LABEL[k] }; });
      // next: Asana's earliest open milestone task; else the first open milestone with a date
      var next = null;
      if (nm && nm.key && DEV_LABEL[nm.key] && !(ms[nm.key] && ms[nm.key].done)) next = { key: nm.key, label: DEV_LABEL[nm.key], on: nm.dueOn ? day(nm.dueOn) : null };
      else {
        var open = DEV_KEYS.filter(function (k) { return ms[k] && ms[k].on && !ms[k].done; })
          .sort(function (a, b) { return ms[a].on < ms[b].on ? -1 : ms[a].on > ms[b].on ? 1 : 0; })[0];
        if (open) next = { key: open, label: DEV_LABEL[open], on: day(ms[open].on) };
      }
      if (next) next.overdue = !!(next.on && next.on < today);
      var slips = 0;
      Object.keys((nm && nm.slips) || {}).forEach(function (g) { slips += +(nm.slips[g] && nm.slips[g].count) || 0; });
      var cons = nm && nm.construction && nm.construction.total ? { done: nm.construction.done || 0, total: nm.construction.total } : null;
      var match = activeMatch(d.match);
      jobs.push({
        id: d.id, slug: d.slug, type: 'development', market: d.market || '', name: d.label, stage: idx >= 0 ? DEV[idx] : 'No milestones yet',
        chip: 'pre', price: '', rooms: '', place: d.size_band ? d.size_band : '', folder: d.drive_folder || null, folderState: d.folder_state,
        steps: DEV, stageIdx: idx, done: {}, milestones: ms, bars: [], ticks: dated, activity: {}, flags: flags,
        dates: [], match: match, mismatches: match.length, asanaUrl: d.asana_project_gid && /^\d+$/.test(String(d.asana_project_gid)) ? 'https://app.asana.com/0/' + d.asana_project_gid : null, agents: [],
        next: next, slips: slips, progress: { done: DEV_KEYS.filter(function (k) { return ms[k] && ms[k].done; }).length, total: DEV_KEYS.length },
        construction: cons, hints: (d.milestone_hints || []).length,
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
      total: jobs.length,
      mismatches: jobs.reduce(function (n, j) { return n + (j.mismatches || 0); }, 0)
    };
  }

  var TASK = { link: 'Link the Drive folder', relink: 'Relink the folder (moved or renamed)', de: 'Match to a DE listing' };
  function taskFlags(jobs) {
    var out = [];
    jobs.forEach(function (j) {
      j.flags.forEach(function (f) { out.push({ job: j.name, href: j.href, text: TASK[f.k], market: j.market, kind: f.k }); });
      if ((j.stage === 'Sold' || j.stage === 'Rented') && (j.stageSource === 'DE' || j.stageSource === 'Asana')) {
        out.push({ job: j.name, href: j.href, text: j.stage + (j.stageSource === 'DE' ? ' on DE' : ' in Asana') + '. Archive the job?', market: j.market, kind: 'archive' });
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
    if (c.field === 'match' || c.field === 'milestones' || c.field === 'milestone_hints') return c.note || 'Changed';
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
        var noteToo = c.field && ['price', 'match', 'milestones', 'milestone_hints'].indexOf(c.field) === -1;
        return { job: j.name, href: j.href, market: j.market, stage: j.stage, title: changeTitle(c), note: noteToo ? c.note : null,
          when: day(c.at), kind: c.field === 'stage' ? (CHIP[c.new_value] || 'pre') : 'pre' };
      });
  }

  function health(name, run, now, lateMs, lateWords) {
    now = now || new Date();
    if (!run) return { state: 'never', text: name + ' hasn\'t synced yet', why: null };
    var at = new Date(run.started_at);
    if (run.ok === false) {
      var e = (run.errors && run.errors[0]) || {};
      return { state: 'red', text: name + ' sync failed ' + fmtWhen(run.started_at), why: e.detail || e.what || 'No reason was recorded.' };
    }
    if (now - at > lateMs) return { state: 'amber', text: lateWords(fmtWhen(run.started_at)), why: null };
    return { state: 'ok', text: name === 'DE' ? 'DE synced ' + fmtWhen(run.started_at) : name + ' last synced ' + fmtWhen(run.started_at), why: null };
  }
  function syncHealth(run, now) {
    return health('DE', run, now, 36 * 3600e3, function (w) { return 'DE hasn\'t synced since ' + w + '. Is the PC on?'; });
  }
  function asanaHealth(run, now) {
    return health('Asana', run, now, 6 * 3600e3, function (w) { return 'Asana last synced ' + w + ', over 6 hours ago. Is the PC on?'; });
  }

  /* ---------- the team Status page (S9) ---------- */
  function statusRows(jobs) {
    var by = {};
    jobs.forEach(function (j) {
      if (!(j.type === 'listing' || j.type === 'rental' || (j.type === 'pitch' && j.stage === 'Pitch'))) return;
      var done = (j.dates || []).filter(function (d) { return !d.planned; }), planned = (j.dates || []).filter(function (d) { return d.planned; });
      var last = done.length ? done[done.length - 1] : null;
      (by[j.market || ''] = by[j.market || ''] || []).push({
        name: j.name, href: j.href, stage: j.stage, chip: j.chip,
        lastMilestone: last ? { label: last.label, on: last.on } : null,
        nextDate: planned.length ? { label: planned[0].label, on: planned[0].on } : null,
        agents: (j.agents || []).slice(), mismatches: j.mismatches || 0
      });
    });
    var keys = Object.keys(by).sort(function (a, b) {
      var x = MARKETS.indexOf(a), y = MARKETS.indexOf(b);
      return (x === -1 ? 99 : x) - (y === -1 ? 99 : y) || (a < b ? -1 : a > b ? 1 : 0);
    });
    return keys.map(function (m) {
      return { market: m, rows: by[m].sort(function (a, b) { return ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }) };
    });
  }

  /* ---------- the Match page (S10) ---------- */
  function matchGroups(jobs, drift) {
    var g = {};
    jobs.forEach(function (j) {
      (j.match || []).forEach(function (m) {
        var fix = FIX.indexOf(m.fixAt) === -1 ? 'Matt' : m.fixAt;
        var item = { job: j.name, href: j.href, id: j.id, table: j.type === 'development' ? 'dev_projects' : j.type === 'pitch' ? 'pitches' : 'properties',
          code: m.code, key: m.key || m.code, text: m.text, since: m.since || null, asanaUrl: j.asanaUrl || null,
          paste: m.values && typeof m.values.paste === 'string' ? m.values.paste : null };
        var who = m.who && m.who.length ? m.who : [''];
        g[fix] = g[fix] || {};
        who.forEach(function (w) { (g[fix][w] = g[fix][w] || []).push(item); });
      });
    });
    var out = FIX.filter(function (f) { return g[f]; }).map(function (f) {
      return { fixAt: f, people: Object.keys(g[f]).sort(function (a, b) {
        if (!a) return 1; if (!b) return -1; return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
      }).map(function (w) { return { who: w, items: g[f][w] }; }) };
    });
    if (drift && drift.length) {
      out.push({ fixAt: 'Roster', people: [{ who: '', items: drift.map(function (d) {
        return { job: d.name, href: null, id: null, table: null, code: 'roster', key: 'roster:' + d.name, text: d.text, since: null, asanaUrl: null, paste: null };
      }) }] });
    }
    return out;
  }

  /* DE's status codes in the words DE's own site uses */
  var DE_WORDS = { Active: 'Active', ActiveUnderContract: 'Contract signed', Pending: 'Pending', Sold: 'Sold', Rented: 'Rented' };
  function deLabel(s) { return s ? DE_WORDS[s] || s : ''; }

  return { STAGES: STAGES, DEV: DEV, DEV_KEYS: DEV_KEYS, DEV_LABEL: DEV_LABEL, deLabel: deLabel, day: day, today: today, mondayOf: mondayOf, addMonths: addMonths,
    buildJobs: buildJobs, overviewStats: overviewStats, taskFlags: taskFlags, activeMatch: activeMatch,
    recentChanges: recentChanges, syncHealth: syncHealth, asanaHealth: asanaHealth, statusRows: statusRows, matchGroups: matchGroups,
    fmtDay: fmtDay, fmtWhen: fmtWhen, money: money, readable: readable };
});
