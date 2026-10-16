// Shows the Google file picker, so a person can give aima their sheet.
// aima may only open the files that a person picks for it (the Google permission "drive.file").
// So the first time, the picker opens on the aima sheet and the person taps Select. Google then
// remembers this for their Google account, and the picker does not show again.

const GAPI_URL = 'https://apis.google.com/js/api.js';

// The picker could not load: no internet, or Google is down.
export class PickerFailedError extends Error {
  constructor() {
    super('The Google file picker could not load.');
    this.name = 'PickerFailedError';
  }
}

const loading = new WeakMap();

// Adds Google's loader script to the page (only once), loads the picker with it, and returns
// the `google` library.
export function loadGooglePicker({ window, document }) {
  if (window.google?.picker) return Promise.resolve(window.google);
  if (!loading.has(window)) {
    const promise = new Promise((resolve, reject) => {
      const fail = () => reject(new PickerFailedError());
      const loadPicker = () =>
        window.gapi.load('picker', { callback: () => resolve(window.google), onerror: fail });
      if (window.gapi) {
        loadPicker();
        return;
      }
      const script = document.createElement('script');
      script.src = GAPI_URL;
      script.async = true;
      script.onload = loadPicker;
      script.onerror = () => {
        // Take the failed script out of the page, so the next try starts clean.
        script.remove();
        fail();
      };
      document.head.appendChild(script);
    });
    loading.set(window, promise);
    // Forget a failed try, so the next time can try again.
    promise.catch(() => loading.delete(window));
  }
  return loading.get(window);
}

export function createPicker({ google, apiKey, appId, spreadsheetId, getLocale }) {
  const { picker } = google;

  // Opens the picker on the sheet. Gives true when the person picked it, false when they closed
  // the picker. Someone who cannot open the sheet does not see it there, so they can only close.
  // Fails with PickerFailedError when the picker shows an error.
  function pickSheet(token) {
    return new Promise((resolve, reject) => {
      const view = new picker.DocsView(picker.ViewId.SPREADSHEETS).setFileIds(spreadsheetId);
      new picker.PickerBuilder()
        .addView(view)
        .enableFeature(picker.Feature.NAV_HIDDEN)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        // The app ID tells Google which app gets the file: without it, aima cannot open it.
        .setAppId(appId)
        .setLocale(getLocale())
        .setCallback((data) => {
          const action = data[picker.Response.ACTION];
          if (action === picker.Action.PICKED) {
            const docs = data[picker.Response.DOCUMENTS] ?? [];
            resolve(docs.some((doc) => doc[picker.Document.ID] === spreadsheetId));
          } else if (action === picker.Action.CANCEL) {
            resolve(false);
          } else if (action === picker.Action.ERROR) {
            reject(new PickerFailedError());
          }
          // Other answers only say that the picker is loading. We wait for the person.
        })
        .build()
        .setVisible(true);
    });
  }

  return { pickSheet };
}
