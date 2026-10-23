/* ============================================================
   JOB PAGE: the Floorplans card (spec §2.8, S18, D22, D72).

     GVC_JP.floorplans.html(ctx) / wire(host, ctx)

   Versions down, renders across (branded · unbranded (MLS-safe) · blank
   sheet), from the floorplan files found in the folder (live, or last
   night's scan): the version from a v1\ v2\ folder or "v2" in the name, the
   render from the name. Versions recorded in the floorplans table show even
   before a file exists ("v3 recorded 21 Oct, no file yet"). Alternate
   layouts are listed when names say "alt", "alternate" or "option".

   Record new version (owner): note + who asked → a floorplans row (REST, as
   members may insert), then a change-log row through save_job.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var RENDERS = [['branded', 'Branded'], ['unbranded', 'Unbranded (MLS-safe)'], ['blank', 'Blank sheet']];
  var OUTPUT = /\.(pdf|png|jpe?g|webp|svg)$/i;
  var recording = null;   // { note, asked, msg } the open form, kept across a redraw
  var recorded = {};      // property id → rows of the floorplans table

  function ms(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }
  function versionOf(f) {
    var segs = String(f.path || f.name).split('/');
    for (var i = segs.length - 2; i >= 0; i--) { var m = /^v(\d+)$/i.exec(segs[i]); if (m) return +m[1]; }
    var n = /\bv(\d+)\b/i.exec(f.name);
    return n ? +n[1] : 0;
  }
  function renderOf(name) {
    if (/unbranded|\bmls\b/i.test(name)) return 'unbranded';
    if (/blank/i.test(name)) return 'blank';
    return 'branded';
  }

  /* files → { versions: { n: { branded: file, … , newest } }, alternates: [file] } */
  function group(files) {
    var out = { versions: {}, alternates: [] };
    (files || []).forEach(function (f) {
      if (!OUTPUT.test(f.name) || /(^|\/)source\//i.test(f.path || '')) return;
      if (/\b(alt|alternate|option)\b/i.test(f.name)) { out.alternates.push(f); return; }
      var v = versionOf(f), r = renderOf(f.name), slot = out.versions[v] = out.versions[v] || {};
      if (!slot[r] || ms(f.modified) > ms(slot[r].modified)) slot[r] = f;
      if (!slot.newest || ms(f.modified) > ms(slot.newest)) slot.newest = f.modified;
    });
    return out;
  }

  function matrix(files, ctx) {
    var esc = ctx.esc, D = JP.drive, g = group(files), rec = recorded[ctx.row.id] || [];
    var nums = Object.keys(g.versions).map(Number);
    rec.forEach(function (x) { if ((x.layout || 'current') === 'current' && nums.indexOf(+x.version) === -1) nums.push(+x.version); });
    nums.sort(function (a, b) { return b - a; });
    if (!nums.length) return '<p class="soft">No floorplan files found yet.</p>';
    var head = '<span class="h">Version</span>' + RENDERS.map(function (r) { return '<span class="h">' + esc(r[1]) + '</span>'; }).join('');
    var rows = nums.map(function (n, i) {
      var slot = g.versions[n], note = rec.filter(function (x) { return +x.version === n && (x.layout || 'current') === 'current'; })[0];
      var label = n ? 'v' + n : 'No version';
      var small = slot && slot.newest ? D.day(slot.newest) : '';
      if (!slot && note) small = 'recorded ' + D.day(note.created_at) + ', no file yet';
      else if (note) small += (small ? ' · ' : '') + 'recorded ' + D.day(note.created_at);
      if (note && (note.note || note.asked_by)) small += (note.note ? ' · ' + note.note : '') + (note.asked_by ? ' · asked by ' + note.asked_by : '');
      var cells = RENDERS.map(function (r) {
        var f = slot && slot[r[0]];
        return f ? '<div class="th" title="' + esc(f.name) + '"><span class="tg">' + esc(f.modified ? D.day(f.modified) : 'found') + '</span><span class="tn">' + esc(f.name) + '</span></div>'
          : '<div class="th empty">Not made</div>';
      }).join('');
      return '<div class="ver' + (i ? ' old' : '') + '" data-ver="' + n + '">' + esc(label) + (i ? '' : ' · current') + '<small>' + esc(small) + '</small></div>' + cells;
    }).join('');
    var alts = g.alternates.length ? '<p class="fpalt"><b>Alternate layouts:</b> ' + g.alternates.map(function (f) { return esc(f.name); }).join(', ') + '</p>' : '';
    return '<div class="fpm">' + head + rows + '</div>' + alts;
  }

  function nextVersion(files, ctx) {
    var top = 0;
    (files || []).forEach(function (f) { top = Math.max(top, versionOf(f)); });
    (recorded[ctx.row.id] || []).forEach(function (x) { top = Math.max(top, +x.version || 0); });
    return top + 1;
  }

  function formHtml(ctx) {
    var esc = ctx.esc, d = recording;
    var opts = ['<option value="">Who asked</option>', '<option value="Matt"' + (d.asked === 'Matt' ? ' selected' : '') + '>Matt</option>']
      .concat((global.GVC_ROSTER || []).map(function (a) { return '<option value="' + esc(a.name) + '"' + (d.asked === a.name ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }));
    return '<div class="fpform"><input class="inp" id="fpNote" placeholder="What changed in this version" aria-label="What changed in this version" value="' + esc(d.note) + '">' +
      '<select class="inp" id="fpWho" aria-label="Who asked">' + opts.join('') + '</select>' +
      '<div class="fbtn"><button class="b primary sm" type="button" id="fpSave">Record</button><button class="b sm" type="button" id="fpCancel">Cancel</button></div>' +
      '<p class="fmsg" id="fpMsg" role="alert">' + esc(d.msg || '') + '</p></div>';
  }

  function html(ctx) {
    var m = JP.drive.mode(ctx), body;
    if (m === 'scan') body = JP.drive.scanLine(ctx.row, ctx.esc) + matrix(((ctx.row.scan || {}).pieces || {}).floorplan || [], ctx);
    else if (m === 'none') body = matrix([], ctx);
    else body = '<p class="soft" data-reading>' + (m === 'checking' ? 'Checking Drive…' : 'Reading the folder…') + '</p>';
    var acts = ctx.canEdit ? (recording ? formHtml(ctx) : '<div class="fbtn"><button class="b sm" type="button" id="fpNew">Record new version</button>' +
      '<span class="soft" style="font-size:13px;align-self:center">When an agent asks for a change. Nothing is drawn here.</span></div>') : '';
    return '<div class="card" id="fpCard"><div class="card-h"><div><h2>Floorplans</h2></div></div>' +
      '<div id="fpBody">' + body + '</div>' + acts + '</div>';
  }

  function wire(host, ctx) {
    var r = ctx.row, P = global.GVC_PROPS, files = null;
    var redraw = function () { host.innerHTML = html(ctx); wire(host, ctx); };
    var paint = function () {
      var b = host.querySelector('#fpBody'), m = JP.drive.mode(ctx);
      if (!b) return;
      if (m === 'live' && files === null) return;   // still reading
      var list = m === 'live' ? files : m === 'scan' ? (((r.scan || {}).pieces || {}).floorplan || []) : [];
      b.innerHTML = (m === 'scan' ? JP.drive.scanLine(r, ctx.esc) : '') + matrix(list, ctx);
    };
    if (!recorded[r.id]) {
      recorded[r.id] = [];
      P.call('/rest/v1/floorplans?property_id=eq.' + encodeURIComponent(r.id) + '&select=*&order=version.desc').then(function (rows) {
        recorded[r.id] = rows || []; paint();
      }, function () { delete recorded[r.id]; });
    }
    if (JP.drive.mode(ctx) === 'live') {
      JP.drive.folder(ctx).then(function (x) { files = x.health.pieces.floorplan; paint(); }, function (e) {
        var b = host.querySelector('#fpBody');
        if (b) b.innerHTML = '<p class="fmsg" role="alert">' + ctx.esc(e.timeout ? JP.drive.FAIL : e.message) + '</p>';
      });
    }
    var nb = host.querySelector('#fpNew');
    if (nb) nb.addEventListener('click', function () { recording = { note: '', asked: '', msg: '' }; redraw(); });
    var save = host.querySelector('#fpSave');
    if (!save || !recording) return;
    var note = host.querySelector('#fpNote'), who = host.querySelector('#fpWho'), msg = host.querySelector('#fpMsg');
    var keep = function () { recording.note = note.value; recording.asked = who.value; };
    note.addEventListener('input', keep); who.addEventListener('change', keep);
    host.querySelector('#fpCancel').addEventListener('click', function () { recording = null; redraw(); });
    save.addEventListener('click', function () {
      keep();
      var text = recording.note.trim();
      if (!text) { msg.textContent = 'Say what changed in this version.'; return; }
      var live = JP.drive.mode(ctx) === 'live';
      var known = live ? (files || []) : (((r.scan || {}).pieces || {}).floorplan || []);
      var version = nextVersion(known, ctx), asked = recording.asked || null;
      host.querySelectorAll('.fpform button').forEach(function (b) { b.disabled = true; });
      msg.textContent = 'Saving…';
      P.call('/rest/v1/floorplans', { method: 'POST', prefer: 'return=representation',
        body: JSON.stringify({ property_id: r.id, version: version, layout: 'current', note: text, asked_by: asked }) }).then(function () {
        delete recorded[r.id];
        return JP.save('properties', r, {}, [{ field: 'floorplan', new_value: { version: version, note: text }, asked_by: asked }]).then(function () {
          recording = null; return JP.reload();
        }, function (e) {
          recording = null;
          return JP.reload().then(function () { if (global.document.getElementById('actMsg')) global.document.getElementById('actMsg').textContent = 'v' + version + ' recorded, but the change log didn\'t save (' + e.message + ').'; });
        });
      }, function (e) {
        recording.msg = /duplicate|23505|409/.test(String(e.message)) ? 'v' + version + ' is already recorded. Reload the page and try again.' : e.message;
        var m = global.document.getElementById('fpMsg'); if (m) m.textContent = recording.msg;
        host.querySelectorAll('.fpform button').forEach(function (b) { b.disabled = false; });
      });
    });
  }

  JP.floorplans = { html: html, wire: wire, group: group };
})(window);
