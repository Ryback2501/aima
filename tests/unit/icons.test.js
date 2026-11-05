import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ICONS } from '../../src/icons.js';

test('every icon has a drawing area and a shape, and no size', () => {
  for (const [name, icon] of Object.entries(ICONS)) {
    assert.match(icon.viewBox, /^0 0 \d+ \d+$/, name);
    assert.ok(icon.path.length > 0, name);
    assert.deepEqual(Object.keys(icon).sort(), ['path', 'viewBox'], name);
  }
});

test('the eye button has an open eye and a crossed-out eye (issue #113)', () => {
  assert.equal(ICONS.eye.viewBox, '0 0 576 512');
  assert.equal(ICONS.eyeSlash.viewBox, '0 0 640 512');
});
