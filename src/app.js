// The app's main logic: which screen to show, and what happens on each button tap.
// It does not touch the page or Google directly. It gets helpers for that, so tests can use fakes.
//
// Screens:
//   login     - logo, name and the "Login with Google" button, maybe with a message
//   checking  - we ask the sheet if this person may see it
//   main      - the Total: the text of the cell named in the config

import { isConfigured } from './config.js';
import { NoAccessError, SignInExpiredError } from './sheets.js';
import { PermissionMissingError, SignInFailedError } from './auth.js';

export function createApp({ config, view, session, t, loadAuth, createSheets }) {
  let auth = null;
  let authReady = null;

  const sheets = createSheets({
    spreadsheetId: config.spreadsheetId,
    getToken: () => session.getToken(),
  });

  // Loads Google sign-in once. If it fails, the next call tries again.
  function getAuth() {
    authReady ??= loadAuth().then(
      (loaded) => (auth = loaded),
      (error) => {
        authReady = null;
        throw error;
      },
    );
    return authReady;
  }

  // Returns Google sign-in, waiting for it to load if needed, or null when it cannot load.
  async function loadedAuth() {
    return auth ?? (await getAuth().catch(() => null));
  }

  // Asks the sheet for the text to show. Google answers only if this person may open the sheet.
  // "fresh" means the person just signed in, so we ask Google which account they chose.
  async function check(token, { fresh = false } = {}) {
    view.render({ screen: 'checking' });
    try {
      const text = await sheets.getCell(config.totalCell);
      let email = fresh ? null : session.getHint();
      if (!email) {
        email = (await (await loadedAuth())?.getEmail(token)) ?? null;
        if (email) session.saveHint(email);
      }
      view.render({ screen: 'main', text: text || t('empty'), email });
    } catch (error) {
      if (error instanceof NoAccessError) {
        // This person cannot open the sheet, so we sign them out completely.
        await (await loadedAuth())?.signOut(token);
        session.clear();
        view.render({ screen: 'login', message: 'noAccess' });
      } else if (error instanceof SignInExpiredError) {
        session.clearToken();
        view.render({ screen: 'login', message: 'expired' });
      } else {
        // No internet or a problem at Google. The sign-in is still good, so we keep it:
        // the next tap on the button tries again without a new Google window.
        view.render({ screen: 'login', message: 'error' });
      }
    }
  }

  async function runSignIn() {
    const saved = session.getToken();
    if (saved) {
      await check(saved);
      return;
    }
    let pending;
    try {
      // The Google window must open in the same moment as the tap, so we do not wait for
      // anything here when Google sign-in is already loaded.
      pending = (auth ?? (await getAuth())).signIn({ hint: session.getHint() });
      const result = await pending;
      session.saveToken(result);
      await check(result.token, { fresh: true });
    } catch (error) {
      if (error instanceof PermissionMissingError) {
        view.render({ screen: 'login', message: 'permissionMissing' });
      } else if (error instanceof SignInFailedError && pending) {
        view.render({ screen: 'login', message: 'signInFailed' });
      } else {
        view.render({ screen: 'login', message: 'error' });
      }
    }
  }

  // A quick double tap must not open two Google windows, so we ignore taps while one runs.
  let signingIn = false;
  async function signIn() {
    if (signingIn) return;
    signingIn = true;
    try {
      await runSignIn();
    } finally {
      signingIn = false;
    }
  }

  async function signOut() {
    const token = session.getToken();
    session.clear();
    view.render({ screen: 'login', message: 'signedOut' });
    // Cancel the token at Google too, even if Google sign-in is still loading.
    if (token) await (await loadedAuth())?.signOut(token);
  }

  async function start() {
    if (!isConfigured(config)) {
      view.render({ screen: 'login', message: 'notConfigured', disabled: true });
      return;
    }
    view.onSignIn(signIn);
    view.onSignOut(signOut);

    const token = session.getToken();
    if (token) {
      // Signed in earlier during this visit: no need to sign in again.
      getAuth().catch(() => {}); // Load sign-in in the background for later.
      await check(token);
      return;
    }

    view.render({ screen: 'login', disabled: true });
    try {
      await getAuth();
      view.render({ screen: 'login' });
    } catch {
      view.render({ screen: 'login', message: 'error' });
    }
  }

  return { start };
}
