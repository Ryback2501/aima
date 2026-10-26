// The month items of the open goal card: one per month of the goal, each one a panel that a
// tap opens into the list of that month's movements. Part of the view: view.js uses it, and
// only these two files change the page.
//
// The months sit in a "room" between the number and the back button. Only one month is open at
// a time. monthLayout (month-layout.js) decides the heights and how far the column of months
// moves up; the browser animates the change (styles.css). The months themselves never scroll:
// only the list inside the open month does.

import { categoryColor, categoryIcon } from './components.js';
import { monthLayout } from './month-layout.js';

// The size of the icons in a month item, in pixels.
const CALENDAR_SIZE = 28;
const ARROW_SIZE = 24;
const MOVEMENT_ICON_SIZE = 20;
const SOURCE_ICON_SIZE = 18;

// How fast a description that does not fit on one line moves to the left, in pixels per second.
export const DESCRIPTION_SPEED = 30;

// An animation that repeats without end (a long description moving) is never waited for.
export const endless = (animation) => animation.effect?.getComputedTiming().iterations === Infinity;

export function createMonths({
  document,
  room,
  createIcon,
  formatMoney,
  monthName,
  dayName,
  lockWhile,
  settled,
  reduceMotion,
}) {
  const window = document.defaultView;
  const column = room.querySelector('.month-column');
  const fadeTop = room.parentElement.querySelector('.month-fade-top');
  const fadeBottom = room.parentElement.querySelector('.month-fade-bottom');
  let items = [];
  let shown = '';
  let open = null;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // Builds one month item: the header row (calendar, amount, arrow) and its list of movements.
  function buildMonth({ year, month, amount, days }, index) {
    const item = make('div', 'month rise-in');
    const head = make('button', 'month-head');
    head.type = 'button';
    const name = monthName(year, month);
    const calendar = make('span', 'month-calendar');
    calendar.append(createIcon('calendar', CALENDAR_SIZE), make('span', 'month-letter', name[0]));
    const empty = amount === null;
    const total = make('span', 'month-amount', empty ? '--' : formatMoney(amount));
    total.toggleAttribute('data-empty', empty);
    const arrow = createIcon('chevron', ARROW_SIZE);
    arrow.classList.add('month-arrow');
    head.append(calendar, total, arrow);
    head.setAttribute('aria-label', `${name}: ${total.textContent}`);
    head.setAttribute('aria-expanded', 'false');
    head.disabled = empty;
    head.addEventListener('click', () => toggle(index));

    // Each day: its date, then its movements. The dates stay at the top while the list
    // scrolls, until the next date covers them (styles.css).
    const list = make('div', 'month-list');
    for (const { day, movements } of days) {
      list.append(make('div', 'movement-date', dayName(year, month, day)));
      for (const movement of movements) {
        const row = make('div', 'movement');
        const text = make('span', 'movement-text');
        // textContent shows the sheet's words as plain text, never as page code.
        // The description sits in a "track": when it does not fit, the track moves (see
        // fitDescriptions).
        const description = make('span', 'movement-description');
        const track = make('span', 'description-track');
        track.append(make('span', 'description-text', movement.description));
        description.append(track);
        text.append(make('span', 'movement-amount', formatMoney(movement.amount)), description);
        const icon = createIcon(
          categoryIcon(movement.category, movement.description),
          MOVEMENT_ICON_SIZE,
        );
        // The color of this kind of movement, for its icon and its soft background (styles.css).
        row.style.setProperty(
          '--movement-color',
          categoryColor(movement.category, movement.description),
        );
        row.append(icon, text);
        // Where the money came from: cash, card or bank, with the same icon as the Total.
        if (movement.source) {
          const source = createIcon(movement.source, SOURCE_ICON_SIZE);
          source.classList.add('movement-source');
          row.append(source);
        }
        list.append(row);
      }
    }
    item.append(head, list);
    return item;
  }

  // Shows the months. Nothing changes when the months are the same as before.
  function render(months) {
    const key = JSON.stringify(months);
    if (key === shown) return;
    shown = key;
    reset();
    items = months.map(buildMonth);
    column.replaceChildren(...items);
  }

  // Forgets which months are shown, so the next render builds them again, for example after
  // the language changed: the month names, the dates and the amounts then use the new language.
  function forget() {
    shown = '';
  }

  // A description that does not fit on one line moves slowly to the left without end: the
  // text, a dot, and a copy of the text, again and again. One loop moves the track exactly to
  // where the copy starts, so the copy takes the place of the text and nobody sees the jump.
  // With "reduce motion" on the phone, it stays still and ends with "…" (styles.css).
  function fitDescriptions(item) {
    stopDescriptions(item);
    if (reduceMotion()) return;
    for (const description of item.querySelectorAll('.movement-description')) {
      if (description.scrollWidth <= description.clientWidth) continue;
      const track = description.firstElementChild;
      const text = track.firstElementChild;
      const dot = make('span', 'description-dot', '•');
      const copy = make('span', 'description-text', text.textContent);
      // Screen readers read the description only once.
      dot.setAttribute('aria-hidden', 'true');
      copy.setAttribute('aria-hidden', 'true');
      track.append(dot, copy);
      description.classList.add('moving');
      const distance = copy.getBoundingClientRect().left - text.getBoundingClientRect().left;
      track.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${distance}px)` }], {
        duration: (distance / DESCRIPTION_SPEED) * 1000,
        iterations: Infinity,
        easing: 'linear',
      });
    }
  }

  // Stops the moving descriptions of a month and takes their copies away.
  function stopDescriptions(item) {
    for (const description of item.querySelectorAll('.movement-description.moving')) {
      const track = description.firstElementChild;
      for (const animation of track.getAnimations()) animation.cancel();
      track.replaceChildren(track.firstElementChild);
      description.classList.remove('moving');
    }
  }

  // How tall a month is closed (header only) and open (with every movement).
  function sizes(item) {
    const css = window.getComputedStyle(item);
    const frame =
      parseFloat(css.paddingTop) +
      parseFloat(css.paddingBottom) +
      parseFloat(css.borderTopWidth) +
      parseFloat(css.borderBottomWidth);
    const head = item.querySelector('.month-head').offsetHeight;
    const list = item.querySelector('.month-list');
    const listGap = parseFloat(window.getComputedStyle(list).marginTop);
    return { closed: frame + head, full: frame + head + listGap + list.scrollHeight };
  }

  // How far the column is moved up by the layout (while a month is open, or moving).
  let shift = 0;

  // Changes styles at once, without the animations of styles.css.
  function instantly(change) {
    room.classList.add('instant');
    change();
    void room.offsetHeight;
    room.classList.remove('instant');
  }

  // Works out the layout for the open month (or none) and puts the months there.
  function place() {
    const measured = items.map(sizes);
    const layout = monthLayout({
      heights: measured.map(({ closed }) => closed),
      gap: gap(),
      open,
      openFull: open === null ? 0 : measured[open].full,
      room: space(),
      current: shift,
      // A month's shadow reaches exactly to the next month (styles.css).
      below: gap(),
    });
    items.forEach((item, i) => {
      item.style.height = `${layout.heights[i]}px`;
      item.classList.toggle('open', i === open);
      item.querySelector('.month-head').setAttribute('aria-expanded', String(i === open));
      // A closed month always shows the start of its list next time, with its descriptions still.
      if (i !== open) {
        item.querySelector('.month-list').scrollTop = 0;
        stopDescriptions(item);
      }
    });
    shift = layout.shift;
    column.style.transform = `translateY(${-shift}px)`;
  }

  // Opens the month at index (or closes it when it is open), and lets the others move.
  // With no month open the area scrolls like a normal list. While a month is open, the layout
  // places the months instead and they cannot be scrolled by hand.
  function toggle(index) {
    if (!items.length) return;
    // The animation starts from what is on the screen now: the heights, and the scrolled
    // position, which becomes a shift of the column (it looks exactly the same).
    instantly(() => {
      for (const item of items) {
        item.style.height = `${item.offsetHeight}px`;
        // From here on each month has its own height, so its list can show inside it.
        item.classList.add('sized');
      }
      if (!room.classList.contains('placed')) {
        shift = room.scrollTop;
        room.classList.add('placed');
        room.scrollTop = 0;
        column.style.transform = `translateY(${-shift}px)`;
      }
    });

    open = open === index ? null : index;
    place();
    if (open !== null) fitDescriptions(items[open]);
    // Taps wait until the months have stopped moving. The fades follow them on every frame.
    const done = settled(room);
    lockWhile(done);
    window.requestAnimationFrame(followFades);
    // With no month open any more, the area scrolls again, from where the months are.
    if (open === null) done.then(() => open === null && backToScrolling());
  }

  // Turns the column's shift back into the area's scrolled position (it looks the same).
  function backToScrolling() {
    instantly(() => {
      room.classList.remove('placed');
      column.style.transform = '';
      room.scrollTop = shift;
      shift = 0;
    });
    updateFades();
  }

  // The fades follow the list when it is scrolled by hand.
  room.addEventListener('scroll', () => updateFades());

  // When the window changes size, the area changes size too: an open month is placed again at
  // once, and the fades are checked again.
  window.addEventListener('resize', () => {
    if (!items.length) return;
    if (open !== null) {
      instantly(place);
      fitDescriptions(items[open]);
    }
    updateFades();
  });

  // The height the months can use: the area without the room kept for the first month's shadow.
  function space() {
    return room.clientHeight - parseFloat(window.getComputedStyle(room).paddingTop);
  }

  // The space between two months. A month's shadow fills it exactly (styles.css).
  const gap = () => parseFloat(window.getComputedStyle(column).rowGap) || 0;

  // Shows a fade where a closed month, or its shadow, is cut at the top or the bottom edge of
  // the area, as it is on the screen now. A month and its shadow reach the next month, so this
  // is simply: does a closed month (with its shadow) cross the edge? Never over the open month.
  function updateFades() {
    const { top, bottom } = room.getBoundingClientRect();
    const shadow = gap();
    const cutAt = (line) =>
      items.some((item, index) => {
        if (index === open) return false;
        const box = item.getBoundingClientRect();
        return box.top < line - 0.5 && box.bottom + shadow > line + 0.5;
      });
    fadeTop.classList.toggle('visible', cutAt(top));
    fadeBottom.classList.toggle('visible', cutAt(bottom));
  }

  // While the months move, the fades are checked on every frame, until the movement ends.
  function followFades() {
    updateFades();
    const moving = room
      .getAnimations({ subtree: true })
      .some((animation) => !endless(animation) && animation.playState !== 'finished');
    if (moving) window.requestAnimationFrame(followFades);
  }

  // Puts every month back to closed at once (when the goal card closes).
  function reset() {
    open = null;
    shift = 0;
    room.classList.remove('placed');
    room.scrollTop = 0;
    for (const item of items) {
      stopDescriptions(item);
      item.style.height = '';
      item.classList.remove('open', 'sized');
      item.querySelector('.month-head').setAttribute('aria-expanded', 'false');
      item.querySelector('.month-list').scrollTop = 0;
    }
    column.style.transform = '';
    fadeTop.classList.remove('visible');
    fadeBottom.classList.remove('visible');
  }

  // Starts checking the fades on every frame until the months stop moving (for example while
  // they rise into view when the goal card opens).
  const follow = () => window.requestAnimationFrame(followFades);

  return { render, forget, reset, follow };
}
