import { readFile } from 'node:fs/promises';

const fakeGsi = readFile(new URL('./fake-gsi.js', import.meta.url), 'utf8');

export const FAKE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const FAKE_SHEET_ID = 'test-sheet-id';
// Made-up cells for the four parts of the Total, in the order of config.pills.
export const FAKE_CELLS = ['Sheet1!A1', 'Sheet1!A2', 'Sheet1!A3', 'Sheet1!A4'];
// The default amounts of those parts, and their sum as the app writes it in English.
export const FAKE_AMOUNTS = [1000, -200.5, 300, 50];
export const FAKE_TOTAL = '€1,149.50';
export const FAKE_MOVEMENTS = 'Sheet2!B:E';

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
    // Movement rows: date (sheetDay), category, description, amount.
    movements = [],
    email = 'ana@example.com',
    google = {},
  } = {},
) {
  const sheetRequests = [];

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
      .replace(/spreadsheetId: '[^']*'/, `spreadsheetId: '${sheetId}'`)
      .replace(/cell: '[^']*'/g, () => `cell: '${FAKE_CELLS[next++]}'`)
      .replace(/movements: '[^']*'/, `movements: '${FAKE_MOVEMENTS}'`);
    await route.fulfill({ response, body });
  });

  await page.route('https://accounts.google.com/gsi/client', async (route) =>
    route.fulfill({ contentType: 'text/javascript', body: await fakeGsi }),
  );

  await page.route('https://sheets.googleapis.com/**', async (route) => {
    const request = route.request();
    sheetRequests.push({ url: request.url(), authorization: request.headers().authorization });
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

  return sheetRequests;
}

// What the Google stand-in wrote down: sign-in requests and cancelled tokens.
export function googleLog(page) {
  return page.evaluate(() => window.__gsiLog);
}
