import { test } from 'node:test';
import assert from 'node:assert/strict';

import { config, isConfigured } from '../../src/config.js';
import { ICONS } from '../../src/icons.js';

const real = {
  googleClientId: '123-abc.apps.googleusercontent.com',
  googleApiKey: 'AIza-example',
  googleAppId: '123',
  spreadsheetId: '1AbC',
};

test('real values count as set up', () => {
  assert.equal(isConfigured(real), true);
});

test('example values or empty values do not count as set up', () => {
  assert.equal(isConfigured({ ...real, googleClientId: 'REPLACE_WITH_GOOGLE_CLIENT_ID' }), false);
  assert.equal(isConfigured({ ...real, googleApiKey: 'REPLACE_WITH_GOOGLE_API_KEY' }), false);
  assert.equal(isConfigured({ ...real, googleAppId: '' }), false);
  assert.equal(isConfigured({ ...real, spreadsheetId: '' }), false);
  assert.equal(isConfigured({}), false);
});

test('the Total is made of four parts, each read from one cell', () => {
  assert.deepEqual(
    config.pills.map(({ name }) => name),
    ['bank', 'cards', 'provisioned', 'cash'],
  );
  for (const { cell } of config.pills) assert.match(cell, /^.+![A-Z]+[0-9]+$/);
});

test('the permission to read sheets is required and asked for', () => {
  for (const scope of config.requiredScopes) assert.ok(config.scopes.includes(scope));
});

// Google asks apps to use the narrowest permission: only the files the person picks for aima.
test('the app asks only for the files the person picks, and for the email', () => {
  assert.deepEqual(config.scopes, [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ]);
  assert.deepEqual(config.requiredScopes, ['https://www.googleapis.com/auth/drive.file']);
});

// The app ID is the Google Cloud project number. It is also the first part of the Client ID.
test('the app ID belongs to the same Google Cloud project as the Client ID', () => {
  assert.ok(config.googleClientId.startsWith(`${config.googleAppId}-`));
});

// Without this, the released app would say "This app is not set up yet" to everyone.
test('the real config is fully set up', () => {
  assert.equal(isConfigured(config), true);
  assert.match(config.googleApiKey, /^AIza/);
});

test('the movements start at the source column, and each source has an icon of the Total', () => {
  assert.equal(config.goal.movements, 'Movements!A:E');
  assert.deepEqual(config.goal.sources, { Cash: 'cash', Después: 'card', 'BBVA David': 'bank' });
  for (const icon of Object.values(config.goal.sources)) assert.ok(ICONS[icon], icon);
});

// The dropdowns of the first movement row (row 2, under the headers) give the form's lists:
// the source in the first column, the category in the third.
test('the form reads its lists from the dropdowns of the first movement row', () => {
  const sheet = config.goal.movements.split('!')[0];
  assert.equal(config.form.sourceList, `${sheet}!A2`);
  assert.equal(config.form.categoryList, `${sheet}!C2`);
});

// The order of the movements of one day, from top to bottom. Each Cash movement is followed by
// its Provisioned movement.
test('the movements of one day are sorted by their source, in the order of the issue', () => {
  assert.deepEqual(config.goal.sourceOrder, [
    'BBVA David',
    'BBVA Común',
    'Después',
    'AMEX',
    'ECI',
    'ICON',
    'Pluxee',
    'Edenred',
    'Cash',
    'Polina',
    'Provisioned',
    'Deprovisioned',
  ]);
  assert.deepEqual(config.goal.sourcePairs, { Cash: 'Provisioned' });
});

test('new movements are written on the movements sheet, from the first movement row', () => {
  const sheet = config.goal.movements.split('!')[0];
  assert.equal(config.form.sheet, sheet);
  assert.equal(`${config.form.sheet}!A${config.form.firstRow}`, config.form.sourceList);
});
