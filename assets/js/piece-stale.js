/* ============================================================
   PIECE STALE — has a printed piece fallen behind its job? (spec S15, plan §10)

     GVC_STALE.stale(doc, row, opts)
       → { state: 'none'|'untracked'|'fresh'|'stale', changes: [{ field, label, was, now }] }

       doc   the piece's documents row (built_from, output), or null
       row   the job (properties row) as it is now
       opts  { fileFound?   a showsheet file is in the folder (scan or live)
               files?       { '<path in job folder>': { modified } } known file dates
               editedPaths? the edited photos, when Drive or the scan says (else unknown)
               floorplan?   the newest floorplan now: { version, render, path, modified } }
             A key left out is unknown and never judged: a phone or a desktop
             without Drive still sees every fact, agent and link change.

     What counts: each printed fact (only facts this sheet still prints),
     the agents (list or order), the listing link, the two photos (path, or
     the same file with a new date: "file updated on Drive"), a newer
     floorplan version or a newer file of the same version.
     What doesn't: sheet-only wording (it isn't in built_from), paper and
     bleed, how it was made, a plan dropped by hand, and anything changed
     with "Typo, no rebuild" (save_job wrote the new value into built_from).
     No built_from: 'untracked' when a file exists ("made before the
     workspace kept track", never stale), else 'none'.

     GVC_STALE.words(changes) → 'price, agents'

   Loads in the browser (window.GVC_STALE, after sheet-job.js) and in Node.
   Tested by scripts/test-piece-stale.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sheet-job.js'), require('./job-facts.js'));
  else global.GVC_STALE = factory(global.GVC_SHEETJOB, global.GVC_FACTS);
})(typeof window !== 'undefined' ? window : globalThis, function (S, F) {
  'use strict';

  var EXTRA_LABELS = { rent: 'Rent', city: 'Town', headline: 'Headline' };

  function labelOf(row, name) {
    var f = F.fieldsFor(row).filter(function (x) { return x.name === name; })[0];
    if (f) return f.label;
    var any = F.FIELDS.filter(function (x) { return x.name === name; })[0];
    return EXTRA_LABELS[name] || (any && any.label) || name;
  }
  function blank(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function same(a, b) { return (blank(a) && blank(b)) || S.same(a, b); }
  function ms(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }

  function stale(doc, row, opts) {
    opts = opts || {};
    var bf = doc && doc.built_from;
    if (!bf || typeof bf !== 'object' || Array.isArray(bf)) return { state: opts.fileFound ? 'untracked' : 'none', changes: [] };
    var changes = [], add = function (field, label, was, now) { changes.push({ field: field, label: label, was: was, now: now }); };

    var printed = S.FIELDS(row, bf.ownership || undefined);
    // every fact the sheet prints now; one the build didn't hold (the chip moved from town to
    // neighbourhood) counts as empty then
    printed.forEach(function (name) {
      var now = S.valueOf(row, name), was = (bf.facts || {})[name];
      if (!same(was, now)) add(name, labelOf(row, name), was, now);
    });

    var agents = S.agentsOf(row).ids;
    if (JSON.stringify(bf.agents || []) !== JSON.stringify(agents)) add('agents', 'Agents', bf.agents || [], agents);
    var url = S.listingUrlOf(row);
    if ((bf.listingUrl || null) !== (url || null)) add('listingUrl', 'Listing link', bf.listingUrl || null, url);

    var now = S.photosOf(row, opts.editedPaths === undefined ? null : opts.editedPaths);
    // with no tray order and Drive unknown only the hero is known: the back photo isn't judged
    var backKnown = ((row && row.photo_order) || []).length > 0 || opts.editedPaths !== undefined;
    if (now) {
      [['front', 'Front photo'], ['back', 'Back photo']].forEach(function (p) {
        if (p[0] === 'back' && !backKnown) return;
        var was = (bf.photos || {})[p[0]] || null, path = now[p[0]] || null;
        if ((was && was.path || null) !== path) { add('photos.' + p[0], p[1], was && was.path || null, path); return; }
        var f = path && opts.files && opts.files[path];
        if (f && was && was.modified && f.modified && ms(f.modified) !== ms(was.modified)) add('photos.' + p[0], p[1], path, 'file updated on Drive');
      });
    }

    var fp = bf.floorplan, fn = opts.floorplan;
    if (fp && !fp.dropped && fn) {
      if (fn.version > fp.version) add('floorplan', 'Floorplan', 'v' + fp.version, 'v' + fn.version);
      else if (fn.version === fp.version) {
        if (fn.path !== fp.path && ms(fn.modified) > ms(fp.modified)) add('floorplan', 'Floorplan', fp.path, fn.path);
        else if (fn.path === fp.path && ms(fn.modified) > ms(fp.modified)) add('floorplan', 'Floorplan', fp.path, 'file updated on Drive');
      }
    }
    return { state: changes.length ? 'stale' : 'fresh', changes: changes };
  }

  function words(changes) {
    return (changes || []).map(function (c) { return String(c.label || c.field).toLowerCase(); }).join(', ');
  }

  return { stale: stale, words: words };
});
