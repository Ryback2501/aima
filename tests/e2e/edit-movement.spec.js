import { test, expect } from '@playwright/test';

import { setUp, sheetDay } from './helpers.js';
import { CARDS } from '../../src/components.js';
import { ICONS } from '../../src/icons.js';
import { STRINGS } from '../../src/i18n.js';

// Changing a movement from the open goal card (issue #102).

const signInButton = (page) => page.locator('#sign-in');
const goalCard = (page) => page.locator('#main [data-card="goal"]');
const goalValue = (page) => page.locator('#goal-value');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const edit = (page) => page.locator('#edit');
const remove = (page) => page.locator('#delete');
const form = (page) => page.locator('.movement-form');
const title = (page) => form(page).locator('.movement-form-title');
const field = (page, name, words = STRINGS.en) =>
  form(page).getByLabel(words[name], { exact: true });
const save = (page) => form(page).locator('[data-card="save"]');
const cancel = (page) => form(page).locator('[data-card="cancel"]');
const sign = (page) => form(page).locator('.sign-switch');
const note = (page) => form(page).locator('.amount-note');
const saveMessage = (page) => form(page).locator('.save-message');
const panel = (page) => page.locator('.delete-panel');
const no = (page) => panel(page).locator('[data-card="no"]');
const month = (page, index) => page.locator('.month').nth(index);
const monthAmount = (page, index) => month(page, index).locator('.month-amount');
const movement = (page, monthIndex, index) =>
  month(page, monthIndex).locator('.movement').nth(index);
const descriptions = (page, monthIndex) =>
  month(page, monthIndex).locator('.description-text').allTextContents();
const selected = (page) => page.locator('.movement.selected');

// True while the app ignores taps, because an animation is playing.
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);
const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1);

// The movements sheet, from its first movement row. October shows four of them (newest
// first: Petrol, Cinema, and the two Markets of the 3rd), December one (Bakery). The salary
// does not count for the goal, so the goal card does not show it.
const movementRows = () => [
  ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -100],
  ['Provisioned', sheetDay('2026-10-03'), 'General', 'Market', -100],
  ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -10],
  ['BBVA David', sheetDay('2026-10-15'), 'Salary', 'October', 2500],
  ['Cash', sheetDay('2026-10-20'), 'Car', 'Petrol', -40],
  ['Cash', sheetDay('2026-12-02'), 'General', 'Bakery', -6],
];

async function openMain(page, options = {}) {
  const movements = options.movements ?? movementRows();
  const requests = await setUp(page, { canEdit: true, ...options, movements });
  await page.goto('./');
  await signInButton(page).click();
  await expect(page.locator('#total-value')).toHaveText(/\d/);
  await expect.poll(() => locked(page)).toBe(false);
  return { requests, movements };
}

async function openGoal(page, options = {}) {
  const parts = await openMain(page, options);
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  return parts;
}

async function tapMonth(page, index) {
  await month(page, index).locator('.month-head').click();
  await expect.poll(() => locked(page)).toBe(false);
}

// Taps, and waits until the animations it starts are over.
async function tapAndWait(page, locator) {
  await locator.click();
  await page.waitForTimeout(50);
  await expect.poll(() => locked(page)).toBe(false);
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

// Selects movements of the open month: the first one by holding it, the others by a tap.
async function select(page, monthIndex, indexes) {
  const [first, ...others] = indexes;
  await hold(page, movement(page, monthIndex, first));
  for (const index of others) await tapAndWait(page, movement(page, monthIndex, index));
}

// Opens October, selects one of its movements and taps Edit.
async function openEdit(page, index, options = {}) {
  const parts = await openGoal(page, options);
  await tapMonth(page, 0);
  await select(page, 0, [index]);
  await tapAndWait(page, edit(page));
  await expect(form(page)).toBeVisible();
  return parts;
}

// Checks that only "+" shows at the bottom, in the middle, next to the back button.
async function onlyPlusInTheMiddle(page) {
  await expect(edit(page)).toBeHidden();
  await expect(remove(page)).toBeHidden();
  await expect(add(page)).toBeVisible();
  const plus = await add(page).boundingBox();
  near(plus.x + plus.width / 2, page.viewportSize().width / 2);
}

// Checks that Edit, "+" and Delete sit side by side, 14 pixels apart, with "+" in the middle.
async function threeInTheMiddle(page) {
  for (const button of [edit(page), add(page), remove(page)]) await expect(button).toBeVisible();
  const [pen, plus, bin] = await Promise.all(
    [edit(page), add(page), remove(page)].map((button) => button.boundingBox()),
  );
  near(plus.x - (pen.x + pen.width), 14);
  near(bin.x - (plus.x + plus.width), 14);
  near(plus.x + plus.width / 2, page.viewportSize().width / 2);
  const arrow = await back(page).boundingBox();
  for (const box of [pen, plus, bin]) near(box.y + box.height, arrow.y + arrow.height);
}

// Writes down every animation and transition that starts or ends on the buttons, the months
// (month0 is the top one) and the form: which one, which kind, and when.
const startAnimationLog = (page) =>
  page.evaluate(() => {
    window.__animationLog = [];
    const nameOf = (node) => {
      if (['back', 'add', 'delete', 'edit'].includes(node.id)) return node.id;
      if (node.classList.contains('movement-form')) return 'form';
      if (node.classList.contains('month')) {
        return `month${[...document.querySelectorAll('.month')].indexOf(node)}`;
      }
      return 'other';
    };
    const steps = {
      animationstart: 'start',
      animationend: 'end',
      transitionrun: 'start',
      transitionend: 'end',
    };
    for (const [type, step] of Object.entries(steps)) {
      document.addEventListener(
        type,
        (event) => {
          window.__animationLog.push({
            who: nameOf(event.target),
            step,
            name: event.animationName ?? `move ${event.propertyName}`,
            time: window.performance.now(),
          });
        },
        true,
      );
    }
  });
const animationLog = (page) => page.evaluate(() => window.__animationLog);
const momentOf = (log, who, step, name) =>
  log.find(
    (entry) =>
      entry.who === who && entry.step === step && (name === undefined || entry.name === name),
  )?.time;

// On every frame while Edit shows: where Edit and "+" are, side to side.
const startEditFrames = (page) =>
  page.evaluate(() => {
    const run = (window.__editRun = (window.__editRun ?? 0) + 1);
    window.__editFrames = [];
    const sample = () => {
      if (window.__editRun !== run) return;
      const pen = document.querySelector('#edit');
      if (pen.getClientRects().length) {
        const plus = document.querySelector('#add').getBoundingClientRect();
        window.__editFrames.push({
          plus: plus.left,
          gap: plus.left - pen.getBoundingClientRect().right,
        });
      }
      if (window.__editFrames.length < 600) window.requestAnimationFrame(sample);
    };
    window.requestAnimationFrame(sample);
  });
const editFrames = (page) => page.evaluate(() => window.__editFrames);

// The animations made by the app's code (not by styles.css) that are still playing.
const playing = (page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect.getComputedTiming().iterations !== Infinity &&
            animation.playState === 'running',
        ).length,
  );

test.describe('the Edit button', () => {
  test('with one movement selected, Edit shows on the left of "+" and Delete on its right', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);

    await hold(page, movement(page, 0, 0));

    await threeInTheMiddle(page);
    // It looks like the back button, with the green border of the goal card and a pen icon.
    expect(CARDS.edit.colors).toEqual(CARDS.goal.colors);
    const size = await edit(page).boundingBox();
    const arrow = await back(page).boundingBox();
    near(size.width, arrow.width);
    near(size.height, arrow.height);
    expect(await edit(page).evaluate((node) => node.style.getPropertyValue('--label-border'))).toBe(
      `linear-gradient(to bottom right, ${CARDS.goal.colors.join(', ')})`,
    );
    const icon = edit(page).locator('[data-icon="pen"] svg');
    await expect(icon.locator('path')).toHaveAttribute('d', ICONS.pen.path);
    await expect(icon).toHaveAttribute('width', '24');
    await expect(edit(page)).toHaveAttribute('aria-label', STRINGS.en.edit);
  });

  test('a person who can only view the sheet never sees it', async ({ page }) => {
    await openGoal(page, { canEdit: false });
    await tapMonth(page, 0);

    await hold(page, movement(page, 0, 0));

    await expect(edit(page)).toBeHidden();
  });

  test.describe('on a screen 360 pixels wide', () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test('Edit, "+" and Delete fit next to the back button, with nothing cut off or overlapping', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);

      await hold(page, movement(page, 0, 0));

      await threeInTheMiddle(page);
      const arrow = await back(page).boundingBox();
      const pen = await edit(page).boundingBox();
      const bin = await remove(page).boundingBox();
      expect(pen.x).toBeGreaterThan(arrow.x + arrow.width);
      expect(bin.x + bin.width).toBeLessThanOrEqual(360);
    });
  });

  test('with a second movement selected, Edit goes and "+" and Delete are in the middle', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);

    await select(page, 0, [0, 1]);

    await expect(edit(page)).toBeHidden();
    const plus = await add(page).boundingBox();
    const bin = await remove(page).boundingBox();
    near(bin.x - (plus.x + plus.width), 14);
    near((plus.x + bin.x + bin.width) / 2, page.viewportSize().width / 2);

    // Back to one movement selected: the three again, with "+" in the middle.
    await tapAndWait(page, movement(page, 0, 1));
    await threeInTheMiddle(page);
  });

  test('unselecting the only movement takes Edit and Delete away, and "+" stays in the middle', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await hold(page, movement(page, 0, 0));

    await tapAndWait(page, movement(page, 0, 0));

    await onlyPlusInTheMiddle(page);
  });

  test('with one movement selected, "+" opens the new movement form; after Cancel nothing is selected', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await hold(page, movement(page, 0, 0));

    await tapAndWait(page, add(page));

    await expect(form(page)).toBeVisible();
    await expect(title(page)).toHaveText(STRINGS.en.newMovement);
    for (const button of [back(page), edit(page), remove(page)]) await expect(button).toBeHidden();
    await tapAndWait(page, cancel(page));
    await expect(selected(page)).toHaveCount(0);
    await onlyPlusInTheMiddle(page);
  });

  test('with one movement selected, Delete and then No bring the three buttons back', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await hold(page, movement(page, 0, 1));

    await tapAndWait(page, remove(page));
    await expect(panel(page)).toBeVisible();
    await expect(edit(page)).toBeHidden();
    await tapAndWait(page, no(page));

    await threeInTheMiddle(page);
    await expect(movement(page, 0, 1)).toHaveClass(/\bselected\b/);
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('Edit and Delete rise in together while "+" stays still; unselecting, they sink together', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);
      await startAnimationLog(page);

      await hold(page, movement(page, 0, 0));
      await expect(edit(page)).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);

      let log = await animationLog(page);
      const rise = momentOf(log, 'edit', 'start', 'card-rise');
      expect(rise).toBeDefined();
      expect(Math.abs(momentOf(log, 'delete', 'start', 'card-rise') - rise)).toBeLessThan(50);
      expect(momentOf(log, 'add', 'start', 'move translate')).toBeUndefined();
      await threeInTheMiddle(page);

      await startAnimationLog(page);
      await tapAndWait(page, movement(page, 0, 0));
      await expect(edit(page)).toBeHidden();

      log = await animationLog(page);
      const sink = momentOf(log, 'edit', 'start', 'card-sink');
      expect(sink).toBeDefined();
      expect(Math.abs(momentOf(log, 'delete', 'start', 'card-sink') - sink)).toBeLessThan(50);
      expect(momentOf(log, 'add', 'start', 'move translate')).toBeUndefined();
      await onlyPlusInTheMiddle(page);
    });

    test('a second movement: Edit sinks while the three slide left; back to one, it rises next to "+" while they slide right', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);
      await hold(page, movement(page, 0, 0));
      const middle = page.viewportSize().width / 2;
      const width = (await add(page).boundingBox()).width;
      await startAnimationLog(page);
      await startEditFrames(page);

      await tapAndWait(page, movement(page, 0, 1));
      await expect(edit(page)).toBeHidden();

      let log = await animationLog(page);
      const sink = momentOf(log, 'edit', 'start', 'card-sink');
      expect(sink).toBeDefined();
      expect(Math.abs(momentOf(log, 'add', 'start', 'move translate') - sink)).toBeLessThan(50);
      // Edit stays 14 pixels to the left of "+" while they slide.
      let frames = await editFrames(page);
      expect(frames.length).toBeGreaterThan(2);
      for (const { gap } of frames) near(gap, 14);
      expect(frames.at(-1).plus).toBeLessThan(frames[0].plus - 1);

      await startAnimationLog(page);
      await startEditFrames(page);
      await tapAndWait(page, movement(page, 0, 1));
      await expect(edit(page)).toBeVisible();

      log = await animationLog(page);
      const rise = momentOf(log, 'edit', 'start', 'card-rise');
      expect(rise).toBeDefined();
      expect(Math.abs(momentOf(log, 'add', 'start', 'move translate') - rise)).toBeLessThan(50);
      frames = await editFrames(page);
      expect(frames.length).toBeGreaterThan(2);
      for (const { gap } of frames) near(gap, 14);
      // From the first frame Edit is right next to "+", which starts on the left of the middle.
      expect(Math.abs(frames[0].plus - (middle - width - 7))).toBeLessThan(3);
      near(frames.at(-1).plus, middle - width / 2);
    });

    test('Edit plays the same movement as "+": the buttons sink, then the months, then the form rises', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);
      await hold(page, movement(page, 0, 0));
      await startAnimationLog(page);

      await tapAndWait(page, edit(page));
      await expect(form(page)).toBeVisible();

      const log = await animationLog(page);
      const at = (who, step, name) => momentOf(log, who, step, name);
      for (const button of ['back', 'add', 'edit', 'delete']) {
        expect(at(button, 'start', 'card-sink')).toBeLessThan(at('month0', 'start', 'card-sink'));
      }
      for (const each of ['month0', 'month1', 'month2']) {
        expect(at('form', 'start', 'card-rise')).toBeGreaterThanOrEqual(
          at(each, 'end', 'card-sink'),
        );
      }
    });
  });

  test('with "reduce motion", the buttons and the form change at once', async ({ page }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await startAnimationLog(page);

    await hold(page, movement(page, 0, 0));
    await expect(edit(page)).toBeVisible();
    expect(await playing(page)).toBe(0);
    await tapAndWait(page, movement(page, 0, 1));
    await expect(edit(page)).toBeHidden();
    await tapAndWait(page, movement(page, 0, 1));
    await expect(edit(page)).toBeVisible();
    await edit(page).click();
    await expect(form(page)).toBeVisible();
    expect(await playing(page)).toBe(0);

    expect(
      (await animationLog(page)).filter(({ who, step }) => who !== 'other' && step === 'start'),
    ).toEqual([]);
  });
});

test.describe('the edit form', () => {
  test('Edit opens the form titled "Edit movement", filled in with the movement', async ({
    page,
  }) => {
    // Cinema: the second movement of October.
    await openEdit(page, 1);

    await expect(title(page)).toHaveText('Edit movement');
    await expect(field(page, 'source')).toHaveValue('Cash');
    await expect(field(page, 'date')).toHaveValue('2026-10-12');
    await expect(field(page, 'category')).toHaveValue('Leisure');
    await expect(field(page, 'concept')).toHaveValue('Cinema');
    await expect(field(page, 'amount')).toHaveValue('10.00');
    await expect(sign(page)).toHaveAttribute('data-sign', 'minus');
    await expect(note(page)).toBeHidden();
    await expect(save(page)).toBeVisible();
    await expect(cancel(page)).toHaveText(STRINGS.en.cancel);
  });

  test('an amount added to the sheet shows its sign and always two decimals', async ({ page }) => {
    const movements = movementRows();
    movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Refund', 125.5];
    await openEdit(page, 1, { movements });

    await expect(field(page, 'amount')).toHaveValue('125.50');
    await expect(sign(page)).toHaveAttribute('data-sign', 'plus');
  });

  test('an amount of 0 shows as 0.00 with "−"', async ({ page }) => {
    const movements = movementRows();
    movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Free', 0];
    await openEdit(page, 1, { movements });

    await expect(field(page, 'amount')).toHaveValue('0.00');
    await expect(sign(page)).toHaveAttribute('data-sign', 'minus');
  });

  test('a date with a time of day shows its day', async ({ page }) => {
    const movements = movementRows();
    movements[2] = ['Cash', sheetDay('2026-10-12') + 0.75, 'Leisure', 'Cinema', -10];
    await openEdit(page, 1, { movements });

    await expect(field(page, 'date')).toHaveValue('2026-10-12');
  });

  test('a source and a category that are no longer in the lists are empty and already marked Required', async ({
    page,
  }) => {
    const movements = movementRows();
    movements[2] = ['Old bank', sheetDay('2026-10-12'), 'Hobbies', 'Cinema', -10];
    const { requests } = await openEdit(page, 1, { movements });

    for (const name of ['source', 'category']) {
      await expect(field(page, name)).toHaveValue('');
      await expect(
        form(page)
          .locator('.form-field.missing')
          .filter({ has: field(page, name) }),
      ).toHaveCount(1);
    }
    await expect(form(page).locator('.form-field.missing')).toHaveCount(2);

    await tapAndWait(page, save(page));

    await expect(form(page)).toBeVisible();
    expect(requests.saves).toEqual([]);
  });

  test('an amount with more than two decimals has a red warning in the list, and the form cuts it', async ({
    page,
  }) => {
    const movements = movementRows();
    movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -12.345];
    await openGoal(page, { movements });
    await tapMonth(page, 0);

    const warning = movement(page, 0, 1).locator('.amount-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAttribute('aria-label', STRINGS.en.amountCut);
    await expect(warning.locator('path')).toHaveAttribute('d', ICONS.warning.path);
    // Red, right after the amount.
    expect(await warning.evaluate((node) => getComputedStyle(node).color)).toBe('rgb(220, 38, 38)');
    const amount = await movement(page, 0, 1).locator('.movement-amount').boundingBox();
    const icon = await warning.boundingBox();
    expect(icon.x).toBeGreaterThanOrEqual(amount.x + amount.width - 1);
    expect(icon.x).toBeLessThan(amount.x + amount.width + 12);
    await expect(movement(page, 0, 0).locator('.amount-warning')).toHaveCount(0);

    await select(page, 0, [1]);
    await tapAndWait(page, edit(page));

    await expect(field(page, 'amount')).toHaveValue('12.34');
    await expect(note(page)).toBeVisible();
    await expect(note(page)).toHaveText(STRINGS.en.amountCut);
    expect(await note(page).evaluate((node) => getComputedStyle(node).color)).toBe(
      'rgb(234, 88, 12)',
    );
  });

  test('Cancel closes the form, changes nothing in the sheet, and nothing is selected', async ({
    page,
  }) => {
    const { requests, movements } = await openEdit(page, 1);
    await field(page, 'concept').fill('Theatre');

    await tapAndWait(page, cancel(page));

    await expect(form(page)).toBeHidden();
    expect(requests.saves).toEqual([]);
    expect(movements).toEqual(movementRows());
    await expect(selected(page)).toHaveCount(0);
    await onlyPlusInTheMiddle(page);
    await expect.poll(() => descriptions(page, 0)).toContain('Cinema');
  });
});

// Replaces the whole amount of the form with the typed numbers.
async function typeAmount(page, numbers) {
  await field(page, 'amount').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(numbers);
}

// Saves the form, and waits until it has closed.
async function saveAndClose(page) {
  await tapAndWait(page, save(page));
  await expect(form(page)).toBeHidden();
  await expect.poll(() => locked(page)).toBe(false);
}

test.describe('saving a change', () => {
  test('a new amount shows in the movement, its month and the goal; the sheet has only that change', async ({
    page,
  }) => {
    const { requests, movements } = await openEdit(page, 1);
    await expect(goalValue(page)).toHaveText('€256.00');

    await typeAmount(page, '3000');
    await saveAndClose(page);

    await tapMonth(page, 0);
    await expect(movement(page, 0, 1).locator('.movement-amount')).toHaveText('€30.00');
    await expect(monthAmount(page, 0)).toHaveText('€270.00');
    await expect(goalValue(page)).toHaveText('€276.00');
    await expect(selected(page)).toHaveCount(0);
    await onlyPlusInTheMiddle(page);
    const rows = movementRows();
    rows[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -30];
    expect(movements).toEqual(rows);
    // One single request, that writes only values, only in columns A to E. It adds, inserts and
    // deletes no row.
    expect(requests.saves).toHaveLength(1);
    const { requests: changes } = requests.saves[0].body;
    expect(changes).toHaveLength(1);
    expect(changes[0].updateCells).toMatchObject({
      range: { startColumnIndex: 0, endColumnIndex: 5 },
      fields: 'userEnteredValue',
    });
  });

  test('a changed concept of the first of two movements of a source keeps it first', async ({
    page,
  }) => {
    const movements = [
      ['Cash', sheetDay('2026-10-03'), 'General', 'Bread', -2],
      ['Cash', sheetDay('2026-10-03'), 'General', 'Milk', -3],
    ];
    await openEdit(page, 0, { movements });

    await field(page, 'concept').fill('Rolls');
    await saveAndClose(page);

    expect(movements.map(([, , , concept]) => concept)).toEqual(['Rolls', 'Milk']);
    await tapMonth(page, 0);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Rolls', 'Milk']);
  });

  test('a new day of the goal moves it there, after its source; the rows between move up by one', async ({
    page,
  }) => {
    const { movements } = await openEdit(page, 1);

    await field(page, 'date').fill('2026-10-03');
    await saveAndClose(page);

    const rows = movementRows();
    expect(movements).toEqual([
      rows[0],
      rows[1],
      ['Cash', sheetDay('2026-10-03'), 'Leisure', 'Cinema', -10],
      rows[3],
      rows[4],
      rows[5],
    ]);
    await tapMonth(page, 0);
    await expect
      .poll(() => descriptions(page, 0))
      .toEqual(['Petrol', 'Market', 'Market', 'Cinema']);
  });

  test('a later day that is out of order is put in order too', async ({ page }) => {
    const movements = movementRows();
    // The 20th has Cash above BBVA David: out of order.
    movements.splice(5, 0, ['BBVA David', sheetDay('2026-10-20'), 'Car', 'Tyres', -60]);
    const { movements: sheet } = await openEdit(page, 1, { movements });

    await field(page, 'concept').fill('Cinema 2');
    await saveAndClose(page);

    expect(sheet.slice(4, 6).map(([source]) => source)).toEqual(['BBVA David', 'Cash']);
  });

  test('a day outside the goal: the card no longer shows it, and the totals are lower', async ({
    page,
  }) => {
    const { movements } = await openEdit(page, 1);

    await field(page, 'date').fill('2027-01-05');
    await saveAndClose(page);

    await expect(goalValue(page)).toHaveText('€246.00');
    await expect(monthAmount(page, 0)).toHaveText('€240.00');
    expect(movements.at(-1)).toEqual(['Cash', sheetDay('2027-01-05'), 'Leisure', 'Cinema', -10]);
    expect(movements).toHaveLength(6);
  });

  test('a category the goal does not count: the card no longer shows it', async ({ page }) => {
    const movements = movementRows();
    // The form's lists come from the sheet: here they offer Salary too.
    const { movements: sheet } = await openEdit(page, 1, {
      movements,
      dropdowns: {
        'Sheet2!A2': {
          type: 'ONE_OF_LIST',
          values: ['Cash', 'Provisioned'].map((value) => ({ userEnteredValue: value })),
        },
        'Sheet2!C2': {
          type: 'ONE_OF_LIST',
          values: ['Leisure', 'Salary'].map((value) => ({ userEnteredValue: value })),
        },
      },
    });

    await field(page, 'category').selectOption('Salary');
    await saveAndClose(page);

    await expect(goalValue(page)).toHaveText('€246.00');
    expect(sheet[2][2]).toBe('Salary');
  });

  test('changing only the Cash amount keeps its Provisioned movement as it was, right below it', async ({
    page,
  }) => {
    // The Cash Market: the third movement of October.
    const { movements } = await openEdit(page, 2);

    await typeAmount(page, '12000');
    await saveAndClose(page);

    expect(movements.slice(0, 2)).toEqual([
      ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -120],
      movementRows()[1],
    ]);
  });

  test('a Cash movement moved to another day leaves its Provisioned movement in its own day', async ({
    page,
  }) => {
    const { movements } = await openEdit(page, 2);

    await field(page, 'date').fill('2026-10-05');
    await saveAndClose(page);

    expect(movements.slice(0, 2)).toEqual([
      movementRows()[1],
      ['Cash', sheetDay('2026-10-05'), 'General', 'Market', -100],
    ]);
  });

  test('a Cash movement with another source leaves its Provisioned movement in the usual order', async ({
    page,
  }) => {
    const movements = movementRows();
    movements.splice(2, 0, ['Cash', sheetDay('2026-10-03'), 'General', 'Kiosk', -1]);
    // October now: Petrol, Cinema, Market, Market, Kiosk. The Cash Market is the third.
    const { movements: sheet } = await openEdit(page, 2, { movements });

    await field(page, 'source').selectOption('BBVA David');
    await saveAndClose(page);

    // BBVA David goes first; Cash Kiosk next; the Provisioned Market keeps its place after them.
    expect(sheet.slice(0, 3).map(([source, , , concept]) => `${source} ${concept}`)).toEqual([
      'BBVA David Market',
      'Cash Kiosk',
      'Provisioned Market',
    ]);
  });

  test('an amount of 0 is saved as it is, with the new concept', async ({ page }) => {
    const rows = movementRows();
    rows[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Free', 0];
    const { movements } = await openEdit(page, 1, { movements: rows });

    await field(page, 'concept').fill('Free ticket');
    await saveAndClose(page);

    expect(movements[2]).toEqual(['Cash', sheetDay('2026-10-12'), 'Leisure', 'Free ticket', 0]);
  });

  test('a date with a time of day is saved as the day; with nothing changed, the time stays', async ({
    page,
  }) => {
    const rows = movementRows();
    rows[2] = ['Cash', sheetDay('2026-10-12') + 0.75, 'Leisure', 'Cinema', -10];
    rows[4] = ['Cash', sheetDay('2026-10-20') + 0.5, 'Car', 'Petrol', -40];
    const { movements, requests } = await openEdit(page, 0, { movements: rows });

    // Petrol, unchanged: nothing is written.
    await saveAndClose(page);
    expect(requests.saves).toEqual([]);
    expect(movements[4][1]).toBe(sheetDay('2026-10-20') + 0.5);

    await tapMonth(page, 0);
    await select(page, 0, [1]);
    await tapAndWait(page, edit(page));
    await typeAmount(page, '1100');
    await saveAndClose(page);

    expect(movements[2]).toEqual(['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -11]);
  });

  test('an amount with more than two decimals is saved cut to two, and the warning goes', async ({
    page,
  }) => {
    const rows = movementRows();
    rows[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -12.345];
    rows[4] = ['Cash', sheetDay('2026-10-20'), 'Car', 'Petrol', 12.345];
    const { movements } = await openEdit(page, 1, { movements: rows });

    await saveAndClose(page);
    await tapMonth(page, 0);
    await select(page, 0, [0]);
    await tapAndWait(page, edit(page));
    await saveAndClose(page);

    expect(movements[2][4]).toBe(-12.34);
    expect(movements[4][4]).toBe(12.34);
    await tapMonth(page, 0);
    await expect(page.locator('.amount-warning')).toHaveCount(0);
  });

  test('Save with nothing changed closes the form, writes nothing, and nothing is selected', async ({
    page,
  }) => {
    const { requests } = await openEdit(page, 1);
    await field(page, 'concept').fill('  Cinema ');

    await saveAndClose(page);

    expect(requests.saves).toEqual([]);
    await expect(selected(page)).toHaveCount(0);
    await onlyPlusInTheMiddle(page);
  });
});

test.describe('problems while saving a change', () => {
  test('when the sheet was changed by hand, nothing is saved, and Close shows the sheet as it is now', async ({
    page,
  }) => {
    const { requests, movements } = await openEdit(page, 1);
    // Somebody writes another movement in the row of Cinema.
    movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
    await field(page, 'concept').fill('Cinema 2');

    await tapAndWait(page, save(page));

    await expect(saveMessage(page)).toHaveText('The sheet was changed, so nothing was saved.');
    await expect(save(page)).toBeHidden();
    await expect(cancel(page)).toHaveText('Close');
    expect(requests.saves).toEqual([]);

    await tapAndWait(page, cancel(page));

    await expect(form(page)).toBeHidden();
    await expect(selected(page)).toHaveCount(0);
    await onlyPlusInTheMiddle(page);
    if (!(await month(page, 0).locator('.month-list').isVisible())) await tapMonth(page, 0);
    await expect
      .poll(() => descriptions(page, 0))
      .toEqual(['Petrol', 'Theatre', 'Market', 'Market']);
  });

  test('with no internet, nothing is saved and the form says so; the next Save saves once', async ({
    page,
  }) => {
    const { requests, movements } = await openEdit(page, 1, { saves: ['offline', 200] });
    await field(page, 'concept').fill('Cinema 2');

    await tapAndWait(page, save(page));

    await expect(saveMessage(page)).toHaveText('The movement was not saved. Please try again.');
    await expect(form(page)).toBeVisible();
    await expect(field(page, 'concept')).toHaveValue('Cinema 2');
    expect(movements).toEqual(movementRows());

    await saveAndClose(page);

    expect(requests.saves.map(({ done }) => done)).toEqual([false, true]);
    expect(movements[2][3]).toBe('Cinema 2');
  });

  test('two quick taps on Save save once; while saving, Save and Cancel cannot be tapped', async ({
    page,
  }) => {
    const { requests } = await openEdit(page, 1);
    // The answer to the save waits until the test lets it go.
    let letGo;
    const waiting = new Promise((done) => (letGo = done));
    await page.route('**/*:batchUpdate', async (route) => {
      await waiting;
      await route.fallback();
    });
    await field(page, 'concept').fill('Cinema 2');

    await save(page).dblclick();

    await expect(save(page)).toBeDisabled();
    await expect(cancel(page)).toBeDisabled();
    letGo();
    await expect(form(page)).toBeHidden();
    await expect.poll(() => locked(page)).toBe(false);
    expect(requests.saves).toHaveLength(1);
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('when the sheet was changed, Save sinks away and the message rises in', async ({
      page,
    }) => {
      const { movements } = await openEdit(page, 1);
      movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
      await field(page, 'concept').fill('Cinema 2');
      await page.evaluate(() => {
        window.__formLog = [];
        document.addEventListener(
          'animationstart',
          ({ target, animationName }) => {
            if (!target.closest?.('.movement-form')) return;
            window.__formLog.push(`${target.dataset.card ?? target.classList[0]} ${animationName}`);
          },
          true,
        );
      });

      await tapAndWait(page, save(page));

      await expect(save(page)).toBeHidden();
      expect(await page.evaluate(() => window.__formLog)).toEqual(
        expect.arrayContaining(['save card-sink', 'save-message card-rise']),
      );
    });
  });
});

test.describe('in other languages', () => {
  for (const language of ['es', 'ru']) {
    test(`after picking the "${language}" flag, Edit, the title, the warning and the messages are in that language`, async ({
      page,
    }) => {
      const rows = movementRows();
      rows[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -12.345];
      const { movements } = await openMain(page, { movements: rows, saves: ['offline'] });
      const picker = page.locator('#main [data-card="language"]');
      await picker.locator('[aria-current="true"]').click();
      await expect.poll(() => locked(page)).toBe(false);
      await picker.locator(`[data-language="${language}"]`).click();
      await expect.poll(() => locked(page)).toBe(false);
      await goalCard(page).click();
      await expect(back(page)).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);
      await tapMonth(page, 0);
      const words = STRINGS[language];

      await expect(movement(page, 0, 1).locator('.amount-warning')).toHaveAttribute(
        'aria-label',
        words.amountCut,
      );
      await select(page, 0, [1]);
      await expect(edit(page)).toHaveAttribute('aria-label', words.edit);
      await tapAndWait(page, edit(page));
      await expect(title(page)).toHaveText(words.editMovement);
      await expect(note(page)).toHaveText(words.amountCut);

      await tapAndWait(page, save(page));
      await expect(saveMessage(page)).toHaveText(words.notSaved);

      movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
      await tapAndWait(page, save(page));
      await expect(saveMessage(page)).toHaveText(words.sheetChangedNotSaved);
      await expect(cancel(page)).toHaveText(words.close);
    });
  }
});
