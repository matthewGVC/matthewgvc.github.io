/* ============================================================
   COURTESY CHECK — is this DE listing one GVC listed? (plan D8)

   DE's sold list includes buyer-side deals, and its data has no "listed
   by" field. A listing's own page tells: another brokerage's listing reads
   "Listing Courtesy of <BROKERAGE>., <agent>"; DE's own listing has no such
   line and shows a "Get in touch with our agents" block instead. It counts
   as GVC's only when that block names someone on the team roster.

     parseCourtesy(pageText, rosterNames) → { gvcListed, line, agent, mlsId }
     await checkCourtesy(page, row, cache)  opens row.listingUrl (a Playwright
       page), parses it, and remembers the answer by DE id in `cache`
       (a Map; saved to <helper home>/courtesy.json by de-sync.js).
   ============================================================ */
'use strict';

/* What the 2026-10-19 pages showed:
   - DE's own listing: "GET IN TOUCH WITH OUR AGENTS <name> <phone> Licensed … CONNECT …",
     and no "Listing Courtesy of" line for the listing itself.
   - Another brokerage's listing: "Listing Courtesy of <BROKERAGE>., <AGENT> - <phone>".
   - After "CONNECT NOW" / "SIMILAR LISTINGS" come other listings, with their own
     courtesy lines: everything from there on is ignored. */
/* The subject listing's part of a page: whitespace collapsed, cut at "CONNECT NOW" / "SIMILAR LISTINGS". */
function subjectOf(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const ends = ['CONNECT NOW', 'SIMILAR LISTINGS'].map(m => t.indexOf(m)).filter(i => i !== -1);
  return ends.length ? t.slice(0, Math.min.apply(null, ends)) : t;
}

function parseCourtesy(text, names) {
  const subject = subjectOf(text);
  const mls = /MLS(?:\/Listing)? ID:?\s*([A-Z0-9-]+)/i.exec(subject);
  const out = { gvcListed: false, line: null, agent: null, mlsId: mls ? mls[1] : null };

  const c = /Listing Courtesy of (.+?)(?= - |\s+\$|\s+CONNECT\b|$)/i.exec(subject);
  if (c && !/DOUGLAS ELLIMAN/i.test(c[1])) {
    out.line = ('Listing Courtesy of ' + c[1]).trim();
    return out;
  }
  const a = subject.indexOf('GET IN TOUCH WITH OUR AGENTS');
  if (a === -1) return out;
  const block = subject.slice(a).toLowerCase();
  const found = (names || []).map(n => ({ n, i: block.indexOf(n.toLowerCase()) }))
    .filter(x => x.i !== -1).sort((x, y) => x.i - y.i).map(x => x.n);
  if (found.length) {
    out.gvcListed = true;
    out.agent = found[0];
    out.line = 'Douglas Elliman: ' + found.join(', ');
  }
  return out;
}

async function checkCourtesy(page, row, cache, names) {
  if (cache.has(row.id)) return cache.get(row.id);
  if (!row.listingUrl) return { gvcListed: false, line: null, agent: null, mlsId: null };
  await page.goto(row.listingUrl, { waitUntil: 'networkidle', timeout: 90000 });
  const text = await page.evaluate(() => document.body.innerText);
  const out = Object.assign(parseCourtesy(text, names), { checkedAt: new Date().toISOString() });
  cache.set(row.id, out);
  return out;
}

module.exports = { parseCourtesy, checkCourtesy, subjectOf };
