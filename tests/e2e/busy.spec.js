import { test, expect } from '@playwright/test';

import { setUp, sheetDay } from './helpers.js';
import { ICONS } from '../../src/icons.js';
import { STRINGS } from '../../src/i18n.js';

// The spinner while a movement is saved or deleted, then the thumbs-up or the warning
// (issue #108).

const goalCard = (page) => page.locator('#main [data-card="goal"]');
const back = (page) => page.locator('#back');
const add = (page) => page.locator('#add');
const edit = (page) => page.locator('#edit');
const remove = (page) => page.locator('#delete');
const form = (page) => page.locator('.movement-form');
const field = (page, name) => form(page).getByLabel(STRINGS.en[name], { exact: true });
const save = (page) => form(page).locator('[data-card="save"]');
const saveMessage = (page) => form(page).locator('.save-message');
const panel = (page) => page.locator('.delete-panel');
const yes = (page) => panel(page).locator('[data-card="yes"]');
const deleteMessage = (page) => panel(page).locator('.delete-message');
const month = (page, index) => page.locator('.month').nth(index);
const movement = (page, monthIndex, index) =>
  month(page, monthIndex).locator('.movement').nth(index);
const descriptions = (page, monthIndex) =>
  month(page, monthIndex).locator('.description-text').allTextContents();
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

// The three parts of the busy layer of the form or of the delete question, and its text.
const spinner = (owner) => owner.locator('.busy-spinner');
const thumbsUp = (owner) => owner.locator('.busy-done');
const warning = (owner) => owner.locator('.busy-failed');
const status = (owner) => owner.locator('.busy-text');

const GREY = 'rgb(107, 114, 128)';
const GREEN = 'rgb(43, 138, 62)';
const RED = 'rgb(220, 38, 38)';

const movementRows = () => [
  ['Cash', sheetDay('2026-10-03'), 'General', 'Market', -100],
  ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Cinema', -10],
  ['Cash', sheetDay('2026-10-20'), 'Car', 'Petrol', -40],
];

async function openMain(page, options = {}) {
  const movements = options.movements ?? movementRows();
  const requests = await setUp(page, { canEdit: true, ...options, movements });
  await page.goto('./');
  await page.locator('#sign-in').click();
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

async function tapAndWait(page, locator) {
  await locator.click();
  await page.waitForTimeout(50);
  await expect.poll(() => locked(page)).toBe(false);
}

const tapMonth = (page, index) => tapAndWait(page, month(page, index).locator('.month-head'));

// Keeps the mouse button on a movement for longer than half a second: it is selected.
async function hold(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(() => locked(page)).toBe(false);
}

// The new movement form, filled in with a movement that counts for October.
async function openFilledForm(page, options = {}) {
  const parts = await openGoal(page, options);
  await tapAndWait(page, add(page));
  await expect(form(page)).toBeVisible();
  await field(page, 'source').selectOption('Cash');
  await field(page, 'date').fill('2026-10-25');
  await field(page, 'category').selectOption('General');
  await field(page, 'concept').fill('Bakery');
  await field(page, 'amount').click();
  await page.keyboard.type('1250');
  return parts;
}

// Opens October, selects its movement number index and taps Edit.
async function openEdit(page, index, options = {}) {
  const parts = await openGoal(page, options);
  await tapMonth(page, 0);
  await hold(page, movement(page, 0, index));
  await tapAndWait(page, edit(page));
  await expect(form(page)).toBeVisible();
  return parts;
}

// Opens October, selects its first two movements and taps Delete.
async function openDelete(page, options = {}) {
  const parts = await openGoal(page, options);
  await tapMonth(page, 0);
  await hold(page, movement(page, 0, 0));
  await tapAndWait(page, movement(page, 0, 1));
  await tapAndWait(page, remove(page));
  await expect(panel(page)).toBeVisible();
  return parts;
}

// Every save and delete waits this long before Google answers, so the spinner can be seen.
async function slowWrites(page, ms = 1500) {
  await page.route(/:batchUpdate/, async (route) => {
    await new Promise((done) => setTimeout(done, ms));
    await route.fallback();
  });
}

// Writes down every change of what the busy layers show, with its time.
const startBusyLog = (page) =>
  page.evaluate(() => {
    window.__busyLog = [];
    new window.MutationObserver((changes) => {
      for (const change of changes) {
        window.__busyLog.push({
          show: change.target.dataset.show ?? '',
          time: window.performance.now(),
        });
      }
    }).observe(document.body, { subtree: true, attributeFilter: ['data-show'] });
  });
const busyLog = (page) => page.evaluate(() => window.__busyLog);

// The opacity of each of the 16 dots of a spinner.
const dotOpacities = (owner) =>
  spinner(owner)
    .locator('circle')
    .evaluateAll((dots) => dots.map((dot) => Number(getComputedStyle(dot).opacity)));

const opacityOf = (locator) => locator.evaluate((node) => Number(getComputedStyle(node).opacity));

test.describe('saving a new movement', () => {
  test('the content of the form fades out, its card stays, and the spinner shows in its middle @both-screens', async ({
    page,
  }) => {
    await openFilledForm(page);
    // Slow enough for all the checks below to run while the spinner shows.
    await slowWrites(page, 5000);

    await save(page).click();

    await expect(spinner(form(page))).toBeVisible();
    await expect(status(form(page))).toHaveText('Saving…');
    // Taps do nothing while it saves.
    expect(await locked(page)).toBe(true);
    await expect.poll(() => opacityOf(spinner(form(page)))).toBe(1);
    await expect.poll(() => opacityOf(form(page).locator('.movement-form-title'))).toBe(0);
    await expect.poll(() => opacityOf(form(page).locator('.form-buttons'))).toBe(0);
    // The card itself stays.
    await expect(form(page)).toBeVisible();
    expect(await opacityOf(form(page))).toBe(1);
    // In the middle of the card, 48px wide, with 16 grey dots.
    const card = await form(page).boundingBox();
    const ring = await spinner(form(page)).boundingBox();
    expect(Math.abs(ring.x + ring.width / 2 - (card.x + card.width / 2))).toBeLessThan(2);
    expect(Math.abs(ring.y + ring.height / 2 - (card.y + card.height / 2))).toBeLessThan(2);
    expect(Math.round(ring.width)).toBe(48);
    await expect(spinner(form(page)).locator('circle')).toHaveCount(16);
    const fills = await spinner(form(page))
      .locator('circle')
      .evaluateAll((dots) => dots.map((dot) => getComputedStyle(dot).fill));
    expect(new Set(fills)).toEqual(new Set([GREY]));
    // About two dots are visible at any moment, and they move on.
    const first = await dotOpacities(form(page));
    expect(Math.abs(first.reduce((sum, value) => sum + value, 0) - 2)).toBeLessThan(0.2);
    await page.waitForTimeout(250);
    const later = await dotOpacities(form(page));
    expect(later).not.toEqual(first);
  });

  test('when it is saved, a green thumbs-up stays for 1 second, then the form closes and the list shows it @both-screens', async ({
    page,
  }) => {
    await openFilledForm(page);
    await slowWrites(page, 600);
    await startBusyLog(page);

    await save(page).click();

    await expect(thumbsUp(form(page))).toBeVisible();
    await expect.poll(() => opacityOf(thumbsUp(form(page)))).toBe(1);
    expect(await thumbsUp(form(page)).locator('path').getAttribute('d')).toBe(ICONS.thumbsUp.path);
    expect(await thumbsUp(form(page)).evaluate((node) => getComputedStyle(node).fill)).toBe(GREEN);
    expect(Math.round((await thumbsUp(form(page)).boundingBox()).width)).toBe(48);
    await expect(status(form(page))).toHaveText('Saved');
    expect(await locked(page)).toBe(true);

    await expect(form(page)).toBeHidden({ timeout: 5000 });
    await expect.poll(() => locked(page)).toBe(false);
    await expect.poll(() => descriptions(page, 0)).toContain('Bakery');
    // The thumbs-up fades in (250 ms), stays 1 second, then fades out.
    const log = await busyLog(page);
    const shown = log.find(({ show }) => show === 'done');
    const gone = log.find(({ show, time }) => show === '' && time > shown.time);
    expect(gone.time - shown.time).toBeGreaterThan(1200);
    expect(gone.time - shown.time).toBeLessThan(1700);
  });

  test('on a short screen, with the form scrolled down to Save, the spinner shows in the middle of the card @both-screens', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 480 });
    await openFilledForm(page);
    await form(page).evaluate((node) => (node.scrollTop = node.scrollHeight));
    expect(await form(page).evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await slowWrites(page, 3000);

    await save(page).click();

    await expect(spinner(form(page))).toBeVisible();
    const card = await form(page).boundingBox();
    const ring = await spinner(form(page)).boundingBox();
    expect(Math.abs(ring.y + ring.height / 2 - (card.y + card.height / 2))).toBeLessThan(2);
    expect(Math.abs(ring.x + ring.width / 2 - (card.x + card.width / 2))).toBeLessThan(2);
  });

  test('the spinner shows for at least 300 ms, even when the sheet answers at once', async ({
    page,
  }) => {
    await openFilledForm(page);
    await startBusyLog(page);

    await save(page).click();

    await expect(form(page)).toBeHidden({ timeout: 5000 });
    const log = await busyLog(page);
    const spinning = log.find(({ show }) => show === 'spinner');
    const done = log.find(({ show }) => show === 'done');
    expect(done.time - spinning.time).toBeGreaterThanOrEqual(300);
  });

  test('when the sheet cannot be read again after the save, the thumbs-up shows and the form closes', async ({
    page,
  }) => {
    await openFilledForm(page);
    let saved = false;
    await page.route(/:batchUpdate/, async (route) => {
      saved = true;
      await route.fallback();
    });
    await page.route(/sheets\.googleapis\.com/, (route) =>
      saved && route.request().method() === 'GET' ? route.abort() : route.fallback(),
    );

    await save(page).click();

    await expect(thumbsUp(form(page))).toBeVisible();
    await expect(form(page)).toBeHidden({ timeout: 5000 });
    await expect(saveMessage(page)).toBeHidden();
  });

  test('an empty required field is marked, with no spinner', async ({ page }) => {
    await openFilledForm(page);
    await field(page, 'concept').fill('');
    await field(page, 'source').selectOption('');
    await startBusyLog(page);

    await tapAndWait(page, save(page));

    await expect(form(page)).toBeVisible();
    expect(await busyLog(page)).toEqual([]);
    await expect(spinner(form(page))).toBeHidden();
  });

  test('with no internet, a red warning stays for 1 second, then the form comes back with the message', async ({
    page,
  }) => {
    await openFilledForm(page, { saves: ['offline'] });
    await startBusyLog(page);

    await save(page).click();

    await expect(warning(form(page))).toBeVisible();
    await expect.poll(() => opacityOf(warning(form(page)))).toBe(1);
    expect(await warning(form(page)).locator('path').getAttribute('d')).toBe(ICONS.warning.path);
    expect(await warning(form(page)).evaluate((node) => getComputedStyle(node).fill)).toBe(RED);
    await expect(status(form(page))).toHaveText('Not saved');
    expect(await locked(page)).toBe(true);

    await expect.poll(() => opacityOf(form(page).locator('.movement-form-title'))).toBe(1);
    await expect(warning(form(page))).toBeHidden();
    await expect(saveMessage(page)).toHaveText('The movement was not saved. Please try again.');
    await expect(field(page, 'concept')).toHaveValue('Bakery');
    await expect.poll(() => locked(page)).toBe(false);
    const log = await busyLog(page);
    const shown = log.find(({ show }) => show === 'failed');
    const gone = log.find(({ show, time }) => show === '' && time > shown.time);
    expect(gone.time - shown.time).toBeGreaterThan(1200);
    expect(gone.time - shown.time).toBeLessThan(1700);
  });

  test('with "reduce motion" on, the content, the spinner and the icons still fade', async ({
    page,
  }) => {
    // The tests run with "reduce motion" on (playwright.config.js).
    await openFilledForm(page);
    const duration = (locator) =>
      locator.evaluate((node) => getComputedStyle(node).transitionDuration);

    expect(await duration(form(page).locator('.movement-form-title'))).toBe('0.25s');
    expect(await duration(spinner(form(page)))).toBe('0.25s');
    expect(await duration(thumbsUp(form(page)))).toBe('0.25s');
    expect(await duration(warning(form(page)))).toBe('0.25s');
  });
});

test.describe('saving a change', () => {
  test('the spinner, then the thumbs-up, then the list shows the changed movement', async ({
    page,
  }) => {
    await openEdit(page, 1);
    await slowWrites(page, 600);
    await field(page, 'amount').click();
    await page.keyboard.press('Backspace');

    await save(page).click();

    await expect(spinner(form(page))).toBeVisible();
    await expect(status(form(page))).toHaveText('Saving…');
    await expect(thumbsUp(form(page))).toBeVisible();
    await expect(form(page)).toBeHidden({ timeout: 5000 });
    await expect.poll(() => locked(page)).toBe(false);
  });

  test('with nothing changed, the form closes at once, with no spinner and no thumbs-up', async ({
    page,
  }) => {
    await openEdit(page, 1);
    await startBusyLog(page);

    await tapAndWait(page, save(page));

    await expect(form(page)).toBeHidden();
    expect(await busyLog(page)).toEqual([]);
  });

  test('when the sheet was changed by hand, the warning shows, then the form comes back with the message', async ({
    page,
  }) => {
    const { movements } = await openEdit(page, 1);
    // Somebody writes another movement in the row of Cinema.
    movements[1] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];
    await field(page, 'concept').fill('Cinema 2');

    await save(page).click();

    await expect(warning(form(page))).toBeVisible();
    await expect.poll(() => opacityOf(form(page).locator('.movement-form-title'))).toBe(1);
    await expect(saveMessage(page)).toHaveText('The sheet was changed, so nothing was saved.');
    await expect(warning(form(page))).toBeHidden();
  });
});

test.describe('deleting movements', () => {
  test('the content of the question fades out, the spinner shows, then the thumbs-up, then they go @both-screens', async ({
    page,
  }) => {
    await openDelete(page);
    await slowWrites(page);

    await yes(page).click();

    await expect(spinner(panel(page))).toBeVisible();
    await expect.poll(() => opacityOf(panel(page).locator('.delete-question'))).toBe(0);
    await expect(panel(page)).toBeVisible();
    const card = await panel(page).boundingBox();
    const ring = await spinner(panel(page)).boundingBox();
    expect(Math.abs(ring.x + ring.width / 2 - (card.x + card.width / 2))).toBeLessThan(2);
    expect(Math.abs(ring.y + ring.height / 2 - (card.y + card.height / 2))).toBeLessThan(2);
    await expect(status(panel(page))).toHaveText('Deleting…');
    expect(await locked(page)).toBe(true);

    await expect(thumbsUp(panel(page))).toBeVisible();
    await expect(status(panel(page))).toHaveText('Deleted');
    await expect(panel(page)).toBeHidden({ timeout: 5000 });
    // October lists the newest first: Petrol and Cinema were selected, so Market stays.
    await expect.poll(() => descriptions(page, 0), { timeout: 5000 }).toEqual(['Market']);
  });

  test('with no internet, the warning shows, then the question comes back with the message', async ({
    page,
  }) => {
    await openDelete(page, { saves: ['offline'] });

    await yes(page).click();

    await expect(warning(panel(page))).toBeVisible();
    await expect(status(panel(page))).toHaveText('Not deleted');
    await expect.poll(() => opacityOf(panel(page).locator('.delete-question'))).toBe(1);
    await expect(deleteMessage(page)).toHaveText('Nothing was deleted. Please try again.');
    await expect(warning(panel(page))).toBeHidden();
  });

  test('when the sheet was changed by hand, the warning shows, then the question comes back with the message', async ({
    page,
  }) => {
    const { movements } = await openDelete(page);
    // Somebody writes another movement in the row of Cinema.
    movements[1] = ['Cash', sheetDay('2026-10-12'), 'Leisure', 'Theatre', -30];

    await yes(page).click();

    await expect(warning(panel(page))).toBeVisible();
    await expect.poll(() => opacityOf(panel(page).locator('.delete-question'))).toBe(1);
    await expect(deleteMessage(page)).toHaveText('The sheet was changed, so nothing was deleted.');
  });
});

test.describe('in other languages', () => {
  for (const language of ['es', 'ru']) {
    test(`in "${language}", a screen reader reads the spinner, the thumbs-up and the warning in that language`, async ({
      page,
    }) => {
      await openMain(page, { saves: [200, 'offline'] });
      const picker = page.locator('#main [data-card="language"]');
      await picker.locator('[aria-current="true"]').click();
      await expect.poll(() => locked(page)).toBe(false);
      await picker.locator(`[data-language="${language}"]`).click();
      await expect.poll(() => locked(page)).toBe(false);
      await goalCard(page).click();
      await expect(back(page)).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);
      const words = STRINGS[language];
      await slowWrites(page, 600);

      // A delete that works.
      await tapMonth(page, 0);
      await hold(page, movement(page, 0, 0));
      await tapAndWait(page, remove(page));
      await yes(page).click();
      await expect(status(panel(page))).toHaveText(words.busyDeleting);
      await expect(status(panel(page))).toHaveText(words.busyDeleted);
      await expect(panel(page)).toBeHidden({ timeout: 5000 });
      await expect.poll(() => locked(page)).toBe(false);

      // A delete that fails.
      if (!(await month(page, 0).locator('.month-list').isVisible())) await tapMonth(page, 0);
      await hold(page, movement(page, 0, 0));
      await tapAndWait(page, remove(page));
      await yes(page).click();
      await expect(status(panel(page))).toHaveText(words.busyNotDeleted);
      await expect(deleteMessage(page)).toBeVisible({ timeout: 5000 });
      await expect.poll(() => locked(page)).toBe(false);
      await tapAndWait(page, panel(page).locator('[data-card="no"]'));

      // A save that fails.
      await tapAndWait(page, add(page));
      await form(page).locator('#movement-source').selectOption('Cash');
      await form(page).locator('#movement-category').selectOption('General');
      await form(page).locator('#movement-amount').click();
      await page.keyboard.type('500');
      await save(page).click();
      await expect(status(form(page))).toHaveText(words.busySaving);
      await expect(status(form(page))).toHaveText(words.busyNotSaved);
    });
  }
});
