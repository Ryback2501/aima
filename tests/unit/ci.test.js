import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

// The end-to-end tests run inside Playwright's own image, which already has the browser and
// its fonts. The browser in the image only works with the same Playwright version as the one
// the tests use, so the two must always change together.
test('the end-to-end tests run in the Playwright image of the installed Playwright version', async () => {
  const workflow = await read('.github/workflows/ci-jobs.yml');
  const lock = JSON.parse(await read('package-lock.json'));
  const installed = lock.packages['node_modules/@playwright/test'].version;

  const images = [...workflow.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-noble/g)];

  assert.equal(images.length, 1);
  assert.equal(images[0][1], installed);
  // The browser is already in the image, so nothing is installed while the tests run.
  assert.doesNotMatch(workflow, /playwright install/);
});

// The browser tests run on a phone screen and on a computer screen (issue #130). Most of them do
// not depend on the screen size, so only the tests about the layout, marked with @both-screens in
// their name, also run on the computer screen. The phone screen runs every test.
test('the phone screen runs every browser test, the computer screen only those marked @both-screens', async () => {
  const { default: config } = await import('../../playwright.config.js');
  const screens = Object.fromEntries(config.projects.map((project) => [project.name, project]));
  assert.deepEqual(Object.keys(screens).sort(), ['computer', 'phone']);

  const runs = (screen, name) => {
    const { grep, grepInvert } = screens[screen];
    const matches = (patterns) => [patterns].flat().some((pattern) => pattern.test(name));
    return (!grep || matches(grep)) && (!grepInvert || !matches(grepInvert));
  };

  assert.equal(runs('phone', 'a month opens on a tap'), true);
  assert.equal(runs('phone', 'the pills sit in a row @both-screens'), true);
  assert.equal(runs('computer', 'a month opens on a tap'), false);
  assert.equal(runs('computer', 'the pills sit in a row @both-screens'), true);
});

// Most of the time a browser test waits for the app, so four of them run at the same time, on a
// computer and in CI (issue #131).
test('four browser tests run at the same time', async () => {
  const { default: config } = await import('../../playwright.config.js');

  assert.equal(config.workers, 4);
});
