/* ============================================================
   MATCH CHECK — where Asana, DE, Drive and Matt's own values disagree
   (spec §5, plan §8b, D60, D63, D69, D71, D74, D76, D78).

   It only reports: nothing here changes a job.

     check(job, ctx) → [{ code, key, text, values, fixAt, who, since }]
       job   a properties row (stage, asana snapshot, milestones, de, de_stage,
             de_listing_id, core, drive_folder, folder_state, scan), or a
             dev_projects row (asana_project_gid, next_milestone.early)
       ctx   { asana, de, scan, drive, roster, initials, people, now, prev }
             asana    the Asana snapshot (default job.asana); for a development
                      { tasks: [allowlisted 🚧 tasks] } (M12, M13)
             de       DE's snapshot (default job.de)
             scan     the nightly folder scan (default job.scan)
             drive    live Drive, when the page has it: { folderId, folderUrl,
                      found, pieces } (M6's "points elsewhere", M7, M8)
             roster   GVC_ROSTER; initials GVC_ROSTER_INITIALS (browser default:
                      the window's); people asana_people rows, latest only
             now      Date or ISO (default: now); days are New York days
             prev     the stored match ({ list, dismissed, waiting }, default
                      job.match): where the day a mismatch was first found comes from
       code    'M1' … 'M17'
       key     what a dismissal is stored under: the code, or code:part where
               one job can have several (M5:closedOn, M7:drive, M8:showsheet,
               M12:<task gid>, M13:<task gid>, M17:price)
       text    one plain sentence
       values  the sources' values: a dismissal holds while these stay the same
       fixAt   'Asana' | 'DE' | 'Drive' | 'Matt'
       who     names: the Point Person's agents, else the Asana assignee
       since   'YYYY-MM-DD' when known (M1's status change, M8's file), else null
               (merge() fills in the day it was first found)
     A listing's list also carries .waiting = { key: 'YYYY-MM-DD' }: the M1 /
     M2:live mismatches still inside their grace that have no status date, by
     the day they were first found (tune-up B1); merge() stores it.

     checkDeListing(row) → M2 item | null    a de_listings row: GVC-listed on DE,
                                             no job (spec §4)
     statusSince(history, stage, saleRent?) → 'YYYY-MM-DD' | null
         the day Asana's stage last became `stage`, from the kept history (S8)
     sectionDisagrees(status, section, stageFromStatus, stageFromSection) → bool (M14)
     applyDismissed(list, dismissed) → list without the items dismissed at
         their current values (dismissed = { [key]: { values, reason, at } })
     merge(prevMatch, list, now) → { match: { list, dismissed, waiting? }, found, cleared, changed }
         the stored shape; since carried over; found / cleared keys for the log;
         waiting (list.waiting) kept only while there is some
     rosterDrift(roster, people) → [{ name, text }]   D71, not per job

   M3 compares DE with Asana's Current Price only (never the Original Price
   fallback), and is skipped when the job's kind and Asana's Sale/Rent
   disagree (a linking problem, not a price one). M11 fires only when Asana
   names an agent who is not among the confirmed ones (a subset is fine).

   Grace periods (globals): Asana ahead of DE 14 days (M1, M2's Live-not-on-DE),
   milestone overdue 14 days (M12), file on Drive 7 days (M8), dates 3 days (M5).
   M1 and M2:live count their grace from Asana's status date; with none (the
   first runs after go-live), from the day the mismatch was first found.
   M5 compares closing dates only: DE publishes no listing date (its feeds have
   closeDate and nothing else, checked 2026-10-21), so there is no listed half.
   M12 on a task ticked ahead of its date says so, rather than "open".
   M8 never checks "Send Just Listed Email" (D74).

   Needs asana-map.js and job-facts.js (loaded first in the browser).
   Loads in the browser (window.GVC_MATCH) and in Node (require).
   Tested by scripts/test-match-check.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./asana-map.js'), require('./job-facts.js'), global);
  } else global.GVC_MATCH = factory(global.GVC_ASANA, global.GVC_FACTS, global);
})(typeof window !== 'undefined' ? window : globalThis, function (MAP, F, global) {
  'use strict';

  var GRACE_AHEAD = 14, GRACE_OVERDUE = 14, GRACE_FILE = 7, DATE_SLACK = 3;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var RANK = { 'Prep': 0, 'Live': 1, 'Accepted offer': 2, 'In contract': 3, 'Sold': 4, 'Rented': 4, 'Off market': 5 };
  var PREP_ON = ['Prep', 'Live', 'Accepted offer', 'In contract', 'Sold', 'Rented'];
  var ONCE_LIVE = ['Live', 'Accepted offer', 'In contract', 'Sold', 'Rented'];
  var STAGE_DATE = { 'Live': 'listedOn', 'Accepted offer': 'acceptedOfferOn', 'In contract': 'contractOn',
    'Sold': 'closedOn', 'Rented': 'closedOn', 'Off market': 'offMarketOn' };
  var PIECE_STEPS = [
    ['showsheet', /create show ?sheet/],
    ['floorplan', /brand floor ?plan|revise\s*\/\s*brand/],
    ['photos', /pics\s*\/\s*video\s*\/\s*fp/],
    ['postcard', /just listed postcard/]
  ];
  var NEVER_FILE = /just listed email/;                 // built in DE StudioPro, no file (D74)
  var SCANNED = ['floorplan', 'showsheet', 'photos', 'brochure'];   // helper/scan.js PIECES
  var PIECE_LABEL = { showsheet: 'showsheet', floorplan: 'floorplan', photos: 'edited photos', postcard: 'postcard', brochure: 'brochure' };
  var FACT_LABEL = { price: 'the price', originalPrice: 'the original price', beds: 'beds', baths: 'baths', halfBaths: 'half baths', sqft: 'sq ft' };

  /* ---------- small helpers ---------- */
  function empty(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function eq(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
  function day(v) { return v ? String(v).slice(0, 10) : null; }
  function today(now) { return MAP.localDay(now ? (typeof now === 'string' ? now : new Date(now).toISOString()) : new Date().toISOString()); }
  function days(a, b) {   // b − a in days
    var p = function (s) { var x = s.split('-'); return Date.UTC(+x[0], +x[1] - 1, +x[2]); };
    return Math.round((p(b) - p(a)) / 86400000);
  }
  function fmtDay(d, now) {
    var x = String(d).split('-');
    return +x[2] + ' ' + MONTHS[+x[1] - 1] + (now && now.slice(0, 4) !== x[0] ? ' ' + x[0] : '');
  }
  function trim(n, dp) { return String(+n.toFixed(dp)); }
  function money(v) {
    var n = Number(v);
    if (n >= 1e6) return '$' + trim(n / 1e6, 3) + 'M';
    if (n >= 1e5) return '$' + trim(n / 1e3, 1) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function num(v) { return Number(v).toLocaleString('en-US'); }
  function fmtFact(field, v) {
    if (field === 'price' || field === 'originalPrice') return money(v);
    if (field === 'sqft') return num(v);
    return Array.isArray(v) ? v.join(', ') : String(v);
  }
  function stagePhrase(s) {
    return { 'Prep': 'in Prep', 'Accepted offer': 'at Accepted offer', 'In contract': 'in contract' }[s] || s;
  }
  function personKey(name) {
    var w = String(name || '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
    return w.length ? w[0] + ' ' + w[w.length - 1] : '';
  }
  function plainName(s) { return String(s || '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase(); }
  function folderIdOf(url) {
    var m = /\/folders\/([\w-]+)/.exec(url || '') || /[?&]id=([\w-]+)/.exec(url || '');
    return m ? m[1] : null;
  }

  /* ---------- S8: the day Asana's stage became the current one ---------- */
  function statusSince(history, stage, saleRent) {
    var hist = (history || []).filter(function (h) { return h && h.at && (h.type === 'status' || h.type === 'section'); });
    var useStatus = hist.some(function (h) { return h.type === 'status'; });
    hist = hist.filter(function (h) { return h.type === (useStatus ? 'status' : 'section'); })
      .sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
    var since = null, prev = null;
    hist.forEach(function (h) {
      var r = MAP.stageOf({ fields: { 'Listing Status': h.to, 'Sale/Rent': saleRent || null } });
      if (!r.stage) return;
      if (r.stage === stage && prev !== stage) since = MAP.localDay(h.at);
      prev = r.stage;
    });
    return prev === stage ? since : null;
  }

  /* ---------- M14 (D69): names can differ ("Lead" in "Leads"); stages can't, and within
     Off market TOTM / Listing Removed / Graveyard are different things ---------- */
  function sectionDisagrees(status, section, fromStatus, fromSection) {
    if (!status || !section || !fromStatus || !fromSection) return false;
    if (fromStatus !== fromSection) return true;
    return fromStatus === 'Off market' && plainName(status) !== plainName(section);
  }

  /* ---------- who is on the job ---------- */
  function peopleOf(a, ctx) {
    var roster = ctx.roster || [], initials = ctx.initials || (global && global.GVC_ROSTER_INITIALS) || {};
    var r = MAP.agentsOf({ fields: { '🧑‍💼 Point Person': a.pointPerson || (a.fields || {})['🧑‍💼 Point Person'] || null }, assignee: a.assignee }, initials, roster);
    var byId = {};
    roster.forEach(function (p) { byId[p.id] = p; });
    var names = r.ids.map(function (id) { return byId[id] ? byId[id].name : id; })
      .concat(r.others.map(function (o) { return o.name; }));
    if (!names.length && a.assignee) names = [a.assignee];
    return { agents: r, names: names, byId: byId };
  }

  /* ---------- a listing ---------- */
  function checkListing(job, ctx) {
    var a = ctx.asana || job.asana || null;
    var de = ctx.de || job.de || null, scan = ctx.scan || job.scan || null, drive = ctx.drive || null;
    var core = job.core || {}, ms = job.milestones || {}, stage = job.stage;
    var now = today(ctx.now), out = [];
    out.waiting = {};
    if (!stage || stage === 'Archived') return out;
    // the day a mismatch was first found: the stored waiting day, else the stored line's since, else today
    var prev = ctx.prev || job.match || {};
    var firstFound = function (key) {
      if (prev.waiting && prev.waiting[key]) return prev.waiting[key];
      var old = (prev.list || []).filter(function (m) { return (m.key || m.code) === key; })[0];
      return (old && old.since) || now;
    };
    var who = a ? peopleOf(a, ctx) : { names: [], agents: { ids: [], ask: [], others: [] }, byId: {} };
    var add = function (code, key, text, values, fixAt, since) {
      out.push({ code: code, key: key || code, text: text, values: values, fixAt: fixAt, who: who.names.slice(), since: since || null });
    };
    var f = (a && a.fields) || {};
    var aFacts = a ? MAP.factsOf({ fields: f }) : {};
    var msOn = function (k) { return ms[k] && !ms[k].planned ? ms[k].on : null; };
    var deStage = job.de_stage || null;
    var onDe = !!(job.de_listing_id || deStage);

    if (a) {
      /* M2: the task is gone from Asana (Task 4 sets asana.gone on a full read) */
      if (a.gone) add('M2', 'M2', 'Asana task gone.', { asanaGid: a.gid || null }, 'Asana', MAP.localDay(a.gone));

      /* M1: stages disagree; Asana ahead gets 14 days from its status change */
      var since = a.statusSince || msOn(STAGE_DATE[stage]) || null;
      if (deStage && RANK[stage] !== undefined && RANK[deStage] !== undefined) {
        var ar = RANK[stage], dr = RANK[deStage];
        var deAhead = stage === 'Off market' ? (deStage === 'Sold' || deStage === 'Rented') : dr > ar;
        var asanaAhead = stage === 'Off market' ? !deAhead : ar > dr;
        var vals = { asana: stage, de: deStage };
        if (deAhead) add('M1', 'M1', 'DE says ' + deStage + '; Asana still says ' + stage + '.', vals, 'Asana');
        else if (asanaAhead && since) {
          if (days(since, now) > GRACE_AHEAD) add('M1', 'M1', 'Asana says ' + stage + ' since ' + fmtDay(since, now) + '; DE still says ' + deStage + '.', vals, 'DE', since);
        } else if (asanaAhead) {
          var f1 = firstFound('M1');
          if (days(f1, now) > GRACE_AHEAD) add('M1', 'M1', 'Asana says ' + stage + '; DE still says ' + deStage + '.', vals, 'DE', f1);
          else out.waiting.M1 = f1;
        }
      }
      /* M2: Live in Asana, not on DE (Asana ahead, same grace) */
      if (stage === 'Live' && !onDe && !de) {
        var live = a.statusSince || msOn('listedOn');
        if (live) {
          if (days(live, now) > GRACE_AHEAD) add('M2', 'M2:live', 'Asana says Live since ' + fmtDay(live, now) + '; the listing isn\'t on DE.', { stage: 'Live' }, 'DE', live);
        } else {
          var f2 = firstFound('M2:live');
          if (days(f2, now) > GRACE_AHEAD) add('M2', 'M2:live', 'Asana says Live; the listing isn\'t on DE.', { stage: 'Live' }, 'DE', f2);
          else out.waiting['M2:live'] = f2;
        }
      }
    }

    if (a && de) {
      /* M3: price, Asana's Current Price only (0 or blank = not filled in); not when sale vs rental disagree */
      var aCur = f['💵 Current Price'];
      if (Number(aCur) === 0) aCur = null;
      var srText = String(f['Sale/Rent'] || '').toLowerCase();
      var aKind = /sale/.test(srText) && !/rent/.test(srText) ? 'sale' : /rent/.test(srText) && !/sale/.test(srText) ? 'rental' : null;
      var kindClash = !!(aKind && job.kind && job.kind !== aKind);
      if (!kindClash && !empty(aCur) && !empty(de.price) && Number(aCur) !== Number(de.price)) {
        add('M3', 'M3', 'Asana says ' + money(aCur) + '; DE says ' + money(de.price) + '.', { asana: aCur, de: de.price }, 'Asana');
      }
      /* M4: beds / baths / sq ft */
      var diff = {}, aw = [], dw = [];
      [['beds', 'bed', 'beds'], ['baths', 'bath', 'baths'], ['sqft', 'sq ft', 'sq ft']].forEach(function (k) {
        var x = aFacts[k[0]], y = de[k[0]];
        if (empty(x) || empty(y) || Number(x) === Number(y)) return;
        diff[k[0]] = { asana: x, de: y };
        aw.push(num(x) + ' ' + (Number(x) === 1 ? k[1] : k[2]));
        dw.push(num(y) + ' ' + (Number(y) === 1 ? k[1] : k[2]));
      });
      if (aw.length) add('M4', 'M4', 'Asana says ' + aw.join(', ') + '; DE says ' + dw.join(', ') + '.', diff, 'Asana');
    }

    /* M5: Asana's Closing vs DE's closeDate (the DE snapshot, else core's from a sold row), more
       than 3 days apart; planned dates skipped (S7). DE has no listing date, so nothing else */
    var cx = msOn('closedOn'), cy = day((de && de.closeDate) || core.closeDate);
    if (cx && cy && Math.abs(days(cx, cy)) > DATE_SLACK) {
      add('M5', 'M5:closedOn', 'Asana says closing on ' + fmtDay(cx, now) + '; DE says ' + fmtDay(cy, now) + '.', { date: 'closedOn', asana: cx, de: cy }, 'Asana');
    }

    /* M6: no folder while Prep or later; Asana's Drive Link points elsewhere */
    if (PREP_ON.indexOf(stage) !== -1) {
      if (!job.drive_folder || job.folder_state === 'unlinked') {
        add('M6', 'M6', 'No Drive folder is linked, and the job is ' + stagePhrase(stage) + '.', { folder: null, stage: stage }, 'Drive');
      } else if (job.folder_state === 'broken') {
        add('M6', 'M6', 'The linked Drive folder can\'t be found any more.', { folder: job.drive_folder, broken: true }, 'Drive');
      }
    }
    var aDrive = f['🛜 Google Drive Link'] || null;
    if (a && aDrive && drive && drive.folderId && folderIdOf(aDrive) && folderIdOf(aDrive) !== drive.folderId) {
      add('M6', 'M6:link', 'Asana\'s Drive Link points to a different folder than the one linked here.', { asana: folderIdOf(aDrive), linked: drive.folderId }, 'Asana');
    }

    /* M7: a link empty in Asana while the workspace knows it (the line carries the link) */
    if (a) {
      var driveFact = core.facts && core.facts.driveLink && core.facts.driveLink.source !== 'Asana' ? core.facts.driveLink.value : null;
      var knowDrive = (drive && drive.folderUrl) || driveFact || null;
      var knowDe = (de && de.listingUrl) || core.listingUrl || null;
      if (empty(aDrive) && knowDrive) add('M7', 'M7:drive', 'Asana\'s Drive Link is empty; paste ' + knowDrive, { field: 'Drive Link', paste: knowDrive }, 'Asana');
      if (empty(f['🛜 Elliman Link']) && knowDe) add('M7', 'M7:elliman', 'Asana\'s Elliman Link is empty; paste ' + knowDe, { field: 'Elliman Link', paste: knowDe }, 'Asana');
    }

    /* M8: a marketing step vs the file on Drive (D60); never the Just Listed email (D74) */
    var found = (drive && drive.found) || (scan && scan.found) || null;
    if (a && found) {
      var pieces = (drive && drive.pieces) || (scan && scan.pieces) || SCANNED;
      var steps = [];
      (a.checklist || []).forEach(function (b) { (b.steps || []).forEach(function (s) { steps.push(s); }); });
      PIECE_STEPS.forEach(function (ps) {
        if (pieces.indexOf(ps[0]) === -1) return;
        var mine = steps.filter(function (s) { var n = String(s.name || '').toLowerCase(); return !NEVER_FILE.test(n) && ps[1].test(n); });
        if (!mine.length) return;
        var ticked = mine.some(function (s) { return s.done; }), file = found[ps[0]] || null, label = PIECE_LABEL[ps[0]];
        if (ticked && !file) {
          add('M8', 'M8:' + ps[0], mine[0].name + ' is ticked in Asana; no ' + label + ' in the folder.', { piece: ps[0], step: mine[0].name, ticked: true, file: null }, 'Drive');
        } else if (!ticked && file && days(file, now) > GRACE_FILE) {
          add('M8', 'M8:' + ps[0], label.charAt(0).toUpperCase() + label.slice(1) + ' in the folder since ' + fmtDay(file, now) + '; ' + mine[0].name + ' is still open in Asana.',
            { piece: ps[0], step: mine[0].name, ticked: false, file: file }, 'Asana', file);
        }
      });
    }

    /* M9: exclusive expired while Live */
    var exp = msOn('exclusiveExpiresOn');
    if (stage === 'Live' && exp && exp < now) {
      add('M9', 'M9', 'Asana\'s exclusive expired on ' + fmtDay(exp, now) + ' while the listing is Live. Extend it in Asana or confirm it ended.', { exclusiveExpiresOn: exp }, 'Asana');
    }

    if (a) {
      /* M10: no Listing Status, no address, no Listing Date once Live */
      var missing = [];
      if (empty(a.status) && empty(f['Listing Status'])) missing.push('Listing Status');
      if (!/\d/.test(a.name || '')) missing.push('address');
      if (ONCE_LIVE.indexOf(stage) !== -1 && empty(f['🗓️ Listing Date'])) missing.push('Listing Date');
      if (missing.length) {
        var words = missing.map(function (m) { return 'no ' + m; });
        var said = words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words[0];
        add('M10', 'M10', 'Asana task has ' + said + '.', { missing: missing }, 'Asana');
      }

      /* M11: Point Person vs the confirmed agents (core.agentIds until Slice 3) */
      var conf = core.agentIds;
      var ag = who.agents;
      if (Array.isArray(conf) && conf.length && ag.ids.length && !ag.ask.length && !ag.others.length) {
        var A1 = ag.ids.slice().sort(), B1 = conf.slice().sort();
        if (A1.some(function (id) { return B1.indexOf(id) === -1; })) {   // a subset of the confirmed agents is fine
          var nm = function (id) { return who.byId[id] ? who.byId[id].name : id; };
          add('M11', 'M11', 'Asana\'s Point Person is ' + a.pointPerson + ' (' + ag.ids.map(nm).join(', ') + '); the confirmed agents are ' + conf.map(nm).join(', ') + '.',
            { pointPerson: a.pointPerson, asana: A1, confirmed: B1 }, 'Matt');
        }
      }

      /* M13: the listing task ticked while checklist steps are open */
      if (a.completed) {
        var open = 0;
        (a.checklist || []).forEach(function (b) { (b.steps || []).forEach(function (s) { if (!s.done) open++; }); });
        if (open) add('M13', 'M13', 'The Asana task is ticked done while ' + open + ' checklist step' + (open === 1 ? ' is' : 's are') + ' open.', { open: open }, 'Asana');
      }

      /* M14: section vs Listing Status (D69) */
      if (sectionDisagrees(a.status, a.section, a.stageFromStatus, a.stageFromSection)) {
        add('M14', 'M14', 'Asana\'s section is ' + a.section + ' but its Listing Status is ' + a.status + '.', { section: a.section, status: a.status }, 'Asana');
      }

      /* M15: Est. Listing Date passed while Prep */
      var est = msOn('estListingOn');
      if (stage === 'Prep' && est && est < now) {
        add('M15', 'M15', 'Asana\'s Est. Listing Date was ' + fmtDay(est, now) + '; the job is still in Prep.', { estListingOn: est }, 'Asana');
      }

      /* M16: the Point Person has left the team (initials table, or People's Past Team Members) */
      var past = {};
      (ctx.people || []).forEach(function (p) { if (p && p.past) past[personKey(p.name)] = true; });
      var pp = String(a.pointPerson || '').split(/[\/,&+\s]+/).filter(Boolean);
      ag.others.filter(function (o) { return o.past; }).forEach(function (o) {
        add('M16', 'M16:' + String(o.initials).toUpperCase(), 'Asana\'s Point Person ' + o.initials + ' is ' + o.name + ', who has left the team.', { initials: o.initials, name: o.name }, 'Asana');
      });
      var initials = ctx.initials || (global && global.GVC_ROSTER_INITIALS) || {};
      pp.forEach(function (ini) {
        var id = initials[ini] !== undefined ? initials[ini] : initials[ini.toUpperCase()];
        var p = typeof id === 'string' && who.byId[id];
        if (p && past[personKey(p.name)]) {
          add('M16', 'M16:' + ini.toUpperCase(), 'Asana\'s Point Person ' + ini + ' is ' + p.name + ', who has left the team.', { initials: ini, name: p.name }, 'Asana');
        }
      });
    }

    /* M17: Matt's typed value differs from DE's or Asana's (D78), GVC_FACTS's own rule */
    var facts = core.facts || {};
    Object.keys(facts).forEach(function (k) {
      var w = F.warnOf(facts[k]);
      if (!w) return;
      add('M17', 'M17:' + k, 'You typed ' + fmtFact(k, facts[k].value) + ' for ' + (FACT_LABEL[k] || k) + '; ' + w.source + ' says ' + fmtFact(k, w.value) + '.',
        { field: k, matt: facts[k].value, source: w.source, value: w.value }, 'Matt');
    });
    return out;
  }

  /* ---------- a development (M12, M13) ---------- */
  function checkDev(dev, ctx) {
    var tasks = (ctx.asana && ctx.asana.tasks) || [], now = today(ctx.now), out = [];
    var early = (ctx.asana && ctx.asana.early) || (dev.next_milestone && dev.next_milestone.early) || [];
    var earlyGid = {};
    early.forEach(function (e) { earlyGid[e.gid] = true; });
    var add = function (code, key, text, values, who, since) {
      out.push({ code: code, key: key, text: text, values: values, fixAt: 'Asana', who: who ? [who] : [], since: since || null });
    };
    tasks.forEach(function (t) {
      var due = day(t.dueOn);
      if ((t.completed && !earlyGid[t.gid]) || !due || days(due, now) <= GRACE_OVERDUE) return;
      if (t.completed) {   // ticked ahead of its date (a batch day): not open, but worth a look
        add('M12', 'M12:' + t.gid, 'Asana shows ' + t.name + ' ticked before its date (' + fmtDay(due, now) + '); check it really happened.', { task: t.name, dueOn: due, ticked: true }, t.assignee);
        return;
      }
      add('M12', 'M12:' + t.gid, t.name + ' is open in Asana and was due on ' + fmtDay(due, now) + '.', { task: t.name, dueOn: due }, t.assignee);
    });
    tasks.forEach(function (t) {
      if (!t.completed) return;
      var open = tasks.filter(function (s) { return s.parentGid === t.gid && !s.completed; }).length;
      if (open) add('M13', 'M13:' + t.gid, t.name + ' is ticked in Asana while ' + open + ' of its subtasks ' + (open === 1 ? 'is' : 'are') + ' open.', { task: t.name, open: open }, t.assignee);
    });
    early.forEach(function (e) {
      add('M13', 'M13:early:' + e.gid, e.name + ' was ticked in Asana on ' + fmtDay(e.tickedOn, now) + ', ahead of its due date of ' + fmtDay(e.dueOn, now) + '.',
        { task: e.name, tickedOn: e.tickedOn, dueOn: e.dueOn }, null);
    });
    return out;
  }

  function check(job, ctx) {
    var c = ctx || {};
    if (!job) return [];
    if (job.asana_project_gid !== undefined || (c.asana && Array.isArray(c.asana.tasks))) return checkDev(job, c);
    return checkListing(job, c);
  }

  /* M2's other half: GVC-listed on DE, no job (D54; the courtesy line is the evidence) */
  function checkDeListing(row) {
    if (!row || !row.gvc_listed || row.property_id) return null;
    return { code: 'M2', key: 'M2:de:' + row.de_listing_id, text: 'On DE, not in Asana.',
      values: { deListingId: row.de_listing_id, listingUrl: (row.raw && row.raw.listingUrl) || null, courtesy: row.courtesy || null },
      fixAt: 'Asana', who: [], since: day(row.checked_at) || null };
  }

  /* ---------- dismiss (S10) ---------- */
  function applyDismissed(list, dismissed) {
    var d = dismissed || {};
    return (list || []).filter(function (m) { var x = d[m.key || m.code]; return !(x && eq(x.values, m.values)); });
  }

  /* ---------- the stored shape: { list, dismissed } ---------- */
  function merge(prev, list, now) {
    var p = prev || {}, before = {}, after = {};
    (p.list || []).forEach(function (m) { before[m.key || m.code] = m; });
    var d = today(now);
    var next = (list || []).map(function (m) {
      var k = m.key || m.code, old = before[k];
      after[k] = true;
      return Object.assign({}, m, { since: m.since || (old && old.since) || d });
    });
    var found = next.filter(function (m) { return !before[m.key]; }).map(function (m) { return m.key; });
    var cleared = Object.keys(before).filter(function (k) { return !after[k]; });
    var match = { list: next, dismissed: Object.assign({}, p.dismissed || {}) };
    var waiting = (list && list.waiting) || {};
    if (Object.keys(waiting).length) match.waiting = Object.assign({}, waiting);
    return { match: match, found: found, cleared: cleared,
      changed: !eq(match.list, p.list || []) || !eq(match.waiting || {}, p.waiting || {}) || !prev };
  }

  /* ---------- roster drift (D71) ---------- */
  function rosterDrift(roster, people) {
    var ppl = (people || []).filter(Boolean);
    if (!ppl.length) return [];
    var byKey = {}, inRoster = {};
    ppl.forEach(function (p) { byKey[personKey(p.name)] = p; });
    (roster || []).forEach(function (r) { inRoster[personKey(r.name)] = true; });
    var agentLike = function (p) {
      return ['Sales Agents', 'Partners'].indexOf(p.section) !== -1 || /licensed|salesperson|broker/i.test(p.title || '');
    };
    var out = [];
    ppl.forEach(function (p) {
      if (!p.past && agentLike(p) && !inRoster[personKey(p.name)]) out.push({ name: p.name, text: p.name + ' is in Asana\'s People but not on the roster.' });
    });
    (roster || []).forEach(function (r) {
      if (!byKey[personKey(r.name)]) out.push({ name: r.name, text: r.name + ' is on the roster but not in Asana\'s People.' });
    });
    (roster || []).forEach(function (r) {
      var p = byKey[personKey(r.name)];
      if (p && p.past) out.push({ name: r.name, text: r.name + ' has left the team but is still on the roster.' });
    });
    (roster || []).forEach(function (r) {
      var p = byKey[personKey(r.name)];
      if (p && !p.past && !(p.deBioUrl || p.deProfileUrl || p.de_bio_url || p.de_profile_url)) {
        out.push({ name: r.name, text: r.name + ' has no DE profile link in Asana\'s People.' });
      }
    });
    return out;
  }

  return { check: check, checkDeListing: checkDeListing, statusSince: statusSince, sectionDisagrees: sectionDisagrees,
    applyDismissed: applyDismissed, merge: merge, rosterDrift: rosterDrift };
});
