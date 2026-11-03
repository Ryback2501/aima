import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AMOUNT_DIGITS,
  CONCEPT_LIMIT,
  addDigits,
  oneLine,
  removeDigit,
} from '../../src/form-view.js';

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
