import { test, expect } from '@playwright/test';

import {
  CATEGORIES_TABLE,
  FAKE_APP_SHEET,
  SOURCES_TABLE,
  setUp,
  sheetDay,
  sideBySide,
} from './helpers.js';
import { ICONS } from '../../src/icons.js';

// The icon and the color of each movement come from the CATEGORIES table of the App sheet
// (issue #123). The tests' App sheet has the rows the issue asks to copy.

const goalCard = (page) => page.locator('#main [data-card="goal"]');
const back = (page) => page.locator('#back');
const month = (page, index) => page.locator('.month').nth(index);
const lines = (page) => page.locator('#main [data-card="mistakes"] .mistake-line');
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

const october = [
  ['Cash', sheetDay('2026-10-02'), 'Car', 'Petrol', -40],
  ['Cash', sheetDay('2026-10-03'), 'General', 'Compra Mercadona', -30],
  ['Cash', sheetDay('2026-10-04'), 'General', 'Peluquería', -15],
  ['Cash', sheetDay('2026-10-05'), 'Foo', 'Something', -5],
  ['Cash', sheetDay('2026-10-06'), 'Leisure', 'Cinema', -10],
];

// The rows of the CATEGORIES table of the tests: the row of each category is its place in
// CATEGORIES_TABLE.
const CAR = 2;
const GENERAL_COMPRA = 5;
const GENERAL = 6;
// A copy of the tests' App sheet with some cells of the CATEGORIES table changed:
// { [index of the row]: cells }. The other tables of the sheet do not change.
const sheetWith = (changes) =>
  sideBySide(
    CATEGORIES_TABLE.map((row, index) => (index in changes ? changes[index] : [...row])),
    SOURCES_TABLE,
  );

async function signIn(page, appSheet) {
  const requests = await setUp(page, { movements: october, ...(appSheet && { appSheet }) });
  await page.goto('./');
  await page.locator('#sign-in').click();
  await expect(page.locator('#login')).toBeHidden();
  await expect.poll(() => locked(page)).toBe(false);
  return requests;
}

// Opens the goal card and October, with the movements of the App sheet given.
async function openOctober(page, appSheet) {
  const requests = await signIn(page, appSheet);
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  await month(page, 0).locator('.month-head').click();
  await page.waitForTimeout(50);
  await expect.poll(() => locked(page)).toBe(false);
  return requests;
}

const rgb = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

// The icon of a movement (its first drawing) and its color.
async function lookOf(page, description) {
  const drawing = month(page, 0)
    .locator('.movement', { hasText: description })
    .locator('svg')
    .first();
  return {
    path: await drawing.locator('path').getAttribute('d'),
    fill: await drawing.evaluate((node) => getComputedStyle(node).fill),
  };
}

const looksLike = (icon, color) => ({ path: ICONS[icon].path, fill: rgb(color) });

test.describe('the icons and colors of the movements', () => {
  test('with the copied rows, every movement looks as it did before', async ({ page }) => {
    await openOctober(page);

    expect(await lookOf(page, 'Petrol')).toEqual(looksLike('car', '#2f6fd6'));
    expect(await lookOf(page, 'Compra Mercadona')).toEqual(looksLike('cart', '#2b8a3e'));
    expect(await lookOf(page, 'Peluquería')).toEqual(looksLike('sackEuro', '#4b5563'));
    expect(await lookOf(page, 'Cinema')).toEqual(looksLike('cocktail', '#b8338f'));
  });

  test('Car in black: a black car on a very light grey background', async ({ page }) => {
    await openOctober(page, sheetWith({ [CAR]: ['Car', '', 'car', '#000000'] }));

    expect(await lookOf(page, 'Petrol')).toEqual(looksLike('car', '#000000'));
    // The soft shape behind it: 8% of the color, the rest white.
    const css = await month(page, 0)
      .locator('.movement', { hasText: 'Petrol' })
      .evaluate((node) => getComputedStyle(node, '::before').backgroundColor);
    const parts = css
      .match(/[\d.]+/g)
      .map(Number)
      .slice(0, 3);
    const channels = css.startsWith('color(') ? parts.map((part) => part * 255) : parts;
    for (const channel of channels) expect(Math.abs(channel - 255 * 0.92)).toBeLessThan(1.5);
  });

  test('Car with the paw: Car movements show the paw', async ({ page }) => {
    await openOctober(page, sheetWith({ [CAR]: ['Car', '', 'paw', '#2f6fd6'] }));

    expect(await lookOf(page, 'Petrol')).toEqual(looksLike('paw', '#2f6fd6'));
  });

  test('without the row "General | compra", a purchase shows the grey money bag', async ({
    page,
  }) => {
    await openOctober(page, sheetWith({ [GENERAL_COMPRA]: [] }));

    expect(await lookOf(page, 'Compra Mercadona')).toEqual(looksLike('sackEuro', '#4b5563'));
  });

  test('a category that is not in the table shows the grey money bag', async ({ page }) => {
    await openOctober(page);

    expect(await lookOf(page, 'Something')).toEqual(looksLike('sackEuro', '#4b5563'));
  });

  test('a General row with a car, then no General row: the car, then the grey money bag', async ({
    page,
  }) => {
    const requests = await openOctober(
      page,
      sheetWith({ [GENERAL]: ['General', '', 'car', '#2f6fd6'] }),
    );
    expect(await lookOf(page, 'Peluquería')).toEqual(looksLike('car', '#2f6fd6'));

    requests.setAppSheet(sheetWith({ [GENERAL]: [] }));
    await page.reload();
    await expect.poll(() => locked(page)).toBe(false);
    await goalCard(page).click();
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
    await month(page, 0).locator('.month-head').click();
    await expect.poll(() => locked(page)).toBe(false);

    expect(await lookOf(page, 'Peluquería')).toEqual(looksLike('sackEuro', '#4b5563'));
    expect(await lookOf(page, 'Compra Mercadona')).toEqual(looksLike('cart', '#2b8a3e'));
  });

  test('spaces around an icon name do not matter', async ({ page }) => {
    await openOctober(page, sheetWith({ [CAR]: ['Car', '', 'car ', '#2f6fd6'] }));

    expect(await lookOf(page, 'Petrol')).toEqual(looksLike('car', '#2f6fd6'));
  });

  test('a color with capital letters is accepted', async ({ page }) => {
    await openOctober(page, sheetWith({ [CAR]: ['Car', '', 'car', '#2F6FD6'] }));

    expect(await lookOf(page, 'Petrol')).toEqual(looksLike('car', '#2f6fd6'));
  });
});

test.describe('the mistakes of the CATEGORIES table', () => {
  test('an icon that does not exist; fixed, the main screen is back', async ({ page }) => {
    const requests = await signIn(page, sheetWith({ [CAR]: ['Car', '', 'carr', '#2f6fd6'] }));
    await expect(lines(page)).toHaveText([
      'App, CATEGORIES, row 3: there is no icon called "carr".',
    ]);

    requests.setAppSheet(FAKE_APP_SHEET);
    await page.reload();

    await expect(page.locator('#total-value')).toHaveText(/\d/);
    await expect(goalCard(page)).toBeVisible();
  });

  test('an icon with other capital letters does not exist', async ({ page }) => {
    await signIn(page, sheetWith({ [CAR]: ['Car', '', 'Car', '#2f6fd6'] }));

    await expect(lines(page)).toHaveText([
      'App, CATEGORIES, row 3: there is no icon called "Car".',
    ]);
  });

  test('a color that is not valid', async ({ page }) => {
    await signIn(page, sheetWith({ [CAR]: ['Car', '', 'car', '#12'] }));

    await expect(lines(page)).toHaveText([
      'App, CATEGORIES, row 3: "#12" is not a color like #2f6fd6.',
    ]);
  });

  test('a missing color', async ({ page }) => {
    await signIn(page, sheetWith({ [CAR]: ['Car', '', 'car'] }));

    await expect(lines(page)).toHaveText(['App, CATEGORIES, row 3: the color is missing.']);
  });

  test('a category there twice', async ({ page }) => {
    await signIn(page, [...FAKE_APP_SHEET, ['Car', '', 'paw', '#000000']]);

    await expect(lines(page)).toHaveText([
      'App, CATEGORIES, row 16: the category Car is there twice.',
    ]);
  });

  test('no CATEGORIES title: the table is missing', async ({ page }) => {
    await signIn(page, sheetWith({ 0: [] }));

    // Its rows are no longer under a title, so other lines may appear too.
    await expect(lines(page).last()).toHaveText('App, CATEGORIES: the table is missing.');
  });
});
