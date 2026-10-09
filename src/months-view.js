// The month items of the open goal card: one per month of the goal, each one a panel that a
// tap opens into the list of that month's movements. Part of the view: view.js uses it, and
// only these two files change the page.
//
// The months sit in a "room" between the number and the back button. Only one month is open at
// a time. monthLayout (month-layout.js) decides the heights and how far the column of months
// moves up; the browser animates the change (styles.css). The months themselves never scroll:
// only the list inside the open month does.

import { categoryIcon } from './components.js';
import { monthLayout } from './month-layout.js';

// The size of the icons in a month item, in pixels.
const CALENDAR_SIZE = 28;
const ARROW_SIZE = 24;
const MOVEMENT_ICON_SIZE = 20;

export function createMonths({
  document,
  room,
  createIcon,
  formatMoney,
  monthName,
  lockWhile,
  settled,
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
  function buildMonth({ year, month, amount, movements }, index) {
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

    const list = make('div', 'month-list');
    for (const movement of movements) {
      const row = make('div', 'movement');
      const text = make('span', 'movement-text');
      // textContent shows the sheet's words as plain text, never as page code.
      text.append(
        make('span', 'movement-amount', formatMoney(movement.amount)),
        make('span', 'movement-description', movement.description),
      );
      row.append(createIcon(categoryIcon(movement.category), MOVEMENT_ICON_SIZE), text);
      list.append(row);
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
      gap: parseFloat(window.getComputedStyle(column).rowGap) || 0,
      open,
      openFull: open === null ? 0 : measured[open].full,
      room: space(),
      current: shift,
    });
    items.forEach((item, i) => {
      item.style.height = `${layout.heights[i]}px`;
      item.classList.toggle('open', i === open);
      item.querySelector('.month-head').setAttribute('aria-expanded', String(i === open));
      // A closed month always shows the start of its list next time.
      if (i !== open) item.querySelector('.month-list').scrollTop = 0;
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
    if (open !== null) instantly(place);
    updateFades();
  });

  // The height the months can use: the area without the room kept for the first month's shadow.
  function space() {
    return room.clientHeight - parseFloat(window.getComputedStyle(room).paddingTop);
  }

  // Shows a fade over a month that is cut at the top or the bottom edge of the area, as it is on
  // the screen now. Never over the open month.
  function updateFades() {
    const { top, bottom } = room.getBoundingClientRect();
    const cutAt = (line) =>
      items.some((item, index) => {
        if (index === open) return false;
        const box = item.getBoundingClientRect();
        return box.top < line - 0.5 && box.bottom > line + 0.5;
      });
    fadeTop.classList.toggle('visible', cutAt(top));
    fadeBottom.classList.toggle('visible', cutAt(bottom));
  }

  // While the months move, the fades are checked on every frame, until the movement ends.
  function followFades() {
    updateFades();
    const moving = room
      .getAnimations({ subtree: true })
      .some((animation) => animation.playState !== 'finished');
    if (moving) window.requestAnimationFrame(followFades);
  }

  // Puts every month back to closed at once (when the goal card closes).
  function reset() {
    open = null;
    shift = 0;
    room.classList.remove('placed');
    room.scrollTop = 0;
    for (const item of items) {
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

  return { render, reset, follow };
}
