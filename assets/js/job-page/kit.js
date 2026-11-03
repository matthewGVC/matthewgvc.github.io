/* ============================================================
   JOB PAGE: the Marketing materials card (spec §2.7, S12, S16, D60, D74; one card, Matt 11-03).

     GVC_JP.kit.html(ctx, inner)      the card: one row per piece, near the top of the page.
                                      Floorplan, Photos and Video: the file found on Drive
                                      against Asana's step (the track). Showsheet, Brochure,
                                      Postcard, Seller Package (with its map) and Signage:
                                      ONE status word per piece made from the job (Not made yet
                                      · Done · Out of date, with what changed · Not tracked),
                                      and every action of the piece together: Make / Update
                                      (the helper, 0017: [data-build], ctx.canAsk, the newest
                                      request's state in [data-build-state]), Open and Copy Drive
                                      link (the helper's PDF, else the file the track found),
                                      Edit (View for one who may not ask), "Ask Matt" otherwise.
                                      The header counts the rows that are done. inner: the
                                      floorplans, photos and posts sections below the rows.
     GVC_JP.kit.piecesHtml(ctx)       a pitch's Pieces card (Seller Package and Map)
     GVC_JP.kit.wire(host, ctx)       the card's controls; Drive's read repaints the rows
     GVC_JP.kit.wirePieces(ctx, host) the made PDFs' Copy Drive link buttons (after each paint)

   Never a file's own name on the card: "Updated 5 Dec · 24 photos", "Made 3 Nov · A5 · 6
   older versions". The track's states: done (file and tick) · fileOpen (file, Asana open) ·
   tickedNoFile · notStarted · notUsed (signage in NYC: no row) · tracked (video, tracked only).
   Drawn from last night's scan at once, then live from Drive when it is connected here. Open
   goes to the file's own page on drive.google.com when Drive is read through Google, else shows
   it from Drive (desktop); Copy Drive link asks the helper (POST /drive-link), else uses the
   scan's stored link, else copies the G: path. A piece with a file but no Asana step to match
   (brochure, signage) says so. Under the rows: the checklist-only steps (Advertising Spots,
   NYC's Just Listed Email).
   ctx.doc is the showsheet's documents row; ctx.onSheet(result) hears each judgement (the
   page's Update button: "Update showsheet", "Update 2 out-of-date pieces").
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var STATE = {
    done: ['Done', 'made dot'], fileOpen: ['File, Asana open', 'stale'], tickedNoFile: ['Ticked, no file', 'stale'],
    notStarted: ['Not started', ''], notUsed: ['Not used here', ''], tracked: ['Tracked only', '']
  };
  var ICON = { floorplan: 'file', photos: 'photo', showsheet: 'file', brochure: 'file', postcard: 'file', signage: 'file', video: 'file' };
  var NO_STEP = ['brochure', 'signage'];
  // the track's keys whose rows are pieces made from the job (their status is the piece's)
  var PIECE_KEYS = ['showsheet', 'brochure', 'postcard', 'signage'];
  // one status word per piece: word, and the chip's class
  var WORD = { none: ['Not made yet', ''], untracked: ['Not tracked', ''], fresh: ['Done', 'made dot'], stale: ['Out of date', 'stale'] };
  var current = {};   // kit key → the newest current piece { path?, name, url? } of the last draw
  var lastTree = null;   // the folder as Drive was last read live here: its folders' Drive links (Drive through Google)
  /* what Open may show as a blob: types that never run script (no svg, no html) */
  var SAFE_EXT = /\.(pdf|jpe?g|png|webp|gif|mp4|mov|m4v|webm)$/i;
  var SAFE_TYPE = /^(application\/pdf|image\/(jpeg|png|webp|gif)|video\/[a-z0-9.+-]+)$/i;
  var TYPE_OF = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm' };
  function keyOf(cur) { for (var k in current) if (current[k] === cur) return k.split(':')[0]; return null; }
  function say(t) { var m = document.getElementById('kitMsg'); if (m) m.textContent = t || ''; if (JP.drive) JP.drive.msgs.kit = t || ''; }

  function ms(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }
  function newest(list, key) {
    return global.GVC_KIT.realFiles(list, key).filter(function (f) { return !f.archived; }).sort(function (a, b) { return ms(b.modified) - ms(a.modified); })[0] || null;
  }

  /* every plan a person may want to open: each level or unit of the newest version, then each
     alternate layout, every one its own way in, so Open never lands on whichever was saved last.
     The branded render of each, where there is one. */
  function planLevels(list) {
    var PJ = global.GVC_PIECEJOB;
    if (!PJ || !PJ.planSets) return [];
    /* last night's scan keeps names and links, not paths: the name stands in for the path there */
    var files = global.GVC_KIT.realFiles(list, 'floorplan').filter(function (f) { return !f.archived && (f.path || f.name); })
      .map(function (f) { return f.path ? f : { name: f.name, path: f.name, modified: f.modified, url: f.url, scanned: true }; });
    var sets = PJ.planSets(files);
    if (!sets.current.length && !sets.alternates.length) return [];
    function entry(p, label, alt) {
      var f = files.filter(function (x) { return x.path === p.path; })[0] || { path: p.path, name: p.path.split('/').pop() };
      return { path: f.scanned ? null : f.path, name: f.name || p.path.split('/').pop(), url: f.url, modified: f.modified, version: p.version, label: label, alternate: alt };
    }
    function words(name) {
      var base = String(name).replace(/\.[a-z0-9]+$/i, '');
      return (base.split(/\s+-\s+/).pop() || base).replace(/\b(unbranded|branded|mls|v\d+)\b/gi, '').replace(/[_\s]+/g, ' ').trim();
    }
    var cur = sets.current.map(function (p) {
      return entry(p, sets.current.length > 1 ? words(p.path.split('/').pop()) : 'Current layout', false);
    });
    var alts = sets.alternates.map(function (p) {
      return entry(p, sets.alternates.length > 1 ? words(p.path.split('/').pop()) : 'Alternate layout', true);
    });
    return cur.concat(alts);
  }


  /* ---------- the Showsheet's record (Slice 4: S15, S20, S21) ----------
     judge(ctx, pieces, live) → GVC_STALE's { state, changes } for the showsheet, or null
     (not a listing, the check isn't loaded, or it couldn't read the record). Live from Drive
     the photo and floorplan dates count too (the same picks the sheet makes); from the scan
     they're unknown. A file found live or in last night's scan counts, as in the sheet's bar. */
  var IMG = /\.(jpe?g|png|webp)$/i;
  var DRIVE_LINK = /^https:\/\/drive\.google\.com\//;
  // the clock the read's file dates are on: Google's (Drive through Google) or G:'s
  function clockOf(files) { return files.some(function (f) { return f.clock === 'google'; }) ? 'google' : 'disk'; }
  function judge(ctx, pieces, live) {
    var ST = global.GVC_STALE;
    if (!ST || ctx.kind !== 'listing') return null;
    pieces = pieces || {};
    var scanned = ((ctx.row.scan && ctx.row.scan.pieces) || {}).showsheet;
    var opts = { fileFound: !!(newest(pieces.showsheet) || newest(scanned)) };
    if (live) {
      var R = global.GVC_DRIVE_RULES;
      var ok = function (f) { return !f.archived && f.path && R.allowedInJob(f.path) && !R.isJunk(f.name); };
      var photos = (pieces.photos || []).filter(ok).filter(function (f) { return IMG.test(f.name); }), plans = (pieces.floorplan || []).filter(ok);
      opts.files = {};
      photos.concat(plans).forEach(function (f) { opts.files[f.path] = { modified: f.modified }; });
      opts.editedPaths = photos.map(function (f) { return f.path; });
      opts.clock = clockOf(photos.concat(plans));
      opts.floorplan = global.GVC_SHEETJOB.pickFloorplan(plans);
    }
    try { return ST.stale(ctx.doc || null, ctx.row, opts); }
    catch (e) { return null; }   // a record the check can't read never takes the page down
  }
  function sheetHref(ctx, rebuild) {
    return '../../tools/showsheet/?listing=' + encodeURIComponent(ctx.row.slug) + (rebuild ? '&rebuild=1' : '');
  }

  /* ---------- 0017: the helper makes a piece from one click (overturns D89, D91) ----------
     Make / Rebuild on a piece asks the helper (a piece_requests row, through the page's
     [data-build] handler); the piece's own page stays one click away as Open. Anyone who may
     ask (ctx.canAsk: owner, admin, marketing, the team account) sees the button, on any device;
     the map is still made in Map Studio. The row says where the newest request is: waiting for
     the helper, being made, or why it couldn't. */
  var HELPER_MAKES = ['showsheet', 'brochure', 'postcard-listed', 'postcard-sold', 'seller', 'signage'];
  function requestOf(ctx, tool) {
    return (ctx.requests || []).filter(function (r) { return r && r.tool === tool; })
      .sort(function (a, b) { return a.asked_at < b.asked_at ? 1 : a.asked_at > b.asked_at ? -1 : 0; })[0] || null;
  }
  function openRequest(ctx, tool) { var r = requestOf(ctx, tool); return r && (r.status === 'waiting' || r.status === 'working') ? r : null; }
  // a request's time of day (named apart from clockOf: a second declaration would replace it)
  function timeOf(v) {
    var d = new Date(v);
    if (isNaN(d)) return '';
    var t = ((d.getHours() % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (d.getHours() < 12 ? 'am' : 'pm');
    return d.toDateString() === new Date().toDateString() ? t : JP.drive.day(v) + ', ' + t;
  }
  /* the request line under a piece, and the one-click button (or '') */
  function buildBits(ctx, tool, s, doc, name) {
    var esc = ctx.esc, out = { line: '', btn: '' };
    if (HELPER_MAKES.indexOf(tool) === -1 || !ctx.canAsk || ctx.kind === 'dev') return out;
    var r = requestOf(ctx, tool), open = openRequest(ctx, tool);
    var builtAt = Date.parse((doc && doc.built_at) || ((doc && doc.output) || {}).madeAt || 0) || 0;
    if (open && open.status === 'working') out.line = 'The helper is making it now…';
    else if (open) out.line = 'Waiting for the helper on Matt\'s desktop (asked ' + timeOf(open.asked_at) + (open.asked_name ? ' by ' + open.asked_name : '') + ')';
    else if (r && r.status === 'failed' && (Date.parse(r.asked_at) || 0) > builtAt) out.line = 'The helper couldn\'t make it: ' + (r.message || 'it stopped.');
    if (out.line) out.line = '<div class="d" data-build-state="' + esc(tool) + '">' + esc(out.line) + '</div>';
    if (s.state !== 'stale' && s.state !== 'none') return out;
    if (!ctx.row.drive_folder) {
      out.line += '<div class="d" data-build-state="' + esc(tool) + '">Link the Drive folder so the helper can make it.</div>';
      return out;
    }
    var label = open ? (open.status === 'working' ? 'Making…' : 'Waiting for the helper') : s.state === 'stale' ? 'Update ' + (name || 'showsheet') : 'Make ' + (name || 'showsheet');
    out.btn = '<button class="b sm primary" type="button" data-build="' + esc(tool) + '"' + (open ? ' disabled' : '') + '>' + esc(label) + '</button>';
    return out;
  }

  /* ---------- the pieces' records (Slice 5: spec S16) ----------
     Each piece made from the job: the Showsheet, the Brochure, the Postcards (Just Listed and
     Just Sold), the Seller Package and its Map (a pitch's Seller and Map on its own page), and
     the Signage. Same words and buttons for each: Not made yet / Up to date / Out of date /
     Not tracked; Make / Open / Rebuild. A teammate sees Get PDF or Ask Matt, never Make. */
  var TOOLS_OF = { brochure: ['brochure'], postcard: ['postcard-listed', 'postcard-sold'], signage: ['signage'] };
  var NAME = { brochure: 'brochure', 'postcard-listed': 'Just Listed postcard', 'postcard-sold': 'Just Sold postcard', seller: 'seller package', 'pitch-map': 'map',
    signage: 'sign' };
  var DIR = { brochure: 'brochure', 'postcard-listed': 'postcard', 'postcard-sold': 'postcard', seller: 'seller-package', 'pitch-map': 'map-studio',
    signage: 'signage' };
  // postcards share one folder (which card a file is can't be told); pitch pieces have no kit folder
  var FOLDER_KEY = { brochure: 'brochure', signage: 'signage' };
  function docOf(ctx, tool) {
    if (tool === 'showsheet') return ctx.doc || (ctx.docs || []).filter(function (d) { return d && d.tool === tool; })[0] || null;
    return (ctx.docs || []).filter(function (d) { return d && d.tool === tool; })[0] || null;
  }
  function judgeTool(ctx, tool, pieces, live) {
    if (tool === 'showsheet') return judge(ctx, pieces, live);
    var ST = global.GVC_STALE, PJ = global.GVC_PIECEJOB;
    if (!ST || !PJ) return null;
    pieces = pieces || {};
    var key = FOLDER_KEY[tool], scanned = key && ((ctx.row.scan && ctx.row.scan.pieces) || {})[key];
    var opts = { fileFound: !!key && !!(newest(pieces[key]) || newest(scanned)) };
    if (live && ctx.kind === 'listing') {
      var R = global.GVC_DRIVE_RULES;
      var ok = function (f) { return !f.archived && f.path && R.allowedInJob(f.path) && !R.isJunk(f.name); };
      var photos = (pieces.photos || []).filter(ok).filter(function (f) { return IMG.test(f.name); }), plans = (pieces.floorplan || []).filter(ok);
      opts.files = {};
      photos.concat(plans).forEach(function (f) { opts.files[f.path] = { modified: f.modified }; });
      opts.editedPaths = photos.map(function (f) { return f.path; });
      opts.clock = clockOf(photos.concat(plans));
      opts.plans = PJ.pickFloorplans(plans);
    }
    try { return ST.stale(docOf(ctx, tool), ctx.row, opts); }
    catch (e) { return null; }
  }
  /* the Photos row points at the whole Photos folder, not its newest file (Sydney's note):
     the folder of that file up to its "Photos" folder, else the file's own folder */
  function photosDir(cur) {
    var segs = String((cur && cur.path) || '').split('/').slice(0, -1);
    for (var i = 0; i < segs.length; i++) if (/^photos$/i.test(segs[i])) return segs.slice(0, i + 1).join('/');
    return segs.length ? segs.join('/') : 'Photos';
  }
  /* a folder's Drive link in the live tree ('Photos/Edits'), or null */
  function dirUrl(tree, rel) {
    var node = tree;
    String(rel || '').split('/').filter(Boolean).forEach(function (n) {
      node = node && (node.children || []).filter(function (c) { return c.kind === 'directory' && c.name === n; })[0];
    });
    return node && node !== tree && DRIVE_LINK.test(node.url || '') ? node.url : null;
  }
  function pieceHref(ctx, tool, rebuild) {
    var q = (ctx.kind === 'pitch' ? 'pitch' : 'listing') + '=' + encodeURIComponent(ctx.row.slug);
    if (tool === 'postcard-sold') q += '&card=sold';
    return '../../tools/' + DIR[tool] + '/?' + q + (rebuild ? '&rebuild=1' : '');
  }
  function soldYet(ctx) {
    var r = ctx.row || {};
    return r.stage === 'Sold' || r.stage === 'Rented' || ((r.core || {}).closePrice != null);
  }
  /* the reason a piece is not up to date, said beside its status word */
  function reasonOf(s) {
    if (s.state === 'untracked') return 'Made before the workspace kept track';
    if (s.state === 'stale') return 'Changed on the job since it was made: ' + global.GVC_STALE.words(s.changes);
    return '';
  }
  /* one piece's lines and its way in: its status word, its reason, its made line, its action(s) */
  function pieceBits(ctx, tool, s, extra) {
    var esc = ctx.esc, doc = docOf(ctx, tool), out = (doc && doc.output) || null, name = NAME[tool] || tool;
    var head = name.charAt(0).toUpperCase() + name.slice(1);
    if (tool === 'postcard-sold' && !soldYet(ctx) && s.state === 'none') {
      return { lines: '<div class="d" data-piece-line="' + esc(tool) + '">' + esc(head) + ': once the job is sold</div>', act: '', linked: false, made: false };
    }
    var word = WORD[s.state] || [s.state, ''];
    var prefix = TOOLS_OF.postcard.indexOf(tool) !== -1 || tool === 'pitch-map' ? esc(head) + ': ' : '';
    var lines = '<div class="d" data-piece-line="' + esc(tool) + '">' + prefix + '<span class="chip ' + word[1] + '" data-piece-state="' + esc(tool) + '">' + esc(word[0]) + '</span></div>';
    var why = reasonOf(s);
    if (why) lines += '<div class="d" data-piece-why="' + esc(tool) + '">' + esc(why) + '</div>';
    var got = DRIVE_LINK.test(String((out && out.url) || '')) ? out.url : null;   // the PDF in Drive, if the helper wrote one
    if (out && (s.state === 'fresh' || s.state === 'stale')) {
      var when = JP.drive.day(out.madeAt || doc.built_at);
      var made = ['Made' + (when ? ' ' + esc(when) : '')];
      if (out.paper) made.push(esc(String(out.paper).toUpperCase()));
      if (out.via === 'print') made.push('printed by hand, file not tracked');
      if (extra) made.push(esc(extra));
      lines += '<div class="d" data-piece-made="' + esc(tool) + '">' + made.join(' · ') + '</div>';
    }
    // the made PDF: Open and Copy Drive link, the same two buttons as the Marketing track's files, for everyone
    var get = got && (s.state === 'fresh' || s.state === 'stale') && out.via !== 'print'
      ? '<a class="b sm ghost" data-piece-get="' + esc(tool) + '" href="' + esc(got) + '" target="_blank" rel="noopener">' + ctx.I('arrow') + 'Open</a>' +
        '<button class="b sm ghost" type="button" data-piece-copy="' + esc(tool) + '">' + ctx.I('copy') + 'Copy Drive link</button>' : '';
    if (HELPER_MAKES.indexOf(tool) !== -1) {
      // 0017: the helper makes it (one click, anyone who may ask); the piece's own page is where its wording changes
      var b = buildBits(ctx, tool, s, doc, tool === 'showsheet' ? '' : name);
      var ask = !ctx.canAsk && !get ? '<span class="soft" data-piece-ask="' + esc(tool) + '">Ask Matt</span>' : '';
      // the showsheet's generator is Claude's to run (Matt 11-02): its row opens the sheet itself, never the tool
      // its own page, where the wording changes: Edit for whoever may make it, View for everyone else
      var open = tool === 'showsheet' ? '' : '<a class="b sm ghost" data-piece="' + esc(tool) + '" href="' +
        esc(pieceHref(ctx, tool, s.state === 'stale' && ctx.canAsk)) + '">' + esc((ctx.canAsk ? 'Edit ' : 'View ') + name) + '</a>';
      return { lines: lines + b.line, act: b.btn + get + ask + open, linked: !!get, made: lines.indexOf('data-piece-made') !== -1 };
    }
    // the map: made by a person in Map Studio; a teammate gets the file or asks Matt
    var flags = { linked: !!get, made: lines.indexOf('data-piece-made') !== -1 };
    if (!ctx.canEdit) return Object.assign({ lines: lines, act: get || '<span class="soft" data-piece-ask="' + esc(tool) + '">Ask Matt</span>' }, flags);
    var a, verb = tool === 'pitch-map' ? 'Make the map' : 'Make ' + name;
    a = s.state === 'fresh' || s.state === 'untracked' ? ['Edit ' + (tool === 'pitch-map' ? 'map' : name), false, 'ghost']
      : s.state === 'stale' ? ['Update ' + name, true, 'primary'] : [verb, false, 'primary'];
    return Object.assign({ lines: lines, act: get + '<a class="b sm ' + a[2] + '" data-piece="' + esc(tool) + '" href="' + esc(pieceHref(ctx, tool, a[1])) + '">' + esc(a[0]) + '</a>' }, flags);
  }
  /* every piece of the job with its judgement, for the header's Rebuild n stale */
  function judgeAll(ctx, pieces, live) {
    var out = [], add = function (tool) { var s = judgeTool(ctx, tool, pieces, live); if (s) out.push({ tool: tool, s: s, href: tool === 'showsheet' ? sheetHref(ctx, true) : pieceHref(ctx, tool, true) }); };
    if (ctx.kind === 'pitch') { add('seller'); add('pitch-map'); return out; }
    if (ctx.kind !== 'listing') return out;
    add('showsheet'); add('brochure');
    if (ctx.row.kind !== 'rental') { add('postcard-listed'); add('postcard-sold'); add('seller'); }
    if (ctx.row.market !== 'NYC' && ctx.row.kind !== 'rental') add('signage');   // no signs in New York; the For Sale sign isn't for a rental
    return out;
  }
  /* one row of a pitch's Pieces card: its pieces' lines and actions, nothing when none applies */
  function pitchRow(ctx, key, title, tools) {
    var lines = '', acts = '', any = false;
    tools.forEach(function (t) {
      var s = judgeTool(ctx, t, {}, false);
      if (!s) return;
      var b = pieceBits(ctx, t, s, '');
      lines += b.lines; acts += b.act; any = true;
    });
    if (!any) return '';
    return '<div class="kr" data-kit="' + ctx.esc(key) + '"><span class="ic">' + ctx.I('file') + '</span><div><div class="t">' + ctx.esc(title) + '</div>' +
      lines + '</div><div class="a">' + acts + '</div></div>';
  }
  /* a pitch's Pieces card: its Seller Package and Map (a listing's pieces are rows of its Marketing card) */
  function piecesHtml(ctx) {
    if (!global.GVC_STALE || !global.GVC_PIECEJOB || ctx.kind !== 'pitch') return '';
    var rows = pitchRow(ctx, 'seller', 'Seller Package', ['seller']) + pitchRow(ctx, 'pitch-map', 'Map', ['pitch-map']);
    if (!rows) return '';
    return '<div class="card" id="piecesCard"><div class="card-h"><div><h2>Marketing materials</h2><p>Made from this pitch: its facts and comps. One status each.</p></div></div>' +
      '<div class="kit">' + rows + '</div></div>';
  }
  /* the Copy Drive link buttons of the pieces the helper made (the rows are repainted, so this runs after each paint) */
  function wirePieces(ctx, host) {
    host = host || document.getElementById('piecesHost');
    if (!host) return;
    host.querySelectorAll('[data-piece-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var doc = docOf(ctx, b.dataset.pieceCopy), url = doc && doc.output && doc.output.url;
        if (!DRIVE_LINK.test(String(url || ''))) return;
        (global.navigator.clipboard ? global.navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard')))
          .then(function () { say('Drive link copied.'); }, function () { say(url); });
      });
    });
  }
  /* ---------- the Marketing card: one row per piece (Matt, 11-03) ----------
     Each row holds everything about its piece: its status (Done, Not made yet, Out of date and
     what changed), the Asana step, and every way in together: Make / Update / Edit, Open, Copy
     Drive link, Open folder. Never a file's own name: a date and a count say which file it is. */
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function olderWords(n) { return n ? plural(n, 'older version') : ''; }
  // the tools a piece's row judges, or null when the piece isn't made for this job
  function pieceTools(ctx, key) {
    var r = ctx.row, rental = r.kind === 'rental';
    if (key === 'showsheet') return ['showsheet'];
    if (key === 'brochure') return ['brochure'];
    if (key === 'postcard') return rental ? null : ['postcard-listed', 'postcard-sold'];
    if (key === 'seller') return rental ? null : ['seller', 'pitch-map'];
    // no signs in New York; the For Sale sign isn't for a rental
    if (key === 'signage') return rental || !global.GVC_MARKETS.signage(r.market) ? null : ['signage'];
    return null;
  }
  // Open and Copy Drive link for a row's current file on Drive
  function fileActs(ctx, key, cur, live) {
    var esc = ctx.esc, out = '';
    if (!cur) return '';
    if (live && cur.path) out += '<button class="b sm ghost" type="button" data-open="' + esc(key) + '">' + ctx.I('arrow') + 'Open</button>';
    else if (cur.url && DRIVE_LINK.test(cur.url)) out += '<a class="b sm ghost" href="' + esc(cur.url) + '" target="_blank" rel="noopener">' + ctx.I('arrow') + 'Open</a>';
    return out + '<button class="b sm ghost" type="button" data-copy="' + esc(key) + '">' + ctx.I('copy') + 'Copy Drive link</button>';
  }
  function stepLine(ctx, x) {
    var esc = ctx.esc, D = JP.drive;
    if (x.step) return 'Asana: ' + esc(x.step.name) + (x.step.done ? ', ticked' + (x.step.doneOn ? ' ' + esc(D.day(x.step.doneOn)) : '') + (x.step.who ? ' by ' + esc(x.step.who) : '') : ', open');
    return x.file && NO_STEP.indexOf(x.key) !== -1 ? 'No Asana step for this piece' : '';
  }
  /* a piece's row: its tools' lines and buttons, then Open and Copy Drive link for the file the
     track found when the helper's record has no Drive link of its own. done: every tool made and
     up to date (the Just Sold postcard only once the job is sold). */
  function pieceRow(ctx, key, title, tools, pieces, live, x) {
    var esc = ctx.esc, lines = '', acts = '', any = false, done = true, linked = false, made = false, cur = x ? current[key] : null;
    var older = x ? olderWords(x.older) : '';
    tools.forEach(function (t, i) {
      var s = judgeTool(ctx, t, pieces, live);
      if (!s) return;
      // a file on Drive the workspace never recorded (made before it kept track) is not "Not made yet"
      if (s.state === 'none' && cur && t !== 'postcard-sold') s = { state: 'untracked', changes: [] };
      var b = pieceBits(ctx, t, s, made ? '' : older);
      lines += b.lines; acts += b.act; any = true;
      if (b.linked) linked = true;
      if (b.made) made = true;
      if (!(t === 'postcard-sold' && !soldYet(ctx) && s.state === 'none') && s.state !== 'fresh' && s.state !== 'untracked') done = false;
    });
    if (!any) return null;
    if (cur && !linked) {
      if (!made) lines += '<div class="d" data-kit-file>' + esc(['On Drive', cur.modified ? 'updated ' + JP.drive.day(cur.modified) : '', older].filter(Boolean).join(' · ')) + '</div>';
      acts += fileActs(ctx, key, cur, live);
    }
    var step = x ? stepLine(ctx, x) : '';
    var cls = (x && (x.state === 'fileOpen' || x.state === 'tickedNoFile')) || lines.indexOf('chip stale') !== -1 ? ' stale' : '';
    return { done: done, html: '<div class="kr' + cls + '" data-kit="' + esc(key) + '"><span class="ic">' + ctx.I('file') + '</span><div><div class="t">' + esc(title) + '</div>' +
      lines + (step ? '<div class="d" data-step>' + step + '</div>' : '') +
      (x && x.mismatch ? '<div class="d kmm"><span class="code">' + esc(x.mismatch.code) + '</span> ' + esc(x.mismatch.text) + '</div>' : '') +
      '</div><div class="a">' + acts + '</div></div>' };
  }

  /* a row with no piece made from the job (floorplan, photos, video): the track's state, its file's
     date and count, and its buttons */
  function trackRow(ctx, x, cur, pieces, live) {
    var esc = ctx.esc, I = ctx.I, D = JP.drive, st = STATE[x.state] || [x.state, ''];
    var when = function (f) { return f && f.modified ? 'Updated ' + D.day(f.modified) : 'On Drive'; };
    var file;
    if (x.key === 'photos' && x.file) {
      // last night's scan keeps only the newest few photos: its own count of the edited ones says how many
      var counted = ((((ctx.row.scan || {}).health || {}).counts || {}).photos || {}).edited;
      var n = !live && +counted ? +counted : global.GVC_KIT.realFiles(pieces.photos, 'photos').filter(function (f) { return !f.archived && IMG.test(f.name || ''); }).length;
      file = esc([when(x.file), n ? plural(n, 'photo') : ''].filter(Boolean).join(' · '));
    } else file = x.file ? esc([when(x.file), olderWords(x.older)].filter(Boolean).join(' · ')) : x.older ? 'No current file · ' + esc(olderWords(x.older)) : 'No file found';
    var levels = x.key === 'floorplan' && cur ? planLevels(pieces.floorplan) : [], lv = '';
    if (levels.length === 1) {   // one plan: Open is that plan (its branded render), not the newest file
      cur = current.floorplan = levels[0];
      file = esc([when(cur), olderWords(x.older)].filter(Boolean).join(' · '));
      levels = [];
    }
    if (levels.length) {
      var nCur = levels.filter(function (l) { return !l.alternate; }).length, nAlt = levels.length - nCur;
      file = [nCur > 1 ? nCur + ' plans' : nCur ? '1 plan' : '', nAlt ? plural(nAlt, 'alternate') : ''].filter(Boolean).join(' + ') +
        (levels[0].version ? ' · v' + levels[0].version : '');
      levels.forEach(function (l, i) {
        current['floorplan:' + i] = l;
        lv += '<div class="d" data-level style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px"><span>' + esc(l.label || 'Plan ' + (i + 1)) +
          (l.modified ? ' · ' + esc(D.day(l.modified)) : '') + '</span>' +
          (live ? '<button class="b sm ghost" type="button" data-open="floorplan:' + i + '">Open</button>'
            : l.url && DRIVE_LINK.test(l.url) ? '<a class="b sm ghost" href="' + esc(l.url) + '" target="_blank" rel="noopener">Open</a>' : '') +
          '<button class="b sm ghost" type="button" data-copy="floorplan:' + i + '">' + I('copy') + 'Copy Drive link</button></div>';
      });
    }
    var acts = '';
    if (cur && x.key === 'photos' && ctx.row.drive_folder) {
      acts += '<button class="b sm ghost" type="button" data-open-dir>' + I('folder') + 'Open folder</button>' +
        '<button class="b sm ghost" type="button" data-copy-dir>' + I('copy') + 'Copy Drive link</button>';
    } else if (cur && !levels.length) acts += fileActs(ctx, x.key, cur, live);
    var step = stepLine(ctx, x);
    var cls = x.state === 'notStarted' || x.state === 'notUsed' ? ' none' : (x.state === 'fileOpen' || x.state === 'tickedNoFile') ? ' stale' : '';
    return { done: x.state === 'done', html: '<div class="kr' + cls + '" data-kit="' + esc(x.key) + '"><span class="ic">' + I(ICON[x.key] || 'file') + '</span><div>' +
      '<div class="t">' + esc(x.label) + ' <span class="chip ' + st[1] + '">' + esc(st[0]) + '</span></div>' +
      (file ? '<div class="d" data-kit-file>' + file + '</div>' : '') + lv + (step ? '<div class="d" data-step>' + step + '</div>' : '') +
      (x.mismatch ? '<div class="d kmm"><span class="code">' + esc(x.mismatch.code) + '</span> ' + esc(x.mismatch.text) + '</div>' : '') +
      '</div><div class="a">' + acts + '</div></div>' };
  }

  function rowsHtml(pieces, ctx, live) {
    var r = ctx.row, esc = ctx.esc, I = ctx.I, D = JP.drive;
    var t = global.GVC_KIT.track({ kind: r.kind, market: r.market, pieces: pieces, checklist: (r.asana || {}).checklist, match: r.match });
    current = {};
    var out = [], counted = 0, done = 0;
    var add = function (row, counts) { if (!row) return; out.push(row.html); if (counts) { counted++; if (row.done) done++; } };
    t.rows.forEach(function (x) {
      var cur = newest(pieces[x.key], x.key);
      if (cur) current[x.key] = cur;
      if (PIECE_KEYS.indexOf(x.key) === -1) { add(trackRow(ctx, x, cur, pieces, live), x.state !== 'notUsed' && x.state !== 'tracked'); return; }
      var tools = pieceTools(ctx, x.key);
      if (tools) add(pieceRow(ctx, x.key, x.label, tools, pieces, live, x), true);
      // the seller package and its map follow the postcards; the track has no file of its own for them
      if (x.key === 'postcard' && pieceTools(ctx, 'seller')) add(pieceRow(ctx, 'seller', 'Seller Package', pieceTools(ctx, 'seller'), pieces, live, null), true);
    });
    var only = t.checklistOnly.length ? '<div class="ck-block"><h3>Checklist only</h3><ul>' + t.checklistOnly.map(function (s) {
      return '<li class="' + (s.done ? 'done' : '') + '"><span class="bx">' + (s.done ? I('check') : '') + '</span>' + esc(s.name) + (s.doneOn ? '<span class="w">' + esc(D.day(s.doneOn)) + '</span>' : '') + '</li>';
    }).join('') + '</ul></div>' : '';
    return { html: '<div class="kit">' + out.join('') + '</div>' + only, done: done, of: counted, all: judgeAll(ctx, pieces, live) };
  }

  /* the Marketing card: every row at once, from last night's scan (no files when the folder isn't
     linked) until Drive is read here, then from Drive. inner: the floorplans, photos and posts below. */
  function html(ctx, inner) {
    var m = JP.drive.mode(ctx);
    var x = rowsHtml(m === 'none' ? {} : (ctx.row.scan && ctx.row.scan.pieces) || {}, ctx, false);
    var note = m === 'none' ? 'Link the job\'s Drive folder to see its files.' : m === 'checking' ? 'Checking Drive…' : m === 'live' ? 'Reading the folder…' : '';
    return '<div class="card" id="kitCard"><div class="card-h"><div><h2>Marketing materials</h2><p>Each piece: made or not, up to date or not, and its files.</p></div>' +
      '<span class="chip" id="kitCount">' + x.done + ' of ' + x.of + ' done</span></div>' +
      (note ? '<p class="soft" data-reading>' + note + '</p>' : '') + '<div id="kitBody">' + x.html + '</div>' +
      '<p class="soft" id="kitMsg" role="status" style="font-size:13px;margin-top:8px">' + ctx.esc(JP.drive.msgs.kit || '') + '</p>' + (inner || '') + '</div>';
  }

  function wire(host, ctx) {
    var r = ctx.row, msg = host.querySelector('#kitMsg'), body = host.querySelector('#kitBody');
    var count = function (x) { var c = host.querySelector('#kitCount'); if (c) c.textContent = x.done + ' of ' + x.of + ' done'; };
    /* not a type that opens inline: the stored Drive link, else File Explorer */
    var elsewhere = function (cur) {
      var stored = cur.url && /^https:\/\/drive\.google\.com\//.test(cur.url) ? cur.url : null;
      if (!stored) {
        var same = ((((r.scan || {}).pieces || {})[keyOf(cur)]) || []).filter(function (x) { return x.name === cur.name; })[0];
        if (same && /^https:\/\/drive\.google\.com\//.test(same.url || '')) stored = same.url;
      }
      if (stored) { global.open(stored, '_blank', 'noopener'); say(''); }
      else say('Open it from the folder in File Explorer.');
    };
    var hook = function () {
      wirePieces(ctx, body);
      body.querySelectorAll('[data-copy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cur = current[b.dataset.copy] || {};
          JP.drive.copyLink(r, cur.path || null, cur.url || null, msg).then(function () { JP.drive.msgs.kit = msg.textContent; });
        });
      });
      var dir = function () { return { drive_folder: r.drive_folder + '/' + photosDir(current.photos) }; };
      body.querySelectorAll('[data-open-dir]').forEach(function (b) {
        b.addEventListener('click', function () {
          var u = dirUrl(lastTree, photosDir(current.photos));
          if (u) { global.open(u, '_blank', 'noopener'); say(''); return; }
          JP.drive.openWeb(dir(), say);
        });
      });
      body.querySelectorAll('[data-copy-dir]').forEach(function (b) {
        b.addEventListener('click', function () {
          JP.drive.copyLink(dir(), null, dirUrl(lastTree, photosDir(current.photos)), msg).then(function () { JP.drive.msgs.kit = msg.textContent; });
        });
      });
      body.querySelectorAll('[data-open]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cur = current[b.dataset.open];
          if (!cur || !cur.path) return;
          // Drive through Google knows the file's own page: open that, never a downloaded copy
          if (DRIVE_LINK.test(cur.url || '')) { global.open(cur.url, '_blank', 'noopener'); say(''); return; }
          // a blob: URL runs with this site's origin, so only types that can't run script open inline
          if (!SAFE_EXT.test(cur.name)) { elsewhere(cur); return; }
          say('Opening the file…');
          JP.drive.timed(global.GVC_DRIVE.readJobFile(r.drive_folder, cur.path, { timeoutMs: JP.drive.ms() })).then(function (f) {
            if (f.type && !SAFE_TYPE.test(f.type)) { elsewhere(cur); return; }
            var typed = f.type ? f : new global.Blob([f], { type: TYPE_OF[(/\.([a-z0-9]+)$/i.exec(cur.name) || [])[1].toLowerCase()] });
            var u = global.URL.createObjectURL(typed);
            global.open(u, '_blank', 'noopener');
            global.setTimeout(function () { global.URL.revokeObjectURL(u); }, 60000);   // the new tab has it by then
            say('');
          }, function (e) { say(e.timeout ? JP.drive.FAIL : e.message); });
        });
      });
    };
    hook();
    if (JP.drive.mode(ctx) !== 'live') return;
    JP.drive.folder(ctx).then(function (x) {
      lastTree = x.tree;
      var out = rowsHtml(x.health.pieces, ctx, true);
      body.innerHTML = out.html;
      var reading = host.querySelector('[data-reading]');
      if (reading) reading.remove();
      if (ctx.onSheet && body.isConnected) ctx.onSheet(out.all);   // a read that lands after a redraw paints nothing
      count(out);
      hook();
    }, function (e) {
      var reading = host.querySelector('[data-reading]');
      if (reading) { reading.className = 'fmsg'; reading.setAttribute('role', 'alert'); reading.textContent = e.timeout ? JP.drive.FAIL : e.message; }
    });
  }

  /* a piece's name in plain words, for the header's Update button */
  function nameOf(tool) { return tool === 'showsheet' ? 'showsheet' : NAME[tool] || tool; }
  JP.kit = { nameOf: nameOf, html: html, wire: wire, judge: judge, judgeAll: judgeAll, piecesHtml: piecesHtml, wirePieces: wirePieces, HELPER_MAKES: HELPER_MAKES, openRequest: openRequest };
})(window);
