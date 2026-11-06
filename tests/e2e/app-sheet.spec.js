import { test, expect } from '@playwright/test';

import { GOAL_LEAVE_OUT_TABLE, GOAL_TABLE, setUp, sheetDay, sideBySide } from './helpers.js';
import { CARDS } from '../../src/components.js';
import { ICONS } from '../../src/icons.js';
import { STRINGS } from '../../src/i18n.js';

// The App sheet (issue #122): the app reads it first, and when it has a mistake the main screen
// shows only a message card, with the logout button and the language selector at the bottom.

const totalCard = (page) => page.locator('#main [data-card="total"]');
const goalCard = (page) => page.locator('#main [data-card="goal"]');
const messageCard = (page) => page.locator('#main [data-card="mistakes"]');
const lines = (page) => messageCard(page).locator('.mistake-line');
const logOut = (page) => page.locator('#sign-out');
const languagePicker = (page) => page.locator('#main [data-card="language"]');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const edit = (page) => page.locator('#edit');
const remove = (page) => page.locator('#delete');
const form = (page) => page.locator('.movement-form');
const field = (page, name) => form(page).getByLabel(STRINGS.en[name], { exact: true });
const save = (page) => form(page).locator('[data-card="save"]');
const panel = (page) => page.locator('.delete-panel');
const yes = (page) => panel(page).locator('[data-card="yes"]');
const month = (page, index) => page.locator('.month').nth(index);
const movement = (page, monthIndex, index) =>
  month(page, monthIndex).locator('.movement').nth(index);
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);
const thumbsUp = (owner) => owner.locator('.busy-done');
const warning = (owner) => owner.locator('.busy-failed');

const NO_APP_SHEET = 'The document has no sheet called App.';

const movementRows = () => [
  ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -100],
  ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -10],
  ['Cash', sheetDay('2026-10-20'), 'Car', 'Petrol', -40],
];

// Signs in and waits until the first screen after the sign-in has risen.
async function signIn(page, options = {}) {
  const movements = options.movements ?? movementRows();
  const requests = await setUp(page, { canEdit: true, ...options, movements });
  await page.goto('./');
  await page.locator('#sign-in').click();
  await expect(page.locator('#login')).toBeHidden();
  await expect.poll(() => locked(page)).toBe(false);
  return { requests, movements };
}

// The SOURCES, GOAL and GOAL LEAVE OUT tables are required too (issues #124 and #125). An App
// sheet of these tests, with the ones it does not have on the right of its cells, after one
// empty column: an empty SOURCES table and the tests' goal tables, so they add no line.
function withRequired(appSheet) {
  const titles = new Set((appSheet[0] ?? []).map((title) => String(title).trim().toUpperCase()));
  const tables = [
    ['SOURCES', [['SOURCES'], ['Source', 'Icon', 'Paired with']]],
    ['GOAL', GOAL_TABLE],
    ['GOAL LEAVE OUT', GOAL_LEAVE_OUT_TABLE],
  ].filter(([title]) => !titles.has(title));
  if (tables.length === 0) return appSheet;
  const right = sideBySide(...tables.map(([, table]) => table));
  const width = Math.max(...appSheet.map((row) => row.length));
  return Array.from({ length: Math.max(appSheet.length, right.length) }, (_, index) => {
    const row = appSheet[index] ?? [];
    return [...row, ...new Array(width + 1 - row.length).fill(''), ...(right[index] ?? [])];
  });
}

// Signs in with these rows in the App sheet (null: no App sheet), and waits for the message.
async function openMessage(page, appSheet, options = {}) {
  const parts = await signIn(page, { appSheet: appSheet && withRequired(appSheet), ...options });
  await expect(messageCard(page)).toBeVisible();
  return parts;
}

async function tapAndWait(page, locator) {
  await locator.click();
  await page.waitForTimeout(50);
  await expect.poll(() => locked(page)).toBe(false);
}

async function openGoal(page, options = {}) {
  const parts = await signIn(page, options);
  await expect(page.locator('#total-value')).toHaveText(/\d/);
  await tapAndWait(page, goalCard(page));
  await expect(back(page)).toBeVisible();
  return parts;
}

// Keeps the mouse button on a movement for longer than half a second: it is selected.
async function hold(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(() => locked(page)).toBe(false);
}

// Opens October and selects its movement number index.
async function selectMovement(page, index) {
  await tapAndWait(page, month(page, 0).locator('.month-head'));
  await hold(page, movement(page, 0, index));
}

test.describe('reading the App sheet', () => {
  test('with an App sheet with its tables, the main screen shows as before', async ({ page }) => {
    await signIn(page);

    await expect(page.locator('#total-value')).toHaveText('€549.50');
    await expect(goalCard(page)).toBeVisible();
    await expect(messageCard(page)).toBeHidden();
  });

  test('with no App sheet, only the message shows, with logout and the language selector', async ({
    page,
  }) => {
    await openMessage(page, null);

    await expect(lines(page)).toHaveText([NO_APP_SHEET]);
    await expect(totalCard(page)).toBeHidden();
    await expect(goalCard(page)).toBeHidden();
    await expect(logOut(page)).toBeVisible();
    await expect(languagePicker(page)).toBeVisible();
  });
});

test.describe('the message card', () => {
  test('as wide as the Total card, with a red border, the warning icon and the lines on the left @both-screens', async ({
    page,
  }) => {
    const { requests } = await signIn(page);
    const totalWidth = (await totalCard(page).boundingBox()).width;
    // The App sheet goes away; the app is opened again (the sign-in is kept).
    requests.setAppSheet(null);
    await page.reload();
    await expect(messageCard(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);

    const card = await messageCard(page).boundingBox();
    expect(Math.abs(card.width - totalWidth)).toBeLessThan(1);
    expect(
      await messageCard(page).evaluate((node) => node.style.getPropertyValue('--label-border')),
    ).toBe(`linear-gradient(to bottom right, ${CARDS.logOut.colors.join(', ')})`);
    await expect(messageCard(page).locator('.label-badge path')).toHaveAttribute(
      'd',
      ICONS.warning.path,
    );
    expect(
      await lines(page)
        .first()
        .evaluate((node) => getComputedStyle(node).textAlign),
    ).toMatch(/^(left|start)$/);
    // No title: the card holds only the lines.
    expect((await messageCard(page).innerText()).trim()).toBe(NO_APP_SHEET);
  });
});

test.describe('the mistakes', () => {
  test('a row with an empty first column', async ({ page }) => {
    await openMessage(page, [['CATEGORIES'], ['Category', 'Icon'], ['', 'car']]);

    await expect(lines(page)).toHaveText(['App, CATEGORIES, row 3: the first column is empty.']);
  });

  test('a text in the empty column between two tables, with the first column empty', async ({
    page,
  }) => {
    await openMessage(page, [['CATEGORIES', '', '', '', '', 'SOURCES'], [], ['', '', '', '', 'x']]);

    await expect(lines(page)).toHaveText(['App, CATEGORIES, row 3: the first column is empty.']);
  });

  test('a cell with only a space is empty: no message', async ({ page }) => {
    await signIn(page, { appSheet: withRequired([['CATEGORIES'], [], ['', ' ']]) });

    await expect(page.locator('#total-value')).toHaveText('€549.50');
    await expect(messageCard(page)).toBeHidden();
  });

  test('an empty row between two items: no message', async ({ page }) => {
    await signIn(page, {
      appSheet: withRequired([
        ['CATEGORIES'],
        [],
        ['Car', '', 'car', '#2f6fd6'],
        [],
        ['Yoshi', '', 'paw', '#b8860b'],
      ]),
    });

    await expect(page.locator('#total-value')).toHaveText('€549.50');
    await expect(messageCard(page)).toBeHidden();
  });

  test('a title that is there twice', async ({ page }) => {
    await openMessage(page, [['CATEGORIES', '', '', '', '', 'categories ']]);

    await expect(lines(page)).toHaveText(['App, CATEGORIES, column F: the table is there twice.']);
  });

  test('a title the app does not read, there twice', async ({ page }) => {
    // CATEGORIES is there too, in K1: it is required (issue #123).
    await openMessage(page, [['NOTES', '', '', '', '', 'NOTES', '', '', '', '', 'CATEGORIES']]);

    await expect(lines(page)).toHaveText(['App, NOTES, column F: the table is there twice.']);
  });

  test('a cell on the left of the first title', async ({ page }) => {
    await openMessage(page, [['', '', 'CATEGORIES'], [], ['note']]);

    await expect(lines(page)).toHaveText(['App, A3: this cell is not in any table.']);
  });

  test('two mistakes: two lines, from the top of the sheet down', async ({ page }) => {
    await openMessage(page, [['', 'CATEGORIES'], [], [], ['', '', 'car'], ['note']]);

    await expect(lines(page)).toHaveText([
      'App, CATEGORIES, row 4: the first column is empty.',
      'App, A5: this cell is not in any table.',
    ]);
  });
});

for (const [locale, language, text] of [
  ['es-ES', 'es', 'El documento no tiene ninguna hoja llamada App.'],
  ['ru-RU', 'ru', 'В документе нет листа с названием App.'],
]) {
  test.describe(`in "${language}"`, () => {
    test.use({ locale });

    test(`the message is in that language`, async ({ page }) => {
      await openMessage(page, null);

      await expect(lines(page)).toHaveText([text]);
    });
  });
}

test.describe('on the message screen', () => {
  test('logout signs out as usual', async ({ page }) => {
    await openMessage(page, null);

    await logOut(page).click();

    await expect(page.locator('#login')).toBeVisible();
    await expect(page.locator('#login-message')).toHaveText(STRINGS.en.signedOut);
  });

  test('picking another language shows the message in that language at once', async ({ page }) => {
    await openMessage(page, [['CATEGORIES'], [], ['', 'car']]);

    await languagePicker(page).locator('[aria-current="true"]').click();
    await expect.poll(() => locked(page)).toBe(false);
    await languagePicker(page).locator('[data-language="es"]').click();

    await expect(lines(page)).toHaveText([
      'App, CATEGORIES, fila 3: la primera columna está vacía.',
    ]);
  });
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the message card rises in like the cards of the main screen', async ({ page }) => {
    await setUp(page, { appSheet: null });
    await page.goto('./');
    await page.locator('#sign-in').click();

    await expect(messageCard(page)).toBeVisible();
    expect(await messageCard(page).evaluate((node) => getComputedStyle(node).animationName)).toBe(
      'card-rise',
    );
    // Taps wait while it rises, as on the main screen.
    expect(await locked(page)).toBe(true);
    await expect.poll(() => locked(page)).toBe(false);
  });
});

test.describe('after a save, a change or a delete', () => {
  test('a new movement saved with a broken App sheet: the thumbs-up, then the message', async ({
    page,
  }) => {
    const { requests } = await openGoal(page);
    await tapAndWait(page, add(page));
    await field(page, 'source').selectOption('Cash');
    await field(page, 'date').fill('2026-10-25');
    await field(page, 'category').selectOption('General');
    await field(page, 'concept').fill('Bakery');
    await field(page, 'amount').click();
    await page.keyboard.type('1250');
    requests.setAppSheet(null);

    await save(page).click();

    await expect(thumbsUp(form(page))).toBeVisible();
    await expect(lines(page)).toHaveText([NO_APP_SHEET], { timeout: 5000 });
    await expect(goalCard(page)).toBeHidden();
    expect(requests.saves.map(({ done }) => done)).toEqual([true]);
  });

  test('a change saved with a broken App sheet: the thumbs-up, then the message', async ({
    page,
  }) => {
    const { requests, movements } = await openGoal(page);
    await selectMovement(page, 1);
    await tapAndWait(page, edit(page));
    await field(page, 'concept').fill('Cinema 2');
    requests.setAppSheet(null);

    await save(page).click();

    await expect(thumbsUp(form(page))).toBeVisible();
    await expect(lines(page)).toHaveText([NO_APP_SHEET], { timeout: 5000 });
    expect(movements.some((row) => row[3] === 'Cinema 2')).toBe(true);
  });

  test('a delete with a broken App sheet: the thumbs-up, then the message', async ({ page }) => {
    const { requests, movements } = await openGoal(page);
    await selectMovement(page, 1);
    await tapAndWait(page, remove(page));
    requests.setAppSheet(null);

    await yes(page).click();

    await expect(thumbsUp(panel(page))).toBeVisible();
    await expect(lines(page)).toHaveText([NO_APP_SHEET], { timeout: 5000 });
    expect(movements.some((row) => row[3] === 'Cinema')).toBe(false);
  });

  test('after a delete with a broken App sheet, the message screen can still be tapped', async ({
    page,
  }) => {
    const { requests } = await openGoal(page);
    await selectMovement(page, 1);
    await tapAndWait(page, remove(page));
    requests.setAppSheet(null);
    await yes(page).click();
    await expect(lines(page)).toHaveText([NO_APP_SHEET], { timeout: 5000 });

    await expect.poll(() => locked(page)).toBe(false);
    await logOut(page).click();
    await expect(page.locator('#login')).toBeVisible();
  });

  test('a change stopped by a change by hand, with a broken App sheet: the warning, then the message', async ({
    page,
  }) => {
    const { requests, movements } = await openGoal(page);
    await selectMovement(page, 1);
    await tapAndWait(page, edit(page));
    await field(page, 'concept').fill('Cinema 2');
    // Somebody writes another movement in the row of Cinema, and renames the App sheet.
    movements[1] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
    requests.setAppSheet(null);

    await save(page).click();

    await expect(warning(form(page))).toBeVisible();
    await expect(lines(page)).toHaveText([NO_APP_SHEET], { timeout: 5000 });
    // The form does not come back.
    await expect(form(page)).toBeHidden();
    expect(requests.saves).toEqual([]);
  });

  test('a delete stopped by a change by hand, with a broken App sheet: the warning, then the message', async ({
    page,
  }) => {
    const { requests, movements } = await openGoal(page);
    await selectMovement(page, 1);
    await tapAndWait(page, remove(page));
    movements[1] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
    requests.setAppSheet(null);

    await yes(page).click();

    await expect(warning(panel(page))).toBeVisible();
    await expect(lines(page)).toHaveText([NO_APP_SHEET], { timeout: 5000 });
    await expect(panel(page)).toBeHidden();
    expect(requests.saves).toEqual([]);
  });
});
