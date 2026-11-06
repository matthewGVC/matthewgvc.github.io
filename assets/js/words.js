/* ============================================================
   WORDS — the team's plain words (overhaul step 2).

   The team aren't developers: what the workspace shows them says "Elliman",
   not "DE", and names a check ("Price") rather than its code ("M3"). Most of
   the shown text is written in plain words where it is made; this file
   covers what isn't: the Errors lines the helper stores, labels that come
   from the data, and anything older. A new term goes in SWAPS once, here.

     GVC_WORDS.plain(text)    → the text in the team's words
     GVC_WORDS.check(code)    → a check's short name: 'M3' → 'Price'
     GVC_WORDS.tidy(root)     → rewrite the shown text and hover titles under
                                root, and keep doing it as the page redraws
     GVC_WORDS.BANNED         → what must never show (scripts/test-workspace.js)
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_WORDS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // the order matters: the longer phrases first
  var SWAPS = [
    [/\ba DE\b/g, 'an Elliman'], [/\bA DE\b/g, 'An Elliman'],
    [/\bDE id\b/g, 'Elliman listing ID'],
    [/\bDE STATUS\b/g, 'ELLIMAN STATUS'],
    [/\bDE\b/g, 'Elliman'],
    [/the PC that runs the helper/g, 'Matt\'s computer'],
    [/\bthe helper\b/g, 'Matt\'s computer'],
    [/\bThe helper\b/g, 'Matt\'s computer'],
    [/🚧 ?/g, '']
  ];
  var BANNED = [/\bDE\b/, /\bhelper\b/i, /🚧/];

  // each Errors check by a short name; the code stays in the hover for Matt
  var CHECK = {
    M1: 'Stage', M2: 'Not in both', M3: 'Price', M4: 'Beds, baths, size', M5: 'Closing date', M6: 'Folder',
    M7: 'Missing link', M8: 'Marketing step', M9: 'Exclusive expired', M10: 'Missing basics', M11: 'Agents',
    M12: 'Late work', M13: 'Checklist open', M14: 'Asana section', M15: 'Listing date passed', M16: 'Point Person',
    M17: 'Your value', M18: 'Folder found', M19: 'Maybe the same listing', M20: 'Old record', M21: 'Deal stuck',
    M22: 'Original price', M23: 'Missing date', M24: 'Old deal date', M25: 'Not on Elliman', M26: 'Zip code',
    M27: 'Exclusive ending', M28: 'Closed, task open', M29: 'Listed twice', M30: 'Name rule'
  };

  function plain(text) {
    var s = String(text == null ? '' : text);
    SWAPS.forEach(function (w) { s = s.replace(w[0], w[1]); });
    return s;
  }
  function check(code) { return CHECK[code] || code; }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1 };
  function tidyNode(root) {
    if (!root || !root.ownerDocument && root.nodeType !== 9) return;
    var doc = root.ownerDocument || root, walk = doc.createTreeWalker(root, 4 /* text */, null), n, todo = [];
    while ((n = walk.nextNode())) {
      if (n.parentNode && SKIP[n.parentNode.nodeName]) continue;
      if (BANNED.some(function (b) { return b.test(n.nodeValue); })) todo.push(n);
    }
    // only a real change is written: writing the same text back would wake the observer again
    todo.forEach(function (t) { var v = plain(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; });
    var el = root.nodeType === 1 ? root : doc.body;
    if (!el) return;
    [el].concat(Array.prototype.slice.call(el.querySelectorAll('[title],[placeholder],[aria-label]'))).forEach(function (e) {
      ['title', 'placeholder', 'aria-label'].forEach(function (a) {
        var v = e.getAttribute && e.getAttribute(a);
        if (v && BANNED.some(function (b) { return b.test(v); }) && plain(v) !== v) e.setAttribute(a, plain(v));
      });
    });
  }
  // the pages redraw often; a rewrite is only made where a banned word shows, so it settles at once
  function tidy(root) {
    // the page tests read the text as the code writes it; scripts/test-words.js and one page check cover this
    try { if (root.ownerDocument.defaultView.localStorage.getItem('gvc.words.raw')) return; } catch (e) { /* no storage: tidy */ }
    tidyNode(root);
    var MO = typeof MutationObserver === 'function' ? MutationObserver : null;
    if (!MO || root.__gvcWords) return;
    root.__gvcWords = true;
    new MO(function (list) {
      list.forEach(function (m) {
        if (m.type === 'characterData') tidyNode(m.target.parentNode);
        else if (m.type === 'attributes') tidyNode(m.target);
        else m.addedNodes.forEach(function (a) { if (a.nodeType === 3) tidyNode(a.parentNode); else if (a.nodeType === 1) tidyNode(a); });
      });
    }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
  }

  return { plain: plain, check: check, tidy: tidy, BANNED: BANNED, CHECK: CHECK };
});
