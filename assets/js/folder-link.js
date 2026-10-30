/* ============================================================
   FOLDER LINK — "Link folder" / "Relink" on a job (spec §2.7).

     GVC_LINK.open({ table, row, job }) → Promise<boolean>  (true once saved)
       table  'properties' | 'pitches' | 'dev_projects'
       row    the job's database row (id, version, drive_folder, core/label, market)
       job    the GVC_WS job (name, type)

   Shows up to five suggestions — the job's address run through the alias
   matcher against the market's folder names — and a Browse button (the
   folder picker, which must land inside the connected Drive root). Saving
   writes drive_folder + folder_state 'linked' with the version check, and a
   change-log row (source Matt). Nothing on Drive is created, moved or
   renamed (D7, D10). Needs Drive connected; says so otherwise.
   Needs: property-library.js, drive.js, address-aliases.js, workspace-shell.js.

   suggest(D, A, table, row) also runs in Node (require), with D a lister
   over G: (helper/scan.js): the nightly scan uses the same matching to find
   an unlinked job's folder (Match's M18). A house of a development (a
   listing with dev_project_id) is also looked for under New Development.
   Every NJ listing is too, with or without a development row (a TJ New Dev
   house such as "New Development/619 Bradley Ave"): the top level, and one
   level inside a development's folder ("New Development/Westwood/<house>").

   The dialog also offers the nightly scan's candidate (row.scan.candidate)
   first; one the AI pass picked (candidateBy 'ai', D123) is marked "AI
   guess" with its reason, and is linked only if Matt picks it.
   ============================================================ */
(function (global) {
  'use strict';

  var NY = 'GVC - New York/Building Information';
  var NJ = 'GVC - New Jersey/1. Residential Sales/1. Resale';
  var PLACES = {
    NYC: [NY], NJ: [NJ, 'GVC - New Jersey/Rentals'], FL: ['GVC - Florida/Resale'],
    pitch: ['GVC - Marketing/02 - Assets/Pitches'], devNJ: ['GVC - New Jersey/New Development'], devFL: ['GVC - Florida/New Development']
  };
  var OWNER = { properties: 'property_id', pitches: 'pitch_id', dev_projects: 'dev_project_id' };

  function addrOf(row) {
    var core = row.core || {}, a = String(core.address || row.label || '').trim(), u = String(core.unit || '').trim();
    if (!u && a.indexOf(',') !== -1) { u = a.slice(a.lastIndexOf(',') + 1).trim().replace(/^residence\s+/i, ''); a = a.slice(0, a.lastIndexOf(',')).trim(); }
    return { street: a, unit: u };
  }

  /* folder names only (GVC_DRIVE.list); nothing is opened */
  function suggest(D, A, table, row) {
    var au = addrOf(row), out = [];
    var dirs = function (p) { return D.list(p).then(function (xs) { return xs.filter(function (x) { return x.kind === 'directory'; }).map(function (x) { return x.name; }); }, function () { return []; }); };
    var nameMatches = function (n) {
      var base = n.split(',')[0].replace(/^\d{4}-\d{1,2}-\d{1,2}\s+/, '').split(' - ')[0].trim();
      return A.same(base, au.street) || A.startsWithAddress(base, au.street);
    };
    if (table === 'properties' && row.market === 'NYC') {
      return dirs(NY).then(function (bs) {
        return Promise.all(bs.filter(function (b) { return A.same(b, au.street); }).map(function (b) {
          return dirs(NY + '/' + b).then(function (us) {
            var hit = au.unit ? A.matchFolder(au.street, au.unit, us.map(function (u) { return { name: u, path: NY + '/' + b + '/' + u }; })) : null;
            if (hit) out.push(hit.path);
            out.push(NY + '/' + b);
          });
        }));
      }).then(function () { return out.slice(0, 5); });
    }
    var places = table === 'pitches' ? PLACES.pitch : table === 'dev_projects' ? PLACES['dev' + row.market] || [] : PLACES[row.market] || [];
    var devPlaces = table === 'properties' ? PLACES['dev' + row.market] || [] : [];
    if (table === 'properties' && (row.dev_project_id || row.market === 'NJ')) places = places.concat(devPlaces);
    return Promise.all(places.map(function (p) {
      return dirs(p).then(function (names) {
        if (p === NJ) {   // NJ resale is filed by town
          return Promise.all(names.map(function (town) {
            return dirs(p + '/' + town).then(function (xs) { xs.filter(nameMatches).forEach(function (x) { out.push(p + '/' + town + '/' + x); }); });
          }));
        }
        var hits = names.filter(table === 'dev_projects' ? function (n) { return n.replace(/^\d+\s*-\s*/, '').toLowerCase() === String(row.label).toLowerCase(); } : nameMatches);
        var unitKey = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
        return Promise.all(hits.map(function (x) {
          // one address, several houses ("405 Old Bridge Rd/House 1"): the unit's own folder first (Matt, 10-30)
          if (!(table === 'properties' && au.unit && devPlaces.indexOf(p) !== -1)) { out.push(p + '/' + x); return null; }
          return dirs(p + '/' + x).then(function (xs) {
            xs.filter(function (u) { return unitKey(u) === unitKey(au.unit); }).forEach(function (u) { out.push(p + '/' + x + '/' + u); });
            out.push(p + '/' + x);
          });
        })).then(function () {
          if (devPlaces.indexOf(p) !== -1) {   // a house inside a development's folder; a house folder that matched is not looked into
            return Promise.all(names.filter(function (n) { return !nameMatches(n); }).map(function (dev) {
              return dirs(p + '/' + dev).then(function (xs) { xs.filter(nameMatches).forEach(function (x) { out.push(p + '/' + dev + '/' + x); }); });
            }));
          }
        });
      });
    })).then(function () {
      // filed on the wrong drive (3 Crosby Ln, NJ, sits in New York's Building Information): looked for there
      // only when the job's own drive has nothing, and suggested where it is, never moved (Matt, 10-30)
      if (out.length || table !== 'properties' || row.market === 'NYC') return null;
      return dirs(NY).then(function (bs) { bs.filter(nameMatches).forEach(function (b) { out.push(NY + '/' + b); }); });
    }).then(function () { return out.slice(0, 5); });
  }

  function save(table, row, folder) {
    var P = global.GVC_PROPS;
    return P.call('/rest/v1/' + table + '?id=eq.' + encodeURIComponent(row.id) + '&version=eq.' + encodeURIComponent(row.version), {
      method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ drive_folder: folder, folder_state: 'linked' })
    }).then(function (rows) {
      if (!rows || !rows.length) { var e = new Error('Someone changed this job meanwhile. Reload the page and link it again.'); e.conflict = true; throw e; }
      var c = { field: 'drive_folder', old_value: row.drive_folder || null, new_value: folder, source: 'Matt' };
      c[OWNER[table]] = row.id;
      // the folder is saved by now; if only the log entry fails, say so rather than invite a retry that can only conflict
      return P.call('/rest/v1/changes', { method: 'POST', body: JSON.stringify(c) }).then(function () { return rows[0]; }, function (err) {
        var e = new Error('Linked, but the change log didn\'t save (' + err.message + '). The folder is remembered; there\'s nothing to redo.');
        e.linked = true; throw e;
      });
    });
  }

  function open(o) {
    var doc = global.document, D = global.GVC_DRIVE, A = global.GVC_ADDR, esc = global.GVC_ESC;
    return new Promise(function (resolve) {
      var d = doc.createElement('dialog');
      d.className = 'gvc-link';
      d.style.cssText = 'border:1px solid var(--rule);border-radius:10px;padding:22px 24px;max-width:560px;width:calc(100% - 32px);background:var(--paper);color:var(--ink)';
      d.innerHTML = '<h2 style="font-size:22px;margin:0 0 4px">' + (o.row.folder_state === 'broken' ? 'Relink the folder' : 'Link the Drive folder') + '</h2>' +
        '<p class="soft" style="margin:0 0 14px;font-size:13.5px" id="lkWhat"></p><div id="lkList"><p class="soft">Looking for the folder…</p></div>' +
        '<p id="lkMsg" role="alert" style="min-height:1.2em;color:var(--danger);font-size:13px;margin:10px 0 0"></p>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px"><button type="button" class="b" id="lkBrowse">Browse…</button><button type="button" class="b" id="lkCancel">Cancel</button></div>';
      d.querySelector('#lkWhat').textContent = o.job.name + '. Nothing on Drive is moved or renamed; the job just remembers where its folder is.';
      var msg = d.querySelector('#lkMsg'), list = d.querySelector('#lkList');
      var opener = doc.activeElement, saved = false, busy = false;
      var done = function (ok) { d.close(); d.remove(); if (opener && opener.focus) opener.focus(); resolve(ok); };
      // while saving, Cancel and Escape wait: closing early would miss the save and leave the page on an old version
      var lock = function (on) { d.querySelectorAll('#lkBrowse, #lkCancel, button[data-i]').forEach(function (b) { b.disabled = on; }); };
      d.querySelector('#lkCancel').addEventListener('click', function () { done(saved); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); if (!busy || saved) done(saved); });
      var pick = function (folder) {
        if (busy) return;   // a double click saves once
        busy = true; lock(true);
        msg.textContent = 'Saving…';
        save(o.table, o.row, folder).then(function () { done(true); }, function (e) {
          msg.textContent = e.message;
          if (e.linked) { saved = true; var c = d.querySelector('#lkCancel'); c.textContent = 'Close'; c.disabled = false; return; }
          busy = false; lock(false);
        });
      };
      d.querySelector('#lkBrowse').addEventListener('click', function () {
        if (!D || !global.showDirectoryPicker) { msg.textContent = 'This browser can\'t open Drive folders. Use Chrome on the desktop.'; return; }
        global.showDirectoryPicker({ id: 'gvc-drive', mode: 'read' }).then(function (h) { return D.relPathOf(h); }).then(function (rel) {
          if (!rel) { msg.textContent = 'That folder isn\'t inside G:\\Shared drives. Pick one there.'; return; }
          pick(rel);
        }, function () { /* picker closed */ });
      });
      doc.body.appendChild(d);
      d.showModal();

      (D ? D.state() : Promise.resolve('unsupported')).then(function (s) {
        if (s !== 'connected') {
          list.innerHTML = '<p class="soft">Connect Drive (top right) to look for this job\'s folder.</p>';
          d.querySelector('#lkBrowse').disabled = true;
          return;
        }
        return suggest(D, A, o.table, o.row).then(function (paths) {
          var sc = o.row.scan || {}, note = {};
          if (typeof sc.candidate === 'string' && sc.candidate) {
            if (paths.indexOf(sc.candidate) === -1) paths = [sc.candidate].concat(paths);
            if (sc.candidateBy === 'ai') note[sc.candidate] = 'AI guess' + (sc.candidateWhy ? ': ' + String(sc.candidateWhy).replace(/\.\s*$/, '') : '') + '. Check it before you pick it.';
          }
          list.innerHTML = paths.length ? '<p class="lbl" style="margin:0 0 8px">Suggestions</p>' + paths.map(function (p, i) {
            return '<button type="button" class="b" style="display:flex;flex-direction:column;align-items:flex-start;width:100%;margin-bottom:6px;white-space:normal;text-align:left" data-i="' + i + '">' + esc(p) +
              (note[p] ? '<span class="soft" style="font-size:12.5px;margin-top:2px">' + esc(note[p]) + '</span>' : '') + '</button>';
          }).join('') : '<p class="soft">No folder with this address turned up. Use Browse to pick it.</p>';
          list.querySelectorAll('button[data-i]').forEach(function (b) { b.addEventListener('click', function () { pick(paths[+b.dataset.i]); }); });
        });
      }).catch(function () { list.innerHTML = '<p class="soft">Couldn\'t look through Drive just now. Use Browse to pick the folder.</p>'; });
    });
  }

  global.GVC_LINK = { open: open, suggest: suggest, save: save };
  if (typeof module === 'object' && module.exports) module.exports = global.GVC_LINK;
})(typeof window !== 'undefined' ? window : globalThis);
