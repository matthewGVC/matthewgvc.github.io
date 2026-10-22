/* ============================================================
   ASANA MAP — Asana's words turned into the workspace's.

   Takes tasks in the shape helper/asana/allow.js keeps them:
     { gid, name, completed, completedAt, dueOn, assignee, section, projectGid,
       parentGid, fields: { '<exact field name, emoji included>': value },
       history?: [{ type: 'status'|'section'|'due'|'complete'|'incomplete', at, from, to }] }
   (enums as names, multi-enums as arrays, numbers as numbers, dates 'YYYY-MM-DD').

     stageOf(task)          → { stage } | { unknown }      plan §6.1, D69
         Listing Status wins over the section; with no status the section
         name is read the same way. Leads / Pitches → 'Pitch' (the caller
         keeps those in pitches, and only with a 🗓️ Pitch date, D54). A sold
         status on a rental → 'Rented'. Anything not in the table → { unknown }.
     isGvcListing(task)     → bool   Deal Side is List Side, List (Direct), Direct or Landlord (D51)
     factsOf(task, opts?)   → D52's facts, absent keys left out. opts.areas: the
         names that count as NYC neighbourhoods for City/Hood (default: the list
         below plus window.GVC_NYC_AREAS when the page loaded nyc-areas.js;
         nyc-areas.js is browser-only, so Node callers pass a list if they need more).
         📍 State ("New Jersey", "New York", "Florida") is the State fact as its
         two-letter code (NJ / NY / FL); a two-letter value passes through, any
         other name is left out rather than guessed.
         "For Sale or Rent" counts as a sale. A 0 price, original price, sq ft
         or lot size counts as not filled in (beds 0 is a studio and stays).
     datesOf(task, history, today, opts?) → { listedOn: { on, planned }, … } (§6.2, S7)
         planned = the date is after today. listedOn falls back to the first
         move to Active in the history; offMarketOn is the last move to TOTM /
         Listing Removed. opts.tz (default America/New_York) decides which day
         a history timestamp falls on.
     agentsOf(task, initials, roster) → { ids, ask, others }        D53, D71
         Point Person initials (split on / , & + and spaces) through the
         initials table (roster.js GVC_ROSTER_INITIALS). null or a missing entry
         → ask; 'past:Name' / 'other:Name' → others [{ initials, name, past }].
         The assignee's name is used only when there are no initials (NYC tasks
         are mostly assigned to the operations manager, not the agent).
     checklistOf(subtasks)  → [{ block, steps: [{ name, done, doneOn, who }] }]
         blocks 'prep' | 'price change' | 'contract' | 'post-closing', by the
         rule-added subtask names (listings survey §3), in subtask order; a step
         that belongs to more than one block ("Update ReSource & SE") joins the
         block before it, unless that block already has it: then it opens the
         block named by the next step that says which.
     devHints(project, tasks, extras, today) → development hints (D64–D67):
         { family, hints: [{ key, date, approx, rule, source, asanaGid }],
           early: [{ gid, key, name, dueOn, tickedOn }],
           next: { key, name, dueOn } | null,
           slips: { [gid]: { count, days } },
           construction: { done, total } }
         extras: { tz, houses: [task+history], lands: [task], loose: [looseTask],
                   history: { [gid]: [...] } }  (all optional)
         rules: 'batch' ticked on a batch day after its due date → the due date
                'tick'  a live tick → its day
                'late'  a live tick over 45 days after its due date → the due date, approx
                'loose' a ticked loose task (Creative Requests etc.) → its tick day
                'house' the NJ Listings house row (Exclusive Date, → Active, CS date)
                'land'  the Buy-Side land row's Closing date → Land closed
         A tick on a batch day BEFORE its due date is no hint; it goes in early (M13)
         and still counts as open when picking next (it hasn't happened yet, D64).
         A batch day = 10 or more ticks on one local day in that project.
         Only past dates are hints. Construction counts live ticks only (D66),
         over the tasks in a section named "…Construction…", leaving out tasks
         that map to another milestone and the "Video (if applicable)" twins.
     batchDays(tasks, tz)   → ['YYYY-MM-DD', …]
     milestoneOf(name, family) → a MILESTONES key or null
     familyOf(project, tasks)  → 'FL' | 'NJ' | 'MKT'  (project.family wins)
     MILESTONES             D66's 18 keys, in order

   Loads in the browser (window.GVC_ASANA) and in Node (require).
   Tested by scripts/test-asana-map.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory(global);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_ASANA = api;
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  var TZ = 'America/New_York';
  var BATCH_TICKS = 10, LATE_DAYS = 45;

  /* ---------- small helpers ---------- */
  function norm(s) {
    return String(s || '').replace(/[^\p{L}\p{N}\s\/&\-]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function empty(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function field(t, name) { var f = (t && t.fields) || {}; return empty(f[name]) ? null : f[name]; }

  var fmts = {};
  function localDay(iso, tz) {
    if (!iso) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d)) return null;
    var z = tz || TZ;
    if (!fmts[z]) fmts[z] = new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmts[z].format(d);
  }
  /* a date field: 'YYYY-MM-DD' or a midnight-UTC ISO string → 'YYYY-MM-DD' */
  function dayOf(v) { return v ? String(v).slice(0, 10) : null; }
  function days(a, b) {   // b − a in days
    var p = function (s) { var x = s.split('-'); return Date.UTC(+x[0], +x[1] - 1, +x[2]); };
    return Math.round((p(b) - p(a)) / 86400000);
  }
  function todayOf(today, tz) { return today ? localDay(today, tz) : localDay(new Date(), tz); }

  /* ---------- stage (plan §6.1) ---------- */
  var STAGES = {
    'lead': 'Pitch', 'leads': 'Pitch', 'pitch': 'Pitch', 'pitches': 'Pitch',
    'in prep to list': 'Prep', 'coming soon': 'Prep', 'tj new dev': 'Prep',
    'active': 'Live',
    'accepted offer/attorney review': 'Accepted offer', 'accepted offer': 'Accepted offer',
    'fully executed/board package': 'In contract', 'in contract': 'In contract', 'financing & package': 'In contract',
    'pending': 'In contract', 'board interview': 'In contract', 'board approved': 'In contract',
    'waiting to close/board approved': 'In contract',
    'post-closing': 'Sold', 'complete': 'Sold', 'n/a - sold': 'Sold',
    'listing removed': 'Off market', 'totm': 'Off market', 'graveyard': 'Off market'
  };

  function isRental(t) {
    var k = norm(field(t, 'Sale/Rent'));
    return /rent/.test(k) && !/sale/.test(k);
  }

  function stageOf(t) {
    var raw = field(t, 'Listing Status') || (t && t.section) || null;
    if (!raw) return { unknown: '(no status or section)' };
    var stage = STAGES[norm(raw)];
    if (!stage) return { unknown: raw };
    if (stage === 'Sold' && isRental(t)) stage = 'Rented';
    return { stage: stage };
  }

  /* ---------- GVC-listed (D51) ---------- */
  var LIST_SIDES = ['list side', 'list (direct)', 'direct', 'landlord'];
  function isGvcListing(t) {
    var v = field(t, 'Deal Side');
    return !!v && LIST_SIDES.indexOf(String(v).trim().toLowerCase()) !== -1;
  }

  /* ---------- facts (D52) ---------- */
  var NYC_HOODS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Bronx', 'Staten Island',
    'Upper East Side', 'Upper West Side', 'Lincoln Square', 'Lenox Hill', 'Carnegie Hill', 'Yorkville', 'Sutton Place',
    'Beekman', 'Turtle Bay', 'Murray Hill', 'Kips Bay', 'Gramercy', 'Gramercy Park', 'Flatiron', 'NoMad', 'Midtown',
    'Midtown East', 'Midtown West', 'Midtown South', 'Hudson Yards', "Hell's Kitchen", 'Clinton', 'Chelsea',
    'West Chelsea', 'Greenwich Village', 'West Village', 'East Village', 'SoHo', 'NoHo', 'Nolita', 'Little Italy',
    'Chinatown', 'Tribeca', 'Financial District', 'Battery Park City', 'Lower East Side', 'Two Bridges',
    'Central Park South', 'Roosevelt Island', 'Harlem', 'Central Harlem', 'East Harlem', 'Morningside Heights',
    'Hamilton Heights', 'Washington Heights', 'Inwood', 'Manhattan Valley', 'Stuyvesant Town',
    'DUMBO', 'Brooklyn Heights', 'Cobble Hill', 'Carroll Gardens', 'Boerum Hill', 'Park Slope', 'Prospect Heights',
    'Fort Greene', 'Clinton Hill', 'Williamsburg', 'Greenpoint', 'Bushwick', 'Long Island City', 'Astoria'];

  function areaSet(opts) {
    var list = (opts && opts.areas) || NYC_HOODS.concat(
      (global && global.GVC_NYC_AREAS && global.GVC_NYC_AREAS.list || []).map(function (a) { return a.name || a[0]; }));
    var set = {};
    list.forEach(function (n) { if (n) set[norm(n)] = true; });
    return set;
  }

  function parseStats(v) {
    var items = Array.isArray(v) ? v : String(v || '').split(',');
    var out = {};
    items.forEach(function (raw) {
      var s = norm(raw), m;
      if (/\bstudio\b/.test(s)) out.beds = 0;
      if ((m = /(\d+(?:\.\d+)?)\s*bed/.exec(s))) out.beds = +m[1];
      if ((m = /(\d+)\s*half bath/.exec(s))) out.halfBaths = +m[1];
      else if ((m = /(\d+(?:\.\d+)?)\s*(?:full )?baths?\b/.exec(s))) out.baths = +m[1];
      if ((m = /(\d+)\s*rooms?\b/.exec(s))) out.rooms = +m[1];
      if ((m = /(\d+)\s*levels?\b/.exec(s))) out.levels = +m[1];
    });
    return out;
  }

  /* 📍 State in Asana is the state's name; the job's State fact is its code */
  var STATE_CODE = { 'new jersey': 'NJ', 'new york': 'NY', 'florida': 'FL' };
  function stateCode(v) {
    var s = String(v == null ? '' : v).trim();
    if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase();
    return STATE_CODE[s.toLowerCase().replace(/\s+/g, ' ')] || null;
  }

  function factsOf(t, opts) {
    var out = {};
    var put = function (k, v) { if (!empty(v)) out[k] = v; };
    var amount = function (v) { return empty(v) || Number(v) === 0 ? null : v; };   // 0 = not filled in
    var cur = amount(field(t, '💵 Current Price')), orig = amount(field(t, '💵 Original Price'));
    put('price', cur !== null ? cur : orig);
    put('originalPrice', orig);
    var sr = field(t, 'Sale/Rent');
    if (sr) put('kind', isRental(t) ? 'rental' : 'sale');
    var st = field(t, 'ℹ️ Property Stats');
    if (st) {
      var p = parseStats(st);
      ['beds', 'baths', 'halfBaths', 'rooms', 'levels'].forEach(function (k) { if (k in p) out[k] = p[k]; });
    }
    put('sqft', amount(field(t, 'ℹ️ INT SF')));
    put('lotSize', amount(field(t, 'ℹ️ Acreage')));
    var pt = field(t, 'ℹ️ Property Type');
    put('propertyType', Array.isArray(pt) ? pt.join(', ') : pt);
    var ch = field(t, '📍 City/Hood');
    if (ch) {
      var name = String(ch).trim();
      if (areaSet(opts)[norm(name)]) out.neighborhood = name; else out.city = name;
    }
    put('state', stateCode(field(t, '📍 State')));
    put('zip', field(t, '📍 Zip'));
    put('county', field(t, '📍 County'));
    put('mlsBoard', field(t, '📍 MLS'));
    put('description', field(t, 'Listing Copy'));
    put('mapsUrl', field(t, 'Google Maps Link'));
    put('listingUrl', field(t, '🛜 Elliman Link'));
    put('driveLink', field(t, '🛜 Google Drive Link'));
    return out;
  }

  /* ---------- deal dates (§6.2) ---------- */
  var DATE_FIELDS = [
    ['pitchedOn', '🗓️ Pitch'], ['exclusiveOn', '🗓️ Exclusive Date'], ['estListingOn', '🗓️ Est. Listing Date'],
    ['listedOn', '🗓️ Listing Date'], ['acceptedOfferOn', '🗓️ AO Date'], ['contractOn', '🗓️ CS Date'],
    ['boardPackageOn', '🗓️ BPS Date'], ['boardInterviewOn', '🗓️ BI Date'], ['boardApprovedOn', '🗓️ BA Date'],
    ['ccOn', '🗓️ CC Date'], ['closedOn', '🗓️ Closing Date'], ['exclusiveExpiresOn', '🗓️ Exclusive Expires'],
    ['offMarketOn', null]
  ];

  function moves(history, test) {
    return (history || []).filter(function (h) {
      return (h.type === 'status' || h.type === 'section') && h.at && test(norm(h.to));
    }).sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
  }

  function datesOf(t, history, today, opts) {
    var tz = (opts && opts.tz) || TZ, now = todayOf(today, tz);
    var hist = history || (t && t.history) || [];
    var found = {};
    DATE_FIELDS.forEach(function (d) { if (d[1]) { var v = dayOf(field(t, d[1])); if (v) found[d[0]] = v; } });
    if (!found.listedOn) {
      var act = moves(hist, function (s) { return s === 'active'; });
      if (act.length) found.listedOn = localDay(act[0].at, tz);
    }
    var off = moves(hist, function (s) { return s === 'totm' || s === 'listing removed'; });
    if (off.length) found.offMarketOn = localDay(off[off.length - 1].at, tz);
    var out = {};
    DATE_FIELDS.forEach(function (d) { if (found[d[0]]) out[d[0]] = { on: found[d[0]], planned: found[d[0]] > now }; });
    return out;
  }

  /* ---------- agents (D53, D71) ---------- */
  function agentsOf(t, initials, roster) {
    var table = initials || {}, people = roster || [];
    var ids = [], ask = [], others = [];
    var known = {};
    people.forEach(function (p) { known[p.id] = p; });
    var add = function (id) { if (ids.indexOf(id) === -1) ids.push(id); };
    var pp = field(t, '🧑‍💼 Point Person');
    var parts = String(pp || '').split(/[\/,&+\s]+/).filter(Boolean);
    parts.forEach(function (ini) {
      var key = ini in table ? ini : (ini.toUpperCase() in table ? ini.toUpperCase() : null);
      var v = key === null ? undefined : table[key];
      if (typeof v === 'string' && /^(past|other):/.test(v)) {
        others.push({ initials: ini, name: v.replace(/^(past|other):/, ''), past: /^past:/.test(v) });
      } else if (typeof v === 'string' && (!people.length || known[v])) add(v);
      else if (ask.indexOf(ini) === -1) ask.push(ini);
    });
    if (!parts.length && t && t.assignee) {
      var who = String(t.assignee).trim().toLowerCase();
      people.forEach(function (p) { if (String(p.name).toLowerCase() === who) add(p.id); });
    }
    return { ids: ids, ask: ask, others: others };
  }

  /* ---------- checklist (listings survey §3) ---------- */
  var BLOCK_RULES = [
    ['price change', /price change email|^change in results/],
    ['post-closing', /confirm all deal info|holiday book|closing gift|cutting board|solicit testimonial|claim buyer deal|sldc|discuss closing post/],
    ['contract', /deal sheet|due diligence|contract signed|save fek|edeals|appraisal|loan commitment|recognition agreement|board package|board interview|board approval|commi?ss?ion bill|final walkthrough|closing date confirmed|complete bp/]
  ];
  var SHARED = /update resource|update results|add to results/;   // in more than one block

  function checklistOf(subtasks, opts) {
    var tz = (opts && opts.tz) || TZ;
    var out = [], cur = null, subs = subtasks || [];
    var ruleOf = function (n) {
      for (var i = 0; i < BLOCK_RULES.length; i++) if (BLOCK_RULES[i][1].test(n)) return BLOCK_RULES[i][0];
      return null;
    };
    subs.forEach(function (s, idx) {
      var n = norm(s.name), block = ruleOf(n);
      if (!block && cur && SHARED.test(n)) {
        // already in this block: it opens the next one, named by the next step that says which
        var seen = cur.steps.some(function (x) { return norm(x.name) === n; });
        block = cur.block;
        if (seen) {
          for (var j = idx + 1; j < subs.length; j++) {
            var nj = norm(subs[j].name), b = ruleOf(nj);
            if (b) { block = b; break; }
            if (!SHARED.test(nj)) { block = 'prep'; break; }
          }
        }
      }
      if (!block) block = 'prep';
      if (!cur || cur.block !== block) { cur = { block: block, steps: [] }; out.push(cur); }
      cur.steps.push({ name: s.name, done: !!s.completed, doneOn: s.completed ? localDay(s.completedAt, tz) : null, who: s.assignee || null });
    });
    return out;
  }

  /* ---------- development milestones (D66) ---------- */
  var MILESTONES = ['agreement', 'landClosed', 'architecturals', 'permits', 'renders', 'finishes', 'floorplans',
    'branding', 'listingAgreement', 'websiteLive', 'groundbreaking', 'launchEvent', 'showingAssets', 'listedUnits',
    'construction', 'tco', 'contractsSales', 'closedOut'];

  /* Task-name rules per template family (asana-devs-deep.md §5). For each
     milestone the patterns are in priority order: the first is the milestone
     task itself, the rest stand in when it's missing. Names are matched after
     norm() (lower case, emoji dropped), so "(M)" / "(A)" suffixes don't matter. */
  var FAMILY_RULES = {
    FL: [
      ['agreement', [/receive completed advisory agreement/]],
      ['architecturals', [/request architectural plans/]],
      ['renders', [/receive final renderings/, /website rendering selection/]],
      ['floorplans', [/approve floorplans/, /design floorplans/]],
      ['branding', [/branding guidelines approved/]],
      ['listingAgreement', [/listing agreement (finalized|signed)/]],
      ['websiteLive', [/^deploy website/, /^deploy landing page/]],
      ['groundbreaking', [/groundbreaking/]],
      ['launchEvent', [/^demo\s*\/?\s*launch event\b/, /^host launch event/]],
      ['showingAssets', [/print materials arrive/]],
      ['listedUnits', [/^list the units/]],
      ['tco', [/\btco\b/, /substantial completion/]],
      ['closedOut', [/^(host )?success event/, /full retrospective/]]
    ],
    NJ: [
      ['landClosed', [/close on property/, /conclude attorney review/]],
      ['architecturals', [/architectural plans (& design )?complete/, /initial architectural plans/]],
      ['permits', [/construction permit received/, /zoning approval/, /demo permit/]],
      ['renders', [/complete 3d renderings/]],
      ['finishes', [/loop in interior designer/]],
      ['groundbreaking', [/groundbreaking/]],
      ['tco', [/certificate of occupancy/, /^co\b/]],
      ['closedOut', [/final steps to close/]]
    ],
    MKT: [
      ['architecturals', [/review architectural plans/]],
      ['renders', [/renderings?\b/]],
      ['finishes', [/per-unit finish package/, /finish tearsheet/, /finish readiness check/]],
      ['floorplans', [/floorplan approved/, /design floorplans/]],
      ['branding', [/branding approved/]],
      ['listingAgreement', [/listing agreements signed/]],
      ['websiteLive', [/deploy full website/, /deploy landing page/]],
      ['showingAssets', [/sales presentation approved/, /press tearsheet/, /fence wrap/]]
    ]
  };

  /* loose tasks (D65) name what they are about */
  var LOOSE_RULES = [
    ['renders', /render/], ['floorplans', /floor ?plan/], ['finishes', /finish/], ['branding', /branding/],
    ['websiteLive', /website/], ['groundbreaking', /groundbreaking/]
  ];

  /* → { key, rank } or null */
  function matchRule(name, family) {
    var n = norm(name), rules = FAMILY_RULES[family] || [];
    for (var i = 0; i < rules.length; i++) {
      for (var j = 0; j < rules[i][1].length; j++) if (rules[i][1][j].test(n)) return { key: rules[i][0], rank: j };
    }
    return null;
  }
  function milestoneOf(name, family) { var m = matchRule(name, family); return m ? m.key : null; }

  function familyOf(project, tasks) {
    if (project && FAMILY_RULES[project.family]) return project.family;
    var best = 'MKT', score = 0;
    ['FL', 'NJ', 'MKT'].forEach(function (f) {
      var keys = {};
      (tasks || []).forEach(function (t) { var m = matchRule(t.name, f); if (m && m.key !== 'groundbreaking') keys[m.key] = 1; });
      var n = Object.keys(keys).length;
      if (n > score) { score = n; best = f; }
    });
    return best;
  }

  function batchDays(tasks, tz) {
    var count = {};
    (tasks || []).forEach(function (t) {
      if (!t.completedAt) return;
      var d = localDay(t.completedAt, tz);
      count[d] = (count[d] || 0) + 1;
    });
    return Object.keys(count).filter(function (d) { return count[d] >= BATCH_TICKS; }).sort();
  }

  /* D64: the suggested "happened" date of one ticked task */
  function tickDate(t, batch, tz) {
    var ticked = localDay(t.completedAt, tz), due = dayOf(t.dueOn);
    if (batch.indexOf(ticked) !== -1) {
      if (!due) return { date: null, approx: true, rule: 'batch' };
      if (ticked < due) return { early: true, ticked: ticked };
      return { date: due, approx: false, rule: 'batch' };
    }
    if (due && days(due, ticked) > LATE_DAYS) return { date: due, approx: true, rule: 'late' };
    return { date: ticked, approx: false, rule: 'tick' };
  }

  function slipsOf(tasks, extraHistory) {
    var out = {};
    tasks.forEach(function (t) {
      var hist = (t.history || []).concat((extraHistory && extraHistory[t.gid]) || []);
      var mv = hist.filter(function (h) { return h.type === 'due' && h.from && h.to && h.from !== h.to; })
        .sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
      if (mv.length) out[t.gid] = { count: mv.length, days: days(dayOf(mv[0].from), dayOf(mv[mv.length - 1].to)) };
    });
    return out;
  }

  function devHints(project, tasks, extras, today) {
    var ex = extras || {}, tz = ex.tz || TZ, now = todayOf(today, tz);
    var list = tasks || [], pname = (project && project.name) || 'project';
    var family = familyOf(project, list);
    var batch = batchDays(list, tz);
    var hints = [], early = [];
    var hint = function (key, date, approx, rule, source, gid) {
      if (date && date > now) return;
      hints.push({ key: key, date: date, approx: approx, rule: rule, source: source, asanaGid: gid || null });
    };

    // the 🚧 project's own tasks: one task per milestone, the best-ranked name
    var rep = {}, mapped = {};
    list.forEach(function (t) {
      var m = matchRule(t.name, family);
      if (!m) return;
      mapped[t.gid] = m.key;
      if (!rep[m.key] || m.rank < rep[m.key].rank) rep[m.key] = { rank: m.rank, task: t };
    });
    list.forEach(function (t) {
      if (!t.completed || !t.completedAt) return;
      var d = tickDate(t, batch, tz);
      if (d.early) early.push({ gid: t.gid, key: mapped[t.gid] || null, name: t.name, dueOn: dayOf(t.dueOn), tickedOn: d.ticked });
    });
    Object.keys(rep).forEach(function (key) {
      var t = rep[key].task;
      if (!t.completed || !t.completedAt) return;
      var d = tickDate(t, batch, tz);
      if (!d.early) hint(key, d.date, d.approx, d.rule, 'Asana: ' + pname + ', ' + t.name, t.gid);
    });

    // the NJ Listings house row and the land row (D65)
    (ex.houses || []).forEach(function (h) {
      var dd = datesOf(h, h.history || [], now, { tz: tz }), src = 'Asana: house row ' + h.name;
      if (dd.exclusiveOn) hint('listingAgreement', dd.exclusiveOn.on, false, 'house', src, h.gid);
      if (dd.listedOn) hint('listedUnits', dd.listedOn.on, false, 'house', src, h.gid);
      var cs = dd.contractOn || dd.closedOn;
      if (cs) hint('contractsSales', cs.on, false, 'house', src, h.gid);
    });
    (ex.lands || []).forEach(function (l) {
      var c = dayOf(field(l, '🗓️ Closing Date'));
      if (c) hint('landClosed', c, false, 'land', 'Asana: land row ' + l.name, l.gid);
    });
    // loose tasks the caller already matched to this development
    (ex.loose || []).forEach(function (l) {
      if (!l.completedAt) return;
      var n = norm(l.name);
      for (var i = 0; i < LOOSE_RULES.length; i++) {
        if (LOOSE_RULES[i][1].test(n)) { hint(LOOSE_RULES[i][0], localDay(l.completedAt, tz), false, 'loose', 'Asana: ' + l.name, l.gid); break; }
      }
    });
    hints.sort(function (a, b) { return MILESTONES.indexOf(a.key) - MILESTONES.indexOf(b.key); });

    // construction progress: live ticks over the build-phase tasks
    var build = list.filter(function (t) {
      return /construction/i.test(t.section || '') && !mapped[t.gid] && !/video/i.test(t.name);
    });
    var done = build.filter(function (t) { return t.completed && t.completedAt && batch.indexOf(localDay(t.completedAt, tz)) === -1; }).length;
    build.forEach(function (t) { mapped[t.gid] = mapped[t.gid] || 'construction'; });

    // next: the earliest open milestone task by due date; a task ticked ahead
    // of its date on a batch day hasn't happened yet (D64), so it counts as open
    var next = null, earlyGid = {};
    early.forEach(function (e) { earlyGid[e.gid] = true; });
    list.forEach(function (t) {
      if ((t.completed && !earlyGid[t.gid]) || !mapped[t.gid] || !t.dueOn) return;
      var due = dayOf(t.dueOn);
      if (!next || due < next.dueOn) next = { key: mapped[t.gid], name: t.name, dueOn: due };
    });

    return { family: family, hints: hints, early: early, next: next, slips: slipsOf(list, ex.history),
      construction: { done: done, total: build.length } };
  }

  return { stageOf: stageOf, isGvcListing: isGvcListing, factsOf: factsOf, datesOf: datesOf, agentsOf: agentsOf,
    checklistOf: checklistOf, devHints: devHints, batchDays: batchDays, milestoneOf: milestoneOf, familyOf: familyOf,
    localDay: localDay, MILESTONES: MILESTONES, FAMILY_RULES: FAMILY_RULES };
});
