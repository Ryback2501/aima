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
  const column = room.querySelector('.month-column');
  const fadeTop = room.querySelector('.month-fade-top');
  const fadeBottom = room.querySelector('.month-fade-bottom');
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
    const css = document.defaultView.getComputedStyle(item);
    const frame =
      parseFloat(css.paddingTop) +
      parseFloat(css.paddingBottom) +
      parseFloat(css.borderTopWidth) +
      parseFloat(css.borderBottomWidth);
    const head = item.querySelector('.month-head').offsetHeight;
    const list = item.querySelector('.month-list');
    const listGap = parseFloat(document.defaultView.getComputedStyle(list).marginTop);
    return { closed: frame + head, full: frame + head + listGap + list.scrollHeight };
  }

  // Opens the month at index (or closes it when it is open), and lets the others move.
  function toggle(index) {
    if (!items.length) return;
    // The animation starts from the heights on the screen now. From here on each month has its
    // own height ("sized"), so its list can show inside it.
    for (const item of items) {
      item.style.height = `${item.offsetHeight}px`;
      item.classList.add('sized');
    }
    void column.offsetHeight;

    open = open === index ? null : index;
    const measured = items.map(sizes);
    const layout = monthLayout({
      heights: measured.map(({ closed }) => closed),
      gap: parseFloat(document.defaultView.getComputedStyle(column).rowGap) || 0,
      open,
      openFull: open === null ? 0 : measured[open].full,
      room: room.clientHeight,
    });
    items.forEach((item, i) => {
      item.style.height = `${layout.heights[i]}px`;
      item.classList.toggle('open', i === open);
      item.querySelector('.month-head').setAttribute('aria-expanded', String(i === open));
      // A closed month always shows the start of its list next time.
      if (i !== open) item.querySelector('.month-list').scrollTop = 0;
    });
    column.style.transform = `translateY(${-layout.shift}px)`;
    fadeTop.classList.toggle('visible', layout.fadeTop);
    fadeBottom.classList.toggle('visible', layout.fadeBottom);
    room.classList.toggle('out-top', layout.outTop);
    room.classList.toggle('out-bottom', layout.outBottom);
    // Taps wait until the months have stopped moving.
    lockWhile(settled(room));
  }

  // Puts every month back to closed at once (when the goal card closes).
  function reset() {
    open = null;
    for (const item of items) {
      item.style.height = '';
      item.classList.remove('open', 'sized');
      item.querySelector('.month-head').setAttribute('aria-expanded', 'false');
      item.querySelector('.month-list').scrollTop = 0;
    }
    column.style.transform = '';
    fadeTop.classList.remove('visible');
    fadeBottom.classList.remove('visible');
    room.classList.remove('out-top', 'out-bottom');
  }

  return { render, reset };
}
