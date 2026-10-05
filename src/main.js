// Starts the app in the browser: connects the app logic to the real page, storage and Google.

import { config } from './config.js';
import { createApp } from './app.js';
import { createView } from './view.js';
import { createSession } from './session.js';
import { createSheetsClient } from './sheets.js';
import { createAuth, loadGoogleIdentity } from './auth.js';
import { browserLanguages, createTranslator, pickLanguage } from './i18n.js';
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

const language = pickLanguage(browserLanguages(navigator));
document.documentElement.lang = language;
const t = createTranslator(language);

const app = createApp({
  config,
  t,
  view: createView(document, t),
  session: createSession({
    sessionStorage: storage('sessionStorage'),
    localStorage: storage('localStorage'),
  }),
  loadAuth: async () =>
    createAuth({
      google: await loadGoogleIdentity({ window, document }),
      clientId: config.googleClientId,
      scopes: config.scopes,
      requiredScopes: config.requiredScopes,
    }),
  createSheets: createSheetsClient,
});

app.start();
