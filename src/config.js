// Settings for this copy of the app.
// These values are not secret: every visitor's browser needs them to sign in and read the sheet.
// Who may see the data is decided by the Google Sheet's sharing settings, not by these values.
// See README.md for where to find them.

export const config = {
  // The "Client ID" from Google Cloud (it ends in .apps.googleusercontent.com).
  googleClientId: '1031516526294-ti9605k0osnr9inr06fav204q3s94gpb.apps.googleusercontent.com',

  // The long code in the sheet's address: https://docs.google.com/spreadsheets/d/<this part>/edit
  spreadsheetId: '1af4vfockvvLyh2JASL6URix3EdbV9XhmbZQO6vNsL3A',

  // The parts of the Total, each read from one cell. The Total adds up the parts that are
  // switched on; a part with "subtract" is taken away instead. Each part shows as a pill when
  // the Total card is open.
  pills: [
    { name: 'bank', cell: 'Briefing!E7' },
    { name: 'cards', cell: 'Briefing!E10' },
    { name: 'provisioned', cell: 'Briefing!I7', subtract: true },
    { name: 'cash', cell: 'Briefing!K7' },
  ],

  // The spending goal shown below the Total.
  goal: {
    // The movements: date, category, description and amount, one movement per row.
    movements: 'Movements!B:E',
    // The first and the last day that count.
    from: '2026-10-01',
    to: '2026-12-31',
    // Spending over this amount shows in red.
    limit: 4000,
    // Movements that do not count.
    skip: {
      categories: ['Whitening', 'Salary', 'Mortgage'],
      house: {
        category: 'House',
        descriptions: [
          'Seguro hogar BBVA',
          'Pepephone - Internet',
          'Impuesto vivienda',
          'Comunidad',
          'Luz - Endesa',
          'Gas - Endesa',
        ],
      },
    },
  },

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
