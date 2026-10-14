import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FLAGS } from '../../src/flags.js';
import { STRINGS } from '../../src/i18n.js';

test('the flags are, from top to bottom: English, Russian, Spanish', () => {
  assert.deepEqual(Object.keys(FLAGS), ['en', 'ru', 'es']);
});

test('every language of the app has a flag, and every flag a language', () => {
  assert.deepEqual(Object.keys(FLAGS).sort(), Object.keys(STRINGS).sort());
});

test('every flag has its language name, a drawing area and colored shapes', () => {
  for (const [language, flag] of Object.entries(FLAGS)) {
    assert.equal(typeof flag.name, 'string', language);
    assert.match(flag.viewBox, /^0 0 \d+ \d+$/, language);
    assert.ok(flag.parts.length > 0, language);
    for (const part of flag.parts) {
      assert.match(part.fill, /^#[0-9a-f]{3,6}$/, language);
      assert.ok(part.d.length > 0, language);
    }
  }
});

test('each flag is named in its own language', () => {
  assert.equal(FLAGS.en.name, 'English');
  assert.equal(FLAGS.ru.name, 'Русский');
  assert.equal(FLAGS.es.name, 'Español');
});
