/* Page design toggle for the Buyer and Seller packages: Classic (the
   original look) or Guide (assets/css/guide-look.css, the Destination
   Guide's look). The choice is remembered in the browser and applies to
   print too, since it is a class on <body>. */
(function (global) {
  'use strict';
  var KEY = 'gvc-package-look';

  function read() {
    try { return global.localStorage.getItem(KEY) === 'guide' ? 'guide' : 'classic'; }
    catch (e) { return 'classic'; }
  }
  function write(v) {
    try { global.localStorage.setItem(KEY, v); } catch (e) { /* private window: the choice just isn't kept */ }
  }
  function apply(v) { document.body.classList.toggle('look-guide', v === 'guide'); }

  /* Call once before the first draw so the pages are built under the right
     class. `host` is the .seg.pick holding the two buttons; `redraw` repaints
     the pages (the cover fits its own type, so it has to run again). */
  function wire(host, redraw) {
    var cur = read();
    apply(cur);
    global.Pitch.segPick(host, 'look', function () { return cur; }, function (v) {
      cur = v; write(v); apply(v);
      if (redraw) redraw();
    });
  }

  global.GVC_LOOK = { wire: wire };
  apply(read());
})(window);
