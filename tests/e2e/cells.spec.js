import { test, expect } from '@playwright/test';

import {
  CATEGORIES_TABLE,
  CELLS_TABLE,
  FAKE_CATEGORIES,
  FAKE_DROPDOWNS,
  FAKE_SOURCES,
  FAKE_TOTAL,
  GOAL_LEAVE_OUT_TABLE,
  GOAL_TABLE,
  SOURCES_TABLE,
  setUp,
  sheetDay,
  sideBySide,
} from './helpers.js';
import { STRINGS } from '../../src/i18n.js';

// The cells of the Total's parts, the movements sheet, its first movement row and the cells of
// the form's lists come from the CELLS table of the App sheet (issue #126). The tests' CELLS
// table has the cells the tests use.

const totalCard = (page) => page.locator('#main [data-card="total"]');
const totalValue = (page) => page.locator('#total-value');
const pillValue = (page, name) => page.locator(`[data-pill="${name}"] .pill-value`);
const goalValue = (page) => page.locator('#goal-value');
const add = (page) => page.locator('#add');
const form = (page) => page.locator('.movement-form');
const field = (page, name) => form(page).getByLabel(STRINGS.en[name], { exact: true });
const lines = (page) => page.locator('#main [data-card="mistakes"] .mistake-line');
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

// The options of a list of the form, without the empty one it starts with.
const optionsOf = (page, name) =>
  field(page, name)
    .locator('option')
    .evaluateAll((nodes) => nodes.filter((node) => node.value !== '').map((node) => node.value));

// A copy of the tests' App sheet with some Cells of the CELLS table changed: { [name]: cell },
// or null to clear the whole row.
const sheetWith = (changes) =>
  sideBySide(
    CATEGORIES_TABLE,
    SOURCES_TABLE,
    GOAL_TABLE,
    GOAL_LEAVE_OUT_TABLE,
    CELLS_TABLE.map(([name, cell]) => {
      if (!(name in changes)) return [name, cell];
      return changes[name] === null ? [] : [name, changes[name]];
    }),
  );

// One movement of €100 of spending in October.
const movementRows = () => [['Cash', sheetDay('2026-10-03'), 'General', 'Market', -100]];

// Signs in with these options and waits until the first screen after the sign-in has risen.
async function signIn(page, options = {}) {
  await setUp(page, { canEdit: true, movements: movementRows(), ...options });
  await page.goto('./');
  await page.locator('#sign-in').click();
  await expect(page.locator('#login')).toBeHidden();
  await expect.poll(() => locked(page)).toBe(false);
}

async function openTotal(page) {
  await totalCard(page).click();
  await expect(page.locator('#back')).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
}

// The "+" button is on the open goal card.
async function openForm(page) {
  await page.locator('#main [data-card="goal"]').click();
  await expect(page.locator('#back')).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  await add(page).click();
  await expect(form(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
}

test.describe('the cells from the CELLS table', () => {
  test('with the copied rows, the Total, its parts, the goal and the form are the same as before', async ({
    page,
  }) => {
    await signIn(page);

    await expect(totalValue(page)).toHaveText(FAKE_TOTAL);
    await expect(goalValue(page)).toHaveText('€100.00');
    await openTotal(page);
    await expect(pillValue(page, 'bank')).toHaveText('€1,000.00');
    await expect(pillValue(page, 'cards')).toHaveText('-€200.50');
    await expect(pillValue(page, 'provisioned')).toHaveText('€300.00');
    await expect(pillValue(page, 'cash')).toHaveText('€50.00');
    await page.locator('#back').click();
    await expect.poll(() => locked(page)).toBe(false);
    await openForm(page);
    expect(await optionsOf(page, 'source')).toEqual(FAKE_SOURCES);
    expect(await optionsOf(page, 'category')).toEqual(FAKE_CATEGORIES);
  });

  test('another Total - cash cell: the cash part shows its number, and the Total changes', async ({
    page,
  }) => {
    await signIn(page, {
      appSheet: sheetWith({ 'Total - cash': 'Sheet1!B7' }),
      otherCells: { 'Sheet1!B7': 75 },
    });

    // 1000 - 200.50 - 300 (Provisioned is taken away) + 75
    await expect(totalValue(page)).toHaveText('€574.50');
    await openTotal(page);
    await expect(pillValue(page, 'cash')).toHaveText('€75.00');
  });

  test('another Category list cell: the form shows the list of its dropdown', async ({ page }) => {
    await signIn(page, {
      appSheet: sheetWith({ 'Category list': 'Lists!B1' }),
      dropdowns: {
        ...FAKE_DROPDOWNS,
        'Lists!B1': {
          type: 'ONE_OF_LIST',
          values: ['Food', 'Toys'].map((value) => ({ userEnteredValue: value })),
        },
      },
    });

    await openForm(page);

    expect(await optionsOf(page, 'category')).toEqual(['Food', 'Toys']);
  });

  test('an existing cell that is empty as Total - cash: no message, and the cash part is 0', async ({
    page,
  }) => {
    await signIn(page, { appSheet: sheetWith({ 'Total - cash': 'Sheet1!B1' }) });

    await expect(lines(page)).toHaveCount(0);
    // 1000 - 200.50 - 300 (Provisioned is taken away) + 0
    await expect(totalValue(page)).toHaveText('€499.50');
    await openTotal(page);
    await expect(pillValue(page, 'cash')).toHaveText('€0.00');
  });
});

test.describe('the mistakes in the CELLS table', () => {
  test('without the row Total - bank, a line says it is missing', async ({ page }) => {
    await signIn(page, { appSheet: sheetWith({ 'Total - bank': null }) });

    await expect(lines(page)).toHaveText(['App, CELLS: the row Total - bank is missing.']);
  });

  test('Nowhere!A1 as Total - cash: a line says the document has no such cell', async ({
    page,
  }) => {
    await signIn(page, { appSheet: sheetWith({ 'Total - cash': 'Nowhere!A1' }) });

    await expect(lines(page)).toHaveText([
      'App, CELLS, row 6: the document has no cell Nowhere!A1.',
    ]);
  });

  test('"two" as First movement row: a line says it must be a whole number', async ({ page }) => {
    await signIn(page, { appSheet: sheetWith({ 'First movement row': 'two' }) });

    await expect(lines(page)).toHaveText([
      'App, CELLS, row 8: First movement row must be a whole number of 1 or more.',
    ]);
  });

  test('an empty Cell of Total - cash: a line says it is empty', async ({ page }) => {
    await signIn(page, { appSheet: sheetWith({ 'Total - cash': '' }) });

    await expect(lines(page)).toHaveText(['App, CELLS, row 6: the cell of Total - cash is empty.']);
  });
});
