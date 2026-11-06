import { test, expect } from '@playwright/test';

import { CATEGORIES_TABLE, SOURCES_TABLE, setUp, sheetDay, sideBySide } from './helpers.js';
import { ICONS } from '../../src/icons.js';
import { STRINGS } from '../../src/i18n.js';

// The icon of each source, the order of the sources inside a day and the pairs come from the
// SOURCES table of the App sheet (issue #124). The tests' App sheet has the rows the issue asks
// to copy.

const goalCard = (page) => page.locator('#main [data-card="goal"]');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const form = (page) => page.locator('.movement-form');
const field = (page, name) => form(page).getByLabel(STRINGS.en[name], { exact: true });
const save = (page) => form(page).locator('[data-card="save"]');
const month = (page, index) => page.locator('.month').nth(index);
const lines = (page) => page.locator('#main [data-card="mistakes"] .mistake-line');
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

// The rows of the SOURCES table of the tests: the row of each source is its place in
// SOURCES_TABLE (row 3 of the sheet is the place 2).
const BBVA_DAVID = 2;
const AMEX = 5;
const CASH = 10;
const PROVISIONED = 12;
// A copy of the tests' App sheet with some cells of the SOURCES table changed:
// { [index of the row]: cells }. The CATEGORIES table does not change.
const sheetWith = (changes) =>
  sideBySide(
    CATEGORIES_TABLE,
    SOURCES_TABLE.map((row, index) => (index in changes ? changes[index] : [...row])),
  );
// The tests' App sheet with every row of the SOURCES table cleared: only its title and headers.
const noSourceRows = () => sideBySide(CATEGORIES_TABLE, SOURCES_TABLE.slice(0, 2));

const movement = (source, day, description, amount) => [
  source,
  sheetDay(day),
  'General',
  description,
  amount,
];

// Signs in and waits until the first screen after the sign-in has risen.
async function signIn(page, options) {
  const requests = await setUp(page, { canEdit: true, ...options });
  await page.goto('./');
  await page.locator('#sign-in').click();
  await expect(page.locator('#login')).toBeHidden();
  await expect.poll(() => locked(page)).toBe(false);
  return requests;
}

// Opens the goal card, then the newest month (October).
async function openOctober(page) {
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  await month(page, 0).locator('.month-head').click();
  await expect.poll(() => locked(page)).toBe(false);
}

// The drawing of the source icon of a movement, or null when it has none.
async function sourceIconOf(page, description) {
  const icon = month(page, 0)
    .locator('.movement', { hasText: description })
    .locator('.movement-source path');
  return (await icon.count()) === 0 ? null : icon.getAttribute('d');
}

// Saves a new movement "Cash 5" (an expense of 5) on that day, from the goal card, and returns
// the rows the save wrote, as "source amount", from the first row of that day.
async function saveCash5(page, requests, day) {
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  await add(page).click();
  await expect(form(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  await field(page, 'source').selectOption('Cash');
  await field(page, 'date').fill(day);
  await field(page, 'category').selectOption('General');
  await field(page, 'concept').fill('New');
  await field(page, 'amount').focus();
  await page.keyboard.type('500');
  const saves = requests.saves.length;
  await save(page).click();
  await expect(form(page)).toBeHidden();
  expect(requests.saves).toHaveLength(saves + 1);
  return requests.saves
    .at(-1)
    .body.requests.find(({ updateCells }) => updateCells)
    .updateCells.rows.map(({ values }) =>
      values.map(({ userEnteredValue = {} }) => Object.values(userEnteredValue)[0] ?? ''),
    )
    .filter(([source]) => source !== '')
    .map(([source, , , , amount]) => `${source} ${-amount}`);
}

// Opens the app again after a change in the App sheet, as a person would.
async function openAgain(page) {
  await page.reload();
  await expect(page.locator('#login')).toBeHidden();
  await expect.poll(() => locked(page)).toBe(false);
}

test.describe('the icon of each source', () => {
  test('AMEX with the bank icon shows the bank; with no icon, it shows none', async ({ page }) => {
    const requests = await signIn(page, {
      appSheet: sheetWith({ [AMEX]: ['AMEX', 'bank'] }),
      movements: [movement('AMEX', '2026-10-02', 'Shoes', -40)],
    });
    await openOctober(page);
    expect(await sourceIconOf(page, 'Shoes')).toBe(ICONS.bank.path);

    requests.setAppSheet(sheetWith({ [AMEX]: ['AMEX'] }));
    await openAgain(page);
    await openOctober(page);

    expect(await sourceIconOf(page, 'Shoes')).toBeNull();
  });

  test('with no rows in the table, no movement shows a source icon', async ({ page }) => {
    await signIn(page, {
      appSheet: noSourceRows(),
      movements: [
        movement('Cash', '2026-10-02', 'Bakery', -4),
        movement('Provisioned', '2026-10-03', 'Rent', -40),
      ],
    });
    await openOctober(page);

    await expect(lines(page)).toHaveCount(0);
    expect(await sourceIconOf(page, 'Bakery')).toBeNull();
    expect(await sourceIconOf(page, 'Rent')).toBeNull();
  });
});

test.describe('the order of the sources inside a day', () => {
  test('Cash moved above BBVA David: a new Cash movement is saved above BBVA David', async ({
    page,
  }) => {
    const requests = await signIn(page, {
      appSheet: sheetWith({
        [BBVA_DAVID]: ['Cash', 'cash', 'Provisioned'],
        [CASH]: ['BBVA David', 'bank'],
      }),
      movements: [movement('BBVA David', '2026-10-15', 'Market', -20)],
    });

    expect(await saveCash5(page, requests, '2026-10-15')).toEqual(['Cash 5', 'BBVA David 20']);
  });

  test('Provisioned goes right below Cash with the pair, and keeps its place without it', async ({
    page,
  }) => {
    const requests = await signIn(page, {
      movements: [
        movement('Polina', '2026-10-15', 'A', -10),
        movement('Provisioned', '2026-10-15', 'B', -5),
        movement('Polina', '2026-10-20', 'C', -10),
        movement('Provisioned', '2026-10-20', 'D', -5),
      ],
    });

    expect(await saveCash5(page, requests, '2026-10-15')).toEqual([
      'Cash 5',
      'Provisioned 5',
      'Polina 10',
      'Polina 10',
      'Provisioned 5',
    ]);

    requests.setAppSheet(sheetWith({ [CASH]: ['Cash', 'cash'] }));
    await openAgain(page);

    expect(await saveCash5(page, requests, '2026-10-20')).toEqual([
      'Cash 5',
      'Polina 10',
      'Provisioned 5',
    ]);
  });

  test('with no rows in the table, a new movement is saved last in its day', async ({ page }) => {
    const requests = await signIn(page, {
      appSheet: noSourceRows(),
      movements: [
        movement('Polina', '2026-10-15', 'A', -10),
        movement('Provisioned', '2026-10-15', 'B', -5),
      ],
    });

    expect(await saveCash5(page, requests, '2026-10-15')).toEqual([
      'Polina 10',
      'Provisioned 5',
      'Cash 5',
    ]);
  });
});

test.describe('the mistakes of the SOURCES table', () => {
  test('an icon that is not bank, card, cash or empty', async ({ page }) => {
    await signIn(page, { appSheet: sheetWith({ [AMEX]: ['AMEX', 'wallet'] }) });

    await expect(lines(page)).toHaveText([
      'App, SOURCES, row 6: "wallet" is not a source icon. Write bank, card or cash, or leave it empty.',
    ]);
  });

  test('a paired source that is not in the table', async ({ page }) => {
    await signIn(page, { appSheet: sheetWith({ [CASH]: ['Cash', 'cash', 'Bank'] }) });

    await expect(lines(page)).toHaveText([
      'App, SOURCES, row 11: the source "Bank" in Paired with is not in the table.',
    ]);
  });

  test('Cash and Provisioned paired with each other: only that line', async ({ page }) => {
    await signIn(page, {
      appSheet: sheetWith({ [PROVISIONED]: ['Provisioned', 'bank', 'Cash'] }),
    });

    await expect(lines(page)).toHaveText([
      'App, SOURCES, row 13: Cash and Provisioned are paired with each other.',
    ]);
  });

  test('Provisioned goes below Cash and is paired with Deprovisioned', async ({ page }) => {
    await signIn(page, {
      appSheet: sheetWith({ [PROVISIONED]: ['Provisioned', 'bank', 'Deprovisioned'] }),
    });

    await expect(lines(page)).toHaveText([
      'App, SOURCES, row 13: Provisioned goes below Cash, so it cannot be paired with another source.',
    ]);
  });

  test('no SOURCES title: the table is missing', async ({ page }) => {
    await signIn(page, { appSheet: sheetWith({ 0: [] }) });

    // Its rows are no longer under a title, so other lines may appear too.
    await expect(lines(page).last()).toHaveText('App, SOURCES: the table is missing.');
  });
});
