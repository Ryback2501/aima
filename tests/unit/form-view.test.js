import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AMOUNT_DIGITS,
  CONCEPT_LIMIT,
  addDigits,
  oneLine,
  removeDigit,
} from '../../src/form-view.js';
import { createAmountFormatter } from '../../src/i18n.js';

test('a concept has at most 50 characters', () => {
  assert.equal(CONCEPT_LIMIT, 50);
});

test('line breaks in a concept become spaces, so it is always one line', () => {
  assert.equal(oneLine('Bakery\nand milk'), 'Bakery and milk');
  assert.equal(oneLine('one\r\ntwo\rthree'), 'one two three');
});

test('a longer concept keeps only its first 50 characters', () => {
  const long = 'x'.repeat(60);

  assert.equal(oneLine(long), 'x'.repeat(50));
  assert.equal(oneLine(`${'a'.repeat(49)}\nb`), `${'a'.repeat(49)} `);
});

test('a short concept on one line stays as it is', () => {
  assert.equal(oneLine('Bakery'), 'Bakery');
  assert.equal(oneLine(''), '');
});

test('an amount has at most 8 numbers', () => {
  assert.equal(AMOUNT_DIGITS, 8);
});

test('only the numbers of a typed or pasted text are added, at the end', () => {
  assert.equal(addDigits('', '1'), '1');
  assert.equal(addDigits('12', '5'), '125');
  assert.equal(addDigits('', 'Total: 12,50 €'), '1250');
  assert.equal(addDigits('100', '25'), '10025');
  assert.equal(addDigits('125', 'ab -+,.€'), '125');
});

test('a 0 with no other number before it is ignored', () => {
  assert.equal(addDigits('', '0'), '');
  assert.equal(addDigits('', '007'), '7');
  assert.equal(addDigits('5', '0'), '50');
});

test('numbers past the 8th are ignored: the first ones that fit are added', () => {
  assert.equal(addDigits('1234567', '89'), '12345678');
  assert.equal(addDigits('12345678', '99'), '12345678');
});

test('deleting removes the last number', () => {
  assert.equal(removeDigit('1250'), '125');
  assert.equal(removeDigit('1'), '');
  assert.equal(removeDigit(''), '');
});

// Typing in the amount field, as the new movement form shows it in English (issue #131). The form
// keeps the numbers typed and shows them in cents; with no number kept, the field is empty.
const shown = (digits) => createAmountFormatter('en')(Number(digits));
// Keys typed one after the other, like a person.
const type = (digits, keys) => [...keys].reduce(addDigits, digits);

test('typing: the last two numbers are the cents', () => {
  let digits = type('', '5');
  assert.equal(shown(digits), '0.05');
  digits = type(digits, '0');
  assert.equal(shown(digits), '0.50');
  digits = type(digits, '0');
  assert.equal(shown(digits), '5.00');
});

test('typing: a 0 typed into the empty field is ignored', () => {
  let digits = type('', '0');
  assert.equal(digits, '');
  digits = type(digits, '7');
  assert.equal(shown(digits), '0.07');
});

test('typing: big amounts show the thousands mark, and only 8 numbers are taken', () => {
  let digits = type('', '123456');
  assert.equal(shown(digits), '1,234.56');
  digits = type(digits, '78');
  assert.equal(shown(digits), '123,456.78');
  digits = type(digits, '9');
  assert.equal(shown(digits), '123,456.78');
});

test('typing: letters, spaces, signs, commas and dots are ignored', () => {
  let digits = type('', 'ab -+,.€');
  assert.equal(digits, '');
  digits = type(digits, '1250');
  digits = type(digits, 'x -+,.€');
  assert.equal(shown(digits), '12.50');
});

test('pasting: a paste adds only its numbers, at the end, as if they were typed', () => {
  assert.equal(shown(addDigits('', 'Total: 12,50 €')), '12.50');
  // After emptying the field, 100 is typed and then 25 is pasted.
  assert.equal(shown(addDigits(type('', '100'), '25')), '100.25');
});

test('pasting: a paste that does not fit adds only the first numbers that fit', () => {
  let digits = type('', '1234567');
  assert.equal(shown(digits), '12,345.67');
  digits = addDigits(digits, '89');
  assert.equal(shown(digits), '123,456.78');
  digits = addDigits(digits, '99');
  assert.equal(shown(digits), '123,456.78');
});
