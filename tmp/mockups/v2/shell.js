/* Top bar + footer for every v2 mockup page. <body data-nav="overview|jobs|team|reference|tasks"> */
window.ICON = function (n) {
  var P = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    plan: '<path d="M4 4h10v6h6v10H4z"/><path d="M4 12h6v8"/><path d="M14 10v4"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 8"/>',
    slides: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    sign: '<path d="M12 3v18"/><rect x="5" y="5" width="14" height="8" rx="1"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    pitch: '<path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    alert: '<path d="M12 8v5"/><path d="M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    map: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 5.5"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
  };
  return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>';
};
window.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
(function () {
  var a = document.body.dataset.nav || '', I = window.ICON;
  var c = function (k) { return k === a ? ' aria-current="page"' : ''; };
  var t = document.createElement('header');
  t.className = 'top';
  t.innerHTML = '<a class="brand" href="index.html"><img src="../../../assets/logos/monogram.svg" alt="">GVC Workspace</a>' +
    '<nav class="nav" aria-label="Main"><a href="index.html"' + c('overview') + '>Overview</a><a href="jobs.html"' + c('jobs') + '>Jobs</a>' +
    '<a href="team.html"' + c('team') + '>Team</a><a href="team.html#reference"' + c('reference') + '>Reference</a><a href="index.html#tasks"' + c('tasks') + '>Tasks</a></nav>' +
    '<div class="top-r"><span class="pill-ok">Drive connected</span>' +
    '<button class="ibtn" type="button" title="Refresh from DE · last synced Mon 19 Oct, 6:02">' + I('sync') + '</button>' +
    '<button class="ibtn" type="button" title="Search jobs">' + I('search') + '</button>' +
    '<span class="avatar" title="Matt Bloomfield">MB</span></div>';
  document.body.insertBefore(t, document.body.firstChild);
  var f = document.createElement('footer');
  f.className = 'foot';
  f.innerHTML = '<span class="ok">DE synced Mon 19 Oct, 6:02 · Drive G:\\Shared drives</span><span>The GVC Team · Douglas Elliman</span>';
  document.body.appendChild(f);
  var m = document.createElement('div');
  m.className = 'mock';
  m.innerHTML = 'Mockup<a href="../index.html">earlier rounds</a>';
  document.body.appendChild(m);
})();
