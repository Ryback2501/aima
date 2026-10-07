import { readFile } from 'node:fs/promises';

const fakeGsi = readFile(new URL('./fake-gsi.js', import.meta.url), 'utf8');

export const FAKE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const FAKE_SHEET_ID = 'test-sheet-id';
export const FAKE_CELL = 'Sheet1!A1';

// Prepares the page: fake IDs in the config, the Google stand-in, and fake Google answers.
// Returns the list of requests the app sent to Google Sheets.
export async function setUp(
  page,
  {
    configured = true,
    sheetStatus = 200,
    cell = 'Buy milk',
    email = 'ana@example.com',
    google = {},
  } = {},
) {
  const sheetRequests = [];

  await page.addInitScript((options) => (window.__fakeGoogle = options), google);

  await page.route('**/config.js', async (route) => {
    const response = await route.fetch();
    // Tests never use the real IDs or cell: they get fake ones, or the example values to test
    // the "not set up yet" message.
    const clientId = configured ? FAKE_CLIENT_ID : 'REPLACE_WITH_GOOGLE_CLIENT_ID';
    const sheetId = configured ? FAKE_SHEET_ID : 'REPLACE_WITH_SPREADSHEET_ID';
    const body = (await response.text())
      .replace(/googleClientId: '[^']*'/, `googleClientId: '${clientId}'`)
      .replace(/spreadsheetId: '[^']*'/, `spreadsheetId: '${sheetId}'`)
      .replace(/totalCell: '[^']*'/, `totalCell: '${FAKE_CELL}'`);
    await route.fulfill({ response, body });
  });

  await page.route('https://accounts.google.com/gsi/client', async (route) =>
    route.fulfill({ contentType: 'text/javascript', body: await fakeGsi }),
  );

  await page.route('https://sheets.googleapis.com/**', async (route) => {
    const request = route.request();
    sheetRequests.push({ url: request.url(), authorization: request.headers().authorization });
    const body = sheetStatus === 200 ? { values: cell ? [[cell]] : undefined } : { error: {} };
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
