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

  /* Listings give the postal town ("Lanoka Harbor", "Morganville"); the town map is drawn by
     municipality. A row's town is matched to the map by name within its county, then through
     this list. Freehold could be the borough or the township; the township is the larger, so
     postal "Freehold" goes there. Add a line here when a new row's town is not found. */
  const TOWN_ALIASES = {
    Monmouth: { 'Ocean': 'Ocean Twp', 'Port Monmouth': 'Middletown', 'Morganville': 'Marlboro', 'Cliffwood': 'Aberdeen',
      'Freehold': 'Freehold Twp', 'Ocean Township': 'Ocean Twp', 'Shrewsbury': 'Shrewsbury Boro',
      'Wall Township': 'Wall', 'Neptune Township': 'Neptune' },
    Ocean: { 'Lanoka Harbor': 'Lacey', 'Forked River': 'Lacey', 'Bayville': 'Berkeley', 'Brick Township': 'Brick',
      'Point Pleasant Boro': 'Point Pleasant' }
  };

  // The map town a row belongs to, or null. towns: NJ_TOWNS.towns. The MLS sometimes adds a
  // suffix the map leaves off ("Toms River Twp"), so a second try drops it.
  function townOf(row, towns) {
    const here = towns.filter(t => t.county === row.county), want = String(row.town).trim().toLowerCase();
    const alias = (TOWN_ALIASES[row.county] || {})[row.town];
    const bare = want.replace(/ (twp|township|boro|borough|city)$/, '');
    return here.find(t => t.name.toLowerCase() === want) ||
      (alias && here.find(t => t.name === alias)) ||
      here.find(t => t.name.toLowerCase() === bare) || null;
  }

  // Sales per map town: [{ town, deals, volume }], biggest first, plus the rows that matched nothing.
  function byTown(rows, towns) {
    const m = new Map(), missing = [];
    rows.forEach(r => {
      const t = townOf(r, towns);
      if (!t) { missing.push(r); return; }
      const s = m.get(t) || { town: t, deals: 0, volume: 0 };
      s.deals += 1; s.volume += r.price; m.set(t, s);
    });
    const list = Array.from(m.values()).sort((a, b) => b.deals - a.deals || b.volume - a.volume);
    return { list, missing };
  }

  const api = { CORE, AGENTS, TOWN_ALIASES, summarize, tone, moneyShort, townOf, byTown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NJFootprint = api;
})(typeof window !== 'undefined' ? window : globalThis);
