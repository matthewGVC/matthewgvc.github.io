/* Derived job info for the v2 mockups, built on ../data.js */
(function () {
  var M = window.MOCK;
  var STAGES = ['Pitch', 'Won', 'Floorplan', 'Showsheet', 'Photos', 'Brochure', 'Live', 'In contract', 'Sold', 'Archived'];
  var DEV = ['Architecturals', 'Renders', 'Finishes', 'Floorplans', 'Branding', 'Launch event', 'Showing assets', 'Contracts', 'Construction', 'Sales'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var fmt = function (s) { var d = new Date(s + 'T12:00:00'); return d.getDate() + ' ' + MON[d.getMonth()]; };
  var NEXT = {
    'park-1050-13c': 'Showsheet and unbranded floorplan built from floorplan v1; v2 drawn 1 Oct.',
    'e57-435-12b': 'Showsheet built from the 14 Sep floorplan; redrawn 1 Oct.',
    'wbway-347-6': 'On DE as W BROADWAY; folder is "347 West Broadway". Link it once.',
    'w59-555-phc': 'On DE, price reduced 8.9%. No folder linked yet.',
    'fifth-1050-2e': 'Nothing waiting.',
    'e29-229-6g': 'Photos and staging done. Floorplan and showsheet not made.',
    'e74-255-11b': 'Rental. Folder holds paperwork only.',
    'pheasant-1006-204': 'Not matched to a DE listing yet.',
    'w94-250-11b': 'Pitched 4 Aug. No listing folder. Won or lost?',
    'wea-617-4b': 'Pitched 10 Jun. No listing folder. Won or lost?',
    'e71-176-phd': 'Sold on DE. Just Sold postcard 16 Oct. Ready to archive.',
    'bradley-619': 'Floorplans and showing assets 7 Oct.',
    'casa-avenida': '5 milestone folders have no dates.'
  };
  var MAP = { pitch: 'Pitch', won: 'Won', live: 'Live', contract: 'In contract', sold: 'Sold' };
  M.jobs.forEach(function (j) {
    j.next = NEXT[j.id] || '';
    var done = {};
    (j.status || []).forEach(function (s) { done[MAP[s.s]] = s.from; });
    (j.work || []).forEach(function (w) {
      var k = { floorplan: 'Floorplan', showsheet: 'Showsheet', photos: 'Photos', brochure: 'Brochure' }[w.k];
      if (k && !done[k]) done[k] = w.d || w.from;
    });
    j.done = done;
    j.steps = j.type === 'development' ? DEV : STAGES;
    j.stageIdx = j.steps.indexOf(j.stage);
    if (j.type === 'development') j.stageIdx = DEV.indexOf(j.stage === 'Construction' ? 'Construction' : j.stage);
    j.flags = [];
    if (j.stale) j.flags.push({ t: j.stale + ' stale', k: 'stale' });
    if (j.folderMissing) j.flags.push({ t: 'Link folder', k: 'stale' });
    if (j.note && /DE status not matched/.test(j.note)) j.flags.push({ t: 'Match DE', k: 'stale' });
    j.chip = { 'Live': 'live', 'In contract': 'contract', 'Sold': 'sold' }[j.stage] || 'pre';
    var dates = [];
    (j.status || []).forEach(function (s) { dates.push(s.from); });
    (j.work || []).forEach(function (w) { dates.push(w.d || w.to); });
    (j.changes || []).forEach(function (c) { dates.push(c.d); });
    (j.milestones || []).forEach(function (m) { dates.push(m.d || m.to); });
    dates = dates.filter(function (d) { return d && d <= M.today; }).sort();
    j.last = dates.length ? dates[dates.length - 1] : null;
  });
  window.V2 = { M: M, STAGES: STAGES, DEV: DEV, fmt: fmt };
})();
