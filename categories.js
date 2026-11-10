// The icon and the color of each category, from the CATEGORIES table of the App sheet
// (issue #123). Its columns: Category, Description has, Icon, Color.
//
// - A row with nothing in "Description has" gives the look of every movement of its category.
// - A row with a text gives the look of the movements of its category whose description has
//   that text (capital letters do not matter). It wins over the row with no text. When two such
//   rows fit, the upper one wins.
// - Anything else gets the grey money bag (DEFAULT_LOOK).

// The icons a category may use (from icons.js), written exactly like this.
export const ICON_NAMES = [
  'car',
  'house',
  'housePie',
  'investing',
  'cocktail',
  'suitcase',
  'paw',
  'handshake',
  'sackEuro',
  'sackInHand',
  'cart',
  'billTransfer',
  'pumpSoap',
  'bank',
  'card',
  'cash',
  'piggyBank',
];

// The look of a movement that no row fits.
export const DEFAULT_LOOK = { icon: 'sackEuro', color: '#4b5563' };

const TABLE = 'CATEGORIES';
// # and six digits or letters from a to f, in small or capital letters.
const COLOR = /^#[0-9a-f]{6}$/i;

// A cell as a text, without the spaces around it ('' when it is empty).
const textOf = (cell) => (cell === undefined || cell === null ? '' : String(cell).trim());

// Reads the table (see app-sheet.js). Returns { value: the rules, mistakes }. Each rule is
// { category, has, icon, color }; has is '' for a row with no text.
export function readCategories(table) {
  const rules = [];
  const mistakes = [];
  const seen = new Set();
  for (const { row, cells } of table.rows) {
    const [category, has, icon, color] = [0, 1, 2, 3].map((index) => textOf(cells[index]));
    const before = mistakes.length;
    if (!icon) mistakes.push({ kind: 'iconMissing', table: TABLE, row });
    else if (!ICON_NAMES.includes(icon))
      mistakes.push({ kind: 'unknownIcon', table: TABLE, row, icon });
    if (!color) mistakes.push({ kind: 'colorMissing', table: TABLE, row });
    else if (!COLOR.test(color)) mistakes.push({ kind: 'badColor', table: TABLE, row, color });
    // The same category and text twice. For the text, capital letters do not matter.
    const key = JSON.stringify([category, has.toLowerCase()]);
    if (seen.has(key)) mistakes.push({ kind: 'categoryTwice', table: TABLE, row, category, has });
    seen.add(key);
    if (mistakes.length === before) rules.push({ category, has, icon, color });
  }
  return { value: rules, mistakes };
}

// The icon and the color of a movement, from its category and its description.
export function lookOf(rules, category, description = '') {
  const name = textOf(category);
  const words = textOf(description).toLowerCase();
  const fits =
    rules.find(
      (rule) => rule.category === name && rule.has && words.includes(rule.has.toLowerCase()),
    ) ?? rules.find((rule) => rule.category === name && !rule.has);
  return fits ? { icon: fits.icon, color: fits.color } : DEFAULT_LOOK;
}
