/* ============================================================
   PIECE MODE — a tool opened from a job (workspace v2, Slice 5, spec §2):
   the Showsheet, the Brochure, the Postcards, the Seller Package and the
   Signage, at /tools/<tool>/?listing=<slug> (or ?pitch=<slug>).

   blank piece → the piece's saved wording, crops and settings (documents.state)
   → the job laid over it (the rules: GVC_PIECEJOB, or the Showsheet's
   GVC_SHEETJOB through adapter.rules) → photos, floorplans and the map read
   from the job's Drive folder → drawn. A job bar (the job, its market, made /
   stale, Save sheet, Make PDF) and a facts block (each printed fact with its
   badge, other sources and the warning sign) sit at the top of the tool's
   panel. A fact typed on the piece saves to the job as Matt's; the piece's own
   wording stays with the piece. Only the owner saves wording (D87).

   0017 (overturns D89, D91; docs/piece-helper-design.md): the desktop helper
   makes every PDF. Make PDF saves the sheet, then adds a piece request that the
   helper works through (at once when it runs on this desktop, else when it
   next starts); the bar follows the request. Owner, admin, marketing and the
   team account may ask. Print is a plain print and never records anything.
   Photos come from the browser's own Drive when it is connected, else through
   the helper on this desktop (POST /job-tree, /job-file), else Connect Drive.
   With window.__helperBuild (the helper's hidden browser, helper/pdf/lay.js)
   the job, records, folder and files come from the helper, and
   buildPayload() answers what the piece would print.

     GVC_PIECEMODE.start(adapter)   each tool's job-mode.js calls this once:
       tool, label, prefix          the documents tool, its name in the bar, its file name's first words
       owners                       ['listing'] or ['listing', 'pitch']
       panel                        the element the bar and facts go above
       kitKey                       the folder-health piece that proves a file is in the folder
       map                          true: also read the job's map (the pitch-map record's file)
       lay(saved, row, prev)  → { redone }   put the saved piece and the job on the tool
       wants(drive)           → { photos: [path], plans: [plan], map: {path, modified}|null }
                                    drive = { row, editedPaths, pitchPhotos, plans, allPlans, map }
       apply(read)                   put what Drive gave ({ photos, plans, map, failed }) on the tool and draw
       state()                → the tool's state as the piece prints it
       storable()             → that state with pictures as paths only (Save sheet)
       printable()            → that state with what it prints inline (the helper)
       builtCtx()             → { photos, plans, map } for built_from
       paper()                → 'letter' | 'half' | 'a5' | null
       afterLay(canEdit)             the tool's own panel tweaks (read-only agents…)
     optional (the Showsheet):
       ids                    the bar's element ids, when the page has its own (jobBar, jobMsg…)
       rules                  { FIELDS(row, state), value(row, n), factEdits(state, row),
                                applyEdits(row, edits, opts), builtFrom(state, row, ctx), maxAgents }
       labels, editedWords, photoWords, factsExtra   wording in the facts block
       bannerLines(changes, redone)   the Rebuild banner's lines
       afterTree(plans)              the plans in the folder, before any is read
       staleOpts(opts)               the stale check's options, as the piece reads them
       missing(failed)        → path | null   a file Drive didn't bring in that the piece prints
       photoOf(file, path), planOf(file, path) → { src, w, h }   the tool's own image intake
       note(row), notReady()  → a sentence or ''
     GVC_PIECEMODE.ready / row / doc / me / canEdit / canAsk / request / saveSheet() / savePdf() / buildPayload()

   window.__pieceTimeoutMs, __pieceRetryMs and __piecePollMs shorten waits in tests.
   ============================================================ */
(function (global) {
  'use strict';
  var P = global.GVC_PROPS, J = global.GVC_PIECEJOB, SJ = global.GVC_SHEETJOB, ST = global.GVC_STALE, F = global.GVC_FACTS;
  var R = global.GVC_DRIVE_RULES, IM = global.GVC_IMAGES;
  var HB = global.__helperBuild || null;
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var IMG = /\.(jpe?g|png|webp)$/i;
  var MARKET = { NYC: 'New York', NJ: 'New Jersey', FL: 'Florida' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONEY = ['price', 'rent', 'maintenance', 'commonCharges', 'taxesMonthly', 'closePrice', 'priceLow', 'priceMid', 'priceHigh'];
  var LABELS = { rent: 'Rent per month', city: 'Town', closePrice: 'Closing price', comps: 'Comps', priceLow: 'Low price', priceMid: 'Recommended price',
    priceHigh: 'High price', recBand: 'Recommended band', mapAddresses: 'Mapped addresses', features: 'Features', description: 'Description' };
  var ASKERS = ['owner', 'admin', 'marketing', 'shared'];
  var HELPER_MAKES = ['showsheet', 'brochure', 'postcard-listed', 'postcard-sold', 'seller', 'signage'];

  var M = global.GVC_PIECEMODE = { ready: false, row: null, doc: null, mapDoc: null, me: null, canEdit: false, canAsk: false, busy: false,
    noRebuild: {}, redone: [], request: null, source: null };
  var A = null, RU = null, ID = null, q = new URLSearchParams(location.search), rebuild = q.get('rebuild') === '1';
  var kind = q.has('pitch') ? 'pitch' : 'listing', slug = q.get(kind) || '';
  var TABLE = kind === 'pitch' ? 'pitches' : 'properties', OWNER = kind === 'pitch' ? 'pitch_id' : 'property_id';
  var NOUN = kind === 'pitch' ? 'pitch' : 'job';
  var ms = function () { return global.__pieceTimeoutMs || 20000; };
  function timed(p) {
    return Promise.race([p, new Promise(function (_, no) { setTimeout(function () { var e = new Error('timeout'); e.timeout = true; no(e); }, ms()); })]);
  }
  function rest(path) { return HB ? Promise.resolve(hbRest(path)) : P.call('/rest/v1' + path); }
  function rpc(name, body) {
    return P.call('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return Array.isArray(r) ? r[0] : r; });
  }
  function day(v) { var d = new Date(v); return isNaN(d) ? '' : d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function clock(v) {
    var d = new Date(v);
    if (isNaN(d)) return '';
    var h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    var t = ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'am' : 'pm');
    return d.toDateString() === new Date().toDateString() ? t : day(v) + ', ' + t;
  }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function shownValue(name, v) {
    if (v === null || v === undefined || v === '') return 'none';
    if (name === 'comps' && Array.isArray(v)) return v.length + (v.length === 1 ? ' comp' : ' comps');
    if (Array.isArray(v)) return v.join(', ');
    if (MONEY.indexOf(name) !== -1 && typeof v === 'number') return money(v);
    return String(v);
  }
  function jobHref() { return '../../workspace/job/?' + kind + '=' + encodeURIComponent(slug); }
  function el(k) { return document.getElementById(ID[k]); }
  function say(t) { var m = el('msg'); if (m) m.textContent = t || ''; }
  function lower() { return A.label.toLowerCase(); }

  /* ---------- the helper's hidden browser: the job, records, folder and files it hands in ---------- */
  function hbRest(path) {
    var m = /^\/([a-z_]+)\?(.*)$/.exec(path) || [], table = m[1], qs = new URLSearchParams(m[2] || '');
    if (table === TABLE) return [HB.row];
    if (table === 'documents') {
      var tool = qs.get('tool');
      return (HB.docs || []).filter(function (d) { return !tool || 'eq.' + d.tool === tool; });
    }
    return [];
  }
  function hbDrive() {
    return {
      state: function () { return Promise.resolve('connected'); },
      tree: function () { return Promise.resolve(JSON.parse(JSON.stringify(HB.tree))); },
      readJobFile: function (folder, path) {
        return fetch(HB.filePath + '?p=' + encodeURIComponent(path)).then(function (r) {
          if (!r.ok) return r.text().then(function (t) { throw new Error(t || 'The helper couldn\'t read ' + path.split('/').pop() + '.'); });
          return r.blob().then(function (b) { return new File([b], path.split('/').pop(), { type: b.type }); });
        });
      }
    };
  }

  /* ---------- where the photos come from: this browser's Drive, else the helper here ---------- */
  function shell() { return global.GVC_SHELL; }
  function helperHere() {
    var sh = shell();
    if (!sh || !sh.helper) return Promise.resolve(false);
    return sh.helper('GET', '/health').then(function (h) { return !!(h && h.ok && h.paired); }, function () { return false; });
  }
  var HELPER_DRIVE = {
    state: function () { return Promise.resolve('connected'); },
    tree: function (folder) {
      return shell().helper('POST', '/job-tree', { folder: folder }).then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'The helper couldn\'t read the folder.');
        return r.tree;
      });
    },
    readJobFile: function (folder, path) {
      return shell().helper('POST', '/job-file', { folder: folder, file: path }).then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'The helper couldn\'t read ' + path.split('/').pop() + '.');
        var bin = atob(r.data), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], r.name, { type: r.type, lastModified: Date.parse(r.modified) || Date.now() });
      });
    }
  };
  /* → { api, state }: 'connected' (browser Drive or the helper), or the browser's own state to say */
  function pickDrive() {
    if (HB) { M.source = 'helper'; return Promise.resolve({ api: hbDrive(), state: 'connected' }); }
    var D = global.GVC_DRIVE, broke = null;
    var mine = D ? D.state().then(null, function (e) { broke = e; return 'error'; }) : Promise.resolve('unsupported');
    return mine.then(function (st) {
      if (st === 'connected') { M.source = 'drive'; return { api: D, state: st }; }
      return helperHere().then(function (up) {
        if (up) { M.source = 'helper'; return { api: HELPER_DRIVE, state: 'connected' }; }
        M.source = null;
        if (broke) throw broke;   // the browser's own Drive failed and no helper is here: say what failed
        return { api: D, state: st };
      });
    });
  }

  /* ---------- the panel's own pieces ---------- */
  function hosts() {
    var css = document.createElement('style');
    var b = '#' + ID.bar, f = '#' + ID.facts;
    css.textContent =
      b + '{padding:14px 20px;border-bottom:1px solid var(--ui-rule);font-size:13.5px;line-height:1.45;color:var(--navy)}' +
      b + ' .jb-t{font-weight:700}' + b + ' a{color:inherit}' + b + ' .jb-s{color:var(--ui-ink-soft);margin-top:2px}' +
      b + ' .linkbtn{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}' +
      b + ' .jb-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' + b + ' .jb-n{margin-top:8px;color:var(--ui-ink-soft)}' +
      b + ' .jb-r{margin-top:8px;font-weight:600}' +
      b + ' .jb-why{align-self:center;color:var(--ui-ink-soft);font-size:12.5px}' + b + ' .btn:disabled{opacity:.45;cursor:not-allowed}' +
      '#' + ID.banner + '{margin-top:10px;padding:8px 10px;border:1px solid var(--ui-rule);background:var(--ui-paper, #fff)}#' + ID.banner + ' ul{margin:4px 0 0;padding-left:18px}' +
      '#' + ID.msg + '{margin:8px 0 0;min-height:1.2em}' +
      f + '{padding:12px 20px;border-bottom:1px solid var(--ui-rule);font-size:13px}' +
      f + ' h3{margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ui-ink-soft)}' +
      f + ' .jf{padding:5px 0;border-top:1px solid var(--ui-rule)}' + f + ' .jf:first-of-type{border-top:0}' +
      f + ' .jl{display:inline-block;min-width:118px;color:var(--ui-ink-soft)}' + f + ' .jv{font-weight:600;color:var(--navy)}' +
      f + ' .chip{display:inline-block;margin-left:6px;padding:0 6px;border:1px solid var(--ui-rule);border-radius:9px;font-size:11px}' +
      f + ' .jfo,' + f + ' .jfe{color:var(--ui-ink-soft);font-size:12px;margin-top:2px}' + f + ' .jfw{font-size:12px;margin-top:2px;font-weight:600}' +
      f + ' .jfw::before{content:"\\26A0  "}' + f + ' .jfe label{margin-left:8px}' +
      '#' + ID.photoMsg + '{margin:8px 0 0;font-size:12.5px}' +
      'body.piece-mode #propBar{display:none}';
    document.head.appendChild(css);
    document.body.classList.add('piece-mode');
    var panel = (A && A.panel && $(A.panel)) || document.body;
    var bar = el('bar'), facts = el('facts');
    if (!bar) { bar = document.createElement('div'); bar.id = ID.bar; bar.hidden = true; }
    if (!facts) { facts = document.createElement('div'); facts.id = ID.facts; facts.hidden = true; }
    if (!facts.parentNode) panel.insertBefore(facts, panel.firstChild);
    if (!bar.parentNode) facts.parentNode.insertBefore(bar, facts);   // a page with its own bar keeps it where it is
  }
  function fail(html) { var bar = el('bar'); if (!bar) return; bar.innerHTML = html; bar.hidden = false; }

  /* ---------- the bar ---------- */
  function staleOpts() {
    var o = { fileFound: M.fileFound || !!((((M.row.scan || {}).pieces || {})[A.kitKey]) || []).length };
    if (M.files) {
      o.files = M.files; o.editedPaths = M.editedPaths; o.plans = M.plans;
      if (kind === 'pitch') o.photoPaths = M.pitchPhotos;
    }
    if (M.mapNow) o.map = M.mapNow;
    return A.staleOpts ? A.staleOpts(o) : o;
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
  function bannerLines(s) {
    if (A.bannerLines) return A.bannerLines(s.changes, M.redone);
    var lines = s.changes.filter(function (c) { return ['interiorFeatures', 'buildingFeatures', 'features', 'comps', 'mapAddresses'].indexOf(c.field) === -1; })
      .map(function (c) {
        var was = Array.isArray(c.was) && c.field !== 'agents' ? c.was.length + ' files' : shownValue(c.field, c.was);
        var now = Array.isArray(c.now) && c.field !== 'agents' ? c.now.length + ' files' : shownValue(c.field, c.now);
        return esc(c.label) + ' ' + esc(was) + ' → ' + esc(now);
      });
    s.changes.forEach(function (c) { if (c.field === 'comps') lines.push('Comps changed on the job'); });
    if (M.redone.length) lines.push('The feature list changed on the job; the bullets were redone from it');
    return lines;
  }
  function banner(s) {
    if (!rebuild || s.state !== 'stale') return '';
    return '<div id="' + ID.banner + '"><b>Rebuild: what changed since the last ' + esc(A.bannerNoun || lower()) + '</b><ul>' +
      bannerLines(s).map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>Check it, then press Make PDF.</div>';
  }
  /* why Make PDF would certainly be refused, or null (the helper still says anything else) */
  function blocked() {
    if (HELPER_MAKES.indexOf(A.tool) === -1) return 'The helper doesn\'t make the ' + lower() + '.';
    if (!M.row.drive_folder) return 'Link the ' + NOUN + '\'s Drive folder on the ' + NOUN + ' page first: the PDF goes there.';
    return null;
  }
  /* the newest piece request, in words */
  function requestWords() {
    var r = M.request;
    if (!r) return '';
    if (r.status === 'waiting') return 'Waiting for the helper on Matt\'s desktop (asked ' + clock(r.asked_at) + (r.asked_name ? ' by ' + r.asked_name : '') + '). It makes it when it next runs.';
    if (r.status === 'working') return 'The helper is making it now…';
    if (r.status === 'failed') return 'The helper couldn\'t make it: ' + (r.message || 'it stopped.');
    return '';
  }
  function drawBar() {
    var bar = el('bar'), r = M.row, c = r.core || {};
    var s = staleNow(), ag = SJ.agentsOf(r);
    var html = '<div class="jb-t">' + esc(A.label) + ' for ' + esc(c.address || r.label || slug) + (c.unit ? ' · ' + esc(c.unit) : '') +
      ' · <a data-back href="' + esc(jobHref()) + '">← ' + (kind === 'pitch' ? 'Pitch page' : 'Job page') + '</a></div>' +
      '<div class="jb-s">' + esc(MARKET[r.market] || 'New York') + ' · <span id="' + ID.state + '">' + esc(stateWords(s)) + '</span>' + fileLinks() + '</div>';
    var note = A.note ? A.note(r) : '';
    if (note) html += '<div class="jb-n">' + esc(note) + '</div>';
    var max = RU.maxAgents;
    if (max && !ag.confirmed) {
      html += '<div class="jb-n">Agents not confirmed on the ' + NOUN + ': Asana\'s suggestion prints for now. <a href="' + esc(jobHref()) + '">Confirm them on the ' + NOUN + ' page</a>.</div>';
    }
    if (max && ag.ids.length > max) {
      html += '<div class="jb-n">This ' + esc(lower()) + ' prints the first ' + max + ' of the ' + NOUN + '\'s ' + ag.ids.length + ' agents.</div>';
    }
    var why = pdfWhy();
    if (M.canEdit || M.canAsk) {
      // greyed out, with the reason beside it, not only after a click (quick wins)
      html += '<div class="jb-b">' + (M.canEdit ? '<button type="button" class="btn sm" id="' + ID.save + '">Save sheet</button>' : '') +
        '<button type="button" class="btn sm" id="' + ID.pdf + '"' + (why ? ' disabled aria-describedby="' + ID.pdfWhy + '"' : '') + '>Make PDF</button>' +
        (why ? '<span class="jb-why" id="' + ID.pdfWhy + '">' + esc(why) + '</span>' : '') + '</div>';
      if (!M.canEdit) html += '<div class="jb-n">Read only: only the owner account saves this ' + esc(lower()) + '\'s wording. Make PDF asks the helper to make it as last saved.</div>';
    } else {
      // someone who may not ask the helper gets the PDF from Drive, or Matt: never a dead end
      var pdf = M.doc && M.doc.output, got = pdf && /^https:\/\/drive\.google\.com\//.test(String(pdf.url || '')) ? pdf.url : null;
      if (got) html += '<div class="jb-b"><a class="btn sm" data-get href="' + esc(got) + '" target="_blank" rel="noopener">Get PDF</a></div>';
      html += '<div class="jb-n">Read only: only the owner account saves this ' + esc(lower()) + '.' + (got ? '' : ' Ask Matt for the PDF.') + ' Print still works.</div>';
    }
    var rw = requestWords();
    if (rw) html += '<div class="jb-r" data-request="' + esc(M.request.status) + '">' + esc(rw) + '</div>';
    html += banner(s) + '<p id="' + ID.msg + '" role="status"></p>';
    var keep = el('msg') ? el('msg').textContent : '';
    bar.innerHTML = html;
    bar.hidden = false;
    say(keep);
    var b1 = el('save'), b2 = el('pdf');
    if (b1) b1.onclick = function () { M.saveSheet(); };
    if (b2) b2.onclick = function () { M.savePdf(); };
    var cp = $('#' + ID.bar + ' [data-copy]');
    if (cp) cp.onclick = function () {
      var url = M.doc && M.doc.output && M.doc.output.url;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard'))).then(function () { say('Drive link copied.'); }, function () { say(url); });
    };
    busy(M.busy);
  }
  function busy(on) {
    M.busy = !!on;
    var b1 = el('save'), b2 = el('pdf');
    if (b1) b1.disabled = M.busy;
    if (b2) b2.disabled = M.busy || !!pdfWhy();
  }
  /* why Make PDF is greyed out now: the helper would refuse, or (the owner, who saves first) Drive is still reading */
  function pdfWhy() { return blocked() || (M.canEdit ? canSaveNow() : null); }

  /* ---------- the facts block ---------- */
  function labelOf(name) {
    if (A.labels && A.labels[name]) return A.labels[name];
    var f = F.fieldsFor(M.row).filter(function (x) { return x.name === name; })[0] || F.FIELDS.filter(function (x) { return x.name === name; })[0];
    return LABELS[name] && (!f || name === 'rent' || name === 'city') ? LABELS[name] : (f ? f.label : (LABELS[name] || name));
  }
  function drawFacts() {
    var host = el('facts'), r = M.row, core = r.core || {};
    var shown = {};
    F.shown(core, r).forEach(function (x) { shown[x.name] = x; });
    var edits = {};
    RU.factEdits(A.state(), r).edits.forEach(function (e) { edits[e.field === 'halfBaths' ? 'baths' : e.field] = true; });
    var LISTS = ['halfBaths', 'interiorFeatures', 'buildingFeatures', 'features', 'mapAddresses'];
    var fields = RU.FIELDS(r, A.state());
    var rows = fields.filter(function (n) { return LISTS.indexOf(n) === -1; }).map(function (n) {
      var val = RU.value(r, n);
      var x = shown[n] && J.PITCH_FACTS.indexOf(n) === -1 ? shown[n] : { value: val, badge: val !== null ? (J.PITCH_FACTS.indexOf(n) !== -1 ? 'Matt' : 'earlier tool') : null, others: [] };
      var v = n === 'baths' && RU.value(r, 'halfBaths') > 0 ? String(x.value) + '.5' : shownValue(n, x.value);
      var out = '<div class="jf" data-jf="' + esc(n) + '"><span class="jl">' + esc(labelOf(n)) + '</span><span class="jv">' + esc(x.value === null || x.value === undefined ? 'Not set' : v) + '</span>' +
        (x.badge ? '<span class="chip">' + esc(x.badge) + '</span>' : '');
      if (x.warn) out += '<div class="jfw">' + esc((x.warn.source || 'DE') + ' says ' + shownValue(n, x.warn.value)) + '</div>';
      (x.others || []).forEach(function (o) {
        if (x.warn && o.source === x.warn.source) return;
        out += '<div class="jfo">' + esc(o.badge + ' says ' + shownValue(n, o.value)) + '</div>';
      });
      if (edits[n] && M.canEdit) {
        out += '<div class="jfe">' + esc(A.editedWords || 'Changed here: yours, saves to the ' + NOUN) +
          '<label><input type="checkbox" data-typo="' + esc(n) + '"' + (M.noRebuild[n] ? ' checked' : '') + '> Typo, no rebuild</label></div>';
      }
      return out + '</div>';
    }).join('');
    var lists = ['interiorFeatures', 'buildingFeatures', 'features'].filter(function (n) { return fields.indexOf(n) !== -1; }).map(function (n) {
      var v = RU.value(r, n);
      return Array.isArray(v) && v.length ? '<div class="jf" data-jf="' + n + '"><span class="jl">' + esc(labelOf(n)) + '</span><span class="jv">' + v.length + ' on the ' + NOUN + '</span></div>' : '';
    }).join('');
    var words = A.photoWords || ('Photos' + (A.plans ? ', floorplans' : '') + (A.map ? ' and the map' : ''));
    host.innerHTML = '<h3>Facts from the ' + NOUN + '</h3>' + rows + lists +
      '<p class="note">Change a fact in the sections below and it saves to the ' + NOUN + ' when you save. Lists come from the ' + NOUN + ' page.</p>' +
      '<p class="note" style="margin-top:12px">' + esc(words) + ' come from the ' + NOUN + '\'s Drive folder. ' +
      '<a href="' + esc(jobHref()) + '">' + (kind === 'pitch' ? 'Open the pitch page' : 'Change picks on the job page') + '</a>.</p><div id="' + ID.photoMsg + '" role="status"></div>' +
      (A.factsExtra || '');
    host.hidden = false;
    $$('#' + ID.facts + ' [data-typo]').forEach(function (b) { b.addEventListener('change', function () { M.noRebuild[b.dataset.typo] = b.checked; }); });
    photoNote();
    if (A.afterFacts) A.afterFacts();
  }
  var lastPhotoHtml = '';
  function photoNote() { var m = el('photoMsg'); if (m) m.innerHTML = lastPhotoHtml; wireConnect(); }
  function setPhotoHtml(h) { lastPhotoHtml = h; photoNote(); }
  var redrawTimer = null;
  document.addEventListener('input', function (e) {
    if (!M.row || (e.target.closest && e.target.closest('#' + ID.facts))) return;
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(drawFacts, 150);
  });
  function drawAll() { if (!M.row) return; drawBar(); drawFacts(); }

  /* ---------- loading ---------- */
  function lay() {
    var saved = M.doc && M.doc.state && typeof M.doc.state === 'object' ? JSON.parse(JSON.stringify(M.doc.state)) : null;
    var lists = saved && saved.listsFrom && typeof saved.listsFrom === 'object' ? saved.listsFrom : null;
    if (saved) delete saved.listsFrom;
    var names = RU.FIELDS(M.row, A.state()).filter(function (n) { return /features$/i.test(n); });
    M.laidLists = {};
    names.forEach(function (n) { M.laidLists[n] = RU.value(M.row, n); });
    var r = A.lay(saved, M.row, lists ? { facts: lists } : (M.doc && M.doc.built_from) || null) || {};
    M.redone = r.redone || [];
    if (A.afterLay) A.afterLay(M.canEdit);
    lockForTeam();
  }
  /* a teammate sees the piece read-only; run after every draw, since a draw rebuilds rows */
  function lockForTeam() {
    if (M.canEdit) return;
    var root = A.panel || 'body';
    $$(root + ' input, ' + root + ' textarea, ' + root + ' select, ' + root + ' .seg button').forEach(function (x) {
      if (x.closest('#' + ID.bar + ', #' + ID.facts)) return;
      if (x.tagName === 'SELECT' || x.tagName === 'BUTTON' || x.type === 'checkbox' || x.type === 'range' || x.type === 'file') x.disabled = true; else x.readOnly = true;
    });
  }
  M.lockForTeam = lockForTeam;
  function whoAmI() {
    if (HB) return Promise.resolve({ role: 'helper' });
    return P.whoAmI().then(null, function () { return { role: null }; });
  }
  function load() {
    return rest('/' + TABLE + '?slug=eq.' + encodeURIComponent(slug) + '&select=*').then(function (rows) {
      var row = rows && rows[0];
      if (!row) {
        fail('<div class="jb-t">No ' + NOUN + ' called "' + esc(slug) + '"</div><div class="jb-s">It may have been renamed or never existed. <a href="../../workspace/">Back to the overview</a></div>');
        return null;
      }
      var docs = '/documents?' + OWNER + '=eq.' + encodeURIComponent(row.id) + '&select=*';
      return Promise.all([rest(docs).catch(function () { return []; }), whoAmI(), lastRequest(row)]).then(function (r) {
        var all = r[0] || [];
        M.row = row; M.me = r[1] || {};
        M.doc = all.filter(function (d) { return d.tool === A.tool; })[0] || null;
        M.mapDoc = A.map ? all.filter(function (d) { return d.tool === 'pitch-map'; })[0] || null : null;
        M.canEdit = M.me.role === 'owner';
        M.canAsk = ASKERS.indexOf(M.me.role) !== -1;
        M.request = r[2];
        lay();
        drawAll();
        if (M.request && (M.request.status === 'waiting' || M.request.status === 'working')) follow();
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
  function wireConnect() {
    var b = document.getElementById(ID.reconnect);
    if (b) b.onclick = function () {
      var D = global.GVC_DRIVE;
      // the browser has never held Drive here: the folder picker; it held it once: one click back
      D.state().then(function (st) { return st === 'needs-click' ? D.reconnect() : D.connect(); })
        .then(function () { return readDrive(); }).then(drawAll, function (e) {
          setPhotoHtml(e && e.name === 'AbortError' ? 'No folder was picked. Press Connect Drive to try again.' : esc((e && e.message) || 'Drive wasn\'t connected.'));
        });
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
    if (M.row && ID) drawBar();   // "still reading" shows at once, not after the walk
    var done = function () { M.loading = false; if (M.row) drawBar(); };   // the bar follows what Drive brought in
    return readDriveNow().then(done, function (e) { done(); throw e; });
  }
  function readDriveNow() {
    var row = M.row;
    var words = (A.photoWords || 'photos').toLowerCase();
    if (!row.drive_folder) { setPhotoHtml(esc('This ' + NOUN + ' has no Drive folder linked yet. Link it on the ' + NOUN + ' page to bring in ' + words + '.')); return Promise.resolve(); }
    return pickDrive().then(function (pick) {
      var st = pick.state, D = pick.api;
      M.drive = st; M.api = D;
      if (st === 'unsupported') { setPhotoHtml(esc('This browser can\'t read Drive, and the helper isn\'t on this computer. The helper still makes the PDF: press Make PDF.')); return; }
      if (st !== 'connected') {
        setPhotoHtml(esc('Drive isn\'t connected in this browser, and the helper isn\'t on this computer. The helper still makes the PDF.') +
          ' <button type="button" class="btn sm ghost" id="' + ID.reconnect + '">' + (st === 'needs-click' ? 'Reconnect Drive' : 'Connect Drive') + '</button>');
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
        if (A.afterTree) A.afterTree(plans);
        var want = A.wants({ row: row, editedPaths: M.editedPaths, pitchPhotos: M.pitchPhotos, plans: M.plans, allPlans: plans, map: M.mapNow || null });
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
  function readFile(path) { return timed(M.api.readJobFile(M.row.drive_folder, path, { timeoutMs: ms() })); }
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
    return readFile(path).then(function (file) {
      if (A.photoOf) return A.photoOf(file, path);
      return IM.fileToImage(file).then(function (img) { return { src: IM.reencode(img, 2000, 0.87), w: img.naturalWidth, h: img.naturalHeight }; });
    });
  }
  /* the standard Unbranded/ plan has no title band to cut off */
  function planOf(path) {
    return readFile(path).then(function (file) {
      if (A.planOf) return A.planOf(file, path);
      return IM.fileToImage(file).then(function (img) {
        var y = SJ.planPlace(path) === 'unbranded' ? 0 : IM.floorplanHeaderY(img);
        return { src: IM.reencode(img, 2400, 0.9, IM.trimRect(img, y)), w: img.naturalWidth, h: img.naturalHeight };
      });
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
    var fe = RU.factEdits(A.state(), M.row);
    if (fe.errors.length) return Promise.reject(new Error(fe.errors[0].error));
    if (!fe.edits.length) return Promise.resolve(M.row);
    var nr = Object.assign({}, M.noRebuild);
    if (nr.baths) nr.halfBaths = true;
    var ap = RU.applyEdits(M.row, fe.edits, { noRebuild: nr });
    return rpc('save_job', { p_table: TABLE, p_id: M.row.id, p_version: M.row.version, p_set: ap.set, p_changes: ap.changes }).then(function (row) {
      if (row && row.id) M.row = row;
      M.noRebuild = {};
      return M.row;
    }, function (e) {
      var msg = String((e && e.message) || '');
      if (/conflict/.test(msg)) return reloadRow().then(function () { throw new Error(CONFLICT); }, function () { throw new Error(CONFLICT); });
      if (/not allowed/.test(msg)) throw new Error('Only the owner account can change this ' + NOUN + '.');
      throw e;
    });
  }
  function savePiece() {
    return rpc('save_piece_of', {
      p_table: TABLE, p_id: M.row.id, p_tool: A.tool, p_version: M.doc ? M.doc.version : null,
      p_state: storable(), p_built_from: null, p_output: null, p_archived: null
    }).then(function (doc) { if (doc) M.doc = doc; return M.doc; }, function (e) {
      if (/conflict/.test(String((e && e.message) || ''))) {
        return reloadDoc().then(function () { throw new Error('This ' + lower() + ' was saved somewhere else a moment ago. Its record is reloaded; press save again.'); });
      }
      throw e;
    });
  }
  function canSaveNow() {
    // what the piece shows is what is kept: never while Drive is still bringing it in
    if (M.loading || M.reading) return 'Drive is still reading the ' + NOUN + '\'s folder; wait a moment, then save.';
    return null;
  }
  M.saveSheet = function () {
    if (!M.canEdit || M.busy) return Promise.resolve(false);
    var wait = canSaveNow();
    if (wait) { say(wait); return Promise.resolve(false); }
    busy(true); say('Saving…');
    return saveFacts().then(savePiece).then(function () {
      drawAll(); say('Saved. The facts are on the ' + NOUN + '; the wording and crops are kept with the ' + lower() + '.'); return true;
    }, function (e) { drawAll(); say(e.message); return false; }).then(function (ok) { busy(false); return ok; });
  };

  /* ---------- Make PDF: a piece request the helper works through (0017) ---------- */
  function pollMs() { return global.__piecePollMs || 3000; }
  function lastRequest(row) {
    if (HB) return Promise.resolve(null);
    var own = OWNER + '=eq.' + encodeURIComponent(row.id);
    return rest('/piece_requests?' + own + '&tool=eq.' + encodeURIComponent(A.tool) + '&select=*&order=asked_at.desc&limit=1')
      .then(function (rows) { return (rows || [])[0] || null; }, function () { return null; });
  }
  var following = null;
  /* watch the request until the helper finishes it (or 10 minutes pass: the bar keeps saying where it is) */
  function follow() {
    if (following) return following;
    var started = Date.now();
    following = new Promise(function (done) {
      (function tick() {
        setTimeout(function () {
          lastRequest(M.row).then(function (r) {
            var was = M.request && M.request.status;
            M.request = r;
            if (r && r.status === 'done') {
              return reloadDoc().then(function () {
                say('Made: ' + ((r.result && r.result.name) || 'the PDF') + ' is in the ' + NOUN + '\'s folder.');
                M.request = null; drawAll(); done(r);
              });
            }
            if (was !== (r && r.status)) drawBar();
            if (!r || r.status === 'failed' || Date.now() - started > 10 * 60 * 1000) { drawBar(); done(r); return; }
            tick();
          }, function () { tick(); });
        }, pollMs());
      })();
    }).then(function (r) { following = null; return r; });
    return following;
  }
  M.follow = follow;
  function ask() {
    var body = { tool: A.tool };
    body[OWNER] = M.row.id;
    return P.call('/rest/v1/piece_requests', { method: 'POST', body: JSON.stringify(body), prefer: 'return=representation' })
      .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; }, function (e) {
        // one open ask per piece: asking again joins the one already waiting
        if (e && e.status === 409) return lastRequest(M.row);
        if (e && (e.status === 401 || e.status === 403)) throw new Error('This account can\'t ask the helper for a ' + lower() + '.');
        throw e;
      });
  }
  M.savePdf = function () {
    if (!(M.canEdit || M.canAsk) || M.busy) return Promise.resolve(false);
    var why = blocked() || (M.canEdit ? canSaveNow() : null);
    if (why) { say(why); return Promise.resolve(false); }
    busy(true);
    var saved = M.canEdit ? (say('Saving…'), saveFacts().then(savePiece)) : Promise.resolve();
    return saved.then(function () {
      say('Asking the helper…');
      return ask();
    }).then(function (r) {
      M.request = r || null;
      var sh = shell();
      // on the desktop that runs the helper it starts now; anywhere else it starts within 15 seconds of the helper running
      var poke = sh && sh.helper ? sh.helper('POST', '/pieces/run', {}).then(function (x) { return !!(x && x.ok); }, function () { return false; }) : Promise.resolve(false);
      return poke.then(function (here) {
        drawAll();
        say(here ? 'The helper is making it.' : 'Asked. The helper makes it on Matt\'s desktop; this page shows when it is done.');
        follow();
        return true;
      });
    }, function (e) { drawAll(); say(e.message); return false; }).then(function (ok) { busy(false); return ok; });
  };

  /* ---------- the helper's hidden browser: what this piece would print ---------- */
  function notReady() {
    var r = M.row;
    if (!r.drive_folder) return 'This ' + NOUN + ' has no Drive folder linked.';
    if (M.driveFailed) return 'The helper couldn\'t read the ' + NOUN + '\'s folder.';
    if (M.loading || M.reading) return 'The ' + NOUN + '\'s folder was still being read.';
    var miss = A.missing ? A.missing(M.failed || []) : (M.failed || [])[0];
    if (miss) return 'Drive hasn\'t downloaded ' + miss.split('/').pop() + ' on Matt\'s desktop yet. Open the folder in File Explorer once, then ask again.';
    return A.notReady ? A.notReady() : null;
  }
  M.buildPayload = function () {
    if (!M.row) return { why: 'The ' + NOUN + ' couldn\'t be read.' };
    var why = notReady();
    if (why) return { why: why };
    return {
      state: A.printable(),
      storable: storable(),
      builtFrom: RU.builtFrom(A.state(), M.row, Object.assign({}, A.builtCtx(), { via: 'helper', paper: A.paper() || null })),
      paper: A.paper() || null
    };
  };
  M._ = { drawAll: drawAll, say: say, esc: esc, readDrive: readDrive };

  /* ---------- the rules a piece is filled by ---------- */
  function rulesFor(a) {
    if (a.rules) return a.rules;
    return {
      FIELDS: function (row) { return J.FIELDS(a.tool, row); },
      value: function (row, n) { return J.value(a.tool, row, n); },
      factEdits: function (state, row) { return J.factEdits(a.tool, state, row); },
      applyEdits: function (row, edits, opts) { return J.applyEdits(a.tool, row, edits, opts); },
      builtFrom: function (state, row, ctx) { return J.builtFrom(a.tool, { paper: ctx.paper }, row, ctx); },
      maxAgents: J.maxAgents(a.tool)
    };
  }

  /* ---------- start ---------- */
  M.start = function (adapter) {
    A = adapter;
    RU = rulesFor(A);
    ID = Object.assign({ bar: 'pieceBar', facts: 'pieceFacts', msg: 'pieceMsg', photoMsg: 'piecePhotoMsg', save: 'btnPieceSave', pdf: 'btnPiecePdf',
      state: 'pieceState', banner: 'pieceBanner', reconnect: 'pieceReconnect', pdfWhy: 'piecePdfWhy' }, A.ids || {});
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
      if (HB) return true;
      return P.signedIn() ? true : P.askSignIn('Sign in to open this ' + NOUN + '\'s ' + lower() + '.');
    }).then(function (ok) {
      if (!ok) {
        fail('<div class="jb-t">Sign in to open this ' + NOUN + '\'s ' + esc(lower()) + '.</div><div class="jb-s"><a href="">Reload</a> to try again.</div>');
        return null;
      }
      return load();
    }).then(function () { if (M.row) drawAll(); }, function (e) {
      fail('<div class="jb-t">The ' + NOUN + ' couldn\'t load</div><div class="jb-s">' + esc(e.message) + '</div>');
    }).then(function () { M.ready = true; });
  };
})(window);
