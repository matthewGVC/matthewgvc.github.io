/* ============================================================
   WORKSPACE COLLAPSE — every card with a title folds from it (Matt, 10-23).
   A card opens by default only when it carries data-open (each page's main
   list; a job's headline tiles and Stages); every other card starts folded.
   What each person opens or folds is kept in this browser per page and title
   (localStorage gvc.collapse), so a job's cards open the same on every job.
   Cards drawn later (the job page draws after it loads) are picked up too.

     <div class="card" data-open>…           open until folded
     <div class="card" data-collapse="off">  never folds
     localStorage gvc.collapse.all = 'open'  everything open (the page tests)

   The title is the card's .card-h, else its first h2 or h3.
   ============================================================ */
(function (global) {
  'use strict';
  var doc = global.document, KEY = 'gvc.collapse';
  var store = {};
  try { store = JSON.parse(global.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  var allOpen = false;
  try { allOpen = global.localStorage.getItem(KEY + '.all') === 'open'; } catch (e) { /* private window: defaults */ }
  var page = global.location.pathname.replace(/index\.html$/, '');

  function save() { try { global.localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* nothing kept */ } }
  function headOf(card) {
    for (var i = 0; i < card.children.length; i++) {
      var c = card.children[i];
      if (c.classList.contains('card-h') || /^H[23]$/.test(c.tagName)) return c;
    }
    return null;
  }
  function titleOf(head) {
    var h = /^H[23]$/.test(head.tagName) ? head : head.querySelector('h2, h3');
    return h ? h.textContent.replace(/\d+/g, '').replace(/\s+/g, ' ').trim() : '';
  }
  function set(card, open) {
    card.classList.toggle('cz-shut', !open);
    var b = card.querySelector(':scope > .cz-head .cz-btn');
    if (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); b.title = open ? 'Fold' : 'Open'; }
  }
  function wire(card) {
    if (card.dataset.czDone || card.dataset.collapse === 'off') return;
    var head = headOf(card), title = head && titleOf(head);
    if (!title) return;
    card.dataset.czDone = '1';
    head.classList.add('cz-head');
    var id = page + '|' + title;
    var b = doc.createElement('button');
    b.type = 'button'; b.className = 'cz-btn';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg><span class="sr"></span>';
    b.lastChild.textContent = title;
    head.appendChild(b);
    var toggle = function () { var open = card.classList.contains('cz-shut'); store[id] = open; save(); set(card, open); };
    b.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    // the title itself folds too (not the buttons and links beside it)
    head.addEventListener('click', function (e) { if (!e.target.closest('button, a, input, select, label, summary')) toggle(); });
    set(card, allOpen || (id in store ? store[id] : card.hasAttribute('data-open')));
  }
  function scan(root) { (root.querySelectorAll ? root.querySelectorAll('.card') : []).forEach(wire); }

  scan(doc);
  new global.MutationObserver(function (list) {
    list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.classList.contains('card')) wire(n); scan(n); } }); });
  }).observe(doc.body, { childList: true, subtree: true });
})(window);
