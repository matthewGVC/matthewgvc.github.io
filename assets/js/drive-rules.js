/* ============================================================
   DRIVE RULES — what the workspace may read inside a job folder (plan §9).

   Job folders hold deal paperwork beside the marketing: exclusives,
   contracts, offers, commission bills, often loose at the top level. The
   workspace never opens any of it. These rules are checked BEFORE a file
   handle is touched (assets/js/drive.js) and by the desktop helper.

     GVC_DRIVE_RULES.allowedInJob('Photos/Edited/a.jpg')  → true
     GVC_DRIVE_RULES.allowedInJob('Exclusive signed.pdf') → false
     GVC_DRIVE_RULES.isPaperworkFolder('Offers')          → true  (skipped by the folder scan)
     GVC_DRIVE_RULES.hasPaperworkWord('Signed Contract.pdf') → true (whole word, anywhere)
     GVC_DRIVE_RULES.rel('\\Photos\\Edited\\')            → 'Photos/Edited' ('..' → null)

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
  var READABLE = ['floorplan', 'floorplans', 'floor plans', 'photos', 'marketing',
    'showsheet', 'showsheets', 'show sheet', 'brochure', 'copy', 'video',
    'open house', 'postcard', 'postcards', 'signage', 'signs'];

  var PAPERWORK = /^(doc|offer|contract|deal|commission|exclusive|closing)/i;

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
    if (parts.length === 1) {
      var name = parts[0].toLowerCase();
      if (READABLE.indexOf(name) !== -1) return true;              // the folder itself
      return /\.docx$/.test(name) && name.indexOf('details') !== -1 && !PAPER_WORDS.test(name);
    }
    return READABLE.indexOf(parts[0].toLowerCase()) !== -1;
  }

  function isPaperworkFolder(name) { return PAPERWORK.test(String(name || '').trim()); }

  return { rel: rel, allowedInJob: allowedInJob, isPaperworkFolder: isPaperworkFolder, hasPaperworkWord: hasPaperworkWord };
});
