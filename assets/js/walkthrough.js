/* ============================================================
   WALKTHROUGH — the first-day tour (overhaul step 8).

   Numbered steps with a pointer to the thing each one is about. It starts by
   itself the first time someone opens a page (once per page, per VERSION),
   and "Show me around" in the account menu brings it back.

     GVC_WALK.STEPS[page]        → [{ id, target, title, text, roles? }]
     GVC_WALK.start(page, who)   → shows the tour now; who = whoAmI() (roles filter steps)
     GVC_WALK.offer(page, who)   → starts it only if this person hasn't seen this VERSION
     GVC_WALK.missing(page, who) → ids of steps whose target isn't on the page
     GVC_WALK.has(page)          → this page has a tour

   KEEP IT CURRENT: when a page changes, change its steps here in the same
   commit. scripts/test-workspace.js and scripts/test-job-page.js fail when a
   step's target is gone (missing()). Bump VERSION when the steps change in a
   way people should see again; everyone then gets the new tour once.
   ============================================================ */
(function (global) {
  'use strict';
  var VERSION = 2;
  var EDITORS = ['owner', 'admin', 'marketing', 'ops', 'team'];

  var STEPS = {
    overview: [
      { id: 'market', target: '#mkt', title: 'Your market', text: 'You start on your own market. Tap All to see every market.' },
      { id: 'counts', target: '#stats', title: 'The counts', text: 'On the market, in contract, and jobs still missing a Drive folder or an Elliman match.' },
      { id: 'mine', target: '#mineL', title: 'Only my jobs', text: 'Ticked, the list shows the listings you are an agent on. Untick it to see the whole team.' },
      { id: 'jobs', target: '#jobs', title: 'Every job', text: 'Click a job to open its page: its facts, dates, marketing and notes.' },
      { id: 'search', target: '#wsSearch', title: 'Find a job', text: 'Type an address or a unit.' },
      { id: 'errors', target: '.nav a[href$="match/"]', title: 'Errors', text: 'Where Asana, Drive and Elliman disagree. Each line says what to fix and where.' },
      { id: 'account', target: '#wsMe', title: 'Your account', text: 'Sign out here. "Show me around" brings this tour back.' }
    ],
    job: [
      { id: 'stages', target: '.steps-wrap', title: 'Where it stands', text: 'The job\'s stages, with the date each one happened.' },
      { id: 'facts', target: '#factsHost', title: 'The facts', roles: EDITORS, text: 'Click a value to change it. The change goes to Asana too, in your name.' },
      { id: 'factsRead', target: '#factsHost', title: 'The facts', roles: ['shared'], text: 'Price, size and the rest, from Asana, Elliman and the team.' },
      { id: 'kit', target: '#kitHost', title: 'Marketing materials', text: 'Every piece for this job on one card: whether it is made and up to date, and its buttons to make, open or share it.' },
      { id: 'notes', target: '#logHost', title: 'Notes', text: 'Add a note for the team. Every change made here is listed below it.' }
    ]
  };

  var doc = global.document;
  var KEY = function (page) { return 'gvc.walk.' + page; };
  function seen(page) { try { return +global.localStorage.getItem(KEY(page)) >= VERSION; } catch (e) { return true; } }
  function mark(page) { try { global.localStorage.setItem(KEY(page), String(VERSION)); } catch (e) { /* no storage */ } }

  function forWho(page, who) {
    var role = who && who.role;
    return (STEPS[page] || []).filter(function (s) { return !s.roles || s.roles.indexOf(role) !== -1; });
  }
  function shown(el) { return !!(el && !el.hidden && el.getClientRects().length); }
  function missing(page, who) {
    return forWho(page, who).filter(function (s) { return !shown(doc.querySelector(s.target)); }).map(function (s) { return s.id; });
  }

  var layer = null;
  function close(page) { if (layer) { layer.remove(); layer = null; } doc.removeEventListener('keydown', onKey); mark(page); }
  var onKey = function () {};

  function start(page, who) {
    var steps = forWho(page, who).filter(function (s) { return shown(doc.querySelector(s.target)); });
    if (!steps.length) return false;
    if (layer) layer.remove();
    layer = doc.createElement('div');
    layer.className = 'walk';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', 'A quick tour');
    layer.innerHTML = '<div class="walk-hole"><span class="walk-n"></span></div>' +
      '<div class="walk-tip" role="document"><span class="walk-arrow"></span><div class="walk-of mono"></div><h3></h3><p></p>' +
      '<div class="walk-b"><button type="button" class="b sm ghost" data-w="skip">Skip the tour</button><span style="flex:1"></span>' +
      '<button type="button" class="b sm" data-w="back">Back</button><button type="button" class="b sm primary" data-w="next">Next</button></div></div>';
    doc.body.appendChild(layer);
    var i = 0;
    var hole = layer.querySelector('.walk-hole'), tip = layer.querySelector('.walk-tip'), arrow = layer.querySelector('.walk-arrow');
    function paint() {
      var s = steps[i], el = doc.querySelector(s.target);
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      var r = el.getBoundingClientRect(), pad = 6, vw = global.innerWidth, vh = global.innerHeight;
      var top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
      var w = Math.min(vw - 8 - left, r.width + pad * 2), h = Math.min(vh - 8 - top, r.height + pad * 2);
      hole.style.cssText = 'top:' + top + 'px;left:' + left + 'px;width:' + w + 'px;height:' + h + 'px';
      layer.querySelector('.walk-n').textContent = i + 1;
      layer.querySelector('.walk-of').textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
      tip.querySelector('h3').textContent = s.title;
      tip.querySelector('p').textContent = s.text;
      layer.querySelector('[data-w=back]').hidden = i === 0;
      layer.querySelector('[data-w=next]').textContent = i === steps.length - 1 ? 'Done' : 'Next';
      // the tip under the target when it fits, else above; its arrow points at the target
      var tw = Math.min(340, vw - 32), th = tip.offsetHeight || 160;
      // a tall target (the job list) leaves no room either side: the tip sits inside it, at the window's foot, no arrow
      var below = top + h + 14 + th < vh, above = !below && top - th - 14 > 8;
      var tl = Math.min(Math.max(16, left + Math.min(w, 260) / 2 - 40), vw - tw - 16);
      var tt = below ? top + h + 14 : above ? top - th - 14 : vh - th - 16;
      tip.style.cssText = 'width:' + tw + 'px;left:' + tl + 'px;top:' + Math.max(8, Math.min(tt, vh - th - 8)) + 'px';
      tip.classList.toggle('above', above);
      arrow.hidden = !below && !above;
      arrow.style.left = Math.max(16, Math.min(tw - 28, left + Math.min(w, 260) / 2 - tl - 6)) + 'px';
      layer.querySelector('[data-w=next]').focus();
    }
    layer.addEventListener('click', function (e) {
      var b = e.target.closest('[data-w]'); if (!b) return;
      if (b.dataset.w === 'skip' || (b.dataset.w === 'next' && i === steps.length - 1)) return close(page);
      i += b.dataset.w === 'next' ? 1 : -1; paint();
    });
    onKey = function (e) {
      if (e.key === 'Escape') close(page);
      if (e.key === 'ArrowRight' && i < steps.length - 1) { i++; paint(); }
      if (e.key === 'ArrowLeft' && i > 0) { i--; paint(); }
    };
    doc.addEventListener('keydown', onKey);
    global.addEventListener('resize', function () { if (layer) paint(); });
    paint();
    return true;
  }

  // the first visit only, and never under a test browser (the page tests click through the page itself)
  function offer(page, who) {
    if (seen(page) || (global.navigator && global.navigator.webdriver) || !who || !who.role) return false;
    return start(page, who);
  }

  global.GVC_WALK = { VERSION: VERSION, STEPS: STEPS, start: start, offer: offer, missing: missing,
    has: function (page) { return !!STEPS[page]; } };
})(window);
