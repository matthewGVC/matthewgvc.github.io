/* ============================================================
   PIECE MODE — a tool opened from a job (workspace v2, Slice 5, spec §2):
   the Brochure, the Postcards and the Seller pitch, at
   /tools/<tool>/?listing=<slug> (or ?pitch=<slug> for a pitch's seller pitch).

   The Showsheet's job mode (tools/showsheet/job-mode.js, Slice 4) made general:
   blank piece → the piece's saved wording, crops and settings (documents.state)
   → the job laid over it (GVC_PIECEJOB.fill) → photos, floorplans and the map
   read from Drive on this desktop → drawn. A job bar (the job, its market,
   made / stale, Save sheet, Save PDF to Drive) and a facts block (each printed
   fact with its badge, other sources and the warning sign) sit at the top of
   the tool's panel. A fact typed on the piece saves to the job as Matt's; the
   piece's own wording stays with the piece. Only the owner saves (D87).

     GVC_PIECEMODE.start(adapter)   each tool's job-mode.js calls this once:
       tool, label, prefix          the documents tool, its name in the bar, its file name's first words
       owners                       ['listing'] or ['listing', 'pitch']
       panel                        the element the bar and facts go above
       kitKey                       the folder-health piece that proves a file is in the folder
       map                          true: also read the job's map (the pitch-map record's file)
       lay(saved, row, prev)  → { redone }   put the saved piece and the job on the tool
       wants(drive)           → { photos: [path], plans: [plan], map: {path, modified}|null }
       apply(read)                   put what Drive gave ({ photos, plans, map, failed }) on the tool and draw
       state()                → the tool's state as the piece prints it
       storable()             → that state with pictures as paths only (Save sheet)
       printable()            → that state with what it prints inline (the helper)
       builtCtx()             → { photos, plans, map } for built_from
       paper()                → 'letter' | 'half' | null
       afterLay()                    the tool's own panel tweaks (read-only agents…)
     GVC_PIECEMODE.ready / row / doc / me / canEdit / saveSheet() / savePdf()

   window.__pieceTimeoutMs and window.__pieceRetryMs shorten waits in tests.
   ============================================================ */
(function (global) {
  'use strict';
  var P = global.GVC_PROPS, J = global.GVC_PIECEJOB, SJ = global.GVC_SHEETJOB, ST = global.GVC_STALE, F = global.GVC_FACTS;
  var R = global.GVC_DRIVE_RULES, IM = global.GVC_IMAGES;
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var IMG = /\.(jpe?g|png|webp)$/i;
  var MARKET = { NYC: 'New York', NJ: 'New Jersey', FL: 'Florida' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONEY = ['price', 'rent', 'maintenance', 'commonCharges', 'taxesMonthly', 'closePrice', 'priceLow', 'priceMid', 'priceHigh'];
  var LABELS = { rent: 'Rent per month', city: 'Town', closePrice: 'Closing price', comps: 'Comps', priceLow: 'Low price', priceMid: 'Recommended price',
    priceHigh: 'High price', recBand: 'Recommended band', mapAddresses: 'Mapped addresses', features: 'Features', description: 'Description' };

  var M = global.GVC_PIECEMODE = { ready: false, row: null, doc: null, mapDoc: null, me: null, canEdit: false, busy: false, noRebuild: {}, redone: [] };
  var A = null, q = new URLSearchParams(location.search), rebuild = q.get('rebuild') === '1';
  var kind = q.has('pitch') ? 'pitch' : 'listing', slug = q.get(kind) || '';
  var TABLE = kind === 'pitch' ? 'pitches' : 'properties', OWNER = kind === 'pitch' ? 'pitch_id' : 'property_id';
  var NOUN = kind === 'pitch' ? 'pitch' : 'job';
  var ms = function () { return global.__pieceTimeoutMs || 20000; };
  function timed(p) {
    return Promise.race([p, new Promise(function (_, no) { setTimeout(function () { var e = new Error('timeout'); e.timeout = true; no(e); }, ms()); })]);
  }
  function rest(path) { return P.call('/rest/v1' + path); }
  function rpc(name, body) {
    return P.call('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return Array.isArray(r) ? r[0] : r; });
  }
  function day(v) { var d = new Date(v); return isNaN(d) ? '' : d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function shownValue(name, v) {
    if (v === null || v === undefined || v === '') return 'none';
    if (name === 'comps' && Array.isArray(v)) return v.length + (v.length === 1 ? ' comp' : ' comps');
    if (Array.isArray(v)) return v.join(', ');
    if (MONEY.indexOf(name) !== -1 && typeof v === 'number') return money(v);
    return String(v);
  }
  function jobHref() { return '../../workspace/job/?' + kind + '=' + encodeURIComponent(slug); }
  function say(t) { var m = $('#pieceMsg'); if (m) m.textContent = t || ''; }

  /* ---------- the panel's own pieces ---------- */
  function hosts() {
    var css = document.createElement('style');
    css.textContent =
      '#pieceBar{padding:14px 20px;border-bottom:1px solid var(--ui-rule);font-size:13.5px;line-height:1.45;color:var(--navy)}' +
      '#pieceBar .jb-t{font-weight:700}#pieceBar a{color:inherit}#pieceBar .jb-s{color:var(--ui-ink-soft);margin-top:2px}' +
      '#pieceBar .linkbtn{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}' +
      '#pieceBar .jb-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#pieceBar .jb-n{margin-top:8px;color:var(--ui-ink-soft)}' +
      '#pieceBanner{margin-top:10px;padding:8px 10px;border:1px solid var(--ui-rule);background:var(--ui-paper, #fff)}#pieceBanner ul{margin:4px 0 0;padding-left:18px}' +
      '#pieceMsg{margin:8px 0 0;min-height:1.2em}' +
      '#pieceFacts{padding:12px 20px;border-bottom:1px solid var(--ui-rule);font-size:13px}' +
      '#pieceFacts h3{margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ui-ink-soft)}' +
      '#pieceFacts .jf{padding:5px 0;border-top:1px solid var(--ui-rule)}#pieceFacts .jf:first-of-type{border-top:0}' +
      '#pieceFacts .jl{display:inline-block;min-width:118px;color:var(--ui-ink-soft)}#pieceFacts .jv{font-weight:600;color:var(--navy)}' +
      '#pieceFacts .chip{display:inline-block;margin-left:6px;padding:0 6px;border:1px solid var(--ui-rule);border-radius:9px;font-size:11px}' +
      '#pieceFacts .jfo,#pieceFacts .jfe{color:var(--ui-ink-soft);font-size:12px;margin-top:2px}#pieceFacts .jfw{font-size:12px;margin-top:2px;font-weight:600}' +
      '#pieceFacts .jfw::before{content:"\\26A0  "}#pieceFacts .jfe label{margin-left:8px}' +
      '#piecePhotoMsg{margin:8px 0 0;font-size:12.5px}' +
      'body.piece-mode #propBar{display:none}';
    document.head.appendChild(css);
    document.body.classList.add('piece-mode');
    var panel = (A && A.panel && $(A.panel)) || document.body;
    var bar = document.createElement('div'); bar.id = 'pieceBar'; bar.hidden = true;
    var facts = document.createElement('div'); facts.id = 'pieceFacts'; facts.hidden = true;
    panel.insertBefore(facts, panel.firstChild);
    panel.insertBefore(bar, facts);
  }
  function fail(html) { var bar = $('#pieceBar'); if (!bar) return; bar.innerHTML = html; bar.hidden = false; }

  /* ---------- the bar ---------- */
  function staleOpts() {
    var o = { fileFound: M.fileFound || !!((((M.row.scan || {}).pieces || {})[A.kitKey]) || []).length };
    if (M.files) {
      o.files = M.files; o.editedPaths = M.editedPaths; o.plans = M.plans;
      if (kind === 'pitch') o.photoPaths = M.pitchPhotos;
    }
    if (M.mapNow) o.map = M.mapNow;
    return o;
  }
  function staleNow() { try { return ST.stale(M.doc, M.row, staleOpts()); } catch (e) { return { state: 'none', changes: [] }; } }
  function fileLinks() {
    var out = M.doc && M.doc.output;
    if (!out || out.via !== 'helper' || !/^https:\/\/drive\.google\.com\//.test(String(out.url || ''))) return '';
    return ' · <a data-open href="' + esc(out.url) + '" target="_blank" rel="noopener">Open</a>' +
      ' · <button type="button" class="linkbtn" data-copy>Copy Drive link</button>';
  }
  function stateWords(s) {
    var out = M.doc && M.doc.output;
    if (s.state === 'none') return 'Not made yet';
    if (s.state === 'untracked') return 'Made before the workspace kept track';
    var when = (out && out.madeAt) || M.doc.built_at;
    var made = (new Date(when).toDateString() === new Date().toDateString() ? 'Made today' : 'Made ' + day(when)) +
      (out && out.paper ? ' · ' + String(out.paper).toUpperCase() : '') + (out && out.via === 'print' ? ' · printed by hand, file not tracked' : '');
    return s.state === 'stale' ? 'Stale: ' + ST.words(s.changes) + ' · ' + made : made;
  }
  function banner(s) {
    if (!rebuild || s.state !== 'stale') return '';
    var lines = s.changes.filter(function (c) { return ['interiorFeatures', 'buildingFeatures', 'features', 'comps', 'mapAddresses'].indexOf(c.field) === -1; })
      .map(function (c) {
        var was = Array.isArray(c.was) && c.field !== 'agents' ? c.was.length + ' files' : shownValue(c.field, c.was);
        var now = Array.isArray(c.now) && c.field !== 'agents' ? c.now.length + ' files' : shownValue(c.field, c.now);
        return esc(c.label) + ' ' + esc(was) + ' → ' + esc(now);
      });
    s.changes.forEach(function (c) { if (c.field === 'comps') lines.push('Comps changed on the job'); });
    if (M.redone.length) lines.push('The feature list changed on the job; the bullets were redone from it');
    return '<div id="pieceBanner"><b>Rebuild: what changed since the last ' + esc(A.label.toLowerCase()) + '</b><ul>' +
      lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>Check it, then press Save PDF to Drive.</div>';
  }
  function drawBar() {
    var bar = $('#pieceBar'), r = M.row, c = r.core || {};
    var s = staleNow(), ag = SJ.agentsOf(r);
    var html = '<div class="jb-t">' + esc(A.label) + ' for ' + esc(c.address || r.label || slug) + (c.unit ? ' · ' + esc(c.unit) : '') +
      ' · <a data-back href="' + esc(jobHref()) + '">← ' + (kind === 'pitch' ? 'Pitch page' : 'Job page') + '</a></div>' +
      '<div class="jb-s">' + esc(MARKET[r.market] || 'New York') + ' · <span id="pieceState">' + esc(stateWords(s)) + '</span>' + fileLinks() + '</div>';
    var note = A.note ? A.note(r) : '';
    if (note) html += '<div class="jb-n">' + esc(note) + '</div>';
    if (J.maxAgents(A.tool) && !ag.confirmed) {
      html += '<div class="jb-n">Agents not confirmed on the ' + NOUN + ': Asana\'s suggestion prints for now. <a href="' + esc(jobHref()) + '">Confirm them on the ' + NOUN + ' page</a>.</div>';
    }
    if (J.maxAgents(A.tool) && SJ.agentsOf(r).ids.length > J.maxAgents(A.tool)) {
      html += '<div class="jb-n">This ' + esc(A.label.toLowerCase()) + ' prints the first ' + J.maxAgents(A.tool) + ' of the ' + NOUN + '\'s ' + SJ.agentsOf(r).ids.length + ' agents.</div>';
    }
    if (M.canEdit) html += '<div class="jb-b"><button type="button" class="btn sm" id="btnPieceSave">Save sheet</button>' +
      '<button type="button" class="btn sm" id="btnPiecePdf">Save PDF to Drive</button></div>';
    else html += '<div class="jb-n">Read only: only the owner account saves this ' + esc(A.label.toLowerCase()) + '. Print still works.</div>';
    html += banner(s) + '<p id="pieceMsg" role="status"></p>';
    var keep = $('#pieceMsg') ? $('#pieceMsg').textContent : '';
    bar.innerHTML = html;
    bar.hidden = false;
    say(keep);
    var b1 = $('#btnPieceSave'), b2 = $('#btnPiecePdf');
    if (b1) b1.onclick = function () { M.saveSheet(); };
    if (b2) b2.onclick = function () { M.savePdf(); };
    var cp = $('#pieceBar [data-copy]');
    if (cp) cp.onclick = function () {
      var url = M.doc && M.doc.output && M.doc.output.url;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard'))).then(function () { say('Drive link copied.'); }, function () { say(url); });
    };
    busy(M.busy);
  }
  function busy(on) { M.busy = !!on; $$('#btnPieceSave, #btnPiecePdf').forEach(function (b) { b.disabled = M.busy; }); }

  /* ---------- the facts block ---------- */
  function labelOf(name) {
    var f = F.fieldsFor(M.row).filter(function (x) { return x.name === name; })[0] || F.FIELDS.filter(function (x) { return x.name === name; })[0];
    return LABELS[name] && (!f || name === 'rent' || name === 'city') ? LABELS[name] : (f ? f.label : (LABELS[name] || name));
  }
  function drawFacts() {
    var host = $('#pieceFacts'), r = M.row, core = r.core || {};
    var shown = {};
    F.shown(core, r).forEach(function (x) { shown[x.name] = x; });
    var edits = {};
    J.factEdits(A.tool, A.state(), r).edits.forEach(function (e) { edits[e.field === 'halfBaths' ? 'baths' : e.field] = true; });
    var LISTS = ['halfBaths', 'interiorFeatures', 'buildingFeatures', 'features', 'mapAddresses'];
    var rows = J.FIELDS(A.tool, r).filter(function (n) { return LISTS.indexOf(n) === -1; }).map(function (n) {
      var val = J.value(A.tool, r, n);
      var x = shown[n] && J.PITCH_FACTS.indexOf(n) === -1 ? shown[n] : { value: val, badge: val !== null ? (J.PITCH_FACTS.indexOf(n) !== -1 ? 'Matt' : 'earlier tool') : null, others: [] };
      var v = n === 'baths' && J.value(A.tool, r, 'halfBaths') > 0 ? String(x.value) + '.5' : shownValue(n, x.value);
      var out = '<div class="jf" data-jf="' + esc(n) + '"><span class="jl">' + esc(labelOf(n)) + '</span><span class="jv">' + esc(x.value === null || x.value === undefined ? 'Not set' : v) + '</span>' +
        (x.badge ? '<span class="chip">' + esc(x.badge) + '</span>' : '');
      if (x.warn) out += '<div class="jfw">' + esc((x.warn.source || 'DE') + ' says ' + shownValue(n, x.warn.value)) + '</div>';
      (x.others || []).forEach(function (o) {
        if (x.warn && o.source === x.warn.source) return;
        out += '<div class="jfo">' + esc(o.badge + ' says ' + shownValue(n, o.value)) + '</div>';
      });
      if (edits[n] && M.canEdit) {
        out += '<div class="jfe">Changed here: yours, saves to the ' + NOUN +
          '<label><input type="checkbox" data-typo="' + esc(n) + '"' + (M.noRebuild[n] ? ' checked' : '') + '> Typo, no rebuild</label></div>';
      }
      return out + '</div>';
    }).join('');
    var lists = ['interiorFeatures', 'buildingFeatures', 'features'].filter(function (n) { return J.FIELDS(A.tool, r).indexOf(n) !== -1; }).map(function (n) {
      var v = J.value(A.tool, r, n);
      return Array.isArray(v) && v.length ? '<div class="jf" data-jf="' + n + '"><span class="jl">' + esc(labelOf(n)) + '</span><span class="jv">' + v.length + ' on the ' + NOUN + '</span></div>' : '';
    }).join('');
    host.innerHTML = '<h3>Facts from the ' + NOUN + '</h3>' + rows + lists +
      '<p class="note">Change a fact in the sections below and it saves to the ' + NOUN + ' when you save. Lists come from the ' + NOUN + ' page.</p>' +
      '<p class="note" style="margin-top:12px">Photos' + (A.plans ? ', floorplans' : '') + (A.map ? ' and the map' : '') + ' come from the ' + NOUN + '\'s Drive folder. ' +
      '<a href="' + esc(jobHref()) + '">' + (kind === 'pitch' ? 'Open the pitch page' : 'Change picks on the job page') + '</a>.</p><div id="piecePhotoMsg" role="status"></div>';
    host.hidden = false;
    $$('#pieceFacts [data-typo]').forEach(function (b) { b.addEventListener('change', function () { M.noRebuild[b.dataset.typo] = b.checked; }); });
    photoNote();
  }
  var lastPhotoHtml = '';
  function photoNote() { var m = $('#piecePhotoMsg'); if (m) m.innerHTML = lastPhotoHtml; wireReconnect(); }
  function setPhotoHtml(h) { lastPhotoHtml = h; photoNote(); }
  var redrawTimer = null;
  document.addEventListener('input', function (e) {
    if (!M.row || (e.target.closest && e.target.closest('#pieceFacts'))) return;
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(drawFacts, 150);
  });
  function drawAll() { if (!M.row) return; drawBar(); drawFacts(); }

  /* ---------- loading ---------- */
  function lay() {
    var saved = M.doc && M.doc.state && typeof M.doc.state === 'object' ? JSON.parse(JSON.stringify(M.doc.state)) : null;
    var lists = saved && saved.listsFrom && typeof saved.listsFrom === 'object' ? saved.listsFrom : null;
    if (saved) delete saved.listsFrom;
    M.laidVersion = M.row.version;   // the job as the piece was filled; only the piece's own saves move it
    var names = J.FIELDS(A.tool, M.row).filter(function (n) { return /features$/i.test(n); });
    M.laidLists = {};
    names.forEach(function (n) { M.laidLists[n] = J.value(A.tool, M.row, n); });
    var r = A.lay(saved, M.row, lists ? { facts: lists } : (M.doc && M.doc.built_from) || null) || {};
    M.redone = r.redone || [];
    if (A.afterLay) A.afterLay(M.canEdit);
    lockForTeam();
  }
  /* a teammate sees the piece read-only; run after every draw, since a draw rebuilds rows */
  function lockForTeam() {
    if (M.canEdit) return;
    var root = A.panel || 'body';
    $$(root + ' input, ' + root + ' textarea, ' + root + ' select, ' + root + ' .seg button').forEach(function (el) {
      if (el.closest('#pieceBar, #pieceFacts')) return;
      if (el.tagName === 'SELECT' || el.tagName === 'BUTTON' || el.type === 'checkbox' || el.type === 'range' || el.type === 'file') el.disabled = true; else el.readOnly = true;
    });
  }
  function load() {
    return rest('/' + TABLE + '?slug=eq.' + encodeURIComponent(slug) + '&select=*').then(function (rows) {
      var row = rows && rows[0];
      if (!row) {
        fail('<div class="jb-t">No ' + NOUN + ' called "' + esc(slug) + '"</div><div class="jb-s">It may have been renamed or never existed. <a href="../../workspace/">Back to the overview</a></div>');
        return null;
      }
      var docs = '/documents?' + OWNER + '=eq.' + encodeURIComponent(row.id) + '&select=*';
      return Promise.all([rest(docs).catch(function () { return []; }), P.whoAmI().then(null, function () { return { role: null }; })]).then(function (r) {
        var all = r[0] || [];
        M.row = row; M.me = r[1] || {};
        M.doc = all.filter(function (d) { return d.tool === A.tool; })[0] || null;
        M.mapDoc = A.map ? all.filter(function (d) { return d.tool === 'pitch-map'; })[0] || null : null;
        M.canEdit = M.me.role === 'owner';
        lay();
        drawAll();
        return readDrive();
      });
    });
  }
  function reloadRow() {
    return rest('/' + TABLE + '?id=eq.' + encodeURIComponent(M.row.id) + '&select=*').then(function (rows) { if (rows && rows[0]) M.row = rows[0]; drawAll(); });
  }
  function reloadDoc() {
    return rest('/documents?' + OWNER + '=eq.' + encodeURIComponent(M.row.id) + '&tool=eq.' + encodeURIComponent(A.tool) + '&select=*').then(function (rows) {
      M.doc = (rows || [])[0] || null; drawBar();
    });
  }

  /* ---------- Drive ---------- */
  function wireReconnect() {
    var b = $('#pieceReconnect');
    if (b) b.onclick = function () {
      global.GVC_DRIVE.reconnect().then(function () { return readDrive(); }).then(drawAll, function (e) { setPhotoHtml(esc(e.message)); });
    };
  }
  function flat(node, base, out) {
    (node && node.children || []).forEach(function (c) {
      var p = base ? base + '/' + c.name : c.name;
      if (c.kind === 'directory') { if (!/^archive$/i.test(c.name)) flat(c, p, out); }
      else out.push({ path: p, name: c.name, modified: c.modified || null });
    });
    return out;
  }
  function readDrive() {
    M.loading = true; M.driveFailed = false;
    var done = function () { M.loading = false; };
    return readDriveNow().then(done, function (e) { done(); throw e; });
  }
  function readDriveNow() {
    var D = global.GVC_DRIVE, row = M.row;
    if (!row.drive_folder) { setPhotoHtml(esc('This ' + NOUN + ' has no Drive folder linked yet. Link it on the ' + NOUN + ' page to bring in photos.')); return Promise.resolve(); }
    return D.state().then(function (st) {
      M.drive = st;
      if (st === 'unsupported') { setPhotoHtml('This browser can\'t read Drive. Photos come in on the desktop in Chrome.'); return; }
      if (st !== 'connected') {
        setPhotoHtml('Connect Drive on this desktop to bring in photos. <button type="button" class="btn sm ghost" id="pieceReconnect">Reconnect</button>');
        return;
      }
      setPhotoHtml('Reading the folder…');
      return timed(D.tree(row.drive_folder, { timeoutMs: ms() })).then(function (tree) {
        var ok = function (f) { return !f.archived && R.allowedInJob(f.path) && !R.isJunk(f.name) && !R.isPaperwork(f.name); };
        var photos, plans = [];
        if (kind === 'listing') {
          var h = global.GVC_HEALTH.health(tree, { market: row.market, driveRoot: String(row.drive_folder).split('/')[0], isNew: false });
          photos = (h.pieces.photos || []).filter(ok).filter(function (f) { return IMG.test(f.name); });
          plans = (h.pieces.floorplan || []).filter(ok);
          M.fileFound = (h.pieces[A.kitKey] || []).length > 0;
        } else {
          photos = flat(tree, '', []).filter(ok).filter(function (f) { return IMG.test(f.name); });
          M.fileFound = !!(M.doc && M.doc.output);
        }
        var all = flat(tree, '', []);
        M.files = {};
        photos.concat(plans).forEach(function (f) { M.files[f.path] = { modified: f.modified }; });
        M.editedPaths = kind === 'listing' ? photos.map(function (f) { return f.path; }) : null;
        M.pitchPhotos = kind === 'pitch' ? J.pitchPhotos(photos) : null;
        M.plans = J.pickFloorplans(plans);
        var mo = M.mapDoc && M.mapDoc.output;
        if (mo && mo.path) {
          var hit = all.filter(function (f) { return f.path.toLowerCase() === String(mo.path).toLowerCase(); })[0];
          M.mapNow = hit ? { path: hit.path, modified: hit.modified || mo.modified || null } : null;
        }
        var want = A.wants({ row: row, editedPaths: M.editedPaths, pitchPhotos: M.pitchPhotos, plans: M.plans, map: M.mapNow || null });
        return readFiles(want);
      }, function (e) {
        M.driveFailed = true;
        setPhotoHtml(esc(e.timeout ? 'Drive didn\'t answer in time. Reload to try again.' : e.message));
      });
    }).catch(function (e) {
      M.driveFailed = true;
      setPhotoHtml(esc((e && e.message) || 'Drive could not be read.'));
    });
  }
  function readFile(path) { return timed(global.GVC_DRIVE.readJobFile(M.row.drive_folder, path, { timeoutMs: ms() })); }
  function pool(tasks, n) {
    var out = new Array(tasks.length), next = 0;
    function worker() {
      if (next >= tasks.length) return Promise.resolve();
      var i = next++;
      return tasks[i]().then(function (v) { out[i] = { ok: true, v: v }; }, function (e) { out[i] = { ok: false, e: e }; }).then(worker);
    }
    var ws = [];
    for (var k = 0; k < Math.min(n, tasks.length); k++) ws.push(worker());
    return Promise.all(ws).then(function () { return out; });
  }
  function photoOf(path) {
    return readFile(path).then(IM.fileToImage).then(function (img) {
      return { src: IM.reencode(img, 2000, 0.87), w: img.naturalWidth, h: img.naturalHeight };
    });
  }
  function planOf(path) {
    return readFile(path).then(IM.fileToImage).then(function (img) {
      return { src: IM.reencode(img, 2400, 0.9, IM.trimRect(img, IM.floorplanHeaderY(img))), w: img.naturalWidth, h: img.naturalHeight };
    });
  }
  function mapOf(path) {
    return readFile(path).then(IM.fileToImage).then(function (img) { return { src: IM.reencode(img, 2400, 0.9), w: img.naturalWidth, h: img.naturalHeight }; });
  }
  function readFiles(want) {
    want = want || {};
    var photos = (want.photos || []).slice(0, 24), plans = (want.plans || []).slice(0, 4), map = want.map || null;
    var tasks = photos.map(function (p) { return function () { return photoOf(p); }; })
      .concat(plans.map(function (p) { return function () { return planOf(p.path); }; }))
      .concat(map ? [function () { return mapOf(map.path); }] : []);
    M.reading = tasks.length;
    return pool(tasks, 4).then(function (res) {
      M.reading = 0;
      var failed = [], read = { photos: [], plans: [], map: null, failed: failed };
      photos.forEach(function (p, i) {
        if (!res[i].ok) { failed.push(p); return; }
        read.photos.push(Object.assign({ path: p, name: p.split('/').pop(), modified: (M.files[p] || {}).modified || null }, res[i].v));
      });
      plans.forEach(function (p, i) {
        var x = res[photos.length + i];
        if (!x.ok) { failed.push(p.path); return; }
        read.plans.push(Object.assign({}, p, x.v));
      });
      if (map) {
        var mres = res[photos.length + plans.length];
        if (mres.ok) read.map = Object.assign({}, map, mres.v); else failed.push(map.path);
      }
      M.failed = failed;
      M.read = read;
      A.apply(read);
      lockForTeam();
      setPhotoHtml(failed.length ? esc('Drive hasn\'t downloaded this yet: ' + failed.map(function (f) { return f.split('/').pop(); }).join(', ') +
        '. Open the folder in File Explorer to download it, then reload.') : '');
    });
  }

  /* ---------- saving ---------- */
  var CONFLICT = 'This ' + NOUN + ' changed a moment ago. Reloaded; try again.';
  function storable() {
    var d = A.storable();
    d.listsFrom = M.laidLists;
    return d;
  }
  function saveFacts() {
    var fe = J.factEdits(A.tool, A.state(), M.row);
    if (fe.errors.length) return Promise.reject(new Error(fe.errors[0].error));
    if (!fe.edits.length) return Promise.resolve(M.row);
    var nr = Object.assign({}, M.noRebuild);
    if (nr.baths) nr.halfBaths = true;
    var ap = J.applyEdits(A.tool, M.row, fe.edits, { noRebuild: nr });
    var from = M.row.version;
    return rpc('save_job', { p_table: TABLE, p_id: M.row.id, p_version: M.row.version, p_set: ap.set, p_changes: ap.changes }).then(function (row) {
      if (row && row.id) { if (from === M.laidVersion) M.laidVersion = row.version; M.row = row; }
      M.noRebuild = {};
      return M.row;
    }, function (e) {
      var msg = String((e && e.message) || '');
      if (/conflict/.test(msg)) return reloadRow().then(function () { throw new Error(CONFLICT); }, function () { throw new Error(CONFLICT); });
      if (/not allowed/.test(msg)) throw new Error('Only the owner account can change this ' + NOUN + '.');
      throw e;
    });
  }
  function savePiece(bf, output, archived) {
    return rpc('save_piece_of', {
      p_table: TABLE, p_id: M.row.id, p_tool: A.tool, p_version: M.doc ? M.doc.version : null,
      p_state: storable(), p_built_from: bf || null, p_output: output || null, p_archived: archived || null
    }).then(function (doc) { if (doc) M.doc = doc; return M.doc; }, function (e) {
      if (/conflict/.test(String((e && e.message) || ''))) {
        return reloadDoc().then(function () { throw new Error('This ' + A.label.toLowerCase() + ' was saved somewhere else a moment ago. Its record is reloaded; press save again.'); });
      }
      throw e;
    });
  }
  M.saveSheet = function () {
    if (!M.canEdit || M.busy) return Promise.resolve(false);
    // what the piece shows is what is kept: never while Drive is still bringing it in
    if (M.loading || M.reading) { say('Drive is still reading the ' + NOUN + '\'s folder; wait a moment, then save.'); return Promise.resolve(false); }
    busy(true); say('Saving…');
    return saveFacts().then(function () { return savePiece(null, null, null); }).then(function () {
      drawAll(); say('Saved. The facts are on the ' + NOUN + '; the wording and crops are kept with the ' + A.label.toLowerCase() + '.'); return true;
    }, function (e) { drawAll(); say(e.message); return false; }).then(function (ok) { busy(false); return ok; });
  };

  var NOT_RECORDED = 'Saved to Drive, but the ' + NOUN + ' didn\'t record it. Press Save PDF to Drive again or reload.';
  function retryMs() { return global.__pieceRetryMs || 1000; }
  function pause(n) { return new Promise(function (r) { setTimeout(r, n); }); }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function notReady() {
    var r = M.row;
    if (r.drive_folder && M.drive === 'unsupported') return 'This browser can\'t read Drive. Save the PDF from Chrome on the desktop.';
    if (r.drive_folder && M.drive !== 'connected') return 'Connect Drive on this desktop first, so the ' + A.label.toLowerCase() + ' has its photos.';
    if (r.drive_folder && M.loading) return 'Drive is still reading the ' + NOUN + '\'s folder; wait a moment.';
    if (r.drive_folder && M.driveFailed) return 'Drive didn\'t finish reading the ' + NOUN + '\'s folder. Reload to try again.';
    if (M.reading) return 'Drive hasn\'t downloaded the photos yet; wait or reload.';
    var miss = (M.failed || [])[0];
    if (miss) return 'Drive hasn\'t downloaded ' + miss.split('/').pop() + ' yet; wait or reload.';
    return A.notReady ? A.notReady() : null;
  }
  function record(bf, output, archived, failMsg) {
    var tries = 0;
    function attempt() {
      tries++;
      return savePiece(bf, output, archived).catch(function () {
        var landed = function () { var o = M.doc && M.doc.output; return !!o && o.name === output.name && o.madeAt === output.madeAt; };
        var next = function () {
          if (landed()) return M.doc;
          if (tries >= 3) throw new Error(failMsg || NOT_RECORDED);
          return pause(retryMs()).then(attempt);
        };
        return reloadDoc().then(next, next);
      });
    }
    return attempt();
  }
  function byHand(bf) {
    var c = M.row.core || {};
    var name = A.prefix + ' - ' + [c.address, c.unit].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g, '-') + ' - ' + today();
    var title = document.title;
    document.title = name;
    try { global.print(); } finally { document.title = title; }
    bf.via = 'print';
    return record(bf, { name: name + '.pdf', paper: A.paper() || null, madeAt: new Date().toISOString(), via: 'print' }, null,
      'Printed, but the ' + NOUN + ' didn\'t record it. Press Save PDF to Drive again or reload.').then(function () {
      return 'Printed by hand, file not tracked. Save it into the ' + NOUN + '\'s folder yourself.';
    });
  }
  M.savePdf = function () {
    if (!M.canEdit || M.busy) return Promise.resolve(false);
    var why = notReady();
    if (why) { say(why); return Promise.resolve(false); }
    busy(true); say('Saving the facts…');
    return saveFacts().then(function () {
      return reloadRow().then(function () {
        if (M.row.version !== M.laidVersion) {
          throw new Error('This ' + NOUN + ' changed somewhere else since this opened. Reload the page to bring the change in, then save.');
        }
      });
    }).then(function () {
      var bf = J.builtFrom(A.tool, { paper: A.paper() }, M.row, Object.assign({}, A.builtCtx(), { via: 'helper' }));
      say('Making the PDF…');
      var shell = global.GVC_SHELL, body = { tool: A.tool, state: A.printable(), paper: A.paper() || undefined };
      body[kind === 'pitch' ? 'pitchId' : 'propertyId'] = M.row.id;
      var ask = shell && shell.helper ? shell.helper('POST', '/piece', body) : Promise.reject(new Error('no helper'));
      return ask.then(function (reply) {
        if (!reply || !reply.ok) throw Object.assign(new Error((reply && reply.error) || 'The helper couldn\'t make the PDF.'), { refused: true });
        var output = { path: reply.path, name: reply.name, size: reply.size, modified: reply.modified, url: reply.url || null,
          paper: A.paper() || null, madeAt: new Date().toISOString(), via: 'helper' };
        return record(bf, output, reply.archived || null).then(function () {
          var a = reply.archived;
          return 'Saved to Drive: ' + reply.name + '.' + (a && a.to ? ' The older one is in Archive.' : a && a.why ? ' The ' + a.why + '.' : '');
        });
      }, function (e) {
        if (e && e.refused) throw e;
        return byHand(bf);   // the helper isn't here
      });
    }).then(function (msg) { drawAll(); say(msg); return true; }, function (e) { drawAll(); say(e.message); return false; })
      .then(function (ok) { busy(false); return ok; });
  };
  M._ = { drawAll: drawAll, say: say, esc: esc, readDrive: readDrive };

  /* ---------- start ---------- */
  M.start = function (adapter) {
    A = adapter;
    hosts();
    if (A.owners.indexOf(kind) === -1) {
      fail('<div class="jb-t">' + esc(A.label) + ' isn\'t made from a ' + NOUN + '.</div><div class="jb-s"><a href="../../workspace/">Back to the overview</a></div>');
      M.ready = true;
      return Promise.resolve(null);
    }
    var waitTool = new Promise(function (ok) {
      (function tick(n) { if (!A.ready || A.ready() || n > 200) ok(); else setTimeout(function () { tick(n + 1); }, 25); })(0);
    });
    return waitTool.then(function () {
      return P.signedIn() ? true : P.askSignIn('Sign in to open this ' + NOUN + '\'s ' + A.label.toLowerCase() + '.');
    }).then(function (ok) {
      if (!ok) {
        fail('<div class="jb-t">Sign in to open this ' + NOUN + '\'s ' + esc(A.label.toLowerCase()) + '.</div><div class="jb-s"><a href="">Reload</a> to try again.</div>');
        return null;
      }
      return load();
    }).then(function () { if (M.row) drawAll(); }, function (e) {
      fail('<div class="jb-t">The ' + NOUN + ' couldn\'t load</div><div class="jb-s">' + esc(e.message) + '</div>');
    }).then(function () { M.ready = true; });
  };
})(window);
