// A stand-in for Google's file picker (loaded with Google's api.js), used only in tests.
// It writes down how the app set up the picker in window.__pickerLog, and then "taps" Select
// or Cancel at once. Each test can change the answer with window.__fakeGoogle.pick.
(() => {
  const options = window.__fakeGoogle ?? {};
  const log = (window.__pickerLog = []);

  class DocsView {
    constructor(viewId) {
      this.settings = { viewId };
    }
    setFileIds(fileIds) {
      this.settings.fileIds = fileIds;
      return this;
    }
  }

  class PickerBuilder {
    constructor() {
      this.settings = { views: [], features: [] };
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
      this.callback = callback;
      return this;
    }
    build() {
      const { settings, callback } = this;
      return {
        setVisible() {
          log.push(settings);
          setTimeout(() => {
            callback({ action: 'loaded' });
            if (options.pick === 'cancel') {
              callback({ action: 'cancel' });
              return;
            }
            // Tell the fake Google Sheets that the person gave the sheet to the app.
            window.__sheetPicked?.();
            callback({ action: 'picked', docs: [{ id: settings.views[0].fileIds }] });
          }, 10);
        },
      };
    }
  }

  window.gapi = {
    load(name, { callback }) {
      window.google = window.google ?? {};
      window.google.picker = {
        DocsView,
        PickerBuilder,
        ViewId: { SPREADSHEETS: 'spreadsheets' },
        Feature: { NAV_HIDDEN: 'navHidden' },
        Response: { ACTION: 'action', DOCUMENTS: 'docs' },
        Action: { PICKED: 'picked', CANCEL: 'cancel', ERROR: 'error', LOADED: 'loaded' },
        Document: { ID: 'id' },
      };
      setTimeout(callback, 0);
    },
  };
})();
