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
