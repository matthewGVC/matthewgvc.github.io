/* ============================================================
   JOB PAGE: the marketing-step track (spec §2.7, S12, D60, D74).

     GVC_JP.kit.html(ctx) / wire(host, ctx)

   One row per kit piece (GVC_KIT.track): the newest file found in the
   folder with its date and "n older", Asana's matching step with its tick,
   and the state. Live from Drive when it is connected here, else from last
   night's scan. Open shows the file from Drive (desktop); Copy Drive link
   asks the helper (POST /drive-link), else uses the scan's stored link,
   else copies the G: path. A piece with a file but no Asana step to match
   (brochure, open house flyer, signage) says so. Under the rows: the
   checklist-only steps (Advertising Spots, NYC's Just Listed Email).
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var STATE = {
    done: ['Done', 'made dot'], fileOpen: ['File, Asana open', 'stale'], tickedNoFile: ['Ticked, no file', 'stale'],
    notStarted: ['Not started', ''], notUsed: ['Not used here', ''], tracked: ['Tracked only', '']
  };
  var ICON = { floorplan: 'file', photos: 'photo', showsheet: 'file', brochure: 'file', openHouse: 'file', postcard: 'file', signage: 'file', video: 'file' };
  var NO_STEP = ['brochure', 'openHouse', 'signage'];
  var current = {};   // kit key → the newest current piece { path?, name, url? } of the last draw

  function ms(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }
  function newest(list) {
    return (list || []).filter(function (f) { return !f.archived; }).sort(function (a, b) { return ms(b.modified) - ms(a.modified); })[0] || null;
  }

  function rowsHtml(pieces, ctx, live) {
    var r = ctx.row, esc = ctx.esc, I = ctx.I, D = JP.drive;
    var t = global.GVC_KIT.track({ kind: r.kind, market: r.market, pieces: pieces, checklist: (r.asana || {}).checklist, match: r.match });
    current = {};
    var counted = t.rows.filter(function (x) { return x.state !== 'notUsed' && x.state !== 'tracked'; });
    var done = counted.filter(function (x) { return x.state === 'done'; }).length;
    var rows = t.rows.map(function (x) {
      var st = STATE[x.state] || [x.state, ''], cur = newest(pieces[x.key]);
      if (cur) current[x.key] = cur;
      var file = x.file ? esc(x.file.name) + (x.file.modified ? ' · ' + esc(D.day(x.file.modified)) : '') + (x.older ? ' · ' + x.older + ' older' : '')
        : x.older ? 'No current file · ' + x.older + ' older' : 'No file found';
      var step = x.step ? 'Asana: ' + esc(x.step.name) + (x.step.done ? ', ticked' + (x.step.doneOn ? ' ' + esc(D.day(x.step.doneOn)) : '') + (x.step.who ? ' by ' + esc(x.step.who) : '') : ', open')
        : x.file && NO_STEP.indexOf(x.key) !== -1 ? 'No Asana step for this piece' : '';
      var acts = '';
      if (cur) {
        if (live && cur.path) acts += '<button class="b sm ghost" type="button" data-open="' + esc(x.key) + '">Open</button>';
        else if (cur.url && /^https:\/\/drive\.google\.com\//.test(cur.url)) acts += '<a class="b sm ghost" href="' + esc(cur.url) + '" target="_blank" rel="noopener">Open</a>';
        acts += '<button class="b sm ghost" type="button" data-copy="' + esc(x.key) + '">' + I('copy') + 'Copy Drive link</button>';
      }
      var cls = x.state === 'notStarted' || x.state === 'notUsed' ? ' none' : (x.state === 'fileOpen' || x.state === 'tickedNoFile') ? ' stale' : '';
      return '<div class="kr' + cls + '" data-kit="' + esc(x.key) + '"><span class="ic">' + I(ICON[x.key] || 'file') + '</span><div>' +
        '<div class="t">' + esc(x.label) + ' <span class="chip ' + st[1] + '">' + esc(st[0]) + '</span></div>' +
        '<div class="d">' + file + '</div>' + (step ? '<div class="d" data-step>' + step + '</div>' : '') +
        (x.mismatch ? '<div class="d kmm"><span class="code">' + esc(x.mismatch.code) + '</span> ' + esc(x.mismatch.text) + '</div>' : '') +
        '</div><div class="a">' + acts + '</div></div>';
    }).join('');
    var only = t.checklistOnly.length ? '<div class="ck-block"><h3>Checklist only</h3><ul>' + t.checklistOnly.map(function (s) {
      return '<li class="' + (s.done ? 'done' : '') + '"><span class="bx">' + (s.done ? I('check') : '') + '</span>' + esc(s.name) + (s.doneOn ? '<span class="w">' + esc(D.day(s.doneOn)) + '</span>' : '') + '</li>';
    }).join('') + '</ul></div>' : '';
    return { html: '<div class="kit">' + rows + '</div>' + only, done: done, of: counted.length };
  }

  function html(ctx) {
    var m = JP.drive.mode(ctx), body;
    if (m === 'none') body = '<p class="soft">Link the job\'s Drive folder to see its files.</p>';
    else if (m === 'scan') {
      var x = rowsHtml((ctx.row.scan && ctx.row.scan.pieces) || {}, ctx, false);
      body = JP.drive.scanLine(ctx.row, ctx.esc) + x.html;
    } else body = '<p class="soft" data-reading>' + (m === 'checking' ? 'Checking Drive…' : 'Reading the folder…') + '</p>';
    return '<div class="card" id="kitCard"><div class="card-h"><div><h2>Marketing track</h2><p>Each piece: the newest file in the folder beside Asana\'s step.</p></div>' +
      '<span class="chip" id="kitCount"></span></div><div id="kitBody">' + body + '</div>' +
      '<p class="soft" id="kitMsg" role="status" style="font-size:13px;margin-top:8px">' + ctx.esc(JP.drive.msgs.kit || '') + '</p></div>';
  }

  function wire(host, ctx) {
    var r = ctx.row, msg = host.querySelector('#kitMsg'), body = host.querySelector('#kitBody');
    var say = function (t) { msg.textContent = t; JP.drive.msgs.kit = t; };
    var count = function (x) { var c = host.querySelector('#kitCount'); if (c) c.textContent = x.done + ' of ' + x.of + ' done'; };
    var hook = function () {
      body.querySelectorAll('[data-copy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cur = current[b.dataset.copy] || {};
          JP.drive.copyLink(r, cur.path || null, cur.url || null, msg).then(function () { JP.drive.msgs.kit = msg.textContent; });
        });
      });
      body.querySelectorAll('[data-open]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cur = current[b.dataset.open];
          if (!cur || !cur.path) return;
          var w = global.open('about:blank', '_blank');
          say('Opening ' + cur.name + '…');
          JP.drive.timed(global.GVC_DRIVE.readJobFile(r.drive_folder, cur.path, { timeoutMs: JP.drive.ms() })).then(function (f) {
            var u = global.URL.createObjectURL(f);
            if (w) w.location.href = u; else global.open(u, '_blank');
            say('');
          }, function (e) {
            if (w) w.close();
            say(e.timeout ? JP.drive.FAIL : e.message);
          });
        });
      });
    };
    if (JP.drive.mode(ctx) === 'scan') {
      count(rowsHtml((r.scan && r.scan.pieces) || {}, ctx, false));
      hook();
      return;
    }
    if (JP.drive.mode(ctx) !== 'live') return;
    JP.drive.folder(ctx).then(function (x) {
      var out = rowsHtml(x.health.pieces, ctx, true);
      body.innerHTML = out.html;
      count(out);
      hook();
    }, function (e) {
      body.innerHTML = '<p class="fmsg" role="alert">' + ctx.esc(e.timeout ? JP.drive.FAIL : e.message) + '</p>';
    });
  }

  JP.kit = { html: html, wire: wire };
})(window);
