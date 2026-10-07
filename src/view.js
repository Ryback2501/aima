// Shows the screens on the page. This is the only file that changes the page itself.

import { CARDS, cardStyle } from './cards.js';
import { ICONS } from './icons.js';

const SVG = 'http://www.w3.org/2000/svg';

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

  // Builds an icon from icons.js, the given number of pixels wide and high.
  function createIcon(name, size) {
    const icon = ICONS[name];
    if (!icon) throw new Error(`There is no icon called "${name}" in icons.js.`);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', icon.viewBox);
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', icon.path);
    svg.append(path);
    return svg;
  }

  // Give every card the look set in cards.js: sizes, colors and the icon in its corner.
  for (const card of document.querySelectorAll('[data-card]')) {
    const settings = CARDS[card.dataset.card];
    if (!settings) throw new Error(`There is no card called "${card.dataset.card}" in cards.js.`);
    for (const [name, value] of Object.entries(cardStyle(settings))) {
      card.style.setProperty(name, value);
    }
    const badge = document.createElement('span');
    badge.className = 'label-badge';
    badge.append(createIcon(settings.icon, settings.iconSize));
    card.prepend(badge);
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
