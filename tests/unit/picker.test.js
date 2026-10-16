import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPicker, loadGooglePicker, PickerFailedError } from '../../src/picker.js';

// A fake of the Google Picker library. It writes down how the app sets up the picker, and the
// test then answers like Google does when the person taps Select or Cancel.
function fakeGoogle() {
  const log = { views: [], builders: [], shown: 0 };
  class DocsView {
    constructor(viewId) {
      this.settings = { viewId };
      log.views.push(this.settings);
    }
    setFileIds(ids) {
      this.settings.fileIds = ids;
      return this;
    }
  }
  class PickerBuilder {
    constructor() {
      this.settings = { views: [], features: [] };
      log.builders.push(this.settings);
    }
    addView(view) {
      this.settings.views.push(view.settings);
      return this;
    }
    enableFeature(feature) {
      this.settings.features.push(feature);
      return this;
    }
    setOAuthToken(token) {
      this.settings.token = token;
      return this;
    }
    setDeveloperKey(key) {
      this.settings.key = key;
      return this;
    }
    setAppId(appId) {
      this.settings.appId = appId;
      return this;
    }
    setLocale(locale) {
      this.settings.locale = locale;
      return this;
    }
    setCallback(callback) {
      log.answer = callback;
      return this;
    }
    build() {
      return { setVisible: (visible) => visible && log.shown++ };
    }
  }
  const google = {
    picker: {
      DocsView,
      PickerBuilder,
      ViewId: { SPREADSHEETS: 'spreadsheets' },
      Feature: { NAV_HIDDEN: 'navHidden' },
      Response: { ACTION: 'action', DOCUMENTS: 'docs' },
      Action: { PICKED: 'picked', CANCEL: 'cancel', ERROR: 'error', LOADED: 'loaded' },
      Document: { ID: 'id' },
    },
  };
  return { google, log };
}

function picker(google) {
  return createPicker({
    google,
    apiKey: 'key-1',
    appId: '123',
    spreadsheetId: 'sheet-1',
    getLocale: () => 'es',
  });
}

test('the picker opens on the sheet, with our key, app ID, token and language', async () => {
  const { google, log } = fakeGoogle();

  const picking = picker(google).pickSheet('tok');
  log.answer({ action: 'cancel' });
  await picking;

  assert.equal(log.shown, 1);
  assert.deepEqual(log.builders, [
    {
      views: [{ viewId: 'spreadsheets', fileIds: 'sheet-1' }],
      features: ['navHidden'],
      token: 'tok',
      key: 'key-1',
      appId: '123',
      locale: 'es',
    },
  ]);
});

test('picking the sheet gives true', async () => {
  const { google, log } = fakeGoogle();

  const picking = picker(google).pickSheet('tok');
  log.answer({ action: 'loaded' });
  log.answer({ action: 'picked', docs: [{ id: 'sheet-1' }] });

  assert.equal(await picking, true);
});

test('an error in the picker fails clearly, so the app does not wait forever', async () => {
  const { google, log } = fakeGoogle();

  const picking = picker(google).pickSheet('tok');
  log.answer({ action: 'error' });

  await assert.rejects(picking, PickerFailedError);
});

test('closing the picker, or picking another file, gives false', async () => {
  for (const answer of [{ action: 'cancel' }, { action: 'picked', docs: [{ id: 'other' }] }]) {
    const { google, log } = fakeGoogle();

    const picking = picker(google).pickSheet('tok');
    log.answer(answer);

    assert.equal(await picking, false);
  }
});

// A fake page where adding a <script> "loads" Google's loader at once (or fails).
function fakePage({ fails = false } = {}) {
  const added = [];
  const removed = [];
  const loaded = [];
  const window = {};
  const document = {
    createElement: () => {
      const script = { remove: () => removed.push(script) };
      return script;
    },
    head: {
      appendChild(script) {
        added.push(script);
        if (fails) {
          script.onerror();
          return;
        }
        window.gapi = {
          load(name, { callback }) {
            loaded.push(name);
            window.google = { ...window.google, picker: {} };
            callback();
          },
        };
        script.onload();
      },
    },
  };
  return { window, document, added, removed, loaded };
}

test('loadGooglePicker adds the Google script once and gives back the library', async () => {
  const page = fakePage();

  const first = await loadGooglePicker(page);
  const second = await loadGooglePicker(page);

  assert.equal(page.added.length, 1);
  assert.equal(page.added[0].src, 'https://apis.google.com/js/api.js');
  assert.deepEqual(page.loaded, ['picker']);
  assert.equal(first, page.window.google);
  assert.equal(second, page.window.google);
});

test('loadGooglePicker fails clearly when the script cannot load, and can try again', async () => {
  const page = fakePage({ fails: true });

  await assert.rejects(loadGooglePicker(page), PickerFailedError);
  await assert.rejects(loadGooglePicker(page), PickerFailedError);

  assert.equal(page.added.length, 2);
  // The failed script tags do not stay in the page.
  assert.deepEqual(page.removed, page.added);
});
