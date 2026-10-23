/* ============================================================
   MATCH LINK — "Link by hand" on the Match page (tune-up A).

   A line that belongs to no job ("On DE, not in Asana", "Asana task not
   linked") can be tied to a job, or set aside, from the Match page.
   `link` is the line's GVC_WS.looseMatch item.link:
     { type: 'de', id, kind, market, street, unit }  |  { type: 'asana', gid, name, market }

     candidates(rows, link, GVC_ADDR, nameOf) → { same: [row], rest: [row] }
         rows are properties rows. Archived jobs are left out; when the line's
         market is known only that market's jobs; the ones on the same street
         (GVC_ADDR.sameStreet) first, then the rest, each by name.
     filter(rows, text, nameOf)  → the rows whose name has the text (any case)
     refusal(row, link)          → a plain sentence, or null when it can link:
         a job already linked to a different DE listing / Asana task; a sale
         DE listing and a rental job (or the reverse), unless the job's kind
         is empty.
     linkTo(api, row, link)      → Promise; api is GVC_PROPS (call, signedIn)
         DE:    properties.de_listing_id (version-checked), de_listings.property_id,
                one changes row (source Matt, "Linked to DE by hand")
         Asana: properties.asana_gid (version-checked), asana_tasks.property_id,
                one changes row ("Linked to Asana by hand")
         A version conflict writes nothing more (err.conflict). Once the job is
         saved, a later failure says "Linked, but …" (err.linked): the job keeps
         the link and the next sync fills in the rest.
     setAside(api, link)         → Promise   Not ours (DE) / Ignore (Asana):
         de_listings.ignored / asana_tasks.ignored = true; a changes row only
         when the row has an owner.
     open({ link, rows, nameOf, what }) → Promise<boolean>  the picker dialog
         (true once linked). Needs GVC_PROPS, GVC_ADDR, GVC_ESC.
     openForJob({ row, type: 'asana'|'de', name }) → Promise<boolean>  the other way
         round, from a job page's Link Asana / Link DE (tune-ups 3): the job's
         candidates (Asana listing tasks not ignored and not another job's; DE
         listings seen in the last 30 days, featured or the team's, same kind),
         same street first. A job already linked is relinked: the old task or
         listing lets go of it (replace).
     linkTo(api, row, link, { replace: true }) skips the "already linked" refusal.
   Signed out: nothing is written. The helper respects both on its next run:
   DE apply finds a job by its stored de_listing_id, Asana apply by its stored
   asana_gid, and neither unsets `ignored`.
   Loads in the browser (window.GVC_MATCH_LINK) and in Node (require).
   Tested by scripts/test-match-link.js and scripts/test-workspace.js.
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory(global);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_MATCH_LINK = api;
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  var KIND = { sale: 'sale', rental: 'rental' };
  var SIGN_IN = 'Sign in first.';

  function addressOf(row) { var core = row.core || {}; return String(core.address || row.label || ''); }
  function byName(nameOf) {
    return function (a, b) { var x = String(nameOf(a)).toLowerCase(), y = String(nameOf(b)).toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; };
  }

  function candidates(rows, link, A, nameOf) {
    var open = (rows || []).filter(function (r) { return r.stage !== 'Archived' && (!link.market || r.market === link.market); });
    var street = link.type === 'de' ? link.street : link.name;
    var same = [], rest = [];
    open.forEach(function (r) { (street && A && A.sameStreet(street, addressOf(r)) ? same : rest).push(r); });
    return { same: same.sort(byName(nameOf)), rest: rest.sort(byName(nameOf)) };
  }

  function filter(rows, text, nameOf) {
    var t = String(text || '').trim().toLowerCase();
    return t ? rows.filter(function (r) { return String(nameOf(r)).toLowerCase().indexOf(t) !== -1; }) : rows;
  }

  function refusal(row, link) {
    if (link.type === 'de') {
      if (row.de_listing_id && row.de_listing_id !== link.id) return 'That job is already linked to DE listing ' + row.de_listing_id + '. A job has one DE listing.';
      if (link.kind && row.kind && KIND[link.kind] && KIND[row.kind] && link.kind !== row.kind) {
        return 'This DE listing is a ' + link.kind + ' and that job is a ' + row.kind + ', so they can\'t be linked.';
      }
      return null;
    }
    if (row.asana_gid && row.asana_gid !== link.gid) return 'That job is already linked to another Asana task. A job has one Asana task.';
    return null;
  }

  function enc(v) { return encodeURIComponent(v); }

  function linkTo(api, row, link, opts) {
    if (!api.signedIn()) return Promise.reject(new Error(SIGN_IN));
    var replace = !!(opts && opts.replace);
    var no = replace ? null : refusal(row, link);
    if (no) return Promise.reject(new Error(no));
    var de = link.type === 'de', value = de ? link.id : link.gid, field = de ? 'de_listing_id' : 'asana_gid';
    var patch = {}; patch[field] = value;
    return api.call('/rest/v1/properties?id=eq.' + enc(row.id) + '&version=eq.' + enc(row.version), {
      method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(patch)
    }).then(function (rows) {
      if (!rows || !rows.length) { var e = new Error('Someone changed this job meanwhile. Reload the page and link it again.'); e.conflict = true; throw e; }
      // the job holds the link now; the rest is bookkeeping the next sync also fills in
      var cache = de ? '/rest/v1/de_listings?de_listing_id=eq.' + enc(link.id) : '/rest/v1/asana_tasks?gid=eq.' + enc(link.gid);
      var missed = [], old = row[field] && row[field] !== value ? row[field] : null;
      // a relink: the old task or listing lets go of the job (the next sync agrees)
      var letGo = !replace || !old ? Promise.resolve() : api.call((de ? '/rest/v1/de_listings?de_listing_id=eq.' : '/rest/v1/asana_tasks?gid=eq.') + enc(old) + '&property_id=eq.' + enc(row.id),
        { method: 'PATCH', body: JSON.stringify({ property_id: null }) }).catch(function (e) { missed.push('letting go of the old one (' + e.message + ')'); });
      return letGo.then(function () { return api.call(cache, { method: 'PATCH', body: JSON.stringify({ property_id: row.id }) }); }).catch(function (e) { missed.push('the ' + (de ? 'DE' : 'Asana') + ' copy (' + e.message + ')'); })
        .then(function () {
          return api.call('/rest/v1/changes', { method: 'POST', body: JSON.stringify({ property_id: row.id, field: field, old_value: row[field] || null, new_value: value,
            note: (old ? 'Relinked' : 'Linked') + (de ? ' to DE by hand' : ' to Asana by hand'), source: 'Matt' }) }).catch(function (e) { missed.push('the change log (' + e.message + ')'); });
        }).then(function () {
          if (!missed.length) return rows[0];
          var e = new Error('Linked, but ' + missed.join(' and ') + ' didn\'t save. The job keeps the link and the next sync fills in the rest; there\'s nothing to redo.');
          e.linked = true; throw e;
        });
    }, function (e) {
      if (e.status === 409) {
        var x = new Error('Another job is already linked to this ' + (de ? 'DE listing' : 'Asana task') + '. Reload the page to see it.');
        x.status = 409; throw x;
      }
      throw e;
    });
  }

  function setAside(api, link) {
    if (!api.signedIn()) return Promise.reject(new Error(SIGN_IN));
    var de = link.type === 'de';
    var path = de ? '/rest/v1/de_listings?de_listing_id=eq.' + enc(link.id) : '/rest/v1/asana_tasks?gid=eq.' + enc(link.gid);
    return api.call(path, { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ ignored: true }) }).then(function (rows) {
      if (!rows || !rows.length) {
        throw new Error(de ? 'The workspace has no copy of this DE listing any more. Reload the page.' : 'The workspace has no copy of this Asana task yet. Wait for the next Asana sync, then try again.');
      }
      var r = rows[0], owner = null;
      ['property_id', 'pitch_id', 'dev_project_id'].forEach(function (k) { if (!owner && r[k]) { owner = {}; owner[k] = r[k]; } });
      if (!owner) return r;
      var c = Object.assign(owner, { field: null, old_value: null, new_value: null,
        note: de ? 'DE listing ' + link.id + ' marked not ours on the Match page' : 'Asana task ' + (link.name || link.gid) + ' ignored on the Match page', source: 'Matt' });
      // set aside already; a log that fails is said, never retried into a second row
      return api.call('/rest/v1/changes', { method: 'POST', body: JSON.stringify(c) }).then(function () { return r; }, function (e) {
        var x = new Error('Set aside, but the change log didn\'t save (' + e.message + '). There\'s nothing to redo.'); x.linked = true; throw x;
      });
    });
  }

  /* ---------- the picker ---------- */
  function open(o) {
    var doc = global.document, P = global.GVC_PROPS, A = global.GVC_ADDR, esc = global.GVC_ESC, link = o.link, nameOf = o.nameOf;
    var c = candidates(o.rows, link, A, nameOf), all = c.same.concat(c.rest);
    var byId = {}; all.forEach(function (r) { byId[r.id] = r; });
    return new Promise(function (resolve) {
      var d = doc.createElement('dialog');
      d.className = 'gvc-link gvc-mlink';
      d.setAttribute('aria-labelledby', 'mlTitle');
      d.style.cssText = 'border:1px solid var(--rule);border-radius:10px;padding:22px 24px;max-width:560px;width:calc(100% - 32px);background:var(--paper);color:var(--ink)';
      d.innerHTML = '<h2 id="mlTitle" style="font-size:22px;margin:0 0 4px">Link to a job</h2>' +
        '<p class="soft" style="margin:0 0 12px;font-size:13.5px" id="mlWhat"></p>' +
        '<input class="inp" id="mlSearch" type="search" placeholder="Search jobs" aria-label="Search jobs" autocomplete="off" style="width:100%;margin-bottom:10px">' +
        '<div id="mlList" style="max-height:min(50vh,420px);overflow:auto"></div>' +
        '<p id="mlMsg" role="alert" style="min-height:1.2em;color:var(--danger);font-size:13px;margin:10px 0 0"></p>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px"><button type="button" class="b" id="mlCancel">Cancel</button></div>';
      d.querySelector('#mlWhat').textContent = o.what + '. Pick the job it belongs to; the next sync fills the job in from it.';
      var list = d.querySelector('#mlList'), msg = d.querySelector('#mlMsg'), search = d.querySelector('#mlSearch');
      var opener = doc.activeElement, saved = false, busy = false;
      var done = function (ok) { d.close(); d.remove(); if (opener && opener.focus && opener.isConnected) opener.focus(); resolve(ok); };
      var lock = function (on) { d.querySelectorAll('#mlCancel, #mlSearch, button[data-id]').forEach(function (b) { b.disabled = on; }); };
      var btn = function (r) {
        return '<button type="button" class="b" data-id="' + esc(r.id) + '" style="display:flex;width:100%;justify-content:space-between;gap:10px;margin-bottom:6px;white-space:normal;text-align:left">' +
          '<span>' + esc(nameOf(r)) + '</span><span class="soft" style="font-size:12px">' + esc([r.stage, r.market].filter(Boolean).join(' · ')) + '</span></button>';
      };
      var draw = function () {
        var t = search.value, s = filter(c.same, t, nameOf), rest = filter(c.rest, t, nameOf), html = '';
        if (s.length) html += '<p class="lbl" style="margin:0 0 8px">Same street</p>' + s.map(btn).join('');
        if (rest.length) html += '<p class="lbl" style="margin:' + (s.length ? '12px' : '0') + ' 0 8px">' + esc(s.length ? 'Other jobs' : 'Jobs') + (link.market ? ' in ' + esc(link.market) : '') + '</p>' + rest.map(btn).join('');
        list.innerHTML = html || '<p class="soft">' + (t ? 'No job has that in its name.' : 'No open jobs' + (link.market ? ' in ' + esc(link.market) : '') + ' to link to.') + '</p>';
      };
      var pick = function (r) {
        if (busy || saved) return;
        var no = refusal(r, link);
        if (no) { msg.textContent = no; return; }
        busy = true; lock(true); msg.textContent = 'Saving…';
        linkTo(P, r, link).then(function () { done(true); }, function (e) {
          msg.textContent = e.message;
          if (e.linked) { saved = true; var b = d.querySelector('#mlCancel'); b.textContent = 'Close'; b.disabled = false; return; }
          busy = false; lock(false);
        });
      };
      list.addEventListener('click', function (e) { var b = e.target.closest('button[data-id]'); if (b && byId[b.dataset.id]) pick(byId[b.dataset.id]); });
      search.addEventListener('input', draw);
      d.querySelector('#mlCancel').addEventListener('click', function () { done(saved); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); if (!busy || saved) done(saved); });
      draw();
      doc.body.appendChild(d);
      d.showModal();
      search.focus();
    });
  }

  /* ---------- the picker from a job: Link Asana / Link DE ---------- */
  var MONTH = 30 * 864e5;
  function jobCandidates(row, type, list, A) {
    var addr = addressOf(row), out = [];
    (list || []).forEach(function (x) {
      var c;
      if (type === 'asana') {
        if (x.ignored || x.kind !== 'listing' || (x.property_id && x.property_id !== row.id)) return;
        c = { link: { type: 'asana', gid: x.gid, name: x.name || null, market: row.market || null }, title: x.name || 'Asana task ' + x.gid, sub: x.section || '', street: x.name || '', current: x.gid === row.asana_gid };
      } else {
        var raw = x.raw || {};
        if (x.ignored || (x.property_id && x.property_id !== row.id)) return;
        if (x.feed !== 'featured' && x.gvc_listed !== true) return;
        if (x.kind && row.kind && KIND[x.kind] && KIND[row.kind] && x.kind !== row.kind) return;
        if (x.last_seen && Date.now() - Date.parse(x.last_seen) > MONTH) return;
        var street = raw.street ? String(raw.street).trim() : '';
        c = { link: { type: 'de', id: x.de_listing_id, kind: x.kind || null, market: row.market || null, street: street, unit: raw.unit || null },
          title: [street, raw.unit].filter(Boolean).join(' ') || 'DE listing ' + x.de_listing_id,
          sub: [raw.city, raw.status, 'DE ' + x.de_listing_id].filter(Boolean).join(' · '), street: street, current: x.de_listing_id === row.de_listing_id };
      }
      c.same = !!(addr && c.street && A && A.sameStreet(c.street, addr));
      out.push(c);
    });
    var by = function (a, b) { return a.current !== b.current ? (a.current ? -1 : 1) : a.same !== b.same ? (a.same ? -1 : 1) : a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1; };
    return out.sort(by);
  }
  function openForJob(o) {
    var doc = global.document, P = global.GVC_PROPS, A = global.GVC_ADDR, esc = global.GVC_ESC, row = o.row, de = o.type === 'de';
    var read = de ? '/rest/v1/de_listings?select=de_listing_id,feed,kind,raw,gvc_listed,property_id,ignored,last_seen&ignored=is.false'
      : '/rest/v1/asana_tasks?select=gid,kind,name,section,property_id,ignored&kind=eq.listing&ignored=is.false';
    return P.call(read).then(function (list) {
      var all = jobCandidates(row, o.type, list, A);
      return new Promise(function (resolve) {
        var d = doc.createElement('dialog');
        d.className = 'gvc-link gvc-mlink';
        d.setAttribute('aria-labelledby', 'mjTitle');
        d.style.cssText = 'border:1px solid var(--rule);border-radius:10px;padding:22px 24px;max-width:560px;width:calc(100% - 32px);background:var(--paper);color:var(--ink)';
        d.innerHTML = '<h2 id="mjTitle" style="font-size:22px;margin:0 0 4px"></h2><p class="soft" style="margin:0 0 12px;font-size:13.5px" id="mjWhat"></p>' +
          '<input class="inp" id="mjSearch" type="search" aria-label="Search" autocomplete="off" style="width:100%;margin-bottom:10px">' +
          '<div id="mjList" style="max-height:min(50vh,420px);overflow:auto"></div>' +
          '<p id="mjMsg" role="alert" style="min-height:1.2em;color:var(--danger);font-size:13px;margin:10px 0 0"></p>' +
          '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px"><button type="button" class="b" id="mjCancel">Cancel</button></div>';
        d.querySelector('#mjTitle').textContent = (row[de ? 'de_listing_id' : 'asana_gid'] ? 'Relink ' : 'Link ') + (de ? 'DE' : 'Asana');
        d.querySelector('#mjWhat').textContent = 'Pick the ' + (de ? 'DE listing' : 'Asana task') + ' for ' + (o.name || 'this job') + '. The next sync fills the job in from it.';
        d.querySelector('#mjSearch').placeholder = de ? 'Search DE listings' : 'Search Asana tasks';
        var list = d.querySelector('#mjList'), msg = d.querySelector('#mjMsg'), search = d.querySelector('#mjSearch');
        var opener = doc.activeElement, saved = false, busy = false;
        var done = function (ok) { d.close(); d.remove(); if (opener && opener.focus && opener.isConnected) opener.focus(); resolve(ok); };
        var lock = function (on) { d.querySelectorAll('#mjCancel, #mjSearch, button[data-i]').forEach(function (b) { b.disabled = on; }); };
        var draw = function () {
          var t = search.value.trim().toLowerCase(), shown = all.filter(function (c) { return !t || (c.title + ' ' + c.sub).toLowerCase().indexOf(t) !== -1; }).slice(0, 80);
          list.innerHTML = shown.length ? shown.map(function (c) {
            return '<button type="button" class="b" data-i="' + all.indexOf(c) + '" style="display:flex;width:100%;justify-content:space-between;gap:10px;margin-bottom:6px;white-space:normal;text-align:left"' + (c.current ? ' disabled' : '') + '>' +
              '<span>' + esc(c.title) + (c.current ? ' (linked now)' : c.same ? ' · same street' : '') + '</span><span class="soft" style="font-size:12px">' + esc(c.sub) + '</span></button>';
          }).join('') : '<p class="soft">' + (t ? 'Nothing has that in its name.' : 'Nothing to link.') + '</p>';
        };
        list.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-i]'); if (!b || busy || saved) return;
          var c = all[+b.dataset.i];
          busy = true; lock(true); msg.textContent = 'Saving…';
          linkTo(P, row, c.link, { replace: true }).then(function () { done(true); }, function (err) {
            msg.textContent = err.message;
            if (err.linked) { saved = true; var x = d.querySelector('#mjCancel'); x.textContent = 'Close'; x.disabled = false; return; }
            busy = false; lock(false);
          });
        });
        search.addEventListener('input', draw);
        d.querySelector('#mjCancel').addEventListener('click', function () { done(saved); });
        d.addEventListener('cancel', function (e) { e.preventDefault(); if (!busy || saved) done(saved); });
        draw();
        doc.body.appendChild(d);
        d.showModal();
        search.focus();
      });
    });
  }

  return { candidates: candidates, filter: filter, refusal: refusal, linkTo: linkTo, setAside: setAside, open: open,
    jobCandidates: jobCandidates, openForJob: openForJob };
});
