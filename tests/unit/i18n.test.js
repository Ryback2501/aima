import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pickLanguage, browserLanguages, createTranslator, STRINGS } from '../../src/i18n.js';

test('the phone language is used when the app has it', () => {
  assert.equal(pickLanguage(['es-MX', 'en-US']), 'es');
  assert.equal(pickLanguage(['ru-RU']), 'ru');
  assert.equal(pickLanguage(['en-GB']), 'en');
});

test('the first language the app has wins, in the order the phone prefers', () => {
  assert.equal(pickLanguage(['fr-FR', 'ru', 'es']), 'ru');
});

test('upper case language codes work too', () => {
  assert.equal(pickLanguage(['ES-es']), 'es');
});

test('English is used when the phone language is unknown or missing', () => {
  assert.equal(pickLanguage(['fr-FR', 'de']), 'en');
  assert.equal(pickLanguage([]), 'en');
  assert.equal(pickLanguage(undefined), 'en');
  assert.equal(pickLanguage([undefined, '']), 'en');
});

test('every language has exactly the same messages as English', () => {
  const english = Object.keys(STRINGS.en).sort();
  for (const language of Object.keys(STRINGS)) {
    assert.deepEqual(Object.keys(STRINGS[language]).sort(), english, language);
    for (const [key, text] of Object.entries(STRINGS[language])) {
      assert.ok(text.trim(), `${language}.${key} is empty`);
    }
  }
});

test('the app has English, Spanish and Russian', () => {
  assert.deepEqual(Object.keys(STRINGS).sort(), ['en', 'es', 'ru']);
});

test('t returns the message in the chosen language', () => {
  assert.equal(createTranslator('es')('signOut'), STRINGS.es.signOut);
  assert.equal(createTranslator('ru')('signOut'), STRINGS.ru.signOut);
});

test('t fills in values like the email address', () => {
  assert.equal(
    createTranslator('en')('signedInAs', { email: 'ana@example.com' }),
    'Signed in as ana@example.com',
  );
});

test('t shows the key itself when a message does not exist, so it is easy to spot', () => {
  assert.equal(createTranslator('en')('noSuchMessage'), 'noSuchMessage');
});

test('the phone languages come from the browser list, or from the main language when the list is empty', () => {
  assert.deepEqual(browserLanguages({ languages: ['ru-RU', 'en'], language: 'ru-RU' }), [
    'ru-RU',
    'en',
  ]);
  assert.deepEqual(browserLanguages({ languages: [], language: 'es-ES' }), ['es-ES']);
  assert.deepEqual(browserLanguages({ language: 'es-ES' }), ['es-ES']);
  assert.deepEqual(browserLanguages({}), []);
});
