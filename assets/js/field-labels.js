/* ============================================================
   FIELD LABELS — names every editor control for assistive tech.

   The editor panels draw a caption next to each control (a <label> or a
   .field-label span) but the two are siblings, not linked, so a screen reader
   announced "edit text" with no name and clicking the caption did nothing.
   This links them with aria-labelledby, and keeps doing it for controls the
   tools draw later (their panels are rebuilt from templates on every edit).

   A control that already has a <label for>, a wrapping <label>, an aria-label
   or a title is left alone.
   ============================================================ */
(function () {
  'use strict';
  const CONTROLS = 'input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), select, textarea';
  const CAPTION = 'label, .field-label';
  let uid = 0, queued = false;

  function captionFor(el) {
    if (el.labels && el.labels.length) return null;
    if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.title) return null;
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling) {
      if (s.matches(CAPTION)) return s;
    }
    const box = el.closest('.field, .slider-field');
    return box ? box.querySelector(CAPTION) : null;
  }

  function link(root) {
    root.querySelectorAll(CONTROLS).forEach(el => {
      const cap = captionFor(el);
      if (!cap) return;
      if (!cap.id) cap.id = 'fl' + (++uid);
      el.setAttribute('aria-labelledby', cap.id);
    });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; link(document); });
  }

  function start() {
    link(document);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
