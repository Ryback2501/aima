// Signs people in and out with their Google account.
// It uses Google Identity Services, Google's own sign-in library for web pages.
// Google gives the app an "access token": a short-lived key that lets the app read the sheet
// as that person. The app never sees the person's password.

const GSI_URL = 'https://accounts.google.com/gsi/client';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// The sign-in did not finish: the person closed the Google window, said no, or Google failed.
export class SignInFailedError extends Error {
  constructor(reason) {
    super(`Google sign-in did not finish (${reason}).`);
    this.name = 'SignInFailedError';
    this.reason = reason;
  }
}

// The person signed in but did not allow the app to see their sheets.
export class PermissionMissingError extends Error {
  constructor() {
    super('The permission to see Google Sheets was not given.');
    this.name = 'PermissionMissingError';
  }
}

const loading = new WeakMap();

// Adds Google's sign-in script to the page (only once) and returns the `google` library.
export function loadGoogleIdentity({ window, document }) {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (!loading.has(window)) {
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_URL;
      script.async = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        // Forget the failed try, so the next sign-in can try again.
        loading.delete(window);
        reject(new SignInFailedError('script_not_loaded'));
      };
      document.head.appendChild(script);
    });
    loading.set(window, promise);
  }
  return loading.get(window);
}

export function createAuth({
  google,
  clientId,
  scopes,
  requiredScopes,
  fetch = globalThis.fetch,
  now = Date.now,
}) {
  const { oauth2 } = google.accounts;

  function revoke(token) {
    return new Promise((resolve) => oauth2.revoke(token, () => resolve()));
  }

  // Opens Google's sign-in window. Call it straight from a button tap: the browser blocks
  // pop-up windows that do not come from a tap.
  function signIn({ hint } = {}) {
    return new Promise((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: async (response) => {
          if (response.error) {
            reject(new SignInFailedError(response.error));
            return;
          }
          if (!oauth2.hasGrantedAllScopes(response, ...requiredScopes)) {
            await revoke(response.access_token);
            reject(new PermissionMissingError());
            return;
          }
          resolve({
            token: response.access_token,
            expiresAt: now() + Number(response.expires_in) * 1000,
          });
        },
        error_callback: (error) => reject(new SignInFailedError(error?.type ?? 'unknown')),
      });
      // With a remembered email, Google can sign the same person in without the account list.
      client.requestAccessToken(
        hint ? { prompt: '', login_hint: hint } : { prompt: 'select_account' },
      );
    });
  }

  // Cancels the token at Google, so it cannot be used again.
  async function signOut(token) {
    if (token) await revoke(token);
  }

  // Returns the email of the signed-in account, or null. We only use it to make the next
  // sign-in faster, so a failure here is not a problem.
  async function getEmail(token) {
    try {
      const response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return null;
      const { email } = await response.json();
      return email ?? null;
    } catch {
      return null;
    }
  }

  return { signIn, signOut, getEmail };
}
