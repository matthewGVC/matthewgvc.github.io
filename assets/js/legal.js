/* ============================================================
   LEGAL — the brokerage boilerplate every printed document carries.

   One copy, loaded by all four listing builders, so a wording change
   lands on the Showsheet, the Brochure, the Buyer Package and the Seller
   Pitch at once. None of it is editable in any tool: a document that
   printed a wrong or missing disclaimer would be a compliance problem,
   not a design one.

   The text is the Showsheet's, which was the only tool carrying it.
   ============================================================ */
(function (global) {
  'use strict';

  /* The full listing disclaimer, ending in the brokerage line. Printed on
     every property document. */
  var DISCLAIMER =
    'The information set forth herein has been obtained from sources deemed reliable but is not ' +
    'guaranteed and is submitted subject to errors, omissions, change of price, prior sale, or ' +
    'withdrawal without notice. All dimensions and square footage are approximate and should be ' +
    'independently verified. Carrying costs, financing limits, flip tax, assessments, and sublet ' +
    'and pied-à-terre policies are subject to building documents and board approval. This is ' +
    'not intended to solicit property already listed. The Gasdaska Verdiglione Conlon Team at ' +
    'Douglas Elliman Real Estate · 575 Madison Avenue, New York, NY 10022. ' +
    'Equal Housing Opportunity.';

  /* New Jersey and Florida listings. The same disclaimer without the
     sentence about flip tax, sublets, pied-à-terre and board approval: those
     are New York co-op terms, and on a house in Rumson or a condo in Delray
     they describe rules that do not exist. Nothing is added in its place, so
     every other word is the New York text exactly. The brokerage line keeps
     575 Madison Avenue, as elliman.com does under its listings in every state. */
  var CO_OP_SENTENCE =
    'Carrying costs, financing limits, flip tax, assessments, and sublet ' +
    'and pied-à-terre policies are subject to building documents and board approval. ';
  var DISCLAIMER_NJ_FL = DISCLAIMER.replace(CO_OP_SENTENCE, '');

  /* The listing disclaimer for a market: 'nj' and 'fl' drop the co-op
     sentence; anything else, including no market at all, is New York. */
  function listing(market) {
    return market === 'nj' || market === 'fl' ? DISCLAIMER_NJ_FL : DISCLAIMER;
  }

  /* A property's market from its address, for a tool that has no market
     control of its own (the Brochure). The state field is typed freely, so
     it reads the name or the code, and falls back to the zip: 07–08 is New
     Jersey, 32–34 is Florida. A zip masked as "07***" still reads. Anything
     it cannot place is New York, which is how every document printed before. */
  function marketOf(where) {
    where = where || {};
    var st = String(where.state || '').trim().toLowerCase().replace(/\./g, '');
    if (st === 'nj' || st === 'new jersey') return 'nj';
    if (st === 'fl' || st === 'florida') return 'fl';
    if (st === 'ny' || st === 'new york') return 'nyc';
    var zip = String(where.zip || '').trim();
    if (/^0[78]/.test(zip)) return 'nj';
    if (/^3[234]/.test(zip)) return 'fl';
    return 'nyc';
  }

  /* The shorter form, for a document that is not about one listing — a
     buyer consultation carries no property to disclaim, but the brokerage
     and the housing line still belong on it. */
  var BROKERAGE =
    'The information set forth herein has been obtained from sources deemed reliable but is not ' +
    'guaranteed. This is not intended to solicit property already listed. ' +
    'The Gasdaska Verdiglione Conlon Team at Douglas Elliman Real Estate · ' +
    '575 Madison Avenue, New York, NY 10022. Equal Housing Opportunity.';

  /* Mailers. The wording on every postcard the team has sent through
     Vistaprint (Marketing > Just Sold & Expireds - Postcards): a card lands
     in mailboxes it was not asked into, so it carries the "if your property
     is currently listed" line. The year is the year it prints. */
  var MAILER =
    '575 Madison Ave, New York, NY 10022. 732.387.3807 © ' + new Date().getFullYear() +
    ' Douglas Elliman Real Estate. All material presented herein is intended for information ' +
    'purposes only. While this information is believed to be correct, it is represented subject ' +
    'to errors, omissions, changes or withdrawal without notice. All property information, ' +
    'including, but not limited to square footage, room count, number of bedrooms and the school ' +
    'district in property listings should be verified by your own attorney, architect or zoning ' +
    'expert. If your property is currently listed with another real estate broker, please ' +
    'disregard this offer. It is not our intention to solicit the offerings of other real estate ' +
    'brokers. We cooperate with them fully. Equal Housing Opportunity.';

  /* Printed under any floor plan, in every tool that shows one. */
  var FLOORPLAN =
    'Floor plans are for illustrative purposes only. Dimensions and square footage are ' +
    'approximate and subject to verification.';

  /* The Showsheet sets its floor-plan note vertically up the edge of the
     sheet, where the sentence above would run off the page. Same promise,
     short enough to fit. */
  var FLOORPLAN_SHORT = 'All dimensions are approximate. Not to scale.';

  /* The block as it prints at the foot of a closing page. `kind` picks the
     wording: 'listing' (default) for a property document, 'brokerage' for
     one that is not about a specific listing. `market` ('nyc', 'nj', 'fl')
     picks the listing wording; left out, it is New York. */
  function block(kind, market) {
    var text = kind === 'brokerage' ? BROKERAGE : listing(market);
    return '<div class="legal">' + text + '</div>';
  }

  global.GVC_LEGAL = {
    DISCLAIMER: DISCLAIMER,
    BROKERAGE: BROKERAGE,
    MAILER: MAILER,
    FLOORPLAN: FLOORPLAN,
    FLOORPLAN_SHORT: FLOORPLAN_SHORT,
    listing: listing,
    marketOf: marketOf,
    block: block
  };
})(window);
