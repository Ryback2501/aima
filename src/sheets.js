// Reads data from the Google Sheet through the Google Sheets web API.
// Google checks the sheet's sharing settings on every request, so this is also how the app
// learns if the signed-in person may see the data.
// Later, the same client will also add and change data in the sheet.

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
// Asks for plain numbers and dates instead of the text the sheet shows (see getValues).
const RAW = 'valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';

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
  // Normally each cell comes as the text the sheet shows (for example "-12,50 €").
  // With raw, numbers come as plain numbers (-12.5) and dates as day numbers (days since
  // 30 December 1899), the same whatever the sheet's number and date format is.
  async function getValues(range, { raw = false } = {}) {
    const query = raw ? `?${RAW}` : '';
    const data = await request(`/values/${encodeURIComponent(range)}${query}`);
    return data.values ?? [];
  }

  // Reads several single cells in one request, for example ["Sheet1!A1", "Sheet1!B7"].
  // Returns one value per cell, in the same order: numbers as plain numbers, '' when empty.
  async function getCells(ranges) {
    const list = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
    const data = await request(`/values:batchGet?${list}&${RAW}`);
    return ranges.map((range, index) => data.valueRanges?.[index]?.values?.[0]?.[0] ?? '');
  }

  return { getValues, getCells };
}
