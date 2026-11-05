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
const WARNING_SIZE = 14;

// How fast a description that does not fit on one line moves to the left, in pixels per second.
export const DESCRIPTION_SPEED = 30;

// A finger (or the mouse button) kept this long on a movement selects it, in milliseconds,
// if it moves less than HOLD_DISTANCE pixels meanwhile. A finger that moves more is scrolling.
export const HOLD_TIME = 500;
export const HOLD_DISTANCE = 10;

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
  canSelect,
  selectionChanged,
  warningLabel,
}) {
  const window = document.defaultView;
  const column = room.querySelector('.month-column');
  const fadeTop = room.parentElement.querySelector('.month-fade-top');
  const fadeBottom = room.parentElement.querySelector('.month-fade-bottom');
  let items = [];
  let shown = '';
  // The months shown, and the places in the rows of the movements deleted since (see update).
  let shownMonths = [];
  let removed = new Set();
  let open = null;
  // True while the eye button shows the movements the goal leaves out (see showLeftOut).
  let showAll = false;
  // The days of each month item, in order: { date, rows }, the date's node and its movements'
  // nodes. A movement the goal leaves out is in leftOutRows. While they are hidden, a left-out
  // movement, and a date with only left-out movements, are taken off the page: an invisible mark
  // keeps their place, so they come back to the same place.
  const groups = new WeakMap();
  const leftOutRows = new WeakSet();
  const marks = new WeakMap();

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // Shows the amount of a month in its header, or "--" when it has no movements: then it cannot
  // be opened. Next to it, the spending of all its movements (all), which shows only while the
  // left-out movements show (styles.css), and never for a month with "--".
  function showAmount(head, name, amount, all = null) {
    const empty = amount === null;
    const total = head.querySelector('.month-amount');
    total.textContent = empty ? '--' : formatMoney(amount);
    total.toggleAttribute('data-empty', empty);
    const second = head.querySelector('.month-all');
    const noSecond = empty || all === null;
    second.textContent = noSecond ? '' : `(${formatMoney(all)})`;
    second.toggleAttribute('data-empty', noSecond);
    const said =
      showAll && !noSecond ? `${total.textContent} ${second.textContent}` : total.textContent;
    head.setAttribute('aria-label', `${name}: ${said}`);
    head.disabled = empty;
  }

  // Shows the amounts of every month again, for example after the eye button was tapped.
  function showAmounts() {
    items.forEach((item, index) => {
      const { year, month, amount, all = null } = shownMonths[index];
      showAmount(item.querySelector('.month-head'), monthName(year, month), amount, all);
    });
  }

  // The movements of a month item, in order, also the ones taken off the page.
  const rowsOf = (item) => groups.get(item).flatMap(({ rows }) => rows);

  // The nodes of a month item that show only with the eye button: the left-out movements, and
  // the dates with only left-out movements, in order.
  const leftOutNodes = (item) =>
    groups.get(item).flatMap(({ date, rows }) => {
      const left = rows.filter((row) => leftOutRows.has(row));
      return left.length === rows.length ? [date, ...left] : left;
    });

  // Takes a node off the page, leaving its mark in its place; or puts it back at its mark.
  function takeOff(node) {
    if (!node.parentNode) return;
    stopDescriptions(node);
    if (!marks.has(node)) marks.set(node, document.createComment(''));
    node.replaceWith(marks.get(node));
  }
  function putOn(node) {
    const mark = marks.get(node);
    if (!node.parentNode && mark?.parentNode) mark.replaceWith(node);
  }

  // Builds one month item: the header row (calendar, amount, arrow) and its list of movements.
  function buildMonth({ year, month, amount, all = null, days }, index) {
    const item = make('div', 'month rise-in');
    const head = make('button', 'month-head');
    head.type = 'button';
    const name = monthName(year, month);
    const calendar = make('span', 'month-calendar');
    calendar.append(createIcon('calendar', CALENDAR_SIZE), make('span', 'month-letter', name[0]));
    const arrow = createIcon('chevron', ARROW_SIZE);
    arrow.classList.add('month-arrow');
    head.append(calendar, make('span', 'month-amount'), make('span', 'month-all'), arrow);
    showAmount(head, name, amount, all);
    head.setAttribute('aria-expanded', 'false');
    head.addEventListener('click', () => toggle(index));

    // Each day: its date, then its movements. The dates stay at the top while the list
    // scrolls, until the next date covers them (styles.css).
    const list = make('div', 'month-list');
    const dates = [];
    for (const { day, movements } of days) {
      const date = make('div', 'movement-date', dayName(year, month, day));
      list.append(date);
      const rows = [];
      dates.push({ date, rows });
      for (const movement of movements) {
        const row = make('div', 'movement');
        rows.push(row);
        if (movement.leftOut) leftOutRows.add(row);
        // The movement's place in the rows read from the sheet, to delete it.
        row.dataset.row = String(movement.row);
        const text = make('span', 'movement-text');
        // textContent shows the sheet's words as plain text, never as page code.
        // The description sits in a "track": when it does not fit, the track moves (see
        // fitDescriptions).
        const description = make('span', 'movement-description');
        const track = make('span', 'description-track');
        track.append(make('span', 'description-text', movement.description));
        description.append(track);
        const total = make('span', 'movement-amount', formatMoney(movement.amount));
        // An amount with more than two decimals gets a small warning right after it, on the
        // same line. Screen readers read it as the note of the edit form.
        if (movement.extraDecimals) {
          const warning = make('span', 'amount-warning');
          warning.setAttribute('role', 'img');
          warning.setAttribute('aria-label', warningLabel());
          warning.append(createIcon('warning', WARNING_SIZE));
          const line = make('span', 'amount-line');
          line.append(total, warning);
          text.append(line, description);
        } else {
          text.append(total, description);
        }
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
    groups.set(item, dates);
    if (!showAll) for (const node of leftOutNodes(item)) takeOff(node);
    return item;
  }

  // Shows the months. Nothing changes when the months are the same as before. keepOpen (after a
  // delete): the months on the screen stay, and only their amounts change (see update).
  function render(months, { keepOpen = false } = {}) {
    const key = JSON.stringify(months);
    if (key === shown) return;
    shown = key;
    const kept = keepOpen && update(months);
    shownMonths = months;
    removed = new Set();
    if (kept) return;
    reset();
    items = months.map(buildMonth);
    column.replaceChildren(...items);
  }

  // After a delete, the months on the screen already show the movements that are left, in the
  // same places: only the amounts, and the places of the movements in the rows read from the
  // sheet, change. So the months are not built again, and nothing moves or rises in again.
  // Returns false when the new months are not the ones shown without the deleted movements (the
  // sheet was changed in other ways too): then the months are built again.
  function update(months) {
    const left = shownMonths.map((month) => {
      const days = month.days
        .map((day) => ({ ...day, movements: day.movements.filter((m) => !removed.has(m.row)) }))
        .filter((day) => day.movements.length > 0);
      // A month with only left-out movements left has no movements, like in goal.js.
      const counted = days.some(({ movements }) => movements.some((m) => !m.leftOut));
      return { ...month, days: counted ? days : [] };
    });
    // Everything but the amounts of the months and the places in the rows.
    const looks = (list) =>
      JSON.stringify(
        list.map(({ year, month, days }) => ({
          year,
          month,
          days: days.map(({ day, movements }) => ({
            day,
            // JSON leaves out a field that is undefined.
            movements: movements.map((movement) => ({ ...movement, row: undefined })),
          })),
        })),
      );
    if (looks(left) !== looks(months)) return false;
    months.forEach(({ year, month, amount, all = null, days }, index) => {
      showAmount(items[index].querySelector('.month-head'), monthName(year, month), amount, all);
      // The left-out movements of a month that has no movements any more go too: it is closed,
      // and cannot be opened.
      if (days.length === 0 && groups.get(items[index]).length > 0) {
        items[index].querySelector('.month-list').replaceChildren();
        groups.set(items[index], []);
      }
      const rows = rowsOf(items[index]);
      days
        .flatMap(({ movements }) => movements)
        .forEach((movement, at) => (rows[at].dataset.row = String(movement.row)));
    });
    return true;
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
    slide(item.querySelectorAll('.movement-description'));
  }

  // Makes these descriptions move when they do not fit (see fitDescriptions).
  function slide(descriptions) {
    if (reduceMotion()) return;
    for (const description of descriptions) {
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

  // Stops the moving descriptions of a month (or of one movement) and takes their copies away.
  function stopDescriptions(node) {
    for (const description of node.querySelectorAll('.movement-description.moving')) {
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
    return { closed: frame + head, full: frame + head + listGap + contentHeight(list) };
  }

  // How tall the movements of a list are. scrollHeight is never less than the list's own height,
  // so it cannot tell that the list needs less room (after a delete): the end of its last row
  // on the screen can.
  function contentHeight(list) {
    let last = list.lastElementChild;
    // Only while a delete measures, the last rows may be hidden.
    while (last && !last.getClientRects().length) last = last.previousElementSibling;
    if (!last || !list.getClientRects().length) return list.scrollHeight;
    const start = list.getBoundingClientRect().top + list.clientTop - list.scrollTop;
    const end =
      last.getBoundingClientRect().bottom + parseFloat(window.getComputedStyle(last).marginBottom);
    return end - start;
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

  // Selecting movements, for people who can edit the sheet. Keeping a finger (or the mouse
  // button) on a movement selects it. While one or more are selected, a tap selects another
  // one, or unselects a selected one. With nothing selected, a tap does nothing.
  let press = null;
  // The movement just selected by holding it: the tap that ends the hold does not unselect it.
  let held = null;

  const rowOf = (event) => event.target.closest('.movement');
  const selectedCount = () => column.querySelectorAll('.movement.selected').length;

  function stopPress() {
    if (!press) return;
    window.clearTimeout(press.timer);
    press = null;
  }

  column.addEventListener('pointerdown', (event) => {
    stopPress();
    held = null;
    const row = rowOf(event);
    if (!row || !canSelect() || event.button !== 0) return;
    const select = () => {
      press = null;
      held = row;
      row.classList.add('selected');
      selectionChanged(selectedCount());
    };
    const { pointerId, clientX: x, clientY: y } = event;
    press = { pointerId, x, y, timer: window.setTimeout(select, HOLD_TIME) };
  });

  column.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (distance > HOLD_DISTANCE) stopPress();
  });

  // The finger lifts, or the browser takes it to scroll the list.
  for (const type of ['pointerup', 'pointercancel']) {
    column.addEventListener(type, (event) => {
      if (press && event.pointerId === press.pointerId) stopPress();
    });
  }

  column.addEventListener('click', (event) => {
    const row = rowOf(event);
    if (!row) return;
    if (row === held) {
      held = null;
      return;
    }
    if (!canSelect() || selectedCount() === 0) return;
    row.classList.toggle('selected');
    selectionChanged(selectedCount());
  });

  // The phone's own long-press menu never opens on a movement.
  column.addEventListener('contextmenu', (event) => {
    if (rowOf(event)) event.preventDefault();
  });

  // Forgets the selection (when the new movement form opens, or the goal card closes).
  function unselectAll() {
    stopPress();
    held = null;
    for (const row of column.querySelectorAll('.movement.selected')) {
      row.classList.remove('selected');
    }
    selectionChanged(0);
  }

  // The places in the rows read from the sheet of the selected movements.
  const selectedRows = () =>
    [...column.querySelectorAll('.movement.selected')].map((row) => Number(row.dataset.row));

  // How long an animation set in styles.css takes, for animations made here.
  function timing(name) {
    const duration = parseFloat(window.getComputedStyle(room).getPropertyValue(name)) || 0;
    return { duration, easing: 'ease-in-out', fill: 'forwards' };
  }

  // The size of a node on the screen, and no size: what a node grows from or shrinks to.
  const SIDES = ['height', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'];
  const NO_SIZE = Object.fromEntries(SIDES.map((side) => [side, '0px']));
  function sizeOf(node) {
    const box = window.getComputedStyle(node);
    return Object.fromEntries(SIDES.map((side) => [side, box[side]]));
  }
  // Takes back the animations of these nodes, so they look as styles.css says again.
  const stopAnimations = (nodes) => {
    for (const node of nodes) for (const animation of node.getAnimations()) animation.cancel();
  };

  // Nodes of the open month go away: they fade out, all at once. Then, all at the same time,
  // they get shorter until they are gone, the nodes below move up, and the open month gets its
  // new height (relayout, measured without them). The browser moves the month with the same time
  // (styles.css). With "reduce motion" on the phone, all of it happens at once. The caller then
  // removes them, or takes them off the page.
  async function goAway(nodes, relayout) {
    const motion = !reduceMotion();
    if (motion) {
      const fade = timing('--pill-fade');
      await Promise.allSettled(
        nodes.map((node) => node.animate([{ opacity: 1 }, { opacity: 0 }], fade).finished),
      );
    }
    const full = motion ? nodes.map(sizeOf) : [];
    for (const node of nodes) node.style.display = 'none';
    relayout();
    if (motion) {
      const shrink = timing('--expand-time');
      await Promise.allSettled(
        nodes.map((node, index) => {
          node.style.display = '';
          return node.animate(
            [
              { ...full[index], opacity: 0, overflow: 'hidden' },
              { ...NO_SIZE, opacity: 0, overflow: 'hidden' },
            ],
            shrink,
          ).finished;
        }),
      );
    }
    for (const node of nodes) node.style.display = '';
    stopAnimations(nodes);
  }

  // Nodes come into the open month: the open month gets its new height, while they grow from no
  // size, still invisible, and the nodes below move down to make room. Then they fade in. With
  // "reduce motion" on the phone, all of it happens at once.
  async function comeIn(nodes) {
    for (const node of nodes) putOn(node);
    place();
    window.requestAnimationFrame(followFades);
    slide(nodes.flatMap((node) => [...node.querySelectorAll('.movement-description')]));
    if (reduceMotion()) return;
    const full = nodes.map(sizeOf);
    const grow = timing('--expand-time');
    const growing = nodes.map((node, index) =>
      node.animate(
        [
          { ...NO_SIZE, opacity: 0, overflow: 'hidden' },
          { ...full[index], opacity: 0, overflow: 'hidden' },
        ],
        grow,
      ),
    );
    await Promise.allSettled(growing.map((animation) => animation.finished));
    // The fade starts invisible, so nothing blinks when the growing ends.
    const fade = timing('--pill-fade');
    const fading = nodes.map((node) => node.animate([{ opacity: 0 }, { opacity: 1 }], fade));
    for (const animation of growing) animation.cancel();
    await Promise.allSettled(fading.map((animation) => animation.finished));
    stopAnimations(nodes);
  }

  // After a delete: the selected movements go away (see goAway). A date with no movement left on
  // the screen goes with them. The open month closes when it has no counted movement left.
  async function removeSelected() {
    const rows = [...column.querySelectorAll('.movement.selected')];
    for (const row of rows) removed.add(Number(row.dataset.row));
    const leaving = (row) => rows.includes(row) || !row.parentNode;
    const dates = items
      .flatMap((item) => groups.get(item))
      .filter(({ date, rows: own }) => date.parentNode && own.every(leaving))
      .map(({ date }) => date);
    await goAway([...rows, ...dates], () => {
      if (open === null) return;
      // Left-out movements alone do not keep a month open: it has no amount any more.
      const staying = [...items[open].querySelectorAll('.movement:not(.selected)')];
      if (staying.some((row) => !leftOutRows.has(row))) {
        place();
        window.requestAnimationFrame(followFades);
      } else {
        toggle(open);
      }
    });
    for (const row of rows) row.remove();
    // A date whose movements are all gone goes too. A date left with only hidden left-out
    // movements is taken off the page with them, and comes back with them.
    for (const item of items) {
      const kept = [];
      for (const group of groups.get(item)) {
        group.rows = group.rows.filter((row) => !rows.includes(row));
        if (group.rows.length === 0) {
          group.date.remove();
          continue;
        }
        kept.push(group);
        if (dates.includes(group.date)) takeOff(group.date);
      }
      groups.set(item, kept);
    }
    selectionChanged(selectedCount());
    // If the window changed size meanwhile, the open month was measured with them: once more.
    if (open !== null) place();
    await settled(room);
  }

  // The eye button: shows the movements the goal leaves out, with the spending of all movements
  // next to each month's amount (on), or hides them again. In the open month they come in or go
  // away with an animation; the other months change at once. A hidden movement is no longer
  // selected.
  async function showLeftOut(on) {
    if (on === showAll) return;
    showAll = on;
    room.classList.toggle('all', on);
    showAmounts();
    const opened = open === null ? null : items[open];
    if (!on && unselectLeftOut() > 0) selectionChanged(selectedCount());
    for (const item of items) {
      if (item === opened) continue;
      for (const node of leftOutNodes(item)) (on ? putOn : takeOff)(node);
    }
    if (opened) {
      const nodes = leftOutNodes(opened);
      if (on) {
        await comeIn(nodes);
      } else {
        await goAway(nodes, () => {
          place();
          window.requestAnimationFrame(followFades);
        });
        for (const node of nodes) takeOff(node);
        place();
      }
    }
    await settled(room);
  }

  // Hides the left-out movements at once (when the goal card closes): the eye button is off
  // every time the goal card opens.
  function hideLeftOut() {
    if (!showAll) return;
    showAll = false;
    instantly(() => room.classList.remove('all'));
    unselectLeftOut();
    for (const item of items) for (const node of leftOutNodes(item)) takeOff(node);
    showAmounts();
  }

  // Unselects the left-out movements, when they hide. Returns how many were selected.
  function unselectLeftOut() {
    const selected = items
      .flatMap(rowsOf)
      .filter((row) => leftOutRows.has(row) && row.classList.contains('selected'));
    for (const row of selected) row.classList.remove('selected');
    return selected.length;
  }

  // Puts every month back to closed at once (when the goal card closes).
  function reset() {
    unselectAll();
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

  return {
    render,
    forget,
    reset,
    follow,
    unselectAll,
    selectedRows,
    removeSelected,
    showLeftOut,
    hideLeftOut,
  };
}
