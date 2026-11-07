import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readCells } from '../../src/cells.js';

// The cells the app uses, from the CELLS table of the App sheet (issue #126). The table has the
// columns Name and Cell.

// A table as readAppSheet gives it (app-sheet.js): its items, each with its row in the sheet.
const table = (...cells) => ({
  column: 16,
  rows: cells.map((each, index) => ({ row: index + 3, cells: each })),
});

// The sheets of the document, as the sheets client lists them.
const SHEETS = [
  { title: 'App', sheetId: 1, rowCount: 1000, columnCount: 26 },
  { title: 'Briefing', sheetId: 2, rowCount: 1000, columnCount: 26 },
  { title: 'Movements', sheetId: 3, rowCount: 5000, columnCount: 8 },
  { title: 'My sheet', sheetId: 4, rowCount: 10, columnCount: 5 },
  { title: "Ana's", sheetId: 5, rowCount: 10, columnCount: 5 },
];

// The rows the issue asks to copy, so the app uses the same cells as before.
const CELLS = [
  ['Total - bank', 'Briefing!E7'],
  ['Total - cards', 'Briefing!B10'],
  ['Total - provisioned', 'Briefing!I7'],
  ['Total - cash', 'Briefing!K7'],
  ['Movements sheet', 'Movements'],
  ['First movement row', 2],
  ['Source list', 'Movements!A2'],
  ['Category list', 'Movements!C2'],
];
// CELLS with the Cell of one name changed.
const cellsWith = (name, cell) => CELLS.map((row) => (row[0] === name ? [name, cell] : row));
// The row of each name in CELLS (the first one is row 3).
const rowOf = (name) => CELLS.findIndex(([each]) => each === name) + 3;

const cellsOf = (rows, sheets = SHEETS) => {
  const { value, mistakes } = readCells(table(...rows), sheets);
  assert.deepEqual(mistakes, []);
  return value;
};
const mistakesOf = (rows, sheets = SHEETS) => readCells(table(...rows), sheets).mistakes;

test('with the copied rows, the app uses the same cells as before', () => {
  assert.deepEqual(cellsOf(CELLS), {
    totals: {
      bank: 'Briefing!E7',
      cards: 'Briefing!B10',
      provisioned: 'Briefing!I7',
      cash: 'Briefing!K7',
    },
    sheet: 'Movements',
    firstRow: 2,
    // The goal reads the whole columns; the save reads from the first movement row.
    movements: 'Movements!A:E',
    rows: 'Movements!A2:E',
    sourceList: 'Movements!A2',
    categoryList: 'Movements!C2',
  });
});

test('the rows can be in any order; capital letters and spaces around the name do not matter', () => {
  const rows = [...CELLS]
    .reverse()
    .map(([name, cell], index) => [
      index % 2 ? `  ${name.toUpperCase()} ` : name.toLowerCase(),
      cell,
    ]);

  assert.deepEqual(cellsOf(rows), cellsOf(CELLS));
});

test('spaces around a cell, a sheet name or the first row do not matter', () => {
  const value = cellsOf(
    cellsWith('Total - cash', '  Briefing!K7 ').map((row) =>
      row[0] === 'Movements sheet' ? ['Movements sheet', ' Movements  '] : row,
    ),
  );

  assert.equal(value.totals.cash, 'Briefing!K7');
  assert.equal(value.sheet, 'Movements');
});

test('another Total - cash cell is used for the cash part', () => {
  assert.equal(cellsOf(cellsWith('Total - cash', 'Briefing!C3')).totals.cash, 'Briefing!C3');
});

test('another movements sheet and first row change where the goal reads and the save writes', () => {
  const value = cellsOf(
    cellsWith('Movements sheet', 'My sheet').map((row) =>
      row[0] === 'First movement row' ? ['First movement row', 4] : row,
    ),
  );

  assert.equal(value.sheet, 'My sheet');
  assert.equal(value.firstRow, 4);
  // A sheet name with a space is written between quotes, as the sheet writes it.
  assert.equal(value.movements, "'My sheet'!A:E");
  assert.equal(value.rows, "'My sheet'!A4:E");
});

test('a quote in the name of the movements sheet is written twice, as the sheet does', () => {
  const value = cellsOf(cellsWith('Movements sheet', "Ana's"));

  assert.equal(value.movements, "'Ana''s'!A:E");
  assert.equal(value.rows, "'Ana''s'!A2:E");
});

test('a cell of a sheet whose name needs quotes, written the way the sheet writes it, is valid', () => {
  assert.equal(cellsOf(cellsWith('Total - cash', "'My sheet'!E10")).totals.cash, "'My sheet'!E10");
  assert.equal(cellsOf(cellsWith('Total - cash', "'Ana''s'!A1")).totals.cash, "'Ana''s'!A1");
  // Quotes around a name that does not need them are fine too.
  assert.equal(cellsOf(cellsWith('Total - cash', "'Briefing'!K7")).totals.cash, "'Briefing'!K7");
});

test('another Category list cell is used for the form, and it is not checked against the sheets', () => {
  // The lists are read only when the form opens: if they cannot be read, the form says so.
  assert.equal(cellsOf(cellsWith('Category list', 'Lists!B1')).categoryList, 'Lists!B1');
  assert.equal(cellsOf(cellsWith('Source list', 'Nowhere!A1')).sourceList, 'Nowhere!A1');
});

test('a missing name is a mistake, with no row, in the order of the table', () => {
  assert.deepEqual(mistakesOf(CELLS.filter(([name]) => name !== 'Total - bank')), [
    { kind: 'settingMissing', table: 'CELLS', setting: 'Total - bank' },
  ]);
  assert.deepEqual(
    mistakesOf([]).map(({ setting }) => setting),
    CELLS.map(([name]) => name),
  );
});

test('a name there twice is a mistake on the lower row; the first one counts', () => {
  const { value, mistakes } = readCells(table(...CELLS, ['source list', 'Nowhere!B2']), SHEETS);

  assert.deepEqual(mistakes, [
    { kind: 'settingTwice', table: 'CELLS', row: 11, setting: 'Source list' },
  ]);
  assert.equal(value.sourceList, 'Movements!A2');
});

test('a row with another name is a mistake', () => {
  assert.deepEqual(mistakesOf([...CELLS, ['Totl - bank', 'Briefing!E7']]), [
    { kind: 'unknownName', table: 'CELLS', row: 11, name: 'Totl - bank' },
  ]);
});

test('First movement row that is not a whole number of 1 or more is a mistake', () => {
  for (const value of ['two', '2', 0, -1, 2.5, { day: 46000, text: '10/12/2025' }, Infinity]) {
    assert.deepEqual(
      mistakesOf(cellsWith('First movement row', value)),
      [{ kind: 'badFirstRow', table: 'CELLS', row: rowOf('First movement row') }],
      String(value),
    );
  }
});

test('an empty Cell is a mistake, whatever the name', () => {
  for (const [name] of CELLS) {
    for (const empty of [undefined, '', '   ']) {
      assert.deepEqual(
        mistakesOf(cellsWith(name, empty)),
        [{ kind: 'emptyCell', table: 'CELLS', row: rowOf(name), setting: name }],
        `${name}: ${JSON.stringify(empty)}`,
      );
    }
  }
});

test('a Total cell that is not in the document is a mistake', () => {
  for (const cell of [
    // A sheet that does not exist.
    'Nowhere!A1',
    // No sheet name.
    'E7',
    // The name of the sheet with other capital letters.
    'briefing!E7',
    // A name with a space, without the quotes the sheet writes.
    'My sheet!A1',
    // Outside the sheet: it has 26 columns (A to Z) and 1000 rows.
    'Briefing!AA1',
    'Briefing!A1001',
    'Briefing!A0',
    // More than one cell, or not a cell at all.
    'Briefing!E7:E8',
    'Briefing!',
    'Briefing!7',
    'Briefing!E',
    4000,
  ]) {
    assert.deepEqual(
      mistakesOf(cellsWith('Total - cash', cell)),
      [{ kind: 'noSuchCell', table: 'CELLS', row: rowOf('Total - cash'), cell: String(cell) }],
      String(cell),
    );
  }
});

test('the last cell of a sheet is in the document', () => {
  assert.equal(cellsOf(cellsWith('Total - bank', 'Briefing!Z1000')).totals.bank, 'Briefing!Z1000');
});

test('a movements sheet that is not in the document is a mistake', () => {
  for (const sheet of ['Movementz', 'movements', "'Movements'", 'Movements!A:E']) {
    assert.deepEqual(
      mistakesOf(cellsWith('Movements sheet', sheet)),
      [{ kind: 'noSuchSheet', table: 'CELLS', row: rowOf('Movements sheet'), name: sheet }],
      sheet,
    );
  }
});

test('the mistakes of several rows come one per row, from the top', () => {
  const rows = cellsWith('Total - cash', 'Nowhere!A1').map((row) =>
    row[0] === 'First movement row' ? ['First movement row', 'two'] : row,
  );

  assert.deepEqual(mistakesOf(rows), [
    { kind: 'noSuchCell', table: 'CELLS', row: 6, cell: 'Nowhere!A1' },
    { kind: 'badFirstRow', table: 'CELLS', row: 8 },
  ]);
});
