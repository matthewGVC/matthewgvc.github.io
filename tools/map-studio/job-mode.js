/* ============================================================
   MAP STUDIO JOB MODE (workspace v2, Slice 5, spec S10 to S12): the map for
   a job's Seller Package, /tools/map-studio/?pitch=<slug> (or ?listing=).
   Loaded by piece-loader.js only then.

   The address list is the job's subject and its comps (GVC_PIECEJOB.
   mapAddresses), each looked for in the job's town, near the job's market
   (today's tool always looks near Manhattan). Framing and export are the
   tool's own. "Save map to the job" (the owner) sends the picture to the
   helper, which writes Map - <Address Unit> - <date>.png beside the seller
   pitch (Marketing\Pitch\), and the job records it (save_piece_of, tool
   'pitch-map', built_from = the addresses mapped). Without the helper the
   picture downloads as today. The Mapbox token is remembered on this
   computer only, and only in job mode.
   ============================================================ */
(function () {
  'use strict';
  var P = window.GVC_PROPS, J = window.GVC_PIECEJOB, ST = window.GVC_STALE, MS = window.__mapStudio;
  var q = new URLSearchParams(location.search), kind = q.has('pitch') ? 'pitch' : 'listing', slug = q.get(kind) || '';
  var TABLE = kind === 'pitch' ? 'pitches' : 'properties', OWNER = kind === 'pitch' ? 'pitch_id' : 'property_id';
  var TOKEN_KEY = 'gvc.mapStudio.token';
  var NEAR = { NYC: '-73.962,40.773', NJ: '-74.064,40.347', FL: '-80.072,26.461' };
  var STATE = { NYC: 'NY', NJ: 'NJ', FL: 'FL' };
  var M = window.GVC_MAPJOB = { ready: false, row: null, doc: null, canEdit: false };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function rest(path) { return P.call('/rest/v1' + path); }
  function rpc(name, body) { return P.call('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return Array.isArray(r) ? r[0] : r; }); }
  function say(t) { var m = $('#mapJobMsg'); if (m) m.textContent = t || ''; }
  function back() { return '../../workspace/job/?' + kind + '=' + encodeURIComponent(slug); }
  function pause(n) { return new Promise(function (r) { setTimeout(r, n); }); }

  var bar = document.createElement('div');
  bar.id = 'mapJobBar';
  bar.style.cssText = 'padding:14px 20px;border-bottom:1px solid var(--rule);font-size:13.5px;line-height:1.45';
  var side = $('.sidebar');
  (side || document.body).insertBefore(bar, side ? side.firstChild : null);

  /* "100 Example St, Residence 4A" → number, street, unit, and where to look */
  function record(line, place) {
    // "<street>, Residence 4A" is the subject's unit; any other tail ("12 Elm St, Jersey City") is a town
    var at = line.indexOf(', '), head = at === -1 ? line : line.slice(0, at), tail = at === -1 ? '' : line.slice(at + 2).trim(), unit = '';
    if (/^(residence|apt\.?|apartment|unit|#)\s*/i.test(tail) || /^[\w-]{1,7}$/.test(tail)) unit = tail.replace(/^(residence|apt\.?|apartment|unit)\s+|^#\s*/i, '');
    else if (tail) place = /,|\b[A-Z]{2}$/.test(tail) ? tail : tail + ', ' + (place.split(', ').pop() || '');
    var m = /^(\S+)\s+(.+)$/.exec(head.trim());
    return m ? { number: m[1], street: m[2], city: '', unit: unit, place: place } : null;
  }
  function placeOf(row) {
    var c = row.core || {}, st = c.state || STATE[row.market] || 'NY';
    var town = c.city || (row.market === 'NYC' || !row.market ? 'New York' : '');
    return town ? town + ', ' + st : st;
  }
  function drawBar() {
    var r = M.row, c = r.core || {}, s;
    try { s = ST.stale(M.doc, r, {}); } catch (e) { s = { state: 'none', changes: [] }; }
    var words = s.state === 'none' ? 'No map saved yet' : s.state === 'stale' ? 'Stale: the addresses changed since the last map' : 'Map saved' +
      (M.doc && M.doc.output && M.doc.output.madeAt ? ' ' + new Date(M.doc.output.madeAt).toLocaleDateString() : '');
    bar.innerHTML = '<div style="font-weight:700">Map for ' + esc(c.address || r.label || slug) + ' · <a href="' + esc(back()) + '">← ' + (kind === 'pitch' ? 'Pitch page' : 'Job page') + '</a></div>' +
      '<div style="color:var(--ink-soft, inherit);margin-top:2px">' + esc(J.mapAddresses(r).length) + ' addresses: the ' + kind + ' and its comps · <span id="mapJobState">' + esc(words) + '</span></div>' +
      (M.canEdit ? '' : '<div style="margin-top:6px">Read only: only the owner account saves the map to the ' + kind + '. Export still downloads it.</div>') +
      '<p id="mapJobMsg" role="status" style="margin:8px 0 0;min-height:1.2em"></p>';
  }
  function fill() {
    var r = M.row, place = placeOf(r);
    var lines = J.mapAddresses(r);
    var recs = lines.map(function (l) { return record(l, place); }).filter(Boolean);
    window.__mapRecords = function () { return recs.map(function (x) { return Object.assign({}, x); }); };
    var ta = $('#addresses');
    if (ta) { ta.value = lines.join('\n'); ta.readOnly = true; }
    MS.setNear(NEAR[r.market] || NEAR.NYC);
    var tok = $('#token'), saved = null;
    try { saved = localStorage.getItem(TOKEN_KEY); } catch (e) { saved = null; }
    if (tok) {
      if (saved && !tok.value) tok.value = saved;
      tok.addEventListener('change', function () { try { localStorage.setItem(TOKEN_KEY, tok.value.trim()); } catch (e) { /* private window */ } });
    }
    var exp = $('#export');
    if (exp && M.canEdit) exp.textContent = 'Save map to the ' + kind;
  }

  function savePiece(bf, output, archived) {
    return rpc('save_piece_of', { p_table: TABLE, p_id: M.row.id, p_tool: 'pitch-map', p_version: M.doc ? M.doc.version : null,
      p_state: { style: ($('#style') || {}).value || null }, p_built_from: bf, p_output: output, p_archived: archived || null })
      .then(function (doc) { if (doc) M.doc = doc; return M.doc; });
  }
  function record3(bf, output, archived) {
    var tries = 0;
    function attempt() {
      tries++;
      return savePiece(bf, output, archived).catch(function () {
        return rest('/documents?' + OWNER + '=eq.' + encodeURIComponent(M.row.id) + '&tool=eq.pitch-map&select=*').then(function (rows) { M.doc = (rows || [])[0] || M.doc; }, function () {})
          .then(function () {
            var o = M.doc && M.doc.output;
            if (o && o.name === output.name && o.madeAt === output.madeAt) return M.doc;
            if (tries >= 3) throw new Error('Saved to Drive, but the ' + kind + ' didn\'t record it. Save again or reload.');
            return pause(window.__pieceRetryMs || 1000).then(attempt);
          });
      });
    }
    return attempt();
  }

  /* the tool's Export calls this with the finished picture */
  window.__mapExport = function (canvas, download) {
    if (!M.row || !M.canEdit) { download(canvas); return Promise.resolve(); }
    var shell = window.GVC_SHELL, body = { tool: 'pitch-map', image: canvas.toDataURL('image/png') };
    body[kind === 'pitch' ? 'pitchId' : 'propertyId'] = M.row.id;
    var bf = J.builtFrom('pitch-map', {}, M.row, { via: 'helper' });
    say('Saving the map to the ' + kind + '…');
    var ask = shell && shell.helper ? shell.helper('POST', '/piece', body) : Promise.reject(new Error('no helper'));
    return ask.then(function (reply) {
      if (!reply || !reply.ok) { say((reply && reply.error) || 'The helper couldn\'t save the map.'); return; }
      var output = { path: reply.path, name: reply.name, size: reply.size, modified: reply.modified, url: reply.url || null, madeAt: new Date().toISOString(), via: 'helper' };
      return record3(bf, output, reply.archived || null).then(function () {
        drawBar();
        if (window.GVC_UNSAVED) GVC_UNSAVED.clear();
        say('Saved to Drive: ' + reply.name + '. Reload the Seller Package to use it.');
      }, function (e) { drawBar(); say(e.message); });
    }, function (e) {
      if (e && e.status) { say(e.message); return; }   // the helper answered and refused
      download(canvas);
      say('The helper isn\'t running here, so the map downloaded. Put it in the ' + kind + ' folder\'s Marketing\\Pitch, or drop it on the Seller Package.');
    }).catch(function (e) { say((e && e.message) || 'The map was not saved.'); });   // never a half-done export with nothing said
  };

  (P.signedIn() ? Promise.resolve(true) : P.askSignIn('Sign in to make this ' + kind + '\'s map.')).then(function (ok) {
    if (!ok) { bar.textContent = 'Sign in to make this ' + kind + '\'s map. Reload to try again.'; return null; }
    return rest('/' + TABLE + '?slug=eq.' + encodeURIComponent(slug) + '&select=*').then(function (rows) {
      var row = rows && rows[0];
      if (!row) { bar.innerHTML = '<b>No ' + kind + ' called "' + esc(slug) + '"</b>. <a href="../../workspace/">Back to the overview</a>'; return null; }
      return Promise.all([
        rest('/documents?' + OWNER + '=eq.' + encodeURIComponent(row.id) + '&tool=eq.pitch-map&select=*').catch(function () { return []; }),   // before 0010: no record yet
        P.whoAmI().then(null, function () { return { role: null }; })
      ]).then(function (r) {
        M.row = row; M.doc = (r[0] || [])[0] || null; M.canEdit = (r[1] || {}).role === 'owner';
        drawBar(); fill();
      });
    });
  }).catch(function (e) { bar.textContent = 'The ' + kind + ' couldn\'t load: ' + e.message; })
    .then(function () { M.ready = true; });
})();
