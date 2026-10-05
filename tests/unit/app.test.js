import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../src/app.js';
import { createSession } from '../../src/session.js';
import { NoAccessError, SignInExpiredError, SheetsError } from '../../src/sheets.js';
import { SignInFailedError, PermissionMissingError } from '../../src/auth.js';

const config = {
  googleClientId: 'client-1.apps.googleusercontent.com',
  spreadsheetId: 'sheet-1',
  briefingCell: 'Sheet1!A1',
};

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

// Builds the app with fakes. Each test changes only what it needs.
function setup({
  cell = async () => 'Buy milk',
  signIn = async () => ({ token: 'tok', expiresAt: Date.now() + 3_600_000 }),
  email = 'ana@example.com',
  authFails = false,
  appConfig = config,
  storage = memoryStorage,
  loadAuth,
} = {}) {
  const screens = [];
  const handlers = {};
  const view = {
    render: (state) => screens.push(state),
    onSignIn: (handler) => (handlers.signIn = handler),
    onSignOut: (handler) => (handlers.signOut = handler),
  };
  const session = createSession({
    sessionStorage: storage(),
    localStorage: storage(),
  });
  const log = { signIns: [], revoked: [], cells: [], tokens: [] };
  const auth = {
    signIn: (options) => {
      log.signIns.push(options);
      return signIn(options);
    },
    signOut: async (token) => log.revoked.push(token),
    getEmail: async () => (typeof email === 'function' ? email() : email),
  };
  const app = createApp({
    config: appConfig,
    view,
    session,
    t: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
    loadAuth: loadAuth
      ? () => loadAuth(auth)
      : async () => {
          if (authFails) throw new SignInFailedError('script_not_loaded');
          return auth;
        },
    createSheets: ({ spreadsheetId, getToken }) => ({
      getCell: async (range) => {
        log.cells.push({ spreadsheetId, range });
        log.tokens.push(getToken());
        return cell(range);
      },
    }),
  });
  const last = () => screens.at(-1);
  return { app, session, screens, handlers, log, last };
}

test('the app starts on the login page when nobody is signed in', async () => {
  const { app, last } = setup();

  await app.start();

  assert.deepEqual(last(), { screen: 'login' });
});

test('the sign-in button waits until the Google sign-in is ready', async () => {
  const { app, screens } = setup();

  await app.start();

  assert.deepEqual(screens[0], { screen: 'login', disabled: true });
});

test('with the example IDs still in the config, the app says it is not set up', async () => {
  const { app, last } = setup({
    appConfig: { ...config, googleClientId: 'REPLACE_WITH_GOOGLE_CLIENT_ID' },
  });

  await app.start();

  assert.deepEqual(last(), { screen: 'login', message: 'notConfigured', disabled: true });
});

test('a person with access sees the briefing text after sign-in', async () => {
  const { app, handlers, log, last } = setup();
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.cells, [{ spreadsheetId: 'sheet-1', range: 'Sheet1!A1' }]);
  assert.deepEqual(log.tokens, ['tok']);
  assert.deepEqual(last(), { screen: 'briefing', text: 'Buy milk', email: 'ana@example.com' });
});

test('the app shows that it is checking access while it waits for the sheet', async () => {
  const { app, handlers, screens } = setup();
  await app.start();

  await handlers.signIn();

  assert.deepEqual(screens.at(-2), { screen: 'checking' });
});

test('an empty briefing cell shows a friendly message', async () => {
  const { app, handlers, last } = setup({ cell: async () => '' });
  await app.start();

  await handlers.signIn();

  assert.equal(last().text, 'empty');
});

test('after sign-in the email is remembered for a one-tap sign-in next time', async () => {
  const { app, handlers, session, log } = setup();
  await app.start();
  await handlers.signIn();
  await handlers.signOut();
  session.saveHint('ana@example.com');

  await handlers.signIn();

  assert.deepEqual(log.signIns, [{ hint: null }, { hint: 'ana@example.com' }]);
});

test('a person without access is signed out and told why', async () => {
  const { app, handlers, session, log, last } = setup({
    cell: async () => {
      throw new NoAccessError();
    },
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.revoked, ['tok']);
  assert.equal(session.getToken(), null);
  assert.equal(session.getHint(), null);
  assert.deepEqual(last(), { screen: 'login', message: 'noAccess' });
});

test('the email of a person without access is not remembered', async () => {
  const { app, handlers, session } = setup({
    cell: async () => {
      throw new NoAccessError();
    },
  });
  await app.start();

  await handlers.signIn();

  assert.equal(session.getHint(), null);
});

test('an expired sign-in sends the person back to the login page', async () => {
  const { app, handlers, session, last } = setup({
    cell: async () => {
      throw new SignInExpiredError();
    },
  });
  await app.start();

  await handlers.signIn();

  assert.equal(session.getToken(), null);
  assert.deepEqual(last(), { screen: 'login', message: 'expired' });
});

test('other problems show a general error and the person can try again', async () => {
  const { app, handlers, last } = setup({
    cell: async () => {
      throw new SheetsError('down', { status: 500 });
    },
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), { screen: 'login', message: 'error' });
});

test('a sign-in that does not finish shows a message and keeps the login page', async () => {
  const { app, handlers, log, last } = setup({
    signIn: async () => {
      throw new SignInFailedError('popup_closed');
    },
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.cells, []);
  assert.deepEqual(last(), { screen: 'login', message: 'signInFailed' });
});

test('a sign-in without the sheets permission explains what is missing', async () => {
  const { app, handlers, last } = setup({
    signIn: async () => {
      throw new PermissionMissingError();
    },
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), { screen: 'login', message: 'permissionMissing' });
});

test('if Google sign-in cannot load, the app says so', async () => {
  const { app, last } = setup({ authFails: true });

  await app.start();

  assert.deepEqual(last(), { screen: 'login', message: 'error' });
});

test('a token from earlier in this visit is used again without a new sign-in', async () => {
  const { app, session, log, last } = setup();
  session.saveToken({ token: 'old-tok', expiresAt: Date.now() + 3_600_000 });

  await app.start();

  assert.deepEqual(log.signIns, []);
  assert.deepEqual(log.tokens, ['old-tok']);
  assert.equal(last().screen, 'briefing');
});

test('signing out cancels the token, forgets the person and shows the login page', async () => {
  const { app, handlers, session, log, last } = setup();
  await app.start();
  await handlers.signIn();

  await handlers.signOut();

  assert.deepEqual(log.revoked, ['tok']);
  assert.equal(session.getToken(), null);
  assert.equal(session.getHint(), null);
  assert.deepEqual(last(), { screen: 'login', message: 'signedOut' });
});

// Storage that always fails, like in a browser that blocks it.
const brokenStorage = () => ({
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
  removeItem() {
    throw new Error('blocked');
  },
});

test('sign-in still works when the browser blocks storage', async () => {
  const { app, handlers, log, last } = setup({ storage: brokenStorage });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.tokens, ['tok']);
  assert.equal(last().screen, 'briefing');
});

test('after sign-in the app shows the account the person really chose', async () => {
  // Google suggested Ana's account, but the person chose Bob's account.
  const { app, handlers, session, last } = setup({ email: 'bob@example.com' });
  session.saveHint('ana@example.com');
  await app.start();

  await handlers.signIn();

  assert.equal(last().email, 'bob@example.com');
  assert.equal(session.getHint(), 'bob@example.com');
});

test('signing out cancels the token even while Google sign-in is still loading', async () => {
  let finishLoading;
  const { app, handlers, session, log, last } = setup({
    loadAuth: (auth) => new Promise((resolve) => (finishLoading = () => resolve(auth))),
  });
  session.saveToken({ token: 'old-tok', expiresAt: Date.now() + 3_600_000 });
  session.saveHint('ana@example.com');
  await app.start();

  const signingOut = handlers.signOut();
  finishLoading();
  await signingOut;

  assert.deepEqual(log.revoked, ['old-tok']);
  assert.deepEqual(last(), { screen: 'login', message: 'signedOut' });
});

test('after a network problem, the next tap tries again with the same sign-in', async () => {
  let fails = true;
  const { app, handlers, log, last } = setup({
    cell: async () => {
      if (fails) throw new SheetsError('offline');
      return 'Buy milk';
    },
  });
  await app.start();
  await handlers.signIn();
  assert.deepEqual(last(), { screen: 'login', message: 'error' });

  fails = false;
  await handlers.signIn();

  assert.equal(log.signIns.length, 1);
  assert.deepEqual(log.tokens, ['tok', 'tok']);
  assert.equal(last().screen, 'briefing');
});

test('a quick double tap opens only one Google sign-in window', async () => {
  const { app, handlers, log } = setup();
  await app.start();

  await Promise.all([handlers.signIn(), handlers.signIn()]);

  assert.equal(log.signIns.length, 1);
});
