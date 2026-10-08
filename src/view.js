// Shows the screens on the page. This is the only file that changes the page itself.

import { CARDS, cardStyle, hasCornerIcon } from './cards.js';
import { ICONS } from './icons.js';

const SVG = 'http://www.w3.org/2000/svg';

export function createView(document, t, formatMoney) {
  const element = (id) => document.getElementById(id);
  const screens = ['login', 'checking', 'main'].map((id) => element(id));
  const signInButton = element('sign-in');
  const signOutButton = element('sign-out');
  const loginMessage = element('login-message');
  const totalValue = element('total-value');
  const goalValue = element('goal-value');

  // Put the fixed words (button texts and so on) in the chosen language.
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  // The same for names that screen readers say, for buttons that show only an icon.
  for (const node of document.querySelectorAll('[data-i18n-label]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nLabel));
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
    if (hasCornerIcon(settings)) {
      const badge = document.createElement('span');
      badge.className = 'label-badge';
      badge.append(createIcon(settings.icon, settings.iconSize));
      card.prepend(badge);
    } else {
      card.dataset.badge = 'none';
    }
  }

  // Any element can show an icon from icons.js as its content:
  // <span data-icon="back" data-icon-size="24"></span>
  for (const node of document.querySelectorAll('[data-icon]')) {
    node.append(createIcon(node.dataset.icon, Number(node.dataset.iconSize)));
  }

  // The page is hidden while the app gets ready. After the first screen is chosen, and the
  // font has loaded, we show it: people see the final look straight away.
  let visible = null;
  function show() {
    visible = document.fonts.ready.then(() => document.documentElement.classList.remove('loading'));
  }

  // A screen that has just appeared ignores taps (inert) until its cards have risen into
  // view (see "card-rise" in styles.css). Then it reacts again, if it is still on show.
  let current = null;
  function settle(screen) {
    screen.inert = true;
    visible.then(async () => {
      const rising = screen.getAnimations({ subtree: true });
      await Promise.allSettled(rising.map((animation) => animation.finished));
      if (current === screen) screen.inert = false;
    });
  }

  function render(state) {
    for (const screen of screens) screen.hidden = screen.id !== state.screen;
    if (!visible) show();
    const screen = screens.find(({ id }) => id === state.screen);
    if (screen !== current) {
      current = screen;
      settle(screen);
    }

    if (state.screen === 'login') {
      signInButton.disabled = Boolean(state.disabled);
      loginMessage.textContent = state.message ? t(state.message) : '';
      loginMessage.hidden = !state.message;
    }
    if (state.screen === 'main') {
      // textContent shows the cell as plain text, never as page code.
      totalValue.textContent = state.text;
      // The color comes from the level: "over" is red, "close" is yellow (see styles.css).
      goalValue.textContent = formatMoney(state.goal.amount);
      goalValue.dataset.level = state.goal.level;
    }
  }

  return {
    render,
    onSignIn: (handler) => signInButton.addEventListener('click', () => handler()),
    onSignOut: (handler) => signOutButton.addEventListener('click', () => handler()),
  };
}
