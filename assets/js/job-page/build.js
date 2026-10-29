/* ============================================================
   JOB PAGE: a development's build (D109–D114), laid out as an overview.

     GVC_JP.build.html(ctx)       → the overview figures, the Schedule by phase
                                    with Needs attention and Asana suggestions
                                    beside it, then the Budget
     GVC_JP.build.wire(host, ctx) → their controls

   ctx.row.schedule is the 🚧 project's tasks from Asana (D110); ctx.budget is
   the development's dev_budgets row, or null (none linked, or a sign-in that
   can't read budgets: 0016 lets the team's shared account read them; then the
   budget figures, the Budget card and the budget half of Needs attention are
   left out). The owner links the
   pro-forma sheet here: a version-checked write of dev_budgets, then the
   change-log row. Figures and dates come from dev-build.js; all schedule
   dates are Asana's tentative targets.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var B = global.GVC_DEVBUILD;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var STATUS = { done: 'Done', late: 'Past target', soon: 'Due in 14 days', open: 'Open', undated: 'No target date' };
  var LINES_SHOWN = 10;   // the Budget card's lines before "Show all"
  // kept across redraws; section null = not chosen yet (opens on the construction section)
  // shut: phase name → folded; a phase with every trade done starts folded
  var view = { mode: 'gantt', status: 'all', section: null, q: '', shut: {} };
  var upgrades = false, linking = false, allLines = false;

  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  var day = function (W, s) { return s ? W.fmtDay(s) + ' ' + s.slice(0, 4) : ''; };
  var pctOf = function (a, b) { return b ? Math.round(a / b * 1000) / 10 : null; };
  var meter = function (pct, cls) { return '<span class="ov-bar' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, pct || 0)).toFixed(1) + '%"></i></span>'; };
  var readable = function (ctx) { return ctx.budget && ctx.budget.budget; };
  var scoped = function (b) { var up = (b.lines || []).some(function (l) { return l.upgrade; }); return B.totals(b, upgrades && up); };

  /* ---------- Overview: the figures across the top ---------- */
  function overviewHtml(ctx) {
    var W = ctx.W, esc = ctx.esc, j = ctx.job, b = readable(ctx), items = ctx.row.schedule ? B.workItems(ctx.row.schedule) : null, tiles = [];
    var tile = function (k, v, s, bar, cls, note) {
      return '<div class="ov-t' + (cls ? ' ' + cls : '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div>' + (bar || '') + (s ? '<div class="s">' + esc(s) + '</div>' : '') +
        (note ? '<div class="s ov-n">' + esc(note) + '</div>' : '') + '</div>';
    };
    if (b) {
      var t = scoped(b), spent = pctOf(t.actual, t.estimate), over = t.remaining < 0;
      tiles.push(tile('Total budget', W.money(t.estimate), (upgrades ? 'with upgrades, ' : 'base build, ') + plural(t.lines.length, 'line')));
      tiles.push(tile('Spent to date', W.money(t.actual), spent != null ? spent + '% of the budget' : '', meter(spent, over ? 'over' : '')));
      tiles.push(tile('Remaining', (over ? '−' : '') + W.money(Math.abs(t.remaining)), over ? 'over the budget' : spent != null ? Math.round((100 - spent) * 10) / 10 + '% of the budget left' : '', '', over ? 'over' : '',
        // the sheet's way: lines that went over count $0, so this only differs when a line ran over
        t.planned !== t.remaining ? W.money(t.planned) + ' still planned on open lines' : ''));
      // where the build is heading: what's spent, plus what every line under its estimate still plans
      var outlook = t.actual + t.planned, past = outlook - t.estimate;
      tiles.push(tile('Final cost outlook', W.money(outlook), Math.abs(past) < 1 ? 'on the budget' : W.money(Math.abs(past)) + (past > 0 ? ' over the budget' : ' under the budget'),
        '', past >= 1 ? 'over' : ''));
    }
    if (items) {
      var done = items.filter(function (x) { return x.completed; }).length;
      tiles.push(tile('Work items', done + ' / ' + items.length, 'done in Asana, every phase', meter(pctOf(done, items.length))));
    }
    if (!b) {
      if (j.next) tiles.push(tile('Next milestone', j.next.label, j.next.on ? 'Target ' + W.fmtDay(j.next.on) + (j.next.overdue ? ', overdue' : '') : '', '', j.next.overdue ? 'over' : ''));
      if (items) {
        var late = items.filter(function (x) { return B.statusOf(x, W.today()) === 'late'; }).length;
        tiles.push(tile('Past target', String(late), late ? 'work items not done in Asana' : 'nothing late', '', late ? 'over' : ''));
      }
    }
    return tiles.length ? '<div class="card ov" id="ovCard" data-collapse="off"><div class="ov-g">' + tiles.join('') + '</div></div>' : '';
  }

  /* ---------- Needs attention: a count per kind, each opening its list ---------- */
  function attentionHtml(ctx) {
    var W = ctx.W, esc = ctx.esc, b = readable(ctx);
    if (!ctx.row.schedule && !b) return '';
    var a = B.attention(ctx.row.schedule, b, W.today()), groups = [];
    var group = function (title, count, rows, warn, show) {
      if (rows.length) groups.push('<details class="at-d"><summary><span>' + esc(title) + '</span><b class="' + (warn ? 'warn' : '') + '">' + esc(count) + '</b></summary><ul class="at">' + rows.join('') + '</ul>' +
        (show ? '<button class="b sm at-show" type="button" data-show="' + show + '">Show them in the schedule</button>' : '') + '</details>');
    };
    var row = function (name, text) { return '<li><b>' + esc(name) + '</b><span>' + esc(text) + '</span></li>'; };
    group('Past target', plural(a.late.length, 'item'), a.late.map(function (t) { return row(t.name, 'Target ' + day(W, t.dueOn) + (t.parentName ? ' · ' + t.parentName : '') + '. Not done in Asana.'); }), true, 'late');
    group('Over estimate', plural(a.over.length, 'line'), a.over.map(function (o) {
      return row(o.name, W.money(o.by) + ' over' + (o.pct != null ? ' (' + o.pct + '%)' : '') + '. ' + W.money(o.actual) + ' spent against ' + W.money(o.estimate) + '.');
    }), true);
    group('Spending with no estimate', plural(a.noEstimate.length, 'line'), a.noEstimate.map(function (o) { return row(o.name, W.money(o.actual) + ' spent; the sheet has no estimate.'); }), true);
    group('Due in the next ' + B.SOON_DAYS + ' days', plural(a.soon.length, 'item'), a.soon.map(function (t) { return row(t.name, 'Target ' + day(W, t.dueOn) + (t.parentName ? ' · ' + t.parentName : '') + '.'); }), false, 'soon');
    if (a.unestimated.length) group('No estimate yet', plural(a.unestimated.length, 'line'), [row(plural(a.unestimated.length, 'line'), a.unestimated.join(', ') + '.')]);
    if (a.sheetDiff) {
      group('Sheet total', 'Differs', [row('TOTAL row differs', 'The sheet says ' + W.money(a.sheetDiff.sheet) + ' ' + (a.sheetDiff.field === 'actual' ? 'spent' : 'estimated') +
        '; its lines add up to ' + W.money(a.sheetDiff.sum) + '. This page uses the lines.')], true);
    }
    if (a.missingReceipts) group('Receipts missing', plural(a.missingReceipts, 'payment'), [row(plural(a.missingReceipts, 'payment'), 'No receipt linked on the Expense_Tracker tab.')]);
    return '<div class="card" id="attnCard" data-open><div class="card-h"><div><h2>Needs attention</h2><p>From Asana\'s schedule' + (b ? ' and the pro-forma' : '') +
      '. Open a line to see each item.</p></div></div>' + (groups.join('') || '<p class="soft">Nothing needs attention.</p>') + '</div>';
  }

  /* ---------- Schedule, grouped by phase ---------- */
  function shown(items, today) {
    var q = view.q.trim().toLowerCase();
    return items.filter(function (t) {
      return (view.status === 'all' || B.statusOf(t, today) === view.status) && (!view.section || t.section === view.section) &&
        (!q || (t.name + ' ' + (t.parentName || '')).toLowerCase().indexOf(q) !== -1);
    });
  }
  /* rows → [{ phase: name | null, rows }] in the order of each phase's own task in the schedule
     (Asana lists the top tasks before their subtasks); a work item with no parent stands alone */
  function phases(rows, tasks) {
    var pos = {}, out = [], at = {};
    tasks.forEach(function (t, i) { pos[t.gid] = i; });
    rows.forEach(function (t) {
      var k = t.parentName || null;
      if (k == null) { out.push({ phase: null, rows: [t], at: pos[t.gid] }); return; }
      if (!(k in at)) { at[k] = out.length; out.push({ phase: k, rows: [], at: t.parentGid in pos ? pos[t.parentGid] : pos[t.gid] }); }
      out[at[k]].rows.push(t);
    });
    return out.sort(function (a, b) { return a.at - b.at; });
  }

  function gantt(ctx, rows, today) {
    var esc = ctx.esc, dates = [today];
    rows.forEach(function (t) { [t.startOn, t.dueOn].forEach(function (d) { if (d) dates.push(d); }); });
    dates.sort();
    // four days either side, so the first milestone and the last bar sit clear of the edges
    var t0 = Date.parse(dates[0]) - 4 * 864e5, t1 = Date.parse(dates[dates.length - 1]) + 5 * 864e5, span = t1 - t0;
    var at = function (d) { return ((Date.parse(d) - t0) / span * 100).toFixed(2) + '%'; };
    var wide = function (from, to) { return 'calc(' + ((Date.parse(to) + 864e5 - Date.parse(from)) / span * 100).toFixed(2) + '% + 2px)'; };
    var ticks = [], m = new Date(t0);
    m.setUTCDate(1);
    for (m.setUTCMonth(m.getUTCMonth() + 1); m.getTime() < t1; m.setUTCMonth(m.getUTCMonth() + 1)) {
      var mo = m.getUTCMonth();
      ticks.push('<span style="left:' + at(m.toISOString().slice(0, 10)) + '">' + MON[mo] + (mo === 0 ? ' ' + m.getUTCFullYear() : '') + '</span>');
    }
    var item = function (t, inPhase) {
      var s = B.statusOf(t, today), from = t.startOn || t.dueOn, mark = '';
      if (t.milestone && t.dueOn) mark = '<i class="g-ms" style="left:' + at(t.dueOn) + '"></i>';
      else if (from && t.dueOn) mark = '<i class="g-bar" style="left:' + at(from) + ';width:' + wide(from, t.dueOn) + '"></i>';
      var when = [t.startOn ? 'start ' + day(ctx.W, t.startOn) : '', t.dueOn ? 'target ' + day(ctx.W, t.dueOn) : ''].filter(Boolean).join(', ');
      // a trade's status shows as its bar's colour (the key says which); only a trade with no bar gets a word
      var sub = inPhase ? (s === 'undated' ? STATUS[s] : '') : [t.section ? B.sectionLabel(t.section) : '', STATUS[s]].filter(Boolean).join(' · ');
      return '<div class="g-row s-' + s + (inPhase ? ' in' : '') + '" role="listitem"><div class="g-name">' + (/^https:\/\//.test(t.link || '') ? '<a href="' + esc(t.link) + '" target="_blank" rel="noopener">' + esc(t.name) + '</a>' : esc(t.name)) +
        (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' +
        '<div class="g-track" title="' + esc(when || 'No dates in Asana') + '"><span class="sr">' + esc(when || 'No dates in Asana') + '</span>' + mark + '</div></div>';
    };
    var filtered = view.status !== 'all' || view.q.trim();   // a filter opens every phase it matches
    var body = phases(rows, (ctx.row.schedule || {}).tasks || []).map(function (g) {
      if (g.phase == null) return item(g.rows[0], false);
      var ds = [], done = g.rows.filter(function (t) { return t.completed; }).length;
      g.rows.forEach(function (t) { [t.startOn, t.dueOn].forEach(function (d) { if (d) ds.push(d); }); });
      ds.sort();
      var late = g.rows.filter(function (t) { return B.statusOf(t, today) === 'late'; }).length;
      var shut = !filtered && (g.phase in view.shut ? view.shut[g.phase] : done === g.rows.length);
      var note = done === g.rows.length ? 'All ' + g.rows.length + ' done' : done + ' of ' + g.rows.length + ' done' + (late ? ', ' + late + ' past target' : '');
      return '<div class="g-ph' + (late ? ' late' : '') + (done === g.rows.length ? ' done' : '') + '" role="listitem"><div class="g-name"><button type="button" class="g-tog" data-phase="' + esc(g.phase) + '" aria-expanded="' + !shut + '">' +
        esc(g.phase) + '</button><small>' + esc(note) + '</small></div>' +
        '<div class="g-track">' + (ds.length ? '<i class="g-span" style="left:' + at(ds[0]) + ';width:' + wide(ds[0], ds[ds.length - 1]) + '"></i>' : '') + '</div></div>' +
        (shut ? '' : g.rows.map(function (t) { return item(t, true); }).join(''));
    }).join('');
    return '<div class="gantt-wrap"><div class="gantt" role="list" aria-label="Schedule, ' + plural(rows.length, 'work item') + '">' +
      '<div class="g-head" aria-hidden="true"><span class="g-name">Phase and trade</span><div class="g-track">' + ticks.join('') + '</div></div>' +
      '<div class="g-body"><i class="g-today" style="--f:' + ((Date.parse(today) - t0) / span).toFixed(4) + '" aria-hidden="true"></i>' + body + '</div></div></div>';
  }

  function list(ctx, rows, today) {
    var esc = ctx.esc, W = ctx.W, names = {};
    ((ctx.row.schedule || {}).tasks || []).forEach(function (t) { names[t.gid] = t.name; });
    return '<div class="tbl-wrap"><table class="tbl sched"><thead><tr><th>Work item</th><th>Start</th><th>Target</th><th>Status</th><th>Waits on</th></tr></thead><tbody>' +
      rows.map(function (t) {
        var s = B.statusOf(t, today);
        return '<tr><td>' + esc(t.name) + '<small>' + esc(t.parentName || B.sectionLabel(t.section)) + '</small></td><td class="m">' + esc(day(W, t.startOn)) + '</td><td class="m">' + esc(day(W, t.dueOn)) +
          '</td><td><span class="chip s-' + s + '">' + esc(STATUS[s]) + '</span></td><td>' + esc((t.deps || []).map(function (g) { return names[g]; }).filter(Boolean).join(', ')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function scheduleHtml(ctx) {
    var esc = ctx.esc, j = ctx.job, today = ctx.W.today();
    var head = '<div class="card-h"><div><h2>Schedule</h2><p>Each phase with its trades, from the 🚧 Asana project. Every date is a tentative target.</p></div>' +
      (j.asanaUrl ? '<a class="b sm" href="' + esc(j.asanaUrl) + '" target="_blank" rel="noopener">' + ctx.I('arrow') + 'Open in Asana</a>' : '') + '</div>';
    if (!ctx.row.schedule) return '<div class="card" id="schedCard" data-open>' + head + '<p class="soft">' + (ctx.row.asana_project_gid ? 'The next Asana read brings the schedule in.' : 'Link the development\'s 🚧 Asana project to see its schedule.') + '</p></div>';
    var items = B.workItems(ctx.row.schedule);
    var sections = items.map(function (t) { return t.section; }).filter(function (s, i, a) { return s && a.indexOf(s) === i; });
    if (view.section === null) view.section = sections.filter(function (s) { return /construction/i.test(s); })[0] || '';
    if (view.section && sections.indexOf(view.section) === -1) view.section = '';
    var inSection = items.filter(function (t) { return !view.section || t.section === view.section; });
    var rows = shown(items, today), done = inSection.filter(function (t) { return t.completed; }).length;
    var opt = function (v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; };
    return '<div class="card" id="schedCard" data-open>' + head +
      '<p class="sched-n"><b>' + done + '</b> of ' + plural(inSection.length, 'work item') + ' done in Asana' + (view.section ? ' · ' + esc(B.sectionLabel(view.section)) : '') + '</p>' +
      '<div class="sched-f"><div class="seg" role="group" aria-label="View">' + ['gantt', 'list'].map(function (m) {
        return '<button type="button" data-view="' + m + '" aria-pressed="' + (view.mode === m) + '">' + (m === 'gantt' ? 'Timeline' : 'List') + '</button>';
      }).join('') + '</div>' +
      (sections.length > 1 ? '<select class="inp" id="schedSec" aria-label="Phase">' + opt('', 'Every phase', view.section) + sections.map(function (s) { return opt(s, B.sectionLabel(s), view.section); }).join('') + '</select>' : '') +
      '<select class="inp" id="schedS" aria-label="Status">' + opt('all', 'Every status', view.status) + Object.keys(STATUS).map(function (k) { return opt(k, STATUS[k], view.status); }).join('') + '</select>' +
      '<input class="inp" type="search" id="schedQ" placeholder="Find a trade" aria-label="Find a work item" value="' + esc(view.q) + '">' +
      '<button class="b sm" type="button" id="schedCsv">Export CSV</button></div>' +
      (rows.length ? (view.mode === 'gantt' ? gantt(ctx, rows, today) : list(ctx, rows, today)) : '<p class="soft">No work item matches.</p>') +
      (view.mode === 'gantt' && rows.length ? '<p class="g-key"><span class="k-done">Done</span><span class="k-open">Open</span><span class="k-late">Past target</span><span class="k-ms">Milestone</span><span class="k-today">Today</span></p>' : '') +
      '</div>';
  }

  /* ---------- Budget: each line's spending against its estimate ---------- */
  function linkForm(ctx, again) {
    return '<form class="blink" id="budgetLink"><label for="budgetSheet">Pro-forma sheet link</label><div><input class="inp" id="budgetSheet" type="text" inputmode="url" autocomplete="off" required placeholder="https://docs.google.com/spreadsheets/d/…"' +
      ' value="' + ctx.esc(again ? 'https://docs.google.com/spreadsheets/d/' + ctx.budget.sheet_id + '/edit' : '') + '">' +
      '<button class="b primary sm" type="submit">' + (again ? 'Save' : 'Link sheet') + '</button>' + (again ? '<button class="b sm" type="button" id="budgetCancel">Cancel</button>' : '') + '</div>' +
      '<p class="soft">The helper reads it signed in as Matt, so the sheet must open in Matt\'s Google account. Only the Hard Costs table and the Expense_Tracker tab are kept.</p>' +
      '<p class="fmsg" id="budgetMsg" role="alert"></p></form>';
  }

  function budgetHtml(ctx) {
    var W = ctx.W, esc = ctx.esc, row = ctx.budget, b = row && row.budget;
    if (!row && !ctx.canEdit) return '';
    var head = '<div class="card-h"><div><h2>Budget</h2><p>' + (b && b.title ? 'Spent against estimate, line by line, from ' + esc(b.title) + '. ' : 'From the developer\'s pro-forma sheet. ') +
      'Seen only when signed in to the team.</p></div>' + (row ? '<a class="b sm" href="https://docs.google.com/spreadsheets/d/' + esc(row.sheet_id) + '/edit" target="_blank" rel="noopener">' + ctx.I('arrow') + 'Open sheet</a>' : '') + '</div>';
    if (!row || linking) return '<div class="card" id="budgetCard" data-open>' + head + linkForm(ctx, !!row) + '</div>';
    var foot = '<p class="b-foot">' + (row.synced_at ? 'Read ' + esc(W.fmtWhen(row.synced_at)) : 'Linked; the helper reads it within the hour') +
      (ctx.canEdit ? ' · <button class="link" type="button" id="budgetChange">Change sheet</button>' : '') + '</p>';
    var err = row.error ? '<p class="fw" role="alert">' + esc(row.error) + (b ? ' Showing the last good read.' : '') + '</p>' : '';
    if (!b) return '<div class="card" id="budgetCard" data-open>' + head + err + foot + '</div>';
    var hasUp = (b.lines || []).some(function (l) { return l.upgrade; }), t = scoped(b);
    var num = function (v) { return Number(v) || 0; };
    var lines = t.lines.slice().sort(function (x, y) { return num(y.actual) - num(x.actual) || num(y.estimate) - num(x.estimate); });
    var shownLines = allLines ? lines : lines.slice(0, LINES_SHOWN);
    return '<div class="card" id="budgetCard" data-open>' + head + err +
      (hasUp ? '<div class="seg b-scope" role="group" aria-label="Budget scope"><button type="button" data-up="0" aria-pressed="' + !upgrades + '">Base build</button>' +
        '<button type="button" data-up="1" aria-pressed="' + upgrades + '">With upgrades</button></div>' : '') +
      '<p class="b-sum"><span>' + esc(W.money(t.actual)) + ' spent of ' + esc(W.money(t.estimate)) + '</span><span>' + esc(plural(t.lines.length, 'line')) + ', most spent first</span></p>' +
      '<ul class="blines">' + shownLines.map(function (l) {
        var spent = num(l.actual), left = l.estimate != null ? l.estimate - spent : null, over = left != null && left < 0;
        var fig = l.estimate != null ? W.money(spent) + ' of ' + W.money(l.estimate) : spent ? W.money(spent) + ', no estimate' : 'No estimate';
        var note = over ? W.money(-left) + ' over' : left != null ? (spent ? W.money(left) + ' left' : 'Nothing spent yet') : '';
        return '<li' + (over ? ' class="over"' : '') + '><div class="bl-t"><span class="bl-n">' + esc(l.name) + (l.upgrade ? ' <span class="chip">Upgrade</span>' : '') + '</span>' +
          '<span class="bl-f">' + esc(fig) + '</span></div>' + meter(l.estimate ? spent / l.estimate * 100 : 0, over ? 'over' : '') +
          (note ? '<div class="bl-s">' + esc(note) + '</div>' : '') + '</li>';
      }).join('') + '</ul>' +
      (lines.length > LINES_SHOWN ? '<button class="b sm bl-more" type="button" id="budgetAll">' + (allLines ? 'Show the top ' + LINES_SHOWN : 'Show all ' + lines.length + ' lines') + '</button>' : '') +
      ((b.payments || []).length ? '<details class="pays"><summary>' + plural(b.payments.length, 'payment') + '</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th class="r">Amount</th><th>Receipt</th></tr></thead><tbody>' +
        b.payments.slice().sort(function (x, y) { return (y.date || '') < (x.date || '') ? -1 : (y.date || '') > (x.date || '') ? 1 : 0; }).map(function (p) {
          return '<tr><td class="m">' + esc(day(W, p.date)) + '</td><td>' + esc(p.category || '') + '</td><td>' + esc(p.vendor || '') + '</td><td>' + esc(p.description || '') +
            '</td><td class="r m">' + esc(W.money(p.amount)) + '</td><td>' + (p.receipt ? 'Yes' : '<span class="miss">Missing</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></details>' : '') + foot + '</div>';
  }

  function html(ctx) {
    return '<div id="ovHost">' + overviewHtml(ctx) + '</div>' +
      '<div class="dv-main"><div id="schedHost">' + scheduleHtml(ctx) + '</div>' +
      '<div class="dv-side"><div id="attnHost">' + attentionHtml(ctx) + '</div><div id="hintsHost">' + JP.dev.hintsHtml(ctx) + '</div></div></div>' +
      '<div id="budgetHost">' + budgetHtml(ctx) + '</div>';
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
    // the overview's figures follow the Budget card's scope
    var redrawBudget = function () { $('budgetHost').innerHTML = budgetHtml(ctx); $('ovHost').innerHTML = overviewHtml(ctx); wireBudget(); };

    function wireSchedule() {
      var card = $('schedCard');
      if (!card || !$('schedS')) return;
      card.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { view.mode = b.dataset.view; redrawSchedule(); }); });
      card.querySelectorAll('[data-phase]').forEach(function (b) {
        b.addEventListener('click', function () {
          view.shut[b.dataset.phase] = b.getAttribute('aria-expanded') === 'true'; redrawSchedule();
          var again = card.ownerDocument.querySelector('#schedCard [data-phase="' + CSS.escape(b.dataset.phase) + '"]');
          if (again) again.focus();
        });
      });
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
      if ($('budgetAll')) $('budgetAll').addEventListener('click', function () { allLines = !allLines; redrawBudget(); });
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

    // Needs attention → the schedule: every phase, that status, scrolled into view
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-show]'); if (!b) return;
      view.status = b.dataset.show; view.section = ''; view.q = ''; view.mode = 'gantt';
      redrawSchedule();
      $('schedCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    wireSchedule();
    wireBudget();
    JP.dev.wireHints($('hintsHost'), ctx);
  }

  JP.build = { html: html, wire: wire };
})(window);
