/* ============================================================
   PIECE LOADER — a tool's job-mode files, only when it was opened from a job
   (workspace v2, Slice 5). One line in a tool's page:

     <script src="../../assets/js/piece-loader.js" data-job="job-mode.js"></script>

   With ?listing=<slug> or ?pitch=<slug> in the address it loads, in order,
   the shared job-mode files and then the tool's own job-mode.js; without
   them it does nothing, so the standalone tool never runs a line of job mode.
   ============================================================ */
(function () {
  'use strict';
  var me = document.currentScript, q = new URLSearchParams(location.search);
  if (!q.has('listing') && !q.has('pitch')) return;
  var A = '../../assets/js/';
  var files = ['drive-rules.js', 'drive.js', 'folder-health.js', 'job-facts.js', 'sheet-job.js', 'piece-job.js', 'piece-stale.js', 'workspace-shell.js']
    .map(function (f) { return A + f; });
  if (!window.GVC_IMAGES) files.push(A + 'images.js');
  // the sign-in and the job's rows come through the property library (the Postcard doesn't load it itself)
  if (!window.GVC_PROPS) files.unshift(A + 'supabase-config.js', A + 'property-library.js');
  files.push(A + 'piece-mode.js', (me && me.dataset.job) || 'job-mode.js');
  files.reduce(function (ready, src) {
    return ready.then(function () {
      return new Promise(function (ok, fail) {
        var el = document.createElement('script');
        el.src = src; el.onload = ok; el.onerror = function () { fail(new Error(src)); };
        document.body.appendChild(el);
      });
    });
  }, Promise.resolve()).catch(function (e) {
    var bar = document.createElement('div');
    bar.id = 'pieceLoadFail';
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'padding:14px 20px;font-size:13.5px';
    bar.textContent = 'The job couldn\'t load (' + e.message + '). Reload the page.';
    (document.getElementById('editor') || document.body).prepend(bar);
  });
})();
