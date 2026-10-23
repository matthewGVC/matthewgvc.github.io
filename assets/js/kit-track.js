/* ============================================================
   KIT TRACK — the marketing steps of a job, piece by piece (spec S12, D60).

   One row per kit piece (plan §7): the newest file found on Drive (the proof)
   beside Asana's tick for the matching checklist step, and a plain state.

     GVC_KIT.track({ kind: 'sale'|'rental', market: 'NYC'|'NJ'|'FL',
                     pieces,      // GVC_HEALTH.health(...).pieces
                     checklist,   // row.asana.checklist
                     match })     // row.match { list: [{ code, key, text }] }
       → { rows: [{ key, label, state, file, older, step, mismatch }],
           checklistOnly: [{ name, done, doneOn }] }

   state: done (file and tick) · fileOpen (file, Asana open) · tickedNoFile ·
   notStarted · notUsed (signage in NYC) · tracked (video, tracked only).
   Advertising Spots and Send Just Listed Email (NYC) are checklist only:
   a tick, never a file (D74).

   A sidecar or system file (GVC_DRIVE_RULES.isJunk: "clip.m4v.xmpses.xmp",
   Thumbs.db) is never a piece's file, even in a scan stored before the
   walkers skipped them.

   GVC_KIT.STEPS holds the step name patterns (copied from match-check.js
   PIECE_STEPS; Task 9 makes the Match check use these).
   Loads in the browser (window.GVC_KIT) and in Node (require).
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_KIT = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var KEYS = ['floorplan', 'photos', 'showsheet', 'brochure', 'postcard', 'signage', 'video'];
  var LABELS = { floorplan: 'Floorplan', photos: 'Photos', showsheet: 'Showsheet', brochure: 'Brochure',
    postcard: 'Postcard', signage: 'Signage', video: 'Video' };

  var STEPS = {
    pieces: [
      ['showsheet', /create show ?sheet/],
      ['floorplan', /brand floor ?plan|revise\s*\/\s*brand/],
      ['photos', /pics\s*\/\s*video\s*\/\s*fp/],
      ['postcard', /just listed postcard/]
    ],
    video: /pics\s*\/\s*video\s*\/\s*fp/,       // plan §7: the Video piece shares that step
    neverFile: /just listed email/,             // built in DE StudioPro, no file (D74)
    advertising: /advertising spots?/
  };

  function ms(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }
  /* drive-rules.js may load after this file (the Match page): looked up when used */
  function rules() {
    if (typeof window !== 'undefined' && window.GVC_DRIVE_RULES) return window.GVC_DRIVE_RULES;
    try { return typeof require === 'function' ? require('./drive-rules.js') : null; } catch (e) { return null; }
  }
  function realFiles(list) {
    var R = rules();
    return (list || []).filter(function (f) { return f && !(R && R.isJunk(f.name)); });
  }

  function flat(checklist) {
    var steps = [];
    (checklist || []).forEach(function (b) { (b.steps || []).forEach(function (s) { steps.push(s); }); });
    return steps;
  }
  function low(s) { return String((s && s.name) || '').toLowerCase(); }
  function view(s) { return { name: s.name, done: !!s.done, doneOn: s.doneOn || null, who: s.who || null }; }

  function stepFor(key, steps) {
    var re = key === 'video' ? STEPS.video : null;
    if (!re) STEPS.pieces.forEach(function (ps) { if (ps[0] === key) re = ps[1]; });
    if (!re) return null;
    var mine = steps.filter(function (s) { return !STEPS.neverFile.test(low(s)) && re.test(low(s)); });
    if (!mine.length) return null;
    return view(mine.filter(function (s) { return s.done; })[0] || mine[0]);
  }

  function track(input) {
    input = input || {};
    var steps = flat(input.checklist);
    var matchList = (input.match && input.match.list) || [];
    var rows = KEYS.map(function (key) {
      var files = realFiles(input.pieces && input.pieces[key]).sort(function (a, b) { return ms(b.modified) - ms(a.modified); });
      var current = files.filter(function (f) { return !f.archived; })[0] || null;
      var step = stepFor(key, steps);
      var m = matchList.filter(function (x) { return x.key === 'M8:' + key; })[0] || null;
      var state;
      if (key === 'video') state = 'tracked';
      else if (key === 'signage' && input.market === 'NYC') state = 'notUsed';
      else if (current && step) state = step.done ? 'done' : 'fileOpen';
      else if (current) state = 'done';
      else if (step && step.done) state = 'tickedNoFile';
      else state = 'notStarted';
      var file = null;
      if (current) {
        file = { name: current.name, modified: current.modified || null };
        if (current.url) file.url = current.url;
      }
      return {
        key: key, label: LABELS[key], state: state, file: file,
        older: current ? files.length - 1 : files.length,
        step: step,
        mismatch: m ? { code: m.code, text: m.text } : null
      };
    });

    var only = [];
    steps.forEach(function (s) {
      var n = low(s);
      if (STEPS.advertising.test(n) || (input.market === 'NYC' && STEPS.neverFile.test(n)))
        only.push({ name: s.name, done: !!s.done, doneOn: s.doneOn || null });
    });
    return { rows: rows, checklistOnly: only };
  }

  return { track: track, realFiles: realFiles, STEPS: STEPS, KEYS: KEYS, LABELS: LABELS };
});
