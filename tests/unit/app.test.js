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
    sourceOrder: ['Bank', 'Cash'],
    sourcePairs: {},
  },
  // The cells whose dropdown lists give the options of the new movement form.
  form: { sourceList: 'Sheet2!A2', categoryList: 'Sheet2!C2', sheet: 'Sheet2', firstRow: 2 },
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
  // The movement rows as the save reads them (formulas kept), from the first movement row.
  formulas = async () => [['Cash', OCTOBER_5, 'Food', 'Shop', -12.5]],
  // The number and the size of the movements sheet.
  sheet = async () => ({ sheetId: 7, rowCount: 100 }),
  // What happens when rows are written.
  write = async () => {},
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
    workDone: async (ok) => {
      order.push(ok ? 'thumbs-up' : 'warning');
      order.screensAtEnd = screens.length;
    },
    deleted: async () => {
      deleteLog.events.push('deleted');
      order.push('movements go');
      deleteLog.screensBefore = screens.length;
    },
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
                { category: 'Food', description: 'Shop', amount: 12.5, source: 'cash', row: 0 },
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
        { category: 'Food', description: 'Shop', amount: 12.5, source: 'cash', row: 0 },
        {
          category: 'Pay',
          description: 'Salary',
          amount: -2500,
          source: 'cash',
          row: 1,
          leftOut: true,
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
  const { handlers, order, screens } = await signedInEditor();
  const before = screens.length;

  await handlers.save(filled);

  assert.deepEqual(order, ['spinner', 'thumbs-up', 'form closes']);
  // The list is already read again while the thumbs-up shows.
  assert.equal(order.screensAtEnd, before + 1);
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
  const { handlers, order, screens } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
  });
  await handlers.edit(2);
  rows = [mv('A', -1), mv('New', -9), mv('C', -3, OCTOBER_5 + 1)];
  const before = screens.length;

  await handlers.save({ ...valuesOf(mv('B', -2)), concept: 'Bee' });

  assert.deepEqual(order, ['spinner', 'changed message', 'warning']);
  assert.equal(order.screensAtEnd, before + 1);
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
  const { handlers, order, screens } = await signedInEditor({
    movements: async () => [HEADERS, ...rows],
    formulas: async () => rows,
  });
  rows = [mv('A', -1), mv('B', -2), mv('New', -9), mv('D', -4)];
  const before = screens.length;

  await handlers.delete([2, 3]);

  assert.deepEqual(order, ['spinner', 'changed message', 'warning']);
  assert.equal(order.screensAtEnd, before + 1);
});
