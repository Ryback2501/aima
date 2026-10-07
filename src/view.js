// Shows the screens on the page. This is the only file that changes the page itself.

export function createView(document, t) {
  const element = (id) => document.getElementById(id);
  const screens = ['login', 'checking', 'main'].map((id) => element(id));
  const signInButton = element('sign-in');
  const signOutButton = element('sign-out');
  const loginMessage = element('login-message');
  const totalValue = element('total-value');

  // Put the fixed words (button texts and so on) in the chosen language.
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }

  function render(state) {
    for (const screen of screens) screen.hidden = screen.id !== state.screen;

    if (state.screen === 'login') {
      signInButton.disabled = Boolean(state.disabled);
      loginMessage.textContent = state.message ? t(state.message) : '';
      loginMessage.hidden = !state.message;
    }
    if (state.screen === 'main') {
      // textContent shows the cell as plain text, never as page code.
      totalValue.textContent = state.text;
    }
  }

  return {
    render,
    onSignIn: (handler) => signInButton.addEventListener('click', () => handler()),
    onSignOut: (handler) => signOutButton.addEventListener('click', () => handler()),
  };
}
