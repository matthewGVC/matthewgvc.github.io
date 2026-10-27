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
                                                            sfh, newdev), with missingFolders(type, existing)
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
  var READABLE = ['floorplan', 'floorplans', 'floor plan', 'floor plans', 'photos', 'marketing',
    'showsheet', 'showsheets', 'show sheet', 'brochure', 'copy', 'video',
    'open house', 'postcard', 'postcards', 'signage', 'signs'];

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
    if (parts.length === 1) {
      var name = parts[0].toLowerCase();
      if (READABLE.indexOf(name) !== -1) return true;              // the folder itself
      return /\.docx$/.test(name) && name.indexOf('details') !== -1 && !PAPER_WORDS.test(name);
    }
    return READABLE.indexOf(parts[0].toLowerCase()) !== -1;
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
  function jobTree(raw) {
    if (!raw || raw.kind !== 'directory' || raw.broken) return raw;
    var out = { name: raw.name, kind: 'directory', children: [], looseCount: +raw.looseCount || 0, otherCount: +raw.otherCount || 0 };
    function file(c) {
      var f = { name: c.name, kind: 'file' };
      if (c.size != null) f.size = c.size;
      if (c.modified != null) f.modified = c.modified;
      return f;
    }
    function inside(node, segs) {
      var d = { name: node.name, kind: 'directory', children: [] };
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

  /* ---------- THE FOLDER STANDARD (docs/folder-standard.md) ----------
     One layout per job type, one name per folder. Every type shares the core; the two new-development
     types add the build folders and a project also gets Branding. Archive\ is never listed here: the
     helper makes it inside a piece folder the first time it moves a file there. The workspace reads
     only Floorplan, Photos and Marketing (READABLE); Docs is never opened. */
  var CORE = [
    ['Floorplan', ['Design', 'Unbranded', 'Branded']],
    ['Photos', ['Raw', 'Edited', 'Staged', 'Print', 'Web']],
    ['Marketing', ['Pitch', 'Showsheet', 'Brochure', 'Open House', 'Postcard', 'Signage', 'Video']],
    ['Docs', []]
  ];
  var BUILD = [['Architecturals & Site Plan', ['Old']], ['Finishes', []], ['Final Renders', []],
    ['3D File Assets and Archive - For Matt and Ilin', []]];
  var TYPES = {
    resale: CORE,
    rental: CORE,
    sfh: CORE.concat(BUILD),
    newdev: CORE.concat(BUILD, [['Branding', []]])
  };
  /* the older names for a top folder, lower case → the standard name (they stay readable, the folder
     check says to rename them) */
  var RENAMED = { 'floorplans': 'Floorplan', 'floor plan': 'Floorplan', 'floor plans': 'Floorplan' };

  /* layout('sfh') → [{ name, children: [name] }] in creation order; null for an unknown type */
  function layout(type) {
    var t = TYPES[String(type || '').toLowerCase()];
    return t ? t.map(function (x) { return { name: x[0], children: x[1].slice() }; }) : null;
  }
  /* missingFolders('sfh', ['Floorplans', 'Floorplans/Design', 'Finishes']) → what the standard has
     that the job lacks, as 'Floorplan', 'Floorplan/Unbranded' paths, and the renames to suggest.
     existing: the job's folder paths, relative, any case. Nothing here touches a drive. */
  function missingFolders(type, existing) {
    var L = layout(type);
    if (!L) return null;
    var have = {}, renames = [];
    (existing || []).forEach(function (p) {
      var parts = String(p).split(/[\/]+/).filter(Boolean);
      var top = parts[0].toLowerCase();
      if (RENAMED[top]) {
        renames.push({ from: parts[0], to: RENAMED[top] });
        parts[0] = RENAMED[top];
      }
      have[parts.join('/').toLowerCase()] = true;
    });
    var out = [];
    L.forEach(function (f) {
      if (!have[f.name.toLowerCase()]) out.push(f.name);
      f.children.forEach(function (c) { if (!have[(f.name + '/' + c).toLowerCase()]) out.push(f.name + '/' + c); });
    });
    var seen = {};
    renames = renames.filter(function (r) { return !seen[r.from] && (seen[r.from] = true); });
    return { missing: out, renames: renames };
  }

  return { rel: rel, allowedInJob: allowedInJob, isPaperworkFolder: isPaperworkFolder, hasPaperworkWord: hasPaperworkWord,
    isPaperwork: isPaperwork, isJunk: isJunk, jobTree: jobTree, planPlace: planPlace,
    layout: layout, missingFolders: missingFolders, TYPES: Object.keys(TYPES) };
});
