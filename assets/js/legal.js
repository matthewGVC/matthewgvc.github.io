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
     one that is not about a specific listing. */
  function block(kind) {
    var text = kind === 'brokerage' ? BROKERAGE : DISCLAIMER;
    return '<div class="legal">' + text + '</div>';
  }

  global.GVC_LEGAL = {
    DISCLAIMER: DISCLAIMER,
    BROKERAGE: BROKERAGE,
    MAILER: MAILER,
    FLOORPLAN: FLOORPLAN,
    FLOORPLAN_SHORT: FLOORPLAN_SHORT,
    block: block
  };
})(window);
