/* ============================================================
   DRIVE THROUGH GOOGLE — the shared drives read over the web, no G: drive
   needed (overhaul step 9). On for everyone who signs in with Google on their
   GVC email (Matt, 11-04; a tester-only trial before that). The shared team
   password has no Google account, so it has no Drive (drive.js says
   'not-connected'; Connect Drive is the Google sign-in).

   drive.js asks this file for its root when it is on, and gets folder and
   file objects that act like the browser's own folder handles, so every
   rule in drive.js and drive-rules.js (what may be opened, paperwork never)
   applies unchanged. The permission is read-only (drive.readonly): the
   workspace can't change anything in Drive this way.

     await GVC_DRIVE_WEB.active()   → signed in with a GVC Google account
     await GVC_DRIVE_WEB.state()    → 'connected' | 'needs-click' | 'error'
     await GVC_DRIVE_WEB.connect()  → signs in with Google again, asking for Drive (a page change)
     await GVC_DRIVE_WEB.root()     → the "Shared drives" folder object
     await GVC_DRIVE_WEB.pathOf(id) → a folder's path under Shared drives ('GVC - New York/…')

   Drive comes with the Google sign-in (9b, Matt 11-03): the sign-in asks for
   read-only Drive, the drive-token server function keeps Google's lasting
   permission (0022, no page can read it) and hands this file a fresh pass
   each hour, so nobody clicks again. The pass lives in this tab's
   sessionStorage for its hour, never in a log.

   Each file and folder object also carries its real Drive link (url), so the
   job page opens a file or folder on drive.google.com, never a downloaded copy.
   ============================================================ */
(function (global) {
  'use strict';
  var API = 'https://www.googleapis.com/drive/v3';
  var DOMAIN = '@gvcrealestateteam.com';   // a person's own Google sign-in, never the shared account
  var TOKEN_KEY = 'gvc.drive.web.token', FOLDER = 'application/vnd.google-apps.folder';

  function active() {
    var P = global.GVC_PROPS;
    if (!P || !P.signedIn()) return Promise.resolve(false);
    return P.whoAmI().then(function (w) {
      var email = String((w && w.email) || '').toLowerCase();
      return !!w && w.role !== 'shared' && email.length > DOMAIN.length && email.slice(-DOMAIN.length) === DOMAIN;
    }, function () { return false; });
  }

  /* ---------- the token ---------- */
  function saved() {
    try { var t = JSON.parse(global.sessionStorage.getItem(TOKEN_KEY) || 'null'); return t && t.until > Date.now() + 60000 ? t.value : null; }
    catch (e) { return null; }
  }
  function keep(t, secs) {
    try { global.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ value: t, until: Date.now() + (secs || 3600) * 1000 })); } catch (e) { /* this tab only */ }
    return t;
  }
  function drop() { try { global.sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* gone */ } }
  // this hour's pass: the one this tab holds, else a fresh one from the server; e.consent when it holds no permission
  var asking = null;
  function pass() {
    var t = saved();
    if (t) return Promise.resolve(t);
    if (asking) return asking;
    asking = global.GVC_PROPS.drivePass().then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j.access_token) return keep(j.access_token, j.expires_in);
        var e = new Error(r.status === 409 ? 'Drive needs one click to reconnect.' : (j.error || 'Drive couldn\'t connect.'));
        e.consent = r.status === 409;
        throw e;
      });
    });
    asking.then(function () { asking = null; }, function () { asking = null; });
    return asking;
  }
  function state() {
    return pass().then(function () { return 'connected'; }, function (e) { return e.consent ? 'needs-click' : 'error'; });
  }
  // sign in with Google again with Google's page shown, so it gives the lasting permission (the page reloads)
  function connect() {
    global.GVC_PROPS.googleSignIn({ consent: true });
    return new Promise(function () {});
  }

  /* ---------- the Drive API ---------- */
  function get(path, q, again) {
    var u = API + path + (q ? '?' + new URLSearchParams(q).toString() : '');
    return pass().then(function (t) { return fetch(u, { headers: { authorization: 'Bearer ' + t } }); }).then(function (r) {
      // a pass Google no longer takes: one fresh pass, then give up
      if (r.status === 401) { drop(); if (!again) return get(path, q, true); throw new Error('Drive needs one click to reconnect.'); }
      if (r.status === 403) return r.json().then(function (j) { throw new Error(/has not been used|disabled/.test((j.error || {}).message || '') ? 'The Drive service is switched off in the GVC Helper Google project.' : 'Google Drive refused that folder.'); });
      if (!r.ok) throw new Error('Google Drive answered ' + r.status + '.');
      return q && q.alt === 'media' ? r.blob() : r.json();
    });
  }
  // every child of a folder (a shared drive's own id is its top folder), all pages
  function children(id, driveId) {
    var out = [];
    function page(token) {
      var q = { q: "'" + id + "' in parents and trashed = false", fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
        pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' };
      if (driveId) { q.corpora = 'drive'; q.driveId = driveId; }
      if (token) q.pageToken = token;
      return get('/files', q).then(function (j) { out = out.concat(j.files || []); return j.nextPageToken ? page(j.nextPageToken) : out; });
    }
    return page(null);
  }
  function drives() {
    var out = [];
    function page(token) {
      var q = { pageSize: '100', fields: 'nextPageToken,drives(id,name)' };
      if (token) q.pageToken = token;
      return get('/drives', q).then(function (j) { out = out.concat(j.drives || []); return j.nextPageToken ? page(j.nextPageToken) : out; });
    }
    return page(null);
  }

  /* ---------- folder and file objects, as drive.js uses the browser's handles ---------- */
  function notFound(name) { var e = new Error(name + ' isn\'t there.'); e.name = 'NotFoundError'; return e; }
  function iterate(list) {
    var i = 0;
    return { next: function () { return list().then(function (xs) { return i < xs.length ? { value: xs[i++], done: false } : { value: undefined, done: true }; }); } };
  }
  function fileHandle(f, path) {
    return { kind: 'file', name: f.name, _path: path, url: 'https://drive.google.com/file/d/' + encodeURIComponent(f.id) + '/view',
      meta: { size: f.size == null ? undefined : +f.size, modified: f.modifiedTime },
      getFile: function () {
        return get('/files/' + encodeURIComponent(f.id), { alt: 'media', supportsAllDrives: 'true' }).then(function (b) {
          return new File([b], f.name, { type: b.type, lastModified: Date.parse(f.modifiedTime) || Date.now() });
        });
      } };
  }
  function dirHandle(name, path, list, id) {
    var cache = null;
    var kids = function () { return cache || (cache = list().catch(function (e) { cache = null; throw e; })); };
    var find = function (n, kind) {
      return kids().then(function (xs) { var h = xs.filter(function (x) { return x.name === n && x.kind === kind; })[0]; if (!h) throw notFound(n); return h; });
    };
    return { kind: 'directory', name: name, _path: path, url: id ? 'https://drive.google.com/drive/folders/' + encodeURIComponent(id) : undefined,
      values: function () { return iterate(kids); },
      getDirectoryHandle: function (n) { return find(n, 'directory'); },
      getFileHandle: function (n) { return find(n, 'file'); } };
  }
  function folderOf(f, path, driveId) {
    return dirHandle(f.name, path, function () {
      return children(f.id, driveId).then(function (xs) {
        return xs.map(function (x) {
          var p = path + '/' + x.name;
          return x.mimeType === FOLDER ? folderOf(x, p, driveId) : fileHandle(x, p);
        });
      });
    }, f.id);
  }
  var top = null;
  function root() {
    top = top || dirHandle('Shared drives', '', function () {
      return drives().then(function (ds) { return ds.map(function (d) { return folderOf({ id: d.id, name: d.name }, d.name, d.id); }); });
    });
    return Promise.resolve(top);
  }

  /* a folder id (from a pasted Drive link) → 'Shared drive name/Folder/Sub', walking up its parents */
  function pathOf(id) {
    var F = { fields: 'id,name,parents,driveId,mimeType', supportsAllDrives: 'true' };
    return get('/files/' + encodeURIComponent(id), F).then(function (f) {
      if (f.mimeType !== FOLDER) throw new Error('That link is a file, not a folder.');
      if (!f.driveId) throw new Error('That folder isn\'t on one of the team\'s shared drives.');
      var names = [];
      function up(x, n) {
        if (x.id === f.driveId) return Promise.resolve();   // the shared drive itself
        names.unshift(x.name);
        var parent = (x.parents || [])[0];
        if (!parent || parent === f.driveId || n > 15) return Promise.resolve();
        return get('/files/' + encodeURIComponent(parent), F).then(function (q) { return up(q, n + 1); });
      }
      return up(f, 0).then(function () { return get('/drives/' + encodeURIComponent(f.driveId), { fields: 'name' }); })
        .then(function (d) { return [d.name].concat(names).join('/'); });
    }, function (e) { throw /refused|answered 404/.test(e.message) ? new Error('Google Drive couldn\'t open that link. Check it\'s a folder you can see.') : e; });
  }

  global.GVC_DRIVE_WEB = { active: active, state: state, connect: connect, root: root, pathOf: pathOf };
})(window);
