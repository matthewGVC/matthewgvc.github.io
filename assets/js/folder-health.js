/* ============================================================
   FOLDER HEALTH — what a job's Drive folder holds and what is wrong with it
   (spec S16, plan §9). One shared rule set: the browser runs it live when
   Drive is connected, the helper runs it nightly. It only reports; it never
   fixes a file (D7, D10).

     GVC_HEALTH.health(tree, { market: 'NYC'|'NJ'|'FL', driveRoot: 'GVC - New York',
                               isNew: false })
       → { notes: [{ code, text }],
           counts: { photos: { edited, staged, print, web, raw, finals, selects, ps, usable }, looseTop },
           pieces: { <kit key>: [{ path, name, modified, archived }] },
           detailsDoc: { name, size, modified } | null }

   The photos piece (decision 75): found only from Finals or Edits, old or new
   name (GVC_DRIVE_RULES.photoSet: "5 Finals", "Final", "2 Edits", "Edited"...),
   or, when the job has neither, from photos loose in Photos\ (Matt, 10-30).
   pieces.photos holds only the usable sets (GVC_DRIVE_RULES.usablePhotos):
   Selects' photos first when it has any, then Finals' (or, when Finals has
   none, Edits'), each set in name order, a file name already listed not listed
   again. Selects alone is not the piece. counts.photos counts every set by its
   key (edited = the edits set), whatever the folder is called, but only a set
   inside a Photos folder or the walk's own photo set (never Video\Final); usable is
   selects + (finals, else edited): the photos the pieces use (a scan made
   before it has no usable: read edited then).

   tree: the job folder as { name, kind: 'file'|'directory', size?, modified?,
   children? }. Paperwork folders arrive as { skipped: true } and loose
   non-allowed top files as a count `looseCount` on the root (loose top file
   nodes are also counted here). Nothing here ever prints the name of a
   paperwork file or folder.

   Note codes: noDetails noFloorplan noVersions noEdited twoCurrent
   pieceAtTop twoFolders otherDrive broken. noVersions is only checked on a
   new folder (isNew), and not when the floorplan folder has the standard
   Unbranded/ plan (GVC_DRIVE_RULES.planPlace); old folders are only checked
   for what is actually wrong.
   Loads in the browser (window.GVC_HEALTH) and in Node (require).
   ============================================================ */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./drive-rules.js'));
  else global.GVC_HEALTH = factory(global.GVC_DRIVE_RULES);
})(typeof window !== 'undefined' ? window : globalThis, function (RULES) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var KEYS = ['floorplan', 'photos', 'showsheet', 'brochure', 'postcard', 'signage', 'video', 'openhouse'];
  var LABEL = { floorplan: 'floorplan', photos: 'edited photo', showsheet: 'showsheet', brochure: 'brochure',
    postcard: 'postcard', signage: 'signage', video: 'video', openhouse: 'open house' };

  /* piece folder names, old and new (plan §9), tested on the lower-cased name */
  var FOLDER = {
    floorplan: /^(floorplan|floorplans|floor plan|floor plans)$/,
    showsheet: /^(showsheet|showsheets|show sheet)$/,
    brochure: /^(brochure|brochures)$/,
    postcard: /^(postcard|postcards)$/,
    signage: /^(signage|signs)$/,
    video: /^(video|film)$/,
    openhouse: /^(open house|open houses|openhouse)$/   // Marketing\Open House: the e-invite, trifold, flyer (Matt, 11-10)
  };
  /* the photo sets that make the photos piece (75): Selects is listed first but never the piece alone */
  var USABLE = { selects: 1, finals: 1, edits: 1 };
  /* counts.photos key of each photo set (photoSet) */
  var COUNT_KEY = { edits: 'edited', staged: 'staged', print: 'print', web: 'web', raw: 'raw', finals: 'finals', selects: 'selects', ps: 'ps' };
  /* name order as the pieces have always had it (sheet-job.js before 75): lower-cased name, plain <, so
     "-10.jpg" comes before "-2.jpg" and no piece reads as out of date because the order moved */
  function byName(a, b) { a = low(a.name); b = low(b.name); return a < b ? -1 : a > b ? 1 : 0; }
  /* a piece file loose at the top starts with its piece's name */
  var TOP_NAME = {
    floorplan: /^(floorplans?|floor plans?)\b/i,
    showsheet: /^(showsheets?|show sheets?)\b/i,
    brochure: /^brochures?\b/i,
    postcard: /^postcards?\b/i,
    signage: /^(signage|signs?)\b/i,
    video: /^(video|film)\b/i
  };
  /* finished photos kept loose in the job's Photos folder (no Edited / Finals folder): Matt, 10-30 */
  var PHOTOS_TOP = /^(photos?|pictures)$/;
  var IMAGE = /\.(jpe?g|png|tiff?|heic|webp)$/i;
  var MK = typeof module === 'object' && module.exports && typeof require === 'function' ? require('./markets.js') : (typeof window !== 'undefined' ? window : globalThis).GVC_MARKETS;   // what differs by market (markets.js)
  /* pieces where two current files side by side is wrong (floorplans and photos
     hold many files on purpose; postcards come as listed and sold) */
  var ONE_CURRENT = ['showsheet', 'brochure'];

  function low(s) { return String(s || '').toLowerCase(); }
  function isDir(n) { return !!n && n.kind === 'directory'; }
  // a piece keeps its file's real Drive link when the tree has one (Drive through Google)
  // (and says when its date is Google's, not G:'s: GVC_STALE never compares the two clocks)
  function withUrl(f, c) { if (/^https:\/\/drive\.google\.com\//.test(c.url || '')) f.url = c.url; if (c.clock === 'google') f.clock = 'google'; return f; }
  function ms(v) { var t = typeof v === 'number' ? v : Date.parse(v); return isNaN(t) ? 0 : t; }
  function fmt(v) { var d = new Date(ms(v)); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
  function folderKey(name) {
    var n = low(name).trim();
    if (USABLE[RULES.photoSet(n)]) return 'photos';
    for (var i = 0; i < KEYS.length; i++) if (FOLDER[KEYS[i]] && FOLDER[KEYS[i]].test(n)) return KEYS[i];
    return null;
  }
  /* an open house folder holds each piece in its own folder (Open House\Trifold, \E-invite draft, \Flyer) beside
     working files: notes, the e-invite's HTML and images, reference PDFs loose in Open House\ itself. A piece is
     a PDF one folder or more below the open house folder, never a "(small)" copy made for email (Matt, 11-10). */
  function openHousePiece(path) {
    var at = -1;
    for (var i = 0; i < path.length - 1; i++) if (FOLDER.openhouse.test(low(path[i]).trim())) { at = i; break; }
    var name = path[path.length - 1];
    return at !== -1 && path.length - at >= 3 && /\.pdf$/i.test(name) && !/\(small\)/i.test(name);
  }
  function topPieceKey(name) {
    if (RULES.isPaperworkFolder(name) || RULES.hasPaperworkWord(name)) return null;
    for (var k in TOP_NAME) if (TOP_NAME[k].test(String(name || '').trim())) return k;
    return null;
  }

  function health(tree, opts) {
    opts = opts || {};
    var out = {
      notes: [],
      counts: { photos: { edited: 0, staged: 0, print: 0, web: 0, raw: 0, finals: 0, selects: 0, ps: 0, usable: 0 }, looseTop: 0 },
      pieces: {},
      detailsDoc: null
    };
    KEYS.forEach(function (k) { out.pieces[k] = []; });

    if (!tree || tree.broken || !isDir(tree)) {
      out.notes.push({ code: 'broken', text: "The linked folder can't be found. It may have been renamed or moved. Link it again to the right folder." });
      return out;
    }
    function note(code, text) { out.notes.push({ code: code, text: text }); }

    var loose = +tree.looseCount || 0;
    var dirsByPiece = {};      // piece → [display path] of folders found by name
    var hasVersionDir = false;
    var photoCounts = out.counts.photos;
    var loosePhotos = [];      // images straight inside Photos\, used only when no edited-photo folder exists
    var photoSets = { selects: [], finals: [], edits: [] };   // the usable sets' files, before they make pieces.photos

    function walk(node, segs, archived, piece, set) {
      (node.children || []).forEach(function (c) {
        if (c.skipped) return;
        var path = segs.concat(c.name);
        if (isDir(c)) {
          if (!segs.length && (RULES.isPaperworkFolder(c.name) || !RULES.allowedInJob(c.name))) return;
          var isArchive = low(c.name) === 'archive';
          var key = piece || (isArchive ? null : folderKey(c.name));
          if (!piece && key && !archived) (dirsByPiece[key] = dirsByPiece[key] || []).push(path.join('\\'));
          if (piece === 'floorplan' && /^v\d+$/i.test(c.name)) hasVersionDir = true;
          walk(c, path, archived || isArchive, key, set || (!piece && key === 'photos' ? RULES.photoSet(c.name) : null));
        } else {
          var counted = {};
          /* a set counts only inside the photos: a folder directly in a Photos folder, or the walk's own photo set
             (Video\Final\clip.mp4 is no finished photo) */
          var dirs = path.slice(0, -1);
          dirs.forEach(function (g, i) {
            if (!i || !PHOTOS_TOP.test(low(dirs[i - 1]).trim())) return;
            var k = COUNT_KEY[RULES.photoSet(g)]; if (k && !counted[k]) { counted[k] = 1; photoCounts[k]++; }
          });
          if (piece === 'photos' && set && COUNT_KEY[set] && !counted[COUNT_KEY[set]]) { counted[COUNT_KEY[set]] = 1; photoCounts[COUNT_KEY[set]]++; }
          if (!piece && !archived && segs.length === 1 && PHOTOS_TOP.test(low(segs[0])) && IMAGE.test(c.name)) {
            loosePhotos.push(withUrl({ path: path.join('/'), name: c.name, modified: c.modified || null, archived: false }, c));
          }
          if (piece === 'photos') photoSets[set].push(withUrl({ path: path.join('/'), name: c.name, modified: c.modified || null, archived: archived }, c));
          else if (piece && (piece !== 'openhouse' || openHousePiece(path))) out.pieces[piece].push(withUrl({ path: path.join('/'), name: c.name, modified: c.modified || null, archived: archived }, c));
        }
      });
    }

    /* top-level files: details doc, a piece loose at the top, or just loose */
    (tree.children || []).forEach(function (c) {
      if (c.skipped || isDir(c)) return;
      if (RULES.allowedInJob(c.name)) {
        var cur = out.detailsDoc;
        if (!cur || ms(c.modified) > ms(cur.modified)) out.detailsDoc = { name: c.name, size: c.size == null ? null : c.size, modified: c.modified || null };
        return;
      }
      var key = topPieceKey(c.name);
      if (key) {
        out.pieces[key].push(withUrl({ path: c.name, name: c.name, modified: c.modified || null, archived: false }, c));
        note('pieceAtTop', 'A ' + LABEL[key] + ' file sits loose at the top of the folder. The standard keeps it in its own folder.');
      } else loose++;
    });
    walk(tree, [], false, null, null);
    /* the usable photos (75): which sets, by their current (not archived) photos; each in name order,
       its current files before its archived ones; a name already listed is not listed again */
    var current = {};
    Object.keys(photoSets).forEach(function (k) { current[k] = photoSets[k].filter(function (p) { return !p.archived; }).length; });
    var use = RULES.usablePhotos(current).list, named = {};
    if (use.some(function (k) { return k !== 'selects'; })) use.forEach(function (k) {
      var list = photoSets[k];
      list.filter(function (p) { return !p.archived; }).sort(byName).concat(list.filter(function (p) { return p.archived; }).sort(byName)).forEach(function (p) {
        var n = low(p.name);
        if (named[n]) return;
        named[n] = 1;
        out.pieces.photos.push(p);
      });
    });
    if (!out.pieces.photos.length && loosePhotos.length) {
      out.pieces.photos = loosePhotos;
      photoCounts.edited = loosePhotos.length;
    }
    photoCounts.usable = photoCounts.selects + (photoCounts.finals > 0 ? photoCounts.finals : photoCounts.edited);
    out.counts.looseTop = loose;

    /* ---- notes ---- */
    var root = String(opts.driveRoot || ''), want = (MK.get(opts.market) || {}).drive;
    if (root && want && low(root) !== low(want)) {
      note('otherDrive', 'This folder is on the ' + root + ' drive, but the job is in ' + MK.name(opts.market) + '. The ' + MK.name(opts.market) + ' drive is ' + want + '.');
    }
    if (!out.detailsDoc) note('noDetails', 'There is no details document at the top of the folder.');

    if (!out.pieces.floorplan.length) note('noFloorplan', 'There is no floorplan in the folder.');
    else if (opts.isNew && !hasVersionDir && !out.pieces.floorplan.some(function (p) { return RULES.planPlace(p.path) === 'unbranded'; })) note('noVersions', 'The Floorplan folder has no Unbranded folder yet. The standard is Floorplan\Design, Unbranded and Branded.');
    if (!out.pieces.photos.some(function (p) { return !p.archived; })) note('noEdited', 'There are no edited photos in the folder.');

    ONE_CURRENT.forEach(function (key) {
      var byDir = {};
      out.pieces[key].forEach(function (f) {
        if (f.archived || f.path.indexOf('/') === -1) return;
        var d = f.path.split('/').slice(0, -1).join('\\');
        (byDir[d] = byDir[d] || []).push(f);
      });
      Object.keys(byDir).forEach(function (d) {
        var list = byDir[d];
        if (list.length < 2) return;
        var days = list.map(function (f) { return ms(f.modified); }).filter(Boolean).sort(function (a, b) { return a - b; })
          .map(fmt).filter(function (v, i, a) { return a.indexOf(v) === i; });
        var when = days.length >= 2 ? ' (dated ' + days.join(' and ') + ')' : '';
        note('twoCurrent', d + '\\ holds ' + list.length + ' current ' + LABEL[key] + ' files side by side' + when + '. Only one should be current; older ones belong in Archive\\.');
      });
    });

    Object.keys(dirsByPiece).forEach(function (key) {
      if (key === 'photos') return;
      var seen = {};
      var names = dirsByPiece[key].filter(function (p) { var l = low(p); return seen[l] ? false : (seen[l] = true); });
      if (names.length > 1) note('twoFolders', names.join('\\ and ') + '\\ both hold ' + LABEL[key] + 's. The standard has one folder for it.');
    });
    return out;
  }

  return { health: health, KEYS: KEYS, LABEL: LABEL, FOLDER: FOLDER, topPieceKey: topPieceKey };
});
