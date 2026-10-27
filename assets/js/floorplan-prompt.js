/* ============================================================
   FLOORPLAN PROMPT: the text Matt pastes into a fresh Claude chat to make a
   job's floorplan (the Make Floorplan button on the job page's Floorplans card).

     GVC_FPPROMPT.build(row, files, recorded)
       -> { ok: true, text, version } | { ok: false, reason }

   files: the card's list, { path, name, modified }, paths starting with the
   floorplan folder's own name. recorded: rows of the floorplans table.
   References are the files in Floorplan\Design\ (not Design\archive\): image,
   PDF, SVG, DWG or DXF; never paperwork, plan.json or run-v*.md.
   The chat follows the making-gvc-floorplans skill.
   Loads in the browser (window.GVC_FPPROMPT) and in Node (require).
   ============================================================ */
(function (global, factory) {
  'use strict';
  var node = typeof module === 'object' && module.exports;
  var api = factory(node ? require('./drive-rules.js') : global.GVC_DRIVE_RULES,
    node ? require('./sheet-job.js') : global.GVC_SHEETJOB);
  if (node) module.exports = api;
  else global.GVC_FPPROMPT = api;
})(typeof window !== 'undefined' ? window : globalThis, function (R, J) {
  'use strict';

  var FOLDER = /^floor\s*plans?$/i;
  var REF = /\.(png|jpe?g|webp|gif|pdf|svg|dwg|dxf)$/i;
  var NO_DRIVE = 'This job has no Drive folder linked yet. Link it first.';
  var NO_FOLDER = 'There is no Floorplan folder in the job\'s Drive folder yet. Make one with a Design folder inside and drop the reference there.';
  var NO_REF = 'There is nothing in Floorplan\\Design yet. Drop the reference (Cubicasa file, screenshot, architect\'s PDF or DWG) there.';

  function segs(f) { return String(f.path || f.name || '').split(/[\\/]+/).filter(Boolean); }
  function nameOf(f) { return f.name || segs(f).pop() || ''; }
  function day(v) {
    var d = new Date(v);
    if (!v || isNaN(d.getTime())) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function isReference(f) {
    var s = segs(f), name = nameOf(f);
    if (R.planPlace(String(f.path || '')) !== 'design') return false;
    if (s.length > 3 && /^archive$/i.test(s[2])) return false;
    if (!REF.test(name) || /^plan\.json$/i.test(name) || /^run-v.*\.md$/i.test(name)) return false;
    return !s.some(function (x) { return R.hasPaperworkWord(x); });
  }

  function build(row, files, recorded) {
    row = row || {};
    files = files || [];
    if (!row.drive_folder) return { ok: false, reason: NO_DRIVE };
    var folder = null;
    files.forEach(function (f) { var s = segs(f); if (!folder && s.length > 1 && FOLDER.test(s[0])) folder = s[0]; });
    if (!folder) return { ok: false, reason: NO_FOLDER };
    var refs = files.filter(isReference);
    if (!refs.length) return { ok: false, reason: NO_REF };

    var top = 0;
    files.forEach(function (f) { if (R.planPlace(String(f.path || '')) !== 'design') top = Math.max(top, J.versionOf(f)); });
    (recorded || []).forEach(function (x) { top = Math.max(top, +x.version || 0); });
    var version = top + 1;

    var bits = [row.market, row.kind === 'rental' ? 'rental' : 'sale'].filter(Boolean);
    var beds = J.valueOf(row, 'beds'), baths = J.valueOf(row, 'baths'), half = J.valueOf(row, 'halfBaths');
    var sqft = /nyc/i.test(String(row.market || '')) ? null : J.valueOf(row, 'sqft');
    var num = function (v) { var n = Number(String(v).replace(/,/g, '')); return v !== null && isFinite(n) ? n : null; };
    if (beds !== null && baths !== null) bits.push(beds + ' bed / ' + baths + ' bath');
    else if (beds !== null) bits.push(beds + ' bed');
    else if (baths !== null) bits.push(baths + ' bath');
    if (num(half) > 0) bits.push(num(half) + ' half bath');
    var lines = [
      'Make the floorplan for ' + row.label + ' (' + bits.join(', ') + ').',
      ''
    ];
    /* the header's address and facts, straight from the job, so the chat never reads them off a picture */
    var core = row.core || {}, addr = [core.address, core.unit].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(', ');
    if (addr) lines.push('Address: ' + addr);
    var facts = {};
    if (num(beds) !== null) facts.beds = num(beds);
    if (num(baths) !== null) facts.baths = num(baths);
    if (num(half) > 0) facts.half = num(half);
    if (num(sqft) > 0) facts.sqft = num(sqft);
    if (Object.keys(facts).length) lines.push('Facts: ' + JSON.stringify(facts));
    lines.push('Floorplan folder: G:\\Shared drives\\' + String(row.drive_folder).replace(/[\\/]+/g, '\\') + '\\' + folder,
      'References in Design\\:');
    refs.forEach(function (f) { var d = day(f.modified); lines.push('- ' + nameOf(f) + (d ? ' (modified ' + d + ')' : '')); });
    lines.push('Save as version v' + version + '.', '', 'Use the making-gvc-floorplans skill.');
    return { ok: true, text: lines.join('\n'), version: version };
  }

  return { build: build };
});
