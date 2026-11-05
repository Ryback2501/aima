import { test, expect } from '@playwright/test';

import { setUp, sheetDay } from './helpers.js';
import { CARDS, ICON_COLORS } from '../../src/components.js';
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

// The animations made by the app's code or by styles.css that are still playing (not the
// sliding descriptions).
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

  test.describe('on a screen 360 pixels wide', () => {
    test.use({ viewport: { width: 360, height: 740 } });

    // October: €3,456.78 of spending and a salary, so its second amount is the given one.
    // November and December show "--".
    const withSalary = (salary) => ({
      movements: [
        ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -3456.78],
        ['BBVA David', sheetDay('2026-10-05'), 'Salary', 'October pay', salary],
      ],
    });
    // Where the parts of October's header row are, and how its second amount looks.
    const october = (page) =>
      page.evaluate(() => {
        const [first, , last] = document.querySelectorAll('.month');
        const head = first.querySelector('.month-head');
        const box = (node) => node.getBoundingClientRect().toJSON();
        const all = head.querySelector('.month-all');
        const css = getComputedStyle(all);
        return {
          month: box(first),
          head: box(head),
          emptyHead: box(last.querySelector('.month-head')),
          amount: box(head.querySelector('.month-amount')),
          amountSize: parseFloat(getComputedStyle(head.querySelector('.month-amount')).fontSize),
          all: box(all),
          allSize: parseFloat(css.fontSize),
          allColor: css.color,
          cut: all.scrollWidth > all.clientWidth,
          ending: css.textOverflow,
          arrow: box(head.querySelector('.month-arrow')),
          label: head.getAttribute('aria-label'),
        };
      });
    const middle = ({ top, height }) => top + height / 2;

    test('a second amount that fits shows whole, smaller and grey, on one line with the amount and the arrow', async ({
      page,
    }) => {
      await openGoal(page, withSalary(5056.78));

      await tapEye(page);

      await expect(monthAmount(page, 0)).toHaveText('€3,456.78');
      await expect(monthAll(page, 0)).toHaveText('(-€1,600.00)');
      const parts = await october(page);
      expect(parts.cut).toBe(false);
      near(middle(parts.all), middle(parts.amount));
      near(middle(parts.arrow), middle(parts.amount));
      expect(parts.all.left).toBeGreaterThanOrEqual(parts.amount.right);
      expect(parts.arrow.left).toBeGreaterThanOrEqual(parts.all.right);
      expect(parts.allSize).toBe(14);
      expect(parts.amountSize).toBe(18);
      expect(parts.allColor).toBe('rgb(107, 114, 128)');
      near(parts.head.height, parts.emptyHead.height);
    });

    test('a second amount that does not fit ends with "…", and screen readers hear it whole', async ({
      page,
    }) => {
      await openGoal(page, withSalary(1238024.67));

      await tapEye(page);

      await expect(monthAll(page, 0)).toHaveText('(-€1,234,567.89)');
      const parts = await october(page);
      expect(parts.cut).toBe(true);
      expect(parts.ending).toBe('ellipsis');
      near(middle(parts.all), middle(parts.amount));
      expect(parts.arrow.left).toBeGreaterThanOrEqual(parts.all.right);
      expect(parts.arrow.right).toBeLessThanOrEqual(parts.month.right);
      near(parts.head.height, parts.emptyHead.height);
      expect(parts.label).toContain('(-€1,234,567.89)');
    });
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

test('with "reduce motion", showing and hiding happen at once', async ({ page }) => {
  await openGoal(page);
  await tapMonth(page, 0);

  await eye(page).click();
  expect(await playing(page)).toBe(0);
  await expect.poll(() => descriptions(page, 0)).toHaveLength(4);
  expect(await movement(page, 0, 0).evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
  expect(await monthAll(page, 0).evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
  await expect.poll(() => locked(page)).toBe(false);

  await eye(page).click();
  expect(await playing(page)).toBe(0);
  await expect.poll(() => descriptions(page, 0)).toHaveLength(2);
  await expect.poll(() => locked(page)).toBe(false);
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  // On every frame: the fund's row (how visible and how tall), where Cinema below it is, how
  // tall October is, and how visible its second amount is.
  const startFrames = (page) =>
    page.evaluate(() => {
      window.__frames = [];
      const sample = () => {
        const rows = [...document.querySelectorAll('.movement')];
        const fund = rows.find((node) => node.textContent.includes('Fund'));
        const cinema = rows.find((node) => node.textContent.includes('Cinema'));
        const shown = fund?.getClientRects().length;
        const all = document.querySelector('.month-all');
        window.__frames.push({
          row: Boolean(shown),
          opacity: shown ? Number(getComputedStyle(fund).opacity) : null,
          height: shown ? fund.getBoundingClientRect().height : null,
          below: cinema.getBoundingClientRect().top,
          month: document.querySelector('.month').getBoundingClientRect().height,
          all: all.getClientRects().length ? Number(getComputedStyle(all).opacity) : 0,
        });
        if (window.__frames.length < 600) window.requestAnimationFrame(sample);
      };
      window.requestAnimationFrame(sample);
    });
  const framesOf = (page) => page.evaluate(() => window.__frames);

  test('the eye button rises in and sinks away together with the back button', async ({ page }) => {
    await openMain(page);
    await page.evaluate(() => {
      window.__rises = [];
      document.addEventListener(
        'animationstart',
        ({ target, animationName }) => {
          if (['back', 'eye'].includes(target.id)) {
            window.__rises.push(`${target.id} ${animationName}`);
          }
        },
        true,
      );
    });

    await openGoalCard(page);
    await tapAndWait(page, back(page));

    expect(await page.evaluate(() => window.__rises)).toEqual(
      expect.arrayContaining([
        'back card-rise',
        'eye card-rise',
        'back card-sink',
        'eye card-sink',
      ]),
    );
  });

  test('showing: the movements below make room, then the left-out movements and the second amounts fade in', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await startFrames(page);

    await tapEye(page);
    await page.waitForTimeout(100);

    const frames = await framesOf(page);
    const firstFrame = (check, from = 0) => frames.findIndex((f, i) => i >= from && check(f));
    const fullHeight = frames.at(-1).height;
    const startBelow = frames[0].below;
    const startMonth = frames[0].month;
    // First the fund grows while still invisible, and Cinema moves down bit by bit.
    const growing = firstFrame((f) => f.row && f.opacity === 0 && f.height > 1);
    expect(growing).toBeGreaterThan(-1);
    expect(
      frames.some(
        (f) => f.row && f.opacity === 0 && f.height < fullHeight - 1 && f.below > startBelow + 1,
      ),
    ).toBe(true);
    // Then, at its full height, it fades in.
    const fading = firstFrame((f) => f.row && f.opacity > 0 && f.opacity < 1, growing);
    expect(fading).toBeGreaterThan(growing);
    near(frames[fading].height, fullHeight);
    // The second amount fades in too.
    expect(frames.some((f) => f.all > 0 && f.all < 1)).toBe(true);
    // At the end everything shows, and October is taller.
    expect(frames.at(-1).opacity).toBe(1);
    expect(frames.at(-1).all).toBe(1);
    expect(frames.at(-1).month).toBeGreaterThan(startMonth + 10);
  });

  test('hiding: they fade out, then the movements below move up and the month gets shorter', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await tapEye(page);
    await startFrames(page);

    await tapEye(page);
    await page.waitForTimeout(100);

    const frames = await framesOf(page);
    const firstFrame = (check, from = 0) => frames.findIndex((f, i) => i >= from && check(f));
    const fullHeight = frames[0].height;
    const startBelow = frames[0].below;
    const startMonth = frames[0].month;
    // First the fund fades out, at its full height, and so does the second amount.
    const fading = firstFrame((f) => f.row && f.opacity > 0 && f.opacity < 1);
    expect(fading).toBeGreaterThan(-1);
    near(frames[fading].height, fullHeight);
    expect(frames.some((f) => f.all > 0 && f.all < 1)).toBe(true);
    // Then, invisible, it gets shorter, while Cinema moves up and October gets shorter.
    const shrinking = firstFrame(
      (f) => f.row && f.opacity === 0 && f.height > 1 && f.height < fullHeight - 1,
      fading,
    );
    expect(shrinking).toBeGreaterThan(fading);
    const endBelow = frames.at(-1).below;
    const endMonth = frames.at(-1).month;
    expect(endBelow).toBeLessThan(startBelow - 10);
    expect(endMonth).toBeLessThan(startMonth - 10);
    expect(
      frames.some(
        (f, i) => i >= shrinking && f.row && f.month < startMonth - 1 && f.month > endMonth + 1,
      ),
    ).toBe(true);
    // At the end it is gone.
    expect(frames.at(-1).row).toBe(false);
    expect(frames.at(-1).all).toBe(0);
  });
});

test.describe('in other languages', () => {
  for (const language of ['es', 'ru']) {
    test(`after picking the "${language}" flag, the eye button's name is in that language`, async ({
      page,
    }) => {
      await openMain(page);
      const picker = page.locator('#main [data-card="language"]');
      await picker.locator('[aria-current="true"]').click();
      await expect.poll(() => locked(page)).toBe(false);
      await picker.locator(`[data-language="${language}"]`).click();
      await expect.poll(() => locked(page)).toBe(false);
      await openGoalCard(page);

      await expect(eye(page)).toHaveAttribute('aria-label', STRINGS[language].showLeftOut);
    });
  }
});

test.describe('deleting the last counted movement of a month that has left-out ones, with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  // November has Petrol, and a salary that the goal leaves out.
  const withNovemberPay = () => ({
    movements: [
      ...movementRows().slice(0, 6),
      ['BBVA David', sheetDay('2026-11-10'), 'Salary', 'November pay', 2500],
      movementRows()[6],
    ],
  });

  // Writes down which months rise in from now on (0 is the top one).
  const startRiseLog = (page) =>
    page.evaluate(() => {
      window.__monthRises = [];
      document.addEventListener(
        'animationstart',
        ({ target, animationName }) => {
          if (target.classList.contains('month') && animationName === 'card-rise') {
            window.__monthRises.push([...document.querySelectorAll('.month')].indexOf(target));
          }
        },
        true,
      );
    });
  const monthRises = (page) => page.evaluate(() => window.__monthRises);

  // Selects Petrol in the open November, and deletes it.
  async function deletePetrol(page) {
    await hold(page, month(page, 1).locator('.movement', { hasText: 'Petrol' }));
    await tapAndWait(page, remove(page));
    await expect(panel(page)).toBeVisible();
    await startRiseLog(page);
    await tapAndWait(page, yes(page));
    await expect(panel(page)).toBeHidden();
    await expect(monthAmount(page, 1)).toHaveText('--');
    await page.waitForTimeout(500);
  }

  test('with the eye off, the month shows "--" and the months rise in only once', async ({
    page,
  }) => {
    await openGoal(page, withNovemberPay());
    await tapMonth(page, 1);

    await deletePetrol(page);

    await expect(monthHead(page, 1)).toBeDisabled();
    // Each month rises in once, when the panel goes and the months come back, and not again.
    expect((await monthRises(page)).sort()).toEqual([0, 1, 2]);
  });

  test('with the eye on, the second amount of the month fades out', async ({ page }) => {
    await openGoal(page, withNovemberPay());
    await tapEye(page);
    await tapMonth(page, 1);
    await expect(monthAll(page, 1)).toHaveText('(-€2,460.00)');
    // On every frame: the text of November's second amount, and how visible it is.
    await page.evaluate(() => {
      window.__allFrames = [];
      const sample = () => {
        const all = document.querySelectorAll('.month-all')[1];
        window.__allFrames.push({
          text: all.textContent,
          opacity: Number(getComputedStyle(all).opacity),
        });
        if (window.__allFrames.length < 600) window.requestAnimationFrame(sample);
      };
      window.requestAnimationFrame(sample);
    });

    await deletePetrol(page);

    const frames = await page.evaluate(() => window.__allFrames);
    expect(
      frames.some(({ text, opacity }) => text === '(-€2,460.00)' && opacity > 0 && opacity < 1),
    ).toBe(true);
    expect(frames.at(-1).opacity).toBe(0);
  });

  test('with the eye on, the month closes and shows "--", and the months rise in only once', async ({
    page,
  }) => {
    await openGoal(page, withNovemberPay());
    await tapEye(page);
    await tapMonth(page, 1);
    await expect.poll(() => descriptions(page, 1)).toEqual(['November pay', 'Petrol']);

    await deletePetrol(page);

    await expect(monthHead(page, 1)).toBeDisabled();
    await expect(month(page, 1)).not.toHaveClass(/\bopen\b/);
    await expect(month(page, 1).locator('.month-list')).toBeHidden();
    // Each month rises in once, when the panel goes and the months come back, and not again.
    expect((await monthRises(page)).sort()).toEqual([0, 1, 2]);
  });
});

test.describe('the icons of the movements the goal leaves out (issue #117)', () => {
  // October has one movement of each left-out kind, and a counted Car movement.
  const october = [
    ['BBVA David', sheetDay('2026-10-02'), 'Salary', 'October pay', 2500],
    ['BBVA David', sheetDay('2026-10-03'), 'Mortgage', 'October loan', -700],
    ['BBVA David', sheetDay('2026-10-04'), 'Credit Cards', 'Cards in October', -843.12],
    ['Cash', sheetDay('2026-10-05'), 'Whitening', 'Whitening', -300],
    ['BBVA David', sheetDay('2026-10-06'), 'House', 'Luz - Endesa', -60],
    ['BBVA David', sheetDay('2026-10-07'), 'Investing', 'Fund', -300],
    ['Cash', sheetDay('2026-10-08'), 'Car', 'Petrol', -40],
  ];
  const rgb = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${r}, ${g}, ${b})`;
  };

  test('each one shows its own drawing and color, on a soft background of that color', async ({
    page,
  }) => {
    await openGoal(page, { movements: october });
    await tapMonth(page, 0);
    await tapEye(page);

    const expected = [
      ['October pay', 'sackInHand', '#65a30d'],
      ['October loan', 'housePie', '#c47d4a'],
      ['Cards in October', 'billTransfer', '#1296d6'],
      ['Whitening', 'pumpSoap', '#b06ad9'],
      ['Luz - Endesa', 'house', ICON_COLORS.house],
      ['Fund', 'investing', ICON_COLORS.investing],
      ['Petrol', 'car', ICON_COLORS.car],
    ];
    for (const [description, icon, color] of expected) {
      const row = month(page, 0).locator('.movement', { hasText: description });
      // The first drawing of a movement is its kind; the last one is where the money came from.
      const drawing = row.locator('svg').first();
      await expect(drawing.locator('path')).toHaveAttribute('d', ICONS[icon].path);
      expect(await drawing.evaluate((node) => getComputedStyle(node).fill)).toBe(rgb(color));
      // The soft shape behind it: 8% of the icon's color, the rest white.
      const channels = await row.evaluate((node) => {
        const css = getComputedStyle(node, '::before').backgroundColor;
        const parts = css
          .match(/[\d.]+/g)
          .map(Number)
          .slice(0, 3);
        // Chromium writes a mixed color as color(srgb 0-1 0-1 0-1), other colors as rgb(0-255).
        return css.startsWith('color(') ? parts.map((part) => part * 255) : parts;
      });
      const light = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) * 0.08 + 255 * 0.92);
      channels.forEach((channel, i) =>
        expect(Math.abs(channel - light[i]), description).toBeLessThan(1.5),
      );
    }
  });
});
