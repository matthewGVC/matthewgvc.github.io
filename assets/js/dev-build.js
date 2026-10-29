/* ============================================================
   DEV BUILD — a development's schedule and budget worked out for the job
   page (D109–D114). Pure: no page, no network; the browser and the tests
   share it.

     GVC_DEVBUILD.workItems(schedule)
         → the schedule's leaf rows (no row names them as parent): the work
           items and milestones the Gantt draws, in schedule order, each with
           its section (a work item takes its top task's) and parentName
     GVC_DEVBUILD.statusOf(task, today)
         → 'done' | 'late' | 'soon' (due within SOON_DAYS) | 'open' | 'undated'
     GVC_DEVBUILD.totals(budget, withUpgrades)
         → { lines, estimate, actual, remaining, payments, missingReceipts }
           lines in scope (the base build, or with the "(Upgrade)" lines);
           remaining = estimate − actual
     GVC_DEVBUILD.attention(schedule, budget, today)
         → { over, noEstimate, unestimated, late, soon, sheetDiff, missingReceipts }
           over         lines whose actual passed their estimate (+ by, pct)
           noEstimate   lines with spending and no estimate
           unestimated  open lines with neither (names only)
           late / soon  work items past their target / due within SOON_DAYS, not done
           sheetDiff    { field, sheet, sum } when the sheet's TOTAL row is off
                        by a dollar or more from its base lines, else null
     GVC_DEVBUILD.csv(rows)  → the schedule rows as CSV text
   Dates are 'YYYY-MM-DD'; today is the caller's local day.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GVC_DEVBUILD = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SOON_DAYS = 14;

  function addDays(ymd, n) {
    var d = new Date(ymd + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function workItems(schedule) {
    var tasks = (schedule && schedule.tasks) || [], byGid = {}, parents = {};
    tasks.forEach(function (t) { byGid[t.gid] = t; if (t.parentGid) parents[t.parentGid] = true; });
    var top = function (t) { var n = 0; while (t.parentGid && byGid[t.parentGid] && n++ < 5) t = byGid[t.parentGid]; return t; };
    return tasks.filter(function (t) { return !parents[t.gid]; }).map(function (t) {
      var up = byGid[t.parentGid];
      return Object.assign({}, t, { section: t.section || top(t).section || null, parentName: up ? up.name : null });
    });
  }

  function statusOf(t, today) {
    if (t.completed) return 'done';
    if (!t.dueOn) return 'undated';
    if (t.dueOn < today) return 'late';
    return t.dueOn <= addDays(today, SOON_DAYS) ? 'soon' : 'open';
  }

  var sum = function (list, k) { return list.reduce(function (n, x) { return n + (Number(x[k]) || 0); }, 0); };
  var cents = function (n) { return Math.round(n * 100) / 100; };

  function totals(budget, withUpgrades) {
    var b = budget || {}, lines = (b.lines || []).filter(function (l) { return withUpgrades || !l.upgrade; });
    var estimate = cents(sum(lines, 'estimate')), actual = cents(sum(lines, 'actual')), pays = b.payments || [];
    return { lines: lines, estimate: estimate, actual: actual, remaining: cents(estimate - actual), payments: pays.length,
      missingReceipts: pays.filter(function (p) { return !p.receipt; }).length };
  }

  function attention(schedule, budget, today) {
    var lines = (budget && budget.lines) || [], items = workItems(schedule);
    var over = lines.filter(function (l) { return l.estimate != null && l.actual != null && l.actual > l.estimate; }).map(function (l) {
      return { name: l.name, estimate: l.estimate, actual: l.actual, by: cents(l.actual - l.estimate), pct: l.estimate ? Math.round((l.actual - l.estimate) / l.estimate * 1000) / 10 : null };
    }).sort(function (a, b) { return b.by - a.by; });
    var base = totals(budget, false), st = budget && budget.sheetTotal, sheetDiff = null;
    if (st) {
      [['estimate', base.estimate], ['actual', base.actual]].some(function (f) {
        if (st[f[0]] == null || Math.abs(st[f[0]] - f[1]) < 1) return false;
        sheetDiff = { field: f[0], sheet: st[f[0]], sum: f[1] };
        return true;
      });
    }
    var due = function (s) {
      return items.filter(function (t) { return statusOf(t, today) === s; }).sort(function (a, b) { return a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0; });
    };
    return {
      over: over,
      noEstimate: lines.filter(function (l) { return l.estimate == null && l.actual > 0; }).map(function (l) { return { name: l.name, actual: l.actual }; }),
      unestimated: lines.filter(function (l) { return l.estimate == null && !(l.actual > 0); }).map(function (l) { return l.name; }),
      late: due('late'),
      soon: due('soon'),
      sheetDiff: sheetDiff,
      missingReceipts: base.missingReceipts
    };
  }

  function csv(rows) {
    var cell = function (v) { var s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [['Work item', 'Section', 'Start', 'Target', 'Done', 'Milestone'].join(',')].concat(rows.map(function (t) {
      return [t.name, t.section, t.startOn, t.dueOn, t.completed ? 'yes' : 'no', t.milestone ? 'yes' : 'no'].map(cell).join(',');
    })).join('\r\n') + '\r\n';
  }

  return { workItems: workItems, statusOf: statusOf, totals: totals, attention: attention, csv: csv, SOON_DAYS: SOON_DAYS };
});
