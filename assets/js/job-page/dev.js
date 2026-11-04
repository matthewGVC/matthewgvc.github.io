/* ============================================================
   JOB PAGE: a development's milestones (spec §2.9, S10, D66, D67).

     GVC_JP.dev.html(ctx)            → the Milestones card
     GVC_JP.dev.wire(host, ctx)      → its ticks

   D66's 18 milestones, each with its date and its slips ("re-dated 2 times,
   +9 days", from next_milestone.slips keyed by the Asana task gid). The
   owner ticks one by hand with a date, or unticks it; both save the
   milestones through save_job. A development that is one house (D141,
   ctx.sfh) with a schedule shows only SALE_KEYS: its build is the Schedule
   card's. The Asana suggestions card was retired (11-04): the helper still
   writes milestone_hints, and the overview still counts them.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var ticking = null;   // { key, on, msg } the milestone being ticked, kept across a reload
  // the sale's own milestones, of D66's 18, for a single-house development with a schedule
  var SALE_KEYS = ['listingAgreement', 'showingAssets', 'listedUnits', 'contractsSales', 'closedOut'];

  /* the slips of one milestone: its own Asana task, and the tasks linked to it in asana_map */
  function slipsOf(row, key) {
    var s = (row.next_milestone && row.next_milestone.slips) || {}, ms = (row.milestones || {})[key] || {};
    var gids = [].concat(ms.asanaGid ? [ms.asanaGid] : [], ((row.asana_map || {})[key]) || []);
    var seen = {}, count = 0, days = 0;
    gids.forEach(function (g) {
      if (seen[g] || !s[g]) return; seen[g] = true;
      count += +s[g].count || 0; days += +s[g].days || 0;
    });
    if (!count) return '';
    return 're-dated ' + count + ' time' + (count === 1 ? '' : 's') + (days ? ', ' + (days > 0 ? '+' : '') + days + ' day' + (Math.abs(days) === 1 ? '' : 's') : '');
  }

  function html(ctx) {
    var W = ctx.W, I = ctx.I, esc = ctx.esc, r = ctx.row, j = ctx.job, ms = r.milestones || {}, nx = [];
    var keys = ctx.sfh && r.schedule ? SALE_KEYS : W.DEV_KEYS;
    if (j.next) nx.push('<span class="dmk planned' + (j.next.overdue ? ' over' : '') + '">' + esc('Next: ' + j.next.label + (j.next.on ? ', ' + W.fmtDay(j.next.on) : '') + (j.next.overdue ? ' (overdue)' : '')) + '</span>');
    if (j.construction) nx.push('<span>' + esc('Construction ' + j.construction.done + ' of ' + j.construction.total) + '</span>');
    // a single-house development opens Asana from the page header only
    return '<div class="card" id="msCard"><div class="card-h"><div><h2>Milestones</h2><p>Confirmed by Matt.' +
      (keys === SALE_KEYS ? ' The sale only; the build is in the Schedule.' : '') +
      (ctx.canEdit ? ' Tick one by hand with the day it happened.' : '') + '</p></div>' +
      (j.asanaUrl && !ctx.sfh ? '<a class="b sm" href="' + esc(j.asanaUrl) + '" target="_blank" rel="noopener">' + I('arrow') + 'Open in Asana</a>' : '') + '</div>' +
      '<div class="dates" id="devNext" style="margin:0 0 10px">' + (nx.join('') || '<span>No next milestone yet.</span>') + '</div>' +
      (j.construction ? '<div class="cons" style="margin-bottom:12px"><i style="width:' + (j.construction.done / j.construction.total * 100) + '%"></i></div>' : '') +
      '<p class="fmsg" id="msMsg" role="alert">' + esc((ticking && ticking.msg) || '') + '</p>' +
      '<ul class="log" id="msList">' + keys.map(function (k) {
        var x = ms[k] || {}, slip = slipsOf(r, k);
        var w = x.on ? W.fmtDay(x.on) + (x.done ? '' : ' (planned)') : x.done ? 'done' : '';
        var sub = [];
        if (x.asanaGid) sub.push('Confirmed from Asana' + (x.confirmedBy ? ' by ' + x.confirmedBy : ''));
        else if (x.done && x.source === 'Matt') sub.push('Ticked by hand' + (x.confirmedBy ? ' by ' + x.confirmedBy : ''));
        if (slip) sub.push(slip);
        var act = '';
        if (ctx.canEdit) {
          if (ticking && ticking.key === k) {
            act = '<span class="mtick"><input class="inp" type="date" id="msDate" aria-label="Day ' + esc(W.DEV_LABEL[k]) + ' happened" value="' + esc(ticking.on) + '">' +
              '<button class="b primary sm" type="button" id="msSave">Save</button><button class="b sm" type="button" id="msCancel">Cancel</button></span>';
          } else if (x.done) act = '<button class="b sm" type="button" data-untick="' + k + '" aria-label="Untick ' + esc(W.DEV_LABEL[k]) + '">Untick</button>';
          else act = '<button class="b sm" type="button" data-tick="' + k + '" aria-label="Tick ' + esc(W.DEV_LABEL[k]) + '">Tick</button>';
        }
        return '<li data-ms="' + k + '"><span class="dt' + (x.done ? ' m' : '') + '"></span><div>' + esc(W.DEV_LABEL[k]) +
          sub.map(function (s) { return '<small>' + esc(s) + '</small>'; }).join('') + '</div><span class="mr"><span class="w">' + esc(w) + '</span>' + act + '</span></li>';
      }).join('') + '</ul></div>';
  }

  function wire(host, ctx) {
    var W = ctx.W, r = ctx.row;
    var redraw = function () { host.innerHTML = html(ctx); wire(host, ctx); };
    var msg = host.querySelector('#msMsg');
    var save = function (key, next, note) {
      host.querySelectorAll('#msList button').forEach(function (b) { b.disabled = true; });
      msg.textContent = 'Saving…';
      var ms = JP.clone(r.milestones || {}), before = ms[key] || null;
      if (next) ms[key] = next; else delete ms[key];
      return JP.save('dev_projects', r, { milestones: ms }, [{ field: 'milestones', old_value: before, new_value: next, note: note }])
        .then(function () { ticking = null; return JP.reload(); }, function (e) {
          if (ticking) ticking.msg = e.message;
          var m = global.document.getElementById('msMsg');
          if (m) m.textContent = e.message;
          if (!e.conflict) host.querySelectorAll('#msList button').forEach(function (b) { b.disabled = false; });
        });
    };
    host.querySelectorAll('[data-tick]').forEach(function (b) {
      b.addEventListener('click', function () { ticking = { key: b.dataset.tick, on: W.today(), msg: '' }; redraw(); });
    });
    host.querySelectorAll('[data-untick]').forEach(function (b) {
      b.addEventListener('click', function () { save(b.dataset.untick, null, W.DEV_LABEL[b.dataset.untick] + ' unticked.'); });
    });
    var d = host.querySelector('#msDate');
    if (!d || !ticking) return;
    d.addEventListener('change', function () { ticking.on = d.value; });
    host.querySelector('#msCancel').addEventListener('click', function () { ticking = null; redraw(); });
    host.querySelector('#msSave').addEventListener('click', function () {
      var on = d.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) { msg.textContent = 'Pick the day it happened.'; return; }
      if (on > W.today()) { msg.textContent = 'That day hasn\'t come yet. Pick the day it happened.'; return; }
      ticking.on = on;
      var k = ticking.key, prev = (r.milestones || {})[k] || {};
      var next = Object.assign({}, prev, { done: true, on: on, source: 'Matt', confirmedBy: (ctx.me && ctx.me.name) || 'Matt', confirmedAt: new Date().toISOString() });
      delete next.approx;   // a day picked by hand is exact; an Asana gid stays so its slips still show
      save(k, next, W.DEV_LABEL[k] + ' ticked by hand: ' + W.fmtDay(on) + '.');
    });
  }

  JP.dev = { html: html, wire: wire, slipsOf: slipsOf, SALE_KEYS: SALE_KEYS };
})(window);
