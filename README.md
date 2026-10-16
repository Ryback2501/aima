# aima

Personal home economy survival helper

aima is a small web app. It shows information from a Google Sheet on your phone.

- You sign in with your Google account.
- The Google Sheet decides who can see the data. If the sheet is shared with you (as a viewer or
  an editor), you see the data. If it is not shared with you, the app signs you out and tells you
  why.
- After you sign in, the app shows a short text from the sheet.
- The app speaks English, Spanish and Russian. It uses your phone's language. If it does not have
  your language, it uses English.
- You can add it to your phone's home screen. It then opens like a normal app, without the
  browser bar.

The app has no server. It runs completely in your browser and talks directly to Google.

Address: <https://aima.davidentrena.com/>

## Set up Google (one time)

The app needs four values from Google: a **Client ID**, an **API key**, the **project number**
and the **Spreadsheet ID**. These values are not secret. Every visitor's browser needs them. Your data is protected by the sheet's sharing
settings, not by hiding these values.

### 1. Create the Client ID

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project (or
   choose one).
2. Go to **APIs & Services → Library**. Find **Google Sheets API** and click **Enable**. Do the
   same for **Google Picker API**.
3. Go to **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**).
   - User type: **External**.
   - App name: `aima`. Add your email address where Google asks for it.
   - Under **Data Access**, add the permission
     `https://www.googleapis.com/auth/drive.file`. Paste the full address.
4. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - `https://aima.davidentrena.com`
     - `http://localhost:8082` (to try the app on your computer)
   - You do not need a redirect address.
5. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`. The number at its start is
   the **project number** (you also see it on the project's **Dashboard**).
6. Go to **APIs & Services → Credentials → Create credentials → API key**. Only the Google file
   picker uses it. Restrict it:
   - **Website restrictions**: `https://aima.davidentrena.com/*`, `http://localhost:8082/*` and
     `https://docs.google.com/*` (the file picker does not work without the last one).
   - **API restrictions**: only **Google Picker API**.
7. Copy the **API key**. It starts with `AIza`.

Why the file picker? aima asks Google only for the permission "drive.file". With it, aima can
open only the files that a person gives to it. So the first time someone signs in, the Google file
picker opens on the sheet and the person selects it. Google remembers this for their account. This
permission is not "sensitive", so Google does not need to review it.

### Own address (one time)

The app is published at `https://aima.davidentrena.com`. The domain is managed at Porkbun.

1. At **Porkbun → Domain Management → DNS** for `davidentrena.com`, add a record:
   - Type: **CNAME**, Host: `aima`, Answer: `ryback2501.github.io`.
2. In the GitHub repository, open **Settings → Pages**. Under **Custom domain**, enter
   `aima.davidentrena.com` and save. When the check is green, turn on **Enforce HTTPS**.
3. Recommended, so nobody else can use the domain: in your GitHub account, open
   **Settings → Pages → Add a domain**, enter `davidentrena.com`, and add the TXT record it shows
   at Porkbun.

### Google verification

Google checks these pages before it verifies the app's name:

- About page (the app home page): `https://aima.davidentrena.com/about/`
- Privacy policy: `https://aima.davidentrena.com/privacy`
- Terms of service: `https://aima.davidentrena.com/terms`

In **Google Auth Platform → Branding**, set these three addresses, and add `davidentrena.com` under **Authorized domains**. Google asks you
to prove that you own the domain in [Google Search Console](https://search.google.com/search-console).

### 2. Find the Spreadsheet ID

Open the sheet in your browser. The ID is the long part of the address between `/d/` and
`/edit`:

```
https://docs.google.com/spreadsheets/d/THIS-IS-THE-ID/edit
```

### 3. Put the values in the app

Open `src/config.js` and put in the four values:

```js
googleClientId: 'REPLACE_WITH_GOOGLE_CLIENT_ID',
googleApiKey: 'REPLACE_WITH_GOOGLE_API_KEY',
googleAppId: 'REPLACE_WITH_PROJECT_NUMBER',
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
| `src/index.html`       | The page: login screen, "checking" screen and main screen.      |
| `src/main.js`          | Starts the app in the browser.                                  |
| `src/app.js`           | Decides which screen to show and what each button does.        |
| `src/view.js`          | Shows the screens on the page.                                  |
| `src/months-view.js`   | Shows the months of the open goal card and opens their lists of movements. |
| `src/month-layout.js`  | Works out where the months sit when one of them is open.        |
| `src/goal.js`          | Works out the spending goal, in total and month by month.       |
| `src/components.js`    | How each card and pill looks: size, border, corners, icon, colors, spacing. |
| `src/icons.js`         | The shapes of the app's icons, with no size, so they can be used anywhere. |
| `src/auth.js`          | Signs people in and out with Google.                            |
| `src/picker.js`        | Shows the Google file picker, so a person can give aima the sheet. |
| `src/sheets.js`        | Reads data from the Google Sheet. Later it will also write data. |
| `src/session.js`       | Remembers the sign-in, so the next sign-in needs only one tap.  |
| `src/i18n.js`          | The words of the app in English, Spanish and Russian.           |
| `src/config.js`        | The Google values, the Spreadsheet ID and the cells to read.    |
| `src/no-zoom.js`       | Stops two-finger zoom on phones.                                |
| `src/sw.js`            | Lets phones install the app and keeps a copy of its files.      |
| `src/manifest.webmanifest` | The app name, colors and icons for the home screen.       |
| `src/privacy/index.html` | The privacy policy, at `<app address>/privacy`.          |
| `src/terms/index.html` | The terms of service, at `<app address>/terms`.           |

## Releases

People see a new version only after a release. Changes go to the `dev` branch first. A release
moves them to `main`, and GitHub then publishes the app at the address above. Changes on `dev`
are never published by themselves.
