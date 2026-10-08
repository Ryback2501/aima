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

  // Opening a card full screen, and closing it again.
  const mainScreen = element('main');
  const backdrop = element('backdrop');
  const backButton = element('back');
  const window = document.defaultView;
  let openCard = null;
  let placeholder = null;
  let moving = false;

  // How long a card takes to open or close. No time when the phone asks for less motion.
  function moveTime(card) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return parseFloat(window.getComputedStyle(card).getPropertyValue('--expand-time')) || 0;
  }

  // Moves the card from one place and size on the screen to another, and fades the black
  // backdrop at the same time. Both stay at their end state until we take the animations off.
  async function move(card, from, to, black) {
    const timing = { duration: moveTime(card), easing: 'ease-in-out', fill: 'forwards' };
    const place = ({ top, left, width, height }) => ({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    const animations = [
      card.animate([place(from), place(to)], timing),
      backdrop.animate([{ opacity: black[0] }, { opacity: black[1] }], timing),
    ];
    await Promise.allSettled(animations.map((animation) => animation.finished));
    return animations;
  }

  // While a card is open, only the card and the back button react.
  function coverTheRest(covered) {
    for (const node of mainScreen.querySelectorAll('[data-card]')) {
      node.inert = covered && node !== openCard && node !== backButton;
    }
  }

  async function open(card) {
    if (openCard || moving) return;
    moving = true;
    mainScreen.inert = true;
    const from = card.getBoundingClientRect();
    placeholder = document.createElement('div');
    placeholder.className = 'card-placeholder';
    placeholder.style.width = `${from.width}px`;
    placeholder.style.height = `${from.height}px`;
    card.before(placeholder);
    openCard = card;
    card.classList.add('open');
    card.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    const to = card.getBoundingClientRect();
    const animations = await move(card, from, to, [0, 1]);
    for (const animation of animations) animation.cancel();
    coverTheRest(true);
    backButton.hidden = false;
    // The back button rises in like every card. Taps wait until it is there.
    await Promise.allSettled(backButton.getAnimations().map((animation) => animation.finished));
    moving = false;
    mainScreen.inert = false;
    backButton.focus();
  }

  // Puts the open card back at once, without animation (used when the screen changes).
  function putBack() {
    openCard.classList.remove('open');
    openCard.setAttribute('aria-expanded', 'false');
    placeholder.remove();
    backdrop.hidden = true;
    backButton.hidden = true;
    coverTheRest(false);
    const card = openCard;
    openCard = null;
    placeholder = null;
    return card;
  }

  async function close() {
    if (!openCard || moving) return;
    moving = true;
    mainScreen.inert = true;
    backButton.hidden = true;
    const from = openCard.getBoundingClientRect();
    const to = placeholder.getBoundingClientRect();
    const animations = await move(openCard, from, to, [1, 0]);
    const card = putBack();
    for (const animation of animations) animation.cancel();
    moving = false;
    mainScreen.inert = false;
    card.focus();
  }

  for (const card of document.querySelectorAll('[data-expandable]')) {
    card.addEventListener('click', () => open(card));
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open(card);
    });
  }
  backButton.addEventListener('click', () => close());

  // A tap on a pill switches that part of the Total on or off (the app decides what happens).
  let togglePill = () => {};
  for (const pill of document.querySelectorAll('[data-pill]')) {
    pill.addEventListener('click', () => togglePill(pill.dataset.pill));
  }

  function render(state) {
    if (openCard && state.screen !== 'main') putBack();
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
      totalValue.textContent = formatMoney(state.total);
      // The color comes from the level: "over" is red, "close" is yellow (see styles.css).
      goalValue.textContent = formatMoney(state.goal.amount);
      goalValue.dataset.level = state.goal.level;
    }
  }

  return {
    render,
    onSignIn: (handler) => signInButton.addEventListener('click', () => handler()),
    onSignOut: (handler) => signOutButton.addEventListener('click', () => handler()),
    onTogglePill: (handler) => (togglePill = handler),
  };
}
