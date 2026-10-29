/* ============================================================
   JOB PAGE: a development's build (D109–D114).

     GVC_JP.build.html(ctx)       → the Needs attention, Schedule and Budget cards
     GVC_JP.build.wire(host, ctx) → their controls

   ctx.row.schedule is the 🚧 project's tasks from Asana (D110); ctx.budget is
   the development's dev_budgets row, or null (none linked, or a teammate's
   sign-in, which can't read budgets: then the Budget card and the budget
   half of Needs attention are left out). The owner links the pro-forma sheet
   here: a version-checked write of dev_budgets, then the change-log row.
   Figures and dates come from dev-build.js; all schedule dates are Asana's
   tentative targets.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var B = global.GVC_DEVBUILD;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var STATUS = { done: 'Done', late: 'Past target', soon: 'Due in 14 days', open: 'Open', undated: 'No target date' };
  var view = { mode: 'gantt', status: 'all', section: '', q: '' };   // kept across redraws
  var upgrades = false, linking = false;

  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  var day = function (W, s) { return s ? W.fmtDay(s) + ' ' + s.slice(0, 4) : ''; };

  /* ---------- Needs attention ---------- */
  function attentionHtml(ctx) {
    var W = ctx.W, esc = ctx.esc, b = ctx.budget && ctx.budget.budget;
    if (!ctx.row.schedule && !b) return '';
    var a = B.attention(ctx.row.schedule, b, W.today()), groups = [];
    var group = function (title, rows) {
      if (rows.length) groups.push('<div class="at-g"><h3>' + esc(title) + ' <span class="n">' + rows.length + '</span></h3><ul class="at">' + rows.join('') + '</ul></div>');
    };
    var row = function (name, text) { return '<li><b>' + esc(name) + '</b><span>' + esc(text) + '</span></li>'; };
    group('Past target', a.late.map(function (t) { return row(t.name, 'Target ' + day(W, t.dueOn) + (t.parentName ? ' · ' + t.parentName : '') + '. Not done in Asana.'); }));
    group('Over estimate', a.over.map(function (o) {
      return row(o.name, W.money(o.by) + ' over' + (o.pct != null ? ' (' + o.pct + '%)' : '') + '. ' + W.money(o.actual) + ' spent against ' + W.money(o.estimate) + '.');
    }));
    group('Spending with no estimate', a.noEstimate.map(function (o) { return row(o.name, W.money(o.actual) + ' spent; the sheet has no estimate.'); }));
    group('Due in the next ' + B.SOON_DAYS + ' days', a.soon.map(function (t) { return row(t.name, 'Target ' + day(W, t.dueOn) + (t.parentName ? ' · ' + t.parentName : '') + '.'); }));
    if (a.unestimated.length) group('No estimate yet', [row(plural(a.unestimated.length, 'line'), a.unestimated.join(', ') + '.')]);
    if (a.sheetDiff) {
      group('Sheet total', [row('TOTAL row differs', 'The sheet says ' + W.money(a.sheetDiff.sheet) + ' ' + (a.sheetDiff.field === 'actual' ? 'spent' : 'estimated') +
        '; its lines add up to ' + W.money(a.sheetDiff.sum) + '. This page uses the lines.')]);
    }
    if (a.missingReceipts) group('Receipts', [row(plural(a.missingReceipts, 'payment'), 'No receipt linked on the Expense_Tracker tab.')]);
    return '<div class="card" id="attnCard"><div class="card-h"><div><h2>Needs attention</h2><p>From Asana\'s schedule' + (b ? ' and the pro-forma' : '') +
      '. Construction dates are tentative targets.</p></div></div>' + (groups.join('') || '<p class="soft">Nothing needs attention.</p>') + '</div>';
  }

  /* ---------- Schedule ---------- */
  function shown(items, today) {
    var q = view.q.trim().toLowerCase();
    return items.filter(function (t) {
      return (view.status === 'all' || B.statusOf(t, today) === view.status) && (!view.section || t.section === view.section) &&
        (!q || (t.name + ' ' + (t.parentName || '')).toLowerCase().indexOf(q) !== -1);
    });
  }

  function gantt(ctx, rows, today) {
    var esc = ctx.esc, dates = [today];
    rows.forEach(function (t) { [t.startOn, t.dueOn].forEach(function (d) { if (d) dates.push(d); }); });
    dates.sort();
    // four days either side, so the first milestone and the last bar sit clear of the edges
    var t0 = Date.parse(dates[0]) - 4 * 864e5, t1 = Date.parse(dates[dates.length - 1]) + 5 * 864e5, span = t1 - t0;
    var at = function (d) { return ((Date.parse(d) - t0) / span * 100).toFixed(2) + '%'; };
    var ticks = [], m = new Date(t0);
    m.setUTCDate(1);
    for (m.setUTCMonth(m.getUTCMonth() + 1); m.getTime() < t1; m.setUTCMonth(m.getUTCMonth() + 1)) {
      var mo = m.getUTCMonth();
      ticks.push('<span style="left:' + at(m.toISOString().slice(0, 10)) + '">' + MON[mo] + (mo === 0 ? ' ' + m.getUTCFullYear() : '') + '</span>');
    }
    return '<div class="gantt-wrap"><div class="gantt" role="list" aria-label="Schedule, ' + plural(rows.length, 'work item') + '">' +
      '<div class="g-head" aria-hidden="true"><span class="g-name">Work item</span><div class="g-track">' + ticks.join('') + '</div></div>' +
      '<div class="g-body"><i class="g-today" style="--f:' + ((Date.parse(today) - t0) / span).toFixed(4) + '" aria-hidden="true"></i>' + rows.map(function (t) {
        var s = B.statusOf(t, today), from = t.startOn || t.dueOn, mark = '';
        if (t.milestone && t.dueOn) mark = '<i class="g-ms" style="left:' + at(t.dueOn) + '"></i>';
        else if (from && t.dueOn) mark = '<i class="g-bar" style="left:' + at(from) + ';width:calc(' + ((Date.parse(t.dueOn) + 864e5 - Date.parse(from)) / span * 100).toFixed(2) + '% + 2px)"></i>';
        var when = [t.startOn ? 'start ' + day(ctx.W, t.startOn) : '', t.dueOn ? 'target ' + day(ctx.W, t.dueOn) : ''].filter(Boolean).join(', ');
        return '<div class="g-row s-' + s + '" role="listitem"><div class="g-name">' + (/^https:\/\//.test(t.link || '') ? '<a href="' + esc(t.link) + '" target="_blank" rel="noopener">' + esc(t.name) + '</a>' : esc(t.name)) +
          '<small>' + esc([t.parentName || t.section, STATUS[s]].filter(Boolean).join(' · ')) + '</small></div>' +
          '<div class="g-track" title="' + esc(when || 'No dates in Asana') + '"><span class="sr">' + esc(when || 'No dates in Asana') + '</span>' + mark + '</div></div>';
      }).join('') + '</div></div></div>';
  }

  function list(ctx, rows, today) {
    var esc = ctx.esc, W = ctx.W, names = {};
    ((ctx.row.schedule || {}).tasks || []).forEach(function (t) { names[t.gid] = t.name; });
    return '<div class="tbl-wrap"><table class="tbl sched"><thead><tr><th>Work item</th><th>Start</th><th>Target</th><th>Status</th><th>Waits on</th></tr></thead><tbody>' +
      rows.map(function (t) {
        var s = B.statusOf(t, today);
        return '<tr><td>' + esc(t.name) + '<small>' + esc(t.parentName || t.section || '') + '</small></td><td class="m">' + esc(day(W, t.startOn)) + '</td><td class="m">' + esc(day(W, t.dueOn)) +
          '</td><td><span class="chip s-' + s + '">' + esc(STATUS[s]) + '</span></td><td>' + esc((t.deps || []).map(function (g) { return names[g]; }).filter(Boolean).join(', ')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function scheduleHtml(ctx) {
    var esc = ctx.esc, j = ctx.job, today = ctx.W.today();
    var head = '<div class="card-h"><div><h2>Schedule</h2><p>From the 🚧 Asana project. Every date is a tentative target.</p></div>' +
      (j.asanaUrl ? '<a class="b sm" href="' + esc(j.asanaUrl) + '" target="_blank" rel="noopener">' + ctx.I('arrow') + 'Open in Asana</a>' : '') + '</div>';
    if (!ctx.row.schedule) return '<div class="card" id="schedCard">' + head + '<p class="soft">' + (ctx.row.asana_project_gid ? 'The next Asana read brings the schedule in.' : 'Link the development\'s 🚧 Asana project to see its schedule.') + '</p></div>';
    var items = B.workItems(ctx.row.schedule), rows = shown(items, today), done = items.filter(function (t) { return t.completed; }).length;
    var sections = items.map(function (t) { return t.section; }).filter(function (s, i, a) { return s && a.indexOf(s) === i; });
    var opt = function (v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; };
    return '<div class="card" id="schedCard">' + head +
      '<p class="sched-n"><b>' + done + '</b> of ' + plural(items.length, 'work item') + ' done in Asana</p>' +
      '<div class="sched-f"><div class="seg" role="group" aria-label="View">' + ['gantt', 'list'].map(function (m) {
        return '<button type="button" data-view="' + m + '" aria-pressed="' + (view.mode === m) + '">' + (m === 'gantt' ? 'Gantt' : 'List') + '</button>';
      }).join('') + '</div>' +
      '<input class="inp" type="search" id="schedQ" placeholder="Find a work item" aria-label="Find a work item" value="' + esc(view.q) + '">' +
      '<select class="inp" id="schedS" aria-label="Status">' + opt('all', 'Every status', view.status) + Object.keys(STATUS).map(function (k) { return opt(k, STATUS[k], view.status); }).join('') + '</select>' +
      (sections.length > 1 ? '<select class="inp" id="schedSec" aria-label="Section">' + opt('', 'Every section', view.section) + sections.map(function (s) { return opt(s, s, view.section); }).join('') + '</select>' : '') +
      '<button class="b sm" type="button" id="schedCsv">Export CSV</button></div>' +
      (rows.length ? (view.mode === 'gantt' ? gantt(ctx, rows, today) : list(ctx, rows, today)) : '<p class="soft">No work item matches.</p>') +
      (view.mode === 'gantt' && rows.length ? '<p class="g-key"><span class="k-done">Done</span><span class="k-open">Open</span><span class="k-late">Past target</span><span class="k-ms">Milestone</span><span class="k-today">Today</span></p>' : '') +
      '</div>';
  }

  /* ---------- Budget ---------- */
  function linkForm(ctx, again) {
    return '<form class="blink" id="budgetLink"><label for="budgetSheet">Pro-forma sheet link</label><div><input class="inp" id="budgetSheet" type="text" inputmode="url" autocomplete="off" required placeholder="https://docs.google.com/spreadsheets/d/…"' +
      ' value="' + ctx.esc(again ? 'https://docs.google.com/spreadsheets/d/' + ctx.budget.sheet_id + '/edit' : '') + '">' +
      '<button class="b primary sm" type="submit">' + (again ? 'Save' : 'Link sheet') + '</button>' + (again ? '<button class="b sm" type="button" id="budgetCancel">Cancel</button>' : '') + '</div>' +
      '<p class="soft">Share the sheet as Viewer with the helper\'s Google account first. Only the Hard Costs table and the Expense_Tracker tab are kept.</p>' +
      '<p class="fmsg" id="budgetMsg" role="alert"></p></form>';
  }

  function budgetHtml(ctx) {
    var W = ctx.W, esc = ctx.esc, row = ctx.budget, b = row && row.budget;
    if (!row && !ctx.canEdit) return '';
    var head = '<div class="card-h"><div><h2>Budget</h2><p>' + (b && b.title ? 'From ' + esc(b.title) + '. ' : 'From the developer\'s pro-forma sheet. ') +
      'Seen by Matt and admins only.</p></div>' + (row ? '<a class="b sm" href="https://docs.google.com/spreadsheets/d/' + esc(row.sheet_id) + '/edit" target="_blank" rel="noopener">' + ctx.I('arrow') + 'Open sheet</a>' : '') + '</div>';
    if (!row || linking) return '<div class="card" id="budgetCard">' + head + linkForm(ctx, !!row) + '</div>';
    var foot = '<p class="b-foot">' + (row.synced_at ? 'Read ' + esc(W.fmtWhen(row.synced_at)) : 'Linked; the helper reads it within the hour') +
      (ctx.canEdit ? ' · <button class="link" type="button" id="budgetChange">Change sheet</button>' : '') + '</p>';
    var err = row.error ? '<p class="fw" role="alert">' + esc(row.error) + (b ? ' Showing the last good read.' : '') + '</p>' : '';
    if (!b) return '<div class="card" id="budgetCard">' + head + err + foot + '</div>';
    var hasUp = (b.lines || []).some(function (l) { return l.upgrade; }), t = B.totals(b, upgrades && hasUp);
    var tile = function (k, v, s) { return '<div><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div>' + (s ? '<div class="s">' + esc(s) + '</div>' : '') + '</div>'; };
    var pct = t.estimate ? Math.round(t.actual / t.estimate * 1000) / 10 : null;
    var lines = t.lines.slice().sort(function (x, y) { return (Number(y.actual) || 0) - (Number(x.actual) || 0); });
    return '<div class="card" id="budgetCard">' + head + err +
      (hasUp ? '<div class="seg b-scope" role="group" aria-label="Budget scope"><button type="button" data-up="0" aria-pressed="' + !upgrades + '">Base build</button>' +
        '<button type="button" data-up="1" aria-pressed="' + upgrades + '">With upgrades</button></div>' : '') +
      '<div class="facts b-tiles">' + tile('Estimate', W.money(t.estimate), plural(t.lines.length, 'line')) + tile('Spent', W.money(t.actual), pct != null ? pct + '% of the estimate' : '') +
      tile('Remaining', (t.remaining < 0 ? '−' : '') + W.money(Math.abs(t.remaining)), t.remaining < 0 ? 'over the estimate' : 'estimate less spent') +
      tile('Payments', String(t.payments), t.missingReceipts ? t.missingReceipts + ' without a receipt' : 'all with receipts') + '</div>' +
      '<div class="tbl-wrap"><table class="tbl blines"><thead><tr><th>Line</th><th class="r">Estimate</th><th class="r">Spent</th><th class="r">Remaining</th></tr></thead><tbody>' +
      lines.map(function (l) {
        var left = l.estimate != null ? l.estimate - (Number(l.actual) || 0) : null, over = left != null && left < 0;
        var fill = l.estimate ? Math.min(100, (Number(l.actual) || 0) / l.estimate * 100) : 0;
        return '<tr' + (over ? ' class="over"' : '') + '><td>' + esc(l.name) + (l.upgrade ? ' <span class="chip">Upgrade</span>' : '') +
          (l.estimate ? '<span class="bbar" aria-hidden="true"><i style="width:' + fill.toFixed(1) + '%"></i></span>' : '') + '</td>' +
          '<td class="r m">' + (l.estimate != null ? esc(W.money(l.estimate)) : '<span class="soft">None</span>') + '</td><td class="r m">' + esc(W.money(l.actual)) +
          '</td><td class="r m">' + (left == null ? '' : esc((over ? '−' : '') + W.money(Math.abs(left)))) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      ((b.payments || []).length ? '<details class="pays"><summary>' + plural(b.payments.length, 'payment') + '</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th class="r">Amount</th><th>Receipt</th></tr></thead><tbody>' +
        b.payments.slice().sort(function (x, y) { return (y.date || '') < (x.date || '') ? -1 : (y.date || '') > (x.date || '') ? 1 : 0; }).map(function (p) {
          return '<tr><td class="m">' + esc(day(W, p.date)) + '</td><td>' + esc(p.category || '') + '</td><td>' + esc(p.vendor || '') + '</td><td>' + esc(p.description || '') +
            '</td><td class="r m">' + esc(W.money(p.amount)) + '</td><td>' + (p.receipt ? 'Yes' : '<span class="miss">Missing</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></details>' : '') + foot + '</div>';
  }

  function html(ctx) {
    return '<div id="attnHost">' + attentionHtml(ctx) + '</div><div id="schedHost">' + scheduleHtml(ctx) + '</div><div id="budgetHost">' + budgetHtml(ctx) + '</div>';
  }

  /* the sheet id from a pasted link (…/spreadsheets/d/<id>/…) or the id itself */
  function sheetIdOf(v) {
    var s = String(v || '').trim(), m = s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
    return m ? m[1] : /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : null;
  }

  function saveSheet(ctx, id) {
    var P = global.GVC_PROPS, r = ctx.row, old = ctx.budget, msg = global.document.getElementById('budgetMsg');
    msg.textContent = 'Saving…';
    var body = { dev_project_id: r.id, sheet_id: id, budget: null, synced_at: null, error: null };
    var req = old ? P.call('/rest/v1/dev_budgets?dev_project_id=eq.' + encodeURIComponent(r.id) + '&version=eq.' + encodeURIComponent(old.version),
      { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(body) })
      : P.call('/rest/v1/dev_budgets', { method: 'POST', prefer: 'return=representation', body: JSON.stringify(body) });
    return req.then(function (rows) {
      if (!rows || !rows.length) throw new Error('Someone changed this budget meanwhile. Reload the page and try again.');
      linking = false;
      return P.call('/rest/v1/changes', { method: 'POST', body: JSON.stringify({ dev_project_id: r.id, field: 'budget_sheet', old_value: old ? old.sheet_id : null,
        new_value: id, note: old ? 'Budget sheet changed.' : 'Budget sheet linked.', source: 'Matt' }) }).then(JP.reload, function (e) {
        return JP.reload().then(function () { var m = global.document.getElementById('actMsg'); if (m) m.textContent = 'Saved, but the change log didn\'t save (' + e.message + ').'; });
      });
    }).catch(function (e) { msg.textContent = e.message; });
  }

  function wire(host, ctx) {
    var $ = function (id) { return host.querySelector('#' + id); };
    var redrawSchedule = function () { $('schedHost').innerHTML = scheduleHtml(ctx); wireSchedule(); };
    var redrawBudget = function () { $('budgetHost').innerHTML = budgetHtml(ctx); wireBudget(); };

    function wireSchedule() {
      var card = $('schedCard');
      if (!card || !$('schedS')) return;
      card.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { view.mode = b.dataset.view; redrawSchedule(); }); });
      $('schedS').addEventListener('change', function (e) { view.status = e.target.value; redrawSchedule(); });
      if ($('schedSec')) $('schedSec').addEventListener('change', function (e) { view.section = e.target.value; redrawSchedule(); });
      $('schedQ').addEventListener('input', function (e) {
        view.q = e.target.value; redrawSchedule();
        var q = $('schedQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
      });
      $('schedCsv').addEventListener('click', function () {
        var rows = shown(B.workItems(ctx.row.schedule), ctx.W.today());
        var a = global.document.createElement('a');
        a.href = URL.createObjectURL(new Blob([B.csv(rows)], { type: 'text/csv' }));
        a.download = ctx.job.name + ' schedule.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    function wireBudget() {
      var card = $('budgetCard');
      if (!card) return;
      card.querySelectorAll('[data-up]').forEach(function (b) { b.addEventListener('click', function () { upgrades = b.dataset.up === '1'; redrawBudget(); }); });
      if ($('budgetChange')) $('budgetChange').addEventListener('click', function () { linking = true; redrawBudget(); });
      if ($('budgetCancel')) $('budgetCancel').addEventListener('click', function () { linking = false; redrawBudget(); });
      var form = $('budgetLink');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = sheetIdOf($('budgetSheet').value);
        if (!id) { $('budgetMsg').textContent = 'Paste the sheet\'s link from Google Sheets.'; return; }
        form.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        saveSheet(ctx, id).then(function () { form.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); });
      });
    }

    wireSchedule();
    wireBudget();
  }

  JP.build = { html: html, wire: wire };
})(window);
