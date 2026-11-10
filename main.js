// Starts the app in the browser: connects the app logic to the real page, storage and Google.

import { config } from './config.js';
import { createApp } from './app.js';
import { createView } from './view.js';
import { createSession } from './session.js';
import { createSheetsClient } from './sheets.js';
import { createAuth, loadGoogleIdentity } from './auth.js';
import { createPicker, loadGooglePicker } from './picker.js';
import { browserLanguages, pickLanguage } from './i18n.js';
import { blockZoom } from './no-zoom.js';

// Some browsers throw an error just for looking at storage (for example with cookies blocked).
function storage(name) {
  try {
    return window[name];
  } catch {
    return undefined;
  }
}

blockZoom(document);

// The service worker lets phones install aima as an app. If it fails, the app still works.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const session = createSession({ localStorage: storage('localStorage') });

// The language chosen on this phone comes first. Without one, the phone's languages decide.
const language = pickLanguage([session.getLanguage(), ...browserLanguages(navigator)]);

const app = createApp({
  config,
  view: createView(document, language),
  session,
  loadAuth: async () =>
    createAuth({
      google: await loadGoogleIdentity({ window, document }),
      clientId: config.googleClientId,
      scopes: config.scopes,
      requiredScopes: config.requiredScopes,
    }),
  loadPicker: async () =>
    createPicker({
      google: await loadGooglePicker({ window, document }),
      apiKey: config.googleApiKey,
      appId: config.googleAppId,
      spreadsheetId: config.spreadsheetId,
      // The picker uses the app's language.
      getLocale: () => document.documentElement.lang,
    }),
  createSheets: createSheetsClient,
});

app.start();
