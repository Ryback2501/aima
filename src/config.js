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

  // The parts of the Total, each read from one cell. The Total adds up the parts that are
  // switched on; a part with "subtract" is taken away instead. Each part shows as a pill when
  // the Total card is open.
  pills: [
    { name: 'bank', cell: 'Briefing!E7' },
    { name: 'cards', cell: 'Briefing!B10' },
    { name: 'provisioned', cell: 'Briefing!I7', subtract: true },
    { name: 'cash', cell: 'Briefing!K7' },
  ],

  // The spending goal shown below the Total.
  goal: {
    // The movements: source, date, category, description and amount, one movement per row.
    movements: 'Movements!A:E',
    // Where the money came from: the word in the first column, and its icon: the bank, a card or
    // cash, the same drawings as in the Total. A source can have another icon than the part of
    // the Total with its name (Provisioned shows the bank here, and the piggy bank in the Total).
    // A movement with another word, or none, shows no icon.
    sources: {
      'BBVA David': 'bank',
      'BBVA Común': 'bank',
      Polina: 'bank',
      Provisioned: 'bank',
      Deprovisioned: 'bank',
      Después: 'card',
      AMEX: 'card',
      ECI: 'card',
      ICON: 'card',
      Pluxee: 'card',
      Edenred: 'card',
      Cash: 'cash',
    },
    // When a new movement is saved, the movements of one day are sorted by their source, in this
    // order from top to bottom. A source that is not here goes last.
    sourceOrder: [
      'BBVA David',
      'BBVA Común',
      'Después',
      'AMEX',
      'ECI',
      'ICON',
      'Pluxee',
      'Edenred',
      'Cash',
      'Polina',
      'Provisioned',
      'Deprovisioned',
    ],
    // Each Cash movement is followed right below by its Provisioned movement, the one with the
    // same amount. A Provisioned movement with no Cash keeps its own place in the order above.
    sourcePairs: { Cash: 'Provisioned' },
    // The first and the last day that count.
    from: '2026-10-01',
    to: '2026-12-31',
    // Spending over this amount shows in red.
    limit: 4000,
    // Movements that do not count.
    skip: {
      categories: ['Whitening', 'Salary', 'Mortgage', 'Credit Cards', 'Investing'],
      // In these categories, only the movements with these descriptions are left out.
      descriptions: {
        House: [
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

  // The new movement form (only for people who can edit the sheet). Its Source and Category
  // lists are the dropdown lists of these cells: the first movement row, under the headers.
  form: {
    sourceList: 'Movements!A2',
    categoryList: 'Movements!C2',
    // Where a new movement is saved: the sheet of the movements, and its first movement row.
    sheet: 'Movements',
    firstRow: 2,
  },

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
