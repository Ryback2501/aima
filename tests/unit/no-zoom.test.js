import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blockZoom } from '../../src/no-zoom.js';

// A fake page that keeps the listeners and lets the test "touch" it.
function fakeTarget() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, listener, options) {
      listeners[type] = { listener, options };
    },
    fire(type, extra = {}) {
      let stopped = false;
      listeners[type]?.listener({ ...extra, preventDefault: () => (stopped = true) });
      return stopped;
    },
  };
}

test('pinch gestures on iPhone and iPad are stopped', () => {
  const target = fakeTarget();
  blockZoom(target);

  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    assert.equal(target.fire(type), true, type);
  }
});

test('moving two fingers is stopped, because that is a pinch', () => {
  const target = fakeTarget();
  blockZoom(target);

  assert.equal(target.fire('touchmove', { touches: [{}, {}] }), true);
});

test('moving one finger still works, so people can scroll', () => {
  const target = fakeTarget();
  blockZoom(target);

  assert.equal(target.fire('touchmove', { touches: [{}] }), false);
});

test('the listeners tell the browser they may stop the touch', () => {
  const target = fakeTarget();
  blockZoom(target);

  // Without passive: false, the browser ignores preventDefault on touch events.
  for (const { options } of Object.values(target.listeners)) {
    assert.equal(options.passive, false);
  }
});
