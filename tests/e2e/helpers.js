import { readFile } from 'node:fs/promises';

const fakeGsi = readFile(new URL('./fake-gsi.js', import.meta.url), 'utf8');
const fakePicker = readFile(new URL('./fake-picker.js', import.meta.url), 'utf8');

export const FAKE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const FAKE_SHEET_ID = 'test-sheet-id';
export const FAKE_API_KEY = 'test-api-key';
// Made-up cells for the four parts of the Total, in the order of config.pills (as in CELLS_TABLE).
export const FAKE_CELLS = ['Sheet1!A1', 'Sheet1!A2', 'Sheet1!A3', 'Sheet1!A4'];
// The default amounts of those parts, and their sum as the app writes it in English.
export const FAKE_AMOUNTS = [1000, -200.5, 300, 50];
// 1000 - 200.50 - 300 (Provisioned is taken away) + 50
export const FAKE_TOTAL = '€549.50';
export const FAKE_MOVEMENTS = 'Sheet2!A:E';
// The made-up movements sheet: its name, its number, and the range the save reads (the rows
// under the headers).
const FAKE_SHEET = 'Sheet2';
const FAKE_SHEET_NUMBER = 7;
const FAKE_SAVE_RANGE = 'Sheet2!A2:E';
// The headers in the first row of the movements sheet.
const FAKE_HEADERS = ['Source', 'Date', 'Category', 'Concept', 'Amount'];
// Made-up cells whose dropdowns give the source and category lists of the new movement form.
export const FAKE_SOURCE_LIST = 'Sheet2!A2';
export const FAKE_CATEGORY_LIST = 'Sheet2!C2';
// The default dropdowns: the sources are typed in the rule, the categories come from cells.
export const FAKE_SOURCES = ['BBVA David', 'BBVA Común', 'Después', 'Cash', 'Provisioned'];
export const FAKE_CATEGORIES = ['Car', 'General', 'House', 'Leisure'];
export const FAKE_DROPDOWNS = {
  [FAKE_SOURCE_LIST]: {
    type: 'ONE_OF_LIST',
    values: FAKE_SOURCES.map((value) => ({ userEnteredValue: value })),
  },
  [FAKE_CATEGORY_LIST]: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: '=Lists!A1:A5' }] },
};
// The App sheet as the app asks for it: the whole sheet, by its name.
export const FAKE_APP_RANGE = "'App'";
// The tables of the tests' App sheet, each from row 1: its title, its headers, then its items.
// CATEGORIES has the rows of issue #123, SOURCES the rows of issue #124, GOAL and GOAL LEAVE OUT
// the rows of issue #125, and CELLS the cells the tests use (issue #126), as the app looked and
// worked before the settings moved to the sheet.
export const CATEGORIES_TABLE = [
  ['CATEGORIES'],
  ['Category', 'Description has', 'Icon', 'Color'],
  ['Car', '', 'car', '#2f6fd6'],
  ['Credit Cards', '', 'billTransfer', '#1296d6'],
  ['Debts paid', '', 'handshake', '#d9363e'],
  ['General', 'compra', 'cart', '#2b8a3e'],
  ['General', '', 'sackEuro', '#4b5563'],
  ['House', '', 'house', '#e8620c'],
  ['Investing', '', 'investing', '#0f8a8a'],
  ['Leisure', '', 'cocktail', '#b8338f'],
  ['Mortgage', '', 'housePie', '#c47d4a'],
  ['Salary', '', 'sackInHand', '#65a30d'],
  ['Traveling', '', 'suitcase', '#7a4fd6'],
  ['Whitening', '', 'pumpSoap', '#b06ad9'],
  ['Yoshi', '', 'paw', '#b8860b'],
];
export const SOURCES_TABLE = [
  ['SOURCES'],
  ['Source', 'Icon', 'Paired with'],
  ['BBVA David', 'bank'],
  ['BBVA Común', 'bank'],
  ['Después', 'card'],
  ['AMEX', 'card'],
  ['ECI', 'card'],
  ['ICON', 'card'],
  ['Pluxee', 'card'],
  ['Edenred', 'card'],
  ['Cash', 'cash', 'Provisioned'],
  ['Polina', 'bank'],
  ['Provisioned', 'bank'],
  ['Deprovisioned', 'bank'],
];
// A date cell of the App sheet is written { date: '2026-10-01' } in the tests (see appValues).
export const GOAL_TABLE = [
  ['GOAL'],
  ['Setting', 'Value'],
  ['From', { date: '2026-10-01' }],
  ['To', { date: '2026-12-31' }],
  ['Limit', 4000],
];
export const GOAL_LEAVE_OUT_TABLE = [
  ['GOAL LEAVE OUT'],
  ['Category', 'Description'],
  ['Whitening'],
  ['Salary'],
  ['Mortgage'],
  ['Credit Cards'],
  ['Investing'],
  ['House', 'Seguro hogar BBVA'],
  ['House', 'Pepephone - Internet'],
  ['House', 'Impuesto vivienda'],
  ['House', 'Comunidad'],
  ['House', 'Luz - Endesa'],
  ['House', 'Gas - Endesa'],
];
export const CELLS_TABLE = [
  ['CELLS'],
  ['Name', 'Cell'],
  ['Total - bank', 'Sheet1!A1'],
  ['Total - cards', 'Sheet1!A2'],
  ['Total - provisioned', 'Sheet1!A3'],
  ['Total - cash', 'Sheet1!A4'],
  ['Movements sheet', 'Sheet2'],
  ['First movement row', 2],
  ['Source list', 'Sheet2!A2'],
  ['Category list', 'Sheet2!C2'],
];

// Puts tables side by side, as in the App sheet: each one as wide as its headers, with one
// empty column after it.
export function sideBySide(...tables) {
  const height = Math.max(...tables.map((table) => table.length));
  return Array.from({ length: height }, (_, index) =>
    tables.flatMap((table) => {
      const row = table[index] ?? [];
      return Array.from({ length: table[1].length + 1 }, (__, column) => row[column] ?? '');
    }),
  );
}

// The App sheet of the tests: CATEGORIES in the columns A to D, SOURCES in F to H, GOAL in J and
// K, GOAL LEAVE OUT in M and N, and CELLS in P and Q.
export const FAKE_APP_SHEET = sideBySide(
  CATEGORIES_TABLE,
  SOURCES_TABLE,
  GOAL_TABLE,
  GOAL_LEAVE_OUT_TABLE,
  CELLS_TABLE,
);
const FAKE_LIST_CELLS = { 'Lists!A1:A5': [...FAKE_CATEGORIES.map((value) => [value]), ['']] };

// A date as the sheet sends it in plain values: days since 30 December 1899.
export const sheetDay = (date) =>
  (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

// The App sheet as Google sends it. A date cell, { date: '2026-10-01' } (with a time:
// { date, time: 0.5 } for noon), comes as a day number, or as the text the sheet shows
// (1/10/2026) when the app asks for dates as text. The other cells come as they are.
function appValues(sheet, dates) {
  return sheet.map((row) =>
    row.map((cell) => {
      if (cell === null || typeof cell !== 'object') return cell;
      if (dates !== 'FORMATTED_STRING') return sheetDay(cell.date) + (cell.time ?? 0);
      const [year, month, day] = cell.date.split('-').map(Number);
      return `${day}/${month}/${year}`;
    }),
  );
}

// Prepares the page: fake IDs in the config, the Google stand-in, and fake Google answers.
// Returns the list of requests the app sent to Google Sheets, and their kinds in .methods.
export async function setUp(
  page,
  {
    configured = true,
    sheetStatus = 200,
    // The values of the four parts of the Total.
    cells = FAKE_AMOUNTS,
    // The values of other single cells: { 'Sheet1!B7': 75 }. A cell that is not here is empty.
    otherCells = {},
    // Movement rows: source, date (sheetDay), category, description, amount.
    movements = [],
    email = 'ana@example.com',
    // true: like the first sign-in, Google Sheets says no until the person picks the sheet.
    needsPick = false,
    google = {},
    // What Google Drive says about editing the sheet: true, false, or 'offline' (no answer).
    canEdit = false,
    // The dropdowns of the form's lists: the default ones, 'offline' (no answer) or 'none'
    // (the cells have no dropdown rule).
    dropdowns = FAKE_DROPDOWNS,
    // How many rows the movements sheet has. By default there are empty rows left.
    rowCount = 100,
    // What Google answers to each save, in order: 200, another status, or 'offline'. The
    // last one is used for the saves after it.
    saves = [200],
    // The rows of the App sheet (issue #122), or null when the document has no App sheet.
    appSheet = FAKE_APP_SHEET,
  } = {},
) {
  const sheetRequests = [];
  // The kind of each request (GET reads, the others change the sheet), in the same order.
  sheetRequests.methods = [];
  // What the app asked Google to change in each save, and if Google did it.
  sheetRequests.saves = [];
  let rows = rowCount;
  let picked = !needsPick;
  let app = appSheet;
  // Changes the App sheet while the app is open, as a person would by hand (null: no App sheet).
  sheetRequests.setAppSheet = (changed) => (app = changed);

  await page.exposeFunction('__sheetPicked', () => (picked = true));

  await page.addInitScript((options) => (window.__fakeGoogle = options), google);

  await page.route('**/config.js', async (route) => {
    const response = await route.fetch();
    // Tests never use the real IDs: they get fake ones, or the example values to test the "not
    // set up yet" message. The cells come from the CELLS table of the tests' App sheet.
    const clientId = configured ? FAKE_CLIENT_ID : 'REPLACE_WITH_GOOGLE_CLIENT_ID';
    const sheetId = configured ? FAKE_SHEET_ID : 'REPLACE_WITH_SPREADSHEET_ID';
    const body = (await response.text())
      .replace(/googleClientId: '[^']*'/, `googleClientId: '${clientId}'`)
      .replace(/googleApiKey: '[^']*'/, `googleApiKey: '${FAKE_API_KEY}'`)
      .replace(/spreadsheetId: '[^']*'/, `spreadsheetId: '${sheetId}'`);
    await route.fulfill({ response, body });
  });

  await page.route('https://accounts.google.com/gsi/client', async (route) =>
    route.fulfill({ contentType: 'text/javascript', body: await fakeGsi }),
  );

  await page.route('https://apis.google.com/js/api.js', async (route) =>
    route.fulfill({ contentType: 'text/javascript', body: await fakePicker }),
  );

  await page.route('https://sheets.googleapis.com/**', async (route) => {
    const request = route.request();
    sheetRequests.push({ url: request.url(), authorization: request.headers().authorization });
    sheetRequests.methods.push(request.method());
    if (!picked) {
      await route.fulfill({ status: 403, json: { error: {} } });
      return;
    }
    const url = new URL(request.url());
    // A save: the change is made on the fake movements, as Google would do it.
    if (url.pathname.endsWith(':batchUpdate')) {
      const answer = saves[Math.min(sheetRequests.saves.length, saves.length - 1)];
      const body = request.postDataJSON();
      sheetRequests.saves.push({ body, done: answer === 200 });
      if (answer === 'offline') {
        await route.abort();
        return;
      }
      if (answer === 200) applySave(body);
      await route.fulfill({ status: answer, json: answer === 200 ? {} : { error: {} } });
      return;
    }
    // The number and the size of each sheet of the document.
    if (url.searchParams.get('fields')?.startsWith('sheets.properties')) {
      const sheets = [
        { sheetId: 0, title: 'Sheet1', gridProperties: { rowCount: 1000, columnCount: 26 } },
        {
          sheetId: FAKE_SHEET_NUMBER,
          title: FAKE_SHEET,
          gridProperties: { rowCount: rows, columnCount: 26 },
        },
        { sheetId: 3, title: 'Lists', gridProperties: { rowCount: 1000, columnCount: 26 } },
        ...(app === null
          ? []
          : [{ sheetId: 4, title: 'App', gridProperties: { rowCount: 1000, columnCount: 26 } }]),
      ];
      await route.fulfill({ json: { sheets: sheets.map((properties) => ({ properties })) } });
      return;
    }
    // The dropdown rule of one cell.
    if (url.searchParams.has('fields')) {
      if (dropdowns === 'offline') {
        await route.abort();
        return;
      }
      const condition =
        dropdowns === 'none' ? undefined : dropdowns[url.searchParams.get('ranges')];
      const cell = condition ? { dataValidation: { condition } } : {};
      await route.fulfill({ json: { sheets: [{ data: [{ rowData: [{ values: [cell] }] }] }] } });
      return;
    }
    // The cells a dropdown rule points to.
    const listCells = FAKE_LIST_CELLS[decodeURIComponent(url.pathname.split('/values/')[1] ?? '')];
    if (listCells) {
      await route.fulfill({ json: { values: listCells } });
      return;
    }
    // The goal reads the whole columns, with the headers in the first row; the save and the
    // delete read from the first movement row.
    const range = decodeURIComponent(url.pathname.split('/values/')[1] ?? '');
    // The App sheet: Google cannot find the range when there is no such sheet.
    if (range === FAKE_APP_RANGE && app === null && sheetStatus === 200) {
      await route.fulfill({ status: 400, json: { error: { code: 400 } } });
      return;
    }
    // Single cells: the four parts of the Total, or other cells.
    let answer = {
      valueRanges: url.searchParams.getAll('ranges').map((cell) => {
        const index = FAKE_CELLS.indexOf(cell);
        const value = index === -1 ? otherCells[cell] : cells[index];
        return value === undefined ? {} : { values: [[value]] };
      }),
    };
    if (range === FAKE_APP_RANGE) {
      answer = { values: appValues(app, url.searchParams.get('dateTimeRenderOption')) };
    }
    if (range === FAKE_MOVEMENTS) answer = { values: [FAKE_HEADERS, ...movements] };
    if (range === FAKE_SAVE_RANGE) answer = { values: movements };
    const body = sheetStatus === 200 ? answer : { error: {} };
    await route.fulfill({ status: sheetStatus, json: body });
  });

  await page.route('https://www.googleapis.com/oauth2/v3/userinfo', (route) =>
    route.fulfill({ json: { email } }),
  );

  await page.route('https://www.googleapis.com/drive/v3/files/**', (route) =>
    canEdit === 'offline' ? route.abort() : route.fulfill({ json: { capabilities: { canEdit } } }),
  );

  // Makes a saved change on the fake movements: rows added at the end, and the values of the
  // first five columns written. Row 2 of the sheet is the first movement.
  function applySave({ requests }) {
    for (const { appendDimension, updateCells } of requests) {
      if (appendDimension) rows += appendDimension.length;
      if (!updateCells) continue;
      updateCells.rows.forEach(({ values }, index) => {
        movements[updateCells.range.startRowIndex - 1 + index] = values.map(
          ({ userEnteredValue = {} }) =>
            userEnteredValue.numberValue ?? userEnteredValue.stringValue ?? '',
        );
      });
    }
  }

  return sheetRequests;
}

// What the Google stand-in wrote down: sign-in requests and cancelled tokens.
export function googleLog(page) {
  return page.evaluate(() => window.__gsiLog);
}

// How the app set up each Google file picker it opened.
export function pickerLog(page) {
  return page.evaluate(() => window.__pickerLog ?? []);
}
