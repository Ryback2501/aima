import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pickLanguage,
  browserLanguages,
  createTranslator,
  createMoneyFormatter,
  createAmountFormatter,
  createMonthNamer,
  createDayNamer,
  createDeleteQuestion,
  createMistakeWriter,
  STRINGS,
} from '../../src/i18n.js';

test('the phone language is used when the app has it', () => {
  assert.equal(pickLanguage(['es-MX', 'en-US']), 'es');
  assert.equal(pickLanguage(['ru-RU']), 'ru');
  assert.equal(pickLanguage(['en-GB']), 'en');
});

test('the first language the app has wins, in the order the phone prefers', () => {
  assert.equal(pickLanguage(['fr-FR', 'ru', 'es']), 'ru');
});

test('a language chosen on this phone comes first, so it wins over the phone languages', () => {
  assert.equal(pickLanguage(['ru', 'es-ES', 'en']), 'ru');
  // Nothing chosen yet, or a choice the app no longer has: the phone languages decide.
  assert.equal(pickLanguage([null, 'es-ES', 'en']), 'es');
  assert.equal(pickLanguage(['fr', 'es-ES', 'en']), 'es');
});

test('a damaged saved language never breaks the start, even a built-in JavaScript name', () => {
  assert.equal(pickLanguage(['constructor', '__proto__', 'toString', 'es']), 'es');
  assert.equal(pickLanguage(['constructor']), 'en');
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

// Money texts use special spaces that do not break the line. Plain spaces are easier to read here.
const plain = (text) => text.replace(/\s/g, ' ');

test('money is written the way each language writes euros', () => {
  assert.equal(plain(createMoneyFormatter('en')(1234.5)), '€1,234.50');
  assert.equal(plain(createMoneyFormatter('es')(1234.5)), '1.234,50 €');
  assert.equal(plain(createMoneyFormatter('ru')(1234.5)), '1 234,50 €');
});

test('small amounts and zero always show two decimals', () => {
  assert.equal(plain(createMoneyFormatter('es')(0)), '0,00 €');
  assert.equal(plain(createMoneyFormatter('en')(7)), '€7.00');
});

test('an amount being typed is written in cents with the marks of each language', () => {
  assert.equal(createAmountFormatter('en')(123456), '1,234.56');
  assert.equal(createAmountFormatter('es')(123456), '1.234,56');
  // The same space as in the app's other amounts: one that does not break the line.
  assert.equal(createAmountFormatter('ru')(123456), '1\u00a0234,56');
  assert.equal(createAmountFormatter('es')(12345678), '123.456,78');
});

test('small amounts being typed always show two decimals, and no euro sign', () => {
  assert.equal(createAmountFormatter('en')(5), '0.05');
  assert.equal(createAmountFormatter('en')(0), '0.00');
  assert.equal(createAmountFormatter('ru')(100), '1,00');
});

test('month names are in the app language, starting with a capital letter', () => {
  assert.equal(createMonthNamer('en')(2026, 10), 'October');
  assert.equal(createMonthNamer('es')(2026, 10), 'Octubre');
  assert.equal(createMonthNamer('ru')(2026, 12), 'Декабрь');
});

test('dates show the day of the week, the day and the month, starting with a capital letter', () => {
  assert.equal(createDayNamer('en')(2026, 10, 20), 'Tuesday, October 20');
  assert.equal(createDayNamer('es')(2026, 10, 20), 'Martes, 20 de octubre');
  assert.equal(createDayNamer('ru')(2026, 10, 3), 'Суббота, 3 октября');
});

test('the delete question says "this movement" for one, and the number with the right words for more', () => {
  const english = createDeleteQuestion('en');
  assert.equal(english(1), 'Delete this movement?');
  assert.equal(english(2), 'Delete 2 movements?');
  assert.equal(english(21), 'Delete 21 movements?');

  const spanish = createDeleteQuestion('es');
  assert.equal(spanish(1), '¿Eliminar este movimiento?');
  assert.equal(spanish(2), '¿Eliminar 2 movimientos?');
  assert.equal(spanish(21), '¿Eliminar 21 movimientos?');

  // Russian has three forms, by the last numbers: 21 like 1, 2 to 4 alike, and 5 to 20.
  const russian = createDeleteQuestion('ru');
  assert.equal(russian(1), 'Удалить эту операцию?');
  assert.equal(russian(2), 'Удалить 2 операции?');
  assert.equal(russian(5), 'Удалить 5 операций?');
  assert.equal(russian(11), 'Удалить 11 операций?');
  assert.equal(russian(21), 'Удалить 21 операцию?');
  assert.equal(russian(22), 'Удалить 22 операции?');
});

test('the eye button of the goal card has its name for screen readers in every language', () => {
  assert.equal(STRINGS.en.showLeftOut, 'Show the movements the goal leaves out');
  assert.equal(STRINGS.es.showLeftOut, 'Mostrar los movimientos que el objetivo deja fuera');
  assert.equal(STRINGS.ru.showLeftOut, 'Показать операции, которые цель не учитывает');
});

// What a screen reader reads for the spinner, the thumbs-up and the warning (issue #108).
test('the spinner, the thumbs-up and the warning have their texts in every language', () => {
  const expected = {
    en: ['Saving…', 'Deleting…', 'Saved', 'Deleted', 'Not saved', 'Not deleted'],
    es: ['Guardando…', 'Eliminando…', 'Guardado', 'Eliminado', 'No guardado', 'No eliminado'],
    ru: ['Сохранение…', 'Удаление…', 'Сохранено', 'Удалено', 'Не сохранено', 'Не удалено'],
  };
  const keys = [
    'busySaving',
    'busyDeleting',
    'busySaved',
    'busyDeleted',
    'busyNotSaved',
    'busyNotDeleted',
  ];
  for (const [language, texts] of Object.entries(expected)) {
    assert.deepEqual(
      keys.map((key) => STRINGS[language][key]),
      texts,
      language,
    );
  }
});

// The lines of the message when the App sheet has a mistake (issue #122). Each line says where
// and what.
const MISTAKES = [
  { kind: 'noAppSheet', sheet: 'App' },
  { kind: 'firstColumnEmpty', sheet: 'App', table: 'CATEGORIES', row: 3 },
  { kind: 'tableTwice', sheet: 'App', table: 'CATEGORIES', column: 'F' },
  { kind: 'notInTable', sheet: 'App', cell: 'A3' },
];

test('the lines about mistakes in the App sheet are written in English', () => {
  assert.deepEqual(MISTAKES.map(createMistakeWriter('en')), [
    'The document has no sheet called App.',
    'App, CATEGORIES, row 3: the first column is empty.',
    'App, CATEGORIES, column F: the table is there twice.',
    'App, A3: this cell is not in any table.',
  ]);
});

test('the lines about mistakes in the App sheet are written in Spanish', () => {
  assert.deepEqual(MISTAKES.map(createMistakeWriter('es')), [
    'El documento no tiene ninguna hoja llamada App.',
    'App, CATEGORIES, fila 3: la primera columna está vacía.',
    'App, CATEGORIES, columna F: la tabla está dos veces.',
    'App, A3: esta celda no está en ninguna tabla.',
  ]);
});

test('the lines about mistakes in the App sheet are written in Russian', () => {
  assert.deepEqual(MISTAKES.map(createMistakeWriter('ru')), [
    'В документе нет листа с названием App.',
    'App, CATEGORIES, строка 3: первый столбец пуст.',
    'App, CATEGORIES, столбец F: таблица указана дважды.',
    'App, A3: эта ячейка не входит ни в одну таблицу.',
  ]);
});

test('an unknown language writes the lines in English', () => {
  assert.equal(createMistakeWriter('fr')(MISTAKES[0]), 'The document has no sheet called App.');
});
