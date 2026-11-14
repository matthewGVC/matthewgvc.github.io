/* ============================================================
   DRIVE RULES — what the workspace may read inside a job folder (plan §9).

   Job folders hold deal paperwork beside the marketing: exclusives,
   contracts, offers, commission bills, often loose at the top level. The
   workspace never opens any of it. These rules are checked BEFORE a file
   handle is touched (assets/js/drive.js) and by the desktop helper.

     GVC_DRIVE_RULES.allowedInJob('Photos/Edited/a.jpg')  → true
     GVC_DRIVE_RULES.allowedInJob('Exclusive signed.pdf') → false
     GVC_DRIVE_RULES.isPaperworkFolder('Offers')          → true  (skipped by the folder scan)
     GVC_DRIVE_RULES.isPaperwork('Offer Docs')            → true  (folder rule or paperwork word: the walkers
                                                            never open such a folder, at any depth)
     GVC_DRIVE_RULES.hasPaperworkWord('Signed Contract.pdf') → true (whole word, anywhere)
     GVC_DRIVE_RULES.rel('\\Photos\\Edited\\')            → 'Photos/Edited' ('..' → null)
     GVC_DRIVE_RULES.allowedInJob('Marketing/Offer 2.pdf') → false (paperwork in ANY segment)
     GVC_DRIVE_RULES.jobTree(rawTree)                   → the tree cut down to what may be shown
     GVC_DRIVE_RULES.planPlace('Floorplan/Unbranded/x v5.svg') → 'unbranded': the standard subfolder
                                                            directly under the floorplan folder (the
                                                            first segment): 'design' | 'unbranded' |
                                                            'branded', any case; else null. Design/ files
                                                            are never plans. Also GVC_SHEETJOB.planPlace.
     GVC_DRIVE_RULES.layout('sfh')                      → the standard folders of a job type (resale, rental,
                                                            sfh, newdev): flat and numbered, each made only when
                                                            first needed. missingFolders(type, existing) →
                                                            { missing: [] always (a missing empty folder is never
                                                            flagged), renames: [{ from, to }] }
     GVC_DRIVE_RULES.standardName('Pictures/Edited')    → 'Photos/2 Edits': a folder's standard path, every
                                                            parent too; a folder in Marketing moves up
                                                            ('Marketing/Show Sheets' → 'Showsheet'); null when
                                                            already standard, not in the table, or paperwork.
                                                            ownChange(path): its own name changes, or it moves up
     GVC_DRIVE_RULES.photoSet('Matt Edits')             → 'edits' (raw, edits, ps, staged, finals, selects,
                                                            print, web; old or new name; else null)
     GVC_DRIVE_RULES.usablePhotos({ finals: 3, edits: 9 }) → { list: ['finals'], first: 'finals' }: Selects
                                                            first when it has photos, then Finals, else Edits
     GVC_DRIVE_RULES.STARTER                            → ['Photos', 'Photos/1 Raw', 'Floorplan']: a new place
     GVC_DRIVE_RULES.DEAL_FOLDER                        → a deal's year folder inside a place ('2026 Sale',
                                                            '2016 Purchase', '2025 - Rental'): see-through
     GVC_DRIVE_RULES.finishFile('0 - Approved Assets/Finishes/Le Reve Finish Schedule.pdf') → true: a PDF
                                                            in a folder or with a name that says "finish",
                                                            never paperwork (a development's Finishes card)
     GVC_DRIVE_RULES.isJunk('a.m4v.xmpses.xmp')         → true: a sidecar or system file (*.xmp,
                                                            *.xmpses, desktop.ini, Thumbs.db, .DS_Store,
                                                            ~$ Office temp files, ._ AppleDouble, any
                                                            dot file). Never a piece, a photo or a count:
                                                            jobTree drops them, the walkers skip them.

   Paths are relative to the job folder; "\" or "/" both work.
   Loads in the browser (window.GVC_DRIVE_RULES) and in Node (require).
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_DRIVE_RULES = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* First folder inside a job that may be read: the standard names plus the
     names today's folders already use for the same things. Lower case. */
  var READABLE = ['floorplan', 'floorplans', 'floor plan', 'floor plans', 'photos', 'photo', 'pictures', 'marketing',
    'showsheet', 'showsheets', 'show sheet', 'show sheets', 'brochure', 'brochures', 'copy', 'video', 'videos', 'film',
    'open house', 'open houses', 'postcard', 'postcards', 'signage', 'signs', 'pitch', 'pitches',
    'seller pitch', 'seller pitches'];   // the old pitch folders the helper still finds (helper/pieces.js)

  /* a paperwork folder: its name starts with one of these whole words ("Docs", "Offers 2024",
     "Deal Sheet"); "Dock photos" and "Offering plan" are not paperwork */
  var PAPERWORK = /^(docs?|documents?|offers?|contracts?|deals?|commissions?|exclusives?|closings?)\b/i;

  /* Windows drops trailing dots and spaces from a name, so ".. " or "..."
     could still mean "up a folder": any segment made only of dots and
     spaces is refused, like ".." itself. */
  function rel(path) {
    var parts = String(path == null ? '' : path).split(/[\\/]+/).filter(Boolean);
    for (var i = 0; i < parts.length; i++) if (/^[.\s]+$/.test(parts[i])) return null;
    return parts.join('/');
  }

  /* "Offer details.docx" is paperwork whatever else its name says */
  var PAPER_WORDS = /\b(offer|contract|exclusive|commission|closing|deal|lease|agreement)s?\b/i;

  /* a paperwork word anywhere in a name, as a whole word: "Signed Contract Floorplan.pdf"
     is paperwork; "Dealer.pdf" and "Floorplan v2.pdf" are not */
  var PAPER_ANYWHERE = /\b(offers?|contracts?|exclusives?|commissions?|closings?|deals?|leases?|agreements?|signed)\b/i;
  function hasPaperworkWord(name) { return PAPER_ANYWHERE.test(String(name == null ? '' : name)); }

  /* "2026 Sale", "2016 Purchase", "2025 - Rental": a deal's year folder inside a place, holding that deal's
     own pieces and paperwork. It is see-through: the pieces inside (Floorplan, Photos, Showsheet...) count
     as if they were at the top, and everything else in it is refused like any other top file, so its
     paperwork is still never listed or opened */
  var DEAL_FOLDER = /^(19|20)\d{2}\s*[-–]?\s*(sale|rental|purchase)s?$/i;

  function allowedInJob(path) {
    var r = rel(path);
    if (!r) return false;
    var parts = r.split('/');
    // a paperwork folder name (prefix rule) in any FOLDER segment, or a paperwork word (whole word)
    // in any segment, file name included: "Marketing/Offer from Buyer.pdf" is paperwork,
    // "Marketing/Offering plan.pdf" and "Photos/Edited/Dock view.jpg" are not
    for (var i = 0; i < parts.length; i++) {
      if (hasPaperworkWord(parts[i])) return false;
      if (i < parts.length - 1 && isPaperworkFolder(parts[i])) return false;
    }
    if (DEAL_FOLDER.test(parts[0])) {
      if (parts.length === 1) return true;
      parts = parts.slice(1);
    }
    if (parts.length === 1) {
      var name = parts[0].toLowerCase();
      if (READABLE.indexOf(name) !== -1) return true;              // the folder itself
      return /\.docx$/.test(name) && name.indexOf('details') !== -1 && !PAPER_WORDS.test(name);
    }
    return READABLE.indexOf(parts[0].toLowerCase()) !== -1;
  }

  /* a development's finish sheet: a PDF (finished and shareable; the builder's working sheets carry
     allowances and prices, so they are never shown), with "finish" in its own name or in a folder
     above it, and no paperwork anywhere in its path. Relative to the development's folder. */
  function finishFile(path) {
    var r = rel(path);
    if (!r) return false;
    var parts = r.split('/'), name = parts[parts.length - 1];
    if (!/\.pdf$/i.test(name) || isJunk(name)) return false;
    for (var i = 0; i < parts.length; i++) {
      if (hasPaperworkWord(parts[i])) return false;
      if (i < parts.length - 1 && isPaperworkFolder(parts[i])) return false;
    }
    return parts.some(function (x) { return /finish/i.test(x); });
  }

  /* sidecars and system files: Lightroom / Premiere .xmp and .xmpses (also after another
     extension, "clip.m4v.xmpses.xmp"), Windows desktop.ini and Thumbs.db, Office's "~$" lock
     files, macOS ._ AppleDouble files, .DS_Store and any other dot file */
  var JUNK = /(\.xmp|\.xmpses)$|^(desktop\.ini|thumbs\.db)$|^~\$|^\./i;
  function isJunk(name) { return JUNK.test(String(name == null ? '' : name).trim()); }

  function isPaperworkFolder(name) { return PAPERWORK.test(String(name || '').trim()); }

  /* the floorplan process's three subfolders (Floorplan/Unbranded, Branded, Design): which one a
     floorplan file sits directly inside, the floorplan folder being the path's first segment */
  var PLACES = /^(design|unbranded|branded)$/;
  function planPlace(path) {
    var segs = String(path == null ? '' : path).split(/[\\/]/);
    if (segs.length < 3) return null;
    var s = segs[1].toLowerCase();
    return PLACES.test(s) ? s : null;
  }
  /* a floorplan file of an alternate layout, by its name: "x Alternate v2.jpg", "x_Alternate.jpg", "Alt.png", "Option B.pdf" */
  function isAlternate(name) { return /(^|[^a-z0-9])(alt|alternate|option)([^a-z0-9]|$)/i.test(String(name == null ? '' : name)); }
  function isPaperwork(name) { return isPaperworkFolder(name) || hasPaperworkWord(name); }

  /* A job folder's listing cut down to what the workspace may show (plan §9):
       - a paperwork folder at the top stays as one { name: 'Docs' | 'Paperwork',
         kind: 'directory', skipped: true } line, its own name never kept;
       - another top folder that isn't readable is only counted (otherCount);
       - a paperwork file at the top is only counted (looseCount), never named;
       - any other top file stays (the details doc, or a loose file that
         GVC_HEALTH counts or reports as a piece at the top);
       - below the top, anything allowedInJob refuses is dropped entirely.
     The input is not changed; running it twice gives the same tree. */
  var DRIVE_URL = /^https:\/\/drive\.google\.com\//;
  function jobTree(raw) {
    if (!raw || raw.kind !== 'directory' || raw.broken) return raw;
    var out = { name: raw.name, kind: 'directory', children: [], looseCount: +raw.looseCount || 0, otherCount: +raw.otherCount || 0 };
    if (DRIVE_URL.test(raw.url || '')) out.url = raw.url;
    function file(c) {
      var f = { name: c.name, kind: 'file' };
      if (c.size != null) f.size = c.size;
      if (c.modified != null) f.modified = c.modified;
      if (c.clock === 'google') f.clock = 'google';   // the date is Google's, not G:'s
      if (DRIVE_URL.test(c.url || '')) f.url = c.url;   // Drive through Google: the file's real link
      return f;
    }
    function inside(node, segs) {
      var d = { name: node.name, kind: 'directory', children: [] };
      if (DRIVE_URL.test(node.url || '')) d.url = node.url;
      if (node.more) d.more = true;
      (node.children || []).forEach(function (c) {
        if (!c || c.skipped || (c.kind !== 'directory' && isJunk(c.name))) return;
        var path = segs.concat(String(c.name));
        if (!allowedInJob(path.join('/'))) return;
        d.children.push(c.kind === 'directory' ? inside(c, path) : file(c));
      });
      return d;
    }
    (raw.children || []).forEach(function (c) {
      if (!c) return;
      var name = String(c.name == null ? '' : c.name);
      if (c.kind !== 'directory' && isJunk(name)) return;     // never named, never counted
      var paper = c.skipped || isPaperwork(name);
      if (c.kind === 'directory') {
        if (paper) out.children.push({ name: /^docs?$/i.test(name.trim()) ? 'Docs' : 'Paperwork', kind: 'directory', skipped: true });
        else if (allowedInJob(name)) out.children.push(inside(c, [name]));
        else out.otherCount++;
      } else if (paper) out.looseCount++;
      else if (rel(name)) out.children.push(file(c));
    });
    return out;
  }

  /* ---------- THE FOLDER STANDARD (decisions 19-23, 26, 75) ----------
     Flat and numbered: a place's pieces sit at its top (no Marketing folder), and a folder is made only
     when first needed, so a missing empty folder is never flagged. A new place gets only STARTER. Archive
     is never listed here: the helper makes it inside a piece folder the first time it moves a file there.
     Docs is never opened. A development (newdev) is the FL template; its units have no folders. */
  var LISTING = [
    ['Photos', ['1 Raw', '2 Edits', '3 PS', '4 Virtual Staged', '5 Finals', '6 Selects', 'Print', 'Web']],
    ['Floorplan', ['Design', 'Unbranded', 'Branded']],
    ['Video', []], ['Showsheet', []], ['Brochure', []], ['Open House', []], ['Postcard', []], ['Signage', []],
    ['Pitch', []], ['Docs', []]
  ];
  var BUILD = [['Architecturals & Site Plan', []], ['Finishes', []], ['Final Renders', []],
    ['3D File Assets and Archive - For Matt and Ilin', []]];
  var DEVELOPMENT = ['0 - Approved Assets', '1 - Branding', '2 - Marketing - Working Files', '3 - Assets from Developer',
    '4 - MLS & Listing Info', '5 - Reporting, Pricing & Comps', '6 - Documents', '7 - Construction Schedule']
    .map(function (n) { return [n, []]; });
  var TYPES = {
    resale: LISTING,
    rental: LISTING,
    sfh: LISTING.concat(BUILD),
    newdev: DEVELOPMENT
  };
  var STARTER = ['Photos', 'Photos/1 Raw', 'Floorplan'];

  /* old → new names, on the lower-cased, trimmed name. TOP: a folder at the place's top, or directly in
     its Marketing (which it then leaves). The standard names are in TOP too, so "Marketing/Showsheet" is
     known and moves up; only the old names (TOP_OLD) are renamed where they stand. */
  var TOP = { 'floorplan': 'Floorplan', 'floorplans': 'Floorplan', 'floor plan': 'Floorplan', 'floor plans': 'Floorplan',
    'photos': 'Photos', 'photo': 'Photos', 'pictures': 'Photos',
    'showsheet': 'Showsheet', 'showsheets': 'Showsheet', 'show sheet': 'Showsheet', 'show sheets': 'Showsheet',
    'brochure': 'Brochure', 'brochures': 'Brochure', 'postcard': 'Postcard', 'postcards': 'Postcard',
    'signage': 'Signage', 'signs': 'Signage', 'video': 'Video', 'videos': 'Video', 'film': 'Video',
    'open house': 'Open House', 'open houses': 'Open House', 'pitch': 'Pitch', 'pitches': 'Pitch' };
  var TOP_OLD = { 'floorplans': 1, 'floor plan': 1, 'floor plans': 1, 'photo': 1, 'pictures': 1, 'showsheets': 1,
    'show sheet': 1, 'show sheets': 1, 'brochures': 1, 'postcards': 1, 'signs': 1, 'videos': 1, 'film': 1,
    'open houses': 1, 'pitches': 1 };
  /* inside Photos: set key → [standard name, every name it goes by, lower case] */
  var SETS = {
    raw: ['1 Raw', ['raw', 'raws', '1 raw']],
    edits: ['2 Edits', ['edited', 'edits', 'edited photos', 'matt edits', 'matt-edits', '2 edits']],
    ps: ['3 PS', ['ps', '3 ps']],
    staged: ['4 Virtual Staged', ['staged', 'virtual staged', 'virtually staged', '4 virtual staged']],
    finals: ['5 Finals', ['final', 'finals', 'final photos', '5 finals']],
    selects: ['6 Selects', ['selects', '6 selects']],
    print: ['Print', ['print']],
    web: ['Web', ['web']]
  };
  var PHOTO_NAME = {};
  Object.keys(SETS).forEach(function (k) { SETS[k][1].forEach(function (n) { PHOTO_NAME[n] = k; }); });
  var PLAN_NAME = { 'design': 'Design', 'unbranded': 'Unbranded', 'branded': 'Branded' };

  function low(name) { return String(name == null ? '' : name).trim().toLowerCase(); }

  /* photoSet('Matt Edits') → 'edits': which photo set a folder directly inside Photos is */
  function photoSet(name) { return PHOTO_NAME[low(name)] || null; }
  /* Print and Web keep their names; every other set takes its numbered one */
  function photoName(name) {
    var k = photoSet(name);
    if (!k || k === 'print' || k === 'web') return name;
    return SETS[k][0];
  }

  /* usablePhotos({ finals: 3, edits: 9, selects: 0 }) → { list: ['finals'], first: 'finals' } (75):
     Selects first when it has photos; Finals when it has photos, else Edits. Raw, PS, Staged: never. */
  function usablePhotos(sets) {
    sets = sets || {};
    var list = [];
    if (+sets.selects > 0) list.push('selects');
    if (+sets.finals > 0) list.push('finals');
    else if (+sets.edits > 0) list.push('edits');
    return { list: list, first: list.length ? list[0] : null };
  }

  /* a path split into a leading deal folder (kept as it is) and the rest; null when the path is bad */
  function split(relPath) {
    var r = rel(relPath);
    if (!r) return null;
    var parts = r.split('/');
    var deal = DEAL_FOLDER.test(parts[0]) ? [parts.shift()] : [];
    return { deal: deal, parts: parts };
  }

  /* the rest of the path, standardised segment by segment; moved: it left Marketing */
  function standardParts(parts) {
    var out = parts.slice(), moved = false;
    if (out.length > 1 && low(out[0]) === 'marketing' && TOP[low(out[1])]) { out.shift(); moved = true; }
    var top = low(out[0]);
    if (TOP_OLD[top] || (moved && TOP[top])) out[0] = TOP[top];
    var parent = TOP[low(out[0])];
    if (out.length > 1 && parent === 'Photos') out[1] = photoName(out[1]);
    if (out.length > 1 && parent === 'Floorplan' && PLAN_NAME[low(out[1])]) out[1] = PLAN_NAME[low(out[1])];
    return { parts: out, moved: moved };
  }

  /* standardName('Floorplans/Unbranded') → 'Floorplan/Unbranded'; a leading deal folder is kept; null
     when the whole path is already standard, not in the table, or paperwork (never renamed or moved) */
  function standardName(relPath) {
    var sp = split(relPath);
    if (!sp || !sp.parts.length) return null;
    if (sp.deal.concat(sp.parts).some(isPaperwork)) return null;
    var now = sp.deal.concat(standardParts(sp.parts).parts).join('/');
    return now === sp.deal.concat(sp.parts).join('/') ? null : now;
  }

  /* ownChange('Floorplans/Design') → false (only a parent changes); ('Photos/Edited') → true;
     ('Marketing/Showsheet') → true: it moves up out of Marketing */
  function ownChange(relPath) {
    if (standardName(relPath) == null) return false;
    var sp = split(relPath), st = standardParts(sp.parts);
    if (st.moved && sp.parts.length === 2) return true;
    return st.parts[st.parts.length - 1] !== sp.parts[sp.parts.length - 1];
  }

  /* layout('sfh') → [{ name, children: [name] }] in creation order; null for an unknown type */
  function layout(type) {
    var t = TYPES[String(type || '').toLowerCase()];
    return t ? t.map(function (x) { return { name: x[0], children: x[1].slice() }; }) : null;
  }
  /* missingFolders('resale', ['Photos/Edited', 'Floorplans']) → { missing: [], renames: [{ from:
     'Photos/Edited', to: 'Photos/2 Edits' }, { from: 'Floorplans', to: 'Floorplan' }] }. missing is always
     empty (23: a folder is made when first needed, so an empty one is never flagged); renames list each
     folder whose own name changes. existing: the job's folder paths, relative, any case. Nothing here
     touches a drive. */
  function missingFolders(type, existing) {
    if (!layout(type)) return null;
    var seen = {}, renames = [];
    (existing || []).forEach(function (p) {
      var from = rel(p);
      if (!from || seen[from] || !ownChange(from)) return;
      seen[from] = true;
      renames.push({ from: from, to: standardName(from) });
    });
    return { missing: [], renames: renames };
  }

  return { rel: rel, allowedInJob: allowedInJob, finishFile: finishFile, isPaperworkFolder: isPaperworkFolder, hasPaperworkWord: hasPaperworkWord,
    isPaperwork: isPaperwork, isJunk: isJunk, jobTree: jobTree, planPlace: planPlace, isAlternate: isAlternate,
    layout: layout, missingFolders: missingFolders, TYPES: Object.keys(TYPES),
    standardName: standardName, ownChange: ownChange, photoSet: photoSet, usablePhotos: usablePhotos,
    STARTER: STARTER.slice(), DEAL_FOLDER: DEAL_FOLDER };
});
