import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cutToCents,
  firstRowOf,
  formValues,
  missingFields,
  movementRow,
  planDelete,
  planEdit,
  planSave,
  sameMovement,
  sameMovements,
  sheetDay,
  sortMovements,
} from '../../src/movements.js';

// The source order of the issue, and the Provisioned movement that follows each Cash.
const settings = {
  sourceOrder: [
    'BBVA David',
    'BBVA Común',
    'Después',
    'AMEX',
    'ECI',
    'ICON',
    'Pluxee',
    'Edenred',
    'Cash',
    'Polina',
    'Provisioned',
    'Deprovisioned',
  ],
  sourcePairs: { Cash: 'Provisioned' },
};

const DAY = 46300;
// A movement row as in the sheet: source, date, category, concept, amount.
const m = (source, amount = -1, concept = '', day = DAY) => [
  source,
  day,
  'General',
  concept,
  amount,
];
// The sources (and amounts, when they matter) of rows, to compare easily.
const sources = (rows) => rows.map(([source]) => source);
const withAmounts = (rows) => rows.map(([source, , , , amount]) => `${source} ${amount}`);

test('inside a day, a BBVA David movement goes first, above BBVA Común', () => {
  const day = [m('BBVA Común'), m('AMEX'), m('Cash'), m('BBVA David')];

  assert.deepEqual(sources(sortMovements(day, settings)), [
    'BBVA David',
    'BBVA Común',
    'AMEX',
    'Cash',
  ]);
});

test('a Después movement goes between BBVA David and AMEX', () => {
  const day = [m('BBVA David'), m('AMEX'), m('Cash'), m('Después')];

  assert.deepEqual(sources(sortMovements(day, settings)), [
    'BBVA David',
    'Después',
    'AMEX',
    'Cash',
  ]);
});

test('a new movement goes after the movements of its source that are already there', () => {
  const day = [m('Edenred', -1, 'first'), m('Edenred', -2, 'second'), m('Edenred', -3, 'new')];

  assert.deepEqual(
    sortMovements(day, settings).map(([, , , concept]) => concept),
    ['first', 'second', 'new'],
  );
});

test('a Provisioned movement goes right below the Cash with the same amount', () => {
  const day = [m('Cash', -10), m('Provisioned', -10), m('Cash', -5), m('Provisioned', -5)];

  assert.deepEqual(withAmounts(sortMovements(day, settings)), [
    'Cash -10',
    'Provisioned -10',
    'Cash -5',
    'Provisioned -5',
  ]);
});

test('a new Cash goes after the Cash pairs already there, and its Provisioned right below it', () => {
  const day = [m('Cash', -10), m('Provisioned', -10), m('Cash', -20)];
  const sorted = sortMovements(day, settings);

  assert.deepEqual(withAmounts(sorted), ['Cash -10', 'Provisioned -10', 'Cash -20']);
  assert.deepEqual(withAmounts(sortMovements([...sorted, m('Provisioned', -20)], settings)), [
    'Cash -10',
    'Provisioned -10',
    'Cash -20',
    'Provisioned -20',
  ]);
});

test('a Provisioned movement with no Cash to pair with goes between Polina and Deprovisioned', () => {
  const day = [m('Polina'), m('Deprovisioned'), m('Provisioned', -7)];

  assert.deepEqual(sources(sortMovements(day, settings)), [
    'Polina',
    'Provisioned',
    'Deprovisioned',
  ]);
});

test('a Provisioned movement pairs only with a Cash of the same sign', () => {
  const day = [m('Cash', 10), m('Polina'), m('Provisioned', -10)];

  assert.deepEqual(withAmounts(sortMovements(day, settings)), [
    'Cash 10',
    'Polina -1',
    'Provisioned -10',
  ]);
});

test('a source that is not in the order goes last, after every other source', () => {
  const day = [m('Cash'), m('Polina'), m('Old bank'), m('Edenred')];

  assert.deepEqual(sources(sortMovements(day, settings)), [
    'Edenred',
    'Cash',
    'Polina',
    'Old bank',
  ]);
});

test('movements are sorted by day first, and a day with a time counts as that day', () => {
  const rows = [m('Cash', -1, '', DAY + 1), m('AMEX', -1, '', DAY + 1.5), m('ECI', -1, '', DAY)];

  assert.deepEqual(sources(sortMovements(rows, settings)), ['ECI', 'AMEX', 'Cash']);
});

test('a movement newer than every movement becomes the new last row', () => {
  const rows = [m('Cash', -1, '', DAY), m('AMEX', -1, '', DAY + 1)];

  const plan = planSave(rows, m('Polina', -1, '', DAY + 5), settings);

  assert.equal(plan.start, 2);
  assert.deepEqual(sources(plan.rows), ['Polina']);
});

test('a movement in the middle sorts its day and every later day, and leaves earlier days', () => {
  const rows = [
    m('Cash', -1, '', DAY),
    m('AMEX', -1, '', DAY),
    m('Cash', -1, '', DAY + 1),
    // A later day out of order: Cash above AMEX.
    m('Cash', -1, '', DAY + 2),
    m('AMEX', -1, '', DAY + 2),
  ];

  const plan = planSave(rows, m('BBVA David', -1, '', DAY + 1), settings);

  // The rows from the first movement of the new movement's day, to one row past the last.
  assert.equal(plan.start, 2);
  assert.deepEqual(sources(plan.rows), ['BBVA David', 'Cash', 'AMEX', 'Cash']);
});

test('rows below the last movement, with no date, are not movements', () => {
  const rows = [m('Cash', -1, '', DAY), ['', '', '', '', '']];

  const plan = planSave(rows, m('AMEX', -1, '', DAY), settings);

  assert.equal(plan.start, 0);
  assert.deepEqual(sources(plan.rows), ['AMEX', 'Cash']);
});

test('a date of the form becomes the day number the sheet uses', () => {
  // 5 October 2026: days since 30 December 1899.
  assert.equal(sheetDay('2026-10-05'), 46300);
});

test('a movement row has the source, the day, the category, the concept and the amount', () => {
  const values = {
    source: 'Cash',
    date: '2026-10-05',
    category: 'General',
    concept: '  Bakery  ',
    digits: '1250',
    sign: 'minus',
  };

  assert.deepEqual(movementRow(values), ['Cash', 46300, 'General', 'Bakery', -12.5]);
  assert.deepEqual(movementRow({ ...values, sign: 'plus', concept: '   ' }), [
    'Cash',
    46300,
    'General',
    '',
    12.5,
  ]);
  assert.equal(movementRow({ ...values, digits: '123456' })[4], -1234.56);
});

test('source, date, category and amount are required; the concept may be empty', () => {
  const values = {
    source: 'Cash',
    date: '2026-10-05',
    category: 'General',
    concept: '',
    digits: '1250',
    sign: 'minus',
  };

  assert.deepEqual(missingFields(values), []);
  assert.deepEqual(missingFields({ ...values, source: '', category: '', date: '', digits: '' }), [
    'source',
    'date',
    'category',
    'amount',
  ]);
});

// An empty row of the five movement columns.
const EMPTY = ['', '', '', '', ''];

test('deleting movements moves every movement below them up, and empties the last rows', () => {
  const rows = [
    m('Cash', -1, 'a'),
    m('Cash', -2, 'b'),
    m('Cash', -3, 'c'),
    m('Cash', -4, 'd'),
    m('Cash', -5, 'e'),
  ];

  const plan = planDelete(rows, [1, 3]);

  // From the first deleted row down to the last movement: the others keep their order.
  assert.equal(plan.start, 1);
  assert.deepEqual(plan.rows, [m('Cash', -3, 'c'), m('Cash', -5, 'e'), EMPTY, EMPTY]);
});

test('the order of the deleted rows given does not matter', () => {
  const rows = [m('Cash', -1, 'a'), m('Cash', -2, 'b'), m('Cash', -3, 'c')];

  assert.deepEqual(planDelete(rows, [2, 0]), {
    start: 0,
    rows: [m('Cash', -2, 'b'), EMPTY, EMPTY],
  });
});

test('a Provisioned movement below a deleted Cash movement stays, and moves up', () => {
  const rows = [m('Cash', -10), m('Provisioned', -10), m('Polina', -1)];

  const plan = planDelete(rows, [0]);

  assert.deepEqual(sources(plan.rows), ['Provisioned', 'Polina', '']);
});

test('rows below the last movement, with no date, are not moved', () => {
  const rows = [m('Cash', -1, 'a'), m('Cash', -2, 'b'), EMPTY, ['', '', '', 'note']];

  assert.deepEqual(planDelete(rows, [0]), { start: 0, rows: [m('Cash', -2, 'b'), EMPTY] });
});

test('a movement row with formulas is moved as it is, with its formulas', () => {
  const rows = [m('Cash', -1, 'a'), ['Cash', DAY, 'General', 'b', '=2*3']];

  assert.deepEqual(planDelete(rows, [0]).rows, [['Cash', DAY, 'General', 'b', '=2*3'], EMPTY]);
});

test('the selected rows are the same when each one still holds the movement that was seen', () => {
  const seen = [['Source', 'Date'], m('Cash', -1, 'a'), m('Cash', -2, 'b'), m('Cash', -3, 'c')];
  const now = [['Source', 'Date'], m('Cash', -1, 'a'), m('Cash', -2, 'b'), m('AMEX', -7, 'new')];

  assert.equal(sameMovements(seen, now, [1, 2]), true);
  assert.equal(sameMovements(seen, now, [1, 3]), false);
  // A row that is not there any more.
  assert.equal(sameMovements(seen, now.slice(0, 2), [2]), false);
});

test('an empty cell at the end of a row, sent or not sent by Google, is the same movement', () => {
  const seen = [['Cash', DAY, 'General', '', -1]];

  assert.equal(sameMovements(seen, [['Cash', DAY, 'General', '', -1]], [0]), true);
  assert.equal(
    sameMovements([['Cash', DAY, 'General']], [['Cash', DAY, 'General', '']], [0]),
    true,
  );
  assert.equal(sameMovements(seen, [['Cash', DAY, 'General', '', -1.5]], [0]), false);
});

test('the first row of a range: row 1 when the range gives no row', () => {
  assert.equal(firstRowOf('Movements!A:E'), 1);
  assert.equal(firstRowOf('Movements!A2:E'), 2);
  assert.equal(firstRowOf('A15:E40'), 15);
});

test('a last movement whose date is a formula is a movement too, and moves up', () => {
  const last = ['Cash', '=DATE(2026,10,9)', 'General', 'c', -3];
  const rows = [m('Cash', -1, 'a'), m('Cash', -2, 'b'), last, EMPTY];

  assert.deepEqual(planDelete(rows, [0]), { start: 0, rows: [m('Cash', -2, 'b'), last, EMPTY] });
});

test('an amount is cut to its cents, toward 0, without rounding', () => {
  assert.equal(cutToCents(12.345), 1234);
  assert.equal(cutToCents(-12.345), -1234);
  assert.equal(cutToCents(12.34), 1234);
  assert.equal(cutToCents(0.1 + 0.2), 30);
  assert.equal(cutToCents(0), 0);
});

test('a movement row gives the values of the form: the day, the amount numbers and its sign', () => {
  assert.deepEqual(formValues([' Cash ', DAY, 'General', ' Bakery ', -12.5]), {
    source: 'Cash',
    date: '2026-10-05',
    category: 'General',
    concept: 'Bakery',
    digits: '1250',
    sign: 'minus',
  });
  assert.deepEqual(formValues(['Cash', DAY, 'General', '', 125]), {
    source: 'Cash',
    date: '2026-10-05',
    category: 'General',
    concept: '',
    digits: '12500',
    sign: 'plus',
  });
});

test('in the form, 0 shows as 0.00 with "−", more decimals are cut, and a time of day is left out', () => {
  assert.deepEqual(
    [formValues(m('Cash', 0)), formValues(m('Cash', 12.345)), formValues(m('Cash', -12.345))].map(
      ({ digits, sign }) => [digits, sign],
    ),
    [
      ['0', 'minus'],
      ['1234', 'plus'],
      ['1234', 'minus'],
    ],
  );
  assert.equal(formValues(m('Cash', -1, '', DAY + 0.75)).date, '2026-10-05');
});

test('the form shows the same movement when only spaces or the time of day are different', () => {
  const row = ['Cash', DAY + 0.75, 'General', 'Bakery', -12.5];

  assert.equal(sameMovement(row, formValues(row)), true);
  assert.equal(sameMovement(row, { ...formValues(row), concept: '  Bakery ' }), true);
  assert.equal(sameMovement(row, { ...formValues(row), category: 'House' }), false);
  assert.equal(sameMovement(row, { ...formValues(row), date: '2026-10-06' }), false);
  assert.equal(sameMovement(row, { ...formValues(row), sign: 'plus' }), false);
  // An amount with more decimals is cut in the form: saving it is a change.
  const odd = m('Cash', -12.345);
  assert.equal(sameMovement(odd, formValues(odd)), false);
});

test('a changed movement with the same day and source keeps its place among them', () => {
  const rows = [m('Edenred', -1, 'first'), m('Edenred', -2, 'second')];

  assert.deepEqual(planEdit(rows, 0, m('Edenred', -1, 'changed'), settings), {
    start: 0,
    rows: [m('Edenred', -1, 'changed'), m('Edenred', -2, 'second')],
  });
});

test('a movement moved to a later day goes after its source there; the rows between move up', () => {
  const rows = [m('Cash', -1, 'a', DAY), m('AMEX', -2, 'b', DAY + 1), m('Cash', -3, 'c', DAY + 2)];

  assert.deepEqual(planEdit(rows, 0, m('Cash', -1, 'a', DAY + 2), settings), {
    start: 0,
    rows: [m('AMEX', -2, 'b', DAY + 1), m('Cash', -3, 'c', DAY + 2), m('Cash', -1, 'a', DAY + 2)],
  });
});

test('a movement moved to an earlier day is written from that day, and the days before stay', () => {
  const rows = [m('Cash', -9, 'x', DAY - 1), m('Cash', -1, 'a', DAY), m('Cash', -2, 'b', DAY + 2)];

  assert.deepEqual(planEdit(rows, 2, m('Cash', -2, 'b', DAY), settings), {
    start: 1,
    rows: [m('Cash', -1, 'a', DAY), m('Cash', -2, 'b', DAY)],
  });
});

test('a change also puts a later day in order, and the sheet keeps its number of rows', () => {
  // The later day has Cash above AMEX, out of order. Below the movements, an empty row.
  const rows = [m('Cash', -1, 'a', DAY), m('Cash', -2, 'b', DAY + 1), m('AMEX', -3, 'c', DAY + 1)];

  assert.deepEqual(planEdit([...rows, EMPTY], 0, m('Cash', -1, 'changed', DAY), settings), {
    start: 0,
    rows: [m('Cash', -1, 'changed', DAY), m('AMEX', -3, 'c', DAY + 1), m('Cash', -2, 'b', DAY + 1)],
  });
});

test('a Provisioned movement stays right below its Cash movement when only the Cash amount changes', () => {
  const rows = [m('Cash', -10, 'c'), m('Provisioned', -10, 'p'), m('Cash', -5, 'd')];

  assert.deepEqual(planEdit(rows, 0, m('Cash', -20, 'c'), settings).rows, [
    m('Cash', -20, 'c'),
    m('Provisioned', -10, 'p'),
    m('Cash', -5, 'd'),
  ]);
});

test('a Provisioned movement stays in its day, in the usual order, when its Cash goes to another day', () => {
  const rows = [
    m('AMEX', -1, 'x', DAY),
    m('Cash', -10, 'c', DAY),
    m('Provisioned', -10, 'p', DAY),
    m('Polina', -2, 'y', DAY),
    m('Cash', -3, 'z', DAY + 1),
  ];

  assert.deepEqual(planEdit(rows, 1, m('Cash', -10, 'c', DAY + 1), settings).rows, [
    m('AMEX', -1, 'x', DAY),
    m('Polina', -2, 'y', DAY),
    m('Provisioned', -10, 'p', DAY),
    m('Cash', -3, 'z', DAY + 1),
    m('Cash', -10, 'c', DAY + 1),
  ]);
});

test('a Provisioned movement is placed in the usual order when its Cash gets another source', () => {
  const rows = [m('Cash', -10, 'c'), m('Provisioned', -10, 'p'), m('Polina', -1, 'y')];

  assert.deepEqual(planEdit(rows, 0, m('BBVA David', -10, 'c'), settings).rows, [
    m('BBVA David', -10, 'c'),
    m('Polina', -1, 'y'),
    m('Provisioned', -10, 'p'),
  ]);
});
