// Reads data from the Google Sheet through the Google Sheets web API.
// Google checks the sheet's sharing settings on every request, so this is also how the app
// learns if the signed-in person may see the data.
// Later, the same client will also add and change data in the sheet.

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

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

export function createSheetsClient({ spreadsheetId, getToken, fetch = globalThis.fetch }) {
  async function request(path) {
    const url = `${API}/${encodeURIComponent(spreadsheetId)}${path}`;
    let response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
    } catch (error) {
      throw new SheetsError('Could not reach Google Sheets.', { cause: error });
    }
    if (response.status === 401) throw new SignInExpiredError();
    // Google answers 404 instead of 403 when the person may not even know the sheet exists.
    if (response.status === 403 || response.status === 404) throw new NoAccessError();
    if (!response.ok) {
      throw new SheetsError(`Google Sheets answered with error ${response.status}.`, {
        status: response.status,
      });
    }
    return response.json();
  }

  // Returns the rows of a range, for example "Sheet1!A1:C5". Empty cells at the end are left out.
  async function getValues(range) {
    const data = await request(`/values/${encodeURIComponent(range)}`);
    return data.values ?? [];
  }

  // Returns the text of one cell, for example "Sheet1!A1", or '' when the cell is empty.
  async function getCell(range) {
    const rows = await getValues(range);
    return rows[0]?.[0] ?? '';
  }

  return { getValues, getCell };
}
