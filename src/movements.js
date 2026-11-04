// What happens to the movements of the sheet when one is saved or changed, or some are
// deleted: the rules that sort them, the rows that change, and the checks of the form. It only
// works with values. It does not read the sheet or touch the page.
//
// A movement row is: source, date (the sheet's day number), category, concept, amount.

import { dayNumber, hasExtraDecimals } from './goal.js';

// "2026-10-05" (a date of the form) → the sheet's day number for that date, the same way the
// goal counts days.
export const sheetDay = dayNumber;

const text = (value) => String(value ?? '').trim();
// The day of a movement row, without its time, or null when the row has no date.
const dayOf = (row) => (typeof row[1] === 'number' ? Math.floor(row[1]) : null);
// Amounts are compared in cents, so 0.1 + 0.2 and 0.3 are the same amount.
const centsOf = (amount) => (typeof amount === 'number' ? Math.round(amount * 100) : null);

// Sorts the movements of one day by their source, in the order of sourceOrder. A source that is
// not in it goes last. Each movement of a paired source (Cash) is followed by its partner (a
// Provisioned movement): the first one of the day with the same amount, and the same sign, that
// is not paired yet. A partner with no pair keeps its own place in the order. Movements with
// the same source keep the order they had. kept: pairs that stay together whatever their
// amounts (a changed Cash movement and the Provisioned movement that was right below it).
function sortDay(rows, { sourceOrder, sourcePairs }, kept = new Map()) {
  const rank = (row) => {
    const place = sourceOrder.indexOf(text(row[0]));
    return place === -1 ? sourceOrder.length : place;
  };
  const partners = new Map();
  const paired = new Set();
  for (const [row, partner] of kept) {
    if (!rows.includes(row) || !rows.includes(partner)) continue;
    paired.add(partner);
    partners.set(row, partner);
  }
  for (const row of rows) {
    const source = text(row[0]);
    if (partners.has(row) || !Object.hasOwn(sourcePairs, source)) continue;
    const partner = rows.find(
      (other) =>
        !paired.has(other) &&
        text(other[0]) === sourcePairs[source] &&
        centsOf(other[4]) !== null &&
        centsOf(other[4]) === centsOf(row[4]),
    );
    if (!partner) continue;
    paired.add(partner);
    partners.set(row, partner);
  }
  return rows
    .filter((row) => !paired.has(row))
    .sort((a, b) => rank(a) - rank(b))
    .flatMap((row) => (partners.has(row) ? [row, partners.get(row)] : [row]));
}

// Sorts movement rows by day, and each day by its sources (see sortDay).
export function sortMovements(rows, settings, kept) {
  const days = [];
  for (const row of [...rows].sort((a, b) => dayOf(a) - dayOf(b))) {
    if (days.length === 0 || dayOf(days.at(-1)[0]) !== dayOf(row)) days.push([]);
    days.at(-1).push(row);
  }
  return days.flatMap((day) => sortDay(day, settings, kept));
}

// The rows that change when newRow is saved. rows are the rows of the sheet from the first
// movement row down. The movements are the rows down to the last one with a date. The new
// movement's day and every later day are sorted again; the days before it do not change.
// Returns { start, rows }: the first row that changes (counted from the first movement row,
// from 0), and the rows to write from there, down to one row past the last movement.
export function planSave(rows, newRow, settings) {
  const movements = rows.slice(0, rows.findLastIndex((row) => dayOf(row) !== null) + 1);
  const found = movements.findIndex((row) => dayOf(row) >= dayOf(newRow));
  const start = found === -1 ? movements.length : found;
  return { start, rows: sortMovements([...movements.slice(start), newRow], settings) };
}

// The rows that change when the movement at index is changed into newRow. rows are the rows of
// the sheet from the first movement row down, and index counts from there, from 0.
// - With the same day and source, the movement keeps its place among the movements of its day,
//   and a Cash movement and the Provisioned movement right below it stay together.
// - Otherwise it goes after the movements of its source on its new day.
// The old and the new day, and every day after the earlier of them, are sorted again. The sheet
// keeps its number of rows. Returns { start, rows }: the first row that changes, and the rows to
// write from there.
export function planEdit(rows, index, newRow, settings) {
  const movements = rows.slice(0, rows.findLastIndex((row) => text(row[1]) !== '') + 1);
  const old = movements[index];
  const inPlace = dayOf(old) === dayOf(newRow) && text(old[0]) === text(newRow[0]);
  // A changed movement that stays in its place keeps its pair: a Cash movement the Provisioned
  // movement right below it, and a Provisioned movement the Cash movement right above it.
  const kept = new Map();
  const pairs = (cash, partner) =>
    cash &&
    partner &&
    settings.sourcePairs[text(cash[0])] === text(partner[0]) &&
    dayOf(cash) === dayOf(partner);
  const above = movements[index - 1];
  const below = movements[index + 1];
  if (inPlace && pairs(old, below)) kept.set(newRow, below);
  if (inPlace && pairs(above, old)) kept.set(above, newRow);
  const list = inPlace
    ? movements.map((row, at) => (at === index ? newRow : row))
    : [...movements.filter((row, at) => at !== index), newRow];
  const first = Math.min(dayOf(old), dayOf(newRow));
  const start = movements.findIndex((row) => dayOf(row) >= first);
  return { start, rows: sortMovements(list.slice(start), settings, kept) };
}

// An amount in cents, cut toward 0 without rounding: 12.345 → 1234, −12.345 → −1234. The small
// rounding first keeps 12.34 at 1234, although the computer keeps it as 12.33999…
export const cutToCents = (amount) => Math.trunc(Math.round(amount * 1e6) / 1e4);

// The sheet's day number → the date as the form writes it ("2026-10-05"), without the time.
const SHEET_START = Date.UTC(1899, 11, 30);
const dateOf = (day) =>
  typeof day === 'number'
    ? new Date(SHEET_START + Math.floor(day) * 86_400_000).toISOString().slice(0, 10)
    : '';

// What the form shows for a movement row: the same values the form gives (see movementRow). The
// amount is cut to two decimals; 0 shows with "−", like a new movement.
export function formValues([source, date, category, concept, amount]) {
  const cents = typeof amount === 'number' ? cutToCents(amount) : 0;
  return {
    source: text(source),
    date: dateOf(date),
    category: text(category),
    concept: text(concept),
    digits: String(Math.abs(cents)),
    sign: cents > 0 ? 'plus' : 'minus',
  };
}

// True when the form's values describe the movement row as it is. Spaces at the ends of the
// concept, and the time of day of the date, do not count. An amount with more than two decimals
// is always a change: the form shows it cut.
export function sameMovement(row, values) {
  const [source, day, category, concept, amount] = movementRow(values);
  return (
    source === text(row[0]) &&
    day === dayOf(row) &&
    category === text(row[2]) &&
    concept === text(row[3]) &&
    typeof row[4] === 'number' &&
    !hasExtraDecimals(row[4]) &&
    Math.round(amount * 100) === Math.round(row[4] * 100)
  );
}

// The movement row of what was typed in the form. The amount is the typed numbers, with the
// last two as cents, below 0 when the sign switch is on "−". Spaces around the concept go away.
export function movementRow({ source, date, category, concept, digits, sign }) {
  const amount = Number(digits) / 100;
  return [source, sheetDay(date), category, text(concept), sign === 'minus' ? -amount : amount];
}

// The required fields that are empty, in the order of the form. The concept may be empty.
export function missingFields({ source, date, category, digits }) {
  return Object.entries({ source, date, category, amount: digits })
    .filter(([, value]) => !text(value))
    .map(([name]) => name);
}

// An empty row of the five movement columns.
const EMPTY = ['', '', '', '', ''];

// The rows that change when the movements at indexes are deleted. rows are the rows of the
// sheet from the first movement row down, and indexes count from there, from 0. Every
// movement below a deleted one moves up, in the same order, and the last rows become empty, so
// the sheet keeps its number of rows. Rows below the last movement do not change.
// Returns { start, rows }: the first deleted row, and the rows to write from there.
export function planDelete(rows, indexes) {
  // A date can also be a formula here (the rows come with their formulas), so every row down
  // to the last one with anything in its date cell is a movement.
  const movements = rows.slice(0, rows.findLastIndex((row) => text(row[1]) !== '') + 1);
  const deleted = new Set(indexes);
  const start = Math.min(...indexes);
  const kept = movements.slice(start).filter((row, index) => !deleted.has(start + index));
  return { start, rows: [...kept, ...indexes.map(() => EMPTY)] };
}

// The five cells of a movement row as text, with a missing cell the same as an empty one:
// Google leaves out the empty cells at the end of a row.
const cellsOf = (row = []) => EMPTY.map((empty, index) => String(row[index] ?? empty));

// True when every row at indexes in now still holds the movement that was in seen.
export function sameMovements(seen, now, indexes) {
  return indexes.every(
    (index) =>
      index < now.length &&
      cellsOf(seen[index]).join('\u0000') === cellsOf(now[index]).join('\u0000'),
  );
}

// The first row of a range such as "Movements!A2:E" (2). A range of whole columns, such as
// "Movements!A:E", starts at row 1.
export function firstRowOf(range) {
  const match = /^(?:.*!)?[A-Z]+(\d+)?/.exec(range);
  return Number(match?.[1] ?? 1);
}
