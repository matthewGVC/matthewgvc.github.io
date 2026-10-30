/* ============================================================
   JOB PAGE: the Floorplans card (spec §2.8, S18, D22, D72).

     GVC_JP.floorplans.html(ctx) / wire(host, ctx)

   Versions down, renders across (branded · unbranded (MLS-safe) · blank
   sheet), from the floorplan files found in the folder (live, or last
   night's scan): the version from a v1\ v2\ folder or "v2" in the name, the
   render from the name. Versions recorded in the floorplans table show even
   before a file exists ("v3 recorded 21 Oct, no file yet"). Alternate
   layouts are listed when names say "alt", "alternate" or "option".
   The floorplan process's folders: Floorplan/Branded/ fills the Branded
   column and Floorplan/Unbranded/ the Unbranded one, one entry per version
   (the .svg before the .png); Floorplan/Design/ is never a plan
   (GVC_SHEETJOB.planPlace).

   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var RENDERS = [['branded', 'Branded'], ['unbranded', 'Unbranded (MLS-safe)'], ['blank', 'Blank sheet']];
  var OUTPUT = /\.(pdf|png|jpe?g|webp|svg)$/i;
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
  function placeOf(f) { return global.GVC_SHEETJOB.planPlace(f.path || ''); }
  function svg(f) { return /\.svg$/i.test(f.name) ? 1 : 0; }
  /* the file a cell shows: in Branded/ or Unbranded/ the .svg first, else the newest */
  function better(f, cur) {
    if (placeOf(f) && placeOf(cur) && svg(f) !== svg(cur)) return svg(f) > svg(cur);
    return ms(f.modified) > ms(cur.modified);
  }

  /* files → { versions: { n: { branded: file, … , newest } }, alternates: [file] } */
  function group(files) {
    var out = { versions: {}, alternates: [] };
    (files || []).forEach(function (f) {
      var place = placeOf(f);
      if (!OUTPUT.test(f.name) || /(^|\/)source\//i.test(f.path || '') || place === 'design') return;
      if (/\b(alt|alternate|option)\b/i.test(f.name)) { out.alternates.push(f); return; }
      var v = versionOf(f), r = place || renderOf(f.name), slot = out.versions[v] = out.versions[v] || {};
      if (!slot[r] || better(f, slot[r])) slot[r] = f;
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

  function html(ctx) {
    var m = JP.drive.mode(ctx), body;
    if (m === 'scan') body = matrix(((ctx.row.scan || {}).pieces || {}).floorplan || [], ctx);
    else if (m === 'none') body = matrix([], ctx);
    else body = '<p class="soft" data-reading>' + (m === 'checking' ? 'Checking Drive…' : 'Reading the folder…') + '</p>';
    return '<div class="card" id="fpCard"><div class="card-h"><div><h2>Floorplans</h2></div></div>' +
      '<div id="fpBody">' + body + '</div>' +
      '<div class="fbtn" style="margin-top:14px"><button class="b primary sm" type="button" id="fpMake">Make Floorplan</button></div>' +
      '<div id="fpPrompt" aria-live="polite"></div></div>';
  }

  function wire(host, ctx) {
    var r = ctx.row, P = global.GVC_PROPS, files = null;
    var redraw = function () { host.innerHTML = html(ctx); wire(host, ctx); };
    var paint = function () {
      var b = host.querySelector('#fpBody'), m = JP.drive.mode(ctx);
      if (!b) return;
      if (m === 'live' && files === null) return;   // still reading
      var list = m === 'live' ? files : m === 'scan' ? (((r.scan || {}).pieces || {}).floorplan || []) : [];
      b.innerHTML = matrix(list, ctx);
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
    var mk = host.querySelector('#fpMake');
    if (mk) mk.addEventListener('click', function () {
      var box = host.querySelector('#fpPrompt'), esc = ctx.esc;
      var live = JP.drive.mode(ctx) === 'live';
      if (live && files === null) { box.innerHTML = '<p class="soft">Reading the folder…</p>'; return; }
      var known = live ? files : (((r.scan || {}).pieces || {}).floorplan || []);
      var res = global.GVC_FPPROMPT.build(r, known, recorded[r.id] || []);
      if (!res.ok) { box.innerHTML = '<p class="fmsg" id="fpReason" role="alert">' + esc(res.reason) + '</p>'; return; }
      box.innerHTML = '<textarea class="inp" id="fpText" readonly rows="11" style="width:100%;margin-top:10px" aria-label="Floorplan prompt">' + esc(res.text) + '</textarea>' +
        '<div class="fbtn"><button class="b sm" type="button" id="fpCopy">Copy prompt</button></div>';
      var cb = box.querySelector('#fpCopy');
      cb.addEventListener('click', function () {
        var done = function () { cb.textContent = 'Copied'; };
        try { global.navigator.clipboard.writeText(res.text).then(done, function () { box.querySelector('#fpText').select(); }); }
        catch (e) { box.querySelector('#fpText').select(); }
      });
    });
  }

  JP.floorplans = { html: html, wire: wire, group: group };
})(window);
