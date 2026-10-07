// How each card looks. A card in the page says which settings it uses with
// data-card="<name>", for example <div class="label" data-card="total">.
// All sizes are in pixels.
//
// - width, height: the outer size of the card, border included. On a narrow screen the card
//   gets narrower so it always fits. The height is the smallest height: the card grows taller
//   when its content needs more room.
// - border: how thick the colored border is.
// - radius: how round the corners are. The same size is used for the round corner of the
//   icon area in the top-left corner.
// - icon, iconSize: the icon in the top-left corner (a name from icons.js) and how big it is.
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
    border: 3,
    radius: 24,
    icon: 'star',
    iconSize: 26,
    colors: ['#14b8a6', '#ec4899'],
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
  // The "Log out" button.
  logOut: {
    width: 544,
    height: 64,
    border: 3,
    radius: 20,
    icon: 'logout',
    iconSize: 22,
    colors: ['#14b8a6', '#ec4899'],
    padding: { x: 52, y: 12 },
  },
};

const px = (value) => `${value}px`;

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
