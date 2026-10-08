import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../src/app.js';
import { createSession } from '../../src/session.js';
import { NoAccessError, SignInExpiredError, SheetsError } from '../../src/sheets.js';
import { SignInFailedError, PermissionMissingError } from '../../src/auth.js';

const config = {
  googleClientId: 'client-1.apps.googleusercontent.com',
  spreadsheetId: 'sheet-1',
  pills: [
    { name: 'bank', cell: 'Sheet1!A1' },
    { name: 'cards', cell: 'Sheet1!A2' },
    { name: 'provisioned', cell: 'Sheet1!A3', subtract: true },
    { name: 'cash', cell: 'Sheet1!A4' },
  ],
  goal: {
    movements: 'Sheet2!B:E',
    from: '2026-10-01',
    to: '2026-12-31',
    limit: 3000,
    skip: { categories: ['Pay'], house: { category: 'Home', descriptions: ['Water'] } },
  },
};

// 5 October 2026 as the sheet sends it: days since 30 December 1899.
const OCTOBER_5 = 46300;

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
  cells = async () => [1000, -200.5, 300, 50],
  movements = async () => [[OCTOBER_5, 'Food', 'Shop', -12.5]],
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
    onTogglePill: (handler) => (handlers.togglePill = handler),
  };
  const session = createSession({
    sessionStorage: storage(),
    localStorage: storage(),
  });
  const log = { signIns: [], revoked: [], cells: [], values: [], tokens: [] };
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
    loadAuth: loadAuth
      ? () => loadAuth(auth)
      : async () => {
          if (authFails) throw new SignInFailedError('script_not_loaded');
          return auth;
        },
    createSheets: ({ spreadsheetId, getToken }) => ({
      getCells: async (ranges) => {
        log.cells.push({ spreadsheetId, ranges });
        log.tokens.push(getToken());
        return cells(ranges);
      },
      getValues: async (range, options) => {
        log.values.push({ spreadsheetId, range, options });
        return movements(range);
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

test('a person with access sees the total after sign-in', async () => {
  const { app, handlers, log, last } = setup();
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.cells, [
    { spreadsheetId: 'sheet-1', ranges: ['Sheet1!A1', 'Sheet1!A2', 'Sheet1!A3', 'Sheet1!A4'] },
  ]);
  assert.deepEqual(log.tokens, ['tok']);
  assert.deepEqual(log.values, [
    { spreadsheetId: 'sheet-1', range: 'Sheet2!B:E', options: { raw: true } },
  ]);
  assert.deepEqual(last(), {
    screen: 'main',
    // 1000 - 200.50 - 300 (provisioned is taken away) + 50
    total: 549.5,
    pills: [
      { name: 'bank', amount: 1000, on: true },
      { name: 'cards', amount: -200.5, on: true },
      { name: 'provisioned', amount: 300, on: true },
      { name: 'cash', amount: 50, on: true },
    ],
    goal: { amount: 12.5, level: 'ok' },
  });
});

test('switching a part of the Total off takes it out of the Total, and it is remembered', async () => {
  const { app, handlers, session, last } = setup();
  await app.start();
  await handlers.signIn();

  handlers.togglePill('cash');

  assert.equal(last().total, 499.5);
  assert.deepEqual(last().pills.at(-1), { name: 'cash', amount: 50, on: false });
  assert.deepEqual(session.getSwitchedOff(), ['cash']);

  handlers.togglePill('cash');

  assert.equal(last().total, 549.5);
  assert.deepEqual(session.getSwitchedOff(), []);
});

test('switching off a part that is taken away adds it back to the Total', async () => {
  const { app, handlers, last } = setup();
  await app.start();
  await handlers.signIn();

  handlers.togglePill('provisioned');

  assert.equal(last().total, 849.5);
});

test('parts switched off on an earlier visit stay off', async () => {
  const { app, handlers, session, last } = setup();
  session.saveSwitchedOff(['bank', 'cash']);
  await app.start();

  await handlers.signIn();

  assert.equal(last().total, -500.5);
  assert.deepEqual(
    last().pills.map(({ on }) => on),
    [false, true, true, false],
  );
});

test('the app shows that it is checking access while it waits for the sheet', async () => {
  const { app, handlers, screens } = setup();
  await app.start();

  await handlers.signIn();

  assert.deepEqual(screens.at(-2), { screen: 'checking' });
});

test('a cell that is empty or not a number counts as 0', async () => {
  const { app, handlers, last } = setup({ cells: async () => [100, '', 'n/a', 5] });
  await app.start();

  await handlers.signIn();

  assert.equal(last().total, 105);
  assert.deepEqual(
    last().pills.map(({ amount }) => amount),
    [100, 0, 0, 5],
  );
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
    cells: async () => {
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

test('a person who cannot read the movements is signed out too', async () => {
  const { app, handlers, session, log, last } = setup({
    movements: async () => {
      throw new NoAccessError();
    },
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.revoked, ['tok']);
  assert.equal(session.getToken(), null);
  assert.deepEqual(last(), { screen: 'login', message: 'noAccess' });
});

test('the email of a person without access is not remembered', async () => {
  const { app, handlers, session } = setup({
    cells: async () => {
      throw new NoAccessError();
    },
  });
  await app.start();

  await handlers.signIn();

  assert.equal(session.getHint(), null);
});

test('an expired sign-in sends the person back to the login page', async () => {
  const { app, handlers, session, last } = setup({
    cells: async () => {
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
    cells: async () => {
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
  assert.equal(last().screen, 'main');
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
  assert.equal(last().screen, 'main');
});

test('after sign-in the app remembers the account the person really chose', async () => {
  // Google suggested Ana's account, but the person chose Bob's account.
  const { app, handlers, session } = setup({ email: 'bob@example.com' });
  session.saveHint('ana@example.com');
  await app.start();

  await handlers.signIn();

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
    cells: async () => {
      if (fails) throw new SheetsError('offline');
      return [1, 2, 3, 4];
    },
  });
  await app.start();
  await handlers.signIn();
  assert.deepEqual(last(), { screen: 'login', message: 'error' });

  fails = false;
  await handlers.signIn();

  assert.equal(log.signIns.length, 1);
  assert.deepEqual(log.tokens, ['tok', 'tok']);
  assert.equal(last().screen, 'main');
});

test('a quick double tap opens only one Google sign-in window', async () => {
  const { app, handlers, log } = setup();
  await app.start();

  await Promise.all([handlers.signIn(), handlers.signIn()]);

  assert.equal(log.signIns.length, 1);
});
