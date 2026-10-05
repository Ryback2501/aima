# aima

Personal home economy survival helper

aima is a small web app. It shows information from a Google Sheet on your phone.

- You sign in with your Google account.
- The Google Sheet decides who can see the data. If the sheet is shared with you (as a viewer or
  an editor), you see the data. If it is not shared with you, the app signs you out and tells you
  why.
- After you sign in, the app shows the text of cell **B3** of the **Briefing** sheet.
- The app speaks English, Spanish and Russian. It uses your phone's language. If it does not have
  your language, it uses English.
- You can add it to your phone's home screen. It then opens like a normal app, without the
  browser bar.

The app has no server. It runs completely in your browser and talks directly to Google.

Address: <https://ryback2501.github.io/aima/>

## Set up Google (one time)

The app needs two values from Google: a **Client ID** and the **Spreadsheet ID**. These values
are not secret. Every visitor's browser needs them. Your data is protected by the sheet's sharing
settings, not by hiding these values.

### 1. Create the Client ID

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project (or
   choose one).
2. Go to **APIs & Services → Library**. Find **Google Sheets API** and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**).
   - User type: **External**.
   - App name: `aima`. Add your email address where Google asks for it.
   - Keep the publishing status on **Testing**.
   - Under **Test users**, add the Google account of every person who should use the app. These
     are the same people who can open the sheet.
4. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - `https://ryback2501.github.io`
     - `http://localhost:8082` (to try the app on your computer)
   - You do not need a redirect address.
5. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`.

Why "Testing" mode? Reading sheets is a sensitive permission. A public Google app with this
permission needs a review by Google. In Testing mode there is no review, but only the test users
can sign in (up to 100 people).

### 2. Find the Spreadsheet ID

Open the sheet in your browser. The ID is the long part of the address between `/d/` and
`/edit`:

```
https://docs.google.com/spreadsheets/d/THIS-IS-THE-ID/edit
```

### 3. Put both values in the app

Open `src/config.js` and replace the two example values:

```js
googleClientId: 'REPLACE_WITH_GOOGLE_CLIENT_ID',
spreadsheetId: 'REPLACE_WITH_SPREADSHEET_ID',
```

While the example values are still there, the app shows "This app is not set up yet."

## Try the app on your computer

You need [Node.js](https://nodejs.org/) 22 or newer.

```bash
npm ci          # install the tools (only needed once)
npm start       # build the app and open it at http://localhost:8082
```

Sign-in works on your computer only when `http://localhost:8082` is in the Client ID's
authorized origins (see step 1).

## Checks

| Command             | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `npm run lint`      | Checks the code for mistakes and checks the formatting.        |
| `npm run format`    | Fixes the formatting.                                          |
| `npm run test:unit` | Tests the app logic.                                           |
| `npm run test:e2e`  | Tests the whole app in a real browser, with Google replaced by a stand-in. Run `npx playwright install chromium` once before the first time. |
| `npm run build`     | Builds the app into the `dist/` folder.                        |
| `npm run icons`     | Makes the home-screen icons again from `src/icons/logo.svg`.   |

## How the code is organized

The app has no extra libraries at run time. The files in `src/` are the files people get.

| File                   | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `src/index.html`       | The page: login screen, "checking" screen and briefing screen.  |
| `src/main.js`          | Starts the app in the browser.                                  |
| `src/app.js`           | Decides which screen to show and what each button does.        |
| `src/view.js`          | Shows the screens on the page.                                  |
| `src/auth.js`          | Signs people in and out with Google.                            |
| `src/sheets.js`        | Reads data from the Google Sheet. Later it will also write data. |
| `src/session.js`       | Remembers the sign-in, so the next sign-in needs only one tap.  |
| `src/i18n.js`          | The words of the app in English, Spanish and Russian.           |
| `src/config.js`        | The Client ID, the Spreadsheet ID and the cell to show.         |
| `src/no-zoom.js`       | Stops two-finger zoom on phones.                                |
| `src/sw.js`            | Lets phones install the app and keeps a copy of its files.      |
| `src/manifest.webmanifest` | The app name, colors and icons for the home screen.       |

## Releases

People see a new version only after a release. Changes go to the `dev` branch first. A release
moves them to `main`, and GitHub then publishes the app at the address above. Changes on `dev`
are never published by themselves.
