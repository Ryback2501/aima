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
import { goalStatus, goalMonths, hasExtraDecimals } from './goal.js';
import { PermissionMissingError, SignInFailedError } from './auth.js';
import {
  firstRowOf,
  formValues,
  missingFields,
  movementRow,
  planDelete,
  planEdit,
  planSave,
  sameMovement,
  sameMovements,
} from './movements.js';

// What was typed is always text: a concept that starts with "=" must not become a formula.
const typed = (cell) => (typeof cell === 'string' && cell.startsWith('=') ? { text: cell } : cell);

// The rows to write, from the rows read with their formulas. There a text that starts with "="
// looks like a formula. In the plain read (fresh) a formula gives its result, and a text stays
// the same: then it is written as text again. offset: the place of a row in the rows read with
// formulas → its place in fresh.
function keepTexts(planned, rows, fresh, offset) {
  const placeOf = new Map(rows.map((row, index) => [row, index]));
  return planned.map((row) => {
    const plain = fresh[placeOf.get(row) - offset] ?? [];
    return row.map((cell, column) =>
      typeof cell === 'string' && cell.startsWith('=') && plain[column] === cell
        ? { text: cell }
        : cell,
    );
  });
}

export function createApp({ config, view, session, loadAuth, loadPicker, createSheets }) {
  let auth = null;
  let authReady = null;
  let pickerReady = null;
  // What the main screen shows, kept so a tap on a pill can show it again with new totals.
  let parts = [];
  let goal = null;
  // The movement rows the goal was worked out from, as they were read. A movement on the
  // screen knows its place in them, so it can be found again to delete it.
  let movementRows = [];
  // True when this person may edit the sheet, so they may add movements.
  let canAdd = false;
  // The Source and Category lists of the new movement form, once they are loading or loaded.
  let lists = null;
  // The movement the form is changing ({ index, row }: its place in movementRows, and the row
  // as it was read), or null when the form adds a new movement.
  let editing = null;

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
    view.render({ screen: 'main', total: Math.round(total * 100) / 100, pills, goal, canAdd });
  }

  // Reads the Source and Category lists from the sheet's dropdowns once. If it fails, the next
  // call tries again.
  function getLists() {
    lists ??= Promise.all([
      sheets.getDropdown(config.form.sourceList),
      sheets.getDropdown(config.form.categoryList),
    ]).then(
      ([sources, categories]) => ({ sources, categories }),
      (error) => {
        lists = null;
        throw error;
      },
    );
    return lists;
  }

  // A tap on "+" opens the new movement form with the lists, or with a message when they
  // cannot be read.
  async function openForm() {
    await showForm(null);
  }

  // A tap on Edit opens the same form, filled in with the movement at index (its place in
  // movementRows), as it was read from the sheet.
  async function openEdit(index) {
    const row = movementRows[index];
    await showForm({ index, row });
  }

  // Opens the form for a new movement (change: null) or to change one, with the lists, or with
  // a message when they cannot be read. While the lists load, a newer tap on "+" or Edit takes
  // over: only the last one opens its form, so Save always does what the open form shows.
  let asked = 0;
  async function showForm(change) {
    const tap = (asked += 1);
    const edit = change && {
      values: formValues(change.row),
      extraDecimals: hasExtraDecimals(change.row[4]),
    };
    let form;
    try {
      form = await getLists();
    } catch {
      form = { failed: true };
    }
    if (tap !== asked) return;
    editing = change;
    view.openForm(edit ? { ...form, edit } : form);
  }

  // Reads the parts of the Total and the movements, both at the same time, and works out what
  // the main screen shows.
  async function load() {
    const [amounts, movements] = await Promise.all([
      sheets.getCells(config.pills.map(({ cell }) => cell)),
      sheets.getValues(config.goal.movements, { raw: true }),
    ]);
    // A cell that is empty or not a number counts as 0.
    parts = config.pills.map(({ name, subtract = false }, index) => ({
      name,
      subtract,
      amount: typeof amounts[index] === 'number' ? amounts[index] : 0,
    }));
    showGoalOf(movements);
  }

  // Works out the goal from the movement rows, and keeps the rows.
  function showGoalOf(movements) {
    movementRows = movements;
    goal = {
      ...goalStatus(movements, config.goal),
      limit: config.goal.limit,
      // With the movements the goal leaves out: the eye button of the goal card shows them.
      months: goalMonths(movements, config.goal, { leftOut: true }),
    };
  }

  // Writes a new movement into the sheet: its day and every later day are sorted again (see
  // movements.js). The rows are read again just before, so the newest sheet is used. Returns
  // false when Google could not be reached or refused the change: then nothing was saved.
  async function write(values) {
    const { sheet, firstRow } = config.form;
    try {
      const [rows, place] = await Promise.all([
        sheets.getValues(`${sheet}!A${firstRow}:E`, { formulas: true }),
        sheets.getSheet(sheet),
      ]);
      const row = movementRow(values);
      const plan = planSave(rows, row, config.goal);
      const written = plan.rows.map((each) => (each === row ? each.map(typed) : each));
      await sheets.writeRows({ ...place, startRow: firstRow - 1 + plan.start, rows: written });
      return true;
    } catch {
      return false;
    }
  }

  // Writes the change of the movement at index (its place in movementRows): it moves to its new
  // place (see movements.js). Returns "saved", or "changed" or "failed" (see changeRows).
  async function rewrite(index, values) {
    const row = movementRow(values);
    const result = await changeRows([index], (rows, [place]) => ({
      ...planEdit(rows, place, row, config.goal),
      typedRow: row,
    }));
    return typeof result === 'string' ? result : 'saved';
  }

  // The spinner of a save or a delete ends with the thumbs-up or the warning (done). The spinner
  // blocks taps until then, so if something breaks before done, end still shows the warning:
  // the panel comes back and the app can be tapped again.
  function workOf() {
    let ended = false;
    const done = (ok) => {
      ended = true;
      return view.workDone(ok);
    };
    return { done, end: () => (ended ? undefined : done(false)) };
  }

  // A tap on Save. Empty required fields are marked, and nothing is saved. A changed movement
  // with nothing changed closes the form and writes nothing. While a movement is being saved,
  // the spinner shows, Save and Cancel wait, and another tap does nothing. After the save, the
  // main screen is read again, the thumbs-up shows and the form closes. If the sheet cannot be
  // read again, the same happens: the movement is saved, and saying otherwise would make the
  // person save it twice. When it is not saved, or the sheet was changed by hand (then the main
  // screen shows the sheet as it is now), the form gets its message, and the warning shows
  // before the form comes back with it.
  let saving = false;
  async function saveMovement(values) {
    if (saving) return;
    const missing = missingFields(values);
    view.showMissing(missing);
    if (missing.length > 0) return;
    if (editing && sameMovement(editing.row, values)) {
      view.closeForm();
      return;
    }
    saving = true;
    view.setSaving(true);
    const work = workOf();
    try {
      let result;
      if (editing) result = await rewrite(editing.index, values);
      else result = (await write(values)) ? 'saved' : 'failed';
      if (result === 'saved') {
        editing = null;
        await load().then(showMain, () => {});
        await work.done(true);
        view.closeForm();
      } else if (result === 'changed') {
        view.saveChanged();
        await load().then(showMain, () => {});
        await work.done(false);
      } else {
        view.saveFailed();
        await work.done(false);
      }
    } finally {
      await work.end();
      saving = false;
      view.setSaving(false);
    }
  }

  // Deletes the movements at indexes (their places in movementRows), after the person said Yes.
  // The rows are read again first. If one of them holds another movement now, the sheet was
  // changed by hand: nothing is deleted, and the screen shows the sheet as it is now.
  // Otherwise every movement below moves up (see movements.js), in one write. While it runs,
  // the spinner shows and another Yes does nothing. Then the thumbs-up shows before the
  // movements go, or the warning before the question comes back with its message.
  let deleting = false;
  async function deleteMovements(indexes) {
    if (deleting) return;
    deleting = true;
    view.setDeleting(true);
    const work = workOf();
    try {
      const fresh = await changeRows(indexes, planDelete);
      if (fresh === 'failed') {
        view.deleteFailed();
        await work.done(false);
      } else if (fresh === 'changed') {
        view.deleteChanged();
        await load().then(showMain, () => {});
        await work.done(false);
      } else {
        // The sheet is read again while the view takes the deleted rows away. If it cannot be
        // read, the goal is worked out from the rows read just before, without the deleted ones.
        const reloaded = load().then(
          () => true,
          () => false,
        );
        await work.done(true);
        await view.deleted();
        if (!(await reloaded)) {
          const gone = new Set(indexes);
          showGoalOf(fresh.filter((row, index) => !gone.has(index)));
        }
        showMain();
      }
    } finally {
      await work.end();
      deleting = false;
      view.setDeleting(false);
    }
  }

  // Changes rows of the sheet: reads them again, checks that the movements at indexes (their
  // places in movementRows) are still where they were, and writes the rows that plan gives, in
  // one write. plan gets the rows read with their formulas and the places of the movements in
  // them, and returns { start, rows } (see movements.js), with typedRow: the row typed in the
  // form, if there is one. Returns the movement rows read just before, "changed" when one of
  // the movements is no longer in its row (the sheet was changed by hand), or "failed" when
  // Google could not be reached or refused the change.
  async function changeRows(indexes, plan) {
    const { sheet, firstRow } = config.form;
    try {
      const [fresh, rows, place] = await Promise.all([
        sheets.getValues(config.goal.movements, { raw: true }),
        sheets.getValues(`${sheet}!A${firstRow}:E`, { formulas: true }),
        sheets.getSheet(sheet),
      ]);
      if (!sameMovements(movementRows, fresh, indexes)) return 'changed';
      // A place in the goal's rows → its row in the sheet → its place in the rows read here.
      const offset = firstRowOf(config.goal.movements) - firstRow;
      const {
        start,
        rows: planned,
        typedRow,
      } = plan(
        rows,
        indexes.map((index) => index + offset),
      );
      const written = keepTexts(planned, rows, fresh, offset).map((each, at) =>
        planned[at] === typedRow ? typedRow.map(typed) : each,
      );
      await sheets.writeRows({ ...place, startRow: firstRow - 1 + start, rows: written });
      return fresh;
    } catch {
      return 'failed';
    }
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
      const [, editor] = await Promise.all([
        load(),
        // When Google cannot say, the person adds nothing, but the app still works.
        sheets.canEdit().catch(() => false),
      ]);
      // We keep the account email only so the next sign-in can be one tap.
      if (fresh || !session.getHint()) {
        const email = await (await loadedAuth())?.getEmail(token);
        if (email) session.saveHint(email);
      }
      canAdd = editor;
      // The form's lists load now, so the form is ready when "+" is tapped. They load again at
      // every sign-in, because the sheet's dropdowns may have changed.
      lists = null;
      if (canAdd) getLists().catch(() => {});
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
    view.onAdd(openForm);
    view.onSave(saveMovement);
    view.onDelete(deleteMovements);
    view.onEdit(openEdit);

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
