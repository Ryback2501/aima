import { test } from 'node:test';
import assert from 'node:assert/strict';

import { config, isConfigured } from '../../src/config.js';

test('real values count as set up', () => {
  assert.equal(
    isConfigured({ googleClientId: '123-abc.apps.googleusercontent.com', spreadsheetId: '1AbC' }),
    true,
  );
});

test('example values or empty values do not count as set up', () => {
  assert.equal(
    isConfigured({ googleClientId: 'REPLACE_WITH_GOOGLE_CLIENT_ID', spreadsheetId: '1AbC' }),
    false,
  );
  assert.equal(isConfigured({ googleClientId: '123-abc', spreadsheetId: '' }), false);
  assert.equal(isConfigured({}), false);
});

test('the app reads cell B3 of the Briefing sheet', () => {
  assert.equal(config.briefingCell, 'Briefing!B3');
});

test('the permission to read sheets is required and asked for', () => {
  for (const scope of config.requiredScopes) assert.ok(config.scopes.includes(scope));
});
