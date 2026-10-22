/* ============================================================
   DE PAGE FACTS — monthly tax, maintenance / common charges, lot size, year
   built and MLS id, read from a live listing's public DE page (plan D47, S20).
   DE's feed doesn't carry them. They come in at DE's rank (apply.js).

     parsePageFacts(text, propertyType) → { taxesMonthly?, maintenance? | commonCharges?, lotSize?, yearBuilt?, mlsId? }
       subject listing only (cut as the courtesy check cuts it). Co-op / Condop
       maintenance is `maintenance`; everything else is `commonCharges`.
       Money is a number per month; lotSize is DE's own words ("0.35 acres").
     needsPage(job, deRow, now) → true when the page was never read, the price
       changed since it was read, or it was read 7 or more days ago.
     await readPageFacts(page, row, propertyType)  opens row.listingUrl.
   The page's DETAILS block puts the value before the label ("3,369 Sq Ft Condo
   $6,428 Monthly Maintenance/CC $5,588 Monthly Tax Built in 2007 MLS/Listing ID
   23748057"); the label-first forms are a fallback. Lot size: "<x> Acres Lot",
   "<x> Sq Ft Lot" or "Lot Size <x>".
   ============================================================ */
'use strict';

const { subjectOf } = require('./courtesy.js');

const PAGE_FACTS = ['taxesMonthly', 'maintenance', 'commonCharges', 'lotSize', 'yearBuilt', 'mlsId'];
const WEEK = 7 * 24 * 3600 * 1000;

/* The real page writes the value first ("$5,588 Monthly Tax"); "Monthly Tax: $5,588" is kept as a fallback. */
function money(subject, label) {
  const m = new RegExp('\\$\\s*([\\d,]+(?:\\.\\d+)?)\\s+' + label + '\\b', 'i').exec(subject)
    || new RegExp(label + ':?\\s*\\$\\s*([\\d,]+(?:\\.\\d+)?)', 'i').exec(subject);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

const LOT_NUM = '(\\d[\\d,]*(?:\\.\\d+)?)';
function lotSize(subject) {
  // "0.35 Acres Lot", "7,500 Sq Ft Lot" (value first), then "Lot Size 0.35 acres"; the home's own "3,369 Sq Ft" is never a lot
  let m = new RegExp(LOT_NUM + '\\s*(acres?|sq\\.?\\s*ft\\.?)\\s+Lot\\b', 'i').exec(subject);
  if (m) return (m[1] + ' ' + m[2]).replace(/\s+/g, ' ');
  m = new RegExp('Lot\\s+Size:?\\s*' + LOT_NUM + '(?:\\s*(acres?|sq\\.?\\s*ft|sf|square feet))?', 'i').exec(subject);
  return m ? (m[1] + (m[2] ? ' ' + m[2] : '')).replace(/\s+/g, ' ') : null;
}

function parsePageFacts(text, propertyType) {
  const t = Array.isArray(propertyType) ? propertyType[0] : propertyType;
  const subject = subjectOf(text), out = {};
  const tax = money(subject, 'Monthly\\s+Tax(?:es)?');
  if (tax != null) out.taxesMonthly = tax;
  const mcc = money(subject, 'Monthly\\s+Maintenance\\s*/\\s*CC');
  if (mcc != null) out[/^(co-?op|condop)$/i.test(String(t || '')) ? 'maintenance' : 'commonCharges'] = mcc;
  const lot = lotSize(subject);
  if (lot) out.lotSize = lot;
  const yr = /(?:\bBuilt\s+in|Year\s+Built:?)\s*((?:1[6-9]|20)\d\d)\b/i.exec(subject);
  if (yr) out.yearBuilt = Number(yr[1]);
  const mls = /MLS(?:\/Listing)?\s+ID:?\s*([A-Z0-9-]+)/i.exec(subject);
  if (mls) out.mlsId = mls[1];
  return out;
}

function needsPage(job, deRow, now) {
  const de = (job && job.de) || {};
  if (!de.pageFactsAt) return true;
  if (deRow && deRow.price != null && de.pageFactsPrice !== deRow.price) return true;
  return (now || new Date()).getTime() - new Date(de.pageFactsAt).getTime() >= WEEK;
}

async function readPageFacts(page, row, propertyType) {
  await page.goto(row.listingUrl, { waitUntil: 'networkidle', timeout: 90000 });
  const text = await page.evaluate(() => document.body.innerText);
  return parsePageFacts(text, propertyType);
}

module.exports = { parsePageFacts, needsPage, readPageFacts, PAGE_FACTS };
