/* ============================================================
   DRIVE — the workspace's window onto the team's shared drives (plan D4, §9).

   Read over the web through Google (overhaul 9, assets/js/drive-web.js, loaded
   before this file): anyone signed in with Google on their GVC email reads
   "Shared drives" read-only, on any computer or phone. Connecting is a Google
   sign-in. The old way, picking this computer's G:\Shared drives folder, is
   gone (Matt, 11-04); the desktop helper still reads G: on its own.

     await GVC_DRIVE.state()      'connected' | 'needs-click' | 'not-connected' | 'error'
     await GVC_DRIVE.connect()    signs in with Google, asking for Drive (the page changes)
     await GVC_DRIVE.reconnect()  the same, from a click
     await GVC_DRIVE.list('GVC - New York/ACTIVE LISTINGS & DEALS')
                                  → [{name, kind: 'file' | 'directory'}]
     await GVC_DRIVE.readJobFile(jobFolder, 'Photos/Edited/a.jpg', {timeoutMs})
                                  → File, once its first byte arrives. Refused by GVC_DRIVE_RULES before any
                                    handle inside the job is opened.
     await GVC_DRIVE.pathOfLink('https://drive.google.com/drive/folders/…')
                                  → 'GVC - New York/…', the folder a pasted Drive link points at
     await GVC_DRIVE.tree(jobFolder, { depth: 3, timeoutMs })
                                  → the job folder as GVC_HEALTH's tree: readable folders to `depth` levels
                                    (files with size and modified), the details doc and other loose top
                                    files by name only (never opened), paperwork folders as one skipped
                                    line, paperwork files and unreadable folders only counted
                                    (GVC_DRIVE_RULES.jobTree). A folder that is gone → { broken: true }.
     await GVC_DRIVE.listJob(jobFolder, 'Photos/Edited', { timeoutMs })
                                  → [{ name, kind, size, modified }] of one readable folder, by name;
                                    anything GVC_DRIVE_RULES.allowedInJob refuses is left out.

     await GVC_DRIVE.listFinishes(devFolder, '0 - Approved Assets/Finishes', { timeoutMs })
                                  → [{ name, kind, size, modified, url }]: the finish sheets at the top of
                                    one folder of a development (GVC_DRIVE_RULES.finishFile: PDFs only).
                                    A folder that isn't there → [].

   Paths are relative to Shared drives\, with "/" or "\".
   Needs assets/js/drive-rules.js loaded first.
   ============================================================ */
(function (global) {
  'use strict';

  var RULES = global.GVC_DRIVE_RULES;
  function WEB() { return global.GVC_DRIVE_WEB; }

  // the old G: folder picker kept its folder in this browser's storage: clear it once
  try { if (global.indexedDB) global.indexedDB.deleteDatabase('gvc-drive'); } catch (e) { /* nothing kept */ }

  function web() { return WEB() ? WEB().active() : Promise.resolve(false); }

  /* 'not-connected' when this person isn't signed in with Google on a GVC email
     (the shared team password, or signed out): Connect Drive is that sign-in */
  function state() {
    return web().then(function (on) { return on ? WEB().state() : 'not-connected'; }, function () { return 'error'; });
  }
  function connect() {
    if (!WEB()) return Promise.reject(new Error('Drive isn\'t available on this page.'));
    return WEB().connect();
  }
  function reconnect() {
    return connect().then(function () { return true; }, function () { return false; });
  }

  /* 'GVC - New York/Building Information' → [rootHandle, ['GVC - New York', 'Building Information']] */
  function locate(path) {
    var r = RULES.rel(path);
    if (r === null) return Promise.reject(new Error('That path isn\'t allowed.'));
    var parts = r ? r.split('/') : [];
    return web().then(function (on) {
      if (!on) throw new Error('Drive isn\'t connected. Sign in with Google to read it.');
      return WEB().root().then(function (root) { return [root, parts]; });
    });
  }

  function walk(dir, parts) {
    return parts.reduce(function (p, name) {
      return p.then(function (d) { return d.getDirectoryHandle(name); });
    }, Promise.resolve(dir));
  }

  function list(path) {
    return locate(path).then(function (x) { return walk(x[0], x[1]); }).then(function (d) {
      var out = [], it = d.values();
      function next() {
        return it.next().then(function (r) {
          if (r.done) return out.sort(function (a, b) { return a.name.localeCompare(b.name); });
          out.push({ name: r.value.name, kind: r.value.kind });
          return next();
        });
      }
      return next();
    });
  }

  /* p, or a rejection after ms; the timer is cleared either way */
  function withTimeout(p, ms, message) {
    var timer;
    var limit = new Promise(function (_, rej) { timer = setTimeout(function () { rej(new Error(message)); }, ms); });
    return Promise.race([p, limit]).then(
      function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; });
  }

  /* Returns the File once its first byte arrives: proof Drive is serving it,
     without pulling a whole film into memory. The caller reads the rest. */
  function readJobFile(jobFolder, inside, opts) {
    if (!RULES.allowedInJob(inside)) return Promise.reject(new Error('Not allowed: the workspace only reads Floorplan, Photos and Marketing folders and the details doc.'));
    if (RULES.rel(jobFolder) === null) return Promise.reject(new Error('That path isn\'t allowed.'));
    var ms = (opts && opts.timeoutMs) || 20000;
    var parts = RULES.rel(inside).split('/'), file = parts.pop();
    var read = locate(jobFolder).then(function (x) { return walk(x[0], x[1].concat(parts)); })
      .then(function (d) { return d.getFileHandle(file); })
      .then(function (h) { return h.getFile(); })
      .then(function (f) { return f.slice(0, 1).arrayBuffer().then(function () { return f; }); });
    return withTimeout(read, ms, 'Drive hasn\'t downloaded this file yet. Open it once in Google Drive, then try again.');
  }

  var SLOW = "Drive hasn't downloaded this yet.";
  function byName(a, b) { return a.name.localeCompare(b.name); }

  /* every handle in a folder; each step may wait at most ms */
  function entries(dir, ms) {
    var out = [], it = dir.values();
    function next() {
      return withTimeout(it.next(), ms, SLOW).then(function (r) {
        if (r.done) return out;
        out.push(r.value);
        return next();
      });
    }
    return next();
  }
  /* size and date of an allowed file; a file Drive won't serve in time just has none */
  function fileNode(h, ms) {
    // Drive through Google already knows size and date: no download for them. Its date is
    // Google's modifiedTime, another clock than G:'s file date (clock: 'google', see GVC_STALE)
    if (h.meta) return Promise.resolve(Object.assign(h.meta.modified ? { name: h.name, kind: 'file', size: h.meta.size, modified: new Date(h.meta.modified).toISOString(), clock: 'google' } : { name: h.name, kind: 'file' },
      h.url ? { url: h.url } : {}));   // and its real Drive link
    return withTimeout(h.getFile(), ms, SLOW).then(function (f) {
      return { name: h.name, kind: 'file', size: f.size, modified: new Date(f.lastModified).toISOString() };
    }, function () { return { name: h.name, kind: 'file' }; });
  }

  /* raw photo sets are counted by name, never read (like the helper's scan) */
  var NO_READ = ['raw', 'raws'];

  /* the walk under a job folder's handle; every name passes the rules before
     its handle is opened, and a paperwork folder at any depth is never listed
     (exposed as _treeOf for tests) */
  function treeOf(root, opts) {
    var depth = (opts && opts.depth) || 3, ms = (opts && opts.timeoutMs) || 20000;
    var top = { name: root.name, kind: 'directory', children: [], looseCount: 0, otherCount: 0 };
    if (root.url) top.url = root.url;
    function walkDir(dir, segs, left, node) {
      return entries(dir, ms).then(function (hs) {
        return Promise.all(hs.map(function (h) {
          var path = segs.concat(h.name);
          if (h.kind !== 'directory' && RULES.isJunk(h.name)) return null;   // sidecars, Thumbs.db: never opened
          if (!segs.length) {
            var paper = RULES.isPaperworkFolder(h.name) || RULES.hasPaperworkWord(h.name);
            if (h.kind === 'directory') {
              if (paper) return { name: h.name, kind: 'directory', skipped: true };
              if (!RULES.allowedInJob(h.name)) { top.otherCount++; return null; }
            } else {
              if (paper) { top.looseCount++; return null; }
              if (!RULES.allowedInJob(h.name)) return { name: h.name, kind: 'file' };   // loose: named, never opened
            }
          } else if (!RULES.allowedInJob(path.join('/'))) return null;
          if (h.kind !== 'directory') {
            if (segs.some(function (g) { return NO_READ.indexOf(g.toLowerCase()) !== -1; })) return { name: h.name, kind: 'file' };
            return fileNode(h, ms);
          }
          if (RULES.isPaperwork(h.name)) return null;            // "Marketing/Docs": never listed, never opened
          var d = { name: h.name, kind: 'directory', children: [] };
          if (h.url) d.url = h.url;
          if (left <= 1) { d.more = true; return d; }
          return walkDir(h, path, left - 1, d);
        })).then(function (kids) {
          node.children = kids.filter(Boolean).sort(byName);
          return node;
        });
      });
    }
    return walkDir(root, [], depth, top).then(RULES.jobTree);
  }

  function tree(jobFolder, opts) {
    if (RULES.rel(jobFolder) === null) return Promise.reject(new Error("That path isn't allowed."));
    var parts = RULES.rel(jobFolder).split('/');
    return locate(jobFolder).then(function (x) { return walk(x[0], x[1]); }).then(function (d) {
      return treeOf(d, opts);
    }, function (e) {
      if (e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return { name: parts[parts.length - 1], kind: 'directory', broken: true };
      throw e;
    });
  }

  /* one readable folder's entries (exposed as _listOf for tests) */
  function listOf(root, sub, opts) {
    var ms = (opts && opts.timeoutMs) || 20000, r = RULES.rel(sub);
    if (!r || !RULES.allowedInJob(r) || r.split('/').some(RULES.isPaperwork)) return Promise.reject(new Error('Not allowed: the workspace only reads Floorplan, Photos and Marketing folders and the details doc.'));
    return walk(root, r.split('/')).then(function (d) { return entries(d, ms); }).then(function (hs) {
      return Promise.all(hs.map(function (h) {
        if (h.kind !== 'directory' && RULES.isJunk(h.name)) return null;
        if (!RULES.allowedInJob(r + '/' + h.name)) return null;
        if (h.kind === 'directory' && RULES.isPaperwork(h.name)) return null;
        return h.kind === 'directory' ? { name: h.name, kind: 'directory' } : fileNode(h, ms);
      }));
    }).then(function (xs) { return xs.filter(Boolean).sort(byName); });
  }

  function listJob(jobFolder, sub, opts) {
    if (RULES.rel(jobFolder) === null) return Promise.reject(new Error("That path isn't allowed."));
    if (!RULES.allowedInJob(sub)) return Promise.reject(new Error('Not allowed: the workspace only reads Floorplan, Photos and Marketing folders and the details doc.'));
    return locate(jobFolder).then(function (x) { return walk(x[0], x[1]); }).then(function (d) { return listOf(d, sub, opts); });
  }

  function listFinishes(devFolder, sub, opts) {
    var ms = (opts && opts.timeoutMs) || 20000, r = RULES.rel(sub);
    if (RULES.rel(devFolder) === null || r === null) return Promise.reject(new Error("That path isn't allowed."));
    return locate(devFolder).then(function (x) { return walk(x[0], x[1].concat(r ? r.split('/') : [])); }).then(function (d) {
      return entries(d, ms);
    }).then(function (hs) {
      return Promise.all(hs.map(function (h) {
        return h.kind === 'file' && RULES.finishFile((r ? r + '/' : '') + h.name) ? fileNode(h, ms) : null;
      }));
    }, function (e) {
      if (e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return [];
      throw e;
    }).then(function (xs) { return xs.filter(Boolean).sort(byName); });
  }

  /* a pasted Drive folder link → its path under Shared drives, or a plain reason it can't be used */
  function pathOfLink(link) {
    var m = String(link || '').match(/\/folders\/([A-Za-z0-9_-]{10,})/) || String(link || '').match(/[?&]id=([A-Za-z0-9_-]{10,})/);
    if (!m) return Promise.reject(new Error('That isn\'t a Google Drive folder link.'));
    return web().then(function (on) {
      if (!on) throw new Error('Drive isn\'t connected. Sign in with Google to read it.');
      return WEB().pathOf(m[1]);
    }).then(function (p) {
      if (RULES.rel(p) === null) throw new Error('That folder isn\'t one the workspace may link.');
      return p;
    });
  }

  global.GVC_DRIVE = {
    state: state, connect: connect, reconnect: reconnect,
    list: list, readJobFile: readJobFile, pathOfLink: pathOfLink, tree: tree, listJob: listJob, listFinishes: listFinishes,
    _withTimeout: withTimeout, _treeOf: treeOf, _listOf: listOf   // for tests
  };
})(window);
