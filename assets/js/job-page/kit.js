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
   The Showsheet row also carries its record (Slice 4, S21): Not made yet /
   Up to date / Stale: price, agents / Made before the workspace kept track,
   "Made 22 Oct · A5 · Open · Copy Drive link", and Make showsheet, Open sheet
   or Rebuild. ctx.doc is the showsheet's documents row; ctx.onSheet(result)
   hears each judgement (the page's Rebuild n stale button).
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
  /* what Open may show as a blob: types that never run script (no svg, no html) */
  var SAFE_EXT = /\.(pdf|jpe?g|png|webp|gif|mp4|mov|m4v|webm)$/i;
  var SAFE_TYPE = /^(application\/pdf|image\/(jpeg|png|webp|gif)|video\/[a-z0-9.+-]+)$/i;
  var TYPE_OF = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm' };
  function keyOf(cur) { for (var k in current) if (current[k] === cur) return k; return null; }

  function ms(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }
  function newest(list) {
    return global.GVC_KIT.realFiles(list).filter(function (f) { return !f.archived; }).sort(function (a, b) { return ms(b.modified) - ms(a.modified); })[0] || null;
  }

  /* ---------- the Showsheet's record (Slice 4: S15, S20, S21) ----------
     judge(ctx, pieces, live) → GVC_STALE's { state, changes } for the showsheet, or null
     (not a listing, or the check isn't loaded). Live from Drive the photo and floorplan
     dates count too (the same picks the sheet makes); from the scan they're unknown. */
  var IMG = /\.(jpe?g|png|webp)$/i;
  var DRIVE_LINK = /^https:\/\/drive\.google\.com\//;
  function judge(ctx, pieces, live) {
    var ST = global.GVC_STALE;
    if (!ST || ctx.kind !== 'listing') return null;
    pieces = pieces || {};
    var opts = { fileFound: !!newest(pieces.showsheet) };
    if (live) {
      var R = global.GVC_DRIVE_RULES;
      var ok = function (f) { return !f.archived && f.path && R.allowedInJob(f.path) && !R.isJunk(f.name); };
      var photos = (pieces.photos || []).filter(ok).filter(function (f) { return IMG.test(f.name); }), plans = (pieces.floorplan || []).filter(ok);
      opts.files = {};
      photos.concat(plans).forEach(function (f) { opts.files[f.path] = { modified: f.modified }; });
      opts.editedPaths = photos.map(function (f) { return f.path; });
      opts.floorplan = global.GVC_SHEETJOB.pickFloorplan(plans);
    }
    return ST.stale(ctx.doc || null, ctx.row, opts);
  }
  function sheetHref(ctx, rebuild) {
    return '../../tools/showsheet/?listing=' + encodeURIComponent(ctx.row.slug) + (rebuild ? '&rebuild=1' : '');
  }
  /* the lines under the Showsheet row and its one way into the sheet; a teammate opens it
     read-only, never Make or Rebuild; a phone shows the state only (CSS hides [data-sheet]) */
  function sheetBits(ctx, s) {
    var esc = ctx.esc, out = (ctx.doc && ctx.doc.output) || null;
    var word = { none: ['Not made yet', ''], untracked: ['Made before the workspace kept track', ''], fresh: ['Up to date', 'made'],
      stale: ['Stale: ' + global.GVC_STALE.words(s.changes), 'stale'] }[s.state] || [s.state, ''];
    var lines = '<div class="d"><span class="chip ' + word[1] + '" data-sheet-state>' + esc(word[0]) + '</span></div>';
    if (out && (s.state === 'fresh' || s.state === 'stale')) {
      var when = JP.drive.day(out.madeAt || ctx.doc.built_at);
      var made = ['Made' + (when ? ' ' + esc(when) : '')];
      if (out.paper) made.push(esc(String(out.paper).toUpperCase()));
      if (out.via === 'print') made.push('printed by hand, file not tracked');
      else if (DRIVE_LINK.test(String(out.url || ''))) {
        made.push('<a class="link" href="' + esc(out.url) + '" target="_blank" rel="noopener">Open</a>', '<button class="link" type="button" data-sheet-copy>Copy Drive link</button>');
      }
      lines += '<div class="d" data-sheet-made>' + made.join(' · ') + '</div>';
    }
    var act = !ctx.canEdit || s.state === 'fresh' || s.state === 'untracked' ? ['Open sheet', false, 'ghost']
      : s.state === 'stale' ? ['Rebuild', true, 'primary'] : ['Make showsheet', false, 'primary'];
    return { lines: lines, act: '<a class="b sm ' + act[2] + '" data-sheet href="' + esc(sheetHref(ctx, act[1])) + '">' + esc(act[0]) + '</a>' };
  }
  /* the Showsheet row by itself, when the folder can't be listed (no folder linked) */
  function sheetOnly(ctx) {
    var s = judge(ctx, (ctx.row.scan && ctx.row.scan.pieces) || {}, false);
    if (!s) return '';
    var b = sheetBits(ctx, s);
    return '<div class="kit"><div class="kr" data-kit="showsheet"><span class="ic">' + ctx.I('file') + '</span><div><div class="t">Showsheet</div>' + b.lines +
      '</div><div class="a">' + b.act + '</div></div></div>';
  }

  function rowsHtml(pieces, ctx, live) {
    var r = ctx.row, esc = ctx.esc, I = ctx.I, D = JP.drive;
    var t = global.GVC_KIT.track({ kind: r.kind, market: r.market, pieces: pieces, checklist: (r.asana || {}).checklist, match: r.match });
    current = {};
    var sheet = judge(ctx, pieces, live);
    var counted = t.rows.filter(function (x) { return x.state !== 'notUsed' && x.state !== 'tracked'; });
    var done = counted.filter(function (x) { return x.state === 'done'; }).length;
    var rows = t.rows.map(function (x) {
      var st = STATE[x.state] || [x.state, ''], cur = newest(pieces[x.key]);
      if (cur) current[x.key] = cur;
      var file = x.file ? esc(x.file.name) + (x.file.modified ? ' · ' + esc(D.day(x.file.modified)) : '') + (x.older ? ' · ' + x.older + ' older' : '')
        : x.older ? 'No current file · ' + x.older + ' older' : 'No file found';
      var step = x.step ? 'Asana: ' + esc(x.step.name) + (x.step.done ? ', ticked' + (x.step.doneOn ? ' ' + esc(D.day(x.step.doneOn)) : '') + (x.step.who ? ' by ' + esc(x.step.who) : '') : ', open')
        : x.file && NO_STEP.indexOf(x.key) !== -1 ? 'No Asana step for this piece' : '';
      var acts = '', bits = x.key === 'showsheet' && sheet ? sheetBits(ctx, sheet) : null;
      if (cur) {
        if (live && cur.path) acts += '<button class="b sm ghost" type="button" data-open="' + esc(x.key) + '">Open</button>';
        else if (cur.url && /^https:\/\/drive\.google\.com\//.test(cur.url)) acts += '<a class="b sm ghost" href="' + esc(cur.url) + '" target="_blank" rel="noopener">Open</a>';
        acts += '<button class="b sm ghost" type="button" data-copy="' + esc(x.key) + '">' + I('copy') + 'Copy Drive link</button>';
      }
      if (bits) acts += bits.act;
      var cls = x.state === 'notStarted' || x.state === 'notUsed' ? ' none' : (x.state === 'fileOpen' || x.state === 'tickedNoFile') ? ' stale' : '';
      return '<div class="kr' + cls + '" data-kit="' + esc(x.key) + '"><span class="ic">' + I(ICON[x.key] || 'file') + '</span><div>' +
        '<div class="t">' + esc(x.label) + ' <span class="chip ' + st[1] + '">' + esc(st[0]) + '</span></div>' +
        '<div class="d">' + file + '</div>' + (step ? '<div class="d" data-step>' + step + '</div>' : '') +
        (x.mismatch ? '<div class="d kmm"><span class="code">' + esc(x.mismatch.code) + '</span> ' + esc(x.mismatch.text) + '</div>' : '') + (bits ? bits.lines : '') +
        '</div><div class="a">' + acts + '</div></div>';
    }).join('');
    var only = t.checklistOnly.length ? '<div class="ck-block"><h3>Checklist only</h3><ul>' + t.checklistOnly.map(function (s) {
      return '<li class="' + (s.done ? 'done' : '') + '"><span class="bx">' + (s.done ? I('check') : '') + '</span>' + esc(s.name) + (s.doneOn ? '<span class="w">' + esc(D.day(s.doneOn)) + '</span>' : '') + '</li>';
    }).join('') + '</ul></div>' : '';
    return { html: '<div class="kit">' + rows + '</div>' + only, done: done, of: counted.length, sheet: sheet };
  }

  function html(ctx) {
    var m = JP.drive.mode(ctx), body;
    if (m === 'none') body = '<p class="soft">Link the job\'s Drive folder to see its files.</p>' + sheetOnly(ctx);
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
    /* not a type that opens inline: the stored Drive link, else File Explorer */
    var elsewhere = function (cur) {
      var stored = cur.url && /^https:\/\/drive\.google\.com\//.test(cur.url) ? cur.url : null;
      if (!stored) {
        var same = ((((r.scan || {}).pieces || {})[keyOf(cur)]) || []).filter(function (x) { return x.name === cur.name; })[0];
        if (same && /^https:\/\/drive\.google\.com\//.test(same.url || '')) stored = same.url;
      }
      if (stored) { global.open(stored, '_blank', 'noopener'); say(''); }
      else say('Open it from the folder in File Explorer.');
    };
    var hook = function () {
      body.querySelectorAll('[data-copy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cur = current[b.dataset.copy] || {};
          JP.drive.copyLink(r, cur.path || null, cur.url || null, msg).then(function () { JP.drive.msgs.kit = msg.textContent; });
        });
      });
      body.querySelectorAll('[data-sheet-copy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var url = ((ctx.doc || {}).output || {}).url;
          if (!DRIVE_LINK.test(String(url || ''))) return;
          (global.navigator.clipboard ? global.navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard')))
            .then(function () { say('Drive link copied.'); }, function () { say(url); });
        });
      });
      body.querySelectorAll('[data-open]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cur = current[b.dataset.open];
          if (!cur || !cur.path) return;
          // a blob: URL runs with this site's origin, so only types that can't run script open inline
          if (!SAFE_EXT.test(cur.name)) { elsewhere(cur); return; }
          say('Opening ' + cur.name + '…');
          JP.drive.timed(global.GVC_DRIVE.readJobFile(r.drive_folder, cur.path, { timeoutMs: JP.drive.ms() })).then(function (f) {
            if (f.type && !SAFE_TYPE.test(f.type)) { elsewhere(cur); return; }
            var typed = f.type ? f : new global.Blob([f], { type: TYPE_OF[(/\.([a-z0-9]+)$/i.exec(cur.name) || [])[1].toLowerCase()] });
            var u = global.URL.createObjectURL(typed);
            global.open(u, '_blank', 'noopener');
            global.setTimeout(function () { global.URL.revokeObjectURL(u); }, 60000);   // the new tab has it by then
            say('');
          }, function (e) { say(e.timeout ? JP.drive.FAIL : e.message); });
        });
      });
    };
    if (JP.drive.mode(ctx) === 'scan') {
      count(rowsHtml((r.scan && r.scan.pieces) || {}, ctx, false));
      hook();
      return;
    }
    if (JP.drive.mode(ctx) !== 'live') { hook(); return; }
    JP.drive.folder(ctx).then(function (x) {
      var out = rowsHtml(x.health.pieces, ctx, true);
      body.innerHTML = out.html;
      if (out.sheet && ctx.onSheet) ctx.onSheet(out.sheet);
      count(out);
      hook();
    }, function (e) {
      body.innerHTML = '<p class="fmsg" role="alert">' + ctx.esc(e.timeout ? JP.drive.FAIL : e.message) + '</p>';
    });
  }

  JP.kit = { html: html, wire: wire, judge: judge };
})(window);
