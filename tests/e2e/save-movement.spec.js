import { test, expect } from '@playwright/test';

import { setUp, sheetDay } from './helpers.js';
import { CARDS } from '../../src/components.js';
import { STRINGS } from '../../src/i18n.js';

// Saving a new movement (issue #100).

const goalCard = (page) => page.locator('#main [data-card="goal"]');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const form = (page) => page.locator('.movement-form');
const field = (page, name, words = STRINGS.en) =>
  form(page).getByLabel(words[name], { exact: true });
// The short message under one field.
const fieldMessage = (page, name) =>
  field(page, name).locator('xpath=ancestor::*[@class="form-field"][1]').locator('.field-message');
const save = (page) => form(page).locator('[data-card="save"]');
const cancel = (page) => form(page).locator('[data-card="cancel"]');
const sign = (page) => form(page).locator('.sign-switch');

// True while the app ignores taps, because an animation is playing.
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

async function openForm(page, options = {}) {
  const requests = await setUp(page, { canEdit: true, ...options });
  await page.goto('./');
  await page.locator('#sign-in').click();
  await expect(page.locator('#total-value')).toHaveText(/\d/);
  await expect.poll(() => locked(page)).toBe(false);
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  await add(page).click();
  await expect(form(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  return requests;
}

// Fills in a movement that counts for the goal: Cash, 15 October 2026, General, Bakery.
async function fillMovement(page, { amount = '1250' } = {}) {
  await field(page, 'source').selectOption('Cash');
  await field(page, 'date').fill('2026-10-15');
  await field(page, 'category').selectOption('General');
  await field(page, 'concept').fill('Bakery');
  await field(page, 'amount').focus();
  await page.keyboard.type(amount);
}

// The rows a save wrote, as values: source, date, category, concept, amount.
const writtenRows = (body) =>
  body.requests
    .find(({ updateCells }) => updateCells)
    .updateCells.rows.map(({ values }) =>
      values.map(({ userEnteredValue = {} }) => Object.values(userEnteredValue)[0] ?? ''),
    );

test('Save is a button with a teal border, next to Cancel', async ({ page }) => {
  await openForm(page);

  await expect(save(page)).toHaveText('Save');
  expect(CARDS.save.colors).toEqual(['#0d9488', '#5eead4']);
  expect(CARDS.save.border).toBe(CARDS.cancel.border);
  const left = await cancel(page).boundingBox();
  const right = await save(page).boundingBox();
  expect(Math.abs(left.y - right.y)).toBeLessThan(1);
  expect(right.x).toBeGreaterThan(left.x + left.width);
});

test('a movement that counts for the goal is saved, the form closes, and the goal shows it', async ({
  page,
}) => {
  const requests = await openForm(page);
  await fillMovement(page);

  await save(page).click();

  await expect(form(page)).toBeHidden();
  await expect(page.locator('.month')).toHaveCount(3);
  await expect(back(page)).toBeVisible();
  await expect(page.locator('#goal-value')).toHaveText('€12.50');
  await expect(page.locator('.month').first()).toContainText('€12.50');
  expect(requests.saves).toHaveLength(1);
  expect(writtenRows(requests.saves[0].body)).toEqual([
    ['Cash', sheetDay('2026-10-15'), 'General', 'Bakery', -12.5],
  ]);
});

test('a movement outside the goal is saved, and the goal does not change', async ({ page }) => {
  const requests = await openForm(page);
  await fillMovement(page);
  await field(page, 'date').fill('2027-03-01');

  await save(page).click();

  await expect(form(page)).toBeHidden();
  await expect(page.locator('#goal-value')).toHaveText('€0.00');
  expect(requests.saves).toHaveLength(1);
});

test('the amount is saved as a number, below 0 with "−" and above 0 with "+"', async ({ page }) => {
  const requests = await openForm(page);
  await fillMovement(page, { amount: '123456' });
  await sign(page).click();

  await save(page).click();

  await expect(form(page)).toBeHidden();
  expect(writtenRows(requests.saves[0].body)[0][4]).toBe(1234.56);
});

test('a save writes only values, only in the first five columns, in one single request', async ({
  page,
}) => {
  const requests = await openForm(page, {
    movements: [['Cash', sheetDay('2026-10-14'), 'General', 'Milk', -2]],
  });
  await fillMovement(page);

  await save(page).click();

  await expect(form(page)).toBeHidden();
  expect(requests.methods.filter((method) => method !== 'GET')).toEqual(['POST']);
  const { requests: changes } = requests.saves[0].body;
  expect(changes).toHaveLength(1);
  expect(changes[0].updateCells.fields).toBe('userEnteredValue');
  expect(changes[0].updateCells.range).toMatchObject({
    // The row right below the last movement (row 3 of the sheet, counted from 0: 2).
    startRowIndex: 2,
    endRowIndex: 3,
    startColumnIndex: 0,
    endColumnIndex: 5,
  });
});

test('when no empty row is left, the same request first adds a row at the end', async ({
  page,
}) => {
  // The headers and one movement, and no empty row below it.
  const requests = await openForm(page, {
    movements: [['Cash', sheetDay('2026-10-14'), 'General', 'Milk', -2]],
    rowCount: 2,
  });
  await fillMovement(page);

  await save(page).click();

  await expect(form(page)).toBeHidden();
  const { requests: changes } = requests.saves[0].body;
  expect(changes[0]).toEqual({ appendDimension: { sheetId: 7, dimension: 'ROWS', length: 1 } });
  expect(changes[1].updateCells.range.startRowIndex).toBe(2);
});

test('empty Source, Date, Category or Amount show a message under each, and nothing is saved', async ({
  page,
}) => {
  const requests = await openForm(page);
  await field(page, 'date').fill('');

  await save(page).click();

  for (const name of ['source', 'date', 'category', 'amount']) {
    await expect(fieldMessage(page, name)).toHaveText(STRINGS.en.required);
  }
  // An empty Concept is fine.
  await expect(fieldMessage(page, 'concept')).toBeHidden();
  await expect(form(page)).toBeVisible();
  expect(requests.saves).toEqual([]);
});

test('"Required" under a field goes away as soon as something is typed or picked in it', async ({
  page,
}) => {
  await openForm(page);

  await save(page).click();
  await expect(fieldMessage(page, 'amount')).toBeVisible();
  await expect(fieldMessage(page, 'source')).toBeVisible();

  await field(page, 'amount').focus();
  await page.keyboard.type('5');
  await expect(fieldMessage(page, 'amount')).toBeHidden();
  await field(page, 'source').selectOption('Cash');
  await expect(fieldMessage(page, 'source')).toBeHidden();
});

test('a second tap on Save adds nothing, and Save and Cancel wait while it saves', async ({
  page,
}) => {
  const requests = await openForm(page);
  // Google answers the save only when the test says so.
  let answer;
  const held = new Promise((done) => (answer = done));
  await page.route('**/*:batchUpdate', async (route) => {
    await held;
    await route.fallback();
  });
  await fillMovement(page);

  await save(page).click();
  await save(page).dispatchEvent('click');

  await expect(save(page)).toBeDisabled();
  await expect(cancel(page)).toBeDisabled();
  answer();
  await expect(form(page)).toBeHidden();
  expect(requests.saves).toHaveLength(1);
});

for (const [problem, saves] of [
  ['there is no internet', ['offline', 200]],
  ['Google refuses the change', [403, 200]],
]) {
  test(`when ${problem}, the form stays with everything typed, and a new Save saves it once`, async ({
    page,
  }) => {
    const requests = await openForm(page, { saves });
    await fillMovement(page);

    await save(page).click();

    await expect(form(page).locator('.save-message')).toHaveText(STRINGS.en.notSaved);
    await expect(field(page, 'source')).toHaveValue('Cash');
    await expect(field(page, 'concept')).toHaveValue('Bakery');
    await expect(field(page, 'amount')).toHaveValue('12.50');
    await expect(save(page)).toBeEnabled();
    expect(requests.saves.filter(({ done }) => done)).toEqual([]);

    await save(page).click();

    await expect(form(page)).toBeHidden();
    expect(requests.saves.filter(({ done }) => done)).toHaveLength(1);
  });
}

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('after a save, the form closes with the same movement as Cancel', async ({ page }) => {
    await openForm(page);
    await fillMovement(page);

    await save(page).click();

    // The form sinks away like with Cancel, then the months and the buttons rise in.
    await expect
      .poll(() => form(page).evaluate((node) => getComputedStyle(node).animationName))
      .toBe('card-sink');
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
    await expect(form(page)).toBeHidden();
  });
});

test('with "reduce motion" on, the form closes at once after a save', async ({ page }) => {
  await openForm(page);
  await fillMovement(page);

  await save(page).click();

  await expect(form(page)).toBeHidden();
  expect(await form(page).evaluate((node) => node.getAnimations().length)).toBe(0);
  await expect(page.locator('.month')).toHaveCount(3);
});

for (const language of ['es', 'ru']) {
  test(`in "${language}", the Save button and the messages are in that language`, async ({
    page,
  }) => {
    const words = STRINGS[language];
    await setUp(page, { canEdit: true, saves: ['offline'] });
    await page.goto('./');
    await page.locator('#sign-in').click();
    await expect(page.locator('#total-value')).toHaveText(/\d/);
    await expect.poll(() => locked(page)).toBe(false);
    const picker = page.locator('#main [data-card="language"]');
    await picker.locator('[aria-current="true"]').click();
    await expect.poll(() => locked(page)).toBe(false);
    await picker.locator(`[data-language="${language}"]`).click();
    await expect.poll(() => locked(page)).toBe(false);
    await goalCard(page).click();
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
    await add(page).click();
    await expect.poll(() => locked(page)).toBe(false);

    await expect(save(page)).toHaveText(words.save);
    await save(page).click();
    await expect(
      field(page, 'source', words)
        .locator('xpath=ancestor::*[@class="form-field"][1]')
        .locator('.field-message'),
    ).toHaveText(words.required);

    await field(page, 'source', words).selectOption('Cash');
    await field(page, 'category', words).selectOption('General');
    await field(page, 'amount', words).focus();
    await page.keyboard.type('5');
    await save(page).click();
    await expect(form(page).locator('.save-message')).toHaveText(words.notSaved);
  });
}
