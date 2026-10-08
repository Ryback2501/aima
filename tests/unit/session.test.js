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
    sessionStorage: memoryStorage(),
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

test('the token survives reading it back from storage in a new session object', () => {
  const sessionStorage = memoryStorage();
  const now = () => 0;
  createSession({ sessionStorage, localStorage: memoryStorage(), now }).saveToken({
    token: 'abc',
    expiresAt: 3_600_000,
  });

  const later = createSession({ sessionStorage, localStorage: memoryStorage(), now });

  assert.equal(later.getToken(), 'abc');
});

test('broken or missing storage never stops the app', () => {
  for (const storage of [brokenStorage, undefined]) {
    const session = createSession({ sessionStorage: storage, localStorage: storage });

    session.saveToken({ token: 'abc', expiresAt: Date.now() + 3_600_000 });
    session.saveHint('ana@example.com');
    session.clear();

    assert.equal(session.getToken(), null);
    assert.equal(session.getHint(), null);
  }
});

test('damaged token data in storage is ignored', () => {
  const sessionStorage = memoryStorage();
  sessionStorage.setItem('aima.token', 'not json');

  const session = createSession({ sessionStorage, localStorage: memoryStorage() });

  assert.equal(session.getToken(), null);
});

test('the token works during the visit even when the browser blocks storage', () => {
  const session = createSession({ sessionStorage: brokenStorage, localStorage: brokenStorage });

  session.saveToken({ token: 'abc', expiresAt: Date.now() + 3_600_000 });

  assert.equal(session.getToken(), 'abc');
});

test('a token kept only in memory also expires', () => {
  let time = 0;
  const session = createSession({
    sessionStorage: undefined,
    localStorage: undefined,
    now: () => time,
  });
  session.saveToken({ token: 'abc', expiresAt: 3_600_000 });

  time = 3_600_000;

  assert.equal(session.getToken(), null);
});

test('nothing is switched off at first', () => {
  const session = createSession({ sessionStorage: memoryStorage(), localStorage: memoryStorage() });

  assert.deepEqual(session.getSwitchedOff(), []);
});

test('the parts of the Total that are switched off are remembered for the next visit', () => {
  const localStorage = memoryStorage();
  createSession({ sessionStorage: memoryStorage(), localStorage }).saveSwitchedOff(['cash']);

  const next = createSession({ sessionStorage: memoryStorage(), localStorage });

  assert.deepEqual(next.getSwitchedOff(), ['cash']);
});

test('damaged or blocked storage for the switched-off parts gives an empty list', () => {
  const damaged = memoryStorage();
  damaged.setItem('aima.off', '{not a list');
  assert.deepEqual(
    createSession({ sessionStorage: memoryStorage(), localStorage: damaged }).getSwitchedOff(),
    [],
  );
  const blocked = createSession({ sessionStorage: brokenStorage, localStorage: brokenStorage });
  blocked.saveSwitchedOff(['bank']);
  assert.deepEqual(blocked.getSwitchedOff(), []);
});
