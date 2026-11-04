import { test, expect } from '@playwright/test';

import { setUp, sheetDay } from './helpers.js';
import { STRINGS } from '../../src/i18n.js';

// Investing movements are left out of the goal (issue #114).

const goalCard = (page) => page.locator('#main [data-card="goal"]');
const goalValue = (page) => page.locator('#goal-value');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const form = (page) => page.locator('.movement-form');
const field = (page, name) => form(page).getByLabel(STRINGS.en[name], { exact: true });
const month = (page, index) => page.locator('.month').nth(index);
const monthAmount = (page, index) => month(page, index).locator('.month-amount');
const descriptions = (page, monthIndex) =>
  month(page, monthIndex).locator('.description-text').allTextContents();

// True while the app ignores taps, because an animation is playing.
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

// October has Investing movements (money put in, and money coming back) next to the others;
// November has only an Investing movement.
const movementRows = () => [
  ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -100],
  ['BBVA David', sheetDay('2026-10-05'), 'Investing', 'Fund', -500],
  ['BBVA David', sheetDay('2026-10-09'), 'Investing', 'Sale', 300],
  ['Cash', sheetDay('2026-10-20'), 'Car', 'Petrol', -40],
  ['BBVA David', sheetDay('2026-11-04'), 'Investing', 'Fund', -200],
];

async function openGoal(page, options = {}) {
  const movements = options.movements ?? movementRows();
  const requests = await setUp(page, { canEdit: true, ...options, movements });
  await page.goto('./');
  await page.locator('#sign-in').click();
  await expect(page.locator('#total-value')).toHaveText(/\d/);
  await expect.poll(() => locked(page)).toBe(false);
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  return { requests, movements };
}

async function tapMonth(page, index) {
  await month(page, index).locator('.month-head').click();
  await expect.poll(() => locked(page)).toBe(false);
}

test('the goal card shows no Investing movement, and its amounts add only the others', async ({
  page,
}) => {
  await openGoal(page);

  // Market (100) and Petrol (40); the Fund and the Sale are left out.
  await expect(goalValue(page)).toHaveText('€140.00');
  await expect(monthAmount(page, 0)).toHaveText('€140.00');
  await tapMonth(page, 0);
  await expect.poll(() => descriptions(page, 0)).toEqual(['Petrol', 'Market']);
});

test('a month with only Investing movements shows "--" and cannot be opened', async ({ page }) => {
  await openGoal(page);

  await expect(monthAmount(page, 1)).toHaveText('--');
  await expect(month(page, 1).locator('.month-head')).toBeDisabled();
});

test('a new Investing movement from the "+" form is saved, and the goal card does not show it', async ({
  page,
}) => {
  const { movements } = await openGoal(page, {
    // The sheet's Category list has Investing.
    dropdowns: {
      'Sheet2!A2': {
        type: 'ONE_OF_LIST',
        values: ['Cash', 'BBVA David'].map((value) => ({ userEnteredValue: value })),
      },
      'Sheet2!C2': {
        type: 'ONE_OF_LIST',
        values: ['General', 'Investing'].map((value) => ({ userEnteredValue: value })),
      },
    },
  });
  await add(page).click();
  await expect(form(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);

  await field(page, 'source').selectOption('BBVA David');
  await field(page, 'date').fill('2026-10-15');
  await field(page, 'category').selectOption('Investing');
  await field(page, 'concept').fill('Shares');
  await field(page, 'amount').focus();
  await page.keyboard.type('25000');
  await form(page).locator('[data-card="save"]').click();
  await expect(form(page)).toBeHidden();
  await expect.poll(() => locked(page)).toBe(false);

  expect(movements).toContainEqual([
    'BBVA David',
    sheetDay('2026-10-15'),
    'Investing',
    'Shares',
    -250,
  ]);
  await expect(goalValue(page)).toHaveText('€140.00');
  await tapMonth(page, 0);
  await expect.poll(() => descriptions(page, 0)).toEqual(['Petrol', 'Market']);
});
