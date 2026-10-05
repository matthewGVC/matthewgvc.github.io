/* ============================================================
   GVC PITCH DECKS — shared behaviour
   Paired with assets/css/pitch.css. Used by the Seller Pitch & CMA
   and the Buyer Package.

   Everything here is deck-agnostic: page furniture, the cover, agent
   cards, the roster picker, image drops, money formatting and the
   overflow warnings. Each deck supplies its own page list and its own
   editor fields.
   ============================================================ */
(function (global) {
  'use strict';

  const MONO = '../../assets/logos/monogram-white.svg';
  const MONO_NAVY = '../../assets/logos/monogram.svg';

  /* ---------- text ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
    ));
  }
  function lines(s) { return esc(s).replace(/\n/g, '<br>'); }

  /* ---------- money ---------- */
  /* A price as typed: "$8.95M" and "1.2 million" are what agents write, and
     stripping everything but digits read them as $9 and $1. */
  function amount(v) {
    const s = String(v);
    let n = Number(s.replace(/[^0-9.\-]/g, ''));
    const suf = s.replace(/,/g, '').match(/[\d.]\s*(million|mm|m|thousand|k)\b/i);
    if (suf) n *= /^(k|thousand)$/i.test(suf[1]) ? 1e3 : 1e6;
    return n;
  }
  function money(v) {
    const n = amount(v);
    if (!isFinite(n) || !n) return '';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function moneyShort(v) {
    const n = amount(v);
    if (!isFinite(n) || !n) return '';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 2).replace(/\.00$/, '') + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function num(v) {
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  /* ---------- page furniture ---------- */
  function heading(title) {
    return '<div class="pg-h"><h2>' + esc(title) + '</h2></div>';
  }
  /* Footer: site left, monogram dead-center, page number bottom right.
     The monogram is centered against the full footer width regardless of
     how long the site text or page number run, so it stays put page to page. */
  function foot(site, reversed, n, of) {
    return '<div class="pg-foot"><span class="site">' + esc(site || '') + '</span>' +
           '<img class="pg-mono" src="' + (reversed ? MONO : MONO_NAVY) + '" alt="">' +
           '<span class="pg-n">' + n + ' / ' + of + '</span></div>';
  }

  /* Standard interior page: title, body, footer.
     `key` lands on the wrapper so overflow rules can name a page and give
     a specific warning rather than a generic "something is too tall". */
  function page(o) {
    return '<div class="pg' + (o.reversed ? ' rev' : '') + (o.cls ? ' ' + esc(o.cls) : '') + '"' +
             (o.key ? ' data-key="' + esc(o.key) + '"' : '') + '>' +
      heading(o.title) +
      '<div class="pg-body">' + o.body + '</div>' +
      foot(o.site, o.reversed, o.n, o.of) +
    '</div>';
  }

  /* ---------- the framed cover ----------
     The cover both packages front with, described in full in pitch.css
     under "framed cover": a tracked caps line, a title set to fill the
     measure, a framed photo, a second caps line and the lifted band
     underneath. A deck supplies the three text runs and the photo; nothing
     else about it varies, which is why the band is a constant here. */
  const COVER_BAND = '../../assets/img/cover-band.png';

  function frameCover(o) {
    return '<div class="fcv">' +
      '<div class="fcv-kick">' + esc(o.kicker) + '</div>' +
      '<div class="fcv-ttl">' + esc(o.title) + '</div>' +
      '<div class="fcv-ph" data-drop="cover"' + (o.image ? ' data-pos="cover"' : '') + '>' +
        (o.image ? '<img src="' + o.image + '" alt="" style="object-position:' +
                     (o.pos ? o.pos.x : 50) + '% ' + (o.pos ? o.pos.y : 50) + '%">'
                 : '<div class="empty-note">Drag a photo here<br>from the Photos panel</div>') +
      '</div>' +
      '<div class="fcv-foot">' + esc(o.foot) + '</div>' +
      '<img class="fcv-band" src="' + COVER_BAND + '" alt="">' +
    '</div>';
  }

  /* All three runs on the framed cover are set to the width of the measure
     the way they are in the artwork, where BUYER'S GUIDE runs margin to
     margin. Rather than pick a size and hope, each one is measured after it
     renders and scaled to fit: the artwork's own size is the ceiling, so
     text no longer than the drawn text never grows past it, and longer text
     — a street address for the title, a long client name on the bottom line
     — steps down in size instead of wrapping. None of them can wrap: the
     title would run into the photo and the bottom line into the band.

     The title's measure is the printed INK width of the drawn title,
     523.2pt from the B to the E, not the 523pt gap between the margins:
     Chrome and Illustrator disagree slightly on Playfair's side bearings,
     so matching the advance width leaves the letters a hair narrow.
     Measured off the artwork at 150dpi. The two caps runs are plain
     Nunito Sans and sit on the margins, so theirs is the 523pt gap.

     Every deck calls this from its own post-render check, and again once
     document.fonts has settled: measured before layout the type reads zero
     wide, and measured before the webfont has loaded it measures the
     fallback face instead. */
  const COV_MAX = 69.26, COV_MEASURE = 527.3;   /* the title */
  const CAPS_MAX = 16,   CAPS_MEASURE = 523;    /* the kicker and the foot */

  /* The rendered width of the text itself, in pt. A Range over the contents
     rather than scrollWidth, which reports the width of the BOX whenever
     the text is narrower than it — that would read every short run as a
     full measure and shrink type that already fits. */
  function inkWidth(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    /* px on a canvas where 1in = 96px, so pt = px * 72/96 */
    return r.getBoundingClientRect().width * 0.75;
  }
  function fitRun(sel, max, measure) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.fontSize = max + 'pt';
    const w = inkWidth(el);
    if (w > measure) el.style.fontSize = (max * measure / w) + 'pt';
  }
  function fitCover() {
    fitRun('.fcv-ttl',  COV_MAX,  COV_MEASURE);
    fitRun('.fcv-kick', CAPS_MAX, CAPS_MEASURE);
    fitRun('.fcv-foot', CAPS_MAX, CAPS_MEASURE);
  }

  /* Closing-page agent cards. One solid box per agent holding the cutout
     and every detail that belongs to them — name, title, phone, email —
     rather than the box holding the photo and the details floating loose
     underneath it. Every deck's closing page calls this. */
  /* The phone lines for one agent. With both an office and a mobile number
     each is labelled o: / m:, because two bare numbers in a row say nothing
     about which is which. With only one the label is noise, so the number
     prints bare — which is every agent whose `mobile` is still blank in the
     roster. */
  function phoneLines(a) {
    var o = a.phone && String(a.phone).trim();
    var m = a.mobile && String(a.mobile).trim();
    if (o && m) {
      return '<span class="num"><b>o:</b> ' + esc(o) + '</span>' +
             '<span class="num"><b>m:</b> ' + esc(m) + '</span>';
    }
    var one = o || m;
    return one ? '<span class="num">' + esc(one) + '</span>' : '';
  }

  function agentCards(list, headshotFor) {
    if (!list.length) {
      return '<div class="ag-row"><div class="ag-c"><div class="shot">' +
             '<div class="empty-note on-white">Pick an agent<br>in the Agents panel</div></div></div></div>';
    }
    /* A lone agent gets the wide card: the cutout stands on the page at full
       size and the panel overlaps its foot, so the page reads as being about
       that person rather than as half of a missing pair. Two or more keep the
       paired columns — the wide card twice over would not fit the width. */
    var solo = list.length === 1 ? ' solo' : '';
    return '<div class="ag-row' + solo + '">' + list.map(a =>
      '<div class="ag-c' + solo + '">' +
        '<div class="shot"><img src="' + headshotFor(a) + '" alt=""></div>' +
        '<div class="ag-meta">' +
          '<div class="nm">' + esc(a.name) + '</div>' +
          (a.title ? '<div class="tt">' + esc(a.title) + '</div>' : '') +
          '<div class="ct">' +
            '<div class="nums">' + phoneLines(a) + '</div>' +
            (a.email ? '<span class="em">' + esc(a.email) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>').join('') + '</div>';
  }

  /* ---------- closing-page contact columns ----------
     Each row is marked with the platform's own glyph rather than a
     two-letter monogram. Anything without a mark of its own falls back to
     a generic link glyph, so a row the team invents later still lines up
     with the rest instead of losing its left edge. */
  const LINK_ICONS = {
    instagram:'instagram', youtube:'youtube', linkedin:'linkedin',
    facebook:'facebook', x:'twitter', twitter:'twitter',
    'our listings':'home', 'douglas elliman':'building',
    'market reports':'chart', 'book a call':'calendar',
    website:'globe', email:'mail', phone:'phone'
  };
  function linkIcon(label) {
    const name = LINK_ICONS[String(label || '').trim().toLowerCase()] || 'link';
    return global.icon ? global.icon(name) : '';
  }
  /* cols: [[heading, [[label, value], ...]], ...]

     A row may name its own glyph as a third element. That is for rows whose
     label is not the platform — an agent's own Instagram is labelled with
     their name, and should still be marked with the Instagram glyph rather
     than falling back to the generic link one. */
  function linkCols(cols) {
    return '<div class="lcols">' + cols.map(c =>
      '<div class="lcol"><div class="lcol-t">' + esc(c[0]) + '</div>' + c[1].map(r =>
        '<div class="lrow"><span class="lb">' + linkIcon(r[2] || r[0]) + '</span>' +
        '<span class="ltxt"><span class="lk">' + esc(r[0]) + '</span>' +
        '<span class="lv">' + esc(r[1]) + '</span></span></div>').join('') +
      '</div>').join('') + '</div>';
  }

  /* ---------- table of contents ---------- */
  function toc(entries) {
    return '<ol class="toc">' + entries.map(e =>
      '<li><span class="n">' + String(e.page).padStart(2, '0') + '</span>' +
      '<span class="t">' + esc(e.title) + '</span>' +
      '<span class="d"></span><span class="p">' + e.page + '</span></li>').join('') + '</ol>';
  }

  /* ---------- overflow warnings ----------
     Content that runs past its box is silently clipped by overflow:hidden,
     so each deck registers the selectors that must not overflow and gets a
     plain-English warning instead of a surprise at the printer.
     Note the scrollWidth check: multi-column blocks overflow sideways, so
     scrollHeight alone never grows. */
  function overflowing(el) {
    return !!el && (el.scrollHeight > el.clientHeight + 1 ||
                    el.scrollWidth  > el.clientWidth  + 1);
  }
  /* rules: [{ key, msg, box }] -- `key` is a page key set by page(), `box`
     the id of the warning element in the editor. Anything overflowing that
     has no rule falls back to `fallback`. */
  function checkOverflow(root, rules, fallback) {
    const bucket = {};
    const add = (box, msg) => {
      if (!box) return;
      (bucket[box] = bucket[box] || []).indexOf(msg) === -1 && bucket[box].push(msg);
    };
    const seen = {};
    rules.forEach(r => { seen[r.key] = 1; });

    root.querySelectorAll('.pg[data-key]').forEach(pg => {
      const body = pg.querySelector('.pg-body');
      if (!overflowing(body) && !overflowing(pg)) return;
      const key = pg.dataset.key;
      const rule = rules.filter(r => r.key === key)[0];
      if (rule) add(rule.box, rule.msg);
      else if (fallback) add(fallback, 'Page ' + (pg.dataset.n || '') +
        ' has more content than fits. Trim it, or it will be cut off in print.');
    });

    const boxes = {};
    rules.forEach(r => { boxes[r.box] = 1; });
    if (fallback) boxes[fallback] = 1;
    Object.keys(boxes).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const msgs = bucket[id] || [];
      el.innerHTML = msgs.map(m => '<div class="warn-item">' + esc(m) + '</div>').join('');
      el.hidden = !msgs.length;
    });
  }

  /* ---------- image drop ----------
     Reads straight to a data URL: nothing is uploaded, and the printed
     PDF stays self-contained. */
  function wireDrop(box, input, onFiles) {
    if (!box) return;
    const take = files => {
      const imgs = [...files].filter(f => /^image\//.test(f.type));
      if (!imgs.length) return;
      let pending = imgs.length;
      const outs = new Array(imgs.length);
      imgs.forEach((f, i) => {
        const r = new FileReader();
        r.onload = e => {
          outs[i] = { name: f.name, url: e.target.result };
          if (--pending === 0) onFiles(outs.filter(Boolean));
        };
        r.readAsDataURL(f);
      });
    };
    box.addEventListener('click', () => input && input.click());
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('over'); });
    box.addEventListener('dragleave', () => box.classList.remove('over'));
    box.addEventListener('drop', e => {
      e.preventDefault(); box.classList.remove('over');
      take(e.dataTransfer.files);
    });
    if (input) input.addEventListener('change', () => { take(input.files); input.value = ''; });
  }

  /* ---------- photo roles ----------
     Same idea as the brochure: every photo has a role. 'auto' lets the deck
     fill slots in order; anything else is an explicit pin that the auto
     pass will not touch or steal. 'exclude' keeps a photo out entirely. */
  function assignRoles(photos, slots) {
    const res = {}, taken = {};
    photos.forEach(p => {
      const r = p.role;
      if (!r || r === 'auto') return;
      taken[p.id] = 1;
      if (r !== 'exclude' && !res[r]) res[r] = p;
    });
    const pool = photos.filter(p => !taken[p.id]);
    slots.forEach(s => { if (!res[s] && pool.length) res[s] = pool.shift(); });
    res._spare = pool;
    return res;
  }

  /* Where a photo currently sits, as the tray badge shows it. 'pinned' means
     the agent put it there by hand; 'used' means the auto pass did, and it can
     still be stolen by a later pin. Both decks have the same shape, so this is
     shared rather than written twice. */
  function placementOf(img, assign, roles) {
    if (img.role === 'exclude') return { text: 'Unused', cls: '' };
    var hit = Object.keys(assign).filter(function (k) {
      return k !== '_spare' && assign[k] === img;
    })[0];
    if (!hit) return { text: 'Unused', cls: '' };
    var row = roles.filter(function (r) { return r[0] === hit; })[0];
    return { text: row ? row[1] : hit, cls: img.role === hit ? 'pinned' : 'used' };
  }

  /* ---------- comparable sales editor ----------
     One row per comp: address, sold price, sq ft, bed/bath, date — the same
     five fields the Seller Pitch's CMA and the Buyer Package both print, and
     the same shape in both, which is why they can share a property's comps.
     `host` is the list container, `comps` the array to edit in place. */
  function compsEditor(host, comps, onChange) {
    host.innerHTML = '';
    comps.forEach(function (c, i) {
      var wrap = document.createElement('div');
      wrap.className = 'rw';
      var mk = function (ph, key, w) {
        var inp = document.createElement('input');
        inp.type = 'text'; inp.placeholder = ph; inp.value = c[key] || '';
        if (w) inp.style.flex = '0 0 ' + w;
        inp.addEventListener('input', function () { c[key] = inp.value; onChange(); });
        return inp;
      };
      wrap.appendChild(mk('Address', 'address'));
      wrap.appendChild(mk('Sold $', 'price', '68px'));
      wrap.appendChild(mk('Sq ft', 'sqft', '52px'));
      wrap.appendChild(mk('Bd/Ba', 'bb', '52px'));
      wrap.appendChild(mk('Date', 'date', '58px'));
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'x'; x.textContent = '×';
      x.title = 'Remove this comp';
      x.addEventListener('click', function () {
        comps.splice(i, 1);
        compsEditor(host, comps, onChange);
        onChange();
      });
      wrap.appendChild(x);
      host.appendChild(wrap);
    });
  }

  function blankComp() { return { address:'', price:'', sqft:'', bb:'', date:'' }; }

  /* ---------- editor: segmented pick ----------
     The <div class="seg pick"> markup with one button per choice, each
     carrying a data-<attr>. `get` returns the current value as a string,
     `set` is handed the clicked one. Returns a repaint function, so a
     builder can re-sync the buttons after loading a saved property rather
     than leaving them showing the last document's answer. */
  function segPick(host, attr, get, set) {
    if (!host) return function () {};
    const btns = [].slice.call(host.querySelectorAll('button'));
    const paint = () => btns.forEach(b => b.classList.toggle('on', b.dataset[attr] === String(get())));
    btns.forEach(b => b.addEventListener('click', () => { set(b.dataset[attr]); paint(); }));
    paint();
    return paint;
  }

  /* ---------- editor: tick list ----------
     A column of checkboxes for choosing what a package prints — which
     optional pages, and which town tearsheets. `items` is [[value, label,
     sub]]; `isOn` reads and `toggle` writes wherever the builder keeps the
     answer, so this holds no state of its own. Returns a repaint function.

     The label is set as text, not markup: a town name or a page title is
     data, and this is the one place a stray '<' would end up in the DOM. */
  function tickList(host, items, isOn, toggle) {
    if (!host) return function () {};
    host.className = 'ticks';
    host.replaceChildren();
    const boxes = items.map(it => {
      const lab = document.createElement('label');
      lab.className = 'tick';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      const txt = document.createElement('span');
      const b = document.createElement('b'); b.textContent = it[1]; txt.appendChild(b);
      if (it[2]) { const i = document.createElement('i'); i.textContent = it[2]; txt.appendChild(i); }
      lab.append(cb, txt);
      cb.addEventListener('change', () => toggle(it[0], cb.checked));
      host.appendChild(lab);
      return [it[0], cb];
    });
    const paint = () => boxes.forEach(([value, cb]) => { cb.checked = !!isOn(value); });
    paint();
    return paint;
  }


  /* ============================================================
     THE EDITORIAL CLOSING PAGE

     The last page of the Brochure and the Buyer Package: an asymmetric
     composition — the lockup and the team QR on a header line, the sign-off
     under it, then one row per agent whose cut-out stands in a rail down the
     left with their details hung beside it, and three footer columns.

     It lives here so the two decks cannot drift apart. Its styles are the
     EDITORIAL CLOSING PAGE section of assets/css/pitch.css, mirrored in
     tools/brochure/index.html because that deck cannot load pitch.css (its
     own .stat/.ph/.band would collide). Change one, change the other.

     The older centred-card close — agentCards() + linkCols() + .cx-top — is
     still what the Seller Pitch & CMA prints, so both designs live in this
     file. They share no class names.
     ============================================================ */

  const LOCKUP = '<svg class="lk" viewBox="184.4 730.6 1675.8 514.7" ' +
    'role="img" aria-label="The Gasdaska Verdiglione Conlon Team"><g> <g> <path fill="currentColor" d="M345.28,1004.67l-2.31-6.72c13.84-5.65,28.91-8.66,44.34-8.66,9.66,0,18.85.9,27.37,2.49,2.7.51,5.33,1.08,7.89,1.71,10.54,2.61,19.83,6.28,27.45,10.53l-8.83,47.99-4.13-.59c-3.06-18.97-10.25-33.02-20.23-42.36-2.06-1.93-4.23-3.65-6.51-5.18-8.99-6.03-19.65-8.98-31.26-8.98-12.27,0-23.76,3.34-33.79,9.78Z"/> <path fill="currentColor" d="M444.13,1150.64l3.24,1.18c-12.08,28.55-34.45,52.11-74.49,52.11-56.24,0-98.04-46.22-98.04-104.52,0-31.75,12.31-58.36,31.62-77.47l8.55,23.88c-4.43,12.86-6.9,28.04-6.9,45.35,0,58,30.91,92.45,74.78,92.45,28.85,0,50.35-15.31,61.24-32.98Z"/> </g> <path fill="currentColor" d="M400.45,1005.54l-44.16,119.22c-.18.49-.64.81-1.16.81h-3.58c-.52,0-.99-.33-1.17-.82l-62.22-173.17c-7.73-21.47-19.07-30.16-30.79-32-.61-.1-1.06-.61-1.06-1.22v-.34c0-.68.55-1.24,1.24-1.24h75.08c.68,0,1.24.55,1.24,1.24v.2c0,.68-.55,1.22-1.22,1.24-15.29.4-20.73,8.43-14.41,26.82l46.63,134.71c.38,1.1,1.94,1.11,2.34.02l28.04-77.44"/> <path fill="currentColor" d="M402.43,983.7l5.76-15.9c11-30.97.41-47.74-20.9-48.35-.67-.02-1.22-.56-1.22-1.23v-.2c0-.68.55-1.24,1.24-1.24h68.36v2.65c-17.1,1.47-30.37,18.87-40.7,46.89l-6.67,18.02"/> <path fill="currentColor" d="M398.1,879.53h-80.98c-.69,0-1.24.55-1.24,1.24h0c0,.64.47,1.17,1.09,1.24,11.61,1.4,30.16,6.93,30.16,24.65v33.04c0,12.28-5.27,21.77-14.82,27.37l2.53,7.35c15.59-3.51,29.56-9.26,39.66-14.62.41-.22.65-.63.65-1.09v-52.05c0-17.78,10.03-23.28,23.07-24.66.63-.07,1.11-.6,1.11-1.23,0-.69-.55-1.24-1.24-1.24ZM228.74,852.28c3.65-50.1,30.6-85.41,73.29-85.41,31.31,0,53.62,20.92,60.88,58.41.1.52.52.92,1.03.99l2.08.3c.66.09,1.27-.35,1.39-1.01l8.49-48.37c.09-.52-.15-1.06-.62-1.31-12.95-6.93-38.73-13.73-67.05-13.73-64.29,0-113.83,44.24-113.83,108.23,0,52.96,38.61,98.97,95.88,106.32l-2.49-6.96c-35.77-10.85-59.48-50.58-59.48-105.55,0-1.79.03-3.57.08-5.33.07-2.22.19-4.42.35-6.58Z"/> </g> <text fill="currentColor" style="font-family:NunitoSans-Black,\'Nunito Sans\';font-variation-settings:\'wght\' 900,\'wdth\' 100,\'opsz\' 12,\'YTLC\' 500;font-weight:800;font-size:172.4px;letter-spacing:.05em" transform="translate(510.09 1046.5)"><tspan x="0" y="0">VERDIGLIONE</tspan></text> <g> <text fill="currentColor" style="font-family:NunitoSans-Black,\'Nunito Sans\';font-variation-settings:\'wght\' 900,\'wdth\' 100,\'opsz\' 12,\'YTLC\' 500;font-weight:800;font-size:172.4px;letter-spacing:.05em" transform="translate(743.49 894.85)"><tspan x="0" y="0">GASDASKA</tspan></text> <text fill="currentColor" style="font-family:NunitoSans-Black,\'Nunito Sans\';font-variation-settings:\'wght\' 900,\'wdth\' 100,\'opsz\' 12,\'YTLC\' 500;font-weight:800;font-size:104.36px;letter-spacing:.05em" transform="translate(491.49 894.85)"><tspan x="0" y="0">THE</tspan></text> </g> <text fill="currentColor" style="font-family:NunitoSans-Black,\'Nunito Sans\';font-variation-settings:\'wght\' 900,\'wdth\' 100,\'opsz\' 12,\'YTLC\' 500;font-weight:800;font-size:172.4px;letter-spacing:.05em" transform="translate(585.91 1198.16)"><tspan x="0" y="0">CONLON</tspan></text> <text fill="currentColor" style="font-family:NunitoSans-Black,\'Nunito Sans\';font-variation-settings:\'wght\' 900,\'wdth\' 100,\'opsz\' 12,\'YTLC\' 500;font-weight:800;font-size:104.36px;letter-spacing:.05em" transform="translate(1400.29 1154.94)"><tspan x="0" y="0">TEAM</tspan></text></svg>';

  /* The states on every closing page, in the order they print. */
  const STATES = [
    ['New York',   '../../assets/img/states/new-york.svg'],
    ['New Jersey', '../../assets/img/states/new-jersey.svg'],
    ['Florida',    '../../assets/img/states/florida.svg']
  ];

  /* The team's own accounts. Not editable in any deck, so the handles can
     never be typed wrong on a client's copy. */
  const TEAM_SOCIAL = [
    ['Instagram', '@gvcrealestateteam'],
    ['YouTube',   '@gvcrealestateteam'],
    ['LinkedIn',  'The GVC Real Estate Team']
  ];
  const TEAM_LINKS = [
    ['Our listings',    'gvcrealestateteam.com/listings'],
    ['Douglas Elliman', 'elliman.com'],
    ['Book a call',     'gvcrealestateteam.com/contact']
  ];

  /* The Social column: the team's accounts, then one row per agent on this
     page who has a handle. Labelled with the agent's name — a second row
     just saying "Instagram" would not say whose it is — and marked with the
     Instagram glyph via the row's third element.

     An agent with no handle in the roster is skipped, so this is opt-in: no
     account reaches a client-facing page unless it has been filled in. */
  function socialRows(agents) {
    return TEAM_SOCIAL.concat((agents || [])
      .filter(a => a && String(a.instagram || '').trim())
      .map(a => [a.name, String(a.instagram).trim(), 'instagram']));
  }

  /* One editorial row per agent: the cut-out bleeds off the left trim, the
     details hang in the column beside it. phoneLines() is not reused here —
     this row labels its fields Tel / Mobile / Email down a keyed column
     instead of setting o: / m: inline. */
  function agentRow(a, headshotFor) {
    const rows = [];
    const office = String(a.phone || '').trim();
    const mobile = String(a.mobile || '').trim();
    if (office) rows.push(['Tel', office, true]);
    if (mobile) rows.push(['Mobile', mobile, true]);
    if (a.email) rows.push(['Email', String(a.email).trim(), false]);
    return '<div class="ag-person">' +
      '<div class="ag-shot"><img src="' + esc(headshotFor(a)) + '" alt=""></div>' +
      '<div class="ag-who">' +
        '<div class="nm">' + esc(a.name) + '</div>' +
        '<div class="tt">' + esc(a.title) + '</div>' +
        '<div class="ct">' + rows.map(([k, v, n]) =>
          '<div><span class="k">' + esc(k) + '</span>' +
          '<span class="v' + (n ? ' num' : '') + '">' + esc(v) + '</span></div>').join('') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Social / Links / Licensed in. */
  function agentCol(title, rows) {
    return '<div class="ag-col"><div class="ag-col-t">' + esc(title) + '</div>' +
      rows.map(([k, v]) =>
        '<div class="ag-lrow"><span class="lk">' + esc(k) + '</span>' +
        '<span class="lv">' + esc(v) + '</span></div>').join('') +
    '</div>';
  }

  /* The whole page, footer included.
       agents       roster entries on this page
       headshotFor  how the deck resolves a cut-out
       qr           QR markup for the header, already rendered
       qrCap        its caption
       legal        the GVC_LEGAL block for this deck
       licensedLabel optional heading for the states column (default "Licensed in")
       referral     optional markup set beside "Thank you." (the Buyer's Guide's
                    "know someone moving?" line); omitted by the Brochure
       foot         the running page footer
     `.solo` widens the rail and steps the sign-off down to match — one class
     on the page root so the geometry moves together. */
  function closingPage(o) {
    const list = o.agents || [];
    const people = list.length
      ? list.map(a => agentRow(a, o.headshotFor)).join('')
      : '<div class="ag-person"><div class="ag-who">' +
        '<div class="empty-note" style="position:static">Pick an agent in the Agents panel</div>' +
        '</div></div>';
    return '<div class="ag' + (list.length === 1 ? ' solo' : '') + '">' +
      '<div class="ag-body">' +
        '<div class="ag-hdr">' +
          LOCKUP +
          (o.qr ? '<div class="ag-qr"><div class="qbox">' + o.qr + '</div>' +
                  '<div class="qcap">' + esc(o.qrCap || '') + '</div></div>' : '') +
        '</div>' +
        '<div class="ag-hero"><div class="say"><h2>Thank <em>you</em>.</h2></div>' +
          (o.referral || '') + '</div>' +
        '<div class="ag-people">' + people + '</div>' +
        '<div class="ag-foot">' +
          agentCol('Social', socialRows(list)) +
          agentCol('Links', TEAM_LINKS) +
          '<div class="ag-col"><div class="ag-col-t">' + esc(o.licensedLabel || 'Licensed in') + '</div>' +
            STATES.map(([nm, art]) =>
              '<div class="ag-st"><i style="-webkit-mask-image:url(' + art +
                ');mask-image:url(' + art + ')"></i><span>' + esc(nm) + '</span></div>').join('') +
          '</div>' +
        '</div>' +
        (o.legal || '') +
      '</div>' +
      (o.foot || '') +
    '</div>';
  }

  /* ---------- roster picker ----------
     One implementation for the whole site, in roster.js. This stays as a
     thin wrapper so the packages keep their existing call signature. */
  function wireRoster(host, state, max, redraw) {
    return global.GVC_PICKER(host, state, { max: max, onChange: redraw });
  }

  function agentsOf(state) {
    return state.agents.map(id => global.GVC_AGENT(id)).filter(Boolean);
  }

  global.Pitch = {
    MONO, MONO_NAVY,
    esc, lines, money, moneyShort, num,
    page, frameCover, fitCover, heading, foot, toc, agentCards,
    linkCols, linkIcon,
    checkOverflow, overflowing, wireDrop, wireRoster, agentsOf,
    LOCKUP, STATES, TEAM_SOCIAL, TEAM_LINKS,
    socialRows, agentRow, agentCol, closingPage,
    assignRoles, placementOf, compsEditor, blankComp,
    segPick, tickList
  };
})(window);
