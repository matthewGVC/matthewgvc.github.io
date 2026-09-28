/* ============================================================
   LISTING — what a listing says: its Word document and its money fields.

   Everything the Showsheet has to *interpret* lives here, apart from the
   page: reading the agent's .docx into facts, and turning free-text money
   ("$5,559/mo", "5,588", "$22,080/yr") into the figures the ledger prints.
   None of it touches the sheet's state or the DOM — read() returns facts and
   the page decides what to do with them — so it runs under plain Node:

     node scripts/test-listing.js

   blocksFromHtml() is the one browser-only function (it needs DOMParser).
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- money ---------------- */

  function blankish(v) {
    const t = String(v == null ? '' : v).trim();
    return !t || /^(-|–|—|n\/?a|none|tbd)$/i.test(t);
  }
  function moneyNum(s) {
    if (s == null) return null;
    const m = String(s).replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  }
  function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  /* a price that is nothing but a figure is printed with its commas; anything
     else ("Call for price") comes back exactly as typed */
  function displayPrice(s) {
    const n = moneyNum(s);
    if (n != null && /^[\s$\d,.]+$/.test(String(s).trim())) return fmtMoney(n);
    return s;
  }
  /* A bare figure, optionally with its period: "5,588", "5,588/mo", "$22,080 per year". */
  const BARE_MONEY = /^\s*\$?\s*\d[\d,]*(\.\d+)?\s*(\/\s*(mo|month|yr|year)\.?|per\s+(month|year)|monthly|annually|a\s+(month|year))?\s*$/i;
  /* The monthly figure in a free-text money field, or null.
     "$220.35/mo through July 2027" gives 220.35. The $ is optional when the
     field is nothing but a figure: requiring it meant real estate taxes typed as
     "5,588/mo" were silently left out of Est. Monthly Carrying — the sample
     listing printed $6,128 where the carrying cost is $11,716. Without a $, a
     number inside a sentence ("through July 2027") is not read as money.
     A yearly figure counts as a twelfth; a one-time or total amount is not a
     monthly cost and gives null. */
  function monthlyAmount(s) {
    if (blankish(s)) return null;
    const t = String(s).replace(/,/g, '');
    if (/one[\s-]?time|lump|in\s+full|\btotal\b/i.test(t)) return null;
    const m = t.match(/\$\s*(\d+(?:\.\d+)?)/) || (BARE_MONEY.test(s) && t.match(/(\d+(?:\.\d+)?)/));
    if (!m) return null;
    const n = parseFloat(m[1]);
    return /\/\s*(yr|year)|per\s+year|annual|yearly|a\s+year/i.test(t) ? n / 12 : n;
  }
  /* the ledger prints money as typed, but a bare figure gets its $ */
  function moneyText(s) {
    const t = String(s).trim();
    return BARE_MONEY.test(t) && !/^\$/.test(t) ? '$' + t : t;
  }
  /* Est. Monthly Carrying, and the names of what went into it — the footnote
     lists exactly those, so it never claims taxes or an assessment the total
     does not contain. Takes anything with the sheet's field names. */
  function carrying(s) {
    const items = [];
    const add = (v, what) => { const n = monthlyAmount(v); if (n) items.push({ n, what }); };
    if (s.ownership === 'co-op') add(s.maintenance, 'maintenance');
    else { add(s.commonCharges, 'common charges'); add(s.taxesMonthly, 'taxes'); }
    add(s.assessments, 'assessments');
    if (!items.length) return null;
    const names = items.map(i => i.what);
    const said = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names[0];
    return { total: items.reduce((x, i) => x + i.n, 0), what: said.charAt(0).toUpperCase() + said.slice(1) };
  }

  /* ---------------- the Word document ---------------- */

  /* mammoth's HTML, flattened to the only three things the reader cares
     about: table rows, list items and paragraphs, in document order */
  function blocksFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks = [];
    const flat = el => {
      for (const node of el.children) {
        const tag = node.tagName;
        if (tag === 'TABLE') {
          node.querySelectorAll('tr').forEach(tr => {
            blocks.push({ kind: 'row', cells: [...tr.querySelectorAll('td,th')].map(td => td.textContent.trim()) });
          });
        } else if (tag === 'UL' || tag === 'OL') {
          node.querySelectorAll('li').forEach(li => blocks.push({ kind: 'li', text: li.textContent.trim() }));
        } else if (tag === 'P' || /^H\d$/.test(tag)) {
          blocks.push({ kind: 'p', text: node.textContent.trim() });
        } else flat(node);
      }
    };
    flat(doc.body);
    return blocks;
  }

  const cleanLine = s => s.replace(/^[\s•·•\-–—]+/, '').replace(/\s+/g, ' ').trim();
  const normKey = s => s.toLowerCase().replace(/[^a-z]/g, '');
  // Word turns "80%" into "80 &" and "2.%" often enough to undo it
  const fixPct = v => v.replace(/(\d)\s*&(?=\s|$)/g, '$1%').replace(/(\d)\.\s*%/g, '$1%');
  /* near-identical lines (72% of their longer words shared) are one line */
  function dedupeLines(lines) {
    const seen = [], out = [];
    const tokens = s => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
    for (const ln of lines) {
      const t = tokens(ln);
      let dup = false;
      for (const prev of seen) {
        const inter = [...t].filter(x => prev.has(x)).length;
        const uni = new Set([...t, ...prev]).size;
        if (uni > 0 && inter / uni >= 0.72) { dup = true; break; }
      }
      if (!dup) { seen.push(t); out.push(ln); }
    }
    return out;
  }

  /* "555 West 59th Street - PHC": the first paragraph is the title; the last
     dash-separated part is the unit. */
  function titleOf(blocks) {
    const first = blocks.find(b => b.kind === 'p' && b.text);
    if (!first) return { address: '', unit: '', block: null };
    const m = first.text.split(/\s+[-–—]\s+/);
    return m.length >= 2
      ? { address: m.slice(0, -1).join(' - ').trim(), unit: m[m.length - 1].trim(), block: first }
      : { address: first.text.trim(), unit: '', block: first };
  }

  const LABELS = {
    price: 'price', cc: 'cc', maintenance: 'cc', maintenancecc: 'cc', commoncharges: 'cc',
    taxes: 'taxes', tax: 'taxes', maxfinancing: 'maxFinancing', financing: 'maxFinancing',
    assessments: 'assessments', assessment: 'assessments', fliptax: 'flipTax',
    capitalcontributions: 'capitalContributions', capitalcontribution: 'capitalContributions'
  };
  const BEDS_BATHS = /(\d+)\s*BD\s*\/?\s*(\d+(?:\.\d+)?)\s*BA/i;

  /* Everything the document states, as facts in the sheet's own field names.
     A field is present only when the document gave a value for it, so laying
     the result over a sheet never blanks what the agent already typed.

     ownershipNow is what the sheet says when the document names neither
     condo nor co-op: the single "Maintenance/CC" cell goes to maintenance on
     a co-op and to common charges otherwise. `found` names what was read, in
     document order, for the "Prefilled: …" message. */
  function read(blocks, ownershipNow) {
    const f = { building: {}, residence: {} }, found = [];
    const title = titleOf(blocks);
    if (title.address) { f.address = title.address; found.push('address'); }
    if (title.unit) { f.unit = title.unit; found.push('unit'); }

    // -------- table rows (label/value pairs, tolerant of flattened rows) --------
    let ccValue = null, taxesValue = null;
    const cells = [];
    blocks.filter(b => b.kind === 'row').forEach(r => cells.push(...r.cells));
    for (let i = 0; i < cells.length; i++) {
      const key = LABELS[normKey(cells[i])];
      if (!key) continue;
      // the value is the next cell that is not itself a label (one empty cell allowed)
      let val = '';
      for (let j = i + 1; j < cells.length; j++) {
        if (LABELS[normKey(cells[j])]) break;
        if (cells[j].trim()) { val = cells[j].trim(); break; }
        if (j > i + 1) break;
      }
      if (blankish(val)) continue;
      if (key === 'price') { f.price = val; found.push('price'); }
      else if (key === 'cc') ccValue = val;
      else if (key === 'taxes') taxesValue = val;
      else if (key === 'maxFinancing') { f.maxFinancing = fixPct(val); found.push('max financing'); }
      else if (key === 'assessments') { f.assessments = val; found.push('assessments'); }
      else if (key === 'flipTax') { f.flipTax = fixPct(val); found.push('flip tax'); }
      else if (key === 'capitalContributions') { f.capitalContributions = val; found.push('capital contribution'); }
    }

    // -------- feature sections --------
    let section = null;
    const interior = [], building = [];
    for (const b of blocks) {
      if (b.kind === 'row' || b === title.block) continue;
      const t = b.text || '';
      if (/interior\s+features/i.test(t)) { section = 'interior'; continue; }
      if (/building\s+features/i.test(t)) { section = 'building'; continue; }
      const ln = cleanLine(t);
      if (!ln) continue;
      if (section === 'interior') interior.push(ln);
      else if (section === 'building') building.push(ln);
    }
    const everything = [...interior, ...building].join(' \n ');

    // ownership — word-bounded, or "scoop" in a feature line would read as co-op
    const hasCondo = /\bcondo(minium)?\b/i.test(everything);
    const hasCoop = /\bco-?op(erative)?\b/i.test(everything);
    if (hasCoop && !hasCondo) f.ownership = 'co-op';
    else if (hasCondo && !hasCoop) f.ownership = 'condo';
    if (hasCoop || hasCondo) found.push('ownership');
    const ownership = f.ownership || ownershipNow;
    if (ccValue) {
      if (ownership === 'condo') { f.commonCharges = ccValue; found.push('common charges'); }
      else { f.maintenance = ccValue; found.push('maintenance'); }
    }
    // a co-op's taxes are inside its maintenance
    if (taxesValue && ownership === 'condo') { f.taxesMonthly = taxesValue; found.push('taxes'); }

    const bb = everything.match(BEDS_BATHS);
    if (bb) { f.beds = bb[1]; f.baths = bb[2]; found.push('beds/baths'); }

    // -------- building lines → structured --------
    const claimed = new Set();
    for (const ln of building) {
      let m;
      if ((m = ln.match(/^built\s+(.+)/i))) {
        f.building.builtYear = m[1].replace(/\s*,\s*/g, ', ').trim(); claimed.add(ln); found.push('built');
      } else if ((m = ln.match(/(\d+)\s*floors?\s*\/\s*(\d+)\s*units?/i))) {
        f.building.stories = m[1]; f.building.residences = m[2]; claimed.add(ln); found.push('stories/residences');
      }
    }
    const svc = building.filter(ln => !claimed.has(ln) && /(full[\s-]?service|doorman|concierge|door staff|attended lobby|resident manager|superintendent)/i.test(ln));
    if (svc.length) {
      f.building.service = svc.slice(0, 2).map(s => s.replace(/\s*(cooperative|coop|co-op|condominium|condo|building)\s*$/i, '').trim()).filter(Boolean).join(' · ');
      svc.slice(0, 2).forEach(l => claimed.add(l));
      found.push('service');
    }
    const pol = building.filter(ln => !claimed.has(ln) && /(pied|pets?\b|sublet|guarantor|co-?purchas|gifting|washer\/?dryer allowed)/i.test(ln));
    if (pol.length) {
      f.building.policy = pol.map(s => s.trim()).join(' · ');
      pol.forEach(l => claimed.add(l));
      found.push('policies');
    }
    const amen = dedupeLines(building.filter(ln => !claimed.has(ln)));
    if (amen.length) { f.building.amenities = amen; found.push('amenities'); }

    // -------- interior lines → residence --------
    /* A first line that only restates the beds, baths and ownership ("4BD /
       4BA Condominium") is already on the sheet in the stat strip and the
       ownership chip, so it is not repeated as a bullet. It used to go further:
       any first line mentioning a penthouse, a duplex, a loft or prewar was
       moved into a field nothing ever printed, and simply vanished. */
    const rclaimed = new Set();
    const first = interior[0] || '';
    const leftover = first.replace(BEDS_BATHS, '')
      .replace(/\b(condominium|condo|co-?op(erative)?|residence|apartment|home|unit)\b/gi, '').replace(/[^a-z0-9]/gi, '');
    if (first && BEDS_BATHS.test(first) && !leftover) rclaimed.add(first);
    const grab = re => interior.find(x => !rclaimed.has(x) && re.test(x)) || '';
    [['exposures', /exposure|facing\b|northern|southern|eastern|western light/i],
     ['outdoor', /terrace|balcon|private garden|roof rights|outdoor space/i],
     ['ceiling', /ceiling/i],
     ['climate', /air.?condition|central air|central heat|hvac|mini.?split|heating/i]].forEach(([key, re]) => {
      const ln = grab(re);
      if (ln) { f.residence[key] = ln; rclaimed.add(ln); }
    });
    const feats = dedupeLines(interior.filter(x => !rclaimed.has(x)));
    if (feats.length) { f.residence.features = feats; found.push('features'); }

    f.found = [...new Set(found)];
    return f;
  }

  const api = { blankish, moneyNum, fmtMoney, displayPrice, BARE_MONEY, monthlyAmount, moneyText, carrying,
                blocksFromHtml, titleOf, read, dedupeLines, fixPct };
  global.GVC_LISTING = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
