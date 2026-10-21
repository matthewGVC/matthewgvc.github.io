/* ============================================================
   JOB PAGE: the one way the page saves (Slice 3, S4).

     GVC_JP.save(table, row, set, changes) → Promise<row>
       Calls save_job (migration 0007): the row change and its change-log
       rows together, or nothing. set = {} with note-only changes is a note.
       When someone (or the helper) saved the job first, the page reloads
       and the promise rejects with "This job changed a moment ago.
       Reloaded; try again." (err.conflict = true).
     GVC_JP.reload   set by the page: reloads the row and its changes.
     GVC_JP.canEdit  set by the page: true for the owner account (D87).
     GVC_JP.CONFLICT the conflict sentence.
     GVC_JP.clone(x) a deep copy of plain JSON.
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var CONFLICT = 'This job changed a moment ago. Reloaded; try again.';

  JP.CONFLICT = CONFLICT;
  JP.canEdit = false;
  JP.clone = function (x) { return x == null ? x : JSON.parse(JSON.stringify(x)); };

  JP.save = function (table, row, set, changes) {
    var body = { p_table: table, p_id: row.id, p_version: row.version, p_set: set || {}, p_changes: changes || [] };
    return global.GVC_PROPS.call('/rest/v1/rpc/save_job', { method: 'POST', body: JSON.stringify(body) }).then(function (r) {
      return Array.isArray(r) ? r[0] : r;
    }, function (e) {
      var msg = String((e && e.message) || '');
      if (/conflict/.test(msg)) {
        var err = new Error(CONFLICT);
        err.conflict = true;
        return Promise.resolve(JP.reload ? JP.reload() : null).then(function () { throw err; }, function () { throw err; });
      }
      if (/not allowed/.test(msg)) throw new Error('Only the owner account can change this job. You can still add a note.');
      throw e;
    });
  };
})(window);
