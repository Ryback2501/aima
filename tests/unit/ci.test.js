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
