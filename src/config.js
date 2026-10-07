// Settings for this copy of the app.
// These values are not secret: every visitor's browser needs them to sign in and read the sheet.
// Who may see the data is decided by the Google Sheet's sharing settings, not by these values.
// See README.md for where to find them.

export const config = {
  // The "Client ID" from Google Cloud (it ends in .apps.googleusercontent.com).
  googleClientId: '1031516526294-ti9605k0osnr9inr06fav204q3s94gpb.apps.googleusercontent.com',

  // The long code in the sheet's address: https://docs.google.com/spreadsheets/d/<this part>/edit
  spreadsheetId: '1af4vfockvvLyh2JASL6URix3EdbV9XhmbZQO6vNsL3A',

  // The cell with the Total, which the app shows after sign-in.
  totalCell: 'Briefing!B3',

  // What the app asks Google for. Today it only reads. When the app can add and change data,
  // the first one becomes "https://www.googleapis.com/auth/spreadsheets".
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],

  // Without these permissions the app cannot work, so sign-in fails with a clear message.
  requiredScopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
};

// True when the example values above have been replaced with real ones.
export function isConfigured({ googleClientId, spreadsheetId }) {
  return [googleClientId, spreadsheetId].every(
    (value) => typeof value === 'string' && value !== '' && !value.startsWith('REPLACE_WITH_'),
  );
}
