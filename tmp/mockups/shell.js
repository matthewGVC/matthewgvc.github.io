/* App shell (mockup): one top bar on every screen. <body data-nav="overview|jobs|team|reference|todo"> */
(function () {
  var M = window.MOCK, active = document.body.dataset.nav || '';
  var count = function (t) { return M.jobs.filter(function (j) { return j.type === t; }).length; };
  var listings = M.jobs.filter(function (j) { return j.type === 'listing' || j.type === 'rental'; }).length;
  var cur = function (k) { return k === active ? ' aria-current="page"' : ''; };
  var overview = sessionStorage.getItem('mock-overview') || 'overview-a.html';
  var top = document.createElement('header');
  top.className = 'app-top';
  top.innerHTML =
    '<a class="app-brand" href="index.html"><img src="../../assets/logos/monogram.svg" alt=""><span>GVC Workspace</span></a>' +
    '<nav class="app-nav" aria-label="Main">' +
      '<a href="' + overview + '"' + cur('overview') + '>Overview</a>' +
      '<div class="nav-group"><a href="jobs.html"' + cur('jobs') + '>Jobs</a>' +
        '<div class="nav-sub">' +
          '<a href="jobs.html#listings">Listings <span class="count">' + listings + '</span></a>' +
          '<a href="jobs.html#pitches">Pitches <span class="count">' + count('pitch') + '</span></a>' +
          '<a href="jobs.html#developments">Developments <span class="count">' + count('development') + '</span></a>' +
        '</div></div>' +
      '<div class="nav-group"><a href="team.html"' + cur('team') + '>Team</a>' +
        '<div class="nav-sub">' +
          '<a href="team.html#agents">Agents &amp; bios</a><a href="team.html#guides">Destination guides</a>' +
          '<a href="team.html#footprint">NJ Footprint</a><a href="team.html#screens">Office screens</a>' +
          '<a href="team.html#info">Agent info</a>' +
        '</div></div>' +
      '<div class="nav-group"><a href="team.html#reference"' + cur('reference') + '>Reference</a>' +
        '<div class="nav-sub"><a href="../../listing-rules/">Listing rules</a><a href="../../tools/calculator/">Calculator</a></div></div>' +
      '<a href="' + overview + '#todo"' + cur('todo') + '>To-do</a>' +
    '</nav>' +
    '<div class="app-status"><span><span class="dot"></span>Drive ' + M.sync.drive.replace(/\\/g, '\\') + '</span><span>DE synced ' + M.sync.de + '</span></div>' +
    '<button class="btn-solid" type="button">New job</button>';
  document.body.insertBefore(top, document.body.firstChild);

  var flag = document.createElement('div');
  flag.className = 'mock-flag';
  flag.innerHTML = 'Mockup<a href="index.html">all screens</a>';
  document.body.appendChild(flag);
})();
