/* ============================================================
   JOB PAGE: the Agents card (spec §2.3, S6, S7, D53).

     GVC_JP.agents.html(ctx)       → the card's HTML
     GVC_JP.agents.wire(host, ctx) → its clicks

   Confirmed agents (core.agentIds, first = lead) with headshot and title.
   Before anyone confirms: Asana's suggestion (core.suggestedAgentIds, from
   the Point Person's initials) with Confirm and Change. Change lists the
   job market's agents with a search box, "Show everyone" for the rest;
   ↑ / ↓ reorder, × removes. Saving writes core.agentIds and
   core.agentsConfirmed = { from: Asana's suggestion then, on, by }.
   An id no longer on the roster shows as "Unknown agent (id)" with ×.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var ui = null;   // { list, search, all, msg } while changing the list

  var agent = function (id) { return global.GVC_AGENT ? global.GVC_AGENT(id) : null; };
  var nameOf = function (id) { var a = agent(id); return a ? a.name : 'Unknown agent (' + id + ')'; };
  var same = function (a, b) { return JSON.stringify(a || []) === JSON.stringify(b || []); };

  /* why some of the Point Person's initials were not suggested (CB, past members, unknown) */
  function whyNot(point) {
    var map = global.GVC_ROSTER_INITIALS || {}, out = [];
    String(point || '').split(/[\/,&+\s]+/).filter(Boolean).forEach(function (ini) {
      if (!(ini in map)) out.push(ini + ' isn\'t a set of initials the workspace knows, so it isn\'t suggested.');
      else if (map[ini] === null) out.push(ini + ' could be more than one person, so pick by hand.');
      else if (/^past:/.test(map[ini])) out.push(ini + ' is ' + map[ini].slice(5) + ', no longer on the team.');
      else if (/^other:/.test(map[ini])) out.push(ini + ' is ' + map[ini].slice(6) + ', who isn\'t on the agents roster.');
    });
    return out;
  }

  function person(id, i, ctx, edit) {
    var esc = ctx.esc, a = agent(id);
    var pic = a ? '<img class="ph" src="' + esc(a.photo) + '" alt="">' : '<span class="ph">' + ctx.I('people') + '</span>';
    var who = a ? '<div class="an">' + esc(a.name) + (i === 0 ? ' <span class="chip">Lead</span>' : '') + '</div><div class="at">' + esc(a.title) + '</div>'
                : '<div class="an">' + esc('Unknown agent (' + id + ')') + '</div><div class="at">No longer on the roster</div>';
    var btn = '';
    if (edit) {
      btn = '<span class="ab"><button class="b sm" type="button" data-up="' + i + '" aria-label="Move ' + esc(nameOf(id)) + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="b sm" type="button" data-down="' + i + '" aria-label="Move ' + esc(nameOf(id)) + ' down"' + (i === ui.list.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="b sm" type="button" data-rm="' + i + '" aria-label="Remove ' + esc(nameOf(id)) + '">×</button></span>';
    } else if (!a && ctx.canEdit) {
      btn = '<span class="ab"><button class="b sm" type="button" data-drop="' + esc(id) + '" aria-label="Remove ' + esc(nameOf(id)) + '">×</button></span>';
    }
    return '<li class="agent" data-id="' + esc(id) + '">' + pic + '<div class="aw">' + who + '</div>' + btn + '</li>';
  }

  function picker(ctx) {
    var esc = ctx.esc, market = ctx.row.market, q = (ui.search || '').toLowerCase();
    var roster = (global.GVC_ROSTER || []).filter(function (a) { return ui.list.indexOf(a.id) === -1; })
      .filter(function (a) { return !q || a.name.toLowerCase().indexOf(q) !== -1; });
    var here = roster.filter(function (a) { return !a.market || !market || a.market === market; });
    var rest = roster.filter(function (a) { return here.indexOf(a) === -1; });
    var item = function (a) { return '<li><button class="b sm" type="button" data-add="' + esc(a.id) + '">+ ' + esc(a.name) + '</button></li>'; };
    return '<div class="apick"><input class="inp" id="agSearch" placeholder="Search agents" aria-label="Search agents" value="' + esc(ui.search || '') + '">' +
      '<ul class="aopts">' + (here.map(item).join('') || '<li class="soft">No one else' + (market ? ' in ' + esc(market) : '') + '.</li>') + '</ul>' +
      (rest.length ? (ui.all ? '<ul class="aopts">' + rest.map(item).join('') + '</ul>' : '<button class="link" type="button" id="agAll">Show everyone (' + rest.length + ' more)</button>') : '') + '</div>';
  }

  function html(ctx) {
    var esc = ctx.esc, core = ctx.row.core || {}, ids = core.agentIds || [], sug = core.suggestedAgentIds || [];
    var point = (ctx.row.asana || {}).pointPerson || null, conf = core.agentsConfirmed || null;
    var body = '';
    if (ui) {
      body = (ui.list.length ? '<ol class="agents">' + ui.list.map(function (id, i) { return person(id, i, ctx, true); }).join('') + '</ol>' : '<p class="soft">No agents picked.</p>') +
        picker(ctx) + '<div class="fbtn"><button class="b primary sm" type="button" id="agSave">Save agents</button><button class="b sm" type="button" id="agCancel">Cancel</button></div>';
    } else if (ids.length) {
      body = '<ol class="agents">' + ids.map(function (id, i) { return person(id, i, ctx, false); }).join('') + '</ol>';
      if (conf && conf.on) body += '<p class="soft as">Confirmed ' + esc(ctx.W.fmtDay(conf.on)) + (conf.by ? ' by ' + esc(conf.by) : '') + '.</p>';
      if (conf && sug.length && !same(conf.from, sug)) {
        body += '<p class="aw-n" role="note">' + ctx.I('alert') + esc('Asana\'s Point Person now suggests ' + sug.map(nameOf).join(', ') + '. The confirmed agents stay; if they are right, ask the team to update the Point Person in Asana.') + '</p>';
      }
    } else if (sug.length) {
      body = '<p class="asug">' + esc('Asana suggests ' + sug.map(nameOf).join(', ') + (point ? ' (from ' + point + ')' : '') + '. Confirm?') + '</p>';
    } else {
      body = '<p class="soft">No agents yet' + (point ? '. Asana\'s Point Person is ' + esc(point) : '') + '.</p>';
    }
    var why = !ids.length && !ui ? whyNot(point) : [];
    if (why.length) body += '<ul class="awhy">' + why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
    var mm = (ctx.job.match || []).filter(function (m) { return m.code === 'M11'; });
    if (mm.length) body += '<ul class="mm">' + mm.map(function (m) { return '<li><span class="code">M11</span><span>' + esc(m.text) + '</span></li>'; }).join('') + '</ul>';
    var acts = '';
    if (ctx.canEdit && !ui) {
      acts = (!ids.length && sug.length ? '<button class="b primary sm" type="button" id="agConfirm">Confirm</button>' : '') +
        '<button class="b sm" type="button" id="agChange">' + (ids.length || sug.length ? 'Change' : 'Add') + '</button>';
    }
    return '<div class="card" id="agentsCard"><div class="card-h"><div><h2>Agents</h2></div></div>' +
      body + (acts ? '<div class="fbtn">' + acts + '</div>' : '') + '<p class="fmsg" id="agMsg" role="alert">' + esc((ui && ui.msg) || '') + '</p></div>';
  }

  function wire(host, ctx) {
    var r = ctx.row, core0 = r.core || {};
    var redraw = function () { host.innerHTML = html(ctx); wire(host, ctx); };
    var on = function (sel, fn) { var e = host.querySelector(sel); if (e) e.addEventListener('click', fn); };
    var msg = host.querySelector('#agMsg');
    var save = function (list) {
      host.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      msg.textContent = 'Saving…';
      var core = JP.clone(core0);
      var before = core.agentIds || [];
      core.agentIds = list;
      core.agentsConfirmed = { from: (core.suggestedAgentIds || []).slice(), on: ctx.W.today(), by: (ctx.me && ctx.me.name) || 'Matt' };
      return JP.save(ctx.table, r, { core: core }, [{ field: 'agentIds', old_value: before, new_value: list }])
        .then(function () { ui = null; return JP.reload(); }, function (e) {
          if (ui) ui.msg = e.message;
          var m = global.document.getElementById('agMsg');
          if (e.conflict) { if (m) m.textContent = e.message; return; }
          host.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
          if (m) m.textContent = e.message;
        });
    };
    on('#agConfirm', function () { save((core0.suggestedAgentIds || []).slice()); });
    on('#agChange', function () { ui = { list: (core0.agentIds && core0.agentIds.length ? core0.agentIds : core0.suggestedAgentIds || []).slice(), search: '', all: false, msg: '' }; redraw(); });
    host.querySelectorAll('[data-drop]').forEach(function (b) {
      b.addEventListener('click', function () { save((core0.agentIds || []).filter(function (id) { return id !== b.dataset.drop; })); });
    });
    if (!ui) return;
    host.querySelectorAll('[data-up]').forEach(function (b) { b.addEventListener('click', function () { var i = +b.dataset.up; ui.list.splice(i - 1, 0, ui.list.splice(i, 1)[0]); redraw(); }); });
    host.querySelectorAll('[data-down]').forEach(function (b) { b.addEventListener('click', function () { var i = +b.dataset.down; ui.list.splice(i + 1, 0, ui.list.splice(i, 1)[0]); redraw(); }); });
    host.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { ui.list.splice(+b.dataset.rm, 1); redraw(); }); });
    host.querySelectorAll('[data-add]').forEach(function (b) { b.addEventListener('click', function () { ui.list.push(b.dataset.add); redraw(); }); });
    on('#agAll', function () { ui.all = true; redraw(); });
    var s = host.querySelector('#agSearch');
    s.addEventListener('input', function () {
      ui.search = s.value; var at = s.selectionStart;
      redraw();
      var n = host.querySelector('#agSearch'); n.focus(); n.setSelectionRange(at, at);
    });
    on('#agCancel', function () { ui = null; redraw(); });
    on('#agSave', function () { save(ui.list.slice()); });
  }

  JP.agents = { html: html, wire: wire, whyNot: whyNot };
})(window);
