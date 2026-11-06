import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TABLES, readAppSheet } from '../../src/app-sheet.js';

// The App sheet (issue #122): tables side by side, with their titles in row 1, the headers in
// row 2, and one item per row from row 3 down. The rows come as Google sends them: each row is a
// list of cells from column A, and the empty cells at the end of a row are left out.

const CATEGORIES_HEADERS = ['Category', 'Description has', 'Icon', 'Color'];

test('the five tables of this work have these titles', () => {
  assert.deepEqual(TABLES, ['CATEGORIES', 'SOURCES', 'GOAL', 'GOAL LEAVE OUT', 'CELLS']);
});

test('an empty App sheet has no tables and no mistakes', () => {
  assert.deepEqual(readAppSheet([]), { tables: {}, mistakes: [] });
});

test('each table starts at its title and covers the columns up to the next title', () => {
  const { tables, mistakes } = readAppSheet([
    ['CATEGORIES', '', '', '', '', 'SOURCES'],
    [...CATEGORIES_HEADERS, '', 'Source', 'Icon'],
    ['Car', '', 'car', '#2f6fd6', '', 'AMEX', 'card'],
    ['Yoshi', '', 'paw', '#b8860b', '', 'Cash', 'cash', 'Provisioned'],
  ]);

  assert.deepEqual(mistakes, []);
  // The empty column E belongs to CATEGORIES, the table on its left.
  assert.deepEqual(tables.CATEGORIES, {
    column: 1,
    rows: [
      { row: 3, cells: ['Car', '', 'car', '#2f6fd6', ''] },
      { row: 4, cells: ['Yoshi', '', 'paw', '#b8860b', ''] },
    ],
  });
  assert.deepEqual(tables.SOURCES, {
    column: 6,
    rows: [
      { row: 3, cells: ['AMEX', 'card'] },
      { row: 4, cells: ['Cash', 'cash', 'Provisioned'] },
    ],
  });
});

test('the header row is never an item, even when it is empty', () => {
  const { tables } = readAppSheet([['CELLS'], [], ['Total - bank', 'Briefing!E7']]);

  assert.deepEqual(tables.CELLS.rows, [{ row: 3, cells: ['Total - bank', 'Briefing!E7'] }]);
});

test('a title is found whatever its capital letters and the spaces around it', () => {
  const { tables } = readAppSheet([['  goal leave out ', 'Goal'], [], ['Salary', 'From']]);

  // The title must fill the cell on its own: "GOAL LEAVE OUT" is never read as "GOAL".
  assert.deepEqual(tables['GOAL LEAVE OUT'], { column: 1, rows: [{ row: 3, cells: ['Salary'] }] });
  assert.deepEqual(tables.GOAL, { column: 2, rows: [{ row: 3, cells: ['From'] }] });
});

test('empty rows are skipped, and a cell with only spaces counts as empty', () => {
  const { tables, mistakes } = readAppSheet([
    ['CATEGORIES'],
    CATEGORIES_HEADERS,
    ['Car'],
    [],
    ['  ', ' '],
    ['Yoshi'],
  ]);

  assert.deepEqual(mistakes, []);
  assert.deepEqual(
    tables.CATEGORIES.rows.map(({ row }) => row),
    [3, 6],
  );
});

test('a number in a cell is not empty: 0 counts too', () => {
  const { tables } = readAppSheet([['GOAL'], [], ['Limit', 0]]);

  assert.deepEqual(tables.GOAL.rows, [{ row: 3, cells: ['Limit', 0] }]);
});

test('a row with an empty first column but other cells filled is a mistake', () => {
  const { mistakes } = readAppSheet([['CATEGORIES'], ['Category', 'Icon'], ['', 'car']]);

  assert.deepEqual(mistakes, [{ kind: 'firstColumnEmpty', table: 'CATEGORIES', row: 3 }]);
});

test('a first column with only spaces is empty too', () => {
  const { mistakes } = readAppSheet([['CATEGORIES'], [], ['   ', 'car']]);

  assert.deepEqual(mistakes, [{ kind: 'firstColumnEmpty', table: 'CATEGORIES', row: 3 }]);
});

test('a text in the empty column between two tables belongs to the table on its left', () => {
  const { mistakes } = readAppSheet([
    ['CATEGORIES', '', '', '', '', 'SOURCES'],
    [],
    ['', '', '', '', 'note'],
  ]);

  assert.deepEqual(mistakes, [{ kind: 'firstColumnEmpty', table: 'CATEGORIES', row: 3 }]);
});

test('the header row is not checked for an empty first column', () => {
  const { mistakes } = readAppSheet([['CATEGORIES'], ['', 'Description has']]);

  assert.deepEqual(mistakes, []);
});

test('a table with a title that is not one of the five is not checked', () => {
  const { tables, mistakes } = readAppSheet([['NOTES'], [], ['', 'remember the milk']]);

  assert.deepEqual(mistakes, []);
  assert.equal(tables.NOTES, undefined);
});

test('a title that is there twice is a mistake for the second one, with its column', () => {
  const { mistakes } = readAppSheet([['CATEGORIES', '', '', '', '', 'categories ']]);

  assert.deepEqual(mistakes, [{ kind: 'tableTwice', table: 'CATEGORIES', column: 'F' }]);
});

test('a title twice is a mistake also for a table the app does not read, and for each copy', () => {
  const { mistakes } = readAppSheet([['NOTES', 'NOTES', 'NOTES']]);

  assert.deepEqual(mistakes, [
    { kind: 'tableTwice', table: 'NOTES', column: 'B' },
    { kind: 'tableTwice', table: 'NOTES', column: 'C' },
  ]);
});

test('the first copy of a title is the table the app reads', () => {
  const { tables } = readAppSheet([
    ['CELLS', '', 'CELLS'],
    [],
    ['Total - bank', 'Briefing!E7', 'Total - cash', 'Briefing!K7'],
  ]);

  assert.deepEqual(tables.CELLS.rows, [{ row: 3, cells: ['Total - bank', 'Briefing!E7'] }]);
});

test('a filled cell on the left of the first title is not in any table', () => {
  const { mistakes } = readAppSheet([['', '', 'CATEGORIES'], ['a note'], ['', 'x', 'Car']]);

  assert.deepEqual(mistakes, [
    { kind: 'notInTable', cell: 'A2' },
    { kind: 'notInTable', cell: 'B3' },
  ]);
});

test('with no title at all, every filled cell is not in any table', () => {
  const { mistakes } = readAppSheet([[], [], ['', '', 'Car']]);

  assert.deepEqual(mistakes, [{ kind: 'notInTable', cell: 'C3' }]);
});

test('the mistakes go from the top of the sheet down, and from left to right in a row', () => {
  const { mistakes } = readAppSheet([
    ['', 'CATEGORIES', '', '', '', '', 'CATEGORIES'],
    [],
    ['note', '', 'car'],
    [],
    ['x'],
  ]);

  assert.deepEqual(mistakes, [
    { kind: 'tableTwice', table: 'CATEGORIES', column: 'G' },
    { kind: 'notInTable', cell: 'A3' },
    { kind: 'firstColumnEmpty', table: 'CATEGORIES', row: 3 },
    { kind: 'notInTable', cell: 'A5' },
  ]);
});

test('columns after Z are named like the sheet names them: AA, AB, …', () => {
  const row1 = new Array(28).fill('');
  row1[0] = 'CELLS';
  row1[27] = 'CELLS';

  assert.deepEqual(readAppSheet([row1]).mistakes, [
    { kind: 'tableTwice', table: 'CELLS', column: 'AB' },
  ]);
});
