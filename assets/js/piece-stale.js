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

     Slice 5: a built_from with v: 2 names its piece (brochure, postcards,
     seller pitch, the pitch's map) and is judged by that piece's rules from
     GVC_PIECEJOB: the facts it prints, its agents (only the ones it prints),
     the listing link (brochure), its photos as a list (order counts), its
     floorplans (a newer version, a level added or gone, a newer file) and its
     map (a newer map file; a dropped one never counts). More opts for these:
       photoPaths?  the photos a pitch's folder offers now (no picks on a pitch)
       plans?       the newest floorplans now (GVC_PIECEJOB.pickFloorplans)
       map?         the pitch map's current file { path, modified }

   Loads in the browser (window.GVC_STALE, after sheet-job.js and, for the
   Slice 5 pieces, piece-job.js) and in Node. Tested by scripts/test-piece-stale.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sheet-job.js'), require('./job-facts.js'), require('./piece-job.js'));
  else global.GVC_STALE = factory(global.GVC_SHEETJOB, global.GVC_FACTS, function () { return global.GVC_PIECEJOB; });
})(typeof window !== 'undefined' ? window : globalThis, function (S, F, PJ) {
  'use strict';

  var EXTRA_LABELS = { rent: 'Rent', city: 'Town', headline: 'Headline', mapAddresses: 'Mapped addresses', comps: 'Comps',
    priceLow: 'Low price', priceMid: 'Recommended price', priceHigh: 'High price', recBand: 'Recommended band',
    closePrice: 'Closing price', features: 'Features' };
  function pieces() { return typeof PJ === 'function' ? PJ() : PJ; }

  function labelOf(row, name) {
    var f = F.fieldsFor(row).filter(function (x) { return x.name === name; })[0];
    if (f) return f.label;
    var any = F.FIELDS.filter(function (x) { return x.name === name; })[0];
    return EXTRA_LABELS[name] || (any && any.label) || name;
  }
  function blank(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function same(a, b) { return (blank(a) && blank(b)) || S.same(a, b); }
  function ms(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }

  /* ---------- Slice 5 pieces (built_from v2) ---------- */
  function paths(list) { return (Array.isArray(list) ? list : []).map(function (p) { return p && p.path || null; }).filter(Boolean); }
  function staleV2(bf, row, opts, add) {
    var J = pieces(), tool = bf.tool;
    if (!J || J.TOOLS.indexOf(tool) === -1) return;   // a piece this page doesn't know: never judged
    J.FIELDS(tool, row).forEach(function (name) {
      var now = J.value(tool, row, name), was = (bf.facts || {})[name];
      if (!same(was, now)) add(name, labelOf(row, name), was, now);
    });
    if (J.maxAgents(tool)) {
      var ag = J.agents(tool, row).ids;
      if (JSON.stringify(bf.agents || []) !== JSON.stringify(ag)) add('agents', 'Agents', bf.agents || [], ag);
    }
    if (tool === 'signage' && bf.market && row.market && bf.market !== row.market) add('market', 'Market', bf.market, row.market);   // the office line
    if ((J.LINKED || ['brochure']).indexOf(tool) !== -1) {
      var url = J.linkOf ? J.linkOf(row) : S.listingUrlOf(row);
      if ((bf.listingUrl || null) !== (url || null)) add('listingUrl', 'Listing link', bf.listingUrl || null, url);
    }
    // photos: the list in order; with no picks and Drive unknown, not judged
    var was = paths(bf.photos), now = opts.photoPaths !== undefined ? opts.photoPaths
      : J.photosFor(tool, row, opts.editedPaths === undefined ? null : opts.editedPaths);
    // with no tray order and Drive unknown only the hero is known (as the Showsheet's back photo)
    var heroOnly = opts.photoPaths === undefined && opts.editedPaths === undefined && !((row.photo_order || []).length);
    if (now && heroOnly) { now = now.slice(0, 1); was = was.slice(0, 1); }
    if (now && tool !== 'pitch-map' && (was.length || now.length)) {
      if (JSON.stringify(was) !== JSON.stringify(now.slice(0, Math.max(was.length, now.length)))) add('photos', 'Photos', was, now);
      else if (opts.files && (bf.photos || []).some(function (p) {
        var f = p && p.path && opts.files[p.path];
        return f && p.modified && f.modified && ms(f.modified) !== ms(p.modified);
      })) add('photos', 'Photos', was, 'file updated on Drive');
    }
    // floorplans: a newer version, a level added or gone, or a newer file
    // (only the pieces that print plans; a junk entry is skipped, never thrown on)
    var real = function (list) { return list.filter(function (p) { return p && typeof p === 'object' && p.path; }); };
    if ((tool === 'brochure' || tool === 'seller') && Array.isArray(opts.plans) && Array.isArray(bf.plans)) {
      var bp = real(bf.plans), np = real(opts.plans);
      var bv = Math.max.apply(null, [0].concat(bp.map(function (p) { return p.version || 0; })));
      var nv = Math.max.apply(null, [0].concat(np.map(function (p) { return p.version || 0; })));
      if (nv > bv) add('floorplan', 'Floorplan', 'v' + bv, 'v' + nv);
      else if (JSON.stringify(paths(bp).sort()) !== JSON.stringify(paths(np).sort()) && nv === bv) add('floorplan', 'Floorplan', paths(bp), paths(np));
      else if (bp.some(function (p) {
        var n = np.filter(function (x) { return x.path === p.path; })[0];
        return n && ms(n.modified) > ms(p.modified);
      })) add('floorplan', 'Floorplan', paths(bp), 'file updated on Drive');
    }
    // the map: a newer file than the one printed (a dropped map never counts; no dates, not judged)
    var bm = bf.map, nm = opts.map;
    if (bm && !bm.dropped && nm && nm.path && ms(nm.modified)) {
      if (nm.path !== bm.path ? ms(nm.modified) >= ms(bm.modified) : ms(nm.modified) > ms(bm.modified)) {
        add('map', 'Map', bm.path, nm.path === bm.path ? 'file updated on Drive' : nm.path);
      }
    }
  }

  function stale(doc, row, opts) {
    opts = opts || {};
    var bf = doc && doc.built_from;
    if (!bf || typeof bf !== 'object' || Array.isArray(bf)) return { state: opts.fileFound ? 'untracked' : 'none', changes: [] };
    var changes = [], add = function (field, label, was, now) { changes.push({ field: field, label: label, was: was, now: now }); };
    if (bf.v === 2) {
      staleV2(bf, row || {}, opts, add);
      return { state: changes.length ? 'stale' : 'fresh', changes: changes };
    }

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
