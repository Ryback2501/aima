// The App sheet: the app's settings, in tables side by side (issue #122).
//
// - Row 1 holds the titles. A table starts at the column of its title and covers the columns to
//   its right, up to the column before the next title. An empty column between two tables
//   belongs to the table on its left.
// - Row 2 is the header row: it is only for people, the app does not read it.
// - From row 3 down, one item per row. Empty rows are skipped. A cell with only spaces is empty.
//
// readAppSheet finds the tables and lists the mistakes in the layout. Each table's settings are
// read by a reader, given by the part of the app that uses them (for example categories.js).

// The titles of the tables of the App sheet. A table with another title is ignored.
export const TABLES = ['CATEGORIES', 'SOURCES', 'GOAL', 'GOAL LEAVE OUT', 'CELLS'];

// The rows read from Google start at row 1, and the items start at row 3.
const FIRST_ITEM_ROW = 3;

const isEmpty = (cell) => cell === undefined || cell === null || String(cell).trim() === '';

// A title is found whatever its capital letters and the spaces around it.
const titleOf = (cell) => String(cell).trim().toUpperCase();

// The name the sheet gives a column: 1 → A, 26 → Z, 27 → AA.
function columnName(column) {
  let name = '';
  for (let rest = column; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
  }
  return name;
}

// rows: the rows of the App sheet as Google sends them (each row from column A; empty cells at
// the end of a row are left out). readers: for each title of TABLES the app reads, a function
// that gets its table and returns { value, mistakes }: its settings, and what is wrong in them,
// each mistake with its row. Returns:
// - tables: for each title of TABLES that is there (its first copy), the column where it
//   starts (1 for A) and its items: { row, cells }, with the cells of its columns only.
// - mistakes: from the top of the sheet down, and from left to right in a row. Each one has its
//   kind, and for each kind:
//   - firstColumnEmpty: { table, row } - an item with no name;
//   - tableTwice: { table, column } - the second (or later) copy of a title;
//   - notInTable: { cell } - a filled cell on the left of the first title;
//   - the mistakes of the readers, with their rows (a mistake about something missing from a
//     table has no row: these come after the others);
//   - tableMissing: { table } - a table with a reader is not there. These come last.
// - settings: for each reader whose table is there, its value.
export function readAppSheet(rows, readers = {}) {
  // The widest row. A loop, not Math.max(...rows): a very tall sheet has too many rows for that.
  const width = rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  const cell = (row, column) => rows[row - 1]?.[column - 1];

  // The titles in row 1, from left to right, each with the columns of its table.
  const titles = [];
  for (let column = 1; column <= width; column += 1) {
    if (!isEmpty(cell(1, column))) titles.push({ title: titleOf(cell(1, column)), column });
  }
  titles.forEach((each, index) => (each.last = (titles[index + 1]?.column ?? width + 1) - 1));

  const found = [];
  const seen = new Set();
  const tables = {};
  for (const { title, column, last } of titles) {
    if (seen.has(title)) {
      found.push({ kind: 'tableTwice', table: title, column: columnName(column), at: [1, column] });
      continue;
    }
    seen.add(title);
    if (!TABLES.includes(title)) continue;
    const items = [];
    for (let row = FIRST_ITEM_ROW; row <= rows.length; row += 1) {
      // The cells of the table's columns, as Google sent them.
      const cells = (rows[row - 1] ?? []).slice(column - 1, last);
      if (cells.every(isEmpty)) continue;
      if (isEmpty(cells[0])) {
        found.push({ kind: 'firstColumnEmpty', table: title, row, at: [row, column] });
      } else {
        items.push({ row, cells });
      }
    }
    tables[title] = { column, rows: items };
  }

  // Cells on the left of the first title are not in any table. Without any title, every cell.
  const firstColumn = titles[0]?.column ?? width + 1;
  rows.forEach((row, index) => {
    for (let column = 1; column < firstColumn; column += 1) {
      if (!isEmpty(row[column - 1])) {
        found.push({
          kind: 'notInTable',
          cell: `${columnName(column)}${index + 1}`,
          at: [index + 1, column],
        });
      }
    }
  });

  // Each table with a reader gives its settings and its own mistakes.
  const settings = {};
  const missing = [];
  for (const [title, reader] of Object.entries(readers)) {
    const table = tables[title];
    if (!table) {
      missing.push({ kind: 'tableMissing', table: title });
      continue;
    }
    const { value, mistakes } = reader(table);
    settings[title] = value;
    // A mistake with no row (something missing from the table) comes after the ones with a row.
    for (const mistake of mistakes) {
      found.push({ ...mistake, at: [mistake.row ?? Infinity, table.column] });
    }
  }

  // at: the row and the column of each mistake, only to sort them. Two mistakes with no row are
  // sorted by their column (Infinity - Infinity is not a number, so the row does not decide).
  found.sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1]);
  for (const mistake of found) delete mistake.at;
  return { tables, settings, mistakes: [...found, ...missing] };
}
