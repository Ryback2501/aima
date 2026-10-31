import { readFile } from 'node:fs/promises';

const fakeGsi = readFile(new URL('./fake-gsi.js', import.meta.url), 'utf8');
const fakePicker = readFile(new URL('./fake-picker.js', import.meta.url), 'utf8');

export const FAKE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const FAKE_SHEET_ID = 'test-sheet-id';
export const FAKE_API_KEY = 'test-api-key';
// Made-up cells for the four parts of the Total, in the order of config.pills.
export const FAKE_CELLS = ['Sheet1!A1', 'Sheet1!A2', 'Sheet1!A3', 'Sheet1!A4'];
// The default amounts of those parts, and their sum as the app writes it in English.
export const FAKE_AMOUNTS = [1000, -200.5, 300, 50];
// 1000 - 200.50 - 300 (Provisioned is taken away) + 50
export const FAKE_TOTAL = '€549.50';
export const FAKE_MOVEMENTS = 'Sheet2!A:E';
// Made-up cells whose dropdowns give the source and category lists of the new movement form.
export const FAKE_SOURCE_LIST = 'Sheet2!A2';
export const FAKE_CATEGORY_LIST = 'Sheet2!C2';
// The default dropdowns: the sources are typed in the rule, the categories come from cells.
export const FAKE_SOURCES = ['BBVA David', 'BBVA Común', 'Después', 'Cash', 'Provisioned'];
export const FAKE_CATEGORIES = ['Car', 'General', 'House', 'Leisure'];
const FAKE_DROPDOWNS = {
  [FAKE_SOURCE_LIST]: {
    type: 'ONE_OF_LIST',
    values: FAKE_SOURCES.map((value) => ({ userEnteredValue: value })),
  },
  [FAKE_CATEGORY_LIST]: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: '=Lists!A1:A5' }] },
};
const FAKE_LIST_CELLS = { 'Lists!A1:A5': [...FAKE_CATEGORIES.map((value) => [value]), ['']] };

// A date as the sheet sends it in plain values: days since 30 December 1899.
export const sheetDay = (date) =>
  (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

// Prepares the page: fake IDs in the config, the Google stand-in, and fake Google answers.
// Returns the list of requests the app sent to Google Sheets.
export async function setUp(
  page,
  {
    configured = true,
    sheetStatus = 200,
    // The values of the four parts of the Total.
    cells = FAKE_AMOUNTS,
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
  } = {},
) {
  const sheetRequests = [];
  let picked = !needsPick;

  await page.exposeFunction('__sheetPicked', () => (picked = true));

  await page.addInitScript((options) => (window.__fakeGoogle = options), google);

  await page.route('**/config.js', async (route) => {
    const response = await route.fetch();
    // Tests never use the real IDs, cell or movements range: they get fake ones, or the example
    // values to test the "not set up yet" message.
    const clientId = configured ? FAKE_CLIENT_ID : 'REPLACE_WITH_GOOGLE_CLIENT_ID';
    const sheetId = configured ? FAKE_SHEET_ID : 'REPLACE_WITH_SPREADSHEET_ID';
    let next = 0;
    const body = (await response.text())
      .replace(/googleClientId: '[^']*'/, `googleClientId: '${clientId}'`)
      .replace(/googleApiKey: '[^']*'/, `googleApiKey: '${FAKE_API_KEY}'`)
      .replace(/spreadsheetId: '[^']*'/, `spreadsheetId: '${sheetId}'`)
      .replace(/cell: '[^']*'/g, () => `cell: '${FAKE_CELLS[next++]}'`)
      .replace(/movements: '[^']*'/, `movements: '${FAKE_MOVEMENTS}'`)
      .replace(/sourceList: '[^']*'/, `sourceList: '${FAKE_SOURCE_LIST}'`)
      .replace(/categoryList: '[^']*'/, `categoryList: '${FAKE_CATEGORY_LIST}'`);
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
    sheetRequests.push({
      url: request.url(),
      method: request.method(),
      authorization: request.headers().authorization,
    });
    if (!picked) {
      await route.fulfill({ status: 403, json: { error: {} } });
      return;
    }
    const url = new URL(request.url());
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
    const askedForMovements = request.url().includes(encodeURIComponent(FAKE_MOVEMENTS));
    const answer = askedForMovements
      ? { values: movements }
      : { valueRanges: cells.map((value) => ({ values: [[value]] })) };
    const body = sheetStatus === 200 ? answer : { error: {} };
    await route.fulfill({ status: sheetStatus, json: body });
  });

  await page.route('https://www.googleapis.com/oauth2/v3/userinfo', (route) =>
    route.fulfill({ json: { email } }),
  );

  await page.route('https://www.googleapis.com/drive/v3/files/**', (route) =>
    canEdit === 'offline' ? route.abort() : route.fulfill({ json: { capabilities: { canEdit } } }),
  );

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
