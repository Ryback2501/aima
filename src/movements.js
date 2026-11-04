// What happens to the movements of the sheet when a new one is saved or some are deleted: the
// rules that sort them, the rows that change, and the checks of the form. It only works with
// values. It does not read the sheet or touch the page.
//
// A movement row is: source, date (the sheet's day number), category, concept, amount.

import { dayNumber } from './goal.js';

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
// the same source keep the order they had.
function sortDay(rows, { sourceOrder, sourcePairs }) {
  const rank = (row) => {
    const place = sourceOrder.indexOf(text(row[0]));
    return place === -1 ? sourceOrder.length : place;
  };
  const partners = new Map();
  const paired = new Set();
  for (const row of rows) {
    const source = text(row[0]);
    if (!Object.hasOwn(sourcePairs, source)) continue;
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
export function sortMovements(rows, settings) {
  const days = [];
  for (const row of [...rows].sort((a, b) => dayOf(a) - dayOf(b))) {
    if (days.length === 0 || dayOf(days.at(-1)[0]) !== dayOf(row)) days.push([]);
    days.at(-1).push(row);
  }
  return days.flatMap((day) => sortDay(day, settings));
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
  const movements = rows.slice(0, rows.findLastIndex((row) => dayOf(row) !== null) + 1);
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
