// Remembers the sign-in between screens and visits.
// - The access token is kept only while the app is open (sessionStorage). Google gives it for
//   about one hour. There is no server, so the app cannot renew it alone.
// - The Google account email is kept longer (localStorage). Next time, Google can sign the
//   same person in with one tap, without asking which account to use.

const TOKEN_KEY = 'aima.token';
const HINT_KEY = 'aima.hint';

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

  return {
    saveToken({ token, expiresAt }) {
      short.set(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
    },

    // Returns the token, or null when there is none or it is about to expire.
    getToken() {
      try {
        const saved = JSON.parse(short.get(TOKEN_KEY));
        if (
          saved &&
          typeof saved.token === 'string' &&
          saved.expiresAt - SAFETY_MARGIN_MS > now()
        ) {
          return saved.token;
        }
      } catch {
        // Damaged data: act as if there is no token.
      }
      return null;
    },

    clearToken() {
      short.remove(TOKEN_KEY);
    },

    saveHint(email) {
      long.set(HINT_KEY, email);
    },

    getHint() {
      return long.get(HINT_KEY);
    },

    // Forgets everything, for example when the person signs out.
    clear() {
      short.remove(TOKEN_KEY);
      long.remove(HINT_KEY);
    },
  };
}
