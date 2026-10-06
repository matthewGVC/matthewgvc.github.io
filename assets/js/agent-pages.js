/* ============================================================
   AGENT-FACING PAGE BODIES — "Don't Forget to Ask" and "FAQ's".

   The words are in tools/buyer-package/guide-data.js (askFor / faqFor);
   this only draws them, so the Useful Agent Info tool and the Buyer Package
   print the same page. Styles: assets/css/agent-pages.css.
   Needs GVC_GUIDE and Pitch loaded first.
   ============================================================ */
(function (global) {
  'use strict';
  var esc = function (s) { return global.Pitch.esc(s); };
  var ic = function (name, cls) { return global.icon ? global.icon(name, cls) : ''; };

  /* The agent's own prompt sheet: the questions that slip out of a first
     consultation. Five shared groups and one for the market. */
  function discovery(region) {
    var groups = global.GVC_GUIDE.askFor(region);
    return '<div class="ask">' +
      '<p class="lede">For the agent, with the buyer in the room. Tick each one once it has an answer.</p>' +
      '<div class="chk ask-chk">' + groups.map(function (g, gi) {
        return '<div class="cgrp' + (gi === groups.length - 1 ? ' mkt' : '') + '">' +
          '<div class="cgrp-h"><span class="n">' + (gi + 1) + '</span><span>' + esc(g.title) + '</span></div>' +
          '<ul>' + g.items.map(function (t) { return '<li><i></i><span>' + esc(t) + '</span></li>'; }).join('') + '</ul>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  /* The buyer's checklist, drawn per market. */
  function faq(region) {
    var groups = global.GVC_GUIDE.faqFor(region);
    return '<div class="chk tight faq">' + groups.map(function (g) {
      return '<div class="cgrp"><div class="cgrp-h">' + ic(g.icon, 'ci') + '<span>' + esc(g.title) + '</span></div>' +
        '<ul>' + g.items.map(function (t) { return '<li><i></i><span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';
  }

  global.GVC_AGENTPAGES = { discovery: discovery, faq: faq };
})(window);
