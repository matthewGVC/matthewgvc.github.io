/* ============================================================
   PROPERTY BAR — load and save a property, identically in all three tools
   that bind a document to one: the Showsheet, the Brochure and the Seller
   Pitch & CMA. The Buyer Package has no property to bind to.

   A tool mounts it at the top of its editor panel and hands over four small
   functions: how to read its facts, how to fill its form from them, how to
   read its own document, and how to restore one. Everything else — the
   dropdown, the password, the dirty marker, the offline notice, the
   conflict list — lives here so all three behave the same way.

     GVC_PROPBAR.mount({
       host, tool,
       toCore:   function () { return { address, price, … }; },
       fromCore: function (core) { …fill the form… },
       getDoc:   function () { return state; },
       setDoc:   function (doc) { …restore… }
     });
   ============================================================ */
(function (global) {
  'use strict';

  var P = global.GVC_PROPS;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var STATUS_LABEL = {
    'active': 'Active', 'coming-soon': 'Coming soon', 'sold': 'Sold', 'archived': 'Archived'
  };

  function mount(opts) {
    var host = opts.host, tool = opts.tool;
    if (!host) return null;

    var current = null;        // the loaded property, or null for unsaved work
    var busy = false;

    var bar = el('div', 'plib');
    var title = el('div', 'plib-title', 'Saved property');
    var line = el('div', 'plib-line');
    var name = el('button', 'plib-name');
    var mark = el('span', 'plib-mark');
    var pick = el('select', 'plib-pick');
    var save = el('button', 'plib-save btn sm');
    var status = el('select', 'plib-status');
    var note = el('div', 'plib-note');
    /* The bar can load and save; renaming, archived properties and the photo
       storage read-out live on the Properties page. Same relative path from
       every builder. */
    var more = el('a', 'plib-more', 'All properties');
    more.href = '../properties/';
    more.title = 'Rename, un-archive, and see how much photo storage is left';

    name.type = 'button';
    save.type = 'button';
    pick.title = 'Open a saved property';
    status.title = 'Where this listing is up to';
    P.STATUSES.forEach(function (s) {
      var o = el('option', null, STATUS_LABEL[s]);
      o.value = s;
      status.appendChild(o);
    });

    var head = el('div', 'plib-head');
    var foot = el('div', 'plib-foot');
    head.append(name, mark);
    line.append(pick, save);
    foot.append(status, more);
    bar.append(title, head, line, foot, note);
    host.append(bar);

    /* ---------------- saying what is going on ---------------- */

    function say(text, kind) {
      note.textContent = text || '';
      note.className = 'plib-note' + (kind ? ' is-' + kind : '');
    }

    function paint() {
      name.textContent = current ? current.label : 'No property loaded';
      name.title = current ? 'Show when this property was last saved' : 'Nothing loaded — Save creates one';
      name.classList.toggle('is-empty', !current);
      mark.textContent = global.GVC_UNSAVED && GVC_UNSAVED.isDirty() ? 'Unsaved changes' : '';
      save.textContent = current ? 'Save to this property' : 'Save as new property';
      save.disabled = busy;
      status.value = current ? current.status : 'active';
      status.hidden = !current;
      if (!navigator.onLine) say('You are offline — the library needs a connection.', 'warn');
    }

    /* ---------------- the dropdown ---------------- */

    function fillPick(rows) {
      pick.replaceChildren();
      pick.append(new Option(placeholder(rows.length), ''));
      rows.forEach(function (r) {
        var built = P.TOOLS.filter(function (t) { return r.has[t]; }).length;
        var o = new Option(r.label + '  ·  ' + STATUS_LABEL[r.status] +
                           (built ? '  ·  ' + built + ' doc' + (built > 1 ? 's' : '') : ''), r.id);
        pick.append(o);
      });
      pick.value = current ? current.id : '';
    }

    /* Signed out is the normal first state on a new machine, and "no saved
       properties" would be a lie — say what to do instead. */
    function placeholder(count) {
      if (!P.signedIn()) return 'Sign in to load a property…';
      return count ? 'Load a property…' : 'No saved properties yet';
    }

    function refresh() {
      return P.list().then(fillPick).catch(function (e) { say(e.message, 'warn'); });
    }

    /* ---------------- sign in ---------------- */

    /* The gate is on the library, not on the tools: an agent can build a
       one-off document without ever seeing this. */
    function ensureSignedIn() {
      if (P.signedIn()) return Promise.resolve(true);
      var pw = global.prompt('Team password to open the property library:');
      if (!pw) return Promise.resolve(false);
      return P.signIn(pw).then(function () { say('Signed in.', 'ok'); return true; })
                         .catch(function (e) { say(e.message, 'warn'); return false; });
    }

    /* ---------------- load ---------------- */

    function open(id) {
      if (!id) return;
      var dirty = global.GVC_UNSAVED && GVC_UNSAVED.isDirty();
      if (dirty && !global.confirm('Load this property? Unsaved changes here are lost.')) {
        pick.value = current ? current.id : '';
        return;
      }
      busy = true; paint(); say('Loading…');
      P.load(id, tool)
        .then(function (prop) {
          return P.photoUrls(prop.photos).then(function (urls) {
            current = prop;
            /* A load starts from a blank sheet. The builder puts every
               document field back to its default before the property's facts
               land on it, so nothing from the last listing can reach the next
               one's collateral — a hand-listed reset in each setDoc is how a
               previous listing's Web ID, assessments and financing limit used
               to print on the following property. */
            if (opts.blank) opts.blank();
            opts.fromCore(prop.core || {});
            // retokenize first: a document saved before the token round trip was
            // fixed holds expired signed URLs, and they still name their photos
            opts.setDoc(prop.doc ? P.hydrate(P.retokenize(prop.doc, prop.photos), urls) : null);
            var built = prop.doc ? 'its saved ' + tool : 'no ' + tool + ' yet — the facts are filled in';
            say('Loaded ' + prop.label + ' · ' + built, 'ok');
            if (global.GVC_UNSAVED) GVC_UNSAVED.clear();
          });
        })
        .catch(function (e) { say(e.message, 'warn'); })
        .then(function () { busy = false; paint(); refresh(); });
    }

    /* ---------------- save ---------------- */

    /* Facts that differ from the property's are never overwritten silently:
       the agent is shown what would change and says yes or no. */
    function confirmChanges(core) {
      var diffs = P.changesAgainst(current.core, core);
      if (!diffs.length) return true;
      var lines = diffs.map(function (d) {
        return '  ' + d.field + ':  ' + shown(d.was) + '  →  ' + shown(d.now);
      }).join('\n');
      return global.confirm('Update the property with these changes?\n\n' + lines +
                            '\n\nCancel keeps the property as it is and still saves your ' + tool + '.');
    }

    /* An emptied field reads as "(empty)" rather than "" — clearing a price is
       now a change the agent can be asked about, and a bare pair of quotes is
       not an obvious way to say so. */
    function shown(v) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '(empty)';
      return JSON.stringify(v);
    }

    function doSave() {
      if (busy) return;
      ensureSignedIn().then(function (ok) {
        if (!ok) return;
        var core = opts.toCore() || {};
        busy = true; paint(); say('Saving…');

        var isNew = !current;

        /* Every question that could stop the save is asked before anything is
           written: first whether someone else has moved this document, then
           whether shared facts would change. Cancel at either and the library
           is exactly as it was — which is what "Nothing saved" has always
           claimed, and did not used to be true: the facts had already gone up
           by the time the second prompt appeared. */
        Promise.resolve(isNew ? true : warnIfSavedElsewhere())
          .then(function (go) {
            if (!go) throw new Error('Nothing saved.');
            // a property created from this very form has nothing to
            // reconcile — asking would be theatre
            var writeCore = !isNew && current.core && confirmChanges(core);
            return (isNew ? startProperty(core) : Promise.resolve(current))
              .then(function () { return writeCore ? P.saveCore(current.id, core) : null; });
          })
          .then(function (updated) {
            if (updated) { current.core = updated.core; current.label = updated.label; }
            return P.saveDocument(current.id, tool, opts.getDoc(), function (done, total) {
              say(total > 1 ? 'Saving — photo ' + done + ' of ' + total + '…' : 'Saving…');
            });
          })
          .then(function (saved) {
            if (!saved) return;
            /* This session now holds the newest version, so the next save
               compares against what it just wrote rather than accusing the
               agent of editing from somewhere else. */
            if (saved.saved_at) current.docSavedAt = saved.saved_at;
            if (global.GVC_UNSAVED) GVC_UNSAVED.clear();
            var missed = (saved.skipped || []).length;
            say('Saved to ' + current.label + '.' +
                (missed ? ' ' + missed + ' photo' + (missed > 1 ? 's' : '') +
                          ' could not be read and were left out.' : ''),
                missed ? 'warn' : 'ok');
          })
          .catch(function (e) { say(e.message, 'warn'); })
          .then(function () { busy = false; paint(); refresh(); });
      });
    }

    /* Saving with nothing loaded creates the property — unless that address
       is already in the library, in which case the honest thing is to offer
       the one that exists rather than refuse. */
    function startProperty(core) {
      return P.create(core)
        .then(adopt)
        .catch(function (e) {
          if (e.status !== 409) throw e;
          // the identity is the address and the unit together, so the
          // duplicate check has to ask about the joined line
          return P.findByAddress(P.joinUnit(core.address, core.unit)).then(function (row) {
            if (!row) throw e;
            if (!global.confirm('“' + row.label + '” is already in the library.\n\n' +
                                'Save this ' + tool + ' into that property?')) {
              throw new Error('Nothing saved.');
            }
            return adopt(row);
          });
        });
    }

    function adopt(row) {
      current = { id: row.id, label: row.label, status: row.status || 'active', core: row.core || {} };
      return current;
    }

    /* Last save wins, but not silently: if this document moved since it was
       loaded, somebody else has been in it. */
    function warnIfSavedElsewhere() {
      if (!current || !current.docSavedAt) return Promise.resolve(true);
      return P.docSavedAt(current.id, tool).then(function (at) {
        if (!at || at === current.docSavedAt) return true;
        return global.confirm('This ' + tool + ' was saved again ' + when(at) +
                              ', from another session.\n\nSaving now replaces that version.');
      });
    }

    function when(iso) {
      var mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + ' minute' + (mins > 1 ? 's' : '') + ' ago';
      var hrs = Math.round(mins / 60);
      if (hrs < 24) return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
      return 'on ' + new Date(iso).toLocaleDateString();
    }

    /* ---------------- wiring ---------------- */

    pick.addEventListener('change', function () { open(pick.value); });
    /* Opening the dropdown while signed out asks for the password first,
       then fills itself in — rather than showing an empty list. */
    pick.addEventListener('mousedown', function (e) {
      if (P.signedIn()) return;
      e.preventDefault();
      ensureSignedIn().then(function (ok) { if (ok) refresh(); });
    });
    save.addEventListener('click', doSave);
    status.addEventListener('change', function () {
      if (!current) return;
      P.setStatus(current.id, status.value)
        .then(function () { current.status = status.value; say('Marked ' + STATUS_LABEL[status.value].toLowerCase() + '.', 'ok'); refresh(); })
        .catch(function (e) { say(e.message, 'warn'); });
    });
    name.addEventListener('click', function () {
      if (!current) { say('Nothing loaded yet. Save creates a property from the address.'); return; }
      say(current.label + ' · saved ' + when(current.updated || new Date().toISOString()));
    });
    global.addEventListener('online', paint);
    global.addEventListener('offline', paint);
    // the dirty marker should track the tool's own edits
    document.addEventListener('input', function () { setTimeout(paint, 0); }, true);

    paint();
    if (P.signedIn()) refresh();
    else fillPick([]);

    return { refresh: refresh, property: function () { return current; } };
  }

  global.GVC_PROPBAR = { mount: mount };
})(window);
