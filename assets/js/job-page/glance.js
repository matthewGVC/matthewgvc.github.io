/* ============================================================
   JOB PAGE: a development at a glance, on a phone (overhaul 7b-4).

     GVC_JP.glance.html(ctx)   → the card ('' when there is nothing to say)

   TJ runs every development with SSDG, mostly on his phone: the four things
   he looks for, at the top of the page, from what the page already loads.
     Next up        the next 3 open work items with a target date (Asana's schedule)
     Past target    how many work items are past their target and not done
     Final outlook  spent + still planned against the budget (only when this
                    sign-in can read the budget: owner, admin, ops)
     Units left     units not sold or in contract (ctx.units, Elliman or its houses)
   The page's CSS shows it under 700px only; a computer has the full overview.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var GONE = ['Sold', 'Rented', 'In contract'];

  function html(ctx) {
    var W = ctx.W, esc = ctx.esc, B = global.GVC_DEVBUILD, today = W.today(), rows = [];
    var row = function (k, v, s, warn) {
      return '<li' + (warn ? ' class="warn"' : '') + '><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span>' + (s ? '<span class="s">' + esc(s) + '</span>' : '') + '</li>';
    };
    var items = ctx.row.schedule && B ? B.workItems(ctx.row.schedule) : null;
    if (items) {
      var open = items.filter(function (x) { return !x.completed && x.dueOn; })
        .sort(function (a, b) { return a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0; }).slice(0, 3);
      open.forEach(function (x, i) {
        var late = x.dueOn < today;
        rows.push(row(i ? '' : 'Next up', x.name, 'Target ' + W.fmtDay(x.dueOn) + (late ? ', past target' : ''), late));
      });
      var late = items.filter(function (x) { return B.statusOf(x, today) === 'late'; }).length;
      rows.push(row('Past target', String(late), late ? 'work items not done in Asana' : 'nothing late', late > 0));
    }
    var b = ctx.budget && ctx.budget.budget;
    if (b && B) {
      var t = B.totals(b, false), outlook = t.actual + t.planned, past = outlook - t.estimate;
      rows.push(row('Final cost outlook', W.money(outlook), Math.abs(past) < 1 ? 'on the budget' : W.money(Math.abs(past)) + (past > 0 ? ' over the budget' : ' under the budget'), past >= 1));
    }
    var units = ctx.units || [];
    if (units.length) {
      var left = units.filter(function (u) { return GONE.indexOf(u.word) === -1; }).length;
      rows.push(row('Units left', left + ' of ' + units.length, 'not sold or in contract'));
    }
    if (!rows.length) return '';
    return '<div class="card" id="glanceCard"><div class="card-h"><div><h2>At a glance</h2></div></div><ul class="glance">' + rows.join('') + '</ul></div>';
  }

  JP.glance = { html: html };
})(typeof window !== 'undefined' ? window : globalThis);
