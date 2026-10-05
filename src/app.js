// The app's main logic: which screen to show, and what happens on each button tap.
// It does not touch the page or Google directly. It gets helpers for that, so tests can use fakes.
//
// Screens:
//   login     - logo, name and the "Sign in with Google" button, maybe with a message
//   checking  - we ask the sheet if this person may see it
//   briefing  - the text of the briefing cell

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

  // Loads Google sign-in once. Returns null when it cannot load.
  function getAuth() {
    authReady ??= loadAuth().then(
      (loaded) => (auth = loaded),
      (error) => {
        authReady = null; // Allow a new try later.
        throw error;
      },
    );
    return authReady;
  }

  // Asks the sheet for the briefing. Google answers only if this person may open the sheet.
  async function check(token) {
    view.render({ screen: 'checking' });
    try {
      const text = await sheets.getCell(config.briefingCell);
      let email = session.getHint();
      if (!email) {
        const loaded = auth ?? (await getAuth().catch(() => null));
        email = (await loaded?.getEmail(token)) ?? null;
        if (email) session.saveHint(email);
      }
      view.render({ screen: 'briefing', text: text || t('empty'), email });
    } catch (error) {
      if (error instanceof NoAccessError) {
        // This person cannot open the sheet, so we sign them out completely.
        const loaded = auth ?? (await getAuth().catch(() => null));
        await loaded?.signOut(token);
        session.clear();
        view.render({ screen: 'login', message: 'noAccess' });
      } else if (error instanceof SignInExpiredError) {
        session.clearToken();
        view.render({ screen: 'login', message: 'expired' });
      } else {
        session.clearToken();
        view.render({ screen: 'login', message: 'error' });
      }
    }
  }

  async function signIn() {
    let pending;
    try {
      // The Google window must open in the same moment as the tap, so we do not wait for
      // anything here when Google sign-in is already loaded.
      pending = (auth ?? (await getAuth())).signIn({ hint: session.getHint() });
      const result = await pending;
      session.saveToken(result);
      await check(result.token);
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

  async function signOut() {
    const token = session.getToken();
    session.clear();
    await auth?.signOut(token);
    view.render({ screen: 'login', message: 'signedOut' });
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
