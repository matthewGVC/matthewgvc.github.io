/* ============================================================
   tools/showsheet/sheet.js: drawing the two sides of the sheet
   (renderFront, renderBack) for each market. Second of the eight
   scripts (see state.js).
   ============================================================ */
'use strict';

/* ============================================================
   SHEET RENDERING
   ============================================================ */
/* Wording a unit is shared with the Seller Package and the Brochure, and lives
   in property-library.js next to the split that has to read it back — the two
   are inverses and drifted apart once already. */
function unitDisplay(u){ return GVC_PROPS.unitDisplay(u); }
/* New York is the sheet as it has always printed; every New Jersey and Florida
   difference below hangs off this one test, so a New York sheet cannot move. */
function nycSheet(){ return marketKey(state.market) === 'nyc'; }
/* the three markets; anything else is New York, as GVC_LEGAL.listing reads it */
function marketKey(m){ return m === 'nj' || m === 'fl' ? m : 'nyc'; }
/* a market and an ownership that belong together: no co-op or house in the wrong place */
function settleMarket(){
  state.market = marketKey(state.market);
  if(state.market !== 'nyc' && state.ownership === 'co-op') state.ownership = 'condo';
  if(state.market === 'nyc' && state.ownership === 'house') state.ownership = 'none';
  state.disclaimer = GVC_LEGAL.listing(state.market);
}
function rentalSheet(){ return state.kind === 'rental'; }
function ownLabel(){
  if(state.ownership === 'house') return esc(String(state.propertyType || 'House')).toUpperCase();
  return {'co-op':'CO-OP', 'condo':'CONDO', 'new-con':'NEW CONSTRUCTION', 'none':''}[state.ownership] ?? 'CO-OP';
}
function chipHtml(){
  // the borough is a New York thing: an NJ or FL sheet with no town shows none
  const place = state.neighborhood || (nycSheet() ? state.borough : '') || '';
  const lab = ownLabel();
  if(!lab && !place) return '';
  const sep = (lab && place) ? `<span class="dotsep">·</span>` : '';
  return `<span class="b-own">${lab}${sep}${place?esc(place).toUpperCase():''}</span>`;
}
function statCells(){
  const cells = [];
  if(!blankish(state.beds)){
    // a studio is zero bedrooms — show STUDIO in the label slot (no number) so it
    // can't collide with the value text and clip off the edge of the strip.
    // Catch both a literal 0 and the word "studio" typed straight into the field.
    const studio = /^(0|studios?)$/i.test(String(state.beds).trim());
    cells.push(studio ? {v:'', l:'Studio', ic:ICONS.bed} : {v: esc(state.beds), l:'Bedrooms', ic:ICONS.bed});
  }
  if(!blankish(state.baths)) cells.push({v: esc(state.baths), l:'Bathrooms', ic:ICONS.bath});
  if(!nycSheet() && !blankish(state.sqft)){
    const n = Number(String(state.sqft).replace(/[,\s]/g, ''));
    cells.push({v: esc(Number.isFinite(n) && n > 0 ? n.toLocaleString('en-US') : state.sqft), l:'Sq Ft', ic:ICONS.plan});
    // three to a strip: the short labels, so each box still holds its line
    cells.forEach(c => { if(c.l === 'Bedrooms') c.l = 'Beds'; else if(c.l === 'Bathrooms') c.l = 'Baths'; });
  }
  return cells;
}
function photoCell(p, cls, drop){
  // the focal point is a number the drag sets, but it arrives from a saved
  // document too — coerce it rather than trusting what is in the blob
  const num = v => Number.isFinite(+v) ? +v : 50;
  const pos = `${num(p.fx)}% ${num(p.fy)}%`;
  return `<div class="${cls}" data-drop="${drop}"><img src="${esc(p.src)}" style="object-position:${pos}" alt=""></div>`;
}
function renderFront(){
  const webId = webIdOf(state.listingUrl);
  const heroP = frontPhoto();
  const photoHtml = heroP ? photoCell(heroP, 'photo-hero', 'hero')
    : `<div class="photo-empty" data-drop="hero">${art.monoNavy}</div>`;
  // the residence — complete information, scaled to fit the left column
  const r = state.residence;
  const rSpecs = specRow('Exposures', r.exposures) + specRow('Outdoor', r.outdoor) + specRow('Ceilings', r.ceiling) + specRow('Climate', r.climate);
  const feats = (r.features||[]).filter(s=>s.trim());
  const featCol = items => `<div class="r-feat-col">${items.map(f=>`<div class="r-feat">${esc(f)}</div>`).join('')}</div>`;
  // 5 or fewer: one flex column of bullets; more: split across two side-by-side
  // columns — each column spaces its own bullets via justify-content:space-between
  const featHtml = !feats.length ? '' : feats.length<=5 ? `<div class="r-feats one">${featCol(feats)}</div>` :
    (()=>{ const cut = Math.ceil(feats.length/2); return `<div class="r-feats two">${featCol(feats.slice(0,cut))}${featCol(feats.slice(cut))}</div>`; })();
  const resHtml = (rSpecs || featHtml) ? `
    <div class="col-h"><span class="ich">${ICONS.key}</span><span>The Residence</span></div>
    <div class="res-fit fitblk">${rSpecs}${featHtml}</div>` : '';
  // the building — sits to the right of the asking price
  const b = state.building;
  const scale = [b.stories, b.residences].some(v=>!blankish(v))
    ? [!blankish(b.stories)? `${esc(b.stories)} stories`:null, !blankish(b.residences)? `${esc(b.residences)} residences`:null].filter(Boolean).join(' · ') : '';
  // Built shares its row with stories/residences so the facts below get more space
  const built = [b.builtYear, scale].filter(v=>!blankish(v)).map(v=>String(v).trim()).join(' · ');
  const house = state.ownership === 'house';
  const bSpecs = house
    ? specRow('Built', built) + specRow('Lot', state.lotSize) + specRow('Parking', state.parking)
    : specRow('Built', built) + specRow('Architect', b.architect) +
      specRow('Service', b.service) + specRow('Policies', b.policy);
  const amen = (b.amenities||[]).filter(s=>s.trim());
  const amenHtml = amen.length ? `<div class="amen-run">${amen.map(a=>esc(a)).join('<span class="adot">·</span>')}</div>` : '';
  const bldHtml = (bSpecs || amenHtml) ? `
    <div class="col-h"><span class="ich">${ICONS.bldg}</span><span>${house ? 'The Property' : 'The Building'}</span></div>
    <div class="bld-fit fitblk">${bSpecs}${amenHtml}</div>` : '';
  const cells = statCells();
  const strip = cells.length ? `<div class="strip${cells.length > 2 ? ' three' : ''}">${cells.map(c=>
    `<div class="scell"><span class="slb">${c.ic}<span class="sv">${c.v}</span></span><span class="lead"></span><span class="slabel">${c.l}</span></div>`).join('')}</div>` : '';
  // displayPrice is a formatter, not a sanitiser: a price it cannot read as a
  // number — "Call for price", or anything pasted out of a Word doc — comes
  // back as typed, so it is escaped here like every other field
  const askBlock = state.price ? `<div class="ft-r"><div class="al">${rentalSheet() ? 'Monthly Rent' : 'Asking Price'}</div><div class="av">${esc(displayPrice(state.price))}</div></div>` : '';
  $('#sheetFront').innerHTML = `
    <div class="trim">
      <div class="sh-head">
        ${nycSheet() || !art.de ? `<div class="sh-logo">${art.lockup}</div>`
          : `<div class="sh-logo has-de">${art.lockup}<span class="sh-de" role="img" aria-label="Douglas Elliman">${art.de}</span></div>`}
        <div class="sh-id">
          <div class="addr">${esc(state.address) || '<span style="opacity:.25">Street Address</span>'}</div>
          ${state.unit ? `<div class="unit-lt">${esc(unitDisplay(state.unit))}</div>` : ''}
        </div>
        <div class="sh-right">
          ${askBlock}
          ${webId ? `<span class="webid">Web ID ${esc(webId)}</span>` : ''}
        </div>
      </div>
      ${state.positioning ? `<div class="f-lede">${esc(state.positioning)}</div>` : ''}
      <div class="f-main">
        <div class="f-left">
          ${strip}
          ${resHtml}
          ${backPhoto() ? photoCell(backPhoto(), 'photo-secondary', 'back')
            : '<div class="photo-secondary is-empty" data-drop="back"></div>'}
        </div>
        <div class="f-right">
          ${photoHtml}
          ${bldHtml ? `<div class="f-bldg">${bldHtml}</div>` : ''}
        </div>
      </div>
      <div class="sh-foot">
        <div class="fl">${FRONT_DISCLAIMER}</div>
        <div class="badges"><span class="badge">${art.badgeDe}</span><span class="badge">${art.badgeGvc}</span><span class="badge">${BADGE_EHO}</span></div>
      </div>
    </div>
    <div class="safe"></div>
    ${cropMarks()}`;
}
/* a monthly figure says so: "$150" prints "$150 / mo" */
function perMonth(v){
  const t = moneyText(v);
  return esc(GVC_LISTING.BARE_MONEY.test(String(v)) && !/(mo|month|yr|year|annual)/i.test(String(v)) ? t + ' / mo' : t);
}
/* New Jersey and Florida (S9): taxes quoted yearly (the job keeps them monthly),
   HOA for a house, common charges for a condo, the lot, an assessment only when
   there is one. No co-op lines. A rental prints its rent and nothing to carry. */
function ledgerRowsNjFl(){
  const L = [], rent = rentalSheet();
  L.push({lab: rent ? 'Monthly Rent' : 'Asking Price', val: state.price ? esc(displayPrice(state.price)) : '—', lead:true});
  if(!rent){
    const tax = GVC_LISTING.monthlyAmount(state.taxesMonthly);
    if(tax) L.push({lab:'Property Taxes', val: fmtMoney(tax * 12) + ' / yr'});
    else if(!blankish(state.taxesMonthly)) L.push({lab:'Property Taxes', val: esc(moneyText(state.taxesMonthly))});
    if(!blankish(state.commonCharges)) L.push({lab: state.ownership === 'house' ? 'HOA' : 'Common Charges', val: perMonth(state.commonCharges)});
  }
  if(!blankish(state.lotSize)) L.push({lab:'Lot Size', val: esc(state.lotSize)});
  if(!rent && !blankish(state.assessments)) L.push({lab:'Assessments', val: esc(moneyText(state.assessments))});
  return L;
}
function ledgerRows(){
  if(!nycSheet()) return ledgerRowsNjFl();
  if(rentalSheet()) return [{lab:'Monthly Rent', val: state.price ? esc(displayPrice(state.price)) : '—', lead:true}];
  const L = [];
  // every val in this list is escaped here, because renderBack writes them raw
  L.push({lab:'Asking Price', val: state.price ? esc(displayPrice(state.price)) : '—', lead:true});
  if(state.ownership === 'co-op'){
    if(!blankish(state.maintenance)){
      L.push({lab:'Maintenance', val: esc(moneyText(state.maintenance))});
      L.push({note:'Real estate taxes are included in the monthly maintenance.'});
      if(!blankish(state.taxDeductible)) L.push({note:`Approximately ${esc(state.taxDeductible)} of maintenance is tax-deductible.`});
    }
  } else {
    if(!blankish(state.commonCharges)) L.push({lab:'Common Charges', val: esc(moneyText(state.commonCharges))});
    if(!blankish(state.taxesMonthly)) L.push({lab:'Real Estate Taxes', val: esc(moneyText(state.taxesMonthly))});
  }
  if(!blankish(state.maxFinancing)) L.push({lab:'Max Financing', val: esc(state.maxFinancing)});
  L.push({lab:'Assessments', val: blankish(state.assessments) ? 'None' : esc(moneyText(state.assessments))});
  if(!blankish(state.capitalContributions)) L.push({lab:'Capital Contribution', val: esc(state.capitalContributions)});
  if(!blankish(state.flipTax)) L.push({lab:'Flip Tax', val: esc(state.flipTax)});
  return L;
}
function specRow(lab, val){
  return blankish(val) ? '' : `<div class="r-spec"><span class="sl">${lab}</span><span class="sv">${esc(val)}</span></div>`;
}
function cropMarks(whiteBottom){
  // 8 marks at the trim corners (visible only in bleed mode): .03in gap + .09in line
  let h = '';
  for(const [x,y] of [['left','top'],['right','top'],['left','bottom'],['right','bottom']]){
    const w = whiteBottom && y==='bottom' ? ' w' : ''; // bottom marks sit on the navy footer bleed
    h += `<i class="h${w}" style="${x}:-0.12in;${y}:-0.5pt;"></i>`;
    h += `<i class="v${w}" style="${y}:-0.12in;${x}:-0.5pt;"></i>`;
  }
  return `<div class="crop">${h}</div>`;
}
/* The Numbers as one row across the page (two plans, Numbers above): every
   figure is a cell, the carrying total closes the row, and the notes that sit
   between rows in the column run together on one line underneath. */
function ledgerStrip(carry){
  const rows = ledgerRows();
  const cells = rows.filter(r => !r.note).map(r =>
    `<div class="lg-row${r.lead?' lead':''}"><span class="lg-lab">${r.lab}</span><span class="lg-val">${r.val}</span></div>`).join('');
  const notes = rows.filter(r => r.note).map(r => r.note);
  if(carry) notes.push(`${carry.what}; excludes mortgage financing.`);
  const total = carry ? `<div class="lg-total"><div class="lg-row"><span class="lg-lab">Est. Monthly Carrying</span><span class="lg-val">${fmtMoney(carry.total)}</span></div></div>` : '';
  return `<div class="lg-strip">${cells}${total}</div>${notes.length ? `<div class="lg-notes">${notes.join(' &middot; ')}</div>` : ''}`;
}
/* Est. Monthly Carrying: none for a rental; a house's charges are its HOA */
function carryingNow(){
  if(rentalSheet()) return null;
  const c = GVC_LISTING.carrying(state);
  if(c && state.ownership === 'house') c.what = c.what.replace(/^Common charges/, 'HOA').replace(/common charges/, 'HOA');
  return c;
}
function renderBack(){
  const webId = webIdOf(state.listingUrl);
  const lg = ledgerRows().map(r => r.note
    ? `<div class="lg-note">${r.note}</div>`
    : `<div class="lg-row${r.lead?' lead':''}"><span class="lg-lab">${r.lab}</span><span class="lg-val">${r.val}</span></div>`).join('');
  const carry = carryingNow();
  const numTop = !!(state.floorplan && state.floorplan2) && state.fpLayout === 'above';
  const carryHtml = carry ? `
    <div class="lg-total">
      <div class="lg-row"><span class="lg-lab">Est. Monthly Carrying</span><span class="lg-val">${fmtMoney(carry.total)}</span></div>
      <div class="lg-foot">${carry.what}; excludes mortgage financing.</div>
    </div>` : '';

  const plans = fpPlans();
  const fpCell = (p, i) => {
    const name = plans.length > 1 ? 'Floorplan ' + (i + 1) : 'Floorplan';
    return `<div class="fp-wrap${normFpView(p.view).zoom > 1 ? ' is-zoomed' : ''}" data-fp="${i}" tabindex="0" role="group"
              aria-label="${name} crop. Drag to move it, plus and minus to zoom, 0 to fit."><img src="${esc(p.src)}" alt="${name}" draggable="false" style="${fpTransform(p.view)}"></div>`;
  };
  const fp = plans.length
    ? `<div class="fp-area">
         ${plans.length > 1 ? `<div class="fp-pair">${plans.map(fpCell).join('')}</div>` : fpCell(plans[0], 0)}
         <div class="fp-note">${GVC_LEGAL.FLOORPLAN_SHORT}</div>
       </div>`
    : `<div class="fp-empty">Floorplan available upon request</div>`;

  const agents = state.agentIds.map(id=>ROSTER.find(a=>a.id===id)).filter(Boolean);
  const n = Math.max(1, Math.min(4, agents.length || 1));
  const qr = state.listingUrl ? qrSvg(state.listingUrl) : '';
  const qrInFooter = agents.length >= 4 && qr;
  const cards = agents.map(a=>`
    <div class="ag-card">
      <img src="${a.photo}" alt="${esc(a.name)}">
      <div class="ag-ct">
        <div class="an">${esc(a.name)}</div>
        <div class="at">${esc(a.title)}</div>
        <div class="ac">${[a.phone,a.email].filter(Boolean).map(esc).join("<br>")}</div>
      </div>
    </div>`).join('');
  const bandQr = (!qrInFooter && qr) ? `
    <div class="ag-qr"><div class="ql">Scan for the full listing${webId?`<br><span style="font-weight:300;letter-spacing:.12em">Web ID ${esc(webId)}</span>`:''}</div><div class="qr-box">${qr}</div></div>` : '';

  $('#sheetBack').innerHTML = `
    <div class="trim">
      <div class="b-head">
        <div class="ba">${esc(state.address)||''}${state.unit?`<span class="bu"> — ${esc(unitDisplay(state.unit))}</span>`:''}</div>
        <div class="bh-right">
          ${chipHtml()}
          ${webId?`<span class="webid">Web ID ${esc(webId)}</span>`:''}
        </div>
      </div>
      <div class="b-main${numTop ? ' num-top' : ''}">
        <div class="b-col c1">
          <div class="col-h"><span class="ich">${ICONS.ledger}</span><span>The Numbers</span></div>
          <div class="num-fit fitblk">${numTop ? ledgerStrip(carry) : lg + carryHtml}</div>
        </div>
        <div class="b-col c3">
          ${fp}
        </div>
      </div>
      <div class="ag-band" data-n="${n}">
        <div class="ag-cards">${cards || '<div class="lg-note">Select 1–4 agents in the editor.</div>'}</div>
        ${bandQr}
      </div>
      <div class="b-foot${qrInFooter?' has-qr':''}">
        <div class="mono">${art.monoWhite}</div>
        <div class="dis">${esc(state.disclaimer)}</div>
        <div class="office">
          <div class="o1">The Gasdaska Verdiglione Conlon Team</div>
          <div class="o2">${esc(OFFICE_LINE)}</div>
          <div class="o3">${EHO_SVG}<span>Equal Housing Opportunity</span></div>
        </div>
        ${qrInFooter?`<div class="fqr"><div class="qr-box">${qr}</div></div>`:''}
      </div>
    </div>
    <div class="safe"></div>
    ${cropMarks(true)}`;
}
