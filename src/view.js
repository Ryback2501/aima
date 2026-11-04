// Shows the screens on the page. Only this file and months-view.js (which it uses) change the page.

import { CARDS, cardStyle, hasIcon, PILLS, pillStyle } from './components.js';
import { FLAGS } from './flags.js';
import {
  createDayNamer,
  createAmountFormatter,
  createDeleteQuestion,
  createMoneyFormatter,
  createMonthNamer,
  createTranslator,
} from './i18n.js';
import { createForm } from './form-view.js';
import { ICONS } from './icons.js';
import { createMonths, endless } from './months-view.js';

const SVG = 'http://www.w3.org/2000/svg';
// How big the flags of the language selector are, in pixels.
const FLAG_SIZE = 34;

export function createView(document, language) {
  const element = (id) => document.getElementById(id);
  const screens = ['login', 'checking', 'main'].map((id) => element(id));
  const signInButton = element('sign-in');
  const signOutButton = element('sign-out');
  const loginMessage = element('login-message');
  const totalValue = element('total-value');
  const goalValue = element('goal-value');
  const goalTitle = element('goal-title');

  // The words, the amounts, the month names and the dates, in the app's language. useLanguage
  // changes them.
  let appLanguage, t, formatMoney, formatAmount, monthName, dayName, deleteQuestion;
  function useLanguage(language) {
    appLanguage = language;
    document.documentElement.lang = language;
    t = createTranslator(language);
    formatMoney = createMoneyFormatter(language);
    formatAmount = createAmountFormatter(language);
    monthName = createMonthNamer(language);
    dayName = createDayNamer(language);
    deleteQuestion = createDeleteQuestion(language);
    // Put the fixed words (button texts and so on) in the language.
    for (const node of document.querySelectorAll('[data-i18n]')) {
      node.textContent = t(node.dataset.i18n);
    }
    // The same for names that screen readers say, for buttons that show only an icon.
    for (const node of document.querySelectorAll('[data-i18n-label]')) {
      node.setAttribute('aria-label', t(node.dataset.i18nLabel));
    }
  }
  useLanguage(language);

  // Builds a drawing the given number of pixels wide and high, from its drawing area
  // (viewBox) and its shapes, each with its own color (fill) or the color of the text.
  function createDrawing(viewBox, parts, size) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('aria-hidden', 'true');
    for (const { fill, d } of parts) {
      const path = document.createElementNS(SVG, 'path');
      if (fill) path.setAttribute('fill', fill);
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  // Builds an icon from icons.js.
  function createIcon(name, size) {
    const icon = ICONS[name];
    if (!icon) throw new Error(`There is no icon called "${name}" in icons.js.`);
    return createDrawing(icon.viewBox, [{ d: icon.path }], size);
  }

  // Builds a flag from flags.js.
  const createFlag = (flag, size) => createDrawing(flag.viewBox, flag.parts, size);

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
  // 2 seconds, so the app can never stay stuck. An animation that repeats without end (a long
  // description moving) never finishes, so we do not wait for it.
  async function still(...elements) {
    const animations = elements
      .flatMap((node) => node.getAnimations({ subtree: true }))
      .filter((animation) => !endless(animation));
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
  // The "+" button shows in the open goal card, only for people who can edit the sheet.
  const addButton = element('add');
  // The Delete button shows next to "+" while movements are selected ("paired").
  const deleteButton = element('delete');
  let canAdd = false;
  let paired = false;
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

  // Moves the card from one place and size on the screen to another, and fades the white
  // backdrop at the same time. Both stay at their end state until we take the animations off.
  function move(card, from, to, cover) {
    const timing = { duration: moveTime(card), easing: 'ease-in-out', fill: 'forwards' };
    const place = ({ top, left, width, height }) => ({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    return [
      card.animate([place(from), place(to)], timing),
      backdrop.animate([{ opacity: cover[0] }, { opacity: cover[1] }], timing),
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
    // The "+" and Delete buttons rise in and sink away together with the back button.
    for (const button of [backButton, addButton, deleteButton]) {
      button.style.setProperty('--card-order', String(parts.length));
      button.style.setProperty('--sink-order', '0');
    }
  }

  // The buttons at the bottom of an open card: the back button, and "+" in the goal card, with
  // Delete while movements are selected.
  function bottomButtons() {
    if (!canAdd || openCard?.dataset.card !== 'goal') return [backButton];
    return paired ? [backButton, addButton, deleteButton] : [backButton, addButton];
  }

  // While a card is open, only the card (with the buttons inside it) and its buttons react.
  const allButtons = [backButton, addButton, deleteButton];
  function coverTheRest(covered) {
    for (const node of mainScreen.querySelectorAll('[data-card]')) {
      node.inert = covered && !openCard.contains(node) && !allButtons.includes(node);
    }
  }

  // The first movement selected: "+" slides to the left, then Delete rises in on its right.
  // The last one unselected: the same in reverse. While the buttons are hidden (the form or the
  // delete question is open), they change at once. A change while the buttons move waits for it.
  let pairing = false;
  let selectedCount = 0;
  async function selectionChanged(count) {
    selectedCount = count;
    if (pairing) return;
    pairing = true;
    try {
      while (paired !== selectedCount > 0) {
        paired = !paired;
        if (addButton.hidden) {
          addButton.classList.toggle('paired', paired);
          continue;
        }
        await lockWhile(paired ? showDelete() : hideDelete());
      }
    } finally {
      pairing = false;
    }
  }

  async function showDelete() {
    addButton.classList.add('paired');
    await still(addButton);
    deleteButton.style.setProperty('--card-order', '0');
    deleteButton.hidden = false;
    await still(deleteButton);
  }

  async function hideDelete() {
    deleteButton.style.setProperty('--sink-order', '0');
    deleteButton.classList.add('sinking');
    await still(deleteButton);
    deleteButton.hidden = true;
    deleteButton.classList.remove('sinking');
    addButton.classList.remove('paired');
    await still(addButton);
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
        for (const button of bottomButtons()) button.hidden = false;
        await still(card, ...bottomButtons());
      })(),
    );
    moving = false;
    backButton.focus();
  }

  // Puts the open card back at once, without animation (used when the screen changes, and at
  // the end of closing).
  function putBack() {
    for (const button of allButtons) {
      button.hidden = true;
      button.classList.remove('sinking');
    }
    // The buttons are hidden now, so the selection goes at once.
    months.reset();
    formOpen = false;
    formAsked = false;
    panelOpen = false;
    openCard.classList.remove('open', 'settled', 'closing', 'adding', 'asking', 'hiding-months');
    formPanel.classList.remove('sinking');
    deletePanel.classList.remove('sinking');
    openCard.setAttribute('aria-expanded', 'false');
    placeholder.remove();
    backdrop.hidden = true;
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
        // First the buttons and the parts sink away, in the reverse order.
        openCard.classList.add('closing');
        const buttons = bottomButtons();
        for (const button of buttons) button.classList.add('sinking');
        await still(openCard, ...buttons);
        for (const button of buttons) button.hidden = true;
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
    // Always in the language of the moment, also after it changes.
    formatMoney: (amount) => formatMoney(amount),
    monthName: (year, month) => monthName(year, month),
    dayName: (year, month, day) => dayName(year, month, day),
    lockWhile,
    settled: (node) => nextFrame().then(() => still(node)),
    reduceMotion,
    // Only people who can edit the sheet can select movements, like the "+" button.
    canSelect: () => canAdd,
    selectionChanged,
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

  // The new movement form takes the place of the months in the open goal card ("adding", see
  // styles.css). The back and "+" buttons hide while it is open.
  const formPanel = document.querySelector('.movement-form');
  const form = createForm(formPanel, {
    // Always in the language of the moment, also after it changes.
    formatAmount: (cents) => formatAmount(cents),
  });
  let formOpen = false;
  // True after a tap on "+", until the form opens or the goal card closes.
  let formAsked = false;

  // Shows the form with the lists, or with a message when they could not be read. Nothing
  // happens when the goal card closed while the lists were loading, even if it is open again.
  // First the buttons and the months sink away, like when a card closes ("hiding-months"). Then
  // the form rises in, like a card.
  async function openForm(lists) {
    if (!formAsked || formOpen || moving || openCard?.dataset.card !== 'goal') return;
    formAsked = false;
    formOpen = true;
    moving = true;
    const card = openCard;
    await lockWhile(
      (async () => {
        const buttons = bottomButtons();
        for (const button of buttons) button.classList.add('sinking');
        card.classList.add('hiding-months');
        await still(card, ...buttons);
        for (const button of buttons) {
          button.hidden = true;
          button.classList.remove('sinking');
        }
        // The months are hidden now. When the form closes, no movement is selected.
        months.unselectAll();
        form.reset(lists);
        card.classList.add('adding');
        card.classList.remove('hiding-months');
        form.fitConcept();
        await still(formPanel);
      })(),
    );
    moving = false;
    formPanel.focus();
  }

  // Cancel closes the form and changes nothing. The same movement in reverse: the form sinks
  // away, then the months rise in from the top, and the back and "+" buttons last.
  async function closeForm() {
    if (!formOpen || moving) return;
    moving = true;
    const card = openCard;
    await lockWhile(
      (async () => {
        formPanel.classList.add('sinking');
        await still(formPanel);
        formPanel.classList.remove('sinking');
        formOpen = false;
        card.classList.remove('adding');
        const buttons = bottomButtons();
        for (const button of buttons) button.hidden = false;
        months.follow();
        await still(card, ...buttons);
      })(),
    );
    moving = false;
    addButton.focus();
  }
  document.querySelector('[data-card="cancel"]').addEventListener('click', () => closeForm());
  // Save is handled by the app (see onSave).
  const saveButton = document.querySelector('[data-card="save"]');

  // The delete question takes the place of the months in the open goal card ("asking"), with
  // the same movements as the form. No closes it and keeps the selection. Yes is handled by the
  // app (see onDelete).
  const deletePanel = document.querySelector('.delete-panel');
  const deleteQuestionText = deletePanel.querySelector('.delete-question');
  const deleteMessage = deletePanel.querySelector('.delete-message');
  const noButton = deletePanel.querySelector('[data-card="no"]');
  const noText = noButton.querySelector('.no-text');
  const yesButton = deletePanel.querySelector('[data-card="yes"]');
  let panelOpen = false;
  // True when the sheet was changed by hand: only Close is left, and it shows the sheet as it
  // is now, with nothing selected.
  let sheetChanged = false;

  async function openPanel() {
    if (panelOpen || moving || !paired || openCard?.dataset.card !== 'goal') return;
    panelOpen = true;
    moving = true;
    const card = openCard;
    await lockWhile(
      (async () => {
        const buttons = bottomButtons();
        for (const button of buttons) button.classList.add('sinking');
        card.classList.add('hiding-months');
        await still(card, ...buttons);
        for (const button of buttons) {
          button.hidden = true;
          button.classList.remove('sinking');
        }
        sheetChanged = false;
        deleteQuestionText.textContent = deleteQuestion(selectedCount);
        deleteMessage.hidden = true;
        yesButton.hidden = false;
        noText.textContent = t('no');
        card.classList.add('asking');
        card.classList.remove('hiding-months');
        await still(deletePanel);
      })(),
    );
    moving = false;
    deletePanel.focus();
  }

  // The question sinks away, then the months rise in from the top, and the buttons last. After
  // a delete ("done"), the selected movements are still there: they go once the months are
  // back. Then only "+" comes back, in the middle.
  async function closePanel({ done = false } = {}) {
    const card = openCard;
    deletePanel.classList.add('sinking');
    await still(deletePanel);
    deletePanel.classList.remove('sinking');
    panelOpen = false;
    card.classList.remove('asking');
    if (sheetChanged) months.unselectAll();
    if (done) {
      paired = false;
      addButton.classList.remove('paired');
    }
    lineUp(card);
    const buttons = bottomButtons();
    for (const button of buttons) button.hidden = false;
    months.follow();
    await still(card, ...buttons);
    if (done) await months.removeSelected();
  }

  noButton.addEventListener('click', async () => {
    if (!panelOpen || moving) return;
    moving = true;
    await lockWhile(closePanel());
    moving = false;
    addButton.focus();
  });
  deleteButton.addEventListener('click', () => openPanel());

  // After a delete the months stay as they are (the open month too) until the app shows them
  // without the deleted movements. Taps wait until then.
  let keepMonths = false;
  let monthsShown = null;
  async function deleted() {
    moving = true;
    await lockWhile(closePanel({ done: true }));
    moving = false;
    keepMonths = true;
    lockWhile(new Promise((done) => (monthsShown = done)));
  }

  // Nothing was deleted: the question stays, and says why.
  function deleteFailed() {
    deleteMessage.textContent = t('notDeleted');
    deleteMessage.hidden = false;
  }

  // The sheet was changed by hand: the message rises in, Yes sinks away, and No becomes Close.
  function deleteChanged() {
    sheetChanged = true;
    deleteMessage.textContent = t('sheetChanged');
    deleteMessage.hidden = false;
    noText.textContent = t('close');
    lockWhile(
      (async () => {
        yesButton.classList.add('sinking');
        await still(yesButton);
        yesButton.hidden = true;
        yesButton.classList.remove('sinking');
      })(),
    );
  }

  // While the movements are being deleted, No and Yes cannot be tapped. A message from the try
  // before stays until there is a new answer, so it does not blink.
  function setDeleting(deleting) {
    noButton.disabled = deleting;
    yesButton.disabled = deleting;
  }

  // The language selector on the main screen (see index.html and styles.css). Closed, it shows
  // the flag of the app's language. A tap opens it upward to show every flag. A tap on a flag
  // closes it again and picks that language.
  const picker = document.querySelector('.language-picker');
  const flagButtons = Object.entries(FLAGS).map(([language, flag]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'flag';
    button.dataset.language = language;
    button.lang = language;
    button.setAttribute('aria-label', flag.name);
    button.append(createFlag(flag, FLAG_SIZE));
    return button;
  });
  picker.querySelector('.flag-column').append(...flagButtons);
  picker.style.setProperty('--flag-count', String(flagButtons.length));
  picker.parentElement.style.setProperty('--language-width', `${CARDS.language.width}px`);
  picker.parentElement.style.setProperty('--language-height', `${CARDS.language.height}px`);
  const shield = element('picker-shield');
  let pickerOpen = false;
  // The flag in the selector's window: the app's language, or the flag just picked while the
  // selector closes (the app changes language once it has closed).
  let shownFlag = appLanguage;

  // Shows the selector open or closed, with the shown flag in its window.
  function placeFlags() {
    const index = flagButtons.findIndex((button) => button.dataset.language === shownFlag);
    picker.style.setProperty('--selected', String(index));
    picker.classList.toggle('expanded', pickerOpen);
    shield.hidden = !pickerOpen;
    for (const button of flagButtons) {
      const current = button.dataset.language === shownFlag;
      button.setAttribute('aria-current', String(current));
      // Closed, only the flag of the app's language can be tapped: it opens the selector.
      button.inert = !pickerOpen && !current;
      if (current) button.setAttribute('aria-expanded', String(pickerOpen));
      else button.removeAttribute('aria-expanded');
    }
  }
  placeFlags();

  // Opens or closes the selector. Taps wait until it has stopped moving. When it closes with
  // the keyboard focus inside it, the focus goes to the flag in the window: the other flags
  // can no longer be reached.
  function movePicker(open) {
    const focused = picker.contains(document.activeElement);
    pickerOpen = open;
    placeFlags();
    if (!open && focused) {
      flagButtons.find((button) => button.dataset.language === shownFlag).focus();
    }
    return lockWhile(nextFrame().then(() => still(picker)));
  }

  for (const button of flagButtons) {
    button.addEventListener('click', async () => {
      if (!pickerOpen) {
        movePicker(true);
        return;
      }
      // The picked flag moves into the window as the selector closes. The app changes
      // language once the selector has closed.
      shownFlag = button.dataset.language;
      await movePicker(false);
      if (shownFlag !== appLanguage) pickLanguage(shownFlag);
    });
  }

  // While the selector is open, a see-through shield covers the rest of the screen: a tap
  // anywhere else only closes the selector, without picking. For example a card under the tap
  // does not open. (A shield also works on iPhones, which send no tap for empty places.)
  // Esc closes it too, but not while something moves: like taps, it waits.
  shield.addEventListener('click', () => movePicker(false));
  document.addEventListener('keydown', (event) => {
    if (pickerOpen && event.key === 'Escape' && !page.inert) movePicker(false);
  });

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

  let shownState = null;
  function render(state) {
    shownState = state;
    if (openCard && state.screen !== 'main') putBack();
    if (pickerOpen && state.screen !== 'main') {
      pickerOpen = false;
      placeFlags();
    }
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
      canAdd = Boolean(state.canAdd);
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
      months.render(state.goal.months, { keepOpen: keepMonths });
      keepMonths = false;
      monthsShown?.();
      monthsShown = null;
      // Months built again while a card is open (after a save) need their place in the order.
      if (openCard) lineUp(openCard);
    }
  }

  // What happens when a language is picked (the app decides).
  let pickLanguage = () => {};

  // Shows the app in another language: the words, the amounts and the month names change,
  // and the screen stays as it is.
  function setLanguage(language) {
    useLanguage(language);
    shownFlag = language;
    placeFlags();
    if (!shownState) return;
    months.forget();
    render(shownState);
  }

  return {
    render,
    setLanguage,
    onSignIn: (handler) => signInButton.addEventListener('click', () => handler()),
    onSignOut: (handler) => signOutButton.addEventListener('click', () => handler()),
    onTogglePill: (handler) => (togglePill = handler),
    onPickLanguage: (handler) => (pickLanguage = handler),
    onSave: (handler) => saveButton.addEventListener('click', () => handler(form.values())),
    showMissing: (names) => form.showMissing(names),
    setSaving: (saving) => form.setSaving(saving),
    saveFailed: () => form.saveFailed(),
    closeForm,
    onDelete: (handler) =>
      yesButton.addEventListener('click', () => handler(months.selectedRows())),
    setDeleting,
    deleteFailed,
    deleteChanged,
    deleted,
    onAdd: (handler) =>
      addButton.addEventListener('click', () => {
        formAsked = true;
        handler();
      }),
    openForm,
  };
}
