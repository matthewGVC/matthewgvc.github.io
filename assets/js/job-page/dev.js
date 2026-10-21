/* ============================================================
   JOB PAGE: a development's milestones (spec §2.9, S10, D66, D67).

     GVC_JP.dev.html(ctx)       → the Milestones card and Asana's suggestions
     GVC_JP.dev.wire(host, ctx) → their clicks

   D66's 18 milestones, each with its date and its slips ("re-dated 2 times,
   +9 days", from next_milestone.slips keyed by the Asana task gid). The
   owner ticks one by hand with a date, or unticks it; both save the
   milestones through save_job. Asana's suggestions keep Slice 2's ✓ / ✗
   (a version-checked update of the row, then the change-log row).
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var ticking = null;   // { key, on, msg } the milestone being ticked, kept across a reload

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
    if (j.next) nx.push('<span class="dmk planned' + (j.next.overdue ? ' over' : '') + '">' + esc('Next: ' + j.next.label + (j.next.on ? ', ' + W.fmtDay(j.next.on) : '') + (j.next.overdue ? ' (overdue)' : '')) + '</span>');
    if (j.slips) nx.push('<span>' + esc('Milestones re-dated ' + j.slips + ' time' + (j.slips === 1 ? '' : 's')) + '</span>');
    if (j.construction) nx.push('<span>' + esc('Construction ' + j.construction.done + ' of ' + j.construction.total) + '</span>');
    return '<div class="card"><div class="card-h"><div><h2>Milestones</h2><p>Confirmed by Matt. What Asana suggests waits below until it is confirmed.' +
      (ctx.canEdit ? ' Tick one by hand with the day it happened.' : '') + '</p></div>' +
      (j.asanaUrl ? '<a class="b sm" href="' + esc(j.asanaUrl) + '" target="_blank" rel="noopener">' + I('arrow') + 'Open in Asana</a>' : '') + '</div>' +
      '<div class="dates" id="devNext" style="margin:0 0 10px">' + (nx.join('') || '<span>No next milestone yet.</span>') + '</div>' +
      (j.construction ? '<div class="cons" style="margin-bottom:12px"><i style="width:' + (j.construction.done / j.construction.total * 100) + '%"></i></div>' : '') +
      '<p class="fmsg" id="msMsg" role="alert">' + esc((ticking && ticking.msg) || '') + '</p>' +
      '<ul class="log" id="msList">' + W.DEV_KEYS.map(function (k) {
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
      }).join('') + '</ul></div>' + hintsCard(ctx);
  }

  /* S13 (Slice 2): Asana's suggestions, each confirmed or turned down by hand */
  function hintsCard(ctx) {
    var W = ctx.W, esc = ctx.esc, hs = ctx.row.milestone_hints || [];
    if (!hs.length) return '';
    return '<div class="card" style="margin-top:24px"><div class="card-h"><div><h2>Suggested from Asana</h2><p>' + hs.length + ' milestone' + (hs.length === 1 ? '' : 's') + ' to review. ✓ makes it a milestone with this date; ✗ turns it down and Asana won\'t suggest it again.</p></div></div>' +
      '<p id="hintMsg" role="alert" style="color:var(--danger);font-size:13px;min-height:1.2em;margin:0 0 6px"></p><ul class="log" id="hints">' + hs.map(function (h, i) {
        return '<li style="grid-template-columns:14px 1fr auto"><span class="dt"></span><div>' + esc(W.DEV_LABEL[h.key] || h.key) + ', ' + (h.approx ? 'about ' : '') + esc(W.fmtDay(h.date) + ' ' + String(h.date || '').slice(0, 4)) +
          '<small>' + esc(h.source || 'Asana') + '</small></div><span class="hint-b"><button class="b sm" type="button" data-ok="' + i + '" aria-label="Confirm ' + esc(W.DEV_LABEL[h.key] || h.key) + '">✓</button>' +
          '<button class="b sm" type="button" data-no="' + i + '" aria-label="Turn down ' + esc(W.DEV_LABEL[h.key] || h.key) + '">✗</button></span></li>';
      }).join('') + '</ul></div>';
  }

  var hintBusy = false;
  function saveHint(ctx, i, ok) {
    var W = ctx.W, P = global.GVC_PROPS, r = ctx.row, hs = r.milestone_hints || [], h = hs[i], $ = function (id) { return global.document.getElementById(id); };
    if (!h || hintBusy) return;
    hintBusy = true;
    global.document.querySelectorAll('#hints button').forEach(function (b) { b.disabled = true; });
    var msg = $('hintMsg'); msg.textContent = 'Saving…';
    var label = W.DEV_LABEL[h.key] || h.key;
    var clone = function (x) { return JSON.parse(JSON.stringify(x || {})); };
    P.whoAmI().catch(function () { return { name: 'Matt' }; }).then(function (me) {
      var map = clone(r.asana_map), patch = { milestone_hints: hs.filter(function (x, k) { return k !== i; }) };
      var gid = h.asanaGid || null, add = function (list) { list = list || []; return gid && list.indexOf(gid) === -1 ? list.concat([gid]) : list; };
      if (ok) {
        var ms = clone(r.milestones);
        ms[h.key] = { done: true, on: h.date, approx: !!h.approx, asanaGid: gid, source: h.source || null, confirmedBy: me.name, confirmedAt: new Date().toISOString() };
        patch.milestones = ms;
        map[h.key] = add(map[h.key]);
      } else {
        map.dismissed = map.dismissed || {};
        map.dismissed[h.key] = add(map.dismissed[h.key]);
      }
      patch.asana_map = map;
      return P.call('/rest/v1/dev_projects?id=eq.' + encodeURIComponent(r.id) + '&version=eq.' + encodeURIComponent(r.version), {
        method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(patch)
      }).then(function (rows) {
        if (!rows || !rows.length) throw new Error('Someone changed this development meanwhile. Reload the page and try again.');
        var c = ok ? { dev_project_id: r.id, field: 'milestones', old_value: (r.milestones || {})[h.key] || null, new_value: patch.milestones[h.key], note: label + ' confirmed from Asana: ' + W.fmtDay(h.date) + '.' }
          : { dev_project_id: r.id, field: 'milestone_hints', old_value: h, new_value: null, note: 'Asana\'s suggestion for ' + label + ' turned down.' };
        c.source = 'Matt';
        return P.call('/rest/v1/changes', { method: 'POST', body: JSON.stringify(c) }).then(function () { hintBusy = false; return JP.reload(); }, function (e) {
          hintBusy = false; JP.reload().then(function () { if ($('hintMsg')) $('hintMsg').textContent = 'Saved, but the change log didn\'t save (' + e.message + ').'; });
        });
      });
    }).catch(function (e) {
      hintBusy = false; msg.textContent = e.message;
      global.document.querySelectorAll('#hints button').forEach(function (b) { b.disabled = false; });
    });
  }

  function wire(host, ctx) {
    var W = ctx.W, r = ctx.row;
    var redraw = function () { host.innerHTML = html(ctx); wire(host, ctx); };
    var hints = host.querySelector('#hints');
    if (hints) hints.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.ok != null) saveHint(ctx, +b.dataset.ok, true); else if (b.dataset.no != null) saveHint(ctx, +b.dataset.no, false);
    });
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

  JP.dev = { html: html, wire: wire, slipsOf: slipsOf };
})(window);
