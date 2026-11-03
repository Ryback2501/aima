import { test, expect } from '@playwright/test';

import { setUp, FAKE_TOTAL, FAKE_SOURCES, FAKE_CATEGORIES } from './helpers.js';
import { CARDS } from '../../src/components.js';
import { ICONS } from '../../src/icons.js';
import { STRINGS } from '../../src/i18n.js';

// The "+" button and the new movement form (issue #99).

const signInButton = (page) => page.locator('#sign-in');
const goalCard = (page) => page.locator('#main [data-card="goal"]');
const totalCard = (page) => page.locator('#main [data-card="total"]');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const form = (page) => page.locator('.movement-form');
const field = (page, name) => form(page).getByLabel(STRINGS.en[name], { exact: true });
// The light grey box around a field: it gets the gradient border while the field is used.
const fieldBox = (page, name) =>
  field(page, name).locator('xpath=ancestor::*[@class="field-box"][1]');
const cancel = (page) => form(page).locator('[data-card="cancel"]');
const sign = (page) => form(page).locator('.sign-switch');

// True while the app ignores taps, because an animation is playing.
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);
const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1);

async function openMain(page, options = {}) {
  const requests = await setUp(page, { canEdit: true, ...options });
  await page.goto('./');
  await signInButton(page).click();
  await expect(page.locator('#total-value')).toHaveText(/\d/);
  await expect.poll(() => locked(page)).toBe(false);
  return requests;
}

async function openGoal(page, options = {}) {
  const requests = await openMain(page, options);
  await goalCard(page).click();
  await expect(back(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  return requests;
}

async function openForm(page, options = {}) {
  const requests = await openGoal(page, options);
  await add(page).click();
  await expect(form(page)).toBeVisible();
  await expect.poll(() => locked(page)).toBe(false);
  return requests;
}

// The gradient colors of the border around the field being used, as the browser writes them.
const BLUE = 'rgb(96, 165, 250)';
const PURPLE = 'rgb(167, 139, 250)';
const backgroundOf = (locator) =>
  locator.evaluate((node) => getComputedStyle(node).backgroundImage);

// Writes down every animation that starts or ends on the back and "+" buttons, the months
// (month0 is the top one) and the form: which one, which animation, and when.
const startAnimationLog = (page) =>
  page.evaluate(() => {
    window.__animationLog = [];
    const nameOf = (node) => {
      if (node.id === 'back' || node.id === 'add') return node.id;
      if (node.classList.contains('movement-form')) return 'form';
      if (node.classList.contains('month')) {
        return `month${[...document.querySelectorAll('.month')].indexOf(node)}`;
      }
      return null;
    };
    for (const type of ['animationstart', 'animationend']) {
      document.addEventListener(
        type,
        (event) => {
          const who = nameOf(event.target);
          if (!who) return;
          const step = type === 'animationstart' ? 'start' : 'end';
          window.__animationLog.push({
            who,
            step,
            name: event.animationName,
            time: window.performance.now(),
          });
        },
        true,
      );
    }
  });
const animationLog = (page) => page.evaluate(() => window.__animationLog);
// The moment an animation started or ended, from the log.
const momentOf = (log, who, step, name) =>
  log.find((entry) => entry.who === who && entry.step === step && entry.name === name)?.time;

test.describe('the "+" button', () => {
  test('a person who can edit sees it at the bottom, in the middle, like the back button', async ({
    page,
  }) => {
    await openGoal(page);

    await expect(add(page)).toBeVisible();
    const plus = await add(page).boundingBox();
    const arrow = await back(page).boundingBox();
    const screen = page.viewportSize();
    near(plus.x + plus.width / 2, screen.width / 2);
    near(plus.y + plus.height, arrow.y + arrow.height);
    near(plus.width, arrow.width);
    near(plus.height, arrow.height);
    const look = (locator) =>
      locator.evaluate((node) => {
        const css = getComputedStyle(node);
        return [css.borderTopWidth, css.borderTopLeftRadius, css.boxShadow];
      });
    expect(await look(add(page))).toEqual(await look(back(page)));
    // A "+" icon as big as the back arrow.
    const icon = add(page).locator('[data-icon="plus"] svg');
    await expect(icon.locator('path')).toHaveAttribute('d', ICONS.plus.path);
    await expect(icon).toHaveAttribute('width', '24');
    await expect(back(page).locator('svg')).toHaveAttribute('width', '24');
    // Its border goes from a middle blue to a light blue.
    expect(CARDS.add.colors).toEqual(['#3b82f6', '#93c5fd']);
    expect(await add(page).evaluate((node) => node.style.getPropertyValue('--label-border'))).toBe(
      'linear-gradient(to bottom right, #3b82f6, #93c5fd)',
    );
  });

  test('a person who can only view the sheet does not see it', async ({ page }) => {
    await openGoal(page, { canEdit: false });

    await expect(add(page)).toBeHidden();
    await expect(page.locator('.month')).toHaveCount(3);
  });

  test('when the app cannot ask Google if the person can edit, there is no "+"', async ({
    page,
  }) => {
    await openGoal(page, { canEdit: 'offline' });

    await expect(add(page)).toBeHidden();
    await expect(page.locator('.month')).toHaveCount(3);
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
  });

  test('it is not on the main screen, nor in the open Total card', async ({ page }) => {
    await openMain(page);

    await expect(add(page)).toBeHidden();

    await totalCard(page).click();
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);

    await expect(add(page)).toBeHidden();
  });

  test('it goes away when the goal card closes, and comes back when it opens again', async ({
    page,
  }) => {
    await openGoal(page);

    await back(page).click();
    await expect(back(page)).toBeHidden();
    await expect(add(page)).toBeHidden();

    await goalCard(page).click();
    await expect(add(page)).toBeVisible();
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    const delayOf = (locator) =>
      locator.evaluate((node) => {
        const css = getComputedStyle(node);
        return `${css.animationName} ${css.animationDelay}`;
      });

    test('it rises in and sinks away together with the back button', async ({ page }) => {
      await openMain(page);

      await goalCard(page).click();
      await expect(back(page)).toBeVisible();
      const rise = await delayOf(back(page));
      expect(rise).toMatch(/^card-rise /);
      expect(await delayOf(add(page))).toBe(rise);
      await expect.poll(() => locked(page)).toBe(false);

      await back(page).click();

      expect(await delayOf(back(page))).toBe('card-sink 0s');
      expect(await delayOf(add(page))).toBe('card-sink 0s');
      await expect(page.locator('#backdrop')).toBeHidden();
      await expect(add(page)).toBeHidden();
    });
  });
});

test.describe('the new movement form', () => {
  test('a tap on "+" opens it inside the goal card, in place of the months', async ({ page }) => {
    await openForm(page);

    expect(
      await goalCard(page).evaluate((card) =>
        card.contains(document.querySelector('.movement-form')),
      ),
    ).toBe(true);
    const number = await page.locator('#goal-value').boundingBox();
    const panel = await form(page).boundingBox();
    expect(panel.y).toBeGreaterThan(number.y + number.height);
    await expect(page.locator('#goal-value')).toBeVisible();
    await expect(page.locator('.month-area')).toBeHidden();
    await expect(form(page).locator('.movement-form-title')).toHaveText('New movement');
    for (const name of ['source', 'date', 'category', 'concept', 'amount']) {
      await expect(field(page, name)).toBeVisible();
    }
    await expect(cancel(page)).toHaveText('Cancel');
    // The back and "+" buttons are hidden while the form is open.
    await expect(back(page)).toBeHidden();
    await expect(add(page)).toBeHidden();
  });

  test('a tap on "+" before the goal card closed does not open the form after it opens again', async ({
    page,
  }) => {
    await setUp(page, { canEdit: true });
    // The lists answer only when the test says so.
    let answer;
    const held = new Promise((done) => (answer = done));
    await page.route(
      (url) => url.hostname === 'sheets.googleapis.com' && url.searchParams.has('fields'),
      async (route) => {
        await held;
        await route.fallback();
      },
    );
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(/\d/);
    await expect.poll(() => locked(page)).toBe(false);
    await goalCard(page).click();
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
    await add(page).click();
    await back(page).click();
    await expect(back(page)).toBeHidden();
    await expect.poll(() => locked(page)).toBe(false);
    await goalCard(page).click();
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);

    answer();
    await page.waitForLoadState('networkidle');

    await expect(form(page)).toBeHidden();
    await expect(page.locator('.month')).toHaveCount(3);
    // A new tap opens it.
    await add(page).click();
    await expect(form(page)).toBeVisible();
  });

  test('Source offers the options of the sheet dropdown, in order, and starts empty', async ({
    page,
  }) => {
    await openForm(page);

    const source = field(page, 'source');
    // A list to pick from: nothing can be typed in it.
    expect(await source.evaluate((node) => node.tagName)).toBe('SELECT');
    await expect(source).toHaveValue('');
    const options = await source
      .locator('option')
      .evaluateAll((nodes) => nodes.filter((node) => node.value !== '').map((node) => node.value));
    expect(options).toEqual(FAKE_SOURCES);

    await source.selectOption('Después');
    await expect(source).toHaveValue('Después');
  });

  test('Category offers the options of the sheet dropdown (from its cells), and starts empty', async ({
    page,
  }) => {
    await openForm(page);

    const category = field(page, 'category');
    expect(await category.evaluate((node) => node.tagName)).toBe('SELECT');
    await expect(category).toHaveValue('');
    const options = await category
      .locator('option')
      .evaluateAll((nodes) => nodes.filter((node) => node.value !== '').map((node) => node.value));
    expect(options).toEqual(FAKE_CATEGORIES);
  });

  test('Date starts at today, and any day can be chosen, with no time', async ({ page }) => {
    await openForm(page);

    const date = field(page, 'date');
    await expect(date).toHaveAttribute('type', 'date');
    const today = await page.evaluate(() => {
      const now = new Date();
      const two = (value) => String(value).padStart(2, '0');
      return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
    });
    await expect(date).toHaveValue(today);

    await date.fill('2031-02-14');
    await expect(date).toHaveValue('2031-02-14');
    await date.fill('1999-07-03');
    await expect(date).toHaveValue('1999-07-03');
  });

  test('Concept takes any characters, up to 50', async ({ page }) => {
    await openForm(page);
    const concept = field(page, 'concept');

    await concept.click();
    await page.keyboard.type('Pan de leña, ¿vale? 100% ñandú €');
    await expect(concept).toHaveValue('Pan de leña, ¿vale? 100% ñandú €');

    await concept.fill('');
    await page.keyboard.type('a'.repeat(60));
    await expect(concept).toHaveValue('a'.repeat(50));

    // A longer text that arrives at once (like a paste) keeps its first 50 characters.
    await concept.fill('');
    await page.keyboard.insertText('b'.repeat(70));
    await expect(concept).toHaveValue('b'.repeat(50));
  });

  test('Concept is always one line: Enter adds nothing, and line breaks become spaces', async ({
    page,
  }) => {
    await openForm(page);
    const concept = field(page, 'concept');

    await concept.click();
    await page.keyboard.type('Bakery');
    await page.keyboard.press('Enter');
    await expect(concept).toHaveValue('Bakery');

    await concept.fill('');
    await page.keyboard.insertText('Bread\nand\r\nmilk');
    await expect(concept).toHaveValue('Bread and milk');
  });

  test('a long concept wraps and the field grows taller; shorter again after deleting', async ({
    page,
  }) => {
    await openForm(page);
    const concept = field(page, 'concept');
    const height = async () => (await concept.boundingBox()).height;
    const oneLine = await height();

    await concept.fill('Weekly shopping at the big market, extra bags too');

    expect(await height()).toBeGreaterThan(oneLine + 5);
    // All the text shows: nothing is hidden behind a scroll bar.
    expect(await concept.evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true);

    await concept.fill('Bakery');

    near(await height(), oneLine);
  });

  test('Amount has a "− / +" switch on its left, set to "−"', async ({ page }) => {
    await openForm(page);
    const amount = field(page, 'amount');

    // The switch is left of the amount, and starts on "−".
    const switchBox = await sign(page).boundingBox();
    expect(switchBox.x + switchBox.width).toBeLessThanOrEqual((await amount.boundingBox()).x);
    await expect(sign(page)).toHaveAttribute('data-sign', 'minus');
    await expect(sign(page).locator('.chosen')).toHaveText('−');

    await sign(page).click();
    await expect(sign(page)).toHaveAttribute('data-sign', 'plus');
    await expect(sign(page).locator('.chosen')).toHaveText('+');

    await sign(page).click();
    await expect(sign(page)).toHaveAttribute('data-sign', 'minus');
  });

  test('the field being used gets the blue-to-purple border, and it moves with the focus', async ({
    page,
  }) => {
    await openForm(page);

    await field(page, 'concept').click();
    expect(await backgroundOf(fieldBox(page, 'concept'))).toContain(BLUE);
    expect(await backgroundOf(fieldBox(page, 'concept'))).toContain(PURPLE);

    await field(page, 'amount').click();
    expect(await backgroundOf(fieldBox(page, 'amount'))).toContain(PURPLE);
    expect(await backgroundOf(fieldBox(page, 'concept'))).not.toContain(PURPLE);
  });

  test('it has the look of the preview: grey panel with white border, grey boxes, red Cancel', async ({
    page,
  }) => {
    await openForm(page);

    const panel = await form(page).evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        background: css.backgroundColor,
        border: `${css.borderTopWidth} ${css.borderTopStyle} ${css.borderTopColor}`,
        round: parseFloat(css.borderTopLeftRadius) > 0,
        shadow: css.boxShadow !== 'none',
      };
    });
    expect(panel).toEqual({
      background: 'rgb(245, 246, 248)',
      border: '4px solid rgb(255, 255, 255)',
      round: true,
      shadow: true,
    });
    // The title is at the top, with a thin grey line below it.
    const title = form(page).locator('.movement-form-title');
    expect((await title.boundingBox()).y).toBeLessThan(
      (await field(page, 'source').boundingBox()).y,
    );
    expect(
      await title.evaluate((node) => parseFloat(getComputedStyle(node).borderBottomWidth)),
    ).toBeGreaterThan(0);
    // Each field sits in a light grey box with round corners.
    const box = await fieldBox(page, 'source').evaluate((node) => {
      const css = getComputedStyle(node);
      return [css.backgroundColor, parseFloat(css.borderTopLeftRadius) > 0];
    });
    expect(box).toEqual(['rgb(233, 235, 239)', true]);
    // Cancel looks like the app's other buttons, with a red border, at the bottom of the panel.
    expect(CARDS.cancel.colors).toEqual(['#b91c1c', '#fca5a5']);
    expect(CARDS.cancel.border).toBe(3);
    const cancelBox = await cancel(page).boundingBox();
    const amountBox = await field(page, 'amount').boundingBox();
    const panelBox = await form(page).boundingBox();
    expect(cancelBox.y).toBeGreaterThan(amountBox.y + amountBox.height);
    expect(cancelBox.y + cancelBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
  });

  test('Cancel closes the form, brings the months back, and changes nothing in the sheet', async ({
    page,
  }) => {
    const requests = await openForm(page);
    await field(page, 'concept').fill('Bakery');

    await cancel(page).click();

    await expect(form(page)).toBeHidden();
    await expect(page.locator('.month-area')).toBeVisible();
    await expect(page.locator('.month')).toHaveCount(3);
    await expect(back(page)).toBeVisible();
    await expect(add(page)).toBeVisible();
    expect(requests.methods.filter((method) => method !== 'GET')).toEqual([]);
  });

  test('when the lists cannot be read, the form says so, and Cancel still closes it', async ({
    page,
  }) => {
    await openForm(page, { dropdowns: 'offline' });

    await expect(form(page).locator('.form-message')).toHaveText(STRINGS.en.listsFailed);

    await cancel(page).click();
    await expect(form(page)).toBeHidden();
  });

  test('when a column has no dropdown rule, the form says the lists could not be loaded', async ({
    page,
  }) => {
    await openForm(page, { dropdowns: 'none' });

    await expect(form(page).locator('.form-message')).toHaveText(STRINGS.en.listsFailed);
  });

  test('with "reduce motion" on, the form opens and closes at once, with no animation', async ({
    page,
  }) => {
    await openGoal(page);
    await startAnimationLog(page);

    await add(page).click();
    await expect(form(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
    await cancel(page).click();
    await expect(form(page)).toBeHidden();
    await expect(back(page)).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);

    expect((await animationLog(page)).filter(({ step }) => step === 'start')).toEqual([]);
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });
    const months = ['month0', 'month1', 'month2'];

    test('a tap on "+" sinks the buttons, then the months from the bottom up, then the form rises in', async ({
      page,
    }) => {
      await openGoal(page);
      const number = await page.locator('#goal-value').boundingBox();
      await startAnimationLog(page);

      await add(page).click();
      await expect(form(page)).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);

      const log = await animationLog(page);
      const at = (who, step, name) => momentOf(log, who, step, name);
      // First the back and "+" buttons, with the sinking of a closing card.
      for (const button of ['back', 'add']) {
        expect(at(button, 'start', 'card-sink')).toBeLessThan(at('month2', 'start', 'card-sink'));
      }
      // Then the months, from the bottom up.
      expect(at('month2', 'start', 'card-sink')).toBeLessThan(at('month1', 'start', 'card-sink'));
      expect(at('month1', 'start', 'card-sink')).toBeLessThan(at('month0', 'start', 'card-sink'));
      // The form rises in like a card (fades in and moves up), after every month has sunk.
      for (const month of months) {
        expect(at('form', 'start', 'card-rise')).toBeGreaterThanOrEqual(
          at(month, 'end', 'card-sink'),
        );
      }
      await expect(back(page)).toBeHidden();
      await expect(add(page)).toBeHidden();
      // The goal number does not move.
      expect(await page.locator('#goal-value').boundingBox()).toEqual(number);
    });

    test('Cancel plays it in reverse: the form sinks, the months rise from the top, the buttons last', async ({
      page,
    }) => {
      await openGoal(page);
      await add(page).click();
      await expect(form(page)).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);
      const number = await page.locator('#goal-value').boundingBox();
      await startAnimationLog(page);

      await cancel(page).click();
      await expect(back(page)).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);

      await expect(form(page)).toBeHidden();
      const log = await animationLog(page);
      const at = (who, step, name) => momentOf(log, who, step, name);
      // First the form sinks away (fades out and moves down), then the months rise in.
      for (const month of months) {
        expect(at(month, 'start', 'card-rise')).toBeGreaterThanOrEqual(
          at('form', 'end', 'card-sink'),
        );
      }
      // The months rise from the top down.
      expect(at('month0', 'start', 'card-rise')).toBeLessThan(at('month1', 'start', 'card-rise'));
      expect(at('month1', 'start', 'card-rise')).toBeLessThan(at('month2', 'start', 'card-rise'));
      // The back and "+" buttons rise in last.
      for (const button of ['back', 'add']) {
        expect(at(button, 'start', 'card-rise')).toBeGreaterThan(
          at('month2', 'start', 'card-rise'),
        );
      }
      expect(await page.locator('#goal-value').boundingBox()).toEqual(number);
    });
  });

  test.describe('the amount field', () => {
    // Types keys one after the other, like a person, in the Amount field.
    async function typeAmount(page, keys) {
      await field(page, 'amount').focus();
      await page.keyboard.type(keys);
    }
    // Pastes a text into the Amount field, as the browser does it.
    const paste = (page, text) =>
      field(page, 'amount').evaluate((node, text) => {
        const data = new window.DataTransfer();
        data.setData('text/plain', text);
        node.dispatchEvent(
          new window.ClipboardEvent('paste', {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      }, text);
    // Where the cursor or the selection is: [start, end].
    const selection = (page) =>
      field(page, 'amount').evaluate((node) => [node.selectionStart, node.selectionEnd]);
    const selectAll = (page) => page.keyboard.press('ControlOrMeta+a');

    test('on a phone, it opens a keyboard with only numbers', async ({ page }) => {
      await openForm(page);

      await expect(field(page, 'amount')).toHaveAttribute('inputmode', 'numeric');
    });

    test('before typing, it is empty and shows a grey 0.00 hint', async ({ page }) => {
      await openForm(page);

      await expect(field(page, 'amount')).toHaveValue('');
      await expect(field(page, 'amount')).toHaveAttribute('placeholder', '0.00');
    });

    test('the last two numbers are the cents', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');

      await typeAmount(page, '5');
      await expect(amount).toHaveValue('0.05');
      await page.keyboard.type('0');
      await expect(amount).toHaveValue('0.50');
      await page.keyboard.type('0');
      await expect(amount).toHaveValue('5.00');
    });

    test('a 0 typed into the empty field is ignored', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');

      await typeAmount(page, '0');
      await expect(amount).toHaveValue('');
      await page.keyboard.type('7');
      await expect(amount).toHaveValue('0.07');
    });

    test('big amounts show the thousands mark, and only 8 numbers are taken', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');

      await typeAmount(page, '123456');
      await expect(amount).toHaveValue('1,234.56');
      await page.keyboard.type('78');
      await expect(amount).toHaveValue('123,456.78');
      await page.keyboard.type('9');
      await expect(amount).toHaveValue('123,456.78');
    });

    test('letters, spaces, signs, commas and dots are ignored', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');

      await typeAmount(page, 'ab -+,.€');
      await expect(amount).toHaveValue('');
      await page.keyboard.type('1250');
      await page.keyboard.type('x -+,.€');
      await expect(amount).toHaveValue('12.50');
    });

    test('Backspace and the Delete key remove the last number', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');
      await typeAmount(page, '1250');

      for (const shown of ['1.25', '0.12', '0.01', '']) {
        await page.keyboard.press('Backspace');
        await expect(amount).toHaveValue(shown);
      }
      await page.keyboard.type('1250');
      await page.keyboard.press('Delete');
      await expect(amount).toHaveValue('1.25');
    });

    test('the cursor always goes back to the end', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');
      await typeAmount(page, '1250');

      // A click near the start of the number.
      const box = await amount.boundingBox();
      await amount.click({ position: { x: 2, y: box.height / 2 } });
      await expect.poll(() => selection(page)).toEqual([5, 5]);
      await page.keyboard.press('Home');
      await expect.poll(() => selection(page)).toEqual([5, 5]);
      await page.keyboard.type('3');
      await expect(amount).toHaveValue('125.03');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Backspace');
      await expect(amount).toHaveValue('12.50');
    });

    test('only the whole amount can be selected', async ({ page }) => {
      await openForm(page);
      await typeAmount(page, '1250');

      await page.keyboard.press('Shift+ArrowLeft');
      await expect.poll(() => selection(page)).toEqual([0, 5]);
      await field(page, 'amount').evaluate((node) => node.setSelectionRange(1, 3));
      await expect.poll(() => selection(page)).toEqual([0, 5]);
    });

    test('with all of it selected, delete and cut empty it, and typing or pasting replaces it', async ({
      page,
    }) => {
      await openForm(page);
      const amount = field(page, 'amount');

      await typeAmount(page, '1250');
      await selectAll(page);
      await page.keyboard.press('Backspace');
      await expect(amount).toHaveValue('');

      await page.keyboard.type('1250');
      await selectAll(page);
      await page.keyboard.press('ControlOrMeta+x');
      await expect(amount).toHaveValue('');

      await page.keyboard.type('1250');
      await selectAll(page);
      await page.keyboard.type('7');
      await expect(amount).toHaveValue('0.07');

      await selectAll(page);
      await paste(page, '3,00');
      await expect(amount).toHaveValue('3.00');
    });

    test('with all of it selected, an ignored key or a paste with no numbers changes nothing', async ({
      page,
    }) => {
      await openForm(page);
      const amount = field(page, 'amount');
      await typeAmount(page, '1250');

      await selectAll(page);
      await page.keyboard.type(',');
      await expect(amount).toHaveValue('12.50');
      await selectAll(page);
      await page.keyboard.type('a');
      await expect(amount).toHaveValue('12.50');
      await selectAll(page);
      await paste(page, 'abc');
      await expect(amount).toHaveValue('12.50');
    });

    test('a phone keyboard that builds the text while typing still adds one number per key', async ({
      page,
    }) => {
      await openForm(page);
      const amount = field(page, 'amount');
      await typeAmount(page, '12');

      // Such a keyboard sends a change that cannot be stopped, and the browser makes it itself.
      await amount.evaluate((node) => {
        const composing = { bubbles: true, isComposing: true, data: '5' };
        node.dispatchEvent(new window.CompositionEvent('compositionstart', { bubbles: true }));
        node.dispatchEvent(
          new window.InputEvent('beforeinput', {
            ...composing,
            inputType: 'insertCompositionText',
            cancelable: false,
          }),
        );
        node.value += '5';
        node.dispatchEvent(
          new window.InputEvent('input', { ...composing, inputType: 'insertCompositionText' }),
        );
        node.dispatchEvent(
          new window.CompositionEvent('compositionend', { bubbles: true, data: '5' }),
        );
      });

      await expect(amount).toHaveValue('1.25');
    });

    test('a paste adds only its numbers, at the end, as if they were typed', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');
      await amount.focus();

      await paste(page, 'Total: 12,50 €');
      await expect(amount).toHaveValue('12.50');

      await selectAll(page);
      await page.keyboard.press('Backspace');
      await page.keyboard.type('100');
      await paste(page, '25');
      await expect(amount).toHaveValue('100.25');
    });

    test('a paste that does not fit adds only the first numbers that fit', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');
      await typeAmount(page, '1234567');
      await expect(amount).toHaveValue('12,345.67');

      await paste(page, '89');
      await expect(amount).toHaveValue('123,456.78');
      await paste(page, '99');
      await expect(amount).toHaveValue('123,456.78');
    });

    test('undo and redo do nothing', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');
      await typeAmount(page, '12');

      await page.keyboard.press('ControlOrMeta+z');
      await expect(amount).toHaveValue('0.12');
      await page.keyboard.press('ControlOrMeta+y');
      await page.keyboard.press('ControlOrMeta+Shift+z');
      await expect(amount).toHaveValue('0.12');
    });

    test('the "− / +" switch does not change the amount', async ({ page }) => {
      await openForm(page);
      const amount = field(page, 'amount');
      await typeAmount(page, '1250');

      await sign(page).click();
      await expect(sign(page)).toHaveAttribute('data-sign', 'plus');
      await expect(amount).toHaveValue('12.50');
    });

    for (const [language, marks] of [
      ['es', ['1.234,56', '123.456,78']],
      // In Russian the thousands mark is a space that does not break the line.
      ['ru', ['1\u00a0234,56', '123\u00a0456,78']],
    ]) {
      test(`in "${language}", it uses a comma for the cents and the language's thousands mark`, async ({
        page,
      }) => {
        await openMain(page);
        const picker = page.locator('#main [data-card="language"]');
        await picker.locator('[aria-current="true"]').click();
        await expect.poll(() => locked(page)).toBe(false);
        await picker.locator(`[data-language="${language}"]`).click();
        await expect.poll(() => locked(page)).toBe(false);
        await goalCard(page).click();
        await expect(back(page)).toBeVisible();
        await expect.poll(() => locked(page)).toBe(false);
        await add(page).click();
        await expect(form(page)).toBeVisible();
        await expect.poll(() => locked(page)).toBe(false);
        const amount = form(page).getByLabel(STRINGS[language].amount, { exact: true });

        await expect(amount).toHaveAttribute('placeholder', '0,00');
        await amount.focus();
        await page.keyboard.type('100');
        await expect(amount).toHaveValue('1,00');
        await selectAll(page);
        await page.keyboard.type('123456');
        await expect(amount).toHaveValue(marks[0]);
        await page.keyboard.type('78');
        await expect(amount).toHaveValue(marks[1]);
      });
    }
  });

  test.describe('on a narrow phone', () => {
    test.use({ viewport: { width: 360, height: 780 } });

    test('every field and button fits, with no sideways scrolling', async ({ page }) => {
      await openForm(page);

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        360,
      );
      for (const part of [
        form(page),
        ...['source', 'date', 'category', 'concept', 'amount'].map((name) => field(page, name)),
        sign(page),
        cancel(page),
      ]) {
        const box = await part.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(360);
      }
    });
  });

  test.describe('on a short phone', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('the goal card scrolls to reach every field and the Cancel button', async ({ page }) => {
      await openForm(page);

      await cancel(page).scrollIntoViewIfNeeded();
      const bottom = await cancel(page).boundingBox();
      expect(bottom.y).toBeGreaterThanOrEqual(0);
      expect(bottom.y + bottom.height).toBeLessThanOrEqual(667);
      await field(page, 'source').scrollIntoViewIfNeeded();
      const top = await field(page, 'source').boundingBox();
      expect(top.y).toBeGreaterThanOrEqual(0);
      expect(top.y + top.height).toBeLessThanOrEqual(667);

      await cancel(page).click();
      await expect(form(page)).toBeHidden();
    });
  });

  for (const language of ['es', 'ru']) {
    test(`after picking the "${language}" flag, every word of the form is in that language`, async ({
      page,
    }) => {
      await openMain(page);
      const picker = page.locator('#main [data-card="language"]');
      await picker.locator('[aria-current="true"]').click();
      await expect.poll(() => locked(page)).toBe(false);
      await picker.locator(`[data-language="${language}"]`).click();
      await expect.poll(() => locked(page)).toBe(false);
      await goalCard(page).click();
      await expect(back(page)).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);

      await add(page).click();

      const words = STRINGS[language];
      await expect(form(page).locator('.movement-form-title')).toHaveText(words.newMovement);
      for (const name of ['source', 'date', 'category', 'concept', 'amount']) {
        await expect(form(page).getByLabel(words[name], { exact: true })).toBeVisible();
      }
      await expect(cancel(page)).toHaveText(words.cancel);
      await expect(add(page)).toHaveAttribute('aria-label', words.add);
    });
  }
});
