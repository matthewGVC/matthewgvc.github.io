/* ============================================================
   JOB PAGE: a development's Marketing materials card (overhaul 7b-1).

     GVC_JP.devFiles.html(ctx, inside) → the card ('' before the folder's first nightly scan);
                                   inside: the section inside a one-house development's
                                   Marketing materials card ("More in the Drive folder", D141)

   What is in the development's Drive folder, as the helper's nightly scan
   found it (dev_projects.scan, 0023; helper/scan.js devScan): each top
   folder with Open, its file count and newest date, and Open newest for its
   newest finished file (PDF, picture, video). Never a file's own name (Matt,
   11-03): the date says which. Development folders
   don't follow the listing layout, so the folders are shown as they are named.
   An events folder lists each event's pieces (Trifold, Screen loop...), each with Open for the
   piece's newest finished file (Source and Archive left out).
   Paperwork and money files are never in the scan. Making pieces for a
   development comes later (docs/overhaul-plan.md, 7b-1); this only shows them.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var DRIVE_URL = /^https:\/\/drive\.google\.com\//;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function day(v) {
    var t = Date.parse(v);
    if (isNaN(t)) return '';
    var d = new Date(t);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }

  function html(ctx, inside) {
    var esc = ctx.esc, I = ctx.I, s = ctx.row.scan;
    if (!s || !s.scannedAt) return '';
    var groups = s.groups || [];
    var rows = groups.map(function (g) {
      var n = +g.count || 0;
      var line = n + ' file' + (n === 1 ? '' : 's') + (g.newest ? ' · newest ' + day(g.newest) : '');
      var top = (g.files || []).filter(function (f) { return DRIVE_URL.test(f.url || ''); })[0];
      var open = (top ? '<a class="b sm ghost" data-dev-newest href="' + esc(top.url) + '" target="_blank" rel="noopener">' + I('arrow') + 'Open newest</a>' : '') +
        (DRIVE_URL.test(g.url || '') ? '<a class="b sm ghost" href="' + esc(g.url) + '" target="_blank" rel="noopener">' + I('folder') + 'Open folder</a>' : '');
      var evs = (g.events || []).map(function (ev) {
        return (ev.pieces || []).map(function (pc) {
          if (!DRIVE_URL.test(pc.url || '')) return '';
          return '<div class="kr" data-dev-piece="' + esc(ev.name + ' | ' + pc.name) + '"><span class="ic">' + I('file') + '</span><div><div class="t">' + esc(pc.name) + '</div>' +
            '<div class="d">' + esc(ev.name + (pc.modified ? ' · ' + day(pc.modified) : '')) + '</div></div><div class="a">' +
            '<a class="b sm ghost" href="' + esc(pc.url) + '" target="_blank" rel="noopener">' + I('arrow') + 'Open</a></div></div>';
        }).join('');
      }).join('');
      return '<div class="kr" data-dev-folder="' + esc(g.name) + '"><span class="ic">' + I('folder') + '</span><div><div class="t">' + esc(g.name) + '</div>' +
        '<div class="d">' + esc(line) + '</div></div><div class="a">' + open + '</div></div>' + evs;
    }).join('');
    return '<div class="card" id="devFilesCard"><div class="card-h"><div><h2>' + (inside ? 'More in the Drive folder' : 'Marketing materials') + '</h2><p>What is in its Drive folder, read each night (' + esc(day(s.scannedAt)) + ').</p></div></div>' +
      (rows ? '<div class="kit">' + rows + '</div>' : '<p class="soft">The folder has nothing in it yet.</p>') + '</div>';
  }

  JP.devFiles = { html: html };
})(typeof window !== 'undefined' ? window : globalThis);
