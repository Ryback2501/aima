import { test, expect } from '@playwright/test';

import { setUp, sheetDay } from './helpers.js';
import { CARDS } from '../../src/components.js';
import { ICONS } from '../../src/icons.js';
import { STRINGS } from '../../src/i18n.js';

// Deleting the selected movements in the open goal card (issue #103).

const signInButton = (page) => page.locator('#sign-in');
const goalCard = (page) => page.locator('#main [data-card="goal"]');
const goalValue = (page) => page.locator('#goal-value');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const remove = (page) => page.locator('#delete');
const form = (page) => page.locator('.movement-form');
const panel = (page) => page.locator('.delete-panel');
const question = (page) => panel(page).locator('.delete-question');
const message = (page) => panel(page).locator('.delete-message');
const no = (page) => panel(page).locator('[data-card="no"]');
const yes = (page) => panel(page).locator('[data-card="yes"]');
const monthArea = (page) => goalCard(page).locator('.month-area');
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
const EMPTY = ['', '', '', '', ''];

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

// Opens the delete panel with a tap on Delete.
async function openPanel(page) {
  await tapAndWait(page, remove(page));
  await expect(panel(page)).toBeVisible();
}

// Checks that only "+" shows at the bottom, in the middle, next to the back button.
async function onlyPlusInTheMiddle(page) {
  await expect(remove(page)).toBeHidden();
  await expect(add(page)).toBeVisible();
  const plus = await add(page).boundingBox();
  near(plus.x + plus.width / 2, page.viewportSize().width / 2);
}

// Writes down every animation and transition that starts or ends on the buttons, the months
// (month0 is the top one), the form and the delete panel: which one, which kind, and when.
const startAnimationLog = (page) =>
  page.evaluate(() => {
    window.__animationLog = [];
    const nameOf = (node) => {
      if (['back', 'add', 'delete'].includes(node.id)) return node.id;
      if (node.classList.contains('movement-form')) return 'form';
      if (node.classList.contains('delete-panel')) return 'panel';
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

test.describe('the Delete button', () => {
  test('selecting the first movement puts "+" on the left and Delete on its right, in the middle', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await onlyPlusInTheMiddle(page);

    await hold(page, movement(page, 0, 0));

    await expect(remove(page)).toBeVisible();
    const plus = await add(page).boundingBox();
    const bin = await remove(page).boundingBox();
    const arrow = await back(page).boundingBox();
    // Side by side, 14 pixels apart, in the middle, at the height of the back button.
    near(bin.x - (plus.x + plus.width), 14);
    near((plus.x + bin.x + bin.width) / 2, page.viewportSize().width / 2);
    near(bin.y + bin.height, arrow.y + arrow.height);
    near(bin.width, arrow.width);
    near(bin.height, arrow.height);
    // It looks like the back button, with a red border like Log out, and a delete icon.
    expect(CARDS.delete.colors).toEqual(CARDS.logOut.colors);
    expect(
      await remove(page).evaluate((node) => node.style.getPropertyValue('--label-border')),
    ).toBe(`linear-gradient(to bottom right, ${CARDS.logOut.colors.join(', ')})`);
    const icon = remove(page).locator('[data-icon="trash"] svg');
    await expect(icon.locator('path')).toHaveAttribute('d', ICONS.trash.path);
    await expect(icon).toHaveAttribute('width', '24');
    await expect(remove(page)).toHaveAttribute('aria-label', STRINGS.en.delete);

    // Unselecting the last one: Delete goes, and "+" is in the middle again.
    await tapAndWait(page, movement(page, 0, 0));
    await onlyPlusInTheMiddle(page);
  });

  test('a person who can only view the sheet never sees it', async ({ page }) => {
    await openGoal(page, { canEdit: false });
    await tapMonth(page, 0);

    await hold(page, movement(page, 0, 0));

    await expect(remove(page)).toBeHidden();
  });

  test('"+" with movements selected opens the form as before; after Cancel nothing is selected', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await select(page, 0, [0, 1]);

    await tapAndWait(page, add(page));

    await expect(form(page)).toBeVisible();
    await expect(remove(page)).toBeHidden();
    await expect(back(page)).toBeHidden();
    await tapAndWait(page, form(page).locator('[data-card="cancel"]'));
    await expect(form(page)).toBeHidden();
    await expect(selected(page)).toHaveCount(0);
    await onlyPlusInTheMiddle(page);
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('"+" slides left before Delete rises in; at the end Delete sinks before "+" slides back', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);
      await startAnimationLog(page);

      await hold(page, movement(page, 0, 0));
      await expect(remove(page)).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);

      let log = await animationLog(page);
      const slid = momentOf(log, 'add', 'end');
      expect(slid).toBeDefined();
      expect(momentOf(log, 'delete', 'start', 'card-rise')).toBeGreaterThanOrEqual(slid);

      await startAnimationLog(page);
      await tapAndWait(page, movement(page, 0, 0));
      await expect(remove(page)).toBeHidden();

      log = await animationLog(page);
      const sunk = momentOf(log, 'delete', 'end', 'card-sink');
      expect(sunk).toBeDefined();
      expect(momentOf(log, 'add', 'start')).toBeGreaterThanOrEqual(sunk);
      await onlyPlusInTheMiddle(page);
    });

    test('with movements selected, a tap on "+" sinks Delete with the other buttons', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);
      await hold(page, movement(page, 0, 0));
      await startAnimationLog(page);

      await tapAndWait(page, add(page));
      await expect(form(page)).toBeVisible();

      const log = await animationLog(page);
      const at = (who) => momentOf(log, who, 'start', 'card-sink');
      expect(Math.abs(at('delete') - at('add'))).toBeLessThan(50);
      expect(at('delete')).toBeLessThan(at('month0'));
    });
  });
});

test.describe('the delete panel', () => {
  test('Delete with 3 selected asks "Delete 3 movements?" in a panel like the form', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await select(page, 0, [0, 1, 2]);

    await openPanel(page);

    await expect(question(page)).toHaveText('Delete 3 movements?');
    await expect(no(page)).toHaveText('No');
    await expect(yes(page)).toHaveText('Yes');
    await expect(monthArea(page)).toBeHidden();
    for (const button of [back(page), add(page), remove(page)]) await expect(button).toBeHidden();
    await expect(message(page)).toBeHidden();
    // A light grey panel with a white border, like the form.
    const look = (locator) =>
      locator.evaluate((node) => {
        const css = getComputedStyle(node);
        return [css.backgroundColor, css.borderTopWidth, css.borderTopColor, css.borderRadius];
      });
    await tapAndWait(page, no(page));
    await tapAndWait(page, add(page));
    const formLook = await look(form(page));
    await tapAndWait(page, form(page).locator('[data-card="cancel"]'));
    await select(page, 0, [3]);
    await openPanel(page);
    expect(await look(panel(page))).toEqual(formLook);
    // No has a grey border like the back button, Yes a red one like Log out.
    expect(CARDS.no.colors).toEqual(CARDS.back.colors);
    expect(CARDS.yes.colors).toEqual(CARDS.logOut.colors);
    const border = (locator) =>
      locator.evaluate((node) => node.style.getPropertyValue('--label-border'));
    expect(await border(no(page))).toBe(
      `linear-gradient(to bottom right, ${CARDS.back.colors.join(', ')})`,
    );
    expect(await border(yes(page))).toBe(
      `linear-gradient(to bottom right, ${CARDS.logOut.colors.join(', ')})`,
    );
  });

  test('with one movement selected, it asks "Delete this movement?"', async ({ page }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await select(page, 0, [1]);

    await openPanel(page);

    await expect(question(page)).toHaveText('Delete this movement?');
  });

  test('movements selected in two months count together: "Delete 2 movements?"', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await select(page, 0, [0]);
    await tapMonth(page, 0);
    await tapMonth(page, 2);
    await tapAndWait(page, movement(page, 2, 0));

    await openPanel(page);

    await expect(question(page)).toHaveText('Delete 2 movements?');
  });

  test('No closes the panel, the same movements are still selected, and the sheet does not change', async ({
    page,
  }) => {
    const { requests } = await openGoal(page);
    await tapMonth(page, 0);
    await select(page, 0, [0, 2]);
    await openPanel(page);

    await tapAndWait(page, no(page));

    await expect(panel(page)).toBeHidden();
    await expect(monthArea(page)).toBeVisible();
    await expect(selected(page)).toHaveCount(2);
    await expect(movement(page, 0, 0)).toHaveClass(/\bselected\b/);
    await expect(movement(page, 0, 2)).toHaveClass(/\bselected\b/);
    await expect(back(page)).toBeVisible();
    await expect(add(page)).toBeVisible();
    await expect(remove(page)).toBeVisible();
    expect(requests.saves).toEqual([]);
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('Delete sinks the buttons and the months, then the panel rises in; No plays it in reverse', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);
      await hold(page, movement(page, 0, 0));
      await expect.poll(() => locked(page)).toBe(false);
      await startAnimationLog(page);

      await openPanel(page);

      let log = await animationLog(page);
      let at = (who, step, name) => momentOf(log, who, step, name);
      for (const button of ['back', 'add', 'delete']) {
        expect(at(button, 'start', 'card-sink')).toBeLessThan(at('month2', 'start', 'card-sink'));
      }
      for (const each of ['month0', 'month1', 'month2']) {
        expect(at('panel', 'start', 'card-rise')).toBeGreaterThanOrEqual(
          at(each, 'end', 'card-sink'),
        );
      }

      await startAnimationLog(page);
      await tapAndWait(page, no(page));
      await expect(remove(page)).toBeVisible();

      log = await animationLog(page);
      at = (who, step, name) => momentOf(log, who, step, name);
      for (const each of ['month0', 'month1', 'month2']) {
        expect(at(each, 'start', 'card-rise')).toBeGreaterThanOrEqual(
          at('panel', 'end', 'card-sink'),
        );
      }
      for (const button of ['back', 'add', 'delete']) {
        expect(at(button, 'start', 'card-rise')).toBeGreaterThan(
          at('month2', 'start', 'card-rise'),
        );
      }
    });
  });
});

test.describe('deleting', () => {
  test('Yes deletes them: the rows go, the amounts are lower, nothing is selected, "+" in the middle', async ({
    page,
  }) => {
    await openGoal(page);
    await expect(goalValue(page)).toHaveText('€256.00');
    await tapMonth(page, 0);
    await expect(monthAmount(page, 0)).toHaveText('€250.00');
    // Petrol (40) and Cinema (10).
    await select(page, 0, [0, 1]);
    await openPanel(page);

    await tapAndWait(page, yes(page));

    await expect(panel(page)).toBeHidden();
    await expect(monthArea(page)).toBeVisible();
    await expect.poll(() => descriptions(page, 0)).toEqual(['Market', 'Market']);
    await expect(monthAmount(page, 0)).toHaveText('€200.00');
    await expect(goalValue(page)).toHaveText('€206.00');
    // The month stays open.
    await expect(month(page, 0).locator('.month-list')).toBeVisible();
    await expect(selected(page)).toHaveCount(0);
    await onlyPlusInTheMiddle(page);
  });

  test('deleting every movement of a month closes it and shows "--"; with none left, the goal shows 0', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 2);
    await select(page, 2, [0]);
    await openPanel(page);
    await tapAndWait(page, yes(page));

    await expect(monthAmount(page, 2)).toHaveText('--');
    await expect(month(page, 2).locator('.month-head')).toBeDisabled();
    await expect(month(page, 2).locator('.month-list')).toBeHidden();

    await tapMonth(page, 0);
    await select(page, 0, [0, 1, 2, 3]);
    await openPanel(page);
    await tapAndWait(page, yes(page));

    await expect(monthAmount(page, 0)).toHaveText('--');
    await expect(month(page, 0).locator('.month-head')).toBeDisabled();
    await expect(goalValue(page)).toHaveText('€0.00');
  });

  test('in the sheet, every movement below moves up, also the ones not shown, with empty cells after', async ({
    page,
  }) => {
    const { requests, movements } = await openGoal(page);
    await tapMonth(page, 0);
    // Cinema, the 3rd movement row.
    await select(page, 0, [1]);
    await openPanel(page);

    await tapAndWait(page, yes(page));
    await expect(panel(page)).toBeHidden();

    const rows = movementRows();
    expect(movements).toEqual([rows[0], rows[1], rows[3], rows[4], rows[5], EMPTY]);
    // One single request, that writes only values, only in columns A to E, from the row of
    // Cinema (row 4 of the sheet, 3 counted from 0). It adds, inserts and deletes no row.
    expect(requests.saves).toHaveLength(1);
    const { requests: changes } = requests.saves[0].body;
    expect(changes).toHaveLength(1);
    expect(changes[0].updateCells).toMatchObject({
      range: { startRowIndex: 3, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 5 },
      fields: 'userEnteredValue',
    });
  });

  test('deleting a Cash movement leaves its Provisioned movement in the sheet', async ({
    page,
  }) => {
    const { movements } = await openGoal(page);
    await tapMonth(page, 0);
    // The Cash Market: the third movement of October.
    await select(page, 0, [2]);
    await openPanel(page);

    await tapAndWait(page, yes(page));

    await expect.poll(() => descriptions(page, 0)).toEqual(['Petrol', 'Cinema', 'Market']);
    expect(movements[0]).toEqual(movementRows()[1]);
  });

  test('when the sheet was changed by hand, nothing is deleted, and Close shows the sheet as it is now', async ({
    page,
  }) => {
    const { requests, movements } = await openGoal(page);
    await tapMonth(page, 0);
    await select(page, 0, [1]);
    // Somebody writes another movement in the row of Cinema.
    movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
    await openPanel(page);

    await tapAndWait(page, yes(page));

    await expect(message(page)).toHaveText('The sheet was changed, so nothing was deleted.');
    await expect(yes(page)).toBeHidden();
    await expect(no(page)).toHaveText('Close');
    expect(requests.saves).toEqual([]);

    await tapAndWait(page, no(page));

    await expect(panel(page)).toBeHidden();
    await expect(selected(page)).toHaveCount(0);
    await onlyPlusInTheMiddle(page);
    if (!(await month(page, 0).locator('.month-list').isVisible())) await tapMonth(page, 0);
    await expect
      .poll(() => descriptions(page, 0))
      .toEqual(['Petrol', 'Theatre', 'Market', 'Market']);
    await expect(monthAmount(page, 0)).toHaveText('€270.00');
  });

  test('with no internet, nothing is deleted and the panel says so; the next Yes deletes once', async ({
    page,
  }) => {
    const { requests, movements } = await openGoal(page, { saves: ['offline', 200] });
    await tapMonth(page, 0);
    await select(page, 0, [1]);
    await openPanel(page);

    await tapAndWait(page, yes(page));

    await expect(message(page)).toHaveText('Nothing was deleted. Please try again.');
    await expect(no(page)).toHaveText('No');
    await expect(yes(page)).toBeVisible();
    expect(movements).toEqual(movementRows());

    await tapAndWait(page, yes(page));

    await expect(panel(page)).toBeHidden();
    expect(requests.saves.map(({ done }) => done)).toEqual([false, true]);
    await expect.poll(() => descriptions(page, 0)).toEqual(['Petrol', 'Market', 'Market']);
  });

  test('two quick taps on Yes delete once; while deleting, Yes and No cannot be tapped', async ({
    page,
  }) => {
    const { requests } = await openGoal(page);
    // The answer to the delete waits until the test lets it go.
    let letGo;
    const waiting = new Promise((done) => (letGo = done));
    await page.route('**/*:batchUpdate', async (route) => {
      await waiting;
      await route.fallback();
    });
    await tapMonth(page, 0);
    await select(page, 0, [1]);
    await openPanel(page);

    await yes(page).dblclick();

    await expect(yes(page)).toBeDisabled();
    await expect(no(page)).toBeDisabled();
    letGo();
    await expect(panel(page)).toBeHidden();
    await expect.poll(() => locked(page)).toBe(false);
    expect(requests.saves).toHaveLength(1);
  });

  test('with "reduce motion", the buttons, the panel and the deleting all happen at once', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await startAnimationLog(page);

    await hold(page, movement(page, 0, 1));
    await expect(remove(page)).toBeVisible();
    expect(await playing(page)).toBe(0);
    await openPanel(page);
    expect(await playing(page)).toBe(0);
    await yes(page).click();
    await expect(panel(page)).toBeHidden();
    await expect.poll(() => descriptions(page, 0)).toEqual(['Petrol', 'Market', 'Market']);
    expect(await playing(page)).toBe(0);
    await onlyPlusInTheMiddle(page);

    expect(
      (await animationLog(page)).filter(({ who, step }) => who !== 'other' && step === 'start'),
    ).toEqual([]);
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('after Yes the months come back still showing them, then the rows fade out and the rows below move up', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);
      // Cinema, with the two Markets below it.
      await select(page, 0, [1]);
      await openPanel(page);
      // On every frame: is the panel there, is the movement still there with its border, how
      // visible and how tall it is, and where the Market below it is.
      await page.evaluate(() => {
        window.__frames = [];
        const sample = () => {
          const [row] = document.querySelectorAll('.movement.selected');
          const below = [...document.querySelectorAll('.movement')].find(
            (node) => node.textContent.includes('Market') && node.getClientRects().length,
          );
          window.__frames.push({
            panel: Boolean(document.querySelector('.delete-panel')?.getClientRects().length),
            months: Boolean(document.querySelector('.month-area').getClientRects().length),
            row: Boolean(row),
            opacity: row ? Number(getComputedStyle(row).opacity) : null,
            height: row ? row.getBoundingClientRect().height : null,
            below: below?.getBoundingClientRect().top ?? null,
          });
          if (window.__frames.length < 600) window.requestAnimationFrame(sample);
        };
        window.requestAnimationFrame(sample);
      });

      await tapAndWait(page, yes(page));
      await expect.poll(() => descriptions(page, 0)).toEqual(['Petrol', 'Market', 'Market']);
      await page.waitForTimeout(100);

      const frames = await page.evaluate(() => window.__frames);
      const firstFrame = (check, from = 0) => frames.findIndex((f, i) => i >= from && check(f));
      // The months are back and still show the movement, fully visible, with its border.
      const shown = firstFrame((f) => !f.panel && f.months && f.row && f.opacity === 1);
      expect(shown).toBeGreaterThan(-1);
      const fullHeight = frames[shown].height;
      const startTop = frames[shown].below;
      // Then it fades out.
      const fading = firstFrame((f) => f.row && f.opacity > 0 && f.opacity < 1, shown);
      expect(fading).toBeGreaterThan(shown);
      // Then, once it is invisible, it gets shorter, and the Market below moves up bit by bit.
      const shrinking = firstFrame(
        (f) => f.row && f.opacity === 0 && f.height > 0 && f.height < fullHeight - 1,
        fading,
      );
      expect(shrinking).toBeGreaterThan(fading);
      const endTop = frames.at(-1).below;
      expect(endTop).toBeLessThan(startTop - 10);
      expect(
        frames.some(
          (f, i) => i >= shrinking && f.below < startTop - 1 && f.below > endTop + 1 && f.row,
        ),
      ).toBe(true);
      // At the end it is gone.
      expect(frames.at(-1).row).toBe(false);
    });
  });
});

test.describe('in other languages', () => {
  // 21 movements of the same day in October.
  const many = Array.from({ length: 21 }, (_, index) => [
    'Cash',
    sheetDay('2026-10-05'),
    'General',
    `Shop ${index}`,
    -1,
  ]);
  const questions = {
    es: {
      1: '¿Eliminar este movimiento?',
      2: '¿Eliminar 2 movimientos?',
      5: '¿Eliminar 5 movimientos?',
      21: '¿Eliminar 21 movimientos?',
    },
    ru: {
      1: 'Удалить эту операцию?',
      2: 'Удалить 2 операции?',
      5: 'Удалить 5 операций?',
      21: 'Удалить 21 операцию?',
    },
  };

  for (const language of ['es', 'ru']) {
    test(`after picking the "${language}" flag, the question, the buttons and the messages are in that language`, async ({
      page,
    }) => {
      await openMain(page, { movements: many, saves: ['offline'] });
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

      await hold(page, movement(page, 0, 0));
      await expect(remove(page)).toHaveAttribute('aria-label', words.delete);
      let count = 1;
      for (const wanted of [1, 2, 5, 21]) {
        for (; count < wanted; count += 1) await tapAndWait(page, movement(page, 0, count));
        await openPanel(page);
        await expect(question(page)).toHaveText(questions[language][wanted]);
        await expect(no(page)).toHaveText(words.no);
        await expect(yes(page)).toHaveText(words.yes);
        if (wanted < 21) await tapAndWait(page, no(page));
      }

      await tapAndWait(page, yes(page));
      await expect(message(page)).toHaveText(words.notDeleted);
    });
  }

  test('the message about a changed sheet and the Close button are in Spanish too', async ({
    page,
  }) => {
    const { movements } = await openMain(page);
    const picker = page.locator('#main [data-card="language"]');
    await picker.locator('[aria-current="true"]').click();
    await expect.poll(() => locked(page)).toBe(false);
    await picker.locator('[data-language="es"]').click();
    await expect.poll(() => locked(page)).toBe(false);
    await goalCard(page).click();
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
    await tapMonth(page, 0);
    await select(page, 0, [1]);
    movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
    await openPanel(page);

    await tapAndWait(page, yes(page));

    await expect(message(page)).toHaveText(STRINGS.es.sheetChanged);
    await expect(no(page)).toHaveText(STRINGS.es.close);
  });
});

test.describe('the messages of the delete panel, with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  // Writes down every animation that starts in the delete panel: on which button or part.
  const startPanelLog = (page) =>
    page.evaluate(() => {
      window.__panelLog = [];
      document.addEventListener(
        'animationstart',
        ({ target, animationName }) => {
          if (!target.closest?.('.delete-panel')) return;
          const who = target.dataset.card ?? target.classList[0];
          window.__panelLog.push(`${who} ${animationName}`);
        },
        true,
      );
    });
  const panelLog = (page) => page.evaluate(() => window.__panelLog);

  test('when the sheet was changed, Yes sinks away and the message rises in', async ({ page }) => {
    const { movements } = await openGoal(page);
    await tapMonth(page, 0);
    await select(page, 0, [1]);
    movements[2] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
    await openPanel(page);
    await startPanelLog(page);

    await tapAndWait(page, yes(page));

    await expect(yes(page)).toBeHidden();
    expect(await panelLog(page)).toEqual(
      expect.arrayContaining(['yes card-sink', 'delete-message card-rise']),
    );
  });

  test('when Yes fails again, the message stays and does not blink', async ({ page }) => {
    await openGoal(page, { saves: ['offline'] });
    await tapMonth(page, 0);
    await select(page, 0, [1]);
    await openPanel(page);
    await tapAndWait(page, yes(page));
    await expect(message(page)).toBeVisible();
    await startPanelLog(page);

    await tapAndWait(page, yes(page));

    await expect(message(page)).toBeVisible();
    expect(await panelLog(page)).toEqual([]);
  });
});
