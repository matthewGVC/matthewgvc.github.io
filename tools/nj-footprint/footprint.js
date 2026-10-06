/* NJ Footprint — the arithmetic. Pure functions, no DOM, so scripts/test-nj-footprint.js
   can run it in Node. Every number on the page comes from summarize(). */
(function (root) {
  'use strict';

  // The two counties the page leads with. Everything else with a sale is "also active".
  const CORE = ['Monmouth', 'Ocean'];
  const AGENTS = ['TJ Verdiglione', 'James Huber', 'Marli Silver'];

  const MONEY0 = { deals: 0, volume: 0 };

  // rows: [{ date, town, county, price, agent }]  ->  totals overall, per county, per agent.
  function summarize(rows) {
    const out = { deals: 0, volume: 0, byCounty: {}, byAgent: {} };
    AGENTS.forEach(a => { out.byAgent[a] = Object.assign({}, MONEY0); });
    rows.forEach(r => {
      out.deals += 1;
      out.volume += r.price;
      const c = out.byCounty[r.county] || (out.byCounty[r.county] = Object.assign({}, MONEY0));
      c.deals += 1; c.volume += r.price;
      const a = out.byAgent[r.agent] || (out.byAgent[r.agent] = Object.assign({}, MONEY0));
      a.deals += 1; a.volume += r.price;
    });
    return out;
  }

  // 'core' | 'active' | 'none' — how a county is shaded on the map.
  function tone(county, summary) {
    if (CORE.indexOf(county) !== -1) return 'core';
    return summary.byCounty[county] ? 'active' : 'none';
  }

  // $48.2M, $950K — the house short form, matching assets/js/pitch.js moneyShort.
  function moneyShort(n) {
    if (n >= 1e6) return '$' + Number((n / 1e6).toFixed(n >= 1e7 ? 1 : 2)) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }

  const api = { CORE, AGENTS, summarize, tone, moneyShort };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NJFootprint = api;
})(typeof window !== 'undefined' ? window : globalThis);
