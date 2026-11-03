import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../src/app.js';
import { createSession } from '../../src/session.js';
import { NoAccessError, SignInExpiredError, SheetsError } from '../../src/sheets.js';
import { SignInFailedError, PermissionMissingError } from '../../src/auth.js';

const config = {
  googleClientId: '1-client.apps.googleusercontent.com',
  googleApiKey: 'key-1',
  googleAppId: '1',
  spreadsheetId: 'sheet-1',
  pills: [
    { name: 'bank', cell: 'Sheet1!A1' },
    { name: 'cards', cell: 'Sheet1!A2' },
    { name: 'provisioned', cell: 'Sheet1!A3', subtract: true },
    { name: 'cash', cell: 'Sheet1!A4' },
  ],
  goal: {
    movements: 'Sheet2!A:E',
    sources: { Cash: 'cash' },
    from: '2026-10-01',
    to: '2026-12-31',
    limit: 3000,
    skip: { categories: ['Pay'], descriptions: { Home: ['Water'] } },
  },
  // The cells whose dropdown lists give the options of the new movement form.
  form: { sourceList: 'Sheet2!A2', categoryList: 'Sheet2!C2' },
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
  movements = async () => [['Cash', OCTOBER_5, 'Food', 'Shop', -12.5]],
  signIn = async () => ({ token: 'tok', expiresAt: Date.now() + 3_600_000 }),
  email = 'ana@example.com',
  authFails = false,
  appConfig = config,
  storage = memoryStorage,
  loadAuth,
  // What the person does in the Google file picker: true = picks the sheet, false = closes it.
  pick = async () => true,
  pickerFails = false,
  // What Google Drive says about editing the sheet: true, false, or it fails.
  canEdit = async () => false,
  // The options of the dropdown list in a cell.
  dropdown = async (cell) => (cell === 'Sheet2!A2' ? ['Bank', 'Cash'] : ['Car', 'House']),
} = {}) {
  const screens = [];
  const forms = [];
  const languages = [];
  const handlers = {};
  const view = {
    render: (state) => screens.push(state),
    setLanguage: (language) => languages.push(language),
    onSignIn: (handler) => (handlers.signIn = handler),
    onSignOut: (handler) => (handlers.signOut = handler),
    onTogglePill: (handler) => (handlers.togglePill = handler),
    onPickLanguage: (handler) => (handlers.pickLanguage = handler),
    onAdd: (handler) => (handlers.add = handler),
    openForm: (form) => forms.push(form),
  };
  const session = createSession({
    sessionStorage: storage(),
    localStorage: storage(),
  });
  const log = {
    signIns: [],
    revoked: [],
    cells: [],
    values: [],
    tokens: [],
    picks: [],
    edits: 0,
    dropdowns: [],
  };
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
    loadPicker: async () => {
      if (pickerFails) throw new Error('script_not_loaded');
      return {
        pickSheet: async (token) => {
          log.picks.push(token);
          return pick();
        },
      };
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
      canEdit: async () => {
        log.edits += 1;
        return canEdit();
      },
      getDropdown: async (cell) => {
        log.dropdowns.push(cell);
        return dropdown(cell);
      },
    }),
  });
  const last = () => screens.at(-1);
  return { app, session, screens, languages, handlers, log, last, forms };
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
    { spreadsheetId: 'sheet-1', range: 'Sheet2!A:E', options: { raw: true } },
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
    goal: {
      amount: 12.5,
      level: 'ok',
      limit: 3000,
      months: [
        {
          year: 2026,
          month: 10,
          amount: 12.5,
          days: [
            {
              day: 5,
              movements: [{ category: 'Food', description: 'Shop', amount: 12.5, source: 'cash' }],
            },
          ],
        },
        { year: 2026, month: 11, amount: null, days: [] },
        { year: 2026, month: 12, amount: null, days: [] },
      ],
    },
    canAdd: false,
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

  assert.deepEqual(log.picks, ['tok']);
  assert.equal(log.cells.length, 2);
  // Cancelling the token at Google would also take back the pick the person just made.
  assert.deepEqual(log.revoked, []);
  assert.equal(session.getToken(), null);
  assert.equal(session.getHint(), null);
  assert.deepEqual(last(), { screen: 'login', message: 'noAccess' });
});

test('the first time, the person picks the sheet in the Google picker and sees the total', async () => {
  let picked = false;
  const { app, handlers, session, log, last } = setup({
    cells: async () => {
      if (!picked) throw new NoAccessError();
      return [1, 2, 3, 4];
    },
    pick: async () => (picked = true),
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.picks, ['tok']);
  assert.deepEqual(log.revoked, []);
  assert.equal(session.getHint(), 'ana@example.com');
  assert.equal(last().screen, 'main');
});

test('closing the Google picker signs the person out and says to pick the sheet', async () => {
  const { app, handlers, session, log, last } = setup({
    cells: async () => {
      throw new NoAccessError();
    },
    pick: async () => false,
  });
  await app.start();

  await handlers.signIn();

  assert.equal(log.cells.length, 1);
  assert.deepEqual(log.revoked, ['tok']);
  assert.equal(session.getToken(), null);
  assert.deepEqual(last(), { screen: 'login', message: 'notPicked' });
});

test('when the Google picker cannot load, the sign-in is kept for the next try', async () => {
  const { app, handlers, session, log, last } = setup({
    cells: async () => {
      throw new NoAccessError();
    },
    pickerFails: true,
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.revoked, []);
  assert.equal(session.getToken(), 'tok');
  assert.deepEqual(last(), { screen: 'login', message: 'error' });
});

test('a person who cannot read the movements is signed out too', async () => {
  const { app, handlers, session, log, last } = setup({
    movements: async () => {
      throw new NoAccessError();
    },
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.revoked, []);
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

// Cancelling the token at Google would also take back the sheet the person picked, and they
// would have to pick it again at every sign-in.
test('signing out forgets the person on this phone and shows the login page', async () => {
  const { app, handlers, session, log, last } = setup();
  await app.start();
  await handlers.signIn();

  await handlers.signOut();

  assert.deepEqual(log.revoked, []);
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

test('a language picked with the flag button is shown at once and kept on this phone', async () => {
  const { app, session, languages, handlers, log } = setup();
  await app.start();
  await handlers.signIn();
  const reads = log.cells.length;

  handlers.pickLanguage('es');

  assert.deepEqual(languages, ['es']);
  assert.equal(session.getLanguage(), 'es');
  // The words change, the numbers stay: the sheet is not read again.
  assert.equal(log.cells.length, reads);
});

// Waits until the work the app started in the background has finished.
const settle = () => new Promise((done) => setTimeout(done, 0));

test('a person who can edit the sheet may add movements', async () => {
  const { app, handlers, log, last } = setup({ canEdit: async () => true });
  await app.start();

  await handlers.signIn();

  assert.equal(log.edits, 1);
  assert.equal(last().screen, 'main');
  assert.equal(last().canAdd, true);
});

test('a person who can only view the sheet may not add movements', async () => {
  const { app, handlers, last } = setup({ canEdit: async () => false });
  await app.start();

  await handlers.signIn();

  assert.equal(last().screen, 'main');
  assert.equal(last().canAdd, false);
});

test('when Google cannot say if the person can edit, the app works but adds nothing', async () => {
  const { app, handlers, last } = setup({
    canEdit: async () => {
      throw new SheetsError('Could not reach Google.');
    },
  });
  await app.start();

  await handlers.signIn();

  assert.equal(last().screen, 'main');
  assert.equal(last().total, 549.5);
  assert.equal(last().canAdd, false);
});

test('for a person who can edit, the lists of the form load in the background', async () => {
  const { app, handlers, log } = setup({ canEdit: async () => true });
  await app.start();

  await handlers.signIn();
  await settle();

  assert.deepEqual(log.dropdowns.sort(), ['Sheet2!A2', 'Sheet2!C2']);
});

test('for a person who can only view, the lists of the form are never read', async () => {
  const { app, handlers, log } = setup({ canEdit: async () => false });
  await app.start();

  await handlers.signIn();
  await settle();

  assert.deepEqual(log.dropdowns, []);
});

test('after signing out and in again, the lists of the form are read again', async () => {
  const { app, handlers, log } = setup({ canEdit: async () => true });
  await app.start();
  await handlers.signIn();
  await settle();

  handlers.signOut();
  await handlers.signIn();
  await settle();

  // The sheet's dropdowns may have changed: the lists are not kept from the first sign-in.
  assert.equal(log.dropdowns.length, 4);
});

test('a tap on "+" opens the form with the source and category lists of the sheet', async () => {
  const { app, handlers, log, forms } = setup({ canEdit: async () => true });
  await app.start();
  await handlers.signIn();

  await handlers.add();

  assert.deepEqual(forms, [{ sources: ['Bank', 'Cash'], categories: ['Car', 'House'] }]);
  // The lists loaded in the background are used: they are not read again.
  assert.equal(log.dropdowns.length, 2);
});

test('when the lists cannot be read, the form opens with a message', async () => {
  const { app, handlers, forms } = setup({
    canEdit: async () => true,
    dropdown: async () => {
      throw new SheetsError('Could not reach Google.');
    },
  });
  await app.start();
  await handlers.signIn();

  await handlers.add();

  assert.deepEqual(forms, [{ failed: true }]);
});

test('after the lists could not be read, the next tap on "+" tries again', async () => {
  let online = false;
  const { app, handlers, forms } = setup({
    canEdit: async () => true,
    dropdown: async (cell) => {
      if (!online) throw new SheetsError('Could not reach Google.');
      return cell === 'Sheet2!A2' ? ['Cash'] : ['Car'];
    },
  });
  await app.start();
  await handlers.signIn();
  await handlers.add();

  online = true;
  await handlers.add();

  assert.deepEqual(forms, [{ failed: true }, { sources: ['Cash'], categories: ['Car'] }]);
});
