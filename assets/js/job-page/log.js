/* ============================================================
   JOB PAGE: the Change log card (spec §2.5, S19).

     GVC_JP.log.html(ctx)       → the card's HTML
     GVC_JP.log.wire(host, ctx) → the note box
       ctx.changes  the job's change rows, newest first
       ctx.me       { name, role } (any team member may add a note)

   Each line is worded by GVC_WS.changeTitle (shared with the overview),
   with its note, who asked and "Typo, no rebuild". The "What changed, who
   asked" box saves a change row with no field through save_job. Entries
   are never edited or deleted.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var draft = null;   // { text, asked, msg } kept across a reload

  function html(ctx) {
    var W = ctx.W, esc = ctx.esc;
    var items = (ctx.changes || []).map(function (c) {
      var cls = c.source === 'DE' ? 'de' : c.source === 'Matt' ? 'm' : '';
      var t = W.changeTitle(c), small = [];
      if (c.note && c.field && c.note !== t) small.push(c.note);
      if (c.asked_by) small.push('Asked by ' + c.asked_by + '.');
      if (c.no_rebuild) small.push('Typo, no rebuild.');
      return '<li><span class="dt ' + cls + '"></span><div>' + esc(t) + small.map(function (s) { return '<small>' + esc(s) + '</small>'; }).join('') +
        '</div><span class="w">' + esc(W.fmtDay(c.at) + ' · ' + c.source) + '</span></li>';
    });
    var box = '';
    if (ctx.me && ctx.me.role) {
      var d = draft || { text: '', asked: '', msg: '' };
      var opts = ['<option value="">Who asked</option>', '<option value="Matt"' + (d.asked === 'Matt' ? ' selected' : '') + '>Matt</option>']
        .concat((global.GVC_ROSTER || []).map(function (a) { return '<option value="' + esc(a.name) + '"' + (d.asked === a.name ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }));
      box = '<div class="logf"><input class="inp" id="noteText" placeholder="What changed, who asked" aria-label="What changed" value="' + esc(d.text) + '">' +
        '<select class="inp" id="noteWho" aria-label="Who asked">' + opts.join('') + '</select>' +
        '<button class="b primary sm" type="button" id="noteAdd">Log</button></div><p class="fmsg" id="noteMsg" role="alert">' + esc(d.msg || '') + '</p>';
    }
    return '<div class="card" id="logCard"><div class="card-h"><div><h2>Change log</h2><p>Newest first. Entries are never edited or deleted.</p></div></div>' + box +
      (items.length ? '<ul class="log" id="changeLog">' + items.join('') + '</ul>' : '<p class="soft">Nothing logged yet.</p>') + '</div>';
  }

  function wire(host, ctx) {
    var add = host.querySelector('#noteAdd');
    if (!add) return;
    var text = host.querySelector('#noteText'), who = host.querySelector('#noteWho'), msg = host.querySelector('#noteMsg');
    var keep = function () { draft = { text: text.value, asked: who.value, msg: '' }; };
    text.addEventListener('input', keep); who.addEventListener('change', keep);
    var go = function () {
      var t = text.value.trim();
      if (!t) { msg.textContent = 'Write what changed first.'; return; }
      keep(); add.disabled = true; msg.textContent = 'Saving…';
      JP.save(ctx.table, ctx.row, {}, [{ note: t, asked_by: who.value || null }]).then(function () {   // a note row carries no field (save_job)
        draft = null; return JP.reload();
      }, function (e) {
        var m = global.document.getElementById('noteMsg');
        if (m) m.textContent = e.message;
        if (!e.conflict) add.disabled = false;
      });
    };
    add.addEventListener('click', go);
    text.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  JP.log = { html: html, wire: wire };
})(window);
