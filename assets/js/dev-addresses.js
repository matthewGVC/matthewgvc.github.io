/* ============================================================
   DEVELOPMENT ADDRESSES — the street each development's units are listed at.

   DE lists a development's units one by one (102 SE 5th Ave 2, 102 SE 5th Ave 8 …).
   They are sold through the development, not as Asana listings, so a DE listing at
   one of these streets is that development's unit: the Errors page leaves it out of
   "On DE, not in Asana" (GVC_WS.looseMatch, devStreets).

   Keyed by the development's slug (dev_projects.slug). Street only, as DE writes it;
   the unit and town are ignored (GVC_ADDR.sameStreet). Matt, 2026-10-30.

   Loads in the browser (window.GVC_DEV_ADDRESSES) and in Node (require).
   ============================================================ */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.GVC_DEV_ADDRESSES = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var BY_SLUG = {
    'casa-avenida': ['102 SE 5th Ave'],
    'le-reve': ['200 E Boca Raton Rd'],
    'westwood': ['298 Westwood Ave']
  };

  /* [{ street, slug }] for GVC_WS.looseMatch */
  function streets() {
    var out = [];
    Object.keys(BY_SLUG).forEach(function (slug) { BY_SLUG[slug].forEach(function (s) { out.push({ street: s, slug: slug }); }); });
    return out;
  }

  return { BY_SLUG: BY_SLUG, streets: streets };
});
