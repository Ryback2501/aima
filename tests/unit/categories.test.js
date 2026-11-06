import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_LOOK, ICON_NAMES, lookOf, readCategories } from '../../src/categories.js';
import { ICONS } from '../../src/icons.js';

// The icon and the color of each category, from the CATEGORIES table of the App sheet
// (issue #123). Its columns: Category, Description has, Icon, Color.

// A table as readAppSheet gives it (app-sheet.js): its items, each with its row in the sheet.
const table = (...cells) => ({
  column: 1,
  rows: cells.map((each, index) => ({ row: index + 3, cells: each })),
});

// The rows the issue asks to copy, so everything looks as it did before.
const COPIED = [
  ['Car', '', 'car', '#2f6fd6'],
  ['Credit Cards', '', 'billTransfer', '#1296d6'],
  ['Debts paid', '', 'handshake', '#d9363e'],
  ['General', 'compra', 'cart', '#2b8a3e'],
  ['General', '', 'sackEuro', '#4b5563'],
  ['House', '', 'house', '#e8620c'],
  ['Investing', '', 'investing', '#0f8a8a'],
  ['Leisure', '', 'cocktail', '#b8338f'],
  ['Mortgage', '', 'housePie', '#c47d4a'],
  ['Salary', '', 'sackInHand', '#65a30d'],
  ['Traveling', '', 'suitcase', '#7a4fd6'],
  ['Whitening', '', 'pumpSoap', '#b06ad9'],
  ['Yoshi', '', 'paw', '#b8860b'],
];

const rulesOf = (...cells) => {
  const { value, mistakes } = readCategories(table(...cells));
  assert.deepEqual(mistakes, []);
  return value;
};

test('the icons a category can use are these 17, and they all exist', () => {
  assert.deepEqual(ICON_NAMES, [
    'car',
    'house',
    'housePie',
    'investing',
    'cocktail',
    'suitcase',
    'paw',
    'handshake',
    'sackEuro',
    'sackInHand',
    'cart',
    'billTransfer',
    'pumpSoap',
    'bank',
    'card',
    'cash',
    'piggyBank',
  ]);
  for (const name of ICON_NAMES) assert.ok(ICONS[name], name);
});

test('a movement of a category that is not in the table gets the grey money bag', () => {
  assert.deepEqual(DEFAULT_LOOK, { icon: 'sackEuro', color: '#4b5563' });
  assert.deepEqual(lookOf(rulesOf(...COPIED), 'Foo', 'Something'), DEFAULT_LOOK);
  assert.deepEqual(lookOf(rulesOf(...COPIED), '', ''), DEFAULT_LOOK);
});

test('with the copied rows, every category looks as it did before', () => {
  const rules = rulesOf(...COPIED);
  const before = [
    ['Car', 'Petrol', 'car', '#2f6fd6'],
    ['Credit Cards', 'Cards in October', 'billTransfer', '#1296d6'],
    ['Debts paid', 'Ana', 'handshake', '#d9363e'],
    ['General', 'Compra Mercadona', 'cart', '#2b8a3e'],
    ['General', 'compras de la semana', 'cart', '#2b8a3e'],
    ['General', 'Gran COMPRA', 'cart', '#2b8a3e'],
    ['General', 'Peluquería', 'sackEuro', '#4b5563'],
    ['General', '', 'sackEuro', '#4b5563'],
    ['House', 'Compra de muebles', 'house', '#e8620c'],
    ['House', 'Luz - Endesa', 'house', '#e8620c'],
    ['Investing', 'Fund', 'investing', '#0f8a8a'],
    ['Leisure', 'Cinema', 'cocktail', '#b8338f'],
    ['Mortgage', 'October loan', 'housePie', '#c47d4a'],
    ['Salary', 'October pay', 'sackInHand', '#65a30d'],
    ['Traveling', 'Rome', 'suitcase', '#7a4fd6'],
    ['Whitening', 'Whitening', 'pumpSoap', '#b06ad9'],
    ['Yoshi', 'Vet', 'paw', '#b8860b'],
  ];
  for (const [category, description, icon, color] of before) {
    assert.deepEqual(
      lookOf(rules, category, description),
      { icon, color },
      `${category} ${description}`,
    );
  }
});

test('a row with a text in "Description has" wins, whatever the capital letters', () => {
  const rules = rulesOf(
    ['General', '', 'sackEuro', '#4b5563'],
    ['General', ' COMPRA ', 'cart', '#2b8a3e'],
  );

  assert.deepEqual(lookOf(rules, 'General', 'Una compra'), { icon: 'cart', color: '#2b8a3e' });
  assert.deepEqual(lookOf(rules, 'General', 'Peluquería'), { icon: 'sackEuro', color: '#4b5563' });
});

test('when two rows with a text fit the same movement, the upper row wins', () => {
  const rules = rulesOf(['Car', 'petrol', 'car', '#111111'], ['Car', 'station', 'paw', '#222222']);

  assert.deepEqual(lookOf(rules, 'Car', 'Petrol station'), { icon: 'car', color: '#111111' });
  assert.deepEqual(lookOf(rules, 'Car', 'Station 5'), { icon: 'paw', color: '#222222' });
});

test('a category with only rows with a text gets the grey money bag when none fits', () => {
  const rules = rulesOf(['General', 'compra', 'cart', '#2b8a3e']);

  assert.deepEqual(lookOf(rules, 'General', 'Peluquería'), DEFAULT_LOOK);
  assert.deepEqual(lookOf(rules, 'General', 'Compra Mercadona'), {
    icon: 'cart',
    color: '#2b8a3e',
  });
});

test('the category name needs the same capital letters; spaces around it do not matter', () => {
  const rules = rulesOf([' Car ', '', 'car', '#2f6fd6']);

  assert.deepEqual(lookOf(rules, 'Car', 'Petrol'), { icon: 'car', color: '#2f6fd6' });
  assert.deepEqual(lookOf(rules, ' Car', 'Petrol'), { icon: 'car', color: '#2f6fd6' });
  assert.deepEqual(lookOf(rules, 'car', 'Petrol'), DEFAULT_LOOK);
});

test('spaces around an icon name or a color do not matter, and a color may use capital letters', () => {
  const rules = rulesOf(['Car', '', ' car ', ' #2F6FD6 ']);

  assert.deepEqual(lookOf(rules, 'Car', ''), { icon: 'car', color: '#2F6FD6' });
});

test('an empty icon or color is a mistake, each with its own line', () => {
  const { mistakes } = readCategories(
    table(['Car', '', '', '#2f6fd6'], ['Yoshi', '', 'paw'], ['House']),
  );

  assert.deepEqual(mistakes, [
    { kind: 'iconMissing', table: 'CATEGORIES', row: 3 },
    { kind: 'colorMissing', table: 'CATEGORIES', row: 4 },
    { kind: 'iconMissing', table: 'CATEGORIES', row: 5 },
    { kind: 'colorMissing', table: 'CATEGORIES', row: 5 },
  ]);
});

test('an icon that is not in the list is a mistake; capital letters matter', () => {
  const { mistakes } = readCategories(
    table(['Car', '', 'carr', '#2f6fd6'], ['Yoshi', '', 'Paw', '#b8860b']),
  );

  assert.deepEqual(mistakes, [
    { kind: 'unknownIcon', table: 'CATEGORIES', row: 3, icon: 'carr' },
    { kind: 'unknownIcon', table: 'CATEGORIES', row: 4, icon: 'Paw' },
  ]);
});

test('a color that is not # and six digits or letters from a to f is a mistake', () => {
  const { mistakes } = readCategories(
    table(
      ['A', '', 'car', '#12'],
      ['B', '', 'car', '2f6fd6'],
      ['C', '', 'car', '#2f6fdg'],
      ['D', '', 'car', 123456],
      ['E', '', 'car', '#2f6fd6'],
    ),
  );

  assert.deepEqual(mistakes, [
    { kind: 'badColor', table: 'CATEGORIES', row: 3, color: '#12' },
    { kind: 'badColor', table: 'CATEGORIES', row: 4, color: '2f6fd6' },
    { kind: 'badColor', table: 'CATEGORIES', row: 5, color: '#2f6fdg' },
    { kind: 'badColor', table: 'CATEGORIES', row: 6, color: '123456' },
  ]);
});

test('a category there twice with no text is a mistake, on the second row', () => {
  const { mistakes } = readCategories(
    table(
      ['Car', '', 'car', '#2f6fd6'],
      ['Yoshi', '', 'paw', '#b8860b'],
      ['Car', ' ', 'paw', '#000000'],
    ),
  );

  assert.deepEqual(mistakes, [
    { kind: 'categoryTwice', table: 'CATEGORIES', row: 5, category: 'Car', has: '' },
  ]);
});

test('the same category and text twice is a mistake, whatever the capital letters of the text', () => {
  const { mistakes } = readCategories(
    table(['General', 'compra', 'cart', '#2b8a3e'], ['General', ' Compra ', 'cart', '#2b8a3e']),
  );

  assert.deepEqual(mistakes, [
    { kind: 'categoryTwice', table: 'CATEGORIES', row: 4, category: 'General', has: 'Compra' },
  ]);
});

test('the same text for two categories is not a mistake', () => {
  const { mistakes } = readCategories(
    table(['General', 'compra', 'cart', '#2b8a3e'], ['House', 'compra', 'house', '#e8620c']),
  );

  assert.deepEqual(mistakes, []);
});

test('an empty table is not a mistake: every movement gets the grey money bag', () => {
  const { value, mistakes } = readCategories(table());

  assert.deepEqual(mistakes, []);
  assert.deepEqual(lookOf(value, 'Car', 'Petrol'), DEFAULT_LOOK);
});
