// Remembers the sign-in between screens and visits.
// - The access token is kept only while the app is open (sessionStorage). Google gives it for
//   about one hour. There is no server, so the app cannot renew it alone.
// - The Google account email is kept longer (localStorage). Next time, Google can sign the
//   same person in with one tap, without asking which account to use.
// - The parts of the Total that the person switched off are kept on this phone (localStorage).

const TOKEN_KEY = 'aima.token';
const HINT_KEY = 'aima.hint';
const OFF_KEY = 'aima.off';

// We stop using a token one minute before it expires, so it cannot expire in the middle of a request.
const SAFETY_MARGIN_MS = 60_000;

// The browser can block storage (for example in some private windows). The app must still work,
// so every storage call is protected.
function safe(storage) {
  return {
    get(key) {
      try {
        return storage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage?.setItem(key, value);
      } catch {
        // Nothing to do: the app works without storage, people just sign in more often.
      }
    },
    remove(key) {
      try {
        storage?.removeItem(key);
      } catch {
        // Nothing to do, see above.
      }
    },
  };
}

export function createSession({ sessionStorage, localStorage, now = Date.now }) {
  const short = safe(sessionStorage);
  const long = safe(localStorage);
  // We also keep the token in memory, so sign-in works even when the browser blocks storage.
  let current = null;

  const isValid = (saved) =>
    Boolean(saved) && typeof saved.token === 'string' && saved.expiresAt - SAFETY_MARGIN_MS > now();

  function readSaved() {
    try {
      return JSON.parse(short.get(TOKEN_KEY));
    } catch {
      return null; // Damaged data: act as if there is no token.
    }
  }

  return {
    saveToken({ token, expiresAt }) {
      current = { token, expiresAt };
      short.set(TOKEN_KEY, JSON.stringify(current));
    },

    // Returns the token, or null when there is none or it is about to expire.
    getToken() {
      const saved = current ?? readSaved();
      return isValid(saved) ? saved.token : null;
    },

    clearToken() {
      current = null;
      short.remove(TOKEN_KEY);
    },

    saveHint(email) {
      long.set(HINT_KEY, email);
    },

    getHint() {
      return long.get(HINT_KEY);
    },

    // The names of the parts of the Total that are switched off, for example ["cash"].
    getSwitchedOff() {
      try {
        const names = JSON.parse(long.get(OFF_KEY));
        return Array.isArray(names) ? names.filter((name) => typeof name === 'string') : [];
      } catch {
        return []; // Damaged data: nothing is switched off.
      }
    },

    saveSwitchedOff(names) {
      long.set(OFF_KEY, JSON.stringify(names));
    },

    // Forgets everything, for example when the person signs out.
    clear() {
      current = null;
      short.remove(TOKEN_KEY);
      long.remove(HINT_KEY);
    },
  };
}
