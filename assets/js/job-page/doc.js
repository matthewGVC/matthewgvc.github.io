/* ============================================================
   JOB PAGE: the details doc (spec S11, D43).

     GVC_JP.doc.html(ctx) / wire(host, ctx)

   The job's details .docx (the newest top-level .docx with "details" in its
   name, GVC_DOC.pick) is read with the Showsheet's own reader (mammoth, then
   GVC_LISTING.blocksFromHtml and read, then GVC_DOC.toFacts). On the
   desktop with Drive connected it is read when the page opens, only if the
   file changed since the last read (name, size, date: GVC_DOC.changed), and
   at most once per page visit; Read details doc reads it again regardless.
   Its values come in at source 'doc' (GVC_FACTS.applyFact), so they only
   fill gaps under DE, Matt and Asana. One save_job call writes core, the
   details_doc record { file, size, modified, readAt, found } and a change
   row for each fact whose shown value moved. Owner only (D87).
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var NO_READER = 'The Word reader didn\'t load. Check the internet connection, then try Read details doc again.';
  var tried = {};      // file signature → true once read on open this visit
  var busy = false;
  var said = '';       // the last result, kept across a redraw

  function sig(row, f) { return row.id + '|' + f.name + '|' + f.size + '|' + f.modified; }

  function mammoth() {
    if (global.mammoth) return Promise.resolve(global.mammoth);
    var s = global.document.getElementById('mammothJs');
    if (!s || s.dataset.failed) return Promise.reject(new Error(NO_READER));
    return new Promise(function (res, rej) {
      s.addEventListener('load', function () { if (global.mammoth) res(global.mammoth); else rej(new Error(NO_READER)); });
      s.addEventListener('error', function () { rej(new Error(NO_READER)); });
    });
  }

  function fileOf(tree) {
    var tops = (tree.children || []).filter(function (c) { return c.kind === 'file'; });
    return global.GVC_DOC.pick(tops);
  }

  /* read the doc and save what it says; resolves to a plain sentence */
  function read(ctx, file) {
    var r = ctx.row, F = global.GVC_FACTS;
    var own = { 'Co-op': 'co-op', Condo: 'condo' }[(r.core || {}).propertyType] || '';
    return JP.drive.timed(global.GVC_DRIVE.readJobFile(r.drive_folder, file.name, { timeoutMs: JP.drive.ms() }).then(function (f) { return f.arrayBuffer(); }))
      .then(function (buf) {
        return mammoth().then(function (m) { return m.convertToHtml({ arrayBuffer: buf }); });
      }).then(function (out) {
        var L = global.GVC_LISTING, found = global.GVC_DOC.toFacts(L.read(L.blocksFromHtml(out.value || ''), own));
        var core = JP.clone(r.core || {}), facts = core.facts || {}, changes = [];
        Object.keys(found).forEach(function (name) {
          var before = core[name] === undefined ? null : core[name];
          facts = F.adoptEdit(facts, name, core[name]);
          var res = F.applyFact(facts, name, 'doc', found[name]);
          facts = res.facts;
          if (!res.changed) return;
          core[name] = facts[name].value;
          // a log line only when the value shown moved (not when only its source did)
          if (JSON.stringify(before) !== JSON.stringify(core[name])) changes.push({ field: name, old_value: before, new_value: core[name], note: 'From the details doc.' });
        });
        core.facts = facts;
        var rec = { file: file.name, size: file.size == null ? null : file.size, modified: file.modified || null, readAt: new Date().toISOString(), found: Object.keys(found) };
        return JP.save('properties', r, { core: core, details_doc: rec }, changes).then(function () {
          var n = Object.keys(found).length;
          return 'Read ' + file.name + ': ' + n + ' fact' + (n === 1 ? '' : 's') + ' found, ' + changes.length + ' shown from it.';
        });
      });
  }

  function recLine(ctx) {
    var d = ctx.row.details_doc;
    if (!d || !d.file) return 'Not read yet.';
    var n = (d.found || []).length;
    return 'Last read ' + JP.drive.day(d.readAt) + ' from ' + d.file + ' (' + n + ' fact' + (n === 1 ? '' : 's') + ' found).';
  }

  function html(ctx) {
    var m = JP.drive.mode(ctx), esc = ctx.esc;
    var body = '<p class="docl" id="docRec">' + esc(recLine(ctx)) + '</p>';
    if (m === 'live') body += '<p class="soft" id="docNow" data-reading>Looking for the details doc…</p>';
    else if (m === 'scan') body += JP.drive.scanLine(ctx.row, esc) + (ctx.row.scan && ctx.row.scan.detailsDoc ? '<p class="soft" style="font-size:13px">The scan found ' + esc(ctx.row.scan.detailsDoc.name || 'a details doc') + '.</p>' : '');
    var btn = ctx.canEdit && m === 'live' ? '<div class="fbtn"><button class="b sm" type="button" id="docRead" disabled>Read details doc</button></div>' : '';
    return '<div class="card" id="docCard"><div class="card-h"><div><h2>Details doc</h2><p>Its values fill gaps under DE, yours and Asana\'s.</p></div></div>' + body + btn +
      '<p class="soft" id="docMsg" role="status" style="font-size:13px;margin-top:8px">' + esc(said) + '</p></div>';
  }

  function wire(host, ctx) {
    if (JP.drive.mode(ctx) !== 'live') return;
    var r = ctx.row, msg = host.querySelector('#docMsg'), now = host.querySelector('#docNow'), btn = host.querySelector('#docRead');
    var say = function (t) { said = t; var m = global.document.getElementById('docMsg'); if (m) m.textContent = t; };
    var go = function (file) {
      if (busy) return;
      busy = true;
      if (btn) btn.disabled = true;
      say('Reading ' + file.name + '…');
      read(ctx, file).then(function (t) { busy = false; said = t; return JP.reload(); }, function (e) {
        busy = false;
        say(e.timeout ? JP.drive.FAIL : e.message);
        var b = global.document.getElementById('docRead');
        if (b && !e.conflict) b.disabled = false;
      });
    };
    JP.drive.folder(ctx).then(function (x) {
      var file = fileOf(x.tree);
      if (!file) { if (now) now.textContent = 'There is no details doc at the top of the folder.'; return; }
      var prev = r.details_doc ? { name: r.details_doc.file, size: r.details_doc.size, modified: r.details_doc.modified } : null;
      var isNew = global.GVC_DOC.changed(prev, file);
      if (now) now.textContent = 'In the folder: ' + file.name + (isNew ? ' (changed since the last read).' : ' (unchanged since the last read).');
      if (btn) { btn.disabled = busy; btn.addEventListener('click', function () { go(file); }); }
      if (isNew && ctx.canEdit && !tried[sig(r, file)]) { tried[sig(r, file)] = true; go(file); }
    }, function (e) {
      if (now) now.textContent = e.timeout ? JP.drive.FAIL : e.message;
    });
    if (msg && said) msg.textContent = said;
  }

  JP.doc = { html: html, wire: wire };
})(window);
