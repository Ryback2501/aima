// A stand-in for Google's sign-in script, used only in tests.
// It gives out a fake token and writes down what the app asked for in window.__gsiLog.
// Each test can change how "Google" answers with window.__fakeGoogle.
(() => {
  const options = window.__fakeGoogle ?? {};
  const log = (window.__gsiLog = { requests: [], revoked: [] });

  window.google = {
    accounts: {
      oauth2: {
        initTokenClient(config) {
          return {
            requestAccessToken(overrides) {
              log.requests.push({ clientId: config.client_id, scope: config.scope, ...overrides });
              setTimeout(() => {
                if (options.closePopup) config.error_callback({ type: 'popup_closed' });
                else config.callback({ access_token: 'fake-token', expires_in: 3599 });
              }, 10);
            },
          };
        },
        hasGrantedAllScopes: () => options.grantSheets !== false,
        revoke(token, done) {
          log.revoked.push(token);
          done?.();
        },
      },
    },
  };
})();
