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

// Spending is negative in the sheet. Turns a sum into spending: positive, rounded to cents,
// and never -0.
const spending = (sum) => Math.round(-sum * 100) / 100 + 0;

// The movements that count for the goal: in the period, with a number, and not skipped.
// Returns { day, category, description, amount } for each one, amount as in the sheet.
function countedMovements(rows, { from, to, skip }) {
  const first = dayNumber(from);
  const last = dayNumber(to);
  const counted = [];
  for (const [date, category, description, amount] of rows) {
    if (typeof date !== 'number' || typeof amount !== 'number') continue;
    const day = Math.floor(date);
    if (day < first || day > last) continue;
    if (skipped(text(category), text(description), skip)) continue;
    counted.push({ day: date, category: text(category), description: text(description), amount });
  }
  return counted;
}

// rows: the movements, one row each: date, category, description, amount.
// Returns { amount, level }. amount is the spending as a positive number. level is:
// - "over": more than the limit (red).
// - "close": under the limit, but more than the part of the limit for the time gone by
//   (yellow). The time gone by is the month of the newest movement in the whole sheet: in
//   the 1st month of a 3-month period that part is 1/3 of the limit, in the 2nd month 2/3.
// - "ok": anything else.
export function goalStatus(rows, goal) {
  const { from, to, limit } = goal;
  const amount = spending(countedMovements(rows, goal).reduce((sum, m) => sum + m.amount, 0));

  // The newest movement of the whole sheet, counted or not.
  let newest = -Infinity;
  for (const [date] of rows) if (typeof date === 'number') newest = Math.max(newest, date);

  const first = monthCount(dayNumber(from));
  const months = monthCount(dayNumber(to)) - first + 1;
  const monthsGone = Number.isFinite(newest) ? monthCount(newest) - first + 1 : 0;
  let level = 'ok';
  if (amount > limit) level = 'over';
  else if (amount < limit && monthsGone >= 1 && amount > (limit * monthsGone) / months) {
    level = 'close';
  }
  return { amount, level };
}

// The goal's spending month by month: one entry per month of the period, in order:
// { year, month (1-12), amount, movements }. amount is the month's spending, or null when the
// month has no counted movements. movements: { category, description, amount } with the amount
// as spending, newest first. The same rules as goalStatus decide what counts.
export function goalMonths(rows, goal) {
  const counted = countedMovements(rows, goal);
  const first = monthCount(dayNumber(goal.from));
  const last = monthCount(dayNumber(goal.to));
  const months = [];
  for (let count = first; count <= last; count += 1) {
    const inMonth = counted
      .filter(({ day }) => monthCount(day) === count)
      .sort((a, b) => b.day - a.day);
    months.push({
      year: Math.floor(count / 12),
      month: (count % 12) + 1,
      amount: inMonth.length ? spending(inMonth.reduce((sum, m) => sum + m.amount, 0)) : null,
      movements: inMonth.map(({ category, description, amount }) => ({
        category,
        description,
        amount: spending(amount),
      })),
    });
  }
  return months;
}
