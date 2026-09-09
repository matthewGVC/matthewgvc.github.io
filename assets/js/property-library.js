/* ============================================================
   PROPERTY LIBRARY — one saved property, shared by the listing builders.

   A property is three things:
     core       the facts every builder wants — address, price, beds, baths…
     documents  one saved document per tool, stored verbatim and handed back
                untouched. A property may have none.
     photos     the shelf: files in a private bucket, deduped by content hash
                and downscaled on the way in.

   Whichever tool an agent opens first creates the property. Nothing here
   knows what a showsheet is — each tool maps its own fields with a small
   adapter (fromCore / toCore) and hands the rest over as an opaque blob.

   Talks to Supabase over plain fetch: eight endpoints do not need an SDK.
   Everything needs the team session, and there is exactly one place that
   attaches it — call().
   ============================================================ */
(function (global) {
  'use strict';

  var CFG = global.GVC_SUPABASE;
  var SESSION_KEY = 'gvc.props.session';
  /* The tools that bind a document to a property. The Buyer Package is
     not one of them: it is a packet handed to any buyer, with no address,
     no price and no comps in it, so it has nothing to save against a
     listing. Any buyer document already in the table is simply left
     alone — put 'buyer' back here and it reappears. */
  var TOOLS = ['showsheet', 'brochure', 'seller'];
  var STATUSES = ['active', 'coming-soon', 'sold', 'archived'];

  var session = null;      // { access_token, refresh_token, expires_at }

  /* ---------------- session ---------------- */

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch (e) { session = null; }
    return session;
  }

  function keepSession(s) {
    session = s && s.access_token ? {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      // a minute of slack, so a token never expires mid-request
      expires_at: Date.now() + Math.max(0, (s.expires_in || 3600) - 60) * 1000
    } : null;
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* private window — the session just won't outlive the tab */ }
    return session;
  }

  function auth(path, body) {
    return fetch(CFG.url + '/auth/v1/' + path, {
      method: 'POST',
      headers: { apikey: CFG.publishableKey, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); });
  }

  /* The shared team password. One account for the whole team — see
     supabase/README.md for what that buys and what it costs. */
  function signIn(password) {
    return auth('token?grant_type=password', { email: CFG.teamEmail, password: password })
      .then(function (r) {
        if (!r.ok || !r.body.access_token) {
          throw new Error(r.body.error_description || r.body.msg || 'That password was not accepted.');
        }
        keepSession(r.body);
        return true;
      });
  }

  function signOut() { keepSession(null); }

  function signedIn() { return !!(session || loadSession()); }

  /* Refresh rather than ask for the password again. A refresh that fails
     means the session is genuinely gone, so say so plainly. */
  function fresh() {
    if (!session) loadSession();
    if (!session) return Promise.reject(new Error('Sign in to use the property library.'));
    if (Date.now() < session.expires_at) return Promise.resolve(session);
    return auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then(function (r) {
        if (!r.ok || !r.body.access_token) {
          keepSession(null);
          throw new Error('The library signed you out. Enter the team password again.');
        }
        return keepSession(r.body);
      });
  }

  /* ---------------- one place that talks to the API ---------------- */

  function call(path, opts) {
    opts = opts || {};
    return fresh().then(function (s) {
      var headers = {
        apikey: CFG.publishableKey,
        authorization: 'Bearer ' + s.access_token
      };
      if (opts.json !== false) headers['content-type'] = 'application/json';
      if (opts.prefer) headers.prefer = opts.prefer;
      if (opts.contentType) headers['content-type'] = opts.contentType;

      return fetch(CFG.url + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body
      });
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
        if (!r.ok) throw apiError(r.status, data);
        return data;
      });
    }, function (e) {
      if (!navigator.onLine) throw new Error('You are offline — the library needs a connection.');
      throw e;
    });
  }

  /* Postgres speaks in constraint names; agents should not have to. */
  function apiError(status, data) {
    var msg = (data && (data.message || data.msg || data.error)) || ('Request failed (' + status + ')');
    if (status === 409) msg = 'A property already exists at that address.';
    if (/violates check constraint/.test(msg)) msg = 'That value is not one the library accepts.';
    var e = new Error(msg);
    e.status = status;
    return e;
  }

  var rest = function (path, opts) { return call('/rest/v1' + path, opts); };

  /* ---------------- properties ---------------- */

  /* ---------------- address and unit ---------------- */

  /* A unit is part of the address in the library — one address is one property
     — but every builder keeps it in its own field, so it is joined on the way
     out and split on the way back.

     unitDisplay() and splitUnit() are inverses. They have to be: whatever one
     writes, the other must be able to read, or a unit disappears off the sheet
     on the next load. That pairing was broken for years — unitDisplay() wrote
     "Residence 4B" and splitUnit() could not parse it — so the two are defined
     together here and tested against each other. */

  function unitDisplay(unit) {
    var u = String(unit || '').trim();
    if (!u) return '';
    return /^[\w-]{1,7}$/.test(u) ? 'Residence ' + u : u;
  }

  /* Words that make the tail of an address line a unit rather than a town.
     "residence" leads the list because unitDisplay() puts it there. The list
     is deliberately closed: "Sea Bright, NJ" is a town, not apartment NJ. */
  var UNIT_WORD = /^(?:residence|apartment|apt\.?|unit|suite|ste\.?|penthouse|ph)$/i;

  function looksLikeUnit(tail) {
    if (/^#\s*[\w-]+$/.test(tail)) return true;        // #7
    if (/^[0-9]+[A-Za-z]?$/.test(tail)) return true;   // 12, 4B
    var m = tail.match(/^([A-Za-z.]+)\s*([\w-]*)$/);   // Residence 4B, Apt. 3, PH C
    return !!(m && UNIT_WORD.test(m[1]));
  }

  /* "Residence 4B" was written by unitDisplay(); hand back the "4B" it started
     as, so a round trip does not accumulate the word. Every other spelling is
     what the agent typed and is returned untouched. */
  function stripUnitWord(tail) {
    var m = tail.match(/^residence\s+(.+)$/i);
    return m ? m[1].trim() : tail;
  }

  function splitUnit(full) {
    var s = String(full || '').trim();
    var at = s.lastIndexOf(',');
    if (at === -1) return { address: s, unit: '' };
    var head = s.slice(0, at).trim();
    var tail = s.slice(at + 1).trim();
    if (!head || !tail || !looksLikeUnit(tail)) return { address: s, unit: '' };
    return { address: head, unit: stripUnitWord(tail) };
  }

  function joinUnit(address, unit) {
    var a = String(address || '').trim();
    var u = String(unit || '').trim();
    return [a, u && unitDisplay(u)].filter(Boolean).join(', ');
  }

  /* One place decides what a record means, so three builders cannot disagree:
     trust core.unit when it is there, otherwise read the joined line an older
     record still carries. */
  function unitOf(core) {
    core = core || {};
    var u = String(core.unit || '').trim();
    if (u) return { address: String(core.address || '').trim(), unit: u };
    return splitUnit(core.address);
  }

  /* ---------------- identity ---------------- */

  function slugOf(address) {
    return String(address || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'untitled';
  }

  /* Identity is the address and the unit together, so two apartments in one
     building are two properties. Known limit: city and state are not in it, so
     the same street address in two towns collides. Changing that now cannot
     fix a single existing row — a slug is stamped once by create() and never
     rewritten — so it would only mean old and new records are identified two
     different ways. Left alone deliberately. */
  function slugOfCore(core) {
    core = core || {};
    return slugOf(joinUnit(core.address, core.unit));
  }

  function labelOf(core) {
    core = core || {};
    var where = [core.city, core.state].filter(Boolean).join(', ');
    return [joinUnit(core.address, core.unit), where].filter(Boolean).join(', ') ||
           'Untitled property';
  }

  /* The dropdown: active first, sold last, archived left out unless asked
     for, and within a status the most recently touched at the top.

     withPhotos adds each property's photo sizes, which only the Properties
     page wants — asking for them here by default would pull every photo row
     in the library on every builder load. */
  function list(opts) {
    opts = opts || {};
    var q = '/properties?select=id,slug,label,status,updated_at,documents(tool)' +
            (opts.withPhotos ? ',photos(bytes)' : '') +
            '&order=updated_at.desc';
    if (!opts.includeArchived) q += '&status=neq.archived';
    return rest(q).then(function (rows) {
      return (rows || []).map(function (r) {
        var has = {};
        (r.documents || []).forEach(function (d) { has[d.tool] = true; });
        var row = { id: r.id, slug: r.slug, label: r.label, status: r.status,
                    updated: r.updated_at, has: has };
        if (opts.withPhotos) {
          var ph = r.photos || [];
          row.photoCount = ph.length;
          row.photoBytes = ph.reduce(function (n, x) { return n + (x.bytes || 0); }, 0);
        }
        return row;
      }).sort(function (a, b) {
        return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
      });
    });
  }

  /* Everything a tool needs to open a property: the shared facts, its own
     saved document (or null, which is normal), and the photo shelf. */
  function load(id, tool) {
    return rest('/properties?id=eq.' + id +
                '&select=id,slug,label,status,core,updated_at,documents(tool,state,saved_at),' +
                'photos(id,hash,name,path,width,height)')
      .then(function (rows) {
        var r = rows && rows[0];
        if (!r) throw new Error('That property is no longer in the library.');
        var mine = (r.documents || []).filter(function (d) { return d.tool === tool; })[0];
        return {
          id: r.id, slug: r.slug, label: r.label, status: r.status,
          core: r.core || {}, updated: r.updated_at,
          doc: mine ? mine.state : null,
          docSavedAt: mine ? mine.saved_at : null,
          has: (r.documents || []).reduce(function (m, d) { m[d.tool] = true; return m; }, {}),
          photos: r.photos || []
        };
      });
  }

  /* The address and unit together are the identity, so this is how a tool asks
     "is this listing already in the library?". Takes the joined line — callers
     hand it joinUnit(address, unit). */
  function findByAddress(address) {
    return rest('/properties?slug=eq.' + encodeURIComponent(slugOf(address)) +
                '&select=id,label,status,core')
      .then(function (rows) { return (rows && rows[0]) || null; });
  }

  function create(core) {
    core = core || {};
    if (!String(core.address || '').trim()) {
      return Promise.reject(new Error('A property needs an address before it can be saved.'));
    }
    return rest('/properties', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({ slug: slugOfCore(core), label: labelOf(core), core: core })
    }).then(function (rows) { return rows[0]; });
  }

  /* Facts only. The keys a tool sends are the facts it is responsible for, and
     it sends them whether or not they are filled in — so an empty value here
     means the agent cleared the box, not that the tool has nothing to say, and
     it is written. A key the tool does not send is left alone, so saving a
     Showsheet cannot blank the sqft only the Seller Package collects.

     What protects a colleague's typing is confirmChanges() in property-bar,
     which now runs before this and shows a clear as "was → (empty)". Skipping
     empties here instead — which is what this did — meant a wrong price could
     not be removed at all, and the dialog never mentioned it. */
  /* The merge itself, kept separate so it can be tested without a network:
     the keys the tool owns replace, everything else is left standing. */
  function mergeCore(current, incoming) {
    var merged = Object.assign({}, current || {});
    Object.keys(incoming || {}).forEach(function (k) { merged[k] = incoming[k]; });
    return merged;
  }

  function saveCore(id, core) {
    core = core || {};
    return rest('/properties?id=eq.' + id + '&select=core').then(function (rows) {
      var merged = mergeCore((rows[0] && rows[0].core) || {}, core);
      return rest('/properties?id=eq.' + id, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: JSON.stringify({ core: merged, label: merged.displayLabel || labelOf(merged) })
      }).then(function (out) { return out[0]; });
    });
  }

  /* Postgres stores jsonb with its own key order, so a comps array that
     made the round trip is not character-for-character what went in. Sort
     the keys before comparing, or every save claims the comps changed. */
  function canonical(v) {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce(function (o, k) { o[k] = canonical(v[k]); return o; }, {});
    }
    return v;
  }

  function same(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }

  /* What saving would change about the shared facts. The tool shows this
     before it writes, so a price never quietly changes in three other
     documents. */
  /* What the agent is asked about before a save overwrites shared facts. An
     empty incoming value is reported like any other: clearing a price is a
     change, and used to be the one change this stayed silent about. */
  function changesAgainst(core, incoming) {
    var out = [];
    Object.keys(incoming || {}).forEach(function (k) {
      var was = core ? core[k] : undefined;
      if (isEmpty(was)) return;                       // filling a gap is not a change
      if (same(was, incoming[k])) return;
      out.push({ field: k, was: was, now: incoming[k] });
    });
    return out;
  }

  function isEmpty(v) {
    if (v == null || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  }

  function setStatus(id, status) {
    if (STATUSES.indexOf(status) === -1) return Promise.reject(new Error('Unknown status: ' + status));
    return rest('/properties?id=eq.' + id, {
      method: 'PATCH', body: JSON.stringify({ status: status })
    });
  }

  /* A property's name is normally built from its address, and saveCore
     rebuilds it every time a builder saves facts. A name typed on the
     Properties page is therefore also kept in core.displayLabel, which
     saveCore honours — otherwise the next save would undo the rename.

     The slug is left alone on purpose: the address is the property's
     identity, and duplicate detection matches on it. Renaming changes
     what the library calls a property, never which property it is. */
  function rename(id, name) {
    var clean = String(name || '').trim();
    if (!clean) return Promise.reject(new Error('A property needs a name.'));
    return rest('/properties?id=eq.' + id + '&select=core').then(function (rows) {
      var core = Object.assign({}, (rows[0] && rows[0].core) || {});
      core.displayLabel = clean;
      return rest('/properties?id=eq.' + id, {
        method: 'PATCH', prefer: 'return=representation',
        body: JSON.stringify({ core: core, label: clean })
      });
    }).then(function (out) { return out && out[0]; });
  }

  /* ---------------- documents ---------------- */

  function saveDoc(id, tool, state) {
    if (TOOLS.indexOf(tool) === -1) return Promise.reject(new Error('Unknown tool: ' + tool));
    return rest('/documents?on_conflict=property_id,tool', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: JSON.stringify({ property_id: id, tool: tool, state: state, saved_at: new Date().toISOString() })
    }).then(function (rows) { return rows[0]; });
  }

  /* Who saved this document last, and when — so a second agent is warned
     before overwriting an afternoon of someone else's work. */
  function docSavedAt(id, tool) {
    return rest('/documents?property_id=eq.' + id + '&tool=eq.' + tool + '&select=saved_at')
      .then(function (rows) { return rows[0] ? rows[0].saved_at : null; });
  }

  /* ---------------- photos ---------------- */

  /* Downscaled before it ever leaves the browser: the long edge is capped,
     which is past what a Letter page prints at 300dpi and keeps a property
     near 7 MB rather than 120. */
  function shrink(file) {
    return createImageBitmap(file).then(function (bmp) {
      var max = CFG.photoMaxEdge || 2000;
      var scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
      bmp.close && bmp.close();
      return new Promise(function (res) {
        canvas.toBlob(function (blob) { res({ blob: blob, width: w, height: h }); }, 'image/jpeg', 0.86);
      });
    });
  }

  function hashOf(blob) {
    return blob.arrayBuffer()
      .then(function (buf) { return crypto.subtle.digest('SHA-256', buf); })
      .then(function (digest) {
        return Array.from(new Uint8Array(digest))
          .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('').slice(0, 40);
      });
  }

  /* The same shot dropped into three tools is one file: the hash is the
     identity, so a re-drop returns the photo already on the shelf. */
  function putPhoto(id, file) {
    var shrunk;
    return shrink(file)
      .then(function (s) { shrunk = s; return hashOf(s.blob); })
      .then(function (hash) {
        return rest('/photos?property_id=eq.' + id + '&hash=eq.' + hash +
                    '&select=id,hash,name,path,width,height')
          .then(function (rows) {
            if (rows && rows[0]) return rows[0];           // already shelved
            var path = id + '/' + hash + '.jpg';
            return call('/storage/v1/object/' + CFG.photoBucket + '/' + path, {
              method: 'POST', contentType: 'image/jpeg', body: shrunk.blob
            }).then(function () {
              return rest('/photos', {
                method: 'POST', prefer: 'return=representation',
                body: JSON.stringify({
                  property_id: id, hash: hash, name: file.name || '', path: path,
                  width: shrunk.width, height: shrunk.height, bytes: shrunk.blob.size
                })
              }).then(function (rows2) { return rows2[0]; });
            });
          });
      });
  }

  /* The bucket is private, so a page renders photos through short-lived
     signed URLs rather than public links. One round trip for the lot. */
  function photoUrls(photos) {
    var paths = (photos || []).map(function (p) { return p.path; });
    if (!paths.length) return Promise.resolve({});
    return call('/storage/v1/object/sign/' + CFG.photoBucket, {
      method: 'POST',
      body: JSON.stringify({ paths: paths, expiresIn: 60 * 60 * 8 })
    }).then(function (rows) {
      var byPath = {};
      (rows || []).forEach(function (r) {
        // the API returns the path it signed plus a root-relative URL
        if (r.signedURL) byPath[r.path] = CFG.url + '/storage/v1' + r.signedURL;
      });
      var byId = {};
      (photos || []).forEach(function (p) { if (byPath[p.path]) byId[p.id] = byPath[p.path]; });
      return byId;
    });
  }

  function removePhoto(photo) {
    return call('/storage/v1/object/' + CFG.photoBucket, {
      method: 'DELETE', body: JSON.stringify({ prefixes: [photo.path] })
    }).then(function () {
      return rest('/photos?id=eq.' + photo.id, { method: 'DELETE' });
    });
  }

  /* "Free up photos" on the Properties page. The shelf goes; the address,
     the shared facts and every saved document stay exactly as they are.
     Photos are essentially all of the storage a property uses, so this is
     what reclaims room against the free tier's 1 GB.

     The documents keep opening afterwards: hydrate() already resolves a
     token whose photo has gone to an empty string, so a brochure comes back
     with empty image slots rather than broken ones.

     Files first, rows second. The other order can leave a file in the
     bucket that nothing points at — space consumed with no way to find it
     again — whereas a row whose file is already gone is harmless. */
  function stripPhotos(id) {
    return rest('/photos?property_id=eq.' + id + '&select=id,path')
      .then(function (rows) {
        rows = rows || [];
        if (!rows.length) return { removed: 0 };
        return call('/storage/v1/object/' + CFG.photoBucket, {
          method: 'DELETE',
          body: JSON.stringify({ prefixes: rows.map(function (r) { return r.path; }) })
        })
          .then(function () { return rest('/photos?property_id=eq.' + id, { method: 'DELETE' }); })
          .then(function () { return { removed: rows.length }; });
      });
  }

  /* ---------------- photos inside a saved document ----------------

     Every tool keeps its photos as base64 data URLs somewhere inside its
     own state — images[].url in the Brochure, photos[].src in the
     Showsheet, a bare string for a floor plan. Saving that verbatim would
     push megabytes of base64 into Postgres.

     So the document is walked on the way out: every data URL is shelved as
     a real file and replaced with a token, and on the way back in the token
     becomes a signed URL. Neither function knows anything about a
     particular tool's shape, which is why this works for every tool. */

  var TOKEN = 'gvc:photo:';

  /* A photo reaches a tool either as a data URL (dropped by the agent) or
     as a path on this site (the sample listings, a floor plan shipped with
     the repo). Both have to be shelved: a path that works in one tool is a
     broken image in another, and neither is in the library until it is a
     file of its own. Anything already shelved is left alone. */
  function isShelvable(v) {
    if (typeof v !== 'string') return false;
    if (v.indexOf(TOKEN) === 0) return false;
    if (v.indexOf('data:image/') === 0) return true;
    if (/^(https?:)?\/\//i.test(v)) return false;            // somebody else's server
    // a path, not a bare file name: every tool also stores photo names, and
    // "front.jpg" is a label, not something to go and fetch
    if (v.indexOf('/') === -1) return false;
    return /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(v);
  }

  function walk(value, swap) {
    if (Array.isArray(value)) return value.map(function (v) { return walk(v, swap); });
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function (k) { out[k] = walk(value[k], swap); });
      return out;
    }
    return swap(value);
  }

  function toFile(url, name) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Could not read a photo the document points at.');
      return r.blob();
    }).then(function (b) { return new File([b], name || 'photo.jpg', { type: b.type }); });
  }

  /* The other half of hydrate: a signed URL back to the token it came from.

     hydrate hands the tool a real URL, so by the time the agent saves, the
     document holds signed URLs, not tokens — and a signed URL is somebody
     else's server as far as isShelvable is concerned, so it used to be
     written to the document verbatim. It expires in eight hours, and the
     property came back with dead images.

     The path inside the URL is the shelf's own key, so the token is
     recoverable from the URL alone. That also repairs a document saved
     before this existed: its URLs are expired, but they still name the
     photos, which are all still on the shelf. */
  function signedPrefix() {
    return CFG.url + '/storage/v1/object/sign/' + CFG.photoBucket + '/';
  }

  function retokenize(state, photos) {
    var byPath = {};
    (photos || []).forEach(function (p) { byPath[p.path] = p.id; });
    var pre = signedPrefix();
    return walk(state, function (v) {
      if (typeof v !== 'string' || v.indexOf(pre) !== 0) return v;
      var path = v.slice(pre.length).split('?')[0];
      return byPath[path] ? TOKEN + byPath[path] : v;
    });
  }

  /* Save a tool's document, shelving its photos on the way. The tool's own
     state is never touched — the walk builds a copy. */
  function saveDocument(id, tool, state, onProgress) {
    return rest('/photos?property_id=eq.' + id + '&select=id,path')
      .then(function (photos) { return shelveAndSave(id, tool, retokenize(state, photos), onProgress); });
  }

  function shelveAndSave(id, tool, state, onProgress) {
    var urls = [];
    walk(state, function (v) { if (isShelvable(v) && urls.indexOf(v) === -1) urls.push(v); return v; });

    // one at a time: a listing is a handful of photos, and a queue of
    // parallel uploads on a listing-day connection helps nobody
    var byUrl = {}, skipped = [];
    var chain = urls.reduce(function (p, url, i) {
      return p.then(function () {
        // uploading a listing's photos takes real seconds — say where it is
        if (onProgress) onProgress(i + 1, urls.length);
        return toFile(url, 'photo-' + (i + 1) + '.jpg')
          .then(function (f) { return putPhoto(id, f); })
          .then(function (photo) { byUrl[url] = TOKEN + photo.id; })
          // a photo that cannot be read keeps its old value and the save
          // carries on: losing the whole document over one image is worse
          .catch(function () { skipped.push(url); });
      });
    }, Promise.resolve());

    return chain.then(function () {
      var shelved = walk(state, function (v) { return byUrl[v] || v; });
      return saveDoc(id, tool, shelved).then(function (row) {
        row.skipped = skipped;
        return row;
      });
    });
  }

  /* Put the signed URLs back, so the tool sees a document shaped exactly
     the way it saved one. A photo that has since been deleted resolves to
     an empty string rather than a broken token. */
  function hydrate(state, urlsById) {
    return walk(state, function (v) {
      if (typeof v !== 'string' || v.indexOf(TOKEN) !== 0) return v;
      return urlsById[v.slice(TOKEN.length)] || '';
    });
  }

  global.GVC_PROPS = {
    TOOLS: TOOLS, STATUSES: STATUSES,
    signIn: signIn, signOut: signOut, signedIn: signedIn,
    list: list, load: load, create: create, findByAddress: findByAddress,
    saveCore: saveCore, mergeCore: mergeCore, saveDoc: saveDoc, saveDocument: saveDocument,
    hydrate: hydrate, retokenize: retokenize, docSavedAt: docSavedAt,
    setStatus: setStatus, rename: rename, changesAgainst: changesAgainst,
    putPhoto: putPhoto, photoUrls: photoUrls, removePhoto: removePhoto,
    stripPhotos: stripPhotos,
    slugOf: slugOf, slugOfCore: slugOfCore, labelOf: labelOf,
    joinUnit: joinUnit, splitUnit: splitUnit,
    unitDisplay: unitDisplay, unitOf: unitOf
  };

  /* Node can require this file to test the pure helpers — the address and unit
     pairing especially, which is where the round trip used to break. Nothing
     else in here runs outside a browser. */
  if (typeof module === 'object' && module.exports) module.exports = global.GVC_PROPS;
})(typeof window !== 'undefined' ? window : globalThis);
