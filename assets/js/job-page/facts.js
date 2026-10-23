/* ============================================================
   JOB PAGE: the Facts card (spec §2.2, S1 to S3, D78).

     GVC_JP.facts.html(ctx)       → the card's HTML
     GVC_JP.facts.wire(host, ctx) → its clicks
       ctx = { kind, table, row, job, canEdit, W, I, esc }

   Each fact: its value, its source badge, the other sources' different
   values on a quiet line, and the warning sign while Matt's value differs
   from DE's (else Asana's). The owner clicks a value to edit it inline:
   Save keeps it as Matt's (GVC_FACTS.applyFact), Clear drops Matt's value
   (the next source shows), empty text means Clear. "Typo, no rebuild"
   marks the change-log row. What was typed survives a conflict reload.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var F = function () { return global.GVC_FACTS; };
  var open = null;   // { name, text, typo, msg } the field being edited, kept across a reload

  function words(kind, v, W) {
    if (v === null || v === undefined || v === '') return '';
    if (kind === 'money') return W.money(v);
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  }
  function asText(kind, v) {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.join('\n');
    return String(v);
  }

  function row(f, ctx) {
    var W = ctx.W, esc = ctx.esc, I = ctx.I, rec = ((ctx.row.core || {}).facts || {})[f.name];
    var editing = open && open.name === f.name;
    var v = words(f.kind, f.value, W);
    var shown = v ? '<span class="fv">' + esc(v) + '</span>' : '<span class="soft">Not set</span>';
    var badge = f.badge ? ' <span class="chip de" data-src="' + esc(f.source) + '">' + esc(f.badge) + '</span>' : '';
    var lines = '';
    if (f.warn) lines += '<div class="fw" role="note">' + I('alert') + esc(f.warn.source + ' says ' + words(f.kind, f.warn.value, W)) + '</div>';
    f.others.forEach(function (o) {
      if (f.warn && o.source === f.warn.source) return;
      lines += '<div class="fo">' + esc(o.badge + ' says ' + words(f.kind, o.value, W)) + '</div>';
    });
    var cell = ctx.canEdit && !editing
      ? '<button class="fe" type="button" data-edit="' + esc(f.name) + '" aria-label="Edit ' + esc(f.label) + '">' + shown + '</button>' + badge
      : shown + badge;
    var ed = '';
    if (editing) {
      var big = f.kind === 'list' || f.kind === 'long';
      var hint = f.kind === 'list' ? 'One item per line.' : f.kind === 'money' ? 'Like 2250000 or $2.25M.' : f.kind === 'baths' ? 'End in .5 for a half bath, like 3.5.' : '';
      var deHas = rec && rec.bySource && rec.bySource.DE != null && rec.bySource.DE !== '' && !F().deBlank(f.name, rec.bySource.DE);
      ed = '<div class="fed" data-for="' + esc(f.name) + '">' +
        (big ? '<textarea class="inp" id="fIn" rows="' + (f.kind === 'long' ? 5 : 4) + '" aria-label="' + esc(f.label) + '">' + esc(open.text) + '</textarea>'
             : '<input class="inp" id="fIn" aria-label="' + esc(f.label) + '" value="' + esc(open.text) + '">') +
        (hint ? '<div class="fo">' + esc(hint) + '</div>' : '') +
        (deHas ? '<div class="fo">DE has this. Yours holds until DE\'s own value changes, with a warning meanwhile.</div>' : '') +
        '<label class="ftypo"><input type="checkbox" id="fTypo"' + (open.typo ? ' checked' : '') + '> Typo, no rebuild</label>' +
        '<div class="fbtn"><button class="b primary sm" type="button" id="fSave">Save</button><button class="b sm" type="button" id="fCancel">Cancel</button>' +
        (f.source === 'Matt' ? '<button class="b sm" type="button" id="fClear">Clear</button>' : '') + '</div>' +
        '<p class="fmsg" id="fMsg" role="alert">' + esc(open.msg || '') + '</p></div>';
    }
    return '<tr data-fact="' + esc(f.name) + '"><th>' + esc(f.label) + '</th><td>' + cell + lines + ed + '</td></tr>';
  }

  function html(ctx) {
    var list = F().shown(ctx.row.core || {}, ctx.row);
    var core = list.filter(function (f) { return f.tier === 'core'; }), extra = list.filter(function (f) { return f.tier !== 'core'; });
    var filled = extra.filter(function (f) { return f.value !== null && f.value !== undefined && f.value !== ''; }).length;
    var extraOpen = open && extra.some(function (f) { return f.name === open.name; });
    return '<div class="card" id="factsCard"><div class="card-h"><div><h2>Facts</h2></div></div>' +
      '<table class="ft"><tbody>' + core.map(function (f) { return row(f, ctx); }).join('') + '</tbody></table>' +
      '<details class="fx"' + (extraOpen ? ' open' : '') + '><summary>Extras · ' + filled + ' filled</summary><table class="ft"><tbody>' +
      extra.map(function (f) { return row(f, ctx); }).join('') + '</tbody></table></details></div>';
  }

  /* the new core with Matt's value for one field (and half baths when the baths text gave one) */
  function withValue(core, name, value) {
    var facts = F().adoptEdit(core.facts || {}, name, core[name]);
    facts = F().applyFact(facts, name, 'Matt', value).facts;
    core.facts = facts;
    core[name] = facts[name].value;
  }

  function wire(host, ctx) {
    var r = ctx.row, table = ctx.table, all = F().shown(r.core || {}, r);
    var byName = {}; all.forEach(function (f) { byName[f.name] = f; });
    var rerender = function () { host.innerHTML = html(ctx); wire(host, ctx); };
    host.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = byName[b.dataset.edit];
        open = { name: f.name, text: asText(f.kind, f.value), typo: false, msg: '' };
        rerender();
        var inp = host.querySelector('#fIn'); if (inp) inp.focus();
      });
    });
    if (!open || !byName[open.name] || !host.querySelector('#fIn')) return;
    var f = byName[open.name], inp = host.querySelector('#fIn'), msg = host.querySelector('#fMsg'), typo = host.querySelector('#fTypo');
    var keep = function () { open.text = inp.value; open.typo = typo.checked; };
    inp.addEventListener('input', keep); typo.addEventListener('change', keep);
    var busy = function (on) { host.querySelectorAll('.fed button').forEach(function (b) { b.disabled = on; }); };
    var fail = function (e) {
      keep();
      open.msg = e.message;
      // a conflict has already reloaded and redrawn the card, with the typed value still open
      var m = e.conflict ? global.document.getElementById('fMsg') : msg;
      if (m) m.textContent = e.message;
      if (!e.conflict) busy(false);
    };
    var send = function (core, changes) {
      busy(true); msg.textContent = 'Saving…';
      return JP.save(table, r, { core: core }, changes).then(function () { open = null; return JP.reload(); }, fail);
    };
    var doClear = function () {
      var core = JP.clone(r.core || {}), before = core[f.name];
      core.facts = F().clear(core.facts || {}, f.name);
      var rec = core.facts[f.name];
      if (rec) core[f.name] = rec.value; else delete core[f.name];
      send(core, [{ field: f.name, old_value: before === undefined ? null : before, new_value: rec ? rec.value : null,
        note: rec ? 'Cleared; back to ' + (F().BADGE[rec.source] || rec.source) + '\'s value.' : 'Cleared.', no_rebuild: typo.checked }]);
    };
    host.querySelector('#fCancel').addEventListener('click', function () { open = null; rerender(); });
    if (host.querySelector('#fClear')) host.querySelector('#fClear').addEventListener('click', doClear);
    host.querySelector('#fSave').addEventListener('click', function () {
      keep();
      var p = F().parseValue(f.kind, inp.value);
      if (!p.ok) { msg.textContent = p.error; return; }
      if (p.value === null) {
        if (f.source === 'Matt') return doClear();
        msg.textContent = 'Type a value, or Cancel.'; return;
      }
      var core = JP.clone(r.core || {}), changes = [], tick = typo.checked;
      var put = function (name, value) {
        var before = core[name] === undefined ? null : core[name];
        if (JSON.stringify(before) === JSON.stringify(value) && ((core.facts || {})[name] || {}).source === 'Matt') return;
        withValue(core, name, value);
        changes.push({ field: name, old_value: before, new_value: value, no_rebuild: tick });
      };
      put(f.name, p.value);
      if (f.kind === 'baths' && p.halfBaths != null) put('halfBaths', p.halfBaths);
      if (!changes.length) { msg.textContent = 'That is already the value.'; return; }
      send(core, changes);
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { open = null; rerender(); }
      if (e.key === 'Enter' && inp.tagName === 'INPUT') host.querySelector('#fSave').click();
    });
  }

  JP.facts = { html: html, wire: wire, words: words };
})(window);
