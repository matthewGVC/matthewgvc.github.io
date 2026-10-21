/* ============================================================
   FOLDER HEALTH — what a job's Drive folder holds and what is wrong with it
   (spec S16, plan §9). One shared rule set: the browser runs it live when
   Drive is connected, the helper runs it nightly. It only reports; it never
   fixes a file (D7, D10).

     GVC_HEALTH.health(tree, { market: 'NYC'|'NJ'|'FL', driveRoot: 'GVC - New York',
                               isNew: false })
       → { notes: [{ code, text }],
           counts: { photos: { edited, staged, print, web, raw }, looseTop },
           pieces: { <kit key>: [{ path, name, modified, archived }] },
           detailsDoc: { name, size, modified } | null }

   tree: the job folder as { name, kind: 'file'|'directory', size?, modified?,
   children? }. Paperwork folders arrive as { skipped: true } and loose
   non-allowed top files as a count `looseCount` on the root (loose top file
   nodes are also counted here). Nothing here ever prints the name of a
   paperwork file or folder.

   Note codes: noDetails noFloorplan noVersions noEdited twoCurrent
   pieceAtTop twoFolders otherDrive broken. noVersions is only checked on a
   new folder (isNew); old folders are only checked for what is actually wrong.
   Loads in the browser (window.GVC_HEALTH) and in Node (require).
   ============================================================ */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./drive-rules.js'));
  else global.GVC_HEALTH = factory(global.GVC_DRIVE_RULES);
})(typeof window !== 'undefined' ? window : globalThis, function (RULES) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var KEYS = ['floorplan', 'photos', 'showsheet', 'brochure', 'openHouse', 'postcard', 'signage', 'video'];
  var LABEL = { floorplan: 'floorplan', photos: 'edited photo', showsheet: 'showsheet', brochure: 'brochure',
    openHouse: 'open house flyer', postcard: 'postcard', signage: 'signage', video: 'video' };

  /* piece folder names, old and new (plan §9), tested on the lower-cased name */
  var FOLDER = {
    floorplan: /^(floorplan|floorplans|floor plans)$/,
    photos: /^(edited|edits|matt[- ]edits)$/,
    showsheet: /^(showsheet|showsheets|show sheet)$/,
    brochure: /^(brochure|brochures)$/,
    openHouse: /^open house$/,
    postcard: /^(postcard|postcards)$/,
    signage: /^(signage|signs)$/,
    video: /^(video|film)$/
  };
  /* a piece file loose at the top starts with its piece's name */
  var TOP_NAME = {
    floorplan: /^(floorplans?|floor plans?)\b/i,
    showsheet: /^(showsheets?|show sheets?)\b/i,
    brochure: /^brochures?\b/i,
    openHouse: /^open house\b/i,
    postcard: /^postcards?\b/i,
    signage: /^(signage|signs?)\b/i,
    video: /^(video|film)\b/i
  };
  var MARKET_DRIVE = { NYC: 'GVC - New York', NJ: 'GVC - New Jersey', FL: 'GVC - Florida' };
  var MARKET_NAME = { NYC: 'New York', NJ: 'New Jersey', FL: 'Florida' };
  /* pieces where two current files side by side is wrong (floorplans and photos
     hold many files on purpose; postcards come as listed and sold) */
  var ONE_CURRENT = ['showsheet', 'brochure', 'openHouse'];

  function low(s) { return String(s || '').toLowerCase(); }
  function isDir(n) { return !!n && n.kind === 'directory'; }
  function ms(v) { var t = typeof v === 'number' ? v : Date.parse(v); return isNaN(t) ? 0 : t; }
  function fmt(v) { var d = new Date(ms(v)); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
  function folderKey(name) {
    var n = low(name).trim();
    for (var i = 0; i < KEYS.length; i++) if (FOLDER[KEYS[i]].test(n)) return KEYS[i];
    return null;
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
      counts: { photos: { edited: 0, staged: 0, print: 0, web: 0, raw: 0 }, looseTop: 0 },
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

    function walk(node, segs, archived, piece) {
      (node.children || []).forEach(function (c) {
        if (c.skipped) return;
        var path = segs.concat(c.name);
        if (isDir(c)) {
          if (!segs.length && (RULES.isPaperworkFolder(c.name) || !RULES.allowedInJob(c.name))) return;
          var isArchive = low(c.name) === 'archive';
          var key = piece || (isArchive ? null : folderKey(c.name));
          if (!piece && key && !archived) (dirsByPiece[key] = dirsByPiece[key] || []).push(path.join('\\'));
          if (piece === 'floorplan' && /^v\d+$/i.test(c.name)) hasVersionDir = true;
          walk(c, path, archived || isArchive, key);
        } else {
          var folders = path.slice(0, -1).map(low);
          ['staged', 'print', 'web', 'raw'].forEach(function (f) { if (folders.indexOf(f) !== -1) photoCounts[f]++; });
          if (piece === 'photos') photoCounts.edited++;
          if (piece) out.pieces[piece].push({ path: path.join('/'), name: c.name, modified: c.modified || null, archived: archived });
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
        out.pieces[key].push({ path: c.name, name: c.name, modified: c.modified || null, archived: false });
        note('pieceAtTop', 'A ' + LABEL[key] + ' file sits loose at the top of the folder. The standard keeps it in its own folder.');
      } else loose++;
    });
    walk(tree, [], false, null);
    out.counts.looseTop = loose;

    /* ---- notes ---- */
    var root = String(opts.driveRoot || ''), want = MARKET_DRIVE[opts.market];
    if (root && want && low(root) !== low(want)) {
      note('otherDrive', 'This folder is on the ' + root + ' drive, but the job is in ' + MARKET_NAME[opts.market] + '. The ' + MARKET_NAME[opts.market] + ' drive is ' + want + '.');
    }
    if (!out.detailsDoc) note('noDetails', 'There is no details document at the top of the folder.');

    if (!out.pieces.floorplan.length) note('noFloorplan', 'There is no floorplan in the folder.');
    else if (opts.isNew && !hasVersionDir) note('noVersions', 'The Floorplan folder has no version folders. The standard is v1, v2 and so on.');
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

  return { health: health, KEYS: KEYS, LABEL: LABEL, FOLDER: FOLDER };
});
