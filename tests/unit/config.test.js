import { test } from 'node:test';
import assert from 'node:assert/strict';

import { config, isConfigured } from '../../src/config.js';

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

// The cell of each part comes from the CELLS table of the App sheet (issue #126).
test('the Total is made of four parts, and provisioned is taken away', () => {
  assert.deepEqual(config.pills, [
    { name: 'bank' },
    { name: 'cards' },
    { name: 'provisioned', subtract: true },
    { name: 'cash' },
  ]);
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

// The cells of the Total, the movements sheet, its first movement row and the cells of the
// form's lists come from the CELLS table of the App sheet (issue #126). The goal's sources come
// from its SOURCES table (issue #124), and its dates, limit and left-out movements from its GOAL
// and GOAL LEAVE OUT tables (issue #125).
test('the config has no goal or form settings, and no cell or sheet name apart from the App sheet', () => {
  assert.equal(Object.hasOwn(config, 'goal'), false);
  assert.equal(Object.hasOwn(config, 'form'), false);
  assert.equal(config.appSheet, 'App');
  assert.doesNotMatch(JSON.stringify(config), /![A-Z]|Briefing|Movements/);
});
