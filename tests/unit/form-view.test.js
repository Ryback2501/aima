import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONCEPT_LIMIT, oneLine } from '../../src/form-view.js';

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
