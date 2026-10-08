import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSheetsClient,
  NoAccessError,
  SignInExpiredError,
  SheetsError,
} from '../../src/sheets.js';

// A fake fetch that records each call and answers with the given status and body.
function fakeFetch(status, body = {}) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch, calls };
}

function client(fetch) {
  return createSheetsClient({ spreadsheetId: 'sheet-123', getToken: () => 'token-abc', fetch });
}

test('getValues asks the Sheets API for the range with the access token', async () => {
  const { fetch, calls } = fakeFetch(200, { values: [['hello']] });

  await client(fetch).getValues('Sheet1!A1');

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Sheet1!A1',
  );
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-abc');
});

test('getValues encodes sheet names with spaces and other special characters', async () => {
  const { fetch, calls } = fakeFetch(200, { values: [] });

  await client(fetch).getValues("My sheet's/data!A1");

  assert.match(calls[0].url, /\/values\/My%20sheet's%2Fdata!A1$/);
});

test('getValues with raw asks for plain numbers and dates instead of formatted text', async () => {
  const { fetch, calls } = fakeFetch(200, { values: [[46310, -12.5]] });

  const rows = await client(fetch).getValues('Sheet1!B:E', { raw: true });

  assert.equal(
    calls[0].url,
    'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Sheet1!B%3AE' +
      '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',
  );
  assert.deepEqual(rows, [[46310, -12.5]]);
});

test('getValues returns the rows of the range', async () => {
  const { fetch } = fakeFetch(200, { values: [['a', 'b'], ['c']] });

  assert.deepEqual(await client(fetch).getValues('Sheet1!A1:B2'), [['a', 'b'], ['c']]);
});

test('getValues returns no rows when the range is empty', async () => {
  const { fetch } = fakeFetch(200, { range: 'Sheet1!A1' });

  assert.deepEqual(await client(fetch).getValues('Sheet1!A1'), []);
});

test('getCell returns the text of one cell', async () => {
  const { fetch } = fakeFetch(200, { values: [['Buy milk']] });

  assert.equal(await client(fetch).getCell('Sheet1!A1'), 'Buy milk');
});

test('getCell returns an empty text when the cell is empty', async () => {
  const { fetch } = fakeFetch(200, {});

  assert.equal(await client(fetch).getCell('Sheet1!A1'), '');
});

for (const status of [403, 404]) {
  test(`a ${status} answer means the person cannot open the sheet`, async () => {
    const { fetch } = fakeFetch(status, { error: { code: status } });

    await assert.rejects(client(fetch).getCell('Sheet1!A1'), NoAccessError);
  });
}

test('a 401 answer means the sign-in has expired', async () => {
  const { fetch } = fakeFetch(401);

  await assert.rejects(client(fetch).getCell('Sheet1!A1'), SignInExpiredError);
});

test('any other error answer becomes a SheetsError with the status', async () => {
  const { fetch } = fakeFetch(500);

  await assert.rejects(client(fetch).getCell('Sheet1!A1'), (error) => {
    assert.ok(error instanceof SheetsError);
    assert.equal(error.status, 500);
    return true;
  });
});

test('a network failure becomes a SheetsError', async () => {
  const fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assert.rejects(client(fetch).getCell('Sheet1!A1'), SheetsError);
});

test('getCells reads several cells in one request, as plain numbers', async () => {
  const { fetch, calls } = fakeFetch(200, {
    valueRanges: [{ values: [[1200.5]] }, { values: [[-30]] }],
  });

  const values = await client(fetch).getCells(['Sheet1!A1', 'Other sheet!B2']);

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values:batchGet' +
      '?ranges=Sheet1!A1&ranges=Other%20sheet!B2' +
      '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',
  );
  assert.deepEqual(values, [1200.5, -30]);
});

test('getCells gives an empty text for an empty cell', async () => {
  const { fetch } = fakeFetch(200, { valueRanges: [{ values: [[5]] }, {}] });

  assert.deepEqual(await client(fetch).getCells(['Sheet1!A1', 'Sheet1!A2']), [5, '']);
});

test('getCells also tells when the person cannot open the sheet', async () => {
  const { fetch } = fakeFetch(403);

  await assert.rejects(client(fetch).getCells(['Sheet1!A1']), NoAccessError);
});
