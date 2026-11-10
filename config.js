// Settings for this copy of the app.
// These values are not secret: every visitor's browser needs them to sign in and read the sheet.
// Who may see the data is decided by the Google Sheet's sharing settings, not by these values.
// See README.md for where to find them.

export const config = {
  // The "Client ID" from Google Cloud (it ends in .apps.googleusercontent.com).
  googleClientId: '712077474606-v44i18grv0mtt944hka709lc81o30d7i.apps.googleusercontent.com',

  // The "API key" from Google Cloud (it starts with AIza). Only the Google file picker uses it.
  // It is public on purpose and works only on this app's web addresses, so the secret scanner
  // must not report it.
  googleApiKey: 'AIzaSyA24kHWE3w9Wi0rc64RGX1XJrYezwXPkRo', // gitleaks:allow

  // The Google Cloud "project number". It is also the first part of the Client ID.
  googleAppId: '712077474606',

  // The long code in the sheet's address: https://docs.google.com/spreadsheets/d/<this part>/edit
  spreadsheetId: '1af4vfockvvLyh2JASL6URix3EdbV9XhmbZQO6vNsL3A',

  // The sheet of the document with the app's settings (see app-sheet.js). The app reads it first.
  appSheet: 'App',

  // The parts of the Total. The Total adds up the parts that are switched on; a part with
  // "subtract" is taken away instead. Each part shows as a pill when the Total card is open. The
  // cell of each part, the movements sheet and the cells of the new movement form's lists are
  // in the CELLS table of the App sheet (see cells.js).
  pills: [
    { name: 'bank' },
    { name: 'cards' },
    { name: 'provisioned', subtract: true },
    { name: 'cash' },
  ],

  // What the app asks Google for.
  // "drive.file" lets the app open only the files the person picks for it in the Google file
  // picker: here, the one sheet. It also allows changes to that file: the app saves new
  // movements into it.
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ],

  // Without these permissions the app cannot work, so sign-in fails with a clear message.
  requiredScopes: ['https://www.googleapis.com/auth/drive.file'],
};

// True when the example values above have been replaced with real ones.
export function isConfigured({ googleClientId, googleApiKey, googleAppId, spreadsheetId }) {
  return [googleClientId, googleApiKey, googleAppId, spreadsheetId].every(
    (value) => typeof value === 'string' && value !== '' && !value.startsWith('REPLACE_WITH_'),
  );
}
