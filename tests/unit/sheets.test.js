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

for (const status of [403, 404]) {
  test(`a ${status} answer means the person cannot open the sheet`, async () => {
    const { fetch } = fakeFetch(status, { error: { code: status } });

    await assert.rejects(client(fetch).getValues('Sheet1!A1'), NoAccessError);
  });
}

test('a 401 answer means the sign-in has expired', async () => {
  const { fetch } = fakeFetch(401);

  await assert.rejects(client(fetch).getValues('Sheet1!A1'), SignInExpiredError);
});

test('any other error answer becomes a SheetsError with the status', async () => {
  const { fetch } = fakeFetch(500);

  await assert.rejects(client(fetch).getValues('Sheet1!A1'), (error) => {
    assert.ok(error instanceof SheetsError);
    assert.equal(error.status, 500);
    return true;
  });
});

test('a network failure becomes a SheetsError', async () => {
  const fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assert.rejects(client(fetch).getValues('Sheet1!A1'), SheetsError);
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

// A fake fetch that answers each call with the next answer of the list: [status, body].
function fakeFetchSteps(...answers) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const [status, body] = answers[calls.length - 1];
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch, calls };
}

// The answer of Google Sheets for the dropdown rule of one cell.
const ruleAnswer = (condition) => ({
  sheets: [{ data: [{ rowData: [{ values: [{ dataValidation: { condition } }] }] }] }],
});

test('canEdit asks Google Drive if the signed-in person can edit the sheet', async () => {
  const { fetch, calls } = fakeFetch(200, { capabilities: { canEdit: true } });

  assert.equal(await client(fetch).canEdit(), true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://www.googleapis.com/drive/v3/files/sheet-123?fields=capabilities%2FcanEdit',
  );
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-abc');
});

test('canEdit is false for a person who can only view the sheet', async () => {
  const { fetch } = fakeFetch(200, { capabilities: { canEdit: false } });

  assert.equal(await client(fetch).canEdit(), false);
});

test('canEdit fails like the other requests when Google cannot answer', async () => {
  const offline = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assert.rejects(client(offline).canEdit(), SheetsError);
  await assert.rejects(client(fakeFetch(403).fetch).canEdit(), NoAccessError);
});

test('getDropdown reads the options typed in the dropdown rule of a cell, in order', async () => {
  const { fetch, calls } = fakeFetch(
    200,
    ruleAnswer({
      type: 'ONE_OF_LIST',
      values: [{ userEnteredValue: 'BBVA David' }, { userEnteredValue: 'Cash' }],
    }),
  );

  assert.deepEqual(await client(fetch).getDropdown('My sheet!A2'), ['BBVA David', 'Cash']);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://sheets.googleapis.com/v4/spreadsheets/sheet-123' +
      '?ranges=My%20sheet!A2&fields=sheets.data.rowData.values.dataValidation',
  );
});

test('getDropdown reads the options from the cells a dropdown rule points to', async () => {
  const { fetch, calls } = fakeFetchSteps(
    [200, ruleAnswer({ type: 'ONE_OF_RANGE', values: [{ userEnteredValue: '=Lists!B1:B5' }] })],
    [200, { values: [['House'], [''], ['Car'], [' Leisure ']] }],
  );

  assert.deepEqual(await client(fetch).getDropdown('Sheet1!C2'), ['House', 'Car', 'Leisure']);
  assert.equal(calls.length, 2);
  assert.equal(
    calls[1].url,
    'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Lists!B1%3AB5',
  );
});

test('getDropdown reads the cells of a rule with no sheet name on the sheet of its cell', async () => {
  const { fetch, calls } = fakeFetchSteps(
    [200, ruleAnswer({ type: 'ONE_OF_RANGE', values: [{ userEnteredValue: '=$H$2:$H$4' }] })],
    [200, { values: [['House'], ['Car']] }],
  );

  assert.deepEqual(await client(fetch).getDropdown("'My sheet'!C2"), ['House', 'Car']);
  assert.equal(
    calls[1].url,
    'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/' +
      encodeURIComponent("'My sheet'!$H$2:$H$4"),
  );
});

test('getDropdown fails when the cell has no dropdown rule', async () => {
  const { fetch } = fakeFetch(200, { sheets: [{ data: [{ rowData: [{ values: [{}] }] }] }] });

  await assert.rejects(client(fetch).getDropdown('Sheet1!A2'), SheetsError);
});

test('getDropdown fails when the dropdown has no options', async () => {
  const { fetch } = fakeFetch(200, ruleAnswer({ type: 'ONE_OF_LIST', values: [] }));

  await assert.rejects(client(fetch).getDropdown('Sheet1!A2'), SheetsError);
});

test('getValues with formulas asks for the formulas, and for dates as day numbers', async () => {
  const { fetch, calls } = fakeFetch(200, { values: [['Cash', 46300, 'General', '', '=10+2.5']] });

  const rows = await client(fetch).getValues('Sheet1!A2:E', { formulas: true });

  assert.equal(
    calls[0].url,
    'https://sheets.googleapis.com/v4/spreadsheets/sheet-123/values/Sheet1!A2%3AE' +
      '?valueRenderOption=FORMULA&dateTimeRenderOption=SERIAL_NUMBER',
  );
  assert.deepEqual(rows, [['Cash', 46300, 'General', '', '=10+2.5']]);
});

test('getSheet finds the number and the size of a sheet by its name', async () => {
  const { fetch, calls } = fakeFetch(200, {
    sheets: [
      { properties: { sheetId: 0, title: 'Other', gridProperties: { rowCount: 10 } } },
      { properties: { sheetId: 7, title: 'Sheet1', gridProperties: { rowCount: 500 } } },
    ],
  });

  assert.deepEqual(await client(fetch).getSheet('Sheet1'), { sheetId: 7, rowCount: 500 });
  assert.equal(
    calls[0].url,
    'https://sheets.googleapis.com/v4/spreadsheets/sheet-123?fields=' +
      encodeURIComponent('sheets.properties(sheetId,title,gridProperties.rowCount)'),
  );
});

test('getSheet fails when there is no sheet with that name', async () => {
  const { fetch } = fakeFetch(200, { sheets: [] });

  await assert.rejects(client(fetch).getSheet('Sheet1'), SheetsError);
});

test('writeRows writes only the values of the first five columns, in one single request', async () => {
  const { fetch, calls } = fakeFetch(200, {});

  await client(fetch).writeRows({
    sheetId: 7,
    rowCount: 500,
    startRow: 3,
    rows: [
      ['Cash', 46300, 'General', 'Bakery', -12.5],
      ['AMEX', 46301, 'House', '', '=10+2.5'],
    ],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://sheets.googleapis.com/v4/spreadsheets/sheet-123:batchUpdate');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-abc');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    requests: [
      {
        updateCells: {
          // Rows 4 and 5 of the sheet (counted from 0), columns A to E.
          range: {
            sheetId: 7,
            startRowIndex: 3,
            endRowIndex: 5,
            startColumnIndex: 0,
            endColumnIndex: 5,
          },
          rows: [
            {
              values: [
                { userEnteredValue: { stringValue: 'Cash' } },
                { userEnteredValue: { numberValue: 46300 } },
                { userEnteredValue: { stringValue: 'General' } },
                { userEnteredValue: { stringValue: 'Bakery' } },
                { userEnteredValue: { numberValue: -12.5 } },
              ],
            },
            {
              values: [
                { userEnteredValue: { stringValue: 'AMEX' } },
                { userEnteredValue: { numberValue: 46301 } },
                { userEnteredValue: { stringValue: 'House' } },
                // An empty concept empties its cell.
                {},
                // A formula stays a formula.
                { userEnteredValue: { formulaValue: '=10+2.5' } },
              ],
            },
          ],
          // Only the values change: each cell keeps its own format.
          fields: 'userEnteredValue',
        },
      },
    ],
  });
});

test('writeRows first adds rows at the end, in the same request, when the sheet is too short', async () => {
  const { fetch, calls } = fakeFetch(200, {});

  await client(fetch).writeRows({
    sheetId: 7,
    rowCount: 4,
    startRow: 3,
    rows: [m5('Cash'), m5('AMEX')],
  });

  const { requests } = JSON.parse(calls[0].options.body);
  assert.equal(calls.length, 1);
  assert.deepEqual(requests[0], { appendDimension: { sheetId: 7, dimension: 'ROWS', length: 1 } });
  assert.ok(requests[1].updateCells);
});

test('writeRows tells when Google refuses the change', async () => {
  await assert.rejects(client(fakeFetch(403).fetch).writeRows(oneRow), NoAccessError);
  await assert.rejects(client(fakeFetch(500).fetch).writeRows(oneRow), SheetsError);
});

function m5(source) {
  return [source, 46300, 'General', '', -1];
}
const oneRow = { sheetId: 7, rowCount: 10, startRow: 1, rows: [m5('Cash')] };
