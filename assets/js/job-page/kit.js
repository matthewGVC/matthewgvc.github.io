/* ============================================================
   JOB PAGE: the marketing-step track (spec §2.7, S12, D60, D74) and the
   Pieces card (Slice 5, S16), which sits near the top of the page.

     GVC_JP.kit.html(ctx, inner)      the Marketing track: one row per kit file (floorplan,
                                      photos, video…) with its newest Drive file, Asana's step
                                      and tick. Its piece rows (Showsheet, Brochure, Postcard,
                                      Signage) keep their file lines only.
     GVC_JP.kit.piecesHtml(ctx, pieces, live)
                                      the Pieces card: one row per piece made from the job.
                                      Each piece has ONE status word: Not made yet · Up to date ·
                                      Out of date (its reason beside it) · Not tracked. Owner:
                                      Make / Open / Rebuild and Copy Drive link. Teammate: Get PDF
                                      when a PDF is in Drive, else "Ask Matt".
     GVC_JP.kit.wire(host, ctx)       the track's controls; the Pieces card repaints when Drive is read
     GVC_JP.kit.wirePieces(ctx)       the Pieces card's Copy Drive link buttons (after each paint)

   The track: state done (file and tick) · fileOpen (file, Asana open) · tickedNoFile ·
   notStarted · notUsed (signage in NYC) · tracked (video, tracked only). Live from Drive
   when it is connected here, else from last night's scan. Open shows the file from Drive
   (desktop); Copy Drive link asks the helper (POST /drive-link), else uses the scan's stored
   link, else copies the G: path. A piece with a file but no Asana step to match (brochure,
   signage) says so. Under the rows: the checklist-only steps (Advertising Spots, NYC's Just
   Listed Email).
   ctx.doc is the showsheet's documents row; ctx.onSheet(result) hears each judgement (the
   page's Rebuild n stale button).
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
  // the pieces whose status and actions live on the Pieces card, not on the track row
  var PIECE_KEYS = ['showsheet', 'brochure', 'postcard', 'signage'];
  // one status word per piece: word, and the chip's class
  var WORD = { none: ['Not made yet', ''], untracked: ['Not tracked', ''], fresh: ['Up to date', 'made'], stale: ['Out of date', 'stale'] };
  var current = {};   // kit key → the newest current piece { path?, name, url? } of the last draw
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

  /* a job with several floors has one floorplan file per level: the newest version's levels, each its own
     way in, so Open never lands on whichever level was saved last. [] when there is one level or none. */
  function planLevels(list) {
    var PJ = global.GVC_PIECEJOB;
    if (!PJ || !PJ.pickFloorplans) return [];
    /* last night's scan keeps names and links, not paths: the name stands in for the path there */
    var files = global.GVC_KIT.realFiles(list, 'floorplan').filter(function (f) { return !f.archived && (f.path || f.name); })
      .map(function (f) { return f.path ? f : { name: f.name, path: f.name, modified: f.modified, url: f.url, scanned: true }; });
    var picks = PJ.pickFloorplans(files);
    if (picks.length < 2) return [];
    return picks.map(function (p) {
      var f = files.filter(function (x) { return x.path === p.path; })[0] || { path: p.path, name: p.path.split('/').pop() };
      var base = String(f.name || p.path.split('/').pop()).replace(/\.[a-z0-9]+$/i, '');
      return { path: f.scanned ? null : f.path, name: f.name || base, url: f.url, modified: f.modified, version: p.version,
        label: (base.split(/\s+-\s+/).pop() || base).replace(/\b(unbranded|branded|mls)\b/gi, '').replace(/\s+/g, ' ').trim() };
    });
  }

  /* ---------- the Showsheet's record (Slice 4: S15, S20, S21) ----------
     judge(ctx, pieces, live) → GVC_STALE's { state, changes } for the showsheet, or null
     (not a listing, the check isn't loaded, or it couldn't read the record). Live from Drive
     the photo and floorplan dates count too (the same picks the sheet makes); from the scan
     they're unknown. A file found live or in last night's scan counts, as in the sheet's bar. */
  var IMG = /\.(jpe?g|png|webp)$/i;
  var DRIVE_LINK = /^https:\/\/drive\.google\.com\//;
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
      opts.floorplan = global.GVC_SHEETJOB.pickFloorplan(plans);
    }
    try { return ST.stale(ctx.doc || null, ctx.row, opts); }
    catch (e) { return null; }   // a record the check can't read never takes the page down
  }
  function sheetHref(ctx, rebuild) {
    return '../../tools/showsheet/?listing=' + encodeURIComponent(ctx.row.slug) + (rebuild ? '&rebuild=1' : '');
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
  function pieceBits(ctx, tool, s) {
    var esc = ctx.esc, doc = docOf(ctx, tool), out = (doc && doc.output) || null, name = NAME[tool] || tool;
    var head = name.charAt(0).toUpperCase() + name.slice(1);
    if (tool === 'postcard-sold' && !soldYet(ctx) && s.state === 'none') {
      return { lines: '<div class="d" data-piece-line="' + esc(tool) + '">' + esc(head) + ': once the job is sold</div>', act: '' };
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
      else if (got && ctx.canEdit) made.push('<a class="link" href="' + esc(got) + '" target="_blank" rel="noopener">Open</a>',
        '<button class="link" type="button" data-piece-copy="' + esc(tool) + '">Copy Drive link</button>');
      lines += '<div class="d" data-piece-made="' + esc(tool) + '">' + made.join(' · ') + '</div>';
    }
    // a teammate never makes or rebuilds: the PDF in Drive, or Matt
    if (!ctx.canEdit) {
      var get = got && (s.state === 'fresh' || s.state === 'stale');
      return { lines: lines, act: get ? '<a class="b sm ghost" data-piece-get="' + esc(tool) + '" href="' + esc(got) + '" target="_blank" rel="noopener">Get PDF</a>'
        : '<span class="soft" data-piece-ask="' + esc(tool) + '">Ask Matt</span>' };
    }
    var a;
    if (tool === 'showsheet') {
      a = !ctx.canEdit || s.state === 'fresh' || s.state === 'untracked' ? ['Open sheet', false, 'ghost']
        : s.state === 'stale' ? ['Rebuild', true, 'primary'] : ['Make showsheet', false, 'primary'];
      return { lines: lines, act: '<a class="b sm ' + a[2] + '" data-piece="showsheet" href="' + esc(sheetHref(ctx, a[1])) + '">' + esc(a[0]) + '</a>' };
    }
    var verb = tool === 'pitch-map' ? 'Make the map' : 'Make ' + name;
    a = s.state === 'fresh' || s.state === 'untracked' ? ['Open ' + (tool === 'pitch-map' ? 'map' : name), false, 'ghost']
      : s.state === 'stale' ? ['Rebuild ' + name, true, 'primary'] : [verb, false, 'primary'];
    return { lines: lines, act: '<a class="b sm ' + a[2] + '" data-piece="' + esc(tool) + '" href="' + esc(pieceHref(ctx, tool, a[1])) + '">' + esc(a[0]) + '</a>' };
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
  /* one row of the Pieces card: its pieces' lines and actions, nothing when none applies */
  function pieceRow(ctx, key, title, tools, pieces, live) {
    var lines = '', acts = '', any = false;
    tools.forEach(function (t) {
      var s = judgeTool(ctx, t, pieces, live);
      if (!s) return;
      var b = pieceBits(ctx, t, s);
      lines += b.lines; acts += b.act; any = true;
    });
    if (!any) return '';
    return '<div class="kr" data-kit="' + ctx.esc(key) + '"><span class="ic">' + ctx.I('file') + '</span><div><div class="t">' + ctx.esc(title) + '</div>' +
      lines + '</div><div class="a">' + acts + '</div></div>';
  }
  /* the Pieces card, at the top of the page. A listing: Showsheet, Brochure, Postcards, Seller
     Package with its Map, Signage (where it is made). A pitch: its Seller Package and Map. */
  function piecesHtml(ctx, pieces, live) {
    if (!global.GVC_STALE || !global.GVC_PIECEJOB) return '';
    pieces = pieces || {};
    var rows = '';
    if (ctx.kind === 'pitch') {
      rows = pieceRow(ctx, 'seller', 'Seller Package', ['seller'], {}, false) + pieceRow(ctx, 'pitch-map', 'Map', ['pitch-map'], {}, false);
    } else if (ctx.kind === 'listing') {
      var rental = ctx.row.kind === 'rental', noSign = ctx.row.market === 'NYC' || rental;
      rows = pieceRow(ctx, 'showsheet', 'Showsheet', ['showsheet'], pieces, live) +
        pieceRow(ctx, 'brochure', 'Brochure', ['brochure'], pieces, live) +
        (rental ? '' : pieceRow(ctx, 'postcard', 'Postcard', ['postcard-listed', 'postcard-sold'], pieces, live) +
          pieceRow(ctx, 'seller', 'Seller Package', ['seller', 'pitch-map'], pieces, live)) +
        (noSign ? '' : pieceRow(ctx, 'signage', 'Signage', ['signage'], pieces, live));
    }
    if (!rows) return '';
    return '<div class="card" id="piecesCard"><div class="card-h"><div><h2>Pieces</h2><p>Made from this job\'s facts and Drive picks. Each piece has one status.</p></div></div>' +
      '<div class="kit">' + rows + '</div></div>';
  }
  /* the Copy Drive link buttons on the Pieces card (the card is repainted, so this runs after each paint) */
  function wirePieces(ctx) {
    var host = document.getElementById('piecesHost');
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
  function paintPieces(ctx, pieces, live) {
    var host = document.getElementById('piecesHost');
    if (!host) return;
    host.innerHTML = piecesHtml(ctx, pieces, live);
    wirePieces(ctx);
  }

  /* the marketing track's piece rows: the track says whether a file is there, the Pieces card says
     whether the piece is made. A piece that applies to this job has no track status word. */
  function pieceOn(ctx, key) {
    var r = ctx.row;
    if (key === 'showsheet' || key === 'brochure') return true;
    if (key === 'postcard') return r.kind !== 'rental';
    if (key === 'signage') return r.market !== 'NYC' && r.kind !== 'rental';
    return false;
  }

  function rowsHtml(pieces, ctx, live) {
    var r = ctx.row, esc = ctx.esc, I = ctx.I, D = JP.drive;
    var t = global.GVC_KIT.track({ kind: r.kind, market: r.market, pieces: pieces, checklist: (r.asana || {}).checklist, match: r.match });
    current = {};
    var counted = t.rows.filter(function (x) { return x.state !== 'notUsed' && x.state !== 'tracked'; });
    var done = counted.filter(function (x) { return x.state === 'done'; }).length;
    var rows = t.rows.map(function (x) {
      var st = STATE[x.state] || [x.state, ''], cur = newest(pieces[x.key], x.key), onPiece = PIECE_KEYS.indexOf(x.key) !== -1 && pieceOn(ctx, x.key);
      if (cur) current[x.key] = cur;
      var file = x.file ? esc(x.file.name) + (x.file.modified ? ' · ' + esc(D.day(x.file.modified)) : '') + (x.older ? ' · ' + x.older + ' older' : '')
        : x.older ? 'No current file · ' + x.older + ' older' : onPiece ? '' : 'No file found';
      var step = x.step ? 'Asana: ' + esc(x.step.name) + (x.step.done ? ', ticked' + (x.step.doneOn ? ' ' + esc(D.day(x.step.doneOn)) : '') + (x.step.who ? ' by ' + esc(x.step.who) : '') : ', open')
        : x.file && NO_STEP.indexOf(x.key) !== -1 ? 'No Asana step for this piece' : '';
      var levels = x.key === 'floorplan' && cur ? planLevels(pieces.floorplan) : [], lv = '';
      if (levels.length) {
        file = levels.length + ' floors' + (levels[0].version ? ' · v' + levels[0].version : '');
        levels.forEach(function (l, i) {
          current['floorplan:' + i] = l;
          lv += '<div class="d" data-level style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px"><span>' + esc(l.label || l.name) +
            (l.modified ? ' · ' + esc(D.day(l.modified)) : '') + '</span>' +
            (live ? '<button class="b sm ghost" type="button" data-open="floorplan:' + i + '">Open</button>'
              : l.url && /^https:\/\/drive\.google\.com\//.test(l.url) ? '<a class="b sm ghost" href="' + esc(l.url) + '" target="_blank" rel="noopener">Open</a>' : '') +
            '<button class="b sm ghost" type="button" data-copy="floorplan:' + i + '">' + I('copy') + 'Copy Drive link</button></div>';
        });
      }
      var acts = '';
      if (cur && x.key === 'photos' && ctx.row.drive_folder) {
        acts += '<button class="b sm ghost" type="button" data-open-dir>Open folder</button>' +
          '<button class="b sm ghost" type="button" data-copy-dir>' + I('copy') + 'Copy Drive link</button>';
      } else if (cur && !levels.length) {
        if (live && cur.path) acts += '<button class="b sm ghost" type="button" data-open="' + esc(x.key) + '">Open</button>';
        else if (cur.url && /^https:\/\/drive\.google\.com\//.test(cur.url)) acts += '<a class="b sm ghost" href="' + esc(cur.url) + '" target="_blank" rel="noopener">Open</a>';
        acts += '<button class="b sm ghost" type="button" data-copy="' + esc(x.key) + '">' + I('copy') + 'Copy Drive link</button>';
      }
      var cls = x.state === 'notStarted' || x.state === 'notUsed' ? ' none' : (x.state === 'fileOpen' || x.state === 'tickedNoFile') ? ' stale' : '';
      return '<div class="kr' + cls + '" data-kit="' + esc(x.key) + '"><span class="ic">' + I(ICON[x.key] || 'file') + '</span><div>' +
        '<div class="t">' + esc(x.label) + (onPiece ? '' : ' <span class="chip ' + st[1] + '">' + esc(st[0]) + '</span>') + '</div>' +
        (file ? '<div class="d">' + file + '</div>' : '') + lv + (step ? '<div class="d" data-step>' + step + '</div>' : '') +
        (x.mismatch ? '<div class="d kmm"><span class="code">' + esc(x.mismatch.code) + '</span> ' + esc(x.mismatch.text) + '</div>' : '') +
        '</div><div class="a">' + acts + '</div></div>';
    }).join('');
    var only = t.checklistOnly.length ? '<div class="ck-block"><h3>Checklist only</h3><ul>' + t.checklistOnly.map(function (s) {
      return '<li class="' + (s.done ? 'done' : '') + '"><span class="bx">' + (s.done ? I('check') : '') + '</span>' + esc(s.name) + (s.doneOn ? '<span class="w">' + esc(D.day(s.doneOn)) + '</span>' : '') + '</li>';
    }).join('') + '</ul></div>' : '';
    return { html: '<div class="kit">' + rows + '</div>' + only, done: done, of: counted.length, all: judgeAll(ctx, pieces, live) };
  }

  function html(ctx, inner) {
    var m = JP.drive.mode(ctx), body;
    if (m === 'none') body = '<p class="soft">Link the job\'s Drive folder to see its files.</p>';
    else if (m === 'scan') {
      var x = rowsHtml((ctx.row.scan && ctx.row.scan.pieces) || {}, ctx, false);
      body = x.html;
    } else body = '<p class="soft" data-reading>' + (m === 'checking' ? 'Checking Drive…' : 'Reading the folder…') + '</p>';
    return '<div class="card" id="kitCard"><div class="card-h"><div><h2>Marketing track</h2></div>' +
      '<span class="chip" id="kitCount"></span></div><div id="kitBody">' + body + '</div>' +
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
      body.querySelectorAll('[data-copy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cur = current[b.dataset.copy] || {};
          JP.drive.copyLink(r, cur.path || null, cur.url || null, msg).then(function () { JP.drive.msgs.kit = msg.textContent; });
        });
      });
      var dir = function () { return { drive_folder: r.drive_folder + '/' + photosDir(current.photos) }; };
      body.querySelectorAll('[data-open-dir]').forEach(function (b) {
        b.addEventListener('click', function () {
          global.GVC_SHELL.helper('POST', '/open-folder', { folder: dir().drive_folder }).then(function (x) {
            say(x.ok ? 'Opened the Photos folder in File Explorer.' : (x.error || 'The helper couldn\'t open it.'));
          }, function (e) { say(e.message); });
        });
      });
      body.querySelectorAll('[data-copy-dir]').forEach(function (b) {
        b.addEventListener('click', function () { JP.drive.copyLink(dir(), null, null, msg).then(function () { JP.drive.msgs.kit = msg.textContent; }); });
      });
      body.querySelectorAll('[data-open]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cur = current[b.dataset.open];
          if (!cur || !cur.path) return;
          // a blob: URL runs with this site's origin, so only types that can't run script open inline
          if (!SAFE_EXT.test(cur.name)) { elsewhere(cur); return; }
          say('Opening ' + cur.name + '…');
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
    if (JP.drive.mode(ctx) === 'scan') {
      count(rowsHtml((r.scan && r.scan.pieces) || {}, ctx, false));
      hook();
      return;
    }
    if (JP.drive.mode(ctx) !== 'live') { hook(); return; }
    JP.drive.folder(ctx).then(function (x) {
      var out = rowsHtml(x.health.pieces, ctx, true);
      body.innerHTML = out.html;
      paintPieces(ctx, x.health.pieces, true);
      if (ctx.onSheet && body.isConnected) ctx.onSheet(out.all);   // a read that lands after a redraw paints nothing
      count(out);
      hook();
    }, function (e) {
      body.innerHTML = '<p class="fmsg" role="alert">' + ctx.esc(e.timeout ? JP.drive.FAIL : e.message) + '</p>';
    });
  }

  JP.kit = { html: html, wire: wire, judge: judge, judgeAll: judgeAll, piecesHtml: piecesHtml, wirePieces: wirePieces };
})(window);
