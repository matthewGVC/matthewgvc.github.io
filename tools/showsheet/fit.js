/* ============================================================
   tools/showsheet/fit.js: fitting the sheet: type that scales to fill its
   space, the per-section Text & floorplan size on top of it, the floorplan
   pair, and render(). Third of the eight scripts (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   TEXT AUTOFIT — type scales so content fills its allotted space
   ============================================================ */
/* Every autofit on the sheet is this one search: the largest value in
   [lo, hi] at which ok() holds. hi is tried first; failing that the range is
   halved `steps` times, with lo assumed to hold (and used when nothing larger
   does). set(v) applies each candidate before it is tested, and the answer is
   left applied. The sheet used to spell this loop out six times over. */
function largest(lo, hi, set, ok, steps){
  set(hi);
  if(ok()) return hi;
  for(let k=0;k<steps;k++){ const m = (lo+hi)/2; set(m); if(ok()) lo = m; else hi = m; }
  set(lo);
  return lo;
}
const setFont = el => pt => { el.style.fontSize = pt.toFixed(2) + 'pt'; };
function fitBlock(el, minPt, maxPt){
  // largest container font-size where nothing overflows (children scale in em);
  // returns the size it settled on, in pt
  if(!el) return null;
  return largest(minPt, maxPt, setFont(el),
    () => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1, 7);
}
function fitHeading(el, minPt, maxPt){
  // one-line heading sized to fill its column; wraps only if the minimum still overflows.
  // Returns the size it settled on, in pt.
  if(!el) return null;
  el.style.whiteSpace = 'nowrap';
  const avail = el.clientWidth;
  const pt = largest(minPt, maxPt, setFont(el), () => el.scrollWidth <= avail, 7);
  if(el.scrollWidth > avail) el.style.whiteSpace = 'normal';
  return pt;
}

/* ============================================================
   MANUAL TEXT SIZE — per section, on top of the autofit.

   The autofit still decides every size first, exactly as it always has; a
   section's percentage then scales the size it picked. So 100% is today's
   sheet, and 90% stays "a little smaller than it would be" as the text
   changes, rather than pinning a point size that stops fitting the moment a
   feature is added.

   Smaller always fits. Bigger is honoured only as far as the section still
   fits its space — the largest multiplier up to the one asked for — and the
   panel says when it had to stop short. Growing text never trims content.
   ============================================================ */
const TEXT_SECTIONS = [
  // probe: the text whose size the panel reports
  {key:'address',   label:'Address',          side:'Front', sel:'.addr, .unit-lt, .b-head .ba', probe:'#sheetFront .addr'},
  {key:'price',     label:'Asking price',     side:'Front', sel:'.ft-r',     probe:'#sheetFront .ft-r .av'},
  {key:'lede',      label:'Positioning line', side:'Front', sel:'.f-lede',   probe:'#sheetFront .f-lede'},
  {key:'stats',     label:'Beds & baths',     side:'Front', sel:'.strip',    probe:'#sheetFront .scell'},
  {key:'residence', label:'The Residence',    side:'Front', sel:'.res-fit',  probe:'#sheetFront .res-fit'},
  {key:'building',  label:'The Building',     side:'Front', sel:'.bld-fit',  probe:'#sheetFront .bld-fit'},
  {key:'numbers',   label:'The Numbers',      side:'Back',  sel:'.num-fit',  probe:'#sheetBack .num-fit'},
  {key:'agents',    label:'Agents',           side:'Back',  sel:'.ag-cards', probe:'#sheetBack .ag-card .ac'},
];
/* up to double: a request past what fits still stops at the largest size that does */
const TS_MIN = 70, TS_MAX = 200, TS_STEP = 5;
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function textPct(key){
  const v = Math.round(Number(state.textScale && state.textScale[key]));
  return Number.isFinite(v) && v ? clampN(v, TS_MIN, TS_MAX) : 100;
}
const textK = key => textPct(key) / 100;
/* The floorplan sits in the same panel, as one more back-page row. It sizes
   the plan as printed: 100% is what the sheet shows on its own. Growing it
   takes width from The Numbers and, for a plan that is short of height, takes
   height from the agent headshots. It stops where the ledger would no longer
   fit at its smallest or the headshots are as small as they go; smaller hands
   the room back to The Numbers. */
const FP_SIZE = {key:'floorplan', label:'Floorplan', side:'Back', sel:'.fp-wrap', min:70, max:130};
const SIZE_ROWS = [...TEXT_SECTIONS, FP_SIZE];
const FP_HEADSHOT_MIN = .6;   // a bigger plan may shrink the agent headshots to this share of their size
function fpSizePct(){
  const v = Math.round(Number(state.floorplanSize));
  return Number.isFinite(v) && v ? clampN(v, FP_SIZE.min, FP_SIZE.max) : 100;
}
const sizePct = key => key === FP_SIZE.key ? fpSizePct() : textPct(key);
function setSizePct(key, v){
  if(key === FP_SIZE.key) state.floorplanSize = v;
  else if(v === 100) delete state.textScale[key];
  else state.textScale[key] = v;
}
/* the plan's width/height, read once per image off the page; until it has
   loaded, only the ledger caps the column, and the load re-fits */
const fpShapes = new Map();   // src -> aspect, or null while it loads
function fpAspect(src){
  if(!src) return null;
  if(fpShapes.has(src)) return fpShapes.get(src);
  fpShapes.set(src, null);
  if(fpShapes.size > 6) fpShapes.delete(fpShapes.keys().next().value);
  const im = new Image();
  im.onload = () => {
    const a = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : null;
    if(!fpShapes.has(src)) return;
    fpShapes.set(src, a);
    if(a) render();
  };
  im.src = src;
  return null;
}
/* the plans on the sheet, in order: the first, then the optional second */
function fpPlans(){
  return [{src:state.floorplan, view:state.floorplanView}, {src:state.floorplan2, view:state.floorplan2View}]
    .filter(p => p.src);
}
/* Two plans share the floorplan's frame. Each gets a share of the frame in
   proportion to its shape, so both print at the same height (side by side)
   or the same width (stacked), and the pair behaves like one wider or taller
   plan. Which way round is whichever shows more plan in this frame. Returns
   that combined shape and the margins the pair adds, for Floorplan size. */
const FP_INSET = .1 * 96;   // the image's own margin inside its frame
function arrangeFpPair(pair, sideBySide){
  const wraps = [...pair.querySelectorAll('.fp-wrap')];
  const a = [fpAspect(state.floorplan), fpAspect(state.floorplan2)];
  if(wraps.length !== 2 || !a[0] || !a[1]) return null;
  const W = pair.clientWidth, H = pair.clientHeight;
  const g = parseFloat(getComputedStyle(pair).columnGap) || 0;
  const rowA = a[0] + a[1], colS = 1 / a[0] + 1 / a[1];
  const rowH = Math.max(0, Math.min(H - FP_INSET, (W - g - 2 * FP_INSET) / rowA));
  const colW = Math.max(0, Math.min(W - FP_INSET, (H - g - 2 * FP_INSET) / colS));
  const col = !sideBySide && colW * colW * colS > rowH * rowH * rowA;
  pair.dataset.dir = col ? 'col' : 'row';
  // each frame is its image margin plus a share of the rest in proportion to
  // its shape, which lands both plans at exactly the same height (or width)
  wraps.forEach((w, i) => { w.style.flex = (col ? 1 / a[i] : a[i]).toFixed(4) + ' 1 ' + FP_INSET + 'px'; });
  return col ? {aspect: 1 / colS, insetW: FP_INSET, insetH: 2 * FP_INSET + g}
             : {aspect: rowA, insetW: 2 * FP_INSET + g, insetH: FP_INSET};
}
/* what the last fit actually managed, per section — the panel reads this */
let textFit = {};

/* The largest multiplier up to `want` at which ok() still holds, applied via
   apply(). Shrinking always fits, so only growth is searched; the autofit's
   own size (1) is the known-good floor. */
function growTo(apply, ok, want){
  if(want <= 1){ apply(want); return want; }
  return largest(1, want, apply, ok, 7);
}
/* a heading that the autofit sized to `auto` pt, scaled by k — growth only
   as far as it still fits on one line */
function scaleHeading(el, auto, k){
  if(!el || auto == null || k === 1) return 1;
  if(k < 1){ el.style.fontSize = (auto * k).toFixed(2) + 'pt'; return k; }
  return fitHeading(el, auto, auto * k) / auto;
}
let warnedTrim = false;
const NUM_MIN = 7;       // the ledger's smallest autofit size, in pt
let cutFeatures = 0;   // feature lines the last render had to leave off the sheet
function fitFrontBody(trial){
  // The residence (left column) and the building band (right, beneath the hero) share
  // ONE body size — var(--t-body) — so a residence bullet and a building bullet always
  // match. We take the largest size where the residence column fits; the hero photo
  // (flex:1) gives the building whatever room it needs. The photo is guaranteed at
  // least MIN_HERO_IN: if the building band crowds it below that, the shared size is
  // walked back down until the photo has its room. Only when even the minimum size
  // can't make it fit is the hero dropped and the building given the right column.
  // Features/amenities are trimmed only as a last resort, when even the minimum
  // size overflows.
  //
  // trial: fit without cutting anything, and say whether this layout would
  // have to — {cutFree, photo}. fitSheets() asks this while it decides how far
  // the header sizes may grow; removing feature lines during a trial would make
  // every later trial look roomier than the sheet really is.
  const MIN_HERO_IN = 1.5, PX = 96, MIN = 6.8, MAX = 14;
  const trim  = document.querySelector('#sheetFront .trim');
  const res   = document.querySelector('#sheetFront .res-fit');
  const right = document.querySelector('#sheetFront .f-right');
  const bld   = right && right.querySelector('.bld-fit');
  if(!trim) return {cutFree:true, photo:true};
  if(right) right.classList.remove('no-photo');  // reset to the photo-on-top state each render
  cutFeatures = 0;
  // the autofit runs at the agent's neutral size; their own sizes go on after
  const setR = k => trim.style.setProperty('--k-res', k.toFixed(3));
  const setB = k => trim.style.setProperty('--k-bld', k.toFixed(3));
  setR(1); setB(1);
  const set  = pt => trim.style.setProperty('--t-body', pt.toFixed(2) + 'pt');
  const fits = el => !el || (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1);

  // 1) biggest shared size that keeps the residence column from overflowing
  let size = largest(MIN, MAX, set, () => fits(res), 8);

  // 2) if the photo is now too short, the type is what's crowding it out — shrink the
  //    shared size (the residence still fits at anything smaller) until the building
  //    band frees up the photo's minimum height. Only when even MIN can't buy the
  //    photo its room does the hero get dropped and the building take the column.
  const photo = right && (right.querySelector('.photo-hero') || right.querySelector('.photo-empty'));
  const heroOK = () => photo.offsetHeight >= MIN_HERO_IN * PX;
  if(right && bld && photo && !heroOK()){
    set(MIN);
    if(heroOK()) size = largest(MIN, size, set, heroOK, 8);
    else {
      right.classList.add('no-photo');
      largest(MIN, size, set, () => fits(res) && fits(bld), 8);
    }
  }

  // 2b) the agent's own sizes, as multiples of that shared fit. Each column
  //     answers to its own limit: the residence must fit its column; the
  //     building must leave the photo its minimum (or, with the photo already
  //     gone, fit the column it took over). Smaller building text can hand
  //     the photo back its room, so that case is tried first.
  const kR = textK('residence'), kB = textK('building');
  let gotR = 1, gotB = 1;
  if(res && kR !== 1) gotR = growTo(setR, () => fits(res), kR);
  if(bld && kB !== 1){
    if(right.classList.contains('no-photo') && kB < 1){
      setB(kB); gotB = kB;
      right.classList.remove('no-photo');
      if(!(photo && heroOK())) right.classList.add('no-photo');
    }else if(right.classList.contains('no-photo')){
      gotB = growTo(setB, () => fits(bld), kB);
    }else{
      gotB = growTo(setB, () => heroOK(), kB);
    }
  }
  const body = parseFloat(trim.style.getPropertyValue('--t-body')) || 10;
  textFit.residence = res ? {want:kR, got:gotR, pt: body * gotR} : null;
  textFit.building  = bld ? {want:kB, got:gotB, pt: body * gotB} : null;
  const noPhoto = !!right && right.classList.contains('no-photo');
  if(trial) return { cutFree: fits(res) && !(noPhoto && !fits(bld)), photo: !noPhoto };

  // 3) last resort — trim residence features, then building amenities, if MIN still overflows
  if(res && !fits(res)){
    const feats = [...res.querySelectorAll('.r-feat')];
    let removed = 0, note = null;
    while(res.scrollHeight > res.clientHeight + 1 && feats.length && removed < 60){
      feats.pop().remove(); removed++;
      if(!note){
        note = document.createElement('div');
        note.className = 'feat-more';
        note.textContent = 'A complete list of features is available upon request.';
        res.appendChild(note);
      }
    }
    if(removed && !warnedTrim){
      warnedTrim = true;
      toast(`${removed} feature line${removed>1?'s':''} didn't fit — trim the Residence list in the editor to choose what shows.`);
    }
    cutFeatures = removed;
  }
  if(right && right.classList.contains('no-photo') && bld && !fits(bld)){
    const run = bld.querySelector('.amen-run');
    let guard = 0;
    while(run && bld.scrollHeight > bld.clientHeight + 1 && run.childNodes.length > 1 && guard++ < 80){
      run.removeChild(run.lastChild);
    }
  }
}
function fitSecondary(){
  const res = document.querySelector('#sheetFront .res-fit');
  const sec = document.querySelector('#sheetFront .photo-secondary');
  if(!res || !sec) return;
  // an empty back slot is a drag-time overlay, not part of the column
  if(sec.classList.contains('is-empty')) return;
  // reset to the flex:1 state so we measure the full column each render
  res.style.flex = ''; res.style.height = ''; sec.style.flex = '';
  // res-fit is flex:1, so clientHeight = the full space the column can give it.
  // scrollHeight can't report less than clientHeight, so collapse res to its natural
  // height first, measure that, then decide if the leftover is worth a photo.
  const avail = res.clientHeight;
  res.style.flex = 'none';
  res.style.height = 'auto';
  const natural = res.scrollHeight;
  const empty = avail - natural;
  const MIN_PX = 96 * 1.2; // need at least ~1.2in of slack before showing the photo
  if(empty >= MIN_PX){
    res.style.height = natural + 'px';
    sec.style.flex = '1';
    sayBackRoom(true);
  }else{
    // not enough room — give the column back to the residence, hide the photo
    res.style.flex = ''; res.style.height = '';
    sayBackRoom(false);
  }
}

/* The back photo only appears when the residence column has slack to spare.
   That used to fail silently, which was tolerable while the photo had its own
   upload; now that the slot is something you drag onto, a photo that vanishes
   on arrival needs explaining. */
function sayBackRoom(fits){
  const el = $('#backNote');
  if(!el) return;
  el.textContent = (!fits && backPhoto())
    ? 'No room for the back photo on this sheet — shorten the residence text, trim a feature, or make The Residence smaller under Text &amp; floorplan size.'
    : '';
}
/* The toast about cut features fires once a session; this stays for as long
   as it is true, beside the list it is about. */
function sayCutFeatures(){
  const el = $('#featNote');
  if(el) el.textContent = cutFeatures
    ? `${cutFeatures} feature line${cutFeatures > 1 ? 's' : ''} did not fit and are left off the sheet — trim the list, or make The Residence smaller under Text &amp; floorplan size.`
    : '';
}
function fitSheets(){
  textFit = {};
  const front = document.querySelector('#sheetFront .trim');
  const back  = document.querySelector('#sheetBack .trim');
  const setK = (el, name) => k => el && el.style.setProperty(name, k.toFixed(3));
  const noSpill = els => () => els.every(e => e.scrollWidth <= e.clientWidth + 1);
  const report = (key, want, got, present) => {
    textFit[key] = present ? {want, got, pt: null} : null;
  };

  const addr = document.querySelector('#sheetFront .addr');
  const unit = document.querySelector('#sheetFront .unit-lt');
  const cells = front ? [...front.querySelectorAll('.scell')] : [];
  let kA = 1;   // the address multiplier currently applied
  // the address fitted to its line and scaled by kA; returns what it managed
  const header = () => {
    const got = scaleHeading(addr, fitHeading(addr, 16, 30), kA);
    if(addr && unit){
      // the unit line tracks the fitted address so the pairing keeps its hierarchy
      const pt = parseFloat(addr.style.fontSize) || 30;
      unit.style.fontSize = Math.max(9.5 * Math.min(1, kA), Math.min(14 * Math.max(1, kA), pt * .47)).toFixed(2) + 'pt';
    }
    return got;
  };
  const setPrice = setK(front, '--k-price'), setLede = setK(front, '--k-lede'), setStats = setK(front, '--k-stats');

  /* The header sizes — price, one-liner, beds & baths, address — are not fitted
     themselves, but everything around them is: each takes room from the columns
     below (and the price from the address beside it), which shrink to give it.
     They may grow only while the front, refitted around them, loses nothing it
     had at 100% — no feature or amenity cut, no photo dropped, no address
     pushed off its line. The trial layouts cost a refit each, so they only run when
     one of these was asked to grow. */
  setPrice(1); setLede(1); setStats(1);
  const growing = ['price', 'lede', 'stats', 'address'].some(k => textK(k) > 1);
  // the address has to keep its one line too — a wide price takes its width
  const oneLine = () => !addr || (addr.style.whiteSpace === 'nowrap' && addr.scrollWidth <= addr.clientWidth + 1);
  const layout = () => { header(); return Object.assign(fitFrontBody(true), { line: oneLine() }); };
  const base = growing ? layout() : null;
  const keeps = () => {
    const r = layout();
    return (r.cutFree || !base.cutFree) && (r.photo || !base.photo) && (r.line || !base.line);
  };
  const hasFt = !!(front && front.querySelector('.ft-r')), hasLede = !!(front && front.querySelector('.f-lede'));
  report('price', textK('price'), hasFt ? growTo(setPrice, keeps, textK('price')) : 1, hasFt);
  report('lede', textK('lede'), hasLede ? growTo(setLede, keeps, textK('lede')) : 1, hasLede);
  // beds & baths also have to keep each box holding its line
  report('stats', textK('stats'),
    cells.length ? growTo(setStats, () => noSpill(cells)() && keeps(), textK('stats')) : 1, cells.length > 0);
  // and the address has to stay on one line
  report('address', textK('address'),
    addr ? growTo(k => { kA = k; }, () => header() >= kA - .005 && keeps(), textK('address')) : 1, !!addr);

  header();
  const ba = document.querySelector('#sheetBack .b-head .ba');
  scaleHeading(ba, fitHeading(ba, 13, 19), kA);

  fitFrontBody();
  fitSecondary();

  // the agents band sits under the ledger's column, so it is sized first. Its
  // longest line is an email, which cannot wrap; it may run into its card's own
  // right padding (a long one already does, at 100%, beside a QR code) but has
  // to stop .06in short of the divider to the next card or the QR.
  // The ledger column gives up room to its neighbours — height to a taller
  // agents band, width to a wider floorplan — shrinking down to its own
  // smallest size and no further.
  const num = document.querySelector('#sheetBack .num-fit');
  const kN = textK('numbers');
  const ledgerHolds = () => {
    if(!num) return true;
    num.style.fontSize = (NUM_MIN * Math.min(1, kN)).toFixed(2) + 'pt';
    return num.scrollHeight <= num.clientHeight + 1 && num.scrollWidth <= num.clientWidth + 1;
  };

  const cards = back ? [...back.querySelectorAll('.ag-card')] : [];
  const cardsHold = () => cards.every(card => {
    const ct = card.querySelector('.ag-ct');
    const room = parseFloat(getComputedStyle(card).paddingRight) - .06 * 96;
    return !ct || ct.scrollWidth - ct.clientWidth <= Math.max(room, 0) + 1;
  });
  // A taller band takes height from the ledger column beside it (see ledgerHolds).
  report('agents', textK('agents'),
    cards.length ? growTo(setK(back, '--k-ag'), () => cardsHold() && ledgerHolds(), textK('agents')) : 1, cards.length > 0);

  // Floorplan size scales the plan itself, from what the sheet shows at 100%.
  // Width comes from The Numbers; height, when the plan's shape needs it, from
  // the agent headshots, which shrink as far as FP_HEADSHOT_MIN. It runs after
  // the agents band, so the text there is already final.
  // Two plans are sized as one: the pair's combined shape stands in for the plan's.
  const fpWrap = back && back.querySelector('.fp-wrap');
  const fpPair = back && back.querySelector('.fp-pair');
  // with The Numbers above, the plans sit left and right across the full width
  const numTop = !!(back && back.querySelector('.b-main.num-top'));
  const pairShape = fpPair ? arrangeFpPair(fpPair, numTop) : null;
  const fpBox = fpPair || fpWrap;
  const kF = fpSizePct() / 100;
  const aspect = fpPair ? (pairShape && pairShape.aspect) : fpWrap ? fpAspect(state.floorplan) : null;
  const insetW = pairShape ? pairShape.insetW : FP_INSET, insetH = pairShape ? pairShape.insetH : FP_INSET;
  let gotF = 1, fpWhy = '';
  if(fpBox && kF !== 1 && aspect && !numTop){
    const col = back.querySelector('.b-col.c3');
    const heads = [...back.querySelectorAll('.ag-card img')];
    const W0 = fpBox.clientWidth;
    const extra = col.clientWidth - W0;   // the vertical note beside the frame
    const shown = () => Math.min(fpBox.clientWidth - insetW, (fpBox.clientHeight - insetH) * aspect);
    const D0 = shown();
    const head0 = heads.length ? heads[0].offsetHeight : 0;
    const setHeads = f => heads.forEach(img => {
      if(f >= 1){ img.style.width = img.style.height = ''; return; }
      img.style.width = img.style.height = (head0 * f / 96).toFixed(3) + 'in';
    });
    const apply = k => {
      const D = k * D0;
      // wider only as far as the plan uses; smaller hugs the plan and hands the rest back
      const w = k >= 1 ? Math.max(W0, D + insetW) : D + insetW;
      col.style.flex = '0 0 ' + ((w + extra) / 96).toFixed(3) + 'in';
      setHeads(1);
      if(k > 1 && (D / aspect) + insetH > fpBox.clientHeight + .5 && heads.length)
        largest(FP_HEADSHOT_MIN, 1, setHeads, () => (D / aspect) + insetH <= fpBox.clientHeight + .5, 7);
    };
    let tried = 1;
    const fits = () => ledgerHolds() && cardsHold() && shown() >= tried * D0 - 1;
    gotF = growTo(k => { tried = k; apply(k); }, fits, kF);
    if(gotF < kF - .005){
      tried = Math.min(kF, gotF + .02); apply(tried);
      fpWhy = !ledgerHolds() ? 'numbers' : 'height';
      tried = gotF; apply(gotF);
    }
  }
  report('floorplan', kF, gotF, !!fpWrap);
  if(textFit.floorplan) textFit.floorplan.why = numTop ? 'top' : fpWhy;

  // the back-page ledger never clips — it shrinks to fit its column (10pt is full size)
  const autoN = fitBlock(num, NUM_MIN, 10);
  let gotN = 1;
  if(num && kN !== 1){
    if(kN < 1){ num.style.fontSize = (autoN * kN).toFixed(2) + 'pt'; gotN = kN; }
    else gotN = fitBlock(num, autoN, autoN * kN) / autoN;
  }
  report('numbers', kN, gotN, !!num);

  // what each section actually printed at, for the panel
  TEXT_SECTIONS.forEach(s => {
    const f = textFit[s.key]; if(!f) return;
    const el = document.querySelector(s.probe);
    f.pt = el ? parseFloat(getComputedStyle(el).fontSize) * 72 / 96 : null;
  });
}
let renderQueued = false;
function render(){
  if(renderQueued) return;
  renderQueued = true;
  const draw = ()=>{
    renderQueued = false;
    renderFront(); renderBack(); fitSheets(); layoutPreview();
    paintSlotTools();     // the slots were just rebuilt
    paintFloorplanTools();
    paintTextPanel();     // reports what each section managed, and re-lights a hovered one
    sayCutFeatures();
  };
  // rAF is suspended while the tab is not rendering, so a sheet built in a
  // background tab would sit empty until the agent came back to it. The
  // package builders make the same swap for the same reason.
  if(document.hidden) setTimeout(draw, 0); else requestAnimationFrame(draw);
}
