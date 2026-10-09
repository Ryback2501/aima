// The shapes of the app's icons. Each icon is one drawing: its drawing area (viewBox) and its
// shape (path). There is no size here: the place that shows an icon decides how big it is, so
// the same icon can be small in one place and big in another.

export const ICONS = {
  // A five-pointed star.
  star: {
    viewBox: '0 0 24 24',
    path: 'M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z',
  },
  // Google's "G", drawn as one shape so it can have one color.
  google: {
    viewBox: '0 0 48 48',
    path: 'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z',
  },
  // A checkered finish flag on a pole: the goal.
  flag: {
    viewBox: '0 0 24 24',
    path: 'M4 2h2v20H4z M6 3h3v3H6z M12 3h3v3h-3z M9 6h3v3H9z M15 6h3v3h-3z M6 9h3v3H6z M12 9h3v3h-3z M6 3h12v.75H6z M17.25 3H18v9h-.75z M6 11.25h12V12H6z',
  },
  // An arrow pointing left: go back.
  back: {
    viewBox: '0 0 24 24',
    path: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  },
  // A bank building with columns: the bank account.
  bank: {
    viewBox: '0 0 24 24',
    path: 'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z',
  },
  // A payment card: credit and debit cards.
  card: {
    viewBox: '0 0 24 24',
    path: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
  },
  // A piggy bank: money set aside, not to be spent.
  piggyBank: {
    viewBox: '0 0 24 24',
    path: 'M19.83 7.5l-2.27-2.27c.07-.42.18-.81.32-1.15.08-.18.12-.37.12-.58 0-.83-.67-1.5-1.5-1.5-1.64 0-3.09.79-4 2h-5C4.46 4 2 6.46 2 9.5S4.5 21 4.5 21H10v-2h2v2h5.5l1.68-5.59 2.82-.94V7.5h-2.17zM13 9H8V7h5v2zm3 2c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z',
  },
  // A stack of banknotes: cash.
  cash: {
    viewBox: '0 0 24 24',
    path: 'M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z',
  },
  // A calendar page with an empty space, for the first letter of a month.
  calendar: {
    viewBox: '0 0 24 24',
    path: 'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z',
  },
  // An arrow pointing down: open a list.
  chevron: {
    viewBox: '0 0 24 24',
    path: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  },
  // A car.
  car: {
    viewBox: '0 0 24 24',
    path: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
  },
  // A house.
  house: {
    viewBox: '0 0 24 24',
    path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  },
  // A line going up: investing.
  investing: {
    viewBox: '0 0 24 24',
    path: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  },
  // A ticket: leisure.
  ticket: {
    viewBox: '0 0 24 24',
    path: 'M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-9 7.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z',
  },
  // A plane: traveling.
  plane: {
    viewBox: '0 0 24 24',
    path: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  },
  // A paw print: the pet.
  paw: {
    viewBox: '0 0 24 24',
    path: 'M4.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm4.5-4a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm6 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm4.5 4a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm-2.16 2.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.05-1.08-1.75-1.32-.11-.04-.22-.07-.33-.09-.25-.04-.52-.04-.78-.04s-.53 0-.79.05c-.11.02-.22.05-.33.09-.7.24-1.28.78-1.75 1.32-.87 1.02-1.6 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.03 2.33 2.32.73.15 3.06-.44 5.54-.44h.18c2.48 0 4.81.58 5.54.44 1.31-.29 2.04-1.31 2.33-2.32.31-2.04-1.3-3.49-2.61-4.8z',
  },
  // A hand with a coin: paying back money owed.
  handCoin: {
    viewBox: '0 0 24 24',
    path: 'M16 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM21.45 17.6c-.39-.4-.88-.6-1.45-.6h-7l-2.08-.73.33-.94L13 16h2.8c.35 0 .63-.14.86-.37.23-.23.34-.51.34-.82 0-.54-.26-.91-.78-1.12L8.95 11H7v9l7 2 8.03-3c.01-.53-.19-1-.58-1.4zM5 11H1v11h4V11z',
  },
  // A money bag: general spending.
  moneyBag: {
    viewBox: '0 0 24 24',
    path: 'M9 2h6l-1.6 3.5h-2.8zM10.3 6.5h3.4C17.4 8.4 20 12.6 20 16a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6c0-3.4 2.6-7.6 6.3-9.5z',
  },
  // A door with an arrow going out.
  logout: {
    viewBox: '0 0 24 24',
    path: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  },
};
