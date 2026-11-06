// The spending goal, from two tables of the App sheet (issue #125).
//
// - GOAL, with the columns Setting and Value, has exactly three rows, in any order: From and To
//   (date cells: the first and the last day that count) and Limit (a number above 0; spending
//   over it shows in red). The names of the settings do not care about capital letters or the
//   spaces around them.
// - GOAL LEAVE OUT, with the columns Category and Description, has the movements the goal leaves
//   out. A row with no description leaves out every movement of its category; a row with a
//   description leaves out only the movements of that category with exactly that description.
//   Names are matched with the same capital letters; spaces around them do not matter.

import { dateOf } from './goal.js';

// The settings of GOAL, written as in the lines about mistakes, in this order.
const SETTINGS = ['From', 'To', 'Limit'];

// A cell as a text, without the spaces around it ('' when it is empty).
const textOf = (cell) => (cell === undefined || cell === null ? '' : String(cell).trim());

// True when a cell is a date cell (see getSheetRows in sheets.js): a plain number or a text that
// looks like a date is not one.
const isDate = (cell) => typeof cell === 'object' && cell !== null && Number.isFinite(cell.day);

// Reads the GOAL table (see app-sheet.js). Returns { value, mistakes }. value has the settings
// goal.js uses: from and to as '2026-10-01' (a time in the cell does not matter), and limit.
export function readGoal(table) {
  const TABLE = 'GOAL';
  const mistakes = [];
  const mistake = (kind, details) => mistakes.push({ kind, table: TABLE, ...details });
  // The first row of each setting: { row, value }.
  const found = new Map();
  for (const { row, cells } of table.rows) {
    const setting = SETTINGS.find((name) => name.toLowerCase() === textOf(cells[0]).toLowerCase());
    if (!setting) {
      mistake('unknownSetting', { row, setting: textOf(cells[0]) });
      continue;
    }
    if (found.has(setting)) {
      mistake('settingTwice', { row, setting });
      continue;
    }
    found.set(setting, { row, value: cells[1] });
  }

  const value = {};
  for (const setting of SETTINGS) {
    if (!found.has(setting)) {
      mistake('settingMissing', { setting });
      continue;
    }
    const { row, value: cell } = found.get(setting);
    if (setting === 'Limit') {
      if (typeof cell === 'number' && Number.isFinite(cell) && cell > 0) value.limit = cell;
      else mistake('badLimit', { row });
    } else if (isDate(cell)) {
      value[setting.toLowerCase()] = dateOf(cell.day);
    } else {
      mistake('notADate', { row, setting });
    }
  }
  // Dates written as '2026-10-01' are in the same order as the days.
  if (value.from && value.to && value.from > value.to) {
    mistake('fromAfterTo', { row: found.get('From').row });
  }
  return { value, mistakes };
}

// Reads the GOAL LEAVE OUT table (see app-sheet.js). Returns { value, mistakes }, with no
// mistakes: any row is valid. value is what goal.js leaves out: categories, the categories left
// out as a whole, and descriptions, for each category, the descriptions left out.
export function readLeftOut(table) {
  const categories = [];
  const descriptions = new Map();
  for (const { cells } of table.rows) {
    const [category, description] = [0, 1].map((index) => textOf(cells[index]));
    if (!description) categories.push(category);
    else descriptions.set(category, [...(descriptions.get(category) ?? []), description]);
  }
  // Built from a list, so that any name, even an odd one, is kept as it is written.
  return { value: { categories, descriptions: Object.fromEntries(descriptions) }, mistakes: [] };
}
