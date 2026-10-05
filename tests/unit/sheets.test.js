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
