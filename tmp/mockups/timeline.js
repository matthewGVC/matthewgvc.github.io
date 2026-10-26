/* Shared timeline helpers for the overview mockups. */
window.TL = (function () {
  var M = window.MOCK;
  var D = function (s) { return new Date(s + 'T12:00:00'); };
  var from = D(M.range.from), to = D(M.range.to), span = to - from;
  var pct = function (s) { return Math.max(0, Math.min(100, (D(s) - from) / span * 100)); };
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var fmt = function (s) { var d = D(s); return d.getDate() + ' ' + MON[d.getMonth()]; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function weeks() {
    var out = [], d = new Date(from);
    while (d < to) { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 7 * 864e5); }
    return out;
  }
  function months() {
    var out = [], d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d < to) {
      var s = new Date(Math.max(d, from)), n = new Date(d.getFullYear(), d.getMonth() + 1, 1), e = new Date(Math.min(n, to));
      out.push({ label: MON[d.getMonth()], left: (s - from) / span * 100, width: (e - s) / span * 100, start: d >= from });
      d = n;
    }
    return out;
  }
  /* Activity for a week: files touched. Keys are week starts; map any date into its week. */
  function weekCount(job, w) {
    var a = job.activity || {}, ws = D(w), we = new Date(ws.getTime() + 7 * 864e5), n = 0;
    for (var k in a) { var d = D(k); if (d >= ws && d < we) n += a[k]; }
    return n;
  }
  var STAGE = { pitch: 'Pitch', won: 'Won', live: 'Live', contract: 'In contract', sold: 'Sold', archived: 'Archived' };
  var WORK = { floorplan: ['F', 'Floorplan'], showsheet: ['S', 'Showsheet'], photos: ['P', 'Photos'], brochure: ['B', 'Brochure'],
    social: ['C', 'Social carousel'], postcard: ['M', 'Postcard'], film: ['V', 'Film'], staging: ['VS', 'Virtual staging'] };
  return { M: M, pct: pct, fmt: fmt, esc: esc, weeks: weeks, months: months, weekCount: weekCount, STAGE: STAGE, WORK: WORK, today: M.today };
})();
