import { test, expect } from '@playwright/test';

import { setUp, sheetDay } from './helpers.js';
import { CARDS } from '../../src/components.js';
import { ICONS } from '../../src/icons.js';
import { STRINGS } from '../../src/i18n.js';

// The eye button of the goal card: it shows the movements the goal leaves out (issue #113).

const signInButton = (page) => page.locator('#sign-in');
const goalCard = (page) => page.locator('#main [data-card="goal"]');
const goalValue = (page) => page.locator('#goal-value');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const edit = (page) => page.locator('#edit');
const remove = (page) => page.locator('#delete');
const eye = (page) => page.locator('#eye');
const form = (page) => page.locator('.movement-form');
const field = (page, name) => form(page).getByLabel(STRINGS.en[name], { exact: true });
const save = (page) => form(page).locator('[data-card="save"]');
const panel = (page) => page.locator('.delete-panel');
const yes = (page) => panel(page).locator('[data-card="yes"]');
const month = (page, index) => page.locator('.month').nth(index);
const monthHead = (page, index) => month(page, index).locator('.month-head');
const monthAmount = (page, index) => month(page, index).locator('.month-amount');
const monthAll = (page, index) => month(page, index).locator('.month-all');
const movement = (page, monthIndex, index) =>
  month(page, monthIndex).locator('.movement').nth(index);
const descriptions = (page, monthIndex) =>
  month(page, monthIndex).locator('.movement .description-text').allTextContents();
const selected = (page) => page.locator('.movement.selected');

// True while the app ignores taps, because an animation is playing.
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);
const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1);

// The movements sheet, from its first movement row, in the sheet's order. The salaries, the
// Investing fund and the mortgage are left out of the goal. October shows Cinema and Market
// (€600 of spending; with the fund €900, and a €2,500 salary). November shows Petrol only.
// December has only the mortgage. The September salary is outside the goal's months.
const movementRows = () => [
  ['BBVA David', sheetDay('2026-09-30'), 'Salary', 'September pay', 2500],
  ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -100],
  ['BBVA David', sheetDay('2026-10-05'), 'Salary', 'October pay', 2500],
  ['BBVA David', sheetDay('2026-10-12'), 'Investing', 'Fund', -300],
  ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -500],
  ['Cash', sheetDay('2026-11-04'), 'Car', 'Petrol', -40],
  ['BBVA David', sheetDay('2026-12-01'), 'Mortgage', 'December loan', -700],
];
const EMPTY = ['', '', '', '', ''];

// The form's lists have the categories of the left-out movements too.
const listOf = (values) => ({
  type: 'ONE_OF_LIST',
  values: values.map((value) => ({ userEnteredValue: value })),
});
const dropdowns = {
  'Sheet2!A2': listOf(['BBVA David', 'Cash']),
  'Sheet2!C2': listOf(['Car', 'General', 'Investing', 'Leisure', 'Mortgage', 'Salary']),
};

async function openMain(page, options = {}) {
  const movements = options.movements ?? movementRows();
  const requests = await setUp(page, { canEdit: true, dropdowns, ...options, movements });
  await page.goto('./');
  await signInButton(page).click();
  await expect(page.locator('#total-value')).toHaveText(/\d/);
  await expect.poll(() => locked(page)).toBe(false);
  return { requests, movements };
}

async function openGoalCard(page) {
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
}

async function openGoal(page, options = {}) {
  const parts = await openMain(page, options);
  await openGoalCard(page);
  return parts;
}

// Taps, and waits until the animations it starts are over.
async function tapAndWait(page, locator) {
  await locator.click();
  await page.waitForTimeout(50);
  await expect.poll(() => locked(page)).toBe(false);
}

const tapMonth = (page, index) => tapAndWait(page, monthHead(page, index));

// Keeps the mouse button on a movement for longer than half a second: it is selected.
async function hold(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(() => locked(page)).toBe(false);
}

// The drawing the eye button shows now: its path.
const eyeDrawing = (page) =>
  eye(page)
    .locator('svg')
    .evaluateAll((icons) =>
      icons
        .filter((icon) => icon.getClientRects().length)
        .map((icon) => icon.querySelector('path').getAttribute('d')),
    );

// Turns the eye button on (or off), and waits until the movements have stopped moving.
const tapEye = (page) => tapAndWait(page, eye(page));

test.describe('the eye button', () => {
  test('in the bottom-right corner, at the height of the back button, with a crossed-out eye', async ({
    page,
  }) => {
    await openGoal(page);

    await expect(eye(page)).toBeVisible();
    await expect(eye(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(eye(page)).toHaveAttribute('aria-label', STRINGS.en.showLeftOut);
    expect(await eyeDrawing(page)).toEqual([ICONS.eyeSlash.path]);
    const button = await eye(page).boundingBox();
    const arrow = await back(page).boundingBox();
    near(button.width, arrow.width);
    near(button.height, arrow.height);
    near(button.y + button.height, arrow.y + arrow.height);
    // As far from the right edge as the back button is from the left edge.
    near(page.viewportSize().width - (button.x + button.width), arrow.x);
    expect(await eye(page).evaluate((node) => node.style.getPropertyValue('--label-border'))).toBe(
      `linear-gradient(to bottom right, ${CARDS.back.colors.join(', ')})`,
    );
    // The goal card looks as before: no left-out movement, no second amount.
    await expect(goalValue(page)).toHaveText('€640.00');
    for (const index of [0, 1, 2]) await expect(monthAll(page, index)).toBeHidden();
    await tapMonth(page, 0);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Cinema', 'Market']);
  });

  test('a person who can only view the sheet does not see it', async ({ page }) => {
    await openGoal(page, { canEdit: false });

    await expect(back(page)).toBeVisible();
    await expect(eye(page)).toBeHidden();
  });

  test.describe('on a screen 360 pixels wide', () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test('with one movement selected, the eye, Edit, "+" and Delete fit next to the back button', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);

      await hold(page, movement(page, 0, 0));

      const buttons = [back(page), edit(page), add(page), remove(page), eye(page)];
      for (const button of buttons) await expect(button).toBeVisible();
      const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
      expect(boxes[0].x).toBeGreaterThanOrEqual(0);
      for (let index = 1; index < boxes.length; index += 1) {
        const before = boxes[index - 1];
        expect(boxes[index].x).toBeGreaterThan(before.x + before.width);
      }
      expect(boxes.at(-1).x + boxes.at(-1).width).toBeLessThanOrEqual(360);
    });
  });
});

test.describe('showing the left-out movements', () => {
  test('a tap shows them in their days, like the others, and the goal number stays', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);

    await tapEye(page);

    await expect(eye(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await eyeDrawing(page)).toEqual([ICONS.eye.path]);
    await expect
      .poll(() => descriptions(page, 0))
      .toEqual(['Fund', 'Cinema', 'October pay', 'Market']);
    // The day of the salary shows its date too.
    await expect(month(page, 0).locator('.movement-date')).toHaveCount(3);
    // They look like the others.
    const fund = movement(page, 0, 0);
    const cinema = movement(page, 0, 1);
    expect(await fund.getAttribute('class')).toBe(await cinema.getAttribute('class'));
    expect(await fund.evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
    // The September salary is outside the goal's months.
    await expect(page.locator('.description-text', { hasText: 'September pay' })).toHaveCount(0);
    await expect(goalValue(page)).toHaveText('€640.00');
  });

  test('each month with an amount shows the spending of all its movements next to it', async ({
    page,
  }) => {
    await openGoal(page);

    await tapEye(page);

    // October: €900 of spending and a €2,500 salary.
    await expect(monthAmount(page, 0)).toHaveText('€600.00');
    await expect(monthAll(page, 0)).toBeVisible();
    await expect(monthAll(page, 0)).toHaveText('(-€1,600.00)');
    // November: the same amount, and it still shows.
    await expect(monthAmount(page, 1)).toHaveText('€40.00');
    await expect(monthAll(page, 1)).toHaveText('(€40.00)');
    // At the right of the month's amount.
    const amount = await monthAmount(page, 1).boundingBox();
    const all = await monthAll(page, 1).boundingBox();
    expect(all.x).toBeGreaterThan(amount.x);
    near(all.y + all.height / 2, amount.y + amount.height / 2);
  });

  test('a month with only left-out movements still shows "--", cannot be opened, and has no second amount', async ({
    page,
  }) => {
    await openGoal(page);

    await tapEye(page);

    await expect(monthAmount(page, 2)).toHaveText('--');
    await expect(monthHead(page, 2)).toBeDisabled();
    await expect(monthAll(page, 2)).toBeHidden();
  });

  test('another tap hides them and the second amounts again, and the eye is crossed out', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await tapEye(page);

    await tapEye(page);

    await expect(eye(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await eyeDrawing(page)).toEqual([ICONS.eyeSlash.path]);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Cinema', 'Market']);
    await expect(month(page, 0).locator('.movement-date')).toHaveCount(2);
    for (const index of [0, 1, 2]) await expect(monthAll(page, index)).toBeHidden();
  });

  test('after closing and opening the goal card again, the button is off', async ({ page }) => {
    await openGoal(page);
    await tapEye(page);

    await tapAndWait(page, back(page));
    await openGoalCard(page);

    await expect(eye(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(monthAll(page, 0)).toBeHidden();
    await tapMonth(page, 0);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Cinema', 'Market']);
  });
});

test.describe('the left-out movements while they show', () => {
  test('one can be selected and changed with Edit, and it still shows', async ({ page }) => {
    const { movements } = await openGoal(page);
    await tapMonth(page, 0);
    await tapEye(page);

    await hold(page, movement(page, 0, 0));
    await expect(edit(page)).toBeVisible();
    await expect(remove(page)).toBeVisible();
    await tapAndWait(page, edit(page));
    await expect(form(page)).toBeVisible();
    await expect(field(page, 'category')).toHaveValue('Investing');
    await field(page, 'concept').fill('Fund 2');
    await tapAndWait(page, save(page));
    await expect(form(page)).toBeHidden();

    expect(movements[3]).toEqual([
      'BBVA David',
      sheetDay('2026-10-12'),
      'Investing',
      'Fund 2',
      -300,
    ]);
    await expect(eye(page)).toHaveAttribute('aria-pressed', 'true');
    if (!(await month(page, 0).evaluate((node) => node.classList.contains('open')))) {
      await tapMonth(page, 0);
    }
    await expect.poll(() => descriptions(page, 0)).toContain('Fund 2');
    await expect(goalValue(page)).toHaveText('€640.00');
  });

  test('one can be deleted with Delete, like any movement', async ({ page }) => {
    const { movements } = await openGoal(page);
    await tapMonth(page, 0);
    await tapEye(page);

    await hold(page, movement(page, 0, 0));
    await tapAndWait(page, remove(page));
    await expect(panel(page)).toBeVisible();
    await tapAndWait(page, yes(page));
    await expect(panel(page)).toBeHidden();

    await expect.poll(() => movements[3][3]).toBe('Cinema');
    expect(movements.slice(3)).toEqual([
      ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -500],
      ['Cash', sheetDay('2026-11-04'), 'Car', 'Petrol', -40],
      ['BBVA David', sheetDay('2026-12-01'), 'Mortgage', 'December loan', -700],
      EMPTY,
    ]);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Cinema', 'October pay', 'Market']);
    await expect(goalValue(page)).toHaveText('€640.00');
  });

  test('changed to a category the goal counts, it is added to the goal and still shows', async ({
    page,
  }) => {
    const { movements } = await openGoal(page);
    await tapMonth(page, 0);
    await tapEye(page);

    await hold(page, movement(page, 0, 0));
    await tapAndWait(page, edit(page));
    await field(page, 'category').selectOption('General');
    await tapAndWait(page, save(page));
    await expect(form(page)).toBeHidden();

    expect(movements[3]).toEqual(['BBVA David', sheetDay('2026-10-12'), 'General', 'Fund', -300]);
    await expect(goalValue(page)).toHaveText('€940.00');
    await expect(monthAmount(page, 0)).toHaveText('€900.00');
    if (!(await month(page, 0).evaluate((node) => node.classList.contains('open')))) {
      await tapMonth(page, 0);
    }
    await expect.poll(() => descriptions(page, 0)).toContain('Fund');
  });

  test('a selected one hides with the button and is no longer selected; the buttons follow', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await tapEye(page);
    // Cinema, then the fund: two selected, so there is no Edit.
    await hold(page, movement(page, 0, 1));
    await tapAndWait(page, movement(page, 0, 0));
    await expect(selected(page)).toHaveCount(2);
    await expect(edit(page)).toBeHidden();

    await tapEye(page);

    await expect.poll(() => descriptions(page, 0)).toEqual(['Cinema', 'Market']);
    await expect(selected(page)).toHaveCount(1);
    await expect(movement(page, 0, 0)).toHaveClass(/\bselected\b/);
    await expect(edit(page)).toBeVisible();
    await expect(remove(page)).toBeVisible();

    // Shown again, the fund is not selected.
    await tapEye(page);
    await expect(movement(page, 0, 0)).not.toHaveClass(/\bselected\b/);
    await expect(selected(page)).toHaveCount(1);
  });
});
