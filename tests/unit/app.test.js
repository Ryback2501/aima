import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../src/app.js';
import { createSession } from '../../src/session.js';
import {
  NoAccessError,
  NoSuchSheetError,
  SignInExpiredError,
  SheetsError,
} from '../../src/sheets.js';
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
  // The dates, the limit and the left-out movements come from the App sheet (issue #125).
  goal: { movements: 'Sheet2!A:E' },
  // The cells whose dropdown lists give the options of the new movement form.
  form: { sourceList: 'Sheet2!A2', categoryList: 'Sheet2!C2', sheet: 'Sheet2', firstRow: 2 },
  // The sheet with the app's settings (issue #122).
  appSheet: 'App',
};

// 5 October 2026 as the sheet sends it: days since 30 December 1899.
const OCTOBER_5 = 46300;

// A date cell of the App sheet, as the sheets client gives it (issue #125): its day number and
// the text the sheet shows.
const dateCell = (day, text) => ({ day, text });

// The GOAL and GOAL LEAVE OUT tables of the tests (issue #125), side by side: the goal from
// 1 October to 31 December 2026, with a limit of 3000, that leaves out the category Pay and the
// Home movements called Water.
const OCTOBER_1 = dateCell(OCTOBER_5 - 4, '1/10/2026');
const DECEMBER_31 = dateCell(OCTOBER_5 + 87, '31/12/2026');
const GOAL_TABLES = [
  ['GOAL', '', '', 'GOAL LEAVE OUT'],
  ['Setting', 'Value', '', 'Category', 'Description'],
  ['From', OCTOBER_1, '', 'Pay'],
  ['To', DECEMBER_31, '', 'Home', 'Water'],
  ['Limit', 3000],
];

// An App sheet of the tests with the goal tables on the right of its cells, after one empty
// column. From issue #125, both goal tables are required.
function withGoal(rows, tables = GOAL_TABLES) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return Array.from({ length: Math.max(rows.length, tables.length) }, (_, index) => {
    const row = rows[index] ?? [];
    return [...row, ...new Array(width + 1 - row.length).fill(''), ...(tables[index] ?? [])];
  });
}

// An App sheet with its CATEGORIES table (issue #123), its SOURCES table (issue #124) and its
// goal tables: from then on all of them are required.
const CATEGORIES_AND_SOURCES = [
  ['CATEGORIES', '', '', '', '', 'SOURCES'],
  ['Category', 'Description has', 'Icon', 'Color', '', 'Source', 'Icon', 'Paired with'],
  ['Food', '', 'cart', '#2b8a3e', '', 'Bank'],
  ['', '', '', '', '', 'Cash', 'cash'],
];
const APP_SHEET = withGoal(CATEGORIES_AND_SOURCES);

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
  // The movement rows as the save reads them (formulas kept), from the first movement row.
  formulas = async () => [['Cash', OCTOBER_5, 'Food', 'Shop', -12.5]],
  // The number and the size of the movements sheet.
  sheet = async () => ({ sheetId: 7, rowCount: 100 }),
  // What happens when rows are written.
  write = async () => {},
  // The rows of the App sheet, as Google sends them (issue #122), with its CATEGORIES table.
  appRows = async () => APP_SHEET,
  // Parts of the view that work differently in a test, for example one that breaks.
  viewChanges = {},
} = {}) {
  const screens = [];
  const forms = [];
  // What the form showed: the missing fields of each Save, the saving state, the failures and
  // the closings after a save.
  const formLog = { missing: [], saving: [], failed: 0, closed: 0, changed: 0 };
  // What the delete panel showed: the deleting state, and each result in order.
  const deleteLog = { deleting: [], events: [] };
  // Everything the form and the delete panel showed, in order, with the spinner and the icon
  // that ends it (issue #108).
  const order = [];
  // How many screens were shown when the thumbs-up or the warning came.
  const ends = { screens: null };
  const languages = [];
  const handlers = {};
  const view = {
    render: (state) => {
      screens.push(state);
      if (state.screen === 'mistakes') order.push('mistakes');
    },
    setLanguage: (language) => languages.push(language),
    onSignIn: (handler) => (handlers.signIn = handler),
    onSignOut: (handler) => (handlers.signOut = handler),
    onTogglePill: (handler) => (handlers.togglePill = handler),
    onPickLanguage: (handler) => (handlers.pickLanguage = handler),
    onAdd: (handler) => (handlers.add = handler),
    openForm: (form) => forms.push(form),
    onSave: (handler) => (handlers.save = handler),
    showMissing: (names) => formLog.missing.push(names),
    setSaving: (saving) => {
      formLog.saving.push(saving);
      if (saving) order.push('spinner');
    },
    saveFailed: () => {
      formLog.failed += 1;
      order.push('not saved message');
    },
    closeForm: () => {
      formLog.closed += 1;
      order.push('form closes');
    },
    onEdit: (handler) => (handlers.edit = handler),
    saveChanged: () => {
      formLog.changed += 1;
      order.push('changed message');
    },
    onDelete: (handler) => (handlers.delete = handler),
    setDeleting: (deleting) => {
      deleteLog.deleting.push(deleting);
      if (deleting) order.push('spinner');
    },
    deleteChanged: () => {
      deleteLog.events.push('changed');
      order.push('changed message');
    },
    deleteFailed: () => {
      deleteLog.events.push('failed');
      order.push('not deleted message');
    },
    // The spinner ends with the thumbs-up (ok) or the warning, and the view waits for it.
    // With leave, the content of the panel does not come back after the warning (issue #122).
    workDone: async (ok, { leave = false } = {}) => {
      order.push(ok ? 'thumbs-up' : `warning${leave ? ', the content stays hidden' : ''}`);
      ends.screens = screens.length;
    },
    deleted: async () => {
      deleteLog.events.push('deleted');
      order.push('movements go');
      deleteLog.screensBefore = screens.length;
    },
    ...viewChanges,
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
    writes: [],
    // The reads of the sheet, in the order they started: 'app', 'cells' or 'values'.
    reads: [],
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
      getSheetRows: async (name) => {
        log.reads.push(`app ${name}`);
        return appRows(name);
      },
      getCells: async (ranges) => {
        log.reads.push('cells');
        log.cells.push({ spreadsheetId, ranges });
        log.tokens.push(getToken());
        return cells(ranges);
      },
      getValues: async (range, options) => {
        log.reads.push('values');
        log.values.push({ spreadsheetId, range, options });
        return options?.formulas ? formulas(range) : movements(range);
      },
      getSheet: async (name) => {
        log.sheets = [...(log.sheets ?? []), name];
        return sheet(name);
      },
      writeRows: async (change) => {
        log.writes.push(change);
        return write(change);
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
  return {
    app,
    session,
    screens,
    languages,
    handlers,
    log,
    last,
    forms,
    formLog,
    deleteLog,
    order,
    ends,
  };
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
          all: 12.5,
          days: [
            {
              day: 5,
              movements: [
                {
                  category: 'Food',
                  description: 'Shop',
                  amount: 12.5,
                  source: 'cash',
                  row: 0,
                  // Its look, from the CATEGORIES table of the App sheet (issue #123).
                  icon: 'cart',
                  color: '#2b8a3e',
                },
              ],
            },
          ],
        },
        { year: 2026, month: 11, amount: null, all: null, days: [] },
        { year: 2026, month: 12, amount: null, all: null, days: [] },
      ],
    },
    canAdd: false,
  });
});

test('the goal card also gets the movements the goal leaves out, marked, with the same goal number', async () => {
  const { app, handlers, last } = setup({
    movements: async () => [
      ['Cash', OCTOBER_5, 'Food', 'Shop', -12.5],
      ['Cash', OCTOBER_5, 'Pay', 'Salary', 2500],
    ],
  });
  await app.start();

  await handlers.signIn();

  const { goal } = last();
  assert.equal(goal.amount, 12.5);
  const [october] = goal.months;
  assert.equal(october.amount, 12.5);
  // All the spending of October: 12.50 spent, and 2,500 came in.
  assert.equal(october.all, -2487.5);
  assert.deepEqual(october.days, [
    {
      day: 5,
      movements: [
        {
          category: 'Food',
          description: 'Shop',
          amount: 12.5,
          source: 'cash',
          row: 0,
          // Its look, from the CATEGORIES table of the App sheet (issue #123).
          icon: 'cart',
          color: '#2b8a3e',
        },
        {
          category: 'Pay',
          description: 'Salary',
          amount: -2500,
          source: 'cash',
          row: 1,
          leftOut: true,
          // Pay is not in the CATEGORIES table: the grey money bag.
          icon: 'sackEuro',
          color: '#4b5563',
        },
      ],
    },
  ]);
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

// A movement filled in the form: the amount is the typed numbers, the last two are the cents.
const filled = {
  source: 'Cash',
  date: '2026-10-05',
  category: 'Food',
  concept: '  Bakery  ',
  digits: '1250',
  sign: 'minus',
};

async function signedInEditor(options = {}) {
  const parts = setup({ canEdit: async () => true, ...options });
  await parts.app.start();
  await parts.handlers.signIn();
  return parts;
}

test('Save with empty required fields says which ones, and writes nothing', async () => {
  const { handlers, log, formLog } = await signedInEditor();

  await handlers.save({ ...filled, source: '', digits: '' });

  assert.deepEqual(formLog.missing, [['source', 'amount']]);
  assert.deepEqual(log.writes, []);
  assert.equal(formLog.closed, 0);
});

test('Save writes the movement sorted with its day and the later days, from its first row', async () => {
  const { handlers, log } = await signedInEditor({
    formulas: async () => [
      ['Cash', OCTOBER_5 - 1, 'Food', 'Old', -1],
      ['Cash', OCTOBER_5, 'Food', 'Shop', -12.5],
      ['Bank', OCTOBER_5 + 1, 'Food', 'Later', -3],
    ],
  });

  await handlers.save({ ...filled, source: 'Bank' });

  assert.deepEqual(log.sheets, ['Sheet2']);
  // The save reads the rows again, with their formulas, just before writing.
  assert.ok(log.values.some(({ range, options }) => range === 'Sheet2!A2:E' && options.formulas));
  assert.deepEqual(log.writes, [
    {
      sheetId: 7,
      rowCount: 100,
      // The 3rd row of the sheet (counted from 0: row 2), where the day of the movement starts.
      startRow: 2,
      rows: [
        ['Bank', OCTOBER_5, 'Food', 'Bakery', -12.5],
        ['Cash', OCTOBER_5, 'Food', 'Shop', -12.5],
        ['Bank', OCTOBER_5 + 1, 'Food', 'Later', -3],
      ],
    },
  ]);
});

test('after saving, the Total and the goal are read again, and the form closes', async () => {
  const { handlers, log, formLog, last } = await signedInEditor();
  const reads = log.cells.length;

  await handlers.save(filled);

  assert.equal(log.cells.length, reads + 1);
  assert.equal(last().screen, 'main');
  assert.equal(formLog.closed, 1);
  assert.equal(formLog.failed, 0);
  assert.deepEqual(formLog.missing, [[]]);
});

test('while saving, Save and Cancel are blocked, and a second Save writes nothing more', async () => {
  let finish;
  const { handlers, log, formLog } = await signedInEditor({
    write: () => new Promise((done) => (finish = done)),
  });

  const first = handlers.save(filled);
  await settle();
  await handlers.save(filled);
  finish();
  await first;

  assert.equal(log.writes.length, 1);
  assert.deepEqual(formLog.saving, [true, false]);
  assert.equal(formLog.closed, 1);
});

test('when saving fails, the form stays open and says so, and the next Save writes once', async () => {
  let online = false;
  const { handlers, log, formLog } = await signedInEditor({
    write: async () => {
      if (!online) throw new SheetsError('Could not reach Google.');
    },
  });

  await handlers.save(filled);

  assert.equal(formLog.failed, 1);
  assert.equal(formLog.closed, 0);

  online = true;
  await handlers.save(filled);

  assert.equal(log.writes.length, 2);
  assert.equal(formLog.failed, 1);
  assert.equal(formLog.closed, 1);
});

test('when the save worked but the sheet cannot be read again, the form still closes', async () => {
  let saved = false;
  const { handlers, formLog } = await signedInEditor({
    cells: async () => {
      if (saved) throw new SheetsError('Could not reach Google.');
      return [1000, -200.5, 300, 50];
    },
    write: async () => (saved = true),
  });

  await handlers.save(filled);

  // The movement is in the sheet: saying "not saved" would make the person save it twice.
  assert.equal(formLog.failed, 0);
  assert.equal(formLog.closed, 1);
});

// Issue #108: the spinner while saving, then the thumbs-up or the warning.
test('a saved movement shows the spinner, then the thumbs-up after the sheet is read again, then the form closes', async () => {
  const { handlers, order, ends, screens } = await signedInEditor();
  const before = screens.length;

  await handlers.save(filled);

  assert.deepEqual(order, ['spinner', 'thumbs-up', 'form closes']);
  // The list is already read again while the thumbs-up shows.
  assert.equal(ends.screens, before + 1);
});

test('a movement that is not saved shows the spinner, then the message is set, then the warning', async () => {
  const { handlers, order } = await signedInEditor({
    write: async () => {
      throw new SheetsError('Could not reach Google.');
    },
  });

  await handlers.save(filled);

  assert.deepEqual(order, ['spinner', 'not saved message', 'warning']);
});

test('when the save worked but the sheet cannot be read again, the thumbs-up shows as usual', async () => {
  let saved = false;
  const { handlers, order } = await signedInEditor({
    cells: async () => {
      if (saved) throw new SheetsError('Could not reach Google.');
      return [1000, -200.5, 300, 50];
    },
    write: async () => (saved = true),
  });

  await handlers.save(filled);

  assert.deepEqual(order, ['spinner', 'thumbs-up', 'form closes']);
});

test('Save with an empty required field shows no spinner', async () => {
  const { handlers, order } = await signedInEditor();

  await handlers.save({ ...filled, source: '' });

  assert.deepEqual(order, []);
});

test('a concept typed with "=" at the start is saved as text, never as a formula', async () => {
  const { handlers, log } = await signedInEditor({ formulas: async () => [] });

  await handlers.save({ ...filled, concept: '= dinner' });

  assert.deepEqual(log.writes[0].rows, [['Cash', OCTOBER_5, 'Food', { text: '= dinner' }, -12.5]]);
});

// The movements sheet for the delete tests, as the goal reads it (the headers first) and as the
// delete reads it again with its formulas (from the first movement row).
const HEADERS = ['Source', 'Date', 'Category', 'Concept', 'Amount'];
const mv = (concept, amount, day = OCTOBER_5) => ['Cash', day, 'Food', concept, amount];
const sheetRows = [mv('A', -1), mv('B', -2), mv('C', -3), mv('D', -4)];
const deleteSheet = (rows = sheetRows) => ({
  movements: async () => [HEADERS, ...rows],
  formulas: async () => rows,
});
// The goal's movements on the main screen, by concept, as the last screen shows them.
const shown = (screen) =>
  screen.goal.months.flatMap(({ days }) =>
    days.flatMap(({ movements }) => movements.map(({ description }) => description)),
  );

test('Yes reads the rows again and moves the movements below the deleted ones up, in one write', async () => {
  const { handlers, log } = await signedInEditor(deleteSheet());

  // B and D: rows 2 and 4 of the rows the goal read (the headers are row 0).
  await handlers.delete([2, 4]);

  // The movements are read again just before writing, with their formulas.
  assert.ok(log.values.some(({ range, options }) => range === 'Sheet2!A2:E' && options.formulas));
  assert.deepEqual(log.writes, [
    {
      sheetId: 7,
      rowCount: 100,
      // From B, the 3rd row of the sheet (counted from 0: row 2).
      startRow: 2,
      rows: [mv('C', -3), ['', '', '', '', ''], ['', '', '', '', '']],
    },
  ]);
});

test('after deleting, the goal is read again and shown after the deleted rows went away', async () => {
  let rows = sheetRows;
  const { handlers, deleteLog, screens, last } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
    write: async () => (rows = [mv('A', -1), mv('C', -3), mv('D', -4)]),
  });

  await handlers.delete([2]);

  assert.deepEqual(deleteLog.events, ['deleted']);
  assert.deepEqual(deleteLog.deleting, [true, false]);
  // The new goal shows only after the view has taken the deleted rows away.
  assert.equal(screens.length, deleteLog.screensBefore + 1);
  assert.deepEqual(shown(last()), ['A', 'C', 'D']);
  assert.equal(last().goal.amount, 8);
});

test('when the sheet cannot be read after deleting, the goal still shows without them', async () => {
  let deleted = false;
  const { handlers, deleteLog, last } = await signedInEditor({
    ...deleteSheet(),
    cells: async () => {
      if (deleted) throw new SheetsError('Could not reach Google.');
      return [1000, -200.5, 300, 50];
    },
    write: async () => (deleted = true),
  });

  await handlers.delete([1, 3]);

  assert.deepEqual(deleteLog.events, ['deleted']);
  assert.deepEqual(shown(last()), ['B', 'D']);
  assert.equal(last().goal.amount, 6);
});

test('when a selected row holds another movement now, nothing is deleted and the sheet is read again', async () => {
  let rows = sheetRows;
  const { handlers, log, deleteLog, last } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
  });
  // Somebody changes the sheet by hand: a new movement where C was.
  rows = [mv('A', -1), mv('B', -2), mv('New', -9), mv('D', -4)];
  const reads = log.cells.length;

  await handlers.delete([2, 3]);

  assert.deepEqual(log.writes, []);
  assert.deepEqual(deleteLog.events, ['changed']);
  assert.equal(log.cells.length, reads + 1);
  assert.deepEqual(shown(last()), ['A', 'B', 'New', 'D']);
});

test('when the delete fails, the panel says so, and the next Yes deletes once', async () => {
  let online = false;
  const { handlers, log, deleteLog } = await signedInEditor({
    ...deleteSheet(),
    write: async () => {
      if (!online) throw new SheetsError('Could not reach Google.');
    },
  });

  await handlers.delete([1]);

  assert.deepEqual(deleteLog.events, ['failed']);

  online = true;
  await handlers.delete([1]);

  assert.equal(log.writes.length, 2);
  assert.deepEqual(deleteLog.events, ['failed', 'deleted']);
});

test('when the rows cannot be read again before deleting, nothing is deleted', async () => {
  let online = true;
  const { handlers, log, deleteLog } = await signedInEditor({
    ...deleteSheet(),
    formulas: async () => {
      if (!online) throw new SheetsError('Could not reach Google.');
      return sheetRows;
    },
  });
  online = false;

  await handlers.delete([1]);

  assert.deepEqual(log.writes, []);
  assert.deepEqual(deleteLog.events, ['failed']);
});

test('while deleting, a second Yes deletes nothing more', async () => {
  let finish;
  const { handlers, log, deleteLog } = await signedInEditor({
    ...deleteSheet(),
    write: () => new Promise((done) => (finish = done)),
  });

  const first = handlers.delete([1]);
  await settle();
  await handlers.delete([1]);
  finish();
  await first;

  assert.equal(log.writes.length, 1);
  assert.deepEqual(deleteLog.deleting, [true, false]);
  assert.deepEqual(deleteLog.events, ['deleted']);
});

test('a moved text that starts with "=" stays text, and a moved formula stays a formula', async () => {
  // The formula read gives the text "=Gift" and the formula "=2*3" the same way. The plain read
  // tells them apart: the text is the same there, the formula gives its result.
  const plain = [mv('A', -1), mv('=Gift', -2), ['Cash', OCTOBER_5, 'Food', 'C', 6]];
  const formulas = [mv('A', -1), mv('=Gift', -2), ['Cash', OCTOBER_5, 'Food', 'C', '=2*3']];
  const { handlers, log } = await signedInEditor({
    movements: async () => [HEADERS, ...plain],
    formulas: async () => formulas,
  });

  await handlers.delete([1]);

  assert.deepEqual(log.writes[0].rows, [
    ['Cash', OCTOBER_5, 'Food', { text: '=Gift' }, -2],
    ['Cash', OCTOBER_5, 'Food', 'C', '=2*3'],
    ['', '', '', '', ''],
  ]);
});

// The movements sheet for the edit tests, as the goal reads it (the headers first) and as the
// save reads it again with its formulas (from the first movement row).
const editRows = [mv('A', -1), mv('B', -2), mv('C', -3, OCTOBER_5 + 1)];
const editSheet = (rows = editRows) => ({
  movements: async () => [HEADERS, ...rows],
  formulas: async () => rows,
});
// What the form shows for a movement row: the values to fill it in with.
const valuesOf = ([source, date, category, concept, amount]) => ({
  source,
  date: date === OCTOBER_5 ? '2026-10-05' : '2026-10-06',
  category,
  concept,
  digits: String(Math.abs(Math.round(amount * 100))),
  sign: amount < 0 ? 'minus' : 'plus',
});

test('Edit opens the form filled in with the movement, as the sheet has it', async () => {
  const { handlers, forms } = await signedInEditor(editSheet());

  // B: row 2 of the rows the goal read (the headers are row 0).
  await handlers.edit(2);

  assert.deepEqual(forms.at(-1), {
    sources: ['Bank', 'Cash'],
    categories: ['Car', 'House'],
    edit: { values: valuesOf(mv('B', -2)), extraDecimals: false },
  });
});

test('Edit says when the amount has more than two decimals', async () => {
  const { handlers, forms } = await signedInEditor(editSheet([mv('A', -12.345)]));

  await handlers.edit(1);

  assert.deepEqual(forms.at(-1).edit, {
    values: { ...valuesOf(mv('A', -12.34)) },
    extraDecimals: true,
  });
});

test('Save after Edit reads the rows again and writes the change in its place, in one write', async () => {
  const { handlers, log, formLog } = await signedInEditor(editSheet());
  await handlers.edit(2);

  await handlers.save({ ...valuesOf(mv('B', -2)), concept: 'Bee', digits: '250' });

  assert.ok(log.values.some(({ range, options }) => range === 'Sheet2!A2:E' && options.formulas));
  assert.deepEqual(log.writes, [
    {
      sheetId: 7,
      rowCount: 100,
      // From A, the first movement of the day of B (the 2nd row of the sheet, 1 counted from 0).
      startRow: 1,
      rows: [mv('A', -1), mv('Bee', -2.5), mv('C', -3, OCTOBER_5 + 1)],
    },
  ]);
  assert.equal(formLog.closed, 1);
});

test('Save after Edit with nothing changed closes the form and writes nothing', async () => {
  const { handlers, log, formLog } = await signedInEditor(editSheet());
  await handlers.edit(1);
  const reads = log.values.length;

  await handlers.save({ ...valuesOf(mv('A', -1)), concept: ' A ' });

  assert.deepEqual(log.writes, []);
  assert.equal(log.values.length, reads);
  assert.equal(formLog.closed, 1);
});

test('when the edited row holds another movement now, nothing is saved and the sheet is read again', async () => {
  let rows = editRows;
  const { handlers, log, formLog, last } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
  });
  await handlers.edit(2);
  // Somebody changes the sheet by hand: a new movement where B was.
  rows = [mv('A', -1), mv('New', -9), mv('C', -3, OCTOBER_5 + 1)];
  const reads = log.cells.length;

  await handlers.save({ ...valuesOf(mv('B', -2)), concept: 'Bee' });

  assert.deepEqual(log.writes, []);
  assert.equal(formLog.changed, 1);
  assert.equal(formLog.closed, 0);
  assert.equal(log.cells.length, reads + 1);
  assert.deepEqual(shown(last()), ['C', 'A', 'New']);
});

test('when the change cannot be written, the form says so, and the next Save writes once', async () => {
  let online = false;
  const { handlers, log, formLog } = await signedInEditor({
    ...editSheet(),
    write: async () => {
      if (!online) throw new SheetsError('Could not reach Google.');
    },
  });
  await handlers.edit(1);

  await handlers.save({ ...valuesOf(mv('A', -1)), concept: 'Ay' });

  assert.equal(formLog.failed, 1);
  assert.equal(formLog.closed, 0);

  online = true;
  await handlers.save({ ...valuesOf(mv('A', -1)), concept: 'Ay' });

  assert.equal(log.writes.length, 2);
  assert.equal(formLog.closed, 1);
});

test('while a change is being saved, a second Save writes nothing more', async () => {
  let finish;
  const { handlers, log, formLog } = await signedInEditor({
    ...editSheet(),
    write: () => new Promise((done) => (finish = done)),
  });
  await handlers.edit(1);

  const first = handlers.save({ ...valuesOf(mv('A', -1)), concept: 'Ay' });
  await settle();
  await handlers.save({ ...valuesOf(mv('A', -1)), concept: 'Ay' });
  finish();
  await first;

  assert.equal(log.writes.length, 1);
  assert.deepEqual(formLog.saving, [true, false]);
});

test('a changed concept typed with "=" at the start is written as text', async () => {
  const { handlers, log } = await signedInEditor(editSheet());
  await handlers.edit(1);

  await handlers.save({ ...valuesOf(mv('A', -1)), concept: '=A' });

  assert.deepEqual(log.writes[0].rows[0], ['Cash', OCTOBER_5, 'Food', { text: '=A' }, -1]);
});

test('after Edit, a tap on "+" opens the form for a new movement again', async () => {
  const { handlers, log, forms } = await signedInEditor(editSheet());
  await handlers.edit(1);

  await handlers.add();
  await handlers.save({ ...filled, source: 'Bank' });

  assert.deepEqual(forms.at(-1), { sources: ['Bank', 'Cash'], categories: ['Car', 'House'] });
  // A new movement: one row more than the movements of its day and after.
  assert.equal(log.writes[0].rows.length, editRows.length + 1);
});

test('a tap on "+" and then on Edit while the lists load opens only the Edit form, and Save changes it', async () => {
  let calls = 0;
  let release;
  const waiting = new Promise((done) => (release = done));
  const { handlers, log, forms } = await signedInEditor({
    ...editSheet(),
    dropdown: async (cell) => {
      calls += 1;
      // At sign-in the lists cannot be read, so the form reads them again, and slowly.
      if (calls <= 2) throw new SheetsError('Could not reach Google.');
      await waiting;
      return cell === 'Sheet2!A2' ? ['Bank', 'Cash'] : ['Car', 'House'];
    },
  });

  const plus = handlers.add();
  const pen = handlers.edit(1);
  release();
  await Promise.all([plus, pen]);

  assert.deepEqual(
    forms.map((form) => Boolean(form.edit)),
    [true],
  );
  await handlers.save({ ...valuesOf(mv('A', -1)), concept: 'Ay' });
  // A change: as many rows as before, not one more.
  assert.equal(log.writes[0].rows.length, editRows.length);
});

// Issue #108: the spinner for edits and deletes, then the thumbs-up or the warning.
test('a saved change shows the spinner, then the thumbs-up, then the form closes', async () => {
  const { handlers, order } = await signedInEditor(editSheet());
  await handlers.edit(1);

  await handlers.save({ ...valuesOf(mv('A', -1)), concept: 'Aye' });

  assert.deepEqual(order, ['spinner', 'thumbs-up', 'form closes']);
});

test('an edit with nothing changed closes the form with no spinner', async () => {
  const { handlers, order } = await signedInEditor(editSheet());
  await handlers.edit(1);

  await handlers.save({ ...valuesOf(mv('A', -1)), concept: ' A ' });

  assert.deepEqual(order, ['form closes']);
});

test('an edited row changed by hand shows the message, then the warning after the sheet is read again', async () => {
  let rows = editRows;
  const { handlers, order, ends, screens } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
  });
  await handlers.edit(2);
  rows = [mv('A', -1), mv('New', -9), mv('C', -3, OCTOBER_5 + 1)];
  const before = screens.length;

  await handlers.save({ ...valuesOf(mv('B', -2)), concept: 'Bee' });

  assert.deepEqual(order, ['spinner', 'changed message', 'warning']);
  assert.equal(ends.screens, before + 1);
});

test('deleted movements show the spinner, then the thumbs-up, then they go', async () => {
  const { handlers, order } = await signedInEditor(deleteSheet());

  await handlers.delete([1]);

  assert.deepEqual(order, ['spinner', 'thumbs-up', 'movements go']);
});

test('movements that are not deleted show the spinner, then the message is set, then the warning', async () => {
  const { handlers, order } = await signedInEditor({
    ...deleteSheet(),
    write: async () => {
      throw new SheetsError('Could not reach Google.');
    },
  });

  await handlers.delete([1]);

  assert.deepEqual(order, ['spinner', 'not deleted message', 'warning']);
});

test('a delete stopped by a change by hand shows the message, then the warning after the sheet is read again', async () => {
  let rows = sheetRows;
  const { handlers, order, ends, screens } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
  });
  rows = [mv('A', -1), mv('B', -2), mv('New', -9), mv('D', -4)];
  const before = screens.length;

  await handlers.delete([2, 3]);

  assert.deepEqual(order, ['spinner', 'changed message', 'warning']);
  assert.equal(ends.screens, before + 1);
});

// Issue #108: the spinner blocks taps until workDone. If something breaks on the way, the
// spinner must still end, or the app could never be tapped again.
const broken = () => {
  throw new Error('Something broke.');
};

test('when something breaks after a save, the spinner still ends with the warning', async () => {
  // Drawing the main screen breaks, but only after the sign-in.
  let breaking = false;
  const { handlers, order } = await signedInEditor({
    viewChanges: { render: () => breaking && broken() },
  });
  breaking = true;

  await assert.rejects(handlers.save(filled));

  assert.deepEqual(order, ['spinner', 'warning']);
});

test('when something breaks while saying the save failed, the spinner still ends', async () => {
  const { handlers, order } = await signedInEditor({
    write: async () => {
      throw new SheetsError('Could not reach Google.');
    },
    viewChanges: { saveFailed: broken },
  });

  await assert.rejects(handlers.save(filled));

  assert.deepEqual(order, ['spinner', 'warning']);
});

test('when something breaks while saying the delete stopped, the spinner still ends', async () => {
  let rows = sheetRows;
  const { handlers, order } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
    viewChanges: { deleteChanged: broken },
  });
  rows = [mv('A', -1), mv('B', -2), mv('New', -9), mv('D', -4)];

  await assert.rejects(handlers.delete([2, 3]));

  assert.deepEqual(order, ['spinner', 'warning']);
});

// Issue #122: the App sheet is read first at every load, and a mistake in it shows only the
// message.
const noAppSheet = async () => {
  throw new NoSuchSheetError('App');
};
// An App sheet with one mistake: row 3 of CATEGORIES has an empty first column.
const brokenApp = async () => withGoal([['CATEGORIES', '', '', '', 'SOURCES'], [], ['', 'car']]);
const FIRST_COLUMN_EMPTY = { kind: 'firstColumnEmpty', table: 'CATEGORIES', row: 3, sheet: 'App' };

test('every load reads the App sheet first, then the Total and the movements', async () => {
  const { app, handlers, log, last } = setup();
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.reads.slice(0, 3), ['app App', 'cells', 'values']);
  assert.equal(last().screen, 'main');
});

test('an App sheet with its tables shows the same main screen as before', async () => {
  const { app, handlers, last } = setup({ appRows: async () => APP_SHEET });
  await app.start();

  await handlers.signIn();

  assert.equal(last().screen, 'main');
  assert.equal(last().total, 549.5);
});

test('with no App sheet, only the message shows, and the rest is not read', async () => {
  const { app, handlers, log, last } = setup({ appRows: noAppSheet });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), {
    screen: 'mistakes',
    mistakes: [{ kind: 'noAppSheet', sheet: 'App' }],
  });
  assert.deepEqual(log.reads, ['app App']);
});

test('the mistakes of the App sheet are shown, each with the name of the sheet', async () => {
  const { app, handlers, last } = setup({
    // CATEGORIES covers the columns B and C; its second copy starts at D.
    appRows: async () =>
      withGoal([['', 'CATEGORIES', '', 'CATEGORIES', '', 'SOURCES'], [], ['x', '', 'car']]),
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), {
    screen: 'mistakes',
    mistakes: [
      { kind: 'tableTwice', table: 'CATEGORIES', column: 'D', sheet: 'App' },
      { kind: 'notInTable', cell: 'A3', sheet: 'App' },
      { kind: 'firstColumnEmpty', table: 'CATEGORIES', row: 3, sheet: 'App' },
    ],
  });
});

test('the sign-in is kept with the message: the person stays signed in', async () => {
  const { app, handlers, session } = setup({ appRows: noAppSheet });
  await app.start();

  await handlers.signIn();

  assert.equal(session.getToken(), 'tok');
});

test('a person who has not picked the document gets the Google picker at the App sheet read', async () => {
  let picked = false;
  const { app, handlers, log, last } = setup({
    appRows: async () => {
      if (!picked) throw new NoAccessError();
      return APP_SHEET;
    },
    pick: async () => (picked = true),
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(log.picks, ['tok']);
  assert.equal(last().screen, 'main');
});

test('a person who cannot open the document gets the same access message as before', async () => {
  const { app, handlers, last } = setup({
    appRows: async () => {
      throw new NoAccessError();
    },
    pick: async () => true,
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), { screen: 'login', message: 'noAccess' });
});

test('a saved movement with a broken App sheet: the thumbs-up, then the message', async () => {
  let broken = false;
  const { handlers, order, last, log } = await signedInEditor({
    appRows: async () => (broken ? brokenApp() : APP_SHEET),
    write: async () => (broken = true),
  });

  await handlers.save(filled);

  assert.equal(log.writes.length, 1);
  assert.deepEqual(order, ['spinner', 'thumbs-up', 'form closes', 'mistakes']);
  assert.deepEqual(last(), { screen: 'mistakes', mistakes: [FIRST_COLUMN_EMPTY] });
});

test('a saved change with a broken App sheet: the thumbs-up, then the message', async () => {
  let broken = false;
  const { handlers, order, log } = await signedInEditor({
    ...editSheet(),
    appRows: async () => (broken ? noAppSheet() : APP_SHEET),
    write: async () => (broken = true),
  });
  await handlers.edit(1);

  await handlers.save({ ...valuesOf(mv('A', -1)), concept: 'Aye' });

  assert.equal(log.writes.length, 1);
  assert.deepEqual(order, ['spinner', 'thumbs-up', 'form closes', 'mistakes']);
});

test('deleted movements with a broken App sheet: the thumbs-up, then the message', async () => {
  let broken = false;
  const { handlers, order, log, last } = await signedInEditor({
    ...deleteSheet(),
    appRows: async () => (broken ? noAppSheet() : APP_SHEET),
    write: async () => (broken = true),
  });

  await handlers.delete([1]);

  assert.equal(log.writes.length, 1);
  assert.deepEqual(order, ['spinner', 'thumbs-up', 'movements go', 'mistakes']);
  assert.equal(last().screen, 'mistakes');
});

test('an edited row changed by hand with a broken App sheet: the warning, then the message', async () => {
  let rows = editRows;
  let broken = false;
  const { handlers, order, log, last } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
    appRows: async () => (broken ? noAppSheet() : APP_SHEET),
  });
  await handlers.edit(2);
  rows = [mv('A', -1), mv('New', -9), mv('C', -3, OCTOBER_5 + 1)];
  broken = true;

  await handlers.save({ ...valuesOf(mv('B', -2)), concept: 'Bee' });

  assert.equal(log.writes.length, 0);
  // The form does not come back: the message takes the place of the main screen.
  assert.deepEqual(order, [
    'spinner',
    'changed message',
    'warning, the content stays hidden',
    'mistakes',
  ]);
  assert.equal(last().screen, 'mistakes');
});

test('a delete stopped by a change by hand with a broken App sheet: the warning, then the message', async () => {
  let rows = sheetRows;
  let broken = false;
  const { handlers, order, log } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
    appRows: async () => (broken ? noAppSheet() : APP_SHEET),
  });
  rows = [mv('A', -1), mv('B', -2), mv('New', -9), mv('D', -4)];
  broken = true;

  await handlers.delete([2, 3]);

  assert.equal(log.writes.length, 0);
  assert.deepEqual(order, [
    'spinner',
    'changed message',
    'warning, the content stays hidden',
    'mistakes',
  ]);
});

test('when the sheet cannot be read again at all after a save, the app does what it did before', async () => {
  let saved = false;
  const { handlers, order, last } = await signedInEditor({
    appRows: async () => {
      if (saved) throw new SheetsError('Could not reach Google.');
      return APP_SHEET;
    },
    write: async () => (saved = true),
  });

  await handlers.save(filled);

  assert.deepEqual(order, ['spinner', 'thumbs-up', 'form closes']);
  assert.equal(last().screen, 'main');
});

test('when the sheet cannot be read again at all after a delete, the goal shows without them', async () => {
  let deleted = false;
  const { handlers, order, last } = await signedInEditor({
    ...deleteSheet(),
    appRows: async () => {
      if (deleted) throw new SheetsError('Could not reach Google.');
      return APP_SHEET;
    },
    write: async () => (deleted = true),
  });

  await handlers.delete([1]);

  assert.deepEqual(order, ['spinner', 'thumbs-up', 'movements go']);
  assert.equal(last().screen, 'main');
  // The movements of the same day show in the order of the sheet.
  assert.deepEqual(shown(last()), ['B', 'C', 'D']);
});

// Issue #123: the icon and the color of each movement come from the CATEGORIES table.
const movementsOf = (screen) =>
  screen.goal.months.flatMap(({ days }) => days.flatMap(({ movements }) => movements));

test('each movement on the main screen gets its icon and color from the CATEGORIES table', async () => {
  const { app, handlers, last } = setup({
    movements: async () => [
      ['Cash', OCTOBER_5, 'Food', 'Shop', -12.5],
      ['Cash', OCTOBER_5, 'Toys', 'Ball', -3],
    ],
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(
    movementsOf(last()).map(({ description, icon, color }) => [description, icon, color]),
    [
      ['Shop', 'cart', '#2b8a3e'],
      // Toys is not in the table: the grey money bag.
      ['Ball', 'sackEuro', '#4b5563'],
    ],
  );
});

test('an App sheet without the CATEGORIES table shows the message that it is missing', async () => {
  const { app, handlers, last } = setup({ appRows: async () => withGoal([['SOURCES']]) });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), {
    screen: 'mistakes',
    mistakes: [{ kind: 'tableMissing', table: 'CATEGORIES', sheet: 'App' }],
  });
});

test('a mistake in the CATEGORIES table shows its line', async () => {
  const { app, handlers, last } = setup({
    appRows: async () =>
      withGoal([['CATEGORIES', '', '', '', '', 'SOURCES'], [], ['Food', '', 'carr', '#2b8a3e']]),
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), {
    screen: 'mistakes',
    mistakes: [{ kind: 'unknownIcon', table: 'CATEGORIES', row: 3, icon: 'carr', sheet: 'App' }],
  });
});

// Issue #124: the icons, the order and the pairs of the sources come from the SOURCES table.
// An App sheet with this SOURCES table (from row 3 down) and the CATEGORIES table of APP_SHEET.
const withSources = (...items) =>
  withGoal([
    ['CATEGORIES', '', '', '', '', 'SOURCES'],
    [],
    ...Array.from({ length: Math.max(items.length, 1) }, (_, index) => [
      ...(index === 0 ? ['Food', '', 'cart', '#2b8a3e'] : ['', '', '', '']),
      '',
      ...(items[index] ?? []),
    ]),
  ]);

test('each movement on the main screen gets its source icon from the SOURCES table', async () => {
  const { app, handlers, last } = setup({
    appRows: async () => withSources(['Cash', 'card'], ['Bank']),
    movements: async () => [
      ['Cash', OCTOBER_5, 'Food', 'Shop', -12.5],
      ['Bank', OCTOBER_5, 'Food', 'Bread', -2],
      ['Other', OCTOBER_5, 'Food', 'Milk', -1],
    ],
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(
    movementsOf(last()).map(({ description, source }) => [description, source]),
    [
      ['Shop', 'card'],
      // Bank has no icon in the table, and Other is not in it: no source icon.
      ['Bread', null],
      ['Milk', null],
    ],
  );
});

test('Save sorts the day in the order of the SOURCES table', async () => {
  const { handlers, log } = await signedInEditor({
    appRows: async () => withSources(['Cash', 'cash'], ['Bank', 'bank']),
    formulas: async () => [['Bank', OCTOBER_5, 'Food', 'Shop', -20]],
  });

  await handlers.save({ ...filled, digits: '500' });

  assert.deepEqual(log.writes[0].rows, [
    ['Cash', OCTOBER_5, 'Food', 'Bakery', -5],
    ['Bank', OCTOBER_5, 'Food', 'Shop', -20],
  ]);
});

test('Save puts a movement of a paired source right above its partner of the same amount', async () => {
  const { handlers, log } = await signedInEditor({
    appRows: async () =>
      withSources(['Cash', 'cash', 'Provisioned'], ['Polina', 'bank'], ['Provisioned', 'bank']),
    formulas: async () => [
      ['Polina', OCTOBER_5, 'Food', 'A', -10],
      ['Provisioned', OCTOBER_5, 'Food', 'B', -5],
    ],
  });

  await handlers.save({ ...filled, digits: '500' });

  assert.deepEqual(
    log.writes[0].rows.map(([source]) => source),
    ['Cash', 'Provisioned', 'Polina'],
  );
});

test('Save after Edit sorts the day in the order of the SOURCES table', async () => {
  const rows = [
    ['Bank', OCTOBER_5, 'Food', 'A', -1],
    ['Cash', OCTOBER_5, 'Food', 'B', -2],
  ];
  const { handlers, log } = await signedInEditor({
    ...editSheet(rows),
    appRows: async () => withSources(['Cash', 'cash'], ['Bank', 'bank']),
  });
  await handlers.edit(1);

  await handlers.save({ ...valuesOf(rows[0]), concept: 'Ant' });

  assert.deepEqual(log.writes[0].rows, [
    ['Cash', OCTOBER_5, 'Food', 'B', -2],
    ['Bank', OCTOBER_5, 'Food', 'Ant', -1],
  ]);
});

test('an App sheet without the SOURCES table shows the message that it is missing', async () => {
  const { app, handlers, last } = setup({
    appRows: async () => withGoal([['CATEGORIES'], [], ['Food', '', 'cart', '#2b8a3e']]),
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), {
    screen: 'mistakes',
    mistakes: [{ kind: 'tableMissing', table: 'SOURCES', sheet: 'App' }],
  });
});

test('a mistake in the SOURCES table shows its line', async () => {
  const { app, handlers, last } = setup({
    appRows: async () => withSources(['Cash', 'wallet']),
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), {
    screen: 'mistakes',
    mistakes: [{ kind: 'badSourceIcon', table: 'SOURCES', row: 3, icon: 'wallet', sheet: 'App' }],
  });
});

// Issue #125: the dates, the limit and the left-out movements of the goal come from the GOAL and
// GOAL LEAVE OUT tables.
// The App sheet of the tests with these goal tables (from row 1: titles, headers, then items).
const withGoalTables = (...rows) =>
  withGoal(CATEGORIES_AND_SOURCES, [
    ['GOAL', '', '', 'GOAL LEAVE OUT'],
    ['Setting', 'Value', '', 'Category', 'Description'],
    ...rows,
  ]);

test('the limit of the goal comes from the GOAL table', async () => {
  const { app, handlers, last } = setup({
    appRows: async () =>
      withGoalTables(['From', OCTOBER_1, '', 'Pay'], ['To', DECEMBER_31], ['Limit', 10]),
  });
  await app.start();

  await handlers.signIn();

  assert.equal(last().goal.limit, 10);
  // Shop: 12.50 of spending, over the limit.
  assert.equal(last().goal.amount, 12.5);
  assert.equal(last().goal.level, 'over');
});

test('the dates of the goal come from the GOAL table', async () => {
  const NOVEMBER_15 = dateCell(OCTOBER_5 + 41, '15/11/2026');
  const { app, handlers, last } = setup({
    appRows: async () =>
      withGoalTables(['From', NOVEMBER_15], ['To', DECEMBER_31], ['Limit', 3000]),
    movements: async () => [
      ['Cash', OCTOBER_5, 'Food', 'Shop', -12.5],
      ['Cash', OCTOBER_5 + 40, 'Food', 'Bread', -2],
      ['Cash', OCTOBER_5 + 41, 'Food', 'Milk', -1],
    ],
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(
    last().goal.months.map(({ month }) => month),
    [11, 12],
  );
  assert.equal(last().goal.amount, 1);
  assert.deepEqual(
    movementsOf(last()).map(({ description }) => description),
    ['Milk'],
  );
});

test('the movements the goal leaves out come from the GOAL LEAVE OUT table', async () => {
  const { app, handlers, last } = setup({
    appRows: async () =>
      withGoalTables(
        ['From', OCTOBER_1, '', 'Food', 'Bread'],
        ['To', DECEMBER_31, '', 'Toys'],
        ['Limit', 3000],
      ),
    movements: async () => [
      ['Cash', OCTOBER_5, 'Food', 'Shop', -12.5],
      ['Cash', OCTOBER_5, 'Food', 'Bread', -2],
      ['Cash', OCTOBER_5, 'Toys', 'Ball', -3],
      ['Cash', OCTOBER_5, 'Pay', 'Salary', 100],
    ],
  });
  await app.start();

  await handlers.signIn();

  // Pay is not in this table: it counts.
  assert.equal(last().goal.amount, -87.5);
  assert.deepEqual(
    movementsOf(last()).map(({ description, leftOut }) => [description, Boolean(leftOut)]),
    [
      ['Shop', false],
      ['Bread', true],
      ['Ball', true],
      ['Salary', false],
    ],
  );
});

test('a mistake in the GOAL table shows its line', async () => {
  const { app, handlers, last } = setup({
    appRows: async () =>
      withGoalTables(['From', OCTOBER_1, '', 'Pay'], ['To', DECEMBER_31], ['Limit', 0]),
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), {
    screen: 'mistakes',
    mistakes: [{ kind: 'badLimit', table: 'GOAL', row: 5, sheet: 'App' }],
  });
});

test('an App sheet without the GOAL LEAVE OUT table shows the message that it is missing', async () => {
  const { app, handlers, last } = setup({
    appRows: async () =>
      withGoal(CATEGORIES_AND_SOURCES, [
        ['GOAL'],
        [],
        ['From', OCTOBER_1],
        ['To', DECEMBER_31],
        ['Limit', 3000],
      ]),
  });
  await app.start();

  await handlers.signIn();

  assert.deepEqual(last(), {
    screen: 'mistakes',
    mistakes: [{ kind: 'tableMissing', table: 'GOAL LEAVE OUT', sheet: 'App' }],
  });
});
