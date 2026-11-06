/* ============================================================
   JOB PAGE: a place's other deals (places and deals).

     GVC_JP.deals.rows(deals, currentId) → { live: [{ slug, word, kind, here }],
                                              past: [{ slug, year, type, soldPrice, word, dates: [{ word, day }] }] }
     GVC_JP.deals.html(ctx)              → the Deals card ('' when the place has one deal)

   A place (an apartment or house) can carry several deals: a sale and its
   rental, or a listing years after the last. `deals` are the database's rows
   at this job's place (id, slug, kind, side, stage, core, milestones,
   created_at), this one included. Live ones (GVC_PLACES.LIVE) sit on top, each
   a link to its page, so a sale's rental is one click away; this page's own
   deal is marked "This page". Past ones, newest first, are rows that open to
   show the year, type, sold price and dates, and link to their page.

   A sold price is Elliman's (core.closePrice) and nothing else: never Asana's,
   never the asking price. A purchase (side 'buy') reads "Purchase". Milestones
   are { key: { on } }; an older row may keep a bare date, so both are read.

   Loads in the browser (GVC_JP.deals) and in Node (require, for its test).
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory(global);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { var JP = global.GVC_JP = global.GVC_JP || {}; JP.deals = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  var inNode = typeof module === 'object' && module.exports && typeof require === 'function';
  function W() { return inNode ? require('../workspace-data.js') : global.GVC_WS; }
  function places() { return inNode ? require('../places.js') : global.GVC_PLACES; }

  function typeOf(d) { return d.side === 'buy' ? 'Purchase' : d.kind === 'rental' ? 'Rental' : 'Sale'; }
  function dayOf(m) { return typeof m === 'string' ? m : m && m.on ? m.on : ''; }
  /* the dates it reached, in date order, each with the workspace's word for it ('Listed', 'Closed');
     a planned date with no day yet, and a key the workspace has no word for, stay out */
  function days(d) {
    var ms = d.milestones || {}, words = W().DATE_LABEL;
    return Object.keys(ms).filter(function (k) { return words[k] && dayOf(ms[k]); })
      .map(function (k) { return { word: words[k][0], day: dayOf(ms[k]) }; })
      .sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; });
  }
  /* the row's chip: 'Sale · Live', 'Rental · Live', 'Purchase · Live', and plain 'Pitch' like the Overview */
  function word(d) {
    var type = d.stage === 'Pitch' ? 'pitch' : d.side === 'buy' ? 'purchase' : d.kind === 'rental' ? 'rental' : 'listing';
    return places().dealWord({ type: type, stage: stage(d) });
  }
  function when(d) { var ms = d.milestones || {}; return dayOf(ms.closedOn) || dayOf(ms.listedOn) || String(d.created_at || '').slice(0, 10); }
  function stage(d) { return W().stageWord(d.stage, d.kind); }

  function rows(deals, currentId) {
    var live = [], past = [];
    (deals || []).forEach(function (d) {
      if (places().LIVE.indexOf(d.stage) !== -1) {
        live.push({ slug: d.slug, word: word(d), kind: typeOf(d), here: d.id === currentId });
      } else if (d.id !== currentId) {
        var close = (d.core || {}).closePrice;
        past.push({ slug: d.slug, year: when(d).slice(0, 4), type: typeOf(d), soldPrice: close ? W().money(close) : '', word: stage(d), dates: days(d), _on: when(d) });
      }
    });
    past.sort(function (a, b) { return a._on < b._on ? 1 : a._on > b._on ? -1 : 0; });
    past.forEach(function (p) { delete p._on; });
    return { live: live, past: past };
  }

  function html(ctx) {
    var deals = ctx.deals || [];
    if (deals.length < 2) return '';
    var esc = ctx.esc, I = ctx.I, W_ = W(), r = rows(deals, ctx.row.id);
    function link(slug, text) { return '<a href="../job/?listing=' + encodeURIComponent(slug) + '">' + I('arrow') + esc(text) + '</a>'; }
    var live = r.live.map(function (d) {
      return '<div class="deal-row" data-deal-live>' + (d.here ? '<b>' + esc(d.word) + '</b> <span class="chip">This page</span>' : link(d.slug, d.word)) + '</div>';
    }).join('');
    var past = r.past.map(function (d) {
      var head = [d.year, d.type, d.soldPrice, d.word].filter(Boolean).join(' · ');
      return '<details class="fx" data-deal-past><summary>' + esc(head) + '</summary><div class="deal-row">' +
        (d.dates.length ? esc(d.dates.map(function (x) { return x.word + ' ' + W_.fmtDayYear(x.day); }).join(' · ')) + ' ' : '') + link(d.slug, 'Open') + '</div></details>';
    }).join('');
    return '<div class="card" id="dealsCard"><div class="card-h"><div><h2>Deals</h2><p>Everything on this place: what is live now, and what came before.</p></div></div>' + live + past + '</div>';
  }

  return { rows: rows, html: html };
});
