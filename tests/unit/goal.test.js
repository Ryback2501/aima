import { test } from 'node:test';
import assert from 'node:assert/strict';

import { goalStatus } from '../../src/goal.js';
import { config } from '../../src/config.js';

// Made-up settings in the same shape as config.goal.
const goal = {
  movements: 'Sheet2!B:E',
  from: '2026-10-01',
  to: '2026-12-31',
  limit: 3000,
  skip: {
    categories: ['Pay', 'Loan'],
    house: { category: 'Home', descriptions: ['Water', 'Phone'] },
  },
};

// The sheet sends dates as day numbers: days since 30 December 1899.
const day = (date) => (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

// One movement row: date, category, description, amount.
const row = (date, amount, category = 'Food', description = 'Shop') => [
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
  const rows = [[day('2026-12-31') + 0.75, 'Food', 'Shop', -10]];

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

test('the heading row, empty rows and rows without a number are left out', () => {
  const rows = [
    ['Date', 'Category', 'Description', 'Amount'],
    [],
    [day('2026-10-05'), 'Food', 'Shop'],
    [day('2026-10-05'), 'Food', 'Shop', 'unknown'],
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
  assert.equal(typeof skip.house.category, 'string');
  assert.ok(Array.isArray(skip.house.descriptions));
});
