import { test, expect } from '@playwright/test';

import {
  CATEGORIES_TABLE,
  GOAL_LEAVE_OUT_TABLE,
  GOAL_TABLE,
  SOURCES_TABLE,
  setUp,
  sheetDay,
  sideBySide,
} from './helpers.js';

// The dates and the limit of the goal come from the GOAL table of the App sheet, and the
// movements it leaves out from the GOAL LEAVE OUT table (issue #125). The tests' App sheet has
// the rows the issue asks to copy.

const goalCard = (page) => page.locator('#main [data-card="goal"]');
const goalValue = (page) => page.locator('#goal-value');
const back = (page) => page.locator('#back');
const eye = (page) => page.locator('#eye');
const month = (page, index) => page.locator('.month').nth(index);
const descriptions = (page, index) =>
  month(page, index).locator('.movement .description-text').allTextContents();
const lines = (page) => page.locator('#main [data-card="mistakes"] .mistake-line');
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

// The names of the months of the goal card, from the top.
const monthNames = (page) =>
  page
    .locator('.month-head')
    .evaluateAll((heads) => heads.map((head) => head.getAttribute('aria-label').split(':')[0]));

// The rows of the GOAL table: the row of each setting is its place in GOAL_TABLE (row 3 of the
// sheet is the place 2).
const FROM = 2;
const TO = 3;
const LIMIT = 4;
// The place of the row Salary in GOAL_LEAVE_OUT_TABLE.
const SALARY = 3;
// A copy of the tests' App sheet with other GOAL and GOAL LEAVE OUT tables.
const sheetWith = ({ goal = GOAL_TABLE, leaveOut = GOAL_LEAVE_OUT_TABLE }) =>
  sideBySide(CATEGORIES_TABLE, SOURCES_TABLE, goal, leaveOut);
// GOAL with some rows changed: { [place of the row]: cells }.
const goalWith = (changes) =>
  GOAL_TABLE.map((row, index) => (index in changes ? changes[index] : [...row]));

// October has €600 of spending and a salary, left out. November has two Car movements: Petrol
// (€40, on the 4th) and Petrol station (€30, on the 20th). €670 in all.
const movementRows = () => [
  ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -100],
  ['BBVA David', sheetDay('2026-10-05'), 'Salary', 'October pay', 2500],
  ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -500],
  ['Cash', sheetDay('2026-11-04'), 'Car', 'Petrol', -40],
  ['Cash', sheetDay('2026-11-20'), 'Car', 'Petrol station', -30],
];

// Signs in with this App sheet and waits until the first screen after the sign-in has risen.
async function signIn(page, appSheet) {
  await setUp(page, { canEdit: true, movements: movementRows(), ...(appSheet && { appSheet }) });
  await page.goto('./');
  await page.locator('#sign-in').click();
  await expect(page.locator('#login')).toBeHidden();
  await expect.poll(() => locked(page)).toBe(false);
}

// Opens the goal card, and then the month at that place.
async function openMonth(page, index) {
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  await month(page, index).locator('.month-head').click();
  await expect.poll(() => locked(page)).toBe(false);
}

test.describe('the goal from the App sheet', () => {
  test('with the copied rows, the goal is the same as before, and the eye shows the salary', async ({
    page,
  }) => {
    await signIn(page);

    await expect(goalValue(page)).toHaveText('€670.00');
    await expect(goalValue(page)).toHaveAttribute('data-level', 'ok');
    await openMonth(page, 0);
    expect(await monthNames(page)).toEqual(['October', 'November', 'December']);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Cinema', 'Market']);
    await eye(page).click();
    await expect.poll(() => locked(page)).toBe(false);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Cinema', 'October pay', 'Market']);
  });

  test('a limit of 100 shows the goal amount in red', async ({ page }) => {
    await signIn(page, sheetWith({ goal: goalWith({ [LIMIT]: ['Limit', 100] }) }));

    await expect(goalValue(page)).toHaveAttribute('data-level', 'over');
  });

  test('From on 1/11/2026: October is not in the list, and its spending does not count', async ({
    page,
  }) => {
    await signIn(page, sheetWith({ goal: goalWith({ [FROM]: ['From', { date: '2026-11-01' }] }) }));

    await expect(goalValue(page)).toHaveText('€70.00');
    await openMonth(page, 0);
    expect(await monthNames(page)).toEqual(['November', 'December']);
  });

  test('From on 15/11/2026: November is still in the list, with its movements from the 15th', async ({
    page,
  }) => {
    await signIn(page, sheetWith({ goal: goalWith({ [FROM]: ['From', { date: '2026-11-15' }] }) }));

    await expect(goalValue(page)).toHaveText('€30.00');
    await openMonth(page, 0);
    expect(await monthNames(page)).toEqual(['November', 'December']);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Petrol station']);
  });

  test('without the row Salary, the salary counts and shows without the eye button', async ({
    page,
  }) => {
    const leaveOut = GOAL_LEAVE_OUT_TABLE.map((row, index) => (index === SALARY ? [] : [...row]));
    await signIn(page, sheetWith({ leaveOut }));

    await expect(goalValue(page)).toHaveText('-€1,830.00');
    await openMonth(page, 0);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Cinema', 'October pay', 'Market']);
  });

  test('the row Car | Petrol leaves out "Petrol", but not "Petrol station"', async ({ page }) => {
    await signIn(page, sheetWith({ leaveOut: [...GOAL_LEAVE_OUT_TABLE, ['Car', 'Petrol']] }));

    await expect(goalValue(page)).toHaveText('€630.00');
    await openMonth(page, 1);
    await expect.poll(() => descriptions(page, 1)).toEqual(['Petrol station']);
  });
});

test.describe('the mistakes in the goal tables', () => {
  for (const [what, value] of [
    ['the text "soon"', 'soon'],
    ['the plain number 46000', 46000],
  ]) {
    test(`To is ${what}: a line says it is not a date`, async ({ page }) => {
      await signIn(page, sheetWith({ goal: goalWith({ [TO]: ['To', value] }) }));

      await expect(lines(page)).toHaveText(['App, GOAL, row 4: To is not a date.']);
    });
  }

  for (const [what, value] of [
    ['0', 0],
    ['the text "4000"', '4000'],
  ]) {
    test(`Limit is ${what}: a line says it must be a number above 0`, async ({ page }) => {
      await signIn(page, sheetWith({ goal: goalWith({ [LIMIT]: ['Limit', value] }) }));

      await expect(lines(page)).toHaveText([
        'App, GOAL, row 5: the limit must be a number above 0.',
      ]);
    });
  }

  test('a second Limit row: a line says Limit is there twice', async ({ page }) => {
    await signIn(page, sheetWith({ goal: [...GOAL_TABLE, ['Limit', 100]] }));

    await expect(lines(page)).toHaveText(['App, GOAL, row 6: Limit is there twice.']);
  });

  test('without the title GOAL LEAVE OUT, the message says the table is missing', async ({
    page,
  }) => {
    const leaveOut = GOAL_LEAVE_OUT_TABLE.map((row, index) => (index === 0 ? [''] : [...row]));
    await signIn(page, sheetWith({ leaveOut }));

    await expect(lines(page).last()).toHaveText('App, GOAL LEAVE OUT: the table is missing.');
  });
});
