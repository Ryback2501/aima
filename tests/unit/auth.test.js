import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createAuth,
  loadGoogleIdentity,
  SignInFailedError,
  PermissionMissingError,
} from '../../src/auth.js';

const SHEETS = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const EMAIL = 'https://www.googleapis.com/auth/userinfo.email';

// A fake of the Google Identity Services library. Each test says how Google "answers".
function fakeGoogle({ response, error, granted = [SHEETS, EMAIL] } = {}) {
  const log = { configs: [], requests: [], revoked: [] };
  const google = {
    accounts: {
      oauth2: {
        initTokenClient(config) {
          log.configs.push(config);
          return {
            requestAccessToken(overrides) {
              log.requests.push(overrides);
              if (error) config.error_callback(error);
              else config.callback(response);
            },
          };
        },
        hasGrantedAllScopes: (_response, ...scopes) => scopes.every((s) => granted.includes(s)),
        revoke(token, done) {
          log.revoked.push(token);
          done();
        },
      },
    },
  };
  return { google, log };
}

function auth(google, extra = {}) {
  return createAuth({
    google,
    clientId: 'client-1',
    scopes: [SHEETS, EMAIL],
    requiredScopes: [SHEETS],
    now: () => 1_000,
    ...extra,
  });
}

test('signIn asks Google for a token with our app id and permissions', async () => {
  const { google, log } = fakeGoogle({ response: { access_token: 'tok', expires_in: 3599 } });

  await auth(google).signIn();

  assert.equal(log.configs[0].client_id, 'client-1');
  assert.equal(log.configs[0].scope, `${SHEETS} ${EMAIL}`);
});

test('signIn returns the token and when it expires', async () => {
  const { google } = fakeGoogle({ response: { access_token: 'tok', expires_in: 3599 } });

  assert.deepEqual(await auth(google).signIn(), { token: 'tok', expiresAt: 1_000 + 3_599_000 });
});

test('with a remembered email, Google can sign in with one tap and no account list', async () => {
  const { google, log } = fakeGoogle({ response: { access_token: 'tok', expires_in: 3599 } });

  await auth(google).signIn({ hint: 'ana@example.com' });

  assert.deepEqual(log.requests[0], { prompt: '', login_hint: 'ana@example.com' });
});

test('without a remembered email, Google shows the account list', async () => {
  const { google, log } = fakeGoogle({ response: { access_token: 'tok', expires_in: 3599 } });

  await auth(google).signIn();

  assert.deepEqual(log.requests[0], { prompt: 'select_account' });
});

test('an error answer from Google fails the sign-in', async () => {
  const { google } = fakeGoogle({ response: { error: 'access_denied' } });

  await assert.rejects(auth(google).signIn(), SignInFailedError);
});

test('closing the Google window fails the sign-in', async () => {
  const { google } = fakeGoogle({ error: { type: 'popup_closed' } });

  await assert.rejects(auth(google).signIn(), SignInFailedError);
});

test('a sign-in without the permission to see sheets is refused with a clear reason', async () => {
  const { google, log } = fakeGoogle({
    response: { access_token: 'tok', expires_in: 3599 },
    granted: [EMAIL],
  });

  await assert.rejects(auth(google).signIn(), PermissionMissingError);
  // The half-finished sign-in is cancelled at Google too.
  assert.deepEqual(log.revoked, ['tok']);
});

test('signOut cancels the token at Google', async () => {
  const { google, log } = fakeGoogle();

  await auth(google).signOut('tok');

  assert.deepEqual(log.revoked, ['tok']);
});

test('signOut without a token does nothing', async () => {
  const { google, log } = fakeGoogle();

  await auth(google).signOut(null);

  assert.deepEqual(log.revoked, []);
});

test('getEmail reads the email of the signed-in Google account', async () => {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ email: 'ana@example.com' }), { status: 200 });
  };

  const email = await auth(fakeGoogle().google, { fetch }).getEmail('tok');

  assert.equal(email, 'ana@example.com');
  assert.equal(calls[0].url, 'https://www.googleapis.com/oauth2/v3/userinfo');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer tok');
});

test('getEmail returns null when it cannot read the email, because the email is only a help', async () => {
  const failing = async () => new Response('', { status: 500 });
  const offline = async () => {
    throw new TypeError('Failed to fetch');
  };

  for (const fetch of [failing, offline]) {
    assert.equal(await auth(fakeGoogle().google, { fetch }).getEmail('tok'), null);
  }
});

// A fake page where adding a <script> "loads" it at once (or fails).
function fakePage({ fails = false } = {}) {
  const added = [];
  const window = {};
  const document = {
    createElement: () => ({}),
    head: {
      appendChild(script) {
        added.push(script);
        if (fails) script.onerror();
        else {
          window.google = { accounts: { oauth2: {} } };
          script.onload();
        }
      },
    },
  };
  return { window, document, added };
}

test('loadGoogleIdentity adds the Google script once and gives back the library', async () => {
  const page = fakePage();

  const first = await loadGoogleIdentity(page);
  const second = await loadGoogleIdentity(page);

  assert.equal(page.added.length, 1);
  assert.equal(page.added[0].src, 'https://accounts.google.com/gsi/client');
  assert.equal(first, page.window.google);
  assert.equal(second, page.window.google);
});

test('loadGoogleIdentity fails clearly when the Google script cannot load', async () => {
  await assert.rejects(loadGoogleIdentity(fakePage({ fails: true })), SignInFailedError);
});
