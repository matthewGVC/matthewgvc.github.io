/* ============================================================
   JOB PAGE: a development's Finishes card (Matt, 11-04: every new
   development, accurate finish sheets; plan D142).

     GVC_JP.finishes.html(ctx)        → the card (every development, and a
                                        development that is one house)
     GVC_JP.finishes.wire(host, ctx)  → reads Drive and shows the sheet
     GVC_JP.finishes.placesOf(slug)   → where its finish sheet lives
     GVC_JP.finishes.body(ctx, found) → the card's inside for what Drive gave

   Nothing is typed in here: the card shows the finish sheet itself, read
   live from the development's Drive folder each time the page opens (the
   PDF embedded with Drive's own viewer, and Open on Drive). Put a new
   version at the folder's top (the old one to Archive\, D124) and the page
   shows it at once. Only PDFs (GVC_DRIVE_RULES.finishFile): the builder's
   working sheets carry allowances and prices.

   PLACES says where a development keeps it when that isn't the standard
   Finishes folder (assets/js/drive-rules.js). TBC lists what is known to be
   missing from the sheet: each shows as "To be confirmed", never a guess.
   The open questions behind them are in exports/finish-sheet-notes-<date>.md.
   No file's own name is shown (Matt, 11-03).
   ============================================================ */
(function (global) {
  'use strict';
  var JP = global.GVC_JP = global.GVC_JP || {};
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* where each development's finish sheet sits, under its Drive folder; a label only when there is
     more than one place (a development of several houses). Not listed: the standard 'Finishes'. */
  var PLACES = {
    'le-reve': [{ path: '0 - Approved Assets/Finishes' }],
    'casa-avenida': [{ path: '0 - Approved Asset Collection' }],
    '619-bradley': [{ path: 'Finish Schedule' }],
    '315-foreman-ave': [{ path: 'House 2/Finishes', label: 'House 2' }],
    '405-old-bridge-rd': [{ path: 'House 1/Finishes', label: 'House 1' }, { path: 'House 2/Finishes', label: 'House 2' }]
  };
  /* known gaps: what the sheet doesn't say yet */
  var TBC = {
    'le-reve': ['Surface colours in each residence. The products are the same in all five, but the builder says the colours differ in every residence.'],
    'casa-avenida': ['Which residences have the Brisa finishes and which have the Noir finishes.']
  };

  function placesOf(slug) { return PLACES[slug] || [{ path: 'Finishes' }]; }

  function day(v) {
    var t = Date.parse(v);
    if (isNaN(t)) return '';
    var d = new Date(t);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function asMe(u) { var P = global.GVC_PROPS; return P && P.asMe ? P.asMe(u) : u; }
  function preview(url) { return String(url || '').replace(/\/view(\?.*)?$/, '/preview'); }
  var DRIVE_FILE = /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view/;

  function tbcHtml(ctx) {
    var xs = TBC[ctx.row.slug] || [];
    if (!xs.length) return '';
    return '<div class="fin-tbc"><div class="t">To be confirmed</div><ul>' + xs.map(function (x) { return '<li>' + ctx.esc(x) + '</li>'; }).join('') + '</ul></div>';
  }

  /* found: [{ place, files: [{ modified, url }] }] as wire read it */
  function body(ctx, found) {
    var esc = ctx.esc, I = ctx.I, many = placesOf(ctx.row.slug).length > 1;
    var all = [];
    found.forEach(function (p) { (p.files || []).forEach(function (f) { if (DRIVE_FILE.test(f.url || '')) all.push({ place: p.place, f: f }); }); });
    if (!all.length) return '<p class="fin-none"><b>No finish sheet yet.</b> Once its PDF is in the development\'s Finishes folder on Drive, it shows here.</p>';
    all.sort(function (a, b) { return String(b.f.modified || '').localeCompare(String(a.f.modified || '')); });
    var rows = all.map(function (x) {
      var what = (many && x.place.label ? x.place.label + ' · ' : '') + 'Finish sheet' + (x.f.modified ? ' · ' + day(x.f.modified) : '');
      return '<div class="kr"><span class="ic">' + I('file') + '</span><div><div class="t">' + esc(what) + '</div></div>' +
        '<div class="a"><a class="b sm ghost" href="' + esc(asMe(x.f.url)) + '" target="_blank" rel="noopener">' + I('arrow') + 'Open</a></div></div>';
    }).join('');
    // the newest one embedded, read in Drive's own viewer (each person's own Drive access)
    return '<div class="kit">' + rows + '</div>' +
      '<iframe class="fin-view" title="Finish sheet" loading="lazy" src="' + esc(asMe(preview(all[0].f.url))) + '"></iframe>';
  }

  function html(ctx) {
    if (!ctx.row) return '';
    return '<div class="card" id="finCard"><div class="card-h"><div><h2>Finishes</h2><p>The finishes and specs that come with the homes, from the finish sheet on Drive.</p></div></div>' +
      tbcHtml(ctx) + '<div id="finBody"><p class="soft">' + (ctx.drive === 'connected' ? 'Reading Drive…' :
        'Sign in with Google on your GVC email to see the finish sheet.') + '</p></div></div>';
  }

  function wire(host, ctx) {
    var b = host.querySelector('#finBody'), D = global.GVC_DRIVE, r = ctx.row;
    if (!b || ctx.drive !== 'connected' || !D || !D.listFinishes) return;
    if (!r.drive_folder) { b.innerHTML = body(ctx, []); return; }
    var places = placesOf(r.slug);
    Promise.all(places.map(function (p) {
      return D.listFinishes(r.drive_folder, p.path, { timeoutMs: 20000 }).then(function (files) { return { place: p, files: files }; });
    })).then(function (found) { b.innerHTML = body(ctx, found); }, function (e) {
      b.innerHTML = '<p class="fmsg" role="alert">' + ctx.esc(e && e.message ? e.message : 'Drive couldn\'t be read.') + '</p>';
    });
  }

  JP.finishes = { html: html, wire: wire, placesOf: placesOf, body: body, PLACES: PLACES, TBC: TBC };
})(typeof window !== 'undefined' ? window : globalThis);
