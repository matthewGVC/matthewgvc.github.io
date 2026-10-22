/* ============================================================
   DRIVE — the workspace's window onto G:\Shared drives (plan D4, §9).

   Uses the browser's File System Access API (Chrome / Edge on a desktop).
   Matt picks "G:\Shared drives" once; the folder handle is kept in
   IndexedDB, so later visits need at most one click ("Reconnect Drive").
   If Chrome won't take "Shared drives" itself as the root, each shared
   drive (GVC - New York, GVC - New Jersey…) can be picked as its own root.

     await GVC_DRIVE.state()      'connected' | 'needs-click' | 'not-connected' | 'unsupported' | 'error'
     await GVC_DRIVE.connect()    folder picker → names of the roots now held
     await GVC_DRIVE.reconnect()  call from a click; true when access is back
     await GVC_DRIVE.list('GVC - New York/ACTIVE LISTINGS & DEALS')
                                  → [{name, kind: 'file' | 'directory'}]
     await GVC_DRIVE.readJobFile(jobFolder, 'Photos/Edited/a.jpg', {timeoutMs})
                                  → File, once its first byte arrives. Refused by GVC_DRIVE_RULES before any
                                    handle inside the job is opened.
     await GVC_DRIVE.relPathOf(handle)  → 'GVC - New York/…' or null
     await GVC_DRIVE.tree(jobFolder, { depth: 3, timeoutMs })
                                  → the job folder as GVC_HEALTH's tree: readable folders to `depth` levels
                                    (files with size and modified), the details doc and other loose top
                                    files by name only (never opened), paperwork folders as one skipped
                                    line, paperwork files and unreadable folders only counted
                                    (GVC_DRIVE_RULES.jobTree). A folder that is gone → { broken: true }.
     await GVC_DRIVE.listJob(jobFolder, 'Photos/Edited', { timeoutMs })
                                  → [{ name, kind, size, modified }] of one readable folder, by name;
                                    anything GVC_DRIVE_RULES.allowedInJob refuses is left out.

   Paths are relative to G:\Shared drives\, with "/" or "\".
   Needs assets/js/drive-rules.js loaded first.
   ============================================================ */
(function (global) {
  'use strict';

  var RULES = global.GVC_DRIVE_RULES;
  var DB = 'gvc-drive', STORE = 'roots', TOP = 'Shared drives';

  /* ---------- IndexedDB: root handles survive reloads and restarts ---------- */
  function db() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), out = fn(t.objectStore(STORE));
        t.oncomplete = function () { res(out && out.result); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function roots() {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var all = {}, c = d.transaction(STORE).objectStore(STORE).openCursor();
        c.onsuccess = function () {
          var cur = c.result;
          if (!cur) return res(all);
          all[cur.key] = cur.value; cur.continue();
        };
        c.onerror = function () { rej(c.error); };
      });
    });
  }

  function supported() { return typeof global.showDirectoryPicker === 'function'; }

  /* 'error' when the browser won't open its storage (blocked site data, a
     private window): the page says so instead of waiting forever. */
  function state() {
    if (!supported()) return Promise.resolve('unsupported');
    return roots().then(function (all) {
      var hs = Object.keys(all).map(function (k) { return all[k]; });
      if (!hs.length) return 'not-connected';
      return Promise.all(hs.map(function (h) { return h.queryPermission({ mode: 'read' }); }))
        .then(function (ps) {
          return ps.every(function (p) { return p === 'granted'; }) ? 'connected' : 'needs-click';
        });
    }).catch(function () { return 'error'; });
  }

  function connect() {
    if (!supported()) return Promise.reject(new Error('This browser can\'t open Drive folders. Use Chrome or Edge on the desktop.'));
    return global.showDirectoryPicker({ id: 'gvc-drive', mode: 'read' }).then(function (h) {
      return tx('readwrite', function (s) { s.put(h, h.name); });
    }).then(function () { return roots(); }).then(Object.keys);
  }

  /* true only when every root is back; a refused one is false, not an error */
  function reconnect() {
    return roots().then(function (all) {
      return Promise.all(Object.keys(all).map(function (k) {
        return all[k].requestPermission({ mode: 'read' }).catch(function () { return 'denied'; });
      }));
    }).then(function (ps) { return ps.length > 0 && ps.every(function (p) { return p === 'granted'; }); });
  }

  /* 'GVC - New York/Building Information' → [rootHandle, ['GVC - New York', 'Building Information']] */
  function locate(path) {
    var r = RULES.rel(path);
    if (r === null) return Promise.reject(new Error('That path isn\'t allowed.'));
    var parts = r ? r.split('/') : [];
    return roots().then(function (all) {
      if (all[TOP]) return [all[TOP], parts];
      if (parts.length && all[parts[0]]) return [all[parts[0]], parts.slice(1)];
      throw new Error('Drive isn\'t connected for ' + (parts[0] || 'that folder') + '.');
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

  function relPathOf(handle) {
    return roots().then(function (all) {
      var names = Object.keys(all);
      return names.reduce(function (p, k) {
        return p.then(function (found) {
          if (found) return found;
          return all[k].resolve(handle).then(function (segs) {
            if (!segs) return null;
            return (k === TOP ? segs : [k].concat(segs)).join('/');
          });
        });
      }, Promise.resolve(null));
    });
  }

  global.GVC_DRIVE = {
    supported: supported, state: state, connect: connect, reconnect: reconnect,
    list: list, readJobFile: readJobFile, relPathOf: relPathOf, tree: tree, listJob: listJob,
    _withTimeout: withTimeout, _treeOf: treeOf, _listOf: listOf   // for tests
  };
})(window);
