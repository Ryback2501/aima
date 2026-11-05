import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BUSY, SPINNER, dotOpacities } from '../../src/busy-view.js';

// The spinner while a movement is saved or deleted (issue #108).

// The opacities, rounded so that small rounding errors do not matter.
const at = (time) => dotOpacities(time).map((value) => Math.round(value * 100) / 100);
// 16 dots: the given ones (numbered 1 to 16, 1 at the top) with these opacities, the rest 0.
function dots(visible) {
  const all = new Array(16).fill(0);
  for (const [number, opacity] of Object.entries(visible)) all[number - 1] = opacity;
  return all;
}

test('the spinner has 16 grey dots on a ring 48px wide, and one step every 100 ms', () => {
  assert.deepEqual(SPINNER, { dots: 16, size: 48, dotSize: 6, step: 100, color: '#6b7280' });
});

test('it starts with dots 1 and 2 fully visible, and all the others invisible', () => {
  assert.deepEqual(at(0), dots({ 1: 1, 2: 1 }));
});

test('in the first step, dot 1 fades out while dot 3 fades in', () => {
  assert.deepEqual(at(25), dots({ 1: 0.75, 2: 1, 3: 0.25 }));
  assert.deepEqual(at(50), dots({ 1: 0.5, 2: 1, 3: 0.5 }));
});

test('then dots 2 and 3 are visible, and dot 2 fades out while dot 4 fades in', () => {
  assert.deepEqual(at(100), dots({ 2: 1, 3: 1 }));
  assert.deepEqual(at(150), dots({ 2: 0.5, 3: 1, 4: 0.5 }));
  assert.deepEqual(at(200), dots({ 3: 1, 4: 1 }));
});

test('after dot 16 comes dot 1 again: one turn takes 1.6 seconds', () => {
  assert.deepEqual(at(1500), dots({ 16: 1, 1: 1 }));
  assert.deepEqual(at(1550), dots({ 16: 0.5, 1: 1, 2: 0.5 }));
  assert.deepEqual(at(1600), at(0));
  assert.deepEqual(at(1600 * 3 + 150), at(150));
});

test('at any moment, two dots are visible in total', () => {
  for (let time = 0; time < 3200; time += 7) {
    const sum = dotOpacities(time).reduce((total, value) => total + value, 0);
    assert.ok(Math.abs(sum - 2) < 1e-9, `at ${time} ms the sum is ${sum}`);
  }
});

test('the spinner shows for at least 300 ms, and the thumbs-up or the warning for 1 second', () => {
  assert.equal(BUSY.minimum, 300);
  assert.equal(BUSY.iconTime, 1000);
});
