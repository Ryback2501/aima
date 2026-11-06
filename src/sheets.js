// Reads data from the Google Sheet through the Google Sheets web API.
// Google checks the sheet's sharing settings on every request, so this is also how the app
// learns if the signed-in person may see the data. Google Drive tells if they may also edit it.
// The same client also writes new movements into the sheet.

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
// Asks for plain numbers and dates instead of the text the sheet shows (see getValues).
const RAW = 'valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';
// The same, but a cell with a formula gives its formula (see getValues).
const FORMULAS = 'valueRenderOption=FORMULA&dateTimeRenderOption=SERIAL_NUMBER';
// Plain numbers, but dates as the text the sheet shows (see getSheetRows).
const DATES_AS_TEXT = 'valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING';

// A cell of the sheet that holds a date (see getSheetRows): day is its day number (days since
// 30 December 1899; a time is the part after the point), text is what the sheet shows. Where a
// text is read, it is that text.
class DateCell {
  constructor(day, text) {
    this.day = day;
    this.text = text;
  }

  toString() {
    return this.text;
  }
}

// True when a cell from getSheetRows holds a date. A plain number, or a text that looks like a
// date, does not. It looks at the cell's day number, so a cell made in the same shape by hand
// (in the tests) counts too.
export const isDateCell = (cell) =>
  typeof cell === 'object' && cell !== null && Number.isFinite(cell.day);

// The person's Google account cannot open the sheet.
export class NoAccessError extends Error {
  constructor() {
    super('This Google account cannot open the sheet.');
    this.name = 'NoAccessError';
  }
}

// The sign-in is too old. The person must sign in again.
export class SignInExpiredError extends Error {
  constructor() {
    super('The sign-in has expired.');
    this.name = 'SignInExpiredError';
  }
}

// Any other problem: no internet, Google is down, and so on.
export class SheetsError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'SheetsError';
    this.status = status;
  }
}

// The document has no sheet with this name (see getSheetRows).
export class NoSuchSheetError extends SheetsError {
  constructor(sheet) {
    super(`The document has no sheet called ${sheet}.`, { status: 400 });
    this.name = 'NoSuchSheetError';
    this.sheet = sheet;
  }
}

export function createSheetsClient({ spreadsheetId, getToken, fetch = globalThis.fetch }) {
  const sheetUrl = `${API}/${encodeURIComponent(spreadsheetId)}`;

  // Sends a request to Google. With a body, it is a change (POST), sent as JSON.
  async function request(url, body) {
    const headers = { Authorization: `Bearer ${getToken()}` };
    const options = body
      ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } }
      : { headers };
    if (body) options.body = JSON.stringify(body);
    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      throw new SheetsError('Could not reach Google.', { cause: error });
    }
    if (response.status === 401) throw new SignInExpiredError();
    // Google answers 404 instead of 403 when the person may not even know the sheet exists.
    if (response.status === 403 || response.status === 404) throw new NoAccessError();
    if (!response.ok) {
      throw new SheetsError(`Google answered with error ${response.status}.`, {
        status: response.status,
      });
    }
    return response.json();
  }

  // Returns the rows of a range, for example "Sheet1!A1:C5". Empty cells at the end are left out.
  // Normally each cell comes as the text the sheet shows (for example "-12,50 €").
  // With raw, numbers come as plain numbers (-12.5) and dates as day numbers (days since
  // 30 December 1899), the same whatever the sheet's number and date format is.
  // With formulas, the same, but a cell with a formula gives its formula ("=10+2.5"), so it can
  // be written again as a formula.
  async function getValues(range, { raw = false, formulas = false } = {}) {
    let query = '';
    if (formulas) query = FORMULAS;
    else if (raw) query = RAW;
    return valuesOf(range, query);
  }

  // The rows of a range, with the values asked for in the query ('' for the text the sheet
  // shows).
  async function valuesOf(range, query) {
    const data = await request(
      `${sheetUrl}/values/${encodeURIComponent(range)}${query ? `?${query}` : ''}`,
    );
    return data.values ?? [];
  }

  // Returns the rows of a whole sheet, found by its name, as plain numbers (see getValues with
  // raw). A date cell is a DateCell, so it is never taken for a plain number or for a text that
  // looks like a date. To find the date cells, the sheet is read twice at the same time: with the
  // dates as day numbers, and with the dates as text. A cell that is a number in the first read
  // and a text in the second one holds a date.
  // The name is written between quotes, as the sheet writes it, so names with spaces work too.
  // Google answers 400 when it cannot find the sheet: then this fails with NoSuchSheetError.
  async function getSheetRows(name) {
    const range = `'${name.replaceAll("'", "''")}'`;
    try {
      const [rows, texts] = await Promise.all([
        valuesOf(range, RAW),
        valuesOf(range, DATES_AS_TEXT),
      ]);
      return rows.map((row, index) =>
        row.map((cell, column) => {
          const text = texts[index]?.[column];
          return typeof cell === 'number' && typeof text === 'string'
            ? new DateCell(cell, text)
            : cell;
        }),
      );
    } catch (error) {
      if (error instanceof SheetsError && error.status === 400) throw new NoSuchSheetError(name);
      throw error;
    }
  }

  // Reads several single cells in one request, for example ["Sheet1!A1", "Sheet1!B7"].
  // Returns one value per cell, in the same order: numbers as plain numbers, '' when empty.
  async function getCells(ranges) {
    const list = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
    const data = await request(`${sheetUrl}/values:batchGet?${list}&${RAW}`);
    return ranges.map((range, index) => data.valueRanges?.[index]?.values?.[0]?.[0] ?? '');
  }

  // True when the signed-in person may edit the sheet, false when they may only see it.
  async function canEdit() {
    const fields = encodeURIComponent('capabilities/canEdit');
    const data = await request(
      `${DRIVE_API}/${encodeURIComponent(spreadsheetId)}?fields=${fields}`,
    );
    return data.capabilities?.canEdit === true;
  }

  // Returns the options of the dropdown list in one cell, for example "Sheet1!A2", in their
  // order. The options are typed in the dropdown rule, or the rule takes them from other cells.
  // Fails with SheetsError when the cell has no dropdown list.
  async function getDropdown(cell) {
    const fields = 'sheets.data.rowData.values.dataValidation';
    const data = await request(`${sheetUrl}?ranges=${encodeURIComponent(cell)}&fields=${fields}`);
    const rule = data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation?.condition;
    const values = (rule?.values ?? []).map(({ userEnteredValue }) => userEnteredValue ?? '');
    let options = [];
    if (rule?.type === 'ONE_OF_LIST') {
      options = values;
    } else if (rule?.type === 'ONE_OF_RANGE' && values[0]) {
      // The rule says where the options are, like "=Lists!A1:A9". Without a sheet name, like
      // "=$H$2:$H$9", the cells are on the same sheet as the dropdown.
      const range = values[0].replace(/^=/, '');
      const sheet = cell.slice(0, cell.lastIndexOf('!') + 1);
      const rows = await getValues(range.includes('!') ? range : sheet + range);
      options = rows.flat().map(String);
    }
    options = options.map((option) => option.trim()).filter(Boolean);
    if (options.length === 0) throw new SheetsError(`The cell ${cell} has no dropdown list.`);
    return options;
  }

  // Returns the number Google gives a sheet of the file, found by its name, and how many rows
  // it has: { sheetId, rowCount }. Fails with SheetsError when there is no such sheet.
  async function getSheet(name) {
    const fields = encodeURIComponent('sheets.properties(sheetId,title,gridProperties.rowCount)');
    const data = await request(`${sheetUrl}?fields=${fields}`);
    const found = data.sheets?.find(({ properties }) => properties?.title === name)?.properties;
    if (!found) throw new SheetsError(`There is no sheet called ${name}.`);
    return { sheetId: found.sheetId, rowCount: found.gridProperties?.rowCount ?? 0 };
  }

  // Writes rows of five values into the first five columns of a sheet, from the row startRow
  // (counted from 0). Only the values change: each cell keeps its format. A formula ("=...")
  // stays a formula, and an empty value empties its cell. When the sheet has too few rows, rows
  // are added at its end first. Everything goes in one single request, so Google makes all of
  // it or none of it.
  async function writeRows({ sheetId, rowCount, startRow, rows }) {
    const endRow = startRow + rows.length;
    const requests = [];
    if (endRow > rowCount) {
      requests.push({ appendDimension: { sheetId, dimension: 'ROWS', length: endRow - rowCount } });
    }
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: startRow,
          endRowIndex: endRow,
          startColumnIndex: 0,
          endColumnIndex: 5,
        },
        rows: rows.map((row) => ({ values: [0, 1, 2, 3, 4].map((column) => cell(row[column])) })),
        fields: 'userEnteredValue',
      },
    });
    // Added rows have no format yet: they get the format of the last row that was there, so
    // dates still look like dates and amounts like amounts.
    if (endRow > rowCount) {
      requests.push({
        copyPaste: {
          source: { sheetId, startRowIndex: rowCount - 1, endRowIndex: rowCount },
          destination: { sheetId, startRowIndex: rowCount, endRowIndex: endRow },
          pasteType: 'PASTE_FORMAT',
        },
      });
    }
    await request(`${sheetUrl}:batchUpdate`, { requests });
  }

  return { getValues, getSheetRows, getCells, canEdit, getDropdown, getSheet, writeRows };
}

// One cell for writeRows: a number, a formula, a text, or nothing (an empty cell). A value
// { text } is always text, also when it starts with "=".
function cell(value) {
  if (typeof value === 'number') return { userEnteredValue: { numberValue: value } };
  if (typeof value === 'boolean') return { userEnteredValue: { boolValue: value } };
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'object') return { userEnteredValue: { stringValue: String(value.text) } };
  const text = String(value);
  if (text.startsWith('=')) return { userEnteredValue: { formulaValue: text } };
  return { userEnteredValue: { stringValue: text } };
}
