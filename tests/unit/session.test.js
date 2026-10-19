import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSession } from '../../src/session.js';

// A small in-memory copy of the browser's storage.
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

// Storage that always fails, like in some private browser windows.
const brokenStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
  removeItem() {
    throw new Error('blocked');
  },
};

function setup(start = 1_000_000) {
  let time = start;
  const session = createSession({
    localStorage: memoryStorage(),
    now: () => time,
  });
  return { session, wait: (ms) => (time += ms) };
}

test('a saved token can be read back while it is still valid', () => {
  const { session } = setup();
  session.saveToken({ token: 'abc', expiresAt: 1_000_000 + 3_600_000 });

  assert.equal(session.getToken(), 'abc');
});

test('there is no token before sign-in', () => {
  const { session } = setup();

  assert.equal(session.getToken(), null);
});

test('a token is not used in its last minute, so it cannot expire during a request', () => {
  const { session, wait } = setup();
  session.saveToken({ token: 'abc', expiresAt: 1_000_000 + 3_600_000 });

  wait(3_600_000 - 61_000);
  assert.equal(session.getToken(), 'abc');
  wait(2_000);
  assert.equal(session.getToken(), null);
});

test('clearToken forgets the token', () => {
  const { session } = setup();
  session.saveToken({ token: 'abc', expiresAt: 1_000_000 + 3_600_000 });

  session.clearToken();

  assert.equal(session.getToken(), null);
});

test('the Google account email is remembered for the next sign-in', () => {
  const { session } = setup();

  session.saveHint('ana@example.com');

  assert.equal(session.getHint(), 'ana@example.com');
});

test('clear forgets both the token and the email', () => {
  const { session } = setup();
  session.saveToken({ token: 'abc', expiresAt: 1_000_000 + 3_600_000 });
  session.saveHint('ana@example.com');

  session.clear();

  assert.equal(session.getToken(), null);
  assert.equal(session.getHint(), null);
});

test('the token stays after the app is closed and opened again, until it expires', () => {
  const localStorage = memoryStorage();
  let time = 0;
  const now = () => time;
  createSession({ localStorage, now }).saveToken({ token: 'abc', expiresAt: 3_600_000 });

  const reopened = createSession({ localStorage, now });
  assert.equal(reopened.getToken(), 'abc');

  time = 3_600_000;
  assert.equal(createSession({ localStorage, now }).getToken(), null);
});

test('after signing out, the app opened again has no token', () => {
  const localStorage = memoryStorage();
  const now = () => 0;
  const session = createSession({ localStorage, now });
  session.saveToken({ token: 'abc', expiresAt: 3_600_000 });

  session.clear();

  assert.equal(createSession({ localStorage, now }).getToken(), null);
});

test('broken or missing storage never stops the app', () => {
  for (const storage of [brokenStorage, undefined]) {
    const session = createSession({ localStorage: storage });

    session.saveToken({ token: 'abc', expiresAt: Date.now() + 3_600_000 });
    session.saveHint('ana@example.com');
    session.clear();

    assert.equal(session.getToken(), null);
    assert.equal(session.getHint(), null);
  }
});

test('damaged token data in storage is ignored', () => {
  const localStorage = memoryStorage();
  localStorage.setItem('aima.token', 'not json');

  const session = createSession({ localStorage });

  assert.equal(session.getToken(), null);
});

test('the token works during the visit even when the browser blocks storage', () => {
  const session = createSession({ localStorage: brokenStorage });

  session.saveToken({ token: 'abc', expiresAt: Date.now() + 3_600_000 });

  assert.equal(session.getToken(), 'abc');
});

test('a token kept only in memory also expires', () => {
  let time = 0;
  const session = createSession({
    localStorage: undefined,
    now: () => time,
  });
  session.saveToken({ token: 'abc', expiresAt: 3_600_000 });

  time = 3_600_000;

  assert.equal(session.getToken(), null);
});

test('nothing is switched off at first', () => {
  const session = createSession({ localStorage: memoryStorage() });

  assert.deepEqual(session.getSwitchedOff(), []);
});

test('the parts of the Total that are switched off are remembered for the next visit', () => {
  const localStorage = memoryStorage();
  createSession({ localStorage }).saveSwitchedOff(['cash']);

  const next = createSession({ localStorage });

  assert.deepEqual(next.getSwitchedOff(), ['cash']);
});

test('damaged or blocked storage for the switched-off parts gives an empty list', () => {
  const damaged = memoryStorage();
  damaged.setItem('aima.off', '{not a list');
  assert.deepEqual(createSession({ localStorage: damaged }).getSwitchedOff(), []);
  const blocked = createSession({ localStorage: brokenStorage });
  blocked.saveSwitchedOff(['bank']);
  assert.deepEqual(blocked.getSwitchedOff(), []);
});

test('the chosen language is kept on this phone, also after signing out', () => {
  const localStorage = memoryStorage();
  const session = createSession({ localStorage });
  assert.equal(session.getLanguage(), null);

  session.saveLanguage('es');
  session.clear();

  const later = createSession({ localStorage });
  assert.equal(later.getLanguage(), 'es');
});

test('broken or missing storage never stops the language choice', () => {
  for (const storage of [brokenStorage, undefined]) {
    const session = createSession({ localStorage: storage });

    session.saveLanguage('ru');

    assert.equal(session.getLanguage(), null);
  }
});
