/* ============================================================
   COLLAPSIBLE EDITOR PANEL — shared by every tool with a left-hand panel.
   Styles: assets/css/panel-collapse.css.

   Three panel layouts exist on the site, and this finds whichever the page
   has:
     builder   #app > #editor        builder.css tools and the Showsheet
     map       .mapstudio > .sidebar Map Studio
     watermark .tool > .controls     Watermark
   A round handle sits on the panel's right edge; clicking it folds the
   panel away (or back) and the preview takes the width.

   Every preview here re-fits on window resize (builder.js fit(), the
   Showsheet's layoutPreview(), Mapbox), and none watches its own size, so
   one resize event after the slide is what makes the pages fill the room.

   Remembered per tool in localStorage. Desktop only: below each layout's
   stacking breakpoint the panel sits above the preview and the handle is
   hidden by CSS, with the panel always shown.
   ============================================================ */
(function () {
  'use strict';
  const LAYOUTS = [
    { name: 'builder',   box: '#app',       panel: '#editor' },
    { name: 'map',       box: '.mapstudio', panel: '.mapstudio > .sidebar' },
    { name: 'watermark', box: '.tool',      panel: '.tool > .controls' }
  ];

  function start() {
    let L = null, box = null, panel = null;
    for (const l of LAYOUTS) {
      box = document.querySelector(l.box); panel = document.querySelector(l.panel);
      if (box && panel) { L = l; break; }
    }
    if (!L) return;   // a tool with no side panel (NJ Footprint, Calculator, ...)

    const KEY = 'gvc.panel.' + location.pathname.replace(/index\.html$/, '');
    const read = () => { try { return localStorage.getItem(KEY) === 'closed'; } catch (e) { return false; } };
    const keep = shut => { try { localStorage.setItem(KEY, shut ? 'closed' : 'open'); } catch (e) { /* private window */ } };

    if (!panel.id) panel.id = 'toolPanel';
    document.body.dataset.panelLayout = L.name;
    box.classList.add('pc-box');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pc-handle';
    btn.setAttribute('aria-controls', panel.id);
    btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    box.appendChild(btn);

    /* the handle rides the panel's edge, wherever that edge is */
    const shutNow = () => document.body.classList.contains('panel-collapsed');
    /* collapsing is a desktop thing: where the handle is hidden the panel is
       shown whatever was saved, so it must not be left inert there */
    const desktop = () => getComputedStyle(btn).display !== 'none';
    const place = () => {
      btn.style.left = (shutNow() ? 0 : panel.offsetWidth) + 'px';
      panel.toggleAttribute('inert', shutNow() && desktop());
    };
    const label = shut => {
      btn.setAttribute('aria-expanded', String(!shut));
      btn.setAttribute('aria-label', shut ? 'Show the editing panel' : 'Hide the editing panel');
      btn.title = shut ? 'Show panel' : 'Hide panel';
    };
    let timer = 0;
    function set(shut, animate) {
      document.body.classList.toggle('pc-anim', !!animate);
      document.body.classList.toggle('panel-collapsed', shut);
      label(shut); place();
      clearTimeout(timer);
      timer = setTimeout(() => {
        place();
        window.dispatchEvent(new Event('resize'));
        document.body.classList.remove('pc-anim');
      }, animate ? 340 : 0);
    }

    btn.addEventListener('click', () => {
      const shut = !shutNow();
      keep(shut); set(shut, true);
    });
    window.addEventListener('resize', place);
    set(read(), false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
