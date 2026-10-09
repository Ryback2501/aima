// Shows the screens on the page. Only this file and months-view.js (which it uses) change the page.

import { CARDS, cardStyle, hasIcon, PILLS, pillStyle } from './components.js';
import { ICONS } from './icons.js';
import { createMonths } from './months-view.js';

const SVG = 'http://www.w3.org/2000/svg';

export function createView(document, t, formatMoney, monthName) {
  const element = (id) => document.getElementById(id);
  const screens = ['login', 'checking', 'main'].map((id) => element(id));
  const signInButton = element('sign-in');
  const signOutButton = element('sign-out');
  const loginMessage = element('login-message');
  const totalValue = element('total-value');
  const goalValue = element('goal-value');
  const goalTitle = element('goal-title');

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

  // Give every card the look set in components.js: sizes, colors and the icon in its corner.
  for (const card of document.querySelectorAll('[data-card]')) {
    const settings = CARDS[card.dataset.card];
    if (!settings)
      throw new Error(`There is no card called "${card.dataset.card}" in components.js.`);
    for (const [name, value] of Object.entries(cardStyle(settings))) {
      card.style.setProperty(name, value);
    }
    if (hasIcon(settings)) {
      const badge = document.createElement('span');
      badge.className = 'label-badge';
      badge.append(createIcon(settings.icon, settings.iconSize));
      card.prepend(badge);
    } else {
      card.dataset.badge = 'none';
    }
  }

  // Open cards keep room at the bottom for the back button, so styles.css needs its height.
  document.documentElement.style.setProperty('--back-size', `${CARDS.back.height}px`);

  // Give every pill the look set in components.js.
  for (const pill of document.querySelectorAll('[data-pill]')) {
    const settings = PILLS[pill.dataset.pill];
    if (!settings) {
      throw new Error(`There is no pill called "${pill.dataset.pill}" in components.js.`);
    }
    for (const [name, value] of Object.entries(pillStyle(settings))) {
      pill.style.setProperty(name, value);
    }
    if (hasIcon(settings)) {
      const icon = createIcon(settings.icon, settings.iconSize);
      icon.classList.add('pill-icon');
      pill.querySelector('.pill-name').before(icon);
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

  const window = document.defaultView;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nextFrame = () => new Promise((done) => window.requestAnimationFrame(() => done()));

  // Every animation blocks taps while it plays: the whole app is "inert" until all the work
  // given to lockWhile is done. Several animations can overlap; taps come back after the last.
  const page = document.querySelector('main');
  let locks = 0;
  async function lockWhile(work) {
    locks += 1;
    page.inert = true;
    try {
      return await work;
    } finally {
      locks -= 1;
      if (locks === 0) page.inert = false;
    }
  }

  // Waits until every animation on these elements (and inside them) has finished.
  // If a browser ever forgets to tell that an animation ended, taps still come back after
  // 2 seconds, so the app can never stay stuck.
  async function still(...elements) {
    const animations = elements.flatMap((node) => node.getAnimations({ subtree: true }));
    await Promise.race([
      Promise.allSettled(animations.map((animation) => animation.finished)),
      new Promise((done) => window.setTimeout(done, 2000)),
    ]);
  }

  // A screen that has just appeared waits until its cards have risen into view.
  let current = null;
  function settle(screen) {
    lockWhile(visible.then(() => still(screen)));
  }

  // Opening a card full screen, and closing it again.
  const mainScreen = element('main');
  const backdrop = element('backdrop');
  const backButton = element('back');
  let openCard = null;
  let placeholder = null;
  let moving = false;
  // How far the number of the open card moves when it opens (see moveNumber).
  let numberShift = 0;

  // How long a card takes to open or close. No time when the phone asks for less motion.
  function moveTime(card) {
    if (reduceMotion()) return 0;
    return parseFloat(window.getComputedStyle(card).getPropertyValue('--expand-time')) || 0;
  }

  // Moves the card from one place and size on the screen to another, and fades the black
  // backdrop at the same time. Both stay at their end state until we take the animations off.
  function move(card, from, to, black) {
    const timing = { duration: moveTime(card), easing: 'ease-in-out', fill: 'forwards' };
    const place = ({ top, left, width, height }) => ({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    return [
      card.animate([place(from), place(to)], timing),
      backdrop.animate([{ opacity: black[0] }, { opacity: black[1] }], timing),
    ];
  }

  // In an open card the number sits at the top. While the card grows, the number glides from
  // where it was to the top, with the card's own timing. It starts "shift" pixels away from its
  // place in the open layout, and goes to 0 (or the other way round when closing).
  const numberOf = (card) => card.querySelector('.total-value');
  function moveNumber(card, from, to) {
    const timing = { duration: moveTime(card), easing: 'ease-in-out', fill: 'forwards' };
    const at = (shift) => ({ transform: `translateY(${shift}px)` });
    return [numberOf(card).animate([at(from), at(to)], timing)];
  }

  // The parts of an open card that rise in one after the other, then the back button.
  // Closing uses the reverse order: the back button first, the first part last.
  function lineUp(card) {
    const parts = [...card.querySelectorAll('.rise-in')];
    parts.forEach((part, index) => {
      part.style.setProperty('--rise-order', String(index));
      part.style.setProperty('--sink-order', String(parts.length - index));
    });
    backButton.style.setProperty('--card-order', String(parts.length));
    backButton.style.setProperty('--sink-order', '0');
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
    await lockWhile(
      (async () => {
        const from = card.getBoundingClientRect();
        const number = numberOf(card);
        const numberFrom = number ? number.getBoundingClientRect().top - from.top : 0;
        placeholder = document.createElement('div');
        placeholder.className = 'card-placeholder';
        placeholder.style.width = `${from.width}px`;
        placeholder.style.height = `${from.height}px`;
        card.before(placeholder);
        openCard = card;
        lineUp(card);
        card.classList.add('open');
        card.setAttribute('aria-expanded', 'true');
        backdrop.hidden = false;
        // Measure the open layout before anything moves.
        const to = card.getBoundingClientRect();
        const hasNumber = Boolean(number);
        if (hasNumber) numberShift = numberFrom - (number.getBoundingClientRect().top - to.top);
        const animations = move(card, from, to, [0, 1]);
        if (hasNumber) animations.push(...moveNumber(card, numberShift, 0));
        await Promise.allSettled(animations.map((animation) => animation.finished));
        for (const animation of animations) animation.cancel();
        coverTheRest(true);
        // Now the parts rise in, one after the other, and the back button last.
        card.classList.add('settled');
        months.follow();
        backButton.hidden = false;
        await still(card, backButton);
      })(),
    );
    moving = false;
    backButton.focus();
  }

  // Puts the open card back at once, without animation (used when the screen changes, and at
  // the end of closing).
  function putBack() {
    months.reset();
    openCard.classList.remove('open', 'settled', 'closing');
    openCard.setAttribute('aria-expanded', 'false');
    placeholder.remove();
    backdrop.hidden = true;
    backButton.hidden = true;
    backButton.classList.remove('sinking');
    coverTheRest(false);
    const card = openCard;
    openCard = null;
    placeholder = null;
    return card;
  }

  async function close() {
    if (!openCard || moving) return;
    moving = true;
    const card = await lockWhile(
      (async () => {
        // First the back button and the parts sink away, in the reverse order.
        openCard.classList.add('closing');
        backButton.classList.add('sinking');
        await still(openCard, backButton);
        backButton.hidden = true;
        // Then the card shrinks back to its place, and the number glides back down.
        const from = openCard.getBoundingClientRect();
        const to = placeholder.getBoundingClientRect();
        const animations = move(openCard, from, to, [1, 0]);
        if (numberOf(openCard)) animations.push(...moveNumber(openCard, 0, numberShift));
        await Promise.allSettled(animations.map((animation) => animation.finished));
        const closed = putBack();
        for (const animation of animations) animation.cancel();
        return closed;
      })(),
    );
    moving = false;
    card.focus();
  }

  // The month items of the open goal card (see months-view.js).
  const months = createMonths({
    document,
    room: document.querySelector('.month-room'),
    createIcon,
    formatMoney,
    monthName,
    lockWhile,
    settled: (node) => nextFrame().then(() => still(node)),
  });

  for (const card of document.querySelectorAll('[data-expandable]')) {
    card.addEventListener('click', () => open(card));
    card.addEventListener('keydown', (event) => {
      // Only keys on the card itself: the pills inside it handle their own keys.
      if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      open(card);
    });
  }
  backButton.addEventListener('click', () => close());

  // Shows the Total as money. After a tap on a pill, the number counts from the old Total to
  // the new one while the pill changes color. A small animation with the pill's timing is the
  // clock: at every frame we write the value for the time gone by.
  let shownTotal = null;
  // Writes a Total. Below 0 it is red (see styles.css), also while it counts.
  function writeTotal(value) {
    totalValue.textContent = formatMoney(value);
    totalValue.toggleAttribute('data-negative', value < 0);
  }
  let counting = false;
  function showTotal(total) {
    const start = shownTotal;
    shownTotal = total;
    if (!counting || start === null || start === total || reduceMotion()) {
      writeTotal(total);
      return Promise.resolve();
    }
    const pillFade = window.getComputedStyle(page).getPropertyValue('--pill-fade');
    const clock = totalValue.animate([{}, {}], {
      duration: parseFloat(pillFade) || 0,
      easing: 'ease-in-out',
    });
    const tick = () => {
      if (shownTotal !== total) return; // A newer Total took over.
      const progress = clock.effect.getComputedTiming().progress ?? 1;
      writeTotal(start + (total - start) * progress);
      if (clock.playState !== 'finished') window.requestAnimationFrame(tick);
    };
    tick();
    return clock.finished.then(() => shownTotal === total && writeTotal(total));
  }

  // A tap on a pill switches that part of the Total on or off (the app decides what happens).
  // Taps wait until the pill has changed color and the Total has finished counting.
  let togglePill = () => {};
  for (const pill of document.querySelectorAll('[data-pill]')) {
    pill.addEventListener('click', () => {
      counting = true;
      togglePill(pill.dataset.pill);
      counting = false;
      lockWhile(nextFrame().then(() => still(pill, totalValue)));
    });
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
      showTotal(state.total);
      for (const { name, amount, on } of state.pills) {
        const pill = document.querySelector(`[data-pill="${name}"]`);
        pill.setAttribute('aria-pressed', String(on));
        pill.querySelector('.pill-value').textContent = formatMoney(amount);
      }
      // The color comes from the level: "over" is red, "close" is yellow (see styles.css).
      goalValue.textContent = formatMoney(state.goal.amount);
      goalValue.dataset.level = state.goal.level;
      // "Goal 4K": the word in the app's language and the limit in thousands.
      goalTitle.textContent = `${t('goal')} ${state.goal.limit / 1000}K`;
      months.render(state.goal.months);
    }
  }

  return {
    render,
    onSignIn: (handler) => signInButton.addEventListener('click', () => handler()),
    onSignOut: (handler) => signOutButton.addEventListener('click', () => handler()),
    onTogglePill: (handler) => (togglePill = handler),
  };
}
