import { test } from 'node:test';
import assert from 'node:assert/strict';

import { monthLayout } from '../../src/month-layout.js';

// Three closed months, 60px tall, 12px apart: they take 204px together.
const closed = [60, 60, 60];
const gap = 12;

test('with nothing open, the months keep their place', () => {
  assert.deepEqual(monthLayout({ heights: closed, gap, open: null, openFull: 0, room: 400 }), {
    heights: [60, 60, 60],
    shift: 0,
    fadeTop: false,
    fadeBottom: false,
    outTop: false,
    outBottom: false,
  });
});

test('an open month that fits with the others needs no shift and no fades', () => {
  assert.deepEqual(monthLayout({ heights: closed, gap, open: 1, openFull: 150, room: 400 }), {
    heights: [60, 150, 60],
    shift: 0,
    fadeTop: false,
    fadeBottom: false,
    outTop: false,
    outBottom: false,
  });
});

test('months below the open one go out at the bottom first, under a fade', () => {
  // Open October: 0-200, November 212-272 is cut by the bottom limit at 250.
  assert.deepEqual(monthLayout({ heights: closed, gap, open: 0, openFull: 200, room: 250 }), {
    heights: [200, 60, 60],
    shift: 0,
    fadeTop: false,
    fadeBottom: true,
    outTop: false,
    outBottom: true,
  });
});

test('when the open month still does not fit, the months above go out at the top', () => {
  // Open December: 144-394 needs a room of 300, so everything moves up by 94.
  // November (72-132) is cut by the top limit at 94; the open month ends at the bottom limit.
  assert.deepEqual(monthLayout({ heights: closed, gap, open: 2, openFull: 250, room: 300 }), {
    heights: [60, 60, 250],
    shift: 94,
    fadeTop: true,
    fadeBottom: false,
    outTop: true,
    outBottom: false,
  });
});

test('an open month taller than the room fills it exactly, with no fade over it', () => {
  // Open November is cut to the room (300) and moves up to the top limit (shift 72).
  assert.deepEqual(monthLayout({ heights: closed, gap, open: 1, openFull: 900, room: 300 }), {
    heights: [60, 300, 60],
    shift: 72,
    fadeTop: false,
    fadeBottom: false,
    outTop: true,
    outBottom: true,
  });
});

test('a month in the middle can push months out on both sides', () => {
  // Open November 72-302 in a room of 240: shift 62, October (0-60) is fully out above,
  // November reaches the bottom limit; December is fully out below.
  assert.deepEqual(monthLayout({ heights: closed, gap, open: 1, openFull: 230, room: 240 }), {
    heights: [60, 230, 60],
    shift: 62,
    fadeTop: false,
    fadeBottom: false,
    outTop: true,
    outBottom: true,
  });
});
