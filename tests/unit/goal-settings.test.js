import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readGoal, readLeftOut } from '../../src/goal-settings.js';
import { goalStatus, goalMonths } from '../../src/goal.js';

// The spending goal, from the GOAL and GOAL LEAVE OUT tables of the App sheet (issue #125).
// GOAL has the columns Setting and Value, LEAVE OUT the columns Category and Description.

// A date as the sheet sends it: days since 30 December 1899.
const day = (date) => (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
// A date cell, as the sheets client gives it: its day number and the text the sheet shows.
const dateCell = (date, time = 0) => {
  const [year, month, dayOfMonth] = date.split('-').map(Number);
  return { day: day(date) + time, text: `${dayOfMonth}/${month}/${year}` };
};

// A table as readAppSheet gives it (app-sheet.js): its items, each with its row in the sheet.
const table = (...cells) => ({
  column: 10,
  rows: cells.map((each, index) => ({ row: index + 3, cells: each })),
});

// The rows the issue asks to copy, so the goal is the same as before.
const GOAL = [
  ['From', dateCell('2026-10-01')],
  ['To', dateCell('2026-12-31')],
  ['Limit', 4000],
];
const LEAVE_OUT = [
  ['Whitening'],
  ['Salary'],
  ['Mortgage'],
  ['Credit Cards'],
  ['Investing'],
  ['House', 'Seguro hogar BBVA'],
  ['House', 'Pepephone - Internet'],
  ['House', 'Impuesto vivienda'],
  ['House', 'Comunidad'],
  ['House', 'Luz - Endesa'],
  ['House', 'Gas - Endesa'],
];

const goalOf = (...cells) => {
  const { value, mistakes } = readGoal(table(...cells));
  assert.deepEqual(mistakes, []);
  return value;
};
const mistakesOf = (...cells) => readGoal(table(...cells)).mistakes;
const leftOutOf = (...cells) => {
  const { value, mistakes } = readLeftOut(table(...cells));
  assert.deepEqual(mistakes, []);
  return value;
};

// The goal's settings, as the app puts them together: the dates and the limit from GOAL, and
// the movements left out from GOAL LEAVE OUT.
const settingsOf = (goal = GOAL, leftOut = LEAVE_OUT) => ({
  ...goalOf(...goal),
  skip: leftOutOf(...leftOut),
});
// GOAL with one setting changed.
const goalWith = (name, value) => GOAL.map((row) => (row[0] === name ? [name, value] : row));

// One movement row: source, date, category, description, amount.
const row = (date, amount, category = 'General', description = 'Shop') => [
  'Cash',
  day(date),
  category,
  description,
  amount,
];
const descriptionsOf = (month) =>
  month.days.flatMap(({ movements }) => movements.map(({ description }) => description));

test('with the copied rows, the dates, the limit and the left-out movements are the same as before', () => {
  assert.deepEqual(goalOf(...GOAL), { from: '2026-10-01', to: '2026-12-31', limit: 4000 });
  assert.deepEqual(leftOutOf(...LEAVE_OUT), {
    categories: ['Whitening', 'Salary', 'Mortgage', 'Credit Cards', 'Investing'],
    descriptions: {
      House: [
        'Seguro hogar BBVA',
        'Pepephone - Internet',
        'Impuesto vivienda',
        'Comunidad',
        'Luz - Endesa',
        'Gas - Endesa',
      ],
    },
  });
});

test('with the copied rows, Investing movements do not count, below or above 0', () => {
  const rows = [
    row('2026-10-05', -100, 'Investing', 'Fund'),
    row('2026-10-06', 50, 'Investing', 'Sale'),
    row('2026-10-07', -10, 'General', 'Bread'),
    row('2026-11-03', -20, 'Investing', 'Fund'),
  ];

  assert.equal(goalStatus(rows, settingsOf()).amount, 10);
  const [october, november] = goalMonths(rows, settingsOf());
  assert.deepEqual(descriptionsOf(october), ['Bread']);
  // A month with only Investing movements has no amount, like a month with none.
  assert.equal(november.amount, null);
});

test('the rows can be in any order; capital letters and spaces around the setting do not matter', () => {
  assert.deepEqual(
    goalOf([' LIMIT ', 4000], ['to', dateCell('2026-12-31')], ['From  ', dateCell('2026-10-01')]),
    { from: '2026-10-01', to: '2026-12-31', limit: 4000 },
  );
});

test('a limit of 100 shows the spending in red', () => {
  const rows = [row('2026-10-05', -150)];

  assert.equal(goalStatus(rows, settingsOf()).level, 'ok');
  assert.equal(goalStatus(rows, settingsOf(goalWith('Limit', 100))).level, 'over');
});

test('the limit may have decimals', () => {
  assert.equal(goalOf(...goalWith('Limit', 2500.5)).limit, 2500.5);
});

test('From on 1 November: October is not a month of the goal, and its spending does not count', () => {
  const rows = [row('2026-10-05', -100), row('2026-11-05', -30)];
  const settings = settingsOf(goalWith('From', dateCell('2026-11-01')));

  assert.deepEqual(
    goalMonths(rows, settings).map(({ month }) => month),
    [11, 12],
  );
  assert.equal(goalStatus(rows, settingsOf()).amount, 130);
  assert.equal(goalStatus(rows, settings).amount, 30);
});

test('From on 15 November: November is still a month, and only its movements from the 15th count', () => {
  const rows = [
    row('2026-11-14', -100, 'General', 'Before'),
    row('2026-11-15', -30, 'General', 'On'),
  ];
  const settings = settingsOf(goalWith('From', dateCell('2026-11-15')));

  const months = goalMonths(rows, settings);
  assert.deepEqual(
    months.map(({ month }) => month),
    [11, 12],
  );
  assert.deepEqual(descriptionsOf(months[0]), ['On']);
  assert.equal(goalStatus(rows, settings).amount, 30);
});

test('a date cell with a time counts by its day', () => {
  assert.deepEqual(
    goalOf(
      ['From', dateCell('2026-10-01', 0.75)],
      ['To', dateCell('2026-12-31', 0.5)],
      ['Limit', 4000],
    ),
    { from: '2026-10-01', to: '2026-12-31', limit: 4000 },
  );
});

test('From and To may be the same day', () => {
  const goal = goalOf(...goalWith('To', dateCell('2026-10-01')));
  assert.equal(goal.from, '2026-10-01');
  assert.equal(goal.to, '2026-10-01');
});

test('without the row Salary, Salary movements count', () => {
  const rows = [row('2026-10-05', 2500, 'Salary', 'October pay'), row('2026-10-06', -100)];
  const settings = settingsOf(
    GOAL,
    LEAVE_OUT.filter(([category]) => category !== 'Salary'),
  );

  assert.equal(goalStatus(rows, settingsOf()).amount, 100);
  assert.equal(goalStatus(rows, settings).amount, -2400);
});

test('the row Car | Petrol leaves out the Car movements "Petrol", but not "Petrol station"', () => {
  const rows = [
    row('2026-10-05', -40, 'Car', 'Petrol'),
    row('2026-10-06', -30, 'Car', 'Petrol station'),
  ];
  const settings = settingsOf(GOAL, [...LEAVE_OUT, ['Car', 'Petrol']]);

  assert.equal(goalStatus(rows, settings).amount, 30);
  assert.deepEqual(descriptionsOf(goalMonths(rows, settings)[0]), ['Petrol station']);
});

test('in GOAL LEAVE OUT, spaces around do not matter, but capital letters do', () => {
  assert.deepEqual(leftOutOf([' Car ', ' Petrol '], ['car', 'petrol'], [' Pay ']), {
    categories: ['Pay'],
    descriptions: { Car: ['Petrol'], car: ['petrol'] },
  });
});

test('an empty GOAL LEAVE OUT table is not a mistake: nothing is left out', () => {
  assert.deepEqual(leftOutOf(), { categories: [], descriptions: {} });
});

test('a category with an odd name, like __proto__, is kept as it is written', () => {
  const { descriptions } = leftOutOf(['__proto__', 'Odd'], ['constructor', 'Odd too']);
  assert.deepEqual(Object.keys(descriptions), ['__proto__', 'constructor']);
  assert.deepEqual(descriptions.constructor, ['Odd too']);
});

test('a missing setting is a mistake, with no row, in the order From, To, Limit', () => {
  assert.deepEqual(mistakesOf(['Limit', 4000]), [
    { kind: 'settingMissing', table: 'GOAL', setting: 'From' },
    { kind: 'settingMissing', table: 'GOAL', setting: 'To' },
  ]);
  assert.deepEqual(
    mistakesOf().map(({ setting }) => setting),
    ['From', 'To', 'Limit'],
  );
});

test('a setting there twice is a mistake on the lower row; the first one counts', () => {
  const { value, mistakes } = readGoal(table(...GOAL, ['limit', 'x']));

  assert.deepEqual(mistakes, [{ kind: 'settingTwice', table: 'GOAL', row: 6, setting: 'Limit' }]);
  assert.equal(value.limit, 4000);
});

test('a row with another name is a mistake', () => {
  assert.deepEqual(mistakesOf(...GOAL, ['Start', dateCell('2026-10-01')]), [
    { kind: 'unknownSetting', table: 'GOAL', row: 6, setting: 'Start' },
  ]);
});

test('From or To that is not a date cell is a mistake: a text, a plain number or nothing', () => {
  for (const value of ['soon', 46000, '1/10/2026', undefined, '']) {
    assert.deepEqual(
      mistakesOf(...goalWith('To', value)),
      [{ kind: 'notADate', table: 'GOAL', row: 4, setting: 'To' }],
      String(value),
    );
  }
  assert.deepEqual(mistakesOf(...goalWith('From', 46000)), [
    { kind: 'notADate', table: 'GOAL', row: 3, setting: 'From' },
  ]);
});

test('From after To is a mistake, on the row of From', () => {
  assert.deepEqual(mistakesOf(...goalWith('From', dateCell('2027-01-01'))), [
    { kind: 'fromAfterTo', table: 'GOAL', row: 3 },
  ]);
  // With the rows the other way round, still on the row of From.
  assert.deepEqual(
    mistakesOf(['Limit', 4000], ['To', dateCell('2026-10-01')], ['From', dateCell('2026-10-02')]),
    [{ kind: 'fromAfterTo', table: 'GOAL', row: 5 }],
  );
});

test('a limit that is not a number above 0 is a mistake: 0, below 0, a text, a date or nothing', () => {
  for (const value of [0, -5, '4000', dateCell('2026-10-01'), undefined, '', Infinity, NaN]) {
    assert.deepEqual(
      mistakesOf(...goalWith('Limit', value)),
      [{ kind: 'badLimit', table: 'GOAL', row: 5 }],
      String(value),
    );
  }
});
