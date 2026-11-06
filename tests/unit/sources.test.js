import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SOURCE_ICONS, readSources } from '../../src/sources.js';
import { ICONS } from '../../src/icons.js';
import { planSave, sheetDay } from '../../src/movements.js';

// The movement sources, from the SOURCES table of the App sheet (issue #124). Its columns:
// Source, Icon, Paired with.

// A table as readAppSheet gives it (app-sheet.js): its items, each with its row in the sheet.
const table = (...cells) => ({
  column: 6,
  rows: cells.map((each, index) => ({ row: index + 3, cells: each })),
});

// The rows the issue asks to copy, so everything works as it did before.
const COPIED = [
  ['BBVA David', 'bank'],
  ['BBVA Común', 'bank'],
  ['Después', 'card'],
  ['AMEX', 'card'],
  ['ECI', 'card'],
  ['ICON', 'card'],
  ['Pluxee', 'card'],
  ['Edenred', 'card'],
  ['Cash', 'cash', 'Provisioned'],
  ['Polina', 'bank'],
  ['Provisioned', 'bank'],
  ['Deprovisioned', 'bank'],
];

const settingsOf = (...cells) => {
  const { value, mistakes } = readSources(table(...cells));
  assert.deepEqual(mistakes, []);
  return value;
};

const mistakesOf = (...cells) => readSources(table(...cells)).mistakes;

// A day in October, as the sheet keeps it.
const DAY = sheetDay('2026-10-05');
const movement = (source, amount) => [source, DAY, 'General', '', amount];

test('a source can have the icon of the bank, a card or cash, and they all exist', () => {
  assert.deepEqual(SOURCE_ICONS, ['bank', 'card', 'cash']);
  for (const name of SOURCE_ICONS) assert.ok(ICONS[name], name);
});

test('with the copied rows, the icons, the order and the pair are the same as before', () => {
  assert.deepEqual(settingsOf(...COPIED), {
    sources: {
      'BBVA David': 'bank',
      'BBVA Común': 'bank',
      Después: 'card',
      AMEX: 'card',
      ECI: 'card',
      ICON: 'card',
      Pluxee: 'card',
      Edenred: 'card',
      Cash: 'cash',
      Polina: 'bank',
      Provisioned: 'bank',
      Deprovisioned: 'bank',
    },
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
  });
});

test('AMEX with the bank icon shows the bank; with no icon, it shows none but keeps its place', () => {
  assert.equal(settingsOf(['AMEX', 'bank']).sources.AMEX, 'bank');

  const empty = settingsOf(['BBVA David', 'bank'], ['AMEX'], ['Cash', '', '']);
  assert.deepEqual(empty.sources, { 'BBVA David': 'bank' });
  assert.deepEqual(empty.sourceOrder, ['BBVA David', 'AMEX', 'Cash']);
});

test('spaces around a source, an icon or a paired source do not matter', () => {
  assert.deepEqual(settingsOf([' Cash ', ' cash ', ' Provisioned '], ['Provisioned ', 'bank']), {
    sources: { Cash: 'cash', Provisioned: 'bank' },
    sourceOrder: ['Cash', 'Provisioned'],
    sourcePairs: { Cash: 'Provisioned' },
  });
});

test('Cash moved above BBVA David: a new Cash movement is saved above a BBVA David one', () => {
  const settings = settingsOf(
    ['Cash', 'cash', 'Provisioned'],
    ...COPIED.filter(([s]) => s !== 'Cash'),
  );

  const { rows } = planSave([movement('BBVA David', 20)], movement('Cash', 5), settings);

  assert.deepEqual(
    rows.map(([source, , , , amount]) => `${source} ${amount}`),
    ['Cash 5', 'BBVA David 20'],
  );
});

test('with its pair, Provisioned goes right below Cash; without it, Provisioned keeps its place', () => {
  const day = [movement('Polina', 10), movement('Provisioned', 5)];
  const order = (settings) =>
    planSave(day, movement('Cash', 5), settings).rows.map(
      ([source, , , , amount]) => `${source} ${amount}`,
    );

  assert.deepEqual(order(settingsOf(...COPIED)), ['Cash 5', 'Provisioned 5', 'Polina 10']);

  const unpaired = COPIED.map((row) => (row[0] === 'Cash' ? ['Cash', 'cash'] : row));
  assert.deepEqual(order(settingsOf(...unpaired)), ['Cash 5', 'Polina 10', 'Provisioned 5']);
});

test('an empty table is not a mistake: no icons, and a new movement goes last in its day', () => {
  const settings = settingsOf();
  assert.deepEqual(settings, { sources: {}, sourceOrder: [], sourcePairs: {} });

  const day = [movement('Polina', 10), movement('Provisioned', 5)];
  const { rows } = planSave(day, movement('Cash', 5), settings);

  assert.deepEqual(
    rows.map(([source, , , , amount]) => `${source} ${amount}`),
    ['Polina 10', 'Provisioned 5', 'Cash 5'],
  );
});

test('an icon that is not bank, card, cash or empty is a mistake; capital letters matter', () => {
  assert.deepEqual(mistakesOf(['AMEX', 'wallet'], ['Cash', 'Cash'], ['ECI', 'car']), [
    { kind: 'badSourceIcon', table: 'SOURCES', row: 3, icon: 'wallet' },
    { kind: 'badSourceIcon', table: 'SOURCES', row: 4, icon: 'Cash' },
    { kind: 'badSourceIcon', table: 'SOURCES', row: 5, icon: 'car' },
  ]);
});

test('a source there twice is a mistake, on the second row; other capital letters are another source', () => {
  assert.deepEqual(mistakesOf(['Cash', 'cash'], ['AMEX', 'card'], [' Cash', 'bank'], ['cash']), [
    { kind: 'sourceTwice', table: 'SOURCES', row: 5, source: 'Cash' },
  ]);
});

test('a paired source that is not in the table is a mistake; capital letters matter', () => {
  assert.deepEqual(
    mistakesOf(['Cash', 'cash', 'Bank'], ['AMEX', 'card', 'provisioned'], ['Provisioned']),
    [
      { kind: 'unknownPartner', table: 'SOURCES', row: 3, partner: 'Bank' },
      { kind: 'unknownPartner', table: 'SOURCES', row: 4, partner: 'provisioned' },
    ],
  );
});

test('a source paired with itself is a mistake', () => {
  assert.deepEqual(mistakesOf(['Cash', 'cash', 'Cash']), [
    { kind: 'pairedWithItself', table: 'SOURCES', row: 3, source: 'Cash' },
  ]);
});

test('the same source in two rows of "Paired with" is a mistake, on the lower row', () => {
  assert.deepEqual(
    mistakesOf(['Cash', 'cash', 'Provisioned'], ['Polina', 'bank', 'Provisioned'], ['Provisioned']),
    [{ kind: 'partnerTwice', table: 'SOURCES', row: 4, partner: 'Provisioned' }],
  );
});

test('two sources paired with each other is a mistake, on the lower row, with no other line', () => {
  assert.deepEqual(
    mistakesOf(
      ['Cash', 'cash', 'Provisioned'],
      ['Polina', 'bank'],
      ['Provisioned', 'bank', 'Cash'],
    ),
    [{ kind: 'pairedBothWays', table: 'SOURCES', row: 5, first: 'Cash', second: 'Provisioned' }],
  );
});

test('a source that goes below another cannot be paired with a third one', () => {
  assert.deepEqual(
    mistakesOf(
      ['Cash', 'cash', 'Provisioned'],
      ['Provisioned', 'bank', 'Deprovisioned'],
      ['Deprovisioned', 'bank'],
    ),
    [{ kind: 'pairedChain', table: 'SOURCES', row: 4, source: 'Provisioned', above: 'Cash' }],
  );
});

test('the chain is found also when the source that goes below is higher in the table', () => {
  assert.deepEqual(
    mistakesOf(
      ['Provisioned', 'bank', 'Deprovisioned'],
      ['Deprovisioned', 'bank'],
      ['Cash', 'cash', 'Provisioned'],
    ),
    [{ kind: 'pairedChain', table: 'SOURCES', row: 3, source: 'Provisioned', above: 'Cash' }],
  );
});

test('the mistakes of one row come in the order of its columns', () => {
  assert.deepEqual(mistakesOf(['Cash', 'cash'], ['Cash', 'wallet', 'Bank']), [
    { kind: 'sourceTwice', table: 'SOURCES', row: 4, source: 'Cash' },
    { kind: 'badSourceIcon', table: 'SOURCES', row: 4, icon: 'wallet' },
    { kind: 'unknownPartner', table: 'SOURCES', row: 4, partner: 'Bank' },
  ]);
});
