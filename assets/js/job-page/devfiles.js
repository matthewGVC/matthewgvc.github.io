/* ============================================================
   JOB PAGE: a development's Marketing materials card (overhaul 7b-1).

     GVC_JP.devFiles.html(ctx)   → the card ('' before the folder's first nightly scan)

   What is in the development's Drive folder, as the helper's nightly scan
   found it (dev_projects.scan, 0023; helper/scan.js devScan): each top
   folder with Open, its file count and newest date, and its newest finished
   files (PDFs, pictures, videos) each with its own link. Development folders
   don't follow the listing layout, so the folders are shown as they are named.
   Paperwork and money files are never in the scan. Making pieces for a
   development comes later (docs/dev-pages-7b-plan.md); this only shows them.
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

  function html(ctx) {
    var esc = ctx.esc, I = ctx.I, s = ctx.row.scan;
    if (!s || !s.scannedAt) return '';
    var groups = s.groups || [];
    var rows = groups.map(function (g) {
      var n = +g.count || 0;
      var line = n + ' file' + (n === 1 ? '' : 's') + (g.newest ? ' · newest ' + day(g.newest) : '');
      var files = (g.files || []).map(function (f) {
        return DRIVE_URL.test(f.url || '') ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' : esc(f.name);
      }).join(' · ');
      var open = DRIVE_URL.test(g.url || '') ? '<a class="b sm ghost" href="' + esc(g.url) + '" target="_blank" rel="noopener">' + I('arrow') + 'Open</a>' : '';
      return '<div class="kr" data-dev-folder="' + esc(g.name) + '"><span class="ic">' + I('folder') + '</span><div><div class="t">' + esc(g.name) + '</div>' +
        '<div class="d">' + esc(line) + '</div>' + (files ? '<div class="d">' + files + '</div>' : '') + '</div><div class="a">' + open + '</div></div>';
    }).join('');
    return '<div class="card" id="devFilesCard"><div class="card-h"><div><h2>Marketing materials</h2><p>What is in its Drive folder, read each night (' + esc(day(s.scannedAt)) + ').</p></div></div>' +
      (rows ? '<div class="kit">' + rows + '</div>' : '<p class="soft">The folder has nothing in it yet.</p>') + '</div>';
  }

  JP.devFiles = { html: html };
})(typeof window !== 'undefined' ? window : globalThis);
