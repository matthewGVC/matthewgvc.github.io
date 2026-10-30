/* ============================================================
   JOB PAGE: the Drive folder card (spec §2.6, S15, S16, S21, S22), and the
   Drive helpers every Drive card shares (GVC_JP.drive).

     GVC_JP.drive.mode(ctx)   'live' (Drive connected here, folder linked) ·
                              'scan' (no Drive here: last night's scan) ·
                              'checking' (Drive state not known yet) · 'none' (no folder)
     GVC_JP.drive.timed(p)    p, or "Drive hasn't downloaded this yet." after
                              window.GVC_JP_TIMEOUT_MS (default 20 s)
     GVC_JP.drive.folder(ctx) → Promise<{ tree, health }> read once per page per
                              folder (GVC_DRIVE.tree, cut down by
                              GVC_DRIVE_RULES.jobTree, then GVC_HEALTH.health)
     GVC_JP.drive.link(row, file, stored) → Promise<Drive link | null>: the
                              helper's POST /drive-link, else the stored link
     GVC_JP.drive.gPath(row, file)  the G: path of the folder or a file in it
     GVC_JP.drive.copy(text, ok, el) copies, saying so in el
     GVC_JP.folder.html(ctx) / wire(host, ctx)   the card

   The tree shows readable folders only (two levels open), each with its
   file count and newest date; loose top files as a count; paperwork as one
   greyed "Docs\ · never read" line. No paperwork name is ever shown.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var FAIL = 'Drive hasn\'t downloaded this yet.';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var cache = {};   // drive_folder → Promise<{ tree, health }>
  var msgs = {};    // card id → last message, kept across a redraw

  function ms() { var n = +global.GVC_JP_TIMEOUT_MS; return n > 0 ? n : 20000; }
  function timed(p) {
    var timer;
    var limit = new Promise(function (_, rej) {
      timer = setTimeout(function () { var e = new Error(FAIL); e.timeout = true; rej(e); }, ms());
    });
    return Promise.race([Promise.resolve(p), limit]).then(function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; });
  }
  function mode(ctx) {
    var r = ctx.row;
    if (!r.drive_folder || r.folder_state !== 'linked') return 'none';
    if (ctx.drive === 'connected' && global.GVC_DRIVE && global.GVC_DRIVE.tree) return 'live';
    if (ctx.drive == null) return 'checking';
    return 'scan';
  }
  function day(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));   // a plain date is that day wherever the page is
    if (m) return +m[3] + ' ' + MONTHS[+m[2] - 1];
    var t = typeof v === 'number' ? v : Date.parse(v);
    if (isNaN(t)) return '';
    var d = new Date(t);
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  function folder(ctx) {
    var r = ctx.row, key = r.drive_folder;
    if (!cache[key]) {
      cache[key] = timed(global.GVC_DRIVE.tree(key, { depth: 4, timeoutMs: ms() })).then(function (raw) {
        var tree = global.GVC_DRIVE_RULES.jobTree(raw);   // again here: whatever GVC_DRIVE returns, only the allowed shape is used
        var root = String(key).split('/')[0];
        return { tree: tree, health: global.GVC_HEALTH.health(tree, { market: r.market, driveRoot: root, isNew: false }) };
      });
      cache[key].catch(function () { /* each card shows the failure itself */ });
    }
    return cache[key];
  }
  function forget(ctx) { delete cache[ctx.row.drive_folder]; }

  var DRIVE_URL = /^https:\/\/drive\.google\.com\//;
  function link(row, file, stored) {
    stored = stored && DRIVE_URL.test(stored) ? stored : null;
    if (!file && !stored && row.scan && DRIVE_URL.test(row.scan.folderUrl || '')) stored = row.scan.folderUrl;
    var body = { folder: row.drive_folder };
    if (file) body.file = file;
    return global.GVC_SHELL.helper('POST', '/drive-link', body).then(function (x) {
      return x && DRIVE_URL.test(x.url || '') ? x.url : stored;
    }, function () { return stored; });
  }
  function gPath(row, file) {
    return 'G:\\Shared drives\\' + String(row.drive_folder).split('/').join('\\') + (file ? '\\' + String(file).split('/').join('\\') : '');
  }
  function copy(text, ok, el) {
    var say = function (t) { if (el) el.textContent = t; };
    return (global.navigator.clipboard ? global.navigator.clipboard.writeText(text) : Promise.reject()).then(function () { say(ok); },
      function () { say(text); });
  }
  /* copy a Drive link: the helper's, else the stored one, else the G: path */
  function copyLink(row, file, stored, el) {
    if (el) el.textContent = 'Finding the Drive link…';
    return link(row, file, stored).then(function (u) {
      if (u) return copy(u, 'Copied the Drive link.', el);
      return copy(gPath(row, file), 'No Drive link known yet, so the folder path was copied instead.', el);
    });
  }
  /* open a folder on drive.google.com in a new tab (Matt, 10-30); File Explorer only when no Drive link is known.
     The tab opens at the click, before the link is found, so the browser doesn't block it as a pop-up. */
  function openWeb(row, say) {
    var tab = global.open('about:blank', '_blank');
    say('Finding the folder on Drive…');
    return link(row, null, null).then(function (u) {
      if (u && tab) { tab.location.href = u; say('Opened the folder on Google Drive.'); return; }
      if (tab) tab.close();
      return global.GVC_SHELL.helper('POST', '/open-folder', { folder: row.drive_folder }).then(function (x) {
        say(x.ok ? 'No Drive link known for it yet, so it opened in File Explorer.' : (x.error || 'Couldn\'t open it.'));
      });
    }).catch(function (e) { if (tab) tab.close(); say(e.message); });
  }
  JP.drive = { FAIL: FAIL, ms: ms, timed: timed, mode: mode, folder: folder, forget: forget, link: link, gPath: gPath,
    copy: copy, copyLink: copyLink, openWeb: openWeb, day: day, msgs: msgs };

  /* ---------- the card ---------- */
  function stat(node) {
    var n = 0, newest = 0;
    (function go(x) {
      (x.children || []).forEach(function (c) {
        if (c.kind === 'directory') go(c);
        else { n++; var t = Date.parse(c.modified); if (!isNaN(t) && t > newest) newest = t; }
      });
    })(node);
    return { n: n, newest: newest };
  }
  function treeHtml(node, level, esc) {
    var dirs = (node.children || []).filter(function (c) { return c.kind === 'directory' && !c.skipped; });
    var files = (node.children || []).filter(function (c) { return c.kind === 'file'; });
    var out = dirs.map(function (d) {
      var s = stat(d);
      var k = s.n + ' file' + (s.n === 1 ? '' : 's') + (s.newest ? ' · newest ' + day(s.newest) : '');
      return '<details class="trd"' + (level < 2 ? ' open' : '') + '><summary><span class="x">' + esc(d.name) + '\\</span><span class="k">' + esc(k) + '</span></summary>' +
        '<div class="tri">' + treeHtml(d, level + 1, esc) + '</div></details>';
    }).join('');
    if (level > 0 && files.length) {
      var shown = files.slice(0, 12);
      out += '<ul class="trf">' + shown.map(function (f) {
        return '<li><span>' + esc(f.name) + '</span><span class="k">' + esc(day(f.modified)) + '</span></li>';
      }).join('') + (files.length > shown.length ? '<li class="soft">and ' + (files.length - shown.length) + ' more</li>' : '') + '</ul>';
    }
    return out;
  }

  function mismatchLines(ctx) {
    var esc = ctx.esc;
    return ((ctx.job && ctx.job.match) || []).filter(function (m) { return m.code === 'M6' || m.code === 'M7'; }).map(function (m) {
      return '<div class="hl warn"><span class="x">' + ctx.I('alert') + '<span><span class="code">' + esc(m.code) + '</span> ' + esc(m.text) + '</span></span>' +
        (m.code === 'M7' ? '<button class="b sm" type="button" data-copy-folder>' + ctx.I('copy') + 'Copy</button>' : '') + '</div>';
    }).join('');
  }
  function notesHtml(notes, ctx) {
    return (notes || []).map(function (n) {
      return '<div class="hl warn" data-note="' + ctx.esc(n.code) + '"><span class="x">' + ctx.I('alert') + '<span>' + ctx.esc(n.text) + '</span></span></div>';
    }).join('');
  }

  function liveBody(x, ctx) {
    var esc = ctx.esc, t = x.tree, h = x.health, out = notesHtml(h.notes, ctx);
    if (t.broken) return out;
    out += '<div class="tree">' + treeHtml(t, 0, esc) + '</div>';
    var doc = (t.children || []).filter(function (c) { return c.kind === 'file' && global.GVC_DRIVE_RULES.allowedInJob(c.name); });
    if (doc.length) out += '<div class="hl"><span class="x">' + ctx.I('file') + 'Details doc</span><span class="k">' + doc.length + ' found</span></div>';
    var loose = h.counts.looseTop;
    if (loose) out += '<div class="hl"><span class="x">Loose files at the top</span><span class="k">' + loose + ', not read</span></div>';
    var skipped = (t.children || []).filter(function (c) { return c.skipped; });
    var docs = skipped.filter(function (c) { return c.name === 'Docs'; }).length, other = skipped.length - docs;
    if (docs) out += '<div class="troff">Docs\\ · never read</div>';
    if (other) out += '<div class="troff">' + other + ' paperwork folder' + (other === 1 ? '' : 's') + ' · never read</div>';
    if (t.otherCount) out += '<div class="troff">' + t.otherCount + ' other folder' + (t.otherCount === 1 ? '' : 's') + ' · not read</div>';
    return out;
  }
  function scanBody(ctx) {
    var r = ctx.row, s = r.scan || {}, h = s.health || {}, c = h.counts || {}, ph = c.photos || {}, out = '';
    out += notesHtml(h.notes, ctx);
    if (s.scannedAt) {
      out += '<div class="hl"><span class="x">' + ctx.I('photo') + 'Photos\\</span><span class="k">edited ' + (+ph.edited || 0) + (ph.raw ? ' · raws ' + ph.raw : '') + '</span></div>';
      if (s.detailsDoc) out += '<div class="hl"><span class="x">' + ctx.I('file') + 'Details doc</span><span class="k">found</span></div>';
      if (c.looseTop) out += '<div class="hl"><span class="x">Loose files at the top</span><span class="k">' + c.looseTop + ', not read</span></div>';
    }
    return out;
  }

  function html(ctx) {
    var r = ctx.row, m = mode(ctx), esc = ctx.esc;
    var body;
    if (m === 'none') body = '<p class="soft">' + (r.drive_folder ? 'The folder link is broken.' + (ctx.canEdit ? ' Relink it from the top of the page.' : '') : 'No Drive folder linked yet.') + '</p>';
    else if (m === 'scan') body = scanBody(ctx);
    else body = '<p class="soft" data-reading>' + (m === 'checking' ? 'Checking Drive…' : 'Reading the folder…') + '</p>';
    return '<div class="card" id="folderCard"><div class="card-h"><div><h2>Folder</h2></div>' +
      (r.drive_folder ? '<button class="b sm" type="button" data-copy-folder>' + ctx.I('link') + 'Copy Drive link</button>' : '') + '</div>' +
      (r.drive_folder ? '<div class="path">' + esc(gPath(r)) + '</div>' : '') + mismatchLines(ctx) +
      '<div id="folderBody">' + body + '</div><p class="soft" id="folderMsg" role="status" style="font-size:13px;margin-top:8px">' + esc(msgs.folder || '') + '</p></div>';
  }

  function wire(host, ctx) {
    var msg = host.querySelector('#folderMsg');
    host.querySelectorAll('[data-copy-folder]').forEach(function (b) {
      b.addEventListener('click', function () { copyLink(ctx.row, null, null, msg).then(function () { msgs.folder = msg.textContent; }); });
    });
    if (mode(ctx) !== 'live') return;
    folder(ctx).then(function (x) {
      var b = host.querySelector('#folderBody');
      if (b) b.innerHTML = liveBody(x, ctx);
    }, function (e) {
      var b = host.querySelector('#folderBody');
      if (b) b.innerHTML = '<p class="fmsg" role="alert">' + ctx.esc(e.timeout ? FAIL : e.message) + '</p><button class="b sm" type="button" data-again>Try again</button>';
      var again = b && b.querySelector('[data-again]');
      if (again) again.addEventListener('click', function () { forget(ctx); if (JP.redraw) JP.redraw(); });
    });
  }

  JP.folder = { html: html, wire: wire };
})(window);
