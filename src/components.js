// How the app's components look: cards and pills. All sizes are in pixels.
//
// CARDS: how each card looks. A card in the page says which settings it uses with
// data-card="<name>", for example <div class="label" data-card="total">.
//
// - width, height: the outer size of the card, border included. On a narrow screen the card
//   gets narrower so it always fits. The height is the smallest height: the card grows taller
//   when its content needs more room.
// - border: how thick the colored border is.
// - radius: how round the corners are. The same size is used for the round corner of the
//   icon area in the top-left corner.
// - icon, iconSize: the icon in the top-left corner (a name from icons.js) and how big it is.
//   Without one of them the card has no corner icon area.
// - badge (optional): the size of the icon area. Without it, it is twice the radius.
// - colors: the border colors, from the top-left corner to the bottom-right corner. One color
//   gives a plain border.
// - padding: the room between the border and the content, left and right (x) and top and
//   bottom (y).

export const CARDS = {
  // The Total on the main screen.
  total: {
    width: 544,
    height: 136,
    border: 6,
    radius: 24,
    icon: 'star',
    iconSize: 26,
    colors: ['#b8860b', '#fde68a'],
    padding: { x: 24, y: 48 },
  },
  // The spending goal, below the Total.
  goal: {
    width: 544,
    height: 136,
    border: 6,
    radius: 24,
    icon: 'flag',
    iconSize: 26,
    colors: ['#15803d', '#86efac'],
    padding: { x: 24, y: 48 },
  },
  // The "Login with Google" button.
  signIn: {
    width: 320,
    height: 64,
    border: 3,
    radius: 20,
    icon: 'google',
    iconSize: 22,
    colors: ['#4285f4', '#ea4335', '#fbbc05', '#34a853'],
    padding: { x: 52, y: 12 },
  },
  // The back button of an open card. It has no corner icon: its content is the back icon.
  back: {
    width: 56,
    height: 56,
    border: 3,
    radius: 16,
    colors: ['#6b7280', '#e5e7eb'],
    padding: { x: 0, y: 0 },
  },
  // The "Log out" button.
  logOut: {
    width: 544,
    height: 64,
    border: 3,
    radius: 20,
    icon: 'logout',
    iconSize: 22,
    colors: ['#b91c1c', '#fca5a5'],
    padding: { x: 52, y: 12 },
  },
};

const px = (value) => `${value}px`;

// True when a card or pill shows an icon: it needs both the icon and its size.
export const hasIcon = ({ icon, iconSize }) => Boolean(icon && iconSize);

// Turns one card's settings into the CSS variables that the card styles (styles.css) use.
export function cardStyle({ width, height, border, radius, badge = radius * 2, colors, padding }) {
  const stops = colors.length === 1 ? [colors[0], colors[0]] : colors;
  return {
    '--width': px(width),
    '--height': px(height),
    '--border': px(border),
    '--radius': px(radius),
    '--badge-size': px(badge),
    '--pad-x': px(padding.x),
    '--pad-y': px(padding.y),
    '--label-border': `linear-gradient(to bottom right, ${stops.join(', ')})`,
  };
}

// PILLS: how each pill looks. A pill in the page says which settings it uses with
// data-pill="<name>", for example <button class="pill" data-pill="bank">. Which cell a pill
// reads, and how it counts in the Total, is in config.js.
//
// - width, height: the outer size of the pill, border included. On a narrow screen the pill
//   gets narrower so it always fits.
// - border, borderColor: how thick the thin light border is, and its color.
// - colors: the dark part of the pill when it is switched on and when it is switched off.
// - valueWidth: the width of the white part with the value, on the right. It is the same
//   whatever the value is.
// - icon, iconSize: the icon left of the name (a name from icons.js) and how big it is. It has
//   the same color as the name. Without one of them the pill has no icon.
// - padding: the room left of the icon or name (x), and around the white value part (y).

const pill = {
  width: 360,
  height: 48,
  border: 3,
  borderColor: '#e5e7eb',
  colors: { on: '#000000', off: '#6b7280' },
  valueWidth: 160,
  padding: { x: 20, y: 4 },
};

export const PILLS = {
  bank: { ...pill, icon: 'bank', iconSize: 20 },
  cards: { ...pill, icon: 'card', iconSize: 20 },
  provisioned: { ...pill, icon: 'piggyBank', iconSize: 20 },
  cash: { ...pill, icon: 'cash', iconSize: 20 },
};

// Turns one pill's settings into the CSS variables that the pill styles (styles.css) use.
export function pillStyle({ width, height, border, borderColor, colors, valueWidth, padding }) {
  return {
    '--pill-width': px(width),
    '--pill-height': px(height),
    '--pill-border': px(border),
    '--pill-border-color': borderColor,
    '--pill-on': colors.on,
    '--pill-off': colors.off,
    '--pill-value-width': px(valueWidth),
    '--pill-pad-x': px(padding.x),
    '--pill-pad-y': px(padding.y),
  };
}
