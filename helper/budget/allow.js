/* ============================================================
   BUDGET ALLOWLIST — the only code that decides what of a developer's
   pro-forma sheet the helper keeps (D112).

     keepBudget({ title, costs, payments }) → { title, lines, sheetTotal, payments }
       costs     the pro-forma tab as rows of cells (Sheets API values)
       payments  the Expense_Tracker tab the same way, or null when the sheet has none
     costsTab(titles) / paymentsTab(titles) → the tab to read, or null

   Kept: the Hard Costs block, each line { name, estimate, actual, upgrade }
   ("(Upgrade)" lines marked upgrade and the word dropped) up to the sheet's
   own TOTAL row, which is kept as sheetTotal { estimate, actual, remaining };
   each payment { date, category, vendor, description, amount, status,
   receipt } with receipt a yes / no. Everything else on those tabs (purchase,
   rehab, holding and closing costs, selling price, proceeds, the draw
   schedule, investors, financing, check numbers, receipt names, notes) is
   never copied into the result, so it can't reach the database.
   A tab whose headings aren't found throws a plain sentence.
   ============================================================ */
'use strict';

const text = v => (v === null || v === undefined ? '' : String(v)).replace(/\s+/g, ' ').trim();
const same = (v, word) => text(v).toLowerCase() === word;

/* "$ 13,500.00", "-$4,132.54", 2500, "-", "$ -" → a number, or null when blank */
function money(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = text(v).replace(/[$,\s]/g, '');
  if (!s || s === '-') return null;
  const n = Number(s.replace(/^\((.*)\)$/, '-$1'));
  return Number.isFinite(n) ? n : null;
}

/* "12/16/2025", "4/10/26", "2026-05-20" → "2026-05-20"; anything else → null */
function day(v) {
  const s = text(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return y + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
}

/* the first row holding every heading; → { row, col: { heading: index } } */
function headings(grid, words) {
  for (let r = 0; r < grid.length; r++) {
    const cells = grid[r] || [], col = {};
    words.forEach(w => { const i = cells.findIndex(c => same(c, w)); if (i !== -1) col[w] = i; });
    if (words.every(w => w in col)) return { row: r, col };
  }
  return null;
}

const UPGRADE = /\s*\(upgrade\)\s*/i;

function keepLines(grid) {
  const h = headings(grid, ['hard costs', 'estimated price', 'actual']);
  if (!h) throw new Error('The pro-forma has no Hard Costs table with Estimated Price and Actual columns.');
  const at = (cells, w) => cells[h.col[w]];
  const rest = (grid[h.row] || []).findIndex(c => same(c, 'remaining'));
  const lines = [];
  for (let r = h.row + 1; r < grid.length; r++) {
    const cells = grid[r] || [], name = text(at(cells, 'hard costs'));
    if (/^total\b/i.test(name)) {
      return { lines, sheetTotal: { estimate: money(at(cells, 'estimated price')), actual: money(at(cells, 'actual')), remaining: rest === -1 ? null : money(cells[rest]) } };
    }
    if (!name) continue;
    lines.push({ name: name.replace(UPGRADE, ' ').trim(), estimate: money(at(cells, 'estimated price')), actual: money(at(cells, 'actual')), upgrade: UPGRADE.test(name) });
  }
  return { lines, sheetTotal: null };
}

function keepPayments(grid) {
  const h = headings(grid, ['date', 'category', 'vendor', 'description', 'amount']);
  if (!h) throw new Error('The Expense_Tracker tab has no Date, Category, Vendor, Description and Amount columns.');
  const col = Object.assign({}, h.col);
  (grid[h.row] || []).forEach((c, i) => { if (same(c, 'status')) col.status = i; if (same(c, 'receipt link') || same(c, 'receipt')) col.receipt = i; });
  const out = [];
  for (let r = h.row + 1; r < grid.length; r++) {
    const cells = grid[r] || [], cell = w => (w in col ? cells[col[w]] : null);
    const amount = money(cell('amount')), date = day(cell('date'));
    if (amount === null && !date) continue;
    out.push({ date, category: text(cell('category')) || null, vendor: text(cell('vendor')) || null, description: text(cell('description')) || null,
      amount, status: text(cell('status')) || null, receipt: !!text(cell('receipt')) });
  }
  return out;
}

function keepBudget(o) {
  const kept = keepLines(o.costs || []);
  return { title: text(o.title) || null, lines: kept.lines, sheetTotal: kept.sheetTotal, payments: o.payments ? keepPayments(o.payments) : [] };
}

const costsTab = titles => titles.find(t => /pro-?\s?forma/i.test(t)) || titles[0] || null;
const paymentsTab = titles => titles.find(t => /expense[\s_]*tracker/i.test(t)) || null;

module.exports = { keepBudget, costsTab, paymentsTab, money, day };
