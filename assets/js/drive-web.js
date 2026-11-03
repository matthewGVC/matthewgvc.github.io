/* ============================================================
   DRIVE THROUGH GOOGLE — the shared drives read over the web, no G: drive
   needed (overhaul step 9). A test for TESTERS only (Matt, 11-03: Matt, Ilin,
   Sydney); everyone else keeps the local folder (drive.js).

   drive.js asks this file for its root when it is on, and gets folder and
   file objects that act like the browser's own folder handles, so every
   rule in drive.js and drive-rules.js (what may be opened, paperwork never)
   applies unchanged. The permission is read-only (drive.readonly): the
   workspace can't change anything in Drive this way.

     await GVC_DRIVE_WEB.active()   → this person is a tester (and hasn't turned it off)
     await GVC_DRIVE_WEB.state()    → 'connected' | 'needs-click'
     await GVC_DRIVE_WEB.connect()  → from a click: Google asks once, then just signs in
     await GVC_DRIVE_WEB.root()     → the "Shared drives" folder object

   The Google token lives in this tab's sessionStorage for its hour, never in
   the database or a log. localStorage 'gvc.drive.local' = '1' turns the test
   off on one computer (the local folder again).
   ============================================================ */
(function (global) {
  'use strict';
  var CLIENT_ID = '537755129990-08phgja5558aa7lifp0mo15c711go2jp.apps.googleusercontent.com';   // public: the GVC Helper web client
  var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  var API = 'https://www.googleapis.com/drive/v3';
  var TESTERS = ['matthew@gvcrealestateteam.com', 'ilin@gvcrealestateteam.com', 'sydney@gvcrealestateteam.com'];
  var TOKEN_KEY = 'gvc.drive.web.token', FOLDER = 'application/vnd.google-apps.folder';

  function active() {
    try { if (global.localStorage.getItem('gvc.drive.local') === '1') return Promise.resolve(false); } catch (e) { /* no storage */ }
    var P = global.GVC_PROPS;
    if (!P || !P.signedIn()) return Promise.resolve(false);
    return P.whoAmI().then(function (w) { return TESTERS.indexOf(String((w && w.email) || '').toLowerCase()) !== -1; }, function () { return false; });
  }

  /* ---------- the token ---------- */
  function saved() {
    try { var t = JSON.parse(global.sessionStorage.getItem(TOKEN_KEY) || 'null'); return t && t.until > Date.now() + 60000 ? t.value : null; }
    catch (e) { return null; }
  }
  function state() { return Promise.resolve(saved() ? 'connected' : 'needs-click'); }

  var gis = null;
  function loadGis() {
    if (global.google && global.google.accounts && global.google.accounts.oauth2) return Promise.resolve();
    if (gis) return gis;
    gis = new Promise(function (res, rej) {
      var s = global.document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () { res(); }; s.onerror = function () { gis = null; rej(new Error('Google couldn\'t be reached.')); };
      global.document.head.appendChild(s);
    });
    return gis;
  }
  // from a click: Google's window asks the first time, and only signs in after that
  function connect() {
    return Promise.all([loadGis(), global.GVC_PROPS.whoAmI()]).then(function (x) {
      return new Promise(function (res, rej) {
        var c = global.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPE, hint: x[1] && x[1].email,
          callback: function (r) {
            if (!r || r.error || !r.access_token) return rej(new Error(r && r.error === 'access_denied' ? 'Drive access was declined.' : 'Drive didn\'t connect. Try again.'));
            try { global.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ value: r.access_token, until: Date.now() + (+r.expires_in || 3600) * 1000 })); } catch (e) { /* this tab only */ }
            res(['Shared drives']);
          },
          error_callback: function () { rej(new Error('The Google window was closed before Drive connected.')); }
        });
        c.requestAccessToken({ prompt: '' });
      });
    });
  }

  /* ---------- the Drive API ---------- */
  function get(path, q) {
    var t = saved();
    if (!t) return Promise.reject(new Error('Drive isn\'t connected. Click Connect Drive.'));
    var u = API + path + (q ? '?' + new URLSearchParams(q).toString() : '');
    return fetch(u, { headers: { authorization: 'Bearer ' + t } }).then(function (r) {
      if (r.status === 401) { try { global.sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* gone */ } throw new Error('Drive needs one click to reconnect.'); }
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
    return { kind: 'file', name: f.name, _path: path,
      meta: { size: f.size == null ? undefined : +f.size, modified: f.modifiedTime },
      getFile: function () {
        return get('/files/' + encodeURIComponent(f.id), { alt: 'media', supportsAllDrives: 'true' }).then(function (b) {
          return new File([b], f.name, { type: b.type, lastModified: Date.parse(f.modifiedTime) || Date.now() });
        });
      } };
  }
  function dirHandle(name, path, list) {
    var cache = null;
    var kids = function () { return cache || (cache = list().catch(function (e) { cache = null; throw e; })); };
    var find = function (n, kind) {
      return kids().then(function (xs) { var h = xs.filter(function (x) { return x.name === n && x.kind === kind; })[0]; if (!h) throw notFound(n); return h; });
    };
    return { kind: 'directory', name: name, _path: path,
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
    });
  }
  var top = null;
  function root() {
    if (!saved()) return Promise.reject(new Error('Drive isn\'t connected. Click Connect Drive.'));
    top = top || dirHandle('Shared drives', '', function () {
      return drives().then(function (ds) { return ds.map(function (d) { return folderOf({ id: d.id, name: d.name }, d.name, d.id); }); });
    });
    return Promise.resolve(top);
  }

  global.GVC_DRIVE_WEB = { active: active, state: state, connect: connect, root: root, TESTERS: TESTERS };
})(window);
