/* ============================================================
   SIGNAGE JOB MODE (workspace v2, Slice 6, spec T4, T5): the For Sale sign
   for a job, /tools/signage/?listing=<slug>. Loaded by piece-loader.js only
   then; GVC_PIECEMODE runs the bar, Drive and saving.

   From the job: its first two agents, the QR to its DE listing (else the
   team's site) and the market's office line. The sign has nothing of its
   own to keep, and no photos. The Open House arrow sign carries nothing
   from a job, so it stays a standalone sign.
   ============================================================ */
(function () {
  'use strict';
  var B = window.__piece, J = window.GVC_PIECEJOB, PM = window.GVC_PIECEMODE;

  function lock() {
    var pick = document.getElementById('rosterPick');
    if (pick) {
      var names = (B.state.agents || []).map(function (id) {
        var a = (window.GVC_ROSTER || []).filter(function (x) { return x.id === id; })[0];
        return '<li>' + PM._.esc(a ? a.name : id) + '</li>';
      }).join('');
      pick.innerHTML = '<ol style="margin:0 0 6px;padding-left:18px">' + names + '</ol><p class="note">These are the job\'s agents. Change agents on the job page.</p>';
    }
    Array.prototype.forEach.call(document.querySelectorAll('#kindPick button, #marketPick button'), function (b) { b.disabled = true; });
    var qr = document.getElementById('fQr');
    if (qr) qr.readOnly = true;
  }

  PM.start({
    tool: 'signage', label: 'For Sale sign', prefix: 'For Sale Sign', owners: ['listing'], panel: '#editor', kitKey: 'signage',
    ready: function () { return B.ready(); },
    note: function (row) {
      var n = [];
      if (row.market === 'NYC') n.push('The kit doesn\'t use signs in New York; this one prints all the same.');
      if (!J.LINKED || !window.GVC_SHEETJOB.listingUrlOf(row)) n.push('No DE listing link yet: the QR points at the team\'s site.');
      return n.join(' ');
    },
    lay: function (doc, row, prev) {
      var f = J.fill('signage', B.sanitize({}), row, { previous: prev });
      B.set(f.state);
      return { redone: f.redone };
    },
    afterLay: lock,
    wants: function () { return {}; },
    apply: function () { lock(); },
    state: function () { return B.state; },
    storable: function () { return {}; },
    printable: function () { return JSON.parse(JSON.stringify(B.state)); },
    builtCtx: function () { return {}; },
    paper: function () { return null; }
  });
})();
