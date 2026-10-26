import { test } from 'node:test';
import assert from 'node:assert/strict';

import { goalStatus, goalMonths } from '../../src/goal.js';
import { config } from '../../src/config.js';

// Made-up settings in the same shape as config.goal.
const goal = {
  movements: 'Sheet2!A:E',
  sources: { Wallet: 'cash', Visa: 'card', 'My Bank': 'bank' },
  from: '2026-10-01',
  to: '2026-12-31',
  limit: 3000,
  skip: {
    categories: ['Pay', 'Loan'],
    descriptions: { Home: ['Water', 'Phone'], Misc: ['Coffee'] },
  },
};

// The sheet sends dates as day numbers: days since 30 December 1899.
const day = (date) => (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

// One movement row: source, date, category, description, amount.
const row = (date, amount, category = 'Food', description = 'Shop', source = '') => [
  source,
  day(date),
  category,
  description,
  amount,
];

test('adds up the spending of the period and shows it as a positive amount', () => {
  const rows = [row('2026-10-05', -100), row('2026-11-20', -50.25), row('2026-12-31', 20)];

  assert.equal(goalStatus(rows, goal).amount, 130.25);
});

test('counts only movements from the first to the last day of the period', () => {
  const rows = [
    row('2026-09-30', -1),
    row('2026-10-01', -10),
    row('2026-12-31', -100),
    row('2027-01-01', -1000),
  ];

  assert.equal(goalStatus(rows, goal).amount, 110);
});

test('a time of day in the date does not matter', () => {
  const rows = [['', day('2026-12-31') + 0.75, 'Food', 'Shop', -10]];

  assert.equal(goalStatus(rows, goal).amount, 10);
});

test('skips the categories in the skip list', () => {
  const rows = [
    row('2026-10-05', -100, 'Pay'),
    row('2026-10-05', -200, 'Loan'),
    row('2026-10-05', -5),
  ];

  assert.equal(goalStatus(rows, goal).amount, 5);
});

test('skips house movements with a listed description, but counts other house movements', () => {
  const rows = [
    row('2026-10-05', -100, 'Home', 'Water'),
    row('2026-10-05', -200, 'Home', 'Phone'),
    row('2026-10-05', -30, 'Home', 'New lamp'),
    row('2026-10-05', -7, 'Food', 'Water'),
  ];

  assert.equal(goalStatus(rows, goal).amount, 37);
});

test('every category with a list of descriptions leaves those movements out', () => {
  const rows = [
    row('2026-10-05', -100, 'Home', 'Water'),
    row('2026-10-05', -200, 'Misc', 'Coffee'),
    row('2026-10-05', -30, 'Misc', 'Water'),
    row('2026-10-05', -7, 'Food', 'Coffee'),
  ];

  assert.equal(goalStatus(rows, goal).amount, 37);
});

test('a category named like a built-in word does not break the lists', () => {
  const rows = [row('2026-10-05', -5, 'constructor', 'Water'), row('2026-10-05', -2, 'toString')];

  assert.equal(goalStatus(rows, goal).amount, 7);
});

test('the heading row, empty rows and rows without a number are left out', () => {
  const rows = [
    ['Source', 'Date', 'Category', 'Description', 'Amount'],
    [],
    ['', day('2026-10-05'), 'Food', 'Shop'],
    ['', day('2026-10-05'), 'Food', 'Shop', 'unknown'],
    row('2026-10-05', -8),
  ];

  assert.equal(goalStatus(rows, goal).amount, 8);
});

test('no spending gives zero, not minus zero', () => {
  assert.ok(Object.is(goalStatus([], goal).amount, 0));
});

test('over the limit is "over" (red)', () => {
  const rows = [row('2026-12-01', -3000.01)];

  assert.equal(goalStatus(rows, goal).level, 'over');
});

test('exactly the limit is neither red nor yellow', () => {
  const rows = [row('2026-10-01', -3000)];

  assert.equal(goalStatus(rows, goal).level, 'ok');
});

test('with the newest movement in the first month, more than a third of the limit is "close" (yellow)', () => {
  assert.equal(goalStatus([row('2026-10-20', -1000.01)], goal).level, 'close');
  assert.equal(goalStatus([row('2026-10-20', -1000)], goal).level, 'ok');
});

test('with the newest movement in the second month, more than two thirds of the limit is "close"', () => {
  assert.equal(goalStatus([row('2026-11-02', -2000.01)], goal).level, 'close');
  assert.equal(goalStatus([row('2026-11-02', -2000)], goal).level, 'ok');
});

test('with the newest movement in the last month, only red is possible', () => {
  assert.equal(goalStatus([row('2026-12-15', -2999)], goal).level, 'ok');
});

test('the newest movement is taken from the whole sheet, also skipped or outside the period', () => {
  const spending = row('2026-10-03', -1500);
  // A skipped movement in November moves us into the second month: 1500 is under 2/3 of 3000.
  assert.equal(goalStatus([spending, row('2026-11-01', -1, 'Pay')], goal).level, 'ok');
  // A movement after the period: the period is over, so only red is possible.
  assert.equal(goalStatus([spending, row('2027-01-02', -1)], goal).level, 'ok');
  // Only October so far: 1500 is over 1/3 of 3000.
  assert.equal(goalStatus([spending], goal).level, 'close');
});

test('the real goal settings have every part the calculation needs', () => {
  const { movements, from, to, limit, skip } = config.goal;
  assert.equal(typeof movements, 'string');
  assert.match(from, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(to, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(limit > 0);
  assert.ok(Array.isArray(skip.categories));
  assert.ok(skip.categories.includes('Credit Cards'));
  for (const descriptions of Object.values(skip.descriptions)) {
    assert.ok(Array.isArray(descriptions));
  }
});

test('goalMonths gives one entry per month of the period, in order', () => {
  const months = goalMonths([], goal);

  assert.deepEqual(
    months.map(({ year, month }) => [year, month]),
    [
      [2026, 10],
      [2026, 11],
      [2026, 12],
    ],
  );
});

test('a month without counted movements has no amount and no movements', () => {
  const rows = [row('2026-11-03', -100, 'Pay'), row('2026-09-30', -5)];

  assert.deepEqual(goalMonths(rows, goal)[1], {
    year: 2026,
    month: 11,
    amount: null,
    days: [],
  });
  assert.equal(goalMonths(rows, goal)[0].amount, null);
});

test('each month adds up its own spending, with the same rules as the goal', () => {
  const rows = [
    row('2026-10-05', -100),
    row('2026-10-31', -20.5, 'Home', 'New lamp'),
    row('2026-10-12', -999, 'Home', 'Water'),
    row('2026-11-01', -7),
    row('2026-12-31', 15, 'Food', 'Refund'),
  ];

  const months = goalMonths(rows, goal);

  assert.deepEqual(
    months.map(({ amount }) => amount),
    [120.5, 7, -15],
  );
});

test('a month lists its movements as spending, grouped by day, newest day first', () => {
  const rows = [
    row('2026-10-05', -100, 'Food', 'Market'),
    ['', day('2026-10-20') + 0.5, 'Car', 'Petrol', -45.2],
    row('2026-10-12', 10, 'Food', 'Refund'),
    row('2026-10-15', -999, 'Pay', 'Salary'),
  ];

  assert.deepEqual(goalMonths(rows, goal)[0].days, [
    {
      day: 20,
      movements: [{ category: 'Car', description: 'Petrol', amount: 45.2, source: null }],
    },
    {
      day: 12,
      movements: [{ category: 'Food', description: 'Refund', amount: -10, source: null }],
    },
    {
      day: 5,
      movements: [{ category: 'Food', description: 'Market', amount: 100, source: null }],
    },
  ]);
});

test('movements of the same day share one day, newest first, also late in the day', () => {
  const rows = [
    row('2026-10-05', -1, 'Food', 'Morning'),
    row('2026-10-06', -2, 'Food', 'Next day'),
    ['', day('2026-10-05') + 0.99, 'Food', 'Night', -3],
    ['', day('2026-10-05') + 0.5, 'Food', 'Noon', -4],
  ];

  assert.deepEqual(
    goalMonths(rows, goal)[0].days.map(({ day: date, movements }) => [
      date,
      movements.map(({ description }) => description),
    ]),
    [
      [6, ['Next day']],
      [5, ['Night', 'Noon', 'Morning']],
    ],
  );
});

test('each movement knows where its money came from, by the word in the first column', () => {
  const rows = [
    row('2026-10-03', -1, 'Food', 'A', 'Wallet'),
    row('2026-10-02', -2, 'Food', 'B', ' Visa '),
    row('2026-10-01', -3, 'Food', 'C', 'My Bank'),
  ];

  const [october] = goalMonths(rows, goal);

  assert.deepEqual(
    october.days.flatMap(({ movements }) => movements.map(({ source }) => source)),
    ['cash', 'card', 'bank'],
  );
});

test('an unknown, empty or missing source gives no source, and the movement still counts', () => {
  const rows = [
    row('2026-10-04', -1, 'Food', 'A', 'Piggy'),
    row('2026-10-03', -2, 'Food', 'B', ''),
    [undefined, day('2026-10-02'), 'Food', 'C', -3],
    row('2026-10-01', -4, 'Food', 'D', 'constructor'),
  ];

  const [october] = goalMonths(rows, goal);

  assert.equal(october.amount, 10);
  assert.deepEqual(
    october.days.flatMap(({ movements }) => movements.map(({ source }) => source)),
    [null, null, null, null],
  );
});
