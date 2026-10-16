// The app's main logic: which screen to show, and what happens on each button tap.
// It does not touch the page or Google directly. It gets helpers for that, so tests can use fakes.
//
// Screens:
//   login     - logo, name and the "Login with Google" button, maybe with a message
//   checking  - we ask the sheet if this person may see it. The first time, the Google file
//               picker opens on top, so the person can give the sheet to aima.
//   main      - the Total (the sum of its parts that are switched on) and the spending goal

import { isConfigured } from './config.js';
import { NoAccessError, SignInExpiredError } from './sheets.js';
import { goalStatus, goalMonths } from './goal.js';
import { PermissionMissingError, SignInFailedError } from './auth.js';

export function createApp({ config, view, session, loadAuth, loadPicker, createSheets }) {
  let auth = null;
  let authReady = null;
  let pickerReady = null;
  // What the main screen shows, kept so a tap on a pill can show it again with new totals.
  let parts = [];
  let goal = null;

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

  // Loads the Google file picker the first time it is needed. If it fails, the next call tries
  // again.
  function getPicker() {
    pickerReady ??= loadPicker().catch((error) => {
      pickerReady = null;
      throw error;
    });
    return pickerReady;
  }

  // aima may open the sheet only after the person gives it to aima in the Google file picker.
  // They do this once: Google remembers it for their account. Someone who cannot open the sheet
  // does not see it in the picker, so they can only close it.
  async function pickSheet(token, { fresh }) {
    let picked;
    try {
      picked = await (await getPicker()).pickSheet(token);
    } catch {
      // No internet or a problem at Google. The sign-in is still good, so we keep it.
      view.render({ screen: 'login', message: 'error' });
      return;
    }
    if (picked) {
      await check(token, { fresh, picked: true });
      return;
    }
    // The person closed the picker: maybe they cannot open the sheet. We sign them out completely.
    await (await loadedAuth())?.signOut(token);
    session.clear();
    view.render({ screen: 'login', message: 'notPicked' });
  }

  // Shows the main screen. The Total adds up the parts that are switched on, and takes away
  // the ones marked "subtract" in the config.
  function showMain() {
    const off = session.getSwitchedOff();
    const pills = parts.map(({ name, amount }) => ({ name, amount, on: !off.includes(name) }));
    const total = parts.reduce((sum, { name, amount, subtract }) => {
      if (off.includes(name)) return sum;
      return subtract ? sum - amount : sum + amount;
    }, 0);
    // Round to cents, so sums like 0.1 + 0.2 show as 0.30.
    view.render({ screen: 'main', total: Math.round(total * 100) / 100, pills, goal });
  }

  // A tap on a pill switches that part of the Total on or off. The choice is remembered.
  function togglePill(name) {
    const off = session.getSwitchedOff();
    session.saveSwitchedOff(off.includes(name) ? off.filter((n) => n !== name) : [...off, name]);
    showMain();
  }

  // Asks the sheet for the parts of the Total and the movements, both at the same time.
  // Google answers only if this person may open the sheet.
  // "fresh" means the person just signed in, so we ask Google which account they chose.
  // "picked" means the person has just picked the sheet in the Google file picker.
  async function check(token, { fresh = false, picked = false } = {}) {
    view.render({ screen: 'checking' });
    try {
      const [amounts, movements] = await Promise.all([
        sheets.getCells(config.pills.map(({ cell }) => cell)),
        sheets.getValues(config.goal.movements, { raw: true }),
      ]);
      // We keep the account email only so the next sign-in can be one tap.
      if (fresh || !session.getHint()) {
        const email = await (await loadedAuth())?.getEmail(token);
        if (email) session.saveHint(email);
      }
      // A cell that is empty or not a number counts as 0.
      parts = config.pills.map(({ name, subtract = false }, index) => ({
        name,
        subtract,
        amount: typeof amounts[index] === 'number' ? amounts[index] : 0,
      }));
      goal = {
        ...goalStatus(movements, config.goal),
        limit: config.goal.limit,
        months: goalMonths(movements, config.goal),
      };
      showMain();
    } catch (error) {
      if (error instanceof NoAccessError && !picked) {
        await pickSheet(token, { fresh });
      } else if (error instanceof NoAccessError) {
        // The person picked the sheet, but Google still says no. We sign them out, but we do
        // not cancel the token at Google: that would also take back the pick they just made.
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

  // We do not cancel the token at Google here: that would also take back the sheet the person
  // picked, and they would have to pick it again at every sign-in. The token stops working by
  // itself after about one hour.
  function signOut() {
    session.clear();
    view.render({ screen: 'login', message: 'signedOut' });
  }

  // A language picked with the flag button: the view shows it at once, and this phone keeps it.
  function chooseLanguage(language) {
    session.saveLanguage(language);
    view.setLanguage(language);
  }

  async function start() {
    if (!isConfigured(config)) {
      view.render({ screen: 'login', message: 'notConfigured', disabled: true });
      return;
    }
    view.onSignIn(signIn);
    view.onSignOut(signOut);
    view.onTogglePill(togglePill);
    view.onPickLanguage(chooseLanguage);

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
