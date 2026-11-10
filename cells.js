// The cells the app uses, from the CELLS table of the App sheet (issue #126).
//
// The table has the columns Name and Cell, and exactly these rows, in any order. The names do not
// care about capital letters or the spaces around them.
// - Total - bank, Total - cards, Total - provisioned and Total - cash: the cells of the parts of
//   the Total. Each one must be a cell of the document.
// - Movements sheet: the name of the sheet with the movements, in the columns A to E. It must be
//   a sheet of the document, with the same capital letters.
// - First movement row: the row of the first movement, under the headers: a whole number, 1 or
//   more.
// - Source list and Category list: the cells whose dropdown lists the new movement form uses.
//   They are read only when the form opens, and the form says when they cannot be read, so they
//   are not checked here.
// A cell is written the way Google Sheets writes it: Briefing!E7, or 'My sheet'!A1 for a sheet
// name with spaces or other signs.

// The parts of the Total, as config.pills names them.
const PARTS = ['bank', 'cards', 'provisioned', 'cash'];
const TOTAL = (part) => `Total - ${part}`;
// The names of the rows, written as in the lines about mistakes, in this order.
const NAMES = [
  ...PARTS.map(TOTAL),
  'Movements sheet',
  'First movement row',
  'Source list',
  'Category list',
];

// A cell as a text, without the spaces around it ('' when it is empty).
const textOf = (cell) => (cell === undefined || cell === null ? '' : String(cell).trim());

// One cell of a sheet: the sheet's name, plain or between quotes (where a quote is written
// twice), "!", the column letters and the row number.
const CELL = /^(?:'((?:[^']|'')+)'|([^'!\s]+))!([A-Za-z]{1,3})([1-9]\d*)$/;

// True when the text is one cell of one of the sheets, inside the sheet's size.
function isInDocument(text, sheets) {
  const match = CELL.exec(text);
  if (!match) return false;
  const [, quoted, plain, letters, row] = match;
  const name = quoted === undefined ? plain : quoted.replaceAll("''", "'");
  // A → 1, Z → 26, AA → 27.
  let column = 0;
  for (const letter of letters.toUpperCase()) column = column * 26 + letter.charCodeAt(0) - 64;
  const sheet = sheets.find(({ title }) => title === name);
  return Boolean(sheet) && column <= sheet.columnCount && Number(row) <= sheet.rowCount;
}

// A sheet name as it is written in a range: between quotes, with each quote written twice,
// unless it has only letters, digits and "_".
const rangeName = (sheet) =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(sheet) ? sheet : `'${sheet.replaceAll("'", "''")}'`;

// Reads the CELLS table (see app-sheet.js). sheets: the sheets of the document, from
// getSheets in sheets.js. Returns { value, mistakes }. value has:
// - totals: the cell of each part of the Total, by its name in config.pills;
// - sheet and firstRow: the movements sheet and its first movement row;
// - movements: the range the goal reads, the whole columns A to E of the movements sheet;
// - rows: the range the save reads, from the first movement row;
// - sourceList and categoryList: the cells of the form's lists.
// Only the first row of each name counts.
export function readCells(table, sheets) {
  const TABLE = 'CELLS';
  const mistakes = [];
  const mistake = (kind, details) => mistakes.push({ kind, table: TABLE, ...details });
  // The first row of each name: { row, cell }.
  const found = new Map();
  for (const { row, cells } of table.rows) {
    const name = NAMES.find((each) => each.toLowerCase() === textOf(cells[0]).toLowerCase());
    if (!name) {
      mistake('unknownName', { row, name: textOf(cells[0]) });
      continue;
    }
    if (found.has(name)) {
      mistake('settingTwice', { row, setting: name });
      continue;
    }
    found.set(name, { row, cell: cells[1] });
  }

  // The Cell of each name that is valid.
  const valid = {};
  for (const name of NAMES) {
    if (!found.has(name)) {
      mistake('settingMissing', { setting: name });
      continue;
    }
    const { row, cell } = found.get(name);
    const text = textOf(cell);
    if (text === '') {
      mistake('emptyCell', { row, setting: name });
    } else if (name === 'First movement row') {
      if (Number.isInteger(cell) && cell >= 1) valid[name] = cell;
      else mistake('badFirstRow', { row });
    } else if (name === 'Movements sheet') {
      if (sheets.some(({ title }) => title === text)) valid[name] = text;
      else mistake('noSuchSheet', { row, name: text });
    } else if (name.startsWith('Total')) {
      if (isInDocument(text, sheets)) valid[name] = text;
      else mistake('noSuchCell', { row, cell: text });
    } else {
      valid[name] = text;
    }
  }

  const sheet = valid['Movements sheet'];
  const firstRow = valid['First movement row'];
  const where = sheet === undefined ? undefined : rangeName(sheet);
  const value = {
    totals: Object.fromEntries(PARTS.map((part) => [part, valid[TOTAL(part)]])),
    sheet,
    firstRow,
    movements: where && `${where}!A:E`,
    rows: where && firstRow && `${where}!A${firstRow}:E`,
    sourceList: valid['Source list'],
    categoryList: valid['Category list'],
  };
  return { value, mistakes };
}
