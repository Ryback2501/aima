// Works out the spending goal: how much was spent in the goal's period, and if that is
// close to or over the limit. It only does sums. It does not read the sheet or touch the page.

const DAY = 86_400_000;
// The sheet counts dates in days since 30 December 1899.
const SHEET_START = Date.UTC(1899, 11, 30);

// "2026-10-01" → the sheet's day number for that date.
function dayNumber(date) {
  return (Date.parse(`${date}T00:00:00Z`) - SHEET_START) / DAY;
}

// The sheet's day number → a month count (year × 12 + month), to compare months easily.
function monthCount(day) {
  const date = new Date(SHEET_START + Math.floor(day) * DAY);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

const text = (value) => String(value ?? '').trim();

// True when a movement must not be counted (salary, mortgage, fixed house bills, ...).
function skipped(category, description, skip) {
  if (skip.categories.includes(category)) return true;
  return category === skip.house.category && skip.house.descriptions.includes(description);
}

// rows: the movements, one row each: date, category, description, amount.
// Returns { amount, level }. amount is the spending as a positive number. level is:
// - "over": more than the limit (red).
// - "close": under the limit, but more than the part of the limit for the time gone by
//   (yellow). The time gone by is the month of the newest movement in the whole sheet: in
//   the 1st month of a 3-month period that part is 1/3 of the limit, in the 2nd month 2/3.
// - "ok": anything else.
export function goalStatus(rows, { from, to, limit, skip }) {
  const first = dayNumber(from);
  const last = dayNumber(to);
  let sum = 0;
  let newest = -Infinity;

  for (const [date, category, description, amount] of rows) {
    if (typeof date !== 'number') continue;
    newest = Math.max(newest, date);
    if (typeof amount !== 'number') continue;
    const day = Math.floor(date);
    if (day < first || day > last) continue;
    if (skipped(text(category), text(description), skip)) continue;
    sum += amount;
  }

  // Spending is negative in the sheet. Round to cents, and turn -0 into 0.
  const amount = Math.round(-sum * 100) / 100 + 0;

  const months = monthCount(last) - monthCount(first) + 1;
  const monthsGone = Number.isFinite(newest) ? monthCount(newest) - monthCount(first) + 1 : 0;
  let level = 'ok';
  if (amount > limit) level = 'over';
  else if (amount < limit && monthsGone >= 1 && amount > (limit * monthsGone) / months) {
    level = 'close';
  }
  return { amount, level };
}
