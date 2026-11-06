import { test, expect } from '@playwright/test';

import { setUp, sheetDay } from './helpers.js';

// Selecting movements in the open goal card (issue #109).

const signInButton = (page) => page.locator('#sign-in');
const goalCard = (page) => page.locator('#main [data-card="goal"]');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const form = (page) => page.locator('.movement-form');
const month = (page, index) => page.locator('.month').nth(index);
const movement = (page, monthIndex, index) =>
  month(page, monthIndex).locator('.movement').nth(index);
const selected = (page) => page.locator('.movement.selected');

// True while the app ignores taps, because an animation is playing.
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

// October has movements on two days; November has none; December has one.
const movements = [
  ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -100],
  ['Cash', sheetDay('2026-10-03'), 'Car', 'Petrol', -45.2],
  ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -10],
  ['Cash', sheetDay('2026-12-02'), 'General', 'Bakery', -6],
];

const LONG =
  'Weekly shopping at the big supermarket in the mall, with extra bags for the whole family';

async function openGoal(page, options = {}) {
  await setUp(page, { canEdit: true, movements, ...options });
  await page.goto('./');
  await signInButton(page).click();
  await expect(page.locator('#total-value')).toHaveText(/\d/);
  await expect.poll(() => locked(page)).toBe(false);
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
}

async function tapMonth(page, index) {
  await month(page, index).locator('.month-head').click();
  await expect.poll(() => locked(page)).toBe(false);
}

// The phone tests use a finger, the computer tests the mouse.
const usesTouch = () => Boolean(test.info().project.use.hasTouch);

// A finger on the screen, through the browser's own touch input, so the browser scrolls and
// shows its menus as it would on a phone.
const fingers = new WeakMap();
function finger(page) {
  if (!fingers.has(page)) fingers.set(page, page.context().newCDPSession(page));
  const session = fingers.get(page);
  const send = async (type, points) =>
    (await session).send('Input.dispatchTouchEvent', { type, touchPoints: points });
  return {
    down: (x, y) => send('touchStart', [{ x, y }]),
    move: (x, y) => send('touchMove', [{ x, y }]),
    up: () => send('touchEnd', []),
  };
}

const centerOf = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// Puts a finger (or the mouse button) down on a movement, and returns how to lift it.
async function pressOn(page, locator, { touch = usesTouch() } = {}) {
  const { x, y } = await centerOf(locator);
  if (touch) {
    await finger(page).down(x, y);
    return () => finger(page).up();
  }
  await page.mouse.move(x, y);
  await page.mouse.down();
  return () => page.mouse.up();
}

// Keeps a finger (or the mouse button) on a movement for a while, then lifts it.
async function hold(page, locator, milliseconds = 700, options) {
  const lift = await pressOn(page, locator, options);
  await page.waitForTimeout(milliseconds);
  await lift();
}

const tap = (locator) => (usesTouch() ? locator.tap() : locator.click());

// The blue-to-purple border of a selected movement, as the browser writes its colors.
const BLUE = 'rgb(96, 165, 250)';
const PURPLE = 'rgb(167, 139, 250)';
// The border of a movement: its colors, its width, and how visible it is now.
const borderOf = (locator) =>
  locator.evaluate((node) => {
    const css = getComputedStyle(node, '::after');
    return {
      image: css.backgroundImage,
      width: css.borderTopWidth,
      opacity: Number(css.opacity),
    };
  });
// The fades of a movement's border that are playing now: their length in milliseconds.
const borderFades = (locator) =>
  locator.evaluate((node) =>
    node
      .getAnimations({ subtree: true })
      .filter(
        (animation) =>
          animation.effect.pseudoElement === '::after' &&
          animation.transitionProperty === 'opacity',
      )
      .map((animation) => animation.effect.getComputedTiming().duration),
  );

test.describe('selecting movements', () => {
  test('a person who can only view the sheet cannot select a movement @both-screens', async ({
    page,
  }) => {
    await openGoal(page, { canEdit: false });
    await tapMonth(page, 0);

    await hold(page, movement(page, 0, 0));

    await expect(selected(page)).toHaveCount(0);
  });

  test('a finger kept on a movement for half a second selects it, with no menu and no text selection', async ({
    page,
  }) => {
    test.skip(!usesTouch(), 'a finger is only used on the phone');
    await openGoal(page);
    await tapMonth(page, 0);
    // Writes down whether the browser's own long-press menu was allowed to open.
    await page.evaluate(() => {
      window.__menus = [];
      window.addEventListener('contextmenu', (event) =>
        window.__menus.push(event.defaultPrevented),
      );
    });

    const lift = await pressOn(page, movement(page, 0, 0));
    // Before half a second, nothing is selected yet.
    await page.waitForTimeout(250);
    await expect(selected(page)).toHaveCount(0);
    // After it, the movement is selected while the finger is still down.
    await expect(movement(page, 0, 0)).toHaveClass(/\bselected\b/, { timeout: 600 });
    await lift();

    await expect(selected(page)).toHaveCount(1);
    await expect(movement(page, 0, 0)).toHaveClass(/\bselected\b/);
    expect(await page.evaluate(() => window.__menus.every((prevented) => prevented))).toBe(true);
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('');
    // The text of a movement can never be selected, and a long press never opens a menu on it.
    expect(
      await movement(page, 0, 0)
        .locator('.description-text')
        .evaluate((node) => getComputedStyle(node).userSelect),
    ).toBe('none');
    expect(
      await movement(page, 0, 1).evaluate(
        (node) =>
          !node.dispatchEvent(
            new window.MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              composed: true,
            }),
          ),
      ),
    ).toBe(true);
  });

  test('a selected movement gets the blue-to-purple border of a field in use @both-screens', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    expect((await borderOf(movement(page, 0, 0))).opacity).toBe(0);

    await hold(page, movement(page, 0, 0));

    const border = await borderOf(movement(page, 0, 0));
    expect(border.image).toContain(BLUE);
    expect(border.image).toContain(PURPLE);
    // As wide as the border of a form field.
    expect(border.width).toBe('3px');
    expect(border.opacity).toBe(1);
    // The other movements have no border.
    expect((await borderOf(movement(page, 0, 1))).opacity).toBe(0);
  });

  test('a short press, or a tap with nothing selected, selects nothing @both-screens', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);

    await hold(page, movement(page, 0, 0), 250);
    await expect(selected(page)).toHaveCount(0);

    await tap(movement(page, 0, 1));
    // Longer than the half second, so a late selection would show.
    await page.waitForTimeout(700);
    await expect(selected(page)).toHaveCount(0);
  });

  test('a finger that slides up more than 10 pixels scrolls the list and selects nothing', async ({
    page,
  }) => {
    test.skip(!usesTouch(), 'a finger is only used on the phone');
    // Enough movements in October for its list to scroll.
    const many = Array.from({ length: 20 }, (_, index) => [
      'Cash',
      sheetDay('2026-10-01') + index,
      'General',
      `Shop ${index}`,
      -1,
    ]);
    await openGoal(page, { movements: many });
    await tapMonth(page, 0);
    const list = month(page, 0).locator('.month-list');

    const { x, y } = await centerOf(movement(page, 0, 3));
    await finger(page).down(x, y);
    for (let step = 1; step <= 8; step += 1) {
      await finger(page).move(x, y - step * 8);
      await page.waitForTimeout(16);
    }
    // The finger stays down past the half second.
    await page.waitForTimeout(600);
    await finger(page).up();

    expect(await list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect(selected(page)).toHaveCount(0);
  });

  test('on a computer, holding the mouse button for half a second selects a movement @both-screens', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);

    const lift = await pressOn(page, movement(page, 0, 2), { touch: false });
    await page.waitForTimeout(250);
    await expect(selected(page)).toHaveCount(0);
    await expect(movement(page, 0, 2)).toHaveClass(/\bselected\b/, { timeout: 600 });
    await lift();

    await expect(selected(page)).toHaveCount(1);
    await expect(movement(page, 0, 2)).toHaveClass(/\bselected\b/);
  });

  test('with one selected, taps select movements of other days and months, and a tap unselects one @both-screens', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);

    await hold(page, movement(page, 0, 0));
    // Another movement of October, on another day.
    await tap(movement(page, 0, 2));
    await tapMonth(page, 2);
    await tap(movement(page, 2, 0));

    await expect(selected(page)).toHaveCount(3);
    await expect(movement(page, 2, 0)).toHaveClass(/\bselected\b/);

    await tap(movement(page, 2, 0));
    await expect(selected(page)).toHaveCount(2);
    await expect(movement(page, 2, 0)).not.toHaveClass(/\bselected\b/);
    await expect(movement(page, 0, 0)).toHaveClass(/\bselected\b/);
    await expect(movement(page, 0, 2)).toHaveClass(/\bselected\b/);
  });

  test('closing a month and opening it again keeps its movements selected @both-screens', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await hold(page, movement(page, 0, 0));
    await tap(movement(page, 0, 1));

    await tapMonth(page, 0);
    await tapMonth(page, 0);

    await expect(selected(page)).toHaveCount(2);
    await expect(movement(page, 0, 0)).toHaveClass(/\bselected\b/);
    await expect(movement(page, 0, 1)).toHaveClass(/\bselected\b/);
  });

  test('"+" opens the form as before, and after Cancel nothing is selected @both-screens', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await hold(page, movement(page, 0, 0));
    await expect(selected(page)).toHaveCount(1);

    await add(page).click();
    await expect(form(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
    await form(page).locator('[data-card="cancel"]').click();
    await expect(form(page)).toBeHidden();
    await expect.poll(() => locked(page)).toBe(false);

    await expect(selected(page)).toHaveCount(0);
  });

  test('back closes the card as before, and when it opens again nothing is selected @both-screens', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);
    await hold(page, movement(page, 0, 0));
    await tap(movement(page, 0, 1));

    await expect(selected(page)).toHaveCount(2);
    await back(page).click();
    await expect(page.locator('#backdrop')).toBeHidden();
    await expect.poll(() => locked(page)).toBe(false);
    await goalCard(page).click();
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
    await tapMonth(page, 0);

    await expect(selected(page)).toHaveCount(0);
  });

  test('with "reduce motion", the border appears and disappears at once @both-screens', async ({
    page,
  }) => {
    await openGoal(page);
    await tapMonth(page, 0);

    await hold(page, movement(page, 0, 0));
    expect(await borderFades(movement(page, 0, 0))).toEqual([]);
    expect((await borderOf(movement(page, 0, 0))).opacity).toBe(1);

    await tap(movement(page, 0, 0));
    expect(await borderFades(movement(page, 0, 0))).toEqual([]);
    expect((await borderOf(movement(page, 0, 0))).opacity).toBe(0);
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('the border fades in and out in a quarter of a second, like the pills @both-screens', async ({
      page,
    }) => {
      await openGoal(page);
      await tapMonth(page, 0);

      // The fade starts at half a second, so it is checked while the finger is still down.
      const lift = await pressOn(page, movement(page, 0, 0));
      // Checked on every frame, so the check is not late.
      await page.waitForFunction(() => document.querySelector('.movement.selected'), null, {
        timeout: 1000,
      });
      expect(await borderFades(movement(page, 0, 0))).toEqual([250]);
      await lift();
      await expect.poll(() => borderOf(movement(page, 0, 0)).then((b) => b.opacity)).toBe(1);

      await tap(movement(page, 0, 0));
      expect(await borderFades(movement(page, 0, 0))).toEqual([250]);
      await expect.poll(() => borderOf(movement(page, 0, 0)).then((b) => b.opacity)).toBe(0);
    });

    test('a long description that slides keeps sliding when its movement is selected @both-screens', async ({
      page,
    }) => {
      await openGoal(page, {
        movements: [
          ['Cash', sheetDay('2026-10-04'), 'General', LONG, -4],
          ['Cash', sheetDay('2026-10-03'), 'General', 'Bread', -2],
        ],
      });
      await month(page, 0).locator('.month-head').click();
      await expect.poll(() => locked(page), { timeout: 1500 }).toBe(false);
      // The newest day comes first: the long description is the first movement.
      const long = movement(page, 0, 0);
      // Remembers the sliding of the long description.
      await long.locator('.description-track').evaluate((track) => {
        window.__sliding = track.getAnimations()[0];
      });
      expect(await page.evaluate(() => window.__sliding?.playState)).toBe('running');
      const before = await page.evaluate(() => window.__sliding.currentTime);

      await hold(page, long.locator('.movement-description'));

      await expect(long).toHaveClass(/\bselected\b/);
      // The same sliding, still running and further along.
      expect(
        await long
          .locator('.description-track')
          .evaluate((track) => track.getAnimations()[0] === window.__sliding),
      ).toBe(true);
      expect(await page.evaluate(() => window.__sliding.playState)).toBe('running');
      expect(await page.evaluate(() => window.__sliding.currentTime)).toBeGreaterThan(before);
    });
  });
});
